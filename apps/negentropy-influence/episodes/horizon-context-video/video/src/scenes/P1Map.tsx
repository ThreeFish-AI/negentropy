/** P1 七机制地图 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import type {SceneRange} from '../types';

const StubShot: React.FC<{ tag: string; color: string }> = ({ tag, color }) => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', top: 56 }}>
    <div style={{ color, fontFamily: theme.sans, fontSize: 44, opacity: 0.85 }}>{tag}</div>
  </AbsoluteFill>
);

export const P1Map: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p1-01', 'p1-03')} name="1-A 四层信号">
        <StubShot tag="1-A 四层信号" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p1-04', 'p1-05')} name="1-B 八层栈">
        <StubShot tag="1-B 八层栈" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p1-06', 'p1-07')} name="1-C 承重七件">
        <StubShot tag="1-C 承重七件" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p1-08', 'p1-10')} name="1-D 拆解宣言">
        <StubShot tag="1-D 拆解宣言" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
