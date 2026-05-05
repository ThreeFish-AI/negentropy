"use client";

import { useEffect, useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface InvokeResponse {
  skill_id: string;
  name: string;
  rendered_prompt: string;
  resources: Array<{ type?: string; ref?: string; title?: string; lazy?: boolean }>;
  missing_tools: string[];
}

interface SkillPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** 当前 Skill 的 id（用于 invoke 调用） */
  skillId: string | null;
  /** 当前 Skill 的展示名（标题） */
  displayName: string;
  /** Jinja2 默认变量（来自 default_config 或表单） */
  defaultVariables?: Record<string, unknown>;
}

/**
 * Layer 2 「Preview」对话框：调用 ``POST /api/interface/skills/{id}/invoke`` 渲染 prompt_template
 * 与资源摘要，便于用户在不启动 LLM 的前提下校验 Jinja2 变量与资源挂载。
 */
export function SkillPreviewDialog({
  open,
  onClose,
  skillId,
  displayName,
  defaultVariables,
}: SkillPreviewDialogProps) {
  const [variablesText, setVariablesText] = useState<string>(
    JSON.stringify(defaultVariables || {}, null, 2),
  );
  const [response, setResponse] = useState<InvokeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setVariablesText(JSON.stringify(defaultVariables || {}, null, 2));
    setResponse(null);
    setError(null);
  }, [open, defaultVariables]);

  const handleRender = async () => {
    if (!skillId) return;
    setLoading(true);
    setError(null);
    let variables: Record<string, unknown> = {};
    try {
      variables = JSON.parse(variablesText || "{}");
    } catch (err) {
      setError(err instanceof Error ? `Variables JSON: ${err.message}` : "Invalid variables JSON");
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch(`/api/interface/skills/${skillId}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables }),
      });
      if (!resp.ok) {
        let message = "Failed to render skill";
        try {
          const body = await resp.json();
          message = body?.detail || body?.message || message;
        } catch {
          // body not JSON
        }
        throw new Error(message);
      }
      const data: InvokeResponse = await resp.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={loading}
      backdropClassName="bg-black/55"
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-4 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Preview · {displayName}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Render the skill&apos;s prompt_template (Jinja2 sandbox) with custom variables. The backend does NOT call any LLM — it returns the rendered text only.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Variables (JSON)
          </label>
          <textarea
            data-testid="skills-preview-vars"
            value={variablesText}
            onChange={(e) => setVariablesText(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="mb-3">
          <button
            type="button"
            data-testid="skills-preview-render"
            onClick={handleRender}
            disabled={loading || !skillId}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Rendering…" : "Render"}
          </button>
        </div>
        {error && (
          <div role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {response && (
          <div className="space-y-3">
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Rendered prompt
              </h3>
              <pre
                data-testid="skills-preview-rendered"
                className="max-h-72 overflow-auto rounded-md bg-zinc-50 p-3 text-xs leading-5 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {response.rendered_prompt}
              </pre>
            </div>
            {response.missing_tools.length > 0 && (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <strong>Heads up:</strong> the skill declares {response.missing_tools.length} required tool(s):
                {" "}
                {response.missing_tools.map((t) => (
                  <code key={t} className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">
                    {t}
                  </code>
                ))}
              </div>
            )}
            {response.resources.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Resources
                </h3>
                <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-200">
                  {response.resources.map((r, i) => (
                    <li key={i}>
                      <code>{r.type}</code> · {r.title || r.ref} · <span className="text-zinc-500">{r.ref}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
