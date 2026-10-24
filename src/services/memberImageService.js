import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import config from "../config/index.js";

export const memberImageService = {
  async save(file) {
    if (!file || (file.type === "file" && !file.filename)) return null;
    if (file.type !== "file" || Array.isArray(file))
      throw new Error("Choose one image file");
    const bytes = await file.toBuffer();
    if (file.file.truncated || bytes.length > config.maxFileSize)
      throw new Error("Profile image exceeds the upload size limit");
    let image;
    try {
      const input = sharp(bytes, { limitInputPixels: 40000000 });
      const metadata = await input.metadata();
      if (!["jpeg", "png", "webp", "gif"].includes(metadata.format))
        throw new Error("Unsupported image");
      // Decode and re-encode instead of trusting filenames or MIME types. Strip metadata
      // and constrain dimensions so profile images remain inexpensive to serve.
      image = await input
        .rotate()
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new Error("Choose a valid JPEG, PNG, WebP, or GIF image");
    }
    const filename = `member-${randomUUID()}.webp`;
    await mkdir(config.uploadDir, { recursive: true });
    await writeFile(path.join(config.uploadDir, filename), image, {
      flag: "wx",
    });
    return `/uploads/${filename}`;
  },
  async discard(url) {
    if (!/^\/uploads\/member-[a-f0-9-]+\.webp$/.test(url || "")) return;
    await unlink(path.join(config.uploadDir, path.basename(url)));
  },
};
