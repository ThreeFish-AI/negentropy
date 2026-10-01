/** P2 口径与现算 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P2Caliber: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p2-01', 'p2-02')} name="2-A 术语卡">
        <StubShot tag="2-A 术语卡" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-03', 'p2-05')} name="2-B 两条底线">
        <StubShot tag="2-B 两条底线" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-06')} name="2-C 校验门">
        <StubShot tag="2-C 校验门" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-07', 'p2-10')} name="2-D 现算与旧账">
        <StubShot tag="2-D 现算与旧账" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-11', 'p2-13')} name="2-E 发票复印">
        <StubShot tag="2-E 发票复印" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-14', 'p2-15')} name="2-F 平均的平均">
        <StubShot tag="2-F 平均的平均" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-16')} name="2-G 半可加">
        <StubShot tag="2-G 半可加" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-18', 'p2-22')} name="2-H Ann 走查">
        <StubShot tag="2-H Ann 走查" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-23', 'p2-24')} name="2-I 拆门消融">
        <StubShot tag="2-I 拆门消融" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p2-25', 'p2-28')} name="2-J 物化与收口">
        <StubShot tag="2-J 物化与收口" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
