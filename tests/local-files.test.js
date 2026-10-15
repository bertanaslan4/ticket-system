import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  localName,
  saveLocal,
  localPath,
} from "../build/server/storage/local-files.js";
test("Local files use Istanbul date, safe names and type folders", () => {
  const date = new Date("2026-10-07T21:30:00Z");
  assert.deepEqual(localName("test123.png", date), {
    folder: "resim",
    stem: "08102026-test123",
    ext: ".png",
  });
  for (const [name, folder] of [
    ["a.xlsx", "excel"],
    ["a.docx", "word"],
    ["a.pdf", "pdf"],
    ["a.mp4", "video"],
  ])
    assert.equal(localName(name, date).folder, folder);
  assert.equal(localName("../../a:test?.pdf", date).stem.includes(".."), false);
  assert.throws(() => localPath("../outside.pdf"));
});
test("Concurrent same-name uploads never overwrite; legacy files remain readable", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-files-"));
  process.env.ATTACHMENT_DIR = join(root, "storage");
  process.env.LEGACY_ATTACHMENT_DIR = join(root, "legacy");
  try {
    const source = join(root, "source");
    await writeFile(source, "original");
    const date = new Date("2026-10-08T10:00:00Z");
    const keys = await Promise.all(
      Array.from({ length: 3 }, () => saveLocal(source, "test123.pdf", date)),
    );
    assert.equal(new Set(keys).size, 3);
    assert.ok(keys.includes("pdf/08102026-test123.pdf"));
    for (const key of keys)
      assert.equal(await readFile(localPath(key), "utf8"), "original");
    await mkdir(process.env.LEGACY_ATTACHMENT_DIR);
    await writeFile(
      join(process.env.LEGACY_ATTACHMENT_DIR, "old.pdf"),
      "legacy",
    );
    assert.equal(await readFile(localPath("old.pdf"), "utf8"), "legacy");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
