import React from "react";
import Link from "next/link";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon: React.ReactNode;
  href?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  className?: string;
}

const colorClasses = {
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-600 dark:text-blue-400",
    icon: "text-blue-500",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900",
    text: "text-green-600 dark:text-green-400",
    icon: "text-green-500",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900",
    text: "text-yellow-600 dark:text-yellow-400",
    icon: "text-yellow-500",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900",
    text: "text-red-600 dark:text-red-400",
    icon: "text-red-500",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900",
    text: "text-purple-600 dark:text-purple-400",
    icon: "text-purple-500",
  },
};

export function StatsCard({
  title,
  value,
  change,
  icon,
  href,
  color = "blue",
  className = "",
}: StatsCardProps) {
  const colors = colorClasses[color];
  const CardContent = (
    <>
      <div className="flex items-center">
        <div className={`rounded-lg p-3 ${colors.bg}`}>{icon}</div>
        <div className="ml-4 w-0 flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {value}
          </p>
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center">
          <p
            className={`text-sm font-medium ${change.type === "increase" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} `}
          >
            {change.type === "increase" ? "+" : ""}
            {change.value}%
          </p>
          <p className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            较上周
          </p>
        </div>
      )}
    </>
  );

  const cardClass = `
    relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6
    hover:shadow-md transition-shadow duration-200
    ${href ? "cursor-pointer" : ""}
    ${className}
  `;

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {CardContent}
      </Link>
    );
  }

  return <div className={cardClass}>{CardContent}</div>;
}

// Predefined icon components
export const PaperIcon = ({ className }: { className?: string }) => (
  <svg
    className={`h-6 w-6 ${className}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

export const TaskIcon = ({ className }: { className?: string }) => (
  <svg
    className={`h-6 w-6 ${className}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

export const TranslatedIcon = ({ className }: { className?: string }) => (
  <svg
    className={`h-6 w-6 ${className}`}
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
);

export const ProcessingIcon = ({ className }: { className?: string }) => (
  <svg
    className={`h-6 w-6 ${className}`}
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
);

export default StatsCard;
