/**
 * API 路由集成测试
 *
 * 测试 BFF 代理层的核心逻辑
 * 遵循 AGENTS.md 原则：反馈闭环、循证工程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/agui/route";
import { GET } from "@/app/api/agui/sessions/list/route";
import { GET as getSessionDetail } from "@/app/api/agui/sessions/[sessionId]/route";
import { POST as createSession } from "@/app/api/agui/sessions/route";

// Mock 环境变量
const mockEnv = {
  AGUI_BASE_URL: "http://localhost:8000",
  NEXT_PUBLIC_AGUI_APP_NAME: "negentropy",
  NEXT_PUBLIC_AGUI_USER_ID: "test-user",
};

/**
 * 创建 Mock Request
 */
function createMockRequest(
  url: string,
  options: RequestInit = {},
): Request {
  return new Request(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
}

describe("POST /api/agui", () => {
  beforeEach(() => {
    // 设置环境变量
    process.env.AGUI_BASE_URL = mockEnv.AGUI_BASE_URL;
    process.env.NEXT_PUBLIC_AGUI_APP_NAME = mockEnv.NEXT_PUBLIC_AGUI_APP_NAME;
    process.env.NEXT_PUBLIC_AGUI_USER_ID = mockEnv.NEXT_PUBLIC_AGUI_USER_ID;
  });

  afterEach(() => {
    // 清理环境变量
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_APP_NAME;
    delete process.env.NEXT_PUBLIC_AGUI_USER_ID;
    vi.restoreAllMocks();
  });

  it("应该返回错误当 AGUI_BASE_URL 未配置", async () => {
    delete process.env.AGUI_BASE_URL;

    const request = createMockRequest("http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=test", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "test" }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("AGUI_INTERNAL_ERROR");
    expect(data.error.message).toContain("AGUI_BASE_URL is not configured");
  });

  it("应该返回错误当 JSON 无效", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=test", {
      method: "POST",
      body: "invalid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
    expect(data.error.message).toContain("Invalid JSON body");
  });

  it("应该返回错误当缺少 session_id", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=negentropy&user_id=test", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "test" }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
    expect(data.error.message).toBe("session_id is required");
  });

  it("应该返回错误当缺少用户消息", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=test", {
      method: "POST",
      body: JSON.stringify({
        messages: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
    expect(data.error.message).toContain("RunAgentInput requires a user message");
  });

  it("遇到非法 ADK 事件时应跳过坏事件并继续输出后续合法事件", async () => {
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"author":"assistant"}',
              "",
              'data: {"id":"evt-1","author":"assistant","content":{"parts":[{"text":"hello"}]}}',
              "",
              "",
            ].join("\n"),
          ),
        );
        controller.close();
      },
    });

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(upstreamStream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      }),
    );

    const request = createMockRequest(
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=session-1",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }],
        }),
      },
    );

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("ADK_EVENT_PARSE_ERROR");
    expect(body).toContain("TEXT_MESSAGE_CONTENT");
    expect(body).toContain("hello");
  });
});

describe("GET /api/agui/sessions/list", () => {
  beforeEach(() => {
    process.env.AGUI_BASE_URL = mockEnv.AGUI_BASE_URL;
    process.env.NEXT_PUBLIC_AGUI_APP_NAME = mockEnv.NEXT_PUBLIC_AGUI_APP_NAME;
    process.env.NEXT_PUBLIC_AGUI_USER_ID = mockEnv.NEXT_PUBLIC_AGUI_USER_ID;
  });

  afterEach(() => {
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_APP_NAME;
    delete process.env.NEXT_PUBLIC_AGUI_USER_ID;
    vi.restoreAllMocks();
  });

  it("应该返回错误当 AGUI_BASE_URL 未配置", async () => {
    delete process.env.AGUI_BASE_URL;

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/list?app_name=negentropy&user_id=test");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("AGUI_INTERNAL_ERROR");
  });

  it("应该返回错误当缺少 app_name", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui/sessions/list?user_id=test");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
  });

  it("应该返回错误当缺少 user_id", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui/sessions/list?app_name=negentropy");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
  });

  it("应该按 archived 参数过滤会话列表", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          { id: "active-1", state: { metadata: {} } },
          { id: "archived-1", state: { metadata: { archived: true } } },
        ]),
    } as Response);

    const request = createMockRequest(
      "http://localhost:3000/api/agui/sessions/list?app_name=negentropy&user_id=test&archived=true"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([{ id: "archived-1", state: { metadata: { archived: true } } }]);
  });

  it("当上游 session list 结构非法时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ lastUpdateTime: 100 }]),
    } as Response);

    const request = createMockRequest(
      "http://localhost:3000/api/agui/sessions/list?app_name=negentropy&user_id=test",
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session list payload");
  });
});

