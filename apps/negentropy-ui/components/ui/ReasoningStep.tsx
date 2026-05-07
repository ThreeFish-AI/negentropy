"use client";

import { cn } from "@/lib/utils";

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  NegentropyEngine: "熵减引擎",
  PerceptionFaculty: "感知系部",
  InternalizationFaculty: "内化系部",
  ContemplationFaculty: "沉思系部",
  ActionFaculty: "知行系部",
  InfluenceFaculty: "影响系部",
  KnowledgeAcquisitionPipeline: "知识获取流水线",
  ProblemSolvingPipeline: "问题解决流水线",
  ValueDeliveryPipeline: "价值交付流水线",
};

function isKnownAgent(title: string): boolean {
  return title in AGENT_DISPLAY_NAMES;
}

function stringifyResult(result: unknown): string {
  if (result === null || result === undefined) return "";
  if (typeof result === "string") return result.trim();
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function ReasoningStep({
  title,
  phase,
  content,
  result,
}: {
  title: string;
  phase: "started" | "finished";
  stepId: string;
  /** ISSUE-070：推理过程文本，由 ne.a2ui.thought / ne.a2ui.reasoning 注入。 */
  content?: string;
  result?: unknown;
}) {
  const isRunning = phase === "started";
  const isAgent = isKnownAgent(title);
  const displayName = AGENT_DISPLAY_NAMES[title] || title;

  const label = isRunning
    ? isAgent
      ? `委派至 ${displayName}`
      : `正在思考 · ${displayName}`
    : isAgent
      ? `${displayName} 已完成`
      : `思考完成 · ${displayName}`;

  const trimmedContent = (content || "").trim();
  const trimmedResult = stringifyResult(result);
  const hasDetail = trimmedContent.length > 0 || trimmedResult.length > 0;

  return (
    <div
      data-testid="reasoning-step"
      data-step-phase={phase}
      data-has-detail={hasDetail ? "true" : "false"}
      className={cn(
        "rounded-xl border px-3 py-2 text-xs",
        isRunning
          ? "border-violet-200/80 bg-violet-50/60 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/20 dark:text-violet-300"
          : "border-zinc-200/60 bg-zinc-50/50 text-zinc-600 dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:text-zinc-300",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-2 w-2 shrink-0 rounded-full",
            isRunning
              ? "animate-pulse bg-violet-500"
              : "bg-zinc-400 dark:bg-zinc-600",
          )}
        />
        <span className="font-medium truncate">{label}</span>
      </div>
      {trimmedContent ? (
        <div
          data-testid="reasoning-step-content"
          className="mt-2 whitespace-pre-wrap break-words rounded-md bg-white/60 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
        >
          {trimmedContent}
        </div>
      ) : null}
      {trimmedResult ? (
        <pre
          data-testid="reasoning-step-result"
          className="mt-2 max-h-48 overflow-auto rounded-md bg-zinc-100/80 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
        >
          {trimmedResult}
        </pre>
      ) : null}
    </div>
  );
}
