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
