"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

import type { ExecStatus, IterationStatus, RoutineIterationDTO, Verdict } from "@/features/routine";

import { useClock } from "./ClockProvider";
import { NULL_HEX, VERDICT_HEX } from "./chart-colors";
import { formatDuration } from "./routine-format";
import { ACTIVE_TIMING } from "./routine-loop";

interface GanttRow {
  label: string;
  seq: number;
  offset: number; // 距 run 起点的秒数（透明占位）
  dur: number; // 执行区间秒数（可见）
  status: IterationStatus;
  verdict: Verdict | null;
  exec_status: ExecStatus | null;
  cost: number;
  turns: number;
  inFlight: boolean;
}

function barColor(row: GanttRow): string {
  if (row.exec_status === "error" || row.exec_status === "timeout") return "#ef4444";
  if (row.inFlight) return "#0ea5e9";
  if (row.verdict) return VERDICT_HEX[row.verdict];
  return NULL_HEX;
}

interface TooltipPayloadItem {
  payload?: GanttRow;
}

function GanttTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  // dur 系列在前，取其 payload。
  const row = payload?.find((p) => p.payload)?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-semibold text-foreground">
        迭代 #{row.seq} · {row.status}
        {row.inFlight && " · 进行中"}
      </div>
      <div className="text-text-secondary">用时: {formatDuration(row.dur * 1000)}</div>
      {row.verdict && <div className="text-text-secondary">verdict: {row.verdict}</div>}
      {row.exec_status && <div className="text-text-muted">exec: {row.exec_status}</div>}
      <div className="text-text-muted">
        {row.turns} turns · ${row.cost.toFixed(4)}
      </div>
    </div>
  );
}

/**
 * 迭代甘特时间线 —— 一行一迭代，共享 run 时钟。
 *
 * 诚实时间编码：bar 跨度 = ``[started_at, finished_at]`` = **执行段**（finished_at 设于写回，
 * 评估阶段后端不记时间戳，故评估不占时长）；在途迭代延伸至 now（随时钟动）。
 * 颜色：error/timeout 红、在途蓝、否则按 verdict。
 */
export function RoutineRunGantt({ iterations }: { iterations: RoutineIterationDTO[] }) {
  const now = useClock();

  const rows = useMemo<GanttRow[]>(() => {
    const started = [...iterations]
      .filter((it) => it.started_at)
      .sort((a, b) => a.seq - b.seq);
    if (started.length === 0) return [];
    const starts = started.map((it) => Date.parse(it.started_at as string)).filter((n) => !Number.isNaN(n));
    const runStart = Math.min(...starts);
    return started.map((it) => {
      const start = Date.parse(it.started_at as string);
      const inFlight = !it.finished_at && ACTIVE_TIMING.has(it.status);
      const end = it.finished_at ? Date.parse(it.finished_at) : now;
      const safeStart = Number.isNaN(start) ? runStart : start;
      return {
        label: `#${it.seq}`,
        seq: it.seq,
        offset: Math.max(0, (safeStart - runStart) / 1000),
        dur: Math.max(0.1, (Math.max(end, safeStart) - safeStart) / 1000),
        status: it.status,
        verdict: it.verdict,
        exec_status: it.exec_status,
        cost: it.cost_usd,
        turns: it.turn_count,
        inFlight,
      };
    });
  }, [iterations, now]);

  return (
    <CollapsibleSection title="迭代时间线 · Run Timeline（执行区间）">
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-secondary">尚无可视化的执行区间</p>
      ) : (
        <div style={{ height: Math.max(120, rows.length * 30 + 36), minWidth: 1 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap={6}>
              <XAxis
                type="number"
                stroke="currentColor"
                fontSize={12}
                tickFormatter={(v: number) => formatDuration(v * 1000)}
              />
              <YAxis type="category" dataKey="label" width={40} stroke="currentColor" fontSize={12} />
              <Tooltip content={<GanttTooltip />} cursor={{ fill: "var(--color-muted, #f4f4f5)", opacity: 0.4 }} />
              {/* 透明占位：run 起点 → 本迭代起点 */}
              <Bar dataKey="offset" stackId="t" fill="transparent" isAnimationActive={false} />
              {/* 可见执行区间 */}
              <Bar dataKey="dur" stackId="t" radius={[2, 2, 2, 2]} isAnimationActive={false}>
                {rows.map((row) => (
                  <Cell key={row.seq} fill={barColor(row)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CollapsibleSection>
  );
}
