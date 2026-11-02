/** P3 只回结论（p3-01..p3-08，3 镜）——分镜 3-A / 3-B / 3-C（全片张力峰值幕）。
 *
 *  叙事链：3-A 实验装置卡（每幕首镜全景坐标锚）：两室剖面原位回归 + 回流通道
 *  中段「规矩开关」新增件——左档「只回结论」（extract_text）/ 右档「回传全部
 *  子历史」（return sub_history）；「拿实验说话」开关高亮圈亮起 →「原样搬回」
 *  拨杆拨到右档、通道瞬间变粗（变粗前后同一路径）→「十六条、两千六百四十九
 *  字符」子历史整列沿粗通道涌入主会场：主会场条数跳 16、字符计跳 2649、警示
 *  红沿面板边缘泛起（落账计数以口播十六/2649 为准）→ 3-B 左红右绿消融同屏
 *  （@pushIn 压向 ×18）：右轨「只回结论在位」4 条/147 字符（确认绿边）、左轨
 *  「回传全史」16 条/2649 字符（警示红边），每轨各配缩微两室剖面（通道粗细=
 *  唯一变量）；「差出十八倍」中央 ×18 大数字 punch（角标 2649÷147）；「就回流
 *  那步松了手」两轨回流通道同位对比闪高亮（其余装置同构静置）；「十二条」左
 *  轨多出 12 条消息条逐条点亮（4→16 差值具象）、「灌满主对话」条顶触顶溢出
 *  一拍 → 3-C 金句卡（衬线体）「只回结论 · 存亡线」两关键词各压一拍重读定格
 *  （caption-dup-ok：收束定格仪式，承 ep1/ep2 5-A 豁免先例）；随即拉回两室
 *  剖面——两室之间的墙被高亮打上问号、墙体隐约透出「白板」半透明暗纹
 *  （欲显未显——P4 主角预显〔M-006〕）。
 *
 *  空间契约：红左绿右恒定、双轨除回流步外全同构（唯一变量的可核对判据）、
 *  ×18 与 2649÷147 口径一致、通道变粗前后同一路径、白板仅暗纹不亮起、问号
 *  落在墙上。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；extract_text /
 *  return sub_history 只进角标；数值元素钳制禁过冲（×18 弹跳只作用 scale、
 *  读数恒定）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ConclusionCard, MeetingRooms, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 剖面全局位（承 P1/P2——原位回归加开关，装置本身上做实验） */
const STAGE = {x: 230, y: 210, w: 1460, h: 560} as const;

// ── 3-A 规矩开关 + 回传全史灌满 ──────────────────────────────────────────

