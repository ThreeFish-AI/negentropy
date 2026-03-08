import type { BaseEvent, Message } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import {
  createActivitySnapshotEvent,
  createCustomEvent,
  createMessagesSnapshotEvent,
  createRawEvent,
  createStateDeltaEvent,
  createStateSnapshotEvent,
  createStepFinishedEvent,
  createStepStartedEvent,
  createTextMessageStartEvent,
  createTextMessageContentEvent,
  createTextMessageEndEvent,
  createToolCallStartEvent,
  createToolCallArgsEvent,
  createToolCallEndEvent,
  createToolCallResultEvent,
} from "@/lib/agui/factories";
import {
  createAgUiMessage,
  getEventDelta,
  getEventMessageId,
  getEventRole,
  getEventRunId,
  getEventThreadId,
  normalizeCompatibleMessageRole,
  type CanonicalMessageRole,
} from "@/types/agui";
import { accumulateTextContent } from "@/utils/message";
import type { AdkEventPayload } from "@/lib/adk/schema";
export {
  adkEventPayloadSchema,
  collectAdkEventPayloads,
  parseAdkEventPayload,
  safeParseAdkEventPayload,
  type AdkEventPayload,
} from "@/lib/adk/schema";

type NormalizedRole = Exclude<CanonicalMessageRole, "tool">;

type StreamMessageState = {
  messageId: string;
};

function normalizeTextRole(value: string | undefined): NormalizedRole {
  const normalized = normalizeCompatibleMessageRole(value);
  if (normalized === "tool") {
    return "assistant";
  }
  return normalized;
}

function getPayloadRole(payload: AdkEventPayload): NormalizedRole {
  if (payload.message?.role) {
    return normalizeTextRole(payload.message.role);
  }
  if (hasToolResults(payload) || payload.message?.role === "tool") {
    return "assistant";
  }
  if (hasToolCalls(payload)) {
    return "assistant";
  }
  if (
    payload.author === "assistant" ||
    payload.author === "agent" ||
    payload.author === "system" ||
    payload.author === "developer" ||
    payload.author === "tool"
  ) {
    return normalizeTextRole(payload.author);
  }
  return "assistant";
}

function extractTextParts(payload: AdkEventPayload): string[] {
  if (payload.content?.parts) {
    return payload.content.parts
      .filter((p) => !p.functionResponse && !p.functionCall)
      .map((p) => p.text || "")
      .filter(Boolean);
  }

  if (payload.message) {
    if (typeof payload.message.content === "string") {
      return payload.message.content ? [payload.message.content] : [];
    }
    if (Array.isArray(payload.message.content)) {
      return payload.message.content
        .map((p) => p.text || "")
        .filter(Boolean);
    }
  }

  return [];
}

function hasToolCalls(payload: AdkEventPayload): boolean {
  return Boolean(
    payload.message?.tool_calls?.length ||
      payload.content?.parts?.some((part) => part.functionCall),
  );
}

function hasToolResults(payload: AdkEventPayload): boolean {
  return Boolean(
    (payload.message?.role === "tool" && payload.message.tool_call_id) ||
      payload.content?.parts?.some((part) => part.functionResponse),
  );
}

function createGeneratedMessageId(
  role: NormalizedRole,
  runId: string,
  index: number,
): string {
  const prefix =
    role === "user"
      ? "user"
      : role === "system"
        ? "system"
        : role === "developer"
          ? "developer"
          : "assistant";
  return `${prefix}:${runId}:${index}`;
}

function messageShouldFlushAfterPayload(payload: AdkEventPayload): boolean {
  return hasToolCalls(payload) || hasToolResults(payload);
}

function normalizeUiMessageRole(value: string | undefined): Message["role"] {
  const role = normalizeCompatibleMessageRole(value);
  if (role === "user" || role === "system" || role === "tool") {
    return role;
  }
  return "assistant";
}

export class AdkMessageStreamNormalizer {
  private openAssistantMessages = new Map<string, StreamMessageState>();
  private segmentIndexByRun = new Map<string, number>();

