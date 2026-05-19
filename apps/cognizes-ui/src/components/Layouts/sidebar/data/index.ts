import * as Icons from "../icons";

export const NAV_DATA = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "仪表板",
        icon: Icons.HomeIcon,
        items: [
          {
            title: "概览",
            url: "/",
          },
        ],
      },
      {
        title: "论文管理",
        url: "/papers",
        icon: Icons.Alphabet,
        items: [],
      },
      {
        title: "任务监控",
        url: "/tasks",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "搜索",
        url: "/search",
        icon: Icons.SearchIcon,
        items: [],
      },
    ],
  },
];
