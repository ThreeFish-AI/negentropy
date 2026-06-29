"use client";

import { useTheme } from "next-themes";

import { IterationEventTimeline } from "../interface/routine/_components/IterationEventTimeline";
import { humanLoopEvents, previewEvents, runningEvents } from "./fixture";

/**
 * Transcript 视觉验证预览（dev-only）。
 *
 * 以固定 fixture 渲染真实的 {@link IterationEventTimeline}，约束宽度近似抽屉中栏，
 * 供浏览器实机 A/B 比对 paseo hero。生产路由默认 404（见 page.tsx）。
 */
export function TimelinePreview() {
  const { setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-[760px] p-6">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-h4 font-bold text-foreground">Transcript Preview</h1>
        <span className="text-caption text-text-muted">（dev-only · paseo 风格转录流）</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setTheme("light")}
          className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-muted/40"
        >
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-muted/40"
        >
          Dark
        </button>
      </div>

      <div data-testid="transcript-preview" className="rounded-card border border-border bg-card p-4">
        <IterationEventTimeline events={previewEvents} />
      </div>

      <h2 className="mb-2 mt-6 text-body-lg font-semibold text-foreground">
        人机交互回合（6 Agent ↔ Claude Code）
      </h2>
      <div data-testid="transcript-preview-human-loop" className="rounded-card border border-border bg-card p-4">
        <IterationEventTimeline events={humanLoopEvents} />
      </div>

      <h2 className="mb-2 mt-6 text-body-lg font-semibold text-foreground">在途态（LIVE / 运行中）</h2>
      <div data-testid="transcript-preview-live" className="rounded-card border border-border bg-card p-4">
        <IterationEventTimeline events={runningEvents} live />
      </div>
    </div>
  );
}
