import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { syncAssets } from "../../../scripts/sync-assets.mjs";

describe("sync-assets", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "sync-assets-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("源缺失时 no-op：不抛错且清空既有目标（fixture 兜底 / Docker / CI smoke 场景）", async () => {
    const src = path.join(tmp, "missing-assets"); // 不存在
    const dest = path.join(tmp, "public", "assets");
    mkdirSync(path.join(dest, "doc-stale"), { recursive: true });
    writeFileSync(path.join(dest, "doc-stale", "stale.png"), "old");

    const result = await syncAssets(src, dest);

    expect(result).toEqual({ skipped: true, copied: 0 });
    // 陈旧目标被清空，避免 next build 把过期图片复制进 out/。
    expect(existsSync(dest)).toBe(false);
  });

  it("源存在时递归复制到目标并统计文件数", async () => {
    const srcDoc = path.join(tmp, "content", "assets", "doc1");
    mkdirSync(srcDoc, { recursive: true });
    writeFileSync(path.join(srcDoc, "a.png"), "png");
    writeFileSync(path.join(srcDoc, "b.png"), "png");
    const dest = path.join(tmp, "public", "assets");

    const result = await syncAssets(path.join(tmp, "content", "assets"), dest);

    expect(result).toEqual({ skipped: false, copied: 2 });
    expect(existsSync(path.join(dest, "doc1", "a.png"))).toBe(true);
    expect(existsSync(path.join(dest, "doc1", "b.png"))).toBe(true);
  });

  it("幂等：先清空陈旧目标再复制（等价 rsync --delete，防陈旧 doc 残留）", async () => {
    const srcDir = path.join(tmp, "content", "assets");
    mkdirSync(path.join(srcDir, "doc-new"), { recursive: true });
    writeFileSync(path.join(srcDir, "doc-new", "x.png"), "png");
    const dest = path.join(tmp, "public", "assets");
    // 预置陈旧 doc-old（模拟上一次导出存在、本次已删除的 doc）。
    mkdirSync(path.join(dest, "doc-old"), { recursive: true });
    writeFileSync(path.join(dest, "doc-old", "stale.png"), "old");

    await syncAssets(srcDir, dest);

    expect(existsSync(path.join(dest, "doc-old"))).toBe(false);
    expect(existsSync(path.join(dest, "doc-new", "x.png"))).toBe(true);
  });
});
