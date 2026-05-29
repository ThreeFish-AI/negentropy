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
import { LlmModelSelect } from "@/components/ui/LlmModelSelect";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { fetchModelConfigs, type ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";

interface Agent {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  agent_type: string;
  system_prompt: string | null;
  model: string | null;
  config: Record<string, unknown>;
  adk_config?: Record<string, unknown>;
  skills: string[];
  tools: string[];
  is_enabled: boolean;
  visibility: string;
  is_builtin?: boolean;
}

interface AgentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  agent: Agent | null;
}

interface NegentropyTemplate {
  name: string;
  display_name: string | null;
  description: string | null;
  agent_type: string;
  system_prompt: string | null;
  model: string | null;
  adk_config: Record<string, unknown>;
  tools: string[];
}

export function AgentFormDialog({
  open,
  onClose,
  onSubmit,
  agent,
}: AgentFormDialogProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    description: "",
    agent_type: "llm_agent",
    system_prompt: "",
    model: "",
    config: "{}",
    adk_config: "{}",
    skills: "",
    tools: "",
    is_enabled: true,
    visibility: "private",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NegentropyTemplate[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [llmModels, setLlmModels] = useState<ModelConfigItem[]>([]);
  const [availableTools, setAvailableTools] = useState<Array<{ name: string; display_name: string | null; source: string }>>([]);

  const applyTemplate = (template: NegentropyTemplate) => {
    setFormData({
      name: template.name,
      display_name: template.display_name || template.name,
      description: template.description || "",
      agent_type: template.agent_type,
      system_prompt: template.system_prompt || "",
      model: template.model || "",
      config: JSON.stringify({ source: "negentropy_builtin" }, null, 2),
      adk_config: JSON.stringify(template.adk_config || {}, null, 2),
      skills: "",
      tools: (template.tools || []).join("\n"),
      is_enabled: true,
      visibility: "private",
    });
  };

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        display_name: agent.display_name || "",
        description: agent.description || "",
        agent_type: agent.agent_type,
        system_prompt: agent.system_prompt || "",
        model: agent.model || "",
        config: JSON.stringify(agent.config || {}, null, 2),
        adk_config: JSON.stringify(agent.adk_config || (agent.config as { adk_config?: unknown })?.adk_config || {}, null, 2),
        skills: Array.isArray(agent.skills) ? agent.skills.join("\n") : "",
        tools: Array.isArray(agent.tools) ? agent.tools.join("\n") : "",
        is_enabled: agent.is_enabled,
        visibility: agent.visibility,
      });
      setSelectedTemplateName("");
    } else {
      setFormData({
        name: "",
        display_name: "",
        description: "",
        agent_type: "llm_agent",
        system_prompt: "",
        model: "",
        config: "{}",
        adk_config: "{}",
        skills: "",
        tools: "",
        is_enabled: true,
        visibility: "private",
      });
      setSelectedTemplateName("");
    }
    setError(null);
  }, [agent, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const list = await fetchModelConfigs({ modelType: "llm", enabled: true });
        if (mounted) {
          setLlmModels(list);
        }
      } catch {
        // keep silent; select will fall back to Default-only option
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

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

  useEffect(() => {
    if (!open || agent) return;
    let mounted = true;
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/interface/agents/templates/negentropy");
        if (!response.ok) return;
        const data = (await response.json()) as NegentropyTemplate[];
        if (mounted) {
          setTemplates(data);
        }
      } catch {
        // keep silent; template loading is optional
      }
    };
    fetchTemplates();
    return () => {
      mounted = false;
    };
  }, [open, agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let confirmBuiltinRename = false;
    if (agent?.is_builtin && formData.name !== agent.name) {
      const confirmed = await confirm({
        title: "Rename Built-in Agent",
        message:
          "Renaming a Negentropy built-in Agent may cause future sync to create a duplicate. Continue?",
        confirmLabel: "Continue",
        destructive: true,
      });
      if (!confirmed) {
        return;
      }
      confirmBuiltinRename = true;
    }

    setLoading(true);
    setError(null);

    try {
      let config = {};
      let adkConfig = {};
      try {
        config = JSON.parse(formData.config || "{}");
      } catch {
        throw new Error("Invalid JSON in config");
      }
      try {
        adkConfig = JSON.parse(formData.adk_config || "{}");
      } catch {
        throw new Error("Invalid JSON in ADK config");
      }

      const normalizedAdkConfig =
        adkConfig && Object.keys(adkConfig).length > 0
          ? adkConfig
          : {
              agent_type: formData.agent_type,
              name: formData.name,
              description: formData.description || null,
              instruction: formData.system_prompt || null,
              model: formData.model || null,
              tools: formData.tools
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            };

      const data: Record<string, unknown> = {
        name: formData.name,
        display_name: formData.display_name || null,
        description: formData.description || null,
        agent_type: formData.agent_type,
        system_prompt: formData.system_prompt || null,
        model: formData.model || null,
        config: config,
        adk_config: normalizedAdkConfig,
        skills: formData.skills
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        tools: formData.tools
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        is_enabled: formData.is_enabled,
        visibility: formData.visibility,
      };
      if (confirmBuiltinRename) {
        data.confirm_builtin_rename = true;
      }

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <OverlayDismissLayer
      open={open}
      onClose={onClose}
      busy={loading}
      containerClassName="flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"
      contentClassName="my-3 flex max-h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl sm:max-h-[calc(100vh-2rem)]"
    >
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-foreground">
              {agent ? "Edit Agent" : "Add Agent"}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Keep fields consistent with ADK while optimizing readability for longer configurations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {!agent && templates.length > 0 && (
                <section className="rounded-lg border border-border bg-muted/50 p-4">
                  <label className="mb-2 block text-sm font-medium text-text-secondary">
                    Negentropy Built-in Templates
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      value={selectedTemplateName}
                      onChange={(e) => setSelectedTemplateName(e.target.value)}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">Select template</option>
                      {templates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.display_name || template.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selectedTemplateName}
                      onClick={() => {
                        const target = templates.find((item) => item.name === selectedTemplateName);
                        if (target) applyTemplate(target);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </section>
              )}

              {error && <ErrorBanner message={error} />}

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
                      placeholder="my-agent"
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
                      placeholder="My Agent"
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
                      placeholder="Description of this agent"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Runtime Setup
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Agent Type *
                    </label>
                    <select
                      value={formData.agent_type}
                      onChange={(e) => setFormData({ ...formData, agent_type: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                    >
                      <option value="llm_agent">LLM Agent</option>
                      <option value="sequential_agent">Sequential Agent</option>
                      <option value="parallel_agent">Parallel Agent</option>
                      <option value="loop_agent">Loop Agent</option>
                      <option value="custom_agent">Custom Agent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Model
                    </label>
                    <LlmModelSelect
                      models={llmModels}
                      value={formData.model}
                      onChange={(v) => setFormData({ ...formData, model: v })}
                      allowClear
                      placeholder="Default"
                      ariaLabel="Agent 使用的 LLM"
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
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
                    <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        className="rounded border-border"
                      />
                      Enabled
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">
                    System Prompt
                  </label>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                    rows={5}
                    placeholder="You are a specialized agent for..."
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Skills (one per line)
                    </label>
                    <textarea
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                      rows={4}
                      placeholder="code-review&#10;document-analysis"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Tools
                    </label>
                    {availableTools.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {availableTools.map((t) => {
                          const currentTools = formData.tools.split("\n").map((s) => s.trim()).filter(Boolean);
                          const isSelected = currentTools.includes(t.name);
                          return (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() => {
                                const tools = formData.tools.split("\n").map((s) => s.trim()).filter(Boolean);
                                const next = isSelected
                                  ? tools.filter((n) => n !== t.name)
                                  : [...tools, t.name];
                                setFormData({ ...formData, tools: next.join("\n") });
                              }}
                              className={
                                "inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                                (isSelected
                                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                                  : "bg-muted text-text-secondary hover:bg-border/60 dark:hover:bg-border")
                              }
                            >
                              <span className="text-[10px] opacity-60">{t.source === "builtin" ? "●" : "◆"}</span>
                              {t.display_name || t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <textarea
                      value={formData.tools}
                      onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                      rows={3}
                      placeholder="Select from above or type tool names (one per line)"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  JSON Configuration
                </h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      Config (JSON)
                    </label>
                    <textarea
                      value={formData.config}
                      onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                      className="min-h-[220px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                      rows={8}
                      placeholder='{"temperature": 0.7}'
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">
                      ADK Config (JSON, full-fidelity)
                    </label>
                    <textarea
                      value={formData.adk_config}
                      onChange={(e) => setFormData({ ...formData, adk_config: e.target.value })}
                      className="min-h-[220px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
                      rows={8}
                      placeholder='{"agent_class":"LlmAgent","output_key":"perception_output","disallow_transfer_to_parent":true}'
                    />
                    <p className="mt-1 text-xs text-text-muted">
                      Use this field to capture all ADK agent capabilities. Empty value will auto-generate a minimal ADK config.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-card px-5 py-4 sm:px-6">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="neutral" disabled={loading}>
                {loading ? "Saving..." : agent ? "Update" : "Create"}
              </Button>
            </div>
          </form>
      </OverlayDismissLayer>
      {confirmDialog}
    </>
  );
}
