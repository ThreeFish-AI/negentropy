/**
 * Wiki Knowledge Graph 类型声明
 *
 * 与 `wiki-api.ts` 中的文档/导航类型正交分解：
 * - 字段命名与后端 `WikiGraphResponse` 一一对应（id/label/type 等小写命名）；
 * - 与主站 `apps/negentropy-ui` 的 GraphCanvas 类型保持字段对齐，便于未来抽
 *   出共享类型包，但 Wiki 场景为"只读浏览"，故不引入主站特有的 build/edit
 *   交互字段。
 */

/** 切片图谱节点 */
export interface WikiGraphNode {
  /** 实体 ID（沿用后端 GraphService 输出格式，字符串形式） */
  id: string;
  /** 节点显示名 */
  label: string;
  /** 节点类型（entity_type，如 PERSON/ORGANIZATION/CONCEPT） */
  type: string;
  /** 重要性得分（用于按 top-N 截断） */
  importance: number | null;
  /** Louvain 社区 ID */
  community_id: number | null;
  /** Publication 内提及本实体的前 N 个 entry slug */
  entry_slugs: string[];
  /** Publication 内对本实体的提及总次数 */
  mention_count_in_pub: number;
  /**
   * 节点附加元数据：
   * - `corpus_id`：跨 corpus publication 着色用；
   * - `entity_type` / `confidence` / `global_mention_count` 等。
   */
  metadata: Record<string, unknown> & {
    corpus_id?: string;
    entity_type?: string;
    confidence?: number;
    global_mention_count?: number;
  };
}

/** 切片图谱边 */
export interface WikiGraphEdge {
  source: string;
  target: string;
  label: string;
  type: string;
  weight: number;
  metadata: Record<string, unknown> & {
    confidence?: number;
    evidence_snippet?: string;
  };
}

/** Publication 整体图谱响应 */
export interface WikiGraphResponse {
  publication_id: string;
  version: number;
  /**
   * - `ok`：正常返回非空图；
   * - `no_kg`：KG 未构建（节点边必空）；
   * - `empty`：KG 已构建但 publication 内文档无任何 mention。
   */
  status: "ok" | "no_kg" | "empty";
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  /** True 表示节点数超过 max_nodes 被截断，悬挂边已剔除 */
  truncated: boolean;
  /** 截断前的实体总数 */
  total_entities: number;
  /** Publication 实际覆盖的 corpus_id 集合 */
  corpus_ids: string[];
}

/** 实体扁平列表条目 */
export interface WikiGraphEntityItem {
  id: string;
  name: string;
  entity_type: string;
  importance: number | null;
  community_id: number | null;
  mention_count_in_pub: number;
  entry_slugs: string[];
  corpus_id: string | null;
}

export interface WikiGraphEntityListResponse {
  publication_id: string;
  version: number;
  total: number;
  offset: number;
  limit: number;
  items: WikiGraphEntityItem[];
}

/** 实体邻居（限定在 publication 节点集合内） */
export interface WikiGraphNeighbor {
  id: string;
  name: string;
  entity_type: string;
  relation_type: string;
  /** "outgoing" | "incoming" */
  direction: "outgoing" | "incoming";
  weight: number;
  entry_slugs: string[];
}

/** 提及该实体的 Wiki entry */
export interface WikiGraphMentioningEntry {
  entry_id: string;
  entry_slug: string;
  entry_title: string | null;
  document_id: string | null;
  mention_count: number;
}

export interface WikiGraphEntityDetailResponse {
  publication_id: string;
  version: number;
  entity: WikiGraphEntityItem;
  neighbors: WikiGraphNeighbor[];
  mentioning_entries: WikiGraphMentioningEntry[];
}

/** 单 entry 的局部图（该文档涉及实体 + 一跳邻居） */
export interface WikiEntryGraphResponse {
  entry_id: string;
  publication_id: string;
  version: number;
  status: "ok" | "no_kg" | "empty";
  nodes: WikiGraphNode[];
  edges: WikiGraphEdge[];
  /** 该 entry 直接涉及的实体 ID（前端用于高亮中心节点） */
  center_entity_ids: string[];
}

/** 排序键白名单（与后端 sort_by 对齐） */
export type WikiGraphEntitySortKey = "importance" | "mention" | "name";

/** Publication 整图查询可选参数 */
export interface WikiGraphQueryOptions {
  /** 节点数上限（1-1000，默认 300） */
  maxNodes?: number;
  /** 最小 importance_score 过滤（默认 0） */
  minImportance?: number;
  /** 是否保留无边孤立节点（默认 false） */
  includeIsolated?: boolean;
}

/** 实体列表查询可选参数 */
export interface WikiGraphEntityQueryOptions {
  offset?: number;
  limit?: number;
  sortBy?: WikiGraphEntitySortKey;
}
