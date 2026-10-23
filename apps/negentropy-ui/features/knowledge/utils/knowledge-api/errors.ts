/**
 * Knowledge 域异常体系与统一错误处理
 *
 * 对齐后端异常体系；handleKnowledgeError 为各域子模块共用的响应错误解析包装器。
 */

// 错误响应类型（对齐后端异常体系）
export interface KnowledgeErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Knowledge 异常类型
export class KnowledgeError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "KnowledgeError";
    this.code = code;
    this.details = details;
  }
}

// 领域异常
export class CorpusNotFoundError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("CORPUS_NOT_FOUND", "Corpus not found", details);
    this.name = "CorpusNotFoundError";
  }
}

export class VersionConflictError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("VERSION_CONFLICT", "Version conflict", details);
    this.name = "VersionConflictError";
  }
}

// 验证异常
export class ValidationError extends KnowledgeError {
  constructor(details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", "Validation error", details);
    this.name = "ValidationError";
  }
}

export class InvalidChunkSizeError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super({ ...details, field: "chunk_size" });
    this.name = "InvalidChunkSizeError";
  }
}

export class InvalidSearchConfigError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super({ ...details, field: "search_config" });
    this.name = "InvalidSearchConfigError";
  }
}

// 基础设施异常
export class InfrastructureError extends KnowledgeError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = "InfrastructureError";
  }
}
// ============================================================================
// 错误处理工具函数
// ============================================================================

/**
 * 从响应中解析错误并映射到对应的异常类型
 */
function extractKnowledgeErrorPayload(
  errorData: unknown,
): KnowledgeErrorResponse | null {
  if (!errorData || typeof errorData !== "object") {
    return null;
  }

  const normalizePayload = (
    payload: Record<string, unknown>,
  ): KnowledgeErrorResponse | null => {
    const code = typeof payload.code === "string" ? payload.code : undefined;
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.detail === "string"
          ? payload.detail
          : undefined;
    const details =
      payload.details && typeof payload.details === "object"
        ? (payload.details as Record<string, unknown>)
        : undefined;

    if (!code && !message) {
      return null;
    }

    return {
      code: code || "UNKNOWN_ERROR",
      message: message || "Unknown error",
      details,
    };
  };

  const root = errorData as Record<string, unknown>;

  const direct = normalizePayload(root);
  if (direct) return direct;

  if (root.error && typeof root.error === "object") {
    const nested = normalizePayload(root.error as Record<string, unknown>);
    if (nested) return nested;
  }

  if (root.detail && typeof root.detail === "object") {
    const nested = normalizePayload(root.detail as Record<string, unknown>);
    if (nested) return nested;
  }

  if (typeof root.detail === "string") {
    return {
      code: "UNKNOWN_ERROR",
      message: root.detail,
    };
  }

  return null;
}

async function parseKnowledgeError(res: Response): Promise<KnowledgeError> {
  let errorData: unknown;
  try {
    errorData = await res.json();
  } catch {
    errorData = null;
  }

  const errorResponse = extractKnowledgeErrorPayload(errorData);
  const code = errorResponse?.code || "UNKNOWN_ERROR";
  const message =
    errorResponse?.message ||
    res.statusText ||
    `Request failed with status ${res.status}`;
  const details = errorResponse?.details;

  switch (code) {
    case "CORPUS_NOT_FOUND":
      return new CorpusNotFoundError(details);
    case "VERSION_CONFLICT":
      return new VersionConflictError(details);
    case "INVALID_CHUNK_SIZE":
      return new InvalidChunkSizeError(details);
    case "INVALID_SEARCH_CONFIG":
      return new InvalidSearchConfigError(details);
    default:
      return new KnowledgeError(code, message, details);
  }
}

/**
 * 统一的错误处理包装器
 */
export async function handleKnowledgeError<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await parseKnowledgeError(res);
    throw error;
  }
  return res.json() as Promise<T>;
}
