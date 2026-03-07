import type { Message } from "@ag-ui/core";
import { z } from "zod";

const metadataRecordSchema = z.record(z.unknown());
const looseObjectSchema = z.object({}).passthrough();

const adkFunctionCallSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    args: metadataRecordSchema,
  })
  .passthrough();

const adkFunctionResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    response: looseObjectSchema.passthrough(),
  })
  .passthrough();

const adkContentPartSchema = z
  .object({
    text: z.string().optional(),
    type: z.string().optional(),
    functionCall: adkFunctionCallSchema.optional(),
    functionResponse: adkFunctionResponseSchema.optional(),
  })
  .passthrough();

const adkMessageContentPartSchema = z
  .object({
    text: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const adkToolCallSchema = z
  .object({
    id: z.string(),
    type: z.literal("function"),
    function: z
      .object({
        name: z.string(),
        arguments: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

const adkMessageSchema = z
  .object({
    role: z.string(),
    content: z.union([z.string(), z.array(adkMessageContentPartSchema)]),
    tool_calls: z.array(adkToolCallSchema).optional(),
    tool_call_id: z.string().optional(),
  })
  .passthrough();

const adkActionsSchema = z
  .object({
    stateDelta: metadataRecordSchema.optional(),
    artifactDelta: metadataRecordSchema.optional(),
    stateSnapshot: metadataRecordSchema.optional(),
    messagesSnapshot: z.array(z.custom<Message>()).optional(),
    stepStarted: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .passthrough()
      .optional(),
    stepFinished: z
      .object({
        id: z.string(),
        result: z.unknown(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const adkEventPayloadSchema = z
  .object({
    id: z.string(),
    threadId: z.string().optional(),
    runId: z.string().optional(),
    timestamp: z.number().finite().optional(),
    author: z.string().optional(),
    content: z
      .object({
        parts: z.array(adkContentPartSchema).optional(),
      })
      .passthrough()
      .optional(),
    message: adkMessageSchema.optional(),
    actions: adkActionsSchema.optional(),
    delta: z.string().optional(),
    raw: metadataRecordSchema.optional(),
    custom: z
      .object({
        type: z.string(),
        data: z.unknown(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type AdkEventPayload = z.infer<typeof adkEventPayloadSchema>;

export function parseAdkEventPayload(input: unknown): AdkEventPayload {
  return adkEventPayloadSchema.parse(input);
}

export function safeParseAdkEventPayload(input: unknown) {
  return adkEventPayloadSchema.safeParse(input);
}

export function collectAdkEventPayloads(input: unknown): {
  payloads: AdkEventPayload[];
  invalidCount: number;
} {
  if (!Array.isArray(input)) {
    return { payloads: [], invalidCount: 0 };
  }

  const payloads: AdkEventPayload[] = [];
  let invalidCount = 0;

  input.forEach((item) => {
    const parsed = safeParseAdkEventPayload(item);
    if (parsed.success) {
      payloads.push(parsed.data);
      return;
    }
    invalidCount += 1;
  });

  return { payloads, invalidCount };
}
