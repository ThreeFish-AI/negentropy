import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {ChapterProgress} from './components/ChapterProgress';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {LangProvider} from './i18n';
import {P0HumanLoop} from './scenes/P0HumanLoop';
import {P1LoopVerify} from './scenes/P1LoopVerify';
import {P2ToolRegistry} from './scenes/P2ToolRegistry';
import {P3ThreeGates} from './scenes/P3ThreeGates';
import {P4HookSockets} from './scenes/P4HookSockets';
import {P5CheckChain} from './scenes/P5CheckChain';
import {P6OneLoop} from './scenes/P6OneLoop';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {Lang} from './i18n';
import type {ManifestItem, SceneRange} from './types';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0HumanLoop,
  P1: P1LoopVerify,
  P2: P2ToolRegistry,
  P3: P3ThreeGates,
  P4: P4HookSockets,
  P5: P5CheckChain,
  P6: P6OneLoop,
};

export type MainProps = {manifest: ManifestItem[]; lang?: Lang};

export const Main: React.FC<MainProps> = ({manifest, lang}) => {
  const {timed, scenes, totalDurationInFrames} = computeTimeline(manifest);
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      {/* 语言 context 包全树：NarrationAudio/Subtitle/ChapterProgress/场景组件经
          useLang 取语言；缺省 zh ⇒ 既有集渲染逐像素不变（provider 零 DOM 输出）。
          挂载行落在 regioned 归一化保留区（同 ChapterProgress 先例，测试锚）。 */}
      <LangProvider lang={lang}>
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
      </LangProvider>
    </AbsoluteFill>
  );
};
