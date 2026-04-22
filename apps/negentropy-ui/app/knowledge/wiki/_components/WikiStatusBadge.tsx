"use client";

import { WikiPublicationStatus } from "@/features/knowledge";

const STATUS_STYLES: Record<WikiPublicationStatus, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  archived: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_LABELS: Record<WikiPublicationStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

export function WikiStatusBadge({ status }: { status: WikiPublicationStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${style}`}>
      {label}
    </span>
  );
}
