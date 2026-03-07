import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/auth/avatar/route";

describe("GET /api/auth/avatar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("缺少 src 时返回 400", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/auth/avatar"),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("src is required");
  });

  it("拒绝非白名单头像域名", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/avatar?src=https%3A%2F%2Fexample.com%2Favatar.png",
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("avatar source is not allowed");
  });

  it("成功代理 Google 头像并写入缓存头", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("avatar-binary", {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "13",
        },
      }),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/avatar?src=https%3A%2F%2Flh3.googleusercontent.com%2Fa%2Favatar",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=3600, stale-while-revalidate=86400",
    );
    expect(await response.text()).toBe("avatar-binary");
  });

  it("透传上游限流状态码", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/auth/avatar?src=https%3A%2F%2Flh3.googleusercontent.com%2Fa%2Favatar",
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Avatar upstream returned 429");
  });
});
