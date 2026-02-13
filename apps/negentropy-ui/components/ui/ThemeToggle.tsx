"use client";

import { useTheme } from "next-themes";

/**
 * ThemeToggle
 *
 * 主题切换组件，支持亮色/暗色/系统三种模式切换。
 * 遵循 WCAG 2.1 AA 标准，提供清晰的视觉反馈。
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    // 业界通用模式：基于当前视觉状态进行反向切换，确保每次点击都有视觉反馈。
    // 这解决了 3 态轮询（Dark -> System -> Light）中 System 与某一方视觉一致导致“点击无效”的问题。
    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const getIcon = () => {
    if (resolvedTheme === "dark") {
      return (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          suppressHydrationWarning
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            suppressHydrationWarning
          />
        </svg>
      );
    }
    return (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        suppressHydrationWarning
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          suppressHydrationWarning
        />
      </svg>
    );
  };

  const getLabel = () => {
    if (theme === "system") return "跟随系统";
    if (theme === "dark") return "暗色模式";
    return "亮色模式";
  };

  return (
    <button
      onClick={cycleTheme}
      className="rounded-lg p-2 text-muted hover:bg-muted/20 hover:text-foreground"
      aria-label={`当前: ${getLabel()}，点击切换`}
      title={getLabel()}
      suppressHydrationWarning
    >
      {getIcon()}
    </button>
  );
}
