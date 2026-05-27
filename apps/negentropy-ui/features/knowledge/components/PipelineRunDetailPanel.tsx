"use client";

import Link from "next/link";

import type { PipelineRunRecord } from "../utils/knowledge-api";
import {
  buildPipelineErrorDetails,
  formatDuration,
  getSortedStages,
  getStageColor,
  getStageErrorSummary,
  STAGE_LABELS,
  OPERATION_LABELS,
} from "../utils/pipeline-helpers";

/**
 * 从 PipelineRunRecord 的 input/output 中尽力抽取关联的 corpus_id / document_id。
 *
 * 不同 operation 把这些字段放在 input 的不同位置：
 *   - 文档 ingest 类：input.document_id + input.corpus_id
 *   - markdown refresh 类：input.document_id（corpus_id 来自 output 或 input.corpus_id）
 *
 * 抽不到完整对则返回 null，UI 隐藏 Continue 操作。绝不影响既有 run 详情渲染。
 */
function extractDocumentRef(
  run: PipelineRunRecord,
): { corpusId: string; documentId: string } | null {
  const candidates: Array<Record<string, unknown> | undefined> = [
    run.input,
    run.output,
  ];
  for (const obj of candidates) {
    if (!obj) continue;
    const docId = typeof obj.document_id === "string" ? obj.document_id : null;
    const corpusId =
      typeof obj.corpus_id === "string" ? obj.corpus_id : null;
    if (docId && corpusId) return { corpusId, documentId: docId };
  }
  return null;
}

/**
 * 判定该 Run 是否可走断点续传：状态为 failed / partial / cancelled，
 * 或 stages 中有 markdown extraction 类阶段失败。
 *
 * perceives 的 auto_batch 把 per-slice checkpoint 落到 output_dir/.batch_state/；
 * 即便整 Run 失败，下一次 refresh_markdown 会从最后一个完成切片继续。
 */
function isRunResumable(run: PipelineRunRecord): boolean {
  const s = (run.status || "").toLowerCase();
  if (s === "failed" || s === "partial" || s === "cancelled") return true;
  if (!run.stages) return false;
  for (const stage of Object.values(run.stages)) {
    const st = (stage?.status || "").toLowerCase();
    if (st === "failed") return true;
  }
  return false;
}

const detailJsonClassName =
  "mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-[11px] dark:bg-zinc-800";
const errorJsonClassName =
  "mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-400";

/**
 * Pipeline Run 详情面板
 *
 * 展示选中 Run 的完整信息：Info、Stages、Input、Output、Errors
 * 从原 Pipelines 页面的 Run Detail 区域提取
 */
export function PipelineRunDetailPanel({ run }: { run: PipelineRunRecord }) {
  const errorDetails = buildPipelineErrorDetails(run);
  const docRef = extractDocumentRef(run);
  const resumable = docRef && isRunResumable(run);

  return (
    <div className="mt-3 min-w-0 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
      {/* Continue 断点续传入口（仅在 Run 失败 / partial + 可抽取文档关联时显示） */}
      {resumable && docRef && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Resume from checkpoint
              </p>
              <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                perceives auto_batch 已为每个完成的切片落 checkpoint；点击 Continue
                跳转到文档详情页触发断点续传（从最后一个完成的切片继续）。
              </p>
            </div>
            <Link
              href={`/knowledge/documents/${docRef.corpusId}/${docRef.documentId}`}
              className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
            >
              Continue →
            </Link>
          </div>
        </div>
      )}

      {/* 基本信息 */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Info</p>
        {run.operation && (
          <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            Operation: {OPERATION_LABELS[run.operation] || run.operation}
          </p>
        )}
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">开始 {run.started_at || "-"}</p>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">结束 {run.completed_at || "-"}</p>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
          Duration: {formatDuration(run.duration_ms, run.started_at, run.completed_at)}
        </p>
      </div>

      {/* 阶段详情 */}
      {run.stages && Object.keys(run.stages).length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Stages</p>
          <div className="mt-2 space-y-2">
            {getSortedStages(run.stages).map(([stageName, stage]) => (
              <div key={stageName}>
                <div className="flex min-w-0 items-center gap-2 text-[11px]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${getStageColor(stageName, stage.status)}`} />
                  <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300">
                    {STAGE_LABELS[stageName] || stageName}
                  </span>
                  <span className="shrink-0 uppercase text-zinc-400">
                    {stage.status || "unknown"}
                  </span>
                  <span className="shrink-0 text-zinc-400">
                    {stage.duration_ms ? `${stage.duration_ms}ms` : "-"}
                  </span>
                  {stage.status === "skipped" && stage.reason && (
                    <span className="truncate text-zinc-400 italic">({stage.reason})</span>
                  )}
                  {stage.error && (
                    <span className="truncate max-w-[120px] text-rose-500">
                      {getStageErrorSummary(stage.error)}
                    </span>
                  )}
                  {stage.output && (
                    <span className="truncate max-w-[120px] text-emerald-600 dark:text-emerald-400">
                      {typeof stage.output === "object" && stage.output !== null && "chunk_count" in stage.output
                        ? `${(stage.output as { chunk_count?: unknown }).chunk_count} chunks`
                        : typeof stage.output === "object" && stage.output !== null && "record_count" in stage.output
                          ? `${(stage.output as { record_count?: unknown }).record_count} records`
                          : ""}
                    </span>
                  )}
                </div>
                {stage.mcp_events && stage.mcp_events.length > 0 && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {stage.mcp_events
                      .filter((evt) => evt.stage !== "stderr")
                      .map((evt, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              evt.status === "completed"
                                ? "bg-emerald-400"
                                : evt.status === "running"
                                  ? "bg-amber-400 animate-pulse"
                                  : evt.status === "failed"
                                    ? "bg-rose-400"
                                    : "bg-zinc-300 dark:bg-zinc-600"
                            }`}
                          />
                          <span className="truncate">{evt.title}</span>
                          <span className="shrink-0 text-zinc-300 dark:text-zinc-600">{evt.status}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Input</p>
        <pre className={detailJsonClassName}>
          {JSON.stringify(run.input ?? {}, null, 2)}
        </pre>
      </div>

      {/* Output */}
      <div className="min-w-0">
        <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Output</p>
        <pre className={detailJsonClassName}>
          {JSON.stringify(run.output ?? {}, null, 2)}
        </pre>
      </div>

      {/* Errors */}
      {errorDetails.length > 0 && (
        <div className="min-w-0">
          <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Errors</p>
          <div className="mt-2 space-y-3">
            {errorDetails.map((detail) => (
              <div
                key={detail.key}
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      {detail.title}
                    </p>
                    {detail.failureLabel && (
                      <p className="mt-0.5 truncate text-[10px] text-rose-500 dark:text-rose-400">
                        {detail.failureLabel}
                      </p>
                    )}
                    {detail.diagnosticSummary && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-rose-600 dark:text-rose-300">
                        {detail.diagnosticSummary}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-rose-500 dark:text-rose-400">
                    {detail.scope === "stage"
                      ? `${detail.status || "failed"}${detail.durationMs ? ` · ${formatDuration(detail.durationMs)}` : ""}`
                      : "failed"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                  {detail.message}
                </p>
                <pre className={errorJsonClassName}>
                  {JSON.stringify(detail.error, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
