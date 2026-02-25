/**
 * AG-UI 事件类型定义
 *
 * 集中定义 AG-UI 协议的事件类型，避免类型定义分散
 * 参考: docs/negentropy-ui-plan.md 第 13.4.1 节
 */

import { EventType } from "@ag-ui/core";

/**
 * 基础事件属性
 */
export interface BaseEventProps {
  threadId: string;
  runId: string;
  timestamp: number;
  messageId?: string;
  /** 消息作者/Agent 名称（来自后端 AdkEventPayload.author） */
  author?: string;
}

/**
 * TEXT_MESSAGE 相关事件
 */
export interface TextMessageStartEvent extends BaseEventProps {
  type: EventType.TEXT_MESSAGE_START;
  role: "user" | "agent" | "system";
}

export interface TextMessageContentEvent extends BaseEventProps {
  type: EventType.TEXT_MESSAGE_CONTENT;
  delta: string;
}

export interface TextMessageEndEvent extends BaseEventProps {
  type: EventType.TEXT_MESSAGE_END;
}

/**
 * TOOL_CALL 相关事件
 */
export interface ToolCallStartEvent extends BaseEventProps {
  type: EventType.TOOL_CALL_START;
  toolCallId: string;
  toolCallName: string;
}

export interface ToolCallArgsEvent extends BaseEventProps {
  type: EventType.TOOL_CALL_ARGS;
  toolCallId: string;
  delta: string; // JSON string of arguments
}

export interface ToolCallEndEvent extends BaseEventProps {
  type: EventType.TOOL_CALL_END;
  toolCallId: string;
}

export interface ToolCallResultEvent extends BaseEventProps {
  type: EventType.TOOL_CALL_RESULT;
  toolCallId: string;
  content: string;
}

/**
 * STATE 相关事件
 */
export interface StateDeltaEvent extends BaseEventProps {
  type: EventType.STATE_DELTA;
  delta: Record<string, unknown>;
}

export interface StateSnapshotEvent extends BaseEventProps {
  type: EventType.STATE_SNAPSHOT;
  snapshot: Record<string, unknown>;
}

/**
 * ACTIVITY 相关事件
 */
export interface ActivitySnapshotEvent extends BaseEventProps {
  type: EventType.ACTIVITY_SNAPSHOT;
  activityType: string;
  content: Record<string, unknown>;
}

/**
 * MESSAGES 相关事件
 */
export interface MessagesSnapshotEvent extends BaseEventProps {
  type: EventType.MESSAGES_SNAPSHOT;
  messages: unknown[];
}

/**
 * STEP 相关事件
 */
export interface StepStartedEvent extends BaseEventProps {
  type: EventType.STEP_STARTED;
  stepId: string;
  stepName: string;
}

export interface StepFinishedEvent extends BaseEventProps {
  type: EventType.STEP_FINISHED;
  stepId: string;
  result: unknown;
}

/**
 * RAW/CUSTOM 事件
 */
export interface RawEvent extends BaseEventProps {
  type: EventType.RAW;
  data: Record<string, unknown>;
}

export interface CustomEvent extends BaseEventProps {
  type: EventType.CUSTOM;
  eventType: string;
  data: unknown;
}

/**
 * AG-UI 事件联合类型
 */
export type AguiEvent =
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StateDeltaEvent
  | StateSnapshotEvent
  | ActivitySnapshotEvent
  | MessagesSnapshotEvent
  | StepStartedEvent
  | StepFinishedEvent
  | RawEvent
  | CustomEvent;

/**
 * 类型守卫：检查是否为 BaseEventProps
 */
export function isBaseEventProps(obj: unknown): obj is BaseEventProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const props = obj as Partial<BaseEventProps>;
  return (
    typeof props.threadId === "string" &&
    typeof props.runId === "string" &&
    typeof props.timestamp === "number"
  );
}

/**
 * 类型守卫：检查是否为 TextMessageEvent
 */
export function isTextMessageEvent(
  event: AguiEvent,
): event is
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent {
  return (
    event.type === EventType.TEXT_MESSAGE_START ||
    event.type === EventType.TEXT_MESSAGE_CONTENT ||
    event.type === EventType.TEXT_MESSAGE_END
  );
}

/**
 * 类型守卫：检查是否为 ToolCallEvent
 */
export function isToolCallEvent(
  event: AguiEvent,
): event is
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent {
  return (
    event.type === EventType.TOOL_CALL_START ||
    event.type === EventType.TOOL_CALL_ARGS ||
    event.type === EventType.TOOL_CALL_END ||
    event.type === EventType.TOOL_CALL_RESULT
  );
}

/**
 * 类型守卫：检查是否为 StateEvent
 */
export function isStateEvent(
  event: AguiEvent,
): event is StateDeltaEvent | StateSnapshotEvent {
  return (
    event.type === EventType.STATE_DELTA ||
    event.type === EventType.STATE_SNAPSHOT
  );
}
