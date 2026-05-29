/**
 * Wiki 知识图谱渲染器共享视觉模块（单一事实源）
 *
 * 五个 Wiki 渲染器（Sigma / 3D / d3-force / Force Graph / Cytoscape）此前各自
 * 逐字拷贝同一套实体配色 / 社区配色 / 取色逻辑与暗色探测，造成多处重复。本模块
 * 收敛这些「跨渲染器不变」的纯视觉策略：
 *   - `entityColor` / `communityColor` / `nodeColor`：与主站
 *     `apps/negentropy-ui/.../_components/constants.ts` 字段对齐；
 *   - `detectDark`：Wiki 统一通过 `data-color-scheme` 属性（而非 next-themes）
 *     探测暗色模式，与 ThemePreference 组件写入的属性一致。
 *
 * 注意：`nodeSize` 各渲染器系数不同（球体 / 圆点 / 节点宽高量纲各异），属于
 * 「随渲染器变化」的局部策略，故保留在各组件内部，不在此收敛。
 *
 * 与主站的关系：Wiki 为只读浏览视图，独立维护本模块以避免跨工程依赖
 * （两个 Next.js 应用无法互相 import 对方 `app/.../_components`）。
 */

/** 实体类型配色（与主站 ENTITY_TYPE_COLORS 对齐） */
export const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "#3B82F6",
  organization: "#10B981",
  location: "#F59E0B",
  event: "#EF4444",
  concept: "#8B5CF6",
  product: "#EC4899",
  document: "#6366F1",
  other: "#6B7280",
};

/** Tableau 10 — 色盲友好的社区配色 */
export const COMMUNITY_COLORS = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
];

/** 按实体类型取色（大小写不敏感；后端 entity_type 多为大写如 PERSON） */
export function entityColor(type?: string): string {
  const key = (type ?? "other").toLowerCase();
  return ENTITY_TYPE_COLORS[key] ?? ENTITY_TYPE_COLORS.other;
}

/** 按 Louvain 社区 ID 取色；缺失社区时回退中性灰 */
export function communityColor(communityId: number | null | undefined): string {
  if (communityId == null) return "#6B7280";
  return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
}

/**
 * 节点最终颜色：优先按社区着色，缺失社区时回退实体类型色。
 * 入参取节点的 `type` / `community_id` 字段子集，兼容所有渲染器的数据形态。
 */
export function nodeColor(node: {
  type?: string;
  community_id?: number | null;
}): string {
  if (node.community_id != null) return communityColor(node.community_id);
  return entityColor(node.type);
}

/**
 * 暗色模式探测（仅客户端可用）：读取 `document.documentElement` 的
 * `data-color-scheme`；未显式设置时回退系统偏好 `prefers-color-scheme`。
 * 与 `ThemePreference` 写入的属性、既有渲染器内联逻辑保持一致。
 */
export function detectDark(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const colorScheme = document.documentElement.getAttribute("data-color-scheme");
  return (
    colorScheme === "dark" ||
    (!colorScheme &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}
