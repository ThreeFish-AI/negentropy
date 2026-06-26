/**
 * 策略层：``ToolCallDetail`` / 工具名 → Lucide 图标。
 *
 * 单一事实源：复用 ``status-style.toolIcon`` 注册表，避免并行图标映射。
 * 仅对 paseo 语义更明确的细节类型（search/fetch/sub_agent/plan）做显式归一，
 * 其余回落到按工具名查表。
 */

import { Bot, Brain, Globe, Search, type LucideIcon } from "lucide-react";

import { toolIcon } from "../status-style";
import type { ToolCallDetail } from "./types";

export function detailIcon(detail: ToolCallDetail, toolName: string): LucideIcon {
  switch (detail.type) {
    case "shell":
      return toolIcon("bash");
    case "read":
      return toolIcon("read");
    case "edit":
      return toolIcon("edit");
    case "write":
      return toolIcon("write");
    case "search":
      return Search;
    case "fetch":
      return Globe;
    case "sub_agent":
      return Bot;
    case "plan":
      return Brain;
    default:
      return toolIcon(toolName);
  }
}
