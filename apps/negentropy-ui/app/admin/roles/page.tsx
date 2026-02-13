"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/ui/AdminNav";

type RoleMap = Record<string, string[]>;
type PermissionMap = Record<string, string>;

type AreaMeta = {
  key: string;
  label: string;
  description?: string;
  href?: string;
};

const AREA_META: Record<string, Omit<AreaMeta, "key">> = {
  admin: {
    label: "Admin Console",
    description: "System settings and administrative views",
    href: "/admin",
  },
  users: {
    label: "User Management",
    description: "User list and role assignment",
    href: "/admin",
  },
  knowledge: {
    label: "Knowledge",
    description: "Knowledge base and pipelines",
    href: "/knowledge",
  },
  memory: {
    label: "Memory",
    description: "Memory dashboards and audit",
    href: "/memory",
  },
  chat: {
    label: "Chat",
    description: "Agent conversations",
    href: "/",
  },
};

const TOGGLE_STYLES = {
  read: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700",
  write: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700",
};

const sortUnique = (list: string[]) =>
  Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));

const isSameList = (left: string[] = [], right: string[] = []) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const expandRolePermissions = (
  patterns: string[],
  permissionKeys: string[],
) => {
  const expanded = new Set<string>();
  patterns.forEach((pattern) => {
    if (pattern === "*") {
      permissionKeys.forEach((key) => expanded.add(key));
      return;
    }
    if (pattern.endsWith(":*")) {
      const prefix = pattern.slice(0, -1);
      permissionKeys.forEach((key) => {
        if (key.startsWith(prefix)) {
          expanded.add(key);
        }
      });
      return;
    }
    if (permissionKeys.includes(pattern)) {
      expanded.add(pattern);
    }
  });
  return sortUnique(Array.from(expanded));
};

const cloneRoleMap = (roleMap: RoleMap): RoleMap =>
  Object.fromEntries(
    Object.entries(roleMap).map(([role, permissions]) => [
      role,
      [...permissions],
    ]),
  );

