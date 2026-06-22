import { describe, expect, it } from "vitest";

import {
  buildHeaderNav,
  resolveSidebarView,
  RESERVED_DOCS_SLUG,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

/**
 * `buildHeaderNav`：全站稳定顶栏模型的分区派生（单一事实源）。
 *
 * 锁定「保留 pub 仅置 reservedExists、其第一层交左栏全树（不入顶栏）；其余 pub 第一层
 * → topNav（携带 pubSlug）」的分区不变式——这是「右区只含非保留 pub、左标签纯链接」
 * 从而不重复的根据。
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
    expect(nav).toEqual({ reservedExists: false, topNav: [] });
  });

  it("仅保留 pub → reservedExists=true、topNav 为空（其第一层交左栏全树，不入顶栏）", () => {
    const nav = buildHeaderNav([
      {
        slug: RESERVED_DOCS_SLUG,
        items: [doc("readme"), container("concepts", [doc("concepts/overview")])],
      },
    ]);
    expect(nav.reservedExists).toBe(true);
    expect(nav.topNav).toEqual([]);
  });

  it("仅非保留 pub → topNav 每项携带正确 pubSlug，reservedExists=false", () => {
    const wikiItems = [
      container("harness-engineering", [doc("harness-engineering/getting-started")]),
      doc("sinestesia-of-cognition"),
    ];
    const nav = buildHeaderNav([{ slug: "wiki", items: wikiItems }]);
    expect(nav.reservedExists).toBe(false);
    expect(nav.topNav).toHaveLength(2);
    expect(nav.topNav.every((t) => t.pubSlug === "wiki")).toBe(true);
    expect(nav.topNav.map((t) => t.item.entry_slug)).toEqual([
      "harness-engineering",
      "sinestesia-of-cognition",
    ]);
  });

  it("混合（1 保留 + 2 非保留）→ 保留 pub 不进 topNav、顺序稳定、各带自身 pubSlug", () => {
    const nav = buildHeaderNav([
      { slug: RESERVED_DOCS_SLUG, items: [doc("readme"), container("concepts")] },
      { slug: "wiki", items: [container("harness-engineering", [doc("harness-engineering/x")])] },
      { slug: "blog", items: [doc("post-1"), doc("post-2")] },
    ]);
    expect(nav.reservedExists).toBe(true);
    // 非保留 pub 第一层进 topNav，顺序 = 入参顺序，pubSlug 各自归属
    expect(nav.topNav.map((t) => `${t.pubSlug}:${t.item.entry_slug}`)).toEqual([
      "wiki:harness-engineering",
      "blog:post-1",
      "blog:post-2",
    ]);
    // 互斥性：保留 pub 的第一层不进 topNav
    const topSlugs = nav.topNav.map((t) => t.item.entry_slug);
    expect(topSlugs).not.toContain("readme");
    expect(topSlugs).not.toContain("concepts");
  });

  it("保留 pub 第一层为空 → reservedExists=true、topNav 不受影响", () => {
    const nav = buildHeaderNav([
      { slug: RESERVED_DOCS_SLUG, items: [] },
      { slug: "wiki", items: [doc("a")] },
    ]);
    expect(nav.reservedExists).toBe(true);
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

describe("resolveSidebarView", () => {
  // 保留 pub 第一层：readme(DOCUMENT) + concepts/reference/research(CONTAINER)
  const reservedTree: WikiNavTreeItem[] = [
    { ...doc("readme", "Negentropy 用户手册"), is_index_page: true },
    container("concepts", [doc("concepts/overview", "认识 Negentropy")]),
    container("reference", [doc("reference/overview", "参考总览")]),
    container("research", [doc("research/overview", "调研总览")]),
  ];

  it("fullTree=true（保留 pub）→ sidebarItems=整棵树、indexEntry=null、catalogName=null", () => {
    const view = resolveSidebarView(reservedTree, { fullTree: true, currentSlug: "readme" });
    expect(view.sidebarItems.map((i) => i.entry_slug)).toEqual([
      "readme",
      "concepts",
      "reference",
      "research",
    ]);
    expect(view.hasActiveItem).toBe(true);
    expect(view.catalogName).toBeNull();
    expect(view.catalogTargetSlug).toBeNull();
    // 不渲染独立 🏠 首页（由全树 readme 节点承载，杜绝重复）
    expect(view.indexEntry).toBeNull();
  });

  it("fullTree=true 在 concepts 深层页 → 仍渲染整棵树（可切换其它二级目录）", () => {
    const view = resolveSidebarView(reservedTree, {
      fullTree: true,
      currentSlug: "concepts/overview",
    });
    expect(view.sidebarItems.map((i) => i.entry_slug)).toEqual([
      "readme",
      "concepts",
      "reference",
      "research",
    ]);
  });

  it("fullTree=true 空树 → sidebarItems=[]、hasActiveItem=false", () => {
    const view = resolveSidebarView([], { fullTree: true });
    expect(view.sidebarItems).toEqual([]);
    expect(view.hasActiveItem).toBe(false);
  });

  it("fullTree=false（动态 pub）→ 与 section 视图一致（仅激活 section 子树）", () => {
    const wikiTree: WikiNavTreeItem[] = [
      container("harness-engineering", [
        { ...doc("harness-engineering/getting-started", "开始使用"), is_index_page: true },
      ]),
      doc("sinestesia-of-cognition"),
    ];
    const view = resolveSidebarView(wikiTree, {
      fullTree: false,
      currentSlug: "harness-engineering/getting-started",
    });
    // 仅激活第一层 section（harness-engineering）的子树
    expect(view.sidebarItems.map((i) => i.entry_slug)).toEqual([
      "harness-engineering/getting-started",
    ]);
    expect(view.catalogName).toBe("harness-engineering");
    // 索引页存在 → indexEntry 非空（落地页「🏠 首页」入口）
    expect(view.indexEntry?.entry_slug).toBe("harness-engineering/getting-started");
  });
});
