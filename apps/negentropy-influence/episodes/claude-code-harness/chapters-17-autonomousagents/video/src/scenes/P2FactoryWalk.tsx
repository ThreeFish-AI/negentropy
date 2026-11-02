/** P2 走查：一个空闲拍（p2-01..p2-09，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  幕间转场（1-E→2-A，头注明示）：机制解构→走查舞台属场景切换（内容工厂
 *  任务墙=ep12 任务墙同款签名换场），走幕界 SceneFade + 全景重锚（非 morph）；
 *  位置呼应：1-E 末帧收拢暗灰的队友机体 = 2-A 首帧队友一展开位（同一机体再
 *  上线）；值班钟随机体跨场恒常。
 *
 *  叙事链：2-A 走查舞台全景：p2-01「四件活」词落位初稿/配图/排版/发布四卡
 *  stagger 挂墙（task_005 级编号签——走查输入值首建、全程可追）→ p2-02 两词
 *  落位三条依赖线（初稿→排版、配图→排版、排版→发布）点亮——依赖拓扑全亮
 *  定格 → 2-B 第一拍 CU：p2-03「交完初稿」初稿卡打勾翻绿、「钟响」钟摆落拍、
 *  「先看信，空的」第一落点格口探查空闪一下 → p2-04「再看墙」第二落点扫到
 *  配图卡、「配图刚被队友二写上名字」名字签高亮一拍即过（不动=有主语义）→
 *  p2-05「陷阱卡」扫到墙角推近、「不存在的编号」幽灵编号 task_999 显形、
 *  「按被挡算，不许开工」拦截绿灯与依赖红灯双灯对照定格（P2 记忆点，重音镜）
 *  → 2-C 第二拍：p2-06「这一拍没活，睡」队友一机体半收拢微降一拍、「下一拍」
 *  钟摆再落、「队友二交完配图」配图卡打勾翻绿 → p2-07「排版三条全齐」三灯
 *  齐亮（双绿输入可追）、「写名，认领，回干活」队友一名字签写入、卡面翻
 *  「进行中」、环体加速+高亮一小段（认领回 WORK——走查闭环重音镜）→ 2-D
 *  走查收束全景（@pushIn 负增量拉远）：p2-08「四件活全部落地」发布卡翻绿、
 *  四绿定格（计数角标 4/4）、「没人指挥过一句」拉远重锚、队长位后景虚化
 *  → p2-09「同一拍」「同一张卡」双影自画面边缘渗入悬于墙上方（P3 接棒位）。
 *
 *  空间契约：四卡等大等距、依赖线箭头单向（被依赖→依赖）、三线点亮次序=
 *  口播次序、每拍动作次序恒定先信后墙（复用 1-B 语法）、幽灵编号可读、依赖
 *  红灯常亮非闪烁、陷阱卡纹丝不动（基线）、配图卡不被再次认领、三灯齐亮
 *  帧序先于写名、环体高亮为一小段非整环、拉远落定后 ≥10 帧再切。
 *  红线落实：发布卡禁提前翻绿、编号签禁显字成句、陷阱卡禁被写名或翻绿、
 *  拦截灯禁用警示红（绿=机制在位）、跳过三灯直接写名禁、环体整环高亮禁、
 *  双影禁显出机制细节（P3 正源）；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：2-D→3-A morph（同一主体 = 「同一拍同一张卡」双影：2-D 末帧双影
 *    半透悬于任务墙上方 → 3-A 首帧双影落位分化为两个队友机体的视线连线、
 *    交汇于同一张空卡——渗入到落位过程双影数量恒为二、交汇点屏位逐帧不变，
 *    仅透明度与形态变化。见 P3SeeNotGrab 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AgentBody,
  DepArrow,
  DutyClock,
  GhostPair,
  LoopRing,
  NameTag,
  pendSwing,
  phasedRing,
  SegArc,
  TallyCounter,
  TeammateRing,
  TrapCard,
  WallTaskCard,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 走查舞台共用布局（2-A / 2-C / 2-D 同一坐标锚——全景坐标锚） ──────────────

/** 安全带红线（ep15 底环侵入返工教训）：墙区底边 = 520+220=740、陷阱卡底
 *  640+170+倾角余量 ≈ 822、队友环底 580+190=770、名签底 ~830，恒 ≤ 860；
 *  往下挪任一常量须同步核算。 */
