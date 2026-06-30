"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type GraphEntityItem,
  fetchGraphEntities,
} from "@/features/knowledge";

import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList, type OffsetFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";

import { ENTITY_TYPE_COLORS, communityColor } from "./constants";

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_COLORS);

/** 实体列表每页条数（偏移分页粒度 + 无限滚动加载粒度 + 页码跳页粒度）。 */
const ENTITY_PAGE_SIZE = 30;

interface EntityListPanelProps {
  corpusId: string;
  onSelectEntity: (entityId: string) => void;
  selectedEntityId?: string | null;
}

/** 实体列表筛选状态（序列化进 useInfiniteList.filters，任一变化即 reset 回第 1 页）。 */
interface EntityFilters {
  entityType: string;
  search: string;
  sortBy: string;
}

export function EntityListPanel({
  corpusId,
  onSelectEntity,
  selectedEntityId,
}: EntityListPanelProps) {
  const [entityType, setEntityType] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // 无限滚动 + 翻页：滚动容器 ref（哨兵 / 滚动联动 observer 的 root）、程序化滚动闸门、待跳页号。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo<EntityFilters>(
    () => ({ entityType, search, sortBy }),
    [entityType, search, sortBy],
  );

  // 偏移分页适配器：薄包 fetchGraphEntities；响应 count 归一为 total。
  // corpusId 进 deps：切换语料库即 reset。
  const fetcher = useMemo<OffsetFetcher<GraphEntityItem, EntityFilters>>(
    () => ({
      kind: "offset",
      fetchRange: async ({ offset, limit, filters: f }) => {
        const data = await fetchGraphEntities(corpusId, {
          entity_type: f?.entityType || undefined,
          search: f?.search || undefined,
          sort_by: f?.sortBy || undefined,
          limit,
          offset,
        });
        return { items: data.items, total: data.count };
      },
    }),
    [corpusId],
  );

  const list = useInfiniteList<GraphEntityItem, EntityFilters>({
    fetcher,
    pageSize: ENTITY_PAGE_SIZE,
    filters,
    deps: [corpusId],
  });
  const entities = list.items;
  const total = list.total ?? 0;

  // 无限滚动哨兵：滚到底（提前 200px）→ 偏移补齐下一页。root = 列表内嵌滚动容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首行的 data-infinite-page 锚点，取最靠上可见页。
  useScrollPageSync({
    enabled: true,
    onPageChange: list.goToPage,
    root: scrollRootRef,
    rescanKey: entities.length,
    programmaticRef: programmaticScrollRef,
  });

  // 点页码跳页：先经 hook 确保该页已加载（偏移单请求补齐），再滚动到该页锚点。
  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动（偏移补齐后，锚点随 entities 增长后再现 → effect 重跑命中）。
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = scrollRootRef.current?.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [list.currentPage, entities.length]);

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索实体..."
          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none"
        />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
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
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground"
        >
          <option value="">按提及数</option>
          <option value="importance">按重要性</option>
        </select>
      </div>

      {/* Table — 内嵌滚动容器同时作为无限滚动哨兵 / 滚动联动 observer 的 root。 */}
      <div ref={scrollRootRef} className="max-h-[420px] overflow-y-auto">
        {list.loading && entities.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">
            加载中...
          </p>
        ) : entities.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">
            暂无实体数据
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-2 text-left font-medium text-text-muted">
                    名称
                  </th>
                  <th className="py-2 px-2 text-left font-medium text-text-muted">
                    类型
                  </th>
                  <th className="py-2 px-2 text-left font-medium text-text-muted">
                    社区
                  </th>
                  <th className="py-2 px-2 text-right font-medium text-text-muted">
                    置信度
                  </th>
                  <th className="py-2 px-2 text-right font-medium text-text-muted">
                    提及
                  </th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity, i) => (
                  <tr
                    key={entity.id}
                    data-infinite-page={
                      i % ENTITY_PAGE_SIZE === 0 ? Math.floor(i / ENTITY_PAGE_SIZE) + 1 : undefined
                    }
                    onClick={() => onSelectEntity(entity.id)}
                    className={`cursor-pointer border-b border-border hover:bg-muted ${
                      selectedEntityId === entity.id
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                  >
                    <td className="py-2 px-2 text-foreground font-medium">
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
                        <span className="text-text-secondary">
                          {entity.entity_type}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {entity.community_id != null ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: communityColor(entity.community_id) }}
                          />
                          <span className="text-text-secondary">
                            C-{entity.community_id}
                          </span>
                        </span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-text-secondary">
                      {entity.confidence.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-text-secondary">
                      {entity.mention_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 无限滚动哨兵：进入视口即追加下一页（hasMore 为否时 hook 自动停观察）。 */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>

      {/* 居中翻页控件（页总数 + 控件组居中成组），与无限滚动并存。 */}
      {total > 0 && (
        <Pagination
          page={list.currentPage}
          totalPages={list.totalPages}
          onPageChange={handleGoToPage}
          total={total}
          itemLabel="entity"
          disabled={list.loading}
          loadingMore={list.loadingMore}
        />
      )}
    </div>
  );
}
