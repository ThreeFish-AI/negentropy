/**
 * 表格视觉令牌 —— 向 HeroUI Table 风格对齐（纯 Tailwind 实现，无第三方依赖）。
 *
 * 设计参考：https://beta.heroui.com/docs/components/table
 * 关键收敛点：
 *  - 去除类 Excel 的竖向分隔线（`border-r`），HeroUI 表格无竖线，观感差异最大；
 *  - 弱化表头为小号大写眼纹（uppercase + tracking），降低视觉权重；
 *  - 行分隔线柔和、统一 hover 反馈；圆角容器收束整体。
 *
 * 仅承载「视觉」类名;布局类（grid/flex/col-span 等）由各调用方组合，
 * 避免强抽象一个跨页通用的 DataTable 组件（两处表格的行内交互差异较大）。
 */

/** 表格外层容器：圆角 + 边框 + 卡片底 + 轻投影。 */
export const tableContainerClassName =
  "overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/** 表头行视觉（不含布局；调用方再组合 grid/flex）。 */
export const tableHeaderClassName =
  "border-b border-border bg-muted/40 px-4 py-3 text-caption font-medium uppercase tracking-overline text-text-muted";

/** 表体：柔和的横向行分隔线。 */
export const tableBodyClassName = "divide-y divide-border";

/** 数据行视觉（不含布局/grid）：统一内边距与 hover 反馈。 */
export const tableRowClassName = "px-4 py-3 transition-colors hover:bg-muted/40";
