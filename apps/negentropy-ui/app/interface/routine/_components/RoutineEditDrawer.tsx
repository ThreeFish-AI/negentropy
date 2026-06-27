"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { cn } from "@/lib/utils";
import { createRoutine, updateRoutine } from "@/features/routine";
import type {
  ApprovalMode,
  RoutineCreatePayload,
  RoutineDTO,
  RoutineTemplateItem,
  RoutineUpdatePayload,
} from "@/features/routine";
import { fetchRepositories } from "@/features/repositories";
import type { RepositoryDTO } from "@/features/repositories";

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

/**
 * Running 状态下允许在线调整的字段集（与后端 _RUNTIME_SAFE_FIELDS 严格对齐）。
 * 不在此集合中的字段在 Running 状态下禁用编辑，需 Pause 后方可修改。
 */
const RUNTIME_SAFE_FIELDS: ReadonlySet<string> = new Set([
  "success_score_threshold",
  "max_iterations",
  "max_cost_usd",
  "deadline_at",
  "no_progress_patience",
  "title",
  "display_name",
  "description",
]);

interface FormState {
  key: string;
  title: string;
  display_name: string;
  description: string;
  goal: string;
  acceptance_criteria: string;
  cwd: string;
  baseline_branch: string;
  /** 关联的已注册 Repository id（空串 = 未关联 = 手填模式）。 */
  repository_id: string;
  verification_command: string;
  max_iterations: string;
  max_cost_usd: string;
  success_score_threshold: string;
  no_progress_patience: string;
  deadline_at: string; // ISO datetime-local string（YYYY-MM-DDTHH:mm）
  approval_mode: ApprovalMode;
  // Claude Code config 覆盖（routine entity）
  model: string;
  max_turns: string;
  max_events_per_iter: string;
  permission_mode: string;
  allowed_tools: string;
  read_dirs: string;
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
  repository_id: "",
  verification_command: "",
  max_iterations: "20",
  max_cost_usd: "5",
  success_score_threshold: "85",
  no_progress_patience: "3",
  deadline_at: "",
  approval_mode: "auto",
  model: "",
  max_turns: "1000",
  max_events_per_iter: "",
  permission_mode: "",
  allowed_tools: "",
  read_dirs: "",
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
function ccFromConfig(cfg: Record<string, unknown>): Pick<FormState, "model" | "max_turns" | "max_events_per_iter" | "permission_mode" | "allowed_tools" | "read_dirs" | "timeout_seconds"> {
  return {
    model: (cfg.model as string) ?? "",
    max_turns: cfg.max_turns != null ? String(cfg.max_turns) : "1000",
    max_events_per_iter: cfg.max_events_per_iter != null ? String(cfg.max_events_per_iter) : "",
    permission_mode: (cfg.permission_mode as string) ?? "",
    allowed_tools: Array.isArray(cfg.allowed_tools) ? (cfg.allowed_tools as string[]).join(", ") : "",
    read_dirs: Array.isArray(cfg.read_dirs) ? (cfg.read_dirs as string[]).join(", ") : "",
    timeout_seconds: cfg.timeout_seconds != null ? String(cfg.timeout_seconds) : "",
  };
}

/** 将表单 CC 配置字段写入 config 对象（原地修改，ccFromConfig 的逆操作）。 */
function applyCCConfig(
  config: Record<string, unknown>,
  form: Pick<FormState, "model" | "max_turns" | "max_events_per_iter" | "permission_mode" | "allowed_tools" | "read_dirs" | "timeout_seconds">,
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
  if (form.read_dirs.trim()) config.read_dirs = form.read_dirs.split(",").map((s) => s.trim()).filter(Boolean);
  else delete config.read_dirs;
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
        repository_id: r.repository_id ?? "",
        verification_command: r.verification_command ?? "",
        max_iterations: r.max_iterations != null ? String(r.max_iterations) : "",
        max_cost_usd: r.max_cost_usd != null ? String(r.max_cost_usd) : "",
        success_score_threshold: String(r.success_score_threshold),
        no_progress_patience: String(r.no_progress_patience),
        deadline_at: r.deadline_at
          ? (() => {
              // datetime-local 需要 YYYY-MM-DDTHH:mm 格式（本地时间），不能直接用 toISOString()（UTC）
              const d = new Date(r.deadline_at);
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })()
          : "",
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
  const { confirm, confirmDialog } = useConfirmDialog();

  // ── 派生 mode 维度 ──
  const entity: Entity = mode.kind === "template-create" || mode.kind === "template-edit" ? "template" : "routine";
  const op: "create" | "edit" = mode.kind === "routine-edit" || mode.kind === "template-edit" ? "edit" : "create";
  const liveRoutine = mode.kind === "routine-edit" ? mode.routine : null;
  const isRunning = liveRoutine?.status === "running";
  const isBuiltinTemplate = mode.kind === "template-edit" && mode.template.source === "builtin";
  // 运行中精准锁定：仅运行时安全字段（RUNTIME_SAFE_FIELDS）可编辑，其余字段保持禁用。
  // 内置模板改为「可编辑 → 另存为我的模板」(copy-on-write, #794)，以 create 语义提交用户副本。

  /** 判断指定字段是否应在当前状态下禁用编辑。 */
  const isFieldDisabled = useCallback(
    (fieldName: string): boolean => {
      if (isRunning) return !RUNTIME_SAFE_FIELDS.has(fieldName);
      return false;
    },
    [isRunning],
  );
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
        form.deadline_at ||
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

  // ── Repository 关联选择（仅 routine entity）——单一事实源：选定后仅提交 repository_id，
  //    cwd/baseline 由后端派生（提交 null）；未选则回退手填 cwd/baseline。──
  const [repos, setRepos] = useState<RepositoryDTO[]>([]);
  useEffect(() => {
    if (entity !== "routine") return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchRepositories();
        if (!cancelled) setRepos(list);
      } catch {
        /* 静默：下拉退化为空，仍可手填 cwd/baseline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity]);
  const selectedRepo = useMemo(
    () => repos.find((r) => r.id === form.repository_id) ?? null,
    [repos, form.repository_id],
  );
  const repoLinked = entity === "routine" && !!form.repository_id;
  const onPickRepository = (repoId: string) => {
    setForm((f) => ({ ...f, repository_id: repoId }));
    setFieldErrors((e) => ({ ...e, cwd: "", baseline_branch: "" }));
  };

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  /** Running 状态下是否有运行时安全字段被修改（决定 Save 按钮是否显示）。非运行态复用 isDirty。 */
  const hasRuntimeSafeDirty = useMemo(() => {
    if (!isRunning) return isDirty;
    const changed = (Object.keys(form) as (keyof FormState)[]).filter(
      (k) => JSON.stringify(form[k]) !== JSON.stringify(baseline[k]),
    );
    return changed.some((k) => RUNTIME_SAFE_FIELDS.has(k as string));
  }, [isRunning, isDirty, form, baseline]);

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

  // 运行中状态翻转提醒：SSE 将状态翻为 running 时，告知用户哪些字段可在线调整。
  const wasRunningRef = useRef(isRunning);
  useEffect(() => {
    if (isRunning && !wasRunningRef.current && isDirty) {
      toast.warning("This Routine just started running — budget & threshold fields can still be saved live. Pause to edit goal or workspace settings.");
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, isDirty]);

  // ── 提交 ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Running 状态下验证逻辑仅覆盖安全字段；非运行状态下全量验证。
    const errs: Record<string, string> = {};
    if (!isRunning) {
      // 内置模板另存为副本走 create 语义，同样需要唯一 Key（op 仍为 edit，故单列判断）。
      if ((op === "create" || isBuiltinTemplate) && !form.key.trim()) errs.key = "Key is required";
      if (!form.title.trim()) errs.title = "Name is required";
      if (!form.goal.trim()) errs.goal = "Goal is required";
      if (!form.acceptance_criteria.trim()) errs.acceptance_criteria = "Acceptance criteria is required";
      // 关联 Repository 时由后端派生 cwd/baseline，跳过手填必填校验；未关联则照旧。
      if (requireWorktree && !repoLinked && !form.cwd.trim()) errs.cwd = "Project Path is required";
      if (requireWorktree && !repoLinked && !form.baseline_branch.trim())
        errs.baseline_branch = "Baseline Branch is required";
    } else {
      // Running 状态：安全字段的基本验证
      if (!form.title.trim()) errs.title = "Name is required";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Fix the highlighted fields before saving.");
      return;
    }

    setLoading(true);
    setError(null);

    // 公共字段（含 deadline_at）
    const common = {
      title: form.title.trim(),
      goal: form.goal.trim(),
      acceptance_criteria: form.acceptance_criteria.trim(),
      verification_command: form.verification_command.trim() || null,
      max_iterations: form.max_iterations.trim() ? parseInt(form.max_iterations, 10) : null,
      max_cost_usd: form.max_cost_usd.trim() ? parseFloat(form.max_cost_usd) : null,
      success_score_threshold: parseInt(form.success_score_threshold, 10) || 85,
      no_progress_patience: parseInt(form.no_progress_patience, 10) || 3,
      deadline_at: form.deadline_at ? new Date(form.deadline_at).toISOString() : null,
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
      // 单一事实源：关联 Repository 时仅提交 repository_id（cwd/baseline 由后端派生，提交 null）；
      // 未关联则提交手填 cwd/baseline、清空 repository_id。
      extra = form.repository_id
        ? { repository_id: form.repository_id, cwd: null, baseline_branch: null }
        : {
            repository_id: null,
            cwd: form.cwd.trim() || null,
            baseline_branch: form.baseline_branch.trim() || null,
          };
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

        if (isRunning) {
          // Running 状态下仅提交「相对 baseline 真正变更」的运行时安全字段（与后端 _RUNTIME_SAFE_FIELDS 对齐）：
          // ① 非安全字段的脏变更保留在 form 草稿中，待 pause 后提交；
          // ② 只发变更字段而非全量安全集，避免抽屉打开期间他端对 title / description / deadline_at 等的并发修改被旧值覆盖。
          const safePatch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(base)) {
            const fk = k as keyof FormState;
            if (RUNTIME_SAFE_FIELDS.has(k) && JSON.stringify(form[fk]) !== JSON.stringify(baseline[fk])) {
              safePatch[k] = v;
            }
          }
          result = await updateRoutine(id, safePatch as RoutineUpdatePayload);
        } else {
          result = await updateRoutine(id, base as RoutineUpdatePayload);
        }
        toast.success(entity === "template" ? "Template updated" : isRunning ? "Runtime params updated" : "Routine updated");
        // 脏基线重置（edit 类抽屉保持打开）：运行态仅重置安全字段，保留非安全字段的草稿脏态
        // （pause 后 Save 按钮仍会出现、关闭仍会弹「Discard changes?」）；非运行态整表单重置。
        if (isRunning) {
          // 仅把安全字段并入基线（form 的安全字段值即已提交值）；非安全字段基线保持不变 → 其草稿仍计脏。
          const merged: FormState = { ...baseline };
          const draft = form as unknown as Record<string, unknown>;
          const target = merged as unknown as Record<string, unknown>;
          for (const k of RUNTIME_SAFE_FIELDS) target[k] = draft[k];
          setBaseline(merged);
        } else {
          setBaseline(form);
        }
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

  // 反向链接：派生自 Scheduler 任务（config.source_task_key，如 pdf_fidelity_patrol）。
  const sourceTaskKey =
    mode.kind === "routine-edit"
      ? (mode.routine.config as Record<string, unknown> | undefined)?.source_task_key
      : undefined;
  const sourceTaskKeyStr = typeof sourceTaskKey === "string" ? sourceTaskKey : null;

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
      <BaseDrawer
        open={true}
        title={
          <div className="flex items-center gap-2">
            <span>{heading}</span>
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
        }
        subtitle={
          <>
            {subtitle}
            {sourceTaskKeyStr && (
              <a
                href={`/interface/scheduler?task_key=${encodeURIComponent(sourceTaskKeyStr)}`}
                className="ml-2 inline-flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                派生自 Scheduler：{sourceTaskKeyStr} →
              </a>
            )}
          </>
        }
        onClose={() => void requestClose()}
        closeOnBackdrop={!loading}
        closeOnEscape={false}
        headerActions={
          mode.kind === "routine-edit" && onOpenFull ? (
            <button
              type="button"
              onClick={() => onOpenFull(mode.routine)}
              className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary underline-offset-4 transition-colors hover:bg-muted/50 hover:underline"
            >
              Full View
              <ExternalLink className="h-3 w-3" />
            </button>
          ) : undefined
        }
        footer={
          <div className="flex items-center gap-2">
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
            {(op === "create" || isBuiltinTemplate || hasRuntimeSafeDirty) && (
              <Button type="submit" form="routine-edit-form" variant="primary" size="sm" loading={loading}>
                {isBuiltinTemplate
                  ? "Save as my copy"
                  : isRunning
                    ? "Update live"
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
        }
      >
        <form id="routine-edit-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            {/* 运行中精准锁定提示 —— 安全字段可在线调整，非安全字段需 Pause */}
            {isRunning && (
              <div className="rounded-card border border-border bg-muted/40 px-4 py-2.5 text-xs text-text-secondary">
                <span className="font-medium text-foreground">Running</span> — Budget, threshold, and metadata fields can be adjusted live. Pause to modify goal, workspace, or model settings.
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
                disabled={isFieldDisabled("title")}
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
                    disabled={isFieldDisabled("key")}
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
              <label className={labelCls}>Goal{!isFieldDisabled("goal") && reqMark}</label>
              <textarea
                value={form.goal}
                onChange={(e) => update("goal", e.target.value)}
                disabled={isFieldDisabled("goal")}
                rows={6}
                placeholder="What should Claude Code accomplish?"
                className={cn(inputCls, "resize-y", fieldErrors.goal && "border-red-400")}
              />
              {renderFieldError("goal")}
            </div>
            <div>
              <label className={labelCls}>Acceptance Criteria{!isFieldDisabled("acceptance_criteria") && reqMark}</label>
              <textarea
                value={form.acceptance_criteria}
                onChange={(e) => update("acceptance_criteria", e.target.value)}
                disabled={isFieldDisabled("acceptance_criteria")}
                rows={4}
                placeholder="How do you judge success?"
                className={cn(inputCls, "resize-y", fieldErrors.acceptance_criteria && "border-red-400")}
              />
              {renderFieldError("acceptance_criteria")}
            </div>

            {/* ── Execution Context（仅 routine entity）── */}
            {entity === "routine" && (
              <>
                <div>
                  <label className={labelCls}>Repository</label>
                  <select
                    value={form.repository_id}
                    onChange={(e) => onPickRepository(e.target.value)}
                    disabled={isFieldDisabled("cwd")}
                    className={inputCls}
                  >
                    <option value="">— Manual (enter path &amp; branch below) —</option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.display_name || r.name}
                      </option>
                    ))}
                    {repoLinked && !selectedRepo && (
                      <option value={form.repository_id}>(repository unavailable — switch to Manual)</option>
                    )}
                  </select>
                  <p className="mt-1 text-caption text-text-secondary">
                    选择已注册的 Repository 以自动派生 Project Path 与 Baseline Branch；或选 Manual 手动填写。
                  </p>
                </div>

                {repoLinked ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Project Path</label>
                      <input
                        type="text"
                        value={selectedRepo?.local_path ?? ""}
                        disabled
                        readOnly
                        placeholder="（仓库信息加载中或不可用）"
                        className={cn(inputCls, "opacity-70")}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Baseline Branch</label>
                      <input
                        type="text"
                        value={selectedRepo?.baseline_branch ?? ""}
                        disabled
                        readOnly
                        placeholder="（仓库信息加载中或不可用）"
                        className={cn(inputCls, "opacity-70")}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Project Path{requireWorktree && !isFieldDisabled("cwd") && reqMark}</label>
                      <input
                        type="text"
                        value={form.cwd}
                        onChange={(e) => update("cwd", e.target.value)}
                        disabled={isFieldDisabled("cwd")}
                        placeholder="/path/to/repo"
                        className={cn(inputCls, fieldErrors.cwd && "border-red-400")}
                      />
                      {renderFieldError("cwd")}
                    </div>
                    <div>
                      <label className={labelCls}>Baseline Branch{requireWorktree && !isFieldDisabled("baseline_branch") && reqMark}</label>
                      <input
                        type="text"
                        value={form.baseline_branch}
                        onChange={(e) => update("baseline_branch", e.target.value)}
                        disabled={isFieldDisabled("baseline_branch")}
                        placeholder="e.g. origin/feature/1.x.x"
                        className={cn(inputCls, fieldErrors.baseline_branch && "border-red-400")}
                      />
                      {renderFieldError("baseline_branch")}
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Additional Dirs</label>
                  <input
                    type="text"
                    value={form.read_dirs}
                    onChange={(e) => update("read_dirs", e.target.value)}
                    disabled={isFieldDisabled("read_dirs")}
                    placeholder="/path/to/other/repo, /path/to/docs"
                    className={inputCls}
                  />
                  <p className="mt-1 text-caption text-text-secondary">
                    额外授予 Claude Code 只读访问的目录（逗号分隔），映射到 <code className="text-xs">--add-dir</code>。仅 Project
                    Worktree 可写，这些目录均为只读。
                  </p>
                </div>
              </>
            )}

            {/* ── Verification ── */}
            <div>
              <label className={labelCls}>Verification Command</label>
              <input
                type="text"
                value={form.verification_command}
                onChange={(e) => update("verification_command", e.target.value)}
                disabled={isFieldDisabled("verification_command")}
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
                          disabled={isFieldDisabled("max_iterations")}
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
                          disabled={isFieldDisabled("max_cost_usd")}
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
                          disabled={isFieldDisabled("success_score_threshold")}
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
                          disabled={isFieldDisabled("no_progress_patience")}
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
                          disabled={isFieldDisabled("max_turns")}
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
                          disabled={isFieldDisabled("max_events_per_iter")}
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
                          disabled={isFieldDisabled("timeout_seconds")}
                          placeholder="10800"
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={labelInlineCls}>Deadline</label>
                        <input
                          type="datetime-local"
                          value={form.deadline_at}
                          onChange={(e) => update("deadline_at", e.target.value)}
                          disabled={isFieldDisabled("deadline_at")}
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
                          disabled={isFieldDisabled("approval_mode")}
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
                      disabled={isFieldDisabled("description")}
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
                            disabled={isFieldDisabled("category")}
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
                            disabled={isFieldDisabled("version")}
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
                          disabled={isFieldDisabled("features_showcase")}
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
                            disabled={isFieldDisabled("model")}
                            placeholder="inherit global config"
                            className={cn(inputCls, "min-w-0 flex-1")}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className={labelInlineCls}>Permission Mode</label>
                          <select
                            value={form.permission_mode}
                            onChange={(e) => update("permission_mode", e.target.value)}
                            disabled={isFieldDisabled("permission_mode")}
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
                          disabled={isFieldDisabled("allowed_tools")}
                          placeholder="Bash, Read, Write, Edit, Glob, Grep"
                          className={cn(inputCls, "min-w-0 flex-1")}
                        />
                      </div>
                    </div>
                </div>
              )}
            </section>
        </form>
      </BaseDrawer>
      {confirmDialog}
    </>
  );
}
