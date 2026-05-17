/**
 * Smoke 测试：确认共享包对外暴露的符号契约不漂移。
 *
 * 真实功能性测试由 apps/negentropy-ui 的 92 个测试文件通过 shim 覆盖
 * （PR-2 验证 722 用例全部通过）。本文件仅守护「protocol / client / parse /
 * server」四个子入口的导出表面，避免后续 PR 误删导出导致下游崩溃。
 */
import { describe, expect, it } from "vitest";

import * as protocol from "@negentropy/agents-chat-core/protocol";
import * as client from "@negentropy/agents-chat-core/client";
import * as parse from "@negentropy/agents-chat-core/parse";
import * as server from "@negentropy/agents-chat-core/server";

describe("@negentropy/agents-chat-core/protocol", () => {
  it("暴露 zod schema 与解析函数", () => {
    expect(typeof protocol.parseBaseEvent).toBe("function");
    expect(typeof protocol.safeParseBaseEvent).toBe("function");
    expect(typeof protocol.safeParseBaseEventProps).toBe("function");
    expect(typeof protocol.parseAgUiEvent).toBe("function");
    expect(typeof protocol.safeParseAgUiEvent).toBe("function");
  });

  it("暴露 NDJSON / SSE 帧工具与协议常量", () => {
    expect(protocol.AGUI_NDJSON_CONTENT_TYPE).toBe("application/x-ndjson");
    expect(protocol.AGUI_NDJSON_PROTOCOL).toBe("negentropy.ndjson.v1");
    expect(typeof protocol.createAguiEventFrame).toBe("function");
    expect(typeof protocol.createTransportErrorFrame).toBe("function");
    expect(typeof protocol.encodeNdjsonFrame).toBe("function");
    expect(typeof protocol.parseNdjsonStream).toBe("function");
    expect(typeof protocol.parseSseStream).toBe("function");
  });

  it("暴露事件访问器", () => {
    expect(typeof protocol.getEventThreadId).toBe("function");
    expect(typeof protocol.getEventRunId).toBe("function");
    expect(typeof protocol.getEventDelta).toBe("function");
    expect(typeof protocol.isBaseEventProps).toBe("function");
    expect(typeof protocol.isTextMessageEvent).toBe("function");
    expect(typeof protocol.isToolCallEvent).toBe("function");
    expect(typeof protocol.isStateEvent).toBe("function");
  });
});

describe("@negentropy/agents-chat-core/client", () => {
  it("暴露 NdjsonHttpAgent 构造器", () => {
    expect(typeof client.NdjsonHttpAgent).toBe("function");
  });
});

describe("@negentropy/agents-chat-core/parse", () => {
  it("暴露 mention 解析纯函数", () => {
    expect(typeof parse.detectMentionTrigger).toBe("function");
    expect(typeof parse.applyMention).toBe("function");
    expect(typeof parse.reconcileMentions).toBe("function");
    expect(typeof parse.deriveForwardedPropsFromMentions).toBe("function");
  });
});

describe("@negentropy/agents-chat-core/server", () => {
  it("暴露 state-delta 派生工具", () => {
    expect(typeof server.buildStateDeltaFromForwardedProps).toBe("function");
    expect(server.UUID_RE).toBeInstanceOf(RegExp);
    expect(server.PREFERRED_SUBAGENT_MAX_LEN).toBe(128);
    expect(server.CORPUS_IDS_MAX_LEN).toBe(32);
  });
});
