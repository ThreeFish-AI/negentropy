"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type ColorScheme = "light" | "dark" | "system";

const COLOR_SCHEME_KEY = "wiki:color-scheme";

function getStoredValue(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function subscribe(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === COLOR_SCHEME_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function subscribeSystemDark(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function ThemePreference() {
  const colorScheme = useSyncExternalStore(
    subscribe,
    () => getStoredValue(COLOR_SCHEME_KEY, "system") as ColorScheme,
    () => "system" as ColorScheme,
  );

  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );

  // 水合后据 localStorage 重新断言外观，兜底内联脚本/水合差异导致的 data-color-scheme 丢失。
  useEffect(() => {
    applyColorScheme(getStoredValue(COLOR_SCHEME_KEY, "system") as ColorScheme);
  }, []);

  const resolvedDark =
    colorScheme === "dark" || (colorScheme === "system" && systemDark);

  const handleToggle = useCallback(() => {
    const current = getStoredValue(COLOR_SCHEME_KEY, "system") as ColorScheme;
    const isDark = current === "dark" || (current === "system" && systemDark);
    const next: "light" | "dark" = isDark ? "light" : "dark";
    localStorage.setItem(COLOR_SCHEME_KEY, next);
    applyColorScheme(next);
    window.dispatchEvent(new StorageEvent("storage", { key: COLOR_SCHEME_KEY }));
  }, [systemDark]);

  return (
    <button
      onClick={handleToggle}
      className="wiki-header-action-btn"
      aria-label={resolvedDark ? "切换浅色模式" : "切换深色模式"}
    >
      {resolvedDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  );
}

function applyColorScheme(cs: ColorScheme) {
  const el = document.documentElement;
  if (cs === "system") {
    el.removeAttribute("data-color-scheme");
  } else {
    el.setAttribute("data-color-scheme", cs);
  }
}

export function initThemeFromStorage() {
  const cs = localStorage.getItem(COLOR_SCHEME_KEY) as ColorScheme | null;
  if (cs && cs !== "system") {
    document.documentElement.setAttribute("data-color-scheme", cs);
  }
}
