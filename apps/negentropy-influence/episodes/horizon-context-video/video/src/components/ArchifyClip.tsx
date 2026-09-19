/** archify 工程图**逐章回放窗**（v3 母题）。
 *
 *  素材链：`pipeline/scripts/record_archify.py --mode chapter --all-chapters`
 *  逐章录制 webm（每章一段）→ `scripts/archify_lead.py` 用场记板白闪测定真实
 *  `leadSec` → `scripts/archify_manifest.py` 生成 `archify.manifest.ts`。
 *
 *  **为什么逐章而不是整段切片**：整段切片要求 `trimBefore` 达 15s 量级，而
 *  `trimBefore × playbackRate` 的换算次序一旦理解偏差就被整段长度放大；逐章录制
 *  把片内 lead 压到 ~2s 量级、且每段只播一章，同样的偏差只造成 ≤2 帧误差。
 *  ——难的对齐问题被消去，而不是被更精确地解决。
 */
import React from 'react';
import {Img, OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {DUR, useProgress, useSpring} from '../motion';

/** 源片长与目标句窗不等长时的适配方式 */
export type ArchifyFit =
  | 'stretch' // 变速铺满：playbackRate = 源秒 / 窗秒（限 [0.7, 1.35]）
  | 'hold' //    原速播完 + 末帧冻结补足（源比窗短时用）
  | 'trim'; //   原速播，超出部分由父 Sequence 裁掉（源比窗长时用）

/** 画中画档位：full = 整屏主控；inset = 小窗（主画面仍是自制模型） */
export type ArchifyVariant = 'full' | 'inset';

const RATE_MIN = 0.7;
const RATE_MAX = 1.35;

/** 画框几何：按**高**定尺，保证底边 ≤ 900 < SAFE_TOP_Y(920)，不压字幕带。
 *  旧版用 width:'88%' + aspectRatio 16/9 ⇒ 高 950、底边 1015，越界 95px。 */
const BOX = {
  /** 整屏主控：顶 150 让出幕标题条（SceneTag 占 y 40–110），底边 880 < SAFE_TOP_Y(920)。
   *  2026-09-19 抽帧目视：top=60 时画框左缘会切掉 SceneTag 的副题。 */
  full: {h: 730, top: 150},
  /** 画中画：**右上角定位**（right 48），底边 416 —— 与主画面分带占位。
   *  同镜的自制模型把 Stage top 设 ≥430 即可保证零遮挡（2026-09-19 抽帧实测：
   *  inset 居中会整块盖住装置）。460×259→640×360：VP8@1M 时代 24% 缩放的
   *  「看不清」一半欠在编码（已换 cdp 高清采集），另一半欠在显示面积——
   *  放大 39% 后 720×405 会把三分镜的纵向预算顶穿（2-B/4-E/1-D 栈底 ≥1010），
   *  640 是三分镜重预算后仍有 ≥14px 余量的上限。
   *  image-rendering 刻意不设置：1440 源在 16:9 框内高质量降采样走 Skia
   *  mipmap 路径；pixelated/crisp-edges 是最近邻，会把降采样变锯齿。 */
  inset: {h: 360, top: 56},
} as const;

export const ArchifyClip: React.FC<{
  /** public/archify/ 下的 webm 文件名 */
  file: string;
  /** 本段必须占满的帧数 = 所锚句区间的 durationInFrames */
  spanInFrames: number;
  /** 片内故事起点（秒，视频钟实测） */
  leadSec: number;
  /** 源片故事时长（秒）；省略则按 fit='trim' 处理 */
  storySec?: number;
  /** 适配方式，默认 'stretch' */
  fit?: ArchifyFit;
  /** fit='hold' 时用于冻结补足的末帧 PNG 文件名 */
  endStill?: string;
  /** 右下角标（工程图名） */
  caption: string;
  /** 左下章节小标题 */
  chapterLabel?: string;
  /** 画框档位，默认 'full' */
  variant?: ArchifyVariant;
  /** 是否做入场弹簧与角标淡入。连续换章（背靠背）应传 false 避免每章都弹像卡顿；
   *  首段与空窗后重现的段应传 true，否则整框以全不透明一帧瞬现 */
  lead?: boolean;
  /** rate 越界时抛错（默认 true）——暴露编排失衡，而不是静默变形 */
  strictRate?: boolean;
}> = ({
  file,
  spanInFrames,
  leadSec,
  storySec,
  fit = 'stretch',
  endStill,
  caption,
  chapterLabel,
  variant = 'full',
  lead = true,
  strictRate = true,
}) => {
  const {fps} = useVideoConfig();
  // effects 走时长+缓动，spatial 走弹簧（运动层铁律③）
  const win = useSpring('settle', {at: 2, dur: DUR.f5});
  const label = useProgress(10, DUR.f4);

  const dstSec = spanInFrames / fps;
  const srcSec = storySec ?? dstSec;
  const rawRate = srcSec / dstSec;
  const rate = fit === 'stretch' ? rawRate : 1;
  if (fit === 'stretch' && (rate < RATE_MIN || rate > RATE_MAX) && strictRate) {
    throw new Error(
      `ArchifyClip ${file}: playbackRate ${rate.toFixed(2)} 越界 [${RATE_MIN}, ${RATE_MAX}]；` +
        `源 ${srcSec.toFixed(2)}s / 窗 ${dstSec.toFixed(2)}s。` +
        `请调整句区间或改 fit（不要放宽阈值）。`,
    );
  }
  // 源片在合成时间轴上的占用帧数（变速后）
  const srcFrames = Math.round((srcSec / rate) * fps);
  const videoFrames = Math.min(srcFrames, spanInFrames);
  const holdFrames = spanInFrames - videoFrames;

  const box = BOX[variant];
  const w = Math.round((box.h * 16) / 9);
  const enter = lead ? win : 1;
  // 右下角标在整个 ArchifyRecap 内恒定：非首章不能再从 0 淡入，否则每次换章
  // 闪断约 17 帧（label 起点 10 帧 + f4 7 帧）。左下章节小标题逐章换文案，保留淡入。
  const captionO = lead ? label : 1;
  const frame: React.CSSProperties =
    variant === 'full'
      ? {
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: box.top,
        }
      : {position: 'absolute', top: box.top, right: 48};

  return (
    <div style={frame}>
      <div
        style={{
          position: 'relative',
          width: w,
          height: box.h,
          borderRadius: 14,
          border: `3px solid ${theme.panelBorder}`,
          background: '#0B0E13',
          overflow: 'hidden',
          opacity: enter,
          transform: `scale(${0.94 + 0.06 * enter})`,
        }}
      >
        <Sequence durationInFrames={videoFrames} layout="none">
          <OffthreadVideo
            src={staticFile(`archify/${file}`)}
            muted
            playbackRate={rate}
            trimBefore={Math.round(leadSec * fps)}
            style={{width: '100%', height: '100%', objectFit: 'contain'}}
          />
        </Sequence>
        {holdFrames > 0 && endStill ? (
          <Sequence from={videoFrames} durationInFrames={holdFrames} layout="none">
            <Img
              src={staticFile(`archify/${endStill}`)}
              style={{width: '100%', height: '100%', objectFit: 'contain'}}
            />
          </Sequence>
        ) : null}
        {chapterLabel ? (
          <div
            style={{
              position: 'absolute',
              left: 14,
              bottom: 10,
              maxWidth: variant === 'full' ? 900 : 360,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: theme.sans,
              fontSize: variant === 'full' ? 22 : 15,
              color: theme.text,
              opacity: 0.86 * label,
              letterSpacing: 0.4,
            }}
          >
            {chapterLabel}
          </div>
        ) : null}
        <div
          style={{
            position: 'absolute',
            right: 14,
            bottom: 10,
            fontFamily: theme.mono,
            fontSize: variant === 'full' ? 18 : 12,
            color: theme.dim,
            opacity: captionO,
            whiteSpace: 'nowrap',
          }}
        >
          {variant === 'full' ? `archify 工程图 · ${caption}` : 'archify'}
        </div>
      </div>
    </div>
  );
};
