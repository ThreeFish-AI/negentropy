/** RetrofitGallery——A/C 轨改造新增物的评审面（独立 Remotion 入口，不经 Root.tsx）。
 *
 * 仿 motion/gallery.tsx 范式：无需 manifest/音频管线，秒级出图。
 *
 * 用法（在 video/ 目录，.bin 直调防污染根 workspace）：
 *   ./node_modules/.bin/remotion still src/dev/retrofit-gallery.tsx RetrofitGallery \
 *       ../out/retrofit-f40.png --frame=40
 *
 * 五格：①P3 兜底弧（evolvePath）②P4 回流弧（evolvePath）③PlateSlab3D 对比板
 * ④HarnessStackP0 真实全编排（180f 覆盖落板→呼吸→缩退）⑤Lottie 占位资产 pulse。
 * 直读本集 theme 与组件（本集自有 dev 面，非 frozen，不进成片）。
 */
import React from 'react';
import {AbsoluteFill, Composition, registerRoot, useCurrentFrame} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {theme} from '../design/theme';
import {PlateSlab3D, HarnessStackP0, LAYERS, ACTIVE_INDEX} from '../components/harness-stack';
import {LottieEmphasis} from '../components/LottieEmphasis';
import {SLOT_GAP, SLOT_W} from '../components/motifs';
import {useProgress} from '../motion';

const CELLS: Array<{name: string; left: number; top: number; w: number; h: number}> = [
  {name: 'p3 arc', left: 60, top: 60, w: 800, h: 300},
  {name: 'p4 backflow', left: 900, top: 60, w: 560, h: 420},
  {name: 'slab3d active/dim', left: 1500, top: 60, w: 380, h: 260},
  {name: 'stack p0', left: 60, top: 400, w: 700, h: 640},
  {name: 'lottie plug-pulse', left: 900, top: 520, w: 560, h: 420},
];

const Cell: React.FC<{c: (typeof CELLS)[number]; children: React.ReactNode}> = ({c, children}) => (
  <div
    style={{
      position: 'absolute',
      left: c.left,
      top: c.top,
      width: c.w,
      height: c.h,
      background: theme.panel,
      border: `2px solid ${theme.panelBorder}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}
  >
    <div style={{position: 'absolute', left: 12, bottom: 6, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
      {c.name}
    </div>
    {children}
  </div>
);

/** ① P3 兜底弧复刻（源：scenes/P3Gates.tsx FourResults） */
const ArcP3: React.FC = () => {
  const frame = useCurrentFrame();
  const arc = useProgress(frame >= 10 ? 10 : -1e9, 24);
  return (
    <svg width={760} height={260} style={{position: 'absolute', left: 20, top: 10}}>
      <path
        d="M 400 210 C 520 210, 560 120, 470 96"
        stroke={theme.mech}
        strokeWidth={4}
        fill="none"
        {...evolvePath(arc, 'M 400 210 C 520 210, 560 120, 470 96')}
      />
      {arc > 0.9 ? <text x={545} y={165} fontFamily={theme.sans} fontSize={24} fill={theme.mech}>{'兜底'}</text> : null}
    </svg>
  );
};

/** ② P4 回流弧复刻（源：scenes/P4Hooks.tsx SlotsLightUp，W/H 缩小 0.7 倍入格） */
const ArcP4: React.FC = () => {
  const frame = useCurrentFrame();
  const back = useProgress(frame >= 10 ? 10 : -1e9, 22);
  const k = 0.7;
  const RING = 400 * k;
  const W = RING + 2 * (SLOT_W + SLOT_GAP);
  const H = RING + 260;
  const PATH = `M ${SLOT_W - 20} ${H - 90} C ${SLOT_W + 60} ${H - 60}, ${W / 2 - 130} ${H / 2}, ${W / 2 - 8} ${(H - RING) / 2 + 30}`;
  return (
    <svg width={W * k + SLOT_W} height={H * k + 40} style={{position: 'absolute', left: 10, top: 10}}>
      <g transform={`scale(${k})`}>
        <path d={PATH} stroke={theme.core} strokeWidth={4} fill="none" {...evolvePath(back, PATH)} />
        {back > 0.9 ? (
          <text x={SLOT_W + 90} y={H / 2 + 70} fontFamily={theme.sans} fontSize={24} fill={theme.core}>
            {'别停，接着干'}
          </text>
        ) : null}
      </g>
    </svg>
  );
};

/** ③ PlateSlab3D 对比：active 辉光板 vs 压暗板 */
const SlabCompare: React.FC = () => {
  const frame = useCurrentFrame();
  const settle = useProgress(frame >= 5 ? 5 : -1e9, 21);
  return (
    <div style={{position: 'absolute', inset: '40px 24px 40px 24px', display: 'flex', flexDirection: 'column', gap: 14}}>
      <PlateSlab3D layer={LAYERS[ACTIVE_INDEX - 1]} active dim={1} glow={0.7} width={330} height={64} settle={settle} />
      <PlateSlab3D layer={LAYERS[0]} active={false} dim={0.55} glow={0} width={330} height={64} settle={settle} />
    </div>
  );
};

/** ⑤ Lottie 占位资产 pulse（t=6 起跳，24f 播完） */
const LottieCell: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div
        style={{
          position: 'absolute',
          left: 232,
          top: 60,
          width: 96,
          height: 96,
          borderRadius: 8,
          border: `3px solid ${theme.mech}`,
        }}
      />
      {frame >= 6 ? (
        <LottieEmphasis
          src="lottie/plug-pulse.json"
          at={6}
          duration={24}
          style={{position: 'absolute', left: 232, top: 60, width: 96, height: 96}}
        />
      ) : null}
      <div style={{position: 'absolute', left: 200, top: 200, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {'咬合脉冲：勾画出 + 圈扩散消散（占位资产）'}
      </div>
    </div>
  );
};

const RetrofitGallery: React.FC = () => (
  <AbsoluteFill style={{background: theme.bg}}>
    <div style={{position: 'absolute', left: 60, top: 20, fontFamily: theme.mono, fontSize: 24, color: theme.text}}>
      {'RetrofitGallery · 30fps · 180f'}
    </div>
    {CELLS.map((c) => (
      <Cell key={c.name} c={c}>
        {c.name === 'p3 arc' ? <ArcP3 /> : null}
        {c.name === 'p4 backflow' ? <ArcP4 /> : null}
        {c.name === 'slab3d active/dim' ? <SlabCompare /> : null}
        {c.name === 'stack p0' ? (
          // 栈在 1920×1080 全幅坐标 (730,300) 处落板——整幅缩放入格保持真实编排
          <div style={{position: 'absolute', left: 0, top: 0, transform: 'scale(0.36)', transformOrigin: '0 0'}}>
            <div style={{position: 'relative', width: 1920, height: 1080}}>
              <HarnessStackP0 recedeAt={120} />
            </div>
          </div>
        ) : null}
        {c.name === 'lottie plug-pulse' ? <LottieCell /> : null}
      </Cell>
    ))}
  </AbsoluteFill>
);

registerRoot(() => (
  <Composition
    id="RetrofitGallery"
    component={RetrofitGallery}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={180}
    defaultProps={{}}
  />
));
