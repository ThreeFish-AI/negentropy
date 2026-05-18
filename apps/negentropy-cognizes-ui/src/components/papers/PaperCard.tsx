"use client";

import { usePaperStore, useUIStore } from "@/store";
import type { Paper } from "@/types";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";
import { useState } from "react";

interface PaperCardProps {
  paper: Paper;
  onSelect?: (id: string) => void;
  onProcess?: (id: string, workflow: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

const statusColors = {
  uploaded: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  translated:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  analyzed:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  deleted: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const statusLabels = {
  uploaded: "已上传",
  processing: "处理中",
  translated: "已翻译",
  analyzed: "已分析",
  failed: "失败",
  deleted: "已删除",
};

const categoryLabels = {
  "llm-agents": "LLM Agents",
  "context-engineering": "Context Engineering",
  reasoning: "Reasoning",
  "tool-use": "Tool Use",
  planning: "Planning",
  memory: "Memory",
  "multi-agent": "Multi-Agent",
  evaluation: "Evaluation",
  other: "其他",
};

export function PaperCard({
  paper,
  onSelect,
  onProcess,
  onDelete,
  className = "",
}: PaperCardProps) {
  const { selectedPapers, togglePaperSelection } = usePaperStore();
  const { addNotification } = useUIStore();

  const handleSelect = () => {
    togglePaperSelection(paper.id);
    onSelect?.(paper.id);
  };

  const handleProcess = (workflow: string) => {
    if (paper.status === "processing") {
      addNotification({
        type: "warning",
        title: "提示",
        message: "该论文正在处理中，请等待完成",
        duration: 3000,
      });
      return;
    }
    onProcess?.(paper.id, workflow);
  };

  const handleDelete = () => {
    if (paper.status === "processing") {
      addNotification({
        type: "error",
        title: "无法删除",
        message: "论文正在处理中，无法删除",
        duration: 3000,
      });
      return;
    }
    if (window.confirm("确定要删除这篇论文吗？此操作不可恢复。")) {
      onDelete?.(paper.id);
    }
  };

  const isSelected = selectedPapers.includes(paper.id);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      role="article"
      data-testid="paper-card"
      className={`rounded-lg border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:bg-gray-800 ${isSelected ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800" : "border-gray-200 dark:border-gray-700"} ${className} `}
    >
      {/* Header */}
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          {/* Checkbox */}
          <div className="flex flex-1 items-start space-x-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleSelect}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
            <div className="min-w-0 flex-1">
              {/* Title */}
              <Link
                href={`/papers/${paper.id}`}
                className="line-clamp-2 text-lg font-semibold text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
              >
                {paper.translation?.title || paper.title}
              </Link>

              {/* Authors */}
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {paper.authors.slice(0, 3).join(", ")}
                {paper.authors.length > 3 &&
                  ` 等 ${paper.authors.length} 位作者`}
              </p>

              {/* Category and Status */}
              <div className="mt-3 flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {categoryLabels[paper.category]}
                </span>
                <span
                  data-testid="paper-status"
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[paper.status]} `}
                >
                  {statusLabels[paper.status]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Abstract */}
        {(paper.abstract || paper.translation?.abstract) && (
          <p className="mt-4 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
            {paper.translation?.abstract || paper.abstract}
          </p>
        )}

        {/* Metadata */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center space-x-4">
            <span>{(paper.fileSize / 1024 / 1024).toFixed(2)} MB</span>
            {paper.metadata?.year && <span>{paper.metadata.year}</span>}
            {paper.metadata?.journal && <span>{paper.metadata.journal}</span>}
          </div>
          <div className="flex items-center space-x-1">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {(() => {
                try {
                  return format(
                    new Date(paper.uploadedAt),
                    "yyyy-MM-dd HH:mm",
                    {
                      locale: zhCN,
                    },
                  );
                } catch (e) {
                  return "无效日期";
                }
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* View Button */}
            <Link
              href={`/papers/${paper.id}`}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <svg
                className="mr-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              查看
            </Link>

            {/* Process Button */}
            {paper.status !== "processing" && paper.status !== "deleted" && (
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  data-testid="process-dialog"
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  <svg
                    className="mr-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  处理
                </button>

                {/* Process Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute left-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
                    <div className="py-1">
                      {!paper.translation && (
                        <button
                          role="menuitem"
                          onClick={() => {
                            handleProcess("translate");
                            setIsMenuOpen(false);
                          }}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          翻译
                        </button>
                      )}
                      {!paper.analysis && (
                        <button
                          role="menuitem"
                          onClick={() => {
                            handleProcess("analyze");
                            setIsMenuOpen(false);
                          }}
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          分析
                        </button>
                      )}
                      <button
                        role="menuitem"
                        onClick={() => {
                          handleProcess("index");
                          setIsMenuOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        建立索引
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete Button */}
          {paper.status !== "deleted" && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <svg
                className="mr-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaperCard;
