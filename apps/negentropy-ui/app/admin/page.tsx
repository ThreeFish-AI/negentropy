"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface UserItem {
  userId: string;
  email?: string;
  name?: string;
  roles: string[];
  lastLoginAt?: string;
}

const AVAILABLE_ROLES = ["admin", "user"] as const;

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/admin/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleToggle = async (
    userId: string,
    role: string,
    hasRole: boolean,
  ) => {
    const targetUser = users.find((u) => u.userId === userId);
    if (!targetUser) return;

    const newRoles = hasRole
      ? targetUser.roles.filter((r) => r !== role)
      : [...targetUser.roles, role];

    // Ensure at least one role
    if (newRoles.length === 0) {
      newRoles.push("user");
    }

    try {
      setUpdatingUser(userId);
      const response = await fetch(
        `/api/auth/users/${encodeURIComponent(userId)}/roles`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles: newRoles }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update roles");
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, roles: newRoles } : u)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdatingUser(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Admin Console</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage users and permissions
          </p>
        </div>

        {/* Current User Info */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Current User
          </div>
          <div className="flex items-center gap-3">
            {user?.picture && (
              <img
                src={user.picture}
                alt=""
                className="h-10 w-10 rounded-full"
              />
            )}
            <div>
              <div className="font-medium text-zinc-900">{user?.name}</div>
              <div className="text-sm text-zinc-500">{user?.email}</div>
            </div>
            <div className="ml-auto flex gap-1">
              {user?.roles?.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3 bg-zinc-50">
            <h2 className="text-sm font-semibold text-zinc-900">
              User Management
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Loading users...
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={fetchUsers}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              No users found
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {users.map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 truncate">
                      {u.name || u.userId}
                    </div>
                    {u.email && (
                      <div className="text-xs text-zinc-500 truncate">
                        {u.email}
                      </div>
                    )}
                  </div>

                  {/* Role Toggles */}
                  <div className="flex items-center gap-2">
                    {AVAILABLE_ROLES.map((role) => {
                      const hasRole = u.roles.includes(role);
                      const isUpdating = updatingUser === u.userId;

                      return (
                        <button
                          key={role}
                          onClick={() =>
                            handleRoleToggle(u.userId, role, hasRole)
                          }
                          disabled={isUpdating}
                          className={`
                            px-3 py-1 rounded-full text-xs font-medium transition-all
                            ${
                              hasRole
                                ? role === "admin"
                                  ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                                  : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-zinc-100 text-zinc-400"
                            }
                            ${isUpdating ? "opacity-50 cursor-wait" : "hover:opacity-80"}
                          `}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions Info */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <div className="border-b border-zinc-200 px-4 py-3 bg-zinc-50">
            <h2 className="text-sm font-semibold text-zinc-900">
              Role Permissions
            </h2>
          </div>
          <div className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    admin
                  </span>
                </div>
                <ul className="text-xs text-zinc-600 space-y-1">
                  <li>• Full system access</li>
                  <li>• User management</li>
                  <li>• Role assignment</li>
                  <li>• System configuration</li>
                </ul>
              </div>
              <div className="rounded-lg border border-zinc-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    user
                  </span>
                </div>
                <ul className="text-xs text-zinc-600 space-y-1">
                  <li>• Chat with agent</li>
                  <li>• View knowledge base</li>
                  <li>• Access memory</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
