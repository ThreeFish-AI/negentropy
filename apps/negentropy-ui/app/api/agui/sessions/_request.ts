import { buildAuthHeaders } from "@/lib/sso";
import {
  errorResponse as aguiErrorResponse,
  AGUI_ERROR_CODES,
} from "@/lib/errors";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

/**
 * 返回类型保持 `string | Response` 以维持既有路由的接入形态。
 * 在 SSOT helper 引入默认值之后，Response 分支实际不可达，
 * 但保留该契约作为 defense-in-depth，避免批量修改调用方。
 */
export function getSessionAguiBaseUrl(): string | Response {
  return getAguiBaseUrl();
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

interface SessionListQuery extends SessionScope {
  archived?: boolean;
}

interface SessionCreateBody extends SessionScope {
  sessionId?: string;
  state?: Record<string, unknown>;
  events?: unknown[];
}

interface SessionTitleBody extends SessionScope {
  title: string | null;
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

function missingScopeResponse(): Response {
  return aguiErrorResponse(
    AGUI_ERROR_CODES.BAD_REQUEST,
    "app_name and user_id are required",
  );
}

function invalidJsonBodyResponse(error: unknown): Response {
  return aguiErrorResponse(
    AGUI_ERROR_CODES.BAD_REQUEST,
    `Invalid JSON body: ${String(error)}`,
  );
}

export function parseSessionQueryScope(request: Request): Response | SessionScope {
  const { searchParams } = new URL(request.url);
  const appName = searchParams.get("app_name");
  const userId = searchParams.get("user_id");

  if (!appName || !userId) {
    return missingScopeResponse();
  }

  return { appName, userId };
}

export function parseSessionListQuery(request: Request): Response | SessionListQuery {
  const scope = parseSessionQueryScope(request);
  if (scope instanceof Response) {
    return scope;
  }

  const archived = new URL(request.url).searchParams.get("archived");
  return {
    ...scope,
    archived: archived === "true" ? true : archived === "false" ? false : undefined,
  };
}

export async function parseSessionScopeBody(
  request: Request,
): Promise<Response | SessionScope> {
  let body: {
    app_name?: string;
    user_id?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch (error) {
    return invalidJsonBodyResponse(error);
  }

  if (!body?.app_name || !body?.user_id) {
    return missingScopeResponse();
  }

  return {
    appName: body.app_name,
    userId: body.user_id,
  };
}

export async function parseSessionCreateBody(
  request: Request,
): Promise<Response | SessionCreateBody> {
  let body: {
    app_name?: string;
    user_id?: string;
    session_id?: string;
    state?: Record<string, unknown>;
    events?: unknown[];
  };

  try {
    body = (await request.json()) as typeof body;
  } catch (error) {
    return invalidJsonBodyResponse(error);
  }

  if (!body?.app_name || !body?.user_id) {
    return missingScopeResponse();
  }

  return {
    appName: body.app_name,
    userId: body.user_id,
    sessionId: body.session_id,
    state: body.state,
    events: body.events,
  };
}

export async function parseSessionTitleBody(
  request: Request,
): Promise<Response | SessionTitleBody> {
  let body: {
    app_name?: string;
    user_id?: string;
    title?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch (error) {
    return invalidJsonBodyResponse(error);
  }

  if (!body?.app_name || !body?.user_id) {
    return missingScopeResponse();
  }

  return {
    appName: body.app_name,
    userId: body.user_id,
    title: body.title ?? null,
  };
}
