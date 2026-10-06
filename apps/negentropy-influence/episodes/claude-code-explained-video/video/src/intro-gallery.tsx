/** IntroGallery——系列片头五集变体评审面（独立 Remotion 入口，仿 MotionGallery，
 *  不经 Root.tsx，对既有 Composition 零影响）。
 *
 * 用法（在 video/ 目录，.bin 直调防污染根 workspace）——每集变体拍 3 定格帧
 * （--frame=620：进度点 stagger 已全亮，且处于片头第三拍中段）：
 *   ./node_modules/.bin/remotion still src/intro-gallery.tsx IntroEp1 \
 *       out/intro-ep1.png --frame=620
 *
 * mech 色为本文件字面量（series.json 五集 accents 实占值；dev 工具面口径同
 * MotionGallery——不读各集 theme，评审面独立声明）。层名/标题仍读 series-layers.json。
 */
import React from 'react';
import {Composition, registerRoot} from 'remotion';
import constants from './timing.json';
import {INTRO_FRAMES, SeriesIntro} from './components/series-intro';

/** 五集变体：activeIndex 1-5 × 各集 mech 色（EP1 青/EP2 紫/EP3 绿/EP4 蓝/EP5 金）。 */
const VARIANTS = [
  {activeIndex: 1, mech: '#64C4C0'},
  {activeIndex: 2, mech: '#9C90EE'},
  {activeIndex: 3, mech: '#A9C46C'},
  {activeIndex: 4, mech: '#7FB2E0'},
  {activeIndex: 5, mech: '#D9B36B'},
] as const;

const Root: React.FC = () => (
  <>
    {VARIANTS.map((v) => (
      <Composition
        key={v.activeIndex}
        id={`IntroEp${v.activeIndex}`}
        component={SeriesIntro}
        width={1920}
        height={1080}
        fps={constants.fps}
        durationInFrames={INTRO_FRAMES}
        defaultProps={{override: v}}
      />
    ))}
  </>
);

registerRoot(Root);
