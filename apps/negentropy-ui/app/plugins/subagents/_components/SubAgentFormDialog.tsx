"use client";

import { useState, useEffect } from "react";

interface SubAgent {
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
}

interface SubAgentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  agent: SubAgent | null;
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

export function SubAgentFormDialog({
  open,
  onClose,
  onSubmit,
  agent,
}: SubAgentFormDialogProps) {
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
    if (!open || agent) return;
    let mounted = true;
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/plugins/subagents/templates/negentropy");
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

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 my-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          {agent ? "Edit SubAgent" : "Add SubAgent"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!agent && templates.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Negentropy Built-in Templates
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.name} value={template.name}>
                      {template.display_name || template.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedTemplateName}
                  onClick={() => {
                    const target = templates.find((item) => item.name === selectedTemplateName);
                    if (target) applyTemplate(target);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="my-subagent"
                required
                disabled={!!agent}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="My SubAgent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={2}
              placeholder="Description of this subagent"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Agent Type *
              </label>
              <select
                value={formData.agent_type}
                onChange={(e) => setFormData({ ...formData, agent_type: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="llm_agent">LLM Agent</option>
                <option value="sequential_agent">Sequential Agent</option>
                <option value="parallel_agent">Parallel Agent</option>
                <option value="loop_agent">Loop Agent</option>
                <option value="custom_agent">Custom Agent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Model
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="claude-sonnet-4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              System Prompt
            </label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={4}
              placeholder="You are a specialized agent for..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Skills (one per line)
              </label>
              <textarea
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                rows={3}
                placeholder="code-review&#10;document-analysis"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tools (one per line)
              </label>
              <textarea
                value={formData.tools}
                onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                rows={3}
                placeholder="get_file&#10;write_file"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Config (JSON)
            </label>
            <textarea
              value={formData.config}
              onChange={(e) => setFormData({ ...formData, config: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={3}
              placeholder='{"temperature": 0.7}'
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              ADK Config (JSON, full-fidelity)
            </label>
            <textarea
              value={formData.adk_config}
              onChange={(e) => setFormData({ ...formData, adk_config: e.target.value })}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={8}
              placeholder='{"agent_class":"LlmAgent","output_key":"perception_output","disallow_transfer_to_parent":true}'
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Use this field to capture all ADK sub-agent capabilities. Empty value will auto-generate a minimal ADK config.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_enabled}
                onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                className="rounded border-zinc-300 dark:border-zinc-600"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Enabled</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Saving..." : agent ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
