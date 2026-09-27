/** P2 当版页制度对象层——场景桩（Stage ⑧ 全量实现待录制/TTS 完成后落位；storyboard P2 节为规格）。 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {SceneRange} from '../types';
import {theme} from '../design/theme';

export const P2MasterPage: React.FC<{scene: SceneRange}> = ({scene}) => (
  <AbsoluteFill style={{background: theme.bg}}>
    {/* 桩：⑧ 按 storyboard 镜表与 cue 落位实现 */}
  </AbsoluteFill>
);
