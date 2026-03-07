/**
 * AG-UI 扩展类型与事件访问工具
 *
 * 集中定义 AG-UI 协议事件、消息扩展字段与统一访问器，
 * 避免业务代码在多个模块重复做 `in` 判断和局部交叉类型断言。
 */

import type { BaseEvent, Message } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { safeParseBaseEventProps } from "@/lib/agui/schema";

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

export interface ExtendedMessageProps {
  createdAt?: Date;
  author?: string;
  runId?: string;
  threadId?: string;
  streaming?: boolean;
}

export type AgUiMessage = Message & ExtendedMessageProps;

export type AgUiEvent = BaseEvent &
  Partial<
    BaseEventProps & {
      role: string;
      toolCallId: string;
      toolCallName: string;
      delta: string;
      content: string;
      snapshot: Record<string, unknown>;
      activityType: string;
      stepId: string;
      stepName: string;
      result: unknown;
      eventType: string;
      data: unknown;
      code: string;
      message: string;
      rawEvent: unknown;
    }
  >;

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

export function asAgUiEvent(event: BaseEvent | AgUiEvent | Record<string, unknown>): AgUiEvent {
  return event as AgUiEvent;
}

export function asAgUiMessage(message: Message): AgUiMessage {
  return message as AgUiMessage;
}

export function getEventThreadId(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.threadId === "string" ? record.threadId : undefined;
}

export function getEventRunId(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.runId === "string" ? record.runId : undefined;
}

export function getEventMessageId(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.messageId === "string" ? record.messageId : undefined;
}

export function getEventToolCallId(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.toolCallId === "string" ? record.toolCallId : undefined;
}

export function getEventToolCallName(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.toolCallName === "string"
    ? record.toolCallName
    : undefined;
}

export function getEventRole(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.role === "string" ? record.role : undefined;
}

export function getEventAuthor(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.author === "string" ? record.author : undefined;
}

export function getEventDelta(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.delta === "string" ? record.delta : undefined;
}

export function getEventContent(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.content === "string" ? record.content : undefined;
}

export function getEventActivityType(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.activityType === "string"
    ? record.activityType
    : undefined;
}

export function getEventSnapshot(
  event: BaseEvent,
): Record<string, unknown> | undefined {
  const record = asAgUiEvent(event);
  return typeof record.snapshot === "object" && record.snapshot !== null
    ? record.snapshot
    : undefined;
}

export function getEventStepId(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.stepId === "string" ? record.stepId : undefined;
}

export function getEventStepName(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.stepName === "string" ? record.stepName : undefined;
}

export function getEventResult(event: BaseEvent): unknown {
  return asAgUiEvent(event).result;
}

export function getCustomEventType(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.eventType === "string" ? record.eventType : undefined;
}

export function getCustomEventData(event: BaseEvent): unknown {
  return asAgUiEvent(event).data;
}

export function getEventCode(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.code === "string" ? record.code : undefined;
}

export function getEventErrorMessage(event: BaseEvent): string | undefined {
  const record = asAgUiEvent(event);
  return typeof record.message === "string" ? record.message : undefined;
}

export function getMessageCreatedAt(message: Message): Date | undefined {
  const record = asAgUiMessage(message);
  return record.createdAt instanceof Date ? record.createdAt : undefined;
}

export function getMessageAuthor(message: Message): string | undefined {
  const record = asAgUiMessage(message);
  return typeof record.author === "string" ? record.author : undefined;
}

export function getMessageRunId(message: Message): string | undefined {
  const record = asAgUiMessage(message);
  return typeof record.runId === "string" ? record.runId : undefined;
}

export function getMessageThreadId(message: Message): string | undefined {
  const record = asAgUiMessage(message);
  return typeof record.threadId === "string" ? record.threadId : undefined;
}

export function getMessageStreaming(message: Message): boolean | undefined {
  const record = asAgUiMessage(message);
  return typeof record.streaming === "boolean" ? record.streaming : undefined;
}

export function createAgUiMessage(input: {
  id: string;
  role: Message["role"];
  content: Message["content"];
  createdAt?: Date;
  author?: string;
  runId?: string;
  threadId?: string;
  streaming?: boolean;
}): AgUiMessage {
  return {
    id: input.id,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt,
    author: input.author,
    runId: input.runId,
    threadId: input.threadId,
    streaming: input.streaming,
  } as AgUiMessage;
}

export function createOptimisticTextEvents(input: {
  threadId: string;
  runId: string;
  messageId: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: number;
}): AgUiEvent[] {
  return [
    {
      type: EventType.TEXT_MESSAGE_START,
      threadId: input.threadId,
      runId: input.runId,
      messageId: input.messageId,
      role: input.role,
      timestamp: input.timestamp,
    },
    {
      type: EventType.TEXT_MESSAGE_CONTENT,
      threadId: input.threadId,
      runId: input.runId,
      messageId: input.messageId,
      delta: input.content,
      timestamp: input.timestamp,
    },
    {
      type: EventType.TEXT_MESSAGE_END,
      threadId: input.threadId,
      runId: input.runId,
      messageId: input.messageId,
      timestamp: input.timestamp,
    },
  ];
}

/**
 * 类型守卫：检查是否为 BaseEventProps
 */
export function isBaseEventProps(obj: unknown): obj is BaseEventProps {
  return safeParseBaseEventProps(obj).success;
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
