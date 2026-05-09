/**
 * 统一管线运行类型与适配器
 *
 * 将 KB PipelineRunRecord 与 KG GraphBuildRunRecord 统一为 UnifiedPipelineRun，
 * 使 Dashboard 能以单一列表展示两类运行记录。
 *
 * 遵循 AGENTS.md：
 * - Reuse-Driven: KG phase 映射为 PipelineStageResult 复用 PipelineStagesBar
 * - Orthogonal Decomposition: source 字段区分类型，组件按 source 分支渲染
 */

import type {
  PipelineRunRecord,
  PipelineStageResult,
  GraphBuildRunRecord,
} from "./knowledge-api";

// ============================================================================
// 类型定义
// ============================================================================

/** 统一管线运行记录（discriminated union） */
export type UnifiedPipelineRun =
  | ({ source: "kb" } & PipelineRunRecord)
  | KgPipelineRun;

/** KG 管线运行记录 */
export interface KgPipelineRun {
  source: "kg";
  id: string;
  run_id: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  version?: number;
  corpus_id: string;
  progress_percent?: number;
  entity_count: number;
  relation_count: number;
  model_name?: string;
  error_message?: string;
  extractor_config?: Record<string, unknown>;
  warnings?: Record<string, unknown>[];
  /** 从 KG phase 映射的合成 stages */
  stages?: Record<string, PipelineStageResult>;
}

// ============================================================================
// KG Phase 常量
// ============================================================================

/** KG phase key 前缀，与 pipeline-helpers.ts 中 STAGE_ORDER 的 kg_* 条目对应 */
export const KG_PHASE_KEYS = [
  "kg_extracting",
  "kg_resolving",
  "kg_syncing",
  "kg_pagerank",
  "kg_communities",
  "kg_summaries",
] as const;

/** KG phase 进度区间边界（左闭右开） */
const KG_PHASE_BOUNDARIES = [
  { key: "kg_extracting", start: 0.0, end: 0.80 },
  { key: "kg_resolving", start: 0.80, end: 0.85 },
  { key: "kg_syncing", start: 0.85, end: 0.90 },
  { key: "kg_pagerank", start: 0.90, end: 0.93 },
  { key: "kg_communities", start: 0.93, end: 0.96 },
  { key: "kg_summaries", start: 0.96, end: 1.00 },
] as const;

// ============================================================================
// Phase → Stage 映射
// ============================================================================

/**
 * 从 warnings 中提取当前 _phase 名称
 *
 * KG service 通过 emit_phase 将阶段元数据写入 warnings JSONB 的 _phase 条目。
 */
function extractCurrentPhase(
  warnings?: Record<string, unknown>[],
): string | null {
  if (!warnings || !warnings.length) return null;

  // 从后往前找最后一条 _phase 条目
  for (let i = warnings.length - 1; i >= 0; i--) {
    const entry = warnings[i];
    if (entry && "_phase" in entry) {
      const phase = entry._phase;
      if (typeof phase === "object" && phase !== null && "name" in phase) {
        return (phase as { name: string }).name;
      }
    }
  }
  return null;
}

/**
 * 根据 KG phase 名称获取对应的 stage key
 */
function phaseNameToKey(phaseName: string): string | null {
  const mapping: Record<string, string | null> = {
    extracting: "kg_extracting",
    resolving: "kg_resolving",
    syncing: "kg_syncing",
    pagerank: "kg_pagerank",
    communities: "kg_communities",
    summaries: "kg_summaries",
    completed: null,
  };
  return mapping[phaseName] ?? null;
}

/**
 * 将 KG 的 progress_percent + warnings 映射为 PipelineStageResult 字典
 *
 * 映射规则：
 * - 已完成 run → 全部 phase completed
 * - 失败 run → 从 warnings._phase 或 progress 推断失败位置
 * - 运行中 run → 已过 phase completed，当前 running，之后 pending
 */
