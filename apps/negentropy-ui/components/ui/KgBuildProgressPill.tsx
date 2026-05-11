"use client";

/**
 * KgBuildProgressPill · P3-1 G1c
 *
 * 论文采集 ingest_paper 完成后，后端 paper_kg_pipeline.enqueue_kg_build 启动 fire-and-forget
 * KG 构建任务。本组件轮询
 *   GET /api/knowledge/base/{corpusId}/graph/build-runs/latest
 * REST 端点，把 progress_percent / status / 实体 + 关系数 实时显示在 ToolExecutionGroup 内
 * 工具卡片下方。
 *
 * 设计原则：
 * - **轮询替代 SSE**：使用递归 setTimeout + fetch 替代 EventSource，消除长连接超时问题；
 *   瞬态网络故障通过指数退避自动恢复，连续失败 10 次才显示 "无法订阅"。
 * - **轻量旁路**：组件仅读 `corpusId` + `enqueued`，自己管理轮询生命周期；
 *   不参与 message-ledger / 双气泡守卫（与 Tool Progress 同模式）。
 * - **失败软退化**：连接失败 → 显示 "无法订阅" 文案；
 *   终态（completed / failed / idle / timeout）自动停止轮询。
 * - **零回归**：父组件传入的 enqueued=false 时此组件返回 null，对旧 message 无影响。
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
  /**
   * 子阶段标签（仅 status=running 时存在）。后端 service.emit_phase 写入 warnings JSONB
   * 的最后一条 _phase 条目，REST 端点透传。可选枚举：
   * extracting / resolving / syncing / pagerank / communities / summaries
   */
  phase?: string | null;
  /** 阶段附加详情（如 processed/total/entity_count），用于扩展显示 */
  phase_detail?: Record<string, unknown> | null;
};

type Props = {
  corpusId?: string | null;
  /** 仅当后端 result.kg_status === "kg_enqueued" 时启用订阅 */
  enqueued: boolean;
  /** 可选：传入 BFF base path（默认 /api/knowledge），便于测试覆盖 */
  apiBase?: string;
  /**
   * 终态回调：在 status 进入 completed/failed/timeout/idle/switched/error 时触发，
   * 让父组件解除 Pill 的"在飞"标志（与 POST 在飞状态解耦）。回调延迟 ~4s 触发，
   * 留出展示终态的时间窗口；父组件需自行幂等处理重复触发。
   */
  onTerminal?: (event: KgBuildProgressEvent) => void;
};

/** 终态展示窗口（ms）：留给用户看清"已完成 / 失败"信息后再让父组件解除挂载 */
const TERMINAL_DISPLAY_HOLD_MS = 4000;

/** 正常轮询间隔 */
const POLL_INTERVAL_MS = 3000;

/** 退避基数（ms） */
const BACKOFF_BASE_MS = 3000;

/** 退避上限（ms） */
const BACKOFF_MAX_MS = 10000;

/** 连续失败上限，超过后显示错误 */
const MAX_CONSECUTIVE_ERRORS = 10;

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

/**
 * 阶段中文标签映射。与后端 PHASE_* 常量（apps/negentropy/src/negentropy/knowledge/graph/service.py）
 * 严格对齐：service.emit_phase 写入的 phase name 必须能被本表覆盖，否则降级为通用"构建中"。
 */
