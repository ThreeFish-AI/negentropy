"use client";

import React, { Suspense } from "react";
import DashboardStats from "@/components/analytics/DashboardStats";
import QuickActions from "@/components/analytics/QuickActions";
import ActivityFeed from "@/components/analytics/ActivityFeed";
import { useUIStore } from "@/store";
import UploadZone from "@/components/papers/UploadZone";

// Loading skeleton for dashboard stats
function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
            <div className="ml-4 flex-1">
              <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div className="h-8 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { modals, setModal } = useUIStore();

  return (
    <>
      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* Quick Actions */}
      <div className="mt-6">
        <QuickActions />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>

        {/* System Info */}
        <div className="space-y-6">
          {/* Quick Upload Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              快速上传
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              拖拽或选择文件快速上传论文
            </p>
            <button
              onClick={() => setModal("uploadPaper", true)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              选择文件
            </button>
          </div>

          {/* System Status */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              系统状态
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  API 服务
                </span>
                <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  正常
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  WebSocket
                </span>
                <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  已连接
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  数据库
                </span>
                <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  正常
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {modals.uploadPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-xl dark:bg-gray-800">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  上传论文
                </h2>
                <button
                  onClick={() => setModal("uploadPaper", false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <UploadZone />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
