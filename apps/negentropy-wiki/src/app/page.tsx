import type { ComponentType } from "react";

import {
  findFirstDocumentSlug,
  isReservedDocsSlug,
  RESERVED_DOCS_HOME,
  RESERVED_DOCS_LABEL,
  type WikiNavTreeItem,
  type WikiPublication,
} from "@/lib/wiki-api";
import { wikiApi } from "@/lib/content-source";
import { WikiHeader } from "@/components/WikiHeader";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import { ThemePreference } from "@/components/ThemePreference";
import { WikiHeaderActions } from "@/components/WikiHeaderActions";
import { HomeCard } from "@/components/home/HomeCard";
import { GalaxyHeroMount } from "@/components/home/GalaxyHeroMount";
import { WikiFooter } from "@/components/home/WikiFooter";
import { getPublicationIcon } from "@/components/home/CardIcons";

/** 从 nav tree 一级节点构建跳转 href */
function buildEntryHref(pubSlug: string, item: WikiNavTreeItem): string {
  const target = findFirstDocumentSlug(item);
  return target ? `/${pubSlug}/${target}` : `/${pubSlug}`;
}

export default async function WikiHomePage() {
  let publications: WikiPublication[] = [];

  try {
    const result = await wikiApi.listPublications();
    publications = result.items;
  } catch (err) {
    console.warn("[Wiki] Failed to load publications:", err);
  }

  // 并行获取每个 publication 的 nav tree，从中提取一级目录节点
  const navTrees = await Promise.all(
    publications.map(async (pub) => {
      try {
        const navResult = await wikiApi.getNavTree(pub.id);
        return { pub, items: navResult.nav_tree?.items || [] };
      } catch {
        return { pub, items: [] as WikiNavTreeItem[] };
      }
    }),
  );

  // 从 nav tree 一级节点构建 header 导航项
  const homeLinks: { label: string; href: string }[] = [];
  // 从 nav tree 一级节点构建卡片数据（存储 Icon 组件引用，在 JSX 中渲染）
  const homeCards: {
    title: string;
    href: string;
    description: string;
    Icon: ComponentType;
  }[] = [];

  for (const { pub, items } of navTrees) {
    // 保留一级目录「Negentropy」不进右区内容标签 / 卡片：它由左侧保留标签 + 领衔卡片单独承载，
    // 避免「左侧保留标签」与「右区普通标签」双重出现。
    if (isReservedDocsSlug(pub.slug)) continue;
    if (items.length > 0) {
      // 有 nav tree 一级节点时，从中构建导航项
      for (const item of items) {
        const title = item.entry_title || item.entry_slug;
        const href = buildEntryHref(pub.slug, item);
        homeLinks.push({ label: title, href });
        homeCards.push({
          title,
          // 优先节点级描述（Catalog 节点 description）→ 回退 Publication 级描述 → 占位
          description: item.entry_description || pub.description || "暂无描述",
          href,
          Icon: getPublicationIcon(pub.name),
        });
      }
    } else {
      // nav tree 为空或 API 失败时，用 publication 自身作为兜底
      homeLinks.push({ label: pub.name, href: `/${pub.slug}` });
      homeCards.push({
        title: pub.name,
        href: `/${pub.slug}`,
        description: pub.description || "暂无描述",
        Icon: getPublicationIcon(pub.name),
      });
    }
  }

  // 保留一级目录领衔首页卡片（置于普通卡片之前），与左侧保留标签呼应。
  const reservedPub = publications.find((p) => isReservedDocsSlug(p.slug));
  if (reservedPub) {
    homeCards.unshift({
      title: RESERVED_DOCS_LABEL,
      href: RESERVED_DOCS_HOME,
      description: reservedPub.description || "熵减引擎设计概念与使用指引",
      Icon: getPublicationIcon(reservedPub.name),
    });
  }

  const firstHref = homeCards.length > 0 ? homeCards[0].href : undefined;

  // Knowledge Graph 标签指向首个**非保留** publication（保留 docs 目录无 KG）。
  const firstPubSlug = publications.find(
    (p) => !isReservedDocsSlug(p.slug),
  )?.slug;

  const header = (
    <WikiHeader
      homeLinks={homeLinks}
      headerSlot={<ThemePreference />}
      actions={<WikiHeaderActions />}
      pubSlug={firstPubSlug}
      reservedTab={
        reservedPub
          ? {
              show: true,
              active: false,
              label: RESERVED_DOCS_LABEL,
              href: RESERVED_DOCS_HOME,
            }
          : undefined
      }
      graphTab={
        firstPubSlug
          ? { show: true, active: false, label: "Knowledge Graph" }
          : undefined
      }
    />
  );

  // 移动端侧栏：保留目录领衔，其后接普通右区导航项。
  const mobileLinks = reservedPub
    ? [{ label: RESERVED_DOCS_LABEL, href: RESERVED_DOCS_HOME }, ...homeLinks]
    : homeLinks;

  const sidebar = (
    <div className="home-mobile-sidebar">
      {mobileLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="home-mobile-sidebar-link"
        >
          {link.label}
        </a>
      ))}
    </div>
  );

  return (
    <WikiLayoutShell
      variant="home"
      header={header}
      sidebar={sidebar}
      footer={<WikiFooter />}
    >
      <section className="home-hero">
        <GalaxyHeroMount />
        <div className="home-hero-content">
          <p className="home-hero-text">
            关注 AI Infra、Agent 工程化、信息学等领域前沿动态
          </p>
          <p className="home-hero-subtext">你我的相识绝非一场零和游戏！</p>
          {firstHref && (
            <a href={firstHref} className="home-hero-cta">
              Harness Engineering → 5min
            </a>
          )}
        </div>
      </section>

      <section className="home-cards-section">
        <div className="home-cards-grid">
          {homeCards.map((card, idx) => (
            <HomeCard
              key={`${card.href}:${idx}`}
              title={card.title}
              href={card.href}
              description={card.description}
              icon={<card.Icon />}
            />
          ))}
        </div>
      </section>
    </WikiLayoutShell>
  );
}
