"use client";

import { useCallback, useEffect, useState } from "react";
import { PluginsNav } from "@/components/ui/PluginsNav";
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

  const fetchSkills = useCallback(async () => {
    try {
      const url = categoryFilter
        ? `/api/plugins/skills?category=${encodeURIComponent(categoryFilter)}`
        : "/api/plugins/skills";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch skills");
      }
      const data = await response.json();
      setSkills(data);
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

  const handleDelete = async (skillId: string) => {
    if (!confirm("Are you sure you want to delete this skill?")) {
      return;
    }
    try {
      const response = await fetch(`/api/plugins/skills/${skillId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete skill");
      }
      fetchSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSkill(null);
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    try {
      const url = editingSkill
        ? `/api/plugins/skills/${editingSkill.id}`
        : "/api/plugins/skills";
      const method = editingSkill ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save skill");
      }

      handleDialogClose();
      fetchSkills();
    } catch (err) {
      throw err;
    }
  };

  const categories = [...new Set(skills.map((s) => s.category))];

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <PluginsNav title="Skills" />
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
              <div className="text-sm text-zinc-500">Loading...</div>
            ) : error ? (
              <div className="text-sm text-red-500">{error}</div>
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
                      onDelete={() => handleDelete(skill.id)}
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
    </div>
  );
}