  private nextMessageId(runId: string, role: NormalizedRole): string {
    const nextIndex = this.segmentIndexByRun.get(runId) || 0;
    this.segmentIndexByRun.set(runId, nextIndex + 1);
    return createGeneratedMessageId(role, runId, nextIndex);
  }

  private flushAssistantMessage(
    events: BaseEvent[],
    common: {
      threadId: string;
      runId: string;
      timestamp: number;
      author?: string;
    },
  ) {
    const openMessage = this.openAssistantMessages.get(common.runId);
    if (!openMessage) {
      return;
    }
    events.push(
      createTextMessageEndEvent({
        ...common,
        messageId: openMessage.messageId,
      }),
    );
    this.openAssistantMessages.delete(common.runId);
  }

  consume(payload: AdkEventPayload, fallback?: { threadId: string; runId: string }): BaseEvent[] {
    const events: BaseEvent[] = [];
    const timestamp = payload.timestamp || Date.now() / 1000;
    const common = {
      threadId: payload.threadId || fallback?.threadId || "default",
      runId: payload.runId || fallback?.runId || "default",
      timestamp,
      author: payload.author,
    };
    const pushLinkEvent = (childId: string, parentId: string, relation: string) => {
      events.push(
        createCustomEvent(
          {
            ...common,
            messageId: payload.id,
          },
          "ne.a2ui.link",
          {
            childId,
            parentId,
            relation,
          },
        ),
      );
    };
    const role = getPayloadRole(payload);
    const text = extractTextParts(payload).join("");
    const isToolResponsePart = payload.content?.parts?.some((p) => p.functionResponse);

    if (role !== "assistant" || messageShouldFlushAfterPayload(payload)) {
      this.flushAssistantMessage(events, common);
    }

    if (text.trim().length > 0 && payload.message?.role !== "tool" && !isToolResponsePart) {
      if (role !== "user" && role !== "system" && role !== "developer") {
        let openMessage = this.openAssistantMessages.get(common.runId);
        if (!openMessage) {
          openMessage = {
            messageId: payload.id || this.nextMessageId(common.runId, role),
          };
          this.openAssistantMessages.set(common.runId, openMessage);
          events.push(
            createTextMessageStartEvent(
              {
                ...common,
                messageId: openMessage.messageId,
              },
              role,
            ),
          );
        }

        events.push(
          createTextMessageContentEvent(
            {
              ...common,
              messageId: openMessage.messageId,
            },
            text,
          ),
        );
      } else {
        const messageId = payload.id || this.nextMessageId(common.runId, role);
        events.push(
          createTextMessageStartEvent(
            {
              ...common,
              messageId,
            },
            role,
          ),
        );
        events.push(
          createTextMessageContentEvent(
            {
              ...common,
              messageId,
            },
            text,
          ),
        );
        events.push(
          createTextMessageEndEvent({
            ...common,
            messageId,
          }),
        );
      }
    }

    if (payload.message?.tool_calls) {
      payload.message.tool_calls.forEach((tc) => {
        events.push(
          createToolCallStartEvent(
            {
              ...common,
              messageId: payload.id,
            },
            tc.id,
            tc.function.name,
          ),
        );

        if (tc.function.arguments) {
          events.push(
            createToolCallArgsEvent(
              {
                ...common,
                messageId: payload.id,
              },
              tc.id,
              tc.function.arguments,
            ),
          );
        }

        events.push(
          createToolCallEndEvent(
            {
              ...common,
              messageId: payload.id,
            },
            tc.id,
          ),
        );
        const parentMessage = this.openAssistantMessages.get(common.runId);
        pushLinkEvent(`tool:${tc.id}`, parentMessage ? `message:${parentMessage.messageId}` : `message:${payload.id}`, "child");
      });
    }

    if (payload.content?.parts) {
      payload.content.parts.forEach((part) => {
        if (part.functionCall) {
          const fc = part.functionCall;
          events.push(
            createToolCallStartEvent(
              {
                ...common,
                messageId: payload.id,
              },
              fc.id,
              fc.name,
            ),
          );

          events.push(
            createToolCallArgsEvent(
              {
                ...common,
                messageId: payload.id,
              },
              fc.id,
              JSON.stringify(fc.args || {}),
            ),
          );

          events.push(
            createToolCallEndEvent(
              {
                ...common,
                messageId: payload.id,
              },
              fc.id,
            ),
          );
          const parentMessage = this.openAssistantMessages.get(common.runId);
          pushLinkEvent(`tool:${fc.id}`, parentMessage ? `message:${parentMessage.messageId}` : `message:${payload.id}`, "child");
        }
      });
    }

    if (payload.message?.role === "tool" && payload.message.tool_call_id) {
      const content = text || payload.delta || "";
      events.push(
        createToolCallResultEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.message.tool_call_id,
          content,
        ),
      );
      pushLinkEvent(
        `tool-result:${payload.message.tool_call_id}`,
        `tool:${payload.message.tool_call_id}`,
        "child",
      );
    }

