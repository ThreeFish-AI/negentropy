/**
 * Wiki 导航树容器判定（PR-5）
 *
 * 锁定 ``isContainerItem`` 在以下场景的行为：
 *   1. 显式 `entry_kind='CONTAINER'`：识别为容器（即使 entry_id 非空）；
 *   2. 显式 `entry_kind='DOCUMENT'`：识别为叶子；
 *   3. 缺 `entry_kind`：按 `document_id` 是否为空兜底兼容旧响应；
 *   4. 历史合成容器（entry_id=null + document_id=null）：识别为容器。
 */

import { describe, expect, it } from "vitest";
import { isContainerItem, type WikiNavTreeItem } from "@/lib/wiki-api";

const baseItem: WikiNavTreeItem = {
  entry_id: "11111111-1111-1111-1111-111111111111",
  entry_slug: "x",
  entry_title: "X",
  is_index_page: false,
  document_id: null,
};

describe("isContainerItem", () => {
  it("entry_kind='CONTAINER' 即使 entry_id 非空也识别为容器", () => {
    const item: WikiNavTreeItem = {
      ...baseItem,
      entry_kind: "CONTAINER",
      catalog_node_id: "node-1",
      document_id: null,
    };
    expect(isContainerItem(item)).toBe(true);
  });

  it("entry_kind='DOCUMENT' 识别为叶子", () => {
    const item: WikiNavTreeItem = {
      ...baseItem,
      entry_kind: "DOCUMENT",
      document_id: "doc-1",
    };
    expect(isContainerItem(item)).toBe(false);
  });

  it("缺 entry_kind 时按 document_id 兜底（document_id=null → 容器）", () => {
    const item: WikiNavTreeItem = {
      ...baseItem,
      document_id: null,
    };
    expect(isContainerItem(item)).toBe(true);
  });

  it("缺 entry_kind 时按 document_id 兜底（document_id 非空 → 叶子）", () => {
    const item: WikiNavTreeItem = {
      ...baseItem,
      document_id: "doc-1",
    };
    expect(isContainerItem(item)).toBe(false);
  });

  it("历史合成容器（entry_id=null + document_id=null）识别为容器", () => {
    const item: WikiNavTreeItem = {
      ...baseItem,
      entry_id: null,
      document_id: null,
    };
    expect(isContainerItem(item)).toBe(true);
  });
});
