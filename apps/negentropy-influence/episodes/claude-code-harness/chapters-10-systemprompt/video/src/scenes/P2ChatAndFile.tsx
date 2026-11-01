/** P2 一句闲聊，一个文件（p2-01..p2-09，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  叙事链：2-A 走查舞台全景（每幕首镜全景坐标锚，episode D）：磁盘格空态定格
 *  → 清单「无记忆」行落定 → 三块分段卡（身份/工具/工作目录）滑入拼成提示条、
 *  计数器跳 113、基线标尺条立起（重音镜，数据本体禁过冲）→「再取一次」缓存
 *  徽标亮、同一条提示条原样弹回一拍（同条复现）→ 2-B 闲聊消息条特写：青碧
 *  气泡自顶部落入（引语全文——走查输入数据本体）、分段卡描边呼吸一下即止、
 *  气泡擦过清单旁滑出画面（「提到记忆」不是状态的静默裁决〔M-003〕）→
 *  2-C 全链路变化：磁盘格亮起（记忆文件落盘 + 写入内容流）→ 清单翻新（记忆行
 *  无→有）→ 缓存徽标闪断红一拍 → 四块分段卡拼装、计数器 113→154、标尺条增格
 *  （重音镜）→「真的有货」记忆段实色点亮到场 → 问号悬念签浮于判据位（交给 P3）。
 *
 *  空间契约：磁盘→清单→拼装从左到右流程向（因果次序可读）、计数器读数以口播
 *    113/154 为准、记忆段卡 2-B 前不入场、跳过清单直接拼装禁、变化链次序 =
 *    磁盘→清单→缓存→拼装（因果链可追）、气泡触发任何判定路径禁、悬念签半透明。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；update_context ·
 *    get_system_prompt · MEMORY.md · --episode D 只进角标；记忆段早于 p2-08
 *    点亮禁；计数禁过冲弹簧。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CacheBadge, CharCounterRuler, LoopRing, MessageBubble, PromptBar, StateManifestCard} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 走查舞台（2-A/2-C 共用坐标——磁盘 → 清单 → 拼装 从左到右） ────────────

const DISK = {x: 120, y: 320, w: 300, h: 220} as const;
const MANI = {x: 480, y: 280, w: 420, h: 240} as const;
const ASSEM = {x: 960, y: 330, w: 720, h: 96} as const;
const COUNTER = {x: 960, y: 490, w: 560} as const;
const BADGE = {x: 1620, y: 316} as const;
const RING2 = {x: 80, y: 76, size: 110} as const;

/** 磁盘格（空态 / 落盘态——走查的持久层） */
const DiskCell: React.FC<{lit: number; onP: number; streamP: number}> = ({lit, onP, streamP}) => {
  const frame = useCurrentFrame();
  const on = clamp01(onP);
  const stream = clamp01(streamP);
  return (
    <div style={{position: 'absolute', left: DISK.x, top: DISK.y, width: DISK.w, height: DISK.h, opacity: clamp01(lit)}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `2.5px dashed ${withAlpha(on > 0.3 ? theme.mech : theme.dim, 0.5 + 0.4 * on)}`,
          background: withAlpha(theme.panel, 0.5),
          position: 'relative',
          padding: '10px 14px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'磁盘 · MEMORY.md'}</span>
        {/* 记忆文件图标（空态虚位 → 落盘实化 + 内容行渐显） */}
        <svg width={64} height={78} viewBox="0 0 64 78" style={{overflow: 'visible', marginTop: 10, marginLeft: 26, filter: `drop-shadow(0 0 ${10 * on}px ${withAlpha(theme.mech, 0.5)})`}}>
          <path d="M 8 4 L 44 4 L 56 16 L 56 74 L 8 74 Z" fill={withAlpha(theme.panel, 0.96)} stroke={withAlpha(theme.mech, 0.3 + 0.7 * on)} strokeWidth={3.5} strokeLinejoin="round" strokeDasharray={on > 0.3 ? undefined : '5 5'} />
          <path d="M 44 4 L 44 16 L 56 16" fill="none" stroke={withAlpha(theme.mech, 0.3 + 0.7 * on)} strokeWidth={3.5} strokeLinejoin="round" />
          <line x1={16} y1={32} x2={46} y2={32} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={3} strokeLinecap="round" opacity={on} />
          <line x1={16} y1={44} x2={38} y2={44} stroke={withAlpha(theme.mech, 0.4)} strokeWidth={3} strokeLinecap="round" opacity={on} />
        </svg>
        {/* 写入内容流（落盘一拍——三条行纹自上而下写入） */}
        {stream > 0.02 ? (
          <div style={{position: 'absolute', right: 18, top: 44, display: 'flex', flexDirection: 'column', gap: 7}}>
            {[0, 1, 2].map((k) => {
              const p = clamp01(stream * 3 - k);
              return <span key={`st${k}`} style={{width: 84, height: 7, borderRadius: 4, background: withAlpha(theme.mech, 0.5), opacity: p * (0.5 + 0.5 * Math.sin(frame / 9 + k))}} />;
            })}
          </div>
        ) : null}
        <span style={{position: 'absolute', left: 14, bottom: 10, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: on > 0.3 ? theme.mech : theme.dim, whiteSpace: 'nowrap'}}>
          {on > 0.3 ? '已落盘 · 有内容' : '空 · 无记忆文件'}
        </span>
      </div>
    </div>
  );
};

/** 舞台横接箭头（磁盘→清单 / 清单→拼装——流程向的低存在感连接） */
const FlowArrow: React.FC<{x1: number; x2: number; y: number; lit: number}> = ({x1, x2, y, lit}) => (
  <svg width={x2 - x1 + 20} height={40} viewBox={`0 0 ${x2 - x1 + 20} 40`} style={{position: 'absolute', left: x1, top: y - 20, overflow: 'visible', opacity: clamp01(lit) * 0.85}}>
    <line x1={0} y1={20} x2={x2 - x1 - 4} y2={20} stroke={withAlpha(theme.sky, 0.6)} strokeWidth={3} strokeDasharray="8 7" />
    <path d={`M ${x2 - x1 - 14} 12 L ${x2 - x1} 20 L ${x2 - x1 - 14} 28`} fill="none" stroke={withAlpha(theme.sky, 0.75)} strokeWidth={3} strokeLinecap="round" />
  </svg>
);

// ── 2-A 首取走查：空磁盘 → 三段 113 → 缓存命中 ────────────────────────────

const TwoA: React.FC<{atStage: number; atChips: number; atCount: number; atHit: number; atBounce: number}> = ({atStage, atChips, atCount, atHit, atBounce}) => {
  const frame = useCurrentFrame();
  // 舞台先立（磁盘空态 + 清单两行落定——「无记忆」）
  const stage = useProgress(atStage, DUR.f5);
  const rowsLit = 2 * clamp01(progress(frame, atStage + 8, 24));
  // 三块分段卡滑入拼成提示条（stagger——次序 = 口播次序）
  const chips = [0, 1, 2].map((i) => clamp01(progress(frame, atChips + i * 7, DUR.f4)));
  // 计数器跳 113（useCount 标准缓动——数据本体禁过冲）+ 基线标尺立起
  const count = useCount({to: 113, at: atCount, dur: 26});
  const baseIn = clamp01(progress(frame, atCount + 6, DUR.f4));
  const punch = useImpulse({at: atCount + 26, dur: DUR.f6, peak: 1});
  // 「再取一次」缓存命中 → 同一条提示条原样弹回一拍（内容零变化）
  const badgeLit = useProgress(atHit, DUR.f4);
  const hit = useProgress(atHit + 8, DUR.f4);
  const bounce = Math.sin(Math.PI * clamp01(progress(frame, atBounce, 20)));
  return (
    <AbsoluteFill>
      <DiskCell lit={stage} onP={0} streamP={0} />
      <FlowArrow x1={DISK.x + DISK.w + 8} x2={MANI.x - 8} y={400} lit={stage} />
      <StateManifestCard x={MANI.x} y={MANI.y} w={MANI.w} h={MANI.h} lit={stage} rowsLit={rowsLit} memHas={0} />
      <FlowArrow x1={MANI.x + MANI.w + 8} x2={ASSEM.x - 8} y={400} lit={stage} />
      {/* 拼装位（三块滑入 → 提示条；命中后原样弹回一拍） */}
      <div style={{position: 'absolute', left: ASSEM.x, top: ASSEM.y - bounce * 10}}>
        <PromptBar
          x={0}
          y={0}
          w={ASSEM.w}
          h={ASSEM.h}
          mode={'assembled'}
          chips={[
            {zh: '身份', en: 'identity'},
            {zh: '工具', en: 'tools'},
            {zh: '工作目录', en: 'workspace'},
          ]}
          chipsLit={chips}
        />
      </div>
      {/* 缓存徽标（拼装流出口——命中亮） */}
      <CacheBadge x={BADGE.x} y={BADGE.y} litP={badgeLit} hitP={hit} size={58} />
      {/* 字符计数器 + 基线标尺条（数字必带基线） */}
      <CharCounterRuler x={COUNTER.x} y={COUNTER.y} w={COUNTER.w} value={Math.round(count)} baseLine={113} baseLit={baseIn} cells={18} cellsLit={(18 * count) / 154} flash={punch} label={'拼装体量 · 首取'} />
      {/* 环体缩悬顶角（走查舞台坐标锚） */}
      <div style={{position: 'absolute', left: RING2.x, top: RING2.y, opacity: 0.45}}>
        <LoopRing size={RING2.size} nodes={[]} showExit={false} dotProgress={(frame / 85) % 1} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'--episode D · get_system_prompt'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 闲聊消息条特写：落入 → 描边呼吸即止 → 擦过清单旁滑出 ──────────────

const CHIPS_3 = [
  {zh: '身份', en: 'identity'},
  {zh: '工具', en: 'tools'},
  {zh: '工作目录', en: 'workspace'},
] as const;

const TwoB: React.FC<{atDrop: number; atBreathe: number; atOut: number}> = ({atDrop, atBreathe, atOut}) => {
  const frame = useCurrentFrame();
  // 气泡自顶部落入（引语全文——走查输入数据本体）
  const drop = clamp01(progress(frame, atDrop, 30));
  const bubbleY = -90 + 420 * drop;
  // 分段卡描边呼吸一下即止（有感知无变化——pulseP 一拍包络）
  const breathe = Math.sin(Math.PI * clamp01(progress(frame, atBreathe, 18)));
  // 「提到记忆不是状态」气泡擦过清单旁滑出画面（静默裁决——清单/分段卡零反应）
  const out = clamp01(progress(frame, atOut, 30));
  const outX = out * 1500;
  return (
    <AbsoluteFill>
      {/* 状态清单卡（缩微驻位——恒静帧：记忆行无、零翻新） */}
      <StateManifestCard x={170} y={330} w={380} h={230} scale={0.95} rowsLit={2} memHas={0} dim={0.15} />
      {/* 分段卡组（缩微驻位——描边呼吸一下即止，内容零变化） */}
      <div style={{position: 'absolute', left: 1180, top: 220}}>
        <PromptBar x={0} y={0} w={520} h={88} mode={'assembled'} chips={CHIPS_3} chipsLit={[1, 1, 1]} hotP={[breathe, breathe, breathe]} />
        <div style={{position: 'absolute', left: 0, right: 0, top: -34, textAlign: 'center', fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          {'三段 · 纹丝不动'}
        </div>
      </div>
      {/* 闲聊消息条（落入 → 擦过清单旁滑出——判定路径之外） */}
      <div style={{position: 'absolute', left: 640 + outX, top: bubbleY, opacity: 1 - out * 0.9}}>
        {/* caption-dup-ok: 引语为走查输入数据本体（消息条即演示对象本身，非画面复述口播；P3 消融需同款输入在场方可演示「记忆」二字高亮） */}
        <MessageBubble x={0} y={0} w={560} lit={clamp01(drop * 2)} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'「提到记忆」≠ 状态 · 清单说了算'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 全链路变化：落盘 → 清单翻新 → 缓存闪断 → 四段 154 ─────────────────

const TwoC: React.FC<{atDisk: number; atFlip: number; atBreak: number; atRebuild: number; atCount: number; atHot: number; atQ: number}> = ({atDisk, atFlip, atBreak, atRebuild, atCount, atHot, atQ}) => {
  const frame = useCurrentFrame();
  // 变化链①磁盘格亮起（记忆文件落盘 + 写入内容流）
  const diskOn = useProgress(atDisk, DUR.f5);
  const stream = clamp01(progress(frame, atDisk + 8, 24));
  // 变化链②清单翻新（记忆行 无→有：flip 白闪一拍 + memHas 交叉换值）
  const flipEnv = Math.sin(Math.PI * clamp01(progress(frame, atFlip, 16)));
  const memHas = clamp01(progress(frame, atFlip, 14));
  // 变化链③缓存徽标闪断（红一拍——失效）
  const brk = Math.sin(Math.PI * clamp01(progress(frame, atBreak, 16)));
  // 变化链④四块分段卡拼装（记忆段滑入）+ 计数 113→154 + 标尺增格（重音镜）
  const chips = [1, 1, 1, clamp01(progress(frame, atRebuild, DUR.f4))].map((v, i) => (i < 3 ? v : v));
  const count = useCount({from: 113, to: 154, at: atCount, dur: 26});
  const punch = useImpulse({at: atCount + 26, dur: DUR.f6, peak: 1});
  // 「真的有货」记忆段实色点亮到场
  const hot = clamp01(progress(frame, atHot, DUR.f4));
  // 「不看状态改看话术呢」问号悬念签（半透明、欲拆未拆——交给 P3）
  const q = useProgress(atQ, DUR.f5);
  const qFloat = useImpulse({at: atQ + DUR.f5, dur: 40, peak: 5});
  return (
    <AbsoluteFill>
      <DiskCell lit={1} onP={diskOn} streamP={stream} />
      <FlowArrow x1={DISK.x + DISK.w + 8} x2={MANI.x - 8} y={400} lit={1} />
      <StateManifestCard x={MANI.x} y={MANI.y} w={MANI.w} h={MANI.h} rowsLit={2} memHas={memHas} flipP={flipEnv} />
      <FlowArrow x1={MANI.x + MANI.w + 8} x2={ASSEM.x - 8} y={400} lit={1} />
      {/* 拼装位（四段——记忆段滑入 + 实色点亮） */}
      <PromptBar
        x={ASSEM.x}
        y={ASSEM.y}
        w={ASSEM.w}
        h={ASSEM.h}
        mode={'assembled'}
        chips={[
          {zh: '身份', en: 'identity'},
          {zh: '工具', en: 'tools'},
          {zh: '工作目录', en: 'workspace'},
          {zh: '记忆', en: 'memory'},
        ]}
        chipsLit={chips}
        hotP={[0, 0, 0, hot]}
      />
      {/* 缓存徽标（闪断红一拍——失效后不复亮为命中态） */}
      <CacheBadge x={BADGE.x} y={BADGE.y} litP={1} breakP={brk} size={58} label={'失效'} />
      {/* 字符计数器（113→154 + 增格；基线 113 对照锚常驻） */}
      <CharCounterRuler x={COUNTER.x} y={COUNTER.y} w={COUNTER.w} value={Math.round(count)} baseLine={113} baseLit={1} cells={18} cellsLit={(18 * count) / 154} flash={punch} label={'重拼体量 · 四段'} />
      {/* 问号悬念签（判据位上方——半透明悬停） */}
      {q > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: MANI.x + 120,
            top: MANI.y - 88 - qFloat,
            padding: '8px 30px',
            borderRadius: 12,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.72),
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: q * 0.85,
            transform: `translateY(${(1 - q) * 18}px)`,
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.dim}}>{'？'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>{'判据要是改话术呢'}</span>
        </div>
      ) : null}
      {/* 环体缩悬顶角（承 2-A 位） */}
      <div style={{position: 'absolute', left: RING2.x, top: RING2.y, opacity: 0.45}}>
        <LoopRing size={RING2.size} nodes={[]} showExit={false} dotProgress={(frame / 85) % 1} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'update_context · MEMORY.md · 落盘 → 翻新 → 失效 → 重拼'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2ChatAndFile: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06', 'p2-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atStage={wa('p2-01', 0.2) - bA.from}
          atChips={wa('p2-02', 0.3) - bA.from}
          atCount={wa('p2-02', 0.66) - bA.from}
          atHit={wa('p2-03', 0.42) - bA.from}
          atBounce={wa('p2-03', 0.66) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB atDrop={wa('p2-04', 0.24) - bB.from} atBreathe={wa('p2-05', 0.14) - bB.from} atOut={wa('p2-05', 0.5) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atDisk={wa('p2-06', 0.2) - bC.from}
          atFlip={wa('p2-07', 0.12) - bC.from}
          atBreak={wa('p2-07', 0.24) - bC.from}
          atRebuild={wa('p2-07', 0.44) - bC.from}
          atCount={wa('p2-07', 0.68) - bC.from}
          atHot={wa('p2-08', 0.4) - bC.from}
          atQ={wa('p2-09', 0.4) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2ChatAndFile;
