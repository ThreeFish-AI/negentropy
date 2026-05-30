"use client";

/**
 * BuildButton — 工具栏紧凑型「构建图谱」按钮。
 *
 * 与 BuildPanel 的职责分工（AGENTS.md「正交分解」）：
 *   - BuildPanel：完整版面，含「请先选择语料库」文案 + 错误段落，仍服务于
 *     d3 渲染器「暂无图谱数据」空态分支。
 *   - BuildButton：仅一个按钮 + 红点错误指示，嵌入工具栏右侧，与
 *     CorpusSelector / 引擎选择器同基线。
 */

import { outlineButtonClassName } from "@/components/ui/button-styles";

interface BuildButtonProps {
  building: boolean;
  corpusId: string | null;
  lastBuildError: string | null;
  onBuild: () => void;
}

export function BuildButton({
  building,
  corpusId,
  lastBuildError,
  onBuild,
}: BuildButtonProps) {
  const title = !corpusId
    ? "请先选择语料库"
    : building
      ? "构建中..."
      : lastBuildError
        ? `上次构建失败：${lastBuildError}`
        : "构建图谱";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onBuild}
        disabled={!corpusId || building}
        title={title}
        aria-label="构建图谱"
        className={outlineButtonClassName(
          "neutral",
          "rounded-lg px-3 py-1 text-xs font-medium",
        )}
      >
        {building ? "构建中..." : "构建图谱"}
      </button>
      {lastBuildError && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-card"
        />
      )}
    </div>
  );
}
