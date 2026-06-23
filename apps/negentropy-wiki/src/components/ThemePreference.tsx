"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import {
  COLOR_SCHEME_KEY,
  applyColorScheme,
  getStoredColorScheme,
  type ColorScheme,
} from "@/lib/wiki-color-scheme";

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
  const pathname = usePathname();

  const colorScheme = useSyncExternalStore(
    subscribe,
    () => getStoredColorScheme(),
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
  // 首页由 HomePageThemeGuard 强制暗色管控：此处须跳过，避免把外观还原成 localStorage 偏好
  // （否则会覆盖 guard 在 paint 前钉定的 dark）。
  useEffect(() => {
    if (pathname === "/" || pathname === "") return;
    applyColorScheme(getStoredColorScheme());
  }, [pathname]);

  const resolvedDark =
    colorScheme === "dark" || (colorScheme === "system" && systemDark);

  const handleToggle = useCallback(() => {
    const current = getStoredColorScheme();
    const isDark = current === "dark" || (current === "system" && systemDark);
    const next: "light" | "dark" = isDark ? "light" : "dark";
    localStorage.setItem(COLOR_SCHEME_KEY, next);
    applyColorScheme(next);
    window.dispatchEvent(new StorageEvent("storage", { key: COLOR_SCHEME_KEY }));
  }, [systemDark]);

  // 首页强制暗色：隐藏切换按钮（不允许切回浅色）。
  // 注意须在所有 hooks 调用之后再 early return，保证 hooks 调用顺序恒定。
  // graph 页等 pathname≠"/" 不受影响，按钮照常渲染。
  if (pathname === "/" || pathname === "") return null;

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
