"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export const JsonNode = ({
  name,
  value,
  isLast,
  level = 0,
}: {
  name?: string;
  value: unknown;
  isLast?: boolean;
  level?: number;
}) => {
  const [expanded, setExpanded] = useState(level < 2);
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  const renderValue = (val: unknown) => {
    if (val === null) return <span className="text-muted">null</span>;
    if (typeof val === "string")
      return (
        <span className="text-secondary-foreground break-all">
          &quot;{val}&quot;
        </span>
      );
    if (typeof val === "number")
      return <span className="text-primary">{val}</span>;
    if (typeof val === "boolean")
      return (
        <span className="text-warning-foreground">
          {val ? "true" : "false"}
        </span>
      );
    return <span className="break-all">{String(val)}</span>;
  };

  if (!isObject) {
    return (
      <div className="font-mono text-[11px] leading-relaxed hover:bg-muted/50 rounded px-1 -mx-1">
        <span
          className="text-zinc-400 select-none dark:text-zinc-500"
          style={{ paddingLeft: level * 12 }}
        >
          {name ? `"${name}": ` : ""}
        </span>
        {renderValue(value)}
        {!isLast && <span className="text-muted select-none">,</span>}
      </div>
    );
  }

  const keys = Object.keys(value as object);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const size = isArray ? (value as unknown[]).length : keys.length;

  if (size === 0) {
    return (
      <div className="font-mono text-[11px] leading-relaxed hover:bg-muted/50 rounded px-1 -mx-1">
        <span
          className="text-zinc-400 select-none dark:text-zinc-500"
          style={{ paddingLeft: level * 12 }}
        >
          {name ? `"${name}": ` : ""}
        </span>
        <span className="text-foreground">
          {openBracket}
          {closeBracket}
        </span>
        {!isLast && <span className="text-muted select-none">,</span>}
      </div>
    );
  }

  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <div
        className="flex items-center hover:bg-muted/50 rounded px-1 -mx-1 cursor-pointer select-none group"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <span className="text-muted" style={{ paddingLeft: level * 12 }}>
          <span className="inline-block w-3 text-muted mr-0.5 transition-transform duration-200 group-hover:text-foreground">
            {expanded ? "▼" : "▶"}
          </span>
          {name ? `"${name}": ` : ""}
        </span>
        <span className="text-foreground">{openBracket}</span>
        {!expanded && <span className="text-muted mx-1">...</span>}
        {!expanded && <span className="text-foreground">{closeBracket}</span>}
        {!expanded && !isLast && <span className="text-muted">,</span>}
        {!expanded && size > 0 && (
          <span className="ml-2 text-[10px] text-muted bg-muted px-1 rounded">
            {size} {isArray ? "items" : "keys"}
          </span>
        )}
      </div>

      {expanded && (
        <div>
          {keys.map((key, index) => (
            <JsonNode
              key={key}
              name={isArray ? undefined : key}
              value={(value as Record<string, unknown>)[key]}
              isLast={index === keys.length - 1}
              level={level + 1}
            />
          ))}
          <div className="hover:bg-muted/50 rounded px-1 -mx-1 select-none">
            <span
              className="text-foreground"
              style={{ paddingLeft: level * 12 + 14 }}
            >
              {closeBracket}
            </span>
            {!isLast && <span className="text-muted">,</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export const JsonViewer = ({ data }: { data: unknown }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/json">
      <button
        onClick={copyToClipboard}
        className="absolute right-2 top-2 z-10 p-1.5 bg-card/80 hover:bg-card rounded-md opacity-0 group-hover/json:opacity-100 transition-all border border-border shadow-sm"
        title="Copy JSON"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted" />
        )}
      </button>
      <JsonNode value={data} isLast={true} />
    </div>
  );
};
