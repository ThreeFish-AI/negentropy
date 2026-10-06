/** 系列片头《一个循环》（seeded 档，五集同构复制——与 harness-stack.tsx 同模式）。
 *
 *  系列统一开场：压在扩展 leadIn 时段（timing.json leadInSec=11.4 → 342 帧），
 *  口播为独立音轨（public/audio/series-intro-zh.mp3，story 档 me-bright，
 *  实测 10.22s）——不入 narration.md 单一事实源、不动 beatWindow 锚定，
 *  「序号只存在于视觉层与 series.json」的系列 rule 精神不打折（口播五集
 *  完全相同、无层名/序号/集名，发布顺序变更零 TTS 代价）。
 *
 *  四拍（帧窗为 342 帧口播对位，字幕文案与口播逐字一致）：
 *   1 循环点亮 0-135   环描线生长 + 环心 0→102 滚动；字幕「一个循环，一百零二行……」
 *   2 时间线生长 135-270 主线自环缘向右生长，五站点错峰点亮（三态描边）；右下 102→1708 行
 *   3 本集定格 268-318  推近当前站 → 本集标题卡（series-layers.json 派生）+ 五颗进度点
 *   4 交棒 318-342      整体渐出至 bg（正片 P0 首镜黑场直入；EP1 0-B「无循环世界」
 *                       叙事不被片头环残留破坏——片头=预告片语义）
 *
 *  逐集差异三处（全部数据驱动零手写）：
 *   - 五站点巡礼停在 activeIndex 站（mech 点亮放大呼吸，已播暗实/待播虚描）
 *   - mech 色渗入（描边/光晕/编号/标题卡）
 *   - 标题卡 + 五颗集号进度点点亮到第 N 颗
 *
 *  双语：第一版 zh 固定文案（en 音轨+文案交付时补，登记于 to-video.toml drift）。
 */
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {theme} from '../design/theme';
import constants from '../timing.json';
import {LoopRing, Panel} from './motifs';
import {
  DUR,
  clamp01,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useFadeOut,
  useProgress,
  usePushIn,
  useStagger,
} from '../motion';
import series from '../series-layers.json';

type Layer = {index: number; layer: string; title: string; published: boolean};

const LAYERS = series.layers as Layer[];

/** 五集变体评审覆盖（IntroGallery 传入；缺省读本集 series-layers.json + theme.mech）。 */
export type IntroOverride = {activeIndex: number; mech: string};

/** 片头总长：timing.json leadInSec(11.4) × fps(30)。overridable 档直读，不动 frozen timing.ts。 */
export const INTRO_FRAMES = Math.round(constants.leadInSec * constants.fps);

// ── 时序表（帧 @30fps；口播 12 帧起播、实测 10.22s → 12-319）──────────────
/** 三句口播边界按字数比例（20/19/8 字）估算：12-144 / 144-270 / 270-319；
 *  草渲目检后如需微调只改本表。 */
const T = {
  audioAt: 12,
  ringDrawAt: 8,
  count102At: 28,
  sub1: {in: 20, out: 134},
  lineAt: 135,
  stationsAt: 150,
  count1708At: 158,
  sub2: {in: 146, out: 258},
  pushAt: 268,
  cardAt: 272,
  dotsAt: 278,
  sub3: {in: 270},
  fadeFrames: 14,
} as const;

// ── 布局（1920×1080，避让契约：顶部 y<56 归章节条；字幕安全带 y≤920）───────
/** 循环环：片头期大环居左 1/3（环心 420,540）；恒 core 橙描边〔M-001〕。 */
const RING = {size: 380, left: 230, top: 350} as const;
const RING_CX = RING.left + RING.size / 2;
const RING_R = RING.size / 2 - 46;

/** Timeline 主线：自环右缘向右，y=540；五站点等距。 */
const LINE = {x1: RING_CX + RING_R + 14, y: 540, x2: 1790} as const;
const STATION_XS = [760, 1000, 1240, 1480, 1720] as const;
const stationX = (i: number): number => STATION_XS[i];

/** 标题卡位置：随当前站平移并钳在画面内（600..1280，卡宽 600）。 */
const cardLeft = (activeIndex: number): number => Math.max(600, Math.min(stationX(activeIndex - 1) - 300, 1280));

// ── 口播字幕（与 TTS 文案逐字一致——数字冲击由计数器图形承载，不靠字幕）─────
const SUBS = [
  '一个循环，一百零二行代码，就能在你机器上动手。',
  '五层装置一层层挂上去，长到一千七百零八行。',
  '循环，还是那一个。',
] as const;

/** 三段口播字幕：底部衬线卡，逐段切换（第三段定格至全局渐出）。
 *  hooks 全在顶层；map 内只做纯组合（铁律：map 内禁 hooks）。 */
