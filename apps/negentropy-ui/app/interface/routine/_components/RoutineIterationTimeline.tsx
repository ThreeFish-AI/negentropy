"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ListTree } from "lucide-react";

import type { RoutineIterationDTO } from "@/features/routine";
import { AGENT_ROLE_META, deriveIterationDriver } from "@/features/routine";
import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";
import { cn } from "@/lib/utils";

import { LiveElapsed, StaticDuration } from "./ElapsedClock";
import { MarkdownText } from "./MarkdownText";
import { ACTIVE_TIMING } from "./routine-loop";
import { iterationDotClass, phaseClass, phaseLabel, scoreColorClass, verdictClass } from "./status-style";

const PAGE_SIZE = 10;

interface RoutineIterationTimelineProps {
  iterations: RoutineIterationDTO[];
  onApprove: (iterationId: string) => void;
  onReject?: (iterationId: string) => void;
  /** 打开某迭代的「全过程」审计抽屉。 */
  onAudit?: (iteration: RoutineIterationDTO) => void;
  busy?: boolean;
}

export function RoutineIterationTimeline({
  iterations,
  onApprove,
  onAudit,
  busy,
}: RoutineIterationTimelineProps) {
  // 统一分页（client 模式）：迭代为父级 detail 加载的近期全量集合，已在内存，渐进切片即可。
  // 对外统一 1-indexed（原本地实现为 0-indexed，由套件归一）。本次仅做 UI 统一 + 对该集合的
  // 无限滚动/翻页，不引入新的 cursor 全量拉取（那是父级 detail 的职责）。
  const list = useInfiniteList<RoutineIterationDTO>({
    fetcher: useMemo(() => ({ kind: "client" as const, items: iterations }), [iterations]),
    pageSize: PAGE_SIZE,
  });

  // 无限滚动 + 翻页：本组件不自建滚动容器，内容平铺进所在深链页的页面级 overflow 容器，
  // 故哨兵 / 滚动联动 observer 以 viewport 为 root（root 省略 → 相对视口，即真实滚动面）。
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  // 无限滚动哨兵：滚到底（提前 200px）→ 揭示下一页。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
  });

  // 滚动联动当前页高亮：观测每页首项的 data-infinite-page 锚点，取最靠上可见页。
  useScrollPageSync({
    enabled: true,
    onPageChange: list.goToPage,
    rescanKey: list.items.length,
    programmaticRef: programmaticScrollRef,
  });

  // 点页码跳页：先经 hook 揭示该页，再滚动到该页锚点。
  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动（client 切片增长后锚点再现 → effect 重跑命中）。
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = document.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return; // 该页尚未渲染，待 items 增长后重跑
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [list.currentPage, list.items.length]);

  if (iterations.length === 0) {
    return <p className="text-sm text-text-secondary">No iterations yet.</p>;
  }

  return (
    <>
      <ol className="space-y-1.5">
        {list.items.map((it, i) => (
          <IterationCard
            key={it.id}
            it={it}
            onApprove={onApprove}
            onAudit={onAudit}
            busy={busy}
            // 每 PAGE_SIZE 项首项打锚点，供翻页定位与滚动联动当前页（1-indexed）。
            anchorPage={i % PAGE_SIZE === 0 ? Math.floor(i / PAGE_SIZE) + 1 : undefined}
          />
        ))}
      </ol>
      {/* 无限滚动哨兵：进入视口即揭示下一页（hasMore 为否时 hook 自动停观察）。 */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      {/* 居中翻页控件（替换原手搓 prev/next，沿用居中布局）；与无限滚动并存。 */}
      {list.total != null && list.total > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <Pagination
            page={list.currentPage}
            totalPages={list.totalPages}
            onPageChange={handleGoToPage}
            total={list.total}
            itemLabel="iteration"
            disabled={list.loading}
            loadingMore={list.loadingMore}
          />
        </div>
      )}
    </>
  );
}

/** Iteration 状态 → 简短中文标签（收起态无 summary 时降级占位用）。 */
const ITERATION_STATUS_LABEL: Record<string, string> = {
  pending_approval: "待审批",
  dispatched: "已派发",
  in_flight: "执行中",
  executed: "已执行",
  evaluated: "已评估",
  reaped: "已收割",
  aborted: "已中止",
};