const WALL2 = {
  draft: {x: 250, y: 190, w: 340, h: 220},
  art: {x: 250, y: 520, w: 340, h: 220},
  layout: {x: 790, y: 355, w: 340, h: 220},
  ship: {x: 1330, y: 355, w: 340, h: 220},
} as const;
const DEPS2 = [
  {x1: 596, y1: 300, x2: 786, y2: 420},
  {x1: 596, y1: 630, x2: 786, y2: 470},
  {x1: 1136, y1: 430, x2: 1326, y2: 430},
] as const;
const MATES2 = [
  {x: 40, y: 580, size: 190},
  {x: 1690, y: 580, size: 190},
] as const;
const RING_TOP2 = {x: 1745, y: 30, size: 150} as const;
const TRAP2 = {x: 1470, y: 640} as const;

/** 走查墙（四卡 + 依赖线 + 陷阱卡——状态由各镜注入） */
const FactoryBoard: React.FC<{
  draftP: {green: number};
  artP: {claim: number; green: number};
  layoutP: {lamps: [number, number, number]; claim: number; pill: number; green: number};
  shipP: {green: number};
  depsP: [number, number, number];
  trapP: {ghost: number; red: number; gate: number; zoom: number};
  hotArt: number;
}> = ({draftP, artP, layoutP, shipP, depsP, trapP, hotArt}) => (
  <>
    <WallTaskCard x={WALL2.draft.x} y={WALL2.draft.y} w={WALL2.draft.w} h={WALL2.draft.h} id="task_005" title="初稿" greenP={draftP.green} />
    <WallTaskCard
      x={WALL2.art.x}
      y={WALL2.art.y}
      w={WALL2.art.w}
      h={WALL2.art.h}
      id="task_006"
      title="配图"
      claimP={artP.claim}
      signer="队友二"
      greenP={artP.green}
      hotP={hotArt}
      deps={[{id: 'task_005', doneP: draftP.green}]}
      depsP={1}
    />
    <WallTaskCard
      x={WALL2.layout.x}
      y={WALL2.layout.y}
      w={WALL2.layout.w}
      h={WALL2.layout.h}
      id="task_007"
      title="排版"
      lamps={layoutP.lamps}
      claimP={layoutP.claim}
      signer="队友一"
      activePillP={layoutP.pill}
      greenP={layoutP.green}
      deps={[
        {id: 'task_005', doneP: draftP.green},
        {id: 'task_006', doneP: artP.green},
      ]}
      depsP={1}
    />
    <WallTaskCard
      x={WALL2.ship.x}
      y={WALL2.ship.y}
      w={WALL2.ship.w}
      h={WALL2.ship.h}
      id="task_008"
      title="发布"
      greenP={shipP.green}
      deps={[{id: 'task_007', doneP: layoutP.green}]}
      depsP={1}
    />
    {DEPS2.map((d, i) => (
      <DepArrow key={`dp${i}`} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} drawP={depsP[i]} litP={depsP[i] > 0.9 ? 1 : 0} />
    ))}
    <TrapCard x={TRAP2.x} y={TRAP2.y} litP={1} ghostP={trapP.ghost} redP={trapP.red} gateP={trapP.gate} zoomP={trapP.zoom} />
  </>
);

