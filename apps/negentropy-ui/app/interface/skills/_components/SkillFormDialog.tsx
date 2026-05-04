"use client";

import { useState, useEffect } from "react";
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
  const [formData, setFormData] = useState({
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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ config_schema?: string; default_config?: string }>({});

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
      });
    } else {
      setFormData({
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
      });
    }
    setError(null);
    setFieldErrors({});
  }, [skill, open]);

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
      backdropClassName="bg-black/55"
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] dark:border-zinc-700 dark:bg-zinc-900"
    >
          <div className="border-b border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {skill ? "Edit Skill" : "Add Skill"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Organize skill metadata and JSON payloads with a readable, high-density form layout.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <div
                  role="alert"
                  data-testid="skills-form-error"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
                >
                  {error}
                </div>
              )}

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Basic Information
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="my-skill"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="My Skill"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      rows={2}
                      placeholder="Description of this skill"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Runtime Setup
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="general"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Version
                    </label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      placeholder="1.0.0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Visibility
                    </label>
                    <select
                      value={formData.visibility}
                      onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      <option value="private">Private</option>
                      <option value="shared">Shared</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex w-full items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      Enabled
                    </label>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Prompt & Requirements
                </h3>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Prompt Template
                  </label>
                  <textarea
                    value={formData.prompt_template}
                    onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    rows={5}
                    placeholder="Enter the skill's prompt template..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Required Tools (one per line)
                  </label>
                  <textarea
                    value={formData.required_tools}
                    onChange={(e) => setFormData({ ...formData, required_tools: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    rows={4}
                    placeholder="get_file&#10;write_file"
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  JSON Configuration
                </h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                        "min-h-[220px] w-full rounded-md border px-3 py-2 text-sm font-mono dark:bg-zinc-800 dark:text-zinc-100 " +
                        (fieldErrors.config_schema
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
                          : "border-zinc-300 dark:border-zinc-600")
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
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                        "min-h-[220px] w-full rounded-md border px-3 py-2 text-sm font-mono dark:bg-zinc-800 dark:text-zinc-100 " +
                        (fieldErrors.default_config
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
                          : "border-zinc-300 dark:border-zinc-600")
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

            <div className="flex shrink-0 justify-end gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? "Saving..." : skill ? "Update" : "Create"}
              </button>
            </div>
          </form>
    </OverlayDismissLayer>
  );
}
