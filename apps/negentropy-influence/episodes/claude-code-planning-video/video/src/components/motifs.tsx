/** 本集视觉母题库（每集独有；复用边界见 pipeline/README.md §四——
 *  Remotion 原语复制适配、不做跨集共享包）。
 *
 *  C 型重制后实际存活的母题只有 Panel（P1/P2/P6 的卡片容器）；旧题的
 *  Terminal/LoopRing/DispatchTable/GateRouter/SlotRing 五母题已随场景
 *  重写退役（git 历史可溯），勿按旧头注到本文件找它们。
 */
import React from 'react';
import {theme} from '../design/theme';

// ─────────────────────────────────────────────────────────── 通用容器

export const Panel: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
  accent?: string;
}> = ({style, children, accent}) => (
  <div
    style={{
      background: theme.panel,
      border: `2px solid ${accent ?? theme.panelBorder}`,
      borderRadius: 14,
      ...style,
    }}
  >
    {children}
  </div>
);
