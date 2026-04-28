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

  it("mergeEventsWithRealtimePriority 在 messageId 不同且时间跨度 >8 秒时也能丢弃 hydrated 文本事件", () => {
    // 长耗时回复（>8s）下，realtime ledger 的 createdAt 取首个 partial 时间戳，
    // hydration ledger 的 createdAt 取终态时间戳，二者跨度超过 8 秒。
    // 期望：内容严格相等时仍能命中语义等价，hydrated 文本事件被丢弃。
    const realtimeContent = "Pong:\n\n- 已收到回执\n- 后续步骤";
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
        messageId: "msg-a1",
        role: "assistant",
        timestamp: 1000.5,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-a1",
        delta: realtimeContent,
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-a1",
        timestamp: 1002,
      }),
    ];

    const hydratedEvents: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-final-f",
        role: "assistant",
        timestamp: 1015,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-final-f",
        delta: realtimeContent,
        timestamp: 1015.5,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-final-f",
        timestamp: 1017,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1018,
      }),
    ];

    const realtimeLedger = [
      {
        id: "msg-a1",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant" as const,
        resolutionSource: "explicit_role" as const,
        content: realtimeContent,
        createdAt: new Date(1000 * 1000), // T1，首个 partial 时间
        streaming: false,
        lifecycle: "closed" as const,
        origin: "realtime" as const,
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["msg-a1"],
      },
    ];

    const hydratedLedger = [
      {
        id: "msg-final-f",
        threadId: "session-1",
        runId: "run-1",
        resolvedRole: "assistant" as const,
        resolutionSource: "fallback_assistant" as const,
        content: realtimeContent,
        createdAt: new Date(1015 * 1000), // Tf，终态时间，跨度 15 秒
        streaming: false,
        lifecycle: "closed" as const,
        origin: "fallback" as const,
        sourceEventTypes: ["TEXT_MESSAGE_END"],
        relatedMessageIds: ["msg-final-f"],
      },
    ];

    const merged = mergeEventsWithRealtimePriority(
      realtimeEvents,
      hydratedEvents,
      realtimeLedger,
      hydratedLedger,
    );

    // hydrated 的 TEXT_MESSAGE_* 三件套被语义等价匹配后丢弃
    expect(
      merged.filter((event) => event.type === EventType.TEXT_MESSAGE_START).length,
    ).toBe(1);
    expect(
      merged.filter((event) => event.type === EventType.TEXT_MESSAGE_CONTENT).length,
    ).toBe(1);
    expect(
      merged.filter((event) => event.type === EventType.TEXT_MESSAGE_END).length,
    ).toBe(1);
    // 生命周期事件 RUN_FINISHED 仍被保留
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

  it("eventKey 在浮点精度抖动下仍稳定（toFixed(3) 毫秒级）", () => {
    // 1001.1 与 1001.10000002384 因浮点表示差异在历史实现中会生成不同 key，
    // 导致 mergeEvents 把同一逻辑事件保留两份；toFixed(3) 后两者归并为一条。
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001.1,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001.10000002384,
      }),
    ];

    const merged = mergeEvents([], events);
    const contentEvents = merged.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_CONTENT,
    );
    expect(contentEvents).toHaveLength(1);
  });

  it("mergeEventsWithRealtimePriority：当 realtime 与 hydrated 的 messageId 相同时保留 realtime 时间戳", () => {
    // realtime 在 t=1001 收到 TEXT_MESSAGE_CONTENT；hydrated 后同 messageId 但
    // 后端时间戳 t=1500（精度损失/异源时钟）。函数语义为「realtime 优先」，
    // 应保留 realtime 时间戳，以稳定后续按 timestamp 的排序。
    const realtime: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hi",
        timestamp: 1001,
      }),
    ];
    const hydrated: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hi",
        timestamp: 1500,
      }),
    ];

    const merged = mergeEventsWithRealtimePriority(realtime, hydrated, [], []);
    const contentEvents = merged.filter(
      (event) => event.type === EventType.TEXT_MESSAGE_CONTENT,
    );
    // 已被语义匹配过滤掉 hydrated 的同 messageId 事件；保留 realtime 版本
    expect(contentEvents).toHaveLength(1);
    expect(contentEvents[0]?.timestamp).toBe(1001);
  });

  it("mergeEventsWithRealtimePriority：生命周期事件 eventKey 冲突时 realtime 覆盖 hydrated", () => {
    // RUN_STARTED 在 step 3 走 LIFECYCLE 直通分支（不被 messageId 过滤），
    // 且 eventKey 不含 messageId / toolCallId，threadId+runId+timestamp 完全一致时
    // realtime 与 hydrated 会在 mergeEvents 的 Map 中冲突。参数顺序交换为
    // (filteredHydrated, realtime) 后，realtime 处于 incoming 位、后写入胜出。
    // 用对象引用断言保留的是 realtime 版本，是验证参数交换生效的最直接证据。
    const realtimeRunStarted = createTestEvent({
      type: EventType.RUN_STARTED,
      threadId: "session-1",
      runId: "run-1",
      timestamp: 1000,
    });
    const hydratedRunStarted = createTestEvent({
      type: EventType.RUN_STARTED,
      threadId: "session-1",
      runId: "run-1",
      timestamp: 1000,
    });

    const merged = mergeEventsWithRealtimePriority(
      [realtimeRunStarted],
      [hydratedRunStarted],
      [],
      [],
    );
    const runStartedEvents = merged.filter(
      (event) => event.type === EventType.RUN_STARTED,
    );
    expect(runStartedEvents).toHaveLength(1);
    expect(runStartedEvents[0]).toBe(realtimeRunStarted);
  });

  // ISSUE-040 H4: eventKey 浮点抖动保护应推广到所有事件类型（不再仅 TEXT_MESSAGE_CONTENT）
  it("eventKey 在 STEP_FINISHED 浮点抖动下仍稳定", () => {
    const stepFinishedA = createTestEvent({
      type: EventType.STEP_FINISHED,
      threadId: "session-1",
      runId: "run-1",
      stepId: "synth-step-1",
      timestamp: 1001.1,
    });
    const stepFinishedB = createTestEvent({
      type: EventType.STEP_FINISHED,
      threadId: "session-1",
      runId: "run-1",
      stepId: "synth-step-1",
      timestamp: 1001.10000002384, // 浮点表示抖动，但 stepId 相同
    });
    const merged = mergeEvents([stepFinishedA], [stepFinishedB]);
    expect(merged).toHaveLength(1);
  });

  it("eventKey 对 ne.a2ui.thought 等 CUSTOM 事件不再因浮点抖动重复保留", () => {
    const thoughtA = createTestEvent({
      type: EventType.CUSTOM,
      threadId: "session-1",
      runId: "run-1",
      timestamp: 1001.0,
      eventType: "ne.a2ui.thought",
      data: { text: "thinking..." },
    } as unknown as Parameters<typeof createTestEvent>[0]);
    const thoughtB = createTestEvent({
      type: EventType.CUSTOM,
      threadId: "session-1",
      runId: "run-1",
      timestamp: 1001.000001, // 同毫秒级浮点抖动
      eventType: "ne.a2ui.thought",
      data: { text: "thinking..." },
    } as unknown as Parameters<typeof createTestEvent>[0]);
    const merged = mergeEvents([thoughtA], [thoughtB]);
    expect(merged).toHaveLength(1);
  });

  // ISSUE-040 Q3 残留乱序：sort tiebreaker 必须保留 lifecycle 推入顺序，
  // 不能在 timestamp 相等时按 eventKey 字典序回退（CONTENT < END < START）。
  it("hydrateSessionDetail 保留同 timestamp 下 normalizer 推入的 lifecycle 顺序", () => {
    // 后端 ADK web events 历史回放经常一秒落库多条 (functionCall / functionResponse / 同期文本)，
    // 三件套时间戳相等。此前 sort 用 eventKey().localeCompare 兜底会把 TEXT_MESSAGE_*
    // 三件套打散为 CONTENT, END, START，导致前端展现层 turn 边界穿插漂移。
    const sameTs = 1000;
    const result = hydrateSessionDetail(
      [
        {
          id: "user-1",
          author: "user",
          timestamp: sameTs,
          content: { parts: [{ text: "Ping." }] },
        },
        {
          id: "asst-1",
          author: "NegentropyEngine",
          timestamp: sameTs,
          content: { parts: [{ text: "Pong." }] },
        },
      ],
      "session-q3",
    );
    // 提取 TEXT_MESSAGE_* 序列，断言：每个 messageId 内 START → CONTENT → END
    // 三件套相邻且不被另一 messageId 切断。
    const textEvents = result.events.filter(
      (event) =>
        event.type === EventType.TEXT_MESSAGE_START ||
        event.type === EventType.TEXT_MESSAGE_CONTENT ||
        event.type === EventType.TEXT_MESSAGE_END,
    );
    // 用 (messageId, lifecycle) 的相对序号映射断言不再交错。
    let lastMessageId = "";
    let lifecycleStage = -1; // -1=before, 0=START, 1=CONTENT, 2=END
    for (const event of textEvents) {
      const mid = (event as unknown as { messageId: string }).messageId;
      if (mid !== lastMessageId) {
        // 进入新 messageId：lifecycle 重置，必须以 START 开头
        expect(event.type).toBe(EventType.TEXT_MESSAGE_START);
        lastMessageId = mid;
        lifecycleStage = 0;
        continue;
      }
      if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
        // CONTENT 必须跟在 START 之后（同 messageId 内）
        expect(lifecycleStage).toBeGreaterThanOrEqual(0);
        expect(lifecycleStage).toBeLessThanOrEqual(1);
        lifecycleStage = 1;
      } else if (event.type === EventType.TEXT_MESSAGE_END) {
        expect(lifecycleStage).toBeGreaterThanOrEqual(1);
        lifecycleStage = 2;
      }
    }
  });
});
