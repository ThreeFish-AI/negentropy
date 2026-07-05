import type { LucideIcon } from "lucide-react";

/**
 * 以 prop 形式渲染 Lucide 图标组件。
 *
 * 注册表函数（``detailIcon`` / ``eventTypeIcon``）在 render 期返回组件引用，直接
 * ``const Icon = fn(); <Icon/>`` 会触发 ``react-hooks/static-components`` 误报；
 * 经此包装以组件 prop 渲染即可规避。
 */
export function LucideGlyph({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon className={className} aria-hidden />;
}
