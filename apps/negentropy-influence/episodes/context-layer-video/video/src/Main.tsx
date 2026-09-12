import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {P0Bare} from './scenes/P0Bare';
import {P1Blocks} from './scenes/P1Blocks';
import {P2Objects} from './scenes/P2Objects';
import {P3Nurture} from './scenes/P3Nurture';
import {P4Window} from './scenes/P4Window';
import {P5Edge} from './scenes/P5Edge';
import {P6Road} from './scenes/P6Road';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {ManifestItem, SceneRange} from './types';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Bare,
  P1: P1Blocks,
  P2: P2Objects,
  P3: P3Nurture,
  P4: P4Window,
  P5: P5Edge,
  P6: P6Road,
};

export type MainProps = {manifest: ManifestItem[]};

export const Main: React.FC<MainProps> = ({manifest}) => {
  const {timed, scenes} = computeTimeline(manifest);
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
    </AbsoluteFill>
  );
};
