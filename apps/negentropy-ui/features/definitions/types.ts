/**
 * Definition Registry 前端类型（定义源 SSOT）。
 *
 * 与后端 ``interface/definitions_api.py`` 的响应/请求形态对齐。
 */

export type DefinitionKind =
  | "skill_template"
  | "routine_preset"
  | "harness_skill"
  | "agent";

export type DefinitionFormat = "yaml" | "markdown";

export interface DefinitionDTO {
  id: string;
  kind: DefinitionKind;
  key: string;
  format: DefinitionFormat;
  source: string;
  meta: Record<string, unknown>;
  version: string | null;
  checksum: string | null;
  owner_id: string;
  is_system: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DefinitionListResponse {
  items: DefinitionDTO[];
  count: number;
  total: number;
  offset: number;
  limit: number;
}

export interface DefinitionCreatePayload {
  kind: DefinitionKind;
  key: string;
  source: string;
  format?: DefinitionFormat;
  is_enabled?: boolean;
  is_system?: boolean;
  sort_order?: number;
}

export interface DefinitionUpdatePayload {
  source?: string;
  key?: string;
  format?: DefinitionFormat;
  is_enabled?: boolean;
  /** 显式置 false 以解除保护标记（关闭「创建即永久不可删」陷阱）。 */
  is_system?: boolean;
  sort_order?: number;
}

export interface DefinitionListFilters {
  kind?: DefinitionKind;
  is_enabled?: boolean;
  limit?: number;
  offset?: number;
}

/** 各定义族的展示标签与默认源格式。 */
export const DEFINITION_KIND_META: Record<
  DefinitionKind,
  { label: string; format: DefinitionFormat; blurb: string }
> = {
  skill_template: {
    label: "Skill 模板",
    format: "yaml",
    blurb: "可克隆的 Skill 目录（原 skill_templates/*.yaml）",
  },
  routine_preset: {
    label: "Routine 预设",
    format: "yaml",
    blurb: "Routine 预设目录（原 routine_presets/*.yaml）",
  },
  harness_skill: {
    label: "Harness 技能",
    format: "markdown",
    blurb: "Claude Code 技能 SKILL.md（DB 为源，渲染回盘）",
  },
  agent: {
    label: "Agent 规格",
    format: "yaml",
    blurb: "代码内置 Agent 声明式规格",
  },
};

export const DEFINITION_KINDS: DefinitionKind[] = [
  "skill_template",
  "routine_preset",
  "harness_skill",
  "agent",
];
