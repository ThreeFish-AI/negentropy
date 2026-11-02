/** MotionGallery——运动层的评审面（独立 Remotion 入口，不经 Root.tsx）。
 *
 * 用法（在 video/ 目录，.bin 直调防污染根 workspace）：
 *   ./node_modules/.bin/remotion still src/motion/gallery.tsx MotionGallery \
 *       out/motion-gallery.png --frame=30
 *
 * 全部模型 × 变体一屏可渲：秒级出图，供 token 校准轮逐格目视。
 * 色板为本文件内字面量（dev 工具面，不进成片、不读 theme——保持 frozen 跨系列共享）。
 */
import React from 'react';
import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {
  useAccelTravel,
  useBreathe,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useFadeOut,
  useFlowDash,
  useImpulse,
  usePushIn,
  useReveal,
  useShake,
  useStagger,
  useTravel,
} from './hooks';

const COLS = 5;
const CW = 340;
const CH = 230;
const GAP = 18;

/** dev 工具面字面量色板（与各集 theme 底座同值但刻意独立声明——不读 theme）。 */
const C = {
  bg: '#0E1116',
  panel: '#171C26',
  border: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  core: '#D97757',
  mech: '#64C4C0',
  deny: '#EF6461',
};

/** 单元格壳：定位 + 角标。 */
const Cell: React.FC<{i: number; name: string; children: React.ReactNode}> = ({i, name, children}) => (
  <div
    style={{
      position: 'absolute',
      left: 72 + (i % COLS) * (CW + GAP),
      top: 96 + Math.floor(i / COLS) * (CH + GAP),
      width: CW,
      height: CH,
      background: C.panel,
      border: `2px solid ${C.border}`,
      borderRadius: 12,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: '28px 0 34px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
    <div style={{position: 'absolute', left: 12, bottom: 8, fontFamily: 'monospace', fontSize: 15, color: C.dim}}>
      {name}
    </div>
  </div>
);

const Box: React.FC<{color?: string; w?: number; h?: number; style?: React.CSSProperties}> = ({
  color = C.core,
  w = 200,
  h = 80,
  style,
}) => <div style={{width: w, height: h, background: C.panel, border: `2px solid ${color}`, borderRadius: 10, ...style}} />;

// ── 每格一个组件：hooks 各归其位（Rules of Hooks 的最简守法形态） ────────

const EnterCell: React.FC<{kind: Parameters<typeof useEnter>[0]}> = ({kind}) => {
  const e = useEnter(kind, {});
  return <Box style={{opacity: e.opacity, transform: e.transform}} />;
};

const StaggerCell: React.FC = () => {
  const ps = useStagger(5, {dur: 5, fit: {total: 60}});
  return (
    <div style={{display: 'flex', gap: 10}}>
      {ps.map((p, i) => (
        <div
          key={i}
          style={{
            width: 34,
            height: 80,
            background: C.panel,
            border: `2px solid ${C.mech}`,
            borderRadius: 8,
            opacity: p,
            transform: `translateY(${(1 - p) * 14}px)`,
          }}
        />
      ))}
    </div>
  );
};

const DrawCell: React.FC = () => {
  const d = useDraw(0, 24);
  return (
    <svg width={280} height={110}>
      <path {...d} d="M10 90 C 90 10, 190 100, 270 20" stroke={C.core} strokeWidth={5} fill="none" strokeLinecap="round" />
    </svg>
  );
};

const ImpulseCell: React.FC = () => {
  const g = useImpulse({dur: 30, peak: 1});
  return (
    <div
      style={{
        width: 90,
        height: 90,
        borderRadius: '50%',
        background: C.core,
        opacity: 0.3 + 0.7 * g,
        boxShadow: `0 0 ${10 + 30 * g}px ${C.core}`,
      }}
    />
  );
};

const BreatheCell: React.FC = () => {
  const b = useBreathe({period: 30});
  return (
    <svg width={160} height={110}>
      <circle cx={80} cy={55} r={40} fill="none" stroke={C.mech} strokeWidth={5} opacity={b} />
    </svg>
  );
};

const TravelCell: React.FC = () => {
  const t = useTravel({cx: 140, cy: 55, r: 42, secPerLap: 3});
  return (
    <svg width={280} height={110}>
      <circle cx={140} cy={55} r={42} fill="none" stroke={C.border} strokeWidth={4} />
      <circle cx={t.x} cy={t.y} r={9} fill={C.core} />
    </svg>
  );
};

const AccelCell: React.FC = () => {
  const t = useAccelTravel({cx: 140, cy: 55, r: 42, durs: [28, 20, 14], at: 4});
  const heat = `rgb(${217 + Math.round(38 * t.heat)}, ${119 - Math.round(60 * t.heat)}, ${87 - Math.round(20 * t.heat)})`;
  return (
    <svg width={280} height={110}>
      <circle cx={140} cy={55} r={42} fill="none" stroke={C.border} strokeWidth={4} strokeDasharray="4 6" />
      <circle cx={t.x} cy={t.y} r={9} fill={heat} />
    </svg>
  );
};

const CountCell: React.FC = () => {
  const v = useCount({to: 255, dur: 40});
  return (
    <div style={{fontFamily: 'monospace', fontSize: 44, color: C.text, fontVariantNumeric: 'tabular-nums'}}>
      {Math.round(v)}
    </div>
  );
};

const RevealCell: React.FC = () => {
  const s = useReveal('while (true) { think(); act(); }', {cps: 14});
  const blink = useBreathe({period: 16, amp: 0.5, base: 0.5});
  return (
    <div style={{fontFamily: 'monospace', fontSize: 20, color: C.text, whiteSpace: 'nowrap'}}>
      {s}
      <span style={{opacity: blink}}>▍</span>
    </div>
  );
};

const PushInCell: React.FC = () => {
  const t = usePushIn(0, {scale: 0.12});
  return <Box w={160} h={90} color={C.mech} style={{transform: t}} />;
};

const DimCell: React.FC = () => {
  const dim = useDim({at: 40, to: 0.35});
  return (
    <div style={{display: 'flex', gap: 12}}>
      <Box w={64} h={80} style={{opacity: dim}} />
      <Box w={64} h={80} color={C.core} />
      <Box w={64} h={80} style={{opacity: dim}} />
    </div>
  );
};

const FlowCell: React.FC = () => {
  const f = useFlowDash({period: 24});
  return (
    <svg width={280} height={60}>
      <line x1={10} y1={30} x2={270} y2={30} stroke={C.mech} strokeWidth={5} {...f} strokeLinecap="round" />
    </svg>
  );
};

const ShakeCell: React.FC = () => {
  const x = useShake({at: 10, amp: 5, decay: true, dur: 40});
  return <Box w={150} h={80} color={C.deny} style={{transform: `translateX(${x}px)`}} />;
};

const FadeCell: React.FC = () => {
  const op = useFadeOut(90, {frames: 36});
  return (
    <div style={{position: 'relative', width: 220, height: 90}}>
      <Box w={220} h={90} color={C.core} style={{position: 'absolute', inset: 0}} />
      <div style={{position: 'absolute', inset: 0, background: '#000', opacity: 1 - op}} />
    </div>
  );
};

const CELLS: Array<[string, React.ReactNode]> = [
  ['enter:fall', <EnterCell kind="fall" />],
  ['enter:rise', <EnterCell kind="rise" />],
  ['enter:slideL', <EnterCell kind="slideL" />],
  ['enter:pop', <EnterCell kind="pop" />],
  ['enter:flyIn', <EnterCell kind="flyIn" />],
  ['enter:fade', <EnterCell kind="fade" />],
  ['stagger×5 fit60', <StaggerCell />],
  ['draw 24f', <DrawCell />],
  ['impulse 30f', <ImpulseCell />],
  ['breathe p30', <BreatheCell />],
  ['travel 3s/lap', <TravelCell />],
  ['accelTravel', <AccelCell />],
  ['count→255', <CountCell />],
  ['reveal 14cps', <RevealCell />],
  ['pushIn .12', <PushInCell />],
  ['dim .35@40', <DimCell />],
  ['flowDash p24', <FlowCell />],
  ['shake decay', <ShakeCell />],
  ['fadeOut 36f', <FadeCell />],
];

const MotionGallery: React.FC = () => (
  <AbsoluteFill style={{background: C.bg}}>
    <div style={{position: 'absolute', left: 72, top: 44, fontFamily: 'monospace', fontSize: 24, color: C.text}}>
      MotionGallery · 30fps · 120f
    </div>
    {CELLS.map(([name, node], i) => (
      <Cell key={name} i={i} name={name}>
        {node}
      </Cell>
    ))}
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition id="MotionGallery" component={MotionGallery} width={1920} height={1080} fps={30} durationInFrames={120} defaultProps={{}} />
));
