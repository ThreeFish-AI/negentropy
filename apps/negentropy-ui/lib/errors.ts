/**
 * 统一错误处理模块
 *
 * 对齐 docs/negentropy-ui-plan.md 第 13.4.3 节的错误码定义
 * 遵循 AGENTS.md 原则：单一事实源、标准化流水线
 */

/**
 * AG-UI 错误码枚举
 *
 * 参考: docs/negentropy-ui-plan.md 第 13.4.3 节
 */
export const AGUI_ERROR_CODES = {
  BAD_REQUEST: "AGUI_BAD_REQUEST",
  UNAUTHORIZED: "AGUI_UNAUTHORIZED",
  FORBIDDEN: "AGUI_FORBIDDEN",
  NOT_FOUND: "AGUI_NOT_FOUND",
  RATE_LIMITED: "AGUI_RATE_LIMITED",
  UPSTREAM_TIMEOUT: "AGUI_UPSTREAM_TIMEOUT",
  UPSTREAM_ERROR: "AGUI_UPSTREAM_ERROR",
  INTERNAL_ERROR: "AGUI_INTERNAL_ERROR",
} as const;

/**
 * 错误码类型（使用值类型，而非键类型）
 */
export type AguiErrorCode = (typeof AGUI_ERROR_CODES)[keyof typeof AGUI_ERROR_CODES];

/**
 * 错误码到 HTTP 状态码的映射
 */
const ERROR_CODE_TO_STATUS: Record<AguiErrorCode, number> = {
  AGUI_BAD_REQUEST: 400,
  AGUI_UNAUTHORIZED: 401,
  AGUI_FORBIDDEN: 403,
  AGUI_NOT_FOUND: 404,
  AGUI_RATE_LIMITED: 429,
  AGUI_UPSTREAM_TIMEOUT: 504,
  AGUI_UPSTREAM_ERROR: 502,
  AGUI_INTERNAL_ERROR: 500,
};

/**
 * 获取错误码对应的 HTTP 状态码
 */
export function getHttpStatus(code: AguiErrorCode): number {
  return ERROR_CODE_TO_STATUS[code];
}

/**
 * AG-UI 错误类
 */
export class AguiError extends Error {
  constructor(
    public code: AguiErrorCode,
    message: string,
    public traceId?: string,
  ) {
    super(message);
    this.name = "AguiError";
  }

  /**
   * 获取 HTTP 状态码
   */
  get status(): number {
    return getHttpStatus(this.code);
  }

  /**
   * 转换为 JSON 响应格式
   */
  toJSON(): { error: { code: string; message: string; traceId?: string } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        traceId: this.traceId,
      },
    };
  }
}

/**
 * 创建错误响应
 *
 * @param code - 错误码
 * @param message - 错误消息
 * @param traceId - 可选的追踪 ID
 * @returns Response 对象
 */
export function errorResponse(
  code: AguiErrorCode,
  message: string,
  traceId?: string,
): Response {
  const status = getHttpStatus(code);
  return Response.json(
    {
      error: {
        code,
        message,
        traceId,
      },
    },
    { status },
  );
}

/**
 * 从未知错误创建 AguiError
 *
 * @param error - 未知错误
 * @param defaultCode - 默认错误码
 * @returns AguiError 实例
 */
export function toAguiError(
  error: unknown,
  defaultCode: AguiErrorCode = "AGUI_INTERNAL_ERROR",
): AguiError {
  if (error instanceof AguiError) {
    return error;
  }

  if (error instanceof Error) {
    return new AguiError(defaultCode, error.message);
  }

  return new AguiError(defaultCode, String(error));
}

/**
 * 检查响应是否为错误响应
 */
export function isErrorResponse(response: unknown): boolean {
  if (
    typeof response !== "object" ||
    response === null ||
    !("error" in response)
  ) {
    return false;
  }

  const error = (response as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * 从响应中提取错误信息
 */
export function extractError(
  response: unknown,
): { code: string; message: string; traceId?: string } | null {
  if (!isErrorResponse(response)) {
    return null;
  }

  const error = (response as { error: { code: string; message: string; traceId?: string } }).error;
  return {
    code: error.code,
    message: error.message,
    traceId: error.traceId,
  };
}
