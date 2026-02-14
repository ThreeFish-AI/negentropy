/**
 * ADK 事件类型守卫
 *
 * 提供类型安全的运行时检查，替代 `as unknown as` 类型断言
 * 遵循 AGENTS.md 原则：循证工程、类型安全
 */

import { BaseEvent, EventType } from "@ag-ui/core";
import type {
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  StateDeltaEvent,
  StateSnapshotEvent,
  ActivitySnapshotEvent,
  MessagesSnapshotEvent,
  StepStartedEvent,
  StepFinishedEvent,
  RawEvent,
  CustomEvent,
} from "@/types/agui";

/**
 * 检查对象是否包含基础事件属性
 */
export function hasBaseEventProps(obj: unknown): obj is {
  threadId: string;
  runId: string;
  timestamp: number;
  messageId?: string;
} {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const props = obj as Record<string, unknown>;
  return (
    typeof props.threadId === "string" &&
    typeof props.runId === "string" &&
    typeof props.timestamp === "number" &&
    (props.messageId === undefined || typeof props.messageId === "string")
  );
}

/**
 * 创建 TEXT_MESSAGE_START 事件
 */
export function createTextMessageStartEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  role: "user" | "agent" | "system",
): TextMessageStartEvent {
  return {
    type: EventType.TEXT_MESSAGE_START,
    role,
    ...props,
  };
}

/**
 * 创建 TEXT_MESSAGE_CONTENT 事件
 */
export function createTextMessageContentEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  delta: string,
): TextMessageContentEvent {
  return {
    type: EventType.TEXT_MESSAGE_CONTENT,
    delta,
    ...props,
  };
}

/**
 * 创建 TEXT_MESSAGE_END 事件
 */
export function createTextMessageEndEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
): TextMessageEndEvent {
  return {
    type: EventType.TEXT_MESSAGE_END,
    ...props,
  };
}

/**
 * 创建 TOOL_CALL_START 事件
 */
export function createToolCallStartEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  toolCallId: string,
  toolCallName: string,
): ToolCallStartEvent {
  return {
    type: EventType.TOOL_CALL_START,
    toolCallId,
    toolCallName,
    ...props,
  };
}

/**
 * 创建 TOOL_CALL_ARGS 事件
 */
export function createToolCallArgsEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  toolCallId: string,
  delta: string,
): ToolCallArgsEvent {
  return {
    type: EventType.TOOL_CALL_ARGS,
    toolCallId,
    delta,
    ...props,
  };
}

/**
 * 创建 TOOL_CALL_END 事件
 */
export function createToolCallEndEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  toolCallId: string,
): ToolCallEndEvent {
  return {
    type: EventType.TOOL_CALL_END,
    toolCallId,
    ...props,
  };
}

/**
 * 创建 TOOL_CALL_RESULT 事件
 */
export function createToolCallResultEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  toolCallId: string,
  content: string,
): ToolCallResultEvent {
  return {
    type: EventType.TOOL_CALL_RESULT,
    toolCallId,
    content,
    ...props,
  };
}

/**
 * 创建 STATE_DELTA 事件
 */
export function createStateDeltaEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  delta: Record<string, unknown>,
): StateDeltaEvent {
  return {
    type: EventType.STATE_DELTA,
    delta,
    ...props,
  };
}

/**
 * 创建 STATE_SNAPSHOT 事件
 */
export function createStateSnapshotEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  snapshot: Record<string, unknown>,
): StateSnapshotEvent {
  return {
    type: EventType.STATE_SNAPSHOT,
    snapshot,
    ...props,
  };
}

/**
 * 创建 ACTIVITY_SNAPSHOT 事件
 */
export function createActivitySnapshotEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  activityType: string,
  content: Record<string, unknown>,
): ActivitySnapshotEvent {
  return {
    type: EventType.ACTIVITY_SNAPSHOT,
    activityType,
    content,
    ...props,
  };
}

/**
 * 创建 MESSAGES_SNAPSHOT 事件
 */
export function createMessagesSnapshotEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  messages: unknown[],
): MessagesSnapshotEvent {
  return {
    type: EventType.MESSAGES_SNAPSHOT,
    messages,
    ...props,
  };
}

/**
 * 创建 STEP_STARTED 事件
 */
export function createStepStartedEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  stepId: string,
  stepName: string,
): StepStartedEvent {
  return {
    type: EventType.STEP_STARTED,
    stepId,
    stepName,
    ...props,
  };
}

/**
 * 创建 STEP_FINISHED 事件
 */
export function createStepFinishedEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  stepId: string,
  result: unknown,
): StepFinishedEvent {
  return {
    type: EventType.STEP_FINISHED,
    stepId,
    result,
    ...props,
  };
}

/**
 * 创建 RAW 事件
 */
export function createRawEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  data: Record<string, unknown>,
): RawEvent {
  return {
    type: EventType.RAW,
    data,
    ...props,
  };
}

/**
 * 创建 CUSTOM 事件
 */
export function createCustomEvent(
  props: {
    threadId: string;
    runId: string;
    timestamp: number;
    messageId: string;
  },
  eventType: string,
  eventData: unknown,
): CustomEvent {
  return {
    type: EventType.CUSTOM,
    eventType,
    data: eventData,
    ...props,
  };
}

/**
 * 类型守卫：安全地将未知类型转换为 BaseEvent
 *
 * 注意：这仅用于已知的、受信任的事件结构
 * 对于不受信任的输入，应使用 Zod 验证
 */
export function asBaseEvent(event: unknown): BaseEvent {
  if (!hasBaseEventProps(event)) {
    throw new Error("Invalid event: missing base properties");
  }
  // 扩展检查可以在这里添加
  return event as BaseEvent;
}
