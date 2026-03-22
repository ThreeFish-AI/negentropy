import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { createTestEvent } from "@/tests/helpers/agui";
import {
  applyHydratedSession,
  applyRealtimeEvents,
  EMPTY_SESSION_PROJECTION,
  sessionProjectionReducer,
  shouldMergeHydratedProjection,
} from "@/features/session/utils/session-projection";
import { ledgerEntriesToMessages } from "@/utils/message-ledger";

describe("session-projection", () => {
  it("appendRealtimeEvents 会同步推进 rawEvents 与 messageLedger", () => {
    const next = applyRealtimeEvents(
      EMPTY_SESSION_PROJECTION,
      [
        createTestEvent({
          type: EventType.TEXT_MESSAGE_START,
          threadId: "thread-1",
          runId: "run-1",
          messageId: "msg-1",
          role: "assistant",
          timestamp: 1000,
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_CONTENT,
          threadId: "thread-1",
          runId: "run-1",
          messageId: "msg-1",
          delta: "hello",
          timestamp: 1001,
        }),
        createTestEvent({
          type: EventType.TEXT_MESSAGE_END,
          threadId: "thread-1",
          runId: "run-1",
          messageId: "msg-1",
          timestamp: 1002,
        }),
      ],
    );

    expect(next.rawEvents).toHaveLength(3);
    expect(next.messageLedger).toHaveLength(1);
    expect(next.messageLedger[0]).toMatchObject({
      id: "msg-1",
      resolvedRole: "assistant",
      content: "hello",
    });
  });

  it("applyHydratedSession 在 shouldMerge=false 时直接替换 projection", () => {
    const next = applyHydratedSession(EMPTY_SESSION_PROJECTION, {
      sessionId: "s1",
      shouldMerge: false,
      detail: {
        events: [
          createTestEvent({
            type: EventType.RUN_STARTED,
            threadId: "s1",
            runId: "run-1",
            timestamp: 1000,
          }),
        ],
        messages: [],
        messageLedger: [
          {
            id: "msg-1",
            threadId: "s1",
            runId: "run-1",
            resolvedRole: "user",
            resolutionSource: "explicit_role",
            content: "Hi",
            createdAt: new Date("2026-03-08T00:00:01.000Z"),
            streaming: false,
            lifecycle: "closed",
            origin: "realtime",
            sourceEventTypes: ["TEXT_MESSAGE_END"],
            relatedMessageIds: ["msg-1"],
          },
        ],
        snapshot: { ready: true },
      },
    });

    expect(next.loadedSessionId).toBe("s1");
    expect(next.messageLedger).toHaveLength(1);
    expect(next.snapshot).toEqual({ ready: true });
  });

  it("applyHydratedSession 在 shouldMerge=true 时合并 ledger 与 snapshot", () => {
    const base = {
      loadedSessionId: "s1",
      rawEvents: [
        createTestEvent({
          type: EventType.RUN_STARTED,
          threadId: "s1",
          runId: "run-1",
          timestamp: 1000,
        }),
      ],
      messageLedger: [
        {
          id: "msg-1",
          threadId: "s1",
          runId: "run-1",
          resolvedRole: "assistant" as const,
          resolutionSource: "fallback_assistant" as const,
          content: "He",
          createdAt: new Date("2026-03-08T00:00:02.000Z"),
          streaming: true,
          lifecycle: "open" as const,
          origin: "realtime" as const,
          sourceEventTypes: ["TEXT_MESSAGE_START"],
          relatedMessageIds: ["msg-1"],
        },
      ],
      snapshot: { stage: "running" },
    };

    const next = applyHydratedSession(base, {
      sessionId: "s1",
      shouldMerge: true,
      detail: {
        events: [
          createTestEvent({
            type: EventType.RUN_FINISHED,
            threadId: "s1",
            runId: "run-1",
            timestamp: 1003,
          }),
        ],
        messages: [],
        messageLedger: [
          {
            id: "msg-1",
            threadId: "s1",
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
        snapshot: { stage: "done" },
      },
    });

    expect(next.rawEvents).toHaveLength(2);
    expect(next.messageLedger[0]).toMatchObject({
      resolvedRole: "user",
      content: "Hello",
      streaming: false,
    });
    expect(next.snapshot).toEqual({ stage: "done" });
    expect(ledgerEntriesToMessages(next.messageLedger)[0]?.role).toBe("user");
  });

  it("applyHydratedSession 在不同 messageId 但同一 assistant 答复下只保留一条 ledger", () => {
    const base = {
      loadedSessionId: "s1",
      rawEvents: [
        createTestEvent({
          type: EventType.TEXT_MESSAGE_CONTENT,
          threadId: "s1",
          runId: "run-1",
          messageId: "assistant-live",
          delta: "我可以帮助你规划任务",
          timestamp: 1000,
        }),
      ],
      messageLedger: [
        {
          id: "assistant-live",
          threadId: "s1",
          runId: "run-1",
          resolvedRole: "assistant" as const,
          resolutionSource: "explicit_role" as const,
          content: "我可以帮助你规划任务",
          createdAt: new Date("2026-03-08T00:00:01.000Z"),
          streaming: true,
          lifecycle: "open" as const,
          origin: "realtime" as const,
          sourceEventTypes: ["TEXT_MESSAGE_CONTENT"],
          relatedMessageIds: ["assistant-live"],
        },
      ],
      snapshot: null,
    };

    const next = applyHydratedSession(base, {
      sessionId: "s1",
      shouldMerge: true,
      detail: {
        events: [
          createTestEvent({
            type: EventType.RUN_FINISHED,
            threadId: "s1",
            runId: "run-1",
            timestamp: 1001,
          }),
        ],
        messages: [],
        messageLedger: [
          {
            id: "assistant-final",
            threadId: "s1",
            runId: "run-1",
            resolvedRole: "assistant" as const,
            resolutionSource: "snapshot_role" as const,
            content: "我可以帮助你规划任务、分析代码并直接修改实现。",
            createdAt: new Date("2026-03-08T00:00:02.000Z"),
            streaming: false,
            lifecycle: "closed",
            origin: "snapshot",
            sourceEventTypes: ["MESSAGES_SNAPSHOT"],
            relatedMessageIds: ["assistant-final"],
          },
        ],
        snapshot: { stage: "done" },
      },
    });

    expect(next.messageLedger).toHaveLength(1);
    expect(next.messageLedger[0]).toMatchObject({
      content: "我可以帮助你规划任务、分析代码并直接修改实现。",
      streaming: false,
    });
    expect(next.messageLedger[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live", "assistant-final"]),
    );
  });

  it("shouldMergeHydratedProjection 正确判断 session 合并条件", () => {
    expect(
      shouldMergeHydratedProjection({
        currentLoadedSessionId: "s1",
        activeSessionId: "s1",
        incomingSessionId: "s1",
        currentRawEvents: [],
      }),
    ).toBe(true);

    expect(
      shouldMergeHydratedProjection({
        currentLoadedSessionId: null,
        activeSessionId: "s1",
        incomingSessionId: "s1",
        currentRawEvents: [
          createTestEvent({
            type: EventType.RUN_STARTED,
            threadId: "s1",
            runId: "run-1",
            timestamp: 1000,
          }),
        ],
      }),
    ).toBe(true);
  });

  it("sessionProjectionReducer 支持 reset action", () => {
    const state = {
      loadedSessionId: "s1",
      rawEvents: [
        createTestEvent({
          type: EventType.RUN_STARTED,
          threadId: "s1",
          runId: "run-1",
          timestamp: 1000,
        }),
      ],
      messageLedger: [],
      snapshot: { ready: true },
    };

    expect(sessionProjectionReducer(state, { type: "reset" })).toEqual(
      EMPTY_SESSION_PROJECTION,
    );
  });
});
