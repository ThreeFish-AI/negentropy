import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it, vi } from "vitest";

// `server-only` 在 vitest（非 RSC）环境导入会抛错，mock 为空模块。
vi.mock("server-only", () => ({}));

const testDir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(testDir, "../../content");

describe("LocalContentClient（读取静态内容包 fixture）", () => {
  // wikiApi 单例由动态导入返回；测试仅断言其方法行为，宽松类型即可。
  let wikiApi: any;

  beforeAll(async () => {
    // content-source 在模块加载期读 process.env.WIKI_CONTENT_DIR 计算 CONTENT_DIR；
    // 重置模块并设置环境后再动态导入，确保指向 fixture。
    // （顶部已 vi.mock("server-only")；resetModules 不清除 mock 注册，无需重复声明。）
    process.env.WIKI_CONTENT_DIR = FIXTURE_DIR;
    vi.resetModules();
    const mod = await import("@/lib/content-source");
    wikiApi = mod.wikiApi;
  });

  it("listPublications 返回 fixture 中的 handbook", async () => {
    const { items, total } = await wikiApi.listPublications();
    expect(total).toBe(1);
    expect(items[0].slug).toBe("negentropy-handbook");
    expect(items[0].status).toBe("published");
  });

  it("findPublicationBySlug 按 slug 命中 publication", async () => {
    const pub = await wikiApi.findPublicationBySlug("negentropy-handbook");
    expect(pub).not.toBeNull();
    expect(pub.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(pub.version).toBe(3);
  });

  it("findPublicationBySlug 未命中返回 null", async () => {
    const pub = await wikiApi.findPublicationBySlug("nope");
    expect(pub).toBeNull();
  });

  it("getNavTree 返回嵌套导航树（含 CONTAINER 容器节点）", async () => {
    const pub = await wikiApi.findPublicationBySlug("negentropy-handbook");
    const { nav_tree } = await wikiApi.getNavTree(pub.id);
    const topSlugs = nav_tree.items.map((i: { entry_slug: string }) => i.entry_slug);
    expect(topSlugs).toContain("quickstart");
    expect(topSlugs).toContain("architecture-overview");
    const quickstart = nav_tree.items.find(
      (i: { entry_slug: string }) => i.entry_slug === "quickstart",
    );
    expect(quickstart.entry_kind).toBe("CONTAINER");
    expect(quickstart.children[0].entry_slug).toBe("quickstart/getting-started");
  });

  it("getEntries + getEntryContent 返回 markdown 正文（含 GCS 直链被保留/重写）", async () => {
    const pub = await wikiApi.findPublicationBySlug("negentropy-handbook");
    const { items } = await wikiApi.getEntries(pub.id);
    const gs = items.find((e: { entry_slug: string }) => e.entry_slug === "quickstart/getting-started");
    expect(gs).toBeTruthy();
    const content = await wikiApi.getEntryContent(gs.id);
    expect(content.entry_title).toBe("开始使用");
    expect(content.markdown_content).toContain("纯静态");
    // 不应残留对主站后端的运行时资产引用
    expect(content.markdown_content).not.toContain("/api/documents/");
  });

  it("getPublicationGraph 返回烘焙的静态图谱数据", async () => {
    const pub = await wikiApi.findPublicationBySlug("negentropy-handbook");
    const graph = await wikiApi.getPublicationGraph(pub.id);
    expect(graph.status).toBe("ok");
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
  });

  it("getPublicationGraph 对未知 pubId 抛错（与 getPublication 一致）", async () => {
    // 未知 pubId 解析不到 slug → 抛错（no_kg 降级仅针对「有效 pub 但 graph.json 缺失」，
    // 由 content-source 的 exists 检查处理，页面层不会用未知 id 调用本方法）。
    await expect(
      wikiApi.getPublicationGraph("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/publication not found/);
  });
});
