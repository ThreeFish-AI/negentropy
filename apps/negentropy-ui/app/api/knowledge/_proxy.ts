import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";

function getBaseUrl() {
  return (
    process.env.KNOWLEDGE_BASE_URL ||
    process.env.AGUI_BASE_URL ||
    process.env.NEXT_PUBLIC_AGUI_BASE_URL
  );
}

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

export async function proxyGet(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
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
      "KNOWLEDGE_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse(
      "KNOWLEDGE_UPSTREAM_ERROR",
      text || "Upstream returned non-OK status",
      upstreamResponse.status,
    );
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyPost(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return errorResponse(
      "KNOWLEDGE_BAD_REQUEST",
      `Invalid JSON body: ${String(error)}`,
      400,
    );
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
    return errorResponse(
      "KNOWLEDGE_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse(
      "KNOWLEDGE_UPSTREAM_ERROR",
      text || "Upstream returned non-OK status",
      upstreamResponse.status,
    );
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyPostFormData(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
      500,
    );
  }

  const formData = await request.formData();

  const upstreamUrl = new URL(path, baseUrl);
  const headers = extractForwardHeaders(request);
  // 不设置 content-type，让浏览器自动处理 multipart/form-data 边界

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
      "KNOWLEDGE_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    try {
      // Try to parse error details if available
      const errorJson = JSON.parse(text);
      return NextResponse.json(errorJson, { status: upstreamResponse.status });
    } catch {
      // Fallback if not JSON
    }
    return errorResponse(
      "KNOWLEDGE_UPSTREAM_ERROR",
      text || "Upstream returned non-OK status",
      upstreamResponse.status,
    );
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyPatch(request: Request, path: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
      500,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return errorResponse(
      "KNOWLEDGE_BAD_REQUEST",
      `Invalid JSON body: ${String(error)}`,
      400,
    );
  }

  const upstreamUrl = new URL(path, baseUrl);
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
      "KNOWLEDGE_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    try {
      // Try to parse error details if available
      const errorJson = JSON.parse(text);
      return NextResponse.json(errorJson, { status: upstreamResponse.status });
    } catch {
      // Fallback if not JSON
    }
    return errorResponse(
      "KNOWLEDGE_UPSTREAM_ERROR",
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
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
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
      "KNOWLEDGE_UPSTREAM_ERROR",
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
      "KNOWLEDGE_UPSTREAM_ERROR",
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

/**
 * 代理 GET 请求并返回二进制流
 * 用于文件下载等场景
 */
export async function proxyGetBinary(
  request: Request,
  path: string,
): Promise<Response> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
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
      "KNOWLEDGE_UPSTREAM_ERROR",
      `Upstream connection failed: ${String(error)}`,
      502,
    );
  }

  if (!upstreamResponse.ok) {
    // 复用 proxyDelete 的错误处理模式
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        const errorJson = await upstreamResponse.json();
        return NextResponse.json(errorJson, { status: upstreamResponse.status });
      } catch {
        // fallback
      }
    }
    return errorResponse(
      "KNOWLEDGE_UPSTREAM_ERROR",
      "Upstream returned non-OK status",
      upstreamResponse.status,
    );
  }

  // 转发二进制响应，保留必要的 headers
  const responseHeaders = new Headers();
  const contentDisposition = upstreamResponse.headers.get("content-disposition");
  const contentType = upstreamResponse.headers.get("content-type");
  if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);
  if (contentType) responseHeaders.set("content-type", contentType);

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
