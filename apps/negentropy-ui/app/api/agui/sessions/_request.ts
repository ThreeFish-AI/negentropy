import { buildAuthHeaders } from "@/lib/sso";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";

export function getSessionAguiBaseUrl(): string | Response {
  const baseUrl = process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
  if (!baseUrl) {
    return aguiErrorResponse(
      AGUI_ERROR_CODES.INTERNAL_ERROR,
      "AGUI_BASE_URL is not configured",
    );
  }

  return baseUrl;
}

export function buildSessionUpstreamHeaders(
  request: Request,
  kind: "json-read" | "json-write",
): HeadersInit {
  const headers = new Headers(buildAuthHeaders(request));
  if (kind === "json-read") {
    headers.set("Accept", "application/json");
  } else {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}
