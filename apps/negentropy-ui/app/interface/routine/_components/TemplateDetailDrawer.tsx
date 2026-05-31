"use client";

import { Button } from "@/components/ui/Button";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import type { RoutineTemplateItem } from "@/features/routine";
import { APPROVAL_BADGE } from "./preset-style";

interface TemplateDetailDrawerProps {
  open: boolean;
  template: RoutineTemplateItem | null;
  onClose: () => void;
  onEdit: (t: RoutineTemplateItem) => void;
  onDelete: (t: RoutineTemplateItem) => void;
  onUse: (t: RoutineTemplateItem) => void;
}

/** approval_mode → 中文说明 */
const APPROVAL_HELP: Record<string, string> = {
  auto: "全自动：创建后无人干预",
  first: "首次审批：第 1 次执行前需确认",
  every: "每轮审批：每次迭代前需确认",
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="ml-4 break-all text-right text-foreground">{children}</span>
    </div>
  );
}

/**
 * 模板详情抽屉 — 复用 BaseDrawer（Reuse-Driven）。
 *
 * 展示 RoutineTemplateItem 的完整配置信息：
 * 描述、任务定义、预算与审批、高级配置（验证命令、特性标签）。
 * Footer 含「使用模板 / 编辑 / 删除」操作按钮。
 */
export function TemplateDetailDrawer({
  open,
  template,
  onClose,
  onEdit,
  onDelete,
  onUse,
}: TemplateDetailDrawerProps) {
  // template 可能在 Drawer 始终挂载但尚未选择时为 null（由 lastViewedTemplate.current 回退）
  if (!template) return null;

  const isUser = template.source === "user";
  const approvalBadge = APPROVAL_BADGE[template.approval_mode];

  const title = (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-h4 font-semibold text-foreground">
          {template.display_name || template.key}
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-micro font-medium ${
            isUser
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              : "bg-muted text-text-secondary"
          }`}
        >
          {isUser ? "Custom" : "内置"}
        </span>
      </div>
      <p className="text-caption text-text-muted">{template.key}</p>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2">
      <Button variant="neutral" size="sm" onClick={() => onUse(template)}>
        使用模板
      </Button>
      <div className="flex-1" />
      {isUser && (
        <>
          <Button variant="neutral" size="sm" onClick={() => onEdit(template)}>
            编辑
          </Button>
          <button
            onClick={() => onDelete(template)}
            className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:border-red-800 dark:text-red-400"
          >
            删除
          </button>
        </>
      )}
    </div>
  );

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      widthClassName="w-[460px] max-w-[92vw]"
    >
      <div className="space-y-5 px-5 py-4">
        {/* 描述 */}
        {template.description && (
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Description
            </h3>
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-text-secondary">
              {template.description}
            </p>
          </section>
        )}

        {/* 任务定义 */}
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Task Definition
          </h3>
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Title
              </span>
              <p className="mt-1 text-xs text-foreground">{template.title}</p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Goal
              </span>
              <p className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-foreground">
                {template.goal}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Acceptance Criteria
              </span>
              <p className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-text-secondary">
                {template.acceptance_criteria}
              </p>
            </div>
          </div>
        </section>

        {/* 预算与审批 */}
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Budget & Approval
          </h3>
          <div className="rounded-lg border border-border p-3">
            <DetailField label="Max Iterations">
              {template.max_iterations ?? "∞"}
            </DetailField>
            <DetailField label="Max Cost (USD)">
              {template.max_cost_usd != null ? `$${template.max_cost_usd}` : "∞"}
            </DetailField>
            <DetailField label="Score Threshold">{template.success_score_threshold}</DetailField>
            <DetailField label="No-Progress Limit">{template.no_progress_patience}</DetailField>
            <DetailField label="Approval Mode">
              {approvalBadge ? (
                <span className={`rounded-full px-1.5 py-0.5 text-micro ${approvalBadge.cls}`}>
                  {approvalBadge.label}
                </span>
              ) : (
                template.approval_mode
              )}
            </DetailField>
            {template.approval_mode in APPROVAL_HELP && (
              <p className="mt-1 text-[10px] text-text-muted">
                {APPROVAL_HELP[template.approval_mode]}
              </p>
            )}
          </div>
        </section>

        {/* 高级配置 */}
        <section>
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Advanced
          </h3>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <DetailField label="Verification">
              {template.has_verification_command && template.verification_command ? (
                <code className="text-[10px]">{template.verification_command}</code>
              ) : (
                <span className="text-text-muted">未设置</span>
              )}
            </DetailField>
            {template.features_showcase.length > 0 && (
              <div className="flex items-start justify-between py-1.5 text-xs">
                <span className="shrink-0 text-muted-foreground">Features</span>
                <div className="ml-4 flex flex-wrap justify-end gap-1">
                  {template.features_showcase.map((f, i) => (
                    <span
                      key={i}
                      className="rounded bg-muted px-1.5 py-0.5 text-micro text-text-secondary"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <DetailField label="Category">
              <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-micro text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {template.category}
              </span>
            </DetailField>
            <DetailField label="Version">
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-secondary">
                v{template.version}
              </span>
            </DetailField>
            {template.created_at && (
              <DetailField label="Created">
                {new Date(template.created_at).toLocaleString()}
              </DetailField>
            )}
            {template.updated_at && (
              <DetailField label="Updated">
                {new Date(template.updated_at).toLocaleString()}
              </DetailField>
            )}
          </div>
        </section>
      </div>
    </BaseDrawer>
  );
}
