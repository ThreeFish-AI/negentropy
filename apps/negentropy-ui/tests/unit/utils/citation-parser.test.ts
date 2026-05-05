/**
 * citation-parser 单元测试（P2-3 G2）
 *
 * 验证 [N] 解析、聚合、跳转链接构造的核心契约：
 * - 严格 regex 不误伤 markdown link / 脚注；
 * - 多工具调用结果去重 + 重新分配序号；
 * - 旧消息无 citations 字段时零回归。
 */

import { describe, it, expect } from "vitest";
import {
  attachCitations,
  citationHref,
  extractCitationsFromToolCalls,
  parseArxivIdFromUri,
  splitCitationTokens,
} from "@/utils/citation-parser";
import type { ChatMessage, ToolCallInfo } from "@/types/common";

const okCall = (name: string, payload: unknown): ToolCallInfo => ({
  id: `call-${name}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  args: "{}",
  result: JSON.stringify(payload),
  status: "completed",
});

describe("parseArxivIdFromUri", () => {
  it("从 PDF URL 中提取 arxiv id", () => {
    expect(parseArxivIdFromUri("https://arxiv.org/pdf/2501.12345.pdf")).toBe("2501.12345");
    expect(parseArxivIdFromUri("https://arxiv.org/abs/2310.11366v2")).toBe("2310.11366");
  });

  it("非 arxiv URL 返回 null（不误识别）", () => {
    expect(parseArxivIdFromUri("https://example.com/doc.pdf")).toBeNull();
    expect(parseArxivIdFromUri(null)).toBeNull();
    expect(parseArxivIdFromUri(undefined)).toBeNull();
    expect(parseArxivIdFromUri("")).toBeNull();
  });
});

describe("splitCitationTokens", () => {
  it("识别独立 [1] 标号", () => {
    const segs = splitCitationTokens("Reflexion [1] 是一种自我反思方法。");
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ kind: "text", content: "Reflexion " });
    expect(segs[1]).toEqual({ kind: "citation", id: 1, raw: "[1]" });
    expect(segs[2]).toEqual({ kind: "text", content: " 是一种自我反思方法。" });
  });

  it("识别多个 [N] 标号 + 中文混排", () => {
    const segs = splitCitationTokens("ReAct [1] 与 Reflexion [2] 都属于 self-improvement 路线 [3]。");
    const cites = segs.filter((s) => s.kind === "citation");
    expect(cites).toHaveLength(3);
    expect(cites.map((c) => (c.kind === "citation" ? c.id : -1))).toEqual([1, 2, 3]);
  });

  it("不误伤 markdown link `[label](url)`", () => {
    const segs = splitCitationTokens("查看 [Self-RAG paper](https://arxiv.org/abs/2310.11511) 详情。");
    const cites = segs.filter((s) => s.kind === "citation");
    expect(cites).toHaveLength(0);
  });

  it("不误伤脚注 `[^1]`", () => {
    const segs = splitCitationTokens("这是脚注 [^1] 形式。");
    const cites = segs.filter((s) => s.kind === "citation");
    expect(cites).toHaveLength(0);
  });

  it("不误伤定义列表 `[label]:`", () => {
    const segs = splitCitationTokens("[1]: https://example.com");
    const cites = segs.filter((s) => s.kind === "citation");
    expect(cites).toHaveLength(0);
  });

  it("空 / 纯文本场景不抛", () => {
    expect(splitCitationTokens("")).toEqual([]);
    expect(splitCitationTokens("纯文本无引用")).toEqual([{ kind: "text", content: "纯文本无引用" }]);
  });
});

describe("extractCitationsFromToolCalls", () => {
  it("从 search_knowledge_base 的 results 中聚合", () => {
    const toolCalls = [
      okCall("search_knowledge_base", {
        status: "success",
        results: [
          {
            citation_id: 1,
            formatted_citation: '[1] Asai et al., "Self-RAG," arXiv:2310.11511, 2024.',
            source_uri: "https://arxiv.org/pdf/2310.11511.pdf",
          },
          {
            citation_id: 2,
            formatted_citation: '[2] Edge et al., "GraphRAG," arXiv:2404.16130, 2024.',
            source_uri: "https://arxiv.org/pdf/2404.16130.pdf",
          },
        ],
      }),
    ];
    const cites = extractCitationsFromToolCalls(toolCalls);
    expect(cites).toHaveLength(2);
    expect(cites[0].id).toBe(1);
    expect(cites[0].arxivId).toBe("2310.11511");
    expect(cites[1].arxivId).toBe("2404.16130");
  });

  it("从 search_knowledge_graph_with_papers 的 papers 中聚合", () => {
    const toolCalls = [
      okCall("search_knowledge_graph_with_papers", {
        status: "success",
        kg_status: "graph_hit",
        papers: [
          {
            citation_id: 1,
            arxiv_id: "2310.04406",
            formatted_citation: '[1] Zhou et al., "LATS," arXiv:2310.04406, 2024.',
            source_uri: "https://arxiv.org/pdf/2310.04406.pdf",
          },
        ],
      }),
    ];
    const cites = extractCitationsFromToolCalls(toolCalls);
    expect(cites).toHaveLength(1);
    expect(cites[0].arxivId).toBe("2310.04406");
  });

  it("跨工具结果去重（按 arxiv_id）+ 重新分配 1..N", () => {
    const toolCalls = [
      okCall("search_knowledge_base", {
        results: [
          {
            citation_id: 1,
            formatted_citation: '[1] Asai 2024',
            source_uri: "https://arxiv.org/pdf/2310.11511.pdf",
          },
        ],
      }),
      okCall("search_knowledge_graph_with_papers", {
        papers: [
          {
            citation_id: 1, // 故意冲突
            formatted_citation: '[1] Asai 2024',
            source_uri: "https://arxiv.org/pdf/2310.11511.pdf",
            arxiv_id: "2310.11511",
          },
          {
            citation_id: 2,
            formatted_citation: '[2] Edge 2024',
            source_uri: "https://arxiv.org/pdf/2404.16130.pdf",
            arxiv_id: "2404.16130",
          },
        ],
      }),
    ];
    const cites = extractCitationsFromToolCalls(toolCalls);
    expect(cites).toHaveLength(2);
    expect(cites.map((c) => c.id)).toEqual([1, 2]);
    expect(cites.map((c) => c.arxivId)).toEqual(["2310.11511", "2404.16130"]);
  });

  it("忽略非 citation 工具的 result（即使含 formatted_citation 字段）", () => {
    const toolCalls = [
      okCall("save_to_memory", {
        results: [{ citation_id: 1, formatted_citation: "[1] should not leak" }],
      }),
    ];
    expect(extractCitationsFromToolCalls(toolCalls)).toEqual([]);
  });

  it("result 不是合法 JSON 时 fail-soft 不抛", () => {
    const bad: ToolCallInfo = {
      id: "x",
      name: "search_knowledge_base",
      args: "{}",
      result: "not json {",
      status: "completed",
    };
    expect(extractCitationsFromToolCalls([bad])).toEqual([]);
  });

  it("undefined / 空数组 → 空 citations（旧消息零回归）", () => {
    expect(extractCitationsFromToolCalls(undefined)).toEqual([]);
    expect(extractCitationsFromToolCalls([])).toEqual([]);
  });
});

describe("attachCitations", () => {
  it("有 toolCalls 时注入 citations 字段", () => {
    const msg: ChatMessage = {
      id: "m1",
      role: "assistant",
      content: "Reflexion [1]",
      toolCalls: [
        okCall("search_knowledge_base", {
          results: [
            {
              citation_id: 1,
              formatted_citation: '[1] Shinn 2023',
              source_uri: "https://arxiv.org/pdf/2303.11366.pdf",
            },
          ],
        }),
      ],
    };
    const out = attachCitations(msg);
    expect(out.citations).toHaveLength(1);
    expect(out.citations?.[0].id).toBe(1);
  });

  it("已有 citations 时不重复注入（保持引用稳定）", () => {
    const msg: ChatMessage = {
      id: "m1",
      role: "assistant",
      content: "x",
      citations: [{ id: 1, text: "[1] preexisting" }],
      toolCalls: [
        okCall("search_knowledge_base", {
          results: [{ citation_id: 99, formatted_citation: "[99] new" }],
        }),
      ],
    };
    const out = attachCitations(msg);
    expect(out.citations).toHaveLength(1);
    expect(out.citations?.[0].text).toBe("[1] preexisting");
  });

  it("无 toolCalls / 不命中工具 → 不挂 citations 字段（避免空数组污染）", () => {
    const msg: ChatMessage = { id: "m1", role: "user", content: "hello" };
    const out = attachCitations(msg);
    expect(out.citations).toBeUndefined();
  });
});

describe("citationHref", () => {
  it("有 arxivId → 跳 abs 页", () => {
    expect(citationHref({ id: 1, text: "x", arxivId: "2310.11511" })).toBe(
      "https://arxiv.org/abs/2310.11511",
    );
  });

  it("无 arxivId 时回退 sourceUri", () => {
    expect(citationHref({ id: 1, text: "x", sourceUri: "https://example.com/doc.pdf" })).toBe(
      "https://example.com/doc.pdf",
    );
  });

  it("两者都无 → null（前端按非链接渲染）", () => {
    expect(citationHref({ id: 1, text: "x" })).toBeNull();
  });
});
