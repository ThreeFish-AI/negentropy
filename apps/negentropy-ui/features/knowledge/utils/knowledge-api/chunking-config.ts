/**
 * Chunking 配置：类型、表单编解码、规范化与校验
 *
 * buildJsonChunkingPayload / appendChunkingConfigToFormData /
 * ChunkingRequestFields 供 corpus / documents 域的 ingest 类函数复用。
 */
import { InvalidChunkSizeError, ValidationError } from "./errors";

// ============================================================================
// Types (对齐后端 types.py)
// ============================================================================
export type ChunkingStrategy =
  | "fixed"
  | "recursive"
  | "semantic"
  | "hierarchical";

export interface FixedChunkingConfig {
  strategy: "fixed";
  chunk_size: number;
  overlap: number;
  preserve_newlines: boolean;
}

export interface RecursiveChunkingConfig {
  strategy: "recursive";
  chunk_size: number;
  overlap: number;
  preserve_newlines: boolean;
  separators: string[];
}

export interface SemanticChunkingConfig {
  strategy: "semantic";
  semantic_threshold: number;
  semantic_buffer_size: number;
  min_chunk_size: number;
  max_chunk_size: number;
}

export interface HierarchicalChunkingConfig {
  strategy: "hierarchical";
  preserve_newlines: boolean;
  separators: string[];
  hierarchical_parent_chunk_size: number;
  hierarchical_child_chunk_size: number;
  hierarchical_child_overlap: number;
}

export type ChunkingConfig =
  | FixedChunkingConfig
  | RecursiveChunkingConfig
  | SemanticChunkingConfig
  | HierarchicalChunkingConfig;

/**
 * 将 separators 数组编码为 textarea 可显示的文本。
 *
 * 每个 separator 中的特殊字符以转义序列表示（真实 \n → 字面量 \\n），
 * 然后以真实换行符 join 各项，实现「每行一个 separator」的体验。
 */
export function encodeSeparatorsForDisplay(separators: string[]): string {
  return separators
    .map((sep) => {
      if (sep === "") return "<empty>";
      return sep
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r");
    })
    .join("\n");
}

/**
 * 将 textarea 文本解码回 separators 数组。
 *
 * 按真实换行拆分行，每行做反转义处理。
 * 使用逐字符扫描避免正则替换的顺序依赖问题。
 */
export function decodeSeparatorsFromInput(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line === "<empty>") return "";
      let result = "";
      let i = 0;
      while (i < line.length) {
        if (line[i] === "\\" && i + 1 < line.length) {
          const next = line[i + 1];
          switch (next) {
            case "n":
              result += "\n";
              i += 2;
              break;
            case "t":
              result += "\t";
              i += 2;
              break;
            case "r":
              result += "\r";
              i += 2;
              break;
            case "\\":
              result += "\\";
              i += 2;
              break;
            default:
              result += line[i];
              i += 1;
              break;
          }
        } else {
          result += line[i];
          i += 1;
        }
      }
      return result;
    });
}

/**
 * 防御式解码单个分隔符字符串。
 *
 * 用于兜底「DB 中残留字面量转义序列」的历史/导入数据：
 *   - 输入 `"\\n\\n"`（4 字符 `\n\n`）→ 输出 `"\n\n"`（2 字符真换行）
 *   - 输入 `"\n\n"`（已是真换行）→ 原样返回（idempotent）
 *
 * 复用 decodeSeparatorsFromInput 的逐字符扫描逻辑，仅当字符串包含字面量转义
 * 序列（`\n` / `\t` / `\r` / `\\`）但不含真实控制字符时触发解码，避免对正常数据的副作用。
 */
export function decodeLiteralEscapesIfNeeded(value: string): string {
  if (typeof value !== "string" || value.length === 0) return value;
  const hasLiteralEscape = /\\[ntr\\]/.test(value);
  const hasRealControl = /[\n\t\r]/.test(value);
  if (!hasLiteralEscape || hasRealControl) return value;
  // 复用 decodeSeparatorsFromInput 的核心扫描逻辑：单行解码后取首项
  const decoded = decodeSeparatorsFromInput(value);
  return decoded[0] ?? value;
}

function normalizeSeparatorsArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return (value as unknown[]).map((s) => decodeLiteralEscapesIfNeeded(String(s)));
}

/**
 * 逐元素比较两个 separators 数组的语义等价性。
 *
 * 用于受控文本域判别「外部 value 变化」是自身键入 round-trip 的回写还是真外部更新
 * （策略切换重置 defaults 等），避免以数组引用为判据导致的无谓重同步。
 */
