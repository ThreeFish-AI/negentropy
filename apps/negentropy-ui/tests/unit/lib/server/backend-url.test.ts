import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BACKEND_BASE_URL,
  LEGACY_LOCAL_PORTS,
  __resetLegacyPortWarningsForTests,
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
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearBackendEnv();
    __resetLegacyPortWarningsForTests();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    clearBackendEnv();
    vi.unstubAllEnvs();
    __resetLegacyPortWarningsForTests();
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

    it("LEGACY_LOCAL_PORTS 应包含历史使用过的 6600 与 6666", () => {
      expect(LEGACY_LOCAL_PORTS).toEqual(expect.arrayContaining(["6600", "6666"]));
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

  describe("非 localhost URL 不受迁移守护影响", () => {
    it("自定义 host + 旧端口不应被改写、不应告警", () => {
      process.env.AGUI_BASE_URL = "http://backend.example.com:6600";
      expect(getAguiBaseUrl()).toBe("http://backend.example.com:6600");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("localhost 但端口不在 LEGACY 列表时不应被改写", () => {
      process.env.AGUI_BASE_URL = "http://localhost:8080";
      expect(getAguiBaseUrl()).toBe("http://localhost:8080");
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("legacy port 迁移守护（开发模式）", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("localhost:6600 应被重写为 :3292 并打印一次迁移告警", () => {
      process.env.AGUI_BASE_URL = "http://localhost:6600";

      const resolved = getAguiBaseUrl();

      expect(resolved).toBe("http://localhost:3292");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain("AGUI_BASE_URL=http://localhost:6600");
      expect(warnSpy.mock.calls[0]?.[0]).toContain(":6600");
      expect(warnSpy.mock.calls[0]?.[0]).toContain(":3292");
    });

    it("127.0.0.1:6666 也应被识别为 legacy 并重写", () => {
      process.env.AGUI_BASE_URL = "http://127.0.0.1:6666";

      expect(getAguiBaseUrl()).toBe("http://127.0.0.1:3292");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("同一 URL 重复调用只告警一次（去重）", () => {
      process.env.AGUI_BASE_URL = "http://localhost:6600";

      getAguiBaseUrl();
      getAguiBaseUrl();
      getAguiBaseUrl();

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("不同 source label 各自独立告警", () => {
      process.env.AUTH_BASE_URL = "http://localhost:6600";
      process.env.AGUI_BASE_URL = "http://localhost:6600";

      getAuthBaseUrl();
      getAguiBaseUrl();

      // AUTH_BASE_URL + AGUI_BASE_URL 两个来源 × 同一 URL => 两次告警
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("legacy port 迁移守护（生产模式）", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("localhost:6600 在生产环境仅告警、不改写", () => {
      process.env.AGUI_BASE_URL = "http://localhost:6600";

      const resolved = getAguiBaseUrl();

      expect(resolved).toBe("http://localhost:6600");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
