/** 系列片头《一个循环》v2（seeded 档，五集同构复制——与 harness-stack.tsx 同模式）。
 *
 *  系列统一开场：压在扩展 leadIn 时段（timing.json leadInSec=23.5 → 705 帧），
 *  口播为独立音轨（public/audio/series-intro-zh.mp3；当前预览音轨需与下方 T 表同步），
 *  不入 narration.md 单一事实源、不动 beatWindow 锚定，
 *  「序号只存在于视觉层与 series.json」的系列 rule 精神不打折（口播五集
 *  完全相同、无序号词/集名——五机制目录点名＝预告片语义的内容词，非层序标识；
 *  发布顺序变更零 TTS 代价）。
 *
 *  六拍（帧窗为 705 帧口播对位，字幕文案与口播逐字一致、定性不念绝对数字）：
 *   1a 装裱 8-103      Harness 图纸装裱（视角的制图本义）：四角合拢→图框边线补全 + 右下标题栏
 *                      纹理（口播「这套视频从 Harness Engineering」）；中心线（点划线）钉在
 *                      环心＝先立参照；基准符号 A 踩「视角」词落位（词窗 78-88 实测；
 *                      主角入场随退——标签先撤、针位留至归位）。
 *                      Harness 表征：认知装置在幕 1，结构表征即幕 2 被点亮的体系本身
 *   1b 主角 103-131    Claude Code 星形（M-002）屏心弹入 + 扫光（口播「讲清 Claude Code」词起≈104）
 *   1c 化归 131-170    星形收缩坐枢 + 环描线 + while True 逐字（口播「简单循环」词起≈142）
 *   1d 预显 170-284    取景框扩幅消隐 + 幽灵蓝图主线/五幽灵站（口播「工程体系」词起≈216）
 *   2  展开与点名 284-467 实心主线 + 蓄能流光 + 五站词级点火（念到哪个机制名哪站点火，
 *                      回声扩张环同步把循环边界扩至恰好穿过该站点）
 *   3  本集定格 467-691 推近本集站（core→mech 授色）+ 标题卡 + 五颗进度点（句三 467-538 陪跑）
 *   4  交棒 691-705    整体渐出至 bg（正片 P0 首镜黑场直入；EP1 0-B「无循环世界」
 *                      叙事不被片头环残留破坏——片头=预告片语义）
 *
 *  逐集差异三处（全部数据驱动零手写）：
 *   - 五站点火后停在 activeIndex 站（T.mechGrantAt 起 core→mech 授色 + 呼吸放大）
 *   - mech 色渗入（授色站描边/光晕/编号/标题卡）
 *   - 标题卡 + 五颗集号进度点点亮到第 N 颗
 *
 *  音轨复现配方（audio/ 整目录 gitignored，新环境/换文案按此重放）：
 *    uv run --no-project ~/.claude/skills/vibe-video/scripts/tts_sample.py \
 *      --ref <工作区>/voices/me-bright.wav --style story --seed 4242 \
 *      --text '<NARRATION 全文>' --out-dir <repo>/.temp/voice-samples
 *    → 产物拷贝为 public/audio/series-intro-zh.mp3（IndexTTS 2.5 story 档，现 take 18.08s）。
 *
 *  双语：第一版 zh 固定文案（en 音轨+文案交付时补，登记于 vibe-video.toml drift）。
 */
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import constants from '../timing.json';
import {LoopRing, Panel} from './motifs';
import {
  DUR,
  clamp01,
  useBreathe,
  useDraw,
  useEnter,
  useFadeOut,
  useFlowDash,
  useImpulse,
  useProgress,
  usePushIn,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';
import {ACTIVE_INDEX, LAYERS} from './harness-stack';

/** 五集变体评审覆盖（IntroGallery 传入；缺省读本集 series-layers.json + theme.mech）。 */
export type IntroOverride = {activeIndex: number; mech: string};

/** 片头总长：timing.json leadInSec(23.5) × fps(30)。overridable 档直读，不动 frozen timing.ts。 */
export const INTRO_FRAMES = Math.round(constants.leadInSec * constants.fps);

// ── 时序表（帧 @30fps；口播 12 帧起播；IndexTTS 2.5 音频总长 18.08s/542 帧）───
/** 全部边界按 TTS 静音带实测对齐（句级 silencedetect -35dB/0.3s、词级 -30dB/0.10
 *  三阈值一致口径；起播偏移 +12 帧；点火识别点=词首+4 帧非对称吸收误差；
 *  五站词首全部由顿号间隙实测（含「多 Agent」——现 take 该处间隙可测，旧插值锚退役）。
 *  改文案重合成后须重测并只改本表，并人工核对 check_series ORDINAL_WORDS
 *  禁词表（顺序词门只扫 narration.md，不覆盖本组件字面量）。 */
const T = {
  audioAt: 12,
  // 幕 1 视角与主体（句一 22-234）
  bracketsAt: 8, // 取景框四臂合拢（stride 4/dur 7 → 8..27 全位；34..39 夹紧脉冲，≈40 settle，「视角」词前）
  borderAt: 40, // 图框边线补全（四边并发 14f——四角合拢后图纸装裱完成）
  titleAt: 58, // 标题栏格子纹理淡入（stride 3/dur 7；字段系列恒定不写集号——「序号只在视觉层」）
  centerHAt: 52, // 中心线·水平 clip 揭示（18f；点划线钉在环心——先立参照再画对象）
  centerVAt: 56, // 中心线·垂直 clip 揭示（18f）
  datumAt: 80, // 基准符号落位（「视角」词窗 78-88 实测、词尾带起 87.6；pop 弹入+引线+交点针位）
  centerOutAt: 168, // 中心线退役（环描线将成、对象已定义——辅助线擦除 12f）
  iconAt: 103, // 星形屏心弹入（flyIn+snap 12f；「Claude Code」词起≈104，扫光 119）
  iconDockAt: 131, // 星形收缩坐枢起（settleSoft 24f，时长标尺外显式帧数；「如何从一个简单循环」段）
  ringDrawAt: 133, // 环描线起（47 帧 ≈1.6s：时长标尺外显式帧数，「简单循环」词起≈142 陪跑）
  ringTextAt: 150, // while True 逐字（cps 14，10 字符 21 帧打完）
  frameOpenAt: 170, // 取景框扩 ×2.6 消隐起（28f accelerate——缩框不缩镜头；「逐步进化」词起 170）
  ghostLineAt: 212, // 幽灵主线揭示（14f；「工程体系」词起 ≈216）
  ghostStationsAt: 218, // 五幽灵站错峰（stride 4/dur 5 → 239 全位）
  // 幕 2 体系展开与点名（句二 248-455）
  lineAt: 284, // 实心主线生长（45 帧 ≈1.5s，时长标尺外显式帧数；「拆解」词起≈287）
  flowAt: 329, // 蓄能流光起（行进虚线通电待命）
  igniteAt: [332, 365, 399, 420, 438], // 五站词级点火（词首 328/361/395/416/434 + 4）
  // 幕 3 本集定格 + 幕 4 交棒（句三 467-538；定格hold至 691）
  pushAt: 467, // 推近当前站（句三起点）
  mechGrantAt: 467, // 本集站 core→mech 授色（12f crossfade——五站皆 core 系列之物，唯本站 mech 本集之物）
  cardAt: 472, // 标题卡起
  dotsAt: 478, // 五颗进度点错峰：478+4×4+5=499 全亮
  // 字幕六行（长句按语义切分；in=词首-4 先行、out=下段 in+6 交叉）
  sub1a: {in: 18, out: 96},
  sub1b: {in: 90, out: 172},
  sub1c: {in: 166, out: 250},
  sub2a: {in: 244, out: 330},
  sub2b: {in: 324, out: 469},
  sub3: {in: 463},
  fadeFrames: 14,
} as const;

// ── 布局（1920×1080，避让契约：顶部 y<56 归章节条；字幕安全带 y≤920）───────
/** 循环环：片头期大环居左 1/3（环心 420,540）；恒 core 橙描边〔M-001〕。 */
const RING = {size: 380, left: 230, top: 350} as const;
const RING_CX = RING.left + RING.size / 2;
const RING_R = RING.size / 2 - 46;

/** Harness 图框（装裱语义）：环 bbox 外扩 56/34（环心严格居中）；四角 L 臂 60px、dim 2.5px。 */
const FRAME = {x1: 174, y1: 316, x2: 666, y2: 764, arm: 60} as const;
const CORNERS = [
  {x: FRAME.x1, y: FRAME.y1, dx: -1, dy: -1},
  {x: FRAME.x2, y: FRAME.y1, dx: 1, dy: -1},
  {x: FRAME.x1, y: FRAME.y2, dx: -1, dy: 1},
  {x: FRAME.x2, y: FRAME.y2, dx: 1, dy: 1},
] as const;

/** 标题栏：图框右下角 2×2 格（纹理层口径——9px/低对比，按制图惯例而非可读信息；
 *  字段系列恒定不写集号——「序号只在视觉层」纪律）。 */
const TITLE_BLOCK = {x: 526, y: 724, w: 140, h: 40, mx: 596, my: 744} as const;
const TITLE_TEXTS = [
  {s: 'HARNESS ENG.', x: TITLE_BLOCK.x + 6, y: TITLE_BLOCK.my - 5},
  {s: 'SCALE 1:1', x: TITLE_BLOCK.mx + 6, y: TITLE_BLOCK.my - 5},
  {s: 'SHT 1 / 1', x: TITLE_BLOCK.x + 6, y: TITLE_BLOCK.y + TITLE_BLOCK.h - 6},
  {s: 'REV A', x: TITLE_BLOCK.mx + 6, y: TITLE_BLOCK.y + TITLE_BLOCK.h - 6},
] as const;

/** 基准符号（GD&T datum）：方框 A 弹入于交点右上，引线描至中心线交点旁——
 *  基准=一切测量与评价的出发参照，「视角」的制图本义；交点即星形坐枢位（基准预测、对象归位）。 */
const DATUM = {bx: 474, by: 402, size: 24, lx1: 474, ly1: 426, lx2: 428, ly2: 532} as const;

/** Timeline 主线：自环右缘向右，y=540；五站点等距。 */
const LINE = {x1: RING_CX + RING_R + 14, y: 540, x2: 1790} as const;
const STATION_XS = [760, 1000, 1240, 1480, 1720] as const;
const stationX = (i: number): number => STATION_XS[i];

/** 回声扩张环半径档：环心到各站距离（圆周恰好穿过站点中心）——循环边界递进够到被点名机制。 */
const ECHO_R = STATION_XS.map((x) => x - RING_CX);

/** 标题卡位置：随当前站平移并钳在画面内（600..1280，卡宽 600）。 */
const cardLeft = (activeIndex: number): number => Math.max(600, Math.min(stationX(activeIndex - 1) - 300, 1280));

/** 星形舞台：主角态 200px 屏心 (960,540) → 枢纽态 76px 环心 (420,540)。 */
const STAR_STAGE = 200;
const STAR_DOCK_SIZE = 76;

// ── 口播台本（TTS 合同）─────────────────────────────────────────────────────
/** 带标点三句全文 = 字幕 SUBS 六行的母本（显示层切分点去标点，join 后≠本串，
 *  重配音一律按本串逐字合成——B-0 台本合同，改文案先改这里）。 */
const NARRATION =
  '这套视频从 Harness Engineering 的视角，讲清 Claude Code 如何从一个简单循环，' +
  '逐步进化为一套完整的工程体系。接下来，我们将依次拆解五种核心机制：' +
  '工具与执行、规划与协调、记忆管理、并发，以及多 Agent。机制层层递进，工程体系持续进化。';

// ── 口播字幕（切分点无标点——语义切换本身承载停顿；句内标点保留）──────────
//    文案定性不念绝对数字（系列数字纪律：口播不引绝对行数/活数据——见 ep1
//    source-notes ②），六段显示窗口与片头音轨逐字一致。
const SUBS = [
  '这套视频从 Harness Engineering 的视角',
  '讲清 Claude Code 如何从一个简单循环',
  '逐步进化为一套完整的工程体系',
  '接下来，我们将依次拆解五种核心机制',
  '工具与执行、规划与协调、记忆管理、并发，以及多 Agent',
  '机制层层递进，工程体系持续进化',
] as const;

/** zh 显示层剥句尾句号（系列字幕风格；en 文案无句号问题，届时不剥） */
const stripZhPeriod = (s: string): string => s.replace(/。+$/, '');

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 双 hex 线性插值（core→mech 授色 crossfade；t 走 useProgress——effects 不吃弹簧）。 */
const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (x: number): string => Math.round(x).toString(16).padStart(2, '0');
  const mix = (sh: number): number => ((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t;
  return `#${ch(mix(16))}${ch(mix(8))}${ch(mix(0))}`;
};

// ── Claude Code 星形徽记（M-002，系列恒定）──────────────────────────────────
/** 12 芽均一几何自绘（不临摹官方路径——品牌安全口径）；fill 恒 theme.core
 *  （系列之物，禁 mech 化）；常量系列恒定，调用点不得覆写（同 LoopRing 口径）。 */
const STAR = {petals: 12, rInner: 0.15, base: 0.045, core: 0.2} as const;

const starPath = (r: number): string => {
  const parts: string[] = [];
  for (let k = 0; k < STAR.petals; k += 1) {
    const a = (k * 2 * Math.PI) / STAR.petals;
    const rot = (dx: number, dy: number): [number, number] => [
      dx * Math.cos(a) - dy * Math.sin(a),
      dx * Math.sin(a) + dy * Math.cos(a),
    ];
    const [bx1, by1] = rot(STAR.rInner * r, -STAR.base * r);
    const [tx, ty] = rot(r, 0);
    const [bx2, by2] = rot(STAR.rInner * r, STAR.base * r);
    parts.push(`M${bx1.toFixed(2)},${by1.toFixed(2)}L${tx.toFixed(2)},${ty.toFixed(2)}L${bx2.toFixed(2)},${by2.toFixed(2)}Z`);
  }
  return parts.join('');
};

/** 星形 SVG：常驻微光晕（呼吸）+ 落定扫光带（clipPath 限星形内，白带横掠）。 */
const StarGlyph: React.FC<{size: number; glow: number; sweep: number}> = ({size, glow, sweep}) => (
  <svg width={size} height={size} viewBox="-110 -110 220 220">
    <defs>
      <clipPath id="intro-star-clip">
        <circle r={STAR.core * 100} />
        <path d={starPath(100)} />
      </clipPath>
    </defs>
    <circle r={98} fill={theme.core} opacity={0.06 + 0.06 * glow} />
    <circle r={STAR.core * 100} fill={theme.core} />
    <path d={starPath(100)} fill={theme.core} />
    <g clipPath="url(#intro-star-clip)">
      <rect
        x={-180 + 360 * sweep}
        y={-140}
        width={64}
        height={280}
        fill={theme.text}
        opacity={0.35 * Math.sin(Math.PI * clamp01(sweep))}
        transform="rotate(20)"
      />
    </g>
  </svg>
);

/** 六段口播字幕：长句按语义切成单行片段，片段之间交叉切换。
 *  hooks 全在顶层；map 内只做纯组合（铁律：map 内禁 hooks）。 */
const IntroSubs: React.FC = () => {
  const in1a = useProgress(T.sub1a.in, DUR.f5);
  const out1a = useProgress(T.sub1a.out, DUR.f5);
  const in1b = useProgress(T.sub1b.in, DUR.f5);
  const out1b = useProgress(T.sub1b.out, DUR.f5);
  const in1c = useProgress(T.sub1c.in, DUR.f5);
  const out1c = useProgress(T.sub1c.out, DUR.f5);
  const in2a = useProgress(T.sub2a.in, DUR.f5);
  const out2a = useProgress(T.sub2a.out, DUR.f5);
  const in2b = useProgress(T.sub2b.in, DUR.f5);
  const out2b = useProgress(T.sub2b.out, DUR.f5);
  const in3 = useProgress(T.sub3.in, DUR.f5);
  const out3 = useProgress(INTRO_FRAMES - T.fadeFrames - DUR.f5, DUR.f5);
  const ops = [
    in1a * (1 - out1a),
    in1b * (1 - out1b),
    in1c * (1 - out1c),
    in2a * (1 - out2a),
    in2b * (1 - out2b),
    in3 * (1 - out3),
  ];
  return (
    <AbsoluteFill>
      {SUBS.map((text, i) => (
        <div
          key={`sub${i}`}
          style={{
            position: 'absolute',
            left: 90,
            top: 806,
            width: 1740,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 42,
            fontWeight: 600,
            lineHeight: 1.35,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: ops[i],
            textShadow: `0 2px 24px ${withAlpha(theme.bg, 0.8)}`,
          }}
        >
          {stripZhPeriod(text)}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 五站点（SVG g 组）：时间驱动三态——虚描幽灵（dim，幕 1d 落位）→ 点火
 *  （core 实心 + 编号染色 + 名字上浮 + 一次性光晕脉冲，幕 2c 词级对位）→
 *  授色（本集站 core→mech crossfade + 呼吸圈，幕 3）。
 *  hooks 全在顶层；map 内只做纯样式计算（点火脉冲为纯函数帧算）。 */
const Stations: React.FC<{
  ghostIn: number[];
  litIn: number[];
  litPulse: number[];
  grantP: number;
  activeNameOut: number;
  activeIndex: number;
  mech: string;
}> = ({ghostIn, litIn, litPulse, grantP, activeNameOut, activeIndex, mech}) => {
  const glow = useBreathe({period: 40, amp: 0.5, base: 0.55});
  return (
    <>
      {LAYERS.map((l) => {
        const i = l.index - 1;
        const active = l.index === activeIndex;
        const enter = ghostIn[i];
        const lit = litIn[i];
        const pulse = litPulse[i];
        // 本集站授色 crossfade；其余站恒 core（系列之物）
        const stroke = active ? mixHex(theme.core, mech, grantP) : theme.core;
        // 「当前站」样式（放大/白字/加粗）一律挂 grantP——幕 2 点名期五站统一，授色后才分化
        const r = active ? 9 + 5 * grantP : 9;
        const labelFill = active ? mixHex(theme.dim, theme.text, grantP) : theme.dim;
        return (
          <g
            key={l.index}
            opacity={enter}
            transform={`translate(${stationX(i)}, ${LINE.y}) scale(${0.7 + 0.3 * enter})`}
          >
            {/* 点火一次性光晕：r26→36 扩散圈，sin 包络起 0 归 0 */}
            {lit > 0 && (
              <circle r={26 + 10 * pulse} fill="none" stroke={stroke} strokeWidth={2} opacity={0.5 * pulse} />
            )}
            {/* 授色站呼吸圈（幕 3） */}
            {active && grantP > 0 && (
              <>
                <circle r={26 + 8 * glow} fill={stroke} opacity={(0.1 + 0.1 * glow) * grantP} />
                <circle r={20} fill="none" stroke={stroke} strokeWidth={2} opacity={(0.35 + 0.3 * glow) * grantP} />
              </>
            )}
            {/* 本体双圈层叠：虚描幽灵随点火消隐，实心点亮随点火显现 */}
            <circle
              r={r}
              fill="none"
              stroke={theme.dim}
              strokeWidth={2.5}
              strokeDasharray="4 4"
              opacity={(1 - lit) * 0.55}
            />
            <circle r={r} fill={stroke} stroke={stroke} strokeWidth={2.5} opacity={lit} />
            {/* 层名：点火时上浮显现（授色后当前站高亮；标题卡进场后淡出由卡接管） */}
            <text
              y={-36 + (1 - lit) * 8}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={25 + 5 * (active ? grantP : 0)}
              fontWeight={active && grantP > 0.5 ? 600 : 400}
              fill={labelFill}
              opacity={lit * (active ? 1 - activeNameOut : 1)}
            >
              {l.layer}
            </text>
            <text
              y={38}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={18}
              fill={active ? stroke : theme.core}
              opacity={lit}
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

/** 图形层主体：幕 1 取景框+扫描+星形+环 / 幕 2 主线+流光+词级点火 / 幕 3 推近+标题卡。 */
const IntroArt: React.FC<{override?: IntroOverride}> = ({override}) => {
  const frame = useCurrentFrame();
  // 逐集差异变量（缺省读本集 series-layers.json + theme.mech；gallery 传 override）
  const activeIndex = override?.activeIndex ?? ACTIVE_INDEX;
  const mech = override?.mech ?? theme.mech;
  const activeLayer = LAYERS[activeIndex - 1];
  const activeX = stationX(activeIndex - 1);
  const cardL = cardLeft(activeIndex);

  // 幕 1a：取景框四臂合拢 + 夹紧脉冲（「视角」词同步入场）
  const bracketIn = useStagger(4, {at: T.bracketsAt, stride: 4, dur: DUR.f4});
  const clampPulse = useImpulse({at: T.bracketsAt + 26, dur: 5, peak: 6});
  // 幕 1a 制图装裱：图框边线补全 + 中心线首笔（点划线钉在环心——先立参照）+ 标题栏纹理
  const borderP = useProgress(T.borderAt, 14, 'decelerate');
  const centerHP = useProgress(T.centerHAt, 18, 'linear');
  const centerVP = useProgress(T.centerVAt, 18, 'linear');
  const centerFade = useProgress(T.centerOutAt, DUR.f5);
  const titleCells = useStagger(4, {at: T.titleAt, stride: 3, dur: DUR.f4});
  // 幕 1a 基准落位：方框 A 踩「视角」词弹入 + 引线描至交点旁 + 交点针位十字脉冲；
  // 标注（框+引线）随主角入场同拍退役——参照文档先撤、针位留至星形归位
  const datumIn = useEnter('pop', {at: T.datumAt, dur: DUR.f4});
  const datumOut = useProgress(T.iconAt, DUR.f5);
  const leaderP = useProgress(T.datumAt + 2, 8, 'linear');
  const pinPulse = useImpulse({at: T.datumAt + 7, dur: 5, peak: 1});
  // 幕 1b：星形屏心弹入（flyIn+snap：3.8% 可见过冲=落定脆感）+ 落定后扫光 + 常驻光晕
  const starEnter = useEnter('flyIn', {at: T.iconAt, dur: DUR.f5, springPreset: 'snap'});
  const starSweep = useProgress(T.iconAt + 16, DUR.f5, 'linear');
  const starGlow = useBreathe({period: 40, amp: 0.5, base: 0.55});
  // 幕 1c：星形收缩坐枢（settleSoft 24f：跨 540px 大位移需比 DUR.f6 略长以免显赶）
  const starDock = useSpring('settleSoft', {at: T.iconDockAt, dur: 24});
  const dockX = 960 + (RING_CX - 960) * starDock;
  const dockS = 1 + (STAR_DOCK_SIZE / STAR_STAGE - 1) * starDock;
  // 幕 1c：环描线 + 起转 + 环下沿 while True（75 帧/圈，与正片巡游同节律）
  const ringDraw = useProgress(T.ringDrawAt, 47, 'decelerate');
  // 巡游光点：自制带 draw 门控版（LoopRing 的点无 draw 门控——环未画时会悬浮绕行；
  // 不动 motifs.tsx，此处按同几何同节律复刻，opacity=draw 效果通道走时长+缓动）
  const lapClock = useProgress(T.ringDrawAt, INTRO_FRAMES - T.ringDrawAt, 'linear');
  const dotLaps = lapClock * ((INTRO_FRAMES - T.ringDrawAt) / 75);
  const dotA = ((-90 + (ringDraw + dotLaps) * 360) * Math.PI) / 180;
  const dotX = RING_CX + RING_R * Math.cos(dotA);
  const dotY = RING.top + RING.size / 2 + RING_R * Math.sin(dotA);
  const ringText = useReveal('while True', {at: T.ringTextAt, cps: 14});
  const ringTextIn = useProgress(T.ringTextAt - DUR.f3, DUR.f3);
  const ringTextOut = useProgress(T.lineAt - DUR.f4, DUR.f4);
  // 幕 1d：取景框扩幅消隐 + 幽灵蓝图（虚线主线揭示 + 五幽灵站错峰）
  const frameOpen = useProgress(T.frameOpenAt, 28, 'accelerate');
  const ghostLine = useProgress(T.ghostLineAt, 14, 'linear');
  const ghostVis = useProgress(T.ghostLineAt, DUR.f3);
  const ghostIn = useStagger(LAYERS.length, {at: T.ghostStationsAt, stride: 4, dur: DUR.f3});
  // 幕 2a：实心主线生长（幽灵线随长随隐）
  const lineGrow = useProgress(T.lineAt, 45, 'decelerate');
  // 幕 2b：蓄能流光（行进虚线通电待命，推近前随幕收）
  const flow = useFlowDash({dash: 10, gap: 14, period: 40});
  const flowVis = useProgress(T.flowAt, DUR.f5) * (1 - useProgress(T.pushAt, DUR.f5));
  // 幕 2c：五站词级点火（顶层 5 锚 hooks；脉冲=纯函数帧算，识别点=词首+4）
  const igniteIn = [
    useProgress(T.igniteAt[0], DUR.f4),
    useProgress(T.igniteAt[1], DUR.f4),
    useProgress(T.igniteAt[2], DUR.f4),
    useProgress(T.igniteAt[3], DUR.f4),
    useProgress(T.igniteAt[4], DUR.f4),
  ];
  const litPulse = T.igniteAt.map((at) => Math.sin(Math.PI * clamp01((frame - at) / 9)));
  const litCount = Math.round(igniteIn.reduce((a, v) => a + v, 0));
  const counterIn = useProgress(T.igniteAt[0] - DUR.f3, DUR.f4);
  // 幕 2c 回声扩张环：点火 k 时半径 soft 生长至恰好穿过站点 k（240px 级大位移，
  // 18 帧时长标尺外显式；顺序 lerp 折叠=单调递进，推近前随流光收）
  const growIn = [
    useProgress(T.igniteAt[0], 18, 'decelerate'),
    useProgress(T.igniteAt[1], 18, 'decelerate'),
    useProgress(T.igniteAt[2], 18, 'decelerate'),
    useProgress(T.igniteAt[3], 18, 'decelerate'),
    useProgress(T.igniteAt[4], 18, 'decelerate'),
  ];
  let echoR = RING_R;
  ECHO_R.forEach((r, k) => {
    echoR += (r - echoR) * growIn[k];
  });
  const echoVis = useProgress(T.igniteAt[0], DUR.f4) * (1 - useProgress(T.pushAt, DUR.f5));

  // 幕 3：推近当前站 + 本集站授色 + 标题卡 + 进度点
  const push = usePushIn(T.pushAt, {scale: 0.05, dur: DUR.f5});
  const grantP = useProgress(T.mechGrantAt, DUR.f5);
  const title = (activeLayer?.title ?? '').split('：');
  const cardIn = useEnter('rise', {at: T.cardAt, dur: DUR.f5, dist: 40});
  const activeNameOut = useProgress(T.cardAt, DUR.f4);
  // 连线描线 20 帧（显式帧数：略短于 DUR.f6=21，与标题卡 rise 同拍收束不拖尾）
  const linkDraw = useDraw(T.cardAt, 20);
  // 五颗点 stride 4 快闪错峰：478+4×4+5=499 全亮（幕 3 中段完成）
  const dotsIn = useStagger(LAYERS.length, {at: T.dotsAt, stride: 4, dur: DUR.f3});

  return (
    <AbsoluteFill style={{transform: push, transformOrigin: `${(activeX / 1920) * 100}% 50%`}}>
      {/* 循环环（恒 core 橙〔M-001〕；交棒整体渐出，不残留到正片——EP1 0-B 无循环叙事。
          showExit=false：右缘停机出口 stub 与 Timeline 主线起点几何相交（P1/P2/P4/P5 同款惯例） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} showLabels={false} showExit={false} />
      </div>

      {/* 幕 1c 环下沿 while True 逐字打出（系列恒定 token；实心主线起拍淡出） */}
      <div
        style={{
          position: 'absolute',
          left: RING.left,
          top: RING.top + RING.size / 2 + 36,
          width: RING.size,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 34,
          fontWeight: 700,
          color: theme.core,
          whiteSpace: 'pre',
          opacity: ringTextIn * (1 - ringTextOut),
        }}
      >
        {ringText || ' '}
      </div>

      {/* 幕 1b/1c Claude Code 星形（M-002，恒 core）：屏心弹入 → 收缩坐枢环心。
          常驻至交棒（随整体渐出零残留）；幕 3 随推近组缩放 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: STAR_STAGE,
          height: STAR_STAGE,
          transform: `translate(${dockX - STAR_STAGE / 2}px, ${RING.top + RING.size / 2 - STAR_STAGE / 2}px) scale(${dockS}) ${starEnter.transform}`,
          transformOrigin: '100px 100px',
          opacity: starEnter.opacity,
        }}
      >
        <StarGlyph size={STAR_STAGE} glow={starGlow} sweep={starSweep} />
      </div>

      {/* 图形 SVG：图纸装裱+中心线+基准（幕 1a）/ 幽灵蓝图（幕 1d）/ 主线+流光+站点（幕 2/3） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 幕 1a Harness 图纸装裱：四角合拢+夹紧脉冲 → 图框边线补全 + 标题栏纹理 + 基准落位；
            幕 1d 扩 ×2.6 消隐（自环心 origin——缩框不缩镜头，3D 宪法二的 2D 同构） */}
        <g
          opacity={1 - frameOpen}
          transform={`translate(${RING_CX}, ${RING.top + RING.size / 2}) scale(${1 + 1.6 * frameOpen}) translate(${-RING_CX}, ${-(RING.top + RING.size / 2)})`}
        >
          {CORNERS.map((c, i) => (
            <g
              key={`corner${i}`}
              opacity={bracketIn[i]}
              transform={`translate(${c.dx * 90 * (1 - bracketIn[i]) - c.dx * clampPulse}, ${c.dy * 90 * (1 - bracketIn[i]) - c.dy * clampPulse})`}
            >
              <line x1={c.x} y1={c.y} x2={c.x - c.dx * FRAME.arm} y2={c.y} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
              <line x1={c.x} y1={c.y} x2={c.x} y2={c.y - c.dy * FRAME.arm} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
            </g>
          ))}
          {/* 图框边线补全：四边并发顺时针描线（pathLength 归一化——实线无像素 dasharray 冲突） */}
          {(
            [
              {x1: FRAME.x1, y1: FRAME.y1, x2: FRAME.x2, y2: FRAME.y1},
              {x1: FRAME.x2, y1: FRAME.y1, x2: FRAME.x2, y2: FRAME.y2},
              {x1: FRAME.x2, y1: FRAME.y2, x2: FRAME.x1, y2: FRAME.y2},
              {x1: FRAME.x1, y1: FRAME.y2, x2: FRAME.x1, y2: FRAME.y1},
            ] as const
          ).map((e, i) => (
            <line
              key={`edge${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={theme.dim}
              strokeWidth={1}
              opacity={0.7}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - borderP}
            />
          ))}
          {/* 标题栏：2×2 格 + 系列恒定字段（9px 低对比——制图惯例的质感层，非可读信息） */}
          <rect
            x={TITLE_BLOCK.x}
            y={TITLE_BLOCK.y}
            width={TITLE_BLOCK.w}
            height={TITLE_BLOCK.h}
            fill="none"
            stroke={theme.dim}
            strokeWidth={1}
            opacity={0.8}
          />
          <line x1={TITLE_BLOCK.mx} y1={TITLE_BLOCK.y} x2={TITLE_BLOCK.mx} y2={TITLE_BLOCK.y + TITLE_BLOCK.h} stroke={theme.dim} strokeWidth={1} opacity={0.8} />
          <line x1={TITLE_BLOCK.x} y1={TITLE_BLOCK.my} x2={TITLE_BLOCK.x + TITLE_BLOCK.w} y2={TITLE_BLOCK.my} stroke={theme.dim} strokeWidth={1} opacity={0.8} />
          {TITLE_TEXTS.map((t, i) => (
            <text key={t.s} x={t.x} y={t.y} fontFamily={theme.mono} fontSize={9} fill={theme.dim} opacity={titleCells[i] * 0.8}>
              {t.s}
            </text>
          ))}
          {/* 基准符号：方框 A 踩「视角」词弹入（绕框心缩放）+ 引线描至交点旁——
              GD&T datum＝一切测量的出发参照，「视角」的制图本义；
              主角入场（iconAt）同拍淡出：标签退役、针位十字留场至归位 */}
          <g
            opacity={datumIn.opacity * (1 - datumOut)}
            transform={`translate(${DATUM.bx + DATUM.size / 2}, ${DATUM.by + DATUM.size / 2}) ${datumIn.transform} translate(${-(DATUM.bx + DATUM.size / 2)}, ${-(DATUM.by + DATUM.size / 2)})`}
          >
            <rect x={DATUM.bx} y={DATUM.by} width={DATUM.size} height={DATUM.size} fill="none" stroke={theme.core} strokeWidth={2} />
            <text
              x={DATUM.bx + DATUM.size / 2}
              y={DATUM.by + DATUM.size / 2 + 5}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={14}
              fontWeight={700}
              fill={theme.core}
            >
              A
            </text>
            <line
              x1={DATUM.lx1}
              y1={DATUM.ly1}
              x2={DATUM.lx2}
              y2={DATUM.ly2}
              stroke={theme.dim}
              strokeWidth={1.2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - leaderP}
            />
          </g>
        </g>
        {/* 中心线（点划线）：水平/垂直 clip 揭示，交叉于环心＝星形坐枢位（基准预测、对象归位）；
            环描线将成时辅助线擦除（中心线与像素 dasharray 正交——用 clip 揭示，红线三） */}
        <defs>
          <clipPath id="intro-center-h">
            <rect x={FRAME.x1} y={RING.top + RING.size / 2 - 2} width={(FRAME.x2 - FRAME.x1) * centerHP} height={4} />
          </clipPath>
          <clipPath id="intro-center-v">
            <rect x={RING_CX - 2} y={FRAME.y1} width={4} height={(FRAME.y2 - FRAME.y1) * centerVP} />
          </clipPath>
        </defs>
        <g opacity={(1 - centerFade) * 0.75}>
          <line
            x1={FRAME.x1}
            y1={RING.top + RING.size / 2}
            x2={FRAME.x2}
            y2={RING.top + RING.size / 2}
            stroke={theme.dim}
            strokeWidth={1.2}
            strokeDasharray="16 5 3 5"
            clipPath="url(#intro-center-h)"
          />
          <line x1={RING_CX} y1={FRAME.y1} x2={RING_CX} y2={FRAME.y2} stroke={theme.dim} strokeWidth={1.2} strokeDasharray="16 5 3 5" clipPath="url(#intro-center-v)" />
        </g>
        {/* 基准针位十字：引线到位后驻留于交点（星形入位后被其覆盖——「对象归位于基准」） */}
        <g opacity={leaderP * (1 - frameOpen)}>
          <line
            x1={RING_CX - 5 - 4 * pinPulse}
            y1={RING.top + RING.size / 2}
            x2={RING_CX + 5 + 4 * pinPulse}
            y2={RING.top + RING.size / 2}
            stroke={theme.core}
            strokeWidth={1.5}
          />
          <line
            x1={RING_CX}
            y1={RING.top + RING.size / 2 - 5 - 4 * pinPulse}
            x2={RING_CX}
            y2={RING.top + RING.size / 2 + 5 + 4 * pinPulse}
            stroke={theme.core}
            strokeWidth={1.5}
          />
        </g>

        {/* 环巡游光点（自制门控版）：随环描线起亮，沿环 75 帧/圈巡游至交棒 */}
        <circle cx={dotX} cy={dotY} r={11} fill={theme.core} opacity={ringDraw} />

        {/* 幕 2c 回声扩张环：薄 core 弧自环心扩张，圆周恰好穿过被点名站点——
            「机制层层递进」的空间化（循环边界=体系势力范围）；主环恒定不动〔M-001 不变量〕 */}
        <circle
          cx={RING_CX}
          cy={RING.top + RING.size / 2}
          r={echoR}
          fill="none"
          stroke={theme.core}
          strokeWidth={2.5}
          opacity={0.55 * echoVis}
        />

        {/* 幕 1d 幽灵主线：dim 虚线，clip 矩形自左揭示；实线生长时整体消隐 */}
        <defs>
          <clipPath id="intro-ghost-reveal">
            <rect x={LINE.x1} y={LINE.y - 24} width={(LINE.x2 - LINE.x1) * ghostLine} height={48} />
          </clipPath>
        </defs>
        <g clipPath="url(#intro-ghost-reveal)" opacity={ghostVis * (1 - lineGrow)}>
          <line x1={LINE.x1} y1={LINE.y} x2={LINE.x2} y2={LINE.y} stroke={theme.dim} strokeWidth={2} strokeDasharray="6 6" />
        </g>
        {/* 幕 1d 五幽灵站虚描圈由 Stations 双圈层独立承担（同几何同时序，此处不再叠绘第二层——
            双层合成不透明度会到 ~0.80，超出声明的 dim 0.55 幽灵态） */}

        {/* 幕 2a 实心主线（pathLength 归一化描线，同 Monument strike 技法） */}
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
        {/* 幕 2b 蓄能流光：行进虚线通电待命（像素 dasharray——与上面 pathLength 归一化描线
            是两个正交特性，分元素渲染——红线三） */}
        <line x1={LINE.x1} y1={LINE.y} x2={LINE.x2} y2={LINE.y} stroke={theme.dim} strokeWidth={2} opacity={flowVis} {...flow} />

        <Stations
          ghostIn={ghostIn}
          litIn={igniteIn}
          litPulse={litPulse}
          grantP={grantP}
          activeNameOut={activeNameOut}
          activeIndex={activeIndex}
          mech={mech}
        />
        {/* 幕 3：标题卡 → 当前站连线（mech） */}
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

      {/* 幕 2c 机制计数：右下随点火 1→5 步进（+DUR.f4 微滚；结构数字非活数据） */}
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
        <div style={{fontSize: 44, fontWeight: 700, color: theme.text}}>{`${litCount} 种机制`}</div>
        <div style={{fontSize: 24, color: theme.dim, marginTop: 4}}>{'1 个循环 · 不变'}</div>
      </div>

      {/* 幕 3：本集标题卡（series-layers.json 派生；主段+副段） */}
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

      {/* 幕 3：五颗集号进度点（前 N 颗 core 实心；「序号只在视觉层」） */}
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
