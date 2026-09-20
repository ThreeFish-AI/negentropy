/** P4 盖章底稿＝M4（应答层验证锚定）+ 全楼台账＝M5（端到端列级血缘）。
 *  M4 与 M1 正交：**手册完全正确，模型仍可能按错的那一页算**。
 *  W6 起 4-A/4-B/4-D/4-E/4-F 全句由 archify 图主控（WrongPage/StampedAnswer/
 *  PipeLedger/ThreeGates+代码走廊③/探照灯卡 退役），自制件仅存 4-C HalfWall、
 *  4-G 四方印鉴与 PillarHUD/EvidenceBadge。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useProgress} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, PillarHUD, Stage} from '../components/devices';

/** 4-C 半堵墙：验证缺口只砌了一半 */
const HalfWall: React.FC = () => {
  const build = useProgress(4, DUR.f6);
  const brick = (filled: boolean, i: number) => (
    <div
      key={i}
      style={{
        width: 118,
        height: 44,
        borderRadius: 4,
        border: `2px ${filled ? 'solid' : 'dashed'} ${filled ? theme.manual : theme.dim}`,
        background: filled ? `${theme.manual}22` : 'transparent',
        opacity: filled ? build : 0.4,
      }}
    />
  );
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center'}}>
        <div style={{display: 'flex', gap: 8}}>{[0, 1, 2, 3].map((i) => brick(false, i))}</div>
        <div style={{display: 'flex', gap: 8}}>{[4, 5, 6, 7].map((i) => brick(false, i))}</div>
        <div style={{display: 'flex', gap: 8}}>{[8, 9, 10, 11].map((i) => brick(true, i))}</div>
        <div style={{display: 'flex', gap: 8}}>{[12, 13, 14, 15].map((i) => brick(true, i))}</div>
      </div>
      <div style={{marginTop: 24, fontFamily: theme.sans, fontSize: 32, color: theme.text}}>
        这堵验证的墙，目前<span style={{color: theme.manual}}>只砌了一半</span>
      </div>
      <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
        另一半（事后评分）是独立开关，不在这座楼里
      </div>
    </div>
  );
};

