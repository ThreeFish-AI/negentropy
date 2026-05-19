"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePaperStore, useUIStore } from "@/store";
import PaperViewer from "@/components/papers/PaperViewer";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const { currentPaper, fetchPaper, updatePaper } = usePaperStore();
  const { addNotification } = useUIStore();

  const [isLoading, setIsLoading] = useState(true);

  // Fetch paper details
  useEffect(() => {
    if (paperId) {
      fetchPaper(paperId).finally(() => setIsLoading(false));
    }
  }, [paperId, fetchPaper]);

  // Handle back navigation
  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-64 rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    );
  }

  if (!currentPaper) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            论文不存在
          </h1>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            找不到指定的论文，可能已被删除或链接有误
          </p>
          <Link
            href="/papers"
            className="inline-flex items-center rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            返回论文列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-8 flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          <li>
            <Link
              href="/papers"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              论文管理
            </Link>
          </li>
          <li>
            <span className="text-gray-300 dark:text-gray-600">/</span>
          </li>
          <li>
            <span className="max-w-xs truncate text-gray-700 dark:text-gray-300">
              {currentPaper.translation?.title || currentPaper.title}
            </span>
          </li>
        </ol>
      </nav>

      {/* Action Buttons */}
      <div className="mb-6 flex items-center space-x-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          返回
        </button>

        {currentPaper.filePath && (
          <a
            href={currentPaper.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
              />
            </svg>
            下载原文
          </a>
        )}
      </div>

      {/* Paper Viewer */}
      <PaperViewer paper={currentPaper} />

      {/* Quick Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              最后更新:{" "}
              {format(new Date(currentPaper.updatedAt), "yyyy-MM-dd HH:mm", {
                locale: zhCN,
              })}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {!currentPaper.translation &&
              currentPaper.status !== "processing" && (
                <button
                  onClick={() => {
                    // This would trigger translation
                    updatePaper(currentPaper.id, { status: "processing" });
                    addNotification({
                      type: "info",
                      title: "翻译已启动",
                      message: "论文正在翻译中，请稍候...",
                      duration: 5000,
                    });
                  }}
                  className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
                >
                  翻译论文
                </button>
              )}

            {!currentPaper.analysis && currentPaper.status !== "processing" && (
              <button
                onClick={() => {
                  // This would trigger analysis
                  updatePaper(currentPaper.id, { status: "processing" });
                  addNotification({
                    type: "info",
                    title: "分析已启动",
                    message: "论文正在分析中，请稍候...",
                    duration: 5000,
                  });
                }}
                className="rounded bg-purple-500 px-3 py-1.5 text-sm text-white hover:bg-purple-600"
              >
                分析论文
              </button>
            )}

            <Link
              href={`/search?q=${encodeURIComponent(currentPaper.title)}`}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              查找相关论文
            </Link>
          </div>
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-20"></div>
    </div>
  );
}
