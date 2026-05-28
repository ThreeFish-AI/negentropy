import { unstable_noStore as noStore } from "next/cache";

import { wikiApi, type WikiPublication } from "@/lib/wiki-api";
import { WikiHeader } from "@/components/WikiHeader";
import { WikiLayoutShell } from "@/components/WikiLayoutShell";
import { ThemePreference } from "@/components/ThemePreference";
import { WikiSearchBox } from "@/components/WikiSearchBox";
import { WikiHeaderActions } from "@/components/WikiHeaderActions";
import { HomeCard } from "@/components/home/HomeCard";
import { WikiFooter } from "@/components/home/WikiFooter";
import { getPublicationIcon } from "@/components/home/CardIcons";

// ISR: 5 分钟增量再验证
export const revalidate = 300;

export default async function WikiHomePage() {
  let publications: WikiPublication[] = [];

  try {
    const result = await wikiApi.listPublications();
    publications = result.items;
  } catch (err) {
    noStore();
    console.warn(
      "[Wiki ISR] Failed to fetch publications (degraded to per-request SSR; will rebuild ISR on next success):",
      err,
    );
  }

  const homeLinks = publications.map((p) => ({
    label: p.name,
    href: `/${p.slug}`,
  }));

  const firstPubSlug = publications.length > 0 ? `/${publications[0].slug}` : undefined;

  const header = (
    <WikiHeader
      homeLinks={homeLinks}
      headerSlot={<ThemePreference />}
      searchBox={<WikiSearchBox />}
      actions={<WikiHeaderActions />}
    />
  );

  const sidebar = (
    <div className="home-mobile-sidebar">
      {publications.map((p) => (
        <a key={p.slug} href={`/${p.slug}`} className="home-mobile-sidebar-link">
          {p.name}
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
        <div className="home-hero-bg" aria-hidden="true" />
        <div className="home-hero-content">
          <p className="home-hero-text">
            关注 AI Infra、Agent 工程化、信息论等领域前沿动态
          </p>
          <p className="home-hero-subtext">
            你我的相识绝非一场零和游戏！
          </p>
          {firstPubSlug && (
            <a href={firstPubSlug} className="home-hero-cta">
              Harness Engineering → 5min
            </a>
          )}
        </div>
      </section>

      <section className="home-cards-section">
        <div className="home-cards-grid">
          {publications.map((pub) => {
            const Icon = getPublicationIcon(pub.name);
            return (
              <HomeCard
                key={pub.id}
                publication={pub}
                icon={<Icon />}
              />
            );
          })}
        </div>
      </section>
    </WikiLayoutShell>
  );
}
