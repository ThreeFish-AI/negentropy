/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderGit2 } from "lucide-react";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  createRepository,
  deleteRepository,
  fetchRepositories,
  updateRepository,
} from "@/features/repositories";
import type {
  RepositoryCreatePayload,
  RepositoryDTO,
  RepositoryUpdatePayload,
} from "@/features/repositories";
import { RepositoryCard } from "./_components/RepositoryCard";
import { RepositoryFormDrawer } from "./_components/RepositoryFormDrawer";

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<RepositoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRepository, setEditingRepository] = useState<RepositoryDTO | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RepositoryDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRepositories = useCallback(async () => {
    try {
      const data = await fetchRepositories();
      setRepositories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRepositories();
  }, [loadRepositories]);

  const handleCreate = () => {
    setEditingRepository(null);
    setDialogOpen(true);
  };

  const handleEdit = (repository: RepositoryDTO) => {
    setEditingRepository(repository);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (repository: RepositoryDTO) => {
    setPendingDelete(repository);
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      await deleteRepository(target.id);
      toast.success(`Deleted repository "${target.display_name || target.name}"`);
      setPendingDelete(null);
      void loadRepositories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingRepository(null);
  };

  const handleFormSubmit = async (
    data: RepositoryCreatePayload | RepositoryUpdatePayload,
  ) => {
    try {
      if (editingRepository) {
        await updateRepository(editingRepository.id, data as RepositoryUpdatePayload);
      } else {
        await createRepository(data as RepositoryCreatePayload);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save repository";
      toast.error(message);
      // 抛出以让抽屉保持打开（对齐 tools 页 handleFormSubmit 语义）
      throw err instanceof Error ? err : new Error(message);
    }

    const label = data.display_name || data.name;
    toast.success(
      editingRepository
        ? `Updated repository "${label}"`
        : `Created repository "${label}"`,
    );
    handleDialogClose();
    void loadRepositories();
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Repositories" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Repositories
                </h1>
                <p className="text-sm text-text-muted">
                  Register local git repositories to drive Routine isolation worktrees.
                </p>
              </div>
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Add Repository
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[196px] rounded-xl border border-border bg-card p-4"
                  >
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
              <ErrorState
                title="Failed to load repositories"
                description={error}
                onRetry={loadRepositories}
              />
            ) : repositories.length === 0 ? (
              <EmptyState
                icon={FolderGit2}
                title="No repositories registered yet"
                action={
                  <button
                    onClick={handleCreate}
                    className="text-sm text-text-secondary hover:text-foreground transition-colors"
                  >
                    Register your first repository →
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {repositories.map((repository) => (
                  <RepositoryCard
                    key={repository.id}
                    repository={repository}
                    onEdit={() => handleEdit(repository)}
                    onDelete={() => handleDeleteRequest(repository)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <RepositoryFormDrawer
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        repository={editingRepository}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete repository?"
        message={
          pendingDelete
            ? `"${pendingDelete.display_name || pendingDelete.name}" will be permanently removed. Routines referencing this repository will fall back to a manually entered path. This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
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
