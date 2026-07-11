"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TruncatedCell } from "@/components/ui/TruncatedCell";
import { DEFINITION_KIND_META, type DefinitionDTO } from "@/features/definitions";

/**
 * DefinitionTable — 定义源列表（固定列宽 + 溢出省略 + Tooltip，遵守 UI 表格规范）。
 *
 * colgroup 使用「裸 <col/>」而非行内注释 <col/> {/* *}，避免 whitespace 文本节点
 * 触发 hydration 报错（见项目既有踩坑）。列说明写在本段注释里：
 * Key(26%) / Kind(14%) / Version(10%) / 状态(12%) / 内置(8%) / 更新时间(14%) / 操作(16%)。
 */
export function DefinitionTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: DefinitionDTO[];
  onEdit: (d: DefinitionDTO) => void;
  onDelete: (d: DefinitionDTO) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs text-text-secondary">
            <th className="px-4 py-2.5 font-medium">Key</th>
            <th className="px-4 py-2.5 font-medium">Kind</th>
            <th className="px-4 py-2.5 font-medium">版本</th>
            <th className="px-4 py-2.5 font-medium">状态</th>
            <th className="px-4 py-2.5 font-medium">内置</th>
            <th className="px-4 py-2.5 font-medium">更新时间</th>
            <th className="px-4 py-2.5 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <TruncatedCell text={d.key} mono textClassName="text-foreground" />
              <TruncatedCell text={DEFINITION_KIND_META[d.kind]?.label ?? d.kind} textClassName="text-text-secondary" />
              <TruncatedCell text={d.version ?? "—"} mono textClassName="text-text-muted" />
              <td className="px-4 py-3">
                <span
                  className={
                    d.is_enabled
                      ? "rounded-full bg-emerald-100 px-1.5 py-0.5 text-micro text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "rounded-full bg-muted px-1.5 py-0.5 text-micro text-text-muted"
                  }
                >
                  {d.is_enabled ? "启用" : "停用"}
                </span>
              </td>
              <td className="px-4 py-3">
                {d.is_system ? (
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-micro text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    系统
                  </span>
                ) : (
                  <span className="text-micro text-text-muted">—</span>
                )}
              </td>
              <TruncatedCell
                text={d.updated_at ? new Date(d.updated_at).toLocaleString() : "—"}
                textClassName="text-text-muted"
              />
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    iconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="编辑"
                    onClick={() => onEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    iconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="删除"
                    disabled={d.is_system}
                    title={d.is_system ? "系统内置定义受保护，禁止删除" : undefined}
                    onClick={() => onDelete(d)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
