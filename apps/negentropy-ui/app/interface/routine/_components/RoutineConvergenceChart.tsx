"use client";

import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

import type { RoutineIterationDTO, Verdict } from "@/features/routine";

import { NULL_HEX, VERDICT_HEX } from "./chart-colors";

interface Row {
  seq: number;
  score: number | null;
  verdict: Verdict | null;
  cost: number;
}

interface TooltipPayloadItem {
  payload?: Row;
}

function ConvergenceTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-semibold text-foreground">迭代 #{row.seq}</div>
      <div className="text-text-secondary">score: {row.score ?? "—"}</div>
      {row.verdict && <div className="text-text-secondary">verdict: {row.verdict}</div>}
      <div className="text-text-muted">cost: ${row.cost.toFixed(4)}</div>
    </div>
  );
}

/**
 * 评分收敛趋势图 —— X=迭代序号，Y=评分(0-100)。
 * 阈值线 + 最佳分参考线；数据点按 verdict 着色，融合「是否改进」与「为何」。
 */
export function RoutineConvergenceChart({
  iterations,
  threshold,
  bestScore,
}: {
  iterations: RoutineIterationDTO[];
  threshold: number;
  bestScore: number | null;
}) {
  const data: Row[] = iterations.map((it) => ({
    seq: it.seq,
    score: it.score,
    verdict: it.verdict,
    cost: it.cost_usd,
  }));
  const hasScores = data.some((d) => d.score != null);

  return (
    <CollapsibleSection title="评分收敛趋势 · Convergence">
      {!hasScores ? (
        <p className="py-8 text-center text-sm text-text-secondary">尚无评分数据</p>
      ) : (
        <div className="h-56 min-h-[14rem] w-full" style={{ minWidth: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" strokeOpacity={0.2} />
              <XAxis
                dataKey="seq"
                type="number"
                domain={["dataMin", "dataMax"]}
                allowDecimals={false}
                stroke="currentColor"
                fontSize={12}
                tickFormatter={(v) => `#${v}`}
              />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="currentColor" fontSize={12} />
              <Tooltip content={<ConvergenceTooltip />} />
              <ReferenceLine
                y={threshold}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: `阈值 ${threshold}`, position: "right", fontSize: 12, fill: "#10b981" }}
              />
              {bestScore != null && (
                <ReferenceLine y={bestScore} stroke="#6366f1" strokeDasharray="2 4" strokeOpacity={0.6} />
              )}
              <Line
                type="monotone"
                dataKey="score"
                stroke="#0ea5e9"
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Scatter dataKey="score" isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.verdict ? VERDICT_HEX[d.verdict] : NULL_HEX} />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleSection>
  );
}
