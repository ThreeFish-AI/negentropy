import { describe, expect, it } from "vitest";

import {
  buildReservedDocsTab,
  isReservedDocsSlug,
  RESERVED_DOCS_HOME,
  RESERVED_DOCS_INDEX_SLUG,
  RESERVED_DOCS_LABEL,
  RESERVED_DOCS_SLUG,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";

// 保留一级目录「Negentropy」的常量与判定（Header 左侧标签 / 首页右区过滤的单一事实源）。
describe("保留 docs 目录常量与 isReservedDocsSlug", () => {
  it("常量取值与后端 reserved_slug 默认值对齐", () => {
    expect(RESERVED_DOCS_SLUG).toBe("negentropy");
    expect(RESERVED_DOCS_INDEX_SLUG).toBe("readme");
    expect(RESERVED_DOCS_HOME).toBe("/negentropy/readme");
    expect(RESERVED_DOCS_LABEL).toBe("Negentropy");
  });

  it("isReservedDocsSlug 仅对保留 slug 为真，其余（含 null/空）为假", () => {
    expect(isReservedDocsSlug("negentropy")).toBe(true);
    expect(isReservedDocsSlug("negentropy-handbook")).toBe(false);
    expect(isReservedDocsSlug("concepts")).toBe(false);
    expect(isReservedDocsSlug(null)).toBe(false);
    expect(isReservedDocsSlug(undefined)).toBe(false);
    expect(isReservedDocsSlug("")).toBe(false);
  });
});

// buildReservedDocsTab：顶级菜单全局化后，下拉项始终来自入参全局 reservedItems
// （与当前路由无关，使「Negentropy」下拉在任意页面恒列二级目录）；仅 active /
// activeChildSlug 依「是否身处保留 pub」而变。三个 pub 页面与首页共享，杜绝重复实现。
describe("buildReservedDocsTab", () => {
  const reservedItems: WikiNavTreeItem[] = [
    {
      entry_id: "readme-id",
      entry_slug: "readme",
      entry_title: "Negentropy 用户手册",
      is_index_page: true,
      document_id: "doc-readme",
    },
    {
      entry_id: "concepts-id",
      entry_slug: "concepts",
      entry_title: "Concepts",
      is_index_page: false,
      document_id: null,
      entry_kind: "CONTAINER",
      children: [
        {
          entry_id: "overview-id",
          entry_slug: "concepts/overview",
          entry_title: "认识 Negentropy",
          is_index_page: false,
          document_id: "doc-overview",
        },
      ],
    },
  ];

  it("reservedExists=false → undefined（保留 pub 不存在，不渲染标签）", () => {
    expect(buildReservedDocsTab({ reservedExists: false, isReserved: false })).toBeUndefined();
    expect(buildReservedDocsTab({ reservedExists: false, isReserved: true })).toBeUndefined();
  });

  it("身处保留 pub（isReserved=true）→ 注入 items + activeChildSlug，渲染为下拉", () => {
    const tab = buildReservedDocsTab({
      reservedExists: true,
      isReserved: true,
      items: reservedItems,
      activeChildSlug: "concepts",
    });
    expect(tab).toEqual({
      show: true,
      active: true,
      label: RESERVED_DOCS_LABEL,
      href: RESERVED_DOCS_HOME,
      items: reservedItems,
      activeChildSlug: "concepts",
    });
  });

  it("非保留页（isReserved=false）→ items 仍注入（全局下拉恒列二级目录），active=false", () => {
    const tab = buildReservedDocsTab({
      reservedExists: true,
      isReserved: false,
      items: reservedItems,
      activeChildSlug: "readme",
    });
    expect(tab?.show).toBe(true);
    expect(tab?.active).toBe(false);
    // 顶级菜单全局化：items 始终来自全局 reservedItems，与 isReserved 无关。
    expect(tab?.items).toEqual(reservedItems);
    // 但非保留页左下拉不高亮任何子项：activeChildSlug 门控为 undefined。
    expect(tab?.activeChildSlug).toBeUndefined();
    expect(tab?.label).toBe(RESERVED_DOCS_LABEL);
    expect(tab?.href).toBe(RESERVED_DOCS_HOME);
  });

  it("items 缺省/空 → items 归一为 undefined（保留 pub 无第一层时回退纯链接）", () => {
    const missing = buildReservedDocsTab({ reservedExists: true, isReserved: true });
    expect(missing?.show).toBe(true);
    expect(missing?.items).toBeUndefined();

    const empty = buildReservedDocsTab({
      reservedExists: true,
      isReserved: false,
      items: [],
      activeChildSlug: "x",
    });
    expect(empty?.items).toBeUndefined();
    expect(empty?.activeChildSlug).toBeUndefined();
  });

  it("label/href 与 RESERVED_DOCS_* 常量族对齐（单一事实源）", () => {
    const tab = buildReservedDocsTab({
      reservedExists: true,
      isReserved: true,
      items: reservedItems,
    });
    expect(tab?.label).toBe(RESERVED_DOCS_LABEL);
    expect(tab?.href).toBe(`/${RESERVED_DOCS_SLUG}/${RESERVED_DOCS_INDEX_SLUG}`);
  });
});
