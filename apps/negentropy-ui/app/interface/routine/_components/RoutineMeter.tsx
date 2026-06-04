"use client";

/**
 * 通用细进度条 —— 标签 + 右侧读数 + 填充条（可选阈值刻痕）。
 * 复用于 Fleet 卡片（迭代/成本）与 Run 守卫面板（迭代/成本/成功分/截止）。
 */
export function RoutineMeter({
  label,
  valueText,
  ratio,
  fillClass,
  /** 阈值刻痕位置（0-100），如成功阈值线。 */
  notchPct,
  /** 自定义右侧内容（替代 valueText 文本）。 */
  rightElement,
  className,
}: {
  label: string;
  valueText: string;
  ratio: number | null;
  fillClass: string;
  notchPct?: number;
  rightElement?: React.ReactNode;
  className?: string;
}) {
  const pct = ratio == null ? 0 : Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-[10px] text-text-muted">
        <span>{label}</span>
        {rightElement ?? <span className="tabular-nums text-text-secondary">{valueText}</span>}
      </div>
      <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${fillClass} transition-[width] duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
        {notchPct != null && (
          <div
            className="absolute top-0 h-full w-px bg-foreground/40"
            style={{ left: `${Math.min(100, Math.max(0, notchPct))}%` }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
