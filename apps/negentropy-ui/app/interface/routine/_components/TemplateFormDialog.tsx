"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { cn } from "@/lib/utils";
import { createRoutine, updateRoutine } from "@/features/routine";
import type { ApprovalMode, RoutineDTO, RoutineTemplateItem } from "@/features/routine";
import { toast } from "sonner";

interface TemplateFormDialogProps {
  open: boolean;
  /** null = 创建模式；传值 = 编辑模式 */
  template: RoutineTemplateItem | null;
  onClose: () => void;
  /** 提交成功回调 */
  onSaved: (saved: RoutineDTO) => void;
}

interface FormState {
  key: string;
  display_name: string;
  description: string;
  category: string;
  version: string;
  title: string;
  goal: string;
  acceptance_criteria: string;
  verification_command: string;
  max_iterations: string;
  max_cost_usd: string;
  success_score_threshold: string;
  no_progress_patience: string;
  approval_mode: ApprovalMode;
  features_showcase: string;
}

const EMPTY: FormState = {
  key: "",
  display_name: "",
  description: "",
  category: "general",
  version: "1.0.0",
  title: "",
  goal: "",
  acceptance_criteria: "",
  verification_command: "",
  max_iterations: "20",
  max_cost_usd: "5",
  success_score_threshold: "85",
  no_progress_patience: "3",
  approval_mode: "auto",
  features_showcase: "",
};

const APPROVAL_HELP: Record<ApprovalMode, string> = {
  auto: "全自动：创建后无人干预",
  first: "首次审批：第 1 次执行前需确认",
  every: "每轮审批：每次迭代前需确认",
};

/**
 * 模板创建/编辑表单对话框。
 *
 * 模板本质上是 `is_template=true` 的 Routine 行。
 * 本表单只暴露模板语义字段（goal / acceptance_criteria / 预算 / config），
 * 不暴露运行时字段（status / cwd / owner_id 等）。
 *
 * category / version / features_showcase 存入 config JSONB，
 * 复用 Routine.config 作为扩展元信息容器。
 */
