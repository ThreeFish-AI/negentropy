"use client";

/**
 * 通用「边缘竖排标签轨道」（Reuse-Driven）。
 *
 * 抽象自 Knowledge Graph 页的 PanelRail：在容器边缘竖排各模块标题，点击切换其抽屉/面板。
 * 本组件仅负责按钮列与激活视觉（vertical-rl 竖排文字 + 激活态蓝色描边 + chevron 旋转），
 * **定位由调用方包裹层负责**（如 fixed 贴视口右缘 / flex 兄弟列）。泛型 key 不绑定具体业务枚举。
 *
 * 相较原 PanelRail 的增强：补 focus-visible 焦点环、min-h ≥ 44px 触达，满足无障碍基线。
 */

import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EdgePanelDef<K extends string = string> {
  key: K;
  label: string;
  /** 默认 true；设为 false 则不渲染该标签。 */
  visible?: boolean;
}

interface EdgePanelRailProps<K extends string = string> {
  panels: EdgePanelDef<K>[];
  /** 当前展开的面板 key；null 表示全部关闭。 */
  openKey: K | null;
  onToggle: (key: K) => void;
  className?: string;
  ariaLabel?: string;
}

export function EdgePanelRail<K extends string = string>({
  panels,
  openKey,
  onToggle,
  className,
  ariaLabel = "面板切换",
}: EdgePanelRailProps<K>) {
  const visiblePanels = panels.filter((p) => p.visible !== false);
  if (visiblePanels.length === 0) return null;

  return (
    <nav className={cn("flex flex-col items-stretch gap-1", className)} aria-label={ariaLabel}>
      {visiblePanels.map((panel) => {
        const isActive = openKey === panel.key;
        return (
          <button
            key={panel.key}
            type="button"
            onClick={() => onToggle(panel.key)}
            aria-label={isActive ? `关闭${panel.label}` : `打开${panel.label}`}
            aria-expanded={isActive}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center rounded-l-md border border-r-0 px-0 py-2 text-caption tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              isActive
                ? "border-l-2 border-l-blue-500 border-border bg-blue-50 font-medium text-blue-600 dark:border-l-blue-400 dark:bg-blue-950/30 dark:text-blue-400"
                : "border-border bg-card text-text-muted hover:bg-muted hover:text-foreground",
            )}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            <span>{panel.label}</span>
            <ChevronLeft
              className={cn(
                "mt-1 h-2.5 w-2.5 flex-shrink-0 transition-transform",
                isActive ? "rotate-180" : "",
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
