/** P0 会写不会做（p0-01..p0-09，3 镜）——分镜 0-A / 0-B / 0-C（storyboard v1）。
 *
 *  ★ 0-A 开篇视听合力（I-039）：Terminal 母题居中，一条命令 p0-01 落字起逐字打出又停住，
 *    光标孤闪；p0-03 句尾整窗轻沉一拍 + 光标停闪变灰——无回车的死寂〔M-002〕：
 *    p0-03 句区间内零强调动效，只有句尾这一个 sanctioned 拍点。
 *  ★ 0-B 分屏搬运回路：左「模型」右「终端」，用户图标沿椭圆回路往返——
 *    单趟等速（机械感，本镜匀速豁免）+ 逐趟加密（storyboard「逐趟加速」）；
 *    回合计数随趟递增；p0-06「牛马」词落位计数数字脉冲一次〔M-005〕。
 *  ★ 0-C 接棒建锚：分屏收拢为竖直通道，用户图标淡出、程序方块自下而上滑入接棒；
 *    p0-09「喂回」词落位环体（LoopRing，core 描边 + RING_STROKE——〔M-001〕自此镜建锚）
 *    自雏形弧闭合成圆 + 一双手轻搭环上（类比 A#1）；@pushIn 揭示全片主角环体。
 *  ★ 署源角标（首部署源位，RSI I-080）：右下常驻「Learn Claude Code」，低饱和小字，
 *    一次淡入后全幕恒定不闪烁（挂在 Sequence 外，不受镜切换与 pushIn 影响）。
 *  ★ Visual Lock：0-C 程序方块无「脑」——决策脑（模型节点脑图标）恒在环上方；
 *    环体闭合成圆只发生在 p0-09 词落位（此前仅 22% 雏形弧）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, Terminal} from '../components/motifs';
import {DUR, clamp01, useEnter, useImpulse, useProgress, usePushIn, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 句间停顿（timing.json sentenceGapSec 0.32s ≈ 10 帧）——「句尾」锚从句窗尾回退的量 */
const TAIL_GAP_FRAMES = 10;

/** 词落位近似（句内相对位置——无词级时间戳，按句窗比例锚定，TTS 变更自动重定时） */
const W = {
  /** p0-06「牛马」 */
  niuma: 0.75,
  /** p0-08「交给程序」 */
  handoff: 0.55,
  /** p0-09「喂回给模型自己」 */
  feedBack: 0.45,
  /** p0-09「接上一双手」 */
  hands: 0.8,
} as const;

/** 0-A 命令行：p0-02「列目录、跑脚本」语义——一条合法、无害的组合命令 */
const COMMAND = 'ls -la ./lab && bash build.sh';

/** 0-B 搬运编排：总趟数与加密指数（t^a——逐趟加速；单趟内等速=机械感，匀速豁免） */
const CARRY_TRIPS = 9;
const CARRY_ACCEL = 1.3;

/** 0-B 双节点位（上半区 y≤472，给计数器与字幕带让位） */
const NODE = {y: 360, w: 380, h: 170, leftX: 330, rightX: 1590} as const;
/** 0-B 搬运回路：节点内缘间的椭圆（左端点=停靠位，与 0-C 交棒） */
const LOOP = {cx: 960, cy: NODE.y, rx: 430, ry: 112} as const;

/** 0-C 环体：小尺寸雏形（〔M-001〕建锚——core 描边 + RING_STROKE 由 LoopRing 恒定给出） */
const RING = {size: 340, cx: 960, cy: 570} as const;
/** 与 LoopRing 内部 r = size/2 - 46 同式（双手搭环的定位半径） */
const RING_R = RING.size / 2 - 46;
/** 雏形弧长（Visual Lock：p0-09 词落位前禁止闭合成圆） */
const RING_ARC0 = 0.22;
/** 双手落位角（屏幕度，0=右、90=下——环的左肩/右肩） */
const HAND_DEGREES = [205, 335] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 椭圆回路上的点（屏幕度；180=左节点，270=顶点，0=右节点，90=谷点） */
const ellPoint = (deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: LOOP.cx + LOOP.rx * Math.cos(rad), y: LOOP.cy + LOOP.ry * Math.sin(rad)};
};

/** 椭圆切向（θ 增方向 = 搬运行进方向，箭头指向用） */
const ellTangent = (deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: -LOOP.rx * Math.sin(rad), y: LOOP.ry * Math.cos(rad)};
};

/** 回路方向箭头（纯函数产 polygon——回路箭头单向循环可追） */
const arrowHead = (p: {x: number; y: number}, dir: {x: number; y: number}, color: string) => {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const nx = -dy;
  const ny = dx;
  return (
    <polygon
      points={`${p.x + dx * 20},${p.y + dy * 20} ${p.x + nx * 11},${p.y + ny * 11} ${p.x - nx * 11},${p.y - ny * 11}`}
      fill={color}
    />
  );
};

