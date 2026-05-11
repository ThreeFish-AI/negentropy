/**
 * Knowledge 域 BFF 代理工具
 *
 * 用于将前端 `/api/knowledge/*` 请求转发到后端 `/knowledge/*`。
 *
 * ### 上游路径约定（SSOT）
 *
 * 跨域一致：Memory / Interface / Knowledge 三个 `_proxy.ts` 均使用
 * `new URL(path, baseUrl)` 构造上游 URL，**不会**在代理层拼接域前缀。
 * 因此本文件导出的 `proxyGet` / `proxyPost` / `proxyPatch` / `proxyDelete` /
 * `proxyPostFormData` / `proxyGetBinary` 等函数的 `path` 参数**必须**为
 * 含 `/knowledge` 前缀的后端绝对路径（与后端 `APIRouter(prefix="/knowledge")`
 * 声明对齐），否则会命中后端 FastAPI 404。
 *
 * ✅ 正确：`proxyPost(request, "/knowledge/catalog/nodes")`
 * ✅ 正确：`` proxyGet(request, `/knowledge/wiki/publications/${pubId}`) ``
 * ❌ 错误：`proxyPost(request, "/catalog/nodes")`          // 缺 `/knowledge`
 * ❌ 错误：`proxyGet(request, `/wiki/publications/${id}`)` // 缺 `/knowledge`
 *
 * 同构参考：`app/api/memory/_proxy.ts`（path 必含 `/memory/`）、
 * `app/api/interface/_proxy.ts`（path 必含 `/interface/`）。
 */

import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";
import { getKnowledgeBaseUrl } from "@/lib/server/backend-url";

const getBaseUrl = getKnowledgeBaseUrl;

/**
 * BFF → 后端默认 fetch 超时（毫秒）。Node.js fetch 默认仅依赖 OS TCP keepalive
 * （往往数分钟），长任务 hang 时前端只能等到 socket 层超时，体感像"凭空 fetch failed"。
 * 显式 30s 上限让快查询失败时能尽早返回，长任务调用方可通过 timeoutMs 覆盖。
 */
export const DEFAULT_PROXY_TIMEOUT_MS = 30_000;

/**
 * 长任务超时（毫秒）：KG build 等长流程的调用方传入此常量。
 * 15min 经验值：覆盖典型 1k chunk 全量构建（含 5 个后置阶段）后仍有冗余；
 * 当前修复（连接池泄漏 + 阶段化进度）后正常构建应在 5min 内完成，超时一般意味着真故障。
 * 注意：UI 通过 SSE 旁路仍可拿到最终终态作为 SSoT，POST 即便 504，KgBuildProgressPill
 * 也会推送 completed/failed 让前端正确转入终态。
 */
export const LONG_TASK_PROXY_TIMEOUT_MS = 15 * 60 * 1_000;

/**
 * Transient 错误自动重试配置。
 *
 * 设计动机：Knowledge Graph 后端 fire-and-forget 构建期间，后端连接池或上游
 * 网络偶发抖动会让 BFF fetch 抛 ``TypeError: fetch failed`` 或上游响应 502/503/504。
 * 前端 ``KgBuildProgressPill`` 虽然已有 10 次外层指数退避，但每次失败都会让用户
 * 短暂看到误导性错误。在 BFF 层增加一段透明 retry 把瞬态错误吸收掉，让前端
 * 只在持续性故障时才看到错误。
 *
 * 触发条件（transient）：
 *  - fetch 抛错且**非** ``DOMException(TimeoutError)``（即 fetch failed /
 *    ECONNRESET / ECONNREFUSED / socket hang up 等连接层瞬态错误）
 *  - upstream Response.status ∈ {502, 503, 504}
 *
 * 不触发（不重试）：
 *  - TimeoutError（请求级超时，重试只会拉长用户等待）
 *  - 4xx 客户端错误（重试无意义）
 *  - 5xx 但非 502/503/504（应用层错误，重试无效）
 *
 * 启用范围：默认 ``undefined``（保留向后兼容），调用方按端点显式启用。
 *   - 已启用：``GET /knowledge/base/:id/graph/build-runs/latest``（轮询）
 *   - 未启用：POST（避免重复 enqueue 副作用，如 KG 构建重复触发）
 */
export type RetryOptions = {
  /** 总尝试次数（首次 + 重试），如 attempts=3 即首次 + 2 次重试 */
  attempts: number;
  /** 每次重试前的退避毫秒数序列；长度应 ≥ attempts-1，超出 attempts-1 的项被忽略 */
  backoffMs: number[];
};

/** 默认轮询端点的重试配置：3 次尝试，200ms / 500ms 退避 */
export const POLLING_RETRY: RetryOptions = {
  attempts: 3,
  backoffMs: [200, 500],
};

type ProxyOptions = {
  /** 覆盖默认 30s 超时；长任务调用方建议传 LONG_TASK_PROXY_TIMEOUT_MS */
  timeoutMs?: number;
  /**
   * Transient 错误自动重试。默认不启用（兼容旧调用方）；
   * 调用方按端点语义显式启用（仅 GET 推荐启用，POST 重试会触发副作用）。
   */
  retry?: RetryOptions;
};

/** 上游响应被视作 transient 的状态码集合 */
const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);

/**
 * 判定 fetch 抛错是否属于 transient（值得重试）。
 *
 * ``DOMException(TimeoutError)`` 来自 ``AbortSignal.timeout()``：请求级超时
 * 由调用方通过 ``timeoutMs`` 显式设定，重试只会让超时累加、用户等待更久，
 * 因此**不**视作 transient。其余 fetch 错误（fetch failed / ECONNRESET /
 * ECONNREFUSED / socket hang up 等）均为连接层瞬态，可重试。
 */
