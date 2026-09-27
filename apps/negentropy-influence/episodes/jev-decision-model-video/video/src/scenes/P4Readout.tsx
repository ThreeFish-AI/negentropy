/** P4 柱高与计算栏（p4-01..30，6 镜）——100% 柱高演示、行尾集中度计算栏（公式/复算）、
 *  K=2/K=10 同读数两含金量、RLCD 岗前记分牌（✓/✗ 全片唯一出场）、ECE 双口径、出厂拆除。
 *  规格：script/storyboard.md `### P4`。色契约：实心柱=概率（柱青）、描边栏+mono=读数
 *  （派生纪律：confidence 不另起色相）、预报单/预印格=格黄〔M-001〕；警示红仅 4-D 扣分
 *  态、确认绿仅 ✓ 态（记分牌/核对行）。archify cue 7 条，全部入图默认 lead（镜内均有
 *  Remotion 间隔，无背靠背）。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 三级角标（0-C 图例的运行时形态；components/ 无共用件，本幕局部实现） ──────
type BadgeKind = 'official' | 'field' | 'ours';

const ProvenanceBadge: React.FC<{kind: BadgeKind; label: string; style?: React.CSSProperties}> = ({
  kind,
  label,
  style,
}) => {
  const ring: React.CSSProperties =
    kind === 'ours'
      ? {
          width: 34,
          height: 34,
          borderRadius: 999,
          background: theme.ok,
          color: theme.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 19,
          fontWeight: 700,
        }
      : {
          width: 34,
          height: 34,
          borderRadius: 999,
          boxSizing: 'border-box',
          border: `2.5px ${kind === 'official' ? 'dashed' : 'solid'} ${
            kind === 'official' ? theme.dim : theme.text
          }`,
        };
  const tone = kind === 'ours' ? theme.ok : kind === 'official' ? theme.dim : theme.text;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, ...style}}>
      <div style={ring}>{kind === 'ours' ? '✓' : null}</div>
      <span style={{fontFamily: theme.sans, fontSize: 19, color: tone, whiteSpace: 'nowrap'}}>
        {label}
      </span>
    </div>
  );
};

/** 钉在 archify 画框角上的小标签（公式/机制/关键词角标）。 */
const CornerTag: React.FC<{
  at: number;
  accent: string;
  main: React.ReactNode;
  sub?: string;
  top?: number;
  right?: number;
}> = ({at, accent, main, sub, top = 176, right = 352}) => {
  const o = useProgress(at, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        right,
        top,
        opacity: o,
        padding: '10px 18px',
        borderRadius: 10,
        border: `2px solid ${accent}`,
        background: `${theme.bg}E6`,
      }}
    >
      <div>{main}</div>
      {sub ? (
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 4}}>{sub}</div>
      ) : null}
    </div>
  );
};

// ── 4-A 装置：预报单单行〔M-001〕 ─────────────────────────────────────────

/** p4-07 判读员的手：沿弧线越过计算栏（绕开该栏）——手写贝塞尔 + 描画/巡游同源
 *  progress（本幕 bespoke 签名镜头，运动层逃生舱）。坐标为单行卡内局部系。 */
const HandArc: React.FC<{at: number}> = ({at}) => {
  const p = useProgress(at, 30); // 跨句弧线巡游：显式 30 帧（beat 级动作，铁律④）
  const bx = (1 - p) ** 2 * 210 + 2 * (1 - p) * p * 690 + p * p * 1130;
  const by = (1 - p) ** 2 * 430 + 2 * (1 - p) * p * -180 + p * p * 150;
  return (
    <svg
      style={{position: 'absolute', left: 370, top: 210, width: 1180, height: 490, pointerEvents: 'none'}}
      viewBox="0 0 1180 490"
    >
      <path
        d="M 210 430 Q 690 -180 1130 150"
        fill="none"
        stroke={theme.slot}
        strokeWidth={2.5}
        opacity={0.75}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
      <circle cx={bx} cy={by} r={16} fill={theme.slot} opacity={0.18} />
      <circle cx={bx} cy={by} r={7} fill={theme.slot} />
    </svg>
  );
};