// ── 图标（简笔 SVG，帧外常量） ──────────────────────────────────────────

/** 用户小人：头 + 肩（牛马在场是 0-B 痛点前提，全程可见） */
const PersonGlyph: React.FC<{color: string}> = ({color}) => (
  <g>
    <circle cx={0} cy={-22} r={16} fill={color} />
    <path d="M-30 34 Q-30 -4 0 -8 Q30 -4 30 34 Z" fill={color} />
  </g>
);

/** 决策脑：轮廓 + 中央沟 + 两道脑回（只归模型节点——装置侧绝无此件，0-C Visual Lock） */
const BrainGlyph: React.FC<{color: string}> = ({color}) => (
  <svg width={64} height={52} viewBox="-32 -26 64 52">
    <g stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-20 6 Q-27 -4 -18 -11 Q-17 -21 -5 -22 Q6 -23 10 -16 Q21 -14 21 -4 Q21 6 12 9 Q-4 15 -20 6 Z" />
      <path d="M0 -22 Q-3 -8 0 10" />
      <path d="M-12 -6 Q-7 -3 -10 4" />
      <path d="M11 -5 Q7 -1 9 5" />
    </g>
  </svg>
);

/** 终端：屏幕框 + 提示符（执行面，tool 青） */
const TermGlyph: React.FC<{color: string}> = ({color}) => (
  <svg width={64} height={48} viewBox="-32 -24 64 48">
    <g stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x={-26} y={-18} width={52} height={36} rx={7} />
      <path d="M-13 -6 L-4 0 L-13 6" />
      <line x1={4} y1={6} x2={14} y2={6} />
    </g>
  </svg>
);

/** 简笔手：掌缘贴环 + 四指 + 拇指侧（指端朝本地 +y，旋转后搭向环心；A#1 落锚） */
const HAND_PATHS = [
  'M-22 4 Q-2 12 22 2',
  'M-14 -16 L-12 12',
  'M-4 -20 L-3 16',
  'M6 -20 L7 15',
  'M15 -16 L15 11',
  'M-26 -2 Q-31 -14 -19 -19',
];

/** 手在环上的落位：环上点 + 旋转角（本地 +y 从屏幕 90° 转向环心方向 deg+180） */
const handAt = (deg: number): {x: number; y: number; rot: number} => {
  const rad = (deg * Math.PI) / 180;
  return {
    x: RING.cx + RING_R * Math.cos(rad),
    y: RING.cy + RING_R * Math.sin(rad),
    rot: deg + 90,
  };
};

// ── 节点件（0-B 升起入场 / 0-C 弹簧收拢定位共用面板） ──────────────────

const NodeFace: React.FC<{accent: string; label: string; glyph: React.ReactNode}> = ({
  accent,
  label,
  glyph,
}) => (
  <Panel
    accent={accent}
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    }}
  >
    {glyph}
    <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: accent}}>{label}</div>
  </Panel>
);

const NodeRiser: React.FC<{
  cx: number;
  cy: number;
  accent: string;
  label: string;
  glyph: React.ReactNode;
  at: number;
}> = ({cx, cy, accent, label, glyph, at}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 26});
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - NODE.w / 2,
        top: cy - NODE.h / 2,
        width: NODE.w,
        height: NODE.h,
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <NodeFace accent={accent} label={label} glyph={glyph} />
    </div>
  );
};

const NodeCard: React.FC<{
  cx: number;
  cy: number;
  accent: string;
  label: string;
  glyph: React.ReactNode;
}> = ({cx, cy, accent, label, glyph}) => (
  <div
    style={{
      position: 'absolute',
      left: cx - NODE.w / 2,
      top: cy - NODE.h / 2,
      width: NODE.w,
      height: NODE.h,
    }}
  >
    <NodeFace accent={accent} label={label} glyph={glyph} />
  </div>
);

// ── 署源角标（首部署源位） ──────────────────────────────────────────────

/** 右下常驻「Learn Claude Code」：theme.dim 小字、一次淡入后恒定不闪烁不抢焦；
 *  bottom 168 ≥ 150 避开字幕条；挂 Sequence 外——全 P0 三镜恒定（storyboard 署源位） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

// ── 0-A 终端冷启动 ──────────────────────────────────────────────────────

/** 终端窗居中：p0-01 落字起命令逐字打出（cps=5）又停住，光标孤闪；
 *  p0-03 句尾（≈句窗尾减句间停顿）整窗轻沉 7px + 微压暗，光标同时停闪变灰（死寂落点）。
 *  p0-03 句区间内无任何其他强调动效〔M-002〕。 */
