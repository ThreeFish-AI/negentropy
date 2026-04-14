"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminNav } from "@/components/ui/AdminNav";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

interface ModelConfig {
  id: string;
  modelType: string;
  displayName: string;
  vendor: string;
  modelName: string;
  isDefault: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ModelFormData {
  model_type: string;
  display_name: string;
  vendor: string;
  model_name: string;
  is_default: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
}

const VENDORS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "zai", label: "ZAI (智谱)" },
  { value: "vertex_ai", label: "Vertex AI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "ollama", label: "Ollama" },
  { value: "gemini", label: "Gemini" },
];

const MODEL_TYPES = [
  { value: "llm", label: "LLM", description: "大语言模型" },
  { value: "embedding", label: "Embedding", description: "向量嵌入模型" },
  { value: "rerank", label: "Rerank", description: "重排序模型" },
];

const EMPTY_FORM: ModelFormData = {
  model_type: "llm",
  display_name: "",
  vendor: "zai",
  model_name: "",
  is_default: false,
  enabled: true,
  config: {},
};

// --- Vendor Configuration ---

interface VendorConfigData {
  vendor: string;
  apiKey: string | null;
  apiBase: string | null;
  configured: boolean;
}

const VENDOR_SETUP_CONFIG = [
  {
    value: "openai",
    label: "OpenAI",
    helpUrl: "https://platform.openai.com/api-keys",
    baseUrlPlaceholder: "https://api.openai.com/v1",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    helpUrl: "https://console.anthropic.com/settings/keys",
    baseUrlPlaceholder: "https://api.anthropic.com",
  },
  {
    value: "gemini",
    label: "Gemini",
    helpUrl: "https://aistudio.google.com/apikey",
    baseUrlPlaceholder: "https://generativelanguage.googleapis.com",
  },
];