function PermissionToggle({
  active,
  disabled,
  label,
  tone,
  title,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  tone: "read" | "write";
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
        active ? TOGGLE_STYLES[tone] : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"}`}
    >
      {label}
    </button>
  );
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleMap | null>(null);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [draft, setDraft] = useState<RoleMap>({});
  const [baseline, setBaseline] = useState<RoleMap>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const permissionKeys = useMemo(
    () => (permissions ? sortUnique(Object.keys(permissions)) : []),
    [permissions],
  );

  const areas = useMemo<AreaMeta[]>(() => {
    if (!permissions) return [];
    const areaKeys = new Set<string>();
    Object.keys(permissions).forEach((key) => {
      const [area] = key.split(":");
      if (area) {
        areaKeys.add(area);
      }
    });
    return Array.from(areaKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({
        key,
        ...(AREA_META[key] || {
          label: key,
          description: "Custom module",
        }),
      }));
  }, [permissions]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        fetch("/api/auth/admin/roles", { cache: "no-store" }),
        fetch("/api/auth/admin/permissions", { cache: "no-store" }),
      ]);

      if (!rolesResponse.ok) {
        throw new Error("Failed to fetch roles");
      }
      if (!permissionsResponse.ok) {
        throw new Error("Failed to fetch permissions");
      }

      const rolesPayload = (await rolesResponse.json()) as { roles: RoleMap };
      const permissionsPayload = (await permissionsResponse.json()) as {
        permissions: PermissionMap;
      };

      const roleMap = rolesPayload.roles || {};
      const permissionMap = permissionsPayload.permissions || {};
      const expandedRoles: RoleMap = {};
      const keys = sortUnique(Object.keys(permissionMap));

      Object.entries(roleMap).forEach(([role, patterns]) => {
        expandedRoles[role] = expandRolePermissions(patterns, keys);
      });

      setRoles(roleMap);
      setPermissions(permissionMap);
      setDraft(cloneRoleMap(expandedRoles));
      setBaseline(cloneRoleMap(expandedRoles));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roleNames = useMemo(
    () => (roles ? Object.keys(roles).sort((a, b) => a.localeCompare(b)) : []),
    [roles],
  );

  const isRoleDirty = useCallback(
    (role: string) => !isSameList(draft[role], baseline[role]),
    [draft, baseline],
  );

  const hasDirty = useMemo(
    () => roleNames.some((role) => isRoleDirty(role)),
    [roleNames, isRoleDirty],
  );

  const togglePermission = (role: string, permission: string) => {
    setDraft((prev) => {
      const current = new Set(prev[role] || []);
      if (current.has(permission)) {
        current.delete(permission);
      } else {
        current.add(permission);
      }
      return {
        ...prev,
        [role]: sortUnique(Array.from(current)),
      };
    });
  };

  const resetRole = (role: string) => {
    setDraft((prev) => ({
      ...prev,
      [role]: baseline[role] ? [...baseline[role]] : [],
    }));
  };

  const resetAll = () => {
    setDraft(cloneRoleMap(baseline));
  };

  const exportSnapshot = useMemo(
    () => JSON.stringify({ roles: draft }, null, 2),
    [draft],
  );

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <AdminNav
        title="Role Management"
        description="Bind roles to page-level read/write permissions"
      />
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            Role bindings are sourced from the server RBAC configuration. This
            page edits a local draft and does not persist changes yet.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={load}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            {hasDirty && (
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              >
                Reset All
              </button>
            )}
            <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
              {roleNames.length} roles · {permissionKeys.length} permissions
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Loading role bindings...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              <div className="font-semibold">Failed to load RBAC data</div>
              <div className="mt-2">{error}</div>
            </div>
          ) : roleNames.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No roles available.
            </div>
          ) : (
            <div className="space-y-4">
              {roleNames.map((role) => {
                const patterns = roles?.[role] || [];
                const enabledCount = draft[role]?.length || 0;
                const totalCount = permissionKeys.length;
                const dirty = isRoleDirty(role);

                return (
                  <div
                    key={role}
                    className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {role}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {patterns.length > 0
                            ? patterns.join(" · ")
                            : "No permission patterns"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          {enabledCount}/{totalCount} enabled
                        </span>
                        {dirty && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Draft
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => resetRole(role)}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 transition-colors dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                          disabled={!dirty}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                      {areas.map((area) => {
                        const readKey = `${area.key}:read`;
                        const writeKey = `${area.key}:write`;
                        const hasRead = permissionKeys.includes(readKey);
                        const hasWrite = permissionKeys.includes(writeKey);
                        const readTitle = permissions?.[readKey];
                        const writeTitle = permissions?.[writeKey];
                        const readActive = draft[role]?.includes(readKey) ?? false;
                        const writeActive =
                          draft[role]?.includes(writeKey) ?? false;

                        return (
                          <div
                            key={area.key}
                            className="grid grid-cols-[minmax(180px,1fr)_auto_auto] items-center gap-4 px-4 py-3"
                          >
                            <div>
                              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {area.href ? (
                                  <Link
                                    href={area.href}
                                    className="hover:underline"
                                  >
                                    {area.label}
                                  </Link>
                                ) : (
                                  area.label
                                )}
                              </div>
                              {area.description && (
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {area.description}
                                </div>
                              )}
                            </div>
                            {hasRead ? (
                              <PermissionToggle
                                active={readActive}
                                disabled={!hasRead}
                                label="Read"
                                tone="read"
                                title={readTitle}
                                onClick={() =>
                                  togglePermission(role, readKey)
                                }
                              />
                            ) : (
                              <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                            )}
                            {hasWrite ? (
                              <PermissionToggle
                                active={writeActive}
                                disabled={!hasWrite}
                                label="Write"
                                tone="write"
                                title={writeTitle}
                                onClick={() =>
                                  togglePermission(role, writeKey)
                                }
                              />
                            ) : (
                              <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Export Draft Snapshot
            </summary>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 overflow-auto dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <pre>{exportSnapshot}</pre>
            </div>
          </details>
          </div>
        </div>
      </div>
    </div>
  );
}
