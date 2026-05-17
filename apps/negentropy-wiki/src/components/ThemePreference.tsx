"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "default" | "book" | "docs";
type ColorScheme = "light" | "dark" | "system";

const THEME_KEY = "wiki:theme";
const COLOR_SCHEME_KEY = "wiki:color-scheme";

const THEMES: { value: Theme; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "book", label: "Book" },
  { value: "docs", label: "Docs" },
];

function getStoredValue(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function subscribe(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === COLOR_SCHEME_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function ThemePreference() {
  const [open, setOpen] = useState(false);

  const theme = useSyncExternalStore(
    subscribe,
    () => getStoredValue(THEME_KEY, "default") as Theme,
    () => "default" as Theme,
  );

  const colorScheme = useSyncExternalStore(
    subscribe,
    () => getStoredValue(COLOR_SCHEME_KEY, "system") as ColorScheme,
    () => "system" as ColorScheme,
  );

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(THEME_KEY, t);
    document.documentElement.setAttribute("data-theme", t);
    setOpen(false);
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
  }, []);

  const setColorScheme = useCallback((cs: ColorScheme) => {
    localStorage.setItem(COLOR_SCHEME_KEY, cs);
    applyColorScheme(cs);
    window.dispatchEvent(new StorageEvent("storage", { key: COLOR_SCHEME_KEY }));
  }, []);

  const resolvedDark =
    colorScheme === "dark" ||
    (colorScheme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="wiki-theme-pref" style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="wiki-theme-toggle"
        aria-label="主题设置"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          border: "1px solid var(--wiki-border)",
          borderRadius: 6,
          background: "transparent",
          color: "var(--wiki-text-secondary)",
          cursor: "pointer",
          transition: "background 0.12s ease, color 0.12s ease",
        }}
      >
        {resolvedDark ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      {open && (
        <div
          className="wiki-theme-dropdown"
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "var(--wiki-bg)",
            border: "1px solid var(--wiki-border)",
            borderRadius: "var(--wiki-radius)",
            boxShadow: "var(--wiki-shadow), 0 4px 16px rgba(0,0,0,0.08)",
            padding: "0.5rem 0",
            minWidth: 160,
            zIndex: 50,
          }}
        >
          <div style={{ padding: "0.35rem 0.75rem", fontSize: "0.72em", fontWeight: 600, color: "var(--wiki-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            主题
          </div>
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="menuitem"
              onClick={() => setTheme(t.value)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.4rem 0.75rem",
                fontSize: "0.88em",
                border: 0,
                background: theme === t.value ? "var(--wiki-bg-secondary)" : "transparent",
                color: theme === t.value ? "var(--wiki-accent)" : "var(--wiki-text)",
                fontWeight: theme === t.value ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--wiki-border)", margin: "0.35rem 0" }} />
          <div style={{ padding: "0.35rem 0.75rem", fontSize: "0.72em", fontWeight: 600, color: "var(--wiki-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            外观
          </div>
          {(["light", "dark", "system"] as ColorScheme[]).map((cs) => (
            <button
              key={cs}
              role="menuitem"
              onClick={() => setColorScheme(cs)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.4rem 0.75rem",
                fontSize: "0.88em",
                border: 0,
                background: colorScheme === cs ? "var(--wiki-bg-secondary)" : "transparent",
                color: colorScheme === cs ? "var(--wiki-accent)" : "var(--wiki-text)",
                fontWeight: colorScheme === cs ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {cs === "light" ? "浅色" : cs === "dark" ? "深色" : "跟随系统"}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const theme = localStorage.getItem(THEME_KEY);
  if (theme) document.documentElement.setAttribute("data-theme", theme);

  const cs = localStorage.getItem(COLOR_SCHEME_KEY) as ColorScheme | null;
  if (cs && cs !== "system") {
    document.documentElement.setAttribute("data-color-scheme", cs);
  }
}
