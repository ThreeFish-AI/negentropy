/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type AuthUser, useAuth } from "@/components/providers/AuthProvider";

import type { FilterOption } from "./filter-option";

/**
 * Dashboard 过滤栏的 Owner 下拉选项数据源。
 *
 * 鉴权策略（与项目其它 14+ 处 ``user?.roles?.includes("admin")`` 范式一致）：
 * - **Admin**：``GET /api/auth/admin/users`` 取全量用户，label 走 name → email → userId 回退；
 * - **非 Admin**：仅返回当前用户自己一项，**不发起** admin 接口请求（避免线上 403 噪音）。
 *
 * Owner 下拉的 value（user_id 字符串）与后端 ``ScheduledTask.owner_id`` 过滤契约
 * 严格匹配（``apps/negentropy/src/negentropy/interface/scheduler_api.py:237``）。
 *
 * 失败兜底：admin 接口异常（5xx / 网络断）时回退到 selfOnly，UI 仍可用。
 */
interface UseDashboardOwnerOptionsResult {
  options: FilterOption[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

interface AdminUserItem {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  lastLoginAt?: string;
}

interface AdminUsersResponse {
  users?: AdminUserItem[];
}

function labelFor(item: {
  userId: string;
  name?: string | null;
  email?: string | null;
}): string {
  const name = item.name?.trim();
  if (name) return name;
  const email = item.email?.trim();
  if (email) return email;
  return item.userId;
}

function selfOnly(user: AuthUser | null): FilterOption[] {
  if (!user?.userId) return [];
  return [
    {
      value: user.userId,
      label: labelFor({
        userId: user.userId,
        name: user.name,
        email: user.email,
      }),
    },
  ];
}

export function useDashboardOwnerOptions(): UseDashboardOwnerOptionsResult {
  const { user, status } = useAuth();
  const isAdmin = Boolean(user?.roles?.includes("admin"));

  const [options, setOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    if (status !== "authenticated") {
      // 鉴权未就绪时不发起请求，等 AuthProvider 解析完毕再触发（依赖列表里有 status）。
      setLoading(status === "loading");
      setOptions([]);
      setError(null);
      return;
    }

    // 非 admin：仅自身可见，无需 admin 接口
    if (!isAdmin) {
      setOptions(selfOnly(user));
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const resp = await fetch("/api/auth/admin/users", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = (await resp.json()) as AdminUsersResponse;
      if (!mountedRef.current) return;
      const next: FilterOption[] = (body.users ?? [])
        .map((u) => ({
          value: u.userId,
          label: labelFor({ userId: u.userId, name: u.name, email: u.email }),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOptions(next);
    } catch (err) {
      if (!mountedRef.current) return;
      // admin 接口失败时回退到自身，保证 UI 仍可用
      setOptions(selfOnly(user));
      setError(err instanceof Error ? err.message : "加载用户列表失败");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isAdmin, status, user]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchOnce();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchOnce]);

  return { options, loading, error, reload: fetchOnce };
}
