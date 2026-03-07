import { afterEach, describe, expect, it } from "vitest";
import {
  buildSessionUpstreamHeaders,
  getSessionAguiBaseUrl,
} from "@/app/api/agui/sessions/_request";

describe("session request helpers", () => {
  afterEach(() => {
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_BASE_URL;
  });

  it("应优先使用 AGUI_BASE_URL", () => {
    process.env.AGUI_BASE_URL = "http://internal-agui";
    process.env.NEXT_PUBLIC_AGUI_BASE_URL = "http://public-agui";

    expect(getSessionAguiBaseUrl()).toBe("http://internal-agui");
  });

  it("在 AGUI_BASE_URL 缺失时回退到 NEXT_PUBLIC_AGUI_BASE_URL", () => {
    process.env.NEXT_PUBLIC_AGUI_BASE_URL = "http://public-agui";

    expect(getSessionAguiBaseUrl()).toBe("http://public-agui");
  });

  it("在 base url 缺失时返回结构化内部错误", async () => {
    const result = getSessionAguiBaseUrl();

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error.code).toBe("AGUI_INTERNAL_ERROR");
    expect(data.error.message).toContain("AGUI_BASE_URL is not configured");
  });

  it("json-read header 应透传鉴权并补齐 Accept", () => {
    const request = new Request("http://localhost/api/agui/sessions/list", {
      headers: {
        cookie: "sid=1",
        authorization: "Bearer token",
      },
    });

    const headers = new Headers(buildSessionUpstreamHeaders(request, "json-read"));
    expect(headers.get("cookie")).toBe("sid=1");
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBeNull();
  });

  it("json-write header 应透传鉴权并补齐 Content-Type", () => {
    const request = new Request("http://localhost/api/agui/sessions", {
      headers: {
        cookie: "sid=1",
        authorization: "Bearer token",
      },
    });

    const headers = new Headers(buildSessionUpstreamHeaders(request, "json-write"));
    expect(headers.get("cookie")).toBe("sid=1");
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBeNull();
  });
});
