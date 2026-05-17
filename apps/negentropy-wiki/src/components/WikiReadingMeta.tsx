interface WikiReadingMetaProps {
  updatedAt?: string;
  wordCount?: number;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

export function WikiReadingMeta({ updatedAt, wordCount }: WikiReadingMetaProps) {
  const parts: string[] = [];
  if (updatedAt) parts.push(formatRelativeDate(updatedAt));
  if (wordCount) parts.push(`约 ${Math.max(1, Math.ceil(wordCount / 300))} 分钟阅读`);
  if (parts.length === 0) return null;

  return (
    <div style={{ fontSize: "0.85em", color: "var(--wiki-text-secondary)" }}>
      {parts.join(" · ")}
    </div>
  );
}
