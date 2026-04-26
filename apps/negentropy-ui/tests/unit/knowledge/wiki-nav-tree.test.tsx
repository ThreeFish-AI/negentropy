/**
 * Wiki nav-tree 契约回归测试
 *
 * 锁定 negentropy-ui ↔ 后端 ↔ negentropy-wiki SSG 三方在
 * `/wiki/publications/{pub_id}/nav-tree` 上的统一响应契约：
 *
 *   {
 *     publication_id: string,
 *     nav_tree: { items: [{ entry_id, entry_slug, entry_title,
 *                            is_index_page, document_id, children? }] }
 *   }
 *
 * 配套 SSG 侧锁定测试位于 apps/negentropy-wiki/tests/lib/wiki-api.test.ts:106-129。
 */

import { render, screen } from "@testing-library/react";
import { WikiEntriesList } from "@/app/knowledge/wiki/_components/WikiEntriesList";
import {
  fetchWikiNavTree,
  type WikiNavTreeItem,
  type WikiNavTreeResponse,
} from "@/features/knowledge";

const navItem = (overrides: Partial<WikiNavTreeItem>): WikiNavTreeItem => ({
  entry_id: "11111111-1111-1111-1111-111111111111",
  document_id: "22222222-2222-2222-2222-222222222222",
  entry_slug: "getting-started",
  entry_title: "Getting Started",
  is_index_page: false,
  children: [],
  ...overrides,
});

describe("fetchWikiNavTree 响应契约", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("反序列化 {nav_tree: {items: [...]}} 信封并保留 entry_slug / entry_title / is_index_page", async () => {
    const payload: WikiNavTreeResponse = {
      publication_id: "33333333-3333-3333-3333-333333333333",
      nav_tree: {
        items: [
          navItem({ entry_slug: "intro", entry_title: "Intro", is_index_page: true }),
          navItem({
            entry_id: null,
            document_id: null,
            entry_slug: "guides",
            entry_title: "Guides",
            children: [
              navItem({ entry_slug: "guides/install", entry_title: "Install" }),
            ],
          }),
        ],
      },
    };
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const resp = await fetchWikiNavTree("33333333-3333-3333-3333-333333333333");
    expect(resp.publication_id).toBe("33333333-3333-3333-3333-333333333333");
    expect(resp.nav_tree.items).toHaveLength(2);
    expect(resp.nav_tree.items[0].entry_slug).toBe("intro");
    expect(resp.nav_tree.items[0].entry_title).toBe("Intro");
    expect(resp.nav_tree.items[0].is_index_page).toBe(true);
    expect(resp.nav_tree.items[1].entry_id).toBeNull();
    expect(resp.nav_tree.items[1].children?.[0]?.entry_slug).toBe("guides/install");
  });
});

describe("WikiEntriesList 渲染", () => {
  it("以后端真实字段渲染嵌套树而不抛 TypeError: object is not iterable", () => {
    const items: WikiNavTreeItem[] = [
      navItem({ entry_slug: "intro", entry_title: "Intro" }),
      navItem({
        entry_id: null,
        document_id: null,
        entry_slug: "guides",
        entry_title: "Guides",
        children: [
          navItem({ entry_slug: "guides/install", entry_title: "Install Guide" }),
        ],
      }),
    ];

    render(<WikiEntriesList navTree={items} loading={false} />);

    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Guides")).toBeInTheDocument();
    expect(screen.getByText("Install Guide")).toBeInTheDocument();
    expect(screen.getByText("/intro")).toBeInTheDocument();
    expect(screen.getByText("/guides/install")).toBeInTheDocument();
  });

  it("entry_title 为空时回退到 entry_slug 作为显示名（容器节点兼容）", () => {
    const items: WikiNavTreeItem[] = [
      navItem({
        entry_id: null,
        document_id: null,
        entry_slug: "orphan-container",
        entry_title: "",
      }),
    ];

    render(<WikiEntriesList navTree={items} loading={false} />);
    expect(screen.getByText("orphan-container")).toBeInTheDocument();
  });

  it("children 字段缺省（可选语义）时不抛错", () => {
    const items: WikiNavTreeItem[] = [
      // 显式不带 children 字段——后端叶节点常见形态
      {
        entry_id: "44444444-4444-4444-4444-444444444444",
        document_id: "55555555-5555-5555-5555-555555555555",
        entry_slug: "leaf",
        entry_title: "Leaf",
        is_index_page: false,
      },
    ];

    expect(() => {
      render(<WikiEntriesList navTree={items} loading={false} />);
    }).not.toThrow();
    expect(screen.getByText("Leaf")).toBeInTheDocument();
  });

  it("空数组渲染默认 emptyHint 文案", () => {
    render(<WikiEntriesList navTree={[]} loading={false} />);
    expect(
      screen.getByText("暂无条目，点击「从 Catalog 同步」拉取"),
    ).toBeInTheDocument();
  });
});
