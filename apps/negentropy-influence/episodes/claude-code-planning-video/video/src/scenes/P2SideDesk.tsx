/** P2 副台与回执（p2-01..30，7 镜 9 cue）——分镜 2-A…2-G。
 *
 *  ★ 空间契约：DeskPlane 主台（coreDeep 大矩形〔M-001〕）恒居画面中央、框体恒静；
 *    副台是第二件 mech 紫装置，**自主台右侧展开**——2-B 的 solids-3d 台体一现是本集
 *    唯一 3D 点缀（planning §3 定案），3D 组合零 motion hook、运动量全部由本幕以 prop
 *    注入；主台内容物对副台压暗不可见（useDim），隔离带 dim 虚线。
 *  ★ 2-C 回执仪式：副台中间过程碎纸化（过程不进主台），单张回执（mech 描边纸片）
 *    跨过台面边界弧线落在主台——「只带回结论」的空间读法。
 *  ★ 2-E 是三连反转对撞卡的第二次出场（D2）：右倾终态＝官方轨胜出。
 *  archify 两图全屏独占：2-D 副台解剖＋三条边界（p2-12／p2-14 空窗句回落自制小卡）、
 *    2-F 撞线回溯＋回执同形（两镜与前镜均隔长空档 → 默认 lead）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ClashCard, DeskPlane, Footnote, LoopRing, Panel, ReceiptPaper, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {SHELL_FACES, Slab3D, Stage3D, axoRotation} from '../components/solids-3d';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, progress, useCount, useDim, useEnter, useProgress, useReveal, useSpring, useStagger} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，由 Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 确定性透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅（及翻版）剪影——text 白，人一律无彩 */
const Person: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.88,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={theme.text} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
  </svg>
);

