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
    if (val === null) return <span className="text-zinc-400">null</span>;
    if (typeof val === "string")
      return (
        <span className="text-emerald-700 break-all">&quot;{val}&quot;</span>
      );
    if (typeof val === "number")
      return <span className="text-blue-600">{val}</span>;
    if (typeof val === "boolean")
      return <span className="text-amber-600">{val ? "true" : "false"}</span>;
    return <span className="break-all">{String(val)}</span>;
  };

  if (!isObject) {
    return (
      <div className="font-mono text-[11px] leading-relaxed hover:bg-black/5 rounded px-1 -mx-1">
        <span
          className="text-zinc-400 select-none"
          style={{ paddingLeft: level * 12 }}
        >
          {name ? `"${name}": ` : ""}
        </span>
        {renderValue(value)}
        {!isLast && <span className="text-zinc-400 select-none">,</span>}
      </div>
    );
  }

  const keys = Object.keys(value as object);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const size = isArray ? (value as unknown[]).length : keys.length;

  if (size === 0) {
    return (
      <div className="font-mono text-[11px] leading-relaxed hover:bg-black/5 rounded px-1 -mx-1">
        <span
          className="text-zinc-400 select-none"
          style={{ paddingLeft: level * 12 }}
        >
          {name ? `"${name}": ` : ""}
        </span>
        <span className="text-zinc-800">
          {openBracket}
          {closeBracket}
        </span>
        {!isLast && <span className="text-zinc-400 select-none">,</span>}
      </div>
    );
  }

  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <div
        className="flex items-center hover:bg-black/5 rounded px-1 -mx-1 cursor-pointer select-none group"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <span className="text-zinc-400" style={{ paddingLeft: level * 12 }}>
          <span className="inline-block w-3 text-zinc-400 mr-0.5 transition-transform duration-200 group-hover:text-zinc-600">
            {expanded ? "▼" : "▶"}
          </span>
          {name ? `"${name}": ` : ""}
        </span>
        <span className="text-zinc-800">{openBracket}</span>
        {!expanded && <span className="text-zinc-400 mx-1">...</span>}
        {!expanded && <span className="text-zinc-800">{closeBracket}</span>}
        {!expanded && !isLast && <span className="text-zinc-400">,</span>}
        {!expanded && size > 0 && (
          <span className="ml-2 text-[10px] text-zinc-400 bg-zinc-100 px-1 rounded">
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
          <div className="hover:bg-black/5 rounded px-1 -mx-1 select-none">
            <span
              className="text-zinc-800"
              style={{ paddingLeft: level * 12 + 14 }}
            >
              {closeBracket}
            </span>
            {!isLast && <span className="text-zinc-400">,</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export const JsonViewer = ({ data }: { data: unknown }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/json">
      <button
        onClick={copyToClipboard}
        className="absolute right-2 top-2 z-10 p-1.5 bg-white/50 hover:bg-white rounded-md opacity-0 group-hover/json:opacity-100 transition-all border border-black/5 shadow-sm"
        title="Copy JSON"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>
      <JsonNode value={data} isLast={true} />
    </div>
  );
};
