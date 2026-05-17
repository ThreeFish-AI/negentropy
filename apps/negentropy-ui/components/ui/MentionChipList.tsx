"use client";

/**
 * MentionChipList — Composer 下方的 mention 摘要 chip 列表。
 *
 * 等价于 ``AttachmentChipList`` 的 mention 镜像，承担"已选定的 @ 项"的可视化与
 * 删除入口。MVP 阶段以列表 chip 替代 mirror overlay 高亮，工作量小且不破坏
 * textarea 的 IME / Shift+Enter / 拖拽附件等既有行为。
 *
 * 删除 chip 时，父组件通过 ``onRemove(tokenId)`` 同步移除 textarea 中对应的
 * ``rawText`` 片段（实际逻辑由 Composer 调用 ``reconcileMentions`` 完成）。
 */
import { Bot, BookOpen, Save, Network, X } from "lucide-react";
import type { MentionKind, MentionToken } from "@negentropy/agents-chat-core/parse";

const _ICONS: Record<MentionKind, typeof Bot> = {
  agent: Bot,
  "corpus-retrieve": BookOpen,
  "corpus-output": Save,
  graph: Network,
};

const _CHIP_CLASS: Record<MentionKind, string> = {
  agent:
    "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200",
  "corpus-retrieve":
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
  "corpus-output":
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  graph:
    "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200",
};

const _KIND_TITLE: Record<MentionKind, string> = {
  agent: "委派 SubAgent",
  "corpus-retrieve": "限定检索范围",
  "corpus-output": "输出沉淀目标",
  graph: "强制图谱模式",
};

export interface MentionChipListProps {
  mentions: MentionToken[];
  onRemove: (tokenId: string) => void;
}

export function MentionChipList({ mentions, onRemove }: MentionChipListProps) {
  if (mentions.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="composer-mentions"
      aria-label="已选定的 @ 项"
    >
      {mentions.map((m) => {
        const Icon = _ICONS[m.kind];
        return (
          <span
            key={m.id}
            data-testid="composer-mention-chip"
            data-mention-kind={m.kind}
            title={`${_KIND_TITLE[m.kind]} · ${m.label}`}
            className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] ${_CHIP_CLASS[m.kind]}`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            <span className="max-w-[160px] truncate">{m.label}</span>
            <button
              type="button"
              aria-label={`移除 @${m.label}`}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-foreground/10"
              onClick={() => onRemove(m.id)}
            >
              <X className="h-2.5 w-2.5" aria-hidden />
            </button>
          </span>
        );
      })}
    </div>
  );
}
