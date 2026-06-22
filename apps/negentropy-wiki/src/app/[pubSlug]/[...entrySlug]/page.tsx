import {
  buildReservedDocsTab,
  isReservedDocsSlug,
  joinEntrySlug,
  resolveSectionView,
  resolveSidebarView,
  type WikiEntry,
  type WikiEntryContent,
  type WikiNavTreeItem,
  type WikiPublication,
} from "@/lib/wiki-api";
import { loadHeaderNav, wikiApi } from "@/lib/content-source";
import { WikiHeader } from "@/components/WikiHeader";
import { WikiHeaderMobileNav } from "@/components/WikiHeaderMobileNav";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import { ThemePreference } from "@/components/ThemePreference";
import { WikiSidebar } from "@/components/WikiSidebar";
import { WikiToc } from "@/components/WikiToc";
import { WikiSearchBox } from "@/components/WikiSearchBox";
import { WikiSearchProvider } from "@/components/WikiSearchProvider";
import { WikiHeaderActions } from "@/components/WikiHeaderActions";
import { extractHeadings } from "@/lib/markdown-headings";
import { stripLeadingTitleHeading } from "@/lib/strip-leading-title";
import { buildBreadcrumbPath } from "@/lib/wiki-api";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { WikiBreadcrumb } from "@/components/WikiBreadcrumb";
import { WikiArticleMeta } from "@/components/WikiArticleMeta";
import { WikiFooter } from "@/components/home/WikiFooter";
import Link from "next/link";
import { Metadata } from "next";

/**
 * `output: export` 要求动态路由导出 generateStaticParams；
 * 从 colocated `generate.ts` re-export（Next 仅识别 page.tsx 的导出）。
 */
export { generateStaticParams } from "./generate";

/**
 * Wiki 文档详情页 — 渲染 Markdown 内容（支持层级路径）
 *
 * 动态路由: /:pubSlug/*entrySlug
 * 因 entry_slug 可能包含 "/"（Materialized Path），使用 catch-all 段捕获。
 *
 * 三栏布局：
 *   - 左：Catalog 同步而来的 nav tree（折叠到当前页祖先链）
 *   - 中：Markdown 内容（react-markdown + GFM + slug）
 *   - 右：本页 TOC（可整体折叠为 rail）
 */

interface Props {
  params: Promise<{ pubSlug: string; entrySlug: string[] }>;
}

type LoadStatus = "ok" | "missing" | "pending" | "orphaned";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pubSlug, entrySlug } = await params;
  const slug = joinEntrySlug(entrySlug);
  return {
    title: `${slug} — ${pubSlug}`,
    description: `Negentropy Wiki 文档页面`,
  };
}

