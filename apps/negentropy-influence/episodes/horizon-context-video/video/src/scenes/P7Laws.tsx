/** P7 规律与边界 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P7Laws: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p7-01', 'p7-02')} name="7-A 冷水">
        <StubShot tag="7-A 冷水" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-03')} name="7-B 读表纪律">
        <StubShot tag="7-B 读表纪律" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-04', 'p7-06')} name="7-C 治理≠验证">
        <StubShot tag="7-C 治理≠验证" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-07', 'p7-08')} name="7-D 玩具复现">
        <StubShot tag="7-D 玩具复现" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-10', 'p7-12b')} name="7-E 边界">
        <StubShot tag="7-E 边界" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-13', 'p7-16')} name="7-F 五规律">
        <StubShot tag="7-F 五规律" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-17', 'p7-18')} name="7-G 自测三问">
        <StubShot tag="7-G 自测三问" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p7-19')} name="7-H 收尾">
        <StubShot tag="7-H 收尾" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
