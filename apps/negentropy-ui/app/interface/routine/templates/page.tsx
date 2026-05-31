/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在挂载取数模式（useEffect 内触发 fetcher → 异步回调 setState）下命中告警。
 * 该模式功能正确，与同目录 RoutineFleetView 一致；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchPresets } from "@/features/routine";
import type { RoutineDTO, RoutinePresetSummary } from "@/features/routine";

import { CreateFromTemplateDialog } from "../_components/CreateFromTemplateDialog";
import { PresetCard } from "../_components/PresetCard";

const GRID_CLS = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

/**
 * Routine Templates 子页面（模版画廊）。
 *
 * 取代原 PresetPickerDialog 模态框：以独立子页面 + 响应式三列网格承载内置预设模版，
 * 点击卡片「使用模板」→ 创建对话框填 key+cwd → 创建后跳转该 Routine 详情页。
 * 无 useSearchParams，故无需 Suspense 包裹。
 */
export default function RoutineTemplatesPage() {
  const router = useRouter();
  const [presets, setPresets] = useState<RoutinePresetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RoutinePresetSummary | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPresets()
      .then((data) => setPresets(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "An error occurred"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = (created: RoutineDTO) => {
    setSelected(null);
    router.push(`/interface/routine/${created.id}`);
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <div className="space-y-5 px-6 py-6">
          {/* 头部：返回 + 标题 + 副标题 */}
          <div className="flex items-center gap-3">
            <Link
              href="/interface/routine"
              aria-label="返回 Routine 列表"
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Routine Templates</h1>
              <p className="text-sm text-text-muted">
                从内置场景模板快速创建一个 Routine —— 覆盖代码审计、测试增强、文档生成与架构清减
              </p>
            </div>
          </div>

          {loading ? (
            <div className={GRID_CLS}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-card border border-border bg-card p-4">
                  <Skeleton className="mb-3 h-5 w-1/3" />
                  <div className="mb-2 flex gap-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="mb-1 h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Failed to load templates" description={error} onRetry={load} />
          ) : presets.length === 0 ? (
            <EmptyState icon={Sparkles} title="No built-in templates available." />
          ) : (
            <div className={GRID_CLS}>
              {presets.map((preset) => (
                <PresetCard key={preset.preset_id} preset={preset} onUse={setSelected} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <CreateFromTemplateDialog
          preset={selected}
          onClose={() => setSelected(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
