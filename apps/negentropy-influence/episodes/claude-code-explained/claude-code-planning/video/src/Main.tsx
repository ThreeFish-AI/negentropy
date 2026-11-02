import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ChapterProgress} from './components/ChapterProgress';
import {NarrationAudio} from './components/NarrationAudio';
import {SceneFade} from './components/SceneFade';
import {Subtitle} from './components/Subtitle';
import {theme} from './design/theme';
import {LangProvider} from './i18n';
import {P0Reread} from './scenes/P0Reread';
import {P1TodoCard} from './scenes/P1TodoCard';
import {P2SideDesk} from './scenes/P2SideDesk';
import {P3Paper} from './scenes/P3Paper';
import {P4Ladder} from './scenes/P4Ladder';
import {P5Scene} from './scenes/P5Scene';
import {P6Arranged} from './scenes/P6Arranged';
import {INTRO_FRAMES, SeriesIntro} from './components/series-intro';
import {computeTimeline, SCENE_FADE_FRAMES} from './timing';
import type {Lang} from './i18n';
import type {ManifestItem, SceneRange} from './types';

const SCENE_COMPONENTS: Record<string, React.FC<{scene: SceneRange}>> = {
  P0: P0Reread,
  P1: P1TodoCard,
  P2: P2SideDesk,
  P3: P3Paper,
  P4: P4Ladder,
  P5: P5Scene,
  P6: P6Arranged,
};

export type MainProps = {manifest: ManifestItem[]; lang?: Lang};

export const Main: React.FC<MainProps> = ({manifest, lang}) => {
  const {timed, scenes, totalDurationInFrames} = computeTimeline(manifest);
  // 章节条片头静默：frozen ChapterProgress 恒从 frame 0 挂载（自带 FADE_IN 12 帧早已完成），
  // 片头期以调用点侧 wrapper 压到 0、片头交棒后 12 帧淡入（不动 frozen 组件本体）
  const frame = useCurrentFrame();
  const chromeIn = Math.min(1, Math.max(0, (frame - INTRO_FRAMES) / 12));
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      {/* 语言 context 包全树：NarrationAudio/Subtitle/ChapterProgress/场景组件经
          useLang 取语言；缺省 zh ⇒ 既有集渲染逐像素不变（provider 零 DOM 输出）。
          挂载行落在 regioned 归一化保留区（同 ChapterProgress 先例，测试锚）。 */}
      <LangProvider lang={lang}>
        {/* 系列片头《一个循环》：压扩展 leadIn 时段（0..INTRO_FRAMES），正片 P0 自 leadIn 起。
            片头口播为独立音轨（不入 narration manifest）——见 components/series-intro.tsx 头注。 */}
        <Sequence from={0} durationInFrames={INTRO_FRAMES} name="Intro">
          <SeriesIntro />
        </Sequence>
        {scenes.map((sc, i) => {
          const SceneComp = SCENE_COMPONENTS[sc.scene];
          if (!SceneComp) {
            throw new Error(`未注册的场景组件: ${sc.scene}`);
          }
          return (
            <Sequence key={sc.scene} from={sc.from} durationInFrames={sc.durationInFrames} name={sc.scene}>
              {/* 幕间呼吸淡入淡出：只花幕间既有静默，from/总时长零改动；首幕不淡入、
                  末幕不淡出（尾幕渐黑由 P6 从末 beat 推导，叠加成双重渐黑）。
                  首幕不淡入的现行依据（片头改版 2026-10-06）：leadIn 时段已是
                  series-intro 片头（非旧 0.6s 黑场），片头自带交棒渐出，首幕再
                  fadeIn 会双重渐出——frozen SceneFade 头注的 0.6s 口径已过期 */}
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
        {/* 顶部分段章节进度条：chapters.json（build_narration 派生）为空时自渲染 null；
            片头期静默（见上 chromeIn） */}
        <AbsoluteFill style={{opacity: chromeIn, pointerEvents: 'none'}}>
          <ChapterProgress scenes={scenes} totalDurationInFrames={totalDurationInFrames} />
        </AbsoluteFill>
      </LangProvider>
    </AbsoluteFill>
  );
};
