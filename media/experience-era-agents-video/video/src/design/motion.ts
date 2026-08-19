/** 动效原语（按集复制、不共享——见 media/pipeline/README.md 复用边界）。
 *  帧驱动铁律：全部动画只依赖 useCurrentFrame()，禁 Date.now()/Math.random()。 */

import {spring, useVideoConfig} from 'remotion';

/** 夹紧 0→1 的线性进度：帧 f 从 a 走到 b */
export const ci = (f: number, a: number, b: number): number =>
  Math.min(1, Math.max(0, (f - a) / (b - a)));

/** 确定性伪随机（sin 哈希）：帧驱动铁律下替代 Math.random() 的标准写法 */
export const rnd = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 交错入场：第 i 个元素延迟 step 帧的 spring（各场景反复重写的四行惯用法） */
export const stagger = (i: number, step = 12, config = {damping: 200}) => {
  // 用法：组件内 const {fps} = useVideoConfig();
  //       spring({frame: frame - i * step, fps, config})
  return {delay: i * step, config};
};

/** 便捷：直接给 frame/fps 算第 i 个元素的入场进度 */
export const staggerIn = (
  frame: number,
  fps: number,
  i: number,
  step = 12,
): number => spring({frame: frame - i * step, fps, config: {damping: 200}});
