/**
 * API 路由集成测试
 *
 * 测试 BFF 代理层的核心逻辑
 * 遵循 AGENTS.md 原则：反馈闭环、循证工程
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/agui/route";
import { GET } from "@/app/api/agui/sessions/list/route";
import { POST as createSession } from "@/app/api/agui/sessions/route";

// Mock 环境变量
const mockEnv = {
  AGUI_BASE_URL: "http://localhost:8000",
  NEXT_PUBLIC_AGUI_APP_NAME: "agents",
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
  });

  it("应该返回错误当 AGUI_BASE_URL 未配置", async () => {
    delete process.env.AGUI_BASE_URL;

    const request = createMockRequest("http://localhost:3000/api/agui?app_name=agents&user_id=test&session_id=test", {
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
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=agents&user_id=test&session_id=test", {
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
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=agents&user_id=test", {
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
    const request = createMockRequest("http://localhost:3000/api/agui?app_name=agents&user_id=test&session_id=test", {
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
  });

  it("应该返回错误当 AGUI_BASE_URL 未配置", async () => {
    delete process.env.AGUI_BASE_URL;

    const request = createMockRequest("http://localhost:3000/api/agui/sessions/list?app_name=agents&user_id=test");

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
    const request = createMockRequest("http://localhost:3000/api/agui/sessions/list?app_name=agents");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
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
        app_name: "agents",
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
        app_name: "agents",
      }),
    });

    const response = await createSession(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("AGUI_BAD_REQUEST");
  });
});
