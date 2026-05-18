import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Task, Paper } from "@/types";

interface ActivityFeedProps {
  activities?: Array<{
    id: string;
    type:
      | "paper_uploaded"
      | "paper_translated"
      | "paper_analyzed"
      | "task_completed"
      | "task_failed";
    title: string;
    description: string;
    timestamp: string;
    entity?: Paper | Task;
  }>;
  maxItems?: number;
  className?: string;
}

const activityIcons = {
  paper_uploaded: (
    <svg
      className="h-5 w-5 text-blue-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  ),
  paper_translated: (
    <svg
      className="h-5 w-5 text-green-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
      />
    </svg>
  ),
  paper_analyzed: (
    <svg
      className="h-5 w-5 text-purple-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
  task_completed: (
    <svg
      className="h-5 w-5 text-green-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  task_failed: (
    <svg
      className="h-5 w-5 text-red-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

const activityLabels = {
  paper_uploaded: "论文上传",
  paper_translated: "翻译完成",
  paper_analyzed: "分析完成",
  task_completed: "任务完成",
  task_failed: "任务失败",
};

export function ActivityFeed({
  activities = [],
  maxItems = 10,
  className = "",
}: ActivityFeedProps) {
  // Mock activities for demonstration
  const mockActivities: typeof activities = [
    {
      id: "1",
      type: "paper_uploaded",
      title: "新论文上传",
      description: "Attention Is All You Need 已上传",
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: "2",
      type: "paper_translated",
      title: "翻译完成",
      description: "《GPT-4 Technical Report》翻译完成",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: "3",
      type: "task_completed",
      title: "批量处理完成",
      description: "5篇论文的分析任务已完成",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "4",
      type: "paper_analyzed",
      title: "分析完成",
      description: "《Chain-of-Thought Prompting》分析完成",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "5",
      type: "task_failed",
      title: "任务失败",
      description: "PDF解析任务失败，请检查文件格式",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const displayActivities = activities.length > 0 ? activities : mockActivities;
  const limitedActivities = displayActivities.slice(0, maxItems);

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return `${Math.floor(diffMins / 1440)}天前`;
  };

  return (
    <div className={`activity-feed ${className}`}>
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            最近活动
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {limitedActivities.map((activity) => (
            <div
              key={activity.id}
              className="p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {activityIcons[activity.type]}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {activity.title}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {activity.description}
                  </p>

                  {/* Action link if entity exists */}
                  {activity.entity && "id" in activity.entity && (
                    <div className="mt-2">
                      <Link
                        href={
                          (activity.entity as any)?.title
                            ? `/papers/${(activity.entity as any).id}`
                            : `/tasks/${(activity.entity as any).id}`
                        }
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        查看详情 →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {limitedActivities.length === 0 && (
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
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
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                暂无最近活动
              </p>
            </div>
          )}
        </div>

        {/* View all link */}
        {displayActivities.length > maxItems && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <Link
              href="/tasks"
              className="block text-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              查看所有活动
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
