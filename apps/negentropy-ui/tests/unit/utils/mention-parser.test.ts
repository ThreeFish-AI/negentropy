import { describe, expect, it } from "vitest";
import {
  applyMention,
  deriveForwardedPropsFromMentions,
  detectMentionTrigger,
  reconcileMentions,
} from "@negentropy/agents-chat-core/parse";
import type { MentionToken } from "@negentropy/agents-chat-core/parse";

// ---------------------------------------------------------------------------
// detectMentionTrigger
// ---------------------------------------------------------------------------

describe("detectMentionTrigger", () => {
  it("行首单独键入 @ → 触发，queryText 为空", () => {
    const t = detectMentionTrigger("@", 1);
    expect(t).toEqual({ start: 0, end: 1, queryText: "" });
  });

  it("@ 后键入字符 → 触发，queryText 为前缀", () => {
    const t = detectMentionTrigger("hello @perc", 11);
    expect(t).toEqual({ start: 6, end: 11, queryText: "perc" });
  });

  it("中文标点（如、，；）后 @ → 触发", () => {
    // "研究、@kb" → 字符索引 0:研 1:究 2:、 3:@ 4:k 5:b（共 6 个 code unit）
    const t = detectMentionTrigger("研究、@kb", 6);
    expect(t).toEqual({ start: 3, end: 6, queryText: "kb" });
  });

  it("全角空格后 @ → 触发", () => {
    const t = detectMentionTrigger("a　@b", 4);
    expect(t).toEqual({ start: 2, end: 4, queryText: "b" });
  });

  it("email 场景（user@example.com）→ 不触发（@ 前为字母）", () => {
    expect(detectMentionTrigger("user@example.com", 8)).toBeNull();
  });

  it("@ 后键入空格 → 不再视作 mention 上下文", () => {
    expect(detectMentionTrigger("@perc ", 6)).toBeNull();
  });

  it("光标在 @ 之前 → 不触发", () => {
    expect(detectMentionTrigger("@perc", 0)).toBeNull();
  });

  it("光标越界 → 不触发", () => {
    expect(detectMentionTrigger("@perc", 99)).toBeNull();
  });

  it("@ 前为引号 → 触发（常见于 \"@xxx\"）", () => {
    const t = detectMentionTrigger('"@kb', 4);
    expect(t).toEqual({ start: 1, end: 4, queryText: "kb" });
  });

  it("两个 @ 紧邻 → 回扫到最近的 @", () => {
    const t = detectMentionTrigger("@@x", 3);
    // 最近的 @ 是 index=1，但 prev=index=0='@' 不是 leading → null
    // 这里实际：从 i=2 向左扫，遇到 @ 但 prev 不合法 → null
    expect(t).toBeNull();
  });

  it("queryText 含中文字符 → 触发", () => {
    const t = detectMentionTrigger("@感知", 3);
    expect(t).toEqual({ start: 0, end: 3, queryText: "感知" });
  });
});

// ---------------------------------------------------------------------------
// applyMention
// ---------------------------------------------------------------------------

describe("applyMention", () => {
  it("插入 rawText 并返回 token / 新光标位置", () => {
    const result = applyMention("hi @perc", { start: 3, end: 8, queryText: "perc" }, {
      kind: "agent",
      refId: "PerceptionFaculty",
      label: "PerceptionFaculty",
    });
    expect(result.value).toBe("hi @PerceptionFaculty ");
    expect(result.caret).toBe("hi @PerceptionFaculty ".length);
    expect(result.token).toMatchObject({
      kind: "agent",
      refId: "PerceptionFaculty",
      label: "PerceptionFaculty",
      rawText: "@PerceptionFaculty",
      start: 3,
      end: 3 + "@PerceptionFaculty".length,
    });
  });

  it("插入后保留 @ 之后被替换之外的尾部文本", () => {
    const result = applyMention("@p tail", { start: 0, end: 2, queryText: "p" }, {
      kind: "corpus-retrieve",
      refId: "uuid-a",
      label: "Corpus-A",
    });
    expect(result.value).toBe("@Corpus-A  tail");
  });
});

// ---------------------------------------------------------------------------
// reconcileMentions
// ---------------------------------------------------------------------------

function _mkToken(
  rawText: string,
  start: number,
  overrides: Partial<MentionToken> = {},
): MentionToken {
  return {
    id: `id-${rawText}`,
    kind: "agent",
    refId: "ref",
    label: rawText.replace(/^@/, ""),
    rawText,
    start,
    end: start + rawText.length,
    ...overrides,
  };
}