const ThreeA: React.FC<{atSpot: number; atFlip: number; atFlood: number; atCount: number; atDanger: number}> = ({
  atSpot,
  atFlip,
  atFlood,
  atCount,
  atDanger,
}) => {
  const frame = useCurrentFrame();
  // 「拿实验说话」开关装置高亮圈亮起
  const spot = useImpulse({at: atSpot, dur: DUR.f6, peak: 1});
  const switchLit = useProgress(atSpot - DUR.f4, DUR.f4);
  // 「原样搬回」拨杆拨到右档 + 通道变粗（同一路径——粗细是唯一变量）
  const flip = useProgress(atFlip, DUR.f4, 'accelerate');
  // 「十六条」子历史整列沿粗通道涌入主会场（紫室排空 → 主会场灌满——连续转移）
  const flood = useProgress(atFlood, DUR.f6 + DUR.f4, 'linear');
  const roomBars = 16 * (1 - flood);
  const leftBars = 4 + 12 * flood;
  // 落账双计数（跳 16 / 跳 2649——读数钳制、以口播为准）
  const cnt = clamp01(progress(frame, atCount, DUR.f5));
  const chars = clamp01(progress(frame, atCount + DUR.f4, DUR.f6));
  // 警示红沿面板边缘泛起（持续态——泛起后保持）
  const danger = useProgress(atDanger, DUR.f5);
  return (
    <AbsoluteFill>
      <MeetingRooms
        x={STAGE.x}
        y={STAGE.y}
        w={STAGE.w}
        h={STAGE.h}
        rightOpen={1}
        leftBars={leftBars}
        counterVal={16 * cnt}
        counterFlash={cnt}
        leftDanger={danger}
        leftOverflow={danger * 0.8}
        roomBars={roomBars}
        roomClear={0}
        ringLit={0}
        channelThick={flip}
        channelFlow={flood}
        switchLit={switchLit}
        switchPos={flip}
        switchFlash={spot}
      />
      {/* 开关高亮圈（「拿实验说话」——实验装置聚光） */}
      {spot > 0.03 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle
            cx={STAGE.x + STAGE.w / 2}
            cy={STAGE.y + STAGE.h * 0.4 - 46}
            r={150 + 60 * (1 - spot)}
            fill="none"
            stroke={theme.text}
            strokeWidth={3}
            strokeDasharray="14 10"
            opacity={0.7 * spot}
          />
        </svg>
      ) : null}
      {/* 字符计读数（跳 2649——警示红口径） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.x + STAGE.w - 320,
          top: STAGE.y + 84,
          padding: '6px 16px',
          borderRadius: 9,
          border: `2.5px solid ${danger > 0.4 ? theme.danger : theme.panelBorder}`,
          background: theme.panel,
          fontFamily: theme.mono,
          fontSize: 22,
          fontWeight: 700,
          color: danger > 0.4 ? theme.danger : theme.dim,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          opacity: cnt,
        }}
      >
        {`${Math.round(2649 * chars)} 字符`}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'实验 · 回传全部子历史'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 左红右绿消融同屏（全片张力峰值） ─────────────────────────────────

/** 单轨（缩微两室剖面 + 双计数 + 轨名——除回流步外全同构） */
const Track: React.FC<{
  x: number;
  tag: string;
  sub: string;
  accent: string;
  lit: number;
  bars: number;
  counter: number;
  chars: number;
  valP: number;
  thick: number;
  channelFlash: number;
  overflow: number;
  cardFly: number;
}> = ({x, tag, sub, accent, lit, bars, counter, chars, valP, thick, channelFlash, overflow, cardFly}) => (
  <div style={{position: 'absolute', left: x, top: 170, width: 800, opacity: 0.3 + 0.7 * clamp01(lit)}}>
    <Panel accent={accent} style={{width: '100%', height: 620, boxSizing: 'border-box', position: 'relative'}}>
      {/* 头行：轨名 + 工况角标 */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14, padding: '14px 20px 0'}}>
        <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: accent}}>{tag}</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 13,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 6,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </span>
      </div>
      {/* 双计数（条 / 字符——红左绿右各随其轨） */}
      <div style={{display: 'flex', gap: 26, padding: '10px 20px 0'}}>
        {[
          {label: '条', val: counter},
          {label: '字符', val: chars},
        ].map((c) => (
          <div key={c.label} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{c.label}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 26,
                fontWeight: 700,
                color: theme.text,
                fontVariantNumeric: 'tabular-nums',
                opacity: clamp01(valP),
              }}
            >
              {String(Math.round(c.val))}
            </span>
          </div>
        ))}
      </div>
      {/* 缩微两室剖面（通道粗细=唯一变量；其余同构） */}
      <div style={{position: 'absolute', left: 46, top: 190}}>
        <MeetingRooms
          x={0}
          y={0}
          w={700}
          h={280}
          scale={0.99}
          showTools={false}
          leftBars={bars}
          counterVal={0}
          roomBars={0}
          ringLit={0}
          channelThick={thick}
          channelFlow={0.4}
          leftOverflow={overflow}
          flyReturn={cardFly}
        />
      </div>
      {/* 回流通道同位对比闪高亮（「就回流那步松了手」——两轨同位同拍） */}
      {channelFlash > 0.03 ? (
        <svg width={800} height={620} viewBox="0 0 800 620" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={400} cy={190 + 280 * 0.4 + 20} r={70 + 30 * channelFlash} fill="none" stroke={accent} strokeWidth={3.5} opacity={0.8 * channelFlash} />
        </svg>
      ) : null}
    </Panel>
  </div>
);

