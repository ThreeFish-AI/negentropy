"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PanelKey =
  | "model-config"
  | "global-search"
  | "evidence-chain"
  | "time-travel"
  | "graph-stats"
  | "build-history"
  | "path-explorer"
  | "neighbor-explorer"
  | "entity-detail";

const STORAGE_KEY = "kg.panels";
const LEGACY_KEY = "kg.sidebarOpen";

function readStoredPanel(): PanelKey | null {
  if (typeof window === "undefined") return null;
  window.localStorage.removeItem(LEGACY_KEY);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as { openPanel: PanelKey | null };
    return state.openPanel ?? null;
  } catch {
    return null;
  }
}

export function usePanelState() {
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(readStoredPanel);
  const hasHydrated = useRef(true); // useState initializer 同步读取，已 hydrate

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ openPanel }));
  }, [openPanel]);

  const toggle = useCallback(
    (key: PanelKey) => {
      setOpenPanel((prev) => (prev === key ? null : key));
    },
    [],
  );

  const close = useCallback(() => setOpenPanel(null), []);

  return { openPanel, toggle, close };
}
