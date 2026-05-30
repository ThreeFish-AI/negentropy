"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { cn } from "@/lib/utils";
import type { ApprovalMode, RoutineCreatePayload, RoutineDTO, RoutineUpdatePayload } from "@/features/routine";

interface RoutineFormDialogProps {
  open: boolean;
  routine: RoutineDTO | null; // null = create
  onClose: () => void;
  onSubmit: (mode: "create" | "edit", id: string | null, body: RoutineCreatePayload | RoutineUpdatePayload) => Promise<void>;
}

interface FormState {
  key: string;
  title: string;
  goal: string;
  acceptance_criteria: string;
  cwd: string;
  verification_command: string;
  max_iterations: string;
  max_cost_usd: string;
  success_score_threshold: string;
  no_progress_patience: string;
  approval_mode: ApprovalMode;
  // Claude Code config 覆盖
  model: string;
  max_turns: string;
  permission_mode: string;
  allowed_tools: string;
  display_name: string;
  description: string;
}

const EMPTY: FormState = {
  key: "",
  title: "",
  goal: "",
  acceptance_criteria: "",
  cwd: "",
  verification_command: "",
  max_iterations: "20",
  max_cost_usd: "5",
  success_score_threshold: "85",
  no_progress_patience: "3",
  approval_mode: "auto",
  model: "",
  max_turns: "",
  permission_mode: "",
  allowed_tools: "",
  display_name: "",
  description: "",
};

const APPROVAL_HELP: Record<ApprovalMode, string> = {
  auto: "全自动：创建后无人干预，直到完成或终止",
  first: "首次审批：第 1 次执行前需人工确认，之后自动迭代",
  every: "每轮审批：每次迭代执行前都需人工确认",
};