/** 走查队友（值班钟挂胸口——摆动由各镜注入） */
const WalkMate: React.FC<{x: number; y: number; size: number; name: string; swing: number; clockLit: number; droopP?: number; dot: number; segLit?: number}> = ({
  x,
  y,
  size,
  name,
  swing,
  clockLit,
  droopP = 0,
  dot,
  segLit = 0,
}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    <TeammateRing size={size} dotProgress={dot} />
    <SegArc size={size} from={-22} to={24} litP={segLit} />
    <AgentBody x={size / 2 - 40} y={30} w={80} h={100} tone={theme.mate} droopP={droopP}>
      <div style={{position: 'absolute', left: -19, top: 2}}>
        <DutyClock x={0} y={0} size={118} litP={clockLit} swing={swing} />
      </div>
    </AgentBody>
    <div style={{position: 'absolute', left: size / 2 - 44, top: size + 46, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
      {name}
    </div>
  </div>
);

// ── 2-A 开台：四卡 stagger 挂墙 + 依赖拓扑三线点亮 ────────────────────────────

const TwoA: React.FC<{atCards: number[]; atDeps: number[]}> = ({atCards, atDeps}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = ((frame / (fps * 2.5)) % 1 + 1) % 1;
  const cards = atCards.map((a) => clamp01(progress(frame, a, 12)));
  const deps: [number, number, number] = [
    clamp01(progress(frame, atDeps[0], 14)),
    clamp01(progress(frame, atDeps[1], 14)),
    clamp01(progress(frame, atDeps[2], 14)),
  ];
  const allLit = deps[2] > 0.95;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕缩悬顶角（坐标锚） */}
      <div style={{position: 'absolute', left: RING_TOP2.x, top: RING_TOP2.y}}>
        <LoopRing size={RING_TOP2.size} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
      </div>
      <FactoryBoard
        draftP={{green: 0}}
        artP={{claim: 0, green: 0}}
        layoutP={{lamps: [0, 0, 0], claim: 0, pill: 0, green: 0}}
        shipP={{green: 0}}
        depsP={deps}
        trapP={{ghost: 0, red: 0, gate: 0, zoom: 0}}
        hotArt={0}
      />
      {/* 四卡入场透明度（挂墙 stagger——以 litP 包一层） */}
      <CardLitMask cards={cards} />
      <WalkMate x={MATES2[0].x} y={MATES2[0].y} size={MATES2[0].size} name="队友一" swing={pendSwing(frame)} clockLit={1} dot={dot} />
      <WalkMate x={MATES2[1].x} y={MATES2[1].y} size={MATES2[1].size} name="队友二" swing={pendSwing(frame)} clockLit={1} dot={(dot + 0.4) % 1} />
      {allLit ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 128, textAlign: 'center', fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: 0.75}}>
          {'依赖拓扑全亮：排版 ← 初稿 + 配图 · 发布 ← 排版'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'内容工厂 · task_005..task_008 · 走查输入值全程可追'}
      </div>
    </AbsoluteFill>
  );
};

/** 四卡入场遮罩层（2-A stagger 挂墙——以同位暗框罩住未入场卡） */
const CardLitMask: React.FC<{cards: number[]}> = ({cards}) => (
  <>
    {[WALL2.draft, WALL2.art, WALL2.layout, WALL2.ship].map((c, i) =>
      cards[i] < 0.98 ? (
        <div
          key={`mask${i}`}
          style={{
            position: 'absolute',
            left: c.x - 4,
            top: c.y - 4,
            width: c.w + 8,
            height: c.h + 8,
            borderRadius: 14,
            background: theme.bg,
            opacity: 1 - cards[i],
          }}
        />
      ) : null,
    )}
  </>
);


// ── 2-B 第一拍 CU：初稿翻绿 + 钟落探信（空）+ 扫墙（有主不动）+ 陷阱卡 ────────

/** 2-B 布局（安全带红线：信箱格底 660+160=820、排版卡底 500+220=720、陷阱
 *  卡推近底 ~830，恒 ≤ 860。 */
const BB = {
  clock: {x: 470, y: 300, size: 300},
  inbox: {x: 90, y: 660, w: 240, h: 160},
  draft: {x: 430, y: 130, w: 360, h: 230},
  art: {x: 920, y: 170, w: 340, h: 220},
  layout: {x: 920, y: 470, w: 340, h: 220},
  trap: {x: 1400, y: 620},
} as const;

