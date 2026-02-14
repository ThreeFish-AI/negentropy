"use strict";

import { SourceGroup } from "./ContentExplorer";

interface SourceListProps {
  groups: SourceGroup[];
  selectedUri: string | null | undefined;
  onSelect: (uri: string | null | undefined) => void;
}

export function SourceList({ groups, selectedUri, onSelect }: SourceListProps) {
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

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
      {groups.length > 0 && (
        <div className="my-1.5 border-t border-border" />
      )}

      {/* 具体 Source 列表 */}
      {groups.map((group) => {
        const displayUri = group.sourceUri || "(无来源)";
        const key = group.sourceUri ?? "__no_source__";
        return (
          <button
            key={key}
            className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
              selectedUri === group.sourceUri
                ? "bg-foreground text-background shadow-sm"
                : "text-muted hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => onSelect(group.sourceUri)}
            title={displayUri}
          >
            <span className="block truncate">{displayUri}</span>
            <span className="text-[10px] opacity-70">
              {group.items.length} chunk{group.items.length > 1 ? "s" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