const PHASE_LABEL: Record<string, string> = {
  extracting: "实体抽取中",
  resolving: "实体消解中",
  syncing: "一等公民同步中",
  pagerank: "PageRank 计算中",
  communities: "社区检测中",
  summaries: "社区摘要生成中",
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

export function KgBuildProgressPill({
  corpusId,
  enqueued,
  apiBase = "/api/knowledge",
  onTerminal,
}: Props) {
  const [event, setEvent] = useState<KgBuildProgressEvent | null>(
    enqueued ? { status: "pending", progress_percent: 0 } : null,
  );
  const terminalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 闭包稳定化：onTerminal 由父组件每次渲染重新创建（如箭头函数），用 ref 持有最新值，
  // 避免 useEffect 依赖膨胀导致不必要的重订阅。
  const onTerminalRef = useRef(onTerminal);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);

  useEffect(() => {
    if (!enqueued || !corpusId) {
      if (terminalTimerRef.current) {
        clearTimeout(terminalTimerRef.current);
        terminalTimerRef.current = null;
      }
      return;
    }
    if (typeof window === "undefined") return;

    const url = `${apiBase}/base/${encodeURIComponent(corpusId)}/graph/build-runs/latest`;
    const controller = new AbortController();
    let cancelled = false;
    let consecutiveErrors = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    // 跟踪首次见到的 run_id，过滤掉旧 run 的终态（与 SSE 端点 run_id 锁定逻辑一致）
    let seenRunId: string | null = null;

    const scheduleTerminalCallback = (payload: KgBuildProgressEvent) => {
      if (terminalTimerRef.current) clearTimeout(terminalTimerRef.current);
      terminalTimerRef.current = setTimeout(() => {
        terminalTimerRef.current = null;
        onTerminalRef.current?.(payload);
      }, TERMINAL_DISPLAY_HOLD_MS);
    };

    const stop = (terminalPayload: KgBuildProgressEvent) => {
      setEvent(terminalPayload);
      scheduleTerminalCallback(terminalPayload);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as KgBuildProgressEvent;
        consecutiveErrors = 0;

        // run_id 锁定：首次记录见到的 run_id，后续若 run_id 变化且新 run 处于终态
        // （旧 run 已完成），继续轮询等待新 run 的活跃状态
        if (payload.run_id && seenRunId === null) {
          seenRunId = payload.run_id;
        }
        if (
          payload.run_id &&
          seenRunId !== null &&
          payload.run_id !== seenRunId
        ) {
          if (!isTerminal(payload.status)) {
            // 切换到新 run
            seenRunId = payload.run_id;
          } else {
            // 旧 run 终态是正常的，新 run 终态说明还没开始，继续轮询
            const delay = POLL_INTERVAL_MS;
            timeoutId = setTimeout(poll, delay);
            return;
          }
        }

        if (isTerminal(payload.status)) {
          stop(payload); // 终态：写入 state + 调度延迟终态回调，停止轮询
          return;
        }
        setEvent(payload);
      } catch {
        if (cancelled || controller.signal.aborted) return;
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // 持续失败，显示错误
          setEvent((prev) =>
            prev?.status && isTerminal(prev.status) ? prev : { status: "error" },
          );
          scheduleTerminalCallback({ status: "error" });
          return;
        }
      }

      // 调度下次轮询：正常 3s，失败时指数退避
      const backoff =
        consecutiveErrors > 0
          ? Math.min(
              BACKOFF_BASE_MS * Math.pow(1.5, consecutiveErrors - 1),
              BACKOFF_MAX_MS,
            )
          : POLL_INTERVAL_MS;
      timeoutId = setTimeout(poll, backoff);
    };

    // 首次轮询立即发起
    poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
      if (terminalTimerRef.current) {
        clearTimeout(terminalTimerRef.current);
        terminalTimerRef.current = null;
      }
    };
  }, [enqueued, corpusId, apiBase]);

  if (!enqueued || !event) return null;

  const status = event.status ?? "pending";
  const percent = Math.max(0, Math.min(100, Math.round((event.progress_percent ?? 0) * 100)));
  const isRunning = status === "pending" || status === "running";
  const isError = status === "failed" || status === "error" || status === "timeout";
  // 当处于 running 子阶段时优先显示 phase 中文标签，更精确反映"卡在哪一步"。
  // 命中未知阶段 / 非 running 状态时降级为顶层 STATUS_LABEL，保证兼容旧后端。
  const phaseLabel =
    isRunning && event.phase && PHASE_LABEL[event.phase] ? PHASE_LABEL[event.phase] : null;
  const headlineLabel = phaseLabel ?? STATUS_LABEL[status];

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
      <span className="font-medium">知识图谱：{headlineLabel}</span>
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
