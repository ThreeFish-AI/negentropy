import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {ChapterProgress} from './components/ChapterProgress';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {LangProvider} from './i18n';
import {P0Failures} from './scenes/P0Failures';
import {P1Todo} from './scenes/P1Todo';
import {P2Subagent} from './scenes/P2Subagent';
import {P3Skills} from './scenes/P3Skills';
import {P4Prompt} from './scenes/P4Prompt';
import {P5Recovery} from './scenes/P5Recovery';
import {P6Rules} from './scenes/P6Rules';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {Lang} from './i18n';
import type {ManifestItem, SceneRange} from './types';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Failures,
  P1: P1Todo,
  P2: P2Subagent,
  P3: P3Skills,
  P4: P4Prompt,
  P5: P5Recovery,
  P6: P6Rules,
};

export type MainProps = {manifest: ManifestItem[]; lang?: Lang};

export const Main: React.FC<MainProps> = ({manifest, lang}) => {
  const {timed, scenes, totalDurationInFrames} = computeTimeline(manifest);
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <LangProvider lang={lang}>
        {scenes.map((sc, i) => {
          const SceneComp = SCENE_COMPONENTS[sc.scene];
          if (!SceneComp) {
            throw new Error(`未注册的场景组件: ${sc.scene}`);
          }
          return (
            <Sequence key={sc.scene} from={sc.from} durationInFrames={sc.durationInFrames} name={sc.scene}>
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
        <ChapterProgress scenes={scenes} totalDurationInFrames={totalDurationInFrames} />
      </LangProvider>
    </AbsoluteFill>
  );
};
