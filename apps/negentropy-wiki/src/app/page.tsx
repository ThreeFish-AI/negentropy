import { unstable_noStore as noStore } from "next/cache";

import { wikiApi, type WikiPublication } from "@/lib/wiki-api";
import { WikiHomeNavbar } from "@/components/home/WikiHomeNavbar";
import { HomeCard } from "@/components/home/HomeCard";
import { WikiFooter } from "@/components/home/WikiFooter";
import { IconAI, IconAlgo, IconCompute, IconKnowledge } from "@/components/home/CardIcons";

// ISR: 5 分钟增量再验证
export const revalidate = 300;

interface CardSlot {
  label: string;
  Icon: React.ComponentType;
  fallbackDesc: string;
}

const CARD_SLOTS: CardSlot[] = [
  {
    label: "数智通识",
    Icon: IconAI,
    fallbackDesc: "人工智能、机器学习、深度学习、AIGC、AI Infra、AI 应用方向",
  },
  {
    label: "算法通解",
    Icon: IconAlgo,
    fallbackDesc: "算法与数据结构、LeetCode 题解、竞赛策略、经典范式",
  },
  {
    label: "计算通践",
    Icon: IconCompute,
    fallbackDesc: "系统设计、工程实践、DevOps、云原生、全栈开发",
  },
  {
    label: "知识通感",
    Icon: IconKnowledge,
    fallbackDesc: "跨学科通识、思维模型、读书笔记、行业观察",
  },
];

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

  const navTabs = CARD_SLOTS.map((slot) => {
    const pub = publications.find((p) => p.name === slot.label);
    return { label: slot.label, href: pub ? `/${pub.slug}` : "" };
  });

  const firstPubSlug = publications.length > 0 ? `/${publications[0].slug}` : undefined;

  return (
    <>
      <WikiHomeNavbar tabs={navTabs} />

      <main className="home-page">
        <section className="home-hero">
          <p className="home-hero-text">
            关注人工智能与互联网技术的前沿动态，工作学习提升、生活日常记录、兴趣知识分享
          </p>
          <p className="home-hero-subtext">
            你我的知识，绝非一场零和的游戏！
          </p>
          {firstPubSlug && (
            <a href={firstPubSlug} className="home-hero-cta">
              深度学习 | 引介 → 5min
            </a>
          )}
        </section>

        <section className="home-cards-section">
          <div className="home-cards-grid">
            {CARD_SLOTS.map((slot) => {
              const pub = publications.find((p) => p.name === slot.label);
              return (
                <HomeCard
                  key={slot.label}
                  href={pub ? `/${pub.slug}` : undefined}
                  icon={<slot.Icon />}
                  title={slot.label}
                  description={pub?.description ?? slot.fallbackDesc}
                />
              );
            })}
          </div>
        </section>
      </main>

      <WikiFooter />
    </>
  );
}
