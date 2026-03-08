import type { CanonicalMessageRole } from "@/types/agui";
import type { RoleResolutionSource } from "@/types/common";

const PROTOCOL_AUTHOR_ROLE_MAP: Record<string, CanonicalMessageRole> = {
  user: "user",
  assistant: "assistant",
  agent: "assistant",
  model: "assistant",
  system: "system",
  developer: "developer",
  tool: "tool",
};

const ROLE_PRIORITY: Record<RoleResolutionSource, number> = {
  explicit_role: 5,
  snapshot_role: 4,
  protocol_author: 3,
  tool_inference: 2,
  fallback_assistant: 1,
};

export type RoleResolution = {
  resolvedRole: CanonicalMessageRole;
  resolutionSource: RoleResolutionSource;
};

function normalizeRawRole(
  value: string | undefined | null,
): CanonicalMessageRole | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "user") {
    return "user";
  }
  if (
    normalized === "assistant" ||
    normalized === "agent" ||
    normalized === "model"
  ) {
    return "assistant";
  }
  if (normalized === "system") {
    return "system";
  }
  if (normalized === "developer") {
    return "developer";
  }
  if (normalized === "tool") {
    return "tool";
  }
  return null;
}

export function resolveMessageRole(input: {
  explicitRole?: string | null;
  snapshotRole?: string | null;
  author?: string | null;
  hasToolCall?: boolean;
  hasToolResult?: boolean;
}): RoleResolution {
  const explicitRole = normalizeRawRole(input.explicitRole);
  if (explicitRole) {
    return {
      resolvedRole: explicitRole,
      resolutionSource: "explicit_role",
    };
  }

  const snapshotRole = normalizeRawRole(input.snapshotRole);
  if (snapshotRole) {
    return {
      resolvedRole: snapshotRole,
      resolutionSource: "snapshot_role",
    };
  }

  const protocolAuthorRole = input.author
    ? PROTOCOL_AUTHOR_ROLE_MAP[input.author.trim().toLowerCase()]
    : undefined;
  if (protocolAuthorRole) {
    return {
      resolvedRole: protocolAuthorRole,
      resolutionSource: "protocol_author",
    };
  }

  if (input.hasToolCall || input.hasToolResult) {
    return {
      resolvedRole: "assistant",
      resolutionSource: "tool_inference",
    };
  }

  return {
    resolvedRole: "assistant",
    resolutionSource: "fallback_assistant",
  };
}

export function shouldReplaceResolvedRole(
  current: RoleResolutionSource,
  incoming: RoleResolutionSource,
): boolean {
  return ROLE_PRIORITY[incoming] > ROLE_PRIORITY[current];
}
