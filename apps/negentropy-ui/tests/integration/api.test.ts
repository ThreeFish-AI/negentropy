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
import { GET as getRunStream } from "@/app/api/agui/runs/[runId]/stream/route";
import { POST as createSession } from "@/app/api/agui/sessions/route";
import { POST as archiveSession } from "@/app/api/agui/sessions/[sessionId]/archive/route";
import { PATCH as updateSessionTitle } from "@/app/api/agui/sessions/[sessionId]/title/route";
import { POST as unarchiveSession } from "@/app/api/agui/sessions/[sessionId]/unarchive/route";

// Mock 环境变量
const mockEnv = {
  AGUI_BASE_URL: "http://localhost:6600",
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
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001", {
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

  it("遇到整条非法 ADK 事件时应发出错误事件并继续输出后续合法事件", async () => {
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
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001",
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

  it("应将不同 payload id 的 assistant 文本块归并为单条 streaming 生命周期", async () => {
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"id":"chunk-1","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"text":"我可以帮助你规划任务"}]},"timestamp":1000}',
              "",
              'data: {"id":"chunk-2","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"text":"我可以帮助你规划任务、分析代码并直接修改实现。"}]},"timestamp":1001}',
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
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "你能帮我做什么？" }],
        }),
      },
    );

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect((body.match(/TEXT_MESSAGE_START/g) || [])).toHaveLength(1);
    expect((body.match(/chunk-2/g) || [])).toHaveLength(0);
    expect(body).toContain("chunk-1");
    expect(body).toContain("我可以帮助你规划任务、分析代码并直接修改实现。");
  });

  it("应输出并行工具调用与结果，且不同 toolCallId 不串线", async () => {
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"id":"assistant-1","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"text":"好的，我将使用 Google Search。"}]},"timestamp":1000}',
              "",
              'data: {"id":"tool-batch","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"functionCall":{"id":"call-1","name":"google_search","args":{"q":"AfterShip"}}},{"functionCall":{"id":"call-2","name":"web_search","args":{"q":"AfterShip tracking"}}}]},"timestamp":1001}',
              "",
              'data: {"id":"tool-result-batch","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"functionResponse":{"id":"call-1","name":"google_search","response":{"result":{"items":[{"title":"AfterShip"}]}}}},{"functionResponse":{"id":"call-2","name":"web_search","response":{"result":{"items":[{"title":"Tracking"}]}}}}]},"timestamp":1002}',
              "",
              'data: {"id":"assistant-2","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"text":"## 摘要"}]},"timestamp":1003}',
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
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "AfterShip 是什么？" }],
        }),
      },
    );

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect((body.match(/TOOL_CALL_START/g) || [])).toHaveLength(2);
    expect((body.match(/TOOL_CALL_RESULT/g) || [])).toHaveLength(2);
    expect(body).toContain("\"toolCallId\":\"call-1\"");
    expect(body).toContain("\"toolCallId\":\"call-2\"");
    expect(body).toContain("AfterShip");
    expect(body).toContain("Tracking");
    expect(body).toContain("## 摘要");
  });

  it("应兼容 event envelope 与 typed step 事件", async () => {
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"id":"env-1","runId":"run-1","threadId":"session-1","event":{"author":"assistant","content":{"parts":[{"text":"先进行搜索"}]}}}',
              "",
              'data: {"id":"env-step","runId":"run-1","threadId":"session-1","type":"step_started","data":{"id":"step-1","name":"Google Search"}}',
              "",
              'data: {"id":"env-tool","runId":"run-1","threadId":"session-1","payload":{"author":"assistant","content":{"parts":[{"functionCall":{"id":"call-1","name":"google_search","args":{"q":"AfterShip"}}}]}}}',
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
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "AfterShip 是什么？" }],
        }),
      },
    );

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("先进行搜索");
    expect(body).toContain("STEP_STARTED");
    expect(body).toContain("\"toolCallId\":\"call-1\"");
  });

  it("应在 Accept 为 NDJSON 时输出带 cursor 的 JSONL 帧", async () => {
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"id":"evt-1","runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"text":"hello"}]}}',
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
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
      },
    );

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(body).toContain("\"protocol\":\"negentropy.ndjson.v1\"");
    expect(body).toContain("\"kind\":\"agui_event\"");
    expect(body).toContain("\"cursor\":\"");
    expect(body).toContain("\"type\":\"RUN_FINISHED\"");
  });

  it("应解析 CRLF 和多行 data 的 SSE 事件", async () => {
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"id":"evt-1",',
              'data: "runId":"run-1","threadId":"session-1","author":"assistant","content":{"parts":[{"text":"hello crlf"}]}}',
              "\r",
              "",
            ].join("\r\n"),
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
      "http://localhost:3000/api/agui?app_name=negentropy&user_id=test&session_id=00000000-0000-0000-0000-000000000001",
      {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
      },
    );

    const response = await POST(request);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("hello crlf");
    expect(body).toContain("RUN_FINISHED");
  });
});