describe("reconcileMentions", () => {
  it("内容未变 → 原样返回", () => {
    const m = [_mkToken("@A", 0)];
    expect(reconcileMentions("@A x", "@A x", m)).toBe(m);
  });

  it("mention 之前插入文本 → offset 平移", () => {
    const m = [_mkToken("@A", 5)];
    const r = reconcileMentions("hello @A", "hello!! @A", m);
    expect(r).toHaveLength(1);
    expect(r[0].start).toBe(8);
    expect(r[0].end).toBe(10);
  });

  it("mention 之后删除文本 → offset 不变", () => {
    const m = [_mkToken("@A", 0)];
    const r = reconcileMentions("@A xxx", "@A x", m);
    expect(r[0].start).toBe(0);
  });

  it("删除穿透 mention 区间 → 丢弃 token", () => {
    const m = [_mkToken("@LongName", 5)];
    const r = reconcileMentions("hello @LongName world", "hello @Long world", m);
    expect(r).toHaveLength(0);
  });

  it("空 mention 列表 → 直接返回", () => {
    expect(reconcileMentions("a", "b", [])).toEqual([]);
  });

  it("重名 mention（同 rawText 出现 2 次）→ 按距离 anchor 最近的位置匹配", () => {
    const a = _mkToken("@X", 0);
    const b = _mkToken("@X", 10);
    const r = reconcileMentions("@X --- @X", "@X --- @X !", [a, b]);
    expect(r).toHaveLength(2);
    expect(r[0].start).toBe(0);
    expect(r[1].start).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// deriveForwardedPropsFromMentions
// ---------------------------------------------------------------------------

describe("deriveForwardedPropsFromMentions", () => {
  it("空数组 → 全部空", () => {
    expect(deriveForwardedPropsFromMentions([])).toEqual({
      preferred_subagent: null,
      scoped_corpus_ids: [],
      output_corpus_ids: [],
      graph_mode_corpus_ids: [],
    });
  });

  it("多 agent → 取最后一个", () => {
    const r = deriveForwardedPropsFromMentions([
      _mkToken("@A", 0, { kind: "agent", refId: "A1" }),
      _mkToken("@B", 0, { kind: "agent", refId: "B2" }),
    ]);
    expect(r.preferred_subagent).toBe("B2");
  });

  it("scoped + output 各自去重", () => {
    const r = deriveForwardedPropsFromMentions([
      _mkToken("@x", 0, { kind: "corpus-retrieve", refId: "u1" }),
      _mkToken("@y", 0, { kind: "corpus-retrieve", refId: "u1" }),
      _mkToken("@z", 0, { kind: "corpus-output", refId: "o1" }),
    ]);
    expect(r.scoped_corpus_ids).toEqual(["u1"]);
    expect(r.output_corpus_ids).toEqual(["o1"]);
  });

  it("validRefIds 过滤孤儿 token", () => {
    const r = deriveForwardedPropsFromMentions(
      [
        _mkToken("@a", 0, { kind: "agent", refId: "Alive" }),
        _mkToken("@b", 0, { kind: "agent", refId: "Dead" }),
        _mkToken("@c", 0, { kind: "corpus-retrieve", refId: "stale-uuid" }),
        _mkToken("@d", 0, { kind: "corpus-output", refId: "valid-uuid" }),
      ],
      {
        agents: new Set(["Alive"]),
        corpora: new Set(["valid-uuid"]),
      },
    );
    expect(r.preferred_subagent).toBe("Alive");
    expect(r.scoped_corpus_ids).toEqual([]);
    expect(r.output_corpus_ids).toEqual(["valid-uuid"]);
  });

  it("agent + retrieve + output 三类共存", () => {
    const r = deriveForwardedPropsFromMentions([
      _mkToken("@a", 0, { kind: "agent", refId: "Pipeline-A" }),
      _mkToken("@b", 0, { kind: "corpus-retrieve", refId: "kb-1" }),
      _mkToken("@c", 0, { kind: "corpus-output", refId: "out-1" }),
    ]);
    expect(r).toEqual({
      preferred_subagent: "Pipeline-A",
      scoped_corpus_ids: ["kb-1"],
      output_corpus_ids: ["out-1"],
      graph_mode_corpus_ids: [],
    });
  });

  it("@graph → 派生 graph_mode_corpus_ids", () => {
    const r = deriveForwardedPropsFromMentions([
      _mkToken("@k", 0, { kind: "graph", refId: "kb-1" }),
      _mkToken("@k2", 0, { kind: "graph", refId: "kb-2" }),
      _mkToken("@k3", 0, { kind: "graph", refId: "kb-1" }), // 去重
    ]);
    expect(r.graph_mode_corpus_ids).toEqual(["kb-1", "kb-2"]);
  });

  it("@graph 与 @corpus-retrieve 共存（两路独立）", () => {
    const r = deriveForwardedPropsFromMentions([
      _mkToken("@k", 0, { kind: "corpus-retrieve", refId: "kb-1" }),
      _mkToken("@k2", 0, { kind: "graph", refId: "kb-2" }),
    ]);
    expect(r.scoped_corpus_ids).toEqual(["kb-1"]);
    expect(r.graph_mode_corpus_ids).toEqual(["kb-2"]);
  });

  it("@graph 也被 validRefIds.corpora 过滤", () => {
    const r = deriveForwardedPropsFromMentions(
      [_mkToken("@k", 0, { kind: "graph", refId: "stale-uuid" })],
      { corpora: new Set(["valid-uuid"]) },
    );
    expect(r.graph_mode_corpus_ids).toEqual([]);
  });
});
