"use client";

import { MCP_HUB_LABEL } from "@/app/interface/copy";
import type { MemoryDashboard } from "@/features/memory";

import { ActivityBadgeButton } from "./ActivityBadgeButton";
import { MetricCell } from "./MetricCell";
import type { KpiResponse } from "../_lib/types";

/* ---------- helpers ---------- */

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(value: number) {
  if (value < 1000) return `${value.toFixed(0)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

/* ---------- Stats type (mirrors InterfaceOverviewSection) ---------- */

interface Stats {
  mcp_servers: { total: number; enabled: number };
  skills: { total: number; enabled: number };
  agents: { total: number; enabled: number };
  models: { total: number; enabled: number; vendors: number };
  tools: { total: number; enabled: number };
}

/* ---------- Props ---------- */

interface DashboardHeaderStripProps {
  kpis: KpiResponse | null;
  kpiLoading: boolean;
  memoryDashboard: MemoryDashboard | null;
  memoryLoading: boolean;
  interfaceStats: Stats | null;
  interfaceLoading: boolean;
  isAdmin: boolean;
  activityCount: number;
  onOpenActivity: () => void;
}

/* ---------- Group wrapper ---------- */

function CellGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-1.5">{children}</div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function DashboardHeaderStrip({
  kpis,
  kpiLoading,
  memoryDashboard,
  memoryLoading,
  interfaceStats,
  interfaceLoading,
  isAdmin,
  activityCount,
  onOpenActivity,
}: DashboardHeaderStripProps) {
  const hasAlerts =
    memoryDashboard &&
    (memoryDashboard.low_retention_count > 0 ||
      memoryDashboard.high_importance_count > 0);

  return (
    <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0">
        {/* ── Scheduler ── */}
        <CellGroup label="Scheduler">
          <MetricCell
            label="Tasks"
            value={kpis?.total_tasks ?? "—"}
            hint={kpis ? `${kpis.enabled_tasks} enabled` : undefined}
            loading={kpiLoading}
            href="/interface/scheduler"
          />
          <MetricCell
            label={`Runs (${kpis?.window ?? "24h"})`}
            value={kpis?.runs ?? "—"}
            loading={kpiLoading}
          />
          <MetricCell
            label="Success Rate"
            value={kpis ? formatPercent(kpis.success_rate) : "—"}
            tone={kpis && kpis.success_rate >= 0.95 ? "good" : "warn"}
            loading={kpiLoading}
          />
          <MetricCell
            label="Running"
            value={kpis?.running ?? "—"}
            loading={kpiLoading}
          />
          <MetricCell
            label="Failed"
            value={kpis?.failed ?? "—"}
            tone={kpis && kpis.failed > 0 ? "warn" : "neutral"}
            loading={kpiLoading}
          />
          <MetricCell
            label="Avg Latency"
            value={kpis ? formatMs(kpis.avg_latency_ms) : "—"}
            loading={kpiLoading}
          />
        </CellGroup>

        {/* ── Divider ── */}
        <div className="hidden md:block w-px self-stretch bg-border/60 mx-2" />

        {/* ── Memory ── */}
        <CellGroup label="Memory">
          <MetricCell
            label="Users"
            value={memoryDashboard?.user_count ?? "—"}
            loading={memoryLoading}
          />
          <MetricCell
            label="Memories"
            value={memoryDashboard?.memory_count ?? "—"}
            loading={memoryLoading}
          />
          <MetricCell
            label="Facts"
            value={memoryDashboard?.fact_count ?? "—"}
            loading={memoryLoading}
          />
          <MetricCell
            label="Avg Retention"
            value={
              memoryDashboard
                ? formatPercent(memoryDashboard.avg_retention_score)
                : "—"
            }
            tone={
              memoryDashboard &&
              memoryDashboard.avg_retention_score < 0.3
                ? "warn"
                : "neutral"
            }
            loading={memoryLoading}
          />
          <MetricCell
            label="Avg Importance"
            value={
              memoryDashboard
                ? formatPercent(memoryDashboard.avg_importance_score)
                : "—"
            }
            loading={memoryLoading}
          />
          <MetricCell
            label="Alerts"
            value={
              memoryDashboard
                ? `${memoryDashboard.low_retention_count} low / ${memoryDashboard.high_importance_count} high`
                : "—"
            }
            tone={hasAlerts ? "warn" : "neutral"}
            loading={memoryLoading}
          />
        </CellGroup>

        {/* ── Divider ── */}
        <div className="hidden md:block w-px self-stretch bg-border/60 mx-2" />

        {/* ── Interface ── */}
        <CellGroup label="Interface">
          {isAdmin && (
            <MetricCell
              label="Models"
              value={interfaceStats?.models.total ?? "—"}
              hint={
                interfaceStats
                  ? `${interfaceStats.models.enabled} enabled`
                  : undefined
              }
              loading={interfaceLoading}
              href="/interface/models"
            />
          )}
          <MetricCell
            label="Agents"
            value={interfaceStats?.agents.total ?? "—"}
            hint={
              interfaceStats
                ? `${interfaceStats.agents.enabled} enabled`
                : undefined
            }
            loading={interfaceLoading}
            href="/interface/agents"
          />
          <MetricCell
            label={MCP_HUB_LABEL}
            value={interfaceStats?.mcp_servers.total ?? "—"}
            hint={
              interfaceStats
                ? `${interfaceStats.mcp_servers.enabled} enabled`
                : undefined
            }
            loading={interfaceLoading}
            href="/interface/mcp"
          />
          <MetricCell
            label="Skills"
            value={interfaceStats?.skills.total ?? "—"}
            hint={
              interfaceStats
                ? `${interfaceStats.skills.enabled} enabled`
                : undefined
            }
            loading={interfaceLoading}
            href="/interface/skills"
          />
          <MetricCell
            label="Tools"
            value={interfaceStats?.tools?.total ?? "—"}
            hint={
              interfaceStats
                ? `${interfaceStats.tools.enabled} enabled`
                : undefined
            }
            loading={interfaceLoading}
            href="/interface/tools"
          />
        </CellGroup>

        {/* Activity trigger */}
        <div className="flex shrink-0 items-center md:ml-2">
          <ActivityBadgeButton count={activityCount} onClick={onOpenActivity} />
        </div>
      </div>
    </div>
  );
}
