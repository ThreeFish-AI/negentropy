/**
 * Agent 身份注册表 barrel（跨域共享）。
 *
 * Routine 与 Studio 共用此处的 ``AgentRole`` / ``AGENT_ROLE_META`` 等身份元信息。
 * Routine 专有的「事件类型→角色」推导仍由 ``features/routine/agent-role`` 维护。
 */

export type { AgentRole, AgentRoleMeta } from "./agent-role";
export { AGENT_ROLE_META, KNOWN_AGENT_ROLES, normalizeAgentRole } from "./agent-role";
export { agentRoleFromAuthor } from "./agent-role-from-author";