export function separatorsArrayEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function createDefaultChunkingConfig(
  strategy: ChunkingStrategy = "recursive",
): ChunkingConfig {
  switch (strategy) {
    case "fixed":
      return {
        strategy,
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
      };
    case "semantic":
      return {
        strategy,
        semantic_threshold: 0.85,
        semantic_buffer_size: 1,
        min_chunk_size: 50,
        max_chunk_size: 2000,
      };
    case "hierarchical":
      return {
        strategy,
        preserve_newlines: true,
        separators: ["\n"],
        hierarchical_parent_chunk_size: 1024,
        hierarchical_child_chunk_size: 256,
        hierarchical_child_overlap: 51,
      };
    case "recursive":
    default:
      return {
        strategy: "recursive",
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
        separators: ["\n"],
      };
  }
}

export function normalizeChunkingConfig(
  config?: Record<string, unknown> | null,
): ChunkingConfig {
  const strategy = (config?.strategy as ChunkingStrategy | undefined) || "recursive";

  switch (strategy) {
    case "fixed": {
      const defaults = createDefaultChunkingConfig("fixed") as FixedChunkingConfig;
      return {
        strategy,
        chunk_size: Number(config?.chunk_size ?? defaults.chunk_size),
        overlap: Number(config?.overlap ?? defaults.overlap),
        preserve_newlines:
          typeof config?.preserve_newlines === "boolean"
            ? config.preserve_newlines
            : defaults.preserve_newlines,
      };
    }
    case "semantic": {
      const defaults = createDefaultChunkingConfig("semantic") as SemanticChunkingConfig;
      return {
        strategy,
        semantic_threshold: Number(config?.semantic_threshold ?? defaults.semantic_threshold),
        semantic_buffer_size: Number(config?.semantic_buffer_size ?? defaults.semantic_buffer_size),
        min_chunk_size: Number(config?.min_chunk_size ?? defaults.min_chunk_size),
        max_chunk_size: Number(config?.max_chunk_size ?? defaults.max_chunk_size),
      };
    }
    case "hierarchical": {
      const defaults = createDefaultChunkingConfig("hierarchical") as HierarchicalChunkingConfig;
      return {
        strategy,
        preserve_newlines:
          typeof config?.preserve_newlines === "boolean"
            ? config.preserve_newlines
            : defaults.preserve_newlines,
        separators: normalizeSeparatorsArray(config?.separators, defaults.separators),
        hierarchical_parent_chunk_size: Number(
          config?.hierarchical_parent_chunk_size ?? defaults.hierarchical_parent_chunk_size,
        ),
        hierarchical_child_chunk_size: Number(
          config?.hierarchical_child_chunk_size ?? defaults.hierarchical_child_chunk_size,
        ),
        hierarchical_child_overlap: Number(
          config?.hierarchical_child_overlap ?? defaults.hierarchical_child_overlap,
        ),
      };
    }
    case "recursive":
    default: {
      const defaults = createDefaultChunkingConfig("recursive") as RecursiveChunkingConfig;
      return {
        strategy: "recursive",
        chunk_size: Number(config?.chunk_size ?? defaults.chunk_size),
        overlap: Number(config?.overlap ?? defaults.overlap),
        preserve_newlines:
          typeof config?.preserve_newlines === "boolean"
            ? config.preserve_newlines
            : defaults.preserve_newlines,
        separators: normalizeSeparatorsArray(config?.separators, defaults.separators),
      };
    }
  }
}

function buildChunkingConfigFromLegacyFields(
  params: LegacyChunkingFields,
): ChunkingConfig | undefined {
  const strategy = params.strategy;
  if (!strategy) return undefined;

  return normalizeChunkingConfig({
    strategy,
    chunk_size: params.chunk_size,
    overlap: params.overlap,
    preserve_newlines: params.preserve_newlines,
    separators: params.separators,
    semantic_threshold: params.semantic_threshold,
    semantic_buffer_size: params.semantic_buffer_size,
    min_chunk_size: params.min_chunk_size,
    max_chunk_size: params.max_chunk_size,
    hierarchical_parent_chunk_size: params.hierarchical_parent_chunk_size,
    hierarchical_child_chunk_size: params.hierarchical_child_chunk_size,
    hierarchical_child_overlap: params.hierarchical_child_overlap,
  });
}

function resolveChunkingConfig(
  params?: ChunkingRequestFields,
): ChunkingConfig | undefined {
  if (!params) return undefined;
  if (params.chunking_config) {
    return normalizeChunkingConfig(params.chunking_config as unknown as Record<string, unknown>);
  }
  return buildChunkingConfigFromLegacyFields(params as LegacyChunkingFields);
}