const IntroSubs: React.FC = () => {
  const in1 = useProgress(T.sub1.in, DUR.f5);
  const out1 = useProgress(T.sub1.out, DUR.f5);
  const in2 = useProgress(T.sub2.in, DUR.f5);
  const out2 = useProgress(T.sub2.out, DUR.f5);
  const in3 = useProgress(T.sub3.in, DUR.f5);
  const out3 = useProgress(INTRO_FRAMES - T.fadeFrames - DUR.f5, DUR.f5);
  const ops = [in1 * (1 - out1), in2 * (1 - out2), in3 * (1 - out3)];
  return (
    <AbsoluteFill>
      {SUBS.map((text, i) => (
        <div
          key={`sub${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 862,
            width: 1920,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 42,
            fontWeight: 600,
            color: theme.text,
            letterSpacing: 2,
            opacity: ops[i],
            textShadow: `0 2px 24px ${withAlpha(theme.bg, 0.8)}`,
          }}
        >
          {text}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 五站点（SVG g 组）：三态描边（已播 dim 实心 / 当前 mech 呼吸放大 / 待播 dim 虚描）。
 *  hooks 全在顶层；map 内只做纯样式计算。 */
const Stations: React.FC<{stationIn: number[]; activeNameOut: number; activeIndex: number; mech: string}> = ({
  stationIn,
  activeNameOut,
  activeIndex,
  mech,
}) => {
  const glow = useBreathe({period: 40, amp: 0.5, base: 0.55});
  return (
    <>
      {LAYERS.map((l) => {
        const active = l.index === activeIndex;
        const done = l.index < activeIndex;
        const enter = stationIn[l.index - 1];
        const r = active ? 14 : 9;
        return (
          <g
            key={l.index}
            opacity={enter}
            transform={`translate(${stationX(l.index - 1)}, ${LINE.y}) scale(${0.7 + 0.3 * enter})`}
          >
            {/* 当前站：mech 光晕 + 呼吸外圈 */}
            {active && (
              <>
                <circle r={26 + 8 * glow} fill={mech} opacity={0.1 + 0.1 * glow} />
                <circle r={20} fill="none" stroke={mech} strokeWidth={2} opacity={0.35 + 0.3 * glow} />
              </>
            )}
            <circle
              r={r}
              fill={active ? mech : done ? theme.dim : 'none'}
              stroke={active ? mech : theme.dim}
              strokeWidth={2.5}
              strokeDasharray={done || active ? undefined : '4 4'}
              opacity={done || active ? 1 : 0.55}
            />
            {/* 层名（当前站高亮；标题卡进场后淡出由卡接管，避免同屏重复） */}
            <text
              y={-36}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={active ? 30 : 25}
              fontWeight={active ? 600 : 400}
              fill={active ? theme.text : theme.dim}
              opacity={active ? 1 - activeNameOut : 1}
            >
              {l.layer}
            </text>
            <text
              y={38}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={18}
              fill={active ? mech : theme.dim}
              style={{fontVariantNumeric: 'tabular-nums'}}
            >
              {String(l.index).padStart(2, '0')}
            </text>
          </g>
        );
      })}
    </>
  );
};

/** 图形层主体：拍 1 环+102 / 拍 2 线+站点+1708 计数器 / 拍 3 推近+标题卡+进度点。 */
const IntroArt: React.FC<{override?: IntroOverride}> = ({override}) => {
  // 逐集差异变量（缺省读本集 series-layers.json + theme.mech；gallery 传 override）
  const activeIndex = override?.activeIndex ?? (series.activeIndex as number);
  const mech = override?.mech ?? theme.mech;
  const activeLayer = LAYERS[activeIndex - 1];
  const activeX = stationX(activeIndex - 1);
  const cardL = cardLeft(activeIndex);
  // 拍 1：环描线 + 起转 + 环心 102（75 帧/圈，与正片巡游同节律）
  const ringDraw = useProgress(T.ringDrawAt, 47, 'decelerate');
  const spin = useProgress(0, INTRO_FRAMES, 'linear');
  const laps = spin * (INTRO_FRAMES / 75);
  const count102 = useCount({from: 0, to: 102, at: T.count102At, dur: 80, ease: 'decelerate'});
  const n102In = useProgress(T.count102At - DUR.f3, DUR.f3);
  const n102Out = useProgress(T.lineAt - DUR.f4, DUR.f4);

  // 拍 2：主线生长 + 五站点错峰 + 1708 计数器
  // stride 10（v1 目检修正：22 时 frame 200 仅亮 3 站，赶不上口播「五层装置」）
  const lineGrow = useProgress(T.lineAt, 45, 'decelerate');
  const stationIn = useStagger(LAYERS.length, {at: T.stationsAt, stride: 10, dur: DUR.f4});
  const count1708 = useCount({from: 102, to: 1708, at: T.count1708At, dur: 70, ease: 'decelerate'});
  const countTools = useCount({from: 1, to: 32, at: T.count1708At, dur: 70, ease: 'decelerate'});
  const counterIn = useProgress(T.count1708At - DUR.f3, DUR.f4);

  // 拍 3：推近当前站（transformOrigin 数据驱动=当前站坐标）+ 标题卡 + 进度点
  const push = usePushIn(T.pushAt, {scale: 0.05, dur: DUR.f5});
  const title = (activeLayer?.title ?? '').split('：');
  const cardIn = useEnter('rise', {at: T.cardAt, dur: DUR.f5, dist: 40});
  const activeNameOut = useProgress(T.cardAt, DUR.f4);
  const linkDraw = useDraw(T.cardAt, 20);
  const dotsIn = useStagger(LAYERS.length, {at: T.dotsAt, stride: 4, dur: DUR.f3});

  return (
    <AbsoluteFill style={{transform: push, transformOrigin: `${(activeX / 1920) * 100}% 50%`}}>
      {/* 循环环（恒 core 橙〔M-001〕；交棒整体渐出，不残留到正片——EP1 0-B 无循环叙事） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} dotProgress={ringDraw + laps} showLabels={false} />
      </div>

      {/* 拍 1 环心计数：0→102（拍 2 起淡出，由线端计数器接管） */}
      <div
        style={{
          position: 'absolute',
          left: RING.left,
          top: RING.top + RING.size / 2 - 44,
          width: RING.size,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 64,
          fontWeight: 700,
          color: theme.core,
          fontVariantNumeric: 'tabular-nums',
          opacity: n102In * (1 - n102Out),
        }}
      >
        {Math.round(count102)}
      </div>

      {/* 拍 2：Timeline 主线（pathLength 归一化描线，同 Monument strike 技法）+ 五站点 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <line
          x1={LINE.x1}
          y1={LINE.y}
          x2={LINE.x2}
          y2={LINE.y}
          stroke={theme.core}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineGrow}
        />
        <Stations stationIn={stationIn} activeNameOut={activeNameOut} activeIndex={activeIndex} mech={mech} />
        {/* 拍 3：标题卡 → 当前站连线（mech） */}
        <g opacity={cardIn.opacity}>
          <line
            x1={cardL + 300}
            y1={414}
            x2={activeX}
            y2={LINE.y - 22}
            stroke={mech}
            strokeWidth={2.5}
            {...linkDraw}
          />
        </g>
      </svg>

      {/* 拍 2 计数器：右下（102→1708 行 / 1→32 工具） */}
      <div
        style={{
          position: 'absolute',
          right: 130,
          top: 614,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontVariantNumeric: 'tabular-nums',
          opacity: counterIn,
        }}
      >
        <div style={{fontSize: 44, fontWeight: 700, color: theme.text}}>{`${Math.round(count1708)} 行`}</div>
        <div style={{fontSize: 24, color: theme.dim, marginTop: 4}}>{`${Math.round(countTools)} 个工具`}</div>
      </div>

      {/* 拍 3：本集标题卡（series-layers.json 派生；主段+副段） */}
      <div style={{position: 'absolute', left: cardL, top: 286, ...cardIn}}>
        <Panel accent={mech} style={{width: 600, boxSizing: 'border-box', padding: '22px 34px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: theme.mono, fontSize: 26, color: mech}}>
              {String(activeIndex).padStart(2, '0')}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.text}}>
              {title[0] ?? ''}
            </span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 10}}>
            {title[1] ?? ''}
          </div>
        </Panel>
      </div>

      {/* 拍 3：五颗集号进度点（前 N 颗 core 实心；「序号只在视觉层」） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 742,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {LAYERS.map((l) => (
          <div
            key={l.index}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: l.index <= activeIndex ? theme.core : 'transparent',
              border: `2.5px solid ${l.index <= activeIndex ? theme.core : theme.panelBorder}`,
              opacity: dotsIn[l.index - 1],
              boxShadow:
                l.index === activeIndex ? `0 0 ${12 * dotsIn[l.index - 1]}px ${withAlpha(theme.core, 0.6)}` : undefined,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 系列片头：压 leadIn 时段的独立 Sequence 内容（Main.tsx 挂载，from=0）。 */
export const SeriesIntro: React.FC<{override?: IntroOverride}> = ({override}) => {
  // 交棒渐出：useFadeOut 按 Sequence 总长从尾部倒数（14 帧 ≈ DUR.f5+2，目检可调）
  const fade = useFadeOut(INTRO_FRAMES, {frames: T.fadeFrames});
  return (
    <AbsoluteFill style={{background: theme.bg, opacity: fade}}>
      <IntroArt override={override} />
      <IntroSubs />
      <Sequence from={T.audioAt} durationInFrames={INTRO_FRAMES - T.audioAt}>
        <Audio src={staticFile('audio/series-intro-zh.mp3')} />
      </Sequence>
    </AbsoluteFill>
  );
};
