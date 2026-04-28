import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { buildMessageLedger, mergeMessageLedger } from "@/utils/message-ledger";
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
});
