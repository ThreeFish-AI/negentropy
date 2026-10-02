/** 本集共享装置层——「接诊循环」视觉母题的实现基准。
 *
 *  ★ 〔M-001〕恒定视觉锚的落点：`LoopRing` 锁死 core 橙描边色与绝对线宽（5px），
 *    全片每次出场逐像素同形，只换周边标签与点亮数——「循环本体从不改」的空间表达。
 *  ★ 恒定空间契约（防 X-001 空间逆旁白）：`ClinicStage` 里循环恒居中央、病历本左上、
 *    医生位左、科室门右，全片不换位；三层外设一律自右缘挂入（mech 青）。
 *  ★ 人（医生/来诊者）一律无彩（text 白/dim 灰）——装置才有颜色。
 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, clamp01, useBreathe, useEnter, useStagger} from '../motion';

/** hex + 确定性透明度（帧驱动，无随机） */
export const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 接诊循环圆环〔M-001〕——core 橙恒定描边 5px，五步位刻度沿环均布。
 *  litSteps：已点亮的步位序号上界（0..5）；spin：环体导流虚线缓转（母题呼吸）。 */
export const LoopRing: React.FC<{
  x: number;
  y: number;
  size?: number;
  litSteps?: number;
  spin?: boolean;
  glow?: boolean;
}> = ({x, y, size = 300, litSteps = 0, spin = false, glow = false}) => {
  const frame = useCurrentFrame();
  const breath = useBreathe({period: 150, amp: 0.08, base: 0.92});
  const r = size / 2;
  const c = 2 * Math.PI * r;
  const ticks = ['调', '落', '判', '执', '回'];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 母题描边：色与线宽锁死（X-001：循环在下恒定） */}
        <circle
          cx={r}
          cy={r}
          r={r - 6}
          fill="none"
          stroke={theme.core}
          strokeWidth={5}
          opacity={glow ? breath : 1}
        />
        {spin && (
          <circle
            cx={r}
            cy={r}
            r={r - 20}
            fill="none"
            stroke={withAlpha(theme.core, 0.45)}
            strokeWidth={2}
            strokeDasharray="14 22"
            strokeDashoffset={-((frame * 0.6) % 36)}
          />
        )}
        {ticks.map((t, i) => {
          const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const tx = r + Math.cos(ang) * (r - 6);
          const ty = r + Math.sin(ang) * (r - 6);
          const lit = i < litSteps;
          return (
            <g key={t}>
              <circle cx={tx} cy={ty} r={13} fill="#0E1116" stroke={lit ? theme.core : withAlpha(theme.core, 0.35)} strokeWidth={2.5} />
              <text x={tx} y={ty + 5} textAnchor="middle" fontFamily={theme.sans} fontSize={14} fill={lit ? theme.text : theme.dim}>
                {t}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: Math.round(size * 0.082),
          color: theme.dim,
          letterSpacing: 6,
        }}
      >
        {'接诊循环'}
      </div>
    </div>
  );
};

/** 医生剪影（人无彩） */
export const Doctor: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.88,
}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity}}>
    <svg width={120 * scale} height={180 * scale} viewBox="0 0 120 180">
      <circle cx={60} cy={34} r={28} fill={theme.text} />
      <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
    </svg>
  </div>
);

/** 病历本（唯一凭据，dim 灰册页 + mech 青书签线） */
export const Ledger: React.FC<{x: number; y: number; scale?: number; open?: boolean}> = ({
  x,
  y,
  scale = 1,
  open = true,
}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `scale(${scale})`}}>
    <svg width={210} height={150} viewBox="0 0 210 150">
      <rect x={10} y={8} width={190} height={134} rx={8} fill="#171C26" stroke={theme.panelBorder} strokeWidth={2} />
      <line x1={105} y1={8} x2={105} y2={142} stroke={theme.panelBorder} strokeWidth={2} />
      <text x={58} y={34} textAnchor="middle" fontFamily={theme.sans} fontSize={16} fill={theme.dim}>
        {open ? '问方' : ''}
      </text>
      <text x={156} y={34} textAnchor="middle" fontFamily={theme.sans} fontSize={16} fill={theme.dim}>
        {open ? '答方' : ''}
      </text>
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <line x1={26} y1={62 + i * 26} x2={92} y2={62 + i * 26} stroke={withAlpha(theme.dim, 0.4)} strokeWidth={2} />
          <line x1={118} y1={62 + i * 26} x2={184} y2={62 + i * 26} stroke={withAlpha(theme.dim, 0.4)} strokeWidth={2} />
        </React.Fragment>
      ))}
      <line x1={196} y1={30} x2={196} y2={58} stroke={theme.mech} strokeWidth={4} />
    </svg>
  </div>
);

