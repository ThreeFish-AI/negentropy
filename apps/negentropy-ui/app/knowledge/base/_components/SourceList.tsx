"use strict";

interface SourceListProps {
  sourceStats: Map<string | null, number>;
  selectedUri: string | null | undefined;
  onSelect: (uri: string | null | undefined) => void;
  onAddSource?: () => void;
  onReplaceSource?: (uri: string) => void;
}

export function SourceList({
  sourceStats,
  selectedUri,
  onSelect,
  onAddSource,
  onReplaceSource,
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
        return (
          <div key={key} className="flex items-center gap-1">
            <button
              className={`flex-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
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
            {/* 操作按钮 */}
            {onReplaceSource && uri && (
              <button
                onClick={() => onReplaceSource(uri)}
                className="shrink-0 rounded p-1 text-muted hover:bg-muted/50 hover:text-foreground"
                title="Replace source"
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
            )}
          </div>
        );
      })}
    </div>
  );
}
