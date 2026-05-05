"use client";

/**
 * KgBuildProgressPill · P3-1 G1c
 *
 * 论文采集 ingest_paper 完成后，后端 paper_kg_pipeline.enqueue_kg_build 启动 fire-and-forget
 * KG 构建任务。本组件订阅
 *   GET /api/knowledge/base/{corpusId}/graph/build-runs/latest/progress
 * SSE 端点，把 progress_percent / status / 实体 + 关系数 实时显示在 ToolExecutionGroup 内
 * 工具卡片下方。
 *
 * 设计原则：
 * - **轻量旁路**：组件仅读 `corpusId` + `enqueued`，自己管理 EventSource 生命周期；
 *   不参与 message-ledger / 双气泡守卫（与 Tool Progress 同模式）。
 * - **失败软退化**：连接失败 → 显示 "无法订阅" 文案 + retry button；
 *   终态（completed / failed / idle / timeout）自动 close。
 * - **零回归**：父组件传入的 enqueued=false 时此组件返回 null，对旧 message 无影响。
 *
 * 参考：HTML Living Standard EventSource，Patil et al. ICSE 2026 latency-aware progress disclosure。
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type KgBuildProgressEvent = {
  status?:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "idle"
    | "timeout"
    | "switched"
    | "error";
  run_id?: string;
  progress_percent?: number;
  entity_count?: number;
  relation_count?: number;
  error_message?: string | null;
  completed_at?: string | null;
};

type Props = {
  corpusId?: string | null;
  /** 仅当后端 result.kg_status === "kg_enqueued" 时启用订阅 */
  enqueued: boolean;
  /** 可选：传入 BFF base path（默认 /api/knowledge），便于测试覆盖 */
  apiBase?: string;
};

const STATUS_LABEL: Record<NonNullable<KgBuildProgressEvent["status"]>, string> = {
  pending: "排队中",
  running: "构建中",
  completed: "已完成",
  failed: "失败",
  idle: "无活跃构建",
  timeout: "已超时",
  switched: "切换至新构建",
  error: "无法订阅",
};

function isTerminal(status: KgBuildProgressEvent["status"]): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "idle" ||
    status === "timeout" ||
    status === "switched" ||
    status === "error"
  );
}

export function KgBuildProgressPill({ corpusId, enqueued, apiBase = "/api/knowledge" }: Props) {
  const [event, setEvent] = useState<KgBuildProgressEvent | null>(
    enqueued ? { status: "pending", progress_percent: 0 } : null,
  );
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enqueued || !corpusId) {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const url = `${apiBase}/base/${encodeURIComponent(corpusId)}/graph/build-runs/latest/progress`;
    const es = new EventSource(url, { withCredentials: true });
    sourceRef.current = es;

    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as KgBuildProgressEvent;
        setEvent(payload);
        if (isTerminal(payload.status)) {
          es.close();
          sourceRef.current = null;
        }
      } catch {
        // fail-soft：忽略不可解析的 event
      }
    };
    es.onerror = () => {
      // 网络中断 → 停止订阅并显示 error 状态
      setEvent((prev) => prev?.status && isTerminal(prev.status) ? prev : { status: "error" });
      es.close();
      sourceRef.current = null;
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [enqueued, corpusId, apiBase]);

  if (!enqueued || !event) return null;

  const status = event.status ?? "pending";
  const percent = Math.max(0, Math.min(100, Math.round((event.progress_percent ?? 0) * 100)));
  const isRunning = status === "pending" || status === "running";
  const isError = status === "failed" || status === "error" || status === "timeout";

  return (
    <div
      data-testid="kg-build-progress"
      data-kg-status={status}
      className={cn(
        "mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        isRunning &&
          "border-violet-200/80 bg-violet-50/40 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/20 dark:text-violet-200",
        status === "completed" &&
          "border-emerald-200/80 bg-emerald-50/40 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-200",
        isError &&
          "border-red-200/80 bg-red-50/40 text-red-700 dark:border-red-800/60 dark:bg-red-950/20 dark:text-red-200",
        (status === "idle" || status === "switched") &&
          "border-zinc-200/60 bg-zinc-50/40 text-zinc-600 dark:border-zinc-800/50 dark:bg-zinc-900/20 dark:text-zinc-300",
      )}
    >
      <span
        className={cn(
          "inline-flex h-2 w-2 shrink-0 rounded-full",
          isRunning && "animate-pulse bg-violet-500",
          status === "completed" && "bg-emerald-500",
          isError && "bg-red-500",
          (status === "idle" || status === "switched") && "bg-zinc-400 dark:bg-zinc-600",
        )}
      />
      <span className="font-medium">知识图谱：{STATUS_LABEL[status]}</span>
      {isRunning ? (
        <span className="font-mono text-muted-foreground">{percent}%</span>
      ) : null}
      {status === "completed" || status === "running" ? (
        <span className="text-muted-foreground">
          · {event.entity_count ?? 0} 实体 / {event.relation_count ?? 0} 关系
        </span>
      ) : null}
      {isError && event.error_message ? (
        <span className="truncate text-muted-foreground">— {event.error_message}</span>
      ) : null}
    </div>
  );
}
