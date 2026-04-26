"use client";

import { useEffect, useRef, useState } from "react";
import type { WikiRevalidationStatus } from "@/features/knowledge";

interface WikiPublishPipelineProps {
  revalidation: WikiRevalidationStatus;
  /** 发布后的目标版本号，用于新鲜度验证 */
  targetVersion?: number;
  /** Publication slug，用于轮询 SSG content-status */
  pubSlug?: string;
}

type FreshnessStatus = "idle" | "checking" | "confirmed" | "timeout";

type StepStatus = "completed" | "active" | "pending";

interface PipelineStep {
  label: string;
  status: StepStatus;
}

const SSG_BASE_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_WIKI_SSG_BASE_URL || ""
    : "";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

function getSteps(
  revalidation: WikiRevalidationStatus,
  freshness: FreshnessStatus,
): PipelineStep[] {
  const ssgStep: StepStatus =
    revalidation === "dispatched"
      ? "completed"
      : revalidation === "failed"
        ? "active"
        : "pending";

  const verifyStep: StepStatus =
    freshness === "confirmed"
      ? "completed"
      : freshness === "checking"
        ? "active"
        : freshness === "timeout"
          ? "active"
          : "pending";

  return [
    { label: "保存版本", status: "completed" },
    { label: "通知 SSG", status: ssgStep },
    { label: "验证内容", status: verifyStep },
  ];
}

const STATUS_MESSAGES: Record<
  WikiRevalidationStatus,
  Record<FreshnessStatus, { text: string; className: string }>
> = {
  dispatched: {
    idle: {
      text: "ISR 已触发，内容即将上线",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    checking: {
      text: "ISR 已触发，正在验证内容是否已上线…",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    confirmed: {
      text: "内容已上线，可正常访问",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    timeout: {
      text: "ISR 已触发，验证超时（内容可能在传播中）",
      className: "text-amber-600 dark:text-amber-400",
    },
  },
  failed: {
    idle: {
      text: "ISR 通知发送失败，将通过 5 分钟窗口异步更新",
      className: "text-amber-600 dark:text-amber-400",
    },
    checking: {
      text: "ISR 通知发送失败，将通过 5 分钟窗口异步更新",
      className: "text-amber-600 dark:text-amber-400",
    },
    confirmed: {
      text: "ISR 通知发送失败，将通过 5 分钟窗口异步更新",
      className: "text-amber-600 dark:text-amber-400",
    },
    timeout: {
      text: "ISR 通知发送失败，将通过 5 分钟窗口异步更新",
      className: "text-amber-600 dark:text-amber-400",
    },
  },
  not_configured: {
    idle: {
      text: "未配置主动 ISR，内容将通过 5 分钟窗口异步更新",
      className: "text-muted",
    },
    checking: {
      text: "未配置主动 ISR，内容将通过 5 分钟窗口异步更新",
      className: "text-muted",
    },
    confirmed: {
      text: "未配置主动 ISR，内容将通过 5 分钟窗口异步更新",
      className: "text-muted",
    },
    timeout: {
      text: "未配置主动 ISR，内容将通过 5 分钟窗口异步更新",
      className: "text-muted",
    },
  },
};

function StepDot({ status }: { status: StepStatus }) {
  const base =
    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium shrink-0";
  const variants: Record<StepStatus, string> = {
    completed: `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`,
    active: `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse`,
    pending: `${base} bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500`,
  };
  return (
    <span className={variants[status]}>
      {status === "completed" ? "✓" : status === "active" ? "•" : "○"}
    </span>
  );
}

export function WikiPublishPipeline({
  revalidation,
  targetVersion,
  pubSlug,
}: WikiPublishPipelineProps) {
  const [freshness, setFreshness] = useState<FreshnessStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  // Poll SSG content-status for freshness verification
  useEffect(() => {
    if (revalidation !== "dispatched" || !SSG_BASE_URL || !pubSlug || !targetVersion) {
      return;
    }

    attemptsRef.current = 0;

    const poll = async () => {
      if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
        setFreshness("timeout");
        return;
      }
      attemptsRef.current++;
      try {
        const resp = await fetch(
          `${SSG_BASE_URL}/api/content-status?slug=${encodeURIComponent(pubSlug)}`,
        );
        if (resp.ok) {
          const data = (await resp.json()) as {
            version: number;
            status: string;
          };
          if (data.version >= targetVersion) {
            setFreshness("confirmed");
            return;
          }
        }
      } catch {
        // retry
      }
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [revalidation, pubSlug, targetVersion]);

  const shouldPoll = revalidation === "dispatched" && !!SSG_BASE_URL && !!pubSlug && !!targetVersion;
  const effectiveFreshness: FreshnessStatus = shouldPoll && freshness === "idle" ? "checking" : freshness;

  const steps = getSteps(revalidation, effectiveFreshness);
  const msg = STATUS_MESSAGES[revalidation]?.[effectiveFreshness] ?? STATUS_MESSAGES[revalidation]?.idle;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-3">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-3 bg-border" />}
            <StepDot status={step.status} />
            <span className="text-[11px] text-muted">{step.label}</span>
          </div>
        ))}
      </div>
      {msg && (
        <p className={`text-[11px] ${msg.className}`}>{msg.text}</p>
      )}
    </div>
  );
}
