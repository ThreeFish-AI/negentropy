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
            className={`flex flex-col items-center justify-center rounded-l-md border border-r-0 px-0 py-2 text-caption tracking-wide transition-colors ${
              isActive
                ? "border-l-2 border-l-blue-500 border-border bg-blue-50 font-medium text-blue-600 dark:border-l-blue-400 dark:bg-blue-950/30 dark:text-blue-400"
                : "border-border bg-card text-text-muted hover:bg-muted hover:text-foreground"
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
