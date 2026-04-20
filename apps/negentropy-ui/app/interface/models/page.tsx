"use client";

import { useState, useEffect, useCallback } from "react";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { VendorModelsDisclosure } from "@/components/interface/VendorModelsDisclosure";
import {
  MODEL_KINDS,
  type ModelConfigRecord,
  type ModelKind,
} from "@/types/interface-models";

interface VendorConfigData {
  vendor: string;
  apiKey: string | null;
  apiBase: string | null;
  configured: boolean;
}

interface VendorSetupItem {
  value: string;
  label: string;
  helpUrl: string;
  baseUrlPlaceholder: string;
  pingModelPlaceholder: string;
}

const VENDOR_SETUP_CONFIG: VendorSetupItem[] = [
  {
    value: "openai",
    label: "OpenAI",
    helpUrl: "https://platform.openai.com/api-keys",
    baseUrlPlaceholder: "https://api.openai.com/v1",
    pingModelPlaceholder: "gpt-4o-mini",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    helpUrl: "https://console.anthropic.com/settings/keys",
    baseUrlPlaceholder: "https://api.anthropic.com",
    pingModelPlaceholder: "claude-haiku-4-5-20251001",
  },
  {
    value: "gemini",
    label: "Gemini",
    helpUrl: "https://aistudio.google.com/apikey",
    baseUrlPlaceholder: "https://generativelanguage.googleapis.com",
    pingModelPlaceholder: "gemini-2.5-flash",
  },
];

interface PingResult {
  status: "ok" | "error";
  message: string;
  latency_ms?: number;
}

