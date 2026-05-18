import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("next.config", () => {
  it("发布构件使用 standalone 输出以支撑 monorepo 可移植打包", () => {
    expect(nextConfig.output).toBe("standalone");
  });
});
