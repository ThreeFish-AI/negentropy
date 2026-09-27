/** P0 三个自信的错——场景桩（Stage ⑧ 全量实现待录制/TTS 完成后落位；storyboard P0 节为规格）。 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {SceneRange} from '../types';
import {theme} from '../design/theme';

export const P0Errors: React.FC<{scene: SceneRange}> = ({scene}) => (
  <AbsoluteFill style={{background: theme.bg}}>
    {/* 桩：⑧ 按 storyboard 镜表与 cue 落位实现 */}
  </AbsoluteFill>
);
