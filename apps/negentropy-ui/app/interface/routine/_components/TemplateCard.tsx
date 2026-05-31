"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { RoutineTemplateItem } from "@/features/routine";
import { APPROVAL_BADGE } from "./preset-style";

interface TemplateCardProps {
  template: RoutineTemplateItem;
  /** 点击「使用模板」CTA */
  onUse: (template: RoutineTemplateItem) => void;
  /** 点击编辑（仅 source=user） */
  onEdit?: (template: RoutineTemplateItem) => void;
  /** 点击删除（仅 source=user） */
  onDelete?: (template: RoutineTemplateItem) => void;
  /** 点击卡片主体（查看详情） */
  onClick?: (template: RoutineTemplateItem) => void;
}

/**
 * 统一模板卡片 — 内置预设 + 用户模板共用。
 *
 * 设计：
 * - 内置模板（source=builtin）：只读，仅 "使用模板" 按钮
 * - 用户模板（source=user）：可编辑/删除，右上角 "Custom" 徽标
 * - 卡片主体可点击查看详情（onClick），底部 CTA 独立
 * - `h-full flex flex-col` 保证同行等高；CTA `mt-auto` 钉底
 */
export function TemplateCard({ template, onUse, onEdit, onDelete, onClick }: TemplateCardProps) {
  const isUser = template.source === "user";
  const badge = APPROVAL_BADGE[template.approval_mode];

  return (
    <div className="group relative flex h-full flex-col rounded-card border border-border bg-card p-4 transition-colors hover:border-foreground/15">
      {/* 用户模板标记 */}
      {isUser && (
        <span className="absolute right-3 top-3 rounded-full bg-indigo-100 px-1.5 py-0.5 text-micro font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          Custom
        </span>
      )}

      {/* 可点击主体 */}
      <button
        type="button"
        className="cursor-pointer space-y-2 text-left"
        onClick={() => onClick?.(template)}
      >
        <div className="flex flex-wrap items-center gap-2 pr-14">
          <h3 className="text-sm font-semibold text-foreground">{template.display_name}</h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
            v{template.version}
          </span>
          <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-micro text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            {template.category}
          </span>
          {badge && (
            <span className={`rounded-full px-1.5 py-0.5 text-micro ${badge.cls}`}>{badge.label}</span>
          )}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
            Gate: {template.has_verification_command ? "✓" : "✗"}
          </span>
        </div>

        <p className="text-xs text-text-muted line-clamp-2">{template.description}</p>

        {template.features_showcase.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.features_showcase.slice(0, 3).map((f, i) => (
              <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
                {f}
              </span>
            ))}
            {template.features_showcase.length > 3 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-micro text-text-muted">
                +{template.features_showcase.length - 3}
              </span>
            )}
          </div>
        )}
      </button>

      {/* 底部操作区 */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        <Button variant="neutral" size="sm" className="flex-1" onClick={() => onUse(template)}>
          使用模板
        </Button>
        {isUser && onEdit && (
          <Button
            iconOnly
            size="sm"
            variant="ghost"
            onClick={() => onEdit(template)}
            aria-label="编辑模板"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {isUser && onDelete && (
          <Button
            iconOnly
            size="sm"
            variant="ghost"
            className="text-text-muted hover:text-red-500"
            onClick={() => onDelete(template)}
            aria-label="删除模板"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
