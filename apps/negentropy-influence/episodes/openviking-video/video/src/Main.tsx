import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {ChapterProgress} from './components/ChapterProgress';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {ManifestItem, SceneRange} from './types';
import {P0Amnesia} from './scenes/P0Amnesia';
import {P1Tree} from './scenes/P1Tree';
import {P2Tiers} from './scenes/P2Tiers';
import {P3Retrieval} from './scenes/P3Retrieval';
import {P4Memory} from './scenes/P4Memory';
import {P5Teardown} from './scenes/P5Teardown';
import {P6Lab} from './scenes/P6Lab';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Amnesia,
  P1: P1Tree,
  P2: P2Tiers,
  P3: P3Retrieval,
  P4: P4Memory,
  P5: P5Teardown,
  P6: P6Lab,
};

export type MainProps = {manifest: ManifestItem[]};

export const Main: React.FC<MainProps> = ({manifest}) => {
  const {timed, scenes, totalDurationInFrames} = computeTimeline(manifest);
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      {scenes.map((sc, i) => {
        const SceneComp = SCENE_COMPONENTS[sc.scene];
        if (!SceneComp) {
          throw new Error(`未注册的场景组件: ${sc.scene}`);
        }
        return (
          <Sequence key={sc.scene} from={sc.from} durationInFrames={sc.durationInFrames} name={sc.scene}>
            {/* 幕间呼吸淡入淡出：只花幕间既有静默，from/总时长零改动；首幕不淡入、
                末幕不淡出（尾幕渐黑由 P6 从末 beat 推导，叠加成双重渐黑） */}
            <SceneFade
              durationInFrames={sc.durationInFrames}
              fadeIn={i === 0 ? 0 : SCENE_FADE_FRAMES}
              fadeOut={i === scenes.length - 1 ? 0 : SCENE_FADE_FRAMES}
            >
              <SceneComp scene={sc} />
            </SceneFade>
          </Sequence>
        );
      })}
      <NarrationAudio timed={timed} />
      <Subtitle timed={timed} />
      {/* 顶部分段章节进度条：chapters.json（build_narration 派生）为空时自渲染 null */}
      <ChapterProgress scenes={scenes} totalDurationInFrames={totalDurationInFrames} />
    </AbsoluteFill>
  );
};
