/**
 * WikiPublishToolbar 行为契约测试
 *
 * 锁定「Wiki 发布入口一体化 + 双目标发布」PR 的关键契约：
 *   1. 无发布对象 / 加载中 → 操作按钮（发布 / 删除 / 目标选择器）全部 disabled；
 *   2. 目标选择器恒显（测试环境 / 生产环境）；draft 与 published 均显示「发布」，
 *      额外仅 published 显示「取消发布」；
 *   3. 默认测试环境：点「发布」→ 节点选择器确认后先 syncWikiEntriesFromCatalog
 *      再 publishWiki(pubId, "local")，不触发生产确认；
 *   4. 选「生产环境」+ 发布：节点确认后经 destructive confirm 二次确认，
 *      通过后 publishWiki(pubId, "production")；
 *   5. 生产确认被拒：不 sync 不 publish；
 *   6. 点「取消发布」→ confirm 通过后 unpublishWiki 被调用；
 *   7. 点「删除」→ confirm 通过后 deleteWikiPublication + onPublicationDeleted。
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { WikiPublishToolbar } from "@/app/knowledge/wiki/_components/WikiPublishToolbar";
import type { WikiPublication } from "@/features/knowledge";

// useConfirmDialog 的 confirm 抽出为模块级 mock，便于按用例控制确认结果。
// 变量名须以 mock 开头（vitest vi.mock 提升规则）。
const mockConfirm = vi.fn().mockResolvedValue(true);

vi.mock("@/features/knowledge", () => ({
  publishWiki: vi.fn(),
  unpublishWiki: vi.fn(),
  syncWikiEntriesFromCatalog: vi.fn(),
  deleteWikiPublication: vi.fn(),
}));

vi.mock("@/lib/activity-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ui/useConfirmDialog", () => ({
  useConfirmDialog: () => ({
    confirm: mockConfirm,
    confirmDialog: null,
  }),
}));

// 子对话框 mock：渲染最小占位 + 暴露 onConfirm 测试钩子。
vi.mock(
  "@/app/knowledge/wiki/_components/CatalogNodeSelectorDialog",
  () => ({
    CatalogNodeSelectorDialog: ({
      open,
      onConfirm,
      confirmLabel,
    }: {
      open: boolean;
      onConfirm: (ids: string[]) => void;
      confirmLabel?: string;
    }) =>
      open ? (
        <div data-testid="mock-selector">
          <span>{confirmLabel}</span>
          <button onClick={() => onConfirm(["node-1"])} data-testid="mock-selector-confirm">
            confirm
          </button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "@/app/knowledge/wiki/_components/CreateWikiPublicationDialog",
  () => ({
    CreateWikiPublicationDialog: ({ open }: { open: boolean }) =>
      open ? <div data-testid="mock-create-dialog" /> : null,
  }),
);

vi.mock(
  "@/app/knowledge/wiki/_components/WikiPublishPipeline",
  () => ({
    WikiPublishPipeline: () => <div data-testid="mock-pipeline" />,
  }),
);

import {
  publishWiki,
  unpublishWiki,
  syncWikiEntriesFromCatalog,
  deleteWikiPublication,
} from "@/features/knowledge";

const draftPub: WikiPublication = {
  id: "pub-1",
  catalog_id: "cat-1",
  app_name: "negentropy",
  name: "Demo Wiki",
  slug: "demo",
  description: null,
  theme: "default",
  status: "draft",
  version: 1,
  entries_count: 3,
  publish_mode: "live",
  created_at: "",
  updated_at: "",
  published_at: null,
} as unknown as WikiPublication;

const publishedPub: WikiPublication = {
  ...draftPub,
  status: "published",
  published_at: "2026-05-01T00:00:00Z",
  version: 2,
};

const baseHandlers = {
  onSelectPublication: vi.fn(),
  onPublicationsChanged: vi.fn(),
  onPublicationCreated: vi.fn(),
  onPublicationDeleted: vi.fn(),
  onAfterSync: vi.fn(),
};

describe("WikiPublishToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(true);
    vi.mocked(publishWiki).mockResolvedValue({
      version: 2,
      entries_count: 3,
      revalidation: "dispatched",
      target: "local",
      site_url: "http://localhost:3092",
    } as never);
    vi.mocked(unpublishWiki).mockResolvedValue({
      version: 2,
      revalidation: "dispatched",
    } as never);
    vi.mocked(syncWikiEntriesFromCatalog).mockResolvedValue({
      synced_count: 3,
      removed_count: 0,
      errors: [],
    } as never);
    vi.mocked(deleteWikiPublication).mockResolvedValue(undefined as never);
  });

  it("无发布对象时，操作按钮全部 disabled", () => {
    render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[]}
        selectedPub={null}
        selectedId={null}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    expect(screen.getByText("发布").closest("button")).toBeDisabled();
    expect(screen.getByText("删除").closest("button")).toBeDisabled();
    expect(screen.getByText("测试环境").closest("button")).toBeDisabled();
    expect(screen.getByText("生产环境").closest("button")).toBeDisabled();
  });

  it("draft 与 published 均显示「发布」+目标选择器；仅 published 额外显示「取消发布」", () => {
    const { rerender } = render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[draftPub]}
        selectedPub={draftPub}
        selectedId={draftPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    expect(screen.getByText("发布")).toBeInTheDocument();
    expect(screen.getByText("测试环境")).toBeInTheDocument();
    expect(screen.getByText("生产环境")).toBeInTheDocument();
    expect(screen.queryByText("取消发布")).not.toBeInTheDocument();

    rerender(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[publishedPub]}
        selectedPub={publishedPub}
        selectedId={publishedPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    expect(screen.getByText("发布")).toBeInTheDocument();
    expect(screen.getByText("取消发布")).toBeInTheDocument();
  });

  it("默认测试环境：点「发布」→ 选节点确认后先同步再 publishWiki(pubId,'local')，不触发生产确认", async () => {
    render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[draftPub]}
        selectedPub={draftPub}
        selectedId={draftPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    fireEvent.click(screen.getByText("发布"));
    expect(await screen.findByTestId("mock-selector")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-selector-confirm"));
    await waitFor(() => {
      expect(syncWikiEntriesFromCatalog).toHaveBeenCalledWith(draftPub.id, {
        catalog_node_ids: ["node-1"],
      });
    });
    await waitFor(() => {
      expect(publishWiki).toHaveBeenCalledWith(draftPub.id, "local");
    });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(baseHandlers.onAfterSync).toHaveBeenCalled();
  });

  it("选「生产环境」+ 发布：节点确认后经 destructive confirm，通过后 publishWiki(pubId,'production')", async () => {
    render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[draftPub]}
        selectedPub={draftPub}
        selectedId={draftPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    fireEvent.click(screen.getByText("生产环境"));
    fireEvent.click(screen.getByText("发布"));
    await screen.findByTestId("mock-selector");

    fireEvent.click(screen.getByTestId("mock-selector-confirm"));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "发布到生产环境", destructive: true }),
    );
    await waitFor(() => {
      expect(syncWikiEntriesFromCatalog).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(publishWiki).toHaveBeenCalledWith(draftPub.id, "production");
    });
  });

  it("生产确认被拒时不 sync 不 publish", async () => {
    mockConfirm.mockResolvedValueOnce(false);
    render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[draftPub]}
        selectedPub={draftPub}
        selectedId={draftPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    fireEvent.click(screen.getByText("生产环境"));
    fireEvent.click(screen.getByText("发布"));
    fireEvent.click(await screen.findByTestId("mock-selector-confirm"));
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledTimes(1);
    });
    expect(syncWikiEntriesFromCatalog).not.toHaveBeenCalled();
    expect(publishWiki).not.toHaveBeenCalled();
  });

  it("点「取消发布」确认后调用 unpublishWiki", async () => {
    render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[publishedPub]}
        selectedPub={publishedPub}
        selectedId={publishedPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    fireEvent.click(screen.getByText("取消发布"));
    await waitFor(() => {
      expect(unpublishWiki).toHaveBeenCalledWith(publishedPub.id);
    });
  });

  it("点「删除」确认后调用 deleteWikiPublication + onPublicationDeleted", async () => {
    render(
      <WikiPublishToolbar
        catalogId="cat-1"
        publications={[draftPub]}
        selectedPub={draftPub}
        selectedId={draftPub.id}
        publicationsLoading={false}
        {...baseHandlers}
      />,
    );
    fireEvent.click(screen.getByText("删除"));
    await waitFor(() => {
      expect(deleteWikiPublication).toHaveBeenCalledWith(draftPub.id);
    });
    expect(baseHandlers.onPublicationDeleted).toHaveBeenCalled();
  });
});