const RowStage: React.FC<{at02: number; at04: number; at06: number; at07: number}> = ({
  at02,
  at04,
  at06,
  at07,
}) => {
  const split = useProgress(at02 + 14, DUR.f5); // 100% 总量条切分
  const grow = useStagger(3, {at: at02 + 30, stride: 9, dur: DUR.f6, easing: 'decelerate'});
  const slot = useEnter('pop', {at: at04, springPreset: 'settle', dur: DUR.f5});
  const numIn = useProgress(at06, DUR.f3);
  const readout = useCount({to: 0.55, at: at06 + 8, dur: DUR.f5}); // 「咔哒」翻数（11/20 = 0.55）
  const tick = useImpulse({at: at06 + 20, dur: DUR.f3, peak: 0.5});
  const yn = useEnter('slideR', {at: at06, dist: 70, springPreset: 'settle', dur: DUR.f5});
  const kw = useProgress(at07 + 8, DUR.f4);
  const cells = [
    {name: '晴', pct: 0.1, label: '10%'},
    {name: '多云', pct: 0.2, label: '20%'},
    {name: '雨', pct: 0.7, label: '70%'},
  ];
  const BAR_MAX = 260;
  return (
    <AbsoluteFill>
      {/* 单行主卡：格黄描边＝预报单〔M-001〕 */}
      <div
        style={{
          position: 'absolute',
          left: 370,
          top: 210,
          width: 1180,
          height: 490,
          borderRadius: 16,
          border: `3px solid ${theme.slot}`,
          background: '#12161F',
        }}
      >
        {/* 行首标签 + 100% 总量条（p4-02 切分成 10/20/70） */}
        <div style={{position: 'absolute', left: 30, top: 22, display: 'flex', alignItems: 'center', gap: 30}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, whiteSpace: 'nowrap'}}>
            明日天气 · 单行
          </div>
          <div style={{position: 'relative', width: 380, height: 40}}>
            <div style={{display: 'flex', width: '100%', height: 20, marginTop: 10, gap: 12 * split}}>
              {[0.1, 0.2, 0.7].map((f, i) => (
                <div key={i} style={{width: `${f * 100}%`, height: '100%', background: theme.bar}} />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: -10,
                fontFamily: theme.mono,
                fontSize: 15,
                color: theme.dim,
                opacity: 1 - split,
              }}
            >
              100%
            </div>
          </div>
        </div>
        {/* 三个预印格 + 概率柱（p4-02 三柱生长） */}
        {cells.map((c, i) => {
          const bh = BAR_MAX * c.pct * grow[i];
          return (
            <div
              key={c.name}
              style={{
                position: 'absolute',
                left: 30 + i * 280,
                top: 96,
                width: 250,
                height: 340,
                border: `2px solid ${theme.slot}55`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 56 + bh + 10,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 26,
                  color: theme.bar,
                  opacity: grow[i],
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 55,
                  bottom: 56,
                  width: 140,
                  height: bh,
                  background: theme.bar,
                  borderRadius: 3,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 16,
                  textAlign: 'center',
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: theme.text,
                }}
              >
                {c.name}
              </div>
            </div>
          );
        })}
        {/* 行尾描边栏＝集中度读数（p4-04 空框浮现 → p4-06 咔哒翻数） */}
        <div
          style={{
            position: 'absolute',
            left: 880,
            top: 96,
            width: 200,
            height: 340,
            borderRadius: 10,
            border: `2.5px dashed ${theme.bar}`,
            opacity: slot.opacity,
            transform: `${slot.transform} scale(${1 + 0.04 * tick})`,
          }}
        >
          <div style={{marginTop: 18, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
            集中度
          </div>
          <div
            style={{
              marginTop: 40,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 54,
              color: theme.bar,
              fontVariantNumeric: 'tabular-nums',
              opacity: numIn,
            }}
          >
            {readout.toFixed(2)}
          </div>
          <div style={{marginTop: 30, textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
            confidence
          </div>
        </div>
      </div>
      {/* 是否行滑过（p4-06）：无集中度栏 */}
      <div
        style={{
          position: 'absolute',
          left: 370,
          top: 716,
          width: 1180,
          height: 104,
          borderRadius: 12,
          border: `2px solid ${theme.slot}55`,
          background: '#12161F',
          opacity: yn.opacity,
          transform: yn.transform,
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          padding: '0 30px',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, width: 110}}>是否行</div>
        {[
          {n: '是', f: 0.85},
          {n: '否', f: 0.15},
        ].map((c) => (
          <div key={c.n} style={{position: 'relative', width: 170, height: 64, border: `2px solid ${theme.slot}55`, borderRadius: 8}}>
            <div style={{position: 'absolute', left: 12, top: 8, fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>
              {c.n}
            </div>
            <div style={{position: 'absolute', left: 12, right: 12, bottom: 16, height: 8, background: `${theme.bar}22`, borderRadius: 4}}>
              <div style={{width: `${c.f * 100}%`, height: '100%', background: theme.bar, borderRadius: 4}} />
            </div>
          </div>
        ))}
        <div
          style={{
            width: 190,
            height: 64,
            borderRadius: 8,
            border: `2px dashed ${theme.dim}88`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
          }}
        >
          无此栏
        </div>
      </div>
      <HandArc at={at07} />
      {/* 「一道算术」关键词 */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center', opacity: kw}}>
        <div
          style={{
            padding: '8px 26px',
            borderRadius: 999,
            border: `2px solid ${theme.bar}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.text,
          }}
        >
          一道算术
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 装置：复算对账 ────────────────────────────────────────────────────

const VerifyStage: React.FC<{at08: number; at09: number; at10: number}> = ({at08, at09, at10}) => {
  const DIGITS = ['0', '.', '5', '5', '0', '0'];
  const left = useStagger(6, {at: at08, stride: 6, dur: DUR.f4});
  const right = useStagger(6, {at: at08 + 26, stride: 6, dur: DUR.f4});
  const match = useProgress(at08 + 62, DUR.f4);
  const pulse = useImpulse({at: at08 + 62, dur: DUR.f5, peak: 0.4});
  const card = useEnter('flyIn', {at: at09, springPreset: 'settle', dur: DUR.f5});
  const cardNote = useProgress(at09 + 14, DUR.f4);
  const infer = useProgress(at10, DUR.f4);
  const digitCell = (d: string, p: number) => (
    <div
      style={{
        width: 62,
        height: 86,
        borderRadius: 8,
        border: `2px solid ${theme.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: 50,
        color: theme.bar,
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
      }}
    >
      {d}
    </div>
  );
  return (
    <AbsoluteFill>
      {/* 问号水印（p4-10，不敲死） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.serif,
          fontSize: 420,
          color: theme.text,
          opacity: 0.05 * infer,
        }}
      >
        ?
      </div>
      {/* 双栏对账卡：左原型复算 / 右公式，逐位对齐 */}
      <div
        style={{
          position: 'absolute',
          left: 420,
          top: 300,
          width: 1080,
          height: 310,
          borderRadius: 16,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
        }}
      >
        <div style={{position: 'absolute', left: 80, top: 16, fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>
          原型复算
        </div>
        <div style={{position: 'absolute', left: 610, top: 16, fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>
          公式
        </div>
        <div style={{position: 'absolute', left: 80, top: 52, display: 'flex', gap: 10}}>
          {DIGITS.map((d, i) => digitCell(d, left[i]))}
        </div>
        <div style={{position: 'absolute', left: 610, top: 52, display: 'flex', gap: 10}}>
          {DIGITS.map((d, i) => digitCell(d, right[i]))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 50,
            bottom: 64,
            width: 0,
            borderLeft: `2px dashed ${theme.panelBorder}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 20,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 14,
            opacity: match,
            transform: `scale(${1 + 0.06 * pulse})`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 34, color: theme.ok}}>✓</span>
          <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>一位不差</span>
        </div>
      </div>
      <ProvenanceBadge kind="ours" label="复算 · 原型" style={{position: 'absolute', left: 1320, top: 272, opacity: match}} />
      {/* p4-09 公式角标卡放大定格（不透明底盖住对账卡中心） */}
      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 330,
          width: 700,
          height: 280,
          borderRadius: 16,
          border: `2.5px solid ${theme.bar}`,
          background: '#12161F',
          opacity: card.opacity,
          transform: card.transform,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 44, color: theme.text}}>{'(p_max − 1/K) / (1 − 1/K)'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: cardNote}}>
          官方参考代码 · MIT
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 168,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontStyle: 'italic',
          fontSize: 22,
          color: theme.dim,
          opacity: infer,
        }}
      >
        {'服务端同式？—— 推断'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 装置：同一读数两种含金量 ──────────────────────────────────────────

const KStage: React.FC<{at11: number; at12: number; at14: number; at15: number}> = ({
  at11,
  at12,
  at14,
  at15,
}) => {
  const hero = useEnter('pop', {at: at11, springPreset: 'settle', dur: DUR.f5});
  const q = useProgress(at12 + 6, DUR.f4);
  const barL = useSpring('settle', {at: at14, dur: DUR.f5});
  const barR = useSpring('settle', {at: at14 + 18, dur: DUR.f5});
  const valL = useProgress(at14 + 16, DUR.f4);
  const valR = useProgress(at14 + 40, DUR.f4);
  const level = useProgress(at14 + 40, DUR.f5);
  const tilt = useSpring('settle', {at: at15, dur: DUR.f5});
  const HMAX = 360;
  const BASE = 810;
  const hL = 0.95 * HMAX * barL;
  const hR = 0.91 * HMAX * barR;
  return (
    <AbsoluteFill>
      {/* 同一读数 0.9 大字（p4-11/12 承接装置） */}
      <div
        style={{
          position: 'absolute',
          left: 810,
          top: 116,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 20,
          color: theme.dim,
          opacity: hero.opacity,
        }}
      >
        集中度
      </div>
      <div
        style={{
          position: 'absolute',
          left: 810,
          top: 150,
          width: 300,
          height: 130,
          borderRadius: 12,
          border: `2.5px dashed ${theme.bar}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 68,
          color: theme.bar,
          opacity: hero.opacity,
          transform: hero.transform,
        }}
      >
        0.9
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1140,
          top: 186,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: q,
        }}
      >
        {'九成把握 ?'}
      </div>
      {/* 左行 K=2：主柱 0.95 */}
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 380,
          width: 500,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.text,
        }}
      >
        {'K = 2'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 424,
          width: 500,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 32,
          color: theme.bar,
          opacity: valL,
        }}
      >
        0.95
      </div>
      <div style={{position: 'absolute', left: 535, top: BASE - hL, width: 90, height: hL, background: theme.bar, borderRadius: 4}} />
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 454 + i * 132,
            top: 822,
            width: 120,
            height: 44,
            border: `2px solid ${theme.slot}77`,
            borderRadius: 8,
          }}
        />
      ))}
      {/* 右行 K=10：主柱 0.91（矮一截，p4-14 落定） */}
      <div
        style={{
          position: 'absolute',
          left: 1090,
          top: 380,
          width: 500,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.text,
        }}
      >
        {'K = 10'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1090,
          top: 424,
          width: 500,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 32,
          color: theme.bar,
          opacity: valR,
        }}
      >
        0.91
      </div>
      <div style={{position: 'absolute', left: 1295, top: BASE - hR, width: 90, height: hR, background: theme.bar, borderRadius: 4}} />
      {Array.from({length: 10}, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 1156 + i * 37,
            top: 822,
            width: 34,
            height: 44,
            border: `2px solid ${theme.slot}77`,
            borderRadius: 6,
          }}
        />
      ))}
      {/* 左柱顶水平线延到右柱：矮一截的落差读出 */}
      <div
        style={{
          position: 'absolute',
          left: 505,
          top: BASE - 0.95 * HMAX - 1,
          width: 915 * level,
          borderTop: `2.5px dashed ${theme.bar}`,
          opacity: 0.55,
        }}
      />
      {/* 含金量天平（p4-15 倾向格少的一侧） */}
      <div style={{position: 'absolute', left: 830, top: 552, width: 260, height: 190}}>
        <svg width="260" height="190" viewBox="0 0 260 190">
          <g transform={`rotate(${-8 * tilt} 130 118)`}>
            <line x1={16} y1={118} x2={244} y2={118} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
            <line x1={16} y1={118} x2={16} y2={138} stroke={theme.dim} strokeWidth={2} />
            <path d="M 0 138 Q 16 154 32 138" fill="none" stroke={theme.dim} strokeWidth={2} />
            <line x1={244} y1={118} x2={244} y2={138} stroke={theme.dim} strokeWidth={2} />
            <path d="M 228 138 Q 244 154 260 138" fill="none" stroke={theme.dim} strokeWidth={2} />
          </g>
          <path d="M 130 118 L 116 148 L 144 148 Z" fill={theme.panelBorder} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 64,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          含金量
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 装置：岗前实况记分牌（✓/✗ 全片唯一出场） ────────────────────────

