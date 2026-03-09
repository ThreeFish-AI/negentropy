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

type EnvelopeMeta = Partial<
  Pick<AdkEventPayload, "id" | "threadId" | "runId" | "timestamp" | "author">
>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMeta(meta: EnvelopeMeta, value: Record<string, unknown>): EnvelopeMeta {
  return {
    id: typeof value.id === "string" ? value.id : meta.id,
    threadId: typeof value.threadId === "string" ? value.threadId : meta.threadId,
    runId: typeof value.runId === "string" ? value.runId : meta.runId,
    timestamp:
      typeof value.timestamp === "number" && Number.isFinite(value.timestamp)
        ? value.timestamp
        : meta.timestamp,
    author: typeof value.author === "string" ? value.author : meta.author,
  };
}

function normalizeEventId(candidate: Record<string, unknown>, meta: EnvelopeMeta): string {
  if (typeof candidate.id === "string" && candidate.id.trim()) {
    return candidate.id;
  }
  if (typeof meta.id === "string" && meta.id.trim()) {
    return meta.id;
  }
  const runOrThread =
    (typeof candidate.runId === "string" && candidate.runId) ||
    (typeof candidate.threadId === "string" && candidate.threadId) ||
    meta.runId ||
    meta.threadId ||
    "adk";
  const timestamp =
    typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp)
      ? candidate.timestamp
      : meta.timestamp || Date.now() / 1000;
  return `adk:${runOrThread}:${timestamp}`;
}

function looksLikePayload(value: Record<string, unknown>): boolean {
  return (
    "content" in value ||
    "message" in value ||
    "actions" in value ||
    "custom" in value ||
    "raw" in value ||
    "delta" in value
  );
}

function maybeCreatePayload(
  candidate: Record<string, unknown>,
  meta: EnvelopeMeta,
): AdkEventPayload | null {
  const mergedCandidate: Record<string, unknown> = {
    ...candidate,
    id: normalizeEventId(candidate, meta),
    threadId:
      typeof candidate.threadId === "string" ? candidate.threadId : meta.threadId,
    runId: typeof candidate.runId === "string" ? candidate.runId : meta.runId,
    timestamp:
      typeof candidate.timestamp === "number" && Number.isFinite(candidate.timestamp)
        ? candidate.timestamp
        : meta.timestamp,
    author: typeof candidate.author === "string" ? candidate.author : meta.author,
  };
  const parsed = adkEventPayloadSchema.safeParse(mergedCandidate);
  return parsed.success ? parsed.data : null;
}

function payloadFromTypedEnvelope(
  envelope: Record<string, unknown>,
  meta: EnvelopeMeta,
): AdkEventPayload | null {
  const eventType = String(
    envelope.type || envelope.eventType || envelope.kind || "",
  ).toLowerCase();
  const payload = isObject(envelope.data)
    ? envelope.data
    : isObject(envelope.payload)
      ? envelope.payload
      : null;
  const envelopeMeta = mergeMeta(meta, envelope);
  if (!payload) {
    return null;
  }

  if (looksLikePayload(payload)) {
    return maybeCreatePayload(payload, envelopeMeta);
  }

  if (eventType.includes("step_started") || eventType.includes("step-started")) {
    return maybeCreatePayload(
      {
        actions: {
          stepStarted: {
            id: String(payload.id || envelope.id || "step"),
            name: String(payload.name || payload.title || "step"),
          },
        },
      },
      envelopeMeta,
    );
  }

  if (eventType.includes("step_finished") || eventType.includes("step-finished")) {
    return maybeCreatePayload(
      {
        actions: {
          stepFinished: {
            id: String(payload.id || envelope.id || "step"),
            result: payload.result ?? payload,
          },
        },
      },
      envelopeMeta,
    );
  }

  return null;
}

function collectPayloadsRecursive(
  input: unknown,
  meta: EnvelopeMeta,
  payloads: AdkEventPayload[],
): number {
  if (Array.isArray(input)) {
    return input.reduce(
      (invalidCount, item) =>
        invalidCount + collectPayloadsRecursive(item, meta, payloads),
      0,
    );
  }

  if (!isObject(input)) {
    return 1;
  }

  const nextMeta = mergeMeta(meta, input);
  if (looksLikePayload(input)) {
    const directPayload = maybeCreatePayload(input, nextMeta);
    if (directPayload) {
      payloads.push(directPayload);
      return 0;
    }
  }

  const nestedCandidates = [input.events, input.event, input.payload];
  for (const candidate of nestedCandidates) {
    if (candidate !== undefined) {
      const invalidCount = collectPayloadsRecursive(candidate, nextMeta, payloads);
      if (payloads.length > 0) {
        return invalidCount;
      }
    }
  }

  const typedPayload = payloadFromTypedEnvelope(input, nextMeta);
  if (typedPayload) {
    payloads.push(typedPayload);
    return 0;
  }

  if ("data" in input) {
    return collectPayloadsRecursive(input.data, nextMeta, payloads);
  }

  return 1;
}

export function parseAdkEventPayload(input: unknown): AdkEventPayload {
  const { payloads, invalidCount } = collectAdkEventPayloads(input);
  if (payloads.length === 0 || invalidCount > 0) {
    throw new Error("Invalid ADK event payload");
  }
  return payloads[0]!;
}

export function safeParseAdkEventPayload(input: unknown) {
  try {
    const payload = parseAdkEventPayload(input);
    return { success: true as const, data: payload };
  } catch (error) {
    return {
      success: false as const,
      error,
    };
  }
}

export function collectAdkEventPayloads(input: unknown): {
  payloads: AdkEventPayload[];
  invalidCount: number;
} {
  const payloads: AdkEventPayload[] = [];
  const invalidCount = collectPayloadsRecursive(input, {}, payloads);
  return { payloads, invalidCount };
}