export default async function WikiEntryPage({ params }: Props) {
  const { pubSlug, entrySlug } = await params;
  const slug = joinEntrySlug(entrySlug);

  let publication: WikiPublication | null = null;
  let navItems: WikiNavTreeItem[] = [];
  let content: WikiEntryContent | null = null;
  let status: LoadStatus = "missing";

  try {
    publication = await wikiApi.findPublicationBySlug(pubSlug);
    if (publication) {
      const [navResult, entriesResult] = await Promise.all([
        wikiApi.getNavTree(publication.id),
        wikiApi.getEntries(publication.id),
      ]);
      navItems = navResult.nav_tree?.items || [];

      const entry: WikiEntry | undefined = entriesResult.items.find(
        (e) => e.entry_slug === slug,
      );
      if (entry) {
        if (entry.status === "orphaned" || entry.document_id === null) {
          status = "orphaned";
        } else {
          content = await wikiApi.getEntryContent(entry.id);
          if (content && content.markdown_content && content.markdown_content.trim()) {
            status = "ok";
          } else {
            status = "pending";
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Wiki] Failed to load entry "${pubSlug}/${slug}":`, err);
  }

  if (status === "orphaned") {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>该文档已失效</h1>
        <p className="wiki-not-found-hint">
          文档 &quot;{slug}&quot; 的源文件已被移除或转移，条目暂时无法访问。
        </p>
        <div className="wiki-not-found-actions">
          <Link href={`/${pubSlug}`}>← 返回 {pubSlug}</Link>
          <Link href="/">返回首页</Link>
        </div>
      </main>
    );
  }

  if (!publication || status === "missing") {
    return (
      <main className="wiki-main wiki-not-found">
        <h1>文档未找到</h1>
        <p className="wiki-not-found-hint">
          文档 &quot;{slug}&quot; 不存在或未发布
        </p>
        <div className="wiki-not-found-actions">
          <Link href={`/${pubSlug}`}>← 返回 {pubSlug}</Link>
          <Link href="/">返回首页</Link>
        </div>
      </main>
    );
  }

  // 正文 Markdown 首行恒为「# {entry_title}」（后端抽取产物），与面包屑末段/页面标题重复。
  // 渲染前剥离该首标题 H1；剥离后的同一字符串同时供 TOC（extractHeadings）与正文
  // （MarkdownRenderer）使用，确保 rehype-slug 锚点与 TOC 不因 H1 缺席而漂移。
  const md = stripLeadingTitleHeading(content?.markdown_content ?? "", content?.entry_title);
  const headings = status === "ok" ? extractHeadings(md) : [];
  const hasToc = headings.length >= 2;
  const isReserved = isReservedDocsSlug(pubSlug);
  const sectionView = resolveSectionView(navItems, slug);
  const hasAnyEntry = sectionView.headerItems.length > 0;
  const breadcrumbItems = status === "ok"
    ? buildBreadcrumbPath(navItems, slug)
    : [];

  // 单一事实源：嵌套页（面包屑 > 1 段）才渲染面包屑；标题承载与 H1 模式均由此判定派生。
  const showBreadcrumb = breadcrumbItems.length > 1;

  // 左栏侧边视图：保留 pub 渲染完整文档树（README + concepts/reference/research，全页可切换），
  // 动态 pub 维持 section 切片。
  const sidebarView = resolveSidebarView(navItems, { fullTree: isReserved, currentSlug: slug });

  const sidebar = (
    <WikiSidebar
      pubSlug={pubSlug}
      publication={publication}
      sidebarItems={sidebarView.sidebarItems}
      hasActiveItem={sidebarView.hasActiveItem}
      activeSlug={slug}
      catalogTargetSlug={sidebarView.catalogTargetSlug}
      catalogName={sidebarView.catalogName}
      searchSlot={<WikiSearchBox />}
    />
  );

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
        active: false,
        show: !!headerNav.graphPubSlug,
        href: headerNav.graphPubSlug ? `/${headerNav.graphPubSlug}/graph` : undefined,
      }}
    />
  );

  const mobileTopNav = (
    <WikiHeaderMobileNav reservedTab={reservedTab} topNav={headerNav.topNav} />
  );

  return (
    <WikiSearchProvider pubSlug={pubSlug}>
    <WikiLayoutShell
      sidebar={sidebar}
      hasToc={hasToc}
      header={header}
      mobileTopNav={mobileTopNav}
      toc={hasToc ? <WikiToc headings={headings} /> : undefined}
      footer={<WikiFooter />}
    >
      {status === "pending" ? (
        <>
          <header className="wiki-doc-header">
            <h1 className="wiki-doc-title">
              {content?.entry_title || slug}
            </h1>
            <div className="wiki-doc-meta">
              来源: {content?.document_filename || "未知"}
            </div>
          </header>
          <section className="wiki-pending-card">
            <h2>📄 文档内容尚未生成</h2>
            <p>
              该条目已收录至 Wiki，但源文档的 Markdown 尚未提取完成。请在
              Negentropy 管理后台的
              <strong> Knowledge › Documents </strong>
              页面为该文档触发「提取 Markdown」后，重新发布 Publication。
            </p>
            <p className="wiki-text-hint">
              发布成功后，SSG 会在 5 分钟内的 ISR 窗口重新拉取内容；如需立即生效，可重新构建站点。
            </p>
          </section>
        </>
      ) : (
        content && (
          <>
            {showBreadcrumb && (
              <WikiBreadcrumb items={breadcrumbItems} pubSlug={pubSlug} />
            )}
            <header className="wiki-doc-header">
              {/*
                标题去重：正文首标题 H1 已在上文剥离。
                - 嵌套页（有面包屑）：标题由面包屑末段承载，此处仅保留视觉隐藏 H1
                  维系文档大纲 / SEO / 无障碍语义（复用 utilities 的 .sr-only）。
                - 顶层页（无面包屑）：保留页面 H1 作为唯一可见标题，维持「标题在上、
                  元信息在下」的布局，与嵌套页视觉一致。
              */}
              {showBreadcrumb ? (
                <h1 className="sr-only">{content.entry_title || slug}</h1>
              ) : (
                <h1 className="wiki-doc-title">{content.entry_title || slug}</h1>
              )}
              <WikiArticleMeta
                authorName={content.author_name}
                authorUrl={content.author_url}
                publishedAt={content.published_at}
                sourceUrl={content.source_url}
              />
            </header>
            <MarkdownRenderer content={md} />
          </>
        )
      )}
    </WikiLayoutShell>
    </WikiSearchProvider>
  );
}
