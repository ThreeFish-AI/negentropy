/**
 * BFF 代理单一实现（Knowledge / Interface(Plugins) / Memory 三域共用）
 *
 * 历史上三个域各自维护同构 `_proxy.ts`（注释互称「同构参考」），能力随时间漂移：
 * Knowledge 率先长出超时 / 二进制 Range 透传 / transient 重试，Interface 长出 PUT 与
 * 成功状态码透传，Memory 长出非 JSON 安全降级。本模块以「能力并集」收敛为唯一实现，
 * 各域通过 `createBffProxy(config)` 绑定错误码前缀 / 环境变量名 / 基址解析器，
 * 再由各域 `_proxy.ts` 薄再导出（消费方 import 路径与导出名零改动）。
 *
 * ### 上游路径约定（SSOT）
 *
 * 统一使用 `new URL(path, baseUrl)` 构造上游 URL，**不会**在代理层拼接域前缀。
 * 因此 `path` 参数必须为含域前缀的后端绝对路径（与后端 `APIRouter(prefix=...)`
 * 声明对齐），否则会命中后端 FastAPI 404：
 *
 * ✅ `proxyPost(request, "/knowledge/catalog/nodes")`
 * ❌ `proxyPost(request, "/catalog/nodes")`  // 缺 `/knowledge`
 *
 * ### 能力清单（三域并集，逐项对齐最强实现）
 *
 * - 超时：`AbortSignal.timeout`；默认值由域配置 `defaultTimeoutMs` 决定（可为
 *   `undefined` 表示不设上限——Interface 域因后端 MCP 工具调用操作超时上限 120s
 *   而保守保持无默认超时，调用方可按端点显式传入 `timeoutMs`）。
 * - 错误分类：fetch 抛 `DOMException(TimeoutError)` → 504 `{前缀}_UPSTREAM_TIMEOUT`；
 *   其余连接层失败 → 502 `{前缀}_UPSTREAM_ERROR`。
 * - 上游错误透传：上游非 2xx 且 body 为 JSON object 时原样透传（保留后端错误细节
 *   与状态码）；否则包装为 `{error: {code, message}}` 信封。
 * - 成功响应：JSON body 原样透传并保留上游 2xx 状态码；`204` 短路返回空 body；
 *   非 JSON body 安全降级为 `{data: text}`（不抛 500）。
 * - Transient 重试：仅 `proxyGet` 支持 `options.retry`（连接层抛错 / 上游
 *   502/503/504 时按退避序列重试），POST 不重试以避免副作用。
 * - 二进制：`proxyGetBinary` 透传 Range / 条件请求头与 206/304/416，支持
 *   `responseDisposition: "inline"` 预览改写。
 */

import { NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/sso";

/**
 * BFF → 后端默认 fetch 超时（毫秒）。Node.js fetch 默认仅依赖 OS TCP keepalive
 * （往往数分钟），长任务 hang 时前端只能等到 socket 层超时，体感像"凭空 fetch failed"。
 * 显式 30s 上限让快查询失败时能尽早返回，长任务调用方可通过 timeoutMs 覆盖。
 */
export const DEFAULT_PROXY_TIMEOUT_MS = 30_000;

/**
 * 二进制（PDF / 下载 / 资产）代理默认超时（毫秒）。
 *
 * 大 PDF 的「无 Range 全量 GET」在慢链路上可能超过 30s 文本默认值；而启用 Range 后
 * 浏览器原生查看器只发小块请求、个个很快，绝不触及此上限。提高到 120s 仅为兜底首屏
 * 全量拉取（如旧后端未升级或客户端不发 Range 时）。调用方仍可通过 `timeoutMs` 覆盖。
 */
export const DEFAULT_BINARY_PROXY_TIMEOUT_MS = 120_000;

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

export type ProxyOptions = {
  /** 覆盖域默认超时；长任务调用方建议传 LONG_TASK_PROXY_TIMEOUT_MS */
  timeoutMs?: number;
  /**
   * Transient 错误自动重试（仅 proxyGet 消费）。默认不启用（兼容旧调用方）；
   * 调用方按端点语义显式启用（仅 GET 推荐启用，POST 重试会触发副作用）。
   */
  retry?: RetryOptions;
  /**
   * 仅 `proxyGetBinary` 消费：把上游二进制响应的 `Content-Disposition` 强制为
   * `inline`，使浏览器（`<object>`/`<iframe>`）内联渲染而非触发下载。默认
   * `undefined` → 原样透传上游头部，行为不变（向后兼容）。
   *
   * 设计动机：后端 `/download` 端点固定回传 `attachment`（语义为「下载」），
   * 但 PDF 源文档「预览」场景需要内联渲染。复用同一后端端点、仅在 BFF 层改写
   * 响应头，避免后端为预览新增并行端点（单一事实源 + 最小干预）。
   */
  responseDisposition?: "inline";
};

/** 域配置：由各域 `_proxy.ts` 绑定，驱动错误码前缀与默认超时等差异项 */
export type BffProxyConfig = {
  /** 错误信封 code 前缀，如 "KNOWLEDGE" / "PLUGINS" / "MEMORY" */
  codePrefix: string;
  /** 基址缺失时的错误提示所用环境变量名（仅文案，不参与解析） */
  envName: string;
  /** 后端基址解析器（SSOT：lib/server/backend-url） */
  baseUrl: () => string;
  /**
   * JSON 方法族默认超时；`undefined` 表示不设上限（保持该域现状）。
   * 二进制方法族固定使用 DEFAULT_BINARY_PROXY_TIMEOUT_MS，不受此项影响。
   */
  defaultTimeoutMs?: number;
};

export type BffProxy = {
  proxyGet: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
  proxyPost: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
  proxyPostFormData: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
  proxyPatch: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
  proxyPut: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
  proxyDelete: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
  proxyGetBinary: (request: Request, path: string, options?: ProxyOptions) => Promise<Response>;
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
 * 历史问题：旧版 catch 一律返回 502 + "TypeError: fetch failed"，既丢失了
 * "是超时还是别的"信号，也让用户在长任务卡住后只看到误导性错误。
 */
function classifyFetchError(
  codePrefix: string,
  error: unknown,
): { code: string; message: string; status: number } {
  // AbortSignal.timeout 触发的中止：DOMException name === "TimeoutError"
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      code: `${codePrefix}_UPSTREAM_TIMEOUT`,
      message: `Upstream request timed out: ${String(error)}`,
      status: 504,
    };
  }
  return {
    code: `${codePrefix}_UPSTREAM_ERROR`,
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

/**
 * 上游非 2xx 响应统一包装：body 为 JSON object 时原样透传（保留后端错误细节），
 * 否则包装为 `{前缀}_UPSTREAM_ERROR` 信封（raw text 作为 message）。
 */
function upstreamErrorResponse(codePrefix: string, text: string, status: number) {
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
    `${codePrefix}_UPSTREAM_ERROR`,
    text || "Upstream returned non-OK status",
    status,
  );
}

/**
 * JSON 方法族统一的收尾处理（所有非二进制方法共用）：
 * - `204` 短路返回空 body（DELETE 契约，族内统一）；
 * - 非 2xx → 上游错误透传/信封包装；
 * - 2xx → JSON body 原样透传并保留上游状态码；非 JSON 时安全降级为
 *   `{data: text}`（Memory 域契约，族内统一；不再因 JSON.parse 抛错挂成 500）。
 */
async function finalizeJsonResponse(
  config: BffProxyConfig,
  upstreamResponse: Response,
): Promise<Response> {
  if (upstreamResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return upstreamErrorResponse(config.codePrefix, text, upstreamResponse.status);
  }

  try {
    return NextResponse.json(JSON.parse(text), { status: upstreamResponse.status });
  } catch {
    // 后端返回空或非 JSON 时，安全降级
    return NextResponse.json({ data: text || null }, { status: upstreamResponse.status });
  }
}

function requireBaseUrl(config: BffProxyConfig): Response | null {
  if (!config.baseUrl()) {
    return errorResponse(
      `${config.codePrefix}_INTERNAL_ERROR`,
      `${config.envName} is not configured`,
      500,
    );
  }
  return null;
}

function buildUpstreamUrl(config: BffProxyConfig, path: string, request: Request): URL {
  const upstreamUrl = new URL(path, config.baseUrl());
  const incomingUrl = new URL(request.url);
  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
}

function resolveTimeoutSignal(
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  return timeoutMs !== undefined ? AbortSignal.timeout(timeoutMs) : undefined;
}

/**
 * 工厂：按域配置生成 proxy 方法族。各域 `_proxy.ts` 调用一次并再导出，
 * 消费方（route.ts）的 import 路径与导出名保持零改动。
 */
export function createBffProxy(config: BffProxyConfig): BffProxy {
  const prefix = config.codePrefix;

  async function proxyGet(request: Request, path: string, options: ProxyOptions = {}) {
    const guard = requireBaseUrl(config);
    if (guard) return guard;

    const upstreamUrl = buildUpstreamUrl(config, path, request);
    const timeoutMs = options.timeoutMs ?? config.defaultTimeoutMs;

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
          signal: resolveTimeoutSignal(timeoutMs),
        });
      } catch (error) {
        // 仅 transient 且还有剩余 attempt 时退避重试
        if (isTransientFetchError(error) && attempt < attempts) {
          await sleep(backoffMs[attempt - 1] ?? 0);
          continue;
        }
        const { code, message, status } = classifyFetchError(prefix, error);
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

      return finalizeJsonResponse(config, upstreamResponse);
    }

    // 理论不可达：retry-loop 内每个分支都有 return 或 continue（continue 仅在
    // attempt<attempts 时才走），最后一次必定走到 return。兜底以满足 TS 控制流分析。
    return errorResponse(
      `${prefix}_UPSTREAM_ERROR`,
      "Upstream temporarily unavailable after retries",
      502,
    );
  }

  async function proxyPost(request: Request, path: string, options: ProxyOptions = {}) {
    const guard = requireBaseUrl(config);
    if (guard) return guard;

    // 容忍空 body：动作型端点（publish / unpublish / action / job enable 等）通常
    // 无请求体。仅当 body 非空时按 JSON 校验，空则原样转发空 body。
    const rawBody = await request.text();
    let forwardBody: string | undefined;
    if (rawBody.trim().length === 0) {
      forwardBody = undefined;
    } else {
      try {
        JSON.parse(rawBody);
      } catch (error) {
        return errorResponse(
          `${prefix}_BAD_REQUEST`,
          `Invalid JSON body: ${String(error)}`,
          400,
        );
      }
      forwardBody = rawBody;
    }

    const upstreamUrl = buildUpstreamUrl(config, path, request);
    const headers = extractForwardHeaders(request);
    if (forwardBody !== undefined) {
      headers.set("content-type", "application/json");
    }
    const timeoutMs = options.timeoutMs ?? config.defaultTimeoutMs;

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers,
        body: forwardBody,
        cache: "no-store",
        signal: resolveTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      const { code, message, status } = classifyFetchError(prefix, error);
      return errorResponse(code, message, status);
    }

    return finalizeJsonResponse(config, upstreamResponse);
  }

  async function proxyPostFormData(
    request: Request,
    path: string,
    options: ProxyOptions = {},
  ) {
    const guard = requireBaseUrl(config);
    if (guard) return guard;

    const formData = await request.formData();

    const upstreamUrl = buildUpstreamUrl(config, path, request);
    const headers = extractForwardHeaders(request);
    // 不设置 content-type，让浏览器自动处理 multipart/form-data 边界
    const timeoutMs = options.timeoutMs ?? config.defaultTimeoutMs;

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers,
        body: formData,
        cache: "no-store",
        signal: resolveTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      const { code, message, status } = classifyFetchError(prefix, error);
      return errorResponse(code, message, status);
    }

    return finalizeJsonResponse(config, upstreamResponse);
  }

  async function proxyJsonWithBody(
    request: Request,
    path: string,
    method: "PATCH" | "PUT",
    options: ProxyOptions,
  ) {
    const guard = requireBaseUrl(config);
    if (guard) return guard;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch (error) {
      return errorResponse(
        `${prefix}_BAD_REQUEST`,
        `Invalid JSON body: ${String(error)}`,
        400,
      );
    }

    const upstreamUrl = buildUpstreamUrl(config, path, request);
    const headers = extractForwardHeaders(request);
    headers.set("content-type", "application/json");
    const timeoutMs = options.timeoutMs ?? config.defaultTimeoutMs;

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method,
        headers,
        body: JSON.stringify(body),
        cache: "no-store",
        signal: resolveTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      const { code, message, status } = classifyFetchError(prefix, error);
      return errorResponse(code, message, status);
    }

    return finalizeJsonResponse(config, upstreamResponse);
  }

  async function proxyPatch(request: Request, path: string, options: ProxyOptions = {}) {
    return proxyJsonWithBody(request, path, "PATCH", options);
  }

  async function proxyPut(request: Request, path: string, options: ProxyOptions = {}) {
    return proxyJsonWithBody(request, path, "PUT", options);
  }

  async function proxyDelete(request: Request, path: string, options: ProxyOptions = {}) {
    const guard = requireBaseUrl(config);
    if (guard) return guard;

    const upstreamUrl = buildUpstreamUrl(config, path, request);
    const timeoutMs = options.timeoutMs ?? config.defaultTimeoutMs;

    let upstreamResponse: Response;
    try {
      const headers = extractForwardHeaders(request);
      upstreamResponse = await fetch(upstreamUrl, {
        method: "DELETE",
        headers,
        cache: "no-store",
        signal: resolveTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      const { code, message, status } = classifyFetchError(prefix, error);
      return errorResponse(code, message, status);
    }

    return finalizeJsonResponse(config, upstreamResponse);
  }

  /**
   * 代理 GET 请求并返回二进制流
   * 用于文件下载等场景
   */
  async function proxyGetBinary(
    request: Request,
    path: string,
    options: ProxyOptions = {},
  ): Promise<Response> {
    const guard = requireBaseUrl(config);
    if (guard) return guard;

    const upstreamUrl = buildUpstreamUrl(config, path, request);
    const timeoutMs = options.timeoutMs ?? DEFAULT_BINARY_PROXY_TIMEOUT_MS;

    // 二进制场景额外透传 Range + 条件请求头：使浏览器原生 PDF 查看器可发起分块/范围
    // 请求并复用缓存，后端据此回 206/304/416。仅在此局部补头，不动共享的
    // extractForwardHeaders（JSON 代理无需这些头）。
    const forwardHeaders = extractForwardHeaders(request);
    for (const name of ["range", "if-none-match", "if-modified-since", "if-range"] as const) {
      const value = request.headers.get(name);
      if (value) forwardHeaders.set(name, value);
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: forwardHeaders,
        cache: "no-store",
        signal: resolveTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      const { code, message, status } = classifyFetchError(prefix, error);
      return errorResponse(code, message, status);
    }

    // 构造透传响应头（304/200/206/416 共用）。除既有 content-type / disposition /
    // cache-control 外，补充 Range + 缓存协商所需头，使浏览器原生查看器能：
    //  - 渐进式分块渲染大 PDF（accept-ranges + content-range + content-length）
    //  - 跨视图切换 / 重访复用缓存（etag + last-modified + cache-control）
    const responseHeaders = new Headers();
    const contentDisposition = upstreamResponse.headers.get("content-disposition");
    const contentType = upstreamResponse.headers.get("content-type");

    if (options.responseDisposition === "inline") {
      // 预览语义：把上游的 `attachment` 改写为 `inline`，保留 `filename*` 等参数，
      // 让浏览器内联渲染 PDF 而非触发下载。上游缺失头部时也显式置 `inline`。
      if (contentDisposition) {
        responseHeaders.set(
          "content-disposition",
          contentDisposition.replace(/^\s*attachment/i, "inline"),
        );
      } else {
        responseHeaders.set("content-disposition", "inline");
      }
      // 兜底：.pdf 文件但上游 MIME 缺失/为通用二进制时，回退为 application/pdf，
      // 否则浏览器可能拒绝内联渲染。已知具体类型则原样透传。
      if (!contentType || contentType === "application/octet-stream") {
        responseHeaders.set("content-type", "application/pdf");
      } else {
        responseHeaders.set("content-type", contentType);
      }
    } else {
      if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);
      if (contentType) responseHeaders.set("content-type", contentType);
    }

    // 范围 + 缓存协商头：存在才透传（旧后端未升级时全部缺失 → no-op，行为不变）。
    for (const name of [
      "cache-control",
      "accept-ranges",
      "content-range",
      "content-length",
      "etag",
      "last-modified",
    ] as const) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    // 304 Not Modified：无 body。必须在 `!ok` 分支之前拦截（304 非 ok，否则会被
    // 误包装成 JSON 错误信封）。保留 etag/cache-control 让浏览器继续命中本地缓存。
    if (upstreamResponse.status === 304) {
      try {
        await upstreamResponse.arrayBuffer(); // drain（304 通常空 body），避免半开连接
      } catch {
        /* ignore drain errors */
      }
      return new NextResponse(null, { status: 304, headers: responseHeaders });
    }

    // 206 Partial Content（ok）与 416 Range Not Satisfiable（非 ok）都需带
    // content-range 原样透传，不能进入下方 JSON 错误包装。
    if (upstreamResponse.status === 206 || upstreamResponse.status === 416) {
      return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    if (!upstreamResponse.ok) {
      const errorContentType = upstreamResponse.headers.get("content-type");
      if (errorContentType?.includes("application/json")) {
        try {
          const errorJson = await upstreamResponse.json();
          return NextResponse.json(errorJson, { status: upstreamResponse.status });
        } catch {
          // fallback
        }
      }
      return errorResponse(
        `${prefix}_UPSTREAM_ERROR`,
        "Upstream returned non-OK status",
        upstreamResponse.status,
      );
    }

    // 200 OK（全量 / 已升级后端的首块）流式透传。
    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  }

  return {
    proxyGet,
    proxyPost,
    proxyPostFormData,
    proxyPatch,
    proxyPut,
    proxyDelete,
    proxyGetBinary,
  };
}
