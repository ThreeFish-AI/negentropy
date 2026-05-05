/**
 * P2-3 G2 · Citation Parser & Aggregator
 *
 * 职责（围绕「最小干预」）：
 * 1. `extractCitationsFromToolCalls`：从 `ChatMessage.toolCalls` 的 result JSON 中聚合
 *    `search_knowledge_base` / `search_knowledge_graph_with_papers` 返回的引用条目。
 *    去重 by (arxivId || sourceUri || text)，按 id 排序。
 * 2. `parseArxivIdFromUri`：从 source_uri 推断 arxiv id（用于点击跳转 abs 页）。
 *
 * 不直接转换 markdown：[N] 标号的高亮交给 MessageBubble 中的 inline 替换逻辑（轻量正则，
 * 不引入新 remark 插件，避免污染 defaultRemarkPlugins 全局链）。
 *
 * 参考：Self-RAG (Asai et al., ICLR 2024) 强调 citation 必须 stable + 可追溯；本工具是
 * 「来源锚定」契约的前端落点。
 */
import type { Citation, ChatMessage, ToolCallInfo } from "@/types/common";

/** 后端 search_knowledge_base / search_knowledge_graph_with_papers 单条结果的最小契约 */
type RawCitationLike = {
  citation_id?: number;
  formatted_citation?: string;
  source_uri?: string | null;
  metadata?: Record<string, unknown> | null;
  // KG 反向工具的 paper-level 字段
  arxiv_id?: string | null;
};

const ARXIV_ID_RE = /\b(\d{4}\.\d{4,5})(v\d+)?\b/;

/** 从 source_uri 中推断 arxiv id（如 https://arxiv.org/pdf/2501.12345.pdf -> 2501.12345）。 */
export function parseArxivIdFromUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const match = uri.match(ARXIV_ID_RE);
  return match ? match[1] : null;
}

/** 从单条原始结果中抽出 arxiv id（优先字段 → metadata → uri 推断）。 */
function pickArxivId(raw: RawCitationLike): string | null {
  if (raw.arxiv_id) return String(raw.arxiv_id);
  const meta = raw.metadata ?? {};
  const fromMeta = meta && typeof meta === "object" ? (meta as Record<string, unknown>)["arxiv_id"] : null;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  return parseArxivIdFromUri(raw.source_uri);
}

/** 把后端原始 result 序列归一为前端 Citation。citation_id 缺失时按数组下标兜底。 */
function normalizeCitations(rawList: RawCitationLike[]): Citation[] {
  const out: Citation[] = [];
  rawList.forEach((raw, idx) => {
    const text = (raw.formatted_citation ?? "").trim();
    if (!text) return;
    out.push({
      id: typeof raw.citation_id === "number" ? raw.citation_id : idx + 1,
      text,
      sourceUri: raw.source_uri ?? null,
      arxivId: pickArxivId(raw),
    });
  });
  return out;
}

/** 兼容三种工具结果形态：{results:[...]} / {papers:[...]} / 直接的数组。 */
function pickCitationCandidates(parsed: unknown): RawCitationLike[] {
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  for (const key of ["results", "papers"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as RawCitationLike[];
  }
  if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === "object") as RawCitationLike[];
  return [];
}

/**
 * 从工具调用结果中聚合 citations。
 *
 * 仅处理 `search_knowledge_base` 与 `search_knowledge_graph_with_papers` 两个工具；
 * 其他工具（即使 result JSON 中含 formatted_citation 字段）一律忽略，避免误聚合。
 */
export function extractCitationsFromToolCalls(toolCalls: ToolCallInfo[] | undefined): Citation[] {
  if (!toolCalls || toolCalls.length === 0) return [];
  const seen = new Set<string>();
  const aggregated: Citation[] = [];

  for (const call of toolCalls) {
    if (!call?.name) continue;
    const isCitationTool =
      call.name === "search_knowledge_base" || call.name === "search_knowledge_graph_with_papers";
    if (!isCitationTool || !call.result) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(call.result);
    } catch {
      continue; // result 不是合法 JSON 则跳过 —— fail-soft 不抛
    }

    const candidates = pickCitationCandidates(parsed);
    const normalized = normalizeCitations(candidates);

    for (const cite of normalized) {
      const dedupKey = (cite.arxivId ?? cite.sourceUri ?? cite.text).toLowerCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      aggregated.push(cite);
    }
  }

  // 按 id 升序，重新分配连续 1..N（避免不同工具调用的 citation_id 冲突）
  return aggregated
    .sort((a, b) => a.id - b.id)
    .map((c, idx) => ({ ...c, id: idx + 1 }));
}

/** 给 ChatMessage 附加聚合后的 citations 字段（不变更原对象）。 */
export function attachCitations(message: ChatMessage): ChatMessage {
  if (message.citations && message.citations.length > 0) return message;
  const citations = extractCitationsFromToolCalls(message.toolCalls);
  if (citations.length === 0) return message;
  return { ...message, citations };
}

/**
 * 解析正文中 [N] 形态的 token，返回 { hasCitations, segments }。
 *
 * 严格 regex 规避 markdown link `[label](url)` 与脚注语法 `[^N]` —— 避免双重渲染。
 */
const CITATION_TOKEN_RE = /(?<![\w\\^])\[(\d+)\](?!\(|:)/g;

export type CitationSegment =
  | { kind: "text"; content: string }
  | { kind: "citation"; id: number; raw: string };

export function splitCitationTokens(text: string): CitationSegment[] {
  if (!text) return [];
  const segments: CitationSegment[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  CITATION_TOKEN_RE.lastIndex = 0;
  while ((match = CITATION_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ kind: "text", content: text.slice(lastIdx, match.index) });
    }
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) {
      segments.push({ kind: "citation", id, raw: match[0] });
    } else {
      segments.push({ kind: "text", content: match[0] });
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    segments.push({ kind: "text", content: text.slice(lastIdx) });
  }
  return segments;
}

/** 给定 arxivId，构造 abs 页跳转 URL（无 arxivId 时回退 sourceUri）。 */
export function citationHref(citation: Citation): string | null {
  if (citation.arxivId) return `https://arxiv.org/abs/${citation.arxivId}`;
  if (citation.sourceUri) return citation.sourceUri;
  return null;
}
