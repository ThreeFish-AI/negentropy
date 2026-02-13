import { useState, useRef, useEffect } from "react";
import { CorpusRecord } from "@/features/knowledge";

interface CorpusListProps {
  corpora: CorpusRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (corpus: CorpusRecord) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

export function CorpusList({
  corpora,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  isLoading,
}: CorpusListProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (
    e: React.MouseEvent,
    action: "edit" | "delete",
    corpus: CorpusRecord,
  ) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (action === "edit") {
      onEdit(corpus);
    } else {
      if (confirm(`确定要删除 "${corpus.name}" 吗？此操作无法撤销。`)) {
        onDelete(corpus.id);
      }
    }
  };

  if (isLoading && corpora.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  if (corpora.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        No corpora found
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {corpora.map((corpus) => (
        <div
          key={corpus.id}
          className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
            selectedId === corpus.id
              ? "bg-foreground text-background shadow-md font-medium"
              : "text-muted hover:bg-muted/50 hover:text-foreground"
          }`}
          onClick={() => onSelect(corpus.id)}
        >
          <div className="flex-1 truncate">
            <span className="font-medium">{corpus.name}</span>
            <span
              className={`ml-2 text-xs ${
                selectedId === corpus.id
                  ? "text-background/70"
                  : "text-muted/70"
              }`}
            >
              {corpus.knowledge_count} items
            </span>
          </div>

          <button
            className={`invisible p-1 opacity-0 group-hover:visible group-hover:opacity-100 ${
              selectedId === corpus.id
                ? "visible opacity-100 text-background/80 hover:text-background"
                : "text-muted hover:text-foreground"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === corpus.id ? null : corpus.id);
            }}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          {menuOpenId === corpus.id && (
            <div
              ref={menuRef}
              className="absolute right-0 top-8 z-10 w-32 origin-top-right rounded-md bg-popover py-1 shadow-lg ring-1 ring-border focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="block w-full px-4 py-2 text-left text-xs text-popover-foreground hover:bg-muted-foreground/10"
                onClick={(e) => handleAction(e, "edit", corpus)}
              >
                编辑配置
              </button>
              <button
                className="block w-full px-4 py-2 text-left text-xs text-error hover:bg-error/10"
                onClick={(e) => handleAction(e, "delete", corpus)}
              >
                删除数据源
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
