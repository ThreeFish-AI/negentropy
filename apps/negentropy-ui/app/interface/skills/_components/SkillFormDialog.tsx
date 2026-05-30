/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface Skill {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  category: string;
  version: string;
  prompt_template: string | null;
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  required_tools: string[];
  is_enabled: boolean;
  priority: number;
  visibility: string;
  enforcement_mode?: string;
  resources?: SkillResource[];
}

interface SkillResource {
  type?: string;
  ref?: string;
  title?: string;
  lazy?: boolean;
}

interface SkillFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  skill: Skill | null;
}

export function SkillFormDialog({
  open,
  onClose,
  onSubmit,
  skill,
}: SkillFormDialogProps) {
  const emptyForm = {
    name: "",
    display_name: "",
    description: "",
    category: "general",
    version: "1.0.0",
    prompt_template: "",
    config_schema: "{}",
    default_config: "{}",
    required_tools: "",
    is_enabled: true,
    priority: 0,
    visibility: "private",
    enforcement_mode: "warning" as "warning" | "strict",
  };
  const [formData, setFormData] = useState(emptyForm);
  const [resourceRows, setResourceRows] = useState<SkillResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ config_schema?: string; default_config?: string }>({});
  const [availableTools, setAvailableTools] = useState<Array<{ name: string; display_name: string | null; source: string }>>([]);

  useEffect(() => {
    if (skill) {
      setFormData({
        name: skill.name,
        display_name: skill.display_name || "",
        description: skill.description || "",
        category: skill.category,
        version: skill.version,
        prompt_template: skill.prompt_template || "",
        config_schema: JSON.stringify(skill.config_schema || {}, null, 2),
        default_config: JSON.stringify(skill.default_config || {}, null, 2),
        required_tools: Array.isArray(skill.required_tools) ? skill.required_tools.join("\n") : "",
        is_enabled: skill.is_enabled,
        priority: skill.priority,
        visibility: skill.visibility,
        enforcement_mode:
          skill.enforcement_mode === "strict" ? "strict" : "warning",
      });
      setResourceRows(
        Array.isArray(skill.resources)
          ? skill.resources.map((r) => ({
              type: r.type || "url",
              ref: r.ref || "",
              title: r.title || "",
              lazy: r.lazy !== false,
            }))
          : [],
      );
    } else {
      setFormData(emptyForm);
      setResourceRows([]);
    }
    setError(null);
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/interface/tools/available");
        if (response.ok) {
          const data = await response.json();
          if (mounted) {
            setAvailableTools(data);
          }
        }
      } catch {
        // keep silent; available tools is optional
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const nextFieldErrors: { config_schema?: string; default_config?: string } = {};
    let configSchema: Record<string, unknown> = {};
    let defaultConfig: Record<string, unknown> = {};
    try {
      configSchema = JSON.parse(formData.config_schema || "{}") as Record<string, unknown>;
    } catch (err) {
      nextFieldErrors.config_schema = err instanceof Error ? err.message : "Invalid JSON";
    }
    try {
      defaultConfig = JSON.parse(formData.default_config || "{}") as Record<string, unknown>;
    } catch (err) {
      nextFieldErrors.default_config = err instanceof Error ? err.message : "Invalid JSON";
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted JSON fields before saving.");
      setLoading(false);
      return;
    }

    try {

      const cleanedResources = resourceRows
        .map((r) => ({
          type: (r.type || "url").trim(),
          ref: (r.ref || "").trim(),
          title: (r.title || "").trim(),
          lazy: r.lazy !== false,
        }))
        .filter((r) => r.ref.length > 0 && r.type.length > 0);

      const data: Record<string, unknown> = {
        name: formData.name,
        display_name: formData.display_name || null,
        description: formData.description || null,
        category: formData.category,
        version: formData.version,
        prompt_template: formData.prompt_template || null,
        config_schema: configSchema,
        default_config: defaultConfig,
        required_tools: formData.required_tools
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        is_enabled: formData.is_enabled,
        priority: formData.priority,
        visibility: formData.visibility,
        enforcement_mode: formData.enforcement_mode,
        resources: cleanedResources,
      };

      await onSubmit(data);
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

      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]"
    >
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-foreground">
              {skill ? "Edit Skill" : "Add Skill"}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Organize skill metadata and JSON payloads with a readable, high-density form layout.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <div data-testid="skills-form-error">
                  <ErrorBanner message={error} />
                </div>
              )}

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Basic Information
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                      placeholder="my-skill"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                      placeholder="My Skill"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                      rows={2}
                      placeholder="Description of this skill"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Runtime Setup
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                      placeholder="general"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Version
                    </label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Visibility
                    </label>
                    <select
                      value={formData.visibility}
                      onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                    >
                      <option value="private">Private</option>
                      <option value="shared">Shared</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        className="rounded border-border"
                      />
                      Enabled
                    </label>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Prompt & Requirements
                </h3>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Prompt Template
                  </label>
                  <textarea
                    value={formData.prompt_template}
                    onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    rows={5}
                    placeholder="Enter the skill's prompt template..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    Required Tools
                  </label>
                  {availableTools.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {availableTools.map((t) => {
                        const currentTools = formData.required_tools.split("\n").map((s) => s.trim()).filter(Boolean);
                        const isSelected = currentTools.includes(t.name);
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => {
                              const tools = formData.required_tools.split("\n").map((s) => s.trim()).filter(Boolean);
                              const next = isSelected
                                ? tools.filter((n) => n !== t.name)
                                : [...tools, t.name];
                              setFormData({ ...formData, required_tools: next.join("\n") });
                            }}
                            className={
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
                              (isSelected
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                : "bg-muted text-text-secondary hover:bg-border/60 dark:hover:bg-border")
                            }
                          >
                            <span className="text-micro opacity-60">{t.source === "builtin" ? "●" : "◆"}</span>
                            {t.display_name || t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <textarea
                    value={formData.required_tools}
                    onChange={(e) => setFormData({ ...formData, required_tools: e.target.value })}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    rows={3}
                    placeholder="Select from above or type tool names (one per line)"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Tool Enforcement
                </h3>
                <fieldset className="rounded-md border border-border p-3 text-sm">
                  <legend className="px-1 text-xs text-text-muted">
                    Required tools enforcement
                  </legend>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="enforcement_mode"
                        value="warning"
                        data-testid="skills-form-enforcement-warning"
                        checked={formData.enforcement_mode === "warning"}
                        onChange={() =>
                          setFormData({ ...formData, enforcement_mode: "warning" })
                        }
                      />
                      <span className="text-foreground">
                        warning <span className="text-xs text-text-muted">(log missing tools, keep running)</span>
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="enforcement_mode"
                        value="strict"
                        data-testid="skills-form-enforcement-strict"
                        checked={formData.enforcement_mode === "strict"}
                        onChange={() =>
                          setFormData({ ...formData, enforcement_mode: "strict" })
                        }
                      />
                      <span className="text-foreground">
                        strict <span className="text-xs text-rose-600 dark:text-rose-400">(block Agent if any required tool is missing)</span>
                      </span>
                    </label>
                  </div>
                </fieldset>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Resources
                  </h3>
                  <button
                    type="button"
                    data-testid="skills-form-add-resource"
                    onClick={() =>
                      setResourceRows((prev) => [
                        ...prev,
                        { type: "url", ref: "", title: "", lazy: true },
                      ])
                    }
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    + Add
                  </button>
                </div>
                {resourceRows.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No resources attached. Use Resources to point to KG nodes, Memory items, Knowledge corpora, or external URLs that the skill can reference on demand.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {resourceRows.map((row, idx) => (
                      <li
                        key={idx}
                        data-testid={`skills-form-resource-${idx}`}
                        className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-12"
                      >
                        <select
                          aria-label={`Resource ${idx + 1} type`}
                          value={row.type || "url"}
                          onChange={(e) =>
                            setResourceRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, type: e.target.value } : r)),
                            )
                          }
                          className="rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground sm:col-span-2"
                        >
                          <option value="url">url</option>
                          <option value="kg_node">kg_node</option>
                          <option value="corpus">corpus</option>
                          <option value="memory">memory</option>
                          <option value="inline">inline</option>
                        </select>
                        <input
                          type="text"
                          aria-label={`Resource ${idx + 1} ref`}
                          value={row.ref || ""}
                          onChange={(e) =>
                            setResourceRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, ref: e.target.value } : r)),
                            )
                          }
                          placeholder="ref (URL / corpus name / kg node label / memory uuid)"
                          className="rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground sm:col-span-5"
                        />
                        <input
                          type="text"
                          aria-label={`Resource ${idx + 1} title`}
                          value={row.title || ""}
                          onChange={(e) =>
                            setResourceRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)),
                            )
                          }
                          placeholder="title (optional)"
                          className="rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground sm:col-span-3"
                        />
                        <label className="flex items-center gap-1 text-xs text-text-secondary sm:col-span-1">
                          <input
                            type="checkbox"
                            checked={row.lazy !== false}
                            onChange={(e) =>
                              setResourceRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, lazy: e.target.checked } : r,
                                ),
                              )
                            }
                          />
                          lazy
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setResourceRows((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 sm:col-span-1 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  JSON Configuration
                </h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Config Schema (JSON)
                    </label>
                    <textarea
                      value={formData.config_schema}
                      onChange={(e) => {
                        setFormData({ ...formData, config_schema: e.target.value });
                        if (fieldErrors.config_schema) {
                          setFieldErrors((prev) => ({ ...prev, config_schema: undefined }));
                        }
                      }}
                      aria-invalid={fieldErrors.config_schema ? "true" : undefined}
                      data-testid="skills-form-config-schema"
                      className={
                        "min-h-[220px] w-full rounded-md border px-3 py-2 text-sm font-mono bg-input text-foreground " +
                        (fieldErrors.config_schema
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
                          : "border-border")
                      }
                      rows={8}
                      placeholder='{"type": "object"}'
                    />
                    {fieldErrors.config_schema && (
                      <p
                        role="status"
                        data-testid="skills-form-config-schema-error"
                        className="mt-1 text-xs text-red-600 dark:text-red-400"
                      >
                        Invalid JSON: {fieldErrors.config_schema}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Default Config (JSON)
                    </label>
                    <textarea
                      value={formData.default_config}
                      onChange={(e) => {
                        setFormData({ ...formData, default_config: e.target.value });
                        if (fieldErrors.default_config) {
                          setFieldErrors((prev) => ({ ...prev, default_config: undefined }));
                        }
                      }}
                      aria-invalid={fieldErrors.default_config ? "true" : undefined}
                      data-testid="skills-form-default-config"
                      className={
                        "min-h-[220px] w-full rounded-md border px-3 py-2 text-sm font-mono bg-input text-foreground " +
                        (fieldErrors.default_config
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
                          : "border-border")
                      }
                      rows={8}
                      placeholder="{}"
                    />
                    {fieldErrors.default_config && (
                      <p
                        role="status"
                        data-testid="skills-form-default-config-error"
                        className="mt-1 text-xs text-red-600 dark:text-red-400"
                      >
                        Invalid JSON: {fieldErrors.default_config}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-card px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="neutral"
                disabled={loading}
              >
                {loading ? "Saving..." : skill ? "Update" : "Create"}
              </Button>
            </div>
          </form>
    </OverlayDismissLayer>
  );
}
