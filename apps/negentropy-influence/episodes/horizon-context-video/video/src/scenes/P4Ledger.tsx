/** P4 背书与血缘 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P4Ledger: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p4-01', 'p4-02')} name="4-A 失效面">
        <StubShot tag="4-A 失效面" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-04', 'p4-05')} name="4-B 核准题库">
        <StubShot tag="4-B 核准题库" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-06', 'p4-08')} name="4-C 命中短路">
        <StubShot tag="4-C 命中短路" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-09', 'p4-10')} name="4-D 对账走查">
        <StubShot tag="4-D 对账走查" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-11', 'p4-14')} name="4-E 三条出路">
        <StubShot tag="4-E 三条出路" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-15', 'p4-17')} name="4-F 血缘账本">
        <StubShot tag="4-F 血缘账本" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-17b', 'p4-19')} name="4-G 三道闸">
        <StubShot tag="4-G 三道闸" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p4-20', 'p4-22')} name="4-H 拆闸消融">
        <StubShot tag="4-H 拆闸消融" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
