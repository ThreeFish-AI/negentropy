import { describe, expect, it } from "vitest";
import { extractHeadings } from "@/lib/markdown-headings";

describe("extractHeadings", () => {
  it("returns empty array for blank input", () => {
    expect(extractHeadings("")).toEqual([]);
    expect(extractHeadings("   \n  ")).toEqual([]);
  });

  it("keeps only H2/H3/H4 and filters H1/H5/H6", () => {
    const md = `# Title\n\n## Intro\n\n### Why\n\n#### Detail\n\n##### Skipped\n\n###### Skipped\n`;
    const headings = extractHeadings(md);
    expect(headings.map((h) => h.depth)).toEqual([2, 3, 4]);
    expect(headings.map((h) => h.text)).toEqual(["Intro", "Why", "Detail"]);
  });

  it("dedupes repeated heading text the same way as rehype-slug", () => {
    // rehype-slug 与 github-slugger 对重复文本会追加 -1 / -2。
    // 重要：H1 也参与 slug 计数（先 slug 后过滤），以保证与 rehype-slug 完全一致。
    const md = `# Intro\n\n## Intro\n\n## Intro\n`;
    const headings = extractHeadings(md);
    expect(headings.map((h) => h.slug)).toEqual(["intro-1", "intro-2"]);
  });

  it("handles Chinese text via github-slugger transliteration rules", () => {
    const md = `## 设计要点\n\n### 复用驱动\n`;
    const headings = extractHeadings(md);
    expect(headings.length).toBe(2);
    // github-slugger 默认仅做小写化与空格转 dash，中文按字符保留
    expect(headings[0].slug).toBe("设计要点");
    expect(headings[1].slug).toBe("复用驱动");
  });

  it("preserves heading order across mixed depths", () => {
    const md = `## A\n\n### A.1\n\n## B\n\n### B.1\n\n#### B.1.a\n`;
    const headings = extractHeadings(md);
    expect(headings.map((h) => `${h.depth}:${h.text}`)).toEqual([
      "2:A",
      "3:A.1",
      "2:B",
      "3:B.1",
      "4:B.1.a",
    ]);
  });

  it("strips inline formatting in heading text", () => {
    const md = `## **Bold** and *italic* and \`code\`\n`;
    const headings = extractHeadings(md);
    expect(headings[0].text).toBe("Bold and italic and code");
  });
});