export function kgPhasesToStages(
  status: string,
  progressPercent?: number,
  warnings?: Record<string, unknown>[],
): Record<string, PipelineStageResult> {
  const stages: Record<string, PipelineStageResult> = {};
  const lowerStatus = status?.toLowerCase();
  const currentPhaseName = extractCurrentPhase(warnings);
  const currentPhaseKey = currentPhaseName ? phaseNameToKey(currentPhaseName) : null;

  // 确定 currentPhaseIndex
  let currentIdx = -1;
  if (currentPhaseKey) {
    currentIdx = KG_PHASE_KEYS.indexOf(currentPhaseKey as typeof KG_PHASE_KEYS[number]);
  }
  // fallback: 从 progress_percent 推断
  if (currentIdx === -1 && progressPercent != null && progressPercent > 0) {
    for (let i = KG_PHASE_BOUNDARIES.length - 1; i >= 0; i--) {
      if (progressPercent >= KG_PHASE_BOUNDARIES[i].start) {
        currentIdx = i;
        break;
      }
    }
  }

  for (let i = 0; i < KG_PHASE_BOUNDARIES.length; i++) {
    const { key } = KG_PHASE_BOUNDARIES[i];

    if (lowerStatus === "completed") {
      stages[key] = { status: "completed" };
    } else if (lowerStatus === "failed") {
      if (currentIdx >= 0 && i < currentIdx) {
        stages[key] = { status: "completed" };
      } else if (i === currentIdx) {
        stages[key] = { status: "failed" };
      } else {
        stages[key] = { status: "skipped", reason: "前置阶段失败" };
      }
    } else {
      // running / pending / 其他
      if (currentIdx >= 0 && i < currentIdx) {
        stages[key] = { status: "completed" };
      } else if (i === currentIdx) {
        stages[key] = { status: "running" };
      } else {
        stages[key] = { status: "pending" };
      }
    }
  }

  return stages;
}

// ============================================================================
// 适配器
// ============================================================================

function computeDurationMs(startedAt?: string, completedAt?: string): number | undefined {
  if (!startedAt) return undefined;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return undefined;
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (Number.isNaN(end)) return undefined;
  return end - start;
}

/**
 * 将 KG GraphBuildRunRecord 适配为 UnifiedPipelineRun
 */
export function adaptKgRunToUnified(
  kgRun: GraphBuildRunRecord,
  corpusId: string,
): KgPipelineRun {
  const durationMs = computeDurationMs(kgRun.started_at, kgRun.completed_at);

  return {
    source: "kg",
    id: kgRun.id,
    run_id: kgRun.run_id,
    status: kgRun.status,
    started_at: kgRun.started_at,
    completed_at: kgRun.completed_at,
    duration_ms: durationMs,
    version: 0,
    corpus_id: corpusId,
    progress_percent: kgRun.progress_percent,
    entity_count: kgRun.entity_count,
    relation_count: kgRun.relation_count,
    model_name: kgRun.model_name,
    error_message: kgRun.error_message,
    extractor_config: kgRun.extractor_config,
    warnings: kgRun.warnings,
    stages: kgPhasesToStages(kgRun.status, kgRun.progress_percent, kgRun.warnings as Record<string, unknown>[] | undefined),
  };
}

// ============================================================================
// 合并与排序
// ============================================================================

/**
 * 合并 KB 与 KG 运行记录并按 started_at 降序排序
 */
export function mergeAndSortRuns(
  kbRuns: PipelineRunRecord[],
  kgRuns: KgPipelineRun[],
): UnifiedPipelineRun[] {
  const kbUnified: UnifiedPipelineRun[] = kbRuns.map((r) => ({
    source: "kb" as const,
    ...r,
  }));

  const all = [...kbUnified, ...kgRuns];

  all.sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
    return tb - ta;
  });

  return all;
}

/**
 * 检测活跃 run（运行中 / 待启动 / 取消中），用于触发轮询。
 *
 * `cancelling` 也视为活跃，因为前端需要持续轮询观察其收敛到 `cancelled` 终态
 * （task 在检查点退出后写终态，最长 < 一个 stage / phase 周期）。
 */
export function hasActiveRuns(runs: UnifiedPipelineRun[]): boolean {
  return runs.some((run) => {
    const status = run.status?.toLowerCase();
    return (
      status === "running" ||
      status === "in_progress" ||
      status === "pending" ||
      status === "cancelling"
    );
  });
}