export const P4Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-09');
  const bC = w('p4-09a');
  const bD = w('p4-10', 'p4-14');
  const bE = w('p4-14a', 'p4-18');
  const bF = w('p4-19', 'p4-24');
  const bG = w('p4-25', 'p4-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 引用错手册">
        <SceneTag chapter="M4" tagline="应答层验证锚定：核准题库与盖章底稿" accent={theme.manual} />
        <ArchifyRecap
          slug="dual-challenge-fork"
          caption="落地的两个挑战"
          cues={[{chapterId: 'challenge-one', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')}]}
        />
        {/* p4-01(challenge-one)→p4-02 换图背靠背跨实例 → lead={false}；02→03 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="wrong-page-failure"
          caption="选错页失效"
          lead={false}
          cues={[
            {chapterId: 'right-book-wrong-page', at: at('p4-02') - bA.from, durationInFrames: dur('p4-02')},
            {chapterId: 'two-branches', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
          ]}
        />
        {/* p4-03→p4-04 背靠背：跨实例必须 lead={false}，否则换图重放入场弹簧 */}
        <ArchifyRecap
          slug="autopilot-loop"
          caption="自动巡航闭环"
          lead={false}
          cues={[{chapterId: 'inputs', at: at('p4-04') - bA.from, durationInFrames: dur('p4-04')}]}
        />
      </Sequence>

      <Sequence {...bB} name="4-B 盖章底稿与重算对账">
        {/* 05..09 逐句换图接力：05 紧贴 4-A 尾窗 inputs@p4-04、06/07/09 各紧贴前句 cue，
            全部跨实例背靠背 → 三实例都 lead={false} */}
        <ArchifyRecap
          slug="autopilot-loop"
          caption="自动巡航闭环"
          lead={false}
          cues={[
            {chapterId: 'valgate', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {chapterId: 'loop', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
          ]}
        />
        <ArchifyRecap
          slug="vqr-lifecycle"
          caption="核准条目的一生"
          lead={false}
          cues={[{chapterId: 'signed-stamped', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')}]}
        />
        <ArchifyRecap
          slug="resolve-activation"
          caption="应答层验证锚定"
          lead={false}
          cues={[
            {chapterId: 'hit-reconcile', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'miss-fallback', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 半堵墙">
        {/* outside-eval cue 已删（W3 cue 手术）：半堵墙装置独占本镜，payoff 句即 p4-09a */}
        <Stage>
          <HalfWall />
        </Stage>
      </Sequence>

      <Sequence {...bD} name="4-D 全楼出入库台账">
        <SceneTag chapter="M5" tagline="端到端列级血缘：全楼出入库台账" accent={theme.engine} />
        {/* challenge-two 前是 p4-09a 装置保护句（非背靠背），保留入场；其后 10→11→12→13→14
            逐句换图背靠背 → 后两实例 lead={false}（含 not-wastepaper@14 在 engine-lane@13 后重现） */}
        <ArchifyRecap
          slug="dual-challenge-fork"
          caption="落地的两个挑战"
          cues={[{chapterId: 'challenge-two', at: at('p4-10') - bD.from, durationInFrames: dur('p4-10')}]}
        />
        <ArchifyRecap
          slug="water-pipe-ledger"
          caption="全楼水管台账"
          lead={false}
          cues={[
            {chapterId: 'fifth-mechanism', at: at('p4-11') - bD.from, durationInFrames: dur('p4-11')},
            {chapterId: 'drop-to-drop', at: at('p4-12') - bD.from, durationInFrames: dur('p4-12')},
            {chapterId: 'not-wastepaper', at: at('p4-14') - bD.from, durationInFrames: dur('p4-14')},
          ]}
        />
        <ArchifyRecap
          slug="lineage-ledger"
          caption="引擎执行自动沉淀"
          lead={false}
          cues={[{chapterId: 'engine-lane', at: at('p4-13') - bD.from, durationInFrames: dur('p4-13')}]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 三道闸与代码走廊③">
        <EvidenceBadge grade="lab" />
        {/* p4-14(not-wastepaper)→p4-14a(ingest-lane) 跨镜换图背靠背、p4-14a→p4-15(fake-event)
            同理（工单点名）→ 两实例都 lead={false}；15..18 同实例连续换章由 enters 抑制 */}
        <ArchifyRecap
          slug="lineage-ledger"
          caption="OpenLineage 摄取三道闸"
          lead={false}
          cues={[{chapterId: 'ingest-lane', at: at('p4-14a') - bE.from, durationInFrames: dur('p4-14a')}]}
        />
        <ArchifyRecap
          slug="ghost-edge-pollution"
          caption="虚构流水的入账生死"
          lead={false}
          cues={[
            {chapterId: 'fake-event', at: at('p4-15') - bE.from, durationInFrames: dur('p4-15')},
            {chapterId: 'rejected', at: at('p4-16') - bE.from, durationInFrames: dur('p4-16')},
            {chapterId: 'gate-removed', at: at('p4-17') - bE.from, durationInFrames: dur('p4-17')},
            {chapterId: 'ledger-detached', at: at('p4-18') - bE.from, durationInFrames: dur('p4-18')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 逆流溯源与双柱">
        {/* 19..24 六句四图逐句换图接力：18(ledger-detached)→19 跨镜起全程背靠背
            → 四实例都 lead={false}（evolution-timeline 原有 lead={false} 保持） */}
        <ArchifyRecap
          slug="upstream-traceback"
          caption="逆流溯源三秒定位"
          lead={false}
          cues={[
            {chapterId: 'living-ledger', at: at('p4-19') - bF.from, durationInFrames: dur('p4-19')},
            {chapterId: 'three-seconds', at: at('p4-20') - bF.from, durationInFrames: dur('p4-20')},
          ]}
        />
        <ArchifyRecap
          slug="evolution-timeline"
          caption="三阶段演进"
          lead={false}
          cues={[{chapterId: 'stage-ecosystem', at: at('p4-21') - bF.from, durationInFrames: dur('p4-21')}]}
        />
        <ArchifyRecap
          slug="trust-timeline"
          caption="信任的事前事中事后"
          lead={false}
          cues={[
            {chapterId: 'before-during', at: at('p4-22') - bF.from, durationInFrames: dur('p4-22')},
            {chapterId: 'after-audit', at: at('p4-23') - bF.from, durationInFrames: dur('p4-23')},
          ]}
        />
        <ArchifyRecap
          slug="trust-assets"
          caption="双柱信任"
          lead={false}
          cues={[{chapterId: 'two-pillars', at: at('p4-24') - bF.from, durationInFrames: dur('p4-24')}]}
        />
      </Sequence>

      <Sequence {...bG} name="4-G 信任资产四方印鉴">
        {/* 模式 b：金句印鉴卡静态，纯 opacity 让位；HUD 在 wrapper 外常驻 */}
        <ArchifyYield
          cues={[
            {at: at('p4-26') - bG.from, durationInFrames: dur('p4-26')},
            {at: at('p4-28') - bG.from, durationInFrames: dur('p4-28')},
          ]}
        >
          <Stage>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 56,
                color: theme.text,
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              答错有拦截，答对有底稿，
              <br />
              <span style={{color: theme.manual}}>出了疑问随时翻账本对质</span>
            </div>
          </Stage>
        </ArchifyYield>
        <PillarHUD lit={5} at={at('p4-28') - bG.from} />
        <ArchifyRecap
          slug="trust-assets"
          caption="双柱信任"
          cues={[
            {chapterId: 'three-seals', at: at('p4-26') - bG.from, durationInFrames: dur('p4-26')},
          ]}
        />
        {/* three-seals@p4-26 与 topk@p4-28 隔 p4-27 空档，非背靠背，无需 lead={false} */}
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="四因子称重"
          cues={[
            {chapterId: 'topk', at: at('p4-28') - bG.from, durationInFrames: dur('p4-28')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
