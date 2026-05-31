/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在挂载取数模式（useEffect 内触发 fetcher → 异步回调 setState）下命中告警。
 * 该模式功能正确，与同目录 RoutineFleetView 一致；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  deleteRoutine,
  fetchTemplates,
} from "@/features/routine";
import type { RoutineDTO, RoutineTemplateItem } from "@/features/routine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { TemplateCard } from "../_components/TemplateCard";
import { TemplateFormDialog } from "../_components/TemplateFormDialog";
import { TemplateDetailDrawer } from "../_components/TemplateDetailDrawer";
import { InlineCreateFromTemplate } from "../_components/InlineCreateFromTemplate";

const GRID_CLS = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

type SourceFilter = "all" | "builtin" | "user";

/**
 * Routine Templates CRUD 页面。
 *
 * 合并展示内置 YAML 预设（source=builtin，只读）与用户自建模板（source=user，可 CRUD）。
 * 提供搜索、分类筛选、来源切换；点击卡片打开详情抽屉。
 * 交互流：
 * - "新建模板" → TemplateFormDialog(create)
 * - 卡片点击 → TemplateDetailDrawer（详情抽屉）
 * - "使用此模板" → 内联创建栏（填 cwd → 创建 Routine → 跳转）
 * - "编辑" → TemplateFormDialog(edit)
 * - "删除" → useConfirmDialog → deleteRoutine → toast + refresh
 */
export default function RoutineTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<RoutineTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // Dialog / Drawer 状态
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineTemplateItem | null>(null);
  const [activeUseTemplateId, setActiveUseTemplateId] = useState<string | null>(null);
  const [selectedForDetail, setSelectedForDetail] = useState<RoutineTemplateItem | null>(null);

  const { confirm, confirmDialog } = useConfirmDialog();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTemplates()
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "An error occurred"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── 动态分类列表 ──
  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ["全部", ...Array.from(cats).sort()];
  }, [templates]);

  // ── 客户端过滤 ──
  const filtered = useMemo(() => {
    return templates.filter((t) => {
      // 来源过滤
      if (sourceFilter === "builtin" && t.source !== "builtin") return false;
      if (sourceFilter === "user" && t.source !== "user") return false;
      // 分类过滤
      if (activeCategory && activeCategory !== "全部" && t.category !== activeCategory) return false;
      // 搜索过滤
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.display_name.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [templates, sourceFilter, activeCategory, searchQuery]);

  // ── Handlers ──
  const handleFormSaved = () => {
    setFormOpen(false);
    setEditing(null);
    load();
  };

  const handleUseCreated = (created: RoutineDTO) => {
    setActiveUseTemplateId(null);
    router.push(`/interface/routine/${created.id}`);
  };

  const handleEdit = (template: RoutineTemplateItem) => {
    setSelectedForDetail(null);
    setEditing(template);
    setFormOpen(true);
  };

  const handleDelete = async (template: RoutineTemplateItem) => {
    const ok = await confirm({
      title: "删除模板",
      message: `确定要删除「${template.display_name}」吗？此操作不可撤销。`,
      confirmLabel: "删除",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteRoutine(template.id);
      toast.success(`模板「${template.display_name}」已删除`);
      setSelectedForDetail(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const inputCls =
    "w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-border focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <div className="space-y-5 px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/interface/routine"
                aria-label="返回 Routine 列表"
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">模板库</h1>
                <p className="text-sm text-text-muted">
                  从内置预设或自定义模板快速创建 Routine
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              新建模板
            </Button>
          </div>

          {/* 命令栏：搜索 + 分类 + 来源切换 */}
          {!error && templates.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* 搜索框 */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索模板名称、描述、分类…"
                  className={cn(inputCls, "pl-9")}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* 分类标签栏 */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat === "全部" ? null : cat)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        (cat === "全部" && !activeCategory) || cat === activeCategory
                          ? "bg-primary/10 text-primary"
                          : "bg-card text-text-secondary hover:bg-border/60",
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* 来源切换 */}
                <div className="flex items-center rounded-control border border-border bg-card p-0.5">
                  {([
                    { value: "all" as const, label: "全部" },
                    { value: "builtin" as const, label: "内置" },
                    { value: "user" as const, label: "我的" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSourceFilter(opt.value)}
                      className={cn(
                        "rounded-control px-3 py-1 text-xs font-medium transition-colors",
                        sourceFilter === opt.value
                          ? "bg-muted text-foreground shadow-xs"
                          : "text-text-muted hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 内容区 */}
          {loading ? (
            <div className={GRID_CLS}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-card border border-border bg-card p-4">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="mb-2 h-5 w-1/2" />
                  <Skeleton className="mb-1 h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState title="加载模板失败" description={error} onRetry={load} />
          ) : templates.length === 0 ? (
            <EmptyState icon={Sparkles} title="暂无模板" />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">没有匹配的模板</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory(null);
                  setSourceFilter("all");
                }}
              >
                清除筛选
              </Button>
            </div>
          ) : (
            <div className={GRID_CLS}>
              {filtered.map((t) => (
                <div key={t.id}>
                  <TemplateCard
                    template={t}
                    onDetail={setSelectedForDetail}
                    onUse={(tmpl) => setActiveUseTemplateId(tmpl.id)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                  {activeUseTemplateId === t.id && (
                    <InlineCreateFromTemplate
                      template={t}
                      onClose={() => setActiveUseTemplateId(null)}
                      onCreated={handleUseCreated}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 详情抽屉 */}
      {selectedForDetail && (
        <TemplateDetailDrawer
          template={selectedForDetail}
          onClose={() => setSelectedForDetail(null)}
          onUse={(t) => {
            setSelectedForDetail(null);
            setActiveUseTemplateId(t.id);
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* 表单对话框 */}
      <TemplateFormDialog
        open={formOpen}
        template={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleFormSaved}
      />

      {confirmDialog}
    </div>
  );
}
