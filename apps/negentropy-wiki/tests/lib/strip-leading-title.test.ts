import { describe, expect, it } from "vitest";
import { stripLeadingTitleHeading } from "@/lib/strip-leading-title";

describe("stripLeadingTitleHeading", () => {
  it("strips a leading H1 matching the title and the trailing blank line", () => {
    const md = `# Self-Harness\n\n正文第一段。\n\n## 章节\n`;
    expect(stripLeadingTitleHeading(md, "Self-Harness")).toBe(
      `正文第一段。\n\n## 章节\n`,
    );
  });

  it("strips any leading H1 when no title is provided", () => {
    const md = `# 任意标题\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md)).toBe(`正文。\n`);
  });

  it("preserves content when first non-empty line is an H2", () => {
    const md = `## 不是 H1\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "不是 H1")).toBe(md);
  });

  it("preserves content when first non-empty line is a paragraph", () => {
    const md = `正文开头。\n\n# 后面的 H1\n`;
    expect(stripLeadingTitleHeading(md, "后面的 H1")).toBe(md);
  });

  it("does not strip when H1 text does not match the title (防误伤)", () => {
    const md = `# 不同标题\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "Self-Harness")).toBe(md);
  });

  it("handles closing hash sequence (ATX closed H1)", () => {
    const md = `# Self-Harness ##\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "Self-Harness")).toBe(`正文。\n`);
  });

  it("skips leading blank lines before the H1", () => {
    const md = `\n\n# Self-Harness\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "Self-Harness")).toBe(`正文。\n`);
  });

  it("normalizes emphasis markers when comparing to title", () => {
    const md = `# **Self** _Harness_\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "Self Harness")).toBe(`正文。\n`);
  });

  it("tolerates up to 3 leading spaces (CommonMark ATX)", () => {
    const md = `   # Self-Harness\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "Self-Harness")).toBe(`正文。\n`);
  });

  it("does not treat a 4-space-indented # as a heading (code block territory)", () => {
    const md = `    # not a heading\n\n正文。\n`;
    expect(stripLeadingTitleHeading(md, "not a heading")).toBe(md);
  });

  it("returns input as-is for empty or blank input", () => {
    expect(stripLeadingTitleHeading("", "X")).toBe("");
    expect(stripLeadingTitleHeading("   \n  ", "X")).toBe("   \n  ");
  });

  it("only removes the single leading H1 (not subsequent H1s)", () => {
    const md = `# Title\n\n## A\n\n# Other H1\n`;
    expect(stripLeadingTitleHeading(md, "Title")).toBe(`## A\n\n# Other H1\n`);
  });
});
