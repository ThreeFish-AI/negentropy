import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import chaptersJson from '../chapters.json';
import {theme} from '../design/theme';
import type {SceneRange} from '../types';

type Chapter = {scene: string; title: string};
/** build_narration.py 从 narration.md `## Pn 幕标题` 派生；scaffold 占位 [] 推断为
 *  never[]，统一断言收窄。空数组（首次 build 前）⇒ 本组件不渲染。 */
const CHAPTERS = chaptersJson as Chapter[];

/* ── 几何带 SSOT：整带收在 y<56 ─────────────────────────────────────────────
 * 依据 skills/06 顶部横条实测：各幕内容最早 y=56 起、SceneTag 在 top:64——
 *  y<56 是本设计系统已验证的零碰撞常驻带（底部字幕安全带的顶部对偶）。 */
const MARGIN_X = 4; // 近贴屏幕左右边框，仅留一条竖线宽度的呼吸
const STRIP_W = 1920 - MARGIN_X * 2;
const BAR_Y = 14;
const BAR_H = 28; // 章节名内嵌段内；原 36 的 4/5，底缘 42 仍收在 y<56
const SEG_RADIUS = 4; // 微圆角（勿回胶囊——播放头圆点应是段上唯一圆形元素）
const SEG_GAP = 8;
const TITLE_SIZE = 18; // sans 章节名；标题缺失回退 mono 幕码（15）
const CODE_SIZE = 15;
const TITLE_PAD_X = 14;
const MIN_SEG_FOR_TEXT = 64; // 窄于此宽度的段不显文字（mono 幕码也放不下）
const FADE_IN_FRAMES = 12; // 开场淡入（帧驱动常量，同 Subtitle 先例）
const FADE_OUT_MAX = 30; // 片尾淡出上限 1s，实际取 min(tail, 30)——从 props 推导不写死

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 段边界：段 i 占 [from_i, from_{i+1})，末段吞到 total——幕间 gap 归前段尾，
 *  段宽比=时长占比，段内填充线性（进度是测量不是动效，无缓动）。 */
const segSpans = (scenes: SceneRange[], total: number) =>
  scenes.map((s, i) => ({
    ...s,
    to: i + 1 < scenes.length ? scenes[i + 1].from : total,
  }));

const titleOf = (scene: string) =>
  CHAPTERS.find((c) => c.scene === scene)?.title ?? '';

/** 段内居中文字层。宽度用**显式 px**（段宽 − 左右 padding）——左右两层共用同值，
 *  才能保证 ellipsis 截断逐像素一致，双色裁切不错位。 */
const SegLabel: React.FC<{label: string; mono: boolean; color: string; width: number}> = ({
  label,
  mono,
  color,
  width,
}) => (
  <div
    style={{
      position: 'absolute',
      left: TITLE_PAD_X,
      top: 0,
      width,
      height: BAR_H,
      // 块级居中（lineHeight + textAlign）：text-overflow 只作用 block 容器，
      // flex 容器上「…」不渲染（超宽标题会两侧硬切）
      lineHeight: `${BAR_H}px`,
      textAlign: 'center',
      fontFamily: mono ? theme.mono : theme.sans,
      fontSize: mono ? CODE_SIZE : TITLE_SIZE,
      fontWeight: 500,
      letterSpacing: 1,
      color,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}
  >
    {label}
  </div>
);

/** 顶部分段章节进度条：段宽∝幕时长、已播填充亮色、播放头随帧推进、章节名
 *  内嵌段内居中。文字跨亮填充/深轨两区，用**双色裁切**保对比度：已填侧深字
 *  （bg 压亮填充）、未填侧亮字（当前章 text / 未播章 dim），色随播放头揭示。
 *  全片 overlay，与 Subtitle 同范式（帧驱动 + 只读底座 token、零 spring）。 */
export const ChapterProgress: React.FC<{
  scenes: SceneRange[];
  totalDurationInFrames: number;
}> = ({scenes, totalDurationInFrames}) => {
  const frame = useCurrentFrame();
  if (CHAPTERS.length === 0 || scenes.length === 0) {
    return null;
  }
  const segs = segSpans(scenes, totalDurationInFrames);
  const scale = (STRIP_W - SEG_GAP * (segs.length - 1)) / segs.reduce((a, s) => a + s.to - s.from, 0);
  let x = 0;
  const layout = segs.map((s) => {
    const w = (s.to - s.from) * scale;
    const seg = {from: s.from, to: s.to, x, w};
    x += w + SEG_GAP;
    return seg;
  });
  let currentIdx = segs.findIndex((s) => frame < s.to);
  if (currentIdx === -1) {
    currentIdx = segs.length - 1; // tail：钳在末段
  }
  const head = layout[currentIdx];
  const headX = head.x + head.w * clamp01((frame - head.from) / (head.to - head.from));

  const lastSeg = segs[segs.length - 1];
  const fadeOutFrames = Math.max(
    1,
    Math.min(totalDurationInFrames - (lastSeg.from + lastSeg.durationInFrames), FADE_OUT_MAX),
  );
  const opacity =
    interpolate(frame, [0, FADE_IN_FRAMES], [0, 1], {extrapolateRight: 'clamp'}) *
    interpolate(frame, [totalDurationInFrames - fadeOutFrames, totalDurationInFrames], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  return (
    <div style={{position: 'absolute', left: MARGIN_X, top: BAR_Y, width: STRIP_W, opacity, pointerEvents: 'none'}}>
      {segs.map((s, i) => {
        const {x: segX, w} = layout[i];
        const fill = clamp01((frame - s.from) / (s.to - s.from));
        const title = titleOf(s.scene);
        const label = title || s.scene; // 标题缺失回退 mono 幕码
        const mono = !title;
        const textW = w - TITLE_PAD_X * 2;
        return (
          <div
            key={s.scene}
            style={{
              position: 'absolute',
              left: segX,
              width: w,
              height: BAR_H,
              borderRadius: SEG_RADIUS,
              overflow: 'hidden',
            }}
          >
            {/* 轨道 + 未填侧文字（当前章 text、未播章 dim；被填充盖住左区） */}
            <div style={{position: 'absolute', left: 0, top: 0, width: w, height: BAR_H, background: theme.panelBorder}} />
            {w >= MIN_SEG_FOR_TEXT && (
              <SegLabel label={label} mono={mono} color={i === currentIdx ? theme.text : theme.dim} width={textW} />
            )}
            {/* 已填区裁切层：亮填充（text@0.9 压顶部重量）+ 深色同位文字 */}
            <div style={{position: 'absolute', left: 0, top: 0, width: w * fill, height: BAR_H, overflow: 'hidden'}}>
              <div style={{position: 'absolute', left: 0, top: 0, width: w, height: BAR_H, background: theme.text, opacity: 0.9}} />
              {w >= MIN_SEG_FOR_TEXT && <SegLabel label={label} mono={mono} color={theme.bg} width={textW} />}
            </div>
          </div>
        );
      })}
      {/* 播放头：亮圆点 + bg 描边（亮填充上保轮廓）+ 辉光（rgba = theme.text 底座 #F2F5FA） */}
      <div
        style={{
          position: 'absolute',
          left: headX - 7,
          top: BAR_H / 2 - 7,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: theme.text,
          border: `3px solid ${theme.bg}`,
          boxShadow: '0 0 10px rgba(242,245,250,0.5)',
        }}
      />
    </div>
  );
};
