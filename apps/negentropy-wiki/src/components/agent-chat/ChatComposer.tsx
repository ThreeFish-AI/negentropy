"use client";

/**
 * ChatComposer —— textarea + @ 提及解析 + 发送/中止控制。
 *
 * 复用 @negentropy/agents-chat-core/parse 的 detectMentionTrigger /
 * applyMention 纯函数，保证与 negentropy-ui Home Composer 行为一致。
 *
 * 当前 wiki 场景仅支持 agent 类型 mention（不支持 corpus / graph）。
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  applyMention,
  deriveForwardedPropsFromMentions,
  detectMentionTrigger,
  reconcileMentions,
  type MentionToken,
} from "@negentropy/agents-chat-core/parse";
import type { AgentSummary } from "@/lib/agent-chat/use-agents";
import {
  AgentMentionPopover,
  clampActiveIndex,
} from "./AgentMentionPopover";

export interface ChatComposerProps {
  /** Agent 候选列表（root + faculties）。 */
  candidates: AgentSummary[];
  /** 是否处于流式中（streaming 时禁用 send，启用 abort）。 */
  streaming: boolean;
  /** 发送：用户回车或点击 Send 触发。 */
  onSend: (text: string, agentName: string | null) => void;
  /** 中止流式。 */
  onAbort: () => void;
  /** 用户选中的偏好 Agent 实时回传（用于显示头像与提示）。 */
  onPreferredAgentChange: (name: string | null) => void;
}

export function ChatComposer({
  candidates,
  streaming,
  onSend,
  onAbort,
  onPreferredAgentChange,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [mentions, setMentions] = useState<MentionToken[]>([]);
  const [trigger, setTrigger] = useState<{ start: number; end: number; queryText: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 派生 forwardedProps 用于回传给父组件
  const derived = useMemo(
    () => deriveForwardedPropsFromMentions(mentions),
    [mentions],
  );

  // 偏好 Agent 名变化时通知父组件
  useEffect(() => {
    onPreferredAgentChange(derived.preferred_agent);
  }, [derived.preferred_agent, onPreferredAgentChange]);

  const handleChange = useCallback(
    (next: string, caret: number) => {
      const reconciled = reconcileMentions(value, next, mentions);
      setMentions(reconciled);
      setValue(next);
      const t = detectMentionTrigger(next, caret);
      setTrigger(t);
      setActiveIndex(0);
    },
    [value, mentions],
  );

  const handleSelectAgent = useCallback(
    (agent: AgentSummary) => {
      if (!trigger) return;
      const { value: nextValue, caret, token } = applyMention(value, trigger, {
        kind: "agent",
        refId: agent.name,
        label: agent.displayName,
      });
      setValue(nextValue);
      setMentions((prev) => [...prev, token]);
      setTrigger(null);
      // 异步把光标移到 mention 之后
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(caret, caret);
      });
    },
    [trigger, value],
  );

  const filteredCandidates = useMemo(() => {
    if (!trigger) return candidates;
    const q = trigger.queryText.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q),
    );
  }, [candidates, trigger]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (trigger && filteredCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => clampActiveIndex(i + 1, filteredCandidates.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => clampActiveIndex(i - 1, filteredCandidates.length));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const target = filteredCandidates[activeIndex];
        if (target) handleSelectAgent(target);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return;
      }
    }
    // 无 trigger 时：Enter 发送（Shift+Enter 换行）
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (streaming) return;
      const text = value.trim();
      if (!text) return;
      onSend(text, derived.preferred_agent);
      setValue("");
      setMentions([]);
    }
  };

  const handleSendClick = () => {
    if (streaming) {
      onAbort();
      return;
    }
    const text = value.trim();
    if (!text) return;
    onSend(text, derived.preferred_agent);
    setValue("");
    setMentions([]);
  };

  return (
    <div className="wiki-agent-chat-composer">
      <div className="wiki-agent-chat-composer__textarea-wrap">
        <textarea
          ref={textareaRef}
          className="wiki-agent-chat-composer__textarea"
          value={value}
          rows={2}
          placeholder="提问，或输入 @ 选择 Agent…"
          onChange={(e) => {
            handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            const caret = target.selectionStart ?? target.value.length;
            const t = detectMentionTrigger(value, caret);
            setTrigger(t);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Agent 对话输入框"
        />
        {trigger ? (
          <AgentMentionPopover
            candidates={filteredCandidates}
            query={trigger.queryText}
            activeIndex={activeIndex}
            onSelect={handleSelectAgent}
            onActiveIndexChange={setActiveIndex}
            anchorEl={textareaRef.current}
          />
        ) : null}
      </div>
      <div className="wiki-agent-chat-composer__actions">
        <span className="wiki-agent-chat-composer__hint">
          {derived.preferred_agent
            ? `→ ${derived.preferred_agent}`
            : "默认主 Agent"}
        </span>
        <button
          type="button"
          className="wiki-agent-chat-composer__btn"
          onClick={handleSendClick}
          aria-label={streaming ? "中止" : "发送"}
        >
          {streaming ? "中止" : "发送"}
        </button>
      </div>
    </div>
  );
}