/** 收起态单行摘要：取 summary 首行、剥离常见 Markdown 记号、超长截断；
 * summary 为空时降级为「相位 · 状态」占位。纯机械处理，无 LLM。 */
function summaryHeadline(it: RoutineIterationDTO): { text: string; full: string | null } {
  const raw = it.summary?.trim();
  if (!raw) {
    const ph = it.phase ? phaseLabel(it.phase) : "";
    const st = ITERATION_STATUS_LABEL[it.status] ?? it.status;
    return { text: [ph, st].filter(Boolean).join(" · "), full: null };
  }
  // 取首条「有意义」行：跳过空行与纯分隔线（--- / *** / ___）
  const firstLine =
    raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0 && !/^(?:[-*_]\s*){3,}$/.test(l)) ?? "";
  const stripped = firstLine
    .replace(/^#+\s*/, "") // ATX 标题
    .replace(/^[-*+]\s+/, "") // 列表项
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接 → 文本
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **加粗**
    .replace(/__([^_]+)__/g, "$1") // __加粗__
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, "$1") // _斜体_（词边界，保留 PR_URL / file_name 等中间下划线）
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, "$1") // *斜体*
    .replace(/~~([^~]+)~~/g, "$1") // ~~删除线~~
    .replace(/`([^`]+)`/g, "$1") // `行内代码`
    .trim();
  const text = stripped.length > 100 ? `${stripped.slice(0, 100)}…` : stripped;
  return { text: text || raw.slice(0, 100), full: raw };
}

function IterationCard({
  it,
  onApprove,
  onAudit,
  busy,
  anchorPage,
}: {
  it: RoutineIterationDTO;
  onApprove: (id: string) => void;
  onAudit?: (iteration: RoutineIterationDTO) => void;
  busy?: boolean;
  /** 无限滚动锚点页号（仅每页首项传入），打在 <li> 上供翻页定位与滚动联动当前页。 */
  anchorPage?: number;
}) {
  const isActive = !it.finished_at && ACTIVE_TIMING.has(it.status);
  const isPendingApproval = it.status === "pending_approval";
  // 活跃迭代（待审批 / 执行中 / 已派发）默认展开以暴露实时计时与审批入口；已完成默认收起。
  const [expanded, setExpanded] = useState(isActive);
  const bodyId = `iter-${it.id}-body`;
  const headline = summaryHeadline(it);

  // 行体内容（状态点 + 序号 + 相位 + 摘要首行 + verdict + score + 元信息 + View Full 标签）。
  // 交互：点击行首 chevron 触发展开/收起；点击行体（整行其余部分）= View Full 打开审计抽屉。
  // View Full 为行内视觉标签（非独立按钮），随行体按钮一并触发，避免 button 套 button。
  const rowContent = (
    <>
      <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", iterationDotClass(it.status))} />
      <span className="shrink-0 text-xs font-semibold text-foreground">#{it.seq}</span>
      {it.phase && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
            phaseClass(it.phase),
          )}
        >
          {phaseLabel(it.phase)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-text-secondary" title={headline.full ?? undefined}>
        {headline.text}
      </span>
      {it.verdict && (
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", verdictClass(it.verdict))}>
          {it.verdict}
        </span>
      )}
      {it.score != null && (
        <span className={cn("shrink-0 text-sm font-bold tabular-nums", scoreColorClass(it.score))}>{it.score}</span>
      )}
      {/* 收起态核心元信息：turns · cost · elapsed（小屏隐藏） */}
      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-text-secondary sm:flex">
        <span className="tabular-nums">{it.turn_count}t</span>
        <span className="text-text-muted">·</span>
        <span className="tabular-nums">${it.cost_usd.toFixed(4)}</span>
        <span className="text-text-muted">·</span>
        {isActive ? (
          <LiveElapsed startedAt={it.started_at} />
        ) : (
          <StaticDuration startedAt={it.started_at} finishedAt={it.finished_at} />
        )}
      </span>
      {onAudit && (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-secondary transition-colors group-hover/head:border-foreground/20 group-hover/head:text-foreground">
          <ListTree className="h-3 w-3" aria-hidden />
          View Full
        </span>
      )}
    </>
  );

  return (
    <li
      data-infinite-page={anchorPage}
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        isActive
          ? "border-sky-500/60 bg-sky-500/[0.05] ring-1 ring-sky-500/20"
          : expanded
            ? "border-border"
            : "border-transparent hover:border-border/60",
      )}
    >
      {/* 头部单行：仅 chevron 触发展开/收起；点击行体（整行其余部分）= View Full 打开审计抽屉 */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `收起迭代 #${it.seq} 详情` : `展开迭代 #${it.seq} 详情`}
          title={expanded ? "收起" : "展开"}
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-text-muted transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-150", expanded && "rotate-90")} aria-hidden />
        </button>
        {onAudit ? (
          <button
            type="button"
            onClick={() => onAudit(it)}
            title="查看全过程 (View Full)"
            aria-label={`Iteration #${it.seq} View Full`}
            className="group/head flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {rowContent}
          </button>
        ) : (
          <div className="group/head flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1">{rowContent}</div>
        )}
      </div>

      {/* 展开态明细框（头部 100% 复用，仅 chevron 翻转） */}
      {expanded && (
        <div
          id={bodyId}
          role="region"
          aria-label={`Iteration #${it.seq} 详情`}
          className="space-y-2 border-t border-border/60 px-4 py-3"
        >
          {/* PLAN 阶段：摘要即「执行计划」，加标签以便人工审批前定位 */}
          {it.phase === "plan" && it.summary && (
            <div className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              📋 执行计划 (Plan)
            </div>
          )}

          {/* 执行摘要（Markdown 全文渲染） */}
          {it.summary && (
            <div className={it.phase === "plan" ? "mt-1" : ""}>
              <MarkdownText content={it.summary} />
            </div>
          )}

          {/* 执行失败信息 */}
          {it.exec_error && (
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-red-500/5 p-2 text-caption text-red-600 dark:text-red-400">
              {it.exec_error}
            </pre>
          )}

          {/* 评估反思（Markdown 渲染） */}
          {it.reflection && (
            <div className="rounded bg-muted/40 p-2">
              <span className="mr-1">💡</span>
              <MarkdownText content={it.reflection} className="[&_p]:inline" />
            </div>
          )}

          {/* 完整指标行 */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
            {/* 当前阶段主导人指示 */}
            {(() => {
              const driver = deriveIterationDriver(it.status);
              if (!driver) return null;
              const meta = AGENT_ROLE_META[driver];
              const Icon = meta.icon;
              return (
                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${meta.badgeClass}`}>
                  <Icon className="h-2.5 w-2.5" aria-hidden />
                  {meta.label}
                </span>
              );
            })()}
            {it.exec_status && <span>exec: {it.exec_status}</span>}
            <span>turns: {it.turn_count}</span>
            <span>cost: ${it.cost_usd.toFixed(4)}</span>
            {it.gate_exit_code != null && <span>gate exit: {it.gate_exit_code}</span>}
            {isActive ? (
              <LiveElapsed startedAt={it.started_at} prefix="⏱ " />
            ) : (
              <StaticDuration startedAt={it.started_at} finishedAt={it.finished_at} prefix="⏱ " />
            )}
            {it.started_at && (
              <span title={new Date(it.started_at).toLocaleString()}>
                {new Date(it.started_at).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* 审批门控：NegentropyEngine 自动审阅中 */}
          {isPendingApproval && (
            <div className="flex items-center gap-2 rounded-md bg-sky-500/5 p-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
              <span className="text-xs text-sky-700 dark:text-sky-300">
                {it.phase === "plan"
                  ? "NegentropyEngine 正在审阅此 Plan…"
                  : it.phase === "implement"
                    ? "NegentropyEngine 正在审阅实现方案…"
                    : "等待 NegentropyEngine 审阅…"}
              </span>
              <div className="flex-1" />
              {/* 手动审批按钮（fallback：当 Engine 未自动审阅时，人工仍可介入） */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(it.id);
                }}
                disabled={busy}
                className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-muted/50 disabled:opacity-50"
              >
                Manual Approve
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
