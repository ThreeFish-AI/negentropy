import Link from "next/link";

import { ThemePreference } from "@/components/ThemePreference";
import { WikiGraphRenderer } from "@/components/WikiGraphRenderer";
import { WikiHeader } from "@/components/WikiHeader";
import { WikiHeaderActions } from "@/components/WikiHeaderActions";
import { WikiHeaderMobileNav } from "@/components/WikiHeaderMobileNav";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import {
  buildReservedDocsTab,
  countLeafEntries,
  isReservedDocsSlug,
  resolveSectionView,
  type WikiNavTreeItem,
  type WikiPublication,
} from "@/lib/wiki-api";
import { loadHeaderNav, wikiApi } from "@/lib/content-source";
import type { WikiGraphResponse } from "@/lib/wiki-graph-types";

/**
 * Publication 知识图谱页 — /:pubSlug/graph
 *
 * 数据流（纯静态化）：
 *   - 构建期 `wikiApi.getPublicationGraph(pub.id)` 从静态内容包读取按
 *     Publication 切片、已烘焙为静态 JSON 的图谱数据（节点 + 边）；
 *   - 客户端组件 `WikiGraphRenderer` 自带 ``"use client"``，Sigma WebGL bundle
 *     会被 Next.js 自动拆分进本路由的客户端 chunk，SSR 阶段不引入。
 *
 * 图谱页使用全宽布局（variant="home"），无 sidebar / TOC，canvas 占满
 * viewport 宽度以最大化图谱可视化空间。
 */

/**
 * `output: export` 要求动态路由导出 generateStaticParams；Graph 与 Publication
 * 首页共用 `[pubSlug]` 段，复用父级参数生成（Next 仅识别 page.tsx 的导出）。
 */
export { generateStaticParams } from "../generate";

interface Props {
  params: Promise<{ pubSlug: string }>;
}

export default async function WikiPublicationGraphPage({ params }: Props) {
  const { pubSlug } = await params;

  let publication: WikiPublication | null = null;
  let navItems: WikiNavTreeItem[] = [];
  let graph: WikiGraphResponse | null = null;
  let graphError: string | null = null;

  try {
    publication = await wikiApi.findPublicationBySlug(pubSlug);
    if (publication) {
      const [navResult, graphResult] = await Promise.all([
        wikiApi.getNavTree(publication.id),
        wikiApi.getPublicationGraph(publication.id),
      ]);
      navItems = navResult.nav_tree?.items || [];
      graph = graphResult;
    }
  } catch (err) {
    console.error(`[Wiki] Failed to load graph for "${pubSlug}":`, err);
    graphError = err instanceof Error ? err.message : String(err);
  }

  if (!publication) {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>Wiki 未找到</h1>
        <p className="wiki-not-found-hint">
          Publication &quot;{pubSlug}&quot; 不存在或未发布
        </p>
        <Link href="/" className="wiki-back-link">
          ← 返回首页
        </Link>
      </main>
    );
  }

  const entriesTotal = countLeafEntries(navItems);
  const sectionView = resolveSectionView(navItems);

  const isReserved = isReservedDocsSlug(pubSlug);

  // 顶栏全局模型：左侧「Negentropy」纯链接，右区恒列各动态 pub 一级菜单（全页并存）。
  const headerNav = await loadHeaderNav();
  const reservedTab = buildReservedDocsTab({
    reservedExists: headerNav.reservedExists,
    isReserved,
  });

  const header = (
    <WikiHeader
      pubSlug={pubSlug}
      topNav={headerNav.topNav}
      activePubSlug={isReserved ? undefined : pubSlug}
      activeTopSlug={sectionView.activeTopSlug}
      headerSlot={<ThemePreference />}
      actions={<WikiHeaderActions />}
      reservedTab={reservedTab}
      graphTab={{
        active: pubSlug === headerNav.graphPubSlug,
        show: !!headerNav.graphPubSlug,
        href: headerNav.graphPubSlug ? `/${headerNav.graphPubSlug}/graph` : undefined,
      }}
    />
  );

  const mobileTopNav = (
    <WikiHeaderMobileNav reservedTab={reservedTab} topNav={headerNav.topNav} />
  );

  return (
    <WikiLayoutShell
      sidebar={<></>}
      hasToc={false}
      header={header}
      mobileTopNav={mobileTopNav}
      variant="home"
    >
      <div className="wiki-graph-page">
        <WikiGraphBody
          pubSlug={pubSlug}
          publication={publication}
          graph={graph}
          graphError={graphError}
        />
      </div>
    </WikiLayoutShell>
  );
}

// ---------------------------------------------------------------------------
// 主体渲染（按 graph 状态分支：error / loading-failed / no_kg / empty / ok）
// ---------------------------------------------------------------------------

interface WikiGraphBodyProps {
  pubSlug: string;
  publication: WikiPublication;
  graph: WikiGraphResponse | null;
  graphError: string | null;
}

function WikiGraphBody({
  pubSlug,
  publication,
  graph,
  graphError,
}: WikiGraphBodyProps) {
  if (graphError) {
    return (
      <div className="wiki-graph-error">
        <p className="wiki-text-hint">
          图谱数据暂时不可用，请稍后重试或返回
          <Link href={`/${pubSlug}`} style={{ marginLeft: "0.3em" }}>
            Publication 首页
          </Link>
          。
        </p>
        <pre className="wiki-error-detail">{graphError}</pre>
      </div>
    );
  }

  if (!graph || graph.status === "no_kg") {
    return (
      <div className="wiki-graph-empty">
        <p className="wiki-text-hint">
          该发布暂未构建知识图谱。请联系管理员在后端 Knowledge 模块对相关
          Corpus 触发 KG 构建后重试。
        </p>
      </div>
    );
  }

  if (graph.status === "empty" || graph.nodes.length === 0) {
    return (
      <div className="wiki-graph-empty">
        <p className="wiki-text-hint">
          该发布的文档暂未触发任何实体提及，图谱为空。
        </p>
      </div>
    );
  }

  // 与主站对齐：提供 Sigma / 3D / d3-force / Force Graph / Cytoscape 五种渲染器，
  // 用户可自由切换（默认 Sigma WebGL）。大图场景由用户手动选择更稳健的引擎
  // （如 Force Graph），不再隐式按节点数自动降级。
  return (
    <div className="wiki-graph-canvas-wrap">
      <WikiGraphRenderer
        pubSlug={pubSlug}
        version={publication.version}
        nodes={graph.nodes}
        edges={graph.edges}
        truncated={graph.truncated}
        totalEntities={graph.total_entities}
      />
    </div>
  );
}