export function RoutineFormDialog({ open, routine, onClose, onSubmit }: RoutineFormDialogProps) {
  const isEdit = routine !== null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cfg = (routine?.config ?? {}) as Record<string, unknown>;
    const next: FormState = routine
      ? {
          key: routine.key,
          title: routine.title,
          goal: routine.goal,
          acceptance_criteria: routine.acceptance_criteria,
          cwd: routine.cwd ?? "",
          verification_command: routine.verification_command ?? "",
          max_iterations: routine.max_iterations != null ? String(routine.max_iterations) : "",
          max_cost_usd: routine.max_cost_usd != null ? String(routine.max_cost_usd) : "",
          success_score_threshold: String(routine.success_score_threshold),
          no_progress_patience: String(routine.no_progress_patience),
          approval_mode: routine.approval_mode,
          model: (cfg.model as string) ?? "",
          max_turns: cfg.max_turns != null ? String(cfg.max_turns) : "",
          permission_mode: (cfg.permission_mode as string) ?? "",
          allowed_tools: Array.isArray(cfg.allowed_tools) ? (cfg.allowed_tools as string[]).join(", ") : "",
          display_name: routine.display_name ?? "",
          description: routine.description ?? "",
        }
      : EMPTY;
    // 编辑模式下，若高级字段有非空值则自动展开
    const hasAdvanced =
      !!(routine?.cwd) ||
      !!(cfg.model) ||
      cfg.max_turns != null ||
      !!(cfg.permission_mode) ||
      (Array.isArray(cfg.allowed_tools) && (cfg.allowed_tools as string[]).length > 0) ||
      !!(routine?.verification_command);
    // 用 microtask 推迟，避免在 effect 体内同步 setState（对齐 SchedulerTaskFormDialog）
    queueMicrotask(() => {
      setForm(next);
      setError(null);
      setFieldErrors({});
      setShowAdvanced(isEdit && hasAdvanced);
    });
  }, [open, routine, isEdit]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const errs: Record<string, string> = {};
    if (!isEdit && !form.key.trim()) errs.key = "Key is required";
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.goal.trim()) errs.goal = "Goal is required";
    if (!form.acceptance_criteria.trim()) errs.acceptance_criteria = "Acceptance criteria is required";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Fix the highlighted fields before saving.");
      setLoading(false);
      return;
    }

    // 组装 Claude Code config 覆盖：从既有 config 起步，仅增删本表单管理的 4 个键，
    // 保留 system_prompt / timeout_seconds 等表单未暴露但引擎消费的键（编辑时不被整体覆盖丢弃）。
    const config: Record<string, unknown> = { ...((routine?.config as Record<string, unknown>) ?? {}) };
    if (form.model.trim()) config.model = form.model.trim();
    else delete config.model;
    if (form.max_turns.trim()) config.max_turns = parseInt(form.max_turns, 10);
    else delete config.max_turns;
    if (form.permission_mode.trim()) config.permission_mode = form.permission_mode.trim();
    else delete config.permission_mode;
    if (form.allowed_tools.trim())
      config.allowed_tools = form.allowed_tools.split(",").map((s) => s.trim()).filter(Boolean);
    else delete config.allowed_tools;

    const base = {
      title: form.title.trim(),
      goal: form.goal.trim(),
      acceptance_criteria: form.acceptance_criteria.trim(),
      cwd: form.cwd.trim() || null,
      verification_command: form.verification_command.trim() || null,
      max_iterations: form.max_iterations.trim() ? parseInt(form.max_iterations, 10) : null,
      max_cost_usd: form.max_cost_usd.trim() ? parseFloat(form.max_cost_usd) : null,
      success_score_threshold: parseInt(form.success_score_threshold, 10) || 85,
      no_progress_patience: parseInt(form.no_progress_patience, 10) || 3,
      approval_mode: form.approval_mode,
      config,
      display_name: form.display_name.trim() || null,
      description: form.description.trim() || null,
    };

    try {
      if (isEdit) {
        await onSubmit("edit", routine.id, base as RoutineUpdatePayload);
      } else {
        await onSubmit("create", null, { ...base, key: form.key.trim() } as RoutineCreatePayload);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  /* ── 样式常量 ── */
  // 通用 input 基础样式；水平布局时叠加 min-w-0 flex-1 覆盖 w-full
  const inputCls =
    "w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  // 水平 Label（shrink-0 不收缩，whitespace-nowrap 不换行）
  const labelCls = "shrink-0 whitespace-nowrap text-xs font-medium text-text-secondary";
  // 垂直 Label（用于 textarea 上方的 label）
  const vLabelCls = "mb-1 block text-xs font-medium text-text-secondary";

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
        <h2 className="text-lg font-semibold text-foreground">{isEdit ? "Edit Routine" : "New Routine"}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {isEdit ? `Editing "${routine.display_name || routine.title}"` : "定义一个长周期自主任务"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <ErrorBanner message={error} />}

          {/* ── Key + Title (双列水平) + Description (垂直) ── */}
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
                      placeholder="unique_routine_key"
                      className={cn(inputCls, "min-w-0 flex-1", fieldErrors.key && "border-red-400")}
                    />
                  </div>
                  {fieldErrors.key && <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.key}</p>}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    className={cn(inputCls, "min-w-0 flex-1", fieldErrors.title && "border-red-400")}
                  />
                </div>
                {fieldErrors.title && <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.title}</p>}
              </div>
            </div>
            <div className="mt-3">
              <label className={vLabelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </div>
          </section>

          {/* ── Goal & Criteria (textarea → 垂直布局) ── */}
          <section className="space-y-3">
            <div>
              <label className={vLabelCls}>
                Goal <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.goal}
                onChange={(e) => update("goal", e.target.value)}
                rows={3}
                placeholder="The long-horizon objective for Claude Code to accomplish"
                className={cn(inputCls, fieldErrors.goal && "border-red-400")}
              />
              {fieldErrors.goal && <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.goal}</p>}
            </div>
            <div>
              <label className={vLabelCls}>
                Acceptance Criteria <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.acceptance_criteria}
                onChange={(e) => update("acceptance_criteria", e.target.value)}
                rows={2}
                placeholder="How the Evaluator judges success (the rubric)"
                className={cn(inputCls, fieldErrors.acceptance_criteria && "border-red-400")}
              />
              {fieldErrors.acceptance_criteria && (
                <p className="mt-0.5 text-[10px] text-red-500">{fieldErrors.acceptance_criteria}</p>
              )}
            </div>
          </section>

          {/* ── Budgets & Approval (子卡片，2 列水平) ── */}
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
                  <option value="auto">Auto (fully autonomous)</option>
                  <option value="first">First iteration approval</option>
                  <option value="every">Every iteration approval</option>
                </select>
                <p className="mt-1 text-caption text-text-muted">{APPROVAL_HELP[form.approval_mode]}</p>
              </div>
            </div>
          </section>

          {/* ── Advanced Settings (折叠，全部水平) ── */}
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
              <span>{showAdvanced ? "收起高级设置" : "高级设置 (Working Directory, Model, Tools...)"}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2 rounded-card border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <label className={labelCls}>Working Directory</label>
                  <input
                    type="text"
                    value={form.cwd}
                    onChange={(e) => update("cwd", e.target.value)}
                    placeholder="/path/to/project"
                    className={cn(inputCls, "min-w-0 flex-1")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>Max Turns / Iter.</label>
                    <input
                      type="number"
                      min={1}
                      value={form.max_turns}
                      onChange={(e) => update("max_turns", e.target.value)}
                      placeholder="default"
                      className={cn(inputCls, "min-w-0 flex-1")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className={labelCls}>Permission Mode</label>
                    <select
                      value={form.permission_mode}
                      onChange={(e) => update("permission_mode", e.target.value)}
                      className={cn(inputCls, "min-w-0 flex-1")}
                    >
                      <option value="">default</option>
                      <option value="auto">auto</option>
                      <option value="ask">ask</option>
                      <option value="plan">plan</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>Allowed Tools</label>
                  <input
                    type="text"
                    value={form.allowed_tools}
                    onChange={(e) => update("allowed_tools", e.target.value)}
                    placeholder="Bash, Read, Write, Edit, Glob, Grep"
                    className={cn(inputCls, "min-w-0 flex-1")}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className={labelCls}>Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => update("model", e.target.value)}
                    placeholder="inherit global config"
                    className={cn(inputCls, "min-w-0 flex-1")}
                  />
                </div>
                <div>
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
                  <p className="mt-1 text-caption text-text-muted">
                    测试驱动门控：退出码非 0 时评分封顶，作为客观锚点缓解 LLM 评审偏差
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
            {isEdit ? "Save" : "Create Routine"}
          </Button>
        </div>
      </form>
    </OverlayDismissLayer>
  );
}
