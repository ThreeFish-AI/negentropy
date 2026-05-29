"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { StatsResponse } from "../_lib/types";

interface DimensionChartsProps {
  byRole: StatsResponse | null;
  byScenario: StatsResponse | null;
  byOwner: StatsResponse | null;
}

const DONUT_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#0ea5e9", // sky
  "#a855f7", // purple
  "#ec4899", // pink
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {/* 显式 min-h 让 ResponsiveContainer 即便在 SSR / Flex 折叠时仍有非负尺寸，
          避免 recharts "width(-1) and height(-1)" 警告。 */}
      <div className="h-56 min-h-[14rem] w-full" style={{ minWidth: 1 }}>
        {children}
      </div>
    </div>
  );
}

export function DimensionCharts({ byRole, byScenario, byOwner }: DimensionChartsProps) {
  const roleData = (byRole?.buckets ?? []).map((b) => ({
    name: b.label,
    success: b.success,
    failed: b.failed,
  }));
  const scenarioData = (byScenario?.buckets ?? []).map((b) => ({
    name: b.label,
    runs: b.runs,
  }));
  const ownerData = (byOwner?.buckets ?? []).slice(0, 7).map((b) => ({
    name: b.label,
    value: b.runs,
  }));

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <ChartCard title="Role × Success / Failed">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={roleData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" strokeOpacity={0.2} />
            <XAxis dataKey="name" stroke="currentColor" fontSize={11} />
            <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--color-card, #fff)",
                border: "1px solid var(--color-border, #e5e7eb)",
                fontSize: 11,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="success" stackId="a" fill="#10b981" />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Scenario × Runs">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={scenarioData}
            layout="vertical"
            margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" strokeOpacity={0.2} />
            <XAxis type="number" stroke="currentColor" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" stroke="currentColor" fontSize={11} width={90} />
            <Tooltip
              contentStyle={{
                background: "var(--color-card, #fff)",
                border: "1px solid var(--color-border, #e5e7eb)",
                fontSize: 11,
              }}
            />
            <Bar dataKey="runs" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Owner × Runs">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "var(--color-card, #fff)",
                border: "1px solid var(--color-border, #e5e7eb)",
                fontSize: 11,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie
              data={ownerData}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={75}
              paddingAngle={2}
            >
              {ownerData.map((_, idx) => (
                <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
