/** archify 工程图**整屏回放窗**（v4 母题：全屏独占、与自制装置来回切换）。
 *
 *  素材链：`pipeline/scripts/record_archify.py --mode chapter --all-chapters`
 *  逐章录制视频（每章一段，playwright=webm / cdp=mp4）→ `scripts/archify_lead.py` 用场记板白闪测定真实
 *  `leadSec` → `scripts/archify_manifest.py` 生成 `archify.manifest.ts`。
 *
 *  **为什么逐章而不是整段切片**：整段切片要求 `trimBefore` 达 15s 量级，而
 *  `trimBefore × playbackRate` 的换算次序一旦理解偏差就被整段长度放大；逐章录制
 *  把片内 lead 压到 ~2s 量级、且每段只播一章，同样的偏差只造成 ≤2 帧误差。
 *  ——难的对齐问题被消去，而不是被更精确地解决。
 *
 *  **全屏独占契约（v4）**：archify 播放期间不与自制装置同屏——装置由 ArchifyYield
 *  按 cue 窗淡出让位、或挪到窗外句窗（1-C 嵌套范式）/被画框直接遮盖（4-D② 范式）。
 *  历史 inset 画中画档（640×360 右上角）已删除：「看不清」欠在显示面积，
 *  覆盖门 forbid_inset 锁死防回退。
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

const RATE_MIN = 0.7;
const RATE_MAX = 1.35;

/** 画框几何：按**高**定尺，三条不变量护栏（改前先在此对账，勿凭感觉放大）：
 *  ① 顶 150 ≥ 135：SceneTag（y 40–110，副题最长 13 字右缘 ~358 与框左缘横向重叠）
 *     只能靠纵向避让——top < 135 会切副题（2026-09-19 实测 top=60 切角标副题）；
 *  ② 底边 880 < SAFE_TOP_Y(920)：字幕带安全带（SUBTITLE_BAND_PX=160 同源）；
 *  ③ 框宽 1298 左缘 311 > PillarHUD 右缘 ~274：HUD 在全屏窗内**仍可见**（左下角
 *     常驻件不是图例，是母图层叙事锚），放大 h 会先吃掉这 37px 余量（h=770 即触线）。
 *  image-rendering 刻意不设置：1440 源在 16:9 框内高质量降采样走 Skia
 *  mipmap 路径；pixelated/crisp-edges 是最近邻，会把降采样变锯齿。 */
const BOX = {h: 730, top: 150} as const;

export const ArchifyClip: React.FC<{
  /** public/archify/ 下的视频文件名（webm / mp4，随采集方式而定） */
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

  const w = Math.round((BOX.h * 16) / 9);
  const enter = lead ? win : 1;
  // 右下角标在整个 ArchifyRecap 内恒定：非首章不能再从 0 淡入，否则每次换章
  // 闪断约 17 帧（label 起点 10 帧 + f4 7 帧）。左下章节小标题逐章换文案，保留淡入。
  const captionO = lead ? label : 1;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: BOX.top,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: w,
          height: BOX.h,
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
            // +1 帧：trimBefore 边界帧会解码到场记板白闪的末帧（openviking-video 3-C 实测单帧 255 亮度），
            // 多跳一帧落在故事首帧（亮度 ≈25），视觉上无可感时移
            trimBefore={Math.round(leadSec * fps) + 1}
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
              maxWidth: 900,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: theme.sans,
              fontSize: 22,
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
            fontSize: 18,
            color: theme.dim,
            opacity: captionO,
            whiteSpace: 'nowrap',
          }}
        >
          {`archify 工程图 · ${caption}`}
        </div>
      </div>
    </div>
  );
};
