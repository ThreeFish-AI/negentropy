import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {ChapterProgress} from './components/ChapterProgress';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {P0Crash} from './scenes/P0Crash';
import {P1Edifice} from './scenes/P1Edifice';
import {P2Manual} from './scenes/P2Manual';
import {P3Ledger} from './scenes/P3Ledger';
import {P4Rampart} from './scenes/P4Rampart';
import {P5Concierge} from './scenes/P5Concierge';
import {P6Assembly} from './scenes/P6Assembly';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {ManifestItem, SceneRange} from './types';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Crash,
  P1: P1Edifice,
  P2: P2Manual,
  P3: P3Ledger,
  P4: P4Rampart,
  P5: P5Concierge,
  P6: P6Assembly,
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