const TwoB: React.FC<{atGreen: number; atBell: number; atLook1: number; atLook2: number; atNameHot: number; atTrap: number; atGhost: number; atLamps: number}> = ({
  atGreen,
  atBell,
  atLook1,
  atLook2,
  atNameHot,
  atTrap,
  atGhost,
  atLamps,
}) => {
  const frame = useCurrentFrame();
  // 初稿卡打勾翻绿（交完）
  const green = clamp01(progress(frame, atGreen, 14));
  // 钟摆落拍（钟响——事件式：中位 → 第一落点 → 回中 → 第二落点扫墙）
  const swing =
    frame < atLook1 + 8
      ? -clamp01(progress(frame, atBell, 14))
      : frame < atLook2
        ? -1 + clamp01(progress(frame, atLook1 + 8, 12))
        : clamp01(progress(frame, atLook2, 14));
  const probe1 = Math.sin(Math.PI * clamp01(progress(frame, atLook1 + 6, 22)));
  const probe2 = Math.sin(Math.PI * clamp01(progress(frame, atLook2 + 12, 22)));
  // 配图名字签高亮一拍即过（不动=有主语义）
  const nameHot = Math.sin(Math.PI * clamp01(progress(frame, atNameHot, 26)));
  // 陷阱卡：推近 + 幽灵编号 + 双灯对照定格
  const zoom = clamp01(progress(frame, atTrap, 16));
  const ghost = clamp01(progress(frame, atGhost, 14));
  const redLit = clamp01(progress(frame, atGhost + 6, DUR.f4));
  const gateLit = clamp01(progress(frame, atLamps, DUR.f4));
  const gateFlash = Math.sin(Math.PI * clamp01(progress(frame, atLamps, 24)));
  return (
    <AbsoluteFill>
      {/* 初稿卡（打勾翻绿——走查第一件落地） */}
      <WallTaskCard x={BB.draft.x} y={BB.draft.y} w={BB.draft.w} h={BB.draft.h} id="task_005" title="初稿" greenP={green} />
      {/* 队友一胸口值班钟（落拍——两落点探查） */}
      <DutyClock x={BB.clock.x} y={BB.clock.y} size={BB.clock.size} litP={1} swing={swing} landing1P={1} landing2P={1} probe1P={probe1} probe2P={probe2} />
      {/* 第一落点：队友一收件箱格口（空、闪一下灰） */}
      <MailboxMini x={BB.inbox.x} y={BB.inbox.y} w={BB.inbox.w} h={BB.inbox.h} probe={probe1} />
      {/* 第二落点扫墙：配图卡（队友二名字签已亮——有主·不动） */}
      <div style={{position: 'absolute', left: BB.art.x, top: BB.art.y}}>
        <WallTaskCard x={0} y={0} w={340} h={220} id="task_006" title="配图" claimP={1} signer="队友二" hotP={nameHot} deps={[{id: 'task_005', doneP: green}]} depsP={1} />
      </div>
      {/* 排版卡（两灯亮一灯暗——依赖 1/2） */}
      <div style={{position: 'absolute', left: BB.layout.x, top: BB.layout.y}}>
        <WallTaskCard
          x={0}
          y={0}
          w={340}
          h={220}
          id="task_007"
          title="排版"
          lamps={[clamp01(green), 1, 0]}
          deps={[
            {id: 'task_005', doneP: green},
            {id: 'task_006', doneP: 0},
          ]}
          depsP={1}
        />
      </div>
      {/* 陷阱卡（半悬墙角——推近 + 幽灵编号 + 双灯对照定格） */}
      <div style={{position: 'absolute', left: BB.trap.x, top: BB.trap.y}}>
        <TrapCard x={0} y={0} litP={1} ghostP={ghost} redP={redLit} gateP={gateLit} zoomP={zoom} />
        {gateFlash > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: -46,
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: gateFlash,
            }}
          >
            拦截 · 按被挡算
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'can_start · 每拍先信后墙 · task_999 不存在 → 不许开工'}
      </div>
    </AbsoluteFill>
  );
};

/** 第一落点信箱小样（空、闪一下——格口探查） */
const MailboxMini: React.FC<{x: number; y: number; w: number; h: number; probe: number}> = ({x, y, w, h, probe}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 12,
        border: `3px solid ${withAlpha(theme.inbox, 0.75)}`,
        background: withAlpha(theme.panel, 0.96),
        boxShadow: probe > 0.03 ? `0 0 ${22 * probe}px ${withAlpha(theme.inbox, 0.5 * probe)}` : 'none',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontFamily: theme.mono, fontSize: 15, color: theme.inbox, whiteSpace: 'nowrap'}}>
        <svg width={16} height={16} viewBox="0 0 20 20">
          <path d="M3 2 h9 l4 4 v12 h-13 z" fill="none" stroke={theme.inbox} strokeWidth={2} />
        </svg>
        teammate-1.jsonl
      </div>
      <div style={{margin: '14px 16px 0', height: 20, borderRadius: 5, border: `2px dashed ${withAlpha(theme.dim, 0.55)}`}} />
      <div style={{textAlign: 'center', marginTop: 14, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: 0.4 + 0.6 * probe, whiteSpace: 'nowrap'}}>空</div>
    </div>
  </div>
);

