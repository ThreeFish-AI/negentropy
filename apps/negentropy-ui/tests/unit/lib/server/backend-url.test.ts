import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_BACKEND_BASE_URL,
  getAguiBaseUrl,
  getAuthBaseUrl,
  getKnowledgeBaseUrl,
  getMemoryBaseUrl,
} from "@/lib/server/backend-url";

const BACKEND_URL_ENV_VARS = [
  "AGUI_BASE_URL",
  "NEXT_PUBLIC_AGUI_BASE_URL",
  "AUTH_BASE_URL",
  "KNOWLEDGE_BASE_URL",
  "MEMORY_BASE_URL",
];

function clearBackendEnv(): void {
  for (const name of BACKEND_URL_ENV_VARS) {
    delete process.env[name];
  }
}

describe("backend-url SSOT helper", () => {
  beforeEach(() => {
    clearBackendEnv();
  });

  afterEach(() => {
    clearBackendEnv();
  });

  describe("默认值", () => {
    it("无任何 env 时应返回默认端口 :3292", () => {
      expect(getAguiBaseUrl()).toBe(DEFAULT_BACKEND_BASE_URL);
      expect(getAuthBaseUrl()).toBe(DEFAULT_BACKEND_BASE_URL);
      expect(getKnowledgeBaseUrl()).toBe(DEFAULT_BACKEND_BASE_URL);
      expect(getMemoryBaseUrl()).toBe(DEFAULT_BACKEND_BASE_URL);
    });

    it("env 仅包含空白字符时视作未配置并回落默认值", () => {
      process.env.AGUI_BASE_URL = "   ";
      expect(getAguiBaseUrl()).toBe(DEFAULT_BACKEND_BASE_URL);
    });
  });

  describe("优先级链", () => {
    it("AUTH_BASE_URL > AGUI_BASE_URL > NEXT_PUBLIC_AGUI_BASE_URL", () => {
      process.env.AUTH_BASE_URL = "http://auth-internal:3292";
      process.env.AGUI_BASE_URL = "http://agui-internal:3292";
      process.env.NEXT_PUBLIC_AGUI_BASE_URL = "http://agui-public:3292";

      expect(getAuthBaseUrl()).toBe("http://auth-internal:3292");
    });

    it("AGUI_BASE_URL 缺失时 auth 链应回落到 NEXT_PUBLIC_AGUI_BASE_URL", () => {
      process.env.NEXT_PUBLIC_AGUI_BASE_URL = "http://agui-public:3292";
      expect(getAuthBaseUrl()).toBe("http://agui-public:3292");
    });

    it("AGUI_BASE_URL 应优先于 NEXT_PUBLIC_AGUI_BASE_URL", () => {
      process.env.AGUI_BASE_URL = "http://agui-internal:3292";
      process.env.NEXT_PUBLIC_AGUI_BASE_URL = "http://agui-public:3292";

      expect(getAguiBaseUrl()).toBe("http://agui-internal:3292");
    });

    it("KNOWLEDGE_BASE_URL 应覆盖 AGUI 链", () => {
      process.env.AGUI_BASE_URL = "http://agui-internal:3292";
      process.env.KNOWLEDGE_BASE_URL = "http://knowledge:9001";

      expect(getKnowledgeBaseUrl()).toBe("http://knowledge:9001");
      expect(getAguiBaseUrl()).toBe("http://agui-internal:3292");
    });

    it("MEMORY_BASE_URL 应覆盖 AGUI 链", () => {
      process.env.AGUI_BASE_URL = "http://agui-internal:3292";
      process.env.MEMORY_BASE_URL = "http://memory:9002";

      expect(getMemoryBaseUrl()).toBe("http://memory:9002");
      expect(getAguiBaseUrl()).toBe("http://agui-internal:3292");
    });

    it("KNOWLEDGE / MEMORY 未配置时应回落至 AGUI 链", () => {
      process.env.AGUI_BASE_URL = "http://agui-internal:3292";
      expect(getKnowledgeBaseUrl()).toBe("http://agui-internal:3292");
      expect(getMemoryBaseUrl()).toBe("http://agui-internal:3292");
    });
  });
});
