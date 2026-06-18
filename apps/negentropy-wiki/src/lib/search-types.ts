/**
 * Wiki 搜索结果类型（单一事实源）
 *
 * 由搜索 API 代理路由（app/api/search/route.ts）产出，
 * 由搜索 modal（components/WikiSearchModal.tsx）消费。
 * 抽到独立模块以杜绝 server/client 两端的类型契约漂移。
 */
export interface WikiSearchResultItem {
  /** Knowledge chunk UUID */
  id: string;
  /** 高亮摘要（后端 chunk 内容截断） */
  snippet: string;
  /** wiki entry slug（Materialized Path） */
  entrySlug: string;
  /** wiki entry 标题 */
  entryTitle: string;
  /** 完整 wiki URL /{pubSlug}/{entrySlug} */
  wikiUrl: string;
  /** 排名分数：combined / semantic / keyword */
  scores: Record<string, number>;
  /** 来源 URI（如 gs:// 链接） */
  sourceUri: string | null;
}

export interface WikiSearchResponse {
  items: WikiSearchResultItem[];
  total: number;
  queryTimeMs: number;
}
