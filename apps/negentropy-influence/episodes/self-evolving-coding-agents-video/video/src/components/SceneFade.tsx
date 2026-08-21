import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

/**
 * 幕间呼吸淡入淡出——只花 timing.json 已声明的幕间静默（句间 0.32s + 幕间 0.9s），
 * 不改任何 Sequence 的 from 与总时长，音频层零风险。
 *
 * 为什么不用 @remotion/transitions 的 TransitionSeries：其总时长 = Σ序列 − Σ转场，
 * 会把视觉层整体左移而旁白（按 manifest 帧号绝对定位的独立层）不动，产生逐幕
 * 递增的失同步。见 pipeline/skills/06-remotion-implementation.md。
 *
 * 用法（Main.tsx 的 scenes.map 内包一层）：
 *   <SceneFade durationInFrames={sc.durationInFrames}
 *              fadeIn={i === 0 ? 0 : SCENE_FADE_FRAMES}
 *              fadeOut={i === scenes.length - 1 ? 0 : SCENE_FADE_FRAMES}>
 *     <SceneComp scene={sc} />
 *   </SceneFade>
 * 首幕不淡入（LEAD_IN 0.6s 本就黑场）；末幕不淡出（尾幕渐黑由 P6 从末 beat 推导，
 * 叠加会成双重渐黑——上线教训见 skills/06 清单第 4 条）。
 * 三集逐字节一致（冻结清单成员）。不变式由 check_script.py 强制：
 * 2 × sceneCrossFadeSec ≤ sentenceGapSec + sceneGapSec。
 */
export const SceneFade: React.FC<{
  durationInFrames: number;
  fadeIn: number;
  fadeOut: number;
  children: React.ReactNode;
}> = ({durationInFrames, fadeIn, fadeOut, children}) => {
  const frame = useCurrentFrame();
  const inOp = fadeIn
    ? interpolate(frame, [0, fadeIn], [0, 1], {extrapolateRight: 'clamp'})
    : 1;
  const outOp = fadeOut
    ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
      })
    : 1;
  return (
    <AbsoluteFill style={{opacity: Math.min(inOp, outOp)}}>{children}</AbsoluteFill>
  );
};
