import type { Message } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import type {
  ActivitySnapshotEvent,
  AgUiMessage,
  BaseEventProps,
  CompatibleEventMessageRole,
  CustomEvent,
  MessagesSnapshotEvent,
  RawEvent,
  StateDeltaEvent,
  StateSnapshotEvent,
  StepFinishedEvent,
  StepStartedEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  TextMessageStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  ToolCallStartEvent,
} from "@/types/agui";
import { createAgUiMessage } from "@/types/agui";

type RequiredMessageEventProps = BaseEventProps & { messageId: string };

export function createTextMessageStartEvent(
  props: RequiredMessageEventProps,
  role: CompatibleEventMessageRole,
): TextMessageStartEvent {
  return {
    type: EventType.TEXT_MESSAGE_START,
    role,
    ...props,
  };
}

export function createTextMessageContentEvent(
  props: RequiredMessageEventProps,
  delta: string,
): TextMessageContentEvent {
  return {
    type: EventType.TEXT_MESSAGE_CONTENT,
    delta,
    ...props,
  };
}

export function createTextMessageEndEvent(
  props: RequiredMessageEventProps,
): TextMessageEndEvent {
  return {
    type: EventType.TEXT_MESSAGE_END,
    ...props,
  };
}

export function createToolCallStartEvent(
  props: RequiredMessageEventProps,
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

export function createToolCallArgsEvent(
  props: RequiredMessageEventProps,
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

export function createToolCallEndEvent(
  props: RequiredMessageEventProps,
  toolCallId: string,
): ToolCallEndEvent {
  return {
    type: EventType.TOOL_CALL_END,
    toolCallId,
    ...props,
  };
}

export function createToolCallResultEvent(
  props: RequiredMessageEventProps,
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

export function createStateDeltaEvent(
  props: RequiredMessageEventProps,
  delta: Record<string, unknown>,
): StateDeltaEvent {
  return {
    type: EventType.STATE_DELTA,
    delta,
    ...props,
  };
}

export function createStateSnapshotEvent(
  props: RequiredMessageEventProps,
  snapshot: Record<string, unknown>,
): StateSnapshotEvent {
  return {
    type: EventType.STATE_SNAPSHOT,
    snapshot,
    ...props,
  };
}

export function createActivitySnapshotEvent(
  props: RequiredMessageEventProps,
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

export function createMessagesSnapshotEvent(
  props: RequiredMessageEventProps,
  messages: unknown[],
): MessagesSnapshotEvent {
  return {
    type: EventType.MESSAGES_SNAPSHOT,
    messages,
    ...props,
  };
}

export function createStepStartedEvent(
  props: RequiredMessageEventProps,
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

export function createStepFinishedEvent(
  props: RequiredMessageEventProps,
  stepId: string,
  result: unknown,
  // ISSUE-040 H2: ag-ui v0.0.47 validator 在 STEP_STARTED/STEP_FINISHED 配对时
  // 用 `stepName`（而非 `stepId`）作 key 比对。若 STEP_FINISHED 不带 stepName，
  // 校验器会把 undefined 视为「未开始过」，抛 `Cannot send 'STEP_FINISHED' for
  // step "undefined" that was not started`，整个 run 被中断 → 推理节点状态卡在
  // running、Home 气泡顶部「正在思考 · 推理阶段」永不切换为「思考完成」。
  stepName?: string,
): StepFinishedEvent {
  return {
    type: EventType.STEP_FINISHED,
    stepId,
    stepName,
    result,
    ...props,
  };
}

export function createRawEvent(
  props: RequiredMessageEventProps,
  data: Record<string, unknown>,
): RawEvent {
  return {
    type: EventType.RAW,
    data,
    ...props,
  };
}

export function createCustomEvent(
  props: RequiredMessageEventProps,
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

export function createMessageWithMeta(input: {
  id: string;
  role: Message["role"];
  content: Message["content"];
  createdAt?: Date;
  author?: string;
  runId?: string;
}): AgUiMessage {
  return createAgUiMessage(input);
}
