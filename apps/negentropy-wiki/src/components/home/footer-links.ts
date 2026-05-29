export interface FooterLinkGroup {
  title: string;
  links: { label: string; href: string }[];
}

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: "知识体系",
    links: [
      { label: "数智通识", href: "/#shuzhi-tongshi" },
      { label: "算法通解", href: "/#suanfa-tongjie" },
      { label: "计算通践", href: "/#jisuan-tongjian" },
      { label: "知识通感", href: "/#zhishi-tonggan" },
    ],
  },
  {
    title: "场景应用",
    links: [
      { label: "AI 应用方向", href: "/#ai-application" },
      { label: "AI Infra", href: "/#ai-infra" },
      { label: "AIGC", href: "/#aigc" },
      { label: "深度学习", href: "/#deep-learning" },
    ],
  },
  {
    title: "资源",
    links: [
      { label: "GitHub", href: "https://github.com/ThreeFish-AI/negentropy" },
      { label: "更新日志", href: "/#changelog" },
    ],
  },
];
