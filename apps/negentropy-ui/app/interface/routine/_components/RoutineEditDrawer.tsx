"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cn } from "@/lib/utils";
import { createRoutine, updateRoutine } from "@/features/routine";
import type {
  ApprovalMode,
  RoutineCreatePayload,
  RoutineDTO,
  RoutineTemplateItem,
  RoutineUpdatePayload,
} from "@/features/routine";

import { canRestart, CONTROL_LABEL, controlsFor, type ControlAction } from "./routine-controls";
import { phaseClass, phaseLabel, routineStatusClass } from "./status-style";

/**
 * 统一「Edit Routine」抽屉 —— 以判别式联合 `mode` 驱动 5 种形态，替代原先割裂的
 * RoutineDetailDrawer（只读）+ RoutineFormDialog（模态）+ TemplateDetailDrawer +
 * TemplateFormDialog（向导）+ InlineCreateFromTemplate（被遮挡的内联展开）。
 *
 * 正交分解：entity ∈ {routine, template} × op ∈ {create, edit} + 一个 use-template 实例化态。
 * 页面是「当前打开哪个 mode」的单一事实源；抽屉为受控壳层，仅自持表单草稿态。
 */
export type DrawerMode =
  | { kind: "routine-create" }
  | { kind: "routine-edit"; routine: RoutineDTO }
  | { kind: "template-create" }
  | { kind: "template-edit"; template: RoutineTemplateItem }
  | { kind: "use-template"; template: RoutineTemplateItem };

/** 供页面生成 React key —— 同一实体（kind+id）保持稳定以免 SSE 刷新重挂导致草稿丢失。 */
export function drawerKey(mode: DrawerMode): string {
  switch (mode.kind) {
    case "routine-edit":
      return `routine-edit:${mode.routine.id}`;
    case "template-edit":
      return `template-edit:${mode.template.id}`;
    case "use-template":
      return `use-template:${mode.template.id}`;
    default:
      return mode.kind;
  }
}

interface RoutineEditDrawerProps {
  mode: DrawerMode;
  onClose: () => void;
  /** 创建/更新成功回调，由页面决定后续导航/刷新。 */
  onSaved: (result: RoutineDTO, kind: DrawerMode["kind"]) => void;
  /** 「Use」：由模板（template-edit）切换到实例化态 use-template（页面负责切 mode）。 */
  onUse?: (template: RoutineTemplateItem) => void;
  /** routine-edit 生命周期控制（start/pause/resume/cancel）。 */
  onControl?: (action: ControlAction) => void;
  /** routine-edit 终态（failed/cancelled）重新启动重跑（打开确认对话框）。 */
  onRestart?: (routine: RoutineDTO) => void;
  /** 删除（routine-edit 终态 / template-edit 用户模板）。 */
  onDelete?: (target: RoutineDTO | RoutineTemplateItem) => void;
  /** routine-edit「Full View →」深链到 /interface/routine/[id]。 */
  onOpenFull?: (routine: RoutineDTO) => void;
  /** 生命周期/删除进行中。 */
  busy?: boolean;
}

type Entity = "routine" | "template";

interface FormState {
  key: string;
  title: string;
  display_name: string;
  description: string;
  goal: string;
  acceptance_criteria: string;
  cwd: string;
  baseline_branch: string;
  verification_command: string;
  max_iterations: string;
  max_cost_usd: string;
  success_score_threshold: string;
  no_progress_patience: string;
  approval_mode: ApprovalMode;
  // Claude Code config 覆盖（routine entity）
  model: string;
  max_turns: string;
  max_events_per_iter: string;
  permission_mode: string;
  allowed_tools: string;
  timeout_seconds: string;
  // 模板元数据（template entity）
  category: string;
  version: string;
  features_showcase: string;
}

