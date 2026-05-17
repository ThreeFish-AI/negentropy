"use client";

/**
 * AgentChatMount —— Layout 中 client-only 异步装载点。
 *
 * 通过 next/dynamic({ ssr:false }) 把 AgentChatFab 拆为独立 chunk，
 * 首屏 HTML 不包含聊天代码、不阻塞 SSG/ISR 关键路径；
 * hydration 后空闲时段再装载。
 */
import dynamic from "next/dynamic";

const AgentChatFab = dynamic(() => import("./AgentChatFab"), {
  ssr: false,
  loading: () => null,
});

export function AgentChatMount() {
  return <AgentChatFab />;
}
