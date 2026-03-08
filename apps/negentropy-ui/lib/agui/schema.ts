import type { BaseEvent } from "@ag-ui/core";
import { EventType } from "@ag-ui/core";
import { z } from "zod";
import type { AguiEvent, BaseEventProps } from "@/types/agui";

const metadataRecordSchema = z.record(z.unknown());

export const baseEventPropsSchema = z
  .object({
    threadId: z.string(),
    runId: z.string(),
    timestamp: z.number().finite(),
    messageId: z.string().optional(),
    author: z.string().optional(),
  })
  .passthrough();

export const baseEventSchema = baseEventPropsSchema
  .extend({
    type: z.nativeEnum(EventType),
  })
  .passthrough();

const textMessageStartEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TEXT_MESSAGE_START),
  role: z.enum(["user", "assistant", "agent", "system", "developer", "tool"]),
});

const textMessageContentEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TEXT_MESSAGE_CONTENT),
  delta: z.string(),
});

const textMessageEndEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TEXT_MESSAGE_END),
});

const toolCallStartEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TOOL_CALL_START),
  toolCallId: z.string(),
  toolCallName: z.string(),
});

const toolCallArgsEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TOOL_CALL_ARGS),
  toolCallId: z.string(),
  delta: z.string(),
});

const toolCallEndEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TOOL_CALL_END),
  toolCallId: z.string(),
});

const toolCallResultEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.TOOL_CALL_RESULT),
  toolCallId: z.string(),
  content: z.string(),
});

const stateDeltaEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.STATE_DELTA),
  delta: metadataRecordSchema,
});

const stateSnapshotEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.STATE_SNAPSHOT),
  snapshot: metadataRecordSchema,
});

const activitySnapshotEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.ACTIVITY_SNAPSHOT),
  activityType: z.string(),
  content: metadataRecordSchema,
});

const messagesSnapshotEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.MESSAGES_SNAPSHOT),
  messages: z.array(z.unknown()),
});

const stepStartedEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.STEP_STARTED),
  stepId: z.string(),
  stepName: z.string(),
});

const stepFinishedEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.STEP_FINISHED),
  stepId: z.string(),
  result: z.unknown(),
});

const rawEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.RAW),
  data: metadataRecordSchema,
});

const customEventSchema = baseEventPropsSchema.extend({
  type: z.literal(EventType.CUSTOM),
  eventType: z.string(),
  data: z.unknown(),
});

export const agUiEventSchema = z.discriminatedUnion("type", [
  textMessageStartEventSchema,
  textMessageContentEventSchema,
  textMessageEndEventSchema,
  toolCallStartEventSchema,
  toolCallArgsEventSchema,
  toolCallEndEventSchema,
  toolCallResultEventSchema,
  stateDeltaEventSchema,
  stateSnapshotEventSchema,
  activitySnapshotEventSchema,
  messagesSnapshotEventSchema,
  stepStartedEventSchema,
  stepFinishedEventSchema,
  rawEventSchema,
  customEventSchema,
]) as z.ZodType<AguiEvent>;

export function parseBaseEventProps(input: unknown): BaseEventProps {
  return baseEventPropsSchema.parse(input);
}

export function safeParseBaseEventProps(input: unknown) {
  return baseEventPropsSchema.safeParse(input);
}

export function parseBaseEvent(input: unknown): BaseEvent {
  return baseEventSchema.parse(input) as BaseEvent;
}

export function safeParseBaseEvent(input: unknown) {
  return baseEventSchema.safeParse(input);
}

export function parseAgUiEvent(input: unknown): AguiEvent {
  return agUiEventSchema.parse(input);
}

export function safeParseAgUiEvent(input: unknown) {
  return agUiEventSchema.safeParse(input);
}