/** 坑对账卡（与 P1 同形：幕开幕账的共用形态） */
const PitCard: React.FC<{index: string; zh: string; at: number}> = ({index, zh, at}) => {
  const e = useEnter('fade', {at, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', left: 96, top: 132, ...e}}>
      <Panel accent={theme.mech} style={{padding: '12px 24px', display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.mech}}>{index}</span>
        <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{zh}</span>
      </Panel>
    </div>
  );
};

/** 台面文件 glyph（过程数据一律无彩：dim 描边） */
const FileGlyph: React.FC<{x: number; y: number; s?: number; o?: number}> = ({x, y, s = 1, o = 1}) => (
  <svg width={30 * s} height={40 * s} style={{position: 'absolute', left: x, top: y, opacity: o}}>
    <path
      d={`M${3 * s} ${2 * s} H${19 * s} L${27 * s} ${10 * s} V${38 * s} H${3 * s} Z`}
      fill={theme.panel}
      stroke={theme.dim}
      strokeWidth={2.5}
    />
    <path d={`M${19 * s} ${2 * s} V${10 * s} H${27 * s}`} fill="none" stroke={theme.dim} strokeWidth={2} />
    <line x1={8 * s} y1={18 * s} x2={22 * s} y2={18 * s} stroke={theme.panelBorder} strokeWidth={2.5} />
    <line x1={8 * s} y1={26 * s} x2={22 * s} y2={26 * s} stroke={theme.panelBorder} strokeWidth={2.5} />
  </svg>
);

// ── 2-A 坑二对账：上下文污染滚涨 ─────────────────────────────────────────

const FILE_ROWS = 5;
const FILE_COLS = 6;

const PollutionSurge: React.FC<{atRows: number; rowsWin: number; atCounts: number}> = ({
  atRows,
  rowsWin,
  atCounts,
}) => {
  const rows = useStagger(FILE_ROWS, {at: atRows, fit: {total: Math.max(1, rowsWin)}});
  const n1 = useCount({from: 0, to: 30, at: atCounts, dur: DUR.f6, ease: 'standard'});
  const n2 = useCount({from: 0, to: 60, at: atCounts + 14, dur: DUR.f6, ease: 'standard'});
  const n3 = useCount({from: 0, to: 100, at: atCounts + 28, dur: DUR.f6, ease: 'standard'});
  const cards = useStagger(3, {at: atCounts, stride: 14, dur: DUR.f4});
  const note = useProgress(atCounts + DUR.f6, DUR.f4);

  const counters: {v: number; unit: string; suffix?: string}[] = [
    {v: n1, unit: '文件'},
    {v: n2, unit: '轮'},
    {v: n3, unit: '条', suffix: '+'},
  ];
  return (
    <AbsoluteFill>
      {/* 台面内容物滚涨：文件图标一行行堆叠（dim） */}
      {Array.from({length: FILE_ROWS}, (_, r) =>
        Array.from({length: FILE_COLS}, (_, c) => {
          const p = rows[r];
          return (
            <FileGlyph
              key={`${r}-${c}`}
              x={790 + c * 64}
              y={350 + r * 76 - (1 - p) * 22}
              o={p}
            />
          );
        }),
      )}

      {/* 滚涨计数数字卡三联（叙事口径） */}
      {counters.map((c, i) => (
        <div
          key={c.unit}
          style={{
            position: 'absolute',
            left: 1520,
            top: 300 + i * 148,
            opacity: cards[i],
            transform: `translateY(${(1 - cards[i]) * 16}px)`,
          }}
        >
          <Panel accent={theme.mechDeep} style={{width: 330, padding: '16px 26px'}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 62,
                  fontWeight: 700,
                  color: theme.mech,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(c.v)}
                {c.suffix}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginLeft: 6}}>{c.unit}</span>
            </div>
          </Panel>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 1520,
          top: 748,
          fontFamily: theme.sans,
          fontSize: 21,
          color: theme.dim,
          opacity: note,
        }}
      >
        {'叙事口径'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 副台升起（solids-3d 一现） ───────────────────────────────────────

/** 副台 3D 几何（世界单位 = CSS px；正交 zoom 1——solids-3d 宪法二） */
const SIDE3D = {plateW: 360, plateH: 24, plateD: 230, legW: 20, legH: 148, canvas: {w: 500, h: 360}} as const;
/** 副台画布锚位（自主台右侧展开）：画布中心 ≈ (1690, 560) */
const SIDE_CANVAS = {left: 1440, top: 380} as const;
/** 升起行程：r=0 时台面整组沉在画布下缘之外，r=1 落位 */
const SIDE_TRAVEL = 262;

/** 副台台体（mech 紫装置）：台板 + 双腿。零 motion hook——rise 由调用方注入；
 *  面色走 SHELL_FACES 梯度（宪法三），概念色只走 mech/mechDeep 棱线。 */
const SideDesk3D: React.FC<{rise: number}> = ({rise}) => {
  const r = clamp01(rise);
  return (
    <Stage3D width={SIDE3D.canvas.w} height={SIDE3D.canvas.h}>
      {/* 静置俯角 20°/偏航 -8°（朝主台一侧微转）；相机全程不动（宪法二） */}
      <group rotation={axoRotation({pitch: 20, yaw: -8})} position={[0, -SIDE_TRAVEL * (1 - r), 0]}>
        <Slab3D
          width={SIDE3D.plateW}
          height={SIDE3D.plateH}
          depth={SIDE3D.plateD}
          position={[0, 60, 0]}
          skin={{face: SHELL_FACES[1], edge: theme.mech, edgeOpacity: 0.9}}
        />
        {[-1, 1].map((s) => (
          <Slab3D
            key={s}
            width={SIDE3D.legW}
            height={SIDE3D.legH}
            depth={SIDE3D.legW}
            position={[s * 140, 60 - SIDE3D.plateH / 2 - SIDE3D.legH / 2, 30]}
            skin={{face: SHELL_FACES[2], edge: theme.mechDeep, edgeOpacity: 0.8}}
          />
        ))}
      </group>
    </Stage3D>
  );
};

/** 全新台面上的任务条子：白纸无彩（结论前的一切都不上色）。入场经 style 注入。 */
const TaskSlip: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div style={{position: 'absolute', left: 1620, top: 410, ...style}}>
    <svg width={140} height={78} style={{display: 'block'}}>
      <rect x={1.5} y={1.5} width={137} height={75} rx={6} fill={theme.text} />
      <path d="M110 1.5 V22 H138.5" fill="none" stroke={theme.panelBorder} strokeWidth={2} />
      <line x1={16} y1={34} x2={124} y2={34} stroke={theme.panelBorder} strokeWidth={3} />
      <line x1={16} y1={50} x2={92} y2={50} stroke={theme.panelBorder} strokeWidth={3} />
    </svg>
  </div>
);

const SideDeskRise: React.FC<{atRise: number; atSlip: number; atIso: number; atLoop: number; span: number}> = ({
  atRise,
  atSlip,
  atIso,
  atLoop,
  span,
}) => {
  const rise = useSpring('settle', {at: atRise, dur: DUR.f6});
  // 主台内容物对副台压暗不可见（台面框体〔M-001〕不随之压暗——恒静）
  const dim = useDim({at: atRise + DUR.f4, to: 0.35, dur: DUR.f6});
  const slip = useEnter('pop', {at: atSlip, dur: DUR.f4, springPreset: 'settle'});
  const iso = useProgress(atIso, DUR.f5);
  // 师傅翻版跑自己的循环：mini LoopRing（core 橙微缩，恒定锚的节拍也不变）
  const loopIn = useProgress(atLoop, DUR.f5);
  const spin = useProgress(0, Math.max(1, span), 'linear');
  const deskLabels = useProgress(atRise + DUR.f5, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 主台（框体恒静）＋内容物压暗 */}
      <DeskPlane />
      <div style={{position: 'absolute', left: 0, top: 0, opacity: dim}}>
        <Person x={560} y={110} scale={0.9} />
        <FileGlyph x={820} y={430} o={0.9} />
        <FileGlyph x={880} y={470} o={0.9} />
        <FileGlyph x={860} y={520} o={0.9} />
      </div>

      {/* 副台 3D 一现：画布紧贴 3D 区域（本集唯一 3D 点缀） */}
      <div style={{position: 'absolute', left: SIDE_CANVAS.left, top: SIDE_CANVAS.top}}>
        <SideDesk3D rise={rise} />
      </div>

      {/* 隔离带：两台之间的 dim 虚线（隔离的是对话，不是世界） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={1466}
          y1={250}
          x2={1466}
          y2={800}
          stroke={theme.dim}
          strokeWidth={3}
          strokeDasharray="10 14"
          opacity={0.7 * iso}
        />
      </svg>

      {/* 全新台面上只放一张任务条子（白纸无彩） */}
      <TaskSlip style={{opacity: slip.opacity, transform: slip.transform}} />

      {/* 师傅翻版：在副台从头干起、跑自己的循环 */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: loopIn}}>
        <Person x={1722} y={386} scale={0.55} />
        <div style={{position: 'absolute', left: 1596, top: 498}}>
          <LoopRing size={130} dotProgress={spin * (span / 75)} showLabels={false} showExit={false} />
        </div>
      </div>

      {/* 台面标签（主台/副台） */}
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 826,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: deskLabels,
        }}
      >
        {'主台'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1654,
          top: 690,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: deskLabels * clamp01(rise),
        }}
      >
        {'副台'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 回执仪式：碎纸化＋回执弧线落位 ───────────────────────────────────

/** 副台 2D 收敛形态（3D 只在 2-B 一现；此后副台以 2D 同形常驻） */
const SideDesk2D: React.FC<{x: number; y: number}> = ({x, y}) => (
  <svg width={380} height={190} style={{position: 'absolute', left: x, top: y}}>
    <rect x={0} y={0} width={380} height={18} rx={7} fill={theme.panel} stroke={theme.mech} strokeWidth={4} />
    <line x1={30} y1={18} x2={30} y2={190} stroke={theme.mechDeep} strokeWidth={5} />
    <line x1={350} y1={18} x2={350} y2={190} stroke={theme.mechDeep} strokeWidth={5} />
  </svg>
);

/** 二次贝塞尔（回执弧线） */
const qbez = (p0: {x: number; y: number}, pc: {x: number; y: number}, p1: {x: number; y: number}, t: number) => {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * pc.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * pc.y + t * t * p1.y,
  };
};

