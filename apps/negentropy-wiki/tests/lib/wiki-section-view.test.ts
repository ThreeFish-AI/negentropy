/**
 * Header tabs / Sidebar 子树切片派生（catalog 第一层提升）
 *
 * 锁定 ``findFirstDocumentSlug`` / ``findActiveTopLevelSlug`` / ``resolveSectionView``
 * 在以下场景的行为：
 *   1. 空树 → 视图为空；
 *   2. 单 DOCUMENT 一级节点 → tab 直链该 doc；
 *   3. 多 CONTAINER 一级节点 → 找首个可达后代 DOCUMENT；
 *   4. CONTAINER 无任何后代 DOCUMENT → tab 跳转 slug = null（禁用语义）；
 *   5. currentSlug 为空 → activeTop = 首项；
 *   6. currentSlug 为深层 entry → activeTop 反查命中所属第一层；
 *   7. currentSlug 在树外 → 兜底为首项。
 */

import { describe, expect, it } from "vitest";
import {
  findActiveTopLevelSlug,
  findFirstDocumentSlug,
  resolveSectionView,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

function doc(slug: string, overrides: Partial<WikiNavTreeItem> = {}): WikiNavTreeItem {
  return {
    entry_id: `entry-${slug}`,
    entry_slug: slug,
    entry_title: slug,
    is_index_page: false,
    document_id: `doc-${slug}`,
    entry_kind: "DOCUMENT",
    ...overrides,
  };
}

function container(
  slug: string,
  children: WikiNavTreeItem[] = [],
  overrides: Partial<WikiNavTreeItem> = {},
): WikiNavTreeItem {
  return {
    entry_id: `entry-${slug}`,
    entry_slug: slug,
    entry_title: slug,
    is_index_page: false,
    document_id: null,
    entry_kind: "CONTAINER",
    catalog_node_id: `node-${slug}`,
    children,
    ...overrides,
  };
}

describe("findFirstDocumentSlug", () => {
  it("DOCUMENT 节点直接返回自身 slug", () => {
    expect(findFirstDocumentSlug(doc("a"))).toBe("a");
  });

  it("CONTAINER → DFS 找到首个后代 DOCUMENT", () => {
    const tree = container("c1", [
      container("c1/sub", [doc("c1/sub/p1"), doc("c1/sub/p2")]),
      doc("c1/p"),
    ]);
    expect(findFirstDocumentSlug(tree)).toBe("c1/sub/p1");
  });

  it("CONTAINER 无后代 DOCUMENT → 返回 null", () => {
    const tree = container("c1", [container("c1/sub", [container("c1/sub/empty")])]);
    expect(findFirstDocumentSlug(tree)).toBeNull();
  });
});

describe("findActiveTopLevelSlug", () => {
  const tree: WikiNavTreeItem[] = [
    container("alpha", [
      container("alpha/blog", [doc("alpha/blog/post-1")]),
      container("alpha/paper", [doc("alpha/paper/p-2")]),
    ]),
    container("beta", [doc("beta/intro")]),
  ];

  it("空树 → undefined", () => {
    expect(findActiveTopLevelSlug([], "anything")).toBeUndefined();
  });

  it("currentSlug 为空 → 默认首项", () => {
    expect(findActiveTopLevelSlug(tree)).toBe("alpha");
    expect(findActiveTopLevelSlug(tree, undefined)).toBe("alpha");
  });

  it("currentSlug 命中首层节点本身", () => {
    expect(findActiveTopLevelSlug(tree, "beta")).toBe("beta");
  });

  it("currentSlug 命中深层节点 → 返回所属第一层", () => {
    expect(findActiveTopLevelSlug(tree, "alpha/blog/post-1")).toBe("alpha");
    expect(findActiveTopLevelSlug(tree, "beta/intro")).toBe("beta");
  });

  it("currentSlug 在树外 → 兜底首项", () => {
    expect(findActiveTopLevelSlug(tree, "ghost/unknown")).toBe("alpha");
  });
});

describe("resolveSectionView", () => {
  const tree: WikiNavTreeItem[] = [
    container("alpha", [
      container("alpha/blog", [doc("alpha/blog/post-1")]),
      container("alpha/paper", [doc("alpha/paper/p-2")]),
    ]),
    doc("beta-only"),
  ];

  it("空树 → 全空视图", () => {
    const view = resolveSectionView([]);
    expect(view.headerItems).toHaveLength(0);
    expect(view.activeTopSlug).toBeUndefined();
    expect(view.activeItem).toBeUndefined();
    expect(view.sidebarItems).toHaveLength(0);
  });

  it("无 currentSlug → 默认首项激活，sidebarItems = 该项 children", () => {
    const view = resolveSectionView(tree);
    expect(view.activeTopSlug).toBe("alpha");
    expect(view.activeItem?.entry_slug).toBe("alpha");
    expect(view.sidebarItems.map((it) => it.entry_slug)).toEqual([
      "alpha/blog",
      "alpha/paper",
    ]);
  });

  it("DOCUMENT-only 一级激活 → sidebarItems 为空", () => {
    const view = resolveSectionView(tree, "beta-only");
    expect(view.activeTopSlug).toBe("beta-only");
    expect(view.activeItem?.entry_slug).toBe("beta-only");
    expect(view.sidebarItems).toHaveLength(0);
  });

  it("深层 currentSlug → 激活其所属第一层", () => {
    const view = resolveSectionView(tree, "alpha/paper/p-2");
    expect(view.activeTopSlug).toBe("alpha");
    expect(view.sidebarItems.map((it) => it.entry_slug)).toEqual([
      "alpha/blog",
      "alpha/paper",
    ]);
  });
});
