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

interface SessionScope {
  appName: string;
  userId: string;
}

interface SessionTarget extends SessionScope {
  sessionId: string;
}

function buildSessionCollectionPath({ appName, userId }: SessionScope): string {
  return `/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions`;
}

function buildSessionItemPath({ appName, userId, sessionId }: SessionTarget): string {
  return `${buildSessionCollectionPath({ appName, userId })}/${encodeURIComponent(sessionId)}`;
}

export function buildSessionListUpstreamUrl(baseUrl: string, scope: SessionScope): URL {
  return new URL(buildSessionCollectionPath(scope), baseUrl);
}

export function buildSessionCreateUpstreamUrl(baseUrl: string, scope: SessionScope): URL {
  return new URL(buildSessionCollectionPath(scope), baseUrl);
}

export function buildSessionDetailUpstreamUrl(baseUrl: string, target: SessionTarget): URL {
  return new URL(buildSessionItemPath(target), baseUrl);
}

export function buildSessionArchiveUpstreamUrl(baseUrl: string, target: SessionTarget): URL {
  return new URL(`${buildSessionItemPath(target)}/archive`, baseUrl);
}

export function buildSessionTitleUpstreamUrl(baseUrl: string, target: SessionTarget): URL {
  return new URL(`${buildSessionItemPath(target)}/title`, baseUrl);
}

export function buildSessionUnarchiveUpstreamUrl(baseUrl: string, target: SessionTarget): URL {
  return new URL(`${buildSessionItemPath(target)}/unarchive`, baseUrl);
}
