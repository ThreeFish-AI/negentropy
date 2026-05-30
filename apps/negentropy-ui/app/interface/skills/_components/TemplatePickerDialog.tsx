/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { toast } from "sonner";

interface TemplateSummary {
  template_id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  category: string;
  version: string;
}

interface TemplatePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}

/**
 * 「From Template...」对话框：列出内置 Skill 模板，一键安装并通知父级刷新。
 *
 * 设计：
 * - 数据通过 BFF GET /api/interface/skills/templates 获取；
 * - Install 走 BFF POST /api/interface/skills/from-template，name 冲突由后端自动加 owner short id 后缀；
 * - 不在此处缓存模板列表，每次 open 重新拉取以反映 backend 端 yaml 变化。
 */
export function TemplatePickerDialog({ open, onClose, onInstalled }: TemplatePickerDialogProps) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/interface/skills/templates")
      .then(async (resp) => {
        if (!resp.ok) {
          const body = await resp.text().catch(() => "");
          throw new Error(body || "Failed to load templates");
        }
        return resp.json();
      })
      .then((data: TemplateSummary[]) => {
        if (cancelled) return;
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "An error occurred");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleInstall = async (templateId: string, displayName: string) => {
    setInstallingId(templateId);
    try {
      const resp = await fetch("/api/interface/skills/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (!resp.ok) {
        let message = "Failed to install template";
        try {
          const body = await resp.json();
          message = body?.detail || body?.message || message;
        } catch {
          // body not JSON
        }
        throw new Error(message);
      }
      toast.success(`Installed template "${displayName}"`);
      onInstalled();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setInstallingId(null);
    }
  };

  if (!open) return null;

  return (
    <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={installingId !== null}

      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-4 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Install from Template</h2>
        <p className="mt-1 text-sm text-text-muted">
          Select a built-in skill template (manifest + prompt + required tools + resources). One click materializes it into your workspace.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        {loading && (
          <div data-testid="skills-templates-loading" className="text-sm text-text-muted">
            Loading templates…
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && templates.length === 0 && (
          <div className="text-sm text-text-muted">No built-in templates available.</div>
        )}
        <ul className="space-y-3">
          {templates.map((tpl) => (
            <li
              key={tpl.template_id}
              data-testid={`skills-template-${tpl.template_id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {tpl.display_name || tpl.name}
                  </h3>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
                    v{tpl.version}
                  </span>
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    {tpl.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted line-clamp-3 text-text-muted">
                  {tpl.description || "No description"}
                </p>
                <p className="mt-1 text-[11px] text-text-muted">{tpl.template_id}</p>
              </div>
              <button
                type="button"
                disabled={installingId !== null}
                onClick={() => handleInstall(tpl.template_id, tpl.display_name || tpl.name)}
                data-testid={`skills-template-install-${tpl.template_id}`}
                className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {installingId === tpl.template_id ? "Installing…" : "Install"}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-card px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={installingId !== null}
          className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:bg-muted disabled:opacity-50"
        >
          Close
        </button>
      </div>
    </OverlayDismissLayer>
  );
}
