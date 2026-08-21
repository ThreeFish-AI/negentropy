import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {ManifestItem, SceneRange} from './types';
import {P0Hook} from './scenes/P0Hook';
import {P1Anatomy} from './scenes/P1Anatomy';
import {P2FourDestinations} from './scenes/P2FourDestinations';
import {P3Meta} from './scenes/P3Meta';
import {P4Eval} from './scenes/P4Eval';
import {P5Safety} from './scenes/P5Safety';
import {P6Ending} from './scenes/P6Ending';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Hook,
  P1: P1Anatomy,
  P2: P2FourDestinations,
  P3: P3Meta,
  P4: P4Eval,
  P5: P5Safety,
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