const RECEIPT_PATH = {
  from: {x: 1640, y: 430},
  ctrl: {x: 1180, y: 290},
  to: {x: 860, y: 552},
} as const;

const ReceiptRite: React.FC<{atScraps: number; atFly: number; atTitle: number}> = ({
  atScraps,
  atFly,
  atTitle,
}) => {
  const frame = useCurrentFrame();
  const title = useProgress(atTitle, DUR.f5);
  const fly = useSpring('settle', {at: atFly, dur: DUR.f6});
  const flyIn = useProgress(atFly, DUR.f3);
  // 碎纸化：副台中间过程逐片淡出飘散（纯函数 per-scrap 窗口——铁律①的 map 形态）
  const scraps = [
    {x: 1520, y: 418, w: 46, h: 30},
    {x: 1580, y: 404, w: 60, h: 34},
    {x: 1656, y: 424, w: 42, h: 28},
    {x: 1706, y: 400, w: 66, h: 38},
    {x: 1560, y: 448, w: 52, h: 30},
    {x: 1640, y: 458, w: 40, h: 26},
    {x: 1740, y: 446, w: 48, h: 32},
  ];
  const deskIn = useProgress(2, DUR.f4);
  const pos = qbez(RECEIPT_PATH.from, RECEIPT_PATH.ctrl, RECEIPT_PATH.to, clamp01(fly));
  return (
    <AbsoluteFill>
      <DeskPlane />
      <Person x={560} y={110} scale={0.9} />
      <SideDesk2D x={1490} y={470} />

      {/* 副台干活的中间过程：碎纸化（dim 淡出飘散——过程不进主台） */}
      {scraps.map((s, i) => {
        const p = progress(frame, atScraps + i * 4, DUR.f6);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y - 52 * p,
              width: s.w,
              height: s.h,
              borderRadius: 4,
              background: theme.panel,
              border: `2px solid ${theme.dim}`,
              opacity: (1 - p) * deskIn,
              transform: `rotate(${(i % 2 === 0 ? 1 : -1) * 14 * p}deg)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 1490,
          top: 432,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: deskIn,
        }}
      >
        {'副台'}
      </div>

      {/* 单张回执：跨过台面边界，弧线落在主台台面（mech 描边纸片） */}
      <div
        style={{
          position: 'absolute',
          left: pos.x - 95,
          top: pos.y - 64,
          opacity: flyIn,
          transform: `rotate(${clamp01(fly) * 14 - 7}deg)`,
        }}
      >
        <ReceiptPaper w={190} h={128} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 826,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: deskIn,
        }}
      >
        {'主台'}
      </div>

      {/* 题词（落位后停驻〔M-003〕） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 212,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          fontWeight: 700,
          color: theme.text,
          opacity: title,
        }}
      >
        <span style={{color: theme.mech}}>{'一张回执'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span>{'过程作废'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 空窗回落件 ───────────────────────────────────────────────────────

/** p2-12 空窗回落：「同工作区」文件落地小标记（副作用保留——文件落在两台共用的地上） */
const WorkdirMark: React.FC = () => {
  const e = useEnter('pop', {at: 2, dur: DUR.f4, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...e}}>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 360,
          width: 800,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 32,
          fontWeight: 600,
          color: theme.text,
        }}
      >
        {'同工作区'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 420,
          width: 800,
          height: 210,
          border: `3px dashed ${theme.dim}`,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 56,
        }}
      >
        {[1.5, 1.2].map((s, i) => (
          <svg key={i} width={30 * s} height={40 * s}>
            <path
              d={`M${3 * s} ${2 * s} H${19 * s} L${27 * s} ${10 * s} V${38 * s} H${3 * s} Z`}
              fill={theme.panel}
              stroke={theme.dim}
              strokeWidth={2.5}
            />
            <path d={`M${19 * s} ${2 * s} V${10 * s} H${27 * s}`} fill="none" stroke={theme.dim} strokeWidth={2} />
          </svg>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 660,
          width: 800,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
        }}
      >
        {'写的文件 · 跑的命令都生效'}
      </div>
    </div>
  );
};

/** p2-14 空窗回落：「拦因回传」小卡（每次工具调用也过门禁，被拦就把原因回给副台） */
const BlockReasonCard: React.FC = () => {
  const e = useEnter('pop', {at: 2, dur: DUR.f4, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...e}}>
      <div style={{position: 'absolute', left: 600, top: 400}}>
        <Panel style={{width: 720, height: 260, padding: 0, overflow: 'hidden'}}>
          <div
            style={{
              padding: '14px 28px',
              borderBottom: `2px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 28,
              fontWeight: 600,
              color: theme.text,
            }}
          >
            {'拦因回传'}
          </div>
          <div style={{position: 'relative', height: 178}}>
            <svg width={720} height={178}>
              {/* 门禁闸（deny） */}
              <rect x={96} y={44} width={16} height={90} rx={5} fill={theme.deny} />
              <rect x={124} y={44} width={16} height={90} rx={5} fill={theme.deny} opacity={0.55} />
              {/* 回传箭头：被拦 → 原因弯回副台 */}
              <path
                d="M170 88 H420 Q470 88 470 128 V150"
                fill="none"
                stroke={theme.dim}
                strokeWidth={4}
                strokeDasharray="9 9"
              />
              <path d="M458 140 L470 154 L482 140" fill="none" stroke={theme.dim} strokeWidth={4} />
              {/* 副台 mini 形 */}
              <rect x={520} y={96} width={130} height={12} rx={5} fill={theme.panel} stroke={theme.mech} strokeWidth={3} />
              <line x1={540} y1={108} x2={540} y2={150} stroke={theme.mechDeep} strokeWidth={4} />
              <line x1={630} y1={108} x2={630} y2={150} stroke={theme.mechDeep} strokeWidth={4} />
            </svg>
          </div>
        </Panel>
      </div>
    </div>
  );
};

// ── 2-E D2 对撞卡 ────────────────────────────────────────────────────────

/** D2 左槽：拆源码引语卡（mono 逐字＋归属角标） */
const D2Quote: React.FC<{atAttr: number; atQuote: number}> = ({atAttr, atQuote}) => {
  const attr = useProgress(atAttr, DUR.f4);
  const line = useReveal('派生工具默认在禁用名单', {at: atQuote + 4, cps: 9});
  return (
    <Panel style={{width: '100%', height: 380, boxSizing: 'border-box', padding: '26px 32px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: attr}}>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.dim,
            border: `2px solid ${theme.dim}`,
            borderRadius: 6,
            padding: '2px 10px',
          }}
        >
          {'【三】'}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{'开源项目作者 · 源码分析'}</span>
      </div>
      <div style={{marginTop: 40, minHeight: 120}}>
        <span style={{fontFamily: theme.serif, fontSize: 64, color: theme.panelBorder}}>{'“'}</span>
        <div style={{fontFamily: theme.mono, fontSize: 36, lineHeight: 1.8, color: theme.text, whiteSpace: 'pre'}}>
          {line}
        </div>
      </div>
    </Panel>
  );
};

/** D2 右槽：官方文档页样 */
const D2Docs: React.FC = () => (
  <Panel accent={theme.panelBorder} style={{width: '100%', height: 380, boxSizing: 'border-box', padding: '22px 30px'}}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 14,
        borderBottom: `2px solid ${theme.panelBorder}`,
      }}
    >
      {[0, 1, 2].map((i) => (
        <div key={i} style={{width: 11, height: 11, borderRadius: 999, background: theme.panelBorder}} />
      ))}
      <span style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'docs'}</span>
    </div>
    <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 52, fontWeight: 700, color: theme.text}}>
      {'默认可再派'}
    </div>
    <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>{'最深三层'}</div>
  </Panel>
);

