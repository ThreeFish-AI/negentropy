import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

describe("next.config", () => {
  it("允许头像代理路由作为受控本地图片来源", () => {
    expect(nextConfig.images?.localPatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathname: "/api/auth/avatar",
        }),
      ]),
    );
  });
});
