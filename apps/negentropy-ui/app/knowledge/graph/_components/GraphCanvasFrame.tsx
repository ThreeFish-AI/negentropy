"use client";

/**
 * GraphCanvasFrame — 五大图谱渲染器共享的画布外框。
 *
 * 设计意图：
 *   - 收敛 Cytoscape / d3-force / 3D / Sigma / Force Graph 此前各自复制的
 *     `relative min-h-0 flex-1 w-full rounded-2xl border ...` 外壳，确保
 *     视觉契约的单一事实源（AGENTS.md「单一事实源」）。
 *   - 统一提供右上角浮层：stats 徽标 + 调用方传入的次要徽标（truncated /
 *     expanding 等）+ 全屏切换按钮。
 *   - 全屏使用浏览器原生 Fullscreen API：以外框元素自身作为目标，确保
 *     stats 与按钮在全屏期间仍可见；并通过 `data-fullscreen` 自定义属性
 *     + Tailwind `data-[fullscreen=true]:*` 修正全屏元素默认黑底问题。
 *   - Safari 兼容：fallback 调用 `webkitRequestFullscreen` /
 *     `webkitExitFullscreen`。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface GraphCanvasFrameStats {
  nodes: number;
  edges: number;
  /** 渲染器后缀，例如 "WebGL" / "Canvas" / "SVG"，便于用户辨识当前引擎 */
  suffix?: string;
}

export interface GraphCanvasFrameProps {
  stats?: GraphCanvasFrameStats;
  /** truncated / expanding 等次要徽标，渲染于 stats 与全屏按钮之间 */
  badges?: ReactNode;
  /** 渲染器 DOM（容器 div / ForceGraph3D / etc.） */
  children: ReactNode;
  /** 扩展类名（追加到基础样式） */
  className?: string;
}

interface FullscreenCapableElement extends HTMLDivElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenCapableDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenCapableDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function GraphCanvasFrame({
  stats,
  badges,
  children,
  className,
}: GraphCanvasFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFs(getFullscreenElement() === frameRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = frameRef.current as FullscreenCapableElement | null;
    if (!el) return;
    const current = getFullscreenElement();
    // requestFullscreen / exitFullscreen 返回 Promise，可能因以下原因 reject：
    //   - 用户拒绝浏览器权限弹窗
    //   - 页面位于无 `allow="fullscreen"` 的跨域 iframe
    //   - 已有其它元素占据全屏（DOM 状态竞争）
    //   - Safari `webkitRequestFullscreen` 在部分上下文返回非 Promise 或异常
    // 不捕获就会冒泡为 unhandled promise rejection，污染控制台。
    // 这里降级为 console.warn（保留可观测性但不打断用户交互）。
    try {
      if (current === el) {
        const doc = document as FullscreenCapableDocument;
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } else {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn("graph_canvas_fullscreen_toggle_failed", err);
    }
  }, []);

  const baseClass =
    "relative min-h-0 flex-1 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 data-[fullscreen=true]:bg-white data-[fullscreen=true]:dark:bg-zinc-900";

  return (
    <div
      ref={frameRef}
      data-fullscreen={isFs ? "true" : "false"}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      {children}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1 text-[10px]">
        {stats && (
          <span className="rounded bg-zinc-900/70 px-2 py-1 text-white">
            {stats.nodes} 节点 · {stats.edges} 边
            {stats.suffix ? ` · ${stats.suffix}` : ""}
          </span>
        )}
        {badges}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFs ? "退出全屏" : "进入全屏"}
          title={isFs ? "退出全屏" : "进入全屏"}
          className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded bg-zinc-900/70 text-white hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        >
          {isFs ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
