/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内 seed 表单 / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import {
  useState,
  useEffect,
  useId,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { toast } from "sonner";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { inspectBranches } from "@/features/repositories";
import type {
  RepositoryCreatePayload,
  RepositoryDTO,
  RepositoryUpdatePayload,
} from "@/features/repositories";

interface RepositoryFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    data: RepositoryCreatePayload | RepositoryUpdatePayload,
  ) => Promise<void>;
  repository: RepositoryDTO | null;
}

const EMPTY_FORM = {
  name: "",
  display_name: "",
  description: "",
  github_url: "",
  local_path: "",
  baseline_branch: "",
};

type RepositoryForm = typeof EMPTY_FORM;

export function RepositoryFormDrawer({
  open,
  onClose,
  onSubmit,
  repository,
}: RepositoryFormDrawerProps) {
  const formId = useId();
  const [formData, setFormData] = useState<RepositoryForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // ── Inspect Branches 交互态 ──
  const [branches, setBranches] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // ── 脏检基线 ──
  const [baseline, setBaseline] = useState<RepositoryForm>(EMPTY_FORM);
  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  const { confirm, confirmDialog } = useConfirmDialog();
  const confirmingRef = useRef(false);

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

  // Escape 键关闭（脏检确认）
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, requestClose]);

  // open / repository 变化时 seed 表单与基线
  useEffect(() => {
    if (repository) {
      const seeded: RepositoryForm = {
        name: repository.name,
        display_name: repository.display_name || "",
        description: repository.description || "",
        github_url: repository.github_url,
        local_path: repository.local_path,
        baseline_branch: repository.baseline_branch,
      };
      setFormData(seeded);
      setBaseline(seeded);
      // 把已存基线分支作为单元素种子塞入候选，确保未点 Inspect 也能正确显示当前选中分支
      setBranches(repository.baseline_branch ? [repository.baseline_branch] : []);
    } else {
      setFormData(EMPTY_FORM);
      setBaseline(EMPTY_FORM);
      setBranches([]);
    }
    setInspectError(null);
  }, [repository, open]);

  // 枚举分支（手动按钮触发，不做自动 debounce 请求）
  const handleInspect = async () => {
    const path = formData.local_path.trim();
    if (!path) {
      const message = "Please enter a local path first";
      setInspectError(message);
      toast.error(message);
      return;
    }
    setInspecting(true);
    setInspectError(null);
    try {
      const result = await inspectBranches(path);
      // remote 在前（baseline 常为 origin/feature/x.y 这类远端跟踪名），合并去重
      const merged = Array.from(new Set([...result.remote, ...result.local]));
      setBranches(merged);
      // 当前 baseline 不在新列表时，预选 default_remote 下匹配项或首项
      setFormData((prev) => {
        if (prev.baseline_branch && merged.includes(prev.baseline_branch)) {
          return prev;
        }
        const prefix = `${result.default_remote}/`;
        const preferred =
          merged.find((b) => b.startsWith(prefix)) ?? merged[0] ?? "";
        return { ...prev, baseline_branch: preferred };
      });
      if (merged.length === 0) {
        toast.error("No branches found at this path");
      } else {
        toast.success(`Found ${merged.length} branch(es)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Inspect failed";
      setInspectError(message);
      toast.error(message);
    } finally {
      setInspecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const name = formData.name.trim();
      const payload: RepositoryCreatePayload | RepositoryUpdatePayload = {
        name,
        display_name: formData.display_name.trim() || null,
        description: formData.description.trim() || null,
        github_url: formData.github_url.trim(),
        local_path: formData.local_path.trim(),
        baseline_branch: formData.baseline_branch.trim(),
      };
      await onSubmit(payload);
      // 成功后把 baseline 设为当前 form 以重置 isDirty（对齐 ToolFormDrawer）
      setBaseline(formData);
    } catch {
      // onSubmit already handles toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <BaseDrawer
        open={open}
        title={
          repository
            ? `Edit Repository: ${repository.display_name || repository.name}`
            : "Add Repository"
        }
        subtitle="Register a local git repository to drive Routine isolation worktrees."
        onClose={() => void requestClose()}
        closeOnBackdrop={!submitting}
        closeOnEscape={false}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => void requestClose()}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="neutral"
              disabled={submitting}
            >
              {submitting ? "Saving..." : repository ? "Update" : "Create"}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-6 px-5 py-5">
          {/* 基本信息 */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Basic Information
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                  placeholder="e.g. negentropy"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  placeholder="e.g. Negentropy"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  GitHub URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formData.github_url}
                  onChange={(e) =>
                    setFormData({ ...formData, github_url: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  placeholder="https://github.com/org/repo"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                  rows={2}
                  placeholder="Repository description"
                />
              </div>
            </div>
          </section>

          {/* 本地仓库 + 分支枚举 */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Local Repository
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Local Path <span className="text-red-500">*</span>
                </label>
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={formData.local_path}
                    onChange={(e) =>
                      setFormData({ ...formData, local_path: e.target.value })
                    }
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    placeholder="/path/to/repo"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleInspect}
                    disabled={inspecting || submitting}
                    loading={inspecting}
                    className="shrink-0"
                  >
                    Inspect Branches
                  </Button>
                </div>
                {inspectError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {inspectError}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Baseline Branch <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.baseline_branch}
                  onChange={(e) =>
                    setFormData({ ...formData, baseline_branch: e.target.value })
                  }
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground disabled:opacity-50"
                  disabled={branches.length === 0}
                  required
                >
                  {branches.length === 0 ? (
                    <option value="">Inspect branches first…</option>
                  ) : (
                    branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </section>
        </form>
      </BaseDrawer>
      {confirmDialog}
    </>
  );
}
