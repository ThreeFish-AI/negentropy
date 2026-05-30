/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "./_components/ConfirmDialog";
import { SkillCard } from "./_components/SkillCard";
import { SkillFormDialog } from "./_components/SkillFormDialog";
import { SkillPreviewDialog } from "./_components/SkillPreviewDialog";
import { SkillScheduleDialog } from "./_components/SkillScheduleDialog";
import { SkillVersionsDialog } from "./_components/SkillVersionsDialog";
import { TemplatePickerDialog } from "./_components/TemplatePickerDialog";

interface Skill {
  id: string;
  owner_id: string;
  visibility: string;
  name: string;
  display_name: string | null;
  description: string | null;
  category: string;
  version: string;
  prompt_template: string | null;
  config_schema: Record<string, unknown>;
  default_config: Record<string, unknown>;
  required_tools: string[];
  is_enabled: boolean;
  priority: number;
  enforcement_mode?: string;
  resources?: Array<{ type?: string; ref?: string; title?: string; lazy?: boolean }>;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null);
  const [versionsSkill, setVersionsSkill] = useState<Skill | null>(null);
  const [scheduleSkill, setScheduleSkill] = useState<Skill | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      const url = categoryFilter
        ? `/api/interface/skills?category=${encodeURIComponent(categoryFilter)}`
        : "/api/interface/skills";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch skills");
      }
      const data = await response.json();
      setSkills(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const handleCreate = () => {
    setEditingSkill(null);
    setDialogOpen(true);
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setDialogOpen(true);
  };

  const handleDeleteRequest = (skill: Skill) => {
    setPendingDelete(skill);
  };

  const handleDeleteConfirmed = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    try {
      const response = await fetch(`/api/interface/skills/${target.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Failed to delete skill";
        try {
          const body = await response.json();
          message = body?.detail || body?.message || message;
        } catch {
          // body not JSON — keep generic message
        }
        throw new Error(message);
      }
      toast.success(`Deleted skill "${target.display_name || target.name}"`);
      setPendingDelete(null);
      void fetchSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (skill: Skill) => {
    setTogglingId(skill.id);
    const next = !skill.is_enabled;
    try {
      const response = await fetch(`/api/interface/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: next }),
      });
      if (!response.ok) {
        let message = "Failed to update skill";
        try {
          const body = await response.json();
          message = body?.detail || body?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      toast.success(`${next ? "Enabled" : "Disabled"} "${skill.display_name || skill.name}"`);
      void fetchSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSkill(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    const url = editingSkill
      ? `/api/interface/skills/${editingSkill.id}`
      : "/api/interface/skills";
    const method = editingSkill ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let message = "Failed to save skill";
      try {
        const body = await response.json();
        message = body?.detail || body?.message || message;
      } catch {
        // body not JSON
      }
      // 同时发 toast 与抛错：toast 抓注意力，banner 保留上下文。
      toast.error(message);
      throw new Error(message);
    }

    toast.success(
      editingSkill
        ? `Updated skill "${(data.display_name as string) || (data.name as string)}"`
        : `Created skill "${(data.display_name as string) || (data.name as string)}"`,
    );
    handleDialogClose();
    void fetchSkills();
  };

  const categories = [...new Set(skills.map((s) => s.category))];

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Skills" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Skills
                </h1>
                <p className="text-sm text-text-muted">
                  Define reusable skill modules with prompt templates.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setTemplatePickerOpen(true)}
                  data-testid="skills-from-template"
                >
                  From Template…
                </Button>
                <Button
                  variant="neutral"
                  onClick={handleCreate}
                >
                  Add Skill
                </Button>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-text-muted">Filter:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {loading ? (
              <div
                data-testid="skills-loading-skeleton"
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
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
                title="Failed to load skills"
                description={error}
                onRetry={fetchSkills}
              />
            ) : skills.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No skills defined yet."
                action={
                  <Button variant="link" size="sm" onClick={handleCreate}>
                    Create your first skill →
                  </Button>
                }
              />
            ) : (
              <div
                data-testid="skills-grid"
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                {skills.map((skill) => (
                  <div key={skill.id} className="h-[196px]" data-testid="skill-grid-item">
                    <SkillCard
                      skill={skill}
                      onEdit={() => handleEdit(skill)}
                      onDelete={() => handleDeleteRequest(skill)}
                      onToggleEnabled={() => handleToggleEnabled(skill)}
                      onPreview={() => setPreviewSkill(skill)}
                      onViewVersions={() => setVersionsSkill(skill)}
                      onManageSchedule={() => setScheduleSkill(skill)}
                      toggling={togglingId === skill.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SkillFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        skill={editingSkill}
      />

      <TemplatePickerDialog
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onInstalled={() => {
          void fetchSkills();
        }}
      />

      <SkillPreviewDialog
        open={previewSkill !== null}
        onClose={() => setPreviewSkill(null)}
        skillId={previewSkill?.id || null}
        displayName={previewSkill?.display_name || previewSkill?.name || ""}
        defaultVariables={(previewSkill?.default_config || {}) as Record<string, unknown>}
      />

      <SkillVersionsDialog
        open={versionsSkill !== null}
        onClose={() => setVersionsSkill(null)}
        skillId={versionsSkill?.id || null}
        displayName={versionsSkill?.display_name || versionsSkill?.name || ""}
      />

      <SkillScheduleDialog
        open={scheduleSkill !== null}
        onClose={() => setScheduleSkill(null)}
        skillId={scheduleSkill?.id || null}
        displayName={scheduleSkill?.display_name || scheduleSkill?.name || ""}
        defaultVars={(scheduleSkill?.default_config || {}) as Record<string, unknown>}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete skill?"
        message={
          pendingDelete
            ? `"${pendingDelete.display_name || pendingDelete.name}" will be permanently removed. This action cannot be undone.`
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
