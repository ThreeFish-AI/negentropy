import { BaseEvent, EventType, Message } from "@ag-ui/core";
import {
  createTextMessageStartEvent,
  createTextMessageContentEvent,
  createTextMessageEndEvent,
  createToolCallStartEvent,
  createToolCallArgsEvent,
  createToolCallEndEvent,
  createToolCallResultEvent,
  createStateDeltaEvent,
  createStateSnapshotEvent,
  createActivitySnapshotEvent,
  createMessagesSnapshotEvent,
  createStepStartedEvent,
  createStepFinishedEvent,
  createRawEvent,
  createCustomEvent,
} from "./adk/guards";

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
    author: payload.author,
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

    events.push(createTextMessageStartEvent(common, role));

    const fullText = textParts.join("");
    if (fullText) {
      events.push(createTextMessageContentEvent(common, fullText));
    }

    events.push(createTextMessageEndEvent(common));
  }

  // 2. Tool Calls (OpenAI Style)
  if (payload.message?.tool_calls) {
    payload.message.tool_calls.forEach((tc) => {
      events.push(createToolCallStartEvent(common, tc.id, tc.function.name));

      if (tc.function.arguments) {
        events.push(createToolCallArgsEvent(common, tc.id, tc.function.arguments));
      }

      events.push(createToolCallEndEvent(common, tc.id));
    });
  }

  // 2b. Tool Calls (Gemini/Parts Style)
  if (payload.content?.parts) {
    payload.content.parts.forEach((part) => {
      if (part.functionCall) {
        const fc = part.functionCall;
        events.push(createToolCallStartEvent(common, fc.id, fc.name));

        const argsString = JSON.stringify(fc.args || {});
        events.push(createToolCallArgsEvent(common, fc.id, argsString));

        events.push(createToolCallEndEvent(common, fc.id));
      }
    });
  }

  // 3. Tool Result (OpenAI Style)
  if (payload.message?.role === "tool" && payload.message.tool_call_id) {
    const content = textParts.join("") || payload.delta || "";
    events.push(createToolCallResultEvent(common, payload.message.tool_call_id, content));
  }

  // 3b. Tool Result (Gemini/Parts Style)
  if (payload.content?.parts) {
    payload.content.parts.forEach((part) => {
      if (part.functionResponse) {
        const fr = part.functionResponse;
        const result = fr.response?.result ?? fr.response ?? null;
        const content =
          typeof result === "string" ? result : JSON.stringify(result);
        events.push(createToolCallResultEvent(common, fr.id, content));
      }
    });
  }

  // 4. Artifacts (Activity)
  if (
    payload.actions?.artifactDelta &&
    Object.keys(payload.actions.artifactDelta).length > 0
  ) {
    events.push(createActivitySnapshotEvent(common, "artifact", payload.actions.artifactDelta || {}));
  }

  // 5. State Delta
  if (
    payload.actions?.stateDelta &&
    Object.keys(payload.actions.stateDelta).length > 0
  ) {
    events.push(createStateDeltaEvent(common, payload.actions.stateDelta));
  }

  // 6. State Snapshot（完整状态快照）
  if (payload.actions?.stateSnapshot) {
    events.push(createStateSnapshotEvent(common, payload.actions.stateSnapshot));
  }

  // 7. Messages Snapshot（消息历史快照）
  if (payload.actions?.messagesSnapshot) {
    events.push(createMessagesSnapshotEvent(common, payload.actions.messagesSnapshot));
  }

  // 8. Step Started/Finished（细粒度进度）
  if (payload.actions?.stepStarted) {
    events.push(createStepStartedEvent(common, payload.actions.stepStarted.id, payload.actions.stepStarted.name));
  }

  if (payload.actions?.stepFinished) {
    events.push(createStepFinishedEvent(common, payload.actions.stepFinished.id, payload.actions.stepFinished.result));
  }

  // 9. RAW/CUSTOM 事件（透传机制）
  if (payload.raw) {
    events.push(createRawEvent(common, payload.raw));
  }

  if (payload.custom) {
    events.push(createCustomEvent(common, payload.custom.type, payload.custom.data));
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