export function TemplateFormDialog({ open, template, onClose, onSaved }: TemplateFormDialogProps) {
  const isEdit = template !== null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: FormState = template
      ? {
          key: template.key,
          display_name: template.display_name,
          description: template.description,
          category: template.category,
          version: template.version,
          title: template.title,
          goal: template.goal,
          acceptance_criteria: template.acceptance_criteria,
          verification_command: template.verification_command ?? "",
          max_iterations: template.max_iterations != null ? String(template.max_iterations) : "",
          max_cost_usd: template.max_cost_usd != null ? String(template.max_cost_usd) : "",
          success_score_threshold: String(template.success_score_threshold),
          no_progress_patience: String(template.no_progress_patience),
          approval_mode: template.approval_mode,
          features_showcase: Array.isArray(template.features_showcase)
            ? template.features_showcase.join(", ")
            : "",
        }
      : EMPTY;
    queueMicrotask(() => {
      setForm(next);
      setError(null);
      setFieldErrors({});
      setShowAdvanced(isEdit && (!!template?.verification_command || !!template?.features_showcase?.length));
    });
  }, [open, template, isEdit]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const errs: Record<string, string> = {};
    if (!isEdit && !form.key.trim()) errs.key = "必填";
    if (!form.title.trim()) errs.title = "必填";
    if (!form.goal.trim()) errs.goal = "必填";
    if (!form.acceptance_criteria.trim()) errs.acceptance_criteria = "必填";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("请修正标红的字段后重试");
      setLoading(false);
      return;
    }

    // category / version / features_showcase 存入 config JSONB
    const features = form.features_showcase
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const config: Record<string, unknown> = {
      ...(isEdit && template ? (template.config as Record<string, unknown>) : {}),
      category: form.category.trim() || "general",
      version: form.version.trim() || "1.0.0",
      features_showcase: features,
    };

    const base = {
      title: form.title.trim(),
      goal: form.goal.trim(),
      acceptance_criteria: form.acceptance_criteria.trim(),
      verification_command: form.verification_command.trim() || null,
      max_iterations: form.max_iterations.trim() ? parseInt(form.max_iterations, 10) : null,
      max_cost_usd: form.max_cost_usd.trim() ? parseFloat(form.max_cost_usd) : null,
      success_score_threshold: parseInt(form.success_score_threshold, 10) || 85,
      no_progress_patience: parseInt(form.no_progress_patience, 10) || 3,
      approval_mode: form.approval_mode,
      config,
      display_name: form.display_name.trim() || null,
      description: form.description.trim() || null,
      is_template: true,
    };

    try {
      let saved: RoutineDTO;
      if (isEdit && template) {
        // 用户模板的 id 是 UUID（非 builtin:xxx）
        saved = await updateRoutine(template.id, base);
        toast.success("模板已更新");
      } else {
        saved = await createRoutine({ ...base, key: form.key.trim() });
        toast.success("模板已创建");
      }
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputCls =
    "w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const labelCls = "shrink-0 whitespace-nowrap text-xs font-medium text-text-secondary";

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={loading}
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]"
    >
      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          {isEdit ? "编辑模板" : "新建模板"}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {isEdit ? `正在编辑「${template?.display_name}」` : "创建一个可复用的 Routine 模板"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <ErrorBanner message={error} />}

          {/* Section 1 — 基本信息 */}
          <section>
            <div className="grid grid-cols-2 gap-3">
              {isEdit ? (
                <div className="flex items-center gap-2">
                  <label className={labelCls}>Key</label>
                  <input type="text" value={form.key} disabled className={cn(inputCls, "min-w-0 flex-1")} />
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>
                      Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.key}
                      onChange={(e) => update("key", e.target.value)}
                      placeholder="unique_template_key"
                      className={cn(inputCls, "min-w-0 flex-1", fieldErrors.key && "border-red-400")}
                    />
                  </div>
                  {fieldErrors.key && <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.key}</p>}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => update("display_name", e.target.value)}
                    placeholder="模板展示名"
                    className={cn(inputCls, "min-w-0 flex-1")}
                  />
                </div>
              </div>
            </div>
            <textarea
              className={cn(inputCls, "mt-3")}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              placeholder="Description — 模板用途简述"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className={labelCls}>Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  placeholder="quality / testing / general"
                  className={cn(inputCls, "min-w-0 flex-1")}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>Version</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => update("version", e.target.value)}
                  placeholder="1.0.0"
                  className={cn(inputCls, "min-w-0 flex-1")}
                />
              </div>
            </div>
          </section>

          {/* Section 2 — 任务定义 */}
          <section className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className={labelCls}>
                  Title <span className="text-red-500">*</span>
                </label>
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Routine Title — 创建时的默认标题"
                className={cn(inputCls, fieldErrors.title && "border-red-400")}
              />
              {fieldErrors.title && <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.title}</p>}
            </div>
            <div>
              <textarea
                value={form.goal}
                onChange={(e) => update("goal", e.target.value)}
                rows={3}
                placeholder="Goal * — Claude Code 的长周期目标"
                className={cn(inputCls, fieldErrors.goal && "border-red-400")}
              />
              {fieldErrors.goal && <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.goal}</p>}
            </div>
            <div>
              <textarea
                value={form.acceptance_criteria}
                onChange={(e) => update("acceptance_criteria", e.target.value)}
                rows={2}
                placeholder="Acceptance Criteria * — Evaluator 判定成功的准则"
                className={cn(inputCls, fieldErrors.acceptance_criteria && "border-red-400")}
              />
              {fieldErrors.acceptance_criteria && (
                <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.acceptance_criteria}</p>
              )}
            </div>
          </section>

          {/* Section 3 — 预算与审批 */}
          <section className="rounded-card border border-border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <label className={labelCls}>Max Iterations</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_iterations}
                  onChange={(e) => update("max_iterations", e.target.value)}
                  className={cn(inputCls, "min-w-0 flex-1")}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>Max Cost (USD)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.max_cost_usd}
                  onChange={(e) => update("max_cost_usd", e.target.value)}
                  className={cn(inputCls, "min-w-0 flex-1")}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>Score Threshold</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.success_score_threshold}
                  onChange={(e) => update("success_score_threshold", e.target.value)}
                  className={cn(inputCls, "min-w-0 flex-1")}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className={labelCls}>No-Progress Limit</label>
                <input
                  type="number"
                  min={1}
                  value={form.no_progress_patience}
                  onChange={(e) => update("no_progress_patience", e.target.value)}
                  className={cn(inputCls, "min-w-0 flex-1")}
                />
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <label className={cn(labelCls, "pt-2")}>Approval Mode</label>
              <div className="min-w-0 flex-1">
                <select
                  value={form.approval_mode}
                  onChange={(e) => update("approval_mode", e.target.value as ApprovalMode)}
                  className={inputCls}
                >
                  <option value="auto">Auto (全自动)</option>
                  <option value="first">First (首次审批)</option>
                  <option value="every">Every (每轮审批)</option>
                </select>
                <p className="mt-1 text-caption text-text-muted">{APPROVAL_HELP[form.approval_mode]}</p>
              </div>
            </div>
          </section>

          {/* Section 4 — 高级设置（折叠） */}
          <section>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="group flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-caption font-medium text-text-secondary transition-colors hover:bg-muted"
              aria-expanded={showAdvanced}
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-3.5 w-3.5 text-text-muted transition-transform duration-150",
                  showAdvanced && "rotate-180",
                )}
              />
              <span>{showAdvanced ? "收起高级设置" : "高级设置 (Verification, Features...)"}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2 rounded-card border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>Verification Command</label>
                  <input
                    type="text"
                    value={form.verification_command}
                    onChange={(e) => update("verification_command", e.target.value)}
                    placeholder="e.g. uv run pytest -q"
                    className={cn(inputCls, "min-w-0 flex-1")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>Features Showcase</label>
                    <input
                      type="text"
                      value={form.features_showcase}
                      onChange={(e) => update("features_showcase", e.target.value)}
                      placeholder="特性 1, 特性 2, 特性 3（逗号分隔）"
                      className={cn(inputCls, "min-w-0 flex-1")}
                    />
                  </div>
                  <p className="mt-1 text-caption text-text-muted">
                    逗号分隔的特性标签，展示在模板卡片上
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={loading}>
            {isEdit ? "Save" : "Create Template"}
          </Button>
        </div>
      </form>
    </OverlayDismissLayer>
  );
}
