"use strict";

/**
 * ADK 兼容入口
 *
 * 该文件用于避免历史 `.js` 导入命中旧实现。
 * 新代码应优先使用 `@/lib/agui/schema` 与 `@/lib/agui/factories`。
 */

Object.defineProperty(exports, "__esModule", { value: true });
exports.asBaseEvent = asBaseEvent;
exports.createActivitySnapshotEvent = createActivitySnapshotEvent;
exports.createCustomEvent = createCustomEvent;
exports.createMessageWithMeta = createMessageWithMeta;
exports.createMessagesSnapshotEvent = createMessagesSnapshotEvent;
exports.createOptimisticTextEvents = createOptimisticTextEvents;
exports.createRawEvent = createRawEvent;
exports.createStateDeltaEvent = createStateDeltaEvent;
exports.createStateSnapshotEvent = createStateSnapshotEvent;
exports.createStepFinishedEvent = createStepFinishedEvent;
exports.createStepStartedEvent = createStepStartedEvent;
exports.createTextMessageContentEvent = createTextMessageContentEvent;
exports.createTextMessageEndEvent = createTextMessageEndEvent;
exports.createTextMessageStartEvent = createTextMessageStartEvent;
exports.createToolCallArgsEvent = createToolCallArgsEvent;
exports.createToolCallEndEvent = createToolCallEndEvent;
exports.createToolCallResultEvent = createToolCallResultEvent;
exports.createToolCallStartEvent = createToolCallStartEvent;
exports.hasBaseEventProps = hasBaseEventProps;

const { EventType } = require("@ag-ui/core");
const { z } = require("zod");

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

function hasBaseEventProps(obj) {
  return baseEventPropsSchema.safeParse(obj).success;
}

function createTextMessageStartEvent(props, role) {
  return {
    type: EventType.TEXT_MESSAGE_START,
    role,
    ...props,
  };
}

function createTextMessageContentEvent(props, delta) {
  return {
    type: EventType.TEXT_MESSAGE_CONTENT,
    delta,
    ...props,
  };
}

function createTextMessageEndEvent(props) {
  return {
    type: EventType.TEXT_MESSAGE_END,
    ...props,
  };
}

function createToolCallStartEvent(props, toolCallId, toolCallName) {
  return {
    type: EventType.TOOL_CALL_START,
    toolCallId,
    toolCallName,
    ...props,
  };
}

function createToolCallArgsEvent(props, toolCallId, delta) {
  return {
    type: EventType.TOOL_CALL_ARGS,
    toolCallId,
    delta,
    ...props,
  };
}

function createToolCallEndEvent(props, toolCallId) {
  return {
    type: EventType.TOOL_CALL_END,
    toolCallId,
    ...props,
  };
}

function createToolCallResultEvent(props, toolCallId, content) {
  return {
    type: EventType.TOOL_CALL_RESULT,
    toolCallId,
    content,
    ...props,
  };
}

function createStateDeltaEvent(props, delta) {
  return {
    type: EventType.STATE_DELTA,
    delta,
    ...props,
  };
}

function createStateSnapshotEvent(props, snapshot) {
  return {
    type: EventType.STATE_SNAPSHOT,
    snapshot,
    ...props,
  };
}

function createActivitySnapshotEvent(props, activityType, content) {
  return {
    type: EventType.ACTIVITY_SNAPSHOT,
    activityType,
    content,
    ...props,
  };
}

function createMessagesSnapshotEvent(props, messages) {
  return {
    type: EventType.MESSAGES_SNAPSHOT,
    messages,
    ...props,
  };
}

function createStepStartedEvent(props, stepId, stepName) {
  return {
    type: EventType.STEP_STARTED,
    stepId,
    stepName,
    ...props,
  };
}

function createStepFinishedEvent(props, stepId, result) {
  return {
    type: EventType.STEP_FINISHED,
    stepId,
    result,
    ...props,
  };
}

function createRawEvent(props, data) {
  return {
    type: EventType.RAW,
    data,
    ...props,
  };
}

function createCustomEvent(props, eventType, eventData) {
  return {
    type: EventType.CUSTOM,
    eventType,
    data: eventData,
    ...props,
  };
}

function createOptimisticTextEvents(input) {
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

function createMessageWithMeta(input) {
  return {
    id: input.id,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt,
    author: input.author,
    runId: input.runId,
  };
}

function asBaseEvent(event) {
  return baseEventSchema.parse(event);
}