const ScoreboardStage: React.FC<{
  at18: number;
  at20: number;
  at21: number;
  at22: number;
  at23: number;
}> = ({at18, at20, at21, at22, at23}) => {
  const enter = useEnter('fall', {at: 0, dist: 90, springPreset: 'settle', dur: DUR.f5}); // p4-17 吊装入帧
  const rep = useStagger(3, {at: 8, stride: 8, dur: DUR.f5});
  const ground = useProgress(at18 + 6, DUR.f5); // p4-18 沙盘铺开
  const contract = useStagger(3, {at: at20, stride: 9, dur: DUR.f4}); // p4-20 目标合同
  const hit = useStagger(3, {at: at21, stride: 12, dur: DUR.f6, easing: 'decelerate'}); // p4-21 对账
  const align = useProgress(at21 + 46, DUR.f4); // 报七成两列对齐
  const penal = useProgress(at22, DUR.f4); // p4-22 虚高/虚低扣分
  const honestO = useProgress(at22 + 18, DUR.f4);
  const glow = useImpulse({at: at22 + 18, dur: DUR.f5, peak: 0.6});
  const batch = useProgress(at23, DUR.f5); // p4-23 群体框
  const groups = [
    {label: '报七成', rep: 0.7, hitV: 0.7, note: '诚实'},
    {label: '报九成', rep: 0.9, hitV: 0.55, note: '虚高'},
    {label: '报四成', rep: 0.4, hitV: 0.75, note: '虚低'},
  ];
  const HMAX = 280;
  return (
    <AbsoluteFill>
      {/* 记分牌面板（面板内坐标 = 页面坐标 − (385, 260)） */}
      <div
        style={{
          position: 'absolute',
          left: 385,
          top: 260,
          width: 1150,
          height: 570,
          borderRadius: 18,
          border: `2.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: enter.opacity,
          transform: enter.transform,
        }}
      >
        <div style={{position: 'absolute', left: 30, top: 18, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          实况记分牌
        </div>
        <div style={{position: 'absolute', right: 30, top: 28, display: 'flex', gap: 28, alignItems: 'center'}}>
          <span style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
            <span style={{width: 26, height: 14, background: theme.bar, borderRadius: 3}} />
            报的概率
          </span>
          <span style={{display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
            <span style={{width: 26, height: 14, boxSizing: 'border-box', border: `2.5px solid ${theme.bar}`, borderRadius: 3}} />
            实况命中
          </span>
        </div>
        {groups.map((g, i) => {
          const gx = 60 + i * 300; // 组内局部 x
          const cut = i > 0 ? 1 - 0.15 * penal : 1; // 虚高/虚低柱扣分削减
          const rh = HMAX * g.rep * rep[i] * cut;
          const hh = HMAX * g.hitV * hit[i];
          return (
            <div key={g.label}>
              <div
                style={{
                  position: 'absolute',
                  left: gx,
                  top: 148,
                  width: 300,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 26,
                  color: theme.text,
                }}
              >
                {g.label}
              </div>
              {i === 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: gx + 105,
                    top: 188,
                    width: 90,
                    textAlign: 'center',
                    fontFamily: theme.sans,
                    fontSize: 46,
                    color: theme.ok,
                    opacity: honestO,
                    transform: `scale(${0.6 + 0.4 * honestO + 0.22 * glow})`,
                    textShadow: `0 0 ${18 * glow}px ${theme.ok}88`,
                  }}
                >
                  ✓
                </div>
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    left: gx + 105,
                    top: 188,
                    width: 90,
                    textAlign: 'center',
                    fontFamily: theme.sans,
                    fontSize: 46,
                    color: theme.danger,
                    opacity: penal,
                    transform: `scale(${0.6 + 0.4 * penal})`,
                  }}
                >
                  ✗
                </div>
              )}
              {/* 报的概率：柱青实心（虚高/虚低在 p4-22 被警示红削减） */}
              <div
                style={{
                  position: 'absolute',
                  left: gx + 68,
                  top: 500 - rh,
                  width: 64,
                  height: rh,
                  background: theme.bar,
                  borderRadius: 3,
                }}
              />
              {i > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: gx + 68,
                    top: 500 - rh,
                    width: 64,
                    height: rh,
                    borderRadius: 3,
                    background: `repeating-linear-gradient(45deg, ${theme.danger}38 0 7px, transparent 7px 18px)`,
                    opacity: penal,
                  }}
                />
              ) : null}
              {/* 实况命中：柱青描边 */}
              <div
                style={{
                  position: 'absolute',
                  left: gx + 168,
                  top: 500 - hh,
                  width: 64,
                  height: hh,
                  boxSizing: 'border-box',
                  border: `2.5px solid ${theme.bar}`,
                  background: `${theme.bar}1A`,
                  borderRadius: 3,
                }}
              />
              {/* 报七成批次：两列柱顶对齐线（p4-21） */}
              {i === 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: gx + 52,
                    top: 500 - HMAX * g.rep - 1,
                    width: 164,
                    borderTop: `2.5px dashed ${theme.bar}`,
                    opacity: 0.6 * align,
                  }}
                />
              ) : null}
              <div
                style={{
                  position: 'absolute',
                  left: gx + 34,
                  top: 506,
                  width: 132,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: i > 0 && penal > 0 ? theme.danger : theme.dim,
                }}
              >
                {g.note}
              </div>
              {i === 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: gx + 134,
                    top: 506,
                    width: 132,
                    textAlign: 'center',
                    fontFamily: theme.mono,
                    fontSize: 16,
                    color: theme.dim,
                  }}
                >
                  0.7
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* p4-23 「对一批」群体框 + 不担保单条 */}
      <div
        style={{
          position: 'absolute',
          left: 425,
          top: 396,
          width: 1040,
          height: 416,
          borderRadius: 14,
          border: `2.5px dashed ${theme.text}66`,
          opacity: batch,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 445,
          top: 382,
          padding: '6px 16px',
          borderRadius: 8,
          border: `2px solid ${theme.text}66`,
          background: theme.panel,
          fontFamily: theme.sans,
          fontSize: 19,
          color: theme.text,
          opacity: batch,
        }}
      >
        对一批 · 不担保单条
      </div>
      {/* p4-20 目标合同三行小卡（贴在记分牌右缘） */}
      {['不写稿', '带概率', '高概率 ↔ 高命中'].map((t, i) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: 1560,
            top: 316 + i * 70,
            padding: '10px 18px',
            borderRadius: 8,
            border: `2px solid ${theme.slot}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: contract[i],
            transform: `translateY(${(1 - contract[i]) * -14}px) rotate(${i % 2 === 0 ? -1.6 : 1.2}deg)`,
          }}
        >
          {t}
        </div>
      ))}
      {/* p4-18 岗前训练场沙盘铺开 */}
      <div style={{position: 'absolute', left: 300, top: 842, width: 1320, height: 58}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `scaleX(${ground})`,
            borderTop: `2px solid ${theme.panelBorder}`,
            background: `repeating-linear-gradient(90deg, ${theme.panelBorder}26 0 2px, transparent 2px 60px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 16,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            opacity: ground,
          }}
        >
          岗前训练场
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-E 装置：校准误差的口径（同一批数据两个出口） ────────────────────────

const EceStage: React.FC<{at24: number; at25: number; at26: number; at27: number}> = ({
  at24,
  at25,
  at26,
  at27,
}) => {
  const node = useEnter('pop', {at: at24, springPreset: 'settle'});
  const pipeU = useDraw(at24 + 12, DUR.f5);
  const pipeL = useDraw(at24 + 20, DUR.f5);
  const slotU = useEnter('rise', {at: at24 + 22, dist: 22, springPreset: 'settle', dur: DUR.f5});
  const slotL = useEnter('rise', {at: at24 + 30, dist: 22, springPreset: 'settle', dur: DUR.f5});
  const numU = useCount({to: 0.246, at: at25, dur: DUR.f5});
  const numL = useCount({to: 0.347, at: at25 + 22, dur: DUR.f5});
  const numUo = useProgress(at25, DUR.f3);
  const numLo = useProgress(at25 + 22, DUR.f3);
  const delta = useProgress(at25 + 50, DUR.f4);
  const dpulse = useImpulse({at: at25 + 50, dur: DUR.f5, peak: 0.5});
  const dim = useDim({at: at26, to: 0.25}); // 徽章组对位时叉路让位压暗
  const conv = useProgress(at26, DUR.f5);
  const kw = useProgress(at26 + 14, DUR.f4);
  const badgeFade = useProgress(at27, DUR.f4);
  const flip = useProgress(at27 + 6, DUR.f5, 'decelerate');
  const tl = useProgress(at27 + 28, DUR.f6);
  const badges = [
    {kind: 'official' as BadgeKind, label: '官方自报', from: [240, 150], to: [560, 470]},
    {kind: 'field' as BadgeKind, label: '外测 · 第三方', from: [1700, 150], to: [845, 470]},
    {kind: 'ours' as BadgeKind, label: '复算 · 我们', from: [960, 980], to: [1130, 470]},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: dim}}>
        {/* 出口分叉（p4-24） */}
        <div
          style={{
            position: 'absolute',
            left: 300,
            top: 430,
            width: 260,
            height: 120,
            borderRadius: 14,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.text,
            opacity: node.opacity,
            transform: node.transform,
          }}
        >
          同一批数据
        </div>
        <svg style={{position: 'absolute', left: 560, top: 260, width: 340, height: 420}} viewBox="0 0 340 420">
          <path d="M 0 210 Q 190 190 340 74" fill="none" stroke={theme.bar} strokeWidth={3} opacity={0.85} {...pipeU} />
          <path d="M 0 250 Q 190 268 340 356" fill="none" stroke={theme.bar} strokeWidth={3} opacity={0.85} {...pipeL} />
        </svg>
        {[
          {label: '算在读数 · confidence', n: numU, o: numUo, e: slotU, top: 265},
          {label: '算在主柱 · p(chosen)', n: numL, o: numLo, e: slotL, top: 555},
        ].map((s) => (
          <div
            key={s.label}
            style={{
              position: 'absolute',
              left: 900,
              top: s.top,
              width: 520,
              height: 130,
              borderRadius: 12,
              border: `2.5px dashed ${theme.bar}`,
              background: '#12161F',
              opacity: s.e.opacity,
              transform: s.e.transform,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div style={{position: 'absolute', left: 18, top: 10, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
              {s.label}
            </div>
            <div
              style={{
                marginLeft: 26,
                fontFamily: theme.mono,
                fontSize: 56,
                color: theme.bar,
                fontVariantNumeric: 'tabular-nums',
                opacity: s.o,
              }}
            >
              {s.n.toFixed(3)}
            </div>
          </div>
        ))}
        {/* 差值高亮（p4-25） */}
        <div style={{position: 'absolute', left: 1452, top: 336, width: 2.5, height: 276, background: theme.bar, opacity: delta}} />
        <div style={{position: 'absolute', left: 1438, top: 336, width: 30, height: 2.5, background: theme.bar, opacity: delta}} />
        <div style={{position: 'absolute', left: 1438, top: 610, width: 30, height: 2.5, background: theme.bar, opacity: delta}} />
        <div
          style={{
            position: 'absolute',
            left: 1470,
            top: 452,
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.bar,
            opacity: delta,
            textShadow: `0 0 ${14 * dpulse}px ${theme.bar}88`,
          }}
        >
          Δ 0.101
        </div>
      </div>
      {/* p4-26 三级角标徽章组飞回画面中央对位 */}
      {badges.map((b) => (
        <ProvenanceBadge
          key={b.kind}
          kind={b.kind}
          label={b.label}
          style={{
            position: 'absolute',
            left: b.from[0] + (b.to[0] - b.from[0]) * conv,
            top: b.from[1] + (b.to[1] - b.from[1]) * conv,
            opacity: conv * (1 - 0.65 * badgeFade),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 830,
          top: 538,
          width: 260,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.text,
          opacity: kw * (1 - 0.65 * badgeFade),
        }}
      >
        又是那枚徽章
      </div>
      {/* p4-27 Brier 彩蛋卡翻出（1950《Mon. Weather Rev.》引用样式） */}
      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 330,
          width: 700,
          height: 310,
          borderRadius: 16,
          border: `2.5px solid ${theme.panelBorder}`,
          background: '#12161F',
          opacity: Math.min(1, flip * 2),
          transform: `perspective(900px) rotateY(${90 - 90 * flip}deg)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text}}>按实况给概率记分</div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
          Brier, 1950 · Monthly Weather Review
        </div>
        <ProvenanceBadge kind="official" label="公开文献" style={{position: 'absolute', right: 20, top: 16}} />
      </div>
      {/* 七十年时间轴细线延展 */}
      <div style={{position: 'absolute', left: 610, top: 700, width: 700 * tl, height: 2, background: `${theme.dim}88`}} />
      <div style={{position: 'absolute', left: 606, top: 696, width: 10, height: 10, borderRadius: 999, background: theme.bar, opacity: tl}} />
      <div style={{position: 'absolute', left: 610, top: 712, fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: tl}}>
        1950
      </div>
      <div style={{position: 'absolute', left: 1272, top: 712, fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: tl}}>
        今天
      </div>
      <div style={{position: 'absolute', left: 935, top: 672, fontFamily: theme.mono, fontSize: 17, color: theme.dim, opacity: tl}}>
        七十多年
      </div>
    </AbsoluteFill>
  );
};

