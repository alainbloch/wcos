import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import config from "../../config/index.js";
import { getDatabase } from "../../models/database.js";
import {
  FORMAT,
  VERSION,
  MAX_FILE,
  MAX_TOTAL,
  MAX_FILES,
  sha,
  jsonBytes,
  parseJson,
  safePath,
  validateMedia,
  makeArchive,
  readArchive,
} from "./format.js";
import {
  COLLECTIONS,
  inspectSnapshot,
  mergeCollections,
  snapshotOf,
  validateDatabase,
} from "./validation.js";
const TTL = 30 * 60 * 1000;
let recoveryBlocked = false;
export const isTransferBlocked = () => recoveryBlocked;
const transferRoot = () =>
  path.join(path.dirname(path.resolve(config.dbPath)), ".wcos-transfer");
const stageRoot = () => path.join(transferRoot(), "staged");
const journalFile = () => path.join(transferRoot(), "transaction.json");
async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function privateDirectory(dir) {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
}
async function atomicJson(file, data) {
  const temp = file + ".tmp";
  await fs.writeFile(temp, jsonBytes(data), { mode: 0o600 });
  await fs.rename(temp, file);
}
export async function scanMedia() {
  const root = path.resolve(config.uploadDir),
    files = new Map();
  let total = 0;
  async function walk(directory, prefix = "") {
    if (!(await exists(directory))) return;
    if (!(await fs.lstat(directory)).isDirectory())
      throw new Error("Uploads must be a real directory, not a symlink.");
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name,
        location = path.join(directory, entry.name);
      if (entry.name === ".gitkeep" && entry.isFile()) continue;
      if (entry.isSymbolicLink())
        throw new Error(`Symlinks are not supported in uploads: ${name}`);
      if (entry.isDirectory()) {
        if (!safePath(name)) throw new Error("Unsafe uploads directory.");
        await walk(location, name + "/");
        continue;
      }
      if (!entry.isFile() || !safePath(name))
        throw new Error(`Unsafe upload: ${name}`);
      const stat = await fs.stat(location);
      total += stat.size;
      if (
        stat.size > MAX_FILE ||
        total > MAX_TOTAL ||
        files.size >= MAX_FILES - 2
      )
        throw new Error("Upload storage exceeds transfer limits.");
      const bytes = await fs.readFile(location);
      validateMedia(name, bytes);
      files.set(name, bytes);
    }
  }
  await walk(root);
  return files;
}
function fingerprint(data, media) {
  return sha(
    jsonBytes({
      data,
      files: [...media]
        .map(([name, bytes]) => [name, sha(bytes)])
        .sort(([a], [b]) => a.localeCompare(b)),
    }),
  );
}
const uploadPattern = /(^|[\s"'(=])\/uploads\/([A-Za-z0-9_%./-]+)/g;
function transformStrings(value, fn, depth = 0) {
  if (depth > 40) throw new Error("Database nesting exceeds 40 levels.");
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value))
    return value.map((item) => transformStrings(item, fn, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        transformStrings(item, fn, depth + 1),
      ]),
    );
  return value;
}
function decodeName(raw) {
  try {
    const name = decodeURIComponent(raw);
    if (!safePath(name)) throw new Error();
    return name;
  } catch {
    throw new Error("Invalid local media reference.");
  }
}
function rewrite(value, mapping) {
  return transformStrings(value, (text) =>
    text.replace(uploadPattern, (full, prefix, raw) => {
      const name = decodeName(raw);
      return mapping.has(name)
        ? `${prefix}/uploads/${mapping.get(name)}`
        : full;
    }),
  );
}
function mediaErrors(data, files) {
  const errors = [];
  for (const [key, rows] of [
    ...COLLECTIONS.map((key) => [key, data[key] || []]),
    ...Object.entries(data.dynamic?.records || {}),
  ])
    for (const row of rows) {
      transformStrings(row, (text) => {
        for (const match of text.matchAll(uploadPattern)) {
          const name = decodeName(match[2]);
          if (!files.has(name) && errors.length < 1000)
            errors.push(`${key}[${row.id}].media: missing /uploads/${name}`);
        }
        return text;
      });
    }
  return [...new Set(errors)];
}
function parseInput(bytes, archive) {
  return archive
    ? readArchive(bytes)
    : { snapshot: parseJson(bytes), media: new Map() };
}
export async function buildPlan(
  bytes,
  archive,
  mode,
  current = getDatabase().data,
  currentMedia,
) {
  currentMedia ||= await scanMedia();
  const incoming = parseInput(bytes, archive);
  const errors = inspectSnapshot(incoming.snapshot, mode);
  if (errors.length)
    return { errors, counts: [], warnings: [], mediaChanges: [] };
  // Resolve media collisions before validating relationships in the resulting database.
  const mapping = new Map(),
    mediaChanges = [];
  const finalMedia =
    archive && mode === "restore" ? new Map() : new Map(currentMedia);
  for (const [name, content] of incoming.media) {
    let target = name;
    if (finalMedia.has(name) && sha(finalMedia.get(name)) !== sha(content)) {
      const ext = path.posix.extname(name),
        directory = path.posix.dirname(name),
        base = path.posix.basename(name, ext).slice(0, 80);
      let counter = 0;
      do {
        target = path.posix.join(
          directory,
          `${base}-${sha(content).slice(0, 12)}${counter ? "-" + counter : ""}${ext}`,
        );
        counter++;
      } while (
        finalMedia.has(target) &&
        sha(finalMedia.get(target)) !== sha(content)
      );
      mapping.set(name, target);
    }
    mediaChanges.push({
      source: name,
      target,
      action:
        target !== name
          ? "Rename conflict"
          : finalMedia.has(target)
            ? "Reuse"
            : "Add",
    });
    finalMedia.set(target, content);
  }
  const adjusted = structuredClone(incoming.snapshot);
  for (const key of COLLECTIONS) {
    if (!adjusted.collections[key]) continue;
    adjusted.collections[key] = adjusted.collections[key].map((row) => {
      const skipped =
        mode === "populate" &&
        (key === "siteSettings"
          ? (current[key] || []).length
          : (current[key] || []).some((old) => old.id === row.id));
      return skipped ? row : rewrite(row, mapping);
    });
  }
  if (adjusted.system?.dynamic)
    adjusted.system.dynamic = rewrite(adjusted.system.dynamic, mapping);
  const { result, counts } = mergeCollections(current, adjusted, mode);
  errors.push(...validateDatabase(result), ...mediaErrors(result, finalMedia));
  const warnings = [];
  if (!archive)
    warnings.push(
      "JSON contains no media files. Existing uploads are retained; every local media reference must already exist.",
    );
  if (mode === "restore")
    warnings.push(
      archive
        ? "Restore replaces all records and uploaded media."
        : "Restore replaces all records but retains uploaded files.",
    );
  if (archive && mode === "restore")
    for (const name of currentMedia.keys())
      if (!finalMedia.has(name))
        mediaChanges.push({ source: name, target: "", action: "Remove" });
  warnings.push(
    "Backups contain personal data and password hashes. Keep downloaded files private.",
  );
  return {
    result,
    finalMedia,
    errors: errors.slice(0, 1000),
    counts,
    warnings,
    mediaChanges,
    fingerprint: fingerprint(current, currentMedia),
  };
}
export async function exportData(archive = false, collections = COLLECTIONS) {
  if (
    !Array.isArray(collections) ||
    !collections.length ||
    collections.some((key) => !COLLECTIONS.includes(key))
  )
    throw new Error("Select at least one valid collection to export.");
  const selected = new Set(collections);
  const snapshot = snapshotOf(getDatabase().data);
  const partial = selected.size !== COLLECTIONS.length;
  if (partial) {
    snapshot.collections = Object.fromEntries(
      Object.entries(snapshot.collections).filter(([key]) => selected.has(key)),
    );
    // Global recovery metadata belongs only in a full database backup.
    delete snapshot.system;
  }
  if (archive) {
    let media = await scanMedia();
    if (partial) {
      const needed = new Set();
      transformStrings(snapshot.collections, (text) => {
        for (const match of text.matchAll(uploadPattern))
          needed.add(decodeName(match[2]));
        return text;
      });
      const missing = [...needed].filter((name) => !media.has(name));
      if (missing.length)
        throw new Error(`Missing uploaded media: ${missing.join(", ")}`);
      media = new Map([...media].filter(([name]) => needed.has(name)));
    }
    return makeArchive(snapshot, media);
  }
  const bytes = jsonBytes(snapshot);
  if (bytes.length > MAX_FILE) throw new Error("Data export exceeds 128 MiB.");
  return bytes;
}
export async function cleanStages() {
  await privateDirectory(stageRoot());
  for (const name of await fs.readdir(stageRoot())) {
    if (!/^[a-f0-9-]+\.(json|input)$/.test(name)) continue;
    const file = path.join(stageRoot(), name);
    if (Date.now() - (await fs.stat(file)).mtimeMs > TTL)
      await fs.rm(file, { force: true });
  }
}
export async function stageImport(bytes, archive, mode, owner) {
  await cleanStages();
  if (
    (await fs.readdir(stageRoot())).filter((name) => name.endsWith(".json"))
      .length >= 20
  )
    throw new Error("Too many pending previews. They expire after 30 minutes.");
  if (bytes.length > MAX_FILE) throw new Error("Import exceeds 128 MiB.");
  const plan = await buildPlan(bytes, archive, mode);
  const publicPlan = {
    errors: plan.errors,
    counts: plan.counts,
    warnings: plan.warnings,
    mediaChanges: plan.mediaChanges,
    mode,
  };
  const token = randomUUID(),
    root = stageRoot();
  if (!plan.errors.length)
    await fs.writeFile(path.join(root, token + ".input"), bytes, {
      mode: 0o600,
      flag: "wx",
    });
  await fs.writeFile(
    path.join(root, token + ".json"),
    jsonBytes({
      owner,
      archive,
      mode,
      expires: Date.now() + TTL,
      fingerprint: plan.fingerprint,
      inputHash: sha(bytes),
      report: publicPlan,
    }),
    { mode: 0o600, flag: "wx" },
  );
  return { ...publicPlan, token };
}
async function writeMedia(directory, files) {
  await privateDirectory(directory);
  for (const [name, bytes] of files) {
    if (!safePath(name)) throw new Error("Invalid media path.");
    const file = path.join(directory, name);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await fs.writeFile(file, bytes, { mode: 0o600, flag: "wx" });
  }
}
// Recovery runs before opening lowdb. If the database commit did not complete,
// restore the original uploads and database before any request is served.
export async function recoverTransfer() {
  if (!(await exists(journalFile()))) return;
  const transaction = parseJson(await fs.readFile(journalFile()));
  const upload = path.resolve(config.uploadDir),
    parent = path.dirname(upload);
  if (!/^[a-f0-9-]+$/.test(transaction.id))
    throw new Error("Invalid transfer journal; manual recovery required.");
  const old = path.join(parent, `.wcos-import-${transaction.id}.old`),
    next = path.join(parent, `.wcos-import-${transaction.id}.new`);
  if (transaction.phase !== "committed") {
    if (await exists(old)) {
      await fs.rm(upload, { recursive: true, force: true });
      await fs.rename(old, upload);
    } else if (!transaction.hadUploads)
      await fs.rm(upload, { recursive: true, force: true });
    await atomicJson(path.resolve(config.dbPath), transaction.original);
  }
  await fs.rm(old, { recursive: true, force: true });
  await fs.rm(next, { recursive: true, force: true });
  await fs.rm(journalFile(), { force: true });
}
export async function applyImport(token, owner) {
  if (await exists(journalFile())) await recoverTransfer();
  if (!/^[a-f0-9-]{36}$/.test(token || ""))
    throw new Error("Invalid import preview.");
  const root = stageRoot(),
    metaPath = path.join(root, token + ".json"),
    inputPath = path.join(root, token + ".input");
  let meta;
  try {
    meta = parseJson(await fs.readFile(metaPath));
  } catch {
    throw new Error(
      "Preview expired or already applied. Upload the file again.",
    );
  }
  if (meta.owner !== owner || meta.expires < Date.now())
    throw new Error("Preview expired or belongs to another session.");
  if (meta.report.errors.length)
    throw new Error("Resolve validation errors before importing.");
  const bytes = await fs.readFile(inputPath);
  if (sha(bytes) !== meta.inputHash)
    throw new Error("Staged input changed. Upload again.");
  const db = getDatabase(),
    original = structuredClone(db.data),
    media = await scanMedia();
  if (fingerprint(original, media) !== meta.fingerprint)
    throw new Error(
      "Database or media changed since preview. Upload again to review the latest changes.",
    );
  const plan = await buildPlan(bytes, meta.archive, meta.mode, original, media);
  if (plan.errors.length)
    throw new Error(
      "Validation failed. Upload again for an updated error report.",
    );
  for (const user of plan.result.users) {
    const old = original.users.find((item) => item.id === user.id);
    // Preserve unchanged accounts exactly, including their session version.
    if (
      meta.mode === "restore" ||
      !old ||
      old.password !== user.password ||
      old.email !== user.email
    ) {
      user.role = "admin";
      user.authVersion = randomUUID();
    } else if (Object.hasOwn(old, "authVersion")) {
      user.authVersion = old.authVersion;
    } else {
      delete user.authVersion;
    }
  }
  const backups = path.join(transferRoot(), "backups");
  await privateDirectory(backups);
  const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.zip`;
  // Always create a complete backup before changing either the database or media.
  await fs.writeFile(
    path.join(backups, backupName),
    makeArchive(snapshotOf(original), media),
    { mode: 0o600, flag: "wx" },
  );
  const id = randomUUID(),
    upload = path.resolve(config.uploadDir),
    parent = path.dirname(upload),
    old = path.join(parent, `.wcos-import-${id}.old`),
    next = path.join(parent, `.wcos-import-${id}.new`);
  const transaction = {
    id,
    phase: "prepared",
    hadUploads: await exists(upload),
    original,
  };
  await privateDirectory(transferRoot());
  await atomicJson(journalFile(), transaction);
  try {
    await writeMedia(next, plan.finalMedia);
    if (transaction.hadUploads) await fs.rename(upload, old);
    await fs.rename(next, upload);
    db.data = plan.result;
    await db.write();
    await atomicJson(journalFile(), { ...transaction, phase: "committed" });
  } catch (error) {
    db.data = original;
    try {
      await recoverTransfer();
    } catch {
      recoveryBlocked = true;
      throw new Error(
        "Import failed and recovery needs attention. Stop the app and preserve the transfer journal and backup.",
      );
    }
    throw new Error(
      "Import failed; database and uploaded files were restored.",
    );
  }
  // A committed journal is safe to finish cleaning on next startup if cleanup fails.
  await fs.rm(metaPath, { force: true });
  await fs.rm(inputPath, { force: true });
  try {
    await recoverTransfer();
  } catch {
    /* The committed journal will finish cleanup at restart. */
  }
  return { backupName };
}
export async function listBackups() {
  const directory = path.join(transferRoot(), "backups");
  if (!(await exists(directory))) return [];
  return (await fs.readdir(directory))
    .filter((name) => /^backup-[A-Za-z0-9.-]+\.zip$/.test(name))
    .sort()
    .reverse();
}
export async function readBackup(name) {
  if (!(await listBackups()).includes(name))
    throw new Error("Backup not found.");
  return fs.readFile(path.join(transferRoot(), "backups", name));
}

export async function getPreview(token, owner) {
  if (!/^[a-f0-9-]{36}$/.test(token || "")) throw new Error("Invalid preview.");
  const meta = parseJson(
    await fs.readFile(path.join(stageRoot(), token + ".json")),
  );
  if (meta.owner !== owner || meta.expires < Date.now())
    throw new Error("Preview expired or belongs to another session.");
  return { ...meta.report, token: meta.report.errors.length ? null : token };
}