const ThreeB: React.FC<{atRight: number; atX18: number; atFlash: number; atPlus12: number; atOverflow: number}> = ({
  atRight,
  atX18,
  atFlash,
  atPlus12,
  atOverflow,
}) => {
  const frame = useCurrentFrame();
  // 右轨双计数落定（绿——规矩在位）
  const right = useProgress(atRight, DUR.f5);
  // ×18 大数字 punch（1–2s 重音镜：放大弹出回弹定格——弹跳只作用 scale、
  // 读数恒定 18，数据本体红线）
  const pop = useImpulse({at: atX18, dur: DUR.f6 + DUR.f4, peak: 0.14});
  const x18 = useProgress(atX18, DUR.f5);
  const x18Hold = useProgress(atX18 - DUR.f4, DUR.f4);
  // 两轨回流通道同位对比闪高亮（其余装置同构静置）
  const flash = useImpulse({at: atFlash, dur: DUR.f6, peak: 1});
  // 左轨多出 12 条逐条点亮（4→16 差值具象）+ 条顶触顶溢出一拍；左轨双计数在
  // ×18 揭示前先落定（比值可读），差值条形到 p3-06 才点亮
  const plus12 = clamp01(progress(frame, atPlus12, DUR.f6));
  const leftBars = 4 + 12 * plus12;
  const overflow = useImpulse({at: atOverflow, dur: DUR.f5, peak: 1});
  const leftVal = clamp01(progress(frame, atX18 - DUR.f5, DUR.f5));
  // @pushIn：数字揭示压向 ×18
  const push = usePushIn(atX18 - DUR.f5, {scale: 0.05, dur: DUR.f6});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '50% 50%'}}>
        {/* 左轨（红——回传全史） */}
        <Track
          x={110}
          tag={'回传全史'}
          sub={'return sub_history'}
          accent={theme.danger}
          lit={1}
          bars={leftBars}
          counter={16 * leftVal}
          chars={2649 * leftVal}
          valP={Math.max(leftVal, 0)}
          thick={1}
          channelFlash={flash}
          overflow={overflow}
          cardFly={0}
        />
        {/* 右轨（绿——只回结论在位） */}
        <Track
          x={1010}
          tag={'只回结论在位'}
          sub={'extract_text'}
          accent={theme.ok}
          lit={1}
          bars={4}
          counter={4}
          chars={147}
          valP={right}
          thick={0}
          channelFlash={flash}
          overflow={0}
          cardFly={right > 0.5 ? 0.6 : 0}
        />
        {/* 中央 ×18 大数字位（角标 2649÷147——口径一致） */}
        <div
          style={{
            position: 'absolute',
            left: 810,
            top: 340,
            width: 300,
            textAlign: 'center',
            opacity: x18 * x18Hold + 0.0,
            transform: `scale(${1 + pop})`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 110, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1, textShadow: `0 0 ${36 * x18}px ${withAlpha(theme.danger, 0.4)}`}}>
            {'×18'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 10, opacity: x18}}>{'2649 ÷ 147'}</div>
        </div>
      </div>
      {/* 右轨结论卡微注（通道细、仅结论卡——同构对照的唯一回流形态） */}
      <div style={{position: 'absolute', left: 1010, top: 130, opacity: right}}>
        <ConclusionCard x={0} y={0} w={280} h={44} lit={right} text={'一条结论'} tag={''} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'消融对照 · 唯一变量在回流'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 金句卡 + 墙体问号 + 白板暗纹 ────────────────────────────────────

