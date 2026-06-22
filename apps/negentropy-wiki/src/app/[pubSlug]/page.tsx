import {
  buildReservedDocsTab,
  countLeafEntries,
  isReservedDocsSlug,
  resolveSectionView,
  resolveSidebarView,
  type WikiPublication,
  type WikiNavTreeItem,
} from "@/lib/wiki-api";
import { loadHeaderNav, wikiApi } from "@/lib/content-source";
import { WikiHeader } from "@/components/WikiHeader";
import { WikiHeaderMobileNav } from "@/components/WikiHeaderMobileNav";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import { ThemePreference } from "@/components/ThemePreference";
import { WikiSidebar } from "@/components/WikiSidebar";
import { WikiSearchBox } from "@/components/WikiSearchBox";
import { WikiSearchProvider } from "@/components/WikiSearchProvider";
import { WikiHeaderActions } from "@/components/WikiHeaderActions";
import Link from "next/link";
import { WikiFooter } from "@/components/home/WikiFooter";

/**
 * `output: export` 要求动态路由导出 generateStaticParams；
 * 从 colocated `generate.ts` re-export（Next 仅识别 page.tsx 的导出）。
 */
export { generateStaticParams } from "./generate";

/**
 * Publication 首页 — 显示层级导航树与索引入口
 *
 * 动态路由: /:pubSlug
 *
 * 复用 `WikiLayoutShell` 但 `hasToc=false`（首页本身没有正文 TOC），
 * 保持与详情页一致的左栏折叠风格与三栏 Grid 行为。
 */

interface Props {
  params: Promise<{ pubSlug: string }>;
}

export default async function WikiPublicationPage({ params }: Props) {
  const { pubSlug } = await params;

  let publication: WikiPublication | null = null;
  let navItems: WikiNavTreeItem[] = [];

  try {
    const match = await wikiApi.findPublicationBySlug(pubSlug);
    if (match) {
      publication = match;
      const navResult = await wikiApi.getNavTree(match.id);
      navItems = navResult.nav_tree?.items || [];
    }
  } catch (err) {
    console.error(`[Wiki] Failed to load publication "${pubSlug}":`, err);
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

  // 保留一级目录「Negentropy」：左侧标签恒在（存在保留 pub 时），当前在该 pub 时高亮；
  // 保留 docs 目录无 KG，故其页面隐藏 Knowledge Graph 标签。
  const isReserved = isReservedDocsSlug(pubSlug);

  // 顶栏全局模型 + 左栏侧边视图（保留 pub 走全树、动态 pub 走 section 切片）。
  const headerNav = await loadHeaderNav();
  const sidebarView = resolveSidebarView(navItems, { fullTree: isReserved });

  const sidebar = (
    <WikiSidebar
      pubSlug={pubSlug}
      publication={publication}
      sidebarItems={sidebarView.sidebarItems}
      hasActiveItem={sidebarView.hasActiveItem}
      indexEntry={sidebarView.indexEntry}
      catalogTargetSlug={sidebarView.catalogTargetSlug}
      catalogName={sidebarView.catalogName}
      searchSlot={<WikiSearchBox />}
    />
  );

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
      graphTab={{ active: false, show: entriesTotal > 0 && !isReserved }}
    />
  );

  const mobileTopNav = (
    <WikiHeaderMobileNav reservedTab={reservedTab} topNav={headerNav.topNav} />
  );

  return (
    <WikiSearchProvider pubSlug={pubSlug}>
    <WikiLayoutShell sidebar={sidebar} hasToc={false} header={header} mobileTopNav={mobileTopNav} footer={<WikiFooter />}>
      <header className="wiki-doc-header">
        <h1 className="wiki-doc-title">
          {sidebarView.catalogName ? (
            sidebarView.catalogTargetSlug ? (
              <Link href={`/${pubSlug}/${sidebarView.catalogTargetSlug}`}>
                {sidebarView.catalogName}
              </Link>
            ) : (
              sidebarView.catalogName
            )
          ) : (
            publication.name
          )}
        </h1>
        <div className="wiki-doc-meta">
          版本 v{publication.version} · {entriesTotal} 篇文档 ·{" "}
          {publication.published_at
            ? new Date(publication.published_at).toLocaleDateString("zh-CN")
            : "尚未发布"}
        </div>
      </header>

      {entriesTotal === 0 ? (
        <p className="wiki-text-hint wiki-empty-hint">
          此 Publication 尚无文档条目，请通过后端管理界面
          <Link href={`/`} style={{ textDecoration: "underline" }}>
            同步 Catalog
          </Link>
          后重新发布。
        </p>
      ) : sidebarView.indexEntry ? (
        <p className="wiki-text-hint">
          请从左侧导航选择文档，或直接访问{" "}
          <Link href={`/${pubSlug}/${sidebarView.indexEntry.entry_slug}`}>首页</Link>。
        </p>
      ) : (
        <p className="wiki-text-hint">请从左侧导航选择文档开始阅读。</p>
      )}
    </WikiLayoutShell>
    </WikiSearchProvider>
  );
}
