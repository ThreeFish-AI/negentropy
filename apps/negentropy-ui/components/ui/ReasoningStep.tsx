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

export function ReasoningStep({
  title,
  phase,
}: {
  title: string;
  phase: "started" | "finished";
  stepId: string;
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

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
        isRunning
          ? "border-violet-200/80 bg-violet-50/60 text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/20 dark:text-violet-300"
          : "border-zinc-200/60 bg-zinc-50/50 text-zinc-500 dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:text-zinc-400",
      )}
    >
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
  );
}
