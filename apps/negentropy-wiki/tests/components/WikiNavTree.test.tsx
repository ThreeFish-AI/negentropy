import { describe, expect, it } from "vitest";
import { computeAncestorSlugs } from "@/components/WikiNavTree";
import type { WikiNavTreeItem } from "@/lib/wiki-api";

const tree: WikiNavTreeItem[] = [
  {
    entry_id: null,
    document_id: null,
    entry_slug: "guides",
    entry_title: "Guides",
    is_index_page: false,
    children: [
      {
        entry_id: "g-1",
        document_id: "d-1",
        entry_slug: "guides/getting-started",
        entry_title: "Getting Started",
        is_index_page: false,
      },
      {
        entry_id: null,
        document_id: null,
        entry_slug: "guides/advanced",
        entry_title: "Advanced",
        is_index_page: false,
        children: [
          {
            entry_id: "g-2",
            document_id: "d-2",
            entry_slug: "guides/advanced/perf",
            entry_title: "Performance",
            is_index_page: false,
          },
        ],
      },
    ],
  },
  {
    entry_id: null,
    document_id: null,
    entry_slug: "papers",
    entry_title: "Papers",
    is_index_page: false,
    children: [
      {
        entry_id: "p-1",
        document_id: "d-3",
        entry_slug: "papers/2603-05344v3",
        entry_title: "2603.05344v3",
        is_index_page: false,
      },
    ],
  },
];

describe("computeAncestorSlugs", () => {
  it("returns empty when activeSlug is undefined", () => {
    const result = computeAncestorSlugs(tree, undefined);
    expect(result.size).toBe(0);
  });

  it("expands only the ancestor chain of the active leaf", () => {
    const result = computeAncestorSlugs(tree, "guides/advanced/perf");
    // 应包含 guides 与 guides/advanced，不包含其它分支
    expect([...result].sort()).toEqual(["guides", "guides/advanced"]);
  });

  it("returns empty trail when active node is at the top level", () => {
    const result = computeAncestorSlugs(
      [
        {
          entry_id: "x",
          document_id: "y",
          entry_slug: "top-level",
          entry_title: "Top",
          is_index_page: false,
        },
      ],
      "top-level",
    );
    expect(result.size).toBe(0);
  });

  it("does not expand siblings of the active page", () => {
    const result = computeAncestorSlugs(tree, "guides/getting-started");
    expect([...result]).toEqual(["guides"]);
    expect(result.has("papers")).toBe(false);
    expect(result.has("guides/advanced")).toBe(false);
  });
});
