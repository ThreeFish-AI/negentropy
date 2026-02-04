import { NextResponse } from "next/server";

function getBaseUrl() {
  return (
    process.env.KNOWLEDGE_BASE_URL ||
    process.env.AGUI_BASE_URL ||
    process.env.NEXT_PUBLIC_AGUI_BASE_URL
  );
}

function extractForwardHeaders(request: Request) {
  const headers = new Headers();

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
    { status }
  );
}

export async function proxyGet(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("KNOWLEDGE_INTERNAL_ERROR", "KNOWLEDGE_BASE_URL is not configured", 500);
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
    return errorResponse("KNOWLEDGE_UPSTREAM_ERROR", `Upstream connection failed: ${String(error)}`, 502);
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse("KNOWLEDGE_UPSTREAM_ERROR", text || "Upstream returned non-OK status", upstreamResponse.status);
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyPost(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("KNOWLEDGE_INTERNAL_ERROR", "KNOWLEDGE_BASE_URL is not configured", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return errorResponse("KNOWLEDGE_BAD_REQUEST", `Invalid JSON body: ${String(error)}`, 400);
  }

  const upstreamUrl = new URL(path, baseUrl);
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
    return errorResponse("KNOWLEDGE_UPSTREAM_ERROR", `Upstream connection failed: ${String(error)}`, 502);
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse("KNOWLEDGE_UPSTREAM_ERROR", text || "Upstream returned non-OK status", upstreamResponse.status);
  }

  return NextResponse.json(JSON.parse(text));
}
