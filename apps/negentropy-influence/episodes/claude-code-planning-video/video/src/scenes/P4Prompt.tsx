/** P4 指令按实况拼装（p4-01..p4-21，7 镜）——分镜 4-A…4-G。
 *  挂点④回照（panorama pan-m4）→ 每日菜单意象三拍（原生，失配句角标）→
 *  货架三章（pc2-prompt-shelf）→ 走查命中（pc2-prompt-cache cache-hit）→
 *  拼串做键（cache-fingerprint）→ 键污染消融（cache-dirty）→ 两层缓存双栏收尾（原生）。
 *  空间契约：菜单意象不覆盖分段维护（失配句在场）；双层缓存图本地层左、服务端层右。
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

export const P4Prompt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-06');
  const bC = w('p4-07', 'p4-09b');
  const bD = w('p4-10', 'p4-13');
  const bE = w('p4-14', 'p4-15');
  const bF = w('p4-16', 'p4-19');
  const bG = w('p4-20', 'p4-21');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 挂点④回照">
        <ArchifyRecap slug="pc2-panorama" caption="挂点④ · 指令组装" cues={[
          {chapterId: 'pan-m4', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01') + dur('p4-02') + dur('p4-03')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="4-B 每日菜单三拍">
        {/* TODO(实装): 招牌菜恒印/时令菜看货/昨天那页复用（=缓存）；失配句角标 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.core}>{'每日菜单意象三拍（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>

      <Sequence {...bC} name="4-C 货架三章">
        <ArchifyRecap slug="pc2-prompt-shelf" caption="垫纸的拼法" cues={[
          {chapterId: 'shelf-sections', at: at('p4-07') - bC.from, durationInFrames: dur('p4-07')},
          {chapterId: 'shelf-state', at: at('p4-08') - bC.from, durationInFrames: dur('p4-08') + dur('p4-09')},
          {chapterId: 'shelf-split', at: at('p4-09b') - bC.from, durationInFrames: dur('p4-09b')},
        ]} />
      </Sequence>

      <Sequence {...bD} name="4-D 走查命中">
        <ArchifyRecap slug="pc2-prompt-cache" caption="缓存键" cues={[
          {chapterId: 'cache-hit', at: at('p4-10') - bD.from, durationInFrames: dur('p4-10') + dur('p4-11') + dur('p4-12') + dur('p4-13')},
        ]} />
      </Sequence>

      <Sequence {...bE} name="4-E 拼串做键">
        {/* 跨镜背靠背（4-D 尾章→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-prompt-cache" caption="缓存键" lead={false} cues={[
          {chapterId: 'cache-fingerprint', at: at('p4-14') - bE.from, durationInFrames: dur('p4-14') + dur('p4-15')},
        ]} />
      </Sequence>

      <Sequence {...bF} name="4-F 键污染消融">
        <ArchifyRecap slug="pc2-prompt-cache" caption="缓存键" cues={[
          {chapterId: 'cache-dirty', at: at('p4-16') - bF.from, durationInFrames: dur('p4-16') + dur('p4-17') + dur('p4-18') + dur('p4-19')},
        ]} />
      </Sequence>

      <Sequence {...bG} name="4-G 两层缓存双栏">
        {/* TODO(实装): 本地拼串层 vs 服务端前缀层「开头不变按开头复用」双栏，钩 P5 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.mechDeep}>{'两层缓存双栏 + 钩 P5（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
