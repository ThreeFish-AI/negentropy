"use client";

import { WikiPublication } from "@/features/knowledge";
import { WikiStatusBadge } from "./WikiStatusBadge";

interface WikiPublicationListProps {
  publications: WikiPublication[];
  selectedId: string | null;
  onSelect: (pub: WikiPublication) => void;
  loading: boolean;
}

export function WikiPublicationList({
  publications,
  selectedId,
  onSelect,
  loading,
}: WikiPublicationListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted">加载中...</p>
      </div>
    );
  }

  if (publications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted">暂无发布记录</p>
        <p className="text-xs text-muted/60 mt-1">点击上方「新建发布」创建</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border">
      {publications.map((pub) => {
        const active = selectedId === pub.id;
        return (
          <button
            key={pub.id}
            onClick={() => onSelect(pub)}
            className={`w-full text-left px-3 py-2.5 transition-colors ${
              active
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted/30 text-foreground"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">
                    {pub.name}
                  </span>
                  <WikiStatusBadge status={pub.status} />
                </div>
                <div className="text-[11px] text-muted truncate">
                  /{pub.slug} · v{pub.version} · {pub.entries_count} 个条目
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