function isTransientFetchError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 把 fetch 异常归类为 504（超时）或 502（其他连接失败），让前端能准确区分。
 * 历史问题：旧版 catch 一律返回 502 KNOWLEDGE_UPSTREAM_ERROR + "TypeError: fetch failed"，
 * 既丢失了"是超时还是别的"信号，也让用户在长任务卡住 5min 后只看到误导性错误。
 */
function classifyFetchError(error: unknown): { code: string; message: string; status: number } {
  // AbortSignal.timeout 触发的中止：DOMException name === "TimeoutError"
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      code: "KNOWLEDGE_UPSTREAM_TIMEOUT",
      message: `Upstream request timed out: ${String(error)}`,
      status: 504,
    };
  }
  return {
    code: "KNOWLEDGE_UPSTREAM_ERROR",
    message: `Upstream connection failed: ${String(error)}`,
    status: 502,
  };
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
    "KNOWLEDGE_UPSTREAM_ERROR",
    text || "Upstream returned non-OK status",
    status,
  );
}

export async function proxyGet(request: Request, path: string, options: ProxyOptions = {}) {
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

  // Transient retry-loop：connection-layer 抛错 / 上游 502/503/504 时按退避序列
  // 重试，吸收 fire-and-forget 后端构建期间的连接池抖动；非 transient 错误（4xx /
  // TimeoutError / 5xx 非 502-504）立即返回。详见 ``RetryOptions`` 文档。
  const retry = options.retry;
  const attempts = retry?.attempts ?? 1;
  const backoffMs = retry?.backoffMs ?? [];

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: extractForwardHeaders(request),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // 仅 transient 且还有剩余 attempt 时退避重试
      if (isTransientFetchError(error) && attempt < attempts) {
        await sleep(backoffMs[attempt - 1] ?? 0);
        continue;
      }
      const { code, message, status } = classifyFetchError(error);
      return errorResponse(code, message, status);
    }

    // 上游 502/503/504 也按 transient 处理（fire-and-forget 后端瞬态不可达）
    if (TRANSIENT_UPSTREAM_STATUSES.has(upstreamResponse.status) && attempt < attempts) {
      // 读取并丢弃响应体，避免连接保持半开（Node fetch 不主动消费会延后 GC）
      try {
        await upstreamResponse.text();
      } catch {
        /* ignore drain errors */
      }
      await sleep(backoffMs[attempt - 1] ?? 0);
      continue;
    }

    const text = await upstreamResponse.text();
    if (!upstreamResponse.ok) {
      return upstreamErrorResponse(text, upstreamResponse.status);
    }
    return NextResponse.json(JSON.parse(text));
  }

  // 理论不可达：retry-loop 内每个分支都有 return 或 continue（continue 仅在
  // attempt<attempts 时才走），最后一次必定走到 return。兜底以满足 TS 控制流分析。
  return errorResponse(
    "KNOWLEDGE_UPSTREAM_ERROR",
    "Upstream temporarily unavailable after retries",
    502,
  );
}

export async function proxyPost(request: Request, path: string, options: ProxyOptions = {}) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return errorResponse(
      "KNOWLEDGE_INTERNAL_ERROR",
      "KNOWLEDGE_BASE_URL is not configured",
      500,
    );
  }

  // 容忍空 body：动作型端点（publish / unpublish / action）通常无请求体。
  // 仅当 body 非空时按 JSON 校验，空则原样转发空 body。
  const rawBody = await request.text();
  let forwardBody: string | undefined;
  if (rawBody.trim().length === 0) {
    forwardBody = undefined;
  } else {
    try {
      JSON.parse(rawBody);
    } catch (error) {
      return errorResponse(
        "KNOWLEDGE_BAD_REQUEST",
        `Invalid JSON body: ${String(error)}`,
        400,
      );
    }
    forwardBody = rawBody;
  }

  const upstreamUrl = new URL(path, baseUrl);
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  const headers = extractForwardHeaders(request);
  if (forwardBody !== undefined) {
    headers.set("content-type", "application/json");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: forwardBody,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const { code, message, status } = classifyFetchError(error);
    return errorResponse(code, message, status);
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return upstreamErrorResponse(text, upstreamResponse.status);
  }

  return NextResponse.json(JSON.parse(text));
}

export async function proxyPostFormData(
  request: Request,
  path: string,
  options: ProxyOptions = {},
) {
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
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  const headers = extractForwardHeaders(request);
  // 不设置 content-type，让浏览器自动处理 multipart/form-data 边界
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const { code, message, status } = classifyFetchError(error);
    return errorResponse(code, message, status);
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

export async function proxyPatch(request: Request, path: string, options: ProxyOptions = {}) {
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
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  const headers = extractForwardHeaders(request);
  headers.set("content-type", "application/json");
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const { code, message, status } = classifyFetchError(error);
    return errorResponse(code, message, status);
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

export async function proxyDelete(request: Request, path: string, options: ProxyOptions = {}) {
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

  let upstreamResponse: Response;
  try {
    const headers = extractForwardHeaders(request);
    upstreamResponse = await fetch(upstreamUrl, {
      method: "DELETE",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const { code, message, status } = classifyFetchError(error);
    return errorResponse(code, message, status);
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
  options: ProxyOptions = {},
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: extractForwardHeaders(request),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const { code, message, status } = classifyFetchError(error);
    return errorResponse(code, message, status);
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
  const cacheControl = upstreamResponse.headers.get("cache-control");
  if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);
  if (contentType) responseHeaders.set("content-type", contentType);
  if (cacheControl) responseHeaders.set("cache-control", cacheControl);

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