const ThreeC: React.FC<{atCard: number; atK1: number; atK2: number; atPull: number; atQ: number; atGhost: number}> = ({
  atCard,
  atK1,
  atK2,
  atPull,
  atQ,
  atGhost,
}) => {
  // 金句卡淡入（衬线体——收束定格仪式）
  const card = useProgress(atCard, DUR.f6);
  // 「只回结论」「存亡线」两关键词各压一拍重读
  const k1 = useImpulse({at: atK1, dur: DUR.f6, peak: 0.06});
  const k2 = useImpulse({at: atK2, dur: DUR.f6, peak: 0.06});
  const k1Glow = useProgress(atK1, DUR.f5);
  const k2Glow = useProgress(atK2, DUR.f5);
  // 拉回两室剖面（金句卡缩位让景）
  const pull = useProgress(atPull, DUR.f6, 'decelerate');
  // 墙体问号亮起 + 白板半透明暗纹透出（欲显未显——P4 主角预显）
  const q = useProgress(atQ, DUR.f5);
  const ghost = useProgress(atGhost, DUR.f5);
  const quoteScale = 1 - 0.45 * pull;
  const quoteX = 660 - 480 * pull;
  const quoteY = 300 - 220 * pull;
  return (
    <AbsoluteFill>
      {/* 金句卡（衬线体为唯一主体时段 → 拉回时缩位左上角让景） */}
      <div style={{position: 'absolute', left: quoteX, top: quoteY, transform: `scale(${quoteScale})`, transformOrigin: 'left top', opacity: card}}>
        <Panel accent={theme.steel} style={{padding: '40px 60px', display: 'inline-block'}}>
          <div style={{fontFamily: theme.serif, fontSize: 58, color: theme.text, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
            {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1 5-A / ep2 5-A 豁免先例） */}
            <span style={{fontWeight: 700, color: theme.steel, display: 'inline-block', transform: `scale(${1 + k1})`, textShadow: k1Glow > 0.01 ? `0 0 ${24 * k1Glow}px ${withAlpha(theme.steel, 0.5)}` : 'none'}}>
              {'只回结论'}
            </span>
            <span style={{color: theme.dim}}>{' · '}</span>
            <span style={{fontWeight: 700, color: theme.steel, display: 'inline-block', transform: `scale(${1 + k2})`, textShadow: k2Glow > 0.01 ? `0 0 ${24 * k2Glow}px ${withAlpha(theme.steel, 0.5)}` : 'none'}}>
              {'存亡线'}
            </span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 14}}>{'主对话上下文 · 基线'}</div>
        </Panel>
      </div>
      {/* 两室剖面（拉回归位——墙被高亮打上问号、白板暗纹透出） */}
      <div style={{position: 'absolute', left: 370, top: 330, opacity: pull * 0.95}}>
        <MeetingRooms x={0} y={0} w={1180} h={470} scale={0.82} leftBars={4} counterVal={4} roomBars={0} ringLit={0} wallQ={q} wallBoard={0.18 * ghost} />
      </div>
      {/* 墙注（角标——隔住的比你想的少） */}
      <div style={{position: 'absolute', left: 930, top: 300, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: q * pull, whiteSpace: 'nowrap'}}>
        {'这面墙 · ?'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * pull}}>
        {'剖面 · 墙体预显'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3ConclusionAblation: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-06');
  const bC = w('p3-07', 'p3-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atSpot={wa('p3-01', 0.66) - bA.from}
          atFlip={wa('p3-02', 0.6) - bA.from}
          atFlood={wa('p3-03', 0.3) - bA.from}
          atCount={wa('p3-03', 0.34) - bA.from}
          atDanger={wa('p3-03', 0.62) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atRight={wa('p3-04', 0.24) - bB.from}
          atX18={wa('p3-04', 0.62) - bB.from}
          atFlash={wa('p3-05', 0.6) - bB.from}
          atPlus12={wa('p3-06', 0.16) - bB.from}
          atOverflow={wa('p3-06', 0.66) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atCard={wa('p3-07', 0.14) - bC.from}
          atK1={wa('p3-07', 0.42) - bC.from}
          atK2={wa('p3-07', 0.74) - bC.from}
          atPull={wa('p3-08', 0.18) - bC.from}
          atQ={wa('p3-08', 0.42) - bC.from}
          atGhost={wa('p3-08', 0.72) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3ConclusionAblation;
