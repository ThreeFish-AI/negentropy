/**
 * 前端 wiki-slug 工具单测（与后端 SSOT 对齐）
 *
 * 关键 SSOT 锚点：``WIKI_SLUG_PATTERN`` 字符串值必须与后端
 * ``negentropy/knowledge/slug.py::SLUG_PATTERN`` 完全一致。两端任何变更都会
 * 同步触发本测试 / `test_slug.py::TestIsValidSlug.test_pattern_value_stable`。
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SLUG,
  WIKI_SLUG_PATTERN,
  isValidSlug,
  slugify,
} from "@/features/knowledge/utils/wiki-slug";

describe("WIKI_SLUG_PATTERN (前后端 SSOT)", () => {
  it("string value stays in lockstep with backend slug.py SLUG_PATTERN", () => {
    expect(WIKI_SLUG_PATTERN).toBe("^[a-z0-9]+(?:-[a-z0-9]+)*$");
  });
});

describe("slugify", () => {
  it("converts plain ASCII text", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("collapses non-alphanumeric runs to single dash", () => {
    expect(slugify("Hello!! World@@")).toBe("hello-world");
  });

  it("collapses multiple spaces", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
  });

  it("strips leading/trailing dashes", () => {
    expect(slugify("---abc---")).toBe("abc");
  });

  it("returns DEFAULT_SLUG for empty string", () => {
    expect(slugify("")).toBe(DEFAULT_SLUG);
  });

  it("returns DEFAULT_SLUG for all special chars", () => {
    expect(slugify("!@#$%")).toBe(DEFAULT_SLUG);
  });

  it("preserves valid slug shape", () => {
    expect(slugify("docs-2024")).toBe("docs-2024");
  });
});

describe("isValidSlug", () => {
  it.each([
    ["abc-def", true],
    ["docs-2024", true],
    ["a", true],
    ["Abc", false],
    ["a b", false],
    ["-abc", false],
    ["abc-", false],
    ["a--b", false],
    ["", false],
  ])("isValidSlug(%j) → %s", (slug, expected) => {
    expect(isValidSlug(slug)).toBe(expected);
  });
});
