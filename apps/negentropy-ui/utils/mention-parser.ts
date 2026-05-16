/**
 * Home Composer @ Mention 解析工具（纯函数，零副作用，单测覆盖率优先）。
 *
 * 职责：
 * 1. ``detectMentionTrigger`` —— textarea onChange / onSelect 后判断当前光标是否
 *    处于 ``@`` 触发态，返回 ``trigger.queryText`` 供弹层过滤；
 * 2. ``applyMention`` —— 用户从弹层选中候选项后，把 ``rawText`` 写入 textarea，
 *    返回新的 ``value`` 与下一光标位置；
 * 3. ``reconcileMentions`` —— textarea 内容变更后，对齐 mention 区间的 offset；
 *    若用户删除穿透了 mention 区间，则丢弃该 token（孤儿 token 清理）。
 *
 * 触发规则：``@`` 前必须为行首 / 空白 / 中文标点 / 引号，避免 email
 * （``user@example.com``）等场景误触发。query 仅允许字母数字 / 中文 / ``-`` / ``_`` /
 * ``.`` / ``:`` 等，遇到空白即截断（弹层选中后会自动追加尾空格作为闭合）。
 */
import type { MentionKind, MentionToken } from "@/types/mention";

/** 触发态描述。 */
export interface MentionTrigger {
  /** ``@`` 在 inputValue 中的 offset。 */
  start: number;
  /** 当前光标位置（end）—— 已包含正在键入的 query 文本。 */
  end: number;
  /** ``@`` 之后的 query 部分（不含 ``@`` 本身）；空串表示刚键入 ``@``。 */
  queryText: string;
}

/** ``@`` 前的合法前缀：行首、ASCII/全角空白、中文标点、英文引号等。 */
const _LEADING_RE = /[\s 　，。；：、（）《》"'`「」『』【】]/;
/** mention query 允许的字符集（不含空白）：英文数字、中文、常见连字、``:`` 等。 */
const _QUERY_CHAR_RE = /[\p{L}\p{N}_\-.:]/u;

export function detectMentionTrigger(
  value: string,
  caret: number,
): MentionTrigger | null {
  if (caret <= 0 || caret > value.length) return null;
  // 向左回扫找最近的 ``@``；遇到非 query 字符（空白等）则放弃。
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "@") {
      // 验证 ``@`` 前为合法 leading
      const prev = i === 0 ? "" : value[i - 1];
      if (prev === "" || _LEADING_RE.test(prev)) {
        return {
          start: i,
          end: caret,
          queryText: value.slice(i + 1, caret),
        };
      }
      return null;
    }
    if (!_QUERY_CHAR_RE.test(ch)) {
      // 遇到空白或其它分隔符，不在 mention 上下文
      return null;
    }
    i -= 1;
  }
  return null;
}

export interface ApplyMentionResult {
  value: string;
  caret: number;
  token: MentionToken;
}

/**
 * 把候选项写入 textarea：替换从 trigger.start 到 trigger.end 的 query 段，
 * 插入 ``@label `` 闭合，返回新文本、新光标位置与生成的 MentionToken。
 */
export function applyMention(
  value: string,
  trigger: MentionTrigger,
  candidate: { kind: MentionKind; refId: string; label: string },
): ApplyMentionResult {
  const rawTextNoTrail = `@${candidate.label}`;
  const rawText = `${rawTextNoTrail} `; // 尾空格作为视觉闭合
  const next = value.slice(0, trigger.start) + rawText + value.slice(trigger.end);
  const token: MentionToken = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind: candidate.kind,
    refId: candidate.refId,
    label: candidate.label,
    rawText: rawTextNoTrail,
    start: trigger.start,
    end: trigger.start + rawTextNoTrail.length,
  };
  return {
    value: next,
    caret: trigger.start + rawText.length,
    token,
  };
}

/**
 * 文本变更后对齐 mention offset：
 *
 * - 如果某个 mention 的 ``rawText`` 在 next 中按 offset 平移后仍能精确匹配，
 *   则更新 start/end；否则视为被编辑/删除，丢弃。
 * - 通过 diff 计算位移量：找首个差异位置 ``divergeAt`` 与末尾共同长度，反推平移量。
 *
 * 设计取舍：不做穿透分支拼接（避免引入操作转换 OT 的复杂度）；mention 区间内
 * 被编辑即丢弃，简单可靠，符合"软偏好"语义——用户重新选即可。
 */
export function reconcileMentions(
  prev: string,
  next: string,
  mentions: MentionToken[],
): MentionToken[] {
  if (mentions.length === 0) return mentions;
  if (prev === next) return mentions;

  const survivors: MentionToken[] = [];
  for (const m of mentions) {
    // 在 next 中按相同顺序寻找 rawText —— 单次出现优先，多次出现按距离 start 最近的匹配。
    const idx = _nearestIndexOf(next, m.rawText, m.start);
    if (idx < 0) continue; // 已被编辑/删除
    survivors.push({ ...m, start: idx, end: idx + m.rawText.length });
  }
  return survivors;
}

function _nearestIndexOf(s: string, needle: string, anchor: number): number {
  if (!needle) return -1;
  // 从 anchor 附近向两侧扩散搜索，避免重名 mention 错位
  const left = s.lastIndexOf(needle, anchor);
  const right = s.indexOf(needle, anchor);
  if (left < 0 && right < 0) return -1;
  if (left < 0) return right;
  if (right < 0) return left;
  return anchor - left <= right - anchor ? left : right;
}

/**
 * 从 mention 列表派生 forwardedProps 的三个字段。
 *
 * - ``preferred_subagent``：取最后一个 ``agent`` mention（多选时后者覆盖）；
 * - ``scoped_corpus_ids``：所有 ``corpus-retrieve`` mention 的 refId，去重；
 * - ``output_corpus_ids``：所有 ``corpus-output`` mention 的 refId，去重。
 *
 * 调用方可选地传 ``validRefIds`` 用于过滤孤儿 token（如 Corpus 已被删除）。
 */
export interface DerivedMentionProps {
  preferred_subagent: string | null;
  scoped_corpus_ids: string[];
  output_corpus_ids: string[];
}

export function deriveForwardedPropsFromMentions(
  mentions: MentionToken[],
  validRefIds?: {
    agents?: ReadonlySet<string>;
    corpora?: ReadonlySet<string>;
  },
): DerivedMentionProps {
  let preferred: string | null = null;
  const scoped: string[] = [];
  const output: string[] = [];
  for (const m of mentions) {
    if (m.kind === "agent") {
      if (validRefIds?.agents && !validRefIds.agents.has(m.refId)) continue;
      preferred = m.refId;
    } else if (m.kind === "corpus-retrieve") {
      if (validRefIds?.corpora && !validRefIds.corpora.has(m.refId)) continue;
      scoped.push(m.refId);
    } else if (m.kind === "corpus-output") {
      if (validRefIds?.corpora && !validRefIds.corpora.has(m.refId)) continue;
      output.push(m.refId);
    }
  }
  return {
    preferred_subagent: preferred,
    scoped_corpus_ids: Array.from(new Set(scoped)),
    output_corpus_ids: Array.from(new Set(output)),
  };
}
