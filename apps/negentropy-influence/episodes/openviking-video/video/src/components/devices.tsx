/** 本集专用视觉装置库（v1）。
 *
 *  统一空间隐喻 = **一座会自己编目的图书馆**：三个分区（公共馆藏 / 读者档案室 /
 *  馆员手册室）各占一个固定部位、严格单射、全片不换位。角落常驻三分区 HUD，
 *  讲到哪个分区点亮哪格（P1 全亮后常亮至 P4，P6 熄灯收尾）。
 *
 *  设计纪律（与运动层铁律一致）：本文件只产出**形状与排版**，动画时点一律由
 *  调用侧用句边界推导后以 `at` / `delay` 传入；组件内部只在顶层调 hooks，
 *  map 内一律用纯函数 `progress`。
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useProgress, useStagger} from '../motion';

/** 证据分级角标——口播义务的画面执法点（planning §2/§3） */
export type EvidenceGrade = 'lab' | 'official' | 'vendor' | 'thirdparty';
const GRADE: Record<EvidenceGrade, {t: string; c: string}> = {
  lab: {t: '【一】原型实测输出', c: theme.mint},
  official: {t: '【二】精读笔记讲法', c: theme.dim},
  vendor: {t: '【三】厂商自报基准', c: theme.peri},
  thirdparty: {t: '【四】第三方分析', c: theme.rose},
};

export const EvidenceBadge: React.FC<{grade: EvidenceGrade; at?: number; top?: number}> = ({
  grade,
  at = 4,
  top = 44,
}) => {
  const o = useProgress(at, DUR.f4);
  const g = GRADE[grade];
  return (
    <div
      style={{
        position: 'absolute',
        right: 44,
        top,
        padding: '6px 14px',
        borderRadius: 999,
        border: `1px solid ${g.c}66`,
        background: `${g.c}14`,
        color: g.c,
        fontFamily: theme.sans,
        fontSize: 20,
        letterSpacing: 0.5,
        opacity: o,
      }}
    >
      {g.t}
    </div>
  );
};

/** 三分区图书馆 HUD：常驻左下（P0 碎片态 → P1 逐格点亮 → 常亮 → P6 熄灯）。
 *  lit: 已点亮格数（0=碎裂占位、3=全亮）；dimmed=true 时整体压暗（熄灯收尾）。 */
export const LibraryHUD: React.FC<{lit: number; at?: number; dimmed?: boolean}> = ({
  lit,
  at = 0,
  dimmed = false,
}) => {
  const frame = useCurrentFrame();
  const cells = [
    {t: '公共馆藏', s: 'resources'},
    {t: '读者档案', s: 'user'},
    {t: '馆员手册', s: 'agent'},
  ];
  return (
    <div style={{position: 'absolute', right: 44, top: 96, display: 'flex', gap: 8, opacity: dimmed ? 0.25 : 1}}>
      {cells.map((c, i) => {
        const on = i < lit;
        const p = on ? progress(frame, at + i * 6, DUR.f4) : 0;
        return (
          <div
            key={c.s}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${on ? `${theme.mint}${Math.round(88 * p).toString(16).padStart(2, '0')}` : theme.panelBorder}`,
              background: on ? `${theme.mint}${Math.round(20 * p).toString(16).padStart(2, '0')}` : 'transparent',
              color: on ? theme.mint : theme.dim,
              fontFamily: theme.mono,
              fontSize: 15,
              opacity: on ? 0.35 + 0.65 * p : 0.55,
            }}
          >
            {c.s} · {c.t}
          </div>
        );
      })}
    </div>
  );
};

/** 数字对撞卡：坏值 vs 好值（P3 实测对照 / P5 反例对撞） */
export const NumberClash: React.FC<{
  badLabel: string;
  bad: string;
  goodLabel: string;
  good: string;
  at?: number;
  goodColor?: string;
}> = ({badLabel, bad, goodLabel, good, at = 0, goodColor}) => {
  const [a, b] = useStagger(2, {at, stride: 10, dur: DUR.f5});
  const side = (label: string, v: string, c: string, p: number, dir: number) => (
    <div
      style={{
        padding: '22px 34px',
        borderRadius: 12,
        border: `2px solid ${c}`,
        background: `${c}14`,
        opacity: p,
        transform: `translateX(${(1 - p) * 30 * dir}px)`,
        textAlign: 'center',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 8}}>{label}</div>
      <div style={{fontFamily: theme.mono, fontSize: 60, color: c, letterSpacing: 1}}>{v}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 40, alignItems: 'center'}}>
      {side(badLabel, bad, theme.danger, a, -1)}
      <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim, opacity: b}}>vs</div>
      {side(goodLabel, good, goodColor ?? theme.mint, b, 1)}
    </div>
  );
};

/** 幕级标题条 + 主体插槽：统一每幕的排版骨架 */
export const Stage: React.FC<{children: React.ReactNode; gap?: number; top?: number}> = ({
  children,
  gap = 34,
  top = 150,
}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: top, gap}}>{children}</AbsoluteFill>
);
