/**
 * ``author`` 字符串 → ``AgentRole`` 的归一化映射。
 *
 * Studio 的 AG-UI 流把产出方 Agent 名写入 ``message.author``（默认 ``NegentropyEngine``）；
 * 后端一核五翼的 ADK agent 名（``NegentropyEngine`` / ``PerceptionFaculty`` / …）以及
 * ``claude_code`` 在此归一化为 ``AgentRole``，供转录 UI 的 per-agent 徽章复用。
 *
 * 匹配为大小写不敏感子串（兼容后端字符串的别名/前后缀变体，及中文学名兜底）；
 * 未知值回退到 ``engine``（一核 NegentropyEngine 是缺省 orchestrator）。
 */

import type { AgentRole } from "./agent-role";

export function agentRoleFromAuthor(author: string | null | undefined): AgentRole {
  const a = (author ?? "").toLowerCase();
  if (!a) return "engine";
  if (a.includes("claude") || a.includes("code")) return "claude_code";
  if (a.includes("perception") || a.includes("慧眼")) return "perception";
  if (a.includes("internaliz") || a.includes("本心")) return "internalization";
  if (a.includes("contemplat") || a.includes("元神")) return "contemplation";
  if (a.includes("action") || a.includes("妙手")) return "action";
  if (a.includes("influence") || a.includes("喉舌")) return "influence";
  if (a.includes("negentropy") || a.includes("engine")) return "engine";
  return "engine";
}
