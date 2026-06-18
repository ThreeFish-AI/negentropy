/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  MemorySidebarLayout,
  SidebarCard,
  fetchMemoryHealth,
  fetchMemoryMetrics,
  fetchRetrievalMetrics,
  type MemoryHealth,
  type MemorySystemMetrics,
  type RetrievalMetrics,
} from "@/features/memory";
import { MemoryHealthCard } from "./_components/MemoryHealthCard";
import { RetrievalMetricsCard } from "./_components/RetrievalMetricsCard";
import { SystemMetricsPanel } from "./_components/SystemMetricsPanel";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export default function MemoryInsightsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin") ?? false;

  const [health, setHealth] = useState<MemoryHealth | null>(null);
  const [retrieval, setRetrieval] = useState<RetrievalMetrics | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<MemorySystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    // 三个数据源各自降级：health/metrics 端点可能禁用或无权（403/404），
    // 不应阻断整页；用 allSettled 收敛。
    const [healthRes, retrievalRes, metricsRes] = await Promise.allSettled([
      fetchMemoryHealth(),
      fetchRetrievalMetrics({ app_name: APP_NAME }),
      isAdmin ? fetchMemoryMetrics({ app_name: APP_NAME }) : Promise.resolve(null),
    ]);
    setHealth(healthRes.status === "fulfilled" ? healthRes.value : null);
    setRetrieval(retrievalRes.status === "fulfilled" ? retrievalRes.value : null);
    setSystemMetrics(metricsRes.status === "fulfilled" ? metricsRes.value : null);
    setIsLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Insights" description="检索质量与系统可观测" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <MemorySidebarLayout
            sidebar={
              <>
                <MemoryHealthCard health={health} loading={isLoading} />
                <SidebarCard title="About Insights">
                  <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                    检索质量指标对所有用户可见；系统聚合指标（巩固、Retention 分布、PII、
                    知识图谱）仅管理员可见，由后端按 DB 角色强制鉴权。
                  </p>
                </SidebarCard>
              </>
            }
          >
            <div className="space-y-6">
              {/* 检索质量 —— 全员 */}
              <RetrievalMetricsCard metrics={retrieval} loading={isLoading} />

              {/* 系统聚合指标 —— admin 渲染门控 */}
              {isAdmin ? (
                <SystemMetricsPanel metrics={systemMetrics} loading={isLoading} />
              ) : (
                <EmptyState
                  size="sm"
                  icon={ShieldAlert}
                  title="系统聚合指标需要管理员权限"
                  description="上方检索质量指标对你可用；巩固、Retention 分布、PII 与知识图谱等系统级指标仅管理员可见。"
                />
              )}
            </div>
          </MemorySidebarLayout>
        </div>
      </div>
    </div>
  );
}
