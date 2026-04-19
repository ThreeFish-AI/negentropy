import { afterEach, describe, expect, it } from "vitest";
import {
  buildSessionArchiveUpstreamUrl,
  buildSessionCreateUpstreamUrl,
  buildSessionDetailUpstreamUrl,
  buildSessionListUpstreamUrl,
  buildSessionTitleUpstreamUrl,
  parseSessionCreateBody,
  parseSessionListQuery,
  parseSessionQueryScope,
  parseSessionScopeBody,
  parseSessionTitleBody,
  buildSessionUpstreamHeaders,
  buildSessionUnarchiveUpstreamUrl,
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

  it("在所有 base url env 均缺失时回落到默认端口 :3292", () => {
    expect(getSessionAguiBaseUrl()).toBe("http://localhost:3292");
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

  it("应构造 collection 级 session upstream URL", () => {
    const baseUrl = "http://internal-agui/";
    expect(
      buildSessionListUpstreamUrl(baseUrl, {
        appName: "negentropy app",
        userId: "user/1",
      }).toString(),
    ).toBe("http://internal-agui/apps/negentropy%20app/users/user%2F1/sessions");
    expect(
      buildSessionCreateUpstreamUrl("http://internal-agui", {
        appName: "negentropy app",
        userId: "user/1",
      }).toString(),
    ).toBe("http://internal-agui/apps/negentropy%20app/users/user%2F1/sessions");
  });

  it("应构造 item 级 session upstream URL 及动作变体", () => {
    const baseUrl = "http://internal-agui/";
    const target = {
      appName: "negentropy app",
      userId: "user/1",
      sessionId: "session a/b",
    };

    expect(buildSessionDetailUpstreamUrl(baseUrl, target).toString()).toBe(
      "http://internal-agui/apps/negentropy%20app/users/user%2F1/sessions/session%20a%2Fb",
    );
    expect(buildSessionArchiveUpstreamUrl(baseUrl, target).toString()).toBe(
      "http://internal-agui/apps/negentropy%20app/users/user%2F1/sessions/session%20a%2Fb/archive",
    );
    expect(buildSessionTitleUpstreamUrl(baseUrl, target).toString()).toBe(
      "http://internal-agui/apps/negentropy%20app/users/user%2F1/sessions/session%20a%2Fb/title",
    );
    expect(buildSessionUnarchiveUpstreamUrl(baseUrl, target).toString()).toBe(
      "http://internal-agui/apps/negentropy%20app/users/user%2F1/sessions/session%20a%2Fb/unarchive",
    );
  });

  it("应解析 query scope 并校验必填字段", async () => {
    const ok = parseSessionQueryScope(
      new Request("http://localhost/api/agui/sessions/s1?app_name=negentropy&user_id=user-1"),
    );
    expect(ok).toEqual({ appName: "negentropy", userId: "user-1" });

    const invalid = parseSessionQueryScope(
      new Request("http://localhost/api/agui/sessions/s1?app_name=negentropy"),
    );
    expect(invalid).toBeInstanceOf(Response);
    const response = invalid as Response;
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.message).toBe("app_name and user_id are required");
  });

  it("应归一化 list query 的 archived 字段", () => {
    expect(
      parseSessionListQuery(
        new Request("http://localhost/api/agui/sessions/list?app_name=negentropy&user_id=user-1&archived=true"),
      ),
    ).toEqual({ appName: "negentropy", userId: "user-1", archived: true });

    expect(
      parseSessionListQuery(
        new Request("http://localhost/api/agui/sessions/list?app_name=negentropy&user_id=user-1&archived=false"),
      ),
    ).toEqual({ appName: "negentropy", userId: "user-1", archived: false });

    expect(
      parseSessionListQuery(
        new Request("http://localhost/api/agui/sessions/list?app_name=negentropy&user_id=user-1&archived=maybe"),
      ),
    ).toEqual({ appName: "negentropy", userId: "user-1", archived: undefined });
  });

  it("应解析 scope body 并处理非法 JSON", async () => {
    const ok = await parseSessionScopeBody(
      new Request("http://localhost/api/agui/sessions/s1/archive", {
        method: "POST",
        body: JSON.stringify({ app_name: "negentropy", user_id: "user-1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(ok).toEqual({ appName: "negentropy", userId: "user-1" });

    const invalid = await parseSessionScopeBody(
      new Request("http://localhost/api/agui/sessions/s1/archive", {
        method: "POST",
        body: "invalid-json",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(invalid).toBeInstanceOf(Response);
    const response = invalid as Response;
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.message).toContain("Invalid JSON body");
  });

  it("应解析 create body 并保留可选字段", async () => {
    const result = await parseSessionCreateBody(
      new Request("http://localhost/api/agui/sessions", {
        method: "POST",
        body: JSON.stringify({
          app_name: "negentropy",
          user_id: "user-1",
          session_id: "s1",
          state: { ready: true },
          events: [{ id: "e1" }],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(result).toEqual({
      appName: "negentropy",
      userId: "user-1",
      sessionId: "s1",
      state: { ready: true },
      events: [{ id: "e1" }],
    });
  });

  it("应解析 title body 并将缺失 title 归一化为 null", async () => {
    const result = await parseSessionTitleBody(
      new Request("http://localhost/api/agui/sessions/s1/title", {
        method: "PATCH",
        body: JSON.stringify({
          app_name: "negentropy",
          user_id: "user-1",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(result).toEqual({
      appName: "negentropy",
      userId: "user-1",
      title: null,
    });
  });
});
