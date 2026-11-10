/** P1 三十行循环（p1-01..p1-10b + p1-12..13，6 镜）——分镜 1-A..1-F
 *  （规格 SSOT = script/storyboard.md P1 节；句集 = script/narration.md P1 节）。
 *
 *  叙事链：空环五站亮相（两枚信号旗）→ 站位特写：问题入列 + 工具清单打包调模型 →
 *  回答入档 + 扫描检出工具调用块（本镜唯一青碧）→ 执行脉冲 + 工具结果回喂 +
 *  回流箭头接通（一整圈点亮）→ ECU 角色标签（青/灰对比，user 身份揭示）→
 *  拉回全景：五站回放 + ≈30 行标注 + 分工铭牌两行。
 *
 *  空间契约（M-001 恒定锚）：1-A/1-F 环体居中大环（WS 环心 960,530）；1-B..1-D
 *  特写档环体居左（CU 环心 600,520）、装置右展；消息列表恒居右列 x1450、槽位跨镜
 *  累积（1-B 首格问题 → 1-C 次格回答 → 1-D 三格工具结果）。环体描边色/线宽/圆度
 *  全片锁定（LoopRing 内建），仅尺度与伴随元素变化（0-C→1-A morph 连续承接）。
 *  五步站位集经 LoopRing `nodes` 传入（-90 起每 +72°）；牌位/已走标记为调用方覆写层。
 *
 *  红线落实：动画时点一律 beatWindow 句边界（词落位 = 句首 + 句长比例）；pathLength
 *  描线与像素 dasharray 分属不同元素；角色色块（青/灰）到 1-E 才登场——此前消息条
 *  只带中性 mono 角色签，避免提前剧透「以用户的身份」揭示。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, RING_STROKE, SceneTag, type RingNode} from '../components/motifs';
import {DUR, useDraw, useEnter, useFlowDash, useImpulse, useProgress, usePushIn, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 可选锚的哨兵：progress 钳制后恒为 1（在场）/ impulse 恒为 0（不点火） */
const OFFSCREEN = -999;

type Pt = {x: number; y: number};

const polar = (cx: number, cy: number, r: number, deg: number): Pt => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 二次贝塞尔行程（chip 沿弧飞行） */
const qBez = (p0: Pt, c: Pt, p2: Pt, u: number): Pt => {
  const iu = 1 - u;
  return {
    x: iu * iu * p0.x + 2 * iu * u * c.x + u * u * p2.x,
    y: iu * iu * p0.y + 2 * iu * u * c.y + u * u * p2.y,
  };
};

/** 五步站位（关键词 ≤6 字，angle 自 -90 每 +72°）——LoopRing nodes 覆写源 */
const STATIONS: RingNode[] = [
  {label: '进消息', angle: -90},
  {label: '调模型', angle: -18},
  {label: '存档·查', angle: 54},
  {label: '执行', angle: 126},
  {label: '回喂', angle: 198},
];

type RingAnchor = {size: number; left: number; top: number; cx: number; cy: number; r: number};

/** 全景档（1-A / 1-F）：环体居中占屏 */
const RING_WS: RingAnchor = {size: 520, left: 700, top: 270, cx: 960, cy: 530, r: 214};
/** 特写档（1-B..1-D）：环体居左，装置右展 */
const RING_CU: RingAnchor = {size: 460, left: 370, top: 290, cx: 600, cy: 520, r: 184};

/** 消息列表恒居右列（槽位跨镜累积；底部 752 < 字幕安全带 920） */
const LIST = {x: 1450, y: 322, w: 330, headerH: 44, slotH: 64, gap: 14} as const;
const slotTop = (i: number) => LIST.y + LIST.headerH + 10 + i * (LIST.slotH + LIST.gap);

/** 环体挂载：五步 nodes + 牌位关（覆写层自绘），退出线留给 P2 出口门。
 *  activeAccent 恒 core：站位属环体机制域（陶土橙）——本集 mech 与 tool 同色，
 *  缺省会破 1-C「调用块为唯一青碧元素」Visual Lock */
const RingMount: React.FC<{
  anchor: RingAnchor;
  draw?: number;
  activeNode?: number;
  dimNodes?: boolean;
  dotProgress?: number;
  dotOpacity?: number;
}> = ({anchor, draw, activeNode, dimNodes, dotProgress, dotOpacity}) => (
  <div style={{position: 'absolute', left: anchor.left, top: anchor.top}}>
    <LoopRing
      size={anchor.size}
      nodes={STATIONS}
      showLabels={false}
      showExit={false}
      draw={draw}
      activeNode={activeNode}
      dimNodes={dimNodes}
      dotProgress={dotProgress}
      dotOpacity={dotOpacity}
      activeAccent={theme.core}
    />
  </div>
);

/** 站牌覆写层：序号 + 关键词（暗态 dim / 已走亮）；enter 缺省 = 跨镜在场不重入场 */
const StationPlate: React.FC<{
  anchor: RingAnchor;
  index: number;
  enter?: number;
  lit?: boolean;
  glowAt?: number;
}> = ({anchor, index, enter = 1, lit = false, glowAt}) => {
  const n = STATIONS[index];
  const p = polar(anchor.cx, anchor.cy, anchor.r, n.angle);
  const pop = useImpulse({at: glowAt ?? OFFSCREEN, dur: DUR.f5});
  const rightSide = n.angle > -90 && n.angle < 90;
  const base: React.CSSProperties =
    n.angle === -90
      ? {left: p.x, top: p.y - 46, transform: 'translate(-50%, 0)'}
      : rightSide
        ? {left: p.x + 26, top: p.y - 15}
        : {left: p.x - 26, top: p.y - 15, transform: 'translateX(-100%)'};
  return (
    <div style={{position: 'absolute', opacity: enter, ...base}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10, transform: `scale(${1 + 0.09 * pop})`}}>
        <span style={{fontFamily: theme.mono, fontSize: 19, color: lit ? theme.core : theme.dim}}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: lit ? theme.text : theme.dim}}>
          {n.label}
        </span>
      </div>
    </div>
  );
};

