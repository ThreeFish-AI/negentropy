import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { linkRuntimeAsset } from "../../../scripts/start-production.mjs";

describe("linkRuntimeAsset", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wiki-link-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { force: true, recursive: true });
  });

  it("源目录不存在时静默返回，不创建任何文件", () => {
    const missing = path.join(tmpRoot, "missing");
    const target = path.join(tmpRoot, "target");

    expect(() => linkRuntimeAsset(missing, target)).not.toThrow();
    expect(() => lstatSync(target)).toThrow();
  });

  it("目标不存在时为源建立软链，且软链指向源", () => {
    const src = path.join(tmpRoot, "src");
    mkdirSync(src);
    writeFileSync(path.join(src, "a.txt"), "hi");
    const target = path.join(tmpRoot, "target");

    linkRuntimeAsset(src, target);

    const stat = lstatSync(target);
    expect(stat.isSymbolicLink() || stat.isDirectory()).toBe(true);
    expect(readFileSync(path.join(target, "a.txt"), "utf8")).toBe("hi");
  });

  it("目标已是指向同源的软链时跳过重建，避免 cpSync 自拷贝触发 ERR_FS_CP_EINVAL", () => {
    const src = path.join(tmpRoot, "src");
    mkdirSync(src);
    writeFileSync(path.join(src, "a.txt"), "hi");
    const target = path.join(tmpRoot, "target");

    // 模拟首次启动已建立的软链
    symlinkSync(path.relative(path.dirname(target), src), target, "junction");
    const inoBefore = lstatSync(target).ino;

    // 二次启动：必须幂等，不抛错，且原软链保留（inode 不变）
    expect(() => linkRuntimeAsset(src, target)).not.toThrow();
    expect(lstatSync(target).ino).toBe(inoBefore);
  });
});