const D2Clash: React.FC<{
  atLeft: number;
  atAttr: number;
  atQuote: number;
  atRight: number;
  atArrows: number;
  atTilt: number;
  atStrip: number;
}> = ({atLeft, atAttr, atQuote, atRight, atArrows, atTilt, atStrip}) => {
  const eL = useProgress(atLeft, DUR.f5, 'decelerate');
  const eR = useProgress(atRight, DUR.f5, 'decelerate');
  const eA = useProgress(atArrows, DUR.f5);
  const tilt = useSpring('settle', {at: atTilt, dur: DUR.f5});
  const strip = useProgress(atStrip, DUR.f5);
  return (
    <AbsoluteFill>
      <ClashCard
        enter={[eL, eR, eA]}
        tilt={tilt}
        left={<D2Quote atAttr={atAttr} atQuote={atQuote} />}
        right={<D2Docs />}
        strip={
          <div
            style={{
              textAlign: 'center',
              fontFamily: theme.sans,
              fontSize: 25,
              color: theme.dim,
              letterSpacing: 2,
              opacity: strip,
            }}
          >
            {'教学不给工具 · 产品默认放开 · 以官方为准'}
          </div>
        }
      />
    </AbsoluteFill>
  );
};

// ── 2-G 官方双边界两联卡 ─────────────────────────────────────────────────

