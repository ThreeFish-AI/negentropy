import { z } from "zod";

const sessionMetadataSchema = z
  .object({
    title: z.string().optional(),
    archived: z.boolean().optional(),
  })
  .passthrough();

const sessionStateSchema = z
  .object({
    metadata: sessionMetadataSchema.optional(),
  })
  .passthrough();

export const aguiSessionSummarySchema = z
  .object({
    id: z.string(),
    lastUpdateTime: z.number().finite().optional(),
    state: sessionStateSchema.optional(),
  })
  .passthrough();

export const aguiSessionListSchema = z.array(aguiSessionSummarySchema);

export const aguiSessionDetailSchema = z
  .object({
    id: z.string(),
    lastUpdateTime: z.number().finite().optional(),
    state: z.record(z.unknown()).optional(),
    events: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const aguiCreateSessionResponseSchema = z
  .object({
    id: z.string(),
    lastUpdateTime: z.number().finite().optional(),
  })
  .passthrough();

export type AguiSessionSummary = z.infer<typeof aguiSessionSummarySchema>;
export type AguiSessionDetail = z.infer<typeof aguiSessionDetailSchema>;
export type AguiCreateSessionResponse = z.infer<typeof aguiCreateSessionResponseSchema>;

export function safeParseSessionListResponse(input: unknown) {
  return aguiSessionListSchema.safeParse(input);
}

export function safeParseSessionDetailResponse(input: unknown) {
  return aguiSessionDetailSchema.safeParse(input);
}

export function safeParseCreateSessionResponse(input: unknown) {
  return aguiCreateSessionResponseSchema.safeParse(input);
}
