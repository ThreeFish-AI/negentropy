"use client";

/**
 * 右下角悬浮按钮（FAB）+ Drawer 组合根。
 *
 * 由 AgentChatMount 通过 next/dynamic({ ssr:false }) 异步装载，
 * 不阻塞 SSG/ISR 首屏。
 */
import { useState } from "react";
import { ChatDrawer } from "./ChatDrawer";

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
          {open ? "✕" : "💬"}
        </span>
      </button>
      <ChatDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
