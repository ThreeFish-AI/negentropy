"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { ConfirmDialog } from "./_components/ConfirmDialog";
import { SkillCard } from "./_components/SkillCard";
import { SkillFormDialog } from "./_components/SkillFormDialog";

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
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <InterfaceNav title="Skills" />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Skills
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Define reusable skill modules with prompt templates.
                </p>
              </div>
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Add Skill
              </button>
            </div>

            {categories.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Filter:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                    className="h-[196px] animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="mb-3 h-5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="mb-2 flex gap-2">
                      <div className="h-4 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      <div className="h-4 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                    <div className="mb-1 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div role="alert" className="text-sm text-red-500">
                {error}
              </div>
            ) : skills.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-zinc-400 dark:text-zinc-500 mb-4">
                  No skills defined yet.
                </div>
                <button
                  onClick={handleCreate}
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Create your first skill →
                </button>
              </div>
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
