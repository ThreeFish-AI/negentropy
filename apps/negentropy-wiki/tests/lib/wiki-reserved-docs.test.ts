import { describe, expect, it } from "vitest";

import {
  isReservedDocsSlug,
  RESERVED_DOCS_HOME,
  RESERVED_DOCS_INDEX_SLUG,
  RESERVED_DOCS_LABEL,
  RESERVED_DOCS_SLUG,
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
