/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
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
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { LlmModelSelect } from "@/components/ui/LlmModelSelect";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  fetchModelConfigs,
  type ModelConfigItem,
} from "@/features/knowledge/utils/knowledge-api";
import { cn } from "@/lib/utils";
import type {
  Agent,
  NegentropyTemplate,
  AvailableTool,
  AgentFormState,
} from "./_types";

interface AgentFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  agent: Agent | null;
}

/* ── Shared style constants ── */
const INPUT =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
const MONO =
  "w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring";
const LABEL = "mb-1.5 block text-xs font-medium text-text-muted";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 mt-1 text-[11px] font-medium uppercase tracking-wider text-text-muted/60">
      {children}
    </div>
  );
}

const DEFAULT_FORM: AgentFormState = {
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
};

export function AgentFormDrawer({
  open,
  onClose,
  onSubmit,
  agent,
}: AgentFormDrawerProps) {
  const { confirm, confirmDialog } = useConfirmDialog();
  const formId = useId();
  const confirmingRef = useRef(false);

  const [formData, setFormData] = useState<AgentFormState>({ ...DEFAULT_FORM });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NegentropyTemplate[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [llmModels, setLlmModels] = useState<ModelConfigItem[]>([]);
  const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
  const [toolSearch, setToolSearch] = useState("");
  const [baseline, setBaseline] = useState<AgentFormState>({ ...DEFAULT_FORM });

  // ── Dirty check ──
  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline),
    [formData, baseline],
  );

  const requestClose = useCallback(async () => {
    if (confirmingRef.current) return;
    if (!isDirty) {
      onClose();
      return;
    }
    confirmingRef.current = true;
    const ok = await confirm({
      title: "Discard changes?",
      message:
        "You have unsaved changes. Closing now will discard them.",
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      destructive: true,
    });
    confirmingRef.current = false;
    if (ok) onClose();
  }, [isDirty, confirm, onClose]);

  // ── Escape handler (BaseDrawer closeOnEscape=false) ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // ── Initialize form from agent ──
  useEffect(() => {
    const seed: AgentFormState = agent
      ? {
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
        }
      : { ...DEFAULT_FORM };

    setFormData(seed);
    setBaseline(seed);
    setError(null);
    setSelectedTemplateName("");
    setToolSearch("");
  }, [agent, open]);

  // ── Fetch LLM models ──
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const list = await fetchModelConfigs({ modelType: "llm", enabled: true });
        if (mounted) setLlmModels(list);
      } catch {
        // silent
      }
    })();
    return () => { mounted = false; };
  }, [open]);

  // ── Fetch available tools ──
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/interface/tools/available");
        if (response.ok) {
          const data = await response.json();
          if (mounted) setAvailableTools(data);
        }
      } catch {
        // silent
      }
    })();
    return () => { mounted = false; };
  }, [open]);

  // ── Fetch templates (create mode only) ──
  useEffect(() => {
    if (!open || agent) return;
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("/api/interface/agents/templates/negentropy");
        if (!response.ok) return;
        const data = (await response.json()) as NegentropyTemplate[];
        if (mounted) setTemplates(data);
      } catch {
        // silent
      }
    })();
    return () => { mounted = false; };
  }, [open, agent]);

  const applyTemplate = (template: NegentropyTemplate) => {
    const seed: AgentFormState = {
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
    };
    setFormData(seed);
    setSelectedTemplateName(template.name);
  };

  // ── Submit handler ──
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
      if (!confirmed) return;
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
        config,
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
      // 成功后重置 baseline，避免关闭时的脏检测误判
      setBaseline(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const setField = <K extends keyof AgentFormState>(
    key: K,
    value: AgentFormState[K],
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  // ── Filtered tools ──
  const filteredTools = useMemo(() => {
    if (!toolSearch.trim()) return availableTools;
    const q = toolSearch.toLowerCase();
    return availableTools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.display_name?.toLowerCase().includes(q) ?? false),
    );
  }, [availableTools, toolSearch]);

  const currentTools = useMemo(
    () =>
      formData.tools
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [formData.tools],
  );

  return (
    <>
      <BaseDrawer
        open={open}
        title={agent ? "Edit Agent" : "Add Agent"}
        subtitle={
          agent
            ? `Editing "${agent.display_name || agent.name}"`
            : "Configure agent properties and runtime behavior"
        }
        onClose={() => void requestClose()}
        widthClassName="[width:clamp(480px,66.67%,1100px)]"
        closeOnBackdrop={!loading}
        closeOnEscape={false}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void requestClose()}
              disabled={loading}
            >
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
          </div>
        }
      >
        <form
          id={formId}
          onSubmit={handleSubmit}
          className="space-y-6 px-5 py-4"
        >
          {/* Error banner */}
          {error && <ErrorBanner message={error} />}

          {/* Built-in agent notice */}
          {agent?.is_builtin && (
            <div
              role="note"
              className="rounded-card border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-text-secondary"
            >
              Built-in agent. Changes here will override the Negentropy preset
              for your workspace.
            </div>
          )}

          {/* Template selector (create mode only) — responsive grid */}
          {!agent && templates.length > 0 && (
            <div>
              <SectionLabel>Template</SectionLabel>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {templates.map((t) => {
                  const selected = selectedTemplateName === t.name;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setSelectedTemplateName("");
                          setFormData({ ...DEFAULT_FORM });
                        } else {
                          applyTemplate(t);
                        }
                      }}
                      className={cn(
                        "flex flex-col rounded-lg border px-3 py-2 text-left transition-all",
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

          {/* System Prompt */}
          <SectionLabel>System Prompt</SectionLabel>
          <textarea
            value={formData.system_prompt}
            onChange={(e) => setField("system_prompt", e.target.value)}
            className={MONO}
            rows={10}
            placeholder="You are a specialized agent for..."
          />

          {/* Tools */}
          <SectionLabel>
            Tools{" "}
            {currentTools.length > 0 && (
              <span className="text-primary">
                ({currentTools.length} selected)
              </span>
            )}
          </SectionLabel>
          {availableTools.length > 0 && (
            <input
              type="text"
              value={toolSearch}
              onChange={(e) => setToolSearch(e.target.value)}
              className={INPUT}
              placeholder="Search tools..."
            />
          )}
          {filteredTools.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {filteredTools.map((t) => {
                const isSelected = currentTools.includes(t.name);
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? currentTools.filter((n) => n !== t.name)
                        : [...currentTools, t.name];
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

          {/* Advanced (collapsible) */}
          <CollapsibleSection
            title="Advanced"
            defaultExpanded={
              !!(
                formData.skills.trim() ||
                formData.config !== "{}" ||
                formData.adk_config !== "{}"
              )
            }
            headerExtra={
              <span className="text-[10px] text-text-muted">
                Skills, Config, ADK
              </span>
            }
          >
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Skills</label>
                <textarea
                  value={formData.skills}
                  onChange={(e) => setField("skills", e.target.value)}
                  className={MONO}
                  rows={3}
                  placeholder="code-review&#10;document-analysis"
                />
              </div>
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
                    Full-fidelity ADK config. Empty → auto-generate minimal
                    config.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </form>
      </BaseDrawer>
      {confirmDialog}
    </>
  );
}