describe("GET /api/agui/runs/[runId]/stream", () => {
  beforeEach(() => {
    process.env.AGUI_BASE_URL = mockEnv.AGUI_BASE_URL;
  });

  afterEach(() => {
    delete process.env.AGUI_BASE_URL;
    vi.restoreAllMocks();
  });

  it("应按 cursor 回放指定 run 的后续事件", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          id: "session-1",
          lastUpdateTime: 100,
          state: { metadata: {} },
          events: [
            {
              id: "evt-1",
              runId: "run-1",
              threadId: "session-1",
              author: "assistant",
              content: { parts: [{ text: "resume text" }] },
              timestamp: 1000,
            },
          ],
        }),
    } as Response);

    const request = createMockRequest(
      "http://localhost:3000/api/agui/runs/run-1/stream?app_name=negentropy&user_id=test&session_id=session-1&cursor=run-1:1&resume_token=run-1:1",
      {
        method: "GET",
        headers: {
          Accept: "application/x-ndjson",
        },
      },
    );

    const response = await getRunStream(request, {
      params: Promise.resolve({ runId: "run-1" }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(body).toContain("resume text");
    expect(body).toContain("\"type\":\"RUN_FINISHED\"");
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

describe("Session mutation proxy routes", () => {
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

  it("archive 成功时应返回结构化 ACK", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", archived: true }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/archive", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await archiveSession(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok", archived: true });
  });

  it("archive 非法 payload 时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/archive", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await archiveSession(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session archive payload");
  });

  it("archive 非法 JSON 时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "not-json",
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/archive", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await archiveSession(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session archive JSON");
  });

  it("unarchive 成功时应返回结构化 ACK", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", archived: false }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/unarchive", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await unarchiveSession(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok", archived: false });
  });

  it("unarchive 非法 payload 时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", archived: "nope" }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/unarchive", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await unarchiveSession(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session unarchive payload");
  });

  it("unarchive 非法 JSON 时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "not-json",
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/unarchive", {
      method: "POST",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
      }),
    });

    const response = await unarchiveSession(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session unarchive JSON");
  });

  it("title 成功时应返回结构化 ACK", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", title: "Renamed" }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/title", {
      method: "PATCH",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
        title: "Renamed",
      }),
    });

    const response = await updateSessionTitle(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "ok", title: "Renamed" });
  });

  it("title 非法 payload 时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/title", {
      method: "PATCH",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
        title: "Renamed",
      }),
    });

    const response = await updateSessionTitle(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session title payload");
  });

  it("title 非法 JSON 时应返回结构化错误", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "not-json",
    } as Response);

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/s1/title", {
      method: "PATCH",
      body: JSON.stringify({
        app_name: "negentropy",
        user_id: "test",
        title: "Renamed",
      }),
    });

    const response = await updateSessionTitle(request, {
      params: Promise.resolve({ sessionId: "s1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error.code).toBe("AGUI_UPSTREAM_ERROR");
    expect(data.error.message).toContain("Invalid upstream session title JSON");
  });
});
