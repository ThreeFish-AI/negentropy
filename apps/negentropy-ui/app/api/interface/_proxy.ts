import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getAguiBaseUrl } from "@/lib/server/backend-url";

/**
 * Plugins API 代理工具函数
 *
 * 用于将前端的 /api/interface/* 请求代理到后端 /interface/* API
 */

const getBaseUrl = getAguiBaseUrl;

function extractForwardHeaders(request: Request) {
  const headers = buildAuthHeaders(request);

  const auth = request.headers.get("authorization");
  if (auth) {
    headers.set("authorization", auth);
  }

  const sessionId = request.headers.get("x-session-id");
  if (sessionId) {
    headers.set("x-session-id", sessionId);
  }

  const userId = request.headers.get("x-user-id");
  if (userId) {
    headers.set("x-user-id", userId);
  }

  return headers;
}

function errorResponse(code: string, message: string, status = 500) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function upstreamErrorResponse(text: string, status: number) {
  if (text) {
    try {
      const errorJson = JSON.parse(text);
      if (errorJson && typeof errorJson === "object") {
        return NextResponse.json(errorJson, { status });
      }
    } catch {
      // fallthrough to generic wrapper
    }
  }

  return errorResponse(
    "PLUGINS_UPSTREAM_ERROR",
    text || "Upstream returned non-OK status",
    status,
  );
}

export async function proxyGet(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "PLUGINS_INTERNAL_ERROR",
      "AGUI_BASE_URL is not configured",
      500,
    );
  }

  const upstreamUrl = new URL(path, baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: extractForwardHeaders(request),
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return upstreamErrorResponse(text, upstreamResponse.status);
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyPost(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "PLUGINS_INTERNAL_ERROR",
      "AGUI_BASE_URL is not configured",
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return errorResponse(
      "PLUGINS_BAD_REQUEST",
      `Invalid JSON body: ${String(error)}`,
      400,
    );
  }

  const upstreamUrl = new URL(path, baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  const headers = extractForwardHeaders(request);
  headers.set("content-type", "application/json");

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return upstreamErrorResponse(text, upstreamResponse.status);
  }

  return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
}

export async function proxyPostFormData(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "PLUGINS_INTERNAL_ERROR",
      "AGUI_BASE_URL is not configured",
      500,
    );
  }

  const formData = await request.formData();
  const upstreamUrl = new URL(path, baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  const headers = extractForwardHeaders(request);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return upstreamErrorResponse(text, upstreamResponse.status);
  }

  return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
}

export async function proxyPatch(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "PLUGINS_INTERNAL_ERROR",
      "AGUI_BASE_URL is not configured",
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return errorResponse(
      "PLUGINS_BAD_REQUEST",
      `Invalid JSON body: ${String(error)}`,
      400,
    );
  }

  const upstreamUrl = new URL(path, baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  const headers = extractForwardHeaders(request);
  headers.set("content-type", "application/json");

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    try {
      const errorJson = JSON.parse(text);
      return NextResponse.json(errorJson, { status: upstreamResponse.status });
    } catch {
      // Fallback if not JSON
    }
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      text || "Upstream returned non-OK status",
      upstreamResponse.status,
    );
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyDelete(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "PLUGINS_INTERNAL_ERROR",
      "AGUI_BASE_URL is not configured",
      500,
    );
  }

  const upstreamUrl = new URL(path, baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;

  let upstreamResponse: Response;
  try {
    const headers = extractForwardHeaders(request);
    upstreamResponse = await fetch(upstreamUrl, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  if (upstreamResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    try {
      const errorJson = JSON.parse(text);
      return NextResponse.json(errorJson, { status: upstreamResponse.status });
    } catch {
      // fallback
    }
    return errorResponse(
      "PLUGINS_UPSTREAM_ERROR",
      text || "Upstream returned non-OK status",
      upstreamResponse.status,
    );
  }

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return new NextResponse(text, { status: upstreamResponse.status });
  }
}
