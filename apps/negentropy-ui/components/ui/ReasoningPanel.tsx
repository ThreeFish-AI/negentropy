"use client";

/**
 * ReasoningPanel · P2-4 G3
 *
 * 把一组 reasoning steps 折叠成单个可展开容器。
 *
 * 设计目标（RFC 0002 §4.1）：
 *   把推理过程从消息正文分离，腾出视觉空间；用户可主动展开看完整 step-by-step trace。
 *
 * 性能策略（避开高频 thinking event 的 reflow 风暴）：
 *   - 同 stepId 的 started/finished 只保留最新一条（reduce in `mergeSteps`）；
 *   - 50 步硬上限（超出折叠为 "+N 更多"）；
 *   - localStorage 持久化展开状态（key: `home.reasoning_panel.expanded`）。
 *
 * 与 RFC 0002 §4.1 的差异：当前 MVP 把面板嵌入 assistant bubble 上方（inline），
 * 不引入右侧 surface panel —— 后者依赖 RFC 0001 的 Turn/Item 数据模型，本次范围外。
 *
 * 参考：
 *   - Wu et al., "Promptly: Visualizing LLM Reasoning Traces," CHI 2025
 *   - Anthropic Claude Code Reasoning Panel 设计稿（折叠 / 摘要 / 步号导航）
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { ReasoningStep } from "./ReasoningStep";

const STORAGE_KEY = "home.reasoning_panel.expanded";
const MAX_STEPS = 50;

export type ReasoningStepData = {
  id: string;
  stepId: string;
  title: string;
  phase: "started" | "finished";
};

function readPersisted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePersisted(expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    // noop
  }
}

/**
 * useSyncExternalStore 订阅 localStorage `home.reasoning_panel.expanded` —— 比
 * useEffect+setState 更安全，规避 ESLint react-hooks/set-state-in-effect 与
 * SSR 水合不一致（SSR snapshot 永远 false，CSR 首次渲染从 storage 取真实值）。
 */
function subscribeStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * 同 stepId 的 started/finished 仅保留最新（finished 优先）。
 * 输入顺序对结果有影响：后出现的 finished 覆盖先出现的 started —— 这与
 * AG-UI step lifecycle 的事件时序一致。
 */
export function mergeSteps(steps: ReasoningStepData[]): ReasoningStepData[] {
  const byStepId = new Map<string, ReasoningStepData>();
  for (const step of steps) {
    const prev = byStepId.get(step.stepId);
    // finished 永远优先；started → finished 覆盖；finished → started 不覆盖
    if (!prev) {
      byStepId.set(step.stepId, step);
      continue;
    }
    if (prev.phase === "started" && step.phase === "finished") {
      byStepId.set(step.stepId, step);
    }
    // started → started：保留首条；finished → finished：保留首条（idempotent）
  }
  return Array.from(byStepId.values());
}

export function ReasoningPanel({ steps }: { steps: ReasoningStepData[] }) {
  const merged = useMemo(() => mergeSteps(steps), [steps]);
  const truncated = merged.slice(0, MAX_STEPS);
  const overflow = Math.max(0, merged.length - MAX_STEPS);

  const expanded = useSyncExternalStore(
    subscribeStorage,
    readPersisted,
    () => false, // SSR snapshot：永远视为收起，避免水合不一致
  );

  const toggle = useCallback(() => {
    const next = !readPersisted();
    writePersisted(next);
    // 主动派发 storage 事件，让本 tab 内的 useSyncExternalStore 重新拉取
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    }
  }, []);

  if (merged.length === 0) return null;

  const runningCount = merged.filter((s) => s.phase === "started").length;
  const summaryLabel =
    runningCount > 0
      ? `推理中 · ${merged.length} 步（${runningCount} 进行中）`
      : `思考完成 · ${merged.length} 步`;

  return (
    <div
      data-testid="reasoning-panel"
      data-expanded={expanded ? "true" : "false"}
      className={cn(
        "rounded-xl border text-xs transition-colors",
        runningCount > 0
          ? "border-violet-200/80 bg-violet-50/40 dark:border-violet-800/60 dark:bg-violet-950/20"
          : "border-zinc-200/60 bg-zinc-50/40 dark:border-zinc-800/50 dark:bg-zinc-900/20",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-2 w-2 shrink-0 rounded-full",
              runningCount > 0 ? "animate-pulse bg-violet-500" : "bg-zinc-400 dark:bg-zinc-600",
            )}
          />
          <span className="font-medium">{summaryLabel}</span>
        </span>
        <span className="text-muted-foreground">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-border/40 px-3 py-2">
          {truncated.map((step) => (
            <ReasoningStep
              key={step.id}
              title={step.title}
              phase={step.phase}
              stepId={step.stepId}
            />
          ))}
          {overflow > 0 ? (
            <div className="text-center text-muted-foreground">+{overflow} 更多步骤已折叠</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
