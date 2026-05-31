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
import { ArrowLeft, Plus, Sparkles } from "lucide-react";

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

import { TemplateCard } from "../_components/TemplateCard";
import { TemplateFormDialog } from "../_components/TemplateFormDialog";
import { CreateFromTemplateDialog } from "../_components/CreateFromTemplateDialog";
import { TemplateDetailDrawer } from "../_components/TemplateDetailDrawer";

const GRID_CLS = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

/**
 * Routine Templates CRUD 页面。
 *
 * 合并展示内置 YAML 预设（source=builtin，只读）与用户自建模板（source=user，可 CRUD）。
 * 交互流：
 * - "New Template" → TemplateFormDialog(create)
 * - 卡片点击 → TemplateDetailDrawer 查看详情
 * - "使用模板" → CreateFromTemplateDialog（填 key+cwd → 创建 Routine）
 * - "Edit" → TemplateFormDialog(edit)
 * - "Delete" → useConfirmDialog → deleteRoutine → toast + refresh
 */
export default function RoutineTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<RoutineTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineTemplateItem | null>(null);
  const [selectedForUse, setSelectedForUse] = useState<RoutineTemplateItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<RoutineTemplateItem | null>(null);
  // 保留最后一次查看的模板，供 Drawer 关闭动画期间使用
  const [lastViewedTemplate, setLastViewedTemplate] = useState<RoutineTemplateItem | null>(null);

  const openDetail = (t: RoutineTemplateItem) => {
    setSelectedDetail(t);
    setLastViewedTemplate(t);
  };

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

  // ── 分组 ──
  const builtin = templates.filter((t) => t.source === "builtin");
  const user = templates.filter((t) => t.source === "user");

  // ── Handlers ──
  const handleFormSaved = () => {
    setFormOpen(false);
    setEditing(null);
    load();
  };

  const handleUseCreated = (created: RoutineDTO) => {
    setSelectedForUse(null);
    router.push(`/interface/routine/${created.id}`);
  };

  const handleEdit = (template: RoutineTemplateItem) => {
    setEditing(template);
    setFormOpen(true);
  };

  const handleDelete = async (template: RoutineTemplateItem) => {
    if (template.source !== "user") return; // 内置模板不可删除
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
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-6">
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
                <h1 className="text-2xl font-bold text-foreground">Routine Templates</h1>
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
              New Template
            </Button>
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
          ) : templates.length === 0 ? (
            <EmptyState icon={Sparkles} title="No templates available." />
          ) : (
            <>
              {/* Built-in section */}
              {builtin.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    内置模板
                  </h2>
                  <div className={GRID_CLS}>
                    {builtin.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onUse={setSelectedForUse}
                        onClick={openDetail}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* User templates section */}
              {user.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    我的模板
                  </h2>
                  <div className={GRID_CLS}>
                    {user.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        onUse={setSelectedForUse}
                        onClick={openDetail}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <TemplateFormDialog
        open={formOpen}
        template={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleFormSaved}
      />

      {selectedForUse && (
        <CreateFromTemplateDialog
          template={selectedForUse}
          onClose={() => setSelectedForUse(null)}
          onCreated={handleUseCreated}
        />
      )}

      {confirmDialog}

      {/* Detail Drawer（始终挂载以保留 BaseDrawer exit 动画） */}
      <TemplateDetailDrawer
        open={!!selectedDetail}
        template={selectedDetail ?? lastViewedTemplate}
        onClose={() => setSelectedDetail(null)}
        onEdit={(t) => {
          setSelectedDetail(null);
          handleEdit(t);
        }}
        onDelete={(t) => {
          setSelectedDetail(null);
          handleDelete(t);
        }}
        onUse={(t) => {
          setSelectedDetail(null);
          setSelectedForUse(t);
        }}
      />
    </div>
  );
}
