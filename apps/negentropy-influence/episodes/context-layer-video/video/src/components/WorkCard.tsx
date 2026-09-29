/** 工卡 hero（恒定视觉锚 M-001）：钢蓝描边 2px 全片同形，逐格盖章进度跨幕累积。
 *  盖章数由场景按幕推进传入；章印用校准绿（验证通过语义）。 */
import React from 'react';
import {theme, withAlpha} from '../design/theme';
import {useSpring} from '../motion';

export const WorkCard: React.FC<{
  w?: number;
  stamps: number; // 已盖格数
  totalSlots: number; // 总格数（本集 = 七幕里程碑 7 格）
  highlightSlot?: number; // 当前幕高亮格（0 基）
  label?: string;
}> = ({w = 420, stamps, totalSlots, highlightSlot, label = '工卡 WORKCARD'}) => {
  const h = w * 0.63;
  const pop = useSpring('settle', {at: 0, dur: 20});
  const rows = Math.ceil(totalSlots / 4);
  return (
    <div
      style={{
        width: w,
        height: h,
        transform: `scale(${pop})`,
        background: theme.panel,
        border: `2px solid ${theme.concept}`,
        borderRadius: 10,
        padding: 16,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <span style={{fontSize: 22, color: theme.concept, letterSpacing: 2}}>{label}</span>
        <span style={{fontSize: 18, color: theme.dim}}>
          {stamps}/{totalSlots}
        </span>
      </div>
      <div style={{flex: 1, display: 'grid', gridTemplateRows: `repeat(${rows}, 1fr)`, gridTemplateColumns: 'repeat(4, 1fr)', gap: 6}}>
        {Array.from({length: totalSlots}, (_, i) => {
          const stamped = i < stamps;
          const hot = i === highlightSlot;
          return (
            <div
              key={i}
              style={{
                borderRadius: 6,
                border: `1.5px solid ${stamped ? theme.ok : theme.panelBorder}`,
                background: stamped ? withAlpha(theme.ok, 0.1) : 'transparent',
                outline: hot ? `2px solid ${theme.conceptDeep}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: stamped ? theme.ok : theme.dim,
              }}
            >
              {stamped ? '✓' : i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
};
