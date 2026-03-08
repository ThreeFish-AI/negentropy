/**
 * ADK 兼容入口
 *
 * 该文件用于避免历史 `.js` 导入命中旧实现。
 * 新代码应优先使用 `@/lib/agui/schema` 与 `@/lib/agui/factories`。
 */

import { EventType } from "@ag-ui/core";
import { z } from "zod";

const baseEventPropsSchema = z
  .object({
    threadId: z.string(),
    runId: z.string(),
    timestamp: z.number().finite(),
    messageId: z.string().optional(),
    author: z.string().optional(),
  })
  .passthrough();

const baseEventSchema = baseEventPropsSchema
  .extend({
    type: z.nativeEnum(EventType),
  })
  .passthrough();

export function hasBaseEventProps(obj) {
  return baseEventPropsSchema.safeParse(obj).success;
}

export function createTextMessageStartEvent(props, role) {
  return {
    type: EventType.TEXT_MESSAGE_START,
    role,
    ...props,
  };
}

export function createTextMessageContentEvent(props, delta) {
  return {
    type: EventType.TEXT_MESSAGE_CONTENT,
    delta,
    ...props,
  };
}

export function createTextMessageEndEvent(props) {
  return {
    type: EventType.TEXT_MESSAGE_END,
    ...props,
  };
}

export function createToolCallStartEvent(props, toolCallId, toolCallName) {
  return {
    type: EventType.TOOL_CALL_START,
    toolCallId,
    toolCallName,
    ...props,
  };
}

export function createToolCallArgsEvent(props, toolCallId, delta) {
  return {
    type: EventType.TOOL_CALL_ARGS,
    toolCallId,
    delta,
    ...props,
  };
}

export function createToolCallEndEvent(props, toolCallId) {
  return {
    type: EventType.TOOL_CALL_END,
    toolCallId,
    ...props,
  };
}

export function createToolCallResultEvent(props, toolCallId, content) {
  return {
    type: EventType.TOOL_CALL_RESULT,
    toolCallId,
    content,
    ...props,
  };
}

export function createStateDeltaEvent(props, delta) {
  return {
    type: EventType.STATE_DELTA,
    delta,
    ...props,
  };
}

export function createStateSnapshotEvent(props, snapshot) {
  return {
    type: EventType.STATE_SNAPSHOT,
    snapshot,
    ...props,
  };
}

export function createActivitySnapshotEvent(props, activityType, content) {
  return {
    type: EventType.ACTIVITY_SNAPSHOT,
    activityType,
    content,
    ...props,
  };
}

export function createMessagesSnapshotEvent(props, messages) {
  return {
    type: EventType.MESSAGES_SNAPSHOT,
    messages,
    ...props,
  };
}

export function createStepStartedEvent(props, stepId, stepName) {
  return {
    type: EventType.STEP_STARTED,
    stepId,
    stepName,
    ...props,
  };
}

export function createStepFinishedEvent(props, stepId, result) {
  return {
    type: EventType.STEP_FINISHED,
    stepId,
    result,
    ...props,
  };
}

export function createRawEvent(props, data) {
  return {
    type: EventType.RAW,
    data,
    ...props,
  };
}

export function createCustomEvent(props, eventType, eventData) {
  return {
    type: EventType.CUSTOM,
    eventType,
    data: eventData,
    ...props,
  };
}

export function createOptimisticTextEvents(input) {
  return [
    createTextMessageStartEvent(
      {
        threadId: input.threadId,
        runId: input.runId,
        messageId: input.messageId,
        timestamp: input.timestamp,
      },
      input.role,
    ),
    createTextMessageContentEvent(
      {
        threadId: input.threadId,
        runId: input.runId,
        messageId: input.messageId,
        timestamp: input.timestamp,
      },
      input.content,
    ),
    createTextMessageEndEvent({
      threadId: input.threadId,
      runId: input.runId,
      messageId: input.messageId,
      timestamp: input.timestamp,
    }),
  ];
}

export function createMessageWithMeta(input) {
  return {
    id: input.id,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt,
    author: input.author,
    runId: input.runId,
  };
}

export function asBaseEvent(event) {
  return baseEventSchema.parse(event);
}
