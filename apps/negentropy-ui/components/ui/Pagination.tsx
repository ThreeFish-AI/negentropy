"use client";

/**
 * 通用分页控件（Reuse-Driven / Single Source of Truth）。
 *
 * 收敛此前各页（knowledge/documents、memory/facts 等）手搓的 Prev/Next 翻页：
 * 复用统一 [[Button]] 视觉与焦点环，数字页码 + 省略号紧凑展示，1-indexed 语义。
 * 纯展示 + 受控：页码状态由调用方持有，组件仅在边界内回调 onPageChange。
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  /** 当前页（1-indexed）。 */
  page: number;
  /** 总页数（>= 1）。 */
  totalPages: number;
  onPageChange: (page: number) => void;
  /** 可选总条数，用于计数文案（与控件组居中成组）。 */
  total?: number;
  /** 计数单位名（默认 "item"，自动追加复数 s）。 */
  itemLabel?: string;
  /** loading 时禁用全部按钮。 */
  disabled?: boolean;
  /** 无限滚动「向后追加」在途时，于控件旁渲染小 spinner（不阻断翻页）。 */
  loadingMore?: boolean;
  className?: string;
}

/**
 * 计算页码序列（含省略号占位）。
 * totalPages <= 7 时全展开；否则恒显首末 + 当前 ±1，缺口以 "ellipsis" 占位。
 */
function buildPages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

function countLabel(total: number, itemLabel: string): string {
  return `${total} ${itemLabel}${total === 1 ? "" : "s"}`;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  itemLabel = "item",
  disabled = false,
  loadingMore = false,
  className,
}: PaginationProps) {
  // 单页（或无数据）时不渲染翻页器；若提供了 total 则仅显示一行居中计数。
  if (totalPages <= 1) {
    if (total == null) return null;
    return (
      <div className={cn("flex justify-center text-micro tabular-nums text-text-secondary", className)}>
        {countLabel(total, itemLabel)}
      </div>
    );
  }

  const pages = buildPages(page, totalPages);
  const go = (target: number) => {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next !== page) onPageChange(next);
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-4", className)}
    >
      {total != null && (
        <span className="text-micro tabular-nums text-text-secondary">
          {countLabel(total, itemLabel)}
        </span>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          iconOnly
          disabled={disabled || page <= 1}
          onClick={() => go(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="select-none px-1 text-text-muted"
              aria-hidden
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "primary" : "ghost"}
              size="sm"
              disabled={disabled}
              onClick={() => go(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className="min-w-8 px-2 tabular-nums"
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          iconOnly
          disabled={disabled || page >= totalPages}
          onClick={() => go(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {loadingMore && <Spinner size="sm" className="ml-1 text-text-muted" label="加载更多" />}
      </div>
    </nav>
  );
}
