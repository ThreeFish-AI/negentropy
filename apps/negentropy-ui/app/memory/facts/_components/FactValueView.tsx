"use client";

import { useState } from "react";
import { ArrowRight, Braces } from "lucide-react";

import { JsonViewer } from "@/components/ui/JsonViewer";

/**
 * Fact value 的语义化渲染器（形状感知）。
 *
 * 后端写入的 `value` 经核实为「扁平」对象，常见三种形状：
 *   1. 纯文本包装  {text: "prefers Python"}
 *   2. 三元组       {entity|subject, relation|predicate, target|object}
 *   3. 通用扁平对象 {name: "TypeScript"} 等
 * 默认以「给人看」的方式渲染；右上角「{ }」按钮可随时切回原始 JSON，
 * 复用既有 JsonViewer（自带复制），确保信息零丢失 + 保留开发者视角。
 */

// 纯包装键：仅承载一句文本，渲染时剥离键名直接显示句子。
const WRAPPER_KEYS = new Set([
  "text",
  "value",
  "content",
  "description",
  "note",
  "statement",
  "fact",
]);

// 三元组各槽位的同义键（按顺序取第一个非空命中），紧扣后端实际写入的形状。
const SUBJECT_KEYS = ["subject", "entity", "source", "head"];
const RELATION_KEYS = ["predicate", "relation", "rel"];
const OBJECT_KEYS = ["object", "target", "tail"];

interface Triple {
  subject: unknown;
  relation: string;
  object: unknown;
  hasObject: boolean;
  rest: Array<[string, unknown]>;
}

function pickKey(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return k;
  }
  return null;
}

function detectTriple(value: Record<string, unknown>): Triple | null {
  const subjectKey = pickKey(value, SUBJECT_KEYS);
  const relationKey = pickKey(value, RELATION_KEYS);
  if (!subjectKey || !relationKey) return null;

  const objectKey = pickKey(value, OBJECT_KEYS);
  const consumed = new Set(
    [subjectKey, relationKey, objectKey].filter((k): k is string => Boolean(k)),
  );
  return {
    subject: value[subjectKey],
    relation: String(value[relationKey]),
    object: objectKey ? value[objectKey] : undefined,
    hasObject: Boolean(objectKey),
    // 三元组之外的多余键（如 evidence）补渲染为键值行，默认视图不丢信息。
    rest: Object.entries(value).filter(([k]) => !consumed.has(k)),
  };
}

function detectText(value: Record<string, unknown>): string | null {
  const entries = Object.entries(value);
  if (entries.length !== 1) return null;
  const [k, v] = entries[0];
  if (!WRAPPER_KEYS.has(k.toLowerCase())) return null;
  if (v == null) return null;
  if (typeof v === "object") return null;
  return String(v);
}

// ============================================================================
// 原子值渲染
// ============================================================================

function ScalarChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted/70 px-1.5 py-0.5 text-caption text-foreground">
      {children}
    </span>
  );
}

function stringifyScalar(v: unknown): string {
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

function ValueAtom({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-text-muted">—</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-muted">—</span>;
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {value.map((item, i) => (
          <ScalarChip key={i}>{stringifyScalar(item)}</ScalarChip>
        ))}
      </span>
    );
  }
  if (typeof value === "object") {
    // 嵌套对象（罕见）——紧凑单行展示，完整结构可经「{ }」查看原始 JSON。
    return (
      <span className="break-all font-mono text-caption text-foreground">
        {JSON.stringify(value)}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return <span className="font-mono text-foreground">{value ? "true" : "false"}</span>;
  }
  return <span className="break-words text-foreground">{String(value)}</span>;
}

// ============================================================================
// 视图分支
// ============================================================================

function KeyValueList({ entries }: { entries: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2">
          <dt className="shrink-0 font-mono text-caption text-text-muted">{k}</dt>
          <dd className="min-w-0 text-sm">
            <ValueAtom value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TripleView({ triple }: { triple: Triple }) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <span className="break-words font-medium text-foreground">
          {String(triple.subject)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-caption text-text-secondary">
          {triple.relation}
          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
        </span>
        {triple.hasObject ? (
          <ValueAtom value={triple.object} />
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>
      {triple.rest.length > 0 && <KeyValueList entries={triple.rest} />}
    </div>
  );
}

// ============================================================================
// FactValueView
// ============================================================================

export function FactValueView({ value }: { value: Record<string, unknown> }) {
  const [showRaw, setShowRaw] = useState(false);

  const isPlainObject =
    value != null && typeof value === "object" && !Array.isArray(value);
  const isEmpty = !isPlainObject || Object.keys(value).length === 0;

  const text = isPlainObject ? detectText(value) : null;
  const triple = isPlainObject && !text ? detectTriple(value) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowRaw((s) => !s)}
        aria-pressed={showRaw}
        aria-label={showRaw ? "返回语义视图" : "查看原始 JSON"}
        title={showRaw ? "返回语义视图" : "查看原始 JSON"}
        className={`absolute right-0 top-0 z-10 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          showRaw
            ? "bg-muted text-foreground"
            : "text-text-muted/70 hover:bg-muted hover:text-foreground"
        }`}
      >
        <Braces className="h-3.5 w-3.5" aria-hidden />
      </button>

      <div className="pr-7">
        {showRaw ? (
          <div className="rounded-lg border border-border bg-muted/40 p-2.5">
            <JsonViewer data={value} />
          </div>
        ) : isEmpty ? (
          <p className="text-sm text-text-muted">（空）</p>
        ) : text != null ? (
          <p className="break-words text-sm text-foreground">{text}</p>
        ) : triple ? (
          <TripleView triple={triple} />
        ) : (
          <KeyValueList entries={Object.entries(value)} />
        )}
      </div>
    </div>
  );
}
