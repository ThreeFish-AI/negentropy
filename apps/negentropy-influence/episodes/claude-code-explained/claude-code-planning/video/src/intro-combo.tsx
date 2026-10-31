import React from 'react';
import {
  AbsoluteFill,
  Composition,
  OffthreadVideo,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {fitText} from '@remotion/layout-utils';
import {theme} from './design/theme';
import {FPS} from './timing';
import seriesLayers from './series-layers.json';

/**
 * PreparedIntro —— 统一开场换题重制段（独立渲染入口，不进 Main 正片）。
 *
 * 把机器本地的 public/intro/intro-source.mp4（统一开场.mp4 拷贝）铺底播放，
 * 在原片标题出现窗口（~5.5s 起随镜头推近持续放大到结尾）盖一块「贴板」：
 * 半透明暗底 + backdrop blur + 白色角括线（复刻原装配设计语言），板内渲染
 * 本集标题两行，组级缩放复刻实测的原文字缩放曲线，终态大小适配原文字
 * 所容许的区域。渲染产物 out/intro-prepared.mp4 与 out/final.mp4 同参
 * （同 remotion.config.ts），由 scripts/assemble_intro.py（待建）拼接归档 v6。
 *
 * 实测口径（2026-10-05，.context/intro-frames 中性白掩膜 + 红框目检）：
 * - 原装配（板+括线+文字）终态 bbox 536×202 @720p，中心 (652,360)；
 * - 原文字宽度线性 w(t) = 57.88·t − 204.68（720p），w(10s)=374 → 起止缩放比 0.319。
 *
 * 用法（在 video/ 目录，.bin 直调防污染根 workspace）：
 *   ./node_modules/.bin/remotion render src/intro-combo.tsx PreparedIntro out/intro-prepared.mp4
 */

const WIDTH = 1920;
const HEIGHT = 1080;
/** 10.000s 整：源 241 帧 @24fps（10.04s）足够覆盖，字幕偏移取整 10.000s */
const DURATION_IN_FRAMES = 300;

/** 原文字入场时刻（~5.5s；g5.75 帧实测文字已在场，贴板须先于/同时出现） */
const T_START_FRAME = 165;
/** 贴板入场淡入帧数 */
const FADE_FRAMES = 6;

/** 原装配中心 (652,360)@720p ×1.5 → 1080p */
const CENTER = {x: 978, y: 540} as const;

/**
 * 贴板终态尺寸：覆盖原装配 804×303@1080p + 早期中心漂移边距（cx 实测 ±39px）。
 * 同组缩放下，只要 1.0 态盖住原装配 1.0 态，全程即被盖住（两条曲线同源）。
 */
const PLATE_W = 900;
const PLATE_H = 340;

/** 原文字宽度线性拟合（720p）：w(t) = W_SLOPE·t + W_INTERCEPT，终值 W_FINAL */
const W_SLOPE = 57.88;
const W_INTERCEPT = -204.68;
const W_FINAL = 374.1;

/** 贴板组缩放曲线：与原文字同一条实测直线归一到 t=10s 的 1.0 */
const scaleAt = (frame: number): number => {
  const t = frame / FPS;
  const s = (W_SLOPE * t + W_INTERCEPT) / W_FINAL;
  return Math.min(1, Math.max(0.2, s));
};

/** 本集两行标题自主数据源派生（口径同 series-intro.tsx 标题卡：全题按「：」切
 *  主段+副段）——改标题只改 series.json → series-layers.json，本文件零改动。 */
const ACTIVE_LAYER = seriesLayers.layers.find((l) => l.index === seriesLayers.activeIndex);
const TITLE_PARTS = (ACTIVE_LAYER?.title ?? '').split('：');
const LINE1 = TITLE_PARTS[0] ?? '';
const LINE2 = TITLE_PARTS.slice(1).join('：');

const TITLE_FONT = {
  fontFamily: theme.sans,
  fontWeight: 700,
} as const;

/** 文字区占贴板内宽的比例（口径对齐原装配：文字宽/装配宽 ≈ 358/536 ≈ 0.67） */
const TEXT_WIDTH_RATIO = 0.68;
/** L1/L2 字号比封顶：原装配实测 ≈1.41（86px/61px），放行到 1.6 防失衡 */
const MAX_SIZE_RATIO = 1.6;

/**
 * 双行标题字号求解——「大小正好适配」的数值实现：
 * L2（11 字，长行）以内宽 textWidth 定字号（宽度硬约束）；
 * L1（5 字）若按同宽解会远大于原装配比例，封顶 maxRatio × L2。
 */
const fitTitleSize = (params: {
  line1: string;
  line2: string;
  textWidth: number;
  maxRatio: number;
}): {size1: number; size2: number} => {
  // L2（长行）以内宽为宽度硬约束，用 fitText 真实测量求解（@remotion/layout-utils，
  // 口径同 Subtitle.tsx——系统字体栈，validateFontIsLoaded 保持 4.x 默认 false）；
  // L1（短行）同宽解会失衡，封顶 maxRatio × L2，不设下限——若 L1 比 L2 更长，
  // 同宽解自然更小，加下限反而破坏「两行同宽」的几何自洽。
  const {line1, line2, textWidth, maxRatio} = params;
  const size2 = fitText({text: line2, withinWidth: textWidth, ...TITLE_FONT}).fontSize;
  const size1 = Math.min(
    fitText({text: line1, withinWidth: textWidth, ...TITLE_FONT}).fontSize,
    maxRatio * size2,
  );
  return {size1, size2};
};

/** 白色角括线：复刻原装配四角 L 形取景框语言 */
const CornerBrackets: React.FC = () => {
  const arm = 54;
  const stroke = 3;
  const inset = 10;
  const base: React.CSSProperties = {
    position: 'absolute',
    width: arm,
    height: arm,
    borderColor: 'rgba(255,255,255,0.92)',
    borderStyle: 'solid',
  };
  return (
    <>
      <div style={{...base, left: inset, top: inset, borderWidth: 0, borderLeftWidth: stroke, borderTopWidth: stroke}} />
      <div style={{...base, right: inset, top: inset, borderWidth: 0, borderRightWidth: stroke, borderTopWidth: stroke}} />
      <div style={{...base, left: inset, bottom: inset, borderWidth: 0, borderLeftWidth: stroke, borderBottomWidth: stroke}} />
      <div style={{...base, right: inset, bottom: inset, borderWidth: 0, borderRightWidth: stroke, borderBottomWidth: stroke}} />
    </>
  );
};

const TitleReplate: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [T_START_FRAME, T_START_FRAME + FADE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = scaleAt(frame);
  const textWidth = PLATE_W * TEXT_WIDTH_RATIO;
  const {size1, size2} = fitTitleSize({line1: LINE1, line2: LINE2, textWidth, maxRatio: MAX_SIZE_RATIO});

  return (
    <div
      style={{
        position: 'absolute',
        left: CENTER.x,
        top: CENTER.y,
        // 屏幕空间锚定：中心固定、整组随实测曲线缩放（原装配即中心恒定的推近放大）
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        // 未入场时整体隐藏（backdropFilter 常驻会白白模糊底层视频）
        visibility: frame < T_START_FRAME ? 'hidden' : 'visible',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: PLATE_W,
          height: PLATE_H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: Math.round(size2 * 0.55),
          background: 'rgba(10, 17, 29, 0.55)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.28)',
          boxShadow: '0 0 44px rgba(0,0,0,0.38)',
        }}
      >
        <CornerBrackets />
        <div
          style={{
            ...TITLE_FONT,
            fontSize: size1,
            lineHeight: 1.12,
            color: '#ffffff',
            whiteSpace: 'nowrap',
            textShadow: '0 0 18px rgba(140, 210, 255, 0.35)',
          }}
        >
          {LINE1}
        </div>
        <div
          style={{
            ...TITLE_FONT,
            fontSize: size2,
            lineHeight: 1.25,
            color: 'rgba(255,255,255,0.96)',
            whiteSpace: 'nowrap',
            textShadow: '0 0 14px rgba(140, 210, 255, 0.3)',
          }}
        >
          {LINE2}
        </div>
      </div>
    </div>
  );
};

const PreparedIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      <OffthreadVideo
        src={staticFile('intro/intro-source.mp4')}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
      <TitleReplate />
    </AbsoluteFill>
  );
};

export const RemotionIntroComboRoot: React.FC = () => {
  return (
    <Composition
      id="PreparedIntro"
      component={PreparedIntro}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={DURATION_IN_FRAMES}
    />
  );
};

registerRoot(RemotionIntroComboRoot);
