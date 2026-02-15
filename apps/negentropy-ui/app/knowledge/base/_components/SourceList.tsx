"use client";

import { useState } from "react";

interface SourceListProps {
  sourceStats: Map<string | null, number>;
  selectedUri: string | null | undefined;
  onSelect: (uri: string | null | undefined) => void;
  onAddSource?: () => void;
  onReplaceSource?: (uri: string) => void;
  onSyncSource?: (uri: string) => void;
}

/**
 * 判断是否为 URL 类型的 Source
 * 只有 URL 类型的 Source 才支持 Sync 操作
 */
function isUrlSource(uri: string): boolean {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

export function SourceList({
  sourceStats,
  selectedUri,
  onSelect,
  onAddSource,
  onReplaceSource,
  onSyncSource,
}: SourceListProps) {
  const totalCount = Array.from(sourceStats.values()).reduce((sum, c) => sum + c, 0);

  // 转换为数组并排序
  const sortedSources = Array.from(sourceStats.entries())
    .map(([uri, count]) => ({ uri, count }))
    .sort((a, b) => {
      if (a.uri === null) return 1;
      if (b.uri === null) return -1;
      return a.uri.localeCompare(b.uri);
    });

  return (
    <div className="space-y-1">
      {/* All Sources 选项 */}
      <button
        className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
          selectedUri === undefined
            ? "bg-foreground text-background shadow-sm"
            : "text-muted hover:bg-muted/50 hover:text-foreground"
        }`}
        onClick={() => onSelect(undefined)}
      >
        <span className="font-medium">All Sources</span>
        <span className="ml-1.5 text-[10px] opacity-70">({totalCount})</span>
      </button>

      {/* Add Source 按钮 */}
      {onAddSource && (
        <button
          onClick={onAddSource}
          className="w-full rounded-lg border border-dashed border-border px-2 py-1.5 text-xs text-muted hover:border-foreground hover:text-foreground"
        >
          + Add Source
        </button>
      )}

      {/* 分隔线 */}
      {sortedSources.length > 0 && (
        <div className="my-1.5 border-t border-border" />
      )}

      {/* 具体 Source 列表 */}
      {sortedSources.map(({ uri, count }) => {
        const displayUri = uri || "(无来源)";
        const key = uri ?? "__no_source__";
        const showMenu = uri && (onReplaceSource || onSyncSource);
        const isUrl = uri ? isUrlSource(uri) : false;

        return (
          <div key={key} className="flex min-w-0 items-center gap-1">
            <button
              className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                selectedUri === uri
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted hover:bg-muted/50 hover:text-foreground"
              }`}
              onClick={() => onSelect(uri)}
              title={displayUri}
            >
              <span className="block truncate">{displayUri}</span>
              <span className="text-[10px] opacity-70">
                {count} chunk{count > 1 ? "s" : ""}
              </span>
            </button>
            {/* 操作菜单 */}
            {showMenu && (
              <SourceMenu
                uri={uri!}
                isUrl={isUrl}
                onReplace={onReplaceSource}
                onSync={onSyncSource}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Source 操作下拉菜单
 * 使用原生 CSS 实现，避免引入额外依赖
 */
function SourceMenu({
  uri,
  isUrl,
  onReplace,
  onSync,
}: {
  uri: string;
  isUrl: boolean;
  onReplace?: (uri: string) => void;
  onSync?: (uri: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReplace = () => {
    setIsOpen(false);
    onReplace?.(uri);
  };

  const handleSync = () => {
    setIsOpen(false);
    onSync?.(uri);
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded p-1 text-muted hover:bg-muted/50 hover:text-foreground"
        title="Source actions"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <>
          {/* 背景遮罩（点击关闭） */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          {/* 菜单内容 */}
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-border bg-card p-1 shadow-lg">
            {onReplace && (
              <button
                onClick={handleReplace}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-muted/50 hover:text-foreground"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Replace
              </button>
            )}
            {onSync && isUrl && (
              <button
                onClick={handleSync}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-muted/50 hover:text-foreground"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Sync
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
