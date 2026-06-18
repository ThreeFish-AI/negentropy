"use client";

import { Pencil, Trash2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TiltedCard } from "@/components/ui/TiltedCard";
import type { RoutineTemplateItem } from "@/features/routine";
import { APPROVAL_BADGE } from "./preset-style";

interface TemplateCardProps {
  template: RoutineTemplateItem;
  /** 点击卡片主体 → 打开详情抽屉 */
  onDetail?: (template: RoutineTemplateItem) => void;
  /** 点击「使用此模板」CTA */
  onUse: (template: RoutineTemplateItem) => void;
  /** 点击编辑（仅 source=user） */
  onEdit?: (template: RoutineTemplateItem) => void;
  /** 点击删除（仅 source=user） */
  onDelete?: (template: RoutineTemplateItem) => void;
}

/**
 * 统一模板卡片 — 内置预设 + 用户模板共用。
 *
 * 设计：
 * - 顶部：category 标签（浏览维度）+ 来源标识
 * - 主体：名称 + version 后缀 + 描述
 * - 底部元数据：审批模式 pill + 验证盾牌图标
 * - CTA：「使用此模板」
 * - 悬停：用户模板右上角显示编辑/删除图标
 * - `h-full flex flex-col` 保证同行等高；CTA `mt-auto` 钉底
 */
export function TemplateCard({ template, onDetail, onUse, onEdit, onDelete }: TemplateCardProps) {
  const isUser = template.source === "user";
  const badge = APPROVAL_BADGE[template.approval_mode];

  return (
    <TiltedCard>
    <div className="group relative flex h-full flex-col rounded-card border border-border bg-card p-4 transition-all hover:border-foreground/15 hover:shadow-md">
      {/* 用户模板悬停操作（右上角叠加） */}
      {isUser && (
        <div className="absolute right-2 top-2 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(template);
              }}
              aria-label="编辑模板"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              className="text-text-muted hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(template);
              }}
              aria-label="删除模板"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* 可点击主体 */}
      <button
        type="button"
        className="cursor-pointer space-y-2 text-left"
        onClick={() => onDetail?.(template)}
      >
        {/* 顶行：category + 来源标识 */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-overline text-text-secondary">
            {template.category}
          </span>
          {isUser ? (
            // 自建模板 hover 时右上角浮出编辑/删除图标，标识淡出让位避免重叠
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary transition-opacity group-hover:opacity-0">
              自建
            </span>
          ) : (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-text-secondary">
              内置
            </span>
          )}
        </div>

        {/* 名称 + version 后缀 */}
        <div>
          <h3 className="text-body-lg font-semibold text-foreground">
            {template.display_name}
            <span className="ml-1.5 text-caption font-normal text-text-secondary">
              v{template.version}
            </span>
          </h3>
        </div>

        {/* 描述 */}
        <p className="text-xs leading-relaxed text-text-secondary line-clamp-2">
          {template.description}
        </p>
      </button>

      {/* 底部：元数据 + CTA */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        {/* 元数据区 */}
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {badge && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          {template.has_verification_command && (
            <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" />
              验证门控
            </span>
          )}
        </div>

        {/* 主 CTA */}
        <Button
          variant="neutral"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onUse(template);
          }}
        >
          Use
        </Button>
      </div>
    </div>
    </TiltedCard>
  );
}
