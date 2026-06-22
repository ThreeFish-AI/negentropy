import { describe, expect, it } from "vitest";

import {
  buildReservedDocsTab,
  isReservedDocsSlug,
  RESERVED_DOCS_HOME,
  RESERVED_DOCS_INDEX_SLUG,
  RESERVED_DOCS_LABEL,
  RESERVED_DOCS_SLUG,
} from "@/lib/wiki-api";

// 保留一级目录「Negentropy」的常量与判定（Header 左侧纯链接标签的单一事实源）。
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

// buildReservedDocsTab：「Negentropy」恒为纯链接标签（无下拉）——其二级目录由进入后的
// 左栏完整文档树承载。单一事实源，杜绝多页面重复实现。
describe("buildReservedDocsTab", () => {
  it("reservedExists=false → undefined（保留 pub 不存在，不渲染标签）", () => {
    expect(buildReservedDocsTab({ reservedExists: false, isReserved: false })).toBeUndefined();
    expect(buildReservedDocsTab({ reservedExists: false, isReserved: true })).toBeUndefined();
  });

  it("身处保留 pub（isReserved=true）→ 纯链接、active=true", () => {
    const tab = buildReservedDocsTab({ reservedExists: true, isReserved: true });
    expect(tab).toEqual({
      show: true,
      active: true,
      label: RESERVED_DOCS_LABEL,
      href: RESERVED_DOCS_HOME,
    });
  });

  it("其它页面（isReserved=false）→ 纯链接、active=false（仍渲染，全页并存）", () => {
    const tab = buildReservedDocsTab({ reservedExists: true, isReserved: false });
    expect(tab).toEqual({
      show: true,
      active: false,
      label: RESERVED_DOCS_LABEL,
      href: RESERVED_DOCS_HOME,
    });
  });

  it("label/href 与 RESERVED_DOCS_* 常量族对齐（单一事实源）", () => {
    const tab = buildReservedDocsTab({ reservedExists: true, isReserved: true });
    expect(tab?.label).toBe(RESERVED_DOCS_LABEL);
    expect(tab?.href).toBe(`/${RESERVED_DOCS_SLUG}/${RESERVED_DOCS_INDEX_SLUG}`);
  });
});
