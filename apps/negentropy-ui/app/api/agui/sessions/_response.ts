import type { SafeParseReturnType } from "zod";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

interface ParseSessionUpstreamJsonOptions<T> {
  upstreamResponse: Response;
  parse: (input: unknown) => SafeParseReturnType<unknown, T>;
  invalidPayloadMessage: string;
  invalidJsonMessage: string;
}

export interface ParsedSessionUpstreamJson<T> {
  data: T;
  status: number;
}

export async function parseSessionUpstreamJson<T>({
  upstreamResponse,
  parse,
  invalidPayloadMessage,
  invalidJsonMessage,
}: ParseSessionUpstreamJsonOptions<T>): Promise<Response | ParsedSessionUpstreamJson<T>> {
  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      text || "Upstream returned non-OK status",
    );
  }

  try {
    const payload = JSON.parse(text) as unknown;
    const parsed = parse(payload);
    if (!parsed.success) {
      return aguiErrorResponse(
        AGUI_ERROR_CODES.UPSTREAM_ERROR,
        invalidPayloadMessage,
      );
    }

    return {
      data: parsed.data,
      status: upstreamResponse.status,
    };
  } catch {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.UPSTREAM_ERROR,
      invalidJsonMessage,
    );
  }
}
