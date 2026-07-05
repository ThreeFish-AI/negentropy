import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("next.config（纯静态导出）", () => {
  it("使用 export 输出以支撑独立静态部署（无 Node 运行时）", () => {
    expect(nextConfig.output).toBe("export");
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
