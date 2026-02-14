"use client";

import { useState, useEffect } from "react";
import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { KNOWLEDGE_API_ENDPOINTS, ApiEndpoint } from "@/features/knowledge/utils/api-specs";
import { ApiStats, ApiStatsSkeleton } from "./_components/ApiStats";
import { EndpointCard } from "./_components/EndpointCard";
import { ApiDocPanel } from "./_components/ApiDocPanel";
import { TryItPanel } from "./_components/TryItPanel";

interface ApiStatsData {
  total_calls: number;
  success_count: number;
  failed_count: number;
  avg_latency_ms: number;
}

export default function KnowledgeApisPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(
    KNOWLEDGE_API_ENDPOINTS[0]
  );
  const [stats, setStats] = useState<ApiStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setStatsLoading(true);

    fetch("/api/knowledge/stats")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setStats(data);
        }
      })
      .catch(() => {
        // 使用 Mock 数据
        if (active) {
          setStats({
            total_calls: 1234,
            success_count: 1198,
            failed_count: 36,
            avg_latency_ms: 156.5,
          });
        }
      })
      .finally(() => {
        if (active) {
          setStatsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title="Knowledge APIs"
        description="API 调用统计与交互式文档"
      />

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        {/* Main Content */}
        <section className="space-y-4">
          {/* Stats */}
          {statsLoading ? <ApiStatsSkeleton /> : stats && <ApiStats stats={stats} />}

          {/* Documentation Panel */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              API 文档
            </h2>
            <div className="mt-4">
              <ApiDocPanel endpoint={selectedEndpoint} />
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Endpoint List */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              端点列表
            </h2>
            <div className="mt-3 space-y-2">
              {KNOWLEDGE_API_ENDPOINTS.map((endpoint) => (
                <EndpointCard
                  key={endpoint.id}
                  endpoint={endpoint}
                  isSelected={selectedEndpoint.id === endpoint.id}
                  onClick={() => setSelectedEndpoint(endpoint)}
                />
              ))}
            </div>
          </div>

          {/* Try It Panel */}
          <TryItPanel endpoint={selectedEndpoint} />
        </aside>
      </div>
    </div>
  );
}
