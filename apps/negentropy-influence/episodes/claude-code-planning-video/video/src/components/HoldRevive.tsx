/** HoldRevive — archify 扩窗 hold 段的原生唤活装置（ISSUE-208 方案 a：长窗拆原生）。
 *  章视频按 story_sec 播完后画面落 hold 定格；本装置自 hold 起点把本章要点逐条
 *  浮现（关键词对，画面纪律 ≤3 连字），使「图讲完之后」的口播段有信息渐入而非纯静止。
 *  动效只 fade+translateY（运动层铁律：局部动效不弹跳）；stagger 步长随条数自适应。
 *  放置契约：左下 x=80、bottom=200（archify 顶带章节条之下、字幕带 bottom≥150 之上），
 *  半透明 panel 叠于 hold 末帧之上——是场景级原生装置，非 archify inset（forbid_inset 不涉）。 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, useStagger} from '../motion';
import {Panel} from './motifs';

export const HoldRevive: React.FC<{at: number; points: readonly string[]; tag?: string}> = ({
  at,
  points,
  tag = '本章要点',
}) => {
  const frame = useCurrentFrame();
  const stride = Math.max(24, Math.floor(DUR.f3 * 2));
  const rows = useStagger(points.length, {at, dur: DUR.f4, stride});
  if (frame < at) return null;
  return (
    <div style={{position: 'absolute', left: 80, bottom: 200}}>
      <Panel style={{padding: '18px 28px', maxWidth: 560}}>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, letterSpacing: 4, marginBottom: 12}}>
          {tag}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          {points.map((t, i) => (
            <div
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: rows[i] ?? 0,
                transform: `translateY(${(1 - (rows[i] ?? 0)) * 14}px)`,
              }}
            >
              <div style={{width: 7, height: 7, borderRadius: 4, background: theme.mech, flexShrink: 0}} />
              <div style={{fontFamily: theme.serif, fontSize: 22, color: theme.text}}>{t}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
