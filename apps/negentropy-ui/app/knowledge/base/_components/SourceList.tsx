"use strict";

interface SourceListProps {
  sourceStats: Map<string | null, number>;
  selectedUri: string | null | undefined;
  onSelect: (uri: string | null | undefined) => void;
}

export function SourceList({ sourceStats, selectedUri, onSelect }: SourceListProps) {
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

      {/* 分隔线 */}
      {sortedSources.length > 0 && (
        <div className="my-1.5 border-t border-border" />
      )}

      {/* 具体 Source 列表 */}
      {sortedSources.map(({ uri, count }) => {
        const displayUri = uri || "(无来源)";
        const key = uri ?? "__no_source__";
        return (
          <button
            key={key}
            className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
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
        );
      })}
    </div>
  );
}
