"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, GitBranch, SearchCheck } from "lucide-react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  RetryableErrorBanner,
  useMemoryOverview,
} from "@/features/memory";
import { MemoryKpiStrip } from "./_components/MemoryKpiStrip";
import { MemoryPipelineDiagram } from "./_components/MemoryPipelineDiagram";
import { SystemHealthChip } from "./_components/SystemHealthChip";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

const STAGE_LINKS = [
  {
    icon: BookOpen,
    title: "Inspect Formation",
    desc: "浏览记忆时间线与结构化事实",
    href: "/memory/timeline",
    cta: "Timeline & Facts",
  },
  {
    icon: GitBranch,
    title: "Govern Evolution",
    desc: "冲突消解、身份记忆块与审计治理",
    href: "/memory/conflicts",
    cta: "Conflicts · Core Memory · Audit",
  },
  {
    icon: SearchCheck,
    title: "Analyze Retrieval",
    desc: "检索质量、系统指标与健康可观测",
    href: "/memory/insights",
    cta: "Insights",
  },
];

export default function MemoryOverviewPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;

  const { dashboard, health, metrics, isLoading, error, reload } =
    useMemoryOverview({ appName: APP_NAME, isAdmin });

  return (
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Overview" description="记忆系统总览与生命周期" />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-h4 font-bold tracking-heading text-foreground">
                Memory System
              </h1>
              <p className="mt-0.5 text-caption text-muted-foreground">
                从形成、演化到检索的完整记忆生命周期
              </p>
            </div>
            <SystemHealthChip health={health} loading={isLoading} />
          </div>

          {/* dashboard 是主信号；失败可重试。health/metrics 失败已在 hook 内降级。 */}
          <RetryableErrorBanner error={error} onRetry={reload} />

          {/* KPI strip */}
          <MemoryKpiStrip dashboard={dashboard} loading={isLoading} />

          {/* Pipeline 可视化 —— 脊柱 */}
          <MemoryPipelineDiagram
            dashboard={dashboard}
            health={health}
            metrics={metrics}
          />

          {/* Stage navigator */}
          <div className="grid gap-4 sm:grid-cols-3">
            {STAGE_LINKS.map((stage) => {
              const Icon = stage.icon;
              return (
                <Link
                  key={stage.href}
                  href={stage.href}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm outline-none transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      {stage.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                    {stage.desc}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-micro font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                    {stage.cta}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
