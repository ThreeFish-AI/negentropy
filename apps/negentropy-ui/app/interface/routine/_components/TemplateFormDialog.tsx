"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { cn } from "@/lib/utils";
import { createRoutine, updateRoutine } from "@/features/routine";
import type { ApprovalMode, RoutineTemplateItem } from "@/features/routine";
import { toast } from "sonner";

interface TemplateFormDialogProps {
  open: boolean;
  /** null = 创建模式；传值 = 编辑模式 */
  template: RoutineTemplateItem | null;
  onClose: () => void;
  /** 提交成功回调 */
  onSaved: () => void;
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

const STEPS = [
  { key: "basic", label: "基础" },
  { key: "task", label: "任务" },
  { key: "config", label: "配置" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "general", label: "通用" },
  { value: "quality", label: "质量" },
  { value: "testing", label: "测试" },
  { value: "documentation", label: "文档" },
  { value: "custom", label: "自定义" },
];

/**
 * 模板创建/编辑表单对话框 — 三步向导。
 *
 * 步骤 0（基础）：Key、显示名称、描述、分类、版本
 * 步骤 1（任务）：任务标题、执行目标、验收标准
 * 步骤 2（配置）：预算参数、审批模式、验证命令、特性标签
 */
export function TemplateFormDialog({ open, template, onClose, onSaved }: TemplateFormDialogProps) {
  const isEdit = template !== null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);

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
      setStep(0);
    });
  }, [open, template, isEdit]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── 每步校验 ──
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!isEdit && !form.key.trim()) errs.key = "必填";
    } else if (s === 1) {
      if (!form.title.trim()) errs.title = "必填";
      if (!form.goal.trim()) errs.goal = "必填";
      if (!form.acceptance_criteria.trim()) errs.acceptance_criteria = "必填";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("请修正标红的字段后继续");
      return false;
    }
    setFieldErrors({});
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(step)) return;

    setLoading(true);
    setError(null);

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
      success_score_threshold: parseInt(form.success_score_threshold, 10) ?? 85,
      no_progress_patience: parseInt(form.no_progress_patience, 10) ?? 3,
      approval_mode: form.approval_mode,
      config,
      display_name: form.display_name.trim() || null,
      description: form.description.trim() || null,
      is_template: true,
    };

    try {
      if (isEdit && template) {
        await updateRoutine(template.id, base);
        toast.success("模板已更新");
      } else {
        await createRoutine({ ...base, key: form.key.trim() });
        toast.success("模板已创建");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputCls =
    "w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const labelCls = "mb-1 block text-xs font-medium text-text-secondary";
  const textareaCls = cn(inputCls, "min-h-[72px] resize-y");

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
        {/* 步骤指示器 */}
        <div className="mt-3 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && <div className="h-px w-4 bg-border" />}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  i === step
                    ? "bg-primary/10 text-primary"
                    : i < step
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-muted text-text-muted",
                )}
              >
                {i < step ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-[10px]">{i + 1}</span>
                )}
                <span>{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 px-5 py-4">
          {error && <ErrorBanner message={error} />}

          {/* 步骤 0 — 基础信息 */}
          {step === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {isEdit ? (
                  <div>
                    <label className={labelCls}>模板标识</label>
                    <input type="text" value={form.key} disabled className={inputCls} />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>
                      模板标识 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.key}
                      onChange={(e) => update("key", e.target.value)}
                      placeholder="unique_template_key"
                      className={cn(inputCls, fieldErrors.key && "border-red-400")}
                    />
                    {fieldErrors.key && (
                      <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.key}</p>
                    )}
                  </div>
                )}
                <div>
                  <label className={labelCls}>显示名称</label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => update("display_name", e.target.value)}
                    placeholder="模板展示名"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>描述</label>
                <textarea
                  className={cn(inputCls, "resize-y")}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={2}
                  placeholder="模板用途简述"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>分类</label>
                  <select
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                    className={inputCls}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>版本</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => update("version", e.target.value)}
                    placeholder="1.0.0"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 步骤 1 — 任务定义 */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>
                  任务标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="创建时的默认标题"
                  className={cn(inputCls, fieldErrors.title && "border-red-400")}
                />
                {fieldErrors.title && (
                  <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.title}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  执行目标 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.goal}
                  onChange={(e) => update("goal", e.target.value)}
                  rows={4}
                  placeholder="Claude Code 的长周期目标"
                  className={cn(textareaCls, fieldErrors.goal && "border-red-400")}
                />
                {fieldErrors.goal && (
                  <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.goal}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  验收标准 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.acceptance_criteria}
                  onChange={(e) => update("acceptance_criteria", e.target.value)}
                  rows={3}
                  placeholder="Evaluator 判定成功的准则"
                  className={cn(textareaCls, fieldErrors.acceptance_criteria && "border-red-400")}
                />
                {fieldErrors.acceptance_criteria && (
                  <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.acceptance_criteria}</p>
                )}
              </div>
            </div>
          )}

          {/* 步骤 2 — 配置 */}
          {step === 2 && (
            <div className="space-y-4">
              {/* 预算参数 */}
              <div className="rounded-card border border-border bg-muted/30 p-4">
                <h4 className="mb-3 text-xs font-medium text-text-secondary">预算与限制</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <label className={labelCls}>最大迭代</label>
                    <input
                      type="number"
                      min={1}
                      value={form.max_iterations}
                      onChange={(e) => update("max_iterations", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>预算上限 (USD)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={form.max_cost_usd}
                      onChange={(e) => update("max_cost_usd", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>成功阈值</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.success_score_threshold}
                      onChange={(e) => update("success_score_threshold", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>无进展上限</label>
                    <input
                      type="number"
                      min={1}
                      value={form.no_progress_patience}
                      onChange={(e) => update("no_progress_patience", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* 审批模式 */}
              <div>
                <label className={labelCls}>审批模式</label>
                <select
                  value={form.approval_mode}
                  onChange={(e) => update("approval_mode", e.target.value as ApprovalMode)}
                  className={inputCls}
                >
                  <option value="auto">全自动 — 创建后无人干预</option>
                  <option value="first">首次审批 — 第 1 次执行前需确认</option>
                  <option value="every">每轮审批 — 每次迭代前需确认</option>
                </select>
                <p className="mt-1 text-caption text-text-muted">
                  {APPROVAL_HELP[form.approval_mode]}
                </p>
              </div>

              {/* 验证命令 */}
              <div>
                <label className={labelCls}>验证命令</label>
                <input
                  type="text"
                  value={form.verification_command}
                  onChange={(e) => update("verification_command", e.target.value)}
                  placeholder="例如 uv run pytest -q"
                  className={inputCls}
                />
                <p className="mt-1 text-caption text-text-muted">
                  迭代结束后的命令门控，通过后才算完成
                </p>
              </div>

              {/* 特性标签 */}
              <div>
                <label className={labelCls}>特性标签</label>
                <input
                  type="text"
                  value={form.features_showcase}
                  onChange={(e) => update("features_showcase", e.target.value)}
                  placeholder="特性 1, 特性 2, 特性 3（逗号分隔）"
                  className={inputCls}
                />
                <p className="mt-1 text-caption text-text-muted">
                  展示在模板卡片上的特性标签，逗号分隔
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <div>
            {step > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={handlePrev} disabled={loading}>
                上一步
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              取消
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" size="sm" onClick={handleNext}>
                下一步
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="sm" loading={loading}>
                {isEdit ? "保存更改" : "创建模板"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </OverlayDismissLayer>
  );
}
