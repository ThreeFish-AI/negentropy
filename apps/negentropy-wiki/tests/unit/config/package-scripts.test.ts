import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(testDir, "../../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};

describe("package.json scripts（纯静态化）", () => {
  it("build 走 next build（output:export 产出 out/）", () => {
    expect(packageJson.scripts?.build).toBe("next build");
  });

  it("postbuild 运行 pagefind 在 out/ 上构建搜索索引", () => {
    expect(packageJson.scripts?.postbuild).toContain("pagefind");
  });

  it("start 用静态服务器托管 out/（无 Node 服务端）", () => {
    expect(packageJson.scripts?.start).toContain("serve out");
  });

  it("不再依赖 agents-chat-core 的 prebuild 钩子", () => {
    const scripts = packageJson.scripts ?? {};
    const preHooks = Object.keys(scripts).filter((k) => k.startsWith("pre"));
    expect(preHooks).toEqual([]);
  });
});
