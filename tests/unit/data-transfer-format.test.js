import { it, expect } from "@jest/globals";
import { zipSync } from "fflate";
import {
  makeArchive,
  readArchive,
  parseJson,
  MAX_TOTAL,
} from "../../src/services/dataTransfer/format.js";
import { TransferGate } from "../../src/services/dataTransfer/gate.js";
it("rejects path traversal, extra entries, bad checksums, and ZIP bombs before extraction", () => {
  expect(() => parseJson(Buffer.from('{"__proto__":{}}'))).toThrow("Unsafe");
  expect(() =>
    readArchive(Buffer.from(zipSync({ "../escape": Buffer.from("bad") }))),
  ).toThrow("Unsafe");
  const snapshot = { format: "wcos-backup", version: 1, collections: {} };
  const original = makeArchive(snapshot, new Map());
  const corrupted = Buffer.from(original);
  const at = corrupted.indexOf(Buffer.from("wcos-backup"));
  corrupted[at] = 120;
  expect(() => readArchive(corrupted)).toThrow("Checksum");
  const bomb = Buffer.from(original);
  const central = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  bomb.writeUInt32LE(MAX_TOTAL + 1, central + 24);
  expect(() => readArchive(bomb)).toThrow("limits");
  expect(() =>
    readArchive(
      Buffer.from(
        zipSync({
          "manifest.json": Buffer.from("{}"),
          "database.json": Buffer.from("{}"),
          "secrets.txt": Buffer.from("secret"),
        }),
      ),
    ),
  ).toThrow("Unexpected");
});
it("rejects symbolic links and duplicate archive names", () => {
  const original = makeArchive(
    { format: "wcos-backup", version: 1 },
    new Map(),
  );
  const link = Buffer.from(original),
    central = link.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  link.writeUInt32LE(0xa0000000, central + 38);
  expect(() => readArchive(link)).toThrow("Unsafe");
  const duplicate = Buffer.from(original);
  for (
    let at = duplicate.indexOf(Buffer.from("manifest.json"));
    at >= 0;
    at = duplicate.indexOf(Buffer.from("manifest.json"))
  )
    Buffer.from("database.json").copy(duplicate, at);
  expect(() => readArchive(duplicate)).toThrow("Unsafe");
});
it("lets reads overlap but queues new reads behind an import writer", async () => {
  const gate = new TransferGate(),
    order = [];
  const release = await gate.acquire();
  const write = gate.acquire(true).then((done) => {
    order.push("writer");
    done();
  });
  const read = gate.acquire().then((done) => {
    order.push("reader");
    done();
  });
  expect(order).toEqual([]);
  release();
  await Promise.all([write, read]);
  expect(order).toEqual(["writer", "reader"]);
});

it("does not echo malformed JSON contents into error reports", () => {
  try {
    parseJson(Buffer.from('{"password": secret-value}'));
    throw new Error("Expected validation failure");
  } catch (error) {
    expect(error.message).toContain("Invalid JSON");
    expect(error.message).not.toContain("secret-value");
  }
});
