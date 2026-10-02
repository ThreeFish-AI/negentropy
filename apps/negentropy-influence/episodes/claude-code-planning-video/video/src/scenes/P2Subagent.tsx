/** P2 大过程挪出去（p2-01..p2-20，6 镜）——分镜 2-A…2-F。
 *  挂点②回照（panorama pan-m2）→ 主/副台分屏+回执飞回（原生）→ 外包顾问意象三拍
 *  （原生，失配句角标）→ 三不+防线+回退（pc2-sub-guard 三章接力）→ 走查/回执/对比
 *  （pc2-sub-lanes 三章接力）→ 副台收拢钩 P3。
 *  空间契约：主台面左、副台右；消融对比绿上红下；「桌子」一词禁用（角色台账防撞）。
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

export const P2Subagent: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-05');
  const bC = w('p2-06', 'p2-08');
  const bD = w('p2-09', 'p2-14b');
  const bE = w('p2-15', 'p2-19');
  const bF = w('p2-20', 'p2-20');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 挂点②回照">
        <ArchifyRecap slug="pc2-panorama" caption="挂点② · 副台派单" cues={[
          {chapterId: 'pan-m2', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01') + dur('p2-02') + dur('p2-03')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="2-B 副台分屏">
        {/* TODO(实装): 主/副台分屏，副台自开消息列表自跑循环，末尾撕一页回执飞回主线 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.mech}>{'副台分屏 + 回执飞回（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>

      <Sequence {...bC} name="2-C 外包顾问三拍">
        {/* TODO(实装): 自带笔记本/只交一页结论；门禁卡+共享盘高亮；失配句角标「类比到此为止」 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.core}>{'外包顾问意象三拍（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>

      <Sequence {...bD} name="2-D 三不·防线·回退">
        {/* 三章接力：首章锚 p2-09，后两章随句推进（p2-12 / p2-14b） */}
        <ArchifyRecap slug="pc2-sub-guard" caption="副台的防线" cues={[
          {chapterId: 'guard-three', at: at('p2-09') - bD.from, durationInFrames: dur('p2-09') + dur('p2-10') + dur('p2-11')},
          {chapterId: 'guard-notask', at: at('p2-12') - bD.from, durationInFrames: dur('p2-12') + dur('p2-13') + dur('p2-14')},
          {chapterId: 'guard-fallback', at: at('p2-14b') - bD.from, durationInFrames: dur('p2-14b')},
        ]} />
      </Sequence>

      <Sequence {...bE} name="2-E 走查·回执·对比">
        {/* 跨镜背靠背：本章首章前 p2-15 为空窗句回落；三章随句接力 */}
        <ArchifyRecap slug="pc2-sub-lanes" caption="主线与副台" cues={[
          {chapterId: 'lanes-walk', at: at('p2-15') - bE.from, durationInFrames: dur('p2-15') + dur('p2-16')},
          {chapterId: 'lanes-receipt', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
          {chapterId: 'lanes-contrast', at: at('p2-18') - bE.from, durationInFrames: dur('p2-18') + dur('p2-19')},
        ]} />
      </Sequence>

      <Sequence {...bF} name="2-F 收拢钩 P3">
        {/* TODO(实装): 副台收拢回全景挂点② + 抽屉格预告 P3 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.mechDeep}>{'收拢 + 抽屉预告（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
