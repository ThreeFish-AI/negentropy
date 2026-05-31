"use client";

import { Button } from "@/components/ui/Button";
import type { RoutinePresetSummary } from "@/features/routine";
import { APPROVAL_BADGE } from "./preset-style";

interface PresetCardProps {
  preset: RoutinePresetSummary;
  /** 点击「使用模板」CTA：上抛选中的预设，由父组件打开创建对话框。 */
  onUse: (preset: RoutinePresetSummary) => void;
}

/**
 * Routine 预设模版卡片（展示型）。
 *
 * 设计：
 * - 网格单元内 `h-full flex flex-col` 保证同行等高；CTA 以 `mt-auto` 钉底对齐；
 * - 容器为 `div`，仅底部 CTA 为可聚焦交互元素（不把整卡设为可点击，避免交互元素嵌套）。
 */
export function PresetCard({ preset, onUse }: PresetCardProps) {
  const badge = APPROVAL_BADGE[preset.approval_mode];
  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-card p-4 transition-colors hover:border-foreground/15">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{preset.display_name}</h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
          v{preset.version}
        </span>
        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-micro text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
          {preset.category}
        </span>
        {badge && (
          <span className={`rounded-full px-1.5 py-0.5 text-micro ${badge.cls}`}>{badge.label}</span>
        )}
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
          Gate: {preset.has_verification_command ? "✓" : "✗"}
        </span>
      </div>

      <p className="mt-2 text-xs text-text-muted line-clamp-3">{preset.description}</p>

      {preset.features_showcase.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {preset.features_showcase.map((f, i) => (
            <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-3">
        <Button variant="neutral" size="sm" fullWidth onClick={() => onUse(preset)}>
          使用模板
        </Button>
      </div>
    </div>
  );
}
