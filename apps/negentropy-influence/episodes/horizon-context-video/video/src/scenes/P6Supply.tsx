/** P6 供给与生态 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P6Supply: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p6-01', 'p6-02')} name="6-A 三动词">
        <StubShot tag="6-A 三动词" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-03', 'p6-05')} name="6-B 缺口">
        <StubShot tag="6-B 缺口" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-06', 'p6-07')} name="6-C 隐式轨">
        <StubShot tag="6-C 隐式轨" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-08', 'p6-09')} name="6-D 冲突裁决">
        <StubShot tag="6-D 冲突裁决" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-10', 'p6-11')} name="6-E 拆给热度">
        <StubShot tag="6-E 拆给热度" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-12')} name="6-F 检索">
        <StubShot tag="6-F 检索" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-13', 'p6-15')} name="6-G 出口三路">
        <StubShot tag="6-G 出口三路" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p6-16', 'p6-18')} name="6-H 演进">
        <StubShot tag="6-H 演进" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
