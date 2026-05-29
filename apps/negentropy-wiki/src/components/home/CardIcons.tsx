/**
 * 首页卡片插图 — 手绘风格 SVG
 *
 * viewBox 统一 120×120，stroke=currentColor，stroke-linecap="round"
 */

import type { ComponentType } from "react";

export function IconAI() {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      {/* 电脑屏幕 */}
      <rect x="20" y="24" width="80" height="56" rx="6" />
      <line x1="40" y1="80" x2="80" y2="80" />
      <line x1="60" y1="80" x2="60" y2="92" />
      <line x1="42" y1="92" x2="78" y2="92" />
      {/* 神经网络节点 */}
      <circle cx="42" cy="42" r="5" fill="currentColor" opacity="0.15" />
      <circle cx="60" cy="38" r="5" fill="currentColor" opacity="0.15" />
      <circle cx="78" cy="42" r="5" fill="currentColor" opacity="0.15" />
      <circle cx="48" cy="60" r="5" fill="currentColor" opacity="0.15" />
      <circle cx="72" cy="60" r="5" fill="currentColor" opacity="0.15" />
      {/* 连线 */}
      <line x1="42" y1="42" x2="48" y2="60" opacity="0.5" />
      <line x1="60" y1="38" x2="48" y2="60" opacity="0.5" />
      <line x1="60" y1="38" x2="72" y2="60" opacity="0.5" />
      <line x1="78" y1="42" x2="72" y2="60" opacity="0.5" />
      <line x1="42" y1="42" x2="72" y2="60" opacity="0.3" />
      <line x1="78" y1="42" x2="48" y2="60" opacity="0.3" />
      {/* 数据流粒子 */}
      <circle cx="34" cy="52" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="86" cy="52" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export function IconAlgo() {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      {/* 山峰 */}
      <polyline points="10,90 35,40 50,60 60,30 75,55 90,35 110,90" />
      <line x1="5" y1="90" x2="115" y2="90" />
      {/* 代码符号 */}
      <text x="30" y="78" fontSize="14" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.6">{"</>"}</text>
      {/* 星星 */}
      <circle cx="25" cy="28" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="95" cy="22" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="80" cy="18" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function IconCompute() {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      {/* 终端窗口 */}
      <rect x="18" y="22" width="84" height="76" rx="6" />
      {/* 标题栏 */}
      <line x1="18" y1="38" x2="102" y2="38" />
      <circle cx="30" cy="30" r="3" fill="currentColor" opacity="0.4" />
      <circle cx="40" cy="30" r="3" fill="currentColor" opacity="0.4" />
      <circle cx="50" cy="30" r="3" fill="currentColor" opacity="0.4" />
      {/* 代码行 */}
      <text x="28" y="56" fontSize="11" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.7">{">"}</text>
      <line x1="40" y1="53" x2="76" y2="53" opacity="0.4" />
      <text x="28" y="70" fontSize="11" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.7">{">"}</text>
      <line x1="40" y1="67" x2="64" y2="67" opacity="0.4" />
      <text x="28" y="84" fontSize="11" fill="currentColor" stroke="none" fontFamily="monospace" opacity="0.7">{">"}</text>
      <line x1="40" y1="81" x2="90" y2="81" opacity="0.4" />
      {/* 光标闪烁 */}
      <rect x="42" y="89" width="6" height="2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function IconKnowledge() {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      {/* 灯泡 */}
      <path d="M60 20 C38 20 22 38 22 58 C22 72 32 82 40 88 L40 98 L80 98 L80 88 C88 82 98 72 98 58 C98 38 82 20 60 20Z" />
      {/* 灯泡底座 */}
      <line x1="44" y1="98" x2="44" y2="104" />
      <line x1="52" y1="98" x2="52" y2="106" />
      <line x1="60" y1="98" x2="60" y2="106" />
      <line x1="68" y1="98" x2="68" y2="106" />
      <line x1="76" y1="98" x2="76" y2="104" />
      {/* 灯丝 */}
      <path d="M50 60 Q55 48 60 60 Q65 72 70 60" opacity="0.5" />
      {/* 光芒 */}
      <line x1="60" y1="6" x2="60" y2="12" opacity="0.4" />
      <line x1="96" y1="30" x2="100" y2="26" opacity="0.4" />
      <line x1="24" y1="30" x2="20" y2="26" opacity="0.4" />
      <line x1="106" y1="58" x2="112" y2="58" opacity="0.4" />
      <line x1="14" y1="58" x2="8" y2="58" opacity="0.4" />
    </svg>
  );
}

export function IconGeneric() {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      {/* 书本 */}
      <path d="M20 30 L20 90 Q40 80 60 90 Q80 80 100 90 L100 30 Q80 40 60 30 Q40 40 20 30Z" />
      <line x1="60" y1="30" x2="60" y2="90" opacity="0.3" />
      {/* 书页线条 */}
      <line x1="30" y1="48" x2="50" y2="44" opacity="0.3" />
      <line x1="30" y1="60" x2="50" y2="56" opacity="0.3" />
      <line x1="30" y1="72" x2="50" y2="68" opacity="0.3" />
      <line x1="70" y1="44" x2="90" y2="48" opacity="0.3" />
      <line x1="70" y1="56" x2="90" y2="60" opacity="0.3" />
      <line x1="70" y1="68" x2="90" y2="72" opacity="0.3" />
    </svg>
  );
}

/** Publication 名称 → 图标映射 */
const ICON_MAP: Record<string, ComponentType> = {
  "数智通识": IconAI,
  "算法通解": IconAlgo,
  "计算通践": IconCompute,
  "知识通感": IconKnowledge,
};

export function getPublicationIcon(name: string): ComponentType {
  return ICON_MAP[name] ?? IconGeneric;
}
