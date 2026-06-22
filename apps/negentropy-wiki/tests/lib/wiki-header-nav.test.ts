import { describe, expect, it } from "vitest";

import {
  buildHeaderNav,
  RESERVED_DOCS_SLUG,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * `buildHeaderNav`：全站稳定顶栏模型的分区派生（单一事实源）。
 *
 * 锁定「保留 pub 第一层 → reservedItems、其余 pub 第一层 → topNav（携带 pubSlug）」
 * 的分区不变式——这是「左下拉只含保留 pub、右区只含非保留 pub」从而两处不重复的根据。
 */

function doc(slug: string, title = slug): WikiNavTreeItem {
  return {
    entry_id: `entry-${slug}`,
    entry_slug: slug,
    entry_title: title,
    is_index_page: false,
    document_id: `doc-${slug}`,
    entry_kind: "DOCUMENT",
  };
}

function container(slug: string, children: WikiNavTreeItem[] = []): WikiNavTreeItem {
  return {
    entry_id: `entry-${slug}`,
    entry_slug: slug,
    entry_title: slug,
    is_index_page: false,
    document_id: null,
    entry_kind: "CONTAINER",
    catalog_node_id: `node-${slug}`,
    children,
  };
}

describe("buildHeaderNav", () => {
  it("空输入 → 全空模型（无保留、无 topNav）", () => {
    const nav = buildHeaderNav([]);
    expect(nav).toEqual({ reservedExists: false, reservedItems: [], topNav: [] });
  });

  it("仅保留 pub → reservedItems 为其第一层，topNav 为空", () => {
    const reservedFirstLevel = [doc("readme"), container("concepts", [doc("concepts/overview")])];
    const nav = buildHeaderNav([{ slug: RESERVED_DOCS_SLUG, items: reservedFirstLevel }]);
    expect(nav.reservedExists).toBe(true);
    expect(nav.reservedItems).toEqual(reservedFirstLevel);
    expect(nav.topNav).toEqual([]);
  });

  it("仅非保留 pub → topNav 每项携带正确 pubSlug，reservedExists=false", () => {
    const wikiItems = [container("harness-engineering", [doc("harness-engineering/getting-started")]), doc("sinestesia-of-cognition")];
    const nav = buildHeaderNav([{ slug: "wiki", items: wikiItems }]);
    expect(nav.reservedExists).toBe(false);
    expect(nav.reservedItems).toEqual([]);
    expect(nav.topNav).toHaveLength(2);
    expect(nav.topNav.every((t) => t.pubSlug === "wiki")).toBe(true);
    expect(nav.topNav.map((t) => t.item.entry_slug)).toEqual([
      "harness-engineering",
      "sinestesia-of-cognition",
    ]);
  });

  it("混合（1 保留 + 2 非保留）→ 分区互斥、顺序稳定、跨 pub 各带自身 pubSlug", () => {
    const nav = buildHeaderNav([
      { slug: RESERVED_DOCS_SLUG, items: [doc("readme"), container("concepts")] },
      { slug: "wiki", items: [container("harness-engineering", [doc("harness-engineering/x")])] },
      { slug: "blog", items: [doc("post-1"), doc("post-2")] },
    ]);
    // 保留 pub 第一层只进 reservedItems
    expect(nav.reservedExists).toBe(true);
    expect(nav.reservedItems.map((i) => i.entry_slug)).toEqual(["readme", "concepts"]);
    // 非保留 pub 第一层只进 topNav，顺序 = 入参顺序，pubSlug 各自归属
    expect(nav.topNav.map((t) => `${t.pubSlug}:${t.item.entry_slug}`)).toEqual([
      "wiki:harness-engineering",
      "blog:post-1",
      "blog:post-2",
    ]);
    // 互斥性：reservedItems 的 slug 不出现在 topNav
    const topSlugs = nav.topNav.map((t) => t.item.entry_slug);
    expect(topSlugs).not.toContain("readme");
    expect(topSlugs).not.toContain("concepts");
  });

  it("保留 pub 第一层为空 → reservedExists=true 但 reservedItems=[]（供左标签回退纯链接）", () => {
    const nav = buildHeaderNav([
      { slug: RESERVED_DOCS_SLUG, items: [] },
      { slug: "wiki", items: [doc("a")] },
    ]);
    expect(nav.reservedExists).toBe(true);
    expect(nav.reservedItems).toEqual([]);
    expect(nav.topNav).toHaveLength(1);
  });

  it("跨 pub 同名 entry_slug 靠 pubSlug 隔离，不串味", () => {
    const nav = buildHeaderNav([
      { slug: "wiki", items: [doc("intro")] },
      { slug: "blog", items: [doc("intro")] },
    ]);
    expect(nav.topNav).toEqual([
      { pubSlug: "wiki", item: doc("intro") },
      { pubSlug: "blog", item: doc("intro") },
    ]);
  });
});
