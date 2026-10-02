/** 全貌坐标装置（Map-First Anchor，C 型契约 1）——本集新建核心装置。
 *
 *  全片地图三分区：草稿纸层（会话内：四层管线+两红线）/ 卡片册层（跨会话：
 *  四环节+三道门）/ 尾区（规律·边界）。〔M-001 恒定视觉锚〕：三分卡几何与
 *  色契约全片同形复现，只换 active 高亮与 sub 子环节点亮——消除被动收看的
 *  局部迷航。两种形态：
 *  - <MapAnchor>     全屏三分卡（P0 首亮全图 / P3→P4 换层镜 / P6 尾区收束）
 *  - <MapAnchorChip> 右上缩略条（其余各幕首镜短暂驻场后渐隐，y=64 起）
 *
 *  色契约：草稿纸层=灰白系（text/dim/panel，会话内·短期）；卡片册层=mech
 *  苔绿（跨会话·长期）；尾区=dim 灰底+core 橙点（规律收束）。高亮层 100%
 *  亮度，其余两层压暗 55%。
 *  帧驱动（useEnter/useProgress），零随机零 Date.now；内容 y≥56 起步。
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useEnter, useProgress} from '../motion';
import {theme} from '../design/theme';

export type MapZone = 'scratchpad' | 'cardfile' | 'tail';

const ZONES: {id: MapZone; label: string; subs: string[]}[] = [
  {id: 'scratchpad', label: '草稿纸层 · 会话内', subs: ['四层管线', '两条红线']},
  {id: 'cardfile', label: '卡片册层 · 跨会话', subs: ['四环节', '三道门']},
  {id: 'tail', label: '规律 · 边界', subs: ['五规律', '护栏']},
];

const zoneTint = (z: MapZone): string =>
  z === 'cardfile' ? theme.mech : z === 'tail' ? theme.core : theme.text;

/** 全屏三分卡。`enterAt`/`fadeAt` 均为相对所在 Sequence 的帧；-1 表示不入场/不淡出。 */
export const MapAnchor: React.FC<{
  active: MapZone;
  subActive?: number; // 高亮层内点亮的子环节下标（0/1）；省略全部子环节常亮
  enterAt?: number;
  fadeAt?: number;
}> = ({active, subActive = -1, enterAt = 0, fadeAt = -1}) => {
  const e = useEnter('rise', {at: enterAt, springPreset: 'settle'});
  // 运动层门面为位置参数签名（useProgress(at, dur)）——fadeAt<0 时钳到 0，
  // 下方三元已把该项乘出，不产生假淡出
  const fade = useProgress(Math.max(0, fadeAt), 21);
  return (
    <AbsoluteFill style={{opacity: e.opacity * (fadeAt >= 0 ? 1 - fade : 1)}}>
      {ZONES.map((z, i) => {
        const lit = z.id === active;
        const col = i % 3;
        return (
          <div
            key={z.id}
            style={{
              position: 'absolute',
              left: 240 + col * 480,
              top: 200,
              width: 440,
              padding: '26px 28px',
              borderRadius: 16,
              border: `2px solid ${lit ? zoneTint(z.id) : theme.panelBorder}`,
              background: theme.panel,
              opacity: lit ? 1 : 0.55,
              filter: lit ? 'none' : 'brightness(0.72)',
              fontFamily: theme.sans,
            }}
          >
            <div style={{fontSize: 26, fontWeight: 600, color: lit ? zoneTint(z.id) : theme.dim}}>
              {z.label}
            </div>
            <div style={{display: 'flex', gap: 10, marginTop: 14}}>
              {z.subs.map((s, j) => {
                const subLit = lit && (subActive < 0 || subActive === j);
                return (
                  <div
                    key={s}
                    style={{
                      fontSize: 19,
                      color: subLit ? theme.text : theme.dim,
                      border: `1px solid ${subLit ? zoneTint(z.id) : theme.panelBorder}`,
                      borderRadius: 8,
                      padding: '5px 12px',
                    }}
                  >
                    {s}
                  </div>
                );
              })}
            </div>
            {z.id === 'scratchpad' && (
              <div style={{marginTop: 12, color: theme.mono, fontSize: 15, opacity: 0.8}}>
                {'context window'}
              </div>
            )}
            {z.id === 'cardfile' && (
              <div style={{marginTop: 12, color: theme.mono, fontSize: 15, opacity: 0.8}}>
                {'.memory/ · MEMORY.md'}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 右上缩略条：三层小胶囊，active 染色，其余 dim；驻场 ~3.5s 后渐隐。 */
export const MapAnchorChip: React.FC<{active: MapZone; enterAt?: number; hold?: number}> = ({
  active,
  enterAt = 0,
  hold = 105,
}) => {
  const e = useEnter('fade', {at: enterAt});
  const fade = useProgress(enterAt + hold, 15);
  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        right: 28,
        display: 'flex',
        gap: 8,
        opacity: e.opacity * (1 - fade),
        fontFamily: theme.sans,
        fontSize: 15,
      }}
    >
      {ZONES.map((z) => {
        const lit = z.id === active;
        return (
          <div
            key={z.id}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${lit ? zoneTint(z.id) : theme.panelBorder}`,
              color: lit ? zoneTint(z.id) : theme.dim,
              background: theme.panel,
            }}
          >
            {z.label.split(' · ')[0]}
          </div>
        );
      })}
    </div>
  );
};
