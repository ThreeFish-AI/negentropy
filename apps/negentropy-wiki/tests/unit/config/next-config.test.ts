import { describe, expect, it, vi } from "vitest";

import nextConfig from "../../../next.config";

// next.config 在模块加载时读取 process.env.NODE_ENV 决定是否静态导出：
// 仅生产（production）设 `output: "export"`；dev/test 不设，以免 SSG 路由严格化把
// public/ 静态资源（如 /assets/{doc}/{file}）误派给 catch-all 路由并 500。
// 故用「重置模块缓存 + 覆写 NODE_ENV + 动态导入」分别验证生产与非生产两条分支。
async function loadConfigWithEnv(nodeEnv: string) {
  const env = process.env as Record<string, string | undefined>;
  const prev = env.NODE_ENV;
  vi.resetModules();
  env.NODE_ENV = nodeEnv;
  try {
    return (await import("../../../next.config")).default;
  } finally {
    if (prev === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = prev;
  }
}

describe("next.config（生产静态导出 / dev 非导出）", () => {
  it("生产构建启用 export 输出以支撑独立静态部署（无 Node 运行时）", async () => {
    const cfg = await loadConfigWithEnv("production");
    expect(cfg.output).toBe("export");
  });

  it("dev（非生产）不设 output:export，避免 SSG 路由严格化把 public 静态资源误派 catch-all 路由并 500", async () => {
    const cfg = await loadConfigWithEnv("development");
    expect(cfg.output).toBeUndefined();
  });

  it("启用 trailingSlash，为 catch-all 路由产出目录式 HTML，对静态托管友好", () => {
    expect(nextConfig.trailingSlash).toBe(true);
  });

  it("图片不经过 Next.js 优化（markdown 走 GCS 直链）", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  it("不再配置 rewrites（纯静态，无运行时 API 代理）", () => {
    expect(nextConfig.rewrites).toBeUndefined();
  });
});