export default function ModelsPage() {
  const [models, setModels] = useState<Record<string, ModelConfig[]>>({
    llm: [],
    embedding: [],
    rerank: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // LLM config fields
  const [temperature, setTemperature] = useState(0.7);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(2048);
  const [maxTokens, setMaxTokens] = useState<string>("");

  // Embedding config fields
  const [dimensions, setDimensions] = useState<string>("");
  const [inputType, setInputType] = useState("");

  // API credentials (stored in config JSONB)
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyChanged, setApiKeyChanged] = useState(false);

  // Ping state
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: "ok" | "error";
    message: string;
    latency_ms?: number;
  } | null>(null);

  // --- Vendor config state ---
  const [vendorConfigs, setVendorConfigs] = useState<VendorConfigData[]>([]);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDialogVendor, setVendorDialogVendor] = useState<string | null>(null);
  const [vendorApiKey, setVendorApiKey] = useState("");
  const [vendorApiBase, setVendorApiBase] = useState("");
  const [vendorApiKeyChanged, setVendorApiKeyChanged] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/admin/models");
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      setModels(data.models || { llm: [], embedding: [], rerank: [] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVendorConfigs = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/admin/vendor-configs");
      if (!response.ok) return;
      const data = await response.json();
      setVendorConfigs(data.vendorConfigs || []);
    } catch {
      // silently fail — vendor config is non-critical for page rendering
    }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchVendorConfigs();
  }, [fetchModels, fetchVendorConfigs]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setTemperature(0.7);
    setThinkingMode(false);
    setThinkingBudget(2048);
    setMaxTokens("");
    setDimensions("");
    setInputType("");
    setApiBase("");
    setApiKey("");
    setApiKeyChanged(false);
    setPingResult(null);
  };

  const openCreateForm = (modelType: string) => {
    resetForm();
    setForm({ ...EMPTY_FORM, model_type: modelType });
    setShowForm(true);
  };

  const openEditForm = (mc: ModelConfig) => {
    setEditingId(mc.id);
    setForm({
      model_type: mc.modelType,
      display_name: mc.displayName,
      vendor: mc.vendor,
      model_name: mc.modelName,
      is_default: mc.isDefault,
      enabled: mc.enabled,
      config: mc.config,
    });
    const cfg = mc.config || {};
    setTemperature((cfg.temperature as number) ?? 0.7);
    setThinkingMode((cfg.thinking_mode as boolean) ?? false);
    setThinkingBudget((cfg.thinking_budget as number) ?? 2048);
    setMaxTokens(cfg.max_tokens != null ? String(cfg.max_tokens) : "");
    setDimensions(cfg.dimensions != null ? String(cfg.dimensions) : "");
    setInputType((cfg.input_type as string) ?? "");
    setApiBase((cfg.api_base as string) ?? "");
    setApiKey((cfg.api_key as string) ?? "");
    setApiKeyChanged(false);
    setPingResult(null);
    setShowForm(true);
  };

  const buildConfig = (): Record<string, unknown> => {
    const cfg: Record<string, unknown> = {};
    if (form.model_type === "llm") {
      cfg.temperature = temperature;
      if (thinkingMode) {
        cfg.thinking_mode = true;
        cfg.thinking_budget = thinkingBudget;
      }
      const parsedMaxTokens = parseInt(maxTokens, 10);
      if (maxTokens && !isNaN(parsedMaxTokens)) cfg.max_tokens = parsedMaxTokens;
    } else if (form.model_type === "embedding") {
      const parsedDimensions = parseInt(dimensions, 10);
      if (dimensions && !isNaN(parsedDimensions)) cfg.dimensions = parsedDimensions;
      if (inputType) cfg.input_type = inputType;
    }
    // API credentials (所有 model_type 共享)
    if (apiBase.trim()) cfg.api_base = apiBase.trim();
    if (apiKeyChanged && apiKey.trim()) cfg.api_key = apiKey.trim();
    return cfg;
  };

  const handleSave = async () => {
    if (!form.display_name || !form.model_name) return;
    setSaving(true);
    try {
      const payload = { ...form, config: buildConfig() };
      const url = editingId
        ? `/api/auth/admin/models/${editingId}`
        : "/api/auth/admin/models";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      resetForm();
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(
        `/api/auth/admin/models/${id}/set-default`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error("Failed to set default");
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确认删除此模型配置？此操作不可撤销。")) return;
    setActionLoading(id);
    try {
      const response = await fetch(`/api/auth/admin/models/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleEnabled = async (mc: ModelConfig) => {
    setActionLoading(mc.id);
    try {
      const response = await fetch(`/api/auth/admin/models/${mc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !mc.enabled }),
      });
      if (!response.ok) throw new Error("Failed to toggle");
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const currentConfig = buildConfig();
      const payload = {
        model_type: form.model_type,
        vendor: form.vendor,
        model_name: form.model_name,
        config: currentConfig,
        api_base: apiBase.trim() || null,
        api_key: apiKeyChanged ? apiKey.trim() || null : null,
        model_id: editingId || null,
      };
      const response = await fetch("/api/auth/admin/models/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setPingResult({
          status: "error",
          message: data.error || `HTTP ${response.status}`,
        });
        return;
      }
      const data = await response.json();
      setPingResult(data);
    } catch (err) {
      setPingResult({
        status: "error",
        message: err instanceof Error ? err.message : "网络错误",
      });
    } finally {
      setPinging(false);
    }
  };

  // --- Vendor config handlers ---

  const openVendorSetup = (vendor: string) => {
    const existing = vendorConfigs.find((vc) => vc.vendor === vendor);
    setVendorDialogVendor(vendor);
    setVendorApiKey(""); // 始终为空，避免脱敏值被误提交
    setVendorApiBase(existing?.apiBase ?? "");
    setVendorApiKeyChanged(false);
    setVendorDialogOpen(true);
  };

  const closeVendorDialog = () => {
    setVendorDialogOpen(false);
    setVendorDialogVendor(null);
    setVendorApiKey("");
    setVendorApiBase("");
    setVendorApiKeyChanged(false);
  };

  const handleVendorSave = async () => {
    if (!vendorDialogVendor) return;
    const existing = vendorConfigs.find((vc) => vc.vendor === vendorDialogVendor);
    const isEditing = existing?.configured ?? false;
    // 新建时必须提供 API Key；编辑时可以为空（保留原值）
    if (!isEditing && !vendorApiKey.trim()) return;
    setVendorSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      if (vendorApiKeyChanged && vendorApiKey.trim()) {
        payload.api_key = vendorApiKey.trim();
      } else {
        payload.api_key = null; // 告知后端保留原值
      }
      if (vendorApiBase.trim()) {
        payload.api_base = vendorApiBase.trim();
      }
      const response = await fetch(`/api/auth/admin/vendor-configs/${vendorDialogVendor}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save vendor config");
      }
      await fetchVendorConfigs();
      closeVendorDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vendor config");
    } finally {
      setVendorSaving(false);
    }
  };

  const handleVendorRemove = async () => {
    if (!vendorDialogVendor) return;
    if (!window.confirm(`确认移除 ${vendorDialogVendor} 的供应商配置？`)) return;
    setVendorSaving(true);
    try {
      const response = await fetch(`/api/auth/admin/vendor-configs/${vendorDialogVendor}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove vendor config");
      }
      await fetchVendorConfigs();
      closeVendorDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove vendor config");
    } finally {
      setVendorSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <AdminNav title="Model Management" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Loading model configurations...
            </div>
          ) : (
            <>
              {/* Vendor Configuration */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Vendor Credentials
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Configure API keys for model vendors. All models share vendor credentials.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {VENDOR_SETUP_CONFIG.map((vc) => {
                    const config = vendorConfigs.find((c) => c.vendor === vc.value);
                    const isConfigured = config?.configured ?? false;
                    return (
                      <div
                        key={vc.value}
                        className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {vc.label}
                            </h3>
                            {isConfigured ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 mt-1">
                                Configured
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500 mt-1">
                                Not configured
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => openVendorSetup(vc.value)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                          >
                            {isConfigured ? "Edit" : "Setup"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {MODEL_TYPES.map((mt) => (
                <div
                  key={mt.value}
                  className="mb-6 rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {mt.label}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {mt.description}
                      </p>
                    </div>
                    <button
                      onClick={() => openCreateForm(mt.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  {(models[mt.value] || []).length === 0 ? (
                    <div className="p-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                      No {mt.label} models configured
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                      {(models[mt.value] || []).map((mc) => (
                        <div
                          key={mc.id}
                          className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${!mc.enabled ? "opacity-50" : ""}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {mc.displayName}
                              </span>
                              {mc.isDefault && (
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  DEFAULT
                                </span>
                              )}
                              {!mc.enabled && (
                                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
                                  DISABLED
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 mr-1">
                                {mc.vendor}
                              </span>
                              {mc.modelName}
                              {mc.config &&
                                typeof mc.config.temperature === "number" && (
                                  <span className="ml-2 text-zinc-400">
                                    temp={mc.config.temperature}
                                  </span>
                                )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {!mc.isDefault && mc.enabled && (
                              <button
                                onClick={() => handleSetDefault(mc.id)}
                                disabled={actionLoading === mc.id}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleEnabled(mc)}
                              disabled={actionLoading === mc.id}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${mc.enabled ? "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20" : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"}`}
                            >
                              {mc.enabled ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => openEditForm(mc)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                            >
                              Edit
                            </button>
                            {!mc.isDefault && (
                              <button
                                onClick={() => handleDelete(mc.id)}
                                disabled={actionLoading === mc.id}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  {editingId ? "Edit Model" : "Add Model"}
                </h3>

                <div className="space-y-3">
                  {/* Model Type (read-only when editing) */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Type
                    </label>
                    <select
                      value={form.model_type}
                      onChange={(e) =>
                        setForm({ ...form, model_type: e.target.value })
                      }
                      disabled={!!editingId}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 disabled:opacity-60"
                    >
                      {MODEL_TYPES.map((mt) => (
                        <option key={mt.value} value={mt.value}>
                          {mt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={form.display_name}
                      onChange={(e) =>
                        setForm({ ...form, display_name: e.target.value })
                      }
                      placeholder="e.g. GLM-5 (智谱)"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Vendor
                      </label>
                      <select
                        value={form.vendor}
                        onChange={(e) =>
                          setForm({ ...form, vendor: e.target.value })
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        {VENDORS.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Model Name
                      </label>
                      <input
                        type="text"
                        value={form.model_name}
                        onChange={(e) =>
                          setForm({ ...form, model_name: e.target.value })
                        }
                        placeholder="e.g. glm-5"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  {/* LLM-specific config */}
                  {form.model_type === "llm" && (
                    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-700 space-y-3">
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        LLM Parameters
                      </div>
                      <div>
                        <label className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                          <span>Temperature</span>
                          <span className="font-mono">{temperature}</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) =>
                            setTemperature(parseFloat(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                          Max Tokens (optional)
                        </label>
                        <input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(e.target.value)}
                          placeholder="Default"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="thinking_mode"
                          checked={thinkingMode}
                          onChange={(e) => setThinkingMode(e.target.checked)}
                          className="rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <label
                          htmlFor="thinking_mode"
                          className="text-xs text-zinc-600 dark:text-zinc-400"
                        >
                          Thinking Mode
                        </label>
                      </div>
                      {thinkingMode && (
                        <div>
                          <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                            Thinking Budget (tokens)
                          </label>
                          <input
                            type="number"
                            value={thinkingBudget}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setThinkingBudget(isNaN(v) ? 0 : v);
                            }}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Embedding-specific config */}
                  {form.model_type === "embedding" && (
                    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-700 space-y-3">
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Embedding Parameters
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                          Dimensions (optional)
                        </label>
                        <input
                          type="number"
                          value={dimensions}
                          onChange={(e) => setDimensions(e.target.value)}
                          placeholder="Default"
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                          Input Type (optional)
                        </label>
                        <select
                          value={inputType}
                          onChange={(e) => setInputType(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        >
                          <option value="">None</option>
                          <option value="search_query">search_query</option>
                          <option value="search_document">
                            search_document
                          </option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* API Credentials */}
                  <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-700 space-y-3">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      API Credentials
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        API Base URL (optional)
                      </label>
                      <input
                        type="text"
                        value={apiBase}
                        onChange={(e) => setApiBase(e.target.value)}
                        placeholder="e.g. https://open.bigmodel.cn/api/paas/v4"
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                        API Key (optional)
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setApiKeyChanged(true);
                        }}
                        placeholder={editingId ? "留空则保持不变" : "sk-..."}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      {editingId && !apiKeyChanged && apiKey && (
                        <p className="mt-1 text-[10px] text-zinc-400">
                          当前已配置 (已脱敏显示)
                        </p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Ping result */}
                {pingResult && (
                  <div
                    className={`mt-3 rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap ${
                      pingResult.status === "ok"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                    }`}
                  >
                    {pingResult.message}
                    {pingResult.latency_ms != null &&
                      pingResult.latency_ms > 0 && (
                        <span className="ml-1 opacity-60">
                          ({pingResult.latency_ms}ms)
                        </span>
                      )}
                  </div>
                )}

                {/* 底部操作栏 */}
                <div className="mt-5 flex items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enabled"
                        checked={form.enabled}
                        onChange={(e) =>
                          setForm({ ...form, enabled: e.target.checked })
                        }
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      <label
                        htmlFor="enabled"
                        className="text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        Enabled
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handlePing}
                      disabled={pinging || !form.vendor || !form.model_name}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                    >
                      {pinging ? "Pinging..." : "Ping"}
                    </button>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !form.display_name || !form.model_name}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : editingId ? "Update" : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vendor Setup Dialog */}
          <OverlayDismissLayer
            open={vendorDialogOpen}
            onClose={closeVendorDialog}
            busy={vendorSaving}
            containerClassName="fixed inset-0 flex items-center justify-center p-4"
            contentClassName="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            contentProps={{ role: "dialog", "aria-modal": true }}
          >
            {vendorDialogVendor && (() => {
              const vcInfo = VENDOR_SETUP_CONFIG.find((v) => v.value === vendorDialogVendor);
              const existing = vendorConfigs.find((c) => c.vendor === vendorDialogVendor);
              const isEditing = existing?.configured ?? false;
              return (
                <>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                    Setup {vcInfo?.label ?? vendorDialogVendor}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        API Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={vendorApiKey}
                        onChange={(e) => {
                          setVendorApiKey(e.target.value);
                          setVendorApiKeyChanged(true);
                        }}
                        placeholder={isEditing ? "留空则保持不变" : ""}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      {isEditing && (
                        <p className="mt-1 text-[10px] text-zinc-400">
                          当前已配置 API Key，留空则保持不变
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Base URL (optional)
                      </label>
                      <input
                        type="text"
                        value={vendorApiBase}
                        onChange={(e) => setVendorApiBase(e.target.value)}
                        placeholder={vcInfo?.baseUrlPlaceholder}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    </div>

                    {vcInfo && (
                      <a
                        href={vcInfo.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Get your API Key from {vcInfo.label} &rarr;
                      </a>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-2">
                    {isEditing && (
                      <button
                        onClick={handleVendorRemove}
                        disabled={vendorSaving}
                        className="mr-auto px-4 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500 transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      onClick={closeVendorDialog}
                      disabled={vendorSaving}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVendorSave}
                      disabled={vendorSaving || (!isEditing && !vendorApiKey.trim())}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {vendorSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </>
              );
            })()}
          </OverlayDismissLayer>
        </div>
      </div>
    </div>
  );
}
