/** P3 规则与执法 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P3Policy: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p3-01')} name="3-A 谁可见">
        <StubShot tag="3-A 谁可见" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-02')} name="3-B 术语四连">
        <StubShot tag="3-B 术语四连" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-03', 'p3-04')} name="3-C 挂载位置">
        <StubShot tag="3-C 挂载位置" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-05', 'p3-06')} name="3-D 两细节">
        <StubShot tag="3-D 两细节" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-07', 'p3-09')} name="3-E Agent 开关">
        <StubShot tag="3-E Agent 开关" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-10', 'p3-12')} name="3-F 走查">
        <StubShot tag="3-F 走查" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-13', 'p3-14')} name="3-G 拆执行层">
        <StubShot tag="3-G 拆执行层" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-15', 'p3-17')} name="3-H 执法位置">
        <StubShot tag="3-H 执法位置" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-18', 'p3-19')} name="3-I 双层防线">
        <StubShot tag="3-I 双层防线" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p3-20', 'p3-21')} name="3-J 规律金句">
        <StubShot tag="3-J 规律金句" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