export default function ModelsPage() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!user?.roles?.includes("admin")) {
      router.replace("/interface");
    }
  }, [user, status, router]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vendorConfigs, setVendorConfigs] = useState<VendorConfigData[]>([]);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDialogVendor, setVendorDialogVendor] = useState<string | null>(null);
  const [vendorApiKey, setVendorApiKey] = useState("");
  const [vendorApiBase, setVendorApiBase] = useState("");
  const [vendorApiKeyChanged, setVendorApiKeyChanged] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);

  const [vendorPingModel, setVendorPingModel] = useState("");
  const [vendorPinging, setVendorPinging] = useState(false);
  const [vendorPingResult, setVendorPingResult] = useState<PingResult | null>(null);

  // Registered Models (model_configs) — 全量加载后按 vendor 本地过滤，避免来回请求。
  const [registeredModels, setRegisteredModels] = useState<ModelConfigRecord[]>([]);

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelDialogMode, setModelDialogMode] = useState<"create" | "edit">("create");
  const [modelDialogSaving, setModelDialogSaving] = useState(false);
  const [modelDialogError, setModelDialogError] = useState<string | null>(null);
  const [modelEditingId, setModelEditingId] = useState<string | null>(null);
  const [modelFormType, setModelFormType] = useState<ModelKind>("llm");
  const [modelFormDisplayName, setModelFormDisplayName] = useState("");
  const [modelFormModelName, setModelFormModelName] = useState("");
  const [modelFormIsDefault, setModelFormIsDefault] = useState(false);
  const [modelFormEnabled, setModelFormEnabled] = useState(true);
  const [modelFormDimensions, setModelFormDimensions] = useState("");
  const [modelFormConfigJson, setModelFormConfigJson] = useState("");

  const fetchRegisteredModels = useCallback(async () => {
    try {
      const response = await fetch("/api/interface/models/configs");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRegisteredModels(data.items || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to load registered models: ${err.message}`
          : "Failed to load registered models",
      );
    }
  }, []);

  const fetchVendorConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/interface/models/vendor-configs");
      if (!response.ok) throw new Error("Failed to fetch vendor configs");
      const data = await response.json();
      setVendorConfigs(data.vendorConfigs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendorConfigs();
    fetchRegisteredModels();
  }, [fetchVendorConfigs, fetchRegisteredModels]);

  const openVendorSetup = (vendor: string) => {
    const existing = vendorConfigs.find((vc) => vc.vendor === vendor);
    setVendorDialogVendor(vendor);
    setVendorApiKey(""); // 始终为空，避免脱敏值被误提交
    setVendorApiBase(existing?.apiBase ?? "");
    setVendorApiKeyChanged(false);
    setVendorPingModel("");
    setVendorPingResult(null);
    setVendorDialogOpen(true);
  };

  const closeVendorDialog = () => {
    setVendorDialogOpen(false);
    setVendorDialogVendor(null);
    setVendorApiKey("");
    setVendorApiBase("");
    setVendorApiKeyChanged(false);
    setVendorPingModel("");
    setVendorPingResult(null);
  };

  const handleVendorSave = async () => {
    if (!vendorDialogVendor) return;
    const existing = vendorConfigs.find((vc) => vc.vendor === vendorDialogVendor);
    const isEditing = existing?.configured ?? false;
    if (!isEditing && !vendorApiKey.trim()) return;
    setVendorSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      if (vendorApiKeyChanged && vendorApiKey.trim()) {
        payload.api_key = vendorApiKey.trim();
      } else {
        payload.api_key = null;
      }
      if (vendorApiBase.trim()) {
        payload.api_base = vendorApiBase.trim();
      }
      const response = await fetch(`/api/interface/models/vendor-configs/${vendorDialogVendor}`, {
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
      const response = await fetch(`/api/interface/models/vendor-configs/${vendorDialogVendor}`, {
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

  const handleVendorPing = async () => {
    if (!vendorDialogVendor) return;
    const modelName = vendorPingModel.trim();
    if (!modelName) return;
    setVendorPinging(true);
    setVendorPingResult(null);
    try {
      const payload = {
        vendor: vendorDialogVendor,
        model_name: modelName,
        config: {},
        api_base: vendorApiBase.trim() || null,
        api_key: vendorApiKeyChanged ? vendorApiKey.trim() || null : null,
      };
      const response = await fetch("/api/interface/models/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setVendorPingResult({
          status: "error",
          message: data.error || `HTTP ${response.status}`,
        });
        return;
      }
      const data = await response.json();
      setVendorPingResult(data);
    } catch (err) {
      setVendorPingResult({
        status: "error",
        message: err instanceof Error ? err.message : "网络错误",
      });
    } finally {
      setVendorPinging(false);
    }
  };

  const resetModelForm = () => {
    setModelDialogMode("create");
    setModelEditingId(null);
    setModelFormType("llm");
    setModelFormDisplayName("");
    setModelFormModelName("");
    setModelFormIsDefault(false);
    setModelFormEnabled(true);
    setModelFormDimensions("");
    setModelFormConfigJson("");
    setModelDialogError(null);
  };

  const openAddModelDialog = () => {
    resetModelForm();
    setModelDialogOpen(true);
  };

  const openEditModelDialog = (mc: ModelConfigRecord) => {
    resetModelForm();
    setModelDialogMode("edit");
    setModelEditingId(mc.id);
    setModelFormType(mc.model_type);
    setModelFormDisplayName(mc.display_name);
    setModelFormModelName(mc.model_name);
    setModelFormIsDefault(mc.is_default);
    setModelFormEnabled(mc.enabled);
    const cfg: Record<string, unknown> = { ...(mc.config || {}) };
    if (mc.model_type === "embedding" && cfg.dimensions !== undefined) {
      setModelFormDimensions(String(cfg.dimensions ?? ""));
      delete cfg.dimensions;
    }
    setModelFormConfigJson(Object.keys(cfg).length > 0 ? JSON.stringify(cfg, null, 2) : "");
    setModelDialogOpen(true);
  };

  const closeModelDialog = () => {
    if (modelDialogSaving) return;
    setModelDialogOpen(false);
    resetModelForm();
  };

  const handleModelSave = async () => {
    if (!vendorDialogVendor) return;
    if (!modelFormDisplayName.trim() || !modelFormModelName.trim()) {
      setModelDialogError("Display name 与 Model name 均为必填");
      return;
    }

    let extraConfig: Record<string, unknown> = {};
    if (modelFormConfigJson.trim()) {
      try {
        const parsed = JSON.parse(modelFormConfigJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("配置必须是 JSON 对象");
        }
        extraConfig = parsed as Record<string, unknown>;
      } catch (err) {
        setModelDialogError(
          err instanceof Error ? `配置 JSON 无法解析: ${err.message}` : "配置 JSON 无法解析",
        );
        return;
      }
    }

    if (modelFormType === "embedding") {
      const dims = parseInt(modelFormDimensions, 10);
      if (!Number.isFinite(dims) || dims <= 0) {
        setModelDialogError("Embedding 模型必须提供正整数 dimensions");
        return;
      }
      extraConfig = { ...extraConfig, dimensions: dims };
    }

    setModelDialogSaving(true);
    setModelDialogError(null);
    try {
      if (modelDialogMode === "create") {
        const response = await fetch("/api/interface/models/configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_type: modelFormType,
            display_name: modelFormDisplayName.trim(),
            vendor: vendorDialogVendor,
            model_name: modelFormModelName.trim(),
            is_default: modelFormIsDefault,
            enabled: modelFormEnabled,
            config: extraConfig,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || data.error || `HTTP ${response.status}`);
        }
      } else if (modelEditingId) {
        const response = await fetch(`/api/interface/models/configs/${modelEditingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: modelFormDisplayName.trim(),
            is_default: modelFormIsDefault,
            enabled: modelFormEnabled,
            config: extraConfig,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || data.error || `HTTP ${response.status}`);
        }
      }
      await fetchRegisteredModels();
      setModelDialogOpen(false);
      resetModelForm();
    } catch (err) {
      setModelDialogError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setModelDialogSaving(false);
    }
  };

  const handleModelDelete = async (mc: ModelConfigRecord) => {
    if (!window.confirm(`确认删除 ${mc.display_name}（${mc.vendor}/${mc.model_name}）?`)) return;
    try {
      const response = await fetch(`/api/interface/models/configs/${mc.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const detail = typeof data.detail === "object" ? data.detail : null;
        const msg = detail?.message || data.detail || data.error || `HTTP ${response.status}`;
        const refCount = detail?.reference_count;
        throw new Error(refCount ? `${msg}（仍被 ${refCount} 个 Corpus 引用）` : msg);
      }
      await fetchRegisteredModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const registeredForVendor = vendorDialogVendor
    ? registeredModels.filter((mc) => mc.vendor === vendorDialogVendor)
    : [];

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!user?.roles?.includes("admin")) {
    return null;
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <InterfaceNav title="Models" />
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
              Loading vendor configurations...
            </div>
          ) : (
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
              <div className="grid grid-cols-3 items-start gap-4">
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
                      <VendorModelsDisclosure
                        vendor={vc.value}
                        vendorLabel={vc.label}
                        models={registeredModels}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vendor Setup Dialog */}
          <OverlayDismissLayer
            open={vendorDialogOpen}
            onClose={closeVendorDialog}
            busy={vendorSaving}
            containerClassName="p-4"
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

                    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-700 space-y-3">
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Test Connectivity
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={vendorPingModel}
                          onChange={(e) => setVendorPingModel(e.target.value)}
                          placeholder={vcInfo?.pingModelPlaceholder}
                          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <button
                          type="button"
                          onClick={handleVendorPing}
                          disabled={vendorPinging || !vendorPingModel.trim()}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                        >
                          {vendorPinging ? "Pinging..." : "Ping"}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        发送 &quot;Ping, give me a pong&quot; 验证模型连通性。常用模型示例：{vcInfo?.pingModelPlaceholder}
                      </p>
                      {vendorPingResult && (
                        <div
                          className={`rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap ${
                            vendorPingResult.status === "ok"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                          }`}
                        >
                          {vendorPingResult.message}
                          {vendorPingResult.latency_ms != null &&
                            vendorPingResult.latency_ms > 0 && (
                              <span className="ml-1 opacity-60">
                                ({vendorPingResult.latency_ms}ms)
                              </span>
                            )}
                        </div>
                      )}
                    </div>

                    {/* Registered Models — 按 model_type 分组 */}
                    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Registered Models
                        </div>
                        <button
                          type="button"
                          onClick={openAddModelDialog}
                          className="px-2 py-1 rounded text-[10px] font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                        >
                          + Add Model
                        </button>
                      </div>

                      {registeredForVendor.length === 0 ? (
                        <p className="text-[10px] text-zinc-400">尚未登记模型，点击 &quot;+ Add Model&quot; 添加。</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {MODEL_KINDS.map((mk) => {
                            const items = registeredForVendor.filter(
                              (mc) => mc.model_type === mk.value,
                            );
                            if (items.length === 0) return null;
                            return (
                              <div key={mk.value}>
                                <div className="text-[10px] text-zinc-400 font-medium mb-1">
                                  {mk.label}
                                </div>
                                <div className="space-y-1">
                                  {items.map((mc) => (
                                    <div
                                      key={mc.id}
                                      className="flex items-center gap-2 rounded border border-zinc-100 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                                    >
                                      <span className="flex-1 min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                                        {mc.display_name}
                                        <span className="text-zinc-400 font-normal ml-1">
                                          {mc.model_name}
                                        </span>
                                      </span>
                                      {mc.config?.dimensions != null && (
                                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                          {String(mc.config.dimensions)} dims
                                        </span>
                                      )}
                                      {mc.is_default && (
                                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                          Default
                                        </span>
                                      )}
                                      {!mc.enabled && (
                                        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                                          Disabled
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => openEditModelDialog(mc)}
                                        className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                        title="Edit"
                                      >
                                        &#9998;
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleModelDelete(mc)}
                                        className="shrink-0 text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                                        title="Delete"
                                      >
                                        &#10005;
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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

          {/* Model Config Add/Edit Dialog */}
          <OverlayDismissLayer
            open={modelDialogOpen}
            onClose={closeModelDialog}
            busy={modelDialogSaving}
            containerClassName="p-4"
            contentClassName="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            contentProps={{ role: "dialog", "aria-modal": true }}
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {modelDialogMode === "create" ? "Add Model" : "Edit Model"}
            </h3>

            {modelDialogError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {modelDialogError}
              </div>
            )}

            <div className="space-y-3">
              {modelDialogMode === "create" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Model Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={modelFormType}
                      onChange={(e) => setModelFormType(e.target.value as ModelKind)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    >
                      {MODEL_KINDS.map((mk) => (
                        <option key={mk.value} value={mk.value}>
                          {mk.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Model Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={modelFormModelName}
                      onChange={(e) => setModelFormModelName(e.target.value)}
                      placeholder="e.g. gpt-4o-mini / text-embedding-3-small"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={modelFormDisplayName}
                  onChange={(e) => setModelFormDisplayName(e.target.value)}
                  placeholder="e.g. GPT-4o Mini"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {modelFormType === "embedding" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Dimensions <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={modelFormDimensions}
                    onChange={(e) => setModelFormDimensions(e.target.value)}
                    placeholder="e.g. 1536"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Extra Config (JSON, optional)
                </label>
                <textarea
                  value={modelFormConfigJson}
                  onChange={(e) => setModelFormConfigJson(e.target.value)}
                  placeholder='{"thinking": {"type": "enabled", "budget_tokens": 5000}}'
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={modelFormIsDefault}
                    onChange={(e) => setModelFormIsDefault(e.target.checked)}
                    className="rounded"
                  />
                  Set as default
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={modelFormEnabled}
                    onChange={(e) => setModelFormEnabled(e.target.checked)}
                    className="rounded"
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={closeModelDialog}
                disabled={modelDialogSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleModelSave}
                disabled={modelDialogSaving || !modelFormDisplayName.trim() || (modelDialogMode === "create" && !modelFormModelName.trim())}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {modelDialogSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </OverlayDismissLayer>
        </div>
      </div>
    </div>
  );
}
