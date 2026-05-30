"use client";

import { useState } from "react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { Button } from "@/components/ui/Button";
import { createRoutineFromPreset } from "@/features/routine";
import type { RoutineDTO, RoutinePresetSummary } from "@/features/routine";
import { toast } from "sonner";

interface CreateFromTemplateDialogProps {
  /** 仅在选中某个模版时渲染本对话框。 */
  preset: RoutinePresetSummary;
  onClose: () => void;
  /** 创建成功回调，回传后端返回的 RoutineDTO（含 id）供父组件导航。 */
  onCreated: (created: RoutineDTO) => void;
}

/**
 * 从预设模版创建 Routine 的轻量对话框。
 *
 * 设计：
 * - 用户仅需提供 key（自动生成、可编辑）+ cwd（必填）；其余字段由后端预设填充；
 * - 创建走 BFF POST /api/routine/from-preset；
 * - 使用 useState 懒初始化生成 key，无 useEffect 取数，故无需 react-compiler 豁免。
 */
export function CreateFromTemplateDialog({ preset, onClose, onCreated }: CreateFromTemplateDialogProps) {
  const [key, setKey] = useState(() => `${preset.preset_id}-${crypto.randomUUID().slice(0, 4)}`);
  const [cwd, setCwd] = useState("");
  const [creating, setCreating] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const inputCls =
    "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-border focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
  const labelCls = "mb-1 block text-xs font-medium text-text-secondary";

  const handleCreate = async () => {
    if (!cwd.trim()) {
      setFieldError("Working Directory is required");
      return;
    }
    if (!key.trim()) {
      setFieldError("Key is required");
      return;
    }
    setCreating(true);
    setFieldError(null);
    try {
      const created = await createRoutineFromPreset({ preset_id: preset.preset_id, key: key.trim(), cwd: cwd.trim() });
      toast.success(`Routine created from "${preset.display_name}"`);
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreating(false);
    }
  };

  return (
    <OverlayDismissLayer
      open
      onClose={onClose}
      busy={creating}
      containerClassName="flex min-h-full items-center justify-center overflow-y-auto p-4 sm:p-6"
      contentClassName="my-3 flex w-full max-w-md flex-col overflow-hidden rounded-modal border border-border bg-card shadow-xl"
    >
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">使用模板：{preset.display_name}</h2>
        <p className="mt-1 text-sm text-text-muted">提供 Key 与工作目录即可创建，其余配置由模板预填</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div>
          <label className={labelCls}>
            Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="unique_routine_key"
            className={`${inputCls} ${fieldError && !key.trim() ? "border-red-400" : ""}`}
          />
        </div>
        <div>
          <label className={labelCls}>
            Working Directory <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/path/to/project"
            className={`${inputCls} ${fieldError && !cwd.trim() ? "border-red-400" : ""}`}
          />
          {fieldError && <p className="mt-0.5 text-[10px] text-red-500">{fieldError}</p>}
          <p className="mt-0.5 text-[10px] text-text-muted">
            Routine 执行的工作目录，指向你要操作的项目根路径
          </p>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-3 border-t border-border bg-card px-5 py-4">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={creating}>
          Cancel
        </Button>
        <Button
          variant="neutral"
          size="sm"
          loading={creating}
          disabled={!key.trim() || !cwd.trim()}
          onClick={handleCreate}
        >
          Create Routine
        </Button>
      </div>
    </OverlayDismissLayer>
  );
}
