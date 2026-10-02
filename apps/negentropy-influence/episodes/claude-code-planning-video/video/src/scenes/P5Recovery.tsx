/** P5 断了分类自愈（p5-01..p5-22，8 镜）——分镜 5-A…5-H。
 *  挂点⑤回照（pc2-triage-map triage-mount，分诊口包住调用步）→ 修打印机意象三拍
 *  （原生，失配句角标）→ 三路径逐章（triage-trunc / triage-overflow / triage-transient）
 *  → 三连等标尺（pc2-backoff-scale backoff-seq，跨图背靠背 lead={false}）→
 *  双序列+抖动（backoff-jitter）→ 账本三章（pc2-recovery-ledger）→ 五挂点齐亮收拢。
 *  空间契约：分诊口=本集新增唯一角色席；账本红侧「拆掉」绿侧「在位」。
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

export const P5Recovery: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-06');
  const bC = w('p5-07', 'p5-09');
  const bD = w('p5-10', 'p5-10b');
  const bE = w('p5-11', 'p5-12');
  const bF = w('p5-13', 'p5-16b');
  const bG = w('p5-17', 'p5-21');
  const bH = w('p5-22', 'p5-22');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="5-A 分诊口回照">
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" cues={[
          {chapterId: 'triage-mount', at: at('p5-01') - bA.from, durationInFrames: dur('p5-01') + dur('p5-02') + dur('p5-03')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="5-B 修打印机三拍">
        {/* TODO(实装): 换墨盒/抽纸/换备用机；失配句角标「记账无对应，回工程术语」 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.core}>{'修打印机意象三拍（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>

      <Sequence {...bC} name="5-C 路径一截断">
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" cues={[
          {chapterId: 'triage-trunc', at: at('p5-07') - bC.from, durationInFrames: dur('p5-07') + dur('p5-08') + dur('p5-09')},
        ]} />
      </Sequence>

      <Sequence {...bD} name="5-D 路径二超限">
        {/* 同图跨镜背靠背：lead={false} */}
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" lead={false} cues={[
          {chapterId: 'triage-overflow', at: at('p5-10') - bD.from, durationInFrames: dur('p5-10') + dur('p5-10b')},
        ]} />
      </Sequence>

      <Sequence {...bE} name="5-E 瞬态与三连等">
        {/* 跨图背靠背（triage-transient → backoff-seq）：次图 lead={false}，两实例接力 */}
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" cues={[
          {chapterId: 'triage-transient', at: at('p5-11') - bE.from, durationInFrames: dur('p5-11')},
        ]} />
        <ArchifyRecap slug="pc2-backoff-scale" caption="退避标尺" lead={false} cues={[
          {chapterId: 'backoff-seq', at: at('p5-12') - bE.from, durationInFrames: dur('p5-12')},
        ]} />
      </Sequence>

      <Sequence {...bF} name="5-F 双序列与抖动">
        <ArchifyRecap slug="pc2-backoff-scale" caption="退避标尺" cues={[
          {chapterId: 'backoff-jitter', at: at('p5-13') - bF.from, durationInFrames: dur('p5-13') + dur('p5-14') + dur('p5-15') + dur('p5-16') + dur('p5-16b')},
        ]} />
      </Sequence>

      <Sequence {...bG} name="5-G 账本三章">
        <ArchifyRecap slug="pc2-recovery-ledger" caption="恢复账本" cues={[
          {chapterId: 'ledger-book', at: at('p5-17') - bG.from, durationInFrames: dur('p5-17') + dur('p5-18')},
          {chapterId: 'ledger-ablation', at: at('p5-19') - bG.from, durationInFrames: dur('p5-19') + dur('p5-20')},
          {chapterId: 'ledger-ruling', at: at('p5-21') - bG.from, durationInFrames: dur('p5-21')},
        ]} />
      </Sequence>

      <Sequence {...bH} name="5-H 五挂点齐亮">
        {/* TODO(实装): 五挂点齐亮全景缩略收拢（@breathe） */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.mech}>{'五挂点齐亮收拢（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
