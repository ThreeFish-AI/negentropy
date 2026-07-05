/**
 * 策略层：``ToolCallDetail`` → ``{displayName, summary}``（仿 paseo buildToolCallDisplayModel）。
 *
 * displayName 为工具的人读名（如 "Shell"/"Read"/"Edit"），summary 为参数摘要（命令/路径/查询），
 * 行内以 truncate 收尾。generic 工具（含 mcp__*）由 ``humanizeToolName`` 归一。
 */

import type { ToolCallDetail } from "./types";

export interface ToolCallDisplayModel {
  displayName: string;
  summary?: string;
}

/** mcp__server__tool / snake_case / 点分名 → 人读名。 */
export function humanizeToolName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Tool";
  // mcp__server__tool → 取叶子段
  if (trimmed.startsWith("mcp__")) {
    const segs = trimmed.split("__").filter(Boolean);
    const leaf = segs[segs.length - 1] ?? trimmed;
    return humanizeToolName(leaf);
  }
  // 完全限定名（含 : / .）原样透传
  if (/[:./]/.test(trimmed)) return trimmed;
  return trimmed
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((s) => `${s[0]?.toUpperCase() ?? ""}${s.slice(1)}`)
    .join(" ");
}

/** ``ToolCallDetail`` + 原始工具名 → 展示模型。 */
export function buildToolCallDisplayModel(detail: ToolCallDetail, toolName: string): ToolCallDisplayModel {
  switch (detail.type) {
    case "shell":
      return { displayName: "Shell", summary: detail.command || undefined };
    case "read":
      return { displayName: "Read", summary: detail.filePath || undefined };
    case "edit":
      return { displayName: "Edit", summary: detail.filePath || undefined };
    case "write":
      return { displayName: "Write", summary: detail.filePath || undefined };
    case "search":
      return { displayName: "Search", summary: detail.query || undefined };
    case "fetch":
      return { displayName: "Fetch", summary: detail.url || undefined };
    case "sub_agent":
      return { displayName: "Task", summary: detail.description ?? undefined };
    case "plan":
      return { displayName: "Plan" };
    case "generic":
      return { displayName: humanizeToolName(toolName), summary: summaryFromGenericInput(detail.input) };
  }
}

/** 兜底工具：从 input 取首个有意义的字符串字段作摘要。 */
function summaryFromGenericInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const o = input as Record<string, unknown>;
  for (const key of ["command", "query", "pattern", "url", "file_path", "path", "subject", "description", "prompt"]) {
    const v = o[key];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}
