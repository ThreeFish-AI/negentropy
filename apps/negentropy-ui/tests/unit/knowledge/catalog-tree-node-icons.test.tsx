/**
 * CatalogTreeNode 图标 / 徽标兜底测试（PR-4）
 *
 * 锁定：
 *   - `folder` 类型显示 Folder 图标 + 中文「目录」徽标；
 *   - `document_ref` 类型显示 FileText 图标 + 中文「文档」徽标；
 *   - 历史值 `category` / `collection` 兜底为 folder 视觉。
 */

import { render, screen } from "@testing-library/react";
import type { CatalogNode, CatalogNodeType } from "@/features/knowledge";
import { CatalogTreeNode } from "@/app/knowledge/catalog/_components/CatalogTreeNode";

function makeNode(node_type: CatalogNodeType, overrides: Partial<CatalogNode> = {}): CatalogNode {
  return {
    id: "00000000-0000-0000-0000-0000000000aa",
    catalog_id: "cat-1",
    name: "Test Node",
    slug: "test-node",
    parent_id: null,
    node_type,
    description: null,
    sort_order: 0,
    config: {},
    ...overrides,
  };
}

const baseProps = {
  depth: 0,
  isExpanded: false,
  hasChildren: false,
  isSelected: false,
  isEditing: false,
  searchQuery: "",
  onToggle: vi.fn(),
  onSelect: vi.fn(),
  onContextMenu: vi.fn(),
  onRename: vi.fn(),
  onCancelEdit: vi.fn(),
  highlightMatch: (text: string) => text,
  isDragging: false,
  dropTarget: null as null,
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDrop: vi.fn(),
  onDragEnd: vi.fn(),
};

describe("CatalogTreeNode 节点徽标 / 图标", () => {
  it("folder 类型徽标显示「目录」", () => {
    render(<CatalogTreeNode node={makeNode("folder")} {...baseProps} />);
    expect(screen.getByText("目录")).toBeInTheDocument();
  });

  it("document_ref 类型徽标显示「文档」", () => {
    render(<CatalogTreeNode node={makeNode("document_ref")} {...baseProps} />);
    expect(screen.getByText("文档")).toBeInTheDocument();
  });

  it("历史值 category 兜底为「目录」", () => {
    render(<CatalogTreeNode node={makeNode("category")} {...baseProps} />);
    expect(screen.getByText("目录")).toBeInTheDocument();
  });

  it("历史值 collection 兜底为「目录」", () => {
    render(<CatalogTreeNode node={makeNode("collection")} {...baseProps} />);
    expect(screen.getByText("目录")).toBeInTheDocument();
  });
});
