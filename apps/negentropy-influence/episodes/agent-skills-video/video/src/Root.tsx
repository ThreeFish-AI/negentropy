import React from 'react';
import {Composition, staticFile} from 'remotion';
import type {CalculateMetadataFunction} from 'remotion';
import {Main} from './Main';
import type {MainProps} from './Main';
import {computeTimeline, FPS} from './timing';
import type {ManifestItem} from './types';

const calculateMetadata: CalculateMetadataFunction<MainProps> = async () => {
  const res = await fetch(staticFile('audio/manifest.json'));
  if (!res.ok) {
    throw new Error('缺少 public/audio/manifest.json —— 先运行 scripts/tts.py 合成配音');
  }
  const manifest = (await res.json()) as ManifestItem[];
  const {totalDurationInFrames} = computeTimeline(manifest);
  return {
    durationInFrames: totalDurationInFrames,
    props: {manifest},
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
      defaultProps={{manifest: [] as ManifestItem[]}}
      calculateMetadata={calculateMetadata}
    />
  );
};
