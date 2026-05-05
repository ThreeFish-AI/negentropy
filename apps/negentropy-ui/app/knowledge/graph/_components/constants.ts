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

export function entityColor(type?: string): string {
  return ENTITY_TYPE_COLORS[type ?? "other"] ?? ENTITY_TYPE_COLORS.other;
}

// Tableau 10 — 色盲友好的社区配色
const COMMUNITY_COLORS: string[] = [
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

export function communityColor(communityId: number | null | undefined): string {
  if (communityId == null) return "#6B7280";
  return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
}
