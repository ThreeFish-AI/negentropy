/** P2 收件格与派工单（p2-01..32，8 镜 14 cue）——分镜 2-A…2-H。
 *
 *  装置重心：对照卡组（临时工 vs 常驻四轴 / 工具单对开）、副台渐变卡、
 *  权限冒泡链路图；mech 金 = 一切「多人共用」的挂载装置；人色节点（用户）恒 dim。
 *  archify 三图（mailbox-consume / protocol-roundtrip / protocol-fsm）全屏独占：
 *    一章锚一句；跨实例背靠背后挂实例关入场；空窗后重现默认入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, useBreathe, useDraw, useEnter, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';

/** 常驻系列条定位（与 P1 同值，由组装方统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── mono 引语卡（官方引语共用形态） ─────────────────────────────────────

const MonoQuote: React.FC<{
  badge: string;
  badgeColor: string;
  line1: string;
  line2?: string;
  at: number;
  cps?: number;
  width?: number;
}> = ({badge, badgeColor, line1, line2, at, cps = 15, width = 1180}) => {
  const card = useEnter('fade', {at, dur: DUR.f5});
  const r1 = useReveal(line1, {at: at + 4, cps});
  const r2 = useReveal(line2 ?? '', {at: at + DUR.f5, cps});
  return (
    <div style={{...card}}>
      <Panel style={{width, padding: '26px 38px'}}>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 22,
            color: badgeColor,
            border: `2px solid ${badgeColor}`,
            borderRadius: 6,
            padding: '2px 10px',
          }}
        >
          {badge}
        </span>
        <div style={{fontFamily: theme.mono, fontSize: 38, lineHeight: 1.7, marginTop: 18, minHeight: 130}}>
          <span style={{fontFamily: theme.serif, fontSize: 56, color: theme.panelBorder}}>{'“'}</span>
          <div style={{color: theme.text, whiteSpace: 'pre'}}>{r1}</div>
          {line2 ? (
            <div style={{color: theme.mech, whiteSpace: 'pre'}}>{r2}</div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
};

/** 师傅/队友剪影（无彩：text 白 / dim 灰）——头圆 + 肩身 */
const Silhouette: React.FC<{color?: string; size?: number; opacity?: number}> = ({
  color = theme.text,
  size = 1,
  opacity = 0.92,
}) => (
  <svg width={70 * size} height={118 * size} style={{overflow: 'visible'}}>
    <circle cx={35 * size} cy={22 * size} r={19 * size} fill={color} opacity={opacity} />
    <path
      d={`M${7 * size} ${104 * size} Q${7 * size} ${42 * size} ${35 * size} ${38 * size} Q${63 * size} ${42 * size} ${63 * size} ${104 * size} Z`}
      fill={color}
      opacity={opacity}
    />
  </svg>
);

// ── 2-A 组队动机：临时工 vs 常驻同事 ────────────────────────────────────

/** 四轴对照（中缝轴名 + 左右值行），行点亮由 stagger 注入 */
const AXIS_ROWS = [
  {axis: '生命周期', temp: '干完即走', perm: '常驻'},
  {axis: '通信', temp: '不能', perm: '能传话'},
  {axis: '上下文', temp: '一次性', perm: '共享'},
  {axis: '数量', temp: '一个一个', perm: '多个并行'},
] as const;

