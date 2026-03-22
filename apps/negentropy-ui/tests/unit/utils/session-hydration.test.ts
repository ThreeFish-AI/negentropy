import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import {
  deriveConnectionState,
  deriveRunStates,
  hydrateSessionDetail,
  mergeEvents,
  mergeEventsWithRealtimePriority,
} from "@/utils/session-hydration";
import {
  ledgerEntriesToMessages,
  mergeMessageLedger,
} from "@/utils/message-ledger";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";

describe("session-hydration", () => {
  it("为历史回放补齐缺失的运行生命周期事件", () => {
    const result = hydrateSessionDetail(
      [
        {
          id: "msg-1",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1000,
          message: { role: "assistant", content: "hello" },
        },
      ],
      "session-1",
    );

    expect(result.events[0].type).toBe(EventType.RUN_STARTED);
    expect(result.events[result.events.length - 1].type).toBe(EventType.RUN_FINISHED);
  });

  it("将 confirmation 工具轮次派生为 blocked", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "session-1",
        runId: "run-1",
        toolCallId: "tool-1",
        toolCallName: "ui.confirmation",
        timestamp: 1001,
      }),
    ];

    const states = deriveRunStates(events);
    expect(states[0]?.status).toBe("blocked");
    expect(deriveConnectionState(events)).toBe("blocked");
  });

  it("合并历史事件时保留实时唯一事件而不重复", () => {
    const realtime: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      }),
    ];

    const historical: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1002,
      }),
    ];

    const merged = mergeEvents(realtime, historical);
    expect(
      merged.filter(
        (event) =>
          event.type === EventType.TEXT_MESSAGE_CONTENT &&
          "messageId" in event &&
          event.messageId === "msg-1",
      ),
    ).toHaveLength(1);
    expect(merged[merged.length - 1].type).toBe(EventType.RUN_FINISHED);
  });

  it("历史事件中混入坏 payload 时只保留合法项继续 hydration", () => {
    const result = hydrateSessionDetail(
      [
        {
          id: "msg-1",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1000,
          message: { role: "assistant", content: "hello" },
        },
      ],
      "session-1",
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.content).toBe("hello");
  });

  it("将仅通过 protocol author 表达的历史用户消息保留到 message ledger", () => {
    const result = hydrateSessionDetail(
      [
        {
          id: "user-msg",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1000,
          author: "user",
          content: { parts: [{ text: "Hi" }] },
        },
        {
          id: "assistant-msg",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1001,
          author: "assistant",
          content: { parts: [{ text: "Hello there" }] },
        },
      ],
      "session-1",
    );

    expect(result.messageLedger).toHaveLength(2);
    expect(result.messageLedger[0]).toMatchObject({
      id: "user-msg",
      resolvedRole: "user",
      content: "Hi",
    });
    expect(result.messageLedger[1]).toMatchObject({
      id: "assistant-msg",
      resolvedRole: "assistant",
      content: "Hello there",
    });
    expect(result.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("合并 message ledger 时保留更强角色来源与更完整内容", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "msg-1",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "fallback_assistant",
          content: "He",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: true,
          lifecycle: "open",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_START"],
          relatedMessageIds: ["msg-1"],
        },
      ],
      [
        {
          id: "msg-1",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "user",
          resolutionSource: "snapshot_role",
          content: "Hello",
          createdAt: new Date("2026-03-08T00:00:01.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "snapshot",
          sourceEventTypes: ["MESSAGES_SNAPSHOT"],
          relatedMessageIds: ["msg-1"],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      resolvedRole: "user",
      resolutionSource: "snapshot_role",
      content: "Hello",
      streaming: false,
    });
    expect(merged[0]?.sourceEventTypes).toEqual([
      "TEXT_MESSAGE_START",
      "MESSAGES_SNAPSHOT",
    ]);
  });

  it("合并 message ledger 时会将不同 messageId 的同一 assistant 最终答复收敛为一条事实", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-live",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content: "我可以帮助你规划任务",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: true,
          lifecycle: "open",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_CONTENT"],
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
          content: "我可以帮助你规划任务、分析代码并直接修改实现。",
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
      resolvedRole: "assistant",
      content: "我可以帮助你规划任务、分析代码并直接修改实现。",
      streaming: false,
    });
    expect(merged[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live", "assistant-final"]),
    );
  });

  it("合并 message ledger 时不会把两个独立 assistant 完成消息错误折叠为一条", () => {
    const merged = mergeMessageLedger(
      [
        {
          id: "assistant-a",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "explicit_role",
          content: "第一段结论",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "realtime",
          sourceEventTypes: ["TEXT_MESSAGE_END"],
          relatedMessageIds: ["assistant-a"],
        },
      ],
      [
        {
          id: "assistant-b",
          threadId: "session-1",
          runId: "run-1",
          resolvedRole: "assistant",
          resolutionSource: "snapshot_role",
          content: "第二段结论",
          createdAt: new Date("2026-03-08T00:00:03.000Z"),
          streaming: false,
          lifecycle: "closed",
          origin: "snapshot",
          sourceEventTypes: ["MESSAGES_SNAPSHOT"],
          relatedMessageIds: ["assistant-b"],
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((entry) => entry.id)).toEqual(["assistant-a", "assistant-b"]);
  });

  it("将 message ledger 派生为按时间排序的聊天消息", () => {
    const messages = ledgerEntriesToMessages([
      {
        id: "assistant-msg",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant",
        resolutionSource: "explicit_role",
        content: "World",
        createdAt: new Date("2026-03-08T00:00:02.000Z"),
        streaming: false,
        lifecycle: "closed",
        origin: "realtime",
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["assistant-msg"],
      },
      {
        id: "user-msg",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "user",
        resolutionSource: "explicit_role",
        content: "Hello",
        createdAt: new Date("2026-03-08T00:00:01.000Z"),
        streaming: false,
        lifecycle: "closed",
        origin: "realtime",
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["user-msg"],
      },
    ]);

    expect(messages.map((message) => message.id)).toEqual([
      "user-msg",
      "assistant-msg",
    ]);
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("mergeEventsWithRealtimePriority 丢弃已被实时流覆盖的 hydrated 文本事件", () => {
    const realtimeEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-live",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-live",
        delta: "hello world",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-live",
        timestamp: 1003,
      }),
    ];

    const hydratedEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 999,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-live",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-live",
        delta: "hello world",
        timestamp: 1001.5,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-live",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1004,
      }),
    ];

    const realtimeLedger = [
      {
        id: "msg-live",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant" as const,
        resolutionSource: "explicit_role" as const,
        content: "hello world",
        createdAt: new Date(1001 * 1000),
        streaming: false,
        lifecycle: "closed" as const,
        origin: "realtime" as const,
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["msg-live"],
      },
    ];

    const hydratedLedger = [
      {
        id: "msg-live",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant" as const,
        resolutionSource: "fallback_assistant" as const,
        content: "hello world",
        createdAt: new Date(1001 * 1000),
        streaming: false,
        lifecycle: "closed" as const,
        origin: "fallback" as const,
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["msg-live"],
      },
    ];

    const merged = mergeEventsWithRealtimePriority(
      realtimeEvents,
      hydratedEvents,
      realtimeLedger,
      hydratedLedger,
    );

    // hydrated TEXT_MESSAGE_* 被丢弃，但 RUN_FINISHED 保留
    const textContentCount = merged.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_CONTENT,
    ).length;
    expect(textContentCount).toBe(1);
    expect(merged.some((event) => event.type === EventType.RUN_FINISHED)).toBe(true);
  });

  it("mergeEventsWithRealtimePriority 保留 hydrated 生命周期事件（RUN_FINISHED）", () => {
    const realtimeEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      }),
    ];

    const hydratedEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1002,
      }),
    ];

    const merged = mergeEventsWithRealtimePriority(
      realtimeEvents,
      hydratedEvents,
      [],
      [],
    );

    expect(merged.some((event) => event.type === EventType.RUN_FINISHED)).toBe(true);
  });

  it("不同 messageId 但语义等价的 hydrated 事件不会产生重复", () => {
    const realtimeEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-realtime",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-realtime",
        delta: "我可以帮助你",
        timestamp: 1002,
      }),
    ];

    const hydratedEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-hydrated",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-hydrated",
        delta: "我可以帮助你规划任务",
        timestamp: 1001.5,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-hydrated",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1004,
      }),
    ];

    const realtimeLedger = [
      {
        id: "msg-realtime",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant" as const,
        resolutionSource: "explicit_role" as const,
        content: "我可以帮助你",
        createdAt: new Date(1001 * 1000),
        streaming: true,
        lifecycle: "open" as const,
        origin: "realtime" as const,
        sourceEventTypes: ["TEXT_MESSAGE_CONTENT"],
        relatedMessageIds: ["msg-realtime"],
      },
    ];

    const hydratedLedger = [
      {
        id: "msg-hydrated",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant" as const,
        resolutionSource: "fallback_assistant" as const,
        content: "我可以帮助你规划任务",
        createdAt: new Date(1001 * 1000),
        streaming: false,
        lifecycle: "closed" as const,
        origin: "fallback" as const,
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["msg-hydrated"],
      },
    ];

    const merged = mergeEventsWithRealtimePriority(
      realtimeEvents,
      hydratedEvents,
      realtimeLedger,
      hydratedLedger,
    );

    // hydrated 的 TEXT_MESSAGE_* 被语义等价匹配后丢弃
    const textStartCount = merged.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_START,
    ).length;
    expect(textStartCount).toBe(1);
    // RUN_FINISHED 被保留
    expect(merged.some((event) => event.type === EventType.RUN_FINISHED)).toBe(true);
  });

  it("eventKey 对相同 timestamp 的 TEXT_MESSAGE_CONTENT 正确去重", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "token1",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "full text from hydration",
        timestamp: 1001,
      }),
    ];

    const merged = mergeEvents([], events);
    // 相同 timestamp 的同一消息的 delta 事件应被去重为 1 条
    const contentEvents = merged.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_CONTENT,
    );
    expect(contentEvents).toHaveLength(1);
  });
});
