import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {NarrationAudio} from './components/NarrationAudio';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {computeTimeline} from './timing';
import type {ManifestItem, SceneRange} from './types';
import {P0Hook} from './scenes/P0Hook';
import {P1Boundary} from './scenes/P1Boundary';
import {P2FiveObjects} from './scenes/P2FiveObjects';
import {P3WhenEvidence} from './scenes/P3WhenEvidence';
import {P4Eval} from './scenes/P4Eval';
import {P5Trust} from './scenes/P5Trust';
import {P6Ending} from './scenes/P6Ending';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Hook,
  P1: P1Boundary,
  P2: P2FiveObjects,
  P3: P3WhenEvidence,
  P4: P4Eval,
  P5: P5Trust,
  P6: P6Ending,
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
