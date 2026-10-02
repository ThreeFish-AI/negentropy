/** P3 知识按需进场（p3-01..p3-19，5 镜）——分镜 3-A…3-E。
 *  挂点③回照（panorama pan-m3）→ 两级结构与成本（pc2-skill-levels 两章）→
 *  SQL 规范走查（原生：标签常驻垫纸 + 点名后手册抽出经工具结果进场）→
 *  两种命运（levels-lifecycle）→ 消融与结论（pc2-skill-cost 两章）。
 *  空间契约：抽屉标签=卡片系（不得与工序卡/扉页目录撞名）；token 数字带估算口径角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';

const BADGE_STYLE: React.CSSProperties = {top: 64};

export const P3Skills: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-07');
  const bC = w('p3-08', 'p3-11');
  const bD = w('p3-12', 'p3-14c');
  const bE = w('p3-15', 'p3-19');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 挂点③回照">
        <ArchifyRecap slug="pc2-panorama" caption="挂点③ · 技能进场" cues={[
          {chapterId: 'pan-m3', at: at('p3-01') - bA.from, durationInFrames: dur('p3-01') + dur('p3-02') + dur('p3-03')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="3-B 两级与成本">
        <ArchifyRecap slug="pc2-skill-levels" caption="技能两级" cues={[
          {chapterId: 'levels-two', at: at('p3-04') - bB.from, durationInFrames: dur('p3-04') + dur('p3-05') + dur('p3-06')},
          {chapterId: 'levels-cost', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
        ]} />
      </Sequence>

      <Sequence {...bC} name="3-C 规范走查">
        {/* TODO(实装): 标签常驻垫纸 + 点名后手册抽出经工具结果落进消息流（角标 load_skill） */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.mech}>{'SQL 规范走查（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>

      <Sequence {...bD} name="3-D 两种命运">
        <ArchifyRecap slug="pc2-skill-levels" caption="技能两级" cues={[
          {chapterId: 'levels-lifecycle', at: at('p3-12') - bD.from, durationInFrames: dur('p3-12') + dur('p3-13') + dur('p3-14') + dur('p3-14b') + dur('p3-14c')},
        ]} />
      </Sequence>

      <Sequence {...bE} name="3-E 消融与结论">
        <ArchifyRecap slug="pc2-skill-cost" caption="拆掉两级" cues={[
          {chapterId: 'cost-ablation', at: at('p3-15') - bE.from, durationInFrames: dur('p3-15') + dur('p3-16') + dur('p3-17')},
          {chapterId: 'cost-ruling', at: at('p3-18') - bE.from, durationInFrames: dur('p3-18') + dur('p3-19')},
        ]} />
      </Sequence>
    </AbsoluteFill>
  );
};
