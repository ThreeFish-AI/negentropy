import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import {
  buildMessageLedger,
  isSemanticEquivalentEntry,
  isSyntheticRunId,
  mergeMessageLedger,
} from "@/utils/message-ledger";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";

describe("message-ledger", () => {
  it("允许 hydration 终态补全已 closed 的实时 assistant 截断内容", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content: "## 分析\n\n| 项目 | 说明 |\n| --- | --- |\n| A | 首行",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-live"],
        },
      ],
      [
        {
          id: "assistant-final",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "snapshot_role",
          content:
            "## 分析\n\n| 项目 | 说明 |\n| --- | --- |\n| A | 首行 |\n| B | 次行 |\n\n第一段结论。\n\n第二段结论。",
          createdAt: new Date("2026-03-08T00:00:03.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "snapshot",
          sourceEventTypes: ["MESSAGES_SNAPSHOT"],
          relatedMessageIds: ["assistant-final"],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      content:
        "## 分析\n\n| 项目 | 说明 |\n| --- | --- |\n| A | 首行 |\n| B | 次行 |\n\n第一段结论。\n\n第二段结论。",
      streaming: false,
      lifecycle: "closed",
    });
    expect(merged[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live", "assistant-final"]),
    );
  });

  it("长耗时回复（>8 秒）也能在 realtime 与 hydration 间正确去重", () => {
    // 场景：ADK 仅持久化 partial=false 终态事件，realtime 用首个 partial 的 id
    // (a1)、hydration 用终态自身的 id (f)，二者 messageId 不同；当一段回复生成耗时
    // 超过 8 秒（多段落 / 列表型答复常见），原有时间窗硬拒绝会让两条 entry 各
    // 自成形，最终在 UI 形成双气泡。content 严格相等时应直接判为同一逻辑消息。
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live-a1",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content:
            "Pong:\n\n- 已收到回执\n- 关于 \"Pong\" 的几点说明\n- 后续步骤",
          createdAt: new Date("2026-04-27T10:00:00.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-live-a1"],
        },
      ],
      [
        {
          id: "assistant-final-f",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "fallback_assistant",
          content:
            "Pong:\n\n- 已收到回执\n- 关于 \"Pong\" 的几点说明\n- 后续步骤",
          // 与 realtime createdAt 相差 15 秒，超过 8 秒时间窗
          createdAt: new Date("2026-04-27T10:00:15.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "fallback",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-final-f"],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live-a1", "assistant-final-f"]),
    );
  });

  it("不会把 closed realtime 与非补全型历史 assistant 消息错误合并", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content: "第一段结论。",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-live"],
        },
      ],
      [
        {
          id: "assistant-final",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "snapshot_role",
          content: "第二段结论。",
          createdAt: new Date("2026-03-08T00:00:03.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "snapshot",
          sourceEventTypes: ["MESSAGES_SNAPSHOT"],
          relatedMessageIds: ["assistant-final"],
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((entry) => entry.id)).toEqual([
      "assistant-live",
      "assistant-final",
    ]);
  });

  it("buildMessageLedger 在 createdAt 相同的事件下用 sourceOrder 保持原始时间序", () => {
    // 两条 user/assistant 消息 timestamp 完全相同；UUID 字典序与原始事件序刚好相反。
    // 引入 sourceOrder 后，排序应仍然按事件出现顺序而非 UUID localeCompare。
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "z-message",
        role: "user",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "z-message",
        delta: "z first",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "z-message",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "a-message",
        role: "assistant",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "a-message",
        delta: "a second",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "a-message",
        timestamp: 1000,
      }),
    ];

    const ledger = buildMessageLedger({ events });
    expect(ledger.map((entry) => entry.id)).toEqual(["z-message", "a-message"]);
  });

  describe("ISSUE-041: 跨 runId（synthetic）语义匹配", () => {
    // ISSUE-041：后端 ADK Web /sessions/{id} 不透传 runId，前端 fallback 到
    // sessionId（synthetic runId === threadId），导致 hydration 与 realtime
    // 同一逻辑消息分裂为两个 turn → UI 双气泡。本组用例验证 isSyntheticRunId
    // 与 isSemanticEquivalentEntry 的协同放宽行为。

    const baseRealtime = {
      id: "assistant-uuid-actual-run-1-0",
      threadId: "session-abc",
      runId: "uuid-actual-run-1",
      resolvedRole: "assistant" as const,
      resolutionSource: "explicit_role" as const,
      content: "Pong 🏓 Anything else I can help with?",
      createdAt: new Date("2026-04-29T10:00:00.000Z"),
      streaming: false,
      lifecycle: "closed" as const,
      origin: "realtime" as const,
      sourceEventTypes: ["TEXT_MESSAGE_END"],
      relatedMessageIds: ["assistant-uuid-actual-run-1-0"],
    };

    const baseFallbackSynthetic = {
      ...baseRealtime,
      // 合成 runId === threadId，模拟 hydration 后端不透传 runId 的兜底
      runId: "session-abc",
      origin: "fallback" as const,
      sourceEventTypes: ["fallback.message"],
      relatedMessageIds: ["assistant-session-abc-0"],
    };

    it("A1: synthetic runId(=threadId) + 真 runId 同内容 → 视为语义等价", () => {
      const result = isSemanticEquivalentEntry(baseRealtime, baseFallbackSynthetic);
      expect(result).toBe(true);
    });

    it("A2: synthetic runId(=DEFAULT_RUN_ID) + 真 runId 同内容 → 视为语义等价", () => {
      const fallbackDefault = {
        ...baseFallbackSynthetic,
        runId: "default-run",
      };
      const result = isSemanticEquivalentEntry(baseRealtime, fallbackDefault);
      expect(result).toBe(true);
    });

    it("A3: 双方都是真 runId 但不同 → 不等价（不误折叠合法多 run）", () => {
      const otherRun = {
        ...baseFallbackSynthetic,
        runId: "uuid-actual-run-2",
        origin: "realtime" as const,
      };
      const result = isSemanticEquivalentEntry(baseRealtime, otherRun);
      expect(result).toBe(false);
    });

    it("A4: synthetic runId 但 threadId 不同 → 不等价（threadId 仍是必要约束）", () => {
      const otherThread = {
        ...baseFallbackSynthetic,
        threadId: "session-xyz",
        runId: "session-xyz", // 同样是合成 runId，但 threadId 不同
      };
      const result = isSemanticEquivalentEntry(baseRealtime, otherThread);
      expect(result).toBe(false);
    });

    it("A5: synthetic runId 但 origin 都是 realtime → 不等价（origin 多元仍是必要约束）", () => {
      const realtimeSynthetic = {
        ...baseFallbackSynthetic,
        origin: "realtime" as const, // 双方都 realtime
      };
      const result = isSemanticEquivalentEntry(baseRealtime, realtimeSynthetic);
      expect(result).toBe(false);
    });

    it("isSyntheticRunId 单元行为（覆盖各分支）", () => {
      // 1. runId 缺失 → synthetic
      expect(isSyntheticRunId({ runId: undefined, threadId: "t" })).toBe(true);
      expect(isSyntheticRunId({ threadId: "t" })).toBe(true);
      // 2. DEFAULT_RUN_ID → synthetic
      expect(isSyntheticRunId({ runId: "default-run", threadId: "t" })).toBe(true);
      expect(isSyntheticRunId({ runId: "default", threadId: "t" })).toBe(true);
      // 3. runId === threadId → synthetic（hydration fallback）
      expect(isSyntheticRunId({ runId: "session-abc", threadId: "session-abc" })).toBe(true);
      // 4. 真实 runId（不等于 threadId 也不是 default） → 非 synthetic
      expect(isSyntheticRunId({ runId: "uuid-1", threadId: "session-abc" })).toBe(false);
    });

    it("ISSUE-041 端到端 ledger merge：双源（realtime + synthetic fallback）合并为单条", () => {
      // 模拟双气泡场景：realtime turn:uuid-1 与 hydration turn:sessionId 同 Pong 内容。
      const merged = mergeMessageLedger([baseRealtime], [baseFallbackSynthetic]);
      expect(merged).toHaveLength(1);
      // 真 runId 应胜出（realtime 优先）
      expect(merged[0]?.runId).toBe("uuid-actual-run-1");
      expect(merged[0]?.relatedMessageIds).toEqual(
        expect.arrayContaining([
          "assistant-uuid-actual-run-1-0",
          "assistant-session-abc-0",
        ]),
      );
    });
  });
});