const DEFAULTS: FormState = {
  key: "",
  title: "",
  display_name: "",
  description: "",
  goal: "",
  acceptance_criteria: "",
  cwd: "",
  baseline_branch: "",
  verification_command: "",
  max_iterations: "20",
  max_cost_usd: "5",
  success_score_threshold: "85",
  no_progress_patience: "3",
  approval_mode: "auto",
  model: "",
  max_turns: "1000",
  max_events_per_iter: "",
  permission_mode: "",
  allowed_tools: "",
  timeout_seconds: "",
  category: "general",
  version: "1.0.0",
  features_showcase: "",
};

const APPROVAL_OPTIONS: { value: ApprovalMode; label: string }[] = [
  { value: "auto", label: "Auto (fully autonomous)" },
  { value: "first", label: "First iteration approval" },
  { value: "every", label: "Every iteration approval" },
];

const APPROVAL_HELP: Record<ApprovalMode, string> = {
  auto: "Runs autonomously after creation until it completes or is terminated.",
  first: "The first execution requires manual approval; later iterations run automatically.",
  every: "Every iteration requires manual approval before it executes.",
};

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "quality", label: "Quality" },
  { value: "testing", label: "Testing" },
  { value: "documentation", label: "Documentation" },
  { value: "custom", label: "Custom" },
];

/** 从 config 提取 Claude Code 覆盖键 → 表单字符串。 */
function ccFromConfig(cfg: Record<string, unknown>): Pick<FormState, "model" | "max_turns" | "max_events_per_iter" | "permission_mode" | "allowed_tools" | "timeout_seconds"> {
  return {
    model: (cfg.model as string) ?? "",
    max_turns: cfg.max_turns != null ? String(cfg.max_turns) : "1000",
    max_events_per_iter: cfg.max_events_per_iter != null ? String(cfg.max_events_per_iter) : "",
    permission_mode: (cfg.permission_mode as string) ?? "",
    allowed_tools: Array.isArray(cfg.allowed_tools) ? (cfg.allowed_tools as string[]).join(", ") : "",
    timeout_seconds: cfg.timeout_seconds != null ? String(cfg.timeout_seconds) : "",
  };
}

/** 将表单 CC 配置字段写入 config 对象（原地修改，ccFromConfig 的逆操作）。 */
function applyCCConfig(
  config: Record<string, unknown>,
  form: Pick<FormState, "model" | "max_turns" | "max_events_per_iter" | "permission_mode" | "allowed_tools" | "timeout_seconds">,
): void {
  if (form.model.trim()) config.model = form.model.trim();
  else delete config.model;
  if (form.max_turns.trim()) config.max_turns = parseInt(form.max_turns, 10);
  else delete config.max_turns;
  if (form.max_events_per_iter.trim()) config.max_events_per_iter = parseInt(form.max_events_per_iter, 10);
  else delete config.max_events_per_iter;
  if (form.permission_mode.trim()) config.permission_mode = form.permission_mode.trim();
  else delete config.permission_mode;
  if (form.allowed_tools.trim()) config.allowed_tools = form.allowed_tools.split(",").map((s) => s.trim()).filter(Boolean);
  else delete config.allowed_tools;
  if (form.timeout_seconds.trim()) config.timeout_seconds = parseInt(form.timeout_seconds, 10);
  else delete config.timeout_seconds;
}

