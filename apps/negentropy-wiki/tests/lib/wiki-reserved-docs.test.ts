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

// buildReservedDocsTab：把"身处保留 pub 时把 nav-tree 第一层折叠进左侧下拉、其它页面纯链接"
// 的规则集中于此，三个 pub 页面共享，杜绝重复实现。
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

  it("其它页面（isReserved=false）→ items 不注入（纯链接），active=false", () => {
    const tab = buildReservedDocsTab({
      reservedExists: true,
      isReserved: false,
      items: reservedItems,
      activeChildSlug: "readme",
    });
    expect(tab?.show).toBe(true);
    expect(tab?.active).toBe(false);
    expect(tab?.items).toBeUndefined();
    // activeChildSlug 即便传入也不再有意义（纯链接无下拉），但保持透传不抛错
    expect(tab?.activeChildSlug).toBe("readme");
    expect(tab?.label).toBe(RESERVED_DOCS_LABEL);
    expect(tab?.href).toBe(RESERVED_DOCS_HOME);
  });

  it("label/href 与 RESERVED_DOCS_* 常量族对齐（单一事实源）", () => {
    const tab = buildReservedDocsTab({ reservedExists: true, isReserved: true, items: [] });
    expect(tab?.label).toBe(RESERVED_DOCS_LABEL);
    expect(tab?.href).toBe(`/${RESERVED_DOCS_SLUG}/${RESERVED_DOCS_INDEX_SLUG}`);
  });
});
