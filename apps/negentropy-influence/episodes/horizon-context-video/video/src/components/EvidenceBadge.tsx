/** 三级证据徽（Jev 先例复用）：dashed=官方自报 · solid=第三方实测/中立锚 · filled=本仓复算。
 *  徽章是角标件：入口由场景按句挂，文字只放字幕给不了的（等级+归属短词），不复述口播。 */
import React from 'react';
import {theme} from '../design/theme';
import {useEnter} from '../motion';

export type BadgeLevel = 'dashed' | 'solid' | 'filled';

const META: Record<BadgeLevel, {label: string; color: string; border: string}> = {
  dashed: {label: '官方自报', color: theme.dim, border: theme.conceptDeep},
  solid: {label: '第三方实测', color: theme.text, border: theme.concept},
  filled: {label: '本仓复算', color: theme.ok, border: theme.ok},
};

export const EvidenceBadge: React.FC<{
  level: BadgeLevel;
  at: number;
  note?: string;
}> = ({level, at, note}) => {
  const enter = useEnter('rise', {at, dur: 18});
  const m = META[level];
  return (
    <div style={{...enter, display: 'flex', alignItems: 'center', gap: 8}}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `2px ${level === 'dashed' ? 'dashed' : 'solid'} ${m.border}`,
          background: level === 'filled' ? m.border : 'transparent',
        }}
      />
      <span style={{fontFamily: theme.sans, fontSize: 20, color: m.color}}>{m.label}</span>
      {note ? <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{note}</span> : null}
    </div>
  );
};
