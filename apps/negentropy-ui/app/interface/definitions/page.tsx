/* eslint-disable react-hooks/set-state-in-effect --
 * 与 skills / routine 页一致：useEffect 内经 useCallback fetcher 拉列表并回写 state
 * （既有项目范式）。功能正确，仅命中 React 19 严格规则集告警。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileCode2 } from "lucide-react";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { navPillClassName } from "@/components/ui/nav-styles";
import {
  deleteDefinition,
  fetchDefinitions,
  type DefinitionDTO,
  type DefinitionKind,
  DEFINITION_KIND_META,
  DEFINITION_KINDS,
} from "@/features/definitions";
import { DefinitionTable } from "./_components/DefinitionTable";
import { DefinitionEditDrawer } from "./_components/DefinitionEditDrawer";

const PAGE_SIZE = 50;

export default function DefinitionsPage() {
  const [kind, setKind] = useState<DefinitionKind>("skill_template");
  const [rows, setRows] = useState<DefinitionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DefinitionDTO | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DefinitionDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDefinitions({
        kind,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setRows(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [kind, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const handleEdit = (d: DefinitionDTO) => {
    setEditing(d);
    setDrawerOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await deleteDefinition(target.id);
      toast.success(`已删除定义 “${target.key}”`);
      setPendingDelete(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Definitions" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Definitions</h1>
              <p className="text-sm text-text-muted">
                定义源单一事实源（SSOT）：整段 YAML / Markdown 入库，表单编辑器维护。
              </p>
            </div>
            <Button variant="neutral" onClick={handleCreate}>
              新建定义
            </Button>
          </div>

          {/* kind 分组 tab */}
          <div className="mb-4 flex flex-wrap gap-2">
            {DEFINITION_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setPage(1);
                }}
                className={navPillClassName(kind === k)}
              >
                {DEFINITION_KIND_META[k].label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" label="加载中" className="text-text-muted" />
            </div>
          ) : error ? (
            <ErrorState title="加载定义源失败" description={error} onRetry={load} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileCode2}
              title={`暂无「${DEFINITION_KIND_META[kind].label}」定义`}
              description={DEFINITION_KIND_META[kind].blurb}
              action={
                <Button variant="link" size="sm" onClick={handleCreate}>
                  新建第一条 →
                </Button>
              }
            />
          ) : (
            <>
              <DefinitionTable rows={rows} onEdit={handleEdit} onDelete={setPendingDelete} />
              {totalPages > 1 ? (
                <div className="mt-4">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    itemLabel="definition"
                    onPageChange={setPage}
                    disabled={loading}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <DefinitionEditDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={load}
        definition={editing}
        defaultKind={kind}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除定义源？"
        message={
          pendingDelete
            ? `“${pendingDelete.key}” 将被永久删除，此操作不可撤销。`
            : ""
        }
        confirmLabel="删除"
        cancelLabel="取消"
        destructive
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
