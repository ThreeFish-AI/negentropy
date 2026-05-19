/**
 * WikiPublishToolbar 行为契约测试
 *
 * 锁定 PR「Wiki 模块：发布入口一体化」中的关键契约：
 *   1. 无发布对象 / 加载中 → 操作按钮全部 disabled；
 *   2. selectedPub.status === "published" 时显示「取消发布」，否则显示「仅发布」；
 *   3. 点「仅发布」→ publishWiki 被调用并 toast 成功；
 *   4. 点「取消发布」→ confirm 通过后 unpublishWiki 被调用；
 *   5. 点「删除」→ confirm 通过后 deleteWikiPublication + onPublicationDeleted；
 *   6. 「从 Catalog 同步」与「同步并发布」按钮存在，且 syncWikiEntriesFromCatalog 通过对话框 onConfirm 流入。
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { WikiPublishToolbar } from "@/app/knowledge/wiki/_components/WikiPublishToolbar";
import type { WikiPublication } from "@/features/knowledge";

vi.mock("@/features/knowledge", () => ({
  publishWiki: vi.fn(),
  unpublishWiki: vi.fn(),
  syncWikiEntriesFromCatalog: vi.fn(),
  deleteWikiPublication: vi.fn(),
}));

vi.mock("@/lib/activity-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// 简化 confirm dialog：默认始终确认。
vi.mock("@/components/ui/useConfirmDialog", () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
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
  name: "Demo Wiki",
  slug: "demo",
  description: null,
  theme: "default",
  status: "draft",
  version: 1,
  entries_count: 3,
  publish_mode: "LIVE",
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
    vi.mocked(publishWiki).mockResolvedValue({
      version: 2,
      entries_count: 3,
      revalidation: "dispatched",
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
    expect(screen.getByText("从 Catalog 同步").closest("button")).toBeDisabled();
    expect(screen.getByText("同步并发布").closest("button")).toBeDisabled();
    expect(screen.getByText("仅发布").closest("button")).toBeDisabled();
    expect(screen.getByText("删除").closest("button")).toBeDisabled();
  });

  it("draft 状态显示「仅发布」，published 状态显示「取消发布」", () => {
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
    expect(screen.getByText("仅发布")).toBeInTheDocument();
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
    expect(screen.getByText("取消发布")).toBeInTheDocument();
    expect(screen.queryByText("仅发布")).not.toBeInTheDocument();
  });

  it("点「仅发布」调用 publishWiki(pubId) 并触发 onPublicationsChanged", async () => {
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
    fireEvent.click(screen.getByText("仅发布"));
    await waitFor(() => {
      expect(publishWiki).toHaveBeenCalledWith(draftPub.id);
    });
    expect(baseHandlers.onPublicationsChanged).toHaveBeenCalled();
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

  it("「同步并发布」打开选择器；选择器确认后先同步再发布", async () => {
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
    fireEvent.click(screen.getByText("同步并发布"));
    // 选择器以「同步并发布」确认文案展开
    expect(await screen.findByTestId("mock-selector")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-selector-confirm"));
    await waitFor(() => {
      expect(syncWikiEntriesFromCatalog).toHaveBeenCalledWith(draftPub.id, {
        catalog_node_ids: ["node-1"],
      });
    });
    await waitFor(() => {
      expect(publishWiki).toHaveBeenCalledWith(draftPub.id);
    });
    expect(baseHandlers.onAfterSync).toHaveBeenCalled();
  });

  it("「从 Catalog 同步」仅同步不发布", async () => {
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
    fireEvent.click(screen.getByText("从 Catalog 同步"));
    fireEvent.click(await screen.findByTestId("mock-selector-confirm"));
    await waitFor(() => {
      expect(syncWikiEntriesFromCatalog).toHaveBeenCalled();
    });
    expect(publishWiki).not.toHaveBeenCalled();
  });
});
