import { NextResponse } from "next/server";

function getBaseUrl() {
  return process.env.AGUI_BASE_URL || process.env.NEXT_PUBLIC_AGUI_BASE_URL;
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

export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse("AGUI_INTERNAL_ERROR", "AGUI_BASE_URL is not configured", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return errorResponse("AGUI_BAD_REQUEST", `Invalid JSON body: ${String(error)}`, 400);
  }

  const headers = extractForwardHeaders(request);
  headers.set("content-type", "application/json");
  headers.set("accept", "text/event-stream");

  let upstreamResponse: Response;
  try {
    const upstreamUrl = new URL("/run_sse", baseUrl);
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    return errorResponse("AGUI_UPSTREAM_ERROR", `Upstream connection failed: ${String(error)}`, 502);
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return errorResponse("AGUI_UPSTREAM_ERROR", "Upstream returned non-OK status", upstreamResponse.status);
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
