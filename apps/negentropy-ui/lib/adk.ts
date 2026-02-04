import { BaseEvent, EventType, Message } from "@ag-ui/core";

export type AdkEventPayload = {
  id: string;
  threadId?: string;
  runId?: string;
  timestamp?: number;
  author?: string;
  content?: {
    parts?: Array<{ text?: string; type?: string }>;
  };
  message?: {
    role: string;
    content: string | Array<{ text?: string; type?: string }>;
  };
  actions?: {
    stateDelta?: Record<string, unknown>;
    artifactDelta?: Record<string, unknown>;
  };
  delta?: string; // For streaming compatibility if needed
};

export function adkEventToAguiEvents(payload: AdkEventPayload): BaseEvent[] {
  const events: BaseEvent[] = [];
  const timestamp = payload.timestamp || Date.now() / 1000;
  const common = {
    threadId: payload.threadId || "default",
    runId: payload.runId || "default",
    timestamp,
  };

  const messageId = payload.id;

  // Text messages
  let textParts: string[] = [];
  if (payload.content?.parts) {
    textParts = payload.content.parts.map((p) => p.text || "").filter(Boolean);
  } else if (payload.message) {
    if (typeof payload.message.content === "string") {
      textParts = [payload.message.content];
    } else if (Array.isArray(payload.message.content)) {
      textParts = payload.message.content
        .map((p) => p.text || "")
        .filter(Boolean);
    }
  }

  if (textParts.length > 0) {
    const role = payload.message?.role || payload.author || "assistant";

    events.push({
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      role,
      ...common,
    } as unknown as BaseEvent);

    const fullText = textParts.join("");
    if (fullText) {
      events.push({
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta: fullText,
        ...common,
      } as unknown as BaseEvent);
    }

    events.push({
      type: EventType.TEXT_MESSAGE_END,
      messageId,
      ...common,
    } as unknown as BaseEvent);
  }

  // State Delta
  if (
    payload.actions?.stateDelta &&
    Object.keys(payload.actions.stateDelta).length > 0
  ) {
    events.push({
      type: EventType.STATE_DELTA,
      delta: payload.actions.stateDelta,
      ...common,
      messageId,
    } as unknown as BaseEvent);
  }

  return events;
}

export function adkEventsToMessages(events: AdkEventPayload[]): Message[] {
  return events.map((e) => {
    let content = "";
    if (e.content?.parts) {
      content = e.content.parts.map((p) => p.text || "").join("");
    } else if (e.message?.content) {
      if (typeof e.message.content === "string") {
        content = e.message.content;
      } else {
        content = e.message.content.map((p) => p.text || "").join("");
      }
    }

    return {
      id: e.id,
      role: e.message?.role || e.author || "assistant",
      content,
      createdAt: new Date((e.timestamp || Date.now() / 1000) * 1000),
    } as unknown as Message;
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