/** 依 mode 构造初始表单（仅在挂载时调用一次，避免 SSE 刷新回灌草稿）。 */
function buildInitial(mode: DrawerMode): FormState {
  switch (mode.kind) {
    case "routine-create":
    case "template-create":
      return { ...DEFAULTS };
    case "routine-edit": {
      const r = mode.routine;
      const cfg = (r.config ?? {}) as Record<string, unknown>;
      const nameVal = r.display_name || r.title || "";
      return {
        ...DEFAULTS,
        key: r.key,
        title: nameVal,
        display_name: nameVal,
        description: r.description ?? "",
        goal: r.goal,
        acceptance_criteria: r.acceptance_criteria,
        cwd: r.cwd ?? "",
        baseline_branch: r.baseline_branch ?? "",
        verification_command: r.verification_command ?? "",
        max_iterations: r.max_iterations != null ? String(r.max_iterations) : "",
        max_cost_usd: r.max_cost_usd != null ? String(r.max_cost_usd) : "",
        success_score_threshold: String(r.success_score_threshold),
        no_progress_patience: String(r.no_progress_patience),
        approval_mode: r.approval_mode,
        ...ccFromConfig(cfg),
      };
    }
    case "template-edit": {
      const t = mode.template;
      const cfg = (t.config ?? {}) as Record<string, unknown>;
      const nameVal = t.display_name || t.title || "";
      return {
        ...DEFAULTS,
        key: t.key,
        title: nameVal,
        display_name: nameVal,
        description: t.description ?? "",
        goal: t.goal,
        acceptance_criteria: t.acceptance_criteria,
        verification_command: t.verification_command ?? "",
        max_iterations: t.max_iterations != null ? String(t.max_iterations) : "",
        max_cost_usd: t.max_cost_usd != null ? String(t.max_cost_usd) : "",
        success_score_threshold: String(t.success_score_threshold),
        no_progress_patience: String(t.no_progress_patience),
        approval_mode: t.approval_mode,
        ...ccFromConfig(cfg),
        category: t.category || "general",
        version: t.version || "1.0.0",
        features_showcase: Array.isArray(t.features_showcase) ? t.features_showcase.join(", ") : "",
      };
    }
    case "use-template": {
      const t = mode.template;
      const cfg = (t.config ?? {}) as Record<string, unknown>;
      const nameVal = t.display_name || t.title || "";
      return {
        ...DEFAULTS,
        // 从模板预填一个具体 Routine（key 自动生成、cwd 必填留空）
        key: `${t.key}-${crypto.randomUUID().slice(0, 4)}`,
        title: nameVal,
        display_name: nameVal,
        description: t.description ?? "",
        goal: t.goal,
        acceptance_criteria: t.acceptance_criteria,
        verification_command: t.verification_command ?? "",
        max_iterations: t.max_iterations != null ? String(t.max_iterations) : "",
        max_cost_usd: t.max_cost_usd != null ? String(t.max_cost_usd) : "",
        success_score_threshold: String(t.success_score_threshold),
        no_progress_patience: String(t.no_progress_patience),
        approval_mode: t.approval_mode,
        ...ccFromConfig(cfg),
      };
    }
  }
}

