/**
 * 表格视觉令牌 —— 全局向 Routine / Scheduler 参考表格对齐（纯 Tailwind，无第三方依赖）。
 *
 * 设计参考：[[RoutineTable]] / [[SchedulerTaskTable]]（手写 `<table>` 黄金标准）。
 * 关键收敛点（与 AGENTS.md「UI Table 设计规范」一致）：
 *  - 容器 `rounded-xl`（非 2xl）、无投影，收束整体；
 *  - 表头弱化为小号大写眼纹（text-xs + uppercase + tracking）、**无背景填充**（透出 card 底）；
 *  - 行分隔线柔和（border/60）、统一 hover 反馈。
 *
 * 仅承载「视觉」类名;布局类（grid/flex/col-span 等）由各调用方组合，
 * 避免强抽象一个跨页通用的 DataTable 组件（两处表格的行内交互差异较大）。
 */

/** 表格外层容器：圆角 + 边框 + 卡片底（对齐参考表，去投影）。 */
export const tableContainerClassName =
  "overflow-hidden rounded-xl border border-border bg-card";

/** 表头行视觉（不含布局；调用方再组合 grid/flex）。 */
export const tableHeaderClassName =
  "border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-overline text-text-secondary";

/** 表体：柔和的横向行分隔线（与参考表 border-border/60 一致）。 */
export const tableBodyClassName = "divide-y divide-border/60";

/** 数据行视觉（不含布局/grid）：统一内边距与 hover 反馈。 */
export const tableRowClassName = "px-4 py-3 transition-colors hover:bg-muted/40";