const ZeroA: React.FC<{atSink: number}> = ({atSink}) => {
  const enter = useEnter('fade', {at: 0, dur: DUR.f4});
  const sink = useProgress(atSink, DUR.f5, 'decelerate');
  const dim = 1 - 0.08 * useProgress(atSink, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter.opacity * dim, transform: `translateY(${7 * sink}px)`, marginTop: -90}}>
        <Terminal
          lines={[{text: COMMAND, delay: 0, prompt: '$ '}]}
          cps={5}
          freezeCursorAt={atSink}
          width={1180}
          height={430}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 分屏搬运回路 ────────────────────────────────────────────────────

/** 搬运回路：双节点 + 椭圆回路（方向箭头）+ 用户小人往返 + 回合计数。
 *  相位纯函数：t^CARRY_ACCEL × CARRY_TRIPS——趟内等速、逐趟加密（加速）；
 *  atPark 后钉在整数相位 = 停靠左端（0-B 末态确定，供 0-C 交棒）。 */
const ZeroB: React.FC<{atCarry: number; atPark: number; atWord: number}> = ({
  atCarry,
  atPark,
  atWord,
}) => {
  const frame = useCurrentFrame();
  const t = clamp01((frame - atCarry) / Math.max(1, atPark - atCarry));
  const phase = Math.pow(t, CARRY_ACCEL) * CARRY_TRIPS;
  const tripsDone = Math.min(CARRY_TRIPS, Math.floor(phase));
  const carrier = ellPoint(180 + (phase % 1) * 360);
  const personO = useProgress(0, DUR.f4);
  const trackO = useProgress(DUR.f2, DUR.f5);
  const countO = useProgress(atCarry, DUR.f4);
  const pulse = useImpulse({at: atWord, dur: DUR.f6});
  return (
    <AbsoluteFill>
      <NodeRiser
        at={0}
        cx={NODE.leftX}
        cy={NODE.y}
        accent={theme.text}
        label="模型"
        glyph={<BrainGlyph color={theme.text} />}
      />
      <NodeRiser
        at={DUR.f2}
        cx={NODE.rightX}
        cy={NODE.y}
        accent={theme.tool}
        label="终端"
        glyph={<TermGlyph color={theme.tool} />}
      />
      <svg
        width={1920}
        height={1080}
        style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
      >
        <ellipse
          cx={LOOP.cx}
          cy={LOOP.cy}
          rx={LOOP.rx}
          ry={LOOP.ry}
          fill="none"
          stroke={withAlpha(theme.dim, 0.5)}
          strokeWidth={3.5}
          strokeDasharray="12 12"
          opacity={trackO}
        />
        <g opacity={trackO}>
          {arrowHead(ellPoint(300), ellTangent(300), withAlpha(theme.dim, 0.85))}
          {arrowHead(ellPoint(120), ellTangent(120), withAlpha(theme.dim, 0.85))}
        </g>
        <g transform={`translate(${carrier.x} ${carrier.y})`} opacity={personO}>
          <PersonGlyph color={theme.text} />
        </g>
      </svg>
      {/* 回合计数：回路正下方 y≈600，避开字幕带（y≥920）与节点；「牛马」词落位脉冲一次 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 596,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.dim,
          opacity: countO,
        }}
      >
        来回{' '}
        <span
          style={{
            display: 'inline-block',
            fontSize: 64,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            transform: `scale(${1 + 0.38 * pulse})`,
          }}
        >
          {tripsDone}
        </span>{' '}
        趟
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 接棒建锚 ────────────────────────────────────────────────────────

/** 分屏收拢为竖直通道（模型居顶、终端居底）：用户图标自 0-B 停靠位淡出，
 *  程序方块 p0-08「交给程序」词落位自终端端滑入接棒（无脑——纯执行件）；
 *  环体雏形弧随方块到位亮出，p0-09「喂回」词落位闭合成圆、双手句尾轻搭（A#1）；
 *  p0-09 起整幕 @pushIn（揭示全片主角环体）。
 *  决策脑（模型节点）经收拢恒居于环上方——装置不产生决策。 */
const ZeroC: React.FC<{atBlock: number; atFeed: number; atHands: number; atPush: number}> = ({
  atBlock,
  atFeed,
  atHands,
  atPush,
}) => {
  const cv = useSpring('settle', {at: 0, dur: DUR.f6});
  const push = usePushIn(atPush, {scale: 0.055, dur: DUR.f6});
  const personO = 1 - useProgress(0, DUR.f4);
  const loopO = 1 - useProgress(0, DUR.f5);
  const channelO = 0.65 * useProgress(DUR.f3, DUR.f5);
  const blockP = useSpring('settle', {at: atBlock, dur: DUR.f6});
  const blockO = useProgress(atBlock, DUR.f4);
  const ringO = useProgress(atBlock + DUR.f3, DUR.f4);
  const closeP = useProgress(atFeed, DUR.f6, 'decelerate');
  const handP = useProgress(atHands, DUR.f5);
  const draw = RING_ARC0 + (1 - RING_ARC0) * closeP;
  const modelNode = {x: lerp(NODE.leftX, 960, cv), y: lerp(NODE.y, 265, cv)};
  const termNode = {x: lerp(NODE.rightX, 960, cv), y: lerp(NODE.y, 800, cv)};
  const blockY = lerp(880, RING.cy, blockP);
  const handoffPos = ellPoint(180);
  return (
    <AbsoluteFill style={{transform: push}}>
      {/* 环体：LoopRing 恒定 core 描边 + RING_STROKE（〔M-001〕自此镜建锚，全片锁定）；
          小尺寸关标签、零站点——五站牌位是 P1 的戏 */}
      <div
        style={{
          position: 'absolute',
          left: RING.cx - RING.size / 2,
          top: RING.cy - RING.size / 2,
          opacity: ringO,
        }}
      >
        <LoopRing size={RING.size} draw={draw} nodes={[]} showLabels={false} showExit={false} />
      </div>
      <svg
        width={1920}
        height={1080}
        style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
      >
        {/* 0-B 椭圆回路淡出 / 竖直通道淡入（分屏收拢） */}
        <ellipse
          cx={LOOP.cx}
          cy={LOOP.cy}
          rx={LOOP.rx}
          ry={LOOP.ry}
          fill="none"
          stroke={withAlpha(theme.dim, 0.5)}
          strokeWidth={3.5}
          strokeDasharray="12 12"
          opacity={loopO}
        />
        <line
          x1={960}
          y1={352}
          x2={960}
          y2={706}
          stroke={withAlpha(theme.dim, 0.55)}
          strokeWidth={3.5}
          strokeDasharray="12 12"
          opacity={channelO}
        />
        {/* 用户图标自 0-B 停靠位（椭圆左端）淡出——牛马下场 */}
        <g transform={`translate(${handoffPos.x} ${handoffPos.y})`} opacity={personO}>
          <PersonGlyph color={theme.text} />
        </g>
        {/* 程序方块：自终端端沿通道滑入环心接棒 */}
        <g transform={`translate(960 ${blockY})`} opacity={blockO}>
          <rect
            x={-32}
            y={-32}
            width={64}
            height={64}
            rx={10}
            fill={withAlpha(theme.tool, 0.14)}
            stroke={theme.tool}
            strokeWidth={4}
          />
          <text x={56} y={8} fontFamily={theme.sans} fontSize={24} fill={theme.tool}>
            程序
          </text>
        </g>
        {/* 双手轻搭环上：自环外 14px 轻落（effects 通道纯缓动，不吃弹簧） */}
        {HAND_DEGREES.map((deg) => {
          const h = handAt(deg);
          return (
            <g
              key={deg}
              opacity={handP}
              transform={`translate(${h.x} ${h.y}) rotate(${h.rot}) translate(0 ${(handP - 1) * 14})`}
            >
              {HAND_PATHS.map((d, i) => (
                <path key={i} d={d} stroke={theme.text} strokeWidth={4.5} fill="none" strokeLinecap="round" />
              ))}
            </g>
          );
        })}
      </svg>
      <NodeCard
        cx={modelNode.x}
        cy={modelNode.y}
        accent={theme.text}
        label="模型"
        glyph={<BrainGlyph color={theme.text} />}
      />
      <NodeCard
        cx={termNode.x}
        cy={termNode.y}
        accent={theme.tool}
        label="终端"
        glyph={<TermGlyph color={theme.tool} />}
      />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0ColdOpen: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-05', 'p0-06');
  const bC = w('p0-08', 'p0-09');

  return (
    <AbsoluteFill>
      <SourceCredit />
      <Sequence {...bA} name="0-A">
        <ZeroA
          atSink={at('p0-03') + span('p0-03') - (DUR.f5 + TAIL_GAP_FRAMES) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        {/* 局部帧 0 = p0-05 起点；词落位按句窗比例锚定（TTS 变更自动重定时） */}
        <ZeroB
          atCarry={DUR.f5}
          atPark={bB.durationInFrames - DUR.f5}
          atWord={at('p0-06') - bB.from + Math.round(span('p0-06') * W.niuma)}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atBlock={at('p0-08') - bC.from + Math.round(span('p0-08') * W.handoff)}
          atFeed={at('p0-09') - bC.from + Math.round(span('p0-09') * W.feedBack)}
          atHands={at('p0-09') - bC.from + Math.round(span('p0-09') * W.hands)}
          atPush={at('p0-09') - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
