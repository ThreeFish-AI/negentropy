/** 临时抽帧预览（Stage ⑧ 场景代理 QA 用——不入库，用后即删）。
 *  以真实 manifest 走 computeTimeline，单幕挂载本路两场景，供 remotion still 目检。 */
import React from 'react';
import {AbsoluteFill, Composition, Sequence, registerRoot} from 'remotion';
import {computeTimeline} from './timing';
import type {ManifestItem} from './types';
import {P0TwoTimes} from './scenes/P0TwoTimes';
import {P6OneBelt} from './scenes/P6OneBelt';
import {theme} from './design/theme';

type PrevProps = {manifest: ManifestItem[]};

const ScenePrev: React.FC<PrevProps & {scene: string}> = ({manifest, scene}) => {
  const {scenes} = computeTimeline(manifest);
  const sc = scenes.find((s) => s.scene === scene);
  if (!sc) return null;
  const Comp = scene === 'P0' ? P0TwoTimes : P6OneBelt;
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Sequence from={sc.from} durationInFrames={sc.durationInFrames} name={scene}>
        <Comp scene={sc} />
      </Sequence>
    </AbsoluteFill>
  );
};

const meta = ({props}: {props: PrevProps}) => {
  const {totalDurationInFrames} = computeTimeline(props.manifest);
  return {durationInFrames: totalDurationInFrames};
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="P0Prev"
      component={ScenePrev}
      defaultProps={{manifest: [], scene: 'P0'}}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={meta as never}
    />
    <Composition
      id="P6Prev"
      component={ScenePrev}
      defaultProps={{manifest: [], scene: 'P6'}}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={meta as never}
    />
  </>
);

export default RemotionRoot;

registerRoot(RemotionRoot);