    if (payload.content?.parts) {
      payload.content.parts.forEach((part) => {
        if (part.functionResponse) {
          const fr = part.functionResponse;
          const result = fr.response?.result ?? fr.response ?? null;
          const content =
            typeof result === "string" ? result : JSON.stringify(result);
          events.push(
            createToolCallResultEvent(
              {
                ...common,
                messageId: payload.id,
              },
              fr.id,
              content,
            ),
          );
          pushLinkEvent(`tool-result:${fr.id}`, `tool:${fr.id}`, "child");
        }
      });
    }

    if (
      payload.actions?.artifactDelta &&
      Object.keys(payload.actions.artifactDelta).length > 0
    ) {
      events.push(
        createActivitySnapshotEvent(
          {
            ...common,
            messageId: payload.id,
          },
          "artifact",
          payload.actions.artifactDelta || {},
        ),
      );
    }

    if (
      payload.actions?.stateDelta &&
      Object.keys(payload.actions.stateDelta).length > 0
    ) {
      events.push(
        createStateDeltaEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.actions.stateDelta,
        ),
      );
    }

    if (payload.actions?.stateSnapshot) {
      events.push(
        createStateSnapshotEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.actions.stateSnapshot,
        ),
      );
    }

    if (payload.actions?.messagesSnapshot) {
      events.push(
        createMessagesSnapshotEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.actions.messagesSnapshot,
        ),
      );
    }

    if (payload.actions?.stepStarted) {
      events.push(
        createStepStartedEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.actions.stepStarted.id,
          payload.actions.stepStarted.name,
        ),
      );
      events.push(
        createCustomEvent(
          {
            ...common,
            messageId: payload.id,
          },
          "ne.a2ui.reasoning",
          {
            stepId: payload.actions.stepStarted.id,
            phase: "started",
            title: payload.actions.stepStarted.name,
          },
        ),
      );
    }

    if (payload.actions?.stepFinished) {
      events.push(
        createStepFinishedEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.actions.stepFinished.id,
          payload.actions.stepFinished.result,
        ),
      );
      events.push(
        createCustomEvent(
          {
            ...common,
            messageId: payload.id,
          },
          "ne.a2ui.reasoning",
          {
            stepId: payload.actions.stepFinished.id,
            phase: "finished",
            result: payload.actions.stepFinished.result,
          },
        ),
      );
    }

    if (payload.raw) {
      events.push(
        createRawEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.raw,
        ),
      );
    }

    if (payload.custom) {
      events.push(
        createCustomEvent(
          {
            ...common,
            messageId: payload.id,
          },
          payload.custom.type,
          payload.custom.data,
        ),
      );
    }

    if (role === "assistant" && messageShouldFlushAfterPayload(payload)) {
      this.flushAssistantMessage(events, common);
    }

    return events;
  }

  flushRun(runId: string, threadId: string, timestamp = Date.now() / 1000): BaseEvent[] {
    const events: BaseEvent[] = [];
    this.flushAssistantMessage(events, {
      runId,
      threadId,
      timestamp,
    });
    return events;
  }

  flushAll(timestamp = Date.now() / 1000): BaseEvent[] {
    const events: BaseEvent[] = [];
    for (const [runId] of this.openAssistantMessages.entries()) {
      this.flushAssistantMessage(events, {
        runId,
        threadId: "default",
        timestamp,
      });
    }
    return events;
  }
}

