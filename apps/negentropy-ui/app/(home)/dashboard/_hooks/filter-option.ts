/**
 * Dashboard 过滤栏统一选项类型。
 *
 * 为什么独立成文件而不挂在 hook 内：
 * - ``FilterBar`` 与 ``useDashboardAgentOptions`` / ``useDashboardOwnerOptions`` 都
 *   依赖该类型；若挂在某个 hook 内，FilterBar 与另一个 hook 都需跨 hook import，
 *   形成隐式横向依赖。
 * - 独立类型文件让 SSOT 落在「contract」而非「某个 producer」上。
 */

export interface FilterOption {
  /** 实际提交到 API 的过滤值（如 SubAgent UUID 或 user_id 字符串）。 */
  value: string;
  /** UI 展示文本（display_name / name / email 等可读字段）。 */
  label: string;
}