// ── 2-C 第二拍：睡眠半拍 → 钟再落 → 配图翻绿 → 排版三灯齐 + 写名认领 ─────────

const TwoC: React.FC<{atSleep: number; atBell: number; atGreen: number; atLamps: number[]; atWrite: number; atPill: number; atAccel: number}> = ({
  atSleep,
  atBell,
  atGreen,
  atLamps,
  atWrite,
  atPill,
  atAccel,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 队友一睡眠半拍（半收拢微降一拍——非关机）
  const sleep = Math.sin(Math.PI * clamp01(progress(frame, atSleep, 26)));
  // 钟摆再落（下一拍——持续五秒节拍）
  const swingOn = clamp01(progress(frame, atBell - 8, 10));
  const sw = pendSwing(frame, atBell) * swingOn;
  // 配图卡打勾翻绿（队友二交完）
  const greenArt = clamp01(progress(frame, atGreen, 14));
  // 排版三灯齐亮（三灯齐亮帧序先于写名）
  const lamps: [number, number, number] = [
    clamp01(progress(frame, atLamps[0], 10)),
    clamp01(progress(frame, atLamps[1], 10)),
    clamp01(progress(frame, atLamps[2], 10)),
  ];
  // 写名（名字签写入）→ 卡面翻「进行中」→ 环体加速+高亮一小段（认领回 WORK）
  const write = clamp01(progress(frame, atWrite, 14));
  const pill = clamp01(progress(frame, atPill, 12));
  const accel = clamp01(progress(frame, atAccel, 14));
  const segLit = clamp01(progress(frame, atAccel + 4, 12));
  const mate1Dot = phasedRing(frame, fps, [
    {at: 0, sec: 2.5},
    {at: atAccel, sec: 1.3},
  ]);
  const dot = ((frame / (fps * 2.5)) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: RING_TOP2.x, top: RING_TOP2.y}}>
        <LoopRing size={RING_TOP2.size} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
      </div>
      <FactoryBoard
        draftP={{green: 1}}
        artP={{claim: 1, green: greenArt}}
        layoutP={{lamps, claim: write, pill, green: 0}}
        shipP={{green: 0}}
        depsP={[1, 1, 1]}
        trapP={{ghost: 1, red: 1, gate: 1, zoom: 0}}
        hotArt={greenArt > 0.2 && greenArt < 1 ? 0.6 : 0}
      />
      <WalkMate x={MATES2[0].x} y={MATES2[0].y} size={MATES2[0].size} name={accel > 0.5 ? '队友一 · 回干活' : '队友一'} swing={sw} clockLit={1} droopP={sleep * 0.5} dot={mate1Dot} segLit={segLit} />
      <WalkMate x={MATES2[1].x} y={MATES2[1].y} size={MATES2[1].size} name="队友二" swing={sw} clockLit={1} dot={(dot + 0.4) % 1} />
      {/* 写名飞行（队友一伸手写名——名字签自机体侧飞入排版卡） */}
      {write > 0.05 && write < 0.9 ? (
        <NameTag
          x={MATES2[0].x + MATES2[0].size + 20 + (WALL2.layout.x - MATES2[0].x - MATES2[0].size - 60) * write}
          y={MATES2[0].y + 80 - Math.sin(Math.PI * write) * 80 + (WALL2.layout.y + 150 - MATES2[0].y - 80) * write}
          label="队友一"
          writeP={1}
          size={24}
        />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'claim_task · 三灯齐亮 → 写名认领 → 环体回 WORK 加速'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 收束全景：四绿定格 + 计数 4/4 + 拉远（负增量）+ 双影渗入 ─────────────

const TwoD: React.FC<{atShip: number; atPull: number; atGhosts: number[]; beatEnd: number}> = ({atShip, atPull, atGhosts, beatEnd}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = ((frame / (fps * 2.5)) % 1 + 1) % 1;
  // 拉远降压（@pushIn 负增量——动机：「没人指挥过一句」拉远示全貌）
  const pull = usePushIn(atPull, {scale: -0.07, dur: 26});
  // 发布卡最后翻绿 + 四绿定格（计数角标 4/4 与 narration 一致）
  const greenShip = clamp01(progress(frame, atShip, 14));
  const count = greenShip > 0.5 ? 4 : 3;
  const countLit = clamp01(progress(frame, atShip + 10, DUR.f4));
  // 队长位后景虚化（无动作——没人指挥过一句）
  const leadDim = clamp01(progress(frame, atPull - 6, 16));
  // 双影渗入（同一拍、同一张卡——两枚半透队友影自边缘渗入悬于墙上方，跨两词
  //  渐进；P3 接棒位）
  const ghostIn = clamp01(progress(frame, atGhosts[0], atGhosts[1] - atGhosts[0] + 22));
  const ghost2 = clamp01(progress(frame, atGhosts[1], 14));
  return (
    <AbsoluteFill style={{transform: pull, transformOrigin: '50% 42%'}}>
      <div style={{position: 'absolute', left: RING_TOP2.x - 200, top: 26, opacity: 0.35 * leadDim}}>
        <LoopRing size={130} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 20, top: 138, fontFamily: theme.sans, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>队长 · 后景</div>
      </div>
      <div style={{position: 'absolute', left: RING_TOP2.x, top: RING_TOP2.y}}>
        <LoopRing size={RING_TOP2.size} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
      </div>
      <FactoryBoard
        draftP={{green: 1}}
        artP={{claim: 1, green: 1}}
        layoutP={{lamps: [1, 1, 1], claim: 1, pill: 1, green: 1}}
        shipP={{green: greenShip}}
        depsP={[1, 1, 1]}
        trapP={{ghost: 1, red: 1, gate: 1, zoom: 0}}
        hotArt={0}
      />
      {/* 计数角标（4/4——离散给值） */}
      <TallyCounter x={1240} y={140} value={count} label={'/4 落地'} litP={countLit} />
      <WalkMate x={MATES2[0].x} y={MATES2[0].y} size={MATES2[0].size} name="队友一" swing={pendSwing(frame)} clockLit={1} dot={dot} />
      <WalkMate x={MATES2[1].x} y={MATES2[1].y} size={MATES2[1].size} name="队友二" swing={pendSwing(frame)} clockLit={1} dot={(dot + 0.4) % 1} />
      {/* 双影（同一拍同一张卡——自画面边缘渗入悬于墙上方，禁显机制细节） */}
      <GhostPair x={700} y={64} p={ghostIn} fromX={-260} />
      {ghost2 > 0.3 ? (
        <div style={{position: 'absolute', left: 700, top: 226, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap', opacity: clamp01(ghost2 * 1.4 - 0.3)}}>
          同一拍 · 同一张卡？
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * clamp01(1 - progress(frame, beatEnd - 6, 6))}}>
        {'selftest · 4/4 落地 · 陷阱卡被挡 · 零指挥'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2FactoryWalk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-05');
  const bC = w('p2-06', 'p2-07');
  const bD = w('p2-08', 'p2-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atCards={[0.3, 0.44, 0.58, 0.7].map((f) => wa('p2-01', f) - bA.from)}
          atDeps={[0.34, 0.5, 0.78].map((f) => wa('p2-02', f) - bA.from)}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atGreen={wa('p2-03', 0.14) - bB.from}
          atBell={wa('p2-03', 0.42) - bB.from}
          atLook1={wa('p2-03', 0.62) - bB.from}
          atLook2={wa('p2-04', 0.2) - bB.from}
          atNameHot={wa('p2-04', 0.48) - bB.from}
          atTrap={wa('p2-05', 0.12) - bB.from}
          atGhost={wa('p2-05', 0.5) - bB.from}
          atLamps={wa('p2-05', 0.74) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atSleep={wa('p2-06', 0.14) - bC.from}
          atBell={wa('p2-06', 0.46) - bC.from}
          atGreen={wa('p2-06', 0.72) - bC.from}
          atLamps={[0.2, 0.3, 0.4].map((f) => wa('p2-07', f) - bC.from)}
          atWrite={wa('p2-07', 0.56) - bC.from}
          atPill={wa('p2-07', 0.72) - bC.from}
          atAccel={wa('p2-07', 0.84) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD atShip={wa('p2-08', 0.16) - bD.from} atPull={wa('p2-08', 0.56) - bD.from} atGhosts={[wa('p2-09', 0.3), wa('p2-09', 0.6)].map((v) => v - bD.from)} beatEnd={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2FactoryWalk;
