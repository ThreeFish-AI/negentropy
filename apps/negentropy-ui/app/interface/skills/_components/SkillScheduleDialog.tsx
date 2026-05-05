"use client";

import { useEffect, useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { toast } from "sonner";

interface SkillSchedule {
  id: string;
  skill_id: string;
  owner_id: string;
  cron_expr: string;
  enabled: boolean;
  vars: Record<string, unknown>;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  created_at: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  skillId: string | null;
  displayName: string;
  defaultVars?: Record<string, unknown>;
}

/**
 * Skill 定时调度对话框（Phase 3 P1）。
 *
 * - GET 列出当前 Skill 关联的全部 schedules；
 * - 表单输入 cron 表达式 + 变量 JSON 后 POST 创建；
 * - 每行支持 Run Now（手动触发，不等 tick）和 Delete；
 * - cron 校验由后端 croniter 完成（前端仅做最小限制）。
 */
export function SkillScheduleDialog({
  open,
  onClose,
  skillId,
  displayName,
  defaultVars,
}: Props) {
  const [schedules, setSchedules] = useState<SkillSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cronExpr, setCronExpr] = useState<string>("0 9 * * 1");
  const [varsText, setVarsText] = useState<string>(JSON.stringify(defaultVars || {}, null, 2));
  const [enabled, setEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    if (!skillId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/interface/skills/${skillId}/schedules`);
      if (!resp.ok) {
        throw new Error((await resp.text().catch(() => "")) || "Failed to load schedules");
      }
      const data: SkillSchedule[] = await resp.json();
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !skillId) return;
    setVarsText(JSON.stringify(defaultVars || {}, null, 2));
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, skillId]);

  const handleCreate = async () => {
    if (!skillId) return;
    let parsedVars: Record<string, unknown> = {};
    try {
      parsedVars = JSON.parse(varsText || "{}");
    } catch (err) {
      toast.error(err instanceof Error ? `Vars JSON: ${err.message}` : "Invalid vars JSON");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/interface/skills/${skillId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cron_expr: cronExpr, enabled, vars: parsedVars }),
      });
      if (!resp.ok) {
        let message = "Failed to create schedule";
        try {
          const body = await resp.json();
          message = body?.detail || body?.message || message;
        } catch {
          // body not JSON
        }
        throw new Error(message);
      }
      toast.success("Schedule created");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!skillId) return;
    setBusyId(id);
    try {
      const resp = await fetch(`/api/interface/skills/${skillId}/schedules/${id}`, {
        method: "DELETE",
      });
      if (!resp.ok && resp.status !== 204) {
        throw new Error((await resp.text().catch(() => "")) || "Failed to delete");
      }
      toast.success("Schedule deleted");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setBusyId(null);
    }
  };

  const handleRunNow = async (id: string) => {
    if (!skillId) return;
    setBusyId(id);
    try {
      const resp = await fetch(
        `/api/interface/skills/${skillId}/schedules/${id}/run`,
        { method: "POST" },
      );
      if (!resp.ok) {
        throw new Error((await resp.text().catch(() => "")) || "Failed to run");
      }
      toast.success("Schedule ran (synchronously, see last_run_at)");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      backdropClassName="bg-black/55"
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-4 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Schedules · {displayName}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          POSIX cron 表达式（5 字段：minute hour dom month dow）。AsyncScheduler 60s tick 在 backend 进程内
          扫表执行；多 worker 通过 <code>FOR UPDATE SKIP LOCKED</code> 保证不重复触发。
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        <section className="mb-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            New schedule
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              cron_expr
              <input
                data-testid="schedule-form-cron"
                type="text"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="0 9 * * 1"
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">
              enabled
              <div className="mt-1 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>{enabled ? "true" : "false"}</span>
              </div>
            </label>
            <label className="text-xs text-zinc-600 sm:col-span-2 dark:text-zinc-300">
              vars (JSON)
              <textarea
                data-testid="schedule-form-vars"
                rows={4}
                value={varsText}
                onChange={(e) => setVarsText(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-xs font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              data-testid="schedule-form-submit"
              onClick={handleCreate}
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Existing schedules
          </h3>
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {error && (
            <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {!loading && !error && schedules.length === 0 && (
            <div className="text-sm text-zinc-500">No schedules yet.</div>
          )}
          <ul className="space-y-2">
            {schedules.map((s) => (
              <li
                key={s.id}
                data-testid={`schedule-row-${s.id}`}
                className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-zinc-800 dark:text-zinc-200">{s.cron_expr}</code>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 " +
                      (s.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")
                    }
                  >
                    {s.enabled ? "enabled" : "disabled"}
                  </span>
                </div>
                <div className="mt-1 text-zinc-500">
                  next: {s.next_run_at || "—"} · last: {s.last_run_at || "—"}
                </div>
                {s.last_error && (
                  <div className="mt-1 text-rose-600 dark:text-rose-400">last_error: {s.last_error}</div>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunNow(s.id)}
                    disabled={busyId === s.id}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    data-testid={`schedule-row-${s.id}-run`}
                  >
                    Run now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    disabled={busyId === s.id}
                    className="rounded-md border border-red-300 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                    data-testid={`schedule-row-${s.id}-delete`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
