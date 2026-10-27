import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import config from "../config/index.js";
import { memberImageService } from "./memberImageService.js";
export async function uploadCollectionMedia(file) {
  if (!file || file.type !== "file" || !file.filename)
    throw new Error("Choose an image or video");
  if (file.mimetype.startsWith("image/"))
    return {
      type: "image",
      url: await memberImageService.save(file),
      caption: "",
    };
  const bytes = await file.toBuffer();
  if (file.file.truncated || bytes.length > config.maxFileSize)
    throw new Error("Video exceeds the upload size limit");
  let extension;
  if (
    file.mimetype === "video/mp4" &&
    bytes.length > 12 &&
    bytes.toString("ascii", 4, 8) === "ftyp"
  )
    extension = "mp4";
  if (
    file.mimetype === "video/webm" &&
    bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  )
    extension = "webm";
  if (!extension) throw new Error("Choose a valid MP4 or WebM video");
  const filename = `media-${randomUUID()}.${extension}`;
  await mkdir(config.uploadDir, { recursive: true });
  await writeFile(path.join(config.uploadDir, filename), bytes, { flag: "wx" });
  return { type: "video", url: `/uploads/${filename}`, caption: "" };
}
