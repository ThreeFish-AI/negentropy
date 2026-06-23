/**
 * Wiki 颜色方案（明 / 暗）响应式订阅模块 —— 主题响应式的单一事实源。
 *
 * 背景：`ThemePreference` 组件在用户切换主题时执行三件事（见该组件 handleToggle）：
 *   1. 写入 `localStorage[COLOR_SCHEME_KEY]`；
 *   2. 翻转 `<html data-color-scheme>` 属性（`detectDark()` 的读取源）；
 *   3. `window.dispatchEvent(new StorageEvent("storage", { key: COLOR_SCHEME_KEY }))`
 *      —— 这一同窗派发的 storage 事件，是「主题已变更」在 React 侧的广播信号。
 *
 * 五个知识图谱渲染器此前都在挂载时一次性读取 `detectDark()` 后缓存，无人订阅上述
 * 信号，故主题切换不会重绘（只有切换引擎触发 remount 才被动刷新）。本模块把
 * 「订阅同一信号 → 派生响应式 isDark」收敛为唯一来源，供渲染器复用。
 *
 * 设计契约与 `ThemePreference` 完全一致：同一 `COLOR_SCHEME_KEY`、同一 `matchMedia`
 * （覆盖 system 模式下系统主题变化）。
 */

import { useSyncExternalStore } from "react";

import { detectDark } from "./wiki-graph-visual";

/** 主题偏好在 localStorage 中的键名（与 ThemePreference、layout.tsx 内联脚本一致） */
export const COLOR_SCHEME_KEY = "wiki:color-scheme";

/**
 * 订阅主题变更：同窗 storage 事件（ThemePreference 切换时派发）+ 系统主题偏好变化
 * （覆盖 system 模式）。返回清理函数。SSR 环境下为 no-op。
 */
function subscribeColorScheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === COLOR_SCHEME_KEY) onChange();
  };
  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  window.addEventListener("storage", onStorage);
  mq.addEventListener("change", onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    mq.removeEventListener("change", onChange);
  };
}

/**
 * 响应式暗色态：主题切换时同步更新，供图谱渲染器就地适配文字 / 边配色。
 *
 * 以 `detectDark()` 作为客户端快照（返回稳定 boolean，无 tearing / 重渲染循环风险）；
 * 服务端快照恒为 `false`（渲染器均 `ssr:false`，此处仅为 useSyncExternalStore 契约兜底）。
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeColorScheme,
    () => detectDark(),
    () => false,
  );
}

/** 颜色方案字面量（与 localStorage 存储值一致）。 */
export type ColorScheme = "light" | "dark" | "system";

/**
 * 读取 localStorage 中的主题偏好，缺失 / 异常（隐私模式等）回退 `"system"`。
 * SSR 安全：服务端 / SSG 预渲染阶段无 `window`，恒返回 `"system"`。
 */
export function getStoredColorScheme(): ColorScheme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(COLOR_SCHEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

/**
 * 把颜色方案应用到 `<html data-color-scheme>`（仅改 DOM，不写 localStorage）。
 *
 * - `"system"`：移除属性，交由 CSS `@media (prefers-color-scheme)` 跟随系统；
 * - `"light"` / `"dark"`：显式设属性，覆盖系统偏好。
 *
 * 该属性是主题的单一事实源：`detectDark()`、`useIsDark()`、Galaxy 画布与各图谱
 * 渲染器均读取它，故只需翻转此属性即可让全站暗色感知同步。
 */
export function applyColorScheme(cs: ColorScheme): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (cs === "system") el.removeAttribute("data-color-scheme");
  else el.setAttribute("data-color-scheme", cs);
}