/** 已走标记：站位圆心一枚陶土橙实心点 + 点火辉光环（挂载由调用方按帧门控） */
const StationMark: React.FC<{anchor: RingAnchor; index: number; at?: number; glowAt?: number}> = ({
  anchor,
  index,
  at = 0,
  glowAt,
}) => {
  const p = polar(anchor.cx, anchor.cy, anchor.r, STATIONS[index].angle);
  const shown = useProgress(at, DUR.f3);
  const glow = useImpulse({at: glowAt ?? OFFSCREEN, dur: DUR.f5});
  return (
    <svg width={60} height={60} style={{position: 'absolute', left: p.x - 30, top: p.y - 30, overflow: 'visible'}}>
      <circle cx={30} cy={30} r={2 + 4.5 * shown} fill={theme.core} opacity={shown} />
      {glow > 0.01 ? (
        <circle cx={30} cy={30} r={13 + 9 * glow} fill="none" stroke={theme.core} strokeWidth={3} opacity={0.9 * glow} />
      ) : null}
    </svg>
  );
};

/** 特写档共用舞台：环 + 牌位（lit = i ≤ active）+ 已走标记（null = 该站未走）。
 *  glowAts（按站序）优先于单值 glowAt——「一整圈点亮」逐站顺序涟漪用 */
const StepStage: React.FC<{
  active: number;
  markAts: readonly (number | null)[];
  dotProgress?: number;
  glowAt?: number;
  glowAts?: readonly (number | undefined)[];
}> = ({active, markAts, dotProgress, glowAt, glowAts}) => {
  const frame = useCurrentFrame();
  const gAt = (i: number) => glowAts?.[i] ?? glowAt;
  return (
    <>
      <RingMount anchor={RING_CU} activeNode={active} dimNodes dotProgress={dotProgress} />
      {STATIONS.map((s, i) => (
        <StationPlate key={s.label} anchor={RING_CU} index={i} lit={i <= active} glowAt={gAt(i)} />
      ))}
      {STATIONS.map((s, i) =>
        markAts[i] !== null && frame >= (markAts[i] as number) ? (
          <StationMark key={`m-${s.label}`} anchor={RING_CU} index={i} glowAt={gAt(i)} />
        ) : null,
      )}
    </>
  );
};

/** 消息列表：表头 + 五格虚线空架；fills 按槽位入列（角色签 1-E 前保持中性）。
 *  at = OFFSCREEN 表示跨镜已在场（钳制后恒终态，不重播入场——列表是跨镜累积装置）。
 *  packAt/restoreAt：打包拍整行随工具卡压暗微抬（「带上对话」半句的画面参与）、
 *  调用完成后恢复（原件仍在档） */
type MsgFill = {slot: number; role: 'user' | 'assistant'; label: string; at: number; accent?: string};

const SlotRow: React.FC<{fill: MsgFill; packAt?: number; restoreAt?: number}> = ({
  fill,
  packAt,
  restoreAt,
}) => {
  const enter = useEnter('slideR', {at: fill.at, dur: DUR.f4, dist: 26});
  const packP =
    useProgress(packAt ?? OFFSCREEN, DUR.f4) * (1 - useProgress(restoreAt ?? OFFSCREEN, DUR.f4));
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        borderRadius: 10,
        background: fill.accent ? `${fill.accent}1F` : theme.panel,
        borderLeft: `4px solid ${fill.accent ?? theme.panelBorder}`,
        opacity: enter.opacity * (1 - 0.55 * packP),
        transform: `${enter.transform} translateY(${-6 * packP}px)`,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{fill.role}</span>
      <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{fill.label}</span>
    </div>
  );
};

const MsgList: React.FC<{
  fills: MsgFill[];
  headerAt?: number;
  packAt?: number;
  restoreAt?: number;
}> = ({fills, headerAt = 0, packAt, restoreAt}) => {
  const head = useProgress(headerAt, DUR.f4);
  const slots = useStagger(5, {at: headerAt + 2, stride: 3, dur: DUR.f3});
  return (
    <div style={{position: 'absolute', left: LIST.x, top: LIST.y, width: LIST.w}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          height: LIST.headerH,
          opacity: head,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.dim}}>{'消息列表'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'messages'}</span>
      </div>
      {Array.from({length: 5}, (_, i) => {
        const fill = fills.find((f) => f.slot === i);
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              height: LIST.slotH,
              marginTop: i === 0 ? 10 : LIST.gap,
              borderRadius: 10,
              border: `2px dashed ${theme.panelBorder}`,
              opacity: slots[i],
            }}
          >
            {fill ? <SlotRow fill={fill} packAt={packAt} restoreAt={restoreAt} /> : null}
          </div>
        );
      })}
    </div>
  );
};

