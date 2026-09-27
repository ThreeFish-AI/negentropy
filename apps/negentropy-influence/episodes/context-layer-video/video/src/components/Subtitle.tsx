import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {fitText} from '@remotion/layout-utils';
import {theme} from '../design/theme';
import {PRIMARY_LANG, useLang} from '../i18n';
import type {Lang} from '../i18n';
import type {TimedSentence} from '../types';

const MAX_WIDTH = 1600;
const PADDING_X = 36;
/** Remotion 默认样式表为 box-sizing: border-box，内容预算须减去左右 padding */
const CONTENT_WIDTH = MAX_WIDTH - PADDING_X * 2;
const MAX_FONT_SIZE = 44;
const MIN_FONT_SIZE = 30;

/* ── en 双行几何守恒（推导链，勿凭感觉调）──────────────────────────────────
 * 锚点：qa_frames.py 的字幕盒侵入检测线 SUBTITLE_BOX_H_PX = 132（自画底向上），
 * zh 单行满字号盒顶包络 = marginBottom 54 + 上下 padding 12×2 + 44×1.35（单行高）
 * = 137.4 —— 既有 zh 渲染在这条检测线之上的实际安全占位。en 双行盒必须收进
 * 同一包络，否则英文版会把检查线的 padding 缓冲带吃掉（qa 侵入检测两语言照常
 * 执法，不为 en 关门）：
 *   盒顶距画底 = marginBottom 35 + padding 24 + 2 行 × 30 × 1.3 = 137 ≤ 137.4 ✓
 * 故 en 盒**恒用** marginBottom 35（单行/双行不跳变——单行更矮，余量更大）；
 * 双行恒 fontSize 30 / lineHeight 1.3（两常数与 margin 互锁：改任何一个都会
 * 破坏 137 ≤ 137.4，须连同 qa_frames 的检查线一起重标定）。en 恒用 lineHeight
 * 1.3（单/双行同值），zh 恒 1.35——两语言各自恒定，互不牵连。 */
const EN_MARGIN_BOTTOM = 35;
const EN_TWO_LINE_SIZE = 30;
const EN_LINE_HEIGHT = 1.3;

/** 字幕显示文本（仅渲染层变换，narration/manifest 保留原句号以维持 TTS digest
 *  与韵律不变）：zh 剥句尾「。」（2026-09-14 起系列风格）；en 剥**单个**句尾
 *  半角句点——省略号的尾点前仍是「.」，lookbehind 拦下不剥。 */
const displayText = (t: string, lang: Lang) =>
  lang === PRIMARY_LANG ? t.replace(/。+$/, '') : t.replace(/(?<!\.)\.$/, '');

/** 全片底部字幕条：一句一条，与配音逐句同步（storyboard.md 字幕规范）。
 *  字号用 @remotion/layout-utils 的 fitText 真实测量（替代此前手写的全角 1.0/半角
 *  0.55 宽度估算与魔法阈值）。validateFontIsLoaded 保持 4.x 默认 false——系统字体
 *  栈无 loadFont() promise 可等；⚠️ Remotion 5.0 起该开关默认翻 true，届时若仍未
 *  内嵌字体会开始抛错（重启触发器见 references/08 事实条（字体可复现性））。
 *  zh 恒单行（逐像素沿用既有渲染）；en 单行 fitText ≥ 30 用单行（盒几何仍走
 *  en 档），放不下则回落两行 + textWrap balance 均衡断行。 */
export const Subtitle: React.FC<{timed: TimedSentence[]}> = ({timed}) => {
  const frame = useCurrentFrame();
  const lang = useLang();
  const current = timed.find((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  if (!current) {
    return null;
  }
  const local = frame - current.from;
  const opacity = interpolate(local, [0, 4], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const text = displayText(current.text, lang);
  const fitted = fitText({
    text,
    withinWidth: CONTENT_WIDTH,
    fontFamily: theme.sans,
    fontWeight: 500, // 须与下方 div 的 fontWeight 一致，否则测量偏小
  }).fontSize;
  const isZh = lang === PRIMARY_LANG;
  const twoLine = !isZh && fitted < MIN_FONT_SIZE;
  const fontSize = twoLine
    ? EN_TWO_LINE_SIZE
    : Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fitted));
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          marginBottom: isZh ? 54 : EN_MARGIN_BOTTOM,
          maxWidth: MAX_WIDTH,
          padding: `12px ${PADDING_X}px`,
          borderRadius: 12,
          background: 'rgba(6, 8, 12, 0.68)',
          color: theme.text,
          fontFamily: theme.sans,
          fontSize,
          fontWeight: 500,
          lineHeight: isZh ? 1.35 : EN_LINE_HEIGHT,
          whiteSpace: twoLine ? 'normal' : 'nowrap',
          // 两行均衡断行（csstype 3.2.3 已收录；undefined 时 React 不落 DOM 属性）
          textWrap: twoLine ? 'balance' : undefined,
          opacity,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
