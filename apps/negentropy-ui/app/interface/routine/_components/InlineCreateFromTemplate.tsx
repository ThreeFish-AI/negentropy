"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createRoutineFromPreset } from "@/features/routine";
import type { RoutineDTO, RoutineTemplateItem } from "@/features/routine";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InlineCreateFromTemplateProps {
  template: RoutineTemplateItem;
  onClose: () => void;
  /** 创建成功回调 */
  onCreated: (created: RoutineDTO) => void;
}

/**
 * 内联创建栏 — 在卡片下方展开，替代模态弹窗。
 *
 * 用户仅需提供工作目录，Key 自动生成。
 * 按 source 分支发送 preset_id 或 template_id。
 */
export function InlineCreateFromTemplate({
  template,
  onClose,
  onCreated,
}: InlineCreateFromTemplateProps) {
  const [cwd, setCwd] = useState("");
  const [creating, setCreating] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const key = `${template.key}-${crypto.randomUUID().slice(0, 4)}`;

  const inputCls =
    "w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  const handleCreate = async () => {
    if (!cwd.trim()) {
      setFieldError("工作目录为必填项");
      return;
    }
    setCreating(true);
    setFieldError(null);
    try {
      const payload =
        template.source === "builtin"
          ? { preset_id: template.key, key, cwd: cwd.trim() }
          : { template_id: template.id, key, cwd: cwd.trim() };
      const created = await createRoutineFromPreset(payload);
      toast.success(`已基于「${template.display_name}」创建 Routine`);
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="animate-enter rounded-card border border-t-0 border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-medium text-text-muted">
            Key（自动生成）
          </label>
          <input type="text" value={key} disabled className={cn(inputCls, "text-text-muted")} />
        </div>
        <div className="flex-[2]">
          <label className="mb-1 block text-[10px] font-medium text-text-muted">
            工作目录 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={cwd}
            onChange={(e) => {
              setCwd(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            placeholder="/path/to/project"
            className={cn(inputCls, fieldError && !cwd.trim() && "border-red-400")}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={creating}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={creating}
            disabled={!cwd.trim()}
            onClick={handleCreate}
          >
            创建并跳转 →
          </Button>
        </div>
      </div>
      {fieldError && (
        <p className="mt-1 text-[10px] text-red-500">{fieldError}</p>
      )}
    </div>
  );
}
