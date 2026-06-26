/**
 * 机制层（negentropy 专属缝）：把 ``(tool_name, input, output, isError)`` 派生为 ``ToolCallDetail``。
 *
 * paseo 的后端直接产出强类型 ``ToolCallDetail``；negentropy 后端只产出
 * ``tool_use.payload = {tool_id, input}`` 与配对的 ``tool_result.payload = {output, is_error}``，
 * 故由此函数补齐这层映射，下游 displayName/图标/分节即与 paseo 对齐。
 */

import { unwrapText } from "./payload-util";
import type { ToolCallDetail } from "./types";

/** 安全取对象。 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** 从 input 取字符串字段（解包截断预览）。 */
function strField(input: Record<string, unknown>, key: string): string | null {
  return unwrapText(input[key]);
}

/** MultiEdit 的 ``edits`` 数组 → 归一化 old→new 列表。 */
function parseMultiEdits(input: Record<string, unknown>): Array<{ oldString: string | null; newString: string | null }> {
  const raw = input.edits;
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => {
    const r = asRecord(e);
    return { oldString: strField(r, "old_string"), newString: strField(r, "new_string") };
  });
}

/** ``(tool_name, input, output)`` → ``ToolCallDetail``。 */
export function deriveToolCallDetail(args: {
  toolName: string;
  input: unknown;
  output: string | null;
  isError: boolean;
}): ToolCallDetail {
  const { toolName, input, output, isError } = args;
  const name = (toolName || "").toLowerCase();
  const inp = asRecord(input);

  switch (name) {
    case "bash":
    case "bashoutput":
      return { type: "shell", command: strField(inp, "command") ?? "", output, isError };

    case "read":
      return { type: "read", filePath: strField(inp, "file_path") ?? strField(inp, "path") ?? "", content: output };

    case "edit":
      return {
        type: "edit",
        filePath: strField(inp, "file_path") ?? "",
        edits: [{ oldString: strField(inp, "old_string"), newString: strField(inp, "new_string") }],
        output,
      };

    case "multiedit":
      return { type: "edit", filePath: strField(inp, "file_path") ?? "", edits: parseMultiEdits(inp), output };

    case "notebookedit":
      return {
        type: "edit",
        filePath: strField(inp, "notebook_path") ?? "",
        edits: [{ oldString: null, newString: strField(inp, "new_source") }],
        output,
      };

    case "write":
      return { type: "write", filePath: strField(inp, "file_path") ?? "", content: strField(inp, "content") ?? output };

    case "grep":
    case "glob":
      return { type: "search", query: strField(inp, "pattern") ?? "", output };

    case "websearch":
      return { type: "search", query: strField(inp, "query") ?? "", output };

    case "webfetch":
      return { type: "fetch", url: strField(inp, "url") ?? "", output };

    case "task":
    case "taskcreate":
    case "taskupdate":
      return { type: "sub_agent", description: strField(inp, "description") ?? strField(inp, "subject"), output };

    case "exitplanmode":
      return { type: "plan", text: strField(inp, "plan") ?? output ?? "" };

    default:
      return { type: "generic", input, output };
  }
}
