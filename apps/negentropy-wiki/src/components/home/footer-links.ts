export interface FooterLinkGroup {
  title: string;
  links: { label: string; href: string }[];
}

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: "知行",
    links: [
      { label: "数智通识", href: "/#shuzhi-tongshi" },
      { label: "算法通解", href: "/#suanfa-tongjie" },
      { label: "计算通践", href: "/#jisuan-tongjian" },
      { label: "知见通感", href: "/#zhijian-tonggan" },
    ],
  },
  {
    title: "智践",
    links: [
      { label: "Agent 工程化", href: "/#ai-application" },
      { label: "AI Infra", href: "/#ai-infra" },
      { label: "AIGC", href: "/#aigc" },
    ],
  },
  {
    title: "链接",
    links: [
      { label: "GitHub", href: "https://github.com/ThreeFish-AI/negentropy" },
      { label: "Changelog", href: "/#changelog" },
    ],
  },
];
