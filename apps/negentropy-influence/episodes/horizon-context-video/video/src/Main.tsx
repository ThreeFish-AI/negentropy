import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {P0Cold} from './scenes/P0Cold';
import {P1Intern} from './scenes/P1Intern';
import {P2Manual} from './scenes/P2Manual';
import {P3Gate} from './scenes/P3Gate';
import {P4Ledger} from './scenes/P4Ledger';
import {P5Badge} from './scenes/P5Badge';
import {P6Ending} from './scenes/P6Ending';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {ManifestItem, SceneRange} from './types';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Cold,
  P1: P1Intern,
  P2: P2Manual,
  P3: P3Gate,
  P4: P4Ledger,
  P5: P5Badge,
  P6: P6Ending,
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