// ── 4-F 装置：训练场收摊 ──────────────────────────────────────────────────

const TeardownStage: React.FC<{at28: number; at29: number}> = ({at28, at29}) => {
  const lift = useProgress(at28, 18, 'accelerate'); // 出场快于入场（EXIT_FACTOR 口径，显式 18 帧）
  const note = useProgress(at28 + 12, DUR.f4);
  const desk = useEnter('rise', {at: at28 + 16, dist: 40, springPreset: 'settle', dur: DUR.f5});
  const shut = Math.min(1, useSpring('snap', {at: at29, dur: DUR.f4})); // 锁扣扣上（钳过冲防穿透）
  const flash = useImpulse({at: at29 + 8, dur: DUR.f3, peak: 1});
  const lockO = useProgress(at29 + 2, DUR.f3);
  const lockLabel = useProgress(at29 + 10, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 记分牌吊离（4-D 的示意缩影） */}
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 330 + -640 * lift,
          width: 400,
          height: 220,
          borderRadius: 14,
          border: `2.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: 1 - lift,
        }}
      >
        <div style={{position: 'absolute', left: 16, top: 12, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
          实况记分牌
        </div>
        {[
          {x: 90, rh: 90, hh: 64},
          {x: 230, rh: 52, hh: 88},
        ].map((p) => (
          <React.Fragment key={p.x}>
            <div style={{position: 'absolute', left: p.x, bottom: 26, width: 34, height: p.rh, background: theme.bar, borderRadius: 2}} />
            <div
              style={{
                position: 'absolute',
                left: p.x + 46,
                bottom: 26,
                width: 34,
                height: p.hh,
                boxSizing: 'border-box',
                border: `2px solid ${theme.bar}`,
                background: `${theme.bar}1A`,
                borderRadius: 2,
              }}
            />
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 292,
          width: 400,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: note,
        }}
      >
        出厂即拆
      </div>
      {/* 判读员工位：只剩读数平线〔M-003〕 */}
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 632,
          width: 1000,
          height: 150,
          borderRadius: 14,
          border: `2px solid ${theme.panelBorder}`,
          background: '#12161F',
          opacity: desk.opacity,
          transform: desk.transform,
        }}
      >
        <div style={{position: 'absolute', left: 60, top: 80, width: 880, borderTop: `3px dashed ${theme.bar}`}} />
        <div style={{position: 'absolute', left: 850, top: 54, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
          confidence
        </div>
      </div>
      {/* 「不再学习」锁扣扣上（p4-29） */}
      <div style={{position: 'absolute', left: 1300, top: 498, opacity: lockO}}>
        <svg width="90" height="100" viewBox="0 0 90 100" style={{filter: `drop-shadow(0 0 ${14 * flash}px ${theme.dim}66)`}}>
          <g transform={`translateY(${-16 * (1 - shut)})`}>
            <path d="M 30 44 V 32 A 15 15 0 0 1 60 32 V 44" fill="none" stroke={theme.dim} strokeWidth={3} />
          </g>
          <rect x={18} y={44} width={54} height={50} rx={8} fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1110,
          top: 536,
          width: 160,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.dim,
          opacity: lockLabel,
        }}
      >
        不再学习
      </div>
    </AbsoluteFill>
  );
};

/** 4-F p4-30 幕末预转：archify 定格后屏幕下缘泛起高原轮廓暗纹（P5 高原的预告）。 */
const PlateauVeil: React.FC<{winDur: number}> = ({winDur}) => {
  const o = useProgress(Math.round(winDur * 0.45), DUR.f5); // 句窗后半泛起，随窗自动重定时
  const skylines = [
    'M -10 300 L -10 210 L 240 210 L 330 150 L 820 150 L 940 230 L 1930 230 L 1930 300',
    'M -10 300 L -10 262 L 540 262 L 640 205 L 1330 205 L 1440 258 L 1930 258 L 1930 300',
    'M -10 300 L -10 278 L 700 278 L 800 238 L 1520 238 L 1620 272 L 1930 272 L 1930 300',
  ];
  return (
    <svg
      style={{position: 'absolute', left: 0, top: 780, width: 1920, height: 300, opacity: o, pointerEvents: 'none'}}
      viewBox="0 0 1920 300"
    >
      {skylines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={theme.dim} strokeWidth={2} opacity={0.22 - i * 0.06} />
      ))}
    </svg>
  );
};

// ── 幕组装 ────────────────────────────────────────────────────────────────

export const P4Readout: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-07');
  const bB = w('p4-08', 'p4-10');
  const bC = w('p4-11', 'p4-16');
  const bD = w('p4-17', 'p4-23');
  const bE = w('p4-24', 'p4-27');
  const bF = w('p4-28', 'p4-30');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 柱高与咔哒栏">
        <SceneTag chapter="P4" tagline="柱高与计算栏" accent={theme.bar} />
        <ArchifyYield
          cues={[
            {at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')},
            {at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
            {at: at('p4-05') - bA.from, durationInFrames: dur('p4-05')},
          ]}>
          <RowStage
            at02={at('p4-02') - bA.from}
            at04={at('p4-04') - bA.from}
            at06={at('p4-06') - bA.from}
            at07={at('p4-07') - bA.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="lesions-to-specs"
          caption="机制地图 · m1-m4"
          cues={[{chapterId: 'ls-mech', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')}]}
        />
        <ArchifyRecap
          slug="readout-pipeline"
          caption="概率柱 → 计算栏"
          cues={[
            {chapterId: 'rp-probs', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
            {chapterId: 'rp-formula', at: at('p4-05') - bA.from, durationInFrames: dur('p4-05')},
          ]}
        />
        <Sequence {...w('p4-01')} name="4-A 机制三角标">
          <CornerTag
            at={6}
            accent={theme.slot}
            main={
              <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>机制三</span>
            }
            sub="m3"
          />
        </Sequence>
        <Sequence {...w('p4-05')} name="4-A 公式角标">
          <CornerTag
            at={8}
            accent={theme.bar}
            main={
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>
                {'(p_max − 1/K) / (1 − 1/K)'}
              </span>
            }
            sub="官方参考代码 · MIT"
          />
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="4-B 复算一位不差">
        <SceneTag chapter="P4" tagline="柱高与计算栏" accent={theme.bar} />
        <VerifyStage at08={at('p4-08') - bB.from} at09={at('p4-09') - bB.from} at10={at('p4-10') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="4-C 同一读数两种含金量">
        <SceneTag chapter="P4" tagline="柱高与计算栏" accent={theme.bar} />
        <ArchifyYield
          cues={[
            {at: at('p4-13') - bC.from, durationInFrames: dur('p4-13')},
            {at: at('p4-16') - bC.from, durationInFrames: dur('p4-16')},
          ]}>
          <KStage
            at11={at('p4-11') - bC.from}
            at12={at('p4-12') - bC.from}
            at14={at('p4-14') - bC.from}
            at15={at('p4-15') - bC.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="readout-pipeline"
          caption="K 依赖 → 门槛消费"
          cues={[
            {chapterId: 'rp-k', at: at('p4-13') - bC.from, durationInFrames: dur('p4-13')},
            {chapterId: 'rp-gate', at: at('p4-16') - bC.from, durationInFrames: dur('p4-16')},
          ]}
        />
        <Sequence {...w('p4-16')} name="4-C 门槛关键词">
          <CornerTag
            at={8}
            accent={theme.gate}
            main={<span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>量形状 · 非答对</span>}
            sub="readout → gate"
          />
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="4-D 岗前记分牌">
        <SceneTag chapter="P4" tagline="柱高与计算栏" accent={theme.bar} />
        <ArchifyYield cues={[{at: at('p4-19') - bD.from, durationInFrames: dur('p4-19')}]}>
          <ScoreboardStage
            at18={at('p4-18') - bD.from}
            at20={at('p4-20') - bD.from}
            at21={at('p4-21') - bD.from}
            at22={at('p4-22') - bD.from}
            at23={at('p4-23') - bD.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="rlhf-rlvr-rlcd"
          caption="后训练三路 · RLCD 路"
          cues={[{chapterId: 'tr-rlcd', at: at('p4-19') - bD.from, durationInFrames: dur('p4-19')}]}
        />
        <Sequence {...w('p4-19')} name="4-D RLCD 角标">
          <CornerTag
            at={8}
            accent={theme.bar}
            main={<span style={{fontFamily: theme.mono, fontSize: 26, color: theme.text}}>RLCD</span>}
            sub="为校准决策 · 强化学习"
          />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="4-E 校准误差的口径">
        <SceneTag chapter="P4" tagline="柱高与计算栏" accent={theme.bar} />
        <EceStage
          at24={at('p4-24') - bE.from}
          at25={at('p4-25') - bE.from}
          at26={at('p4-26') - bE.from}
          at27={at('p4-27') - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 记分牌拆除">
        <SceneTag chapter="P4" tagline="柱高与计算栏" accent={theme.bar} />
        <ArchifyYield cues={[{at: at('p4-30') - bF.from, durationInFrames: dur('p4-30')}]}>
          <TeardownStage at28={at('p4-28') - bF.from} at29={at('p4-29') - bF.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="calibration-territory"
          caption="校准领地"
          cues={[{chapterId: 'ct-in', at: at('p4-30') - bF.from, durationInFrames: dur('p4-30')}]}
        />
        <Sequence {...w('p4-30')} name="4-F 高原暗纹">
          <PlateauVeil winDur={dur('p4-30')} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