/** 飞行 chip：沿二次贝塞尔弧入位（hooks 先于提前返回——红线：hooks 顶层） */
const TravelChip: React.FC<{
  p0: Pt;
  c: Pt;
  p2: Pt;
  at: number;
  dur: number;
  enterAt?: number;
  children: React.ReactNode;
}> = ({p0, c, p2, at, dur, enterAt, children}) => {
  const u = useProgress(at, dur, 'decelerate');
  const appear = useProgress(enterAt ?? at, DUR.f3);
  if (u >= 1) {
    return null;
  }
  const pos = qBez(p0, c, p2, u);
  return (
    <div style={{position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', opacity: appear}}>
      {children}
    </div>
  );
};

// ── 1-A 空环亮相：五站牌位 + 两枚信号旗 + 消息列表空架 ──────────────────

/** 信号旗：旗杆三角旗 + 关键词；词落位各闪一次（impulse 辉光 + 轻弹）；
 *  flash2At 可选二闪（左旗「要工具」在「模型要不要调工具」词位再轻闪一次——
 *  两枚旗=两去向，这段在教「一个信号、两个去向」） */
const SignalFlag: React.FC<{
  x: number;
  y: number;
  keyword: string;
  sub: string;
  color: string;
  at: number;
  flashAt: number;
  flash2At?: number;
}> = ({x, y, keyword, sub, color, at, flashAt, flash2At}) => {
  const enter = useEnter('rise', {at, dur: DUR.f4, dist: 16});
  const flash = useImpulse({at: flashAt, dur: DUR.f5});
  const flash2 = 0.6 * useImpulse({at: flash2At ?? OFFSCREEN, dur: DUR.f5});
  const glow = Math.max(flash, flash2);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: enter.opacity,
        transform: `${enter.transform} scale(${1 + 0.07 * glow})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderRadius: 12,
          border: `2px solid ${color}`,
          background: theme.panel,
          boxShadow: `0 0 ${26 * glow}px ${color}`,
        }}
      >
        <svg width={32} height={44} viewBox="0 0 32 44">
          <line x1={5} y1={2} x2={5} y2={42} stroke={theme.dim} strokeWidth={3} />
          <path d="M8 5 L29 13 L8 21 Z" fill={color} />
        </svg>
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color}}>{keyword}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{sub}</div>
        </div>
      </div>
    </div>
  );
};

const RingReveal: React.FC<{
  flagInAt: number;
  flashLAt: number;
  flash2LAt: number;
  flashRAt: number;
  linesAt: number;
  tickAt: number;
}> = ({flagInAt, flashLAt, flash2LAt, flashRAt, linesAt, tickAt}) => {
  // 0-C→1-A morph 承接（分镜 Morph Continuity）：draw 恒 1（继承末帧闭环，不重描拆环），
  // 尺度接棒由整体 pushIn 承载（同色同线宽同圆度逐帧不变，仅尺度变化）
  const push = usePushIn(2, {scale: 0.07, dur: DUR.f6});
  // 五站牌位随三句依次浮出（fit 进 p1-03 前收口，杜绝一次全亮的幻灯片感）
  const plates = useStagger(5, {at: 14, fit: {total: Math.max(24, tickAt - 24 - 14)}});
  // 「三十行」规模具象：环心 30 根等高发丝行快速铺满（行数=数据本体，只做 opacity
  // 不吃形变；为 1-F「≈30 行」与 P4 双柱预建视觉记忆；fit.total ≥ 30——schedule
  // 硬约束 total ≥ 子项数）
  const hair = useStagger(30, {at: linesAt, fit: {total: 34}});
  const linesO = useProgress(linesAt, DUR.f4);
  return (
    <AbsoluteFill style={{transform: push}}>
      <SceneTag chapter="Agent Loop" tagline="三十行循环" accent={theme.core} />
      <RingMount anchor={RING_WS} draw={1} />
      {STATIONS.map((s, i) => (
        <StationPlate key={s.label} anchor={RING_WS} index={i} enter={plates[i]} glowAt={tickAt + i * 3} />
      ))}
      {/* 三十行代码剪影：环心 160×128 小卡，30 根发丝行（陶土橙低饱和） */}
      <div
        style={{
          position: 'absolute',
          left: 880,
          top: 466,
          width: 160,
          height: 128,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '8px 12px',
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: 0.75 * linesO,
        }}
      >
        {Array.from({length: 30}, (_, i) => (
          <div
            key={i}
            style={{
              height: 1.6,
              borderRadius: 1,
              background: theme.core,
              opacity: 0.55 * hair[i],
            }}
          />
        ))}
      </div>
      <SignalFlag
        x={540}
        y={138}
        keyword="要工具"
        sub="tool_use"
        color={theme.tool}
        at={flagInAt}
        flashAt={flashLAt}
        flash2At={flash2LAt}
      />
      <SignalFlag x={1300} y={138} keyword="停" sub="stop" color={theme.dim} at={flagInAt} flashAt={flashRAt} />
      <MsgList headerAt={10} fills={[]} />
      <Footnote delay={6}>{'agent loop'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 站位特写：问题入列 + 工具清单打包调模型 ─────────────────────────

/** 工具清单卡（数枚小卡）——打包时朝流光方向抬升并压暗（内容并入流光） */
const TOOLS = [
  {zh: '读文件', en: 'read_file'},
  {zh: '写文件', en: 'write_file'},
  {zh: '命令行', en: 'bash'},
] as const;

/** 模型脑（决策器官，无彩常态；「调一次模型」词落位亮起一拍） */
const BrainChip: React.FC<{litAt: number}> = ({litAt}) => {
  const enter = useProgress(2, DUR.f4);
  const lit = useImpulse({at: litAt, dur: DUR.f6});
  return (
    <div style={{position: 'absolute', left: 500, top: 168, opacity: enter}}>
      <div style={{boxShadow: `0 0 ${36 * lit}px ${theme.core}`}}>
        <Panel style={{padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14}}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={23} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
            <g stroke={theme.dim} strokeWidth={1.6} opacity={0.7}>
              <line x1={17} y1={19} x2={33} y2={16} />
              <line x1={17} y1={19} x2={22} y2={34} />
              <line x1={33} y1={16} x2={36} y2={31} />
              <line x1={22} y1={34} x2={36} y2={31} />
            </g>
            <g fill={theme.core} opacity={0.35 + 0.65 * lit}>
              <circle cx={17} cy={19} r={3.4} />
              <circle cx={33} cy={16} r={3.4} />
              <circle cx={22} cy={34} r={3.4} />
              <circle cx={36} cy={31} r={3.4} />
            </g>
          </svg>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text}}>{'模型'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'model'}</div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const CallModel: React.FC<{
  qAt: number;
  cardsAt: number;
  packAt: number;
  brainAt: number;
  fill0At: number;
  station1At: number;
}> = ({qAt, cardsAt, packAt, brainAt, fill0At, station1At}) => {
  const frame = useCurrentFrame();
  // 「第二步」句首即亮牌（与 1-C/1-D「第 N 步开口即亮」的步进鼓点统一）；
  // 调用完成的 mark（点）仍留 brainAt+4（调完才画点）
  const active = frame >= station1At ? 1 : 0;
  const cards = useStagger(TOOLS.length, {at: cardsAt, stride: 4, dur: DUR.f4});
  const pack = useProgress(packAt, DUR.f4);
  const flow = useFlowDash({dash: 14, gap: 18, period: 24});
  return (
    <AbsoluteFill>
      <StepStage active={active} markAts={[fill0At, brainAt + 4, null, null, null]} />
      <BrainChip litAt={brainAt} />
      <MsgList
        headerAt={0}
        fills={[{slot: 0, role: 'user', label: '问题', at: fill0At}]}
        packAt={packAt}
        restoreAt={brainAt + DUR.f3}
      />

      {/* p1-04：问题气泡自右缘（用户侧）入列首格 */}
      <TravelChip p0={{x: 1880, y: 420}} c={{x: 1755, y: 368}} p2={{x: 1655, y: 408}} at={qAt} dur={DUR.f5}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '10px 20px',
            borderRadius: 16,
            background: theme.panel,
            border: `2px solid ${theme.dim}`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'user'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'问题'}</span>
        </div>
      </TravelChip>

      {/* p1-05：工具清单小卡（打包时抬升压暗——内容并入流光） */}
      {TOOLS.map((t, i) => (
        <div
          key={t.en}
          style={{
            position: 'absolute',
            left: 980,
            top: 470 + i * 64,
            width: 320,
            height: 52,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            padding: '0 16px',
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.panel,
            opacity: cards[i] * (1 - 0.62 * pack),
            transform: `translateY(${(1 - cards[i]) * 12 - 10 * pack}px)`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: theme.text}}>{t.zh}</span>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginLeft: 'auto'}}>{t.en}</span>
        </div>
      ))}

      {/* 流光：列表首格 → 掠过工具卡堆 → 入环调用位（像素 dash 流动，与描线正交） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M1500 400 C1330 440 1230 500 1120 520 C1010 540 880 520 790 462"
          fill="none"
          stroke={theme.core}
          strokeWidth={RING_STROKE - 2}
          strokeLinecap="round"
          opacity={0.5 * pack}
        />
        <path
          d="M1500 400 C1330 440 1230 500 1120 520 C1010 540 880 520 790 462"
          fill="none"
          stroke={theme.core}
          strokeWidth={RING_STROKE - 1}
          strokeLinecap="round"
          opacity={pack}
          {...flow}
        />
        <path d="M0 -7 L0 7 L13 0 Z" fill={theme.core} transform="translate(788 459) rotate(214)" opacity={pack} />
      </svg>

      <Footnote delay={4}>{'messages + tools → model'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-C 站位三特写：回答入档 + 扫描检出工具调用块 ────────────────────────

const PANEL_C = {x: 960, y: 300, w: 470, h: 350} as const;
const SCAN = {x0: 982, x1: 1408, y0: 366, h: 220} as const;
const BLOCK = {x: 1240, w: 154, y: 434, h: 62} as const;

const ArchiveScan: React.FC<{
  ansAt: number;
  hopAt: number;
  scanAt: number;
  scanDur: number;
  blockHitAt: number;
  pulseAt: number;
  pouchAt: number;
  fill1At: number;
}> = ({ansAt, hopAt, scanAt, scanDur, blockHitAt, pulseAt, pouchAt, fill1At}) => {
  const panel = useEnter('rise', {at: ansAt, dur: DUR.f5, dist: 26, restBottom: PANEL_C.y + PANEL_C.h});
  // 扫描线单向一次（linear＝机器扫描语义豁免，A-02 注记）
  const scanP = useProgress(scanAt, scanDur, 'linear');
  const blockLit = useProgress(blockHitAt, DUR.f3);
  const pulse = useImpulse({at: pulseAt, dur: DUR.f6});
  const pouch = useEnter('pop', {at: pouchAt, dur: DUR.f5, springPreset: 'snap'});
  const scanX = SCAN.x0 + (SCAN.x1 - SCAN.x0) * scanP;
  return (
    <AbsoluteFill>
      <StepStage active={2} markAts={[OFFSCREEN, OFFSCREEN, fill1At, null, null]} />
      <MsgList
        headerAt={OFFSCREEN}
        fills={[
          {slot: 0, role: 'user', label: '问题', at: OFFSCREEN},
          {slot: 1, role: 'assistant', label: '回答', at: fill1At},
        ]}
      />

      {/* 回答文本条（放大检视）：角色签中性——青碧只留给调用块 */}
      <div style={{position: 'absolute', left: PANEL_C.x, top: PANEL_C.y, ...panel}}>
        <Panel style={{width: PANEL_C.w, boxSizing: 'border-box', padding: 20, minHeight: PANEL_C.h}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'assistant'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'回答'}</span>
          </div>
          <div style={{height: 14, borderRadius: 7, background: theme.panelBorder, width: 330, marginTop: 22, opacity: 0.55}} />
          <div style={{height: 14, borderRadius: 7, background: theme.panelBorder, width: 240, marginTop: 14, opacity: 0.55}} />
          {/* 工具调用块：扫描线扫到才亮（此前禁预亮）；「请执行」词再脉冲一次 */}
          <div
            style={{
              position: 'absolute',
              left: BLOCK.x - PANEL_C.x,
              top: BLOCK.y - PANEL_C.y,
              width: BLOCK.w,
              height: BLOCK.h,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px',
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2px solid ${blockLit > 0.5 ? theme.tool : theme.panelBorder}`,
              background: blockLit > 0.5 ? `${theme.tool}26` : 'transparent',
              boxShadow: `0 0 ${34 * pulse}px ${theme.tool}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 16, color: blockLit > 0.5 ? theme.tool : theme.dim}}>
              {'tool_use'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: blockLit > 0.5 ? theme.text : theme.dim}}>
              {'工具调用'}
            </span>
          </div>
          <div style={{height: 14, borderRadius: 7, background: theme.panelBorder, width: 200, marginTop: 26, opacity: 0.55}} />
          {/* 参数小袋：自调用块弹出（p1-07「参数备好了」词落位；snap 弹入） */}
          <div
            style={{
              position: 'absolute',
              left: BLOCK.x - PANEL_C.x,
              top: BLOCK.y - PANEL_C.y + BLOCK.h + 14,
              width: BLOCK.w,
              opacity: pouch.opacity,
              transform: pouch.transform,
            }}
          >
            <svg width={154} height={14} style={{display: 'block'}}>
              <line x1={77} y1={0} x2={77} y2={14} stroke={theme.dim} strokeWidth={2} opacity={0.7} />
            </svg>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.text}}>{'参数'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 'auto'}}>{'input'}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* 扫描线：单向一次（线性），扫过即逝 */}
      {scanP > 0 && scanP < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: scanX,
            top: SCAN.y0,
            width: 3,
            height: SCAN.h,
            borderRadius: 2,
            background: theme.text,
            boxShadow: `0 0 14px ${theme.text}`,
          }}
        />
      ) : null}

      {/* p1-06「存档」：回答缩影入列次格 */}
      <TravelChip p0={{x: 1400, y: 458}} c={{x: 1520, y: 428}} p2={{x: 1600, y: 486}} at={hopAt} dur={DUR.f5}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '8px 16px',
            borderRadius: 12,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'assistant'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text}}>{'回答'}</span>
        </div>
      </TravelChip>

      <Footnote delay={4}>{'tool_use'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-D 站位四五连演：执行脉冲 + 工具结果回喂 + 回流箭头接通 ─────────────

const BAY = {x: 380, y: 765, w: 310, h: 115} as const;
/** 环内回流弧：站位五（198°）顺时针经站位一回站位二（-18°），半径 r-30 */
const BACK_ARC = (() => {
  const ra = RING_CU.r - 30;
  const a0 = polar(RING_CU.cx, RING_CU.cy, ra, 198);
  const a1 = polar(RING_CU.cx, RING_CU.cy, ra, 342);
  return {ra, d: `M${a0.x.toFixed(1)} ${a0.y.toFixed(1)} A${ra} ${ra} 0 0 1 ${a1.x.toFixed(1)} ${a1.y.toFixed(1)}`, end: a1};
})();

const ExecBay: React.FC<{pulseAt: number}> = ({pulseAt}) => {
  const enter = useProgress(2, DUR.f4);
  const pulse = useImpulse({at: pulseAt, dur: DUR.f6});
  const corners = 'M2 30 V2 H30 M280 2 H308 V30 M308 85 V113 H280 M30 113 H2 V85';
  return (
    <div style={{position: 'absolute', left: BAY.x, top: BAY.y, width: BAY.w, height: BAY.h, opacity: enter}}>
      <svg width={BAY.w} height={BAY.h} style={{position: 'absolute', left: 0, top: 0}}>
        <path d={corners} fill="none" stroke={theme.panelBorder} strokeWidth={3} strokeLinecap="round" />
        <path d={corners} fill="none" stroke={theme.tool} strokeWidth={4} strokeLinecap="round" opacity={pulse} />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text, textShadow: `0 0 ${22 * pulse}px ${theme.tool}`}}>
          {'执行'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'execute'}</div>
      </div>
    </div>
  );
};

const ExecuteFeed: React.FC<{
  callAt: number;
  t1: number;
  pulseAt: number;
  resultAt: number;
  active5At: number;
  t2: number;
  fill2At: number;
  arrowAt: number;
  glowAt: number;
  atEnd: number;
}> = ({callAt, t1, pulseAt, resultAt, active5At, t2, fill2At, arrowAt, glowAt, atEnd}) => {
  const frame = useCurrentFrame();
  const active = frame >= active5At ? 4 : 3;
  const glow = useImpulse({at: glowAt, dur: DUR.f6});
  // 重音镜 hold：impulse 峰后低档辉光常驻至 beat 尾（升格为标注重音镜）
  const glowHold = useProgress(glowAt + DUR.f6, Math.max(1, atEnd - 5 - (glowAt + DUR.f6)));
  // 「一整圈点亮」逐站顺序涟漪：站位顺 4→0→1→2→3（光点过站次序），每站隔 3 帧
  const glowAts = STATIONS.map((_, i) => arrowAt + 10 + 3 * ((i + 1) % STATIONS.length));
  // 回放光点：自站位五起补完这一整圈（0.8 → 1.2 恰落回站位二；匀速＝机械巡游豁免）
  const lap = useProgress(arrowAt, 26, 'linear');
  const arrow = useDraw(arrowAt, DUR.f5);
  // 参数袋随行小签：callAt 出现、到达执行位（pulseAt 同帧）反向淡出融入脉冲
  const paramTagO = useProgress(callAt, DUR.f3) * (1 - useProgress(pulseAt, DUR.f3));
  // tool_use_id 配对签：调用块与结果条同一枚单号（gl-notes §3.2「带上 tool_use_id」）
  const PairTag: React.FC = () => (
    <span
      style={{
        position: 'absolute',
        top: -12,
        right: -10,
        fontFamily: theme.mono,
        fontSize: 13,
        color: theme.dim,
        padding: '1px 6px',
        borderRadius: 6,
        border: `1.5px solid ${theme.panelBorder}`,
        background: theme.panel,
      }}
    >
      #01
    </span>
  );
  return (
    <AbsoluteFill>
      <StepStage
        active={active}
        markAts={[0, 0, 0, pulseAt, arrowAt]}
        dotProgress={frame >= arrowAt ? 0.8 + 0.4 * lap : undefined}
        glowAts={glowAts}
      />
      <ExecBay pulseAt={pulseAt} />
      <MsgList
        headerAt={OFFSCREEN}
        fills={[
          {slot: 0, role: 'user', label: '问题', at: OFFSCREEN},
          {slot: 1, role: 'assistant', label: '回答', at: OFFSCREEN},
          {slot: 2, role: 'user', label: '工具结果', at: fill2At, accent: theme.tool},
        ]}
      />

      {/* p1-08：调用块（回答里检出的那枚，参数袋随行）进入执行位 */}
      <TravelChip p0={{x: 1470, y: 486}} c={{x: 1000, y: 700}} p2={{x: 560, y: 800}} at={t1} dur={DUR.f6} enterAt={callAt}>
        <div style={{position: 'relative'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 10,
              border: `2px solid ${theme.tool}`,
              background: `${theme.tool}26`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.tool}}>{'tool_use'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: theme.text}}>{'调用'}</span>
          </div>
          <PairTag />
          {/* 「照单执行」的单：1-C 弹出的参数袋随行到达，脉冲即融入 */}
          <div
            style={{
              position: 'absolute',
              left: '100%',
              top: 6,
              marginLeft: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 8,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: paramTagO,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'参数'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'input'}</span>
          </div>
        </div>
      </TravelChip>

      {/* p1-08「包成工具结果」→ p1-09「塞回对话」：结果条以新消息身份入列三格（同 #01 配对签） */}
      <TravelChip p0={{x: 560, y: 800}} c={{x: 1150, y: 868}} p2={{x: 1598, y: 568}} at={t2} dur={DUR.f6} enterAt={resultAt}>
        <div style={{position: 'relative'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 12,
              border: `2px solid ${theme.tool}`,
              background: `${theme.tool}26`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{'工具结果'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.tool}}>{'tool_result'}</span>
          </div>
          <PairTag />
        </div>
      </TravelChip>

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 回流箭头（pathLength 归一化描线，p1-09「回到第二步」词落位接通） */}
        <path
          d={BACK_ARC.d}
          fill="none"
          stroke={theme.core}
          strokeWidth={RING_STROKE - 2}
          strokeLinecap="round"
          {...arrow}
        />
        <path
          d="M0 -7 L0 7 L13 0 Z"
          fill={theme.core}
          transform={`translate(${BACK_ARC.end.x} ${BACK_ARC.end.y}) rotate(72)`}
          opacity={frame >= arrowAt + DUR.f5 ? 1 : 0}
        />
        {/* 一整圈点亮：环体辉光一拍（峰 0.7 + 低档 hold 0.3 至 beat 尾——重音镜） */}
        <circle
          cx={RING_CU.cx}
          cy={RING_CU.cy}
          r={RING_CU.r}
          fill="none"
          stroke={theme.core}
          strokeWidth={RING_STROKE + 4}
          opacity={Math.max(0.7 * glow, 0.3 * glowHold)}
        />
      </svg>

      <Footnote delay={4}>{'tool_result'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-E ECU 角色标签特写：青/灰对比，user 身份揭示 ───────────────────────

const RoleRow: React.FC<{
  top: number;
  role: string;
  color: string;
  text: string;
  at: number;
  f1: number;
  f2: number;
  /** 身份签（如 user 行的 tool_result）——跨镜同物恒常：1-D 青条在 1-E 的延续 */
  tag?: string;
}> = ({top, role, color, text, at, f1, f2, tag}) => {
  // 长距 slideL：自右侧消息列表方向滑入（1-D→1-E 焦点迁移的运动轨迹引导，§3.3）
  const enter = useEnter('slideL', {at, dur: DUR.f6, dist: 500, springPreset: 'settle'});
  const g1 = useImpulse({at: f1, dur: DUR.f5, peak: 0.9});
  const g2 = useImpulse({at: f2, dur: DUR.f6, peak: 1.7});
  const flash = Math.max(g1, g2);
  return (
    <div style={{position: 'absolute', left: 620, top, display: 'flex', alignItems: 'center', gap: 34, opacity: enter.opacity, transform: enter.transform}}>
      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 18,
          background: color,
          boxShadow: `0 0 ${40 * flash}px ${color}`,
          transform: `scale(${1 + 0.08 * flash})`,
        }}
      />
      <div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{role}</span>
          {tag ? (
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 14,
                color: theme.tool,
                padding: '1px 8px',
                borderRadius: 6,
                border: `1.5px solid ${theme.tool}`,
                opacity: 0.8,
              }}
            >
              {tag}
            </span>
          ) : null}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 62, fontWeight: 700, color: theme.text, marginTop: 4}}>{text}</div>
      </div>
    </div>
  );
};

const RoleTags: React.FC<{fA1: number; fB1: number; fA2: number; fB2: number; lineAt: number}> = ({
  fA1,
  fB1,
  fA2,
  fB2,
  lineAt,
}) => {
  const frames = useStagger(2, {at: 2, stride: 5, dur: DUR.f4});
  const line = useDraw(lineAt, DUR.f5);
  // 「对话输入侧」空槽容器：细线落点接住（不再是悬空文字）；恒空置守「第三条消息禁入镜」
  const slotO = useProgress(lineAt + DUR.f4, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 两条消息的空槽轮廓（只此两条——第三条消息禁入镜） */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 596,
            top: 360 + i * 190,
            width: 560,
            height: 136,
            borderRadius: 16,
            border: `2px dashed ${theme.panelBorder}`,
            opacity: 0.55 * frames[i],
          }}
        />
      ))}
      <RoleRow top={376} role="assistant" color={theme.tool} text="我要调工具" at={2} f1={fA1} f2={fA2} />
      <RoleRow
        top={566}
        role="user"
        color={theme.dim}
        text="这是你要的结果"
        at={2 + DUR.f3}
        f1={fB1}
        f2={fB2}
        tag="tool_result"
      />

      {/* p1-10b「都算输入」：一条细线自结果条指向对话输入侧（空槽容器承接） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M590 640 L320 730" fill="none" stroke={theme.dim} strokeWidth={3} {...line} />
        <path d="M0 -6 L0 6 L11 0 Z" fill={theme.dim} transform="translate(326 728) rotate(162.5)" opacity={line.strokeDashoffset < 0.1 ? 1 : 0} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 190,
          top: 708,
          width: 122,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          border: `2px dashed ${theme.dim}`,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: 0.55 * slotO,
        }}
      >
        {'输入'}
      </div>

      <Footnote delay={4}>{'tool_use · tool_result'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-F 拉回全景：五站回放 + ≈30 行标注 + 分工铭牌 ──────────────────────

const NameRow: React.FC<{at: number; color: string; text: string; top: number}> = ({at, color, text, top}) => {
  const enter = useEnter('pop', {at, dur: DUR.f5, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left: 0, top, width: 1920, textAlign: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <span style={{display: 'inline-flex', alignItems: 'center', gap: 18}}>
        <span style={{width: 20, height: 20, borderRadius: 5, background: color}} />
        <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.text}}>{text}</span>
      </span>
    </div>
  );
};

const MinimalCore: React.FC<{
  replayAt: number;
  exitAt: number;
  breathAt: number;
  plateA: number;
  plateB: number;
}> = ({replayAt, exitAt, breathAt, plateA, plateB}) => {
  // @pushIn 负增量：p1-12 把五步收束为一图（镜头拉远，变换原点钉在环心）
  const push = usePushIn(0, {scale: -0.06, dur: DUR.f6});
  const breath = useImpulse({at: breathAt, dur: DUR.f6});
  const lap = useProgress(replayAt, 30, 'linear');
  const frame = useCurrentFrame();
  // 出口门微亮（分镜 1-F 承诺）：dim 档双门柱闭合门，随「平稳退出」词显形 +
  // 微光一拍——确认绿留给 P2 2-D 唯一绿元素锁，此处只建门形前情（M-006 语义槽）
  const doorO = useProgress(exitAt, DUR.f4);
  const doorGlow = useImpulse({at: exitAt + DUR.f4, dur: DUR.f5});
  const ringRight = polar(RING_WS.cx, RING_WS.cy, RING_WS.r, 0);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '960px 530px', transform: push}}>
        <div style={{position: 'absolute', inset: 0, transform: `scale(${1 + 0.035 * breath})`}}>
          <RingMount anchor={RING_WS} dotProgress={frame >= replayAt ? lap : undefined} />
          {/* 五站快速顺序再点亮一圈（回放节奏：每站隔 5 帧；再入场也逐站顺序化） */}
          {STATIONS.map((s, i) => (
            <StationPlate key={s.label} anchor={RING_WS} index={i} lit glowAt={replayAt + i * 5} />
          ))}
          {STATIONS.map((s, i) => (
            <StationMark
              key={`m-${s.label}`}
              anchor={RING_WS}
              index={i}
              at={replayAt + i * 5 - DUR.f3}
              glowAt={replayAt + i * 5}
            />
          ))}
          {/* 出口门：环右缘 3 点钟引线 + 双门柱闭合门（无文字——铭牌是唯一新增文字） */}
          <svg
            width={240}
            height={100}
            style={{position: 'absolute', left: ringRight.x - 10, top: ringRight.y - 50, overflow: 'visible'}}
            opacity={doorO}
          >
            <line x1={0} y1={50} x2={38} y2={50} stroke={theme.dim} strokeWidth={3} />
            <g stroke={theme.dim} strokeWidth={4} fill="none" opacity={0.55 + 0.45 * doorGlow}>
              <line x1={44} y1={22} x2={44} y2={78} />
              <line x1={148} y1={22} x2={148} y2={78} />
              <path d="M44 22 H148" strokeWidth={3} />
              <path d="M44 78 H148" strokeWidth={3} />
              <line x1={96} y1={22} x2={96} y2={78} strokeWidth={2.5} strokeDasharray="6 6" opacity={0.8} />
            </g>
          </svg>
          {/* 分工铭牌（环心，两行随 p1-13 逐行落定；模型=决策 陶土橙 / 程序=执行 青碧） */}
          <NameRow at={plateA} color={theme.core} text="模型 = 决策" top={466} />
          <NameRow at={plateB} color={theme.tool} text="程序 = 执行" top={540} />
        </div>
      </div>
      <Footnote delay={breathAt}>{'≈30 行 · 最小内核'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1FiveSteps: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  // 词落位锚 = 句首 + 句长比例（口播无词级时间戳，比例即词窗）
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-09');
  const bE = w('p1-10', 'p1-10b');
  const bF = w('p1-12', 'p1-13');

  // 1-C 扫描窗：终点越过调用块左缘的 0.61 分位即命中（块右置——扫到在后半程）
  const scanAt = wa('p1-06', 0.52);
  const scanDur = Math.round(dur('p1-06') * 0.42);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <RingReveal
          flagInAt={wa('p1-02', 0.02) - bA.from}
          flashLAt={wa('p1-02', 0.45) - bA.from}
          flash2LAt={wa('p1-02', 0.86) - bA.from}
          flashRAt={wa('p1-02', 0.45) + 4 - bA.from}
          linesAt={wa('p1-02', 0.3) - bA.from}
          tickAt={wa('p1-03', 0.3) - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="1-B">
        <CallModel
          qAt={wa('p1-04', 0.16) - bB.from}
          cardsAt={wa('p1-05', 0.22) - bB.from}
          packAt={wa('p1-05', 0.58) - bB.from}
          brainAt={wa('p1-05', 0.85) - bB.from}
          fill0At={wa('p1-04', 0.16) + DUR.f5 - bB.from}
          station1At={at('p1-05') - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="1-C">
        <ArchiveScan
          ansAt={wa('p1-06', 0.08) - bC.from}
          hopAt={wa('p1-06', 0.3) - bC.from}
          scanAt={scanAt - bC.from}
          scanDur={scanDur}
          blockHitAt={scanAt + Math.round(scanDur * 0.61) - bC.from}
          pulseAt={wa('p1-07', 0.55) - bC.from}
          pouchAt={wa('p1-07', 0.85) - bC.from}
          fill1At={wa('p1-06', 0.3) + DUR.f5 - bC.from}
        />
      </Sequence>

      <Sequence {...bD} name="1-D">
        <ExecuteFeed
          callAt={wa('p1-08', 0.12) - bD.from}
          t1={wa('p1-08', 0.26) - bD.from}
          pulseAt={wa('p1-08', 0.26) + DUR.f6 - bD.from}
          resultAt={wa('p1-08', 0.62) - bD.from}
          active5At={at('p1-09') - bD.from}
          t2={wa('p1-09', 0.38) - bD.from}
          fill2At={wa('p1-09', 0.38) + DUR.f6 - bD.from}
          arrowAt={wa('p1-09', 0.68) - bD.from}
          glowAt={wa('p1-09', 0.68) + 14 - bD.from}
          atEnd={bD.durationInFrames}
        />
      </Sequence>

      <Sequence {...bE} name="1-E">
        <RoleTags
          fA1={Math.round(dur('p1-10') * 0.2)}
          fB1={Math.round(dur('p1-10') * 0.32)}
          fA2={wa('p1-10', 0.62) - 6 - bE.from}
          fB2={wa('p1-10', 0.62) - bE.from}
          lineAt={wa('p1-10b', 0.6) - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="1-F">
        <MinimalCore
          replayAt={4}
          exitAt={wa('p1-12', 0.8) - bF.from}
          breathAt={wa('p1-12', 0.8) - bF.from}
          plateA={wa('p1-13', 0.35) - bF.from}
          plateB={wa('p1-13', 0.75) - bF.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1FiveSteps;
