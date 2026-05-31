"use client";

import { useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { RoutineTemplateItem } from "@/features/routine";
import { APPROVAL_BADGE } from "./preset-style";

interface TemplateDetailDrawerProps {
  template: RoutineTemplateItem;
  onClose: () => void;
  /** 点击「使用此模板」CTA */
  onUse: (template: RoutineTemplateItem) => void;
  /** 点击编辑（仅 source=user） */
  onEdit?: (template: RoutineTemplateItem) => void;
  /** 点击删除（仅 source=user） */
  onDelete?: (template: RoutineTemplateItem) => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="ml-4 break-all text-right text-foreground">{children}</span>
    </div>
  );
}

/**
 * 模板详情侧滑抽屉。
 *
 * 复用 RoutineDetailDrawer 的 translateX 滑入模式。
 * 展示模板完整配置：目标、验收标准、预算、审批模式、验证命令、特性。
 * Footer 含「使用此模板」主 CTA + 编辑/删除（仅用户模板）。
 */
export function TemplateDetailDrawer({
  template,
  onClose,
  onUse,
  onEdit,
  onDelete,
}: TemplateDetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isUser = template.source === "user";
  const badge = APPROVAL_BADGE[template.approval_mode];

  // Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // 滑入动画
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = "translateX(100%)";
    requestAnimationFrame(() => {
      el.style.transition = "transform 200ms ease-out";
      el.style.transform = "translateX(0)";
    });
  }, []);

  return (
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 z-40 bg-overlay" onClick={onClose} />

      {/* 侧滑面板 */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 flex w-[460px] max-w-[92vw] flex-col border-l border-border bg-card shadow-xl"
        style={{ transform: "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">{template.display_name}</h2>
              {isUser ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  自建
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                  内置
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{template.key}</span>
              <span className="text-border">|</span>
              <span>{template.category}</span>
              <span className="text-border">|</span>
              <span>v{template.version}</span>
              {badge && (
                <>
                  <span className="text-border">|</span>
                  <span className={`rounded-full px-1.5 py-px text-[9px] ${badge.cls}`}>
                    {badge.label}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭详情"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
          {/* 描述 */}
          {template.description && (
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                描述
              </h3>
              <p className="whitespace-pre-wrap break-words text-xs text-text-secondary">
                {template.description}
              </p>
            </section>
          )}

          {/* 目标 */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              执行目标
            </h3>
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-foreground">
              {template.goal}
            </p>
          </section>

          {/* 验收标准 */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              验收标准
            </h3>
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-text-secondary">
              {template.acceptance_criteria}
            </p>
          </section>

          {/* 配置 */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              配置
            </h3>
            <div className="rounded-lg border border-border p-3">
              <DetailField label="最大迭代">
                {template.max_iterations ?? "∞"}
              </DetailField>
              <DetailField label="预算上限">
                {template.max_cost_usd != null ? `$${template.max_cost_usd}` : "∞"}
              </DetailField>
              <DetailField label="成功阈值">
                {template.success_score_threshold}
              </DetailField>
              <DetailField label="无进展上限">
                {template.no_progress_patience}
              </DetailField>
              <DetailField label="审批模式">
                {badge?.label ?? template.approval_mode}
              </DetailField>
              {template.verification_command && (
                <DetailField label="验证命令">
                  <code className="text-[10px]">{template.verification_command}</code>
                </DetailField>
              )}
            </div>
          </section>

          {/* 特性 */}
          {template.features_showcase.length > 0 && (
            <section>
              <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                特性
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {template.features_showcase.map((f, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs text-text-secondary"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onUse(template)}
          >
            使用此模板
          </Button>
          {isUser && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(template)}
              aria-label="编辑模板"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </Button>
          )}
          {isUser && onDelete && (
            <button
              onClick={() => onDelete(template)}
              className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:border-red-800 dark:text-red-400"
            >
              <Trash2 className="mr-1 inline h-3 w-3 align-[-2px]" />
              删除
            </button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </>
  );
}
