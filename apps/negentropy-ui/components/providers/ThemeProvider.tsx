"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

/**
 * ThemeProvider
 *
 * 包装 next-themes 的 ThemeProvider，用于管理应用主题。
 * 支持:
 * - 系统主题跟随
 * - 手动切换亮/暗主题
 * - 本地存储持久化
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
