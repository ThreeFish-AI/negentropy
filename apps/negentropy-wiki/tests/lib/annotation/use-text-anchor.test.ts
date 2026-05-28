import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAnchor, type TextAnchor } from "@/lib/annotation/use-text-anchor";
import { captureSnapshot, type AnnotationSnapshot } from "@/lib/annotation/use-snapshot";

describe("resolveAnchor - 三段式解析", () => {
  let container: HTMLDivElement;
  let snapshot: AnnotationSnapshot;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML =
      "<p>This is the first paragraph with annotated text inside.</p>" +
      "<p>Second paragraph for context.</p>";
    document.body.appendChild(container);
    snapshot = captureSnapshot(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // 容器 textContent："This is the first paragraph with annotated text inside.Second paragraph for context."
  // "annotated text" 起始字符偏移 33，长度 14
  // "Second" 起始字符偏移 55，长度 6
  it("段 1：v2 anchor + hash 一致 → snapshot 直接定位", () => {
    const anchor: TextAnchor = {
      xpath: "/p[1]",
      exact: "annotated text",
      prefix: "first paragraph with ",
      suffix: " inside.",
      text_offset: 33,
      text_length: 14,
      source_text_hash: snapshot.textHash,
      anchor_version: 2,
    };
    const range = resolveAnchor(anchor, container, snapshot);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe("annotated text");
  });

  it("段 2：v1 anchor（无 snapshot 字段）→ 当前 DOM 全文搜索命中", () => {
    const anchor: TextAnchor = {
      xpath: "/p[1]",
      exact: "annotated text",
      prefix: "first paragraph with ",
      suffix: " inside.",
      text_offset: 33,
      text_length: 14,
    };
    const range = resolveAnchor(anchor, container);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe("annotated text");
  });

  it("段 1 → 段 2 切换：snapshot hash 不匹配则降级", () => {
    const anchor: TextAnchor = {
      xpath: "/p[1]",
      exact: "annotated text",
      prefix: "first paragraph with ",
      suffix: " inside.",
      text_offset: 33,
      text_length: 14,
      source_text_hash: "deadbeef", // 故意错的 hash
      anchor_version: 2,
    };
    const range = resolveAnchor(anchor, container, snapshot);
    expect(range).not.toBeNull();
    // 走段 2 兜底，仍能命中
    expect(range!.toString()).toBe("annotated text");
  });

  it("段 3：精确文本不存在 → 块级粗粒度回退", () => {
    const anchor: TextAnchor = {
      xpath: "/p[1]",
      // 这段中文文本在英文容器中绝对不存在
      exact: "标注的中文文本",
      prefix: "中文前缀",
      suffix: "中文后缀",
      text_offset: 0,
      text_length: 7,
    };
    const range = resolveAnchor(anchor, container);
    expect(range).not.toBeNull();
    // 块级回退 → 选中整个 <p> 的内容
    expect(range!.toString()).toContain("first paragraph");
  });

  it("xpath 失效但文本仍在 → 走段 2 全文搜索", () => {
    const anchor: TextAnchor = {
      xpath: "/section[3]/div[1]", // 这个 xpath 在 container 中不存在
      exact: "Second paragraph",
      prefix: "",
      suffix: "",
      text_offset: 100,
      text_length: 16,
    };
    const range = resolveAnchor(anchor, container);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe("Second paragraph");
  });

  it("v2 anchor 在 snapshot 节点 nodeValue 被翻译后仍可命中（粗粒度回退）", () => {
    const anchor: TextAnchor = {
      xpath: "/p[1]",
      exact: "annotated text",
      prefix: "",
      suffix: "",
      text_offset: 33,
      text_length: 14,
      source_text_hash: snapshot.textHash,
      anchor_version: 2,
    };
    // 翻译：原地修改第一个 text node 的 nodeValue 为中文
    const originalP1Text = snapshot.textNodes[0];
    originalP1Text.nodeValue = "这是第一段含有被标注文本的段落内容。";

    // 此时容器 textContent 已变，hash 不再匹配
    // 段 2 全文搜索找不到 "annotated text"（中文容器中）
    // 段 3 块级粗粒度回退命中第一个 <p>
    const range = resolveAnchor(anchor, container, snapshot);
    expect(range).not.toBeNull();
    // 落在中文译文里某段（粗粒度），非空字符串
    expect(range!.toString().length).toBeGreaterThan(0);
  });

  it("v2 anchor 在 hash 一致且 nodeValue 未变时精确命中（snapshot fast path）", () => {
    // "Second" 起始于容器全局偏移 55
    const anchor: TextAnchor = {
      xpath: "/p[2]",
      exact: "Second",
      prefix: "",
      suffix: " paragraph",
      text_offset: 55,
      text_length: 6,
      source_text_hash: snapshot.textHash,
      anchor_version: 2,
    };
    const range = resolveAnchor(anchor, container, snapshot);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe("Second");
  });
});
