import React from 'react';
import {Composition, staticFile} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {Main} from './Main';
import type {MainProps} from './Main';
import {audioDir, PRIMARY_LANG} from './i18n';
import type {Lang} from './i18n';
import {computeTimeline, FPS} from './timing';
import type {ManifestItem} from './types';

/** 合法语言集（i18n.tsx 的 Lang 联合类型是 TS 侧事实源，此处仅运行时枚举） */
const LANGS: readonly Lang[] = ['zh', 'en'];

const calculateMetadata: CalculateMetadataFunction<MainProps> = async ({props}) => {
  // --props 输入可能携带任意 JSON，入口处校验：静默回落会产出错版视频
  const lang = props.lang ?? PRIMARY_LANG;
  if (!LANGS.includes(lang)) {
    throw new Error(
      `非法 lang ${JSON.stringify(lang)}：只接受 ${LANGS.map((l) => `'${l}'`).join(' | ')}`,
    );
  }
  const res = await fetch(staticFile(`${audioDir(lang)}/manifest.json`));
  if (!res.ok) {
    throw new Error(
      lang === 'en'
        ? `缺少 public/${audioDir(lang)}/manifest.json —— 英文版先运行 scripts/tts.py --narration-lang en 合成配音`
        : '缺少 public/audio/manifest.json —— 先运行 scripts/tts.py 合成配音',
    );
  }
  const manifest = (await res.json()) as ManifestItem[];
  const {totalDurationInFrames} = computeTimeline(manifest);
  return {
    durationInFrames: totalDurationInFrames,
    props: {...props, manifest, lang},
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={Main}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={100}
      defaultProps={{manifest: [] as ManifestItem[], lang: PRIMARY_LANG}}
      calculateMetadata={calculateMetadata}
    />
  );
};
