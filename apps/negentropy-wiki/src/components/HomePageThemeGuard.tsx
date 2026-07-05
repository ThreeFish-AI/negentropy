"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { applyColorScheme, getStoredColorScheme } from "@/lib/wiki-color-scheme";

/**
 * 同构 effect：客户端取 `useLayoutEffect`（commit 后、paint 前同步执行，客户端导航
 * 切换主题零闪烁）；SSR / SSG 预渲染取 `useEffect`（规避 `useLayoutEffect` 在无
 * `window` 环境下的服务端告警）。模块加载时按 `typeof window` 一次性锁定，客户端
 * bundle 恒为 `useLayoutEffect`，含水合首帧亦在 paint 前生效。
 */
const useIsoMorphicEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** 站点首页判定（`trailingSlash: true` 下 `usePathname()` 返回 `"/"`，`""` 为防御兜底）。 */
function isHomePath(pathname: string | null): boolean {
  return pathname === "/" || pathname === "";
}

/**
 * 首页强制暗色外观的站点级守卫。
 *
 * 挂在根 `layout.tsx`，跨所有路由持久存在，覆盖「客户端导航」时序窗口（首屏硬刷新
 * 由 `layout.tsx` 的 FOUC 防闪脚本兜底）。核心不变量：**仅覆写 DOM 外观，绝不写
 * localStorage**——首页强制暗色是临时外观覆写，不污染用户偏好；离开首页时从
 * localStorage 重新 apply 偏好，自然恢复。
 *
 * - 首页（`pathname === "/"`）：钉 `<html data-color-scheme="dark">`；
 * - 非首页：apply 用户 localStorage 偏好（`"system"` → 移除属性，跟随系统）。
 *
 * 注意：`WikiLayoutShell` 的 `variant="home"` 不等于站点首页（图谱页亦用之），
 * 故判定一律基于路由 `pathname`，与布局变体解耦。
 */
export function HomePageThemeGuard() {
  const pathname = usePathname();

  useIsoMorphicEffect(() => {
    if (typeof window === "undefined") return;
    if (isHomePath(pathname)) {
      applyColorScheme("dark");
    } else {
      applyColorScheme(getStoredColorScheme());
    }
  }, [pathname]);

  return null;
}
