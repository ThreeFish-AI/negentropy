/* eslint-disable react-hooks/set-state-in-effect --
 * 与 skills / routine 抽屉一致：打开或切换编辑目标时用 useEffect 从 props 播种表单
 * 基线（既有项目范式）。这些回写功能正确，仅命中 React 19 严格规则集告警。
 * TODO(react-compiler): 后续按 key 重挂载 / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/Button";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  createDefinition,
  updateDefinition,
  type DefinitionDTO,
  type DefinitionFormat,
  type DefinitionKind,
  DEFINITION_KIND_META,
  DEFINITION_KINDS,
} from "@/features/definitions";

interface FormState {
  kind: DefinitionKind;
  key: string;
  format: DefinitionFormat;
  source: string;
  is_enabled: boolean;
  is_system: boolean;
  sort_order: number;
}

function seedForm(def: DefinitionDTO | null, defaultKind: DefinitionKind): FormState {
  if (def) {
    return {
      kind: def.kind,
      key: def.key,
      format: def.format,
      source: def.source,
      is_enabled: def.is_enabled,
      is_system: def.is_system,
      sort_order: def.sort_order,
    };
  }
  return {
    kind: defaultKind,
    key: "",
    format: DEFINITION_KIND_META[defaultKind].format,
    source: "",
    is_enabled: true,
    is_system: false,
    sort_order: 0,
  };
}

export function DefinitionEditDrawer({
  open,
  onClose,
  onSaved,
  definition,
  defaultKind,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  definition: DefinitionDTO | null;
  defaultKind: DefinitionKind;
}) {
  const [form, setForm] = useState<FormState>(() => seedForm(definition, defaultKind));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = definition !== null;

  useEffect(() => {
    if (!open) return;
    setForm(seedForm(definition, defaultKind));
    setFieldErrors({});
    setError(null);
  }, [open, definition, defaultKind]);

  const parsedMeta = useMemo(() => (definition?.meta ?? {}) as Record<string, unknown>, [definition]);

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!form.key.trim()) errs.key = "key 必填";
    if (!form.source.trim()) errs.source = "定义源不能为空";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing && definition) {
        await updateDefinition(definition.id, {
          source: form.source,
          key: definition.is_system ? undefined : form.key.trim(),
          format: form.format,
          is_enabled: form.is_enabled,
          sort_order: form.sort_order,
        });
        toast.success(`已更新定义 “${form.key}”`);
      } else {
        await createDefinition({
          kind: form.kind,
          key: form.key.trim(),
          source: form.source,
          format: form.format,
          is_enabled: form.is_enabled,
          is_system: form.is_system,
          sort_order: form.sort_order,
        });
        toast.success(`已创建定义 “${form.key}”`);
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "保存失败";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const kindMeta = DEFINITION_KIND_META[form.kind];

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title={isEditing ? `编辑定义源 · ${definition?.key}` : "新建定义源"}
      subtitle={kindMeta.blurb}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {isEditing ? "保存" : "创建"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <Field label="Kind" required>
          {isEditing ? (
            <Input value={DEFINITION_KIND_META[form.kind].label} readOnly disabled />
          ) : (
            <Select
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as DefinitionKind;
                setForm((f) => ({ ...f, kind, format: DEFINITION_KIND_META[kind].format }));
              }}
            >
              {DEFINITION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DEFINITION_KIND_META[k].label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Key" required error={fieldErrors.key} description="定义族内唯一键（承接 template_id / preset_id / 技能名 / Agent name）">
          <Input
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            readOnly={isEditing && !!definition?.is_system}
            disabled={isEditing && !!definition?.is_system}
            placeholder="e.g. pdf_fidelity_restore"
          />
        </Field>

        <Field label="Format" required>
          <Select
            value={form.format}
            onChange={(e) => setForm((f) => ({ ...f, format: e.target.value as DefinitionFormat }))}
          >
            <option value="yaml">yaml</option>
            <option value="markdown">markdown</option>
          </Select>
        </Field>

        <Field label="启用" variant="check">
          <input
            type="checkbox"
            checked={form.is_enabled}
            onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-border"
          />
        </Field>

        {!isEditing ? (
          <Field label="系统内置" variant="check" hint="系统内置定义受保护、禁止删除（可停用）">
            <input
              type="checkbox"
              checked={form.is_system}
              onChange={(e) => setForm((f) => ({ ...f, is_system: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
          </Field>
        ) : null}

        <Field label="排序" description="值越小越靠前">
          <Input
            type="number"
            value={String(form.sort_order)}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
          />
        </Field>

        {/* 整段源文本：全宽编辑器（非 1/12 label 行）。 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">
              定义源 <span className="text-error">*</span>
            </label>
            {definition?.version ? (
              <span className="text-micro text-text-muted">解析版本 v{definition.version}</span>
            ) : null}
          </div>
          <CodeEditor
            language={form.format}
            value={form.source}
            onValueChange={(next) => setForm((f) => ({ ...f, source: next }))}
            placeholder={form.format === "markdown" ? "---\nname: ...\n---\n# ..." : "template_id: ...\nname: ..."}
          />
          {fieldErrors.source ? (
            <p role="alert" className="text-xs text-error">
              {fieldErrors.source}
            </p>
          ) : (
            <p className="text-caption text-text-muted">
              保存时服务端会用对应解析器校验（非法源返回 422，不落库）。
            </p>
          )}
        </div>

        {isEditing && Object.keys(parsedMeta).length > 0 ? (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="mb-1 text-caption font-medium text-text-secondary">解析元信息（只读）</p>
            <pre className="overflow-auto text-micro text-text-muted">{JSON.stringify(parsedMeta, null, 2)}</pre>
          </div>
        ) : null}
      </div>
    </BaseDrawer>
  );
}
