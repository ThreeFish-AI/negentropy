/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useState, useEffect, useId, type ReactNode } from "react";
import {
  Settings2,
  MessageSquareCode,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { BaseModal } from "@/components/ui/BaseModal";
import { LlmModelSelect } from "@/components/ui/LlmModelSelect";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  fetchModelConfigs,
  type ModelConfigItem,
} from "@/features/knowledge/utils/knowledge-api";
import { cn } from "@/lib/utils";

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

/* ── Shared style constants ── */
const INPUT =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
const MONO =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring";
const LABEL = "mb-1.5 block text-xs font-medium text-text-muted";

/* ── Tab definitions ── */
const TABS = [
  { key: "general", label: "General", icon: Settings2 },
  { key: "prompt-tools", label: "Prompt & Tools", icon: MessageSquareCode },
  { key: "advanced", label: "Advanced", icon: Wrench },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  tabId,
  panelId,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  tabId: string;
  panelId: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-text-muted hover:text-text-secondary",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 mt-1 text-[11px] font-medium uppercase tracking-wider text-text-muted/60">
      {children}
    </div>
  );
}

export function AgentFormDialog({
  open,
  onClose,
  onSubmit,
  agent,
}: AgentFormDialogProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const formId = useId();
  const tabBaseId = useId();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
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
  const [availableTools, setAvailableTools] = useState<
    Array<{ name: string; display_name: string | null; source: string }>
  >([]);

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
    setSelectedTemplateName(template.name);
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
        adk_config: JSON.stringify(
          agent.adk_config ||
            (agent.config as { adk_config?: unknown })?.adk_config ||
            {},
          null,
          2,
        ),
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
    setActiveTab("general");
  }, [agent, open]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const list = await fetchModelConfigs({
          modelType: "llm",
          enabled: true,
        });
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
        const response = await fetch(
          "/api/interface/agents/templates/negentropy",
        );
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

  const setField = <K extends keyof typeof formData>(
    key: K,
    value: (typeof formData)[K],
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  /* ── Tab: General ── */
  const renderGeneral = () => (
    <div className="space-y-5">
      {/* Template selector (create only) */}
      {!agent && templates.length > 0 && (
        <div>
          <SectionLabel>Template</SectionLabel>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {templates.map((t) => {
              const selected = selectedTemplateName === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() =>
                    selected
                      ? setSelectedTemplateName("")
                      : setSelectedTemplateName(t.name)
                  }
                  className={cn(
                    "flex shrink-0 flex-col rounded-lg border px-3 py-2 text-left transition-all min-w-[140px] max-w-[200px]",
                    selected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-border/80 hover:bg-muted/50",
                  )}
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {t.display_name || t.name}
                  </span>
                  {t.description && (
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-text-muted">
                      {t.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedTemplateName && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const target = templates.find(
                  (item) => item.name === selectedTemplateName,
                );
                if (target) applyTemplate(target);
              }}
            >
              Apply Template
            </Button>
          )}
        </div>
      )}

      {/* Identity */}
      <SectionLabel>Identity</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setField("name", e.target.value)}
            className={INPUT}
            placeholder="my-agent"
            required
          />
        </div>
        <div>
          <label className={LABEL}>Display Name</label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => setField("display_name", e.target.value)}
            className={INPUT}
            placeholder="My Agent"
          />
        </div>
      </div>
      <div>
        <label className={LABEL}>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setField("description", e.target.value)}
          className={INPUT}
          rows={2}
          placeholder="Brief description of this agent"
        />
      </div>

      {/* Runtime */}
      <SectionLabel>Runtime</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Agent Type *</label>
          <select
            value={formData.agent_type}
            onChange={(e) => setField("agent_type", e.target.value)}
            className={INPUT}
          >
            <option value="llm_agent">LLM Agent</option>
            <option value="sequential_agent">Sequential Agent</option>
            <option value="parallel_agent">Parallel Agent</option>
            <option value="loop_agent">Loop Agent</option>
            <option value="custom_agent">Custom Agent</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Model</label>
          <LlmModelSelect
            models={llmModels}
            value={formData.model}
            onChange={(v) => setField("model", v)}
            allowClear
            placeholder="Default"
            ariaLabel="Agent 使用的 LLM"
            className="w-full"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Visibility</label>
          <select
            value={formData.visibility}
            onChange={(e) => setField("visibility", e.target.value)}
            className={INPUT}
          >
            <option value="private">Private</option>
            <option value="shared">Shared</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-3 text-sm text-text-secondary">
            <button
              type="button"
              role="switch"
              aria-checked={formData.is_enabled}
              onClick={() => setField("is_enabled", !formData.is_enabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                formData.is_enabled ? "bg-primary" : "bg-border",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  formData.is_enabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
            Enabled
          </label>
        </div>
      </div>
    </div>
  );

  /* ── Tab: Prompt & Tools ── */
  const renderPromptTools = () => (
    <div className="space-y-5">
      <SectionLabel>System Prompt</SectionLabel>
      <div>
        <textarea
          value={formData.system_prompt}
          onChange={(e) => setField("system_prompt", e.target.value)}
          className={MONO}
          rows={8}
          placeholder="You are a specialized agent for..."
        />
      </div>

      <SectionLabel>Tools</SectionLabel>
      <div>
        {availableTools.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {availableTools.map((t) => {
              const currentTools = formData.tools
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean);
              const isSelected = currentTools.includes(t.name);
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    const tools = formData.tools
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const next = isSelected
                      ? tools.filter((n) => n !== t.name)
                      : [...tools, t.name];
                    setField("tools", next.join("\n"));
                  }}
                  className={
                    "inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (isSelected
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                      : "bg-muted text-text-secondary hover:bg-border/60 dark:hover:bg-border")
                  }
                >
                  <span className="text-micro opacity-60">
                    {t.source === "builtin" ? "●" : "◆"}
                  </span>
                  {t.display_name || t.name}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          value={formData.tools}
          onChange={(e) => setField("tools", e.target.value)}
          className={MONO}
          rows={3}
          placeholder="Select from above or type tool names (one per line)"
        />
      </div>
    </div>
  );

  /* ── Tab: Advanced ── */
  const renderAdvanced = () => (
    <div className="space-y-5">
      <SectionLabel>Skills</SectionLabel>
      <div>
        <textarea
          value={formData.skills}
          onChange={(e) => setField("skills", e.target.value)}
          className={MONO}
          rows={3}
          placeholder="code-review&#10;document-analysis"
        />
      </div>

      <SectionLabel>Configuration</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Config (JSON)</label>
          <textarea
            value={formData.config}
            onChange={(e) => setField("config", e.target.value)}
            className={MONO}
            rows={6}
            placeholder='{"temperature": 0.7}'
          />
        </div>
        <div>
          <label className={LABEL}>ADK Config (JSON)</label>
          <textarea
            value={formData.adk_config}
            onChange={(e) => setField("adk_config", e.target.value)}
            className={MONO}
            rows={6}
            placeholder='{"agent_class":"LlmAgent","output_key":"perception_output"}'
          />
          <p className="mt-1 text-[11px] text-text-muted">
            Full-fidelity ADK config. Empty → auto-generate minimal config.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <BaseModal
        open={open}
        title={agent ? "Edit Agent" : "Add Agent"}
        subtitle="Configure agent properties and runtime behavior"
        onClose={onClose}
        size="2xl"
        closeOnBackdrop={!loading}
        closeOnEscape={!loading}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="neutral"
              disabled={loading}
            >
              {loading ? "Saving..." : agent ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner message={error} />}

          {/* Tab bar */}
          <div
            role="tablist"
            className="-mx-6 -mt-3 flex gap-0 overflow-x-auto border-b border-border px-6"
          >
            {TABS.map((tab) => {
              const tabId = `${tabBaseId}-tab-${tab.key}`;
              const panelId = `${tabBaseId}-panel-${tab.key}`;
              return (
                <TabButton
                  key={tab.key}
                  label={tab.label}
                  icon={tab.icon}
                  active={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  tabId={tabId}
                  panelId={panelId}
                />
              );
            })}
          </div>

          {/* Tab panels */}
          <div
            role="tabpanel"
            id={`${tabBaseId}-panel-${activeTab}`}
            aria-labelledby={`${tabBaseId}-tab-${activeTab}`}
            className="pt-1"
          >
            {activeTab === "general" && renderGeneral()}
            {activeTab === "prompt-tools" && renderPromptTools()}
            {activeTab === "advanced" && renderAdvanced()}
          </div>
        </form>
      </BaseModal>
      {confirmDialog}
    </>
  );
}
