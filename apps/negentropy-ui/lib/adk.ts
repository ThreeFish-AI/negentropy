import { BaseEvent, EventType, Message } from "@ag-ui/core";

// ... (imports)

export type AdkEventPayload = {
  id: string;
  threadId?: string;
  runId?: string;
  timestamp?: number;
  author?: string;
  content?: {
    parts?: Array<{
      text?: string;
      type?: string;
      functionCall?: {
        id: string;
        name: string;
        args: Record<string, unknown>;
      };
      functionResponse?: {
        id: string;
        name: string;
        response: {
          result: unknown;
        };
      };
    }>;
  };
  message?: {
    role: string;
    content: string | Array<{ text?: string; type?: string }>;
    // Standard OpenAI/ADK tool calls
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    // Standard OpenAI/ADK tool result
    tool_call_id?: string;
  };
  actions?: {
    stateDelta?: Record<string, unknown>;
    artifactDelta?: Record<string, unknown>;
    stateSnapshot?: Record<string, unknown>;
    messagesSnapshot?: Message[];
    stepStarted?: { id: string; name: string };
    stepFinished?: { id: string; result: unknown };
  };
  delta?: string;
  raw?: Record<string, unknown>;
  custom?: { type: string; data: unknown };
};

export function adkEventToAguiEvents(payload: AdkEventPayload): BaseEvent[] {
  const events: BaseEvent[] = [];
  const timestamp = payload.timestamp || Date.now() / 1000;
  const common = {
    threadId: payload.threadId || "default",
    runId: payload.runId || "default",
    timestamp,
    messageId: payload.id,
  };

  // 1. Text Messages
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

  // Emit Text Events only if not a Tool Result
  const isToolResponsePart = payload.content?.parts?.some(
    (p) => p.functionResponse,
  );

  if (
    textParts.length > 0 &&
    payload.message?.role !== "tool" &&
    !isToolResponsePart
  ) {
    const role = payload.message?.role || payload.author || "assistant";

    events.push({
      type: EventType.TEXT_MESSAGE_START,
      role,
      ...common,
    } as unknown as BaseEvent);

    const fullText = textParts.join("");
    if (fullText) {
      events.push({
        type: EventType.TEXT_MESSAGE_CONTENT,
        delta: fullText,
        ...common,
      } as unknown as BaseEvent);
    }

    events.push({
      type: EventType.TEXT_MESSAGE_END,
      ...common,
    } as unknown as BaseEvent);
  }

  // 2. Tool Calls (OpenAI Style)
  if (payload.message?.tool_calls) {
    payload.message.tool_calls.forEach((tc) => {
      events.push({
        type: EventType.TOOL_CALL_START,
        toolCallId: tc.id,
        toolCallName: tc.function.name,
        ...common,
      } as unknown as BaseEvent);

      if (tc.function.arguments) {
        events.push({
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: tc.id,
          delta: tc.function.arguments,
          ...common,
        } as unknown as BaseEvent);
      }

      events.push({
        type: EventType.TOOL_CALL_END,
        toolCallId: tc.id,
        ...common,
      } as unknown as BaseEvent);
    });
  }

  // 2b. Tool Calls (Gemini/Parts Style)
  if (payload.content?.parts) {
    payload.content.parts.forEach((part) => {
      if (part.functionCall) {
        const fc = part.functionCall;
        events.push({
          type: EventType.TOOL_CALL_START,
          toolCallId: fc.id,
          toolCallName: fc.name,
          ...common,
        } as unknown as BaseEvent);

        const argsString = JSON.stringify(fc.args || {});
        events.push({
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: fc.id,
          delta: argsString,
          ...common,
        } as unknown as BaseEvent);

        events.push({
          type: EventType.TOOL_CALL_END,
          toolCallId: fc.id,
          ...common,
        } as unknown as BaseEvent);
      }
    });
  }

  // 3. Tool Result (OpenAI Style)
  if (payload.message?.role === "tool" && payload.message.tool_call_id) {
    const content = textParts.join("") || payload.delta || "";
    events.push({
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: payload.message.tool_call_id,
      content,
      ...common,
    } as unknown as BaseEvent);
  }

  // 3b. Tool Result (Gemini/Parts Style)
  if (payload.content?.parts) {
    payload.content.parts.forEach((part) => {
      if (part.functionResponse) {
        const fr = part.functionResponse;
        const result = fr.response?.result ?? fr.response ?? null;
        const content =
          typeof result === "string" ? result : JSON.stringify(result);
        events.push({
          type: EventType.TOOL_CALL_RESULT,
          toolCallId: fr.id,
          content,
          ...common,
        } as unknown as BaseEvent);
      }
    });
  }

  // 4. Artifacts (Activity)
  if (
    payload.actions?.artifactDelta &&
    Object.keys(payload.actions.artifactDelta).length > 0
  ) {
    events.push({
      type: EventType.ACTIVITY_SNAPSHOT,
      activityType: "artifact",
      content: payload.actions.artifactDelta || {},
      ...common,
    } as unknown as BaseEvent);
  }

  // 5. State Delta
  if (
    payload.actions?.stateDelta &&
    Object.keys(payload.actions.stateDelta).length > 0
  ) {
    events.push({
      type: EventType.STATE_DELTA,
      delta: payload.actions.stateDelta,
      ...common,
    } as unknown as BaseEvent);
  }

  // 6. State Snapshot（完整状态快照）
  if (payload.actions?.stateSnapshot) {
    events.push({
      type: EventType.STATE_SNAPSHOT,
      snapshot: payload.actions.stateSnapshot,
      ...common,
    } as unknown as BaseEvent);
  }

  // 7. Messages Snapshot（消息历史快照）
  if (payload.actions?.messagesSnapshot) {
    events.push({
      type: EventType.MESSAGES_SNAPSHOT,
      messages: payload.actions.messagesSnapshot,
      ...common,
    } as unknown as BaseEvent);
  }

  // 8. Step Started/Finished（细粒度进度）
  if (payload.actions?.stepStarted) {
    events.push({
      type: EventType.STEP_STARTED,
      stepId: payload.actions.stepStarted.id,
      stepName: payload.actions.stepStarted.name,
      ...common,
    } as unknown as BaseEvent);
  }

  if (payload.actions?.stepFinished) {
    events.push({
      type: EventType.STEP_FINISHED,
      stepId: payload.actions.stepFinished.id,
      result: payload.actions.stepFinished.result,
      ...common,
    } as unknown as BaseEvent);
  }

  // 9. RAW/CUSTOM 事件（透传机制）
  if (payload.raw) {
    events.push({
      type: EventType.RAW,
      data: payload.raw,
      ...common,
    } as unknown as BaseEvent);
  }

  if (payload.custom) {
    events.push({
      type: EventType.CUSTOM,
      eventType: payload.custom.type,
      data: payload.custom.data,
      ...common,
    } as unknown as BaseEvent);
  }

  return events;
}

export function adkEventsToMessages(events: AdkEventPayload[]): Message[] {
  // ... (unchanged)
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
