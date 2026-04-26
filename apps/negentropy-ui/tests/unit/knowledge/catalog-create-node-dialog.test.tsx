/**
 * CreateNodeDialog 契约回归测试（PR-4 节点类型选择移除）
 *
 * 锁定：
 *   1. 类型 select 控件已彻底移除（创建即 FOLDER）；
 *   2. createCatalogNode API 调用使用 node_type='folder'；
 *   3. 提示文案明确指引用户通过节点详情页挂载文档。
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CreateNodeDialog } from "@/app/knowledge/catalog/_components/CreateNodeDialog";

vi.mock("@/features/knowledge", () => ({
  createCatalogNode: vi.fn().mockResolvedValue({
    id: "00000000-0000-0000-0000-000000000001",
    catalog_id: "cat-1",
    name: "My Folder",
    slug: "my-folder",
    parent_id: null,
    node_type: "folder",
    description: null,
    sort_order: 0,
    config: {},
  }),
}));

vi.mock("@/lib/activity-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { createCatalogNode } from "@/features/knowledge";

describe("CreateNodeDialog（PR-4 类型选择移除）", () => {
  const baseProps = {
    open: true,
    parentId: null,
    catalogId: "cat-1",
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(createCatalogNode).mockClear();
  });

  it("不再渲染「类型」select 控件", () => {
    render(<CreateNodeDialog {...baseProps} />);
    // 任何 <select> 元素都不应出现
    const selects = document.querySelectorAll("select");
    expect(selects.length).toBe(0);
    // 文案中也不应出现旧的「分类」「集合」「文档引用」候选
    expect(screen.queryByText("分类")).not.toBeInTheDocument();
    expect(screen.queryByText("集合")).not.toBeInTheDocument();
    expect(screen.queryByText("文档引用")).not.toBeInTheDocument();
  });

  it("提交时调用 createCatalogNode 且 node_type='folder'", async () => {
    render(<CreateNodeDialog {...baseProps} />);

    const nameInput = screen.getByPlaceholderText("节点名称");
    fireEvent.change(nameInput, { target: { value: "My Folder" } });

    const submitBtn = screen.getByText("创建");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createCatalogNode).toHaveBeenCalledTimes(1);
    });
    const callArgs = vi.mocked(createCatalogNode).mock.calls[0][0];
    expect(callArgs.node_type).toBe("folder");
    expect(callArgs.catalog_id).toBe("cat-1");
    expect(callArgs.name).toBe("My Folder");
    // slug 由 name 自动生成
    expect(callArgs.slug).toBe("my-folder");
  });

  it("说明文案指引用户通过节点详情挂载文档", () => {
    render(<CreateNodeDialog {...baseProps} />);
    expect(screen.getByText(/挂载文档/)).toBeInTheDocument();
  });
});
