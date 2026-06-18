/**
 * Agent Edit Drawer 共享类型定义。
 *
 * 消除 AgentFormDrawer 与 agents/page.tsx 之间的 Agent 接口重复定义，
 * 同时收敛模板、可用工具等内联类型。
 */

export interface Agent {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  agent_type: string;
  system_prompt: string | null;
  model: string | null;
  config: Record<string, unknown>;
  adk_config?: Record<string, unknown>;
  skills: string[];
  tools: string[];
  is_enabled: boolean;
  visibility: string;
  is_builtin?: boolean;
}

export interface NegentropyTemplate {
  name: string;
  display_name: string | null;
  description: string | null;
  agent_type: string;
  system_prompt: string | null;
  model: string | null;
  adk_config: Record<string, unknown>;
  tools: string[];
}

export interface AvailableTool {
  name: string;
  display_name: string | null;
  source: string;
}

export interface AgentFormState {
  name: string;
  display_name: string;
  description: string;
  agent_type: string;
  system_prompt: string;
  model: string;
  config: string;
  adk_config: string;
  skills: string;
  tools: string;
  is_enabled: boolean;
  visibility: string;
}
