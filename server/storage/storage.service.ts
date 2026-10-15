import {localRoot} from './local-files.js';
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail } from "../common/domain.js";
import { audit } from "../common/admin-domain.js";
import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
@Injectable()
export class StorageSettings {
  constructor(private readonly db: DatabaseService) {}
  private async key(create = false) {
    if (process.env.STORAGE_MASTER_KEY) {
      const key = Buffer.from(process.env.STORAGE_MASTER_KEY, "hex");
      if (key.length !== 32) throw Error("Invalid STORAGE_MASTER_KEY");
      return key;
    }
    const path = resolve(
      process.env.STORAGE_KEY_FILE || "data/storage-master.key",
    );
    if (create) {
      await mkdir(dirname(path), { recursive: true });
      try {
        await writeFile(path, randomBytes(32), { flag: "wx", mode: 0o600 });
      } catch (e: any) {
        if (e.code !== "EEXIST") throw e;
      }
    }
    const key = await readFile(path);
    if (key.length !== 32) throw Error("Invalid storage key");
    return key;
  }
  private async encrypt(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", await this.key(true), iv);
    const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }
  private async decrypt(value: string) {
    const raw = Buffer.from(value, "base64"),
      cipher = createDecipheriv(
        "aes-256-gcm",
        await this.key(),
        raw.subarray(0, 12),
      );
    cipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([
      cipher.update(raw.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
  async config() {
    const row = (
      await this.db.query("SELECT * FROM storage_settings WHERE id=1")
    ).rows[0];
    if (row)
      return {
        ...JSON.parse(await this.decrypt(row.config)),
        version: row.version,
        checked_at: row.checked_at,
      };
    return {
      provider: process.env.ATTACHMENT_STORAGE || "local",
      account: process.env.R2_ACCOUNT_ID || "",
      bucket: process.env.R2_BUCKET || "",
      accessKey: process.env.R2_ACCESS_KEY_ID || "",
      secret: process.env.R2_SECRET_ACCESS_KEY || "",
      version: 0,
      checked_at: null,
    };
  }
  client(c: any) {
    return new S3Client({
      region: "auto",
      endpoint: `https://${c.account}.r2.cloudflarestorage.com`,
      maxAttempts: 1,
      credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secret },
    });
  }
  async candidate(body: any) {
    const old = await this.config();
    if (
      !body ||
      !["local", "r2"].includes(body.provider) ||
      body.version !== old.version
    )
      fail(409, "storage_settings_conflict");
    const c = {
      provider: body.provider,
      account: String(body.account || "").trim(),
      bucket: String(body.bucket || "").trim(),
      accessKey: String(body.accessKey || old.accessKey).trim(),
      secret: String(body.secret || old.secret).trim(),
    };
    if (
      c.provider === "r2" ||
      c.account ||
      c.bucket ||
      c.accessKey ||
      c.secret
    ) {
      if (
        !/^[a-f0-9]{32}$/.test(c.account) ||
        !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(c.bucket) ||
        !c.accessKey ||
        !c.secret ||
        c.accessKey.length > 256 ||
        c.secret.length > 256
      )
        fail(400, "storage_settings_invalid");
    }
    // Keep existing object locations stable, including uploads currently in flight.
    if (
      old.account &&
      old.bucket &&
      (c.account !== old.account || c.bucket !== old.bucket)
    )
      fail(409, "storage_destination_locked");
    return c;
  }
  async probe(c: any) {
    const start = Date.now();
    if (c.provider !== "r2") {
      const root = localRoot(),
        path = resolve(root, ".check-" + randomUUID());
      let ok = false;
      try {
        await mkdir(root, { recursive: true });
        await writeFile(path, "check", { flag: "wx" });
        ok = (await readFile(path, "utf8")) === "check";
      } catch {
      } finally {
        try {
          await unlink(path);
        } catch {
          ok = false;
        }
      }
      return {
        ok,
        latency_ms: Date.now() - start,
        checked_at: new Date().toISOString(),
        provider: "local",
        errorKey: ok ? null : "storage_connection_failed",
      };
    }
    const client = this.client(c),
      key = "connection-check/" + randomUUID(),
      content = "Ticket storage connection check";
    let written = false,
      ok = false,
      clean = true;
    try {
      await client.send(
        new PutObjectCommand({ Bucket: c.bucket, Key: key, Body: content }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      written = true;
      const response = await client.send(
        new GetObjectCommand({ Bucket: c.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      ok = (await response.Body?.transformToString()) === content;
    } catch {
      ok = false;
    } finally {
      if (written)
        try {
          await client.send(
            new DeleteObjectCommand({ Bucket: c.bucket, Key: key }),
            { abortSignal: AbortSignal.timeout(15000) },
          );
        } catch {
          clean = false;
        }
      client.destroy();
    }
    return {
      ok: ok && clean,
      latency_ms: Date.now() - start,
      checked_at: new Date().toISOString(),
      provider: "r2",
      errorKey: !clean
        ? "storage_cleanup_failed"
        : ok
          ? null
          : "storage_connection_failed",
    };
  }
  async test(body: any) {
    return this.probe(await this.candidate(body));
  }
  async save(body: any, user: any) {
    const c = await this.candidate(body),
      result = await this.probe(c);
    if (!result.ok) fail(400, result.errorKey || "storage_connection_failed");
    const encrypted = await this.encrypt(JSON.stringify(c));
    await this.db.transaction(async (tx) => {
      await tx.query("LOCK TABLE storage_settings IN EXCLUSIVE MODE");
      const row = (
        await tx.query("SELECT version FROM storage_settings WHERE id=1")
      ).rows[0];
      if ((row?.version || 0) !== body.version)
        fail(409, "storage_settings_conflict");
      await tx.query(
        "INSERT INTO storage_settings(id,config,version,checked_at) VALUES(1,$1,1,$2) ON CONFLICT(id) DO UPDATE SET config=$1,version=storage_settings.version+1,checked_at=$2",
        [encrypted, result.checked_at],
      );
      await audit(tx, user, "storage_settings_updated", 1, {
        provider: c.provider,
      });
    });
    return this.status();
  }
  async status() {
    const c = await this.config();
    const usage = (
      await this.db.query(
        "SELECT storage, count(*)::int files, COALESCE(sum(size),0)::text bytes FROM attachments GROUP BY storage",
      )
    ).rows;
    return {
      provider: c.provider,
      account: c.account,
      bucket: c.bucket,
      hasCredentials: !!(c.accessKey && c.secret),
      version: c.version,
      checked_at: c.checked_at,
      uptime_seconds: Math.floor(process.uptime()),
      database_ok: true,
      usage,
    };
  }
}
