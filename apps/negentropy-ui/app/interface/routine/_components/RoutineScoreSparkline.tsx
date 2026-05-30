"use client";

interface RoutineScoreSparklineProps {
  /** 按 seq 升序的评分序列（null 表示尚未评估，跳过）。 */
  scores: (number | null)[];
  threshold?: number;
  width?: number;
  height?: number;
}

/**
 * 评分趋势 SVG 折线图。X 轴 = 迭代序号，Y 轴 = 0-100。虚线标注成功阈值。
 */
export function RoutineScoreSparkline({
  scores,
  threshold = 85,
  width = 220,
  height = 48,
}: RoutineScoreSparklineProps) {
  const pts = scores
    .map((s, i) => ({ s, i }))
    .filter((p): p is { s: number; i: number } => p.s != null);

  if (pts.length === 0) {
    return <div className="text-[10px] text-text-muted">尚无评分数据</div>;
  }

  const pad = 4;
  const n = scores.length;
  const xOf = (i: number) => (n <= 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (n - 1));
  const yOf = (s: number) => height - pad - (s / 100) * (height - 2 * pad);

  const path = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${xOf(p.i).toFixed(1)},${yOf(p.s).toFixed(1)}`).join(" ");
  const thresholdY = yOf(threshold);

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="score trajectory">
      {/* 阈值线 */}
      <line
        x1={pad}
        y1={thresholdY}
        x2={width - pad}
        y2={thresholdY}
        className="stroke-emerald-500/40"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {/* 折线 */}
      <path d={path} fill="none" className="stroke-sky-500" strokeWidth={1.5} strokeLinejoin="round" />
      {/* 数据点 */}
      {pts.map((p) => (
        <circle
          key={p.i}
          cx={xOf(p.i)}
          cy={yOf(p.s)}
          r={2}
          className={p.s >= threshold ? "fill-emerald-500" : "fill-sky-500"}
        />
      ))}
    </svg>
  );
}
