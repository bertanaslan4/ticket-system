import { saveLocal, localPath } from "../storage/local-files.js";
import { StorageSettings } from "../storage/storage.service.js";
import { Injectable } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { mkdir, copyFile, unlink, open } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { fail } from "../common/domain.js";

export const uploadOptions = {
  dest: tmpdir(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5,
    fields: 12,
    fieldSize: 20000,
  },
};
const allowed = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
]);
export async function cleanup(files: any[]) {
  await Promise.all(files.map((f) => unlink(f.path).catch(() => {})));
}
@Injectable()
export class AttachmentStorage {
  constructor(private readonly settings: StorageSettings) {}
  async save(files: any[]) {
    const config = await this.settings.config();
    const client =
      config.provider === "r2" ? this.settings.client(config) : undefined;
    const saved: any[] = [];
    try {
      for (const f of files) {
        const ext = extname(f.originalname).toLowerCase();
        if (!allowed.has(ext) || !f.size) fail(400, "attachment_invalid");
        const handle = await open(f.path, "r");
        const header = Buffer.alloc(16);
        try {
          await handle.read(header, 0, 16, 0);
        } finally {
          await handle.close();
        }
        const hex = header.toString("hex"),
          ascii = header.toString("latin1");
        const valid =
          ext === ".pdf"
            ? ascii.startsWith("%PDF-")
            : [".docx", ".xlsx"].includes(ext)
              ? hex.startsWith("504b0304")
              : [".doc", ".xls"].includes(ext)
                ? hex.startsWith("d0cf11e0a1b11ae1")
                : ext === ".png"
                  ? hex.startsWith("89504e470d0a1a0a")
                  : [".jpg", ".jpeg"].includes(ext)
                    ? hex.startsWith("ffd8ff")
                    : ext === ".gif"
                      ? /^GIF8[79]a/.test(ascii)
                      : ext === ".webp"
                        ? ascii.startsWith("RIFF") &&
                          ascii.slice(8, 12) === "WEBP"
                        : ext === ".webm"
                          ? hex.startsWith("1a45dfa3")
                          : ascii.slice(4, 8) === "ftyp";
        if (!valid) fail(400, "attachment_invalid");
        const item = {
          id: randomUUID(),
          storage: config.provider,
          object_key: randomUUID() + ext,
          name: Buffer.from(f.originalname, "latin1")
            .toString("utf8")
            .replace(/[\x00-\x1f\x7f/\\]/g, "_")
            .slice(0, 200),
          size: f.size,
        };
        if (client) {
          saved.push(item);
          await client.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: item.object_key,
              Body: createReadStream(f.path),
              ContentLength: f.size,
              ContentType: "application/octet-stream",
            }),
          );
        } else {
          item.object_key = await saveLocal(f.path, item.name);
          saved.push(item);
        }
      }
      return saved;
    } catch (error) {
      await this.remove(saved);
      throw error;
    } finally {
      client?.destroy();
    }
  }
  async remove(items: any[]) {
    const config = await this.settings.config();
    const client = config.account ? this.settings.client(config) : undefined;
    await Promise.all(
      items.map(async (a) => {
        try {
          if (a.storage === "r2")
            await client?.send(
              new DeleteObjectCommand({
                Bucket: config.bucket,
                Key: a.object_key,
              }),
            );
          else await unlink(localPath(a.object_key));
        } catch {
          console.error("Attachment cleanup failed", a.id);
        }
      }),
    );
    client?.destroy();
  }
  async read(a: any) {
    if (a.storage === "local") return createReadStream(localPath(a.object_key));
    const config = await this.settings.config();
    if (!config.account) fail(503, "attachment_storage_unavailable");
    const client = this.settings.client(config);
    const result = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: a.object_key }),
    );
    const stream = result.Body as any;
    stream.once("close", () => client.destroy());
    return stream;
  }
}
