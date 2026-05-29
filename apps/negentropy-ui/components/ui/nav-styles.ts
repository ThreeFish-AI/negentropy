import { cn } from "@/lib/utils";

/**
 * 顶部主导航与各区二级导航的统一胶囊样式（Single Source of Truth）。
 *
 * 收敛 MainNav / HomeNav / KnowledgeNav / MemoryNav / InterfaceNav / AdminNav 六处
 * 重复的 pill 标记：统一轨道背景、激活反白、悬停浅底、焦点环、ease-out 过渡与
 * scale 按压反馈。各导航仅保留各自的 items 与路由/角色逻辑。
 */

/** 胶囊轨道容器（承载若干 pill 链接）。 */
export const navRailContainerClassName =
  "flex flex-wrap items-center gap-1 rounded-full bg-muted/50 p-1";

/** 单个胶囊链接样式。`active` 为当前路由命中态。 */
export function navPillClassName(active: boolean, className?: string): string {
  return cn(
    "rounded-full px-4 py-1 text-xs font-semibold outline-none transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97]",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
    active
      ? "bg-foreground text-background shadow-sm ring-1 ring-border"
      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
    className,
  );
}
