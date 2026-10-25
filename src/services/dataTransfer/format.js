import { createHash } from "node:crypto";
import { zipSync, unzipSync } from "fflate";

export const FORMAT = "wcos-backup";
export const VERSION = 1;
export const MAX_FILE = 128 * 1024 * 1024;
export const MAX_TOTAL = 256 * 1024 * 1024;
export const MAX_FILES = 5000;
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2));
export function parseJson(bytes) {
  if (bytes.length > MAX_FILE)
    throw new Error("JSON exceeds the 128 MiB limit.");
  try {
    return JSON.parse(bytes.toString("utf8"), (key, value) => {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error("Unsafe JSON property.");
      return value;
    });
  } catch (error) {
    // Native JSON parser messages can quote credentials from the uploaded file.
    if (error.message === "Unsafe JSON property.") throw error;
    throw new Error(
      "Invalid JSON. Check the file syntax; no changes were applied.",
    );
  }
}
export function safePath(name) {
  return (
    typeof name === "string" &&
    name.length < 240 &&
    /^[A-Za-z0-9_./-]+$/.test(name) &&
    !name.startsWith("/") &&
    name.split("/").every((part) => part && part !== "." && part !== "..")
  );
}
export function validateMedia(name, bytes) {
  if (!safePath(name)) throw new Error(`Unsafe media path: ${name}`);
  const extension = name.split(".").pop().toLowerCase();
  const signatures = {
    png: () =>
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpg: () => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    jpeg: () => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    gif: () => ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)),
    webp: () =>
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP",
    mp4: () => bytes.toString("ascii", 4, 8) === "ftyp",
    mov: () => bytes.toString("ascii", 4, 8) === "ftyp",
    webm: () => bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])),
  };
  if (!signatures[extension]?.() || bytes.length > MAX_FILE)
    throw new Error(
      `Invalid or unsupported media file: ${name}. Use PNG, JPEG, GIF, WebP, MP4, MOV or WebM.`,
    );
}
export function makeArchive(snapshot, media) {
  const files = { "database.json": jsonBytes(snapshot) };
  for (const [name, bytes] of media) files[`uploads/${name}`] = bytes;
  const manifest = {
    format: FORMAT,
    version: VERSION,
    exportedAt: snapshot.exportedAt,
    files: Object.entries(files).map(([path, bytes]) => ({
      path,
      size: bytes.length,
      sha256: sha(bytes),
    })),
  };
  files["manifest.json"] = jsonBytes(manifest);
  if (
    Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0) >
    MAX_TOTAL
  )
    throw new Error("Archive contents exceed 256 MiB.");
  // Store already-compressed media without recompression. No timestamps or credentials in logs.
  const archive = Buffer.from(zipSync(files, { level: 0 }));
  if (archive.length > MAX_FILE)
    throw new Error(
      "Archive exceeds 128 MiB. Reduce upload storage before exporting.",
    );
  return archive;
}
export function readArchive(bytes) {
  if (bytes.length > MAX_FILE || bytes.length < 22)
    throw new Error("Invalid ZIP or archive exceeds 128 MiB.");
  // Inspect every central-directory entry before allocating decompressed buffers.
  let end = -1;
  for (
    let offset = bytes.length - 22;
    offset >= Math.max(0, bytes.length - 65557);
    offset--
  ) {
    if (
      bytes.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw new Error("Unsupported ZIP structure.");
  const count = bytes.readUInt16LE(end + 10),
    directorySize = bytes.readUInt32LE(end + 12),
    start = bytes.readUInt32LE(end + 16);
  if (
    count > MAX_FILES ||
    count !== bytes.readUInt16LE(end + 8) ||
    start + directorySize !== end
  )
    throw new Error("Unsupported ZIP directory or too many files.");
  const names = new Set();
  let cursor = start,
    total = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("Invalid ZIP directory.");
    const flags = bytes.readUInt16LE(cursor + 8),
      method = bytes.readUInt16LE(cursor + 10),
      size = bytes.readUInt32LE(cursor + 24),
      packed = bytes.readUInt32LE(cursor + 20);
    const nameSize = bytes.readUInt16LE(cursor + 28),
      extra = bytes.readUInt16LE(cursor + 30),
      comment = bytes.readUInt16LE(cursor + 32),
      attributes = bytes.readUInt32LE(cursor + 38),
      local = bytes.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameSize + extra + comment;
    if (next > end) throw new Error("Truncated ZIP directory.");
    const name = bytes.toString("utf8", cursor + 46, cursor + 46 + nameSize);
    if (
      !safePath(name) ||
      names.has(name) ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      ((attributes >>> 16) & 0xf000) === 0xa000
    )
      throw new Error("Unsafe, duplicate, encrypted or unsupported ZIP entry.");
    if (local + 30 > start || bytes.readUInt32LE(local) !== 0x04034b50)
      throw new Error("Invalid ZIP file header.");
    const localNameLength = bytes.readUInt16LE(local + 26),
      localExtra = bytes.readUInt16LE(local + 28);
    if (
      bytes.toString("utf8", local + 30, local + 30 + localNameLength) !==
        name ||
      local + 30 + localNameLength + localExtra + packed > start
    )
      throw new Error("ZIP headers disagree.");
    if (
      name !== "database.json" &&
      name !== "manifest.json" &&
      !name.startsWith("uploads/")
    )
      throw new Error(`Unexpected archive entry: ${name}`);
    total += size;
    if (size > MAX_FILE || total > MAX_TOTAL)
      throw new Error("Expanded archive exceeds limits.");
    names.add(name);
    cursor = next;
  }
  if (
    cursor !== end ||
    !names.has("database.json") ||
    !names.has("manifest.json")
  )
    throw new Error("Archive needs manifest.json and database.json.");
  const files = unzipSync(bytes);
  const manifest = parseJson(Buffer.from(files["manifest.json"]));
  if (
    manifest.format !== FORMAT ||
    manifest.version !== VERSION ||
    !Array.isArray(manifest.files)
  )
    throw new Error("Unsupported archive version.");
  const seen = new Set(["manifest.json"]);
  const media = new Map();
  for (const entry of manifest.files) {
    if (!entry || !names.has(entry.path) || seen.has(entry.path))
      throw new Error("Invalid manifest file list.");
    const content = Buffer.from(files[entry.path]);
    if (content.length !== entry.size || sha(content) !== entry.sha256)
      throw new Error(`Checksum or size mismatch: ${entry.path}`);
    seen.add(entry.path);
    if (entry.path.startsWith("uploads/")) {
      const name = entry.path.slice(8);
      validateMedia(name, content);
      media.set(name, content);
    }
  }
  if (seen.size !== names.size)
    throw new Error("Manifest must describe every archive file.");
  return { snapshot: parseJson(Buffer.from(files["database.json"])), media };
}
