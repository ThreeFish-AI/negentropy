import React from 'react';
import {AbsoluteFill} from 'remotion';
import {theme} from '../design/theme';
import type {SceneRange} from '../types';

// P6 两个破坏实验 —— 场景壳（Stage ⑥ 随分镜落位；Stage ⑧ 按分镜镜表填充装置与动效）
export const P6: React.FC<{scene: SceneRange}> = ({scene}) => (
  <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
    <div style={{color: theme.concept, fontFamily: theme.sans, fontSize: 64}}>
      P6 两个破坏实验
    </div>
    <div style={{color: theme.dim, fontFamily: theme.mono, fontSize: 24, marginTop: 24}}>
      {scene.scene} · {scene.from}f +{scene.durationInFrames}f
    </div>
  </AbsoluteFill>
);
