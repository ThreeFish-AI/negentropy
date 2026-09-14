import React from 'react';
import {Audio} from '@remotion/media';
import {staticFile} from 'remotion';
import type {TimedSentence} from '../types';

/**
 * 预览期提前 1s 挂载缓冲；渲染期 Remotion 自动关闭 premount（active 含
 * !env.isRendering——收益只在 Studio 拖拽与 Player，渲染侧收益是 Mediabunny
 * 抽轨与官方声明的时间轴同步，不是渲染速度。见 skills/06 事实条）。
 */
const PREMOUNT_FRAMES = 30;

/** 全片旁白：每句一段音频，按 manifest 绝对帧位装配（时间轴与视觉层解耦）。
 *  @remotion/media 的 <Audio> 原生带 from/durationInFrames，无须外包 <Sequence>——
 *  premountFor 挂在「尚未开始的 Sequence」子节点上不会触发。失败默认回落
 *  <Html5Audio>（更稳），缺 manifest 的报错在 Root.tsx calculateMetadata。 */
export const NarrationAudio: React.FC<{timed: TimedSentence[]}> = ({timed}) => (
  <>
    {timed.map((s) => (
      <Audio
        key={s.id}
        name={`audio:${s.id}`}
        src={staticFile(`audio/${s.id}.mp3`)}
        from={s.from}
        durationInFrames={s.durationInFrames}
        premountFor={PREMOUNT_FRAMES}
      />
    ))}
  </>
);
