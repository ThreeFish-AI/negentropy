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