describe("GET /api/agui/sessions/[sessionId]", () => {
  beforeEach(() => {
    process.env.AGUI_BASE_URL = mockEnv.AGUI_BASE_URL;
    process.env.NEXT_PUBLIC_AGUI_APP_NAME = mockEnv.NEXT_PUBLIC_AGUI_APP_NAME;
    process.env.NEXT_PUBLIC_AGUI_USER_ID = mockEnv.NEXT_PUBLIC_AGUI_USER_ID;
  });

  afterEach(() => {
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_APP_NAME;
    delete process.env.NEXT_PUBLIC_AGUI_USER_ID;
    vi.restoreAllMocks();
  });

  it("应该返回结构化 session detail", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "s1",
          lastUpdateTime: 100,
          state: { metadata: { title: "Session 1" } },
          events: [{ id: "evt-1" }],
        }),
    } as Response);

    const request = createMockRequest(
      "http://localhost:3000/api/agui/sessions/s1?app_name=negentropy&user_id=test",
    );

    const response = await getSessionDetail(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("s1");
    expect(data.events).toHaveLength(1);
  });

  it("当上游 session detail 结构非法时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ events: {} }),
    } as Response);

    const request = createMockRequest(
      "http://localhost:3000/api/agui/sessions/s1?app_name=negentropy&user_id=test",
    );

    const response = await getSessionDetail(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session detail payload");
  });
});

describe("POST /api/agui/sessions", () => {
  beforeEach(() => {
    process.env.AGUI_BASE_URL = mockEnv.AGUI_BASE_URL;
    process.env.NEXT_PUBLIC_AGUI_APP_NAME = mockEnv.NEXT_PUBLIC_AGUI_APP_NAME;
    process.env.NEXT_PUBLIC_AGUI_USER_ID = mockEnv.NEXT_PUBLIC_AGUI_USER_ID;
  });

  afterEach(() => {
    delete process.env.AGUI_BASE_URL;
    delete process.env.NEXT_PUBLIC_AGUI_APP_NAME;
    delete process.env.NEXT_PUBLIC_AGUI_USER_ID;
  });

  it("应该返回错误当 AGUI_BASE_URL 未配置", async () => {
    delete process.env.AGUI_BASE_URL;

    const request = createMockRequest("http://localhost:3000/api/agui/sessions", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await createSession(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe("AGUI_INTERNAL_ERROR");
  });

  it("应该返回错误当 JSON 无效", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui/sessions", {
      method: "POST",
      body: "invalid json",
    });

    const response = await createSession(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
  });

  it("应该返回错误当缺少 app_name", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui/sessions", {
      method: "POST",
      body: JSON.stringify({
        user_id: "test",
      }),
    });

    const response = await createSession(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
  });

  it("应该返回错误当缺少 user_id", async () => {
    const request = createMockRequest("http://localhost:3000/api/agui/sessions", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
      }),
    });

    const response = await createSession(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
  });

  it("当上游创建响应结构非法时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ lastUpdateTime: 300 }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await createSession(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session create payload");
  });
});