/** 科室门（右缘，mech 青门框 + 门楣位归 HarnessPlate） */
export const DeptGate: React.FC<{x: number; y: number; lit?: boolean}> = ({x, y, lit = false}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    <svg width={150} height={210} viewBox="0 0 150 210">
      <rect x={14} y={10} width={122} height={190} rx={6} fill="#171C26" stroke={lit ? theme.mech : withAlpha(theme.mech, 0.5)} strokeWidth={3} />
      <text x={75} y={112} textAnchor="middle" fontFamily={theme.sans} fontSize={20} fill={lit ? theme.mech : theme.dim}>
        {'科室'}
      </text>
      <circle cx={118} cy={118} r={5} fill={lit ? theme.mech : theme.dim} />
    </svg>
  </div>
);

/** Harness 门楣字卡（全片唯一口播英文词的视觉落点） */
export const HarnessPlate: React.FC<{x: number; y: number; at?: number}> = ({x, y, at = 0}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...e,
        padding: '6px 22px',
        background: '#171C26',
        border: `2px solid ${withAlpha(theme.core, 0.75)}`,
        borderRadius: 6,
        fontFamily: theme.mono,
        fontSize: 24,
        color: theme.text,
        letterSpacing: 2,
      }}
    >
      {'Harness'}
    </div>
  );
};

/** 行数尺——底部安全带恒驻四格进度条（102/135/180/232，教学版口径）。
 *  落位铁三角：archify 全屏画框下缘 880 之下（5-B 逐版点亮不被画框遮）、
 *  字幕避让带 920 之上（长句字幕板顶缘 ≈943 且 qa 侵入检测带 [920,948) 零进入）、
 *  格高压缩 ≤40px（20px label 档）——三窗叠加后唯一可行带即 [880, 920]。
 *  lit：已点亮格数（1..4）；逐格点亮由调用侧以 Math.round(useCount(...)) 算好后传入。 */
export const LINE_GAUGE: {label: string; sub: string}[] = [
  {label: '102', sub: '循环'},
  {label: '135', sub: '+表'},
  {label: '180', sub: '+关'},
  {label: '232', sub: '+节点'},
];

export const LineGauge: React.FC<{lit: number; y?: number}> = ({lit, y = 880}) => (
  <div style={{position: 'absolute', left: 240, top: y, width: 1440, display: 'flex', gap: 18}}>
    {LINE_GAUGE.map((g, i) => {
      const on = i < lit;
      return (
        <div
          key={g.label}
          style={{
            flex: 1,
            padding: '4px 12px',
            background: '#171C26',
            border: `2px solid ${on ? theme.core : withAlpha(theme.dim, 0.28)}`,
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            opacity: on ? 1 : 0.45,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 20, color: on ? theme.text : theme.dim}}>{g.label}</span>
          <span style={{fontFamily: theme.sans, fontSize: 14, color: on ? theme.core : theme.dim}}>{g.sub}</span>
        </div>
      );
    })}
  </div>
);

/** 三层外设剪影（表／关／节点，mech 青）——P0 预告与 P6 收束共用 */
export const PERIPHERALS: {key: string; zh: string}[] = [
  {key: 'table', zh: '表'},
  {key: 'gate', zh: '关'},
  {key: 'nodes', zh: '节点'},
];

