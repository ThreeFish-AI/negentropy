"use client";

import { useEffect, useState } from "react";
import {
  type GraphEntityItem,
  fetchGraphEntities,
} from "@/features/knowledge";

import { ENTITY_TYPE_COLORS } from "./constants";

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_COLORS);

interface EntityListPanelProps {
  corpusId: string;
  onSelectEntity: (entityId: string) => void;
  selectedEntityId?: string | null;
}

export function EntityListPanel({
  corpusId,
  onSelectEntity,
  selectedEntityId,
}: EntityListPanelProps) {
  const [entities, setEntities] = useState<GraphEntityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [completedKey, setCompletedKey] = useState<string | null>(null);
  const limit = 30;

  const fetchKey = `${entityType}:${search}:${page}:${sortBy}`;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    fetchGraphEntities(corpusId, {
      entity_type: entityType || undefined,
      search: search || undefined,
      sort_by: sortBy || undefined,
      limit,
      offset: page * limit,
    })
      .then((data) => {
        if (!cancelled) {
          setEntities(data.items);
          setTotal(data.count);
          setCompletedKey(fetchKey);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setCompletedKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [corpusId, entityType, search, page, sortBy, fetchKey]);

  const loading = fetchKey !== completedKey;

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(0);
          }}
          placeholder="搜索实体..."
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">全部类型</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">按提及数</option>
          <option value="importance">按重要性</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
          加载中...
        </p>
      ) : entities.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-8">
          暂无实体数据
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 px-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  名称
                </th>
                <th className="py-2 px-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                  类型
                </th>
                <th className="py-2 px-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  置信度
                </th>
                <th className="py-2 px-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                  提及
                </th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr
                  key={entity.id}
                  onClick={() => onSelectEntity(entity.id)}
                  className={`cursor-pointer border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    selectedEntityId === entity.id
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : ""
                  }`}
                >
                  <td className="py-2 px-2 text-zinc-900 dark:text-zinc-100 font-medium">
                    {entity.name}
                  </td>
                  <td className="py-2 px-2">
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            ENTITY_TYPE_COLORS[entity.entity_type] ?? ENTITY_TYPE_COLORS.other,
                        }}
                      />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {entity.entity_type}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-400">
                    {entity.confidence.toFixed(2)}
                  </td>
                  <td className="py-2 px-2 text-right text-zinc-600 dark:text-zinc-400">
                    {entity.mention_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
          <span>
            {page * limit + 1}-{Math.min((page + 1) * limit, total)} / {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded px-2 py-1 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="rounded px-2 py-1 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
