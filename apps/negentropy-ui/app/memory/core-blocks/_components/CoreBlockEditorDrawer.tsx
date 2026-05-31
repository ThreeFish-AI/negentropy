/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件命中既有代码模式（useEffect 内据 props 同步表单初值）。功能正确，
 * 仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useState } from "react";
import { BaseDrawer } from "@/components/ui/BaseDrawer";
import { Button } from "@/components/ui/Button";
import type { CoreBlockItem } from "@/features/memory";

/**
 * Core Block 编辑抽屉（新建 / 编辑）。
 *
 * 受后端 upsert 约束：scope ∈ {user, app, thread}；scope='thread' 时 thread_id 必填，
 * 其余 scope 强制 NULL。编辑既有块时 label/scope/thread_id 锁定（唯一键），仅改 content。
 */

const SCOPES: Array<"user" | "app" | "thread"> = ["user", "app", "thread"];

export interface CoreBlockDraft {
  scope: "user" | "app" | "thread";
  label: string;
  content: string;
  thread_id?: string;
}

interface CoreBlockEditorDrawerProps {
  open: boolean;
  /** 传入既有块=编辑模式（键锁定）；null=新建模式。 */
  editing: CoreBlockItem | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (draft: CoreBlockDraft) => void;
}

export function CoreBlockEditorDrawer({
  open,
  editing,
  saving,
  error,
  onClose,
  onSave,
}: CoreBlockEditorDrawerProps) {
  const isEdit = editing !== null;

  const [scope, setScope] = useState<"user" | "app" | "thread">("user");
  const [label, setLabel] = useState("persona");
  const [threadId, setThreadId] = useState("");
  const [content, setContent] = useState("");

  // 打开 / 切换目标块时同步表单初值
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setScope(editing.scope);
      setLabel(editing.label);
      setThreadId(editing.thread_id ?? "");
      setContent(editing.content);
    } else {
      setScope("user");
      setLabel("persona");
      setThreadId("");
      setContent("");
    }
  }, [open, editing]);

  const threadRequired = scope === "thread";
  const canSave =
    label.trim().length > 0 &&
    content.trim().length > 0 &&
    (!threadRequired || threadId.trim().length > 0) &&
    !saving;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      scope,
      label: label.trim(),
      content,
      thread_id: threadRequired ? threadId.trim() : undefined,
    });
  };

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Core Block" : "New Core Block"}
      subtitle={
        isEdit ? `${editing?.scope} · ${editing?.label}` : "常驻记忆块（always-injected）"
      }
      widthClassName="w-[480px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
            loading={saving}
          >
            {isEdit ? "保存" : "创建"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Scope */}
        <div>
          <label className="text-micro uppercase tracking-overline text-muted-foreground">
            Scope
          </label>
          <div className="mt-1.5 flex gap-1.5">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isEdit}
                onClick={() => setScope(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  scope === s
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Thread ID (scope=thread only) */}
        {threadRequired && (
          <div>
            <label className="text-micro uppercase tracking-overline text-muted-foreground">
              Thread ID
            </label>
            <input
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs disabled:opacity-60"
              placeholder="UUID"
              value={threadId}
              disabled={isEdit}
              onChange={(e) => setThreadId(e.target.value)}
            />
          </div>
        )}

        {/* Label */}
        <div>
          <label className="text-micro uppercase tracking-overline text-muted-foreground">
            Label
          </label>
          <input
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs disabled:opacity-60"
            placeholder="persona / human / …"
            value={label}
            disabled={isEdit}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        {/* Content */}
        <div>
          <label className="text-micro uppercase tracking-overline text-muted-foreground">
            Content
          </label>
          <textarea
            className="mt-1.5 h-48 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed"
            placeholder="常驻摘要内容（超长将由后端按 token 预算截断）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="mt-1 text-micro text-muted-foreground tabular-nums">
            {content.length} chars
          </p>
        </div>
      </div>
    </BaseDrawer>
  );
}