export function adkEventToAguiEvents(payload: AdkEventPayload): BaseEvent[] {
  const normalizer = new AdkMessageStreamNormalizer();
  return [
    ...normalizer.consume(payload),
    ...normalizer.flushAll(payload.timestamp || Date.now() / 1000),
  ];
}

export function adkEventsToMessages(events: AdkEventPayload[]): Message[] {
  // ... (unchanged)
  return events.map((e) => {
    let content = "";
    if (e.content?.parts) {
      // 过滤掉包含工具调用的 part，避免重复渲染
      content = e.content.parts
        .filter((p) => !p.functionResponse && !p.functionCall)
        .map((p) => p.text || "")
        .join("");
    } else if (e.message?.content) {
      if (typeof e.message.content === "string") {
        content = e.message.content;
      } else {
        content = e.message.content.map((p) => p.text || "").join("");
      }
    }

    return {
      ...createAgUiMessage({
        id: e.id,
        role: normalizeUiMessageRole(e.message?.role),
        content,
        createdAt: new Date((e.timestamp || Date.now() / 1000) * 1000),
        threadId: e.threadId,
        runId: e.runId,
      }),
    };
  });
}

export function adkEventsToSnapshot(
  events: AdkEventPayload[],
): Record<string, unknown> | null {
  let state: Record<string, unknown> = {};
  let hasState = false;
  for (const e of events) {
    if (e.actions?.stateDelta) {
      hasState = true;
      state = { ...state, ...e.actions.stateDelta };
    }
  }
  return hasState ? state : null;
}

export function aguiEventsToMessages(events: BaseEvent[]): Message[] {
  const messageMap = new Map<
    string,
    {
      id: string;
      role: string;
      content: string;
      createdAt: Date;
      runId?: string;
      threadId?: string;
      streaming: boolean;
    }
  >();

  const orderedEvents = [...events].sort((a, b) => {
    const timeDiff = (a.timestamp || 0) - (b.timestamp || 0);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return String(a.type).localeCompare(String(b.type));
  });

  orderedEvents.forEach((event) => {
    if (
      event.type !== EventType.TEXT_MESSAGE_START &&
      event.type !== EventType.TEXT_MESSAGE_CONTENT &&
      event.type !== EventType.TEXT_MESSAGE_END
    ) {
      return;
    }

    const messageId = getEventMessageId(event);
    if (!messageId) {
      return;
    }

    const createdAt = new Date((event.timestamp || Date.now() / 1000) * 1000);
    const existing = messageMap.get(messageId) || {
      id: messageId,
      role: normalizeUiMessageRole(getEventRole(event)),
      content: "",
      createdAt,
      runId: getEventRunId(event),
      threadId: getEventThreadId(event),
      streaming: true,
    };

    if (
      event.type === EventType.TEXT_MESSAGE_START &&
      typeof getEventRole(event) === "string"
    ) {
      existing.role = normalizeUiMessageRole(getEventRole(event));
    }

    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      existing.content = accumulateTextContent(
        existing.content,
        String(getEventDelta(event) || ""),
      );
    }

    if (createdAt.getTime() < existing.createdAt.getTime()) {
      existing.createdAt = createdAt;
    }

    existing.runId = existing.runId || getEventRunId(event);
    existing.threadId = existing.threadId || getEventThreadId(event);
    if (event.type === EventType.TEXT_MESSAGE_END) {
      existing.streaming = false;
    }

    messageMap.set(messageId, existing);
  });

  return [...messageMap.values()]
    .filter((message) => message.content.trim().length > 0)
    .sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id.localeCompare(b.id);
    })
    .map((message) =>
      createAgUiMessage({
        id: message.id,
        role: normalizeUiMessageRole(message.role),
        content: message.content,
        createdAt: message.createdAt,
        runId: message.runId,
        threadId: message.threadId,
        streaming: message.streaming,
      }),
    );
}
