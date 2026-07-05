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

  it("predev/prebuild 同步烘焙图片 content/assets/ → public/assets/", () => {
    const scripts = packageJson.scripts ?? {};
    // 烘焙图片（bake_assets=true 产出的 content/assets/）经 sync-assets.mjs 镜像到
    // public/assets/，使 dev/build/Pages 三场景图片皆可达（见 sync-assets.mjs）。
    expect(scripts.predev).toContain("sync-assets.mjs");
    expect(scripts.prebuild).toContain("sync-assets.mjs");
    // prebuild 现归图片资产同步，不得回退到 agents-chat-core 的历史 prebuild。
    expect(scripts.prebuild).not.toContain("agents-chat-core");
  });
});