export function RoutineEditDrawer({
  mode,
  onClose,
  onSaved,
  onUse,
  onControl,
  onRestart,
  onDelete,
  onOpenFull,
  busy,
}: RoutineEditDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { confirm, confirmDialog } = useConfirmDialog();

  // ── 派生 mode 维度 ──
  const entity: Entity = mode.kind === "template-create" || mode.kind === "template-edit" ? "template" : "routine";
  const op: "create" | "edit" = mode.kind === "routine-edit" || mode.kind === "template-edit" ? "edit" : "create";
  const liveRoutine = mode.kind === "routine-edit" ? mode.routine : null;
  const isRunning = liveRoutine?.status === "running";
  const isBuiltinTemplate = mode.kind === "template-edit" && mode.template.source === "builtin";
  // 仅运行中锁定；内置模板改为「可编辑 → 另存为我的模板」(copy-on-write, #794)，以 create 语义提交用户副本。
  const readOnly = isRunning;
  // 可执行 routine（非模板）必须提供 Project Path (cwd) + Baseline Branch（隔离 worktree 前提）。
  const requireWorktree = entity === "routine";

  // ── 表单草稿态（仅挂载时 seed 一次）──
  const [form, setForm] = useState<FormState>(() => buildInitial(mode));
  // 脏检测基线：state（非 ref，避免 render 期读 ref），编辑保存成功后于事件中重置。
  // 用 form 的初值同源 seed（initializer 仅挂载时取值），避免 use-template 的随机 key 双生致恒脏。
  const [baseline, setBaseline] = useState<FormState>(form);
  const [showAdvanced, setShowAdvanced] = useState(
    () =>
      !!(
        form.description.trim() ||
        form.approval_mode !== "auto" ||
        form.max_iterations !== DEFAULTS.max_iterations ||
        form.max_cost_usd !== DEFAULTS.max_cost_usd ||
        form.model ||
        form.max_turns !== DEFAULTS.max_turns ||
        form.permission_mode ||
        form.allowed_tools ||
        form.timeout_seconds ||
        form.max_events_per_iter ||
        form.verification_command.trim()
      ),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const confirmingRef = useRef(false); // 弃改确认进行中 → 抑制重复关闭

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => (e[k as string] ? { ...e, [k as string]: "" } : e));
  };

  /** Name 字段同步 title + display_name（合并冗余字段）。 */
  const updateName = (v: string) => {
    setForm((f) => ({ ...f, title: v, display_name: v }));
    setFieldErrors((e) => {
      if (!e.title && !e.display_name) return e;
      const n = { ...e };
      delete n.title;
      delete n.display_name;
      return n;
    });
  };

  // ── 关闭（脏则二次确认，防误丢编辑）──
  const requestClose = useCallback(async () => {
    if (confirmingRef.current) return;
    if (!isDirty) {
      onClose();
      return;
    }
    confirmingRef.current = true;
    const ok = await confirm({
      title: "Discard changes?",
      message: "You have unsaved changes. Closing now will discard them.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      destructive: true,
    });
    confirmingRef.current = false;
    if (ok) onClose();
  }, [isDirty, confirm, onClose]);

  // Escape 关闭（确认弹层打开时由 confirmingRef 抑制）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [requestClose]);

  // 焦点陷阱 + 焦点回归（无障碍）
  useFocusTrap(panelRef, true);

  // translateX 滑入（复用原抽屉手法）
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = "translateX(100%)";
    requestAnimationFrame(() => {
      el.style.transition = "transform 200ms ease-out";
      el.style.transform = "translateX(0)";
    });
  }, []);

  // 运行中锁定不静默：若 SSE 将状态翻为 running 时用户尚有未保存编辑，明确告警而非默默锁字段、隐藏 Save。
  const wasRunningRef = useRef(isRunning);
  useEffect(() => {
    if (isRunning && !wasRunningRef.current && isDirty) {
      toast.warning("This Routine just started running — unsaved edits can't be saved until you pause it.");
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, isDirty]);

  // ── 提交 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    const errs: Record<string, string> = {};
    // 内置模板另存为副本走 create 语义，同样需要唯一 Key（op 仍为 edit，故单列判断）。
    if ((op === "create" || isBuiltinTemplate) && !form.key.trim()) errs.key = "Key is required";
    if (!form.title.trim()) errs.title = "Name is required";
    if (!form.goal.trim()) errs.goal = "Goal is required";
    if (!form.acceptance_criteria.trim()) errs.acceptance_criteria = "Acceptance criteria is required";
    if (requireWorktree && !form.cwd.trim()) errs.cwd = "Project Path is required";
    if (requireWorktree && !form.baseline_branch.trim()) errs.baseline_branch = "Baseline Branch is required";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Fix the highlighted fields before saving.");
      return;
    }

    setLoading(true);
    setError(null);

    // 公共字段
    const common = {
      title: form.title.trim(),
      goal: form.goal.trim(),
      acceptance_criteria: form.acceptance_criteria.trim(),
      verification_command: form.verification_command.trim() || null,
      max_iterations: form.max_iterations.trim() ? parseInt(form.max_iterations, 10) : null,
      max_cost_usd: form.max_cost_usd.trim() ? parseFloat(form.max_cost_usd) : null,
      success_score_threshold: parseInt(form.success_score_threshold, 10) || 85,
      no_progress_patience: parseInt(form.no_progress_patience, 10) || 3,
      approval_mode: form.approval_mode,
      display_name: form.display_name.trim() || null,
      description: form.description.trim() || null,
    };

    let config: Record<string, unknown>;
    let extra: Partial<RoutineCreatePayload> = {};
    if (entity === "routine") {
      // 继承既有 config，仅增删本表单管理的 CC 键，保留 system_prompt 等未暴露键
      const inherited =
        mode.kind === "routine-edit"
          ? ((mode.routine.config as Record<string, unknown>) ?? {})
          : mode.kind === "use-template"
            ? ((mode.template.config as Record<string, unknown>) ?? {})
            : {};
      config = { ...inherited };
      applyCCConfig(config, form);
      extra = { cwd: form.cwd.trim() || null, baseline_branch: form.baseline_branch.trim() || null };
    } else {
      // 模板元数据收敛进 config（与列表 API 的读取契约对齐）
      const inherited =
        mode.kind === "template-edit" ? ((mode.template.config as Record<string, unknown>) ?? {}) : {};
      config = {
        ...inherited,
        category: form.category.trim() || "general",
        version: form.version.trim() || "1.0.0",
        features_showcase: form.features_showcase.split(",").map((s) => s.trim()).filter(Boolean),
      };
      applyCCConfig(config, form);
      extra = { is_template: true };
    }

    const base = { ...common, ...extra, config };

    try {
      let result: RoutineDTO;
      // 内置模板（builtin）无可改写的后端实体，编辑保存=另存为新的用户模板，故走 create 分支。
      if ((mode.kind === "routine-edit" || mode.kind === "template-edit") && !isBuiltinTemplate) {
        // 用判别式收窄取 id（不用 as 强转，保持联合的穷尽性，未来新增 mode 时由编译器兜底）。
        const id = mode.kind === "routine-edit" ? mode.routine.id : mode.template.id;
        result = await updateRoutine(id, base as RoutineUpdatePayload);
        toast.success(entity === "template" ? "Template updated" : "Routine updated");
        setBaseline(form); // 重置脏基线（edit 类抽屉保持打开）
      } else {
        // 含：routine-create / template-create / use-template / 内置模板「另存为我的模板」(copy-on-write)
        result = await createRoutine({ ...base, key: form.key.trim() } as RoutineCreatePayload);
        toast.success(
          isBuiltinTemplate
            ? `Saved "${form.display_name.trim() || form.title.trim()}" as your template`
            : mode.kind === "template-create"
              ? "Template created"
              : mode.kind === "use-template"
                ? `Routine created from "${mode.template.display_name}"`
                : "Routine created",
        );
      }
      onSaved(result, mode.kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      // 内置模板另存时 Key 撞库（后端 409 "key already exists"）→ 定位到 Key 字段并给出修复指引
      // （error-placement / error-clarity / aria-live-errors），而非仅顶部一条泛化报错。
      if (isBuiltinTemplate && /already exists/i.test(msg)) {
        setFieldErrors((e) => ({ ...e, key: "This key already exists — choose a different one." }));
        setError("A template with this key already exists. Edit the Key field and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 标题 / 副标题 ──
  const heading = {
    "routine-create": "New Routine",
    "routine-edit": "Edit Routine",
    "template-create": "New Template",
    "template-edit": "Edit Template",
    "use-template": "New Routine",
  }[mode.kind];

  const subtitle = (() => {
    switch (mode.kind) {
      case "routine-create":
        return "Define a long-horizon autonomous task.";
      case "routine-edit":
        return `Editing "${mode.routine.display_name || mode.routine.title}"`;
      case "template-create":
        return "Create a reusable Routine template.";
      case "template-edit":
        return `Editing template "${mode.template.display_name}"`;
      case "use-template":
        return `From template "${mode.template.display_name}"`;
    }
  })();

  /* ── 样式常量 ── */
  const inputCls =
    "w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
  const labelCls = "mb-1 block text-xs font-medium text-text-secondary";
  const labelInlineCls = "shrink-0 whitespace-nowrap text-xs font-medium text-text-secondary";
  const reqMark = <span className="text-red-500"> *</span>;

  // 字段级错误渲染助手（普通函数，非组件 —— 避免 render 期创建组件丢失状态）。
  const renderFieldError = (name: string) =>
    fieldErrors[name] ? (
      <p role="alert" className="mt-0.5 text-xs text-red-500">
        {fieldErrors[name]}
      </p>
    ) : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" onClick={() => void requestClose()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-50 flex [width:clamp(480px,66.67%,1100px)] flex-col border-l border-border bg-card shadow-xl outline-none"
        style={{ transform: "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="text-base font-bold text-foreground">
                {heading}
              </h2>
              {liveRoutine && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${routineStatusClass(liveRoutine.status)}`}
                >
                  {liveRoutine.status}
                </span>
              )}
              {liveRoutine?.current_phase && liveRoutine.status === "running" && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${phaseClass(liveRoutine.current_phase)}`}
                >
                  {phaseLabel(liveRoutine.current_phase)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {mode.kind === "routine-edit" && onOpenFull && (
              <button
                type="button"
                onClick={() => onOpenFull(mode.routine)}
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary underline-offset-4 transition-colors hover:bg-muted/50 hover:underline"
              >
                Full View
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void requestClose()}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {/* 运行中锁定（只读，中性条）—— 含恢复路径 */}
            {readOnly && (
              <div className="rounded-card border border-border bg-muted/40 px-4 py-2.5 text-xs text-text-secondary">
                This Routine is running. Pause it to edit its configuration.
              </div>
            )}

            {/* 内置模板：copy-on-write 信息条（非锁定语义；主色调以与禁用/只读态视觉区分） */}
            {isBuiltinTemplate && (
              <div
                role="note"
                className="rounded-card border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-text-secondary"
              >
                Built-in preset. Editing and saving creates{" "}
                <strong className="font-medium text-foreground">your own editable copy</strong>; the built-in preset
                stays unchanged. You can also click <strong className="font-medium text-foreground">Use</strong> to
                create a Routine directly.
              </div>
            )}

            {error && <ErrorBanner message={error} />}

            {/* ── Identity ── */}
            <div>
              <label className={labelCls}>Name{reqMark}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateName(e.target.value)}
                disabled={readOnly}
                placeholder="My routine"
                className={cn(inputCls, fieldErrors.title && "border-red-400")}
              />
              {renderFieldError("title")}
              {/* Key: editable for create/builtin, muted text for edit */}
              {(op === "create" || isBuiltinTemplate) ? (
                <div className="mt-1.5">
                  <label className={labelCls}>Key{reqMark}</label>
                  <input
                    type="text"
                    value={form.key}
                    onChange={(e) => update("key", e.target.value)}
                    disabled={readOnly}
                    placeholder="unique_key"
                    className={cn(inputCls, "font-mono text-xs", fieldErrors.key && "border-red-400")}
                  />
                  {renderFieldError("key")}
                  {isBuiltinTemplate && !fieldErrors.key && (
                    <p className="mt-0.5 text-xs text-text-secondary">Saved as a new template — pick a unique key.</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs font-mono text-text-secondary">key: {form.key}</p>
              )}
            </div>

            {/* ── Objective（视觉重心）── */}
            <div>
              <label className={labelCls}>Goal{reqMark}</label>
              <textarea
                value={form.goal}
                onChange={(e) => update("goal", e.target.value)}
                disabled={readOnly}
                rows={6}
                placeholder="What should Claude Code accomplish?"
                className={cn(inputCls, "resize-y", fieldErrors.goal && "border-red-400")}
              />
              {renderFieldError("goal")}
            </div>
            <div>
              <label className={labelCls}>Acceptance Criteria{reqMark}</label>
              <textarea
                value={form.acceptance_criteria}
                onChange={(e) => update("acceptance_criteria", e.target.value)}
                disabled={readOnly}
                rows={4}
                placeholder="How do you judge success?"
                className={cn(inputCls, "resize-y", fieldErrors.acceptance_criteria && "border-red-400")}
              />
              {renderFieldError("acceptance_criteria")}
            </div>

            {/* ── Execution Context（仅 routine entity）── */}
            {entity === "routine" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Project Path{requireWorktree && reqMark}</label>
                  <input
                    type="text"
                    value={form.cwd}
                    onChange={(e) => update("cwd", e.target.value)}
                    disabled={readOnly}
                    placeholder="/path/to/repo"
                    className={cn(inputCls, fieldErrors.cwd && "border-red-400")}
                  />
                  {renderFieldError("cwd")}
                </div>
                <div>
                  <label className={labelCls}>Baseline Branch{requireWorktree && reqMark}</label>
                  <input
                    type="text"
                    value={form.baseline_branch}
                    onChange={(e) => update("baseline_branch", e.target.value)}
                    disabled={readOnly}
                    placeholder="e.g. origin/feature/1.x.x"
                    className={cn(inputCls, fieldErrors.baseline_branch && "border-red-400")}
                  />
                  {renderFieldError("baseline_branch")}
                </div>
              </div>
            )}

            {/* ── Verification ── */}
            <div>
              <label className={labelCls}>Verification Command</label>
              <input
                type="text"
                value={form.verification_command}
                onChange={(e) => update("verification_command", e.target.value)}
                disabled={readOnly}
                placeholder="e.g. uv run pytest -q"
                className={inputCls}
              />
              <p className="mt-1 text-caption text-text-secondary">
                Test-driven gate — a non-zero exit code caps the score, mitigating LLM-judge bias.
              </p>
            </div>

            {/* ── Advanced Settings（统一折叠区）── */}
            <section>
              <button
                type="button"
                onClick={() => setShowAdvanced((p) => !p)}
                aria-expanded={showAdvanced}
                className="group flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-caption font-medium text-text-secondary transition-colors hover:bg-muted"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn("h-3.5 w-3.5 text-text-muted transition-transform duration-150", showAdvanced && "rotate-180")}
                />
                <span>{showAdvanced ? "Hide advanced settings" : "Budget, Approval & Advanced settings"}</span>
              </button>

              {showAdvanced && (
                <div className="mt-2 space-y-4 rounded-card border border-border bg-muted/30 p-4">
                  {/* Budget & Approval */}
                  <div>
                    <h4 className="mb-2 text-xs font-medium text-text-secondary">Budget &amp; Approval</h4>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Max Iterations</label>
                        <input
                          type="number"
                          min={1}
                          value={form.max_iterations}
                          onChange={(e) => update("max_iterations", e.target.value)}
                          disabled={readOnly}
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Max Cost (USD)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={form.max_cost_usd}
                          onChange={(e) => update("max_cost_usd", e.target.value)}
                          disabled={readOnly}
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Score Threshold</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.success_score_threshold}
                          onChange={(e) => update("success_score_threshold", e.target.value)}
                          disabled={readOnly}
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>No-Progress Limit</label>
                        <input
                          type="number"
                          min={1}
                          value={form.no_progress_patience}
                          onChange={(e) => update("no_progress_patience", e.target.value)}
                          disabled={readOnly}
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Max Turns / Iter.</label>
                        <input
                          type="number"
                          min={1}
                          value={form.max_turns}
                          onChange={(e) => update("max_turns", e.target.value)}
                          disabled={readOnly}
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Max Events / Iter.</label>
                        <input
                          type="number"
                          min={100}
                          max={100000}
                          value={form.max_events_per_iter}
                          onChange={(e) => update("max_events_per_iter", e.target.value)}
                          disabled={readOnly}
                          placeholder="5000"
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Timeout</label>
                        <input
                          type="number"
                          min={300}
                          max={86400}
                          value={form.timeout_seconds}
                          onChange={(e) => update("timeout_seconds", e.target.value)}
                          disabled={readOnly}
                          placeholder="10800"
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-2">
                      <label className={cn(labelInlineCls, "pt-2")}>Approval Mode</label>
                      <div className="min-w-0 flex-1">
                        <select
                          value={form.approval_mode}
                          onChange={(e) => update("approval_mode", e.target.value as ApprovalMode)}
                          disabled={readOnly}
                          className={inputCls}
                        >
                          {APPROVAL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-caption text-text-secondary">{APPROVAL_HELP[form.approval_mode]}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="border-t border-border pt-3">
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => update("description", e.target.value)}
                      disabled={readOnly}
                      rows={2}
                      placeholder="Short summary of what this does"
                      className={cn(inputCls, "resize-y")}
                    />
                  </div>

                  {/* Template Metadata（仅 template entity）*/}
                  {entity === "template" && (
                    <div className="border-t border-border pt-3">
                      <h4 className="mb-2 text-xs font-medium text-text-secondary">Template Metadata</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Category</label>
                          <select
                            value={form.category}
                            onChange={(e) => update("category", e.target.value)}
                            disabled={readOnly}
                            className={inputCls}
                          >
                            {CATEGORY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Version</label>
                          <input
                            type="text"
                            value={form.version}
                            onChange={(e) => update("version", e.target.value)}
                            disabled={readOnly}
                            placeholder="1.0.0"
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className={labelCls}>Features</label>
                        <input
                          type="text"
                          value={form.features_showcase}
                          onChange={(e) => update("features_showcase", e.target.value)}
                          disabled={readOnly}
                          placeholder="feature 1, feature 2, feature 3"
                          className={inputCls}
                        />
                        <p className="mt-1 text-caption text-text-secondary">
                          Feature tags shown on the template card (comma-separated).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Claude Code Config */}
                  <div className="border-t border-border pt-3">
                      <h4 className="mb-2 text-xs font-medium text-text-secondary">Claude Code Config</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <label className={labelInlineCls}>Model</label>
                          <input
                            type="text"
                            value={form.model}
                            onChange={(e) => update("model", e.target.value)}
                            disabled={readOnly}
                            placeholder="inherit global config"
                            className={cn(inputCls, "min-w-0 flex-1")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className={labelInlineCls}>Permission Mode</label>
                          <select
                            value={form.permission_mode}
                            onChange={(e) => update("permission_mode", e.target.value)}
                            disabled={readOnly}
                            className={cn(inputCls, "min-w-0 flex-1")}
                          >
                            <option value="">default</option>
                            <option value="auto">auto</option>
                            <option value="ask">ask</option>
                            <option value="plan">plan</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <label className={labelInlineCls}>Allowed Tools</label>
                        <input
                          type="text"
                          value={form.allowed_tools}
                          onChange={(e) => update("allowed_tools", e.target.value)}
                          disabled={readOnly}
                          placeholder="Bash, Read, Write, Edit, Glob, Grep"
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                    </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t border-border px-5 py-3">
            {/* 左簇：routine-edit 生命周期控制 / template-edit 删除 */}
            {mode.kind === "routine-edit" &&
              onControl &&
              controlsFor(mode.routine.status).map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "cancel" ? "danger" : "neutral"}
                  size="sm"
                  disabled={busy}
                  onClick={() => onControl(action)}
                >
                  {CONTROL_LABEL[action]}
                </Button>
              ))}
            {mode.kind === "routine-edit" && onRestart && canRestart(mode.routine.status) && (
              <Button
                type="button"
                variant="neutral"
                size="sm"
                disabled={busy}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => onRestart(mode.routine)}
              >
                Restart
              </Button>
            )}
            {mode.kind === "template-edit" && !isBuiltinTemplate && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(mode.template)}
                disabled={busy || loading}
                className="flex cursor-pointer items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}

            <div className="flex-1" />

            {/* 右簇：取消 / Use / Save / Create / Delete(routine 终态) */}
            {op === "create" && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void requestClose()} disabled={loading}>
                Cancel
              </Button>
            )}
            {mode.kind === "template-edit" && onUse && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => onUse(mode.template)}
              >
                Use
              </Button>
            )}
            {!readOnly && (
              <Button type="submit" variant="primary" size="sm" loading={loading}>
                {isBuiltinTemplate
                  ? "Save as my copy"
                  : op === "edit"
                    ? "Save"
                    : entity === "template"
                      ? "Create Template"
                      : "Create Routine"}
              </Button>
            )}
            {mode.kind === "routine-edit" &&
              onDelete &&
              ["succeeded", "failed", "cancelled"].includes(mode.routine.status) && (
                <button
                  type="button"
                  onClick={() => onDelete(mode.routine)}
                  disabled={busy || loading}
                  className="flex cursor-pointer items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
          </div>
        </form>
      </div>

      {confirmDialog}
    </>
  );
}