function validateChunkingConfig(config?: ChunkingConfig): void {
  if (!config) return;

  if (config.strategy === "fixed" || config.strategy === "recursive") {
    if (config.chunk_size < 1 || config.chunk_size > 100000) {
      throw new InvalidChunkSizeError({ chunk_size: config.chunk_size });
    }
    const maxOverlap = Math.floor(config.chunk_size * 0.5);
    if (config.overlap < 0 || config.overlap > maxOverlap) {
      throw new InvalidChunkSizeError({
        overlap: config.overlap,
        max_overlap: maxOverlap,
      });
    }
  }

  if (config.strategy === "semantic") {
    if (config.semantic_buffer_size < 1 || config.semantic_buffer_size > 5) {
      throw new ValidationError({
        field: "semantic_buffer_size",
        min: 1,
        max: 5,
        value: config.semantic_buffer_size,
      });
    }
    if (config.min_chunk_size < 1 || config.max_chunk_size < config.min_chunk_size) {
      throw new ValidationError({
        field: "semantic_chunk_size_range",
        min_chunk_size: config.min_chunk_size,
        max_chunk_size: config.max_chunk_size,
      });
    }
  }

  if (config.strategy === "hierarchical") {
    if (config.hierarchical_parent_chunk_size < config.hierarchical_child_chunk_size) {
      throw new ValidationError({
        field: "hierarchical_parent_chunk_size",
        parent: config.hierarchical_parent_chunk_size,
        child: config.hierarchical_child_chunk_size,
      });
    }
    if (
      config.hierarchical_child_overlap < 0 ||
      config.hierarchical_child_overlap >= config.hierarchical_child_chunk_size
    ) {
      throw new ValidationError({
        field: "hierarchical_child_overlap",
        overlap: config.hierarchical_child_overlap,
        max_overlap: config.hierarchical_child_chunk_size - 1,
      });
    }
  }
}

export function buildJsonChunkingPayload(params?: ChunkingRequestFields): Record<string, unknown> {
  const config = resolveChunkingConfig(params);
  validateChunkingConfig(config);
  return config ? { chunking_config: config } : {};
}

export function appendChunkingConfigToFormData(
  formData: FormData,
  params?: ChunkingRequestFields,
): void {
  const config = resolveChunkingConfig(params);
  validateChunkingConfig(config);

  if (!config) return;

  formData.set("strategy", config.strategy);

  if (config.strategy === "fixed") {
    formData.set("chunk_size", String(config.chunk_size));
    formData.set("overlap", String(config.overlap));
    formData.set("preserve_newlines", String(config.preserve_newlines));
    return;
  }

  if (config.strategy === "recursive") {
    formData.set("chunk_size", String(config.chunk_size));
    formData.set("overlap", String(config.overlap));
    formData.set("preserve_newlines", String(config.preserve_newlines));
    if (config.separators.length > 0) {
      formData.set("separators", JSON.stringify(config.separators));
    }
    return;
  }

  if (config.strategy === "semantic") {
    formData.set("semantic_threshold", String(config.semantic_threshold));
    formData.set("semantic_buffer_size", String(config.semantic_buffer_size));
    formData.set("min_chunk_size", String(config.min_chunk_size));
    formData.set("max_chunk_size", String(config.max_chunk_size));
    return;
  }

  formData.set("preserve_newlines", String(config.preserve_newlines));
  if (config.separators.length > 0) {
    formData.set("separators", JSON.stringify(config.separators));
  }
  formData.set(
    "hierarchical_parent_chunk_size",
    String(config.hierarchical_parent_chunk_size),
  );
  formData.set(
    "hierarchical_child_chunk_size",
    String(config.hierarchical_child_chunk_size),
  );
  formData.set(
    "hierarchical_child_overlap",
    String(config.hierarchical_child_overlap),
  );
}
type LegacyChunkingFields = {
  strategy?: ChunkingStrategy;
  chunk_size?: number;
  overlap?: number;
  preserve_newlines?: boolean;
  separators?: string[];
  semantic_threshold?: number;
  semantic_buffer_size?: number;
  min_chunk_size?: number;
  max_chunk_size?: number;
  hierarchical_parent_chunk_size?: number;
  hierarchical_child_chunk_size?: number;
  hierarchical_child_overlap?: number;
};

export type ChunkingRequestFields =
  | {
      chunking_config?: ChunkingConfig;
    }
  | (LegacyChunkingFields & {
      chunking_config?: ChunkingConfig;
    });
