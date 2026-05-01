"use client";

import { useEffect, useState } from "react";
import {
  type GraphEntityDetailResponse,
  fetchGraphEntityDetail,
} from "@/features/knowledge";

import { ENTITY_TYPE_COLORS } from "./constants";

interface EntityDetailPanelProps {
  corpusId: string;
  entityId: string | null;
}

export function EntityDetailPanel({
  corpusId,
  entityId,
}: EntityDetailPanelProps) {
  const [detail, setDetail] = useState<GraphEntityDetailResponse | null>(null);
  const [loadedEntityId, setLoadedEntityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"outgoing" | "incoming">(
    "outgoing",
  );

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetchGraphEntityDetail(corpusId, entityId)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setLoadedEntityId(entityId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setDetail(null);
          setLoadedEntityId(entityId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [corpusId, entityId]);

  const loading = entityId !== null && loadedEntityId !== entityId;
  const currentDetail = loadedEntityId === entityId ? detail : null;

  if (!entityId) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4 text-center">
        选择实体查看详情
      </p>
    );
  }

  if (loading) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4 text-center">
        加载中...
      </p>
    );
  }

  if (!currentDetail) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4 text-center">
        未找到实体
      </p>
    );
  }

  const outgoing = currentDetail.relations.filter((r) => r.direction === "outgoing");
  const incoming = currentDetail.relations.filter((r) => r.direction === "incoming");
  const activeRelations = activeTab === "outgoing" ? outgoing : incoming;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{
            backgroundColor:
              ENTITY_TYPE_COLORS[currentDetail.entity_type] ?? ENTITY_TYPE_COLORS.other,
          }}
        />
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {currentDetail.name}
        </span>
      </div>

      {/* Properties */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">类型</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {currentDetail.entity_type}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">置信度</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {currentDetail.confidence.toFixed(2)}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">提及次数</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {currentDetail.mention_count}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">状态</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {currentDetail.is_active ? "活跃" : "不活跃"}
        </span>
      </div>

      {currentDetail.description && (
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2 text-xs text-zinc-600 dark:text-zinc-400">
          {currentDetail.description}
        </div>
      )}

      {/* Relations */}
      <div>
        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab("outgoing")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium ${
              activeTab === "outgoing"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            出边 ({outgoing.length})
          </button>
          <button
            onClick={() => setActiveTab("incoming")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium ${
              activeTab === "incoming"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            入边 ({incoming.length})
          </button>
        </div>

        {activeRelations.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-3 text-center">
            暂无{activeTab === "outgoing" ? "出边" : "入边"}关系
          </p>
        ) : (
          <div className="space-y-1.5 mt-2">
            {activeRelations.map((rel) => (
              <div
                key={rel.id}
                className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {rel.relation_type}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {rel.confidence.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        ENTITY_TYPE_COLORS[rel.peer_entity_type] ??
                        ENTITY_TYPE_COLORS.other,
                    }}
                  />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {rel.peer_entity_name}
                  </span>
                </div>
                {rel.evidence_text && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2">
                    {rel.evidence_text}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
