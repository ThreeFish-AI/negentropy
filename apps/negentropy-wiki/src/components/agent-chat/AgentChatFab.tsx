"use client";

/**
 * 右下角悬浮按钮（FAB）+ Drawer 组合根。
 *
 * 由 AgentChatMount 通过 next/dynamic({ ssr:false }) 异步装载，
 * 不阻塞 SSG/ISR 首屏。
 */
import { useState } from "react";
import { ChatDrawer } from "./ChatDrawer";

/** 极简对话气泡 — 圆角矩形 + 三条消息横线 */
function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" opacity="0.7" />
      <line x1="8" y1="13" x2="13" y2="13" opacity="0.5" />
    </svg>
  );
}

/** 极简关闭 X */
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export default function AgentChatFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="wiki-agent-chat-fab"
        aria-label={open ? "关闭 Agents 对话" : "打开 Agents 对话"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Agents at Wiki"
      >
        <span className="wiki-agent-chat-fab__icon" aria-hidden>
          {open ? <CloseIcon /> : <ChatIcon />}
        </span>
      </button>
      <ChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
