"use client";

import { useEffect, useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface SkillVersion {
  id: string;
  skill_id: string;
  version: string;
  snapshot: Record<string, unknown>;
  created_at: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  skillId: string | null;
  displayName: string;
}

/**
 * 历史版本只读列表对话框（Phase 3 P0）。
 *
 * - 来自 GET /api/interface/skills/{id}/versions 的全部历史版本（最新在前）；
 * - 每条展开 snapshot 的 prompt_template / required_tools / resources 字段，便于
 *   diff 与 SubAgent.skills 锁定 ``name@1.0.0`` 时确认对应版本内容；
 * - 不在此处提供回滚操作（可通过手工 PATCH version + 拉历史完成；后续 Phase 4 再做）。
 */
export function SkillVersionsDialog({ open, onClose, skillId, displayName }: Props) {
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !skillId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/interface/skills/${skillId}/versions`);
        if (!resp.ok) {
          const body = await resp.text().catch(() => "");
          throw new Error(body || "Failed to load versions");
        }
        const data: SkillVersion[] = await resp.json();
        if (cancelled) return;
        setVersions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, skillId]);

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
          Versions · {displayName}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          每次 PATCH version 字段会自动 freeze 一条快照；SubAgent 可用 <code>name@1.0.0</code> /
          {" "}<code>name@~1.0</code> / <code>name@*</code> 锁定特定版本。
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        {loading && (
          <div data-testid="skills-versions-loading" className="text-sm text-zinc-500">
            Loading…
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {!loading && !error && versions.length === 0 && (
          <div className="text-sm text-zinc-500">No version snapshot yet.</div>
        )}
        <ul className="space-y-3">
          {versions.map((v) => (
            <li
              key={v.id}
              data-testid={`skill-version-${v.version}`}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  v{v.version}
                </span>
                <span className="text-xs text-zinc-400">
                  {v.created_at ? new Date(v.created_at).toLocaleString() : "—"}
                </span>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-50 p-2 text-[11px] leading-4 dark:bg-zinc-800 dark:text-zinc-100">
                {JSON.stringify(v.snapshot ?? {}, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
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
