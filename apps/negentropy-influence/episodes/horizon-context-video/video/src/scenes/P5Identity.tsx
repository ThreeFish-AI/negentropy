/** P5 身份与纳管 · 场景桩（Stage ⑥ 收口解堵 tsc/规则 6；全量实现按 storyboard v3 镜号替换） */
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

export const P5Identity: React.FC<{ scene: SceneRange }> = ({ scene }) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p5-01', 'p5-03')} name="5-A 假设改写">
        <StubShot tag="5-A 假设改写" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-04', 'p5-05')} name="5-B 识别">
        <StubShot tag="5-B 识别" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-06', 'p5-07')} name="5-C 天花板">
        <StubShot tag="5-C 天花板" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-08', 'p5-09')} name="5-D 交集">
        <StubShot tag="5-D 交集" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-10', 'p5-11')} name="5-E 时间线走查">
        <StubShot tag="5-E 时间线走查" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-12', 'p5-14')} name="5-F 拆天花板">
        <StubShot tag="5-F 拆天花板" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-15', 'p5-16')} name="5-G 焦虑">
        <StubShot tag="5-G 焦虑" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-17', 'p5-18')} name="5-H 四步纳管">
        <StubShot tag="5-H 四步纳管" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-19', 'p5-20')} name="5-I 映射闸">
        <StubShot tag="5-I 映射闸" color={theme.concept} />
      </Sequence>
      <Sequence {...w('p5-21', 'p5-23')} name="5-J 拆映射">
        <StubShot tag="5-J 拆映射" color={theme.concept} />
      </Sequence>    </AbsoluteFill>
  );
};