export const PeripheralRow: React.FC<{x: number; y: number; lit?: number; at?: number}> = ({
  x,
  y,
  lit = 0,
  at = 0,
}) => {
  // hooks 顶层恒定序：入场交错 + 常驻微光（lit 侧加权，不条件调用）
  const enters = useStagger(3, {at, stride: 7, dur: DUR.f5});
  const breathe = useBreathe({period: 163, base: 0.86, amp: 0.14});
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 20}}>
      {PERIPHERALS.map((p, i) => {
        const on = i < lit;
        const p1 = enters[i];
        return (
          <div
            key={p.key}
            style={{
              width: 128,
              padding: '14px 0',
              textAlign: 'center',
              background: '#171C26',
              border: `2px solid ${on ? theme.mech : withAlpha(theme.mech, 0.35)}`,
              borderRadius: 8,
              opacity: p1 * (on ? breathe : 1),
              transform: `translateX(${(1 - p1) * 60}px)`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 34, color: on ? theme.mech : theme.dim}}>{p.zh}</div>
            <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 6}}>{'外设'}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 金句卡（衬线体定格——记忆点收束，画面文字压短形态不复述口播） */
export const QuoteCard: React.FC<{
  x: number;
  y: number;
  at: number;
  children: React.ReactNode;
  width?: number;
}> = ({x, y, at, children, width = 640}) => {
  const e = useEnter('fade', {at, dur: DUR.f5});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        ...e,
        padding: '26px 36px',
        background: withAlpha('#0E1116', 0.92),
        border: `2px solid ${withAlpha(theme.core, 0.55)}`,
        borderRadius: 10,
        fontFamily: theme.serif,
        fontSize: 44,
        lineHeight: 1.5,
        color: theme.text,
        letterSpacing: 4,
      }}
    >
      {children}
    </div>
  );
};

/** 破坏性实验封条卡（mono 徽标，实验编号唯一变量）。
 *  size 单一事实源：md＝让位窗前小徽标（24px 档）；lg＝自制段主画面放大档（27px 档）。
 *  收敛自 P1/P2 各自复制的 SealCard（2026-10-02 评审：三实现两规格 → 一处两档）。 */
export const ExpBadge: React.FC<{x: number; y: number; at: number; n: number; size?: 'md' | 'lg'}> = ({
  x,
  y,
  at,
  n,
  size = 'md',
}) => {
  const lg = size === 'lg';
  const e = useEnter('fall', {at, dur: DUR.f4, dist: lg ? 90 : 30});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...e,
        padding: lg ? '12px 32px' : '10px 26px',
        background: withAlpha(theme.deny, 0.12),
        border: `${lg ? 2.5 : 2}px dashed ${withAlpha(theme.deny, lg ? 0.85 : 0.8)}`,
        borderRadius: lg ? 10 : 8,
        fontFamily: theme.mono,
        fontSize: lg ? 27 : 24,
        color: theme.deny,
        letterSpacing: lg ? 3 : 2,
      }}
    >
      {`破坏性实验 · ${n}`}
    </div>
  );
};

/** 归属角标（【三】级断言的画面义务：「对外拆解口径」） */
export const ProvenanceTag: React.FC<{x: number; y: number; at?: number; text?: string}> = ({
  x,
  y,
  at = 0,
  text = '对外拆解口径',
}) => {
  const e = useEnter('fade', {at, dur: DUR.f3});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...e,
        padding: '4px 14px',
        border: `1.5px solid ${withAlpha(theme.dim, 0.6)}`,
        borderRadius: 5,
        fontFamily: theme.sans,
        fontSize: 17,
        color: theme.dim,
      }}
    >
      {text}
    </div>
  );
};

/** 轻量 mono 角标（关键词/数字/口径注——英文标识符只进角标；同 P0 FootnoteGhost
 *  形态；2026-10-02 评审收敛：P1/P2/P3/P6 四份逐字节副本合一于此） */
export const MonoTag: React.FC<{x: number; y: number; at: number; children: React.ReactNode}> = ({x, y, at, children}) => {
  const e = useEnter('fade', {at, dur: DUR.f3});
  return (
    <span
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...e,
        padding: '4px 12px',
        border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
        borderRadius: 5,
        fontFamily: theme.mono,
        fontSize: 16,
        color: theme.dim,
      }}
    >
      {children}
    </span>
  );
};
