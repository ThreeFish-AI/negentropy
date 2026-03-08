import type { Message } from "@ag-ui/core";
import {
  createTextMessageContentEvent,
  createTextMessageEndEvent,
  createTextMessageStartEvent,
} from "@/lib/agui/factories";
import {
  createAgUiMessage,
  type AgUiEvent,
  type AgUiMessage,
  type CompatibleEventMessageRole,
} from "@/types/agui";

export function createTestMessage(input: {
  id: string;
  role: Message["role"] | "agent";
  content: Message["content"];
  createdAt?: Date;
  author?: string;
  runId?: string;
  threadId?: string;
  streaming?: boolean;
}): AgUiMessage {
  return createAgUiMessage({
    ...input,
    role: input.role as Message["role"],
  }) as AgUiMessage;
}

export function createTestEvent(event: AgUiEvent): AgUiEvent {
  return event;
}

export function createTestTextMessageEvents(input: {
  threadId?: string;
  runId?: string;
  messageId: string;
  role: CompatibleEventMessageRole;
  timestamp: number;
  delta: string;
}): AgUiEvent[] {
  const threadId = input.threadId || "thread-1";
  const runId = input.runId || "run-1";

  return [
    createTextMessageStartEvent(
      {
        threadId,
        runId,
        messageId: input.messageId,
        timestamp: input.timestamp,
      },
      input.role,
    ),
    createTextMessageContentEvent(
      {
        threadId,
        runId,
        messageId: input.messageId,
        timestamp: input.timestamp,
      },
      input.delta,
    ),
    createTextMessageEndEvent({
      threadId,
      runId,
      messageId: input.messageId,
      timestamp: input.timestamp,
    }),
  ];
}