const TeamSetup: React.FC<{atTemp: number; atPerm: number; atOrg: number}> = ({
  atTemp,
  atPerm,
  atOrg,
}) => {
  const hatIn = useProgress(4, DUR.f4);
  const left = useEnter('slideL', {at: atTemp, dur: DUR.f5, dist: 120, springPreset: 'settle'});
  const right = useEnter('slideR', {at: atPerm, dur: DUR.f5, dist: 120, springPreset: 'settle'});
  const rows = useStagger(AXIS_ROWS.length, {at: atPerm + 4, stride: 7, dur: DUR.f4});
  // 两常驻工位自下缘升起（restBottom 钳进行程——安全带构造性保证）
  const seatL = useEnter('rise', {at: atOrg, dur: DUR.f5, dist: 60, restBottom: 880});
  const seatR = useEnter('rise', {at: atOrg + 5, dur: DUR.f5, dist: 60, restBottom: 880});
  const orgIn = useProgress(atOrg, DUR.f4);

  // 对照卡 header（两行等高，保证左右卡与中缝三列行对齐）
  const header = (title: string, en: string, hot: boolean) => (
    <div style={{height: 72}}>
      <div
        style={{
          fontFamily: theme.sans,
          fontSize: 32,
          fontWeight: 700,
          color: hot ? theme.mech : theme.dim,
        }}
      >
        {title}
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 2}}>{en}</div>
    </div>
  );

  return (
    <AbsoluteFill>
      <SceneTag chapter="收件格与派工单" tagline="传话看编号" />

      {/* 领队帽（中央上缘挂入——空间契约） */}
      <div style={{position: 'absolute', left: 960 - 90, top: 120, opacity: hatIn}}>
        <svg width={180} height={92}>
          <path d="M30 84 L90 18 L150 84 Z" fill="none" stroke={theme.mech} strokeWidth={5} />
          <line x1={12} y1={84} x2={168} y2={84} stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: -40,
            top: 92,
            width: 260,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
          }}
        >
          {'领队'}
        </div>
      </div>

      {/* 编制卡（p2-04） */}
      <div style={{position: 'absolute', left: 960 - 250, top: 216, opacity: orgIn}}>
        <Panel accent={theme.mech} style={{width: 500, padding: '10px 0', textAlign: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 32, fontWeight: 700, color: theme.mech}}>
            {'一领队 · 多队友'}
          </span>
        </Panel>
      </div>

      {/* 对照卡对开：左临时工（slideL）/ 右常驻同事（slideR）＋中缝四轴 */}
      <div style={{position: 'absolute', left: 250, top: 360, ...left}}>
        <Panel style={{width: 620, padding: '20px 26px'}}>
          {header('临时工', 'subagent', false)}
          {AXIS_ROWS.map((r, i) => (
            <div
              key={r.axis}
              style={{
                height: 56,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.dim,
                opacity: rows[i],
                transform: `translateY(${(1 - rows[i]) * 10}px)`,
              }}
            >
              {r.temp}
            </div>
          ))}
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1050, top: 360, ...right}}>
        <Panel accent={theme.mech} style={{width: 620, padding: '20px 26px'}}>
          {header('常驻同事', 'teammate', true)}
          {AXIS_ROWS.map((r, i) => (
            <div
              key={r.axis}
              style={{
                height: 56,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                fontFamily: theme.sans,
                fontSize: 26,
                color: theme.text,
                opacity: rows[i],
                transform: `translateY(${(1 - rows[i]) * 10}px)`,
              }}
            >
              {r.perm}
            </div>
          ))}
        </Panel>
      </div>
      {/* 中缝轴名（与值行逐行对齐：卡 top + padding + header 72 + 首 8 间距） */}
      <div style={{position: 'absolute', left: 880, top: 360 + 20 + 72, width: 160}}>
        {AXIS_ROWS.map((r, i) => (
          <div
            key={r.axis}
            style={{
              height: 56,
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.dim,
              opacity: rows[i],
            }}
          >
            {r.axis}
          </div>
        ))}
      </div>

      {/* 两常驻工位（mech 金工位，自下缘升起；bottom 880 避开字幕带与 Footnote） */}
      <div style={{position: 'absolute', left: 470, top: 720, ...seatL}}>
        <Panel accent={theme.mech} style={{width: 300, height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12}}>
          <div style={{transform: 'scale(0.82)'}}>
            <Silhouette />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 10,
              width: '100%',
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.mech,
            }}
          >
            {'工位'}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1150, top: 720, ...seatR}}>
        <Panel accent={theme.mech} style={{width: 300, height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 12}}>
          <div style={{transform: 'scale(0.82)'}}>
            <Silhouette />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 10,
              width: '100%',
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.mech,
            }}
          >
            {'工位'}
          </div>
        </Panel>
      </div>

      <Footnote delay={6}>{'Lead · subagent → teammate'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-B 实验标签 ────────────────────────────────────────────────────────

const ExperimentalTag: React.FC<{atMotto: number}> = ({atMotto}) => {
  const badge = useEnter('fade', {at: 8, dur: DUR.f4});
  // 徽标一次性脉冲（scale 冲击——spatial 通道可用）
  const pulse = useImpulse({at: 8 + DUR.f5, dur: DUR.f5, peak: 0.12});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 960 - 590, top: 260}}>
        <MonoQuote
          badge="官"
          badgeColor={theme.core}
          line1={'Agent teams are experimental'}
          line2={'and disabled by default'}
          at={2}
        />
      </div>
      {/* 「实验标签」徽标：mech 描边细态 + 脉冲 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 160,
          top: 620,
          opacity: badge.opacity,
          transform: `scale(${1 + pulse})`,
        }}
      >
        <div
          style={{
            padding: '10px 44px',
            borderRadius: 999,
            border: `2px solid ${theme.mech}`,
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 600,
            color: theme.mech,
            letterSpacing: 2,
          }}
        >
          {'实验标签'}
        </div>
      </div>
      <Sequence from={atMotto} layout="none">
        <QuoteCard zh="机制真 · 标签实验" />
      </Sequence>
      <Footnote delay={6}>{'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 工具单对开 ──────────────────────────────────────────────────────

const MATE_TOOLS = ['干活', '读写', '传话'] as const;
const LEAD_TOOLS = ['招队友', '开活', '批单'] as const;
/** 队友单里「没有」的两件（ghost 行 + deny 删除线） */
const GHOST_TOOLS = ['招队友', '开新活'] as const;

const ToolSheet: React.FC<{atSheet: number; atStrike: number; atMotto: number}> = ({
  atSheet,
  atStrike,
  atMotto,
}) => {
  const left = useEnter('slideL', {at: atSheet, dur: DUR.f5, dist: 120, springPreset: 'settle'});
  const right = useEnter('slideR', {at: atSheet + 4, dur: DUR.f5, dist: 120, springPreset: 'settle'});
  const strike = useProgress(atStrike, DUR.f5);
  const rows = useStagger(MATE_TOOLS.length, {at: atSheet + 6, stride: 6, dur: DUR.f4});
  const leadRows = useStagger(LEAD_TOOLS.length, {at: atSheet + 10, stride: 6, dur: DUR.f4});

  return (
    <AbsoluteFill>
      {/* 左：队友的单（干得活的） + 没有的两件（ghost + 删除线） */}
      <div style={{position: 'absolute', left: 330, top: 240, ...left}}>
        <Panel accent={theme.mech} style={{width: 560, padding: '22px 30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.mech}}>
              {'队友的单'}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'sub_tools'}</span>
          </div>
          {MATE_TOOLS.map((t, i) => (
            <div
              key={t}
              style={{
                height: 58,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                borderLeft: `4px solid ${theme.mech}`,
                borderRadius: 6,
                fontFamily: theme.sans,
                fontSize: 27,
                color: theme.text,
                opacity: rows[i],
              }}
            >
              {t}
            </div>
          ))}
          {/* 缺席的两件：ghost 虚框 + deny 删除线（发都没发给他） */}
          {GHOST_TOOLS.map((t, i) => (
            <div
              key={t}
              style={{
                height: 58,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                borderRadius: 6,
                border: `2px dashed ${theme.panelBorder}`,
                position: 'relative',
                fontFamily: theme.sans,
                fontSize: 27,
                color: theme.dim,
                opacity: 0.75,
              }}
            >
              {t}
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  height: 3,
                  width: `${Math.min(1, Math.max(0, strike - i * 0.2) / 0.8) * 62}%`,
                  background: theme.deny,
                  borderRadius: 2,
                }}
              />
            </div>
          ))}
        </Panel>
      </div>

      {/* 右：领队的单 */}
      <div style={{position: 'absolute', left: 1030, top: 240, ...right}}>
        <Panel style={{width: 560, padding: '22px 30px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>
            {'领队的单'}
          </div>
          {LEAD_TOOLS.map((t, i) => (
            <div
              key={t}
              style={{
                height: 58,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                borderLeft: `4px solid ${theme.panelBorder}`,
                borderRadius: 6,
                fontFamily: theme.sans,
                fontSize: 27,
                color: theme.text,
                opacity: leadRows[i],
              }}
            >
              {t}
            </div>
          ))}
        </Panel>
      </div>

      <Sequence from={atMotto} layout="none">
        <QuoteCard zh="不拦 · 没发" />
      </Sequence>
      <Footnote delay={atSheet}>{'sub_tools · create_task'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-E 副台渐变：挂牌翻转 + 光谱条 ─────────────────────────────────────

const NameSpectrum: React.FC<{atFlip: number; atSpectrum: number}> = ({atFlip, atSpectrum}) => {
  const quoteIn = useProgress(2, DUR.f4);
  // 引语逐字（官方口径；后半句 mech 强调段延迟起）
  const r1 = useReveal('命名副台可按名 resume，', {at: 6, cps: 13});
  const r2 = useReveal('保留完整对话史', {at: 6 + DUR.f6, cps: 11});
  const flip = useSpring('settle', {at: atFlip, dur: DUR.f6});
  // 翻转读法：scaleX 沿翻轴压缩再展开；过半切换挂牌文字
  const faceB = flip > 0.5 ? 1 : 0;
  const scaleX = Math.abs(Math.cos(Math.PI * flip));
  const beam = useDraw(atSpectrum, DUR.f6);
  const capL = useProgress(atSpectrum + DUR.f5, DUR.f4);
  const capR = useProgress(atSpectrum + DUR.f5 + 6, DUR.f4);
  const midIn = useProgress(atSpectrum + DUR.f6, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 官方引语卡（mono 引语态，逐字） */}
      <div style={{position: 'absolute', left: 960 - 520, top: 170, opacity: quoteIn}}>
        <Panel style={{width: 1040, padding: '24px 38px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.core,
                border: `2px solid ${theme.core}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'官'}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 34, color: theme.text}}>{'“'}</span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 36, lineHeight: 1.6, color: theme.text, marginTop: 8}}>
            <span style={{whiteSpace: 'pre'}}>{r1}</span>
            <span style={{color: theme.mech, whiteSpace: 'pre'}}>{r2}</span>
          </div>
        </Panel>
      </div>

      {/* 挂牌两态翻转：无名一次性 → 挂名按名叫醒 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 170,
          top: 470,
          width: 340,
          transform: `scaleX(${Math.max(0.04, scaleX)})`,
        }}
      >
        <div
          style={{
            padding: '26px 0',
            textAlign: 'center',
            borderRadius: 12,
            background: faceB ? withAlpha(theme.mechDeep, 0.4) : theme.panel,
            border: `3px solid ${faceB ? theme.mech : theme.panelBorder}`,
          }}
        >
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 34,
              fontWeight: 700,
              color: faceB ? theme.mech : theme.dim,
            }}
          >
            {faceB ? '挂名 · 记忆全留' : '无名 · 一次性'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
            {faceB ? 'resume' : 'use-and-forget'}
          </div>
        </div>
      </div>

      {/* 二分 → 渐变光谱条：左临时工 / 右常驻，中点「起名」 */}
      <div style={{position: 'absolute', left: 960 - 480, top: 760, width: 960}}>
        <svg width={960} height={40}>
          {/* 渐变段：中段 mech 高亮（起名把两态连成光谱） */}
          <defs>
            <linearGradient id="spectrum-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={theme.panelBorder} />
              <stop offset="0.42" stopColor={theme.panelBorder} />
              <stop offset="0.5" stopColor={theme.mech} />
              <stop offset="0.58" stopColor={theme.panelBorder} />
              <stop offset="1" stopColor={theme.panelBorder} />
            </linearGradient>
          </defs>
          <line
            x1={0}
            y1={20}
            x2={960}
            y2={20}
            stroke="url(#spectrum-grad)"
            strokeWidth={6}
            strokeLinecap="round"
            {...beam}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 34,
            width: 220,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
            opacity: capL,
          }}
        >
          {'临时工'}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 34,
            width: 220,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
            opacity: capR,
          }}
        >
          {'常驻同事'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 960 / 2 - 60,
            top: -34,
            width: 120,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 600,
            color: theme.mech,
            opacity: midIn,
          }}
        >
          {'起名'}
        </div>
      </div>

      <Footnote delay={4}>{'subagent names · resume'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-F p2-18 引子：凭证位虚线框 ────────────────────────────────────────

const VoucherStub: React.FC = () => {
  const draw = useDraw(4, DUR.f6);
  const done = useProgress(4 + DUR.f6, DUR.f4);
  const q = useProgress(4 + DUR.f5, DUR.f4);
  const sub = useProgress(4 + DUR.f5 + 8, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 960 - 220, top: 380}}>
        <svg width={440} height={280}>
          {/* 描画层：pathLength 归一（红线三——虚线样式另置静态层，不与描画挤同元素） */}
          <rect
            x={4}
            y={4}
            width={432}
            height={272}
            rx={16}
            fill="none"
            stroke={theme.mech}
            strokeWidth={3}
            opacity={1 - done}
            {...draw}
          />
          {/* 定格层：虚线空位形态（「还没有单据」的读法） */}
          <rect
            x={4}
            y={4}
            width={432}
            height={272}
            rx={16}
            fill="none"
            stroke={theme.mechDeep}
            strokeWidth={3}
            strokeDasharray="14 10"
            opacity={done}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 92,
            width: 440,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 64,
            color: theme.dim,
            opacity: q,
          }}
        >
          {'?'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 300,
            width: 440,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
            opacity: sub,
          }}
        >
          {'要拍板的事'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-G p2-26 引子：计划单概念小字 ──────────────────────────────────────

const PlanNote: React.FC = () => {
  const fade = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 960 - 220, top: 430, ...fade}}>
        <Panel style={{width: 440, padding: '30px 0', textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>
            {'计划单'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 10}}>
            {'submit_plan'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-H 权限冒泡链路 ────────────────────────────────────────────────────

const PermissionBubble: React.FC<{atAsk: number; atChain: number; atQuote: number}> = ({
  atAsk,
  atChain,
  atQuote,
}) => {
  const ask = useProgress(2, DUR.f4);
  const askOut = useProgress(atChain, DUR.f4);
  // 链路逐节点点亮（stagger）：队友 → 弹窗 → 用户 → 回流
  const nodes = useStagger(3, {at: atChain + 2, stride: 12, dur: DUR.f5});
  const popup = useEnter('pop', {at: atChain + 14, dur: DUR.f4});
  const breath = useBreathe({period: 46, amp: 0.4, base: 0.6});
  const back = useProgress(atChain + 2 + 2 * 12 + DUR.f5, DUR.f5);
  const quoteIn = useProgress(atQuote, DUR.f4);
  const badgeIn = useProgress(atChain + 2, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 设问（p2-30） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 236,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 52,
          fontWeight: 700,
          color: theme.dim,
          opacity: ask * (1 - askOut),
        }}
      >
        {'审批找谁 ？'}
      </div>

      {/* 链路：队友 → 领队界面弹窗 → 用户（dim 人色 · 呼吸） → 回执回流 */}
      <svg width={1920} height={700} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 去程箭头（队友 → 弹窗 → 用户），y 与剪影视觉中心对齐 */}
        <g opacity={nodes[1]}>
          <line x1={560} y1={390} x2={830} y2={390} stroke={theme.mech} strokeWidth={4} />
          <path d="M816 378 L836 390 L816 402" fill="none" stroke={theme.mech} strokeWidth={4} />
        </g>
        <g opacity={nodes[2]}>
          <line x1={1210} y1={390} x2={1440} y2={390} stroke={theme.mech} strokeWidth={4} />
          <path d="M1426 378 L1446 390 L1426 402" fill="none" stroke={theme.mech} strokeWidth={4} />
        </g>
        {/* 回流箭头（用户批准 → 回执回队友，下弧） */}
        <path
          d="M1480 468 C 1480 560, 500 560, 470 468"
          fill="none"
          stroke={theme.dim}
          strokeWidth={4}
          opacity={back}
        />
        <path d="M478 484 L468 464 L490 462" fill="none" stroke={theme.dim} strokeWidth={4} opacity={back} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 342,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: nodes[1],
        }}
      >
        {'permission_request'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 546,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: back,
        }}
      >
        {'permission_response'}
      </div>

      {/* 节点 1：队友（text 白剪影，无彩） */}
      <div style={{position: 'absolute', left: 390, top: 330, opacity: nodes[0]}}>
        <Silhouette />
        <div
          style={{
            position: 'absolute',
            left: -10,
            top: 118,
            width: 90,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'队友'}
        </div>
      </div>

      {/* 节点 2：领队界面弹窗（pop 弹入） */}
      <div style={{position: 'absolute', left: 840, top: 300, ...popup, opacity: popup.opacity * nodes[1]}}>
        <Panel accent={theme.mech} style={{width: 370, padding: '18px 22px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>
            {'领队界面 · 审批'}
          </div>
          <div style={{display: 'flex', gap: 14, marginTop: 14}}>
            <div
              style={{
                flex: 1,
                padding: '8px 0',
                textAlign: 'center',
                borderRadius: 8,
                border: `2px solid ${theme.mech}`,
                color: theme.mech,
                fontFamily: theme.sans,
                fontSize: 22,
              }}
            >
              {'允许'}
            </div>
            <div
              style={{
                flex: 1,
                padding: '8px 0',
                textAlign: 'center',
                borderRadius: 8,
                border: `2px solid ${theme.panelBorder}`,
                color: theme.dim,
                fontFamily: theme.sans,
                fontSize: 22,
              }}
            >
              {'拒绝'}
            </div>
          </div>
        </Panel>
      </div>

      {/* 节点 3：用户（dim 灰 = 人色 · 呼吸） */}
      <div style={{position: 'absolute', left: 1460, top: 330, opacity: nodes[2] * breath}}>
        <Silhouette color={theme.dim} />
        <div
          style={{
            position: 'absolute',
            left: -12,
            top: 118,
            width: 94,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'用户'}
        </div>
      </div>

      {/* 【三】归属徽标（p2-31 起常驻）＋官方引语卡（p2-32）——bottom ≤ 910 避字幕带 */}
      <div style={{position: 'absolute', left: 960 - 560, top: 620, opacity: badgeIn}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12}}>
          <span
            style={{
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.dim,
              border: `2px solid ${theme.dim}`,
              borderRadius: 6,
              padding: '2px 10px',
            }}
          >
            {'【三】'}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            {'开源项目作者 · 源码分析'}
          </span>
        </div>
        <div style={{opacity: quoteIn}}>
          <MonoQuote
            badge="官"
            badgeColor={theme.core}
            line1={'Teammate permission prompts appear'}
            line2={'in the lead session'}
            at={0}
            width={1120}
          />
        </div>
      </div>

      <Footnote delay={atChain}>{'permission_request'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2MailboxProtocol: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-06');
  const bC = w('p2-07', 'p2-11');
  const bD = w('p2-12', 'p2-14');
  const bE = w('p2-15', 'p2-17');
  const bF = w('p2-18', 'p2-25');
  const bG = w('p2-26', 'p2-29');
  const bH = w('p2-30', 'p2-32');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 组队动机">
        <TeamSetup
          atTemp={at('p2-02') - bA.from}
          atPerm={at('p2-03') - bA.from}
          atOrg={at('p2-04') - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 实验标签">
        <ExperimentalTag atMotto={at('p2-06') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="2-C 收件格机制">
        {/* 与 1-E 末图隔六句空窗 → 默认入场；五章接力无空窗 */}
        <ArchifyRecap
          slug="mailbox-consume"
          caption="收件格"
          cues={[
            {chapterId: 'inbox-per-seat', at: at('p2-07') - bC.from, durationInFrames: dur('p2-07')},
            {chapterId: 'jsonl-append', at: at('p2-08') - bC.from, durationInFrames: dur('p2-08')},
            {chapterId: 'take-all-clear', at: at('p2-09') - bC.from, durationInFrames: dur('p2-09')},
            {chapterId: 'peek-probe', at: at('p2-10') - bC.from, durationInFrames: dur('p2-10')},
            {chapterId: 'host-polling', at: at('p2-11') - bC.from, durationInFrames: dur('p2-11')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 工具单对开">
        <ToolSheet
          atSheet={at('p2-12') - bD.from}
          atStrike={at('p2-13') - bD.from}
          atMotto={at('p2-14') - bD.from}
        />
      </Sequence>

      <Sequence {...bE} name="2-E 副台渐变">
        <NameSpectrum atFlip={at('p2-16') - bE.from} atSpectrum={at('p2-17') - bE.from} />
      </Sequence>

      <Sequence {...bF} name="2-F 派工单机制">
        {/* p2-18 引子：凭证位虚线框（窗 = 本句） */}
        <Sequence durationInFrames={dur('p2-18')}>
          <VoucherStub />
        </Sequence>
        {/* 与 2-C 末图隔多句空窗 → 默认入场；四章接力 */}
        <ArchifyRecap
          slug="protocol-roundtrip"
          caption="派工单"
          cues={[
            {chapterId: 'two-copies', at: at('p2-19') - bF.from, durationInFrames: dur('p2-19')},
            {chapterId: 'id-roundtrip', at: at('p2-20') - bF.from, durationInFrames: dur('p2-20')},
            {chapterId: 'three-checks', at: at('p2-21') - bF.from, durationInFrames: dur('p2-21')},
            {chapterId: 'stale-immune', at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
          ]}
        />
        <Sequence from={at('p2-23') - bF.from} name="2-F 金句卡">
          <QuoteCard zh="一张单 · 一份回执" />
        </Sequence>
        {/* p2-23 一句空窗后重现 → 默认入场 */}
        <ArchifyRecap
          slug="protocol-roundtrip"
          caption="派工单"
          cues={[
            {chapterId: 'route-before-return', at: at('p2-24') - bF.from, durationInFrames: dur('p2-24')},
          ]}
        />
        {/* 与前图跨实例背靠背（p2-24 末 = p2-25 始）→ 关入场 */}
        <ArchifyRecap
          slug="protocol-fsm"
          caption="协议状态机"
          lead={false}
          cues={[
            {chapterId: 'one-fsm-two-protocols', at: at('p2-25') - bF.from, durationInFrames: dur('p2-25')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="2-G 计划门拍一">
        {/* p2-26 引子：计划单概念小字（窗 = 本句） */}
        <Sequence durationInFrames={dur('p2-26')}>
          <PlanNote />
        </Sequence>
        {/* p2-25 后隔一句空窗重现 → 默认入场；三章接力 */}
        <ArchifyRecap
          slug="protocol-fsm"
          caption="协议状态机"
          cues={[
            {chapterId: 'plan-handshake', at: at('p2-27') - bG.from, durationInFrames: dur('p2-27')},
            {chapterId: 'not-a-gate', at: at('p2-28') - bG.from, durationInFrames: dur('p2-28')},
            {chapterId: 'self-discipline', at: at('p2-29') - bG.from, durationInFrames: dur('p2-29')},
          ]}
        />
      </Sequence>

      <Sequence {...bH} name="2-H 权限冒泡链路">
        <PermissionBubble
          atAsk={at('p2-30') - bH.from}
          atChain={at('p2-31') - bH.from}
          atQuote={at('p2-32') - bH.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2MailboxProtocol;