/** 随行件 glyph：嘱托册（册子）／代码状态快照（相机）——一律 dim（官方件非本集装置） */
const BookGlyph: React.FC = () => (
  <svg width={64} height={64}>
    <rect x={8} y={6} width={48} height={52} rx={5} fill="none" stroke={theme.dim} strokeWidth={4} />
    <line x1={8} y1={18} x2={56} y2={18} stroke={theme.dim} strokeWidth={4} />
    {[0, 1, 2].map((i) => (
      <line key={i} x1={18} y1={30 + i * 9} x2={46} y2={30 + i * 9} stroke={theme.panelBorder} strokeWidth={3} />
    ))}
  </svg>
);

const CameraGlyph: React.FC = () => (
  <svg width={64} height={64}>
    <rect x={4} y={16} width={56} height={40} rx={8} fill="none" stroke={theme.dim} strokeWidth={4} />
    <path d="M22 16 L28 6 H36 L42 16" fill="none" stroke={theme.dim} strokeWidth={4} />
    <circle cx={32} cy={36} r={12} fill="none" stroke={theme.dim} strokeWidth={4} />
  </svg>
);

const DualBorders: React.FC<{
  atHead: number;
  atUpper: number;
  atItems: number;
  atLower: number;
  atTicks: number;
  atNote: number;
}> = ({atHead, atUpper, atItems, atLower, atTicks, atNote}) => {
  const head = useProgress(atHead, DUR.f5);
  const upper = useEnter('rise', {at: atUpper, dur: DUR.f5, dist: 26});
  const items = useStagger(2, {at: atItems, stride: 12, dur: DUR.f4});
  const lower = useEnter('rise', {at: atLower, dur: DUR.f5, dist: 26});
  // 占位刻度条：mono 点阵逐点揭示（每一点 = 一张回执占走的台面）
  const ticks = useReveal('················', {at: atTicks, cps: 7});
  const note = useProgress(atNote, DUR.f4);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 176,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          color: theme.dim,
          opacity: head,
        }}
      >
        {'官方补的两条边界'}
      </div>

      {/* 上联：干净 ≠ 空（副台开工随行件） */}
      <div style={{position: 'absolute', left: 300, top: 268, ...upper}}>
        <Panel style={{width: 1320, height: 240, padding: '22px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>{'干净'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>{'≠'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>{'空'}</span>
            <div style={{marginLeft: 'auto', display: 'flex', gap: 64}}>
              {[BookGlyph, CameraGlyph].map((G, i) => (
                <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: items[i]}}>
                  <G />
                  <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
                    {i === 0 ? '嘱托册' : '快照'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* 下联：隔过程 · 不隔结果（回执占位刻度条——回执也花钱） */}
      <div style={{position: 'absolute', left: 300, top: 560, ...lower}}>
        <Panel accent={theme.coreDeep} style={{width: 1320, height: 250, padding: '22px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>
              {'隔过程'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>{'·'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>
              {'不隔结果'}
            </span>
          </div>
          {/* 台面切面（coreDeep）上的占位刻度条 */}
          <div style={{position: 'relative', marginTop: 40, width: 900}}>
            <div style={{position: 'absolute', left: 0, bottom: -14, width: 900, height: 9, borderRadius: 5, background: theme.coreDeep}} />
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 40,
                color: theme.dim,
                letterSpacing: 8,
                whiteSpace: 'pre',
                lineHeight: 1,
              }}
            >
              {ticks}
            </div>
            <div style={{position: 'absolute', right: -140, top: -58}}>
              <ReceiptPaper w={140} h={94} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 64,
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                opacity: note,
              }}
            >
              {'自己花钱'}
            </div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2SideDesk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-04', 'p2-07');
  const bC = w('p2-08', 'p2-09');
  const bD = w('p2-10', 'p2-16');
  const bE = w('p2-17', 'p2-20');
  const bF = w('p2-21', 'p2-24');
  const bG = w('p2-25', 'p2-30');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 过程污染滚涨">
        <SceneTag chapter="messages" tagline="副台与回执" />
        <DeskPlane />
        <Person x={560} y={110} scale={0.9} />
        <PitCard index="坑二" zh="过程污染" at={at('p2-01') - bA.from} />
        <PollutionSurge
          atRows={at('p2-02') - bA.from}
          rowsWin={dur('p2-02')}
          atCounts={at('p2-02') - bA.from + DUR.f4}
        />
        <Footnote delay={at('p2-02') - bA.from}>{'messages'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="2-B 副台升起（3D 一现）">
        <SideDeskRise
          atRise={at('p2-04') - bB.from}
          atSlip={at('p2-05') - bB.from + 6}
          atIso={at('p2-06') - bB.from}
          atLoop={at('p2-07') - bB.from}
          span={bB.durationInFrames}
        />
        <Footnote delay={at('p2-05') - bB.from}>{'task · fresh context'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="2-C 回执仪式">
        {/* p2-08＝回执跨界落位；p2-09＝中间过程碎纸化＋题词（句义对位） */}
        <ReceiptRite
          atScraps={at('p2-09') - bC.from}
          atFly={at('p2-08') - bC.from + 8}
          atTitle={at('p2-09') - bC.from + Math.round(dur('p2-09') * 0.45)}
        />
        <Footnote delay={at('p2-08') - bC.from}>{'extract_text · only summary'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="2-D 副台三条边界">
        {/* 前镜（1-F p1-26）隔长空档 → 默认 lead；实例内 p2-12／p2-14 空窗后
            border-gate／no-sub-desk 自动恢复入场 */}
        <ArchifyRecap
          slug="plan-side-desk"
          caption="副台解剖"
          cues={[
            {chapterId: 'three-borders', at: at('p2-10') - bD.from, durationInFrames: dur('p2-10')},
            {chapterId: 'border-world', at: at('p2-11') - bD.from, durationInFrames: dur('p2-11')},
            {chapterId: 'border-gate', at: at('p2-13') - bD.from, durationInFrames: dur('p2-13')},
            {chapterId: 'no-sub-desk', at: at('p2-15') - bD.from, durationInFrames: dur('p2-15')},
            {chapterId: 'recursion-capability', at: at('p2-16') - bD.from, durationInFrames: dur('p2-16')},
          ]}
        />
        {/* p2-12 空窗回落：同工作区文件落地小标记（窗＝本句，勿越入后续 cue 窗） */}
        <Sequence from={at('p2-12') - bD.from} durationInFrames={dur('p2-12')} name="2-D 同工作区小标记">
          <WorkdirMark />
        </Sequence>
        {/* p2-14 空窗回落：拦因回传小卡 */}
        <Sequence from={at('p2-14') - bD.from} durationInFrames={dur('p2-14')} name="2-D 拦因回传小卡">
          <BlockReasonCard />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="2-E D2 对撞">
        <D2Clash
          atLeft={at('p2-17') - bE.from}
          atAttr={at('p2-17') - bE.from + 8}
          atQuote={at('p2-18') - bE.from}
          atRight={at('p2-19') - bE.from}
          atArrows={at('p2-19') - bE.from + 10}
          atTilt={at('p2-20') - bE.from}
          atStrip={at('p2-20') - bE.from + 6}
        />
        <Footnote delay={at('p2-19') - bE.from}>{'subagents up to three layers'}</Footnote>
      </Sequence>

      <Sequence {...bF} name="2-F 撞线回溯与回执同形">
        {/* 2-D 之后隔 p2-17..20 空档 → 默认 lead（分镜背靠背清单不含本镜） */}
        <ArchifyRecap
          slug="plan-side-guards"
          caption="撞线回溯"
          cues={[
            {chapterId: 'turn-cap', at: at('p2-21') - bF.from, durationInFrames: dur('p2-21')},
            {chapterId: 'backward-scan', at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
            {chapterId: 'same-shape', at: at('p2-23') - bF.from, durationInFrames: dur('p2-23')},
            {chapterId: 'receipt-blind', at: at('p2-24') - bF.from, durationInFrames: dur('p2-24')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="2-G 官方双边界">
        <DualBorders
          atHead={at('p2-25') - bG.from}
          atUpper={at('p2-26') - bG.from}
          atItems={at('p2-27') - bG.from}
          atLower={at('p2-28') - bG.from}
          atTicks={at('p2-29') - bG.from}
          atNote={at('p2-29') - bG.from + DUR.f5}
        />
        <Footnote delay={at('p2-27') - bG.from}>{'CLAUDE.md hierarchy · git status snapshot'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2SideDesk;
