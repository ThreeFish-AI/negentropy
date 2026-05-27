"use client";

import { ChevronLeft } from "lucide-react";
import type { PanelKey } from "./usePanelState";

export interface PanelDef {
  key: PanelKey;
  label: string;
  visible: boolean;
}

interface PanelRailProps {
  panels: PanelDef[];
  openPanel: PanelKey | null;
  onToggle: (key: PanelKey) => void;
}

export function PanelRail({ panels, openPanel, onToggle }: PanelRailProps) {
  const visiblePanels = panels.filter((p) => p.visible);

  return (
    <nav
      className="flex flex-shrink-0 flex-col items-stretch gap-1 self-start pt-2"
      aria-label="面板切换"
    >
      {visiblePanels.map((panel) => {
        const isActive = openPanel === panel.key;
        return (
          <button
            key={panel.key}
            type="button"
            onClick={() => onToggle(panel.key)}
            aria-label={isActive ? `关闭${panel.label}` : `打开${panel.label}`}
            aria-expanded={isActive}
            className={`flex flex-col items-center justify-center rounded-l-md border border-r-0 px-0 py-2 text-[11px] tracking-wide transition-colors ${
              isActive
                ? "border-l-2 border-l-blue-500 border-zinc-200 bg-blue-50 font-medium text-blue-600 dark:border-l-blue-400 dark:border-zinc-800 dark:bg-blue-950/30 dark:text-blue-400"
                : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            }`}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          >
            <span>{panel.label}</span>
            <ChevronLeft
              className={`mt-1 h-2.5 w-2.5 flex-shrink-0 transition-transform ${
                isActive ? "rotate-180" : ""
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
