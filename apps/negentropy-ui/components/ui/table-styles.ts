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

/** 表头行视觉（不含布局；调用方再组合 grid/flex）。
 *  `whitespace-nowrap` 落实「列名禁止折行」（UI 表格设计规范第 3 条）——配合 table-fixed + colgroup
 *  固定列宽，多词表头（如 "Best Score"/"巡检状态"）在窄视口下亦强制单行。 */
export const tableHeaderClassName =
  "whitespace-nowrap border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-overline text-text-secondary";

/** 表体：柔和的横向行分隔线（与参考表 border-border/60 一致）。 */
export const tableBodyClassName = "divide-y divide-border/60";

/** 数据行视觉（不含布局/grid）：统一内边距与 hover 反馈。 */
export const tableRowClassName = "px-4 py-3 transition-colors hover:bg-muted/40";

/**
 * 语义列宽注册表 —— 「相同属性列采用相同固定列宽」（UI 表格设计规范第 2 条）的单一事实源。
 *
 * **适用范围（保守）**：仅用于新表与 [[TABLE_COL_WIDTHS]] 首次落地的违规表转换
 * （`app/knowledge/base/page.tsx` 语料表）。**不**回溯重写既有 9 个合规表的 `<colgroup>` ——
 * 各表列数不同（Routine 8 / Scheduler 10 / Documents 11），其百分比已各自合 100，
 * 强制对齐会引发可见的列宽回退（纯 churn，需逐表视觉 sign-off，宜另开 follow-up）。
 *
 * 消费方式：`<colgroup><col className={TABLE_COL_WIDTHS.name} /> …</colgroup>`
 * （注意：`<colgroup>` 内禁止行内 JSX 注释，否则其内部的星斜杠序列会触发 hydration 报错 —— 见 SchedulerTaskTable 先例）。
 */
export const TABLE_COL_WIDTHS = {
  /** 行选择勾选框列（固定窄宽）。 */
  select: "w-10",
  /** 主标识列（名称/标题）。 */
  name: "w-[18%]",
  /** ID / key 列（含复制按钮）。 */
  id: "w-[13%]",
  /** 状态列（状态芯片）。 */
  status: "w-[13%]",
  /** 描述 / 摘要列。 */
  description: "w-[18%]",
  /** 类型列（handler/trigger/source 等短枚举）。 */
  kind: "w-[10%]",
  /** 时间列（created/updated/last/next）。 */
  time: "w-[8%]",
  /** 数值指标列（progress/score/cost/size）。 */
  metric: "w-[7%]",
  /** 操作列（单行按钮，必要时溢出菜单）。 */
  actions: "w-[17%]",
} as const;

export type TableColKey = keyof typeof TABLE_COL_WIDTHS;
