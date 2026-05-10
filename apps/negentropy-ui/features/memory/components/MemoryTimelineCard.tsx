"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Hash,
  Heart,
  Search,
  Shield,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryItem } from "../utils/memory-api";

// ---------------------------------------------------------------------------
// Memory type → icon + accent colour mapping
// Aligned with memory-basics.md §2 decay-rate table
// ---------------------------------------------------------------------------

const MEMORY_TYPE_CONFIG: Record<
  string,
  { icon: typeof Shield; label: string; accent: string; bg: string }
> = {
  core: { icon: Shield, label: "Core", accent: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40" },
  semantic: { icon: BookOpen, label: "Semantic", accent: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  episodic: { icon: Clock, label: "Episodic", accent: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  procedural: { icon: Wrench, label: "Procedural", accent: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  preference: { icon: Heart, label: "Preference", accent: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100 dark:bg-pink-900/40" },
  fact: { icon: Hash, label: "Fact", accent: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-900/40" },
  search: { icon: Search, label: "Search Result", accent: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/40" },
};

const DEFAULT_TYPE_CONFIG = {
  icon: Hash,
  label: "Unknown",
  accent: "text-zinc-600 dark:text-zinc-400",
  bg: "bg-zinc-100 dark:bg-zinc-800/40",
};

// ---------------------------------------------------------------------------
// Score bar helpers
// ---------------------------------------------------------------------------

function retentionBarColor(score: number): string {
  if (score >= 0.5) return "bg-emerald-500";
  if (score >= 0.1) return "bg-amber-500";
  return "bg-rose-500";
}

function importanceBarColor(score: number): string {
  if (score >= 0.7) return "bg-blue-500";
  if (score >= 0.4) return "bg-cyan-500";
  return "bg-slate-400";
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatDate(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CONTENT_PREVIEW_LENGTH = 150;

interface MemoryTimelineCardProps {
  item: MemoryItem;
  isSearchResult?: boolean;
}

export function MemoryTimelineCard({ item, isSearchResult }: MemoryTimelineCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const typeConfig = MEMORY_TYPE_CONFIG[item.memory_type] ?? DEFAULT_TYPE_CONFIG;
  const TypeIcon = typeConfig.icon;
  const canExpand = item.content.length > CONTENT_PREVIEW_LENGTH;

  return (
    <article
      className={cn(
        "rounded-xl border border-zinc-200 bg-white shadow-sm transition",
        "hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600",
      )}
    >
      {/* Header: type badge + score bars */}
      <div className="flex items-start justify-between gap-3 px-3 pt-3">
        {/* Type badge */}
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-[3px] text-[10px] font-semibold",
            typeConfig.bg,
            typeConfig.accent,
          )}
        >
          <TypeIcon className="h-3 w-3" />
          {typeConfig.label}
        </span>

        {/* Score indicators */}
        <div className="flex shrink-0 items-center gap-3 text-[10px]">
          {/* Retention */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 dark:text-zinc-400">Ret</span>
            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={cn("h-full rounded-full transition-all", retentionBarColor(item.retention_score))}
                style={{ width: `${Math.max(item.retention_score * 100, 2)}%` }}
              />
            </div>
            <span className="w-7 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
              {(item.retention_score * 100).toFixed(0)}%
            </span>
          </div>
          {/* Importance */}
          {!isSearchResult && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">Imp</span>
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={cn("h-full rounded-full transition-all", importanceBarColor(item.importance_score))}
                  style={{ width: `${Math.max(item.importance_score * 100, 2)}%` }}
                />
              </div>
              <span className="w-7 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                {(item.importance_score * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-2 pt-2">
        <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
          {canExpand && !isExpanded
            ? [...item.content].slice(0, CONTENT_PREVIEW_LENGTH).join("")
            : item.content}
        </p>
        {canExpand && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                展开全文
              </>
            )}
          </button>
        )}
      </div>

      {/* Metadata footer */}
      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 px-3 py-2 text-[10px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {!isSearchResult && (
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {item.access_count}x
          </span>
        )}
        {item.last_accessed_at && !isSearchResult && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(item.last_accessed_at)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(item.created_at)}
        </span>
      </div>
    </article>
  );
}
