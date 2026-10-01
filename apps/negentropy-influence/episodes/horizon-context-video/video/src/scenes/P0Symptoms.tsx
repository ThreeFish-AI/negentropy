/** P0 三个症状一个病根 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P0Symptoms: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p0-01')} name="0-A 对峙">
        <StubShot tag="0-A 对峙" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-02', 'p0-03')} name="0-B 两个数">
        <StubShot tag="0-B 两个数" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-04', 'p0-05')} name="0-C 归因">
        <StubShot tag="0-C 归因" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-06', 'p0-07')} name="0-D 裸问">
        <StubShot tag="0-D 裸问" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-08', 'p0-09')} name="0-E 密码列">
        <StubShot tag="0-E 密码列" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-10', 'p0-12')} name="0-F 穿透">
        <StubShot tag="0-F 穿透" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-13')} name="0-G 病历">
        <StubShot tag="0-G 病历" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p0-14', 'p0-16')} name="0-H 定位">
        <StubShot tag="0-H 定位" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
