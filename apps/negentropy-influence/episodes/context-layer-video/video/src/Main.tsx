import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {ChapterProgress} from './components/ChapterProgress';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {LangProvider} from './i18n';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {Lang} from './i18n';
import type {ManifestItem, SceneRange} from './types';
import {P0Errors} from './scenes/P0Errors';
import {P1Blueprint} from './scenes/P1Blueprint';
import {P2Asset} from './scenes/P2Asset';
import {P3Authority} from './scenes/P3Authority';
import {P4Assembly} from './scenes/P4Assembly';
import {P5Retrieval} from './scenes/P5Retrieval';
import {P6Compounding} from './scenes/P6Compounding';
import {P7ReadPath} from './scenes/P7ReadPath';
import {P8Truth} from './scenes/P8Truth';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Errors,
  P1: P1Blueprint,
  P2: P2Asset,
  P3: P3Authority,
  P4: P4Assembly,
  P5: P5Retrieval,
  P6: P6Compounding,
  P7: P7ReadPath,
  P8: P8Truth,
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
                  末幕不淡出（尾幕渐黑由 P8 从末 beat 推导，叠加成双重渐黑） */}
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
