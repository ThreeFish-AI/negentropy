/** P5 断了分类自愈（p5-01..p5-22，8 镜）——分镜 5-A…5-H。
 *  挂点⑤回照（pc2-triage-map triage-mount，分诊口包住调用步）→ 修打印机意象三拍
 *  （原生，失配句角标）→ 三路径逐章（triage-trunc / triage-overflow / triage-transient）
 *  → 三连等标尺（pc2-backoff-scale backoff-seq，跨图背靠背 lead={false}）→
 *  双序列+抖动（backoff-jitter）→ 账本三章（pc2-recovery-ledger）→ 五挂点齐亮收拢。
 *  空间契约：分诊口=本集新增唯一角色席；账本红侧「拆掉」绿侧「在位」。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {HoldRevive} from '../components/HoldRevive';
import {DUR, useProgress, useStagger} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 5-B 修打印机三拍：没墨换墨盒 / 卡纸抽纸 / 断电换备用机——登记表类比带失配句角标。
 *  锚位对齐口播（p5-04 三例并念 → stagger(3)；红叉条=p5-05 关键词化「断电 ≠ 猛按」——
 *  画面纪律禁逐字复述口播（RSI-007）；类比边界条=p5-06 关键词对）。 */
const PrinterAnalogy: React.FC<{at04: number; at05: number; at06: number}> = ({at04, at05, at06}) => {
  const cases = useStagger(3, {at: at04, dur: DUR.f4, stride: DUR.f3});
  const noBlind = useProgress(at05, DUR.f5);
  const edge = useProgress(at06, DUR.f5);
  const rows = [
    {sym: '没墨', fix: '换墨盒', color: 'mech'},
    {sym: '卡纸', fix: '抽纸', color: 'mech'},
    {sym: '断电×N', fix: '备用机', color: 'danger'},
  ] as const;
  const tone = (k: string) => (k === 'danger' ? theme.danger : k === 'mech' ? theme.mech : theme.dim);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 480, top: 250, width: 960}}>
        {rows.map((r, i) => {
          const vis = cases[i] ?? 0;
          return (
            <div
              key={r.sym}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                padding: '22px 32px',
                marginBottom: 18,
                borderRadius: 12,
                background: theme.panel,
                border: `1px solid ${i === 2 ? `${theme.danger}88` : theme.panelBorder}`,
                opacity: vis,
                transform: `translateX(${(1 - vis) * -24}px)`,
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 28, color: tone(r.color), width: 190}}>
                {r.sym}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>→</div>
              <div style={{fontFamily: theme.serif, fontSize: 28, color: theme.text}}>{r.fix}</div>
            </div>
          );
        })}
        {/* 拍三：不盲按——对着断电猛按打印键打红叉 */}
        <div
          style={{
            marginTop: 14,
            padding: '16px 32px',
            borderRadius: 12,
            border: `1px dashed ${theme.danger}aa`,
            opacity: noBlind,
            fontFamily: theme.sans,
            fontSize: 23,
            color: theme.danger,
            textAlign: 'center',
          }}
        >
          {'断电 ≠ 猛按'}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 170,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 19,
          color: theme.dim,
          letterSpacing: 2,
          opacity: edge,
        }}
      >
        {'类比边界 · 人分诊 ↔ 代码分诊；记账回工程术语'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-H 装置：五挂点齐亮收拢——五个 mech 光点在循环环上错相呼吸（@breathe，分镜 5-H） */
const AllMountsLit: React.FC<{span: number}> = ({span}) => {
  const t = useProgress(Math.round(span * 0.3), 22);
  const frame = useCurrentFrame();
  const breathe = (i: number) => 0.5 + 0.5 * Math.sin((frame / 21) * Math.PI + (i * Math.PI * 2) / 5);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 960, top: 420}}>
        {/* 循环环（core 恒定锚） */}
        <div style={{position: 'absolute', left: -130, top: -130, width: 260, height: 260, borderRadius: 130, border: `2.5px solid ${theme.core}`}} />
        {[0, 72, 144, 216, 288].map((deg, i) => {
          const r = (deg * Math.PI) / 180;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: Math.cos(r) * 130 - 11,
                top: Math.sin(r) * 130 - 11,
                width: 22,
                height: 22,
                borderRadius: 11,
                background: theme.mech,
                boxShadow: `0 0 ${12 + 9 * breathe(i)}px ${theme.mech}`,
                opacity: (0.35 + 0.65 * t) * (0.7 + 0.3 * breathe(i)),
              }}
            />
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, top: 640, width: 1920, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: t}}>
        {'五挂点 · 齐'}
      </div>
    </AbsoluteFill>
  );
};


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
        <PrinterAnalogy at04={0} at05={at('p5-05') - bB.from} at06={at('p5-06') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="5-C 路径一截断">
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" cues={[
          {chapterId: 'triage-trunc', at: at('p5-07') - bC.from, durationInFrames: dur('p5-07') + dur('p5-08') + dur('p5-09')},
        ]} />
        <HoldRevive at={at('p5-07') - bC.from + 98} points={['截断 · 首次不存半截', '上限 8K → 64K · 重发', '再截 · 存半截 · 三次封顶']} />
      </Sequence>

      <Sequence {...bD} name="5-D 路径二超限">
        {/* 同图跨镜背靠背：lead={false} */}
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" lead={false} cues={[
          {chapterId: 'triage-overflow', at: at('p5-10') - bD.from, durationInFrames: dur('p5-10') + dur('p5-10b')},
        ]} />
        <HoldRevive at={at('p5-10') - bD.from + 97} points={['超限 · 压缩留五条 · 一次', '再超 · 到此为止']} />
      </Sequence>

      <Sequence {...bE} name="5-E 瞬态与三连等">
        {/* 同图跨镜背靠背（5-D 尾→本章首章）+ 跨图接力（triage→backoff）：两实例均 lead={false} */}
        <ArchifyRecap slug="pc2-triage-map" caption="分诊地图" lead={false} cues={[
          {chapterId: 'triage-transient', at: at('p5-11') - bE.from, durationInFrames: dur('p5-11')},
        ]} />
        <ArchifyRecap slug="pc2-backoff-scale" caption="退避标尺" lead={false} cues={[
          {chapterId: 'backoff-seq', at: at('p5-12') - bE.from, durationInFrames: dur('p5-12')},
        ]} />
      </Sequence>

      <Sequence {...bF} name="5-F 双序列与抖动">
        {/* 同图跨镜背靠背（5-E backoff-seq 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-backoff-scale" caption="退避标尺" lead={false} cues={[
          {chapterId: 'backoff-jitter', at: at('p5-13') - bF.from, durationInFrames: dur('p5-13') + dur('p5-14') + dur('p5-15') + dur('p5-16') + dur('p5-16b')},
        ]} />
      </Sequence>

      <Sequence {...bG} name="5-G 账本三章">
        {/* 跨图背靠背（5-F 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-recovery-ledger" caption="恢复账本" lead={false} cues={[
          {chapterId: 'ledger-book', at: at('p5-17') - bG.from, durationInFrames: dur('p5-17') + dur('p5-18')},
          {chapterId: 'ledger-ablation', at: at('p5-19') - bG.from, durationInFrames: dur('p5-19') + dur('p5-20')},
          {chapterId: 'ledger-ruling', at: at('p5-21') - bG.from, durationInFrames: dur('p5-21'), fit: 'trim'},
        ]} />
        <HoldRevive at={at('p5-19') - bG.from + 125} points={['有记账 · 一次止损', '拆记账 · 反复压 8 次']} />
      </Sequence>

      <Sequence {...bH} name="5-H 五挂点齐亮">
        <AllMountsLit span={bH.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
