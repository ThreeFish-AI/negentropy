import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {NarrationAudio} from './components/NarrationAudio';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {computeTimeline} from './timing';
import type {ManifestItem, SceneRange} from './types';
import {P0Cold} from './scenes/P0Cold';
import {P1Anatomy} from './scenes/P1Anatomy';
import {P2Brain} from './scenes/P2Brain';
import {P3Gear} from './scenes/P3Gear';
import {P4Balance} from './scenes/P4Balance';
import {P5Ending} from './scenes/P5Ending';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Cold,
  P1: P1Anatomy,
  P2: P2Brain,
  P3: P3Gear,
  P4: P4Balance,
  P5: P5Ending,
};

export type MainProps = {manifest: ManifestItem[]};

export const Main: React.FC<MainProps> = ({manifest}) => {
  const {timed, scenes} = computeTimeline(manifest);
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      {scenes.map((sc) => {
        const SceneComp = SCENE_COMPONENTS[sc.scene];
        if (!SceneComp) {
          throw new Error(`未注册的场景组件: ${sc.scene}`);
        }
        return (
          <Sequence key={sc.scene} from={sc.from} durationInFrames={sc.durationInFrames} name={sc.scene}>
            <SceneComp scene={sc} />
          </Sequence>
        );
      })}
      <NarrationAudio timed={timed} />
      <Subtitle timed={timed} />
    </AbsoluteFill>
  );
};
