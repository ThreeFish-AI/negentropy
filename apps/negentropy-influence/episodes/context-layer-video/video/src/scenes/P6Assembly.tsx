/** P6 总装与路线（p6-01..26）——评测 / 治理织物总装 / 十格试金石 / 双轨路线 / 理性收尾。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useFadeOut, useImpulse, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, PillarHUD} from '../components/devices';

/** 6-A 评测考场：考题卡四类 + KPI 金句。 */
const ExamDeck: React.FC<{at: number; kpiAt: number; warnAt: number}> = ({at, kpiAt, warnAt}) => {
  const cards = useStagger(4, {at, stride: 8, dur: DUR.f5});
  const kpi = useStagger(1, {at: kpiAt, dur: DUR.f6});
  const warn = useImpulse({at: warnAt, dur: DUR.f6});
  const cases = [
    {t: '歧义题', d: '「活跃」到底指什么', ok: true},
    {t: '隐晦连接题', d: '绕三张表才够得着', ok: true},
    {t: '空结果题', d: '无答案时如何自处', ok: true},
    {t: '越权题', d: '期望 = 拒绝 + 审计', ok: false},
  ];
  return (
    <div>
      <div style={{display: 'flex', gap: 30, justifyContent: 'center', paddingTop: 110}}>
        {cases.map((c, i) => (
          <div key={c.t} style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 18}px)`, width: 280, padding: '20px 22px', borderRadius: 12, border: `2px solid ${c.ok ? theme.panelBorder : theme.danger}`, background: c.ok ? theme.panel : `${theme.danger}0E`}}>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: c.ok ? theme.text : theme.danger}}>{c.t}</div>
            <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 6}}>{c.d}</div>
          </div>
        ))}
      </div>
      <div style={{opacity: kpi[0], marginTop: 70, textAlign: 'center', fontFamily: theme.serif, fontSize: 38, color: theme.text, letterSpacing: 3}}>
        报错优于错数
      </div>
      <div style={{marginTop: 26, textAlign: 'center', opacity: warn, fontFamily: theme.mono, fontSize: 17, color: theme.danger}}>
        ⚠ 考题库自己也会错 · Spider2-Snow 错标 62.8%（CIDR 论文口径）
      </div>
    </div>
  );
};

/** 6-C 十格破坏实验仪表盘。 */
const TeardownDash: React.FC<{at: number; lastAt: number}> = ({at, lastAt}) => {
  const cells = useStagger(10, {at, stride: 6, dur: DUR.f4});
  const last = useImpulse({at: lastAt, dur: DUR.f6});
  const exps = [
    {id: 'D1', v: '440 vs 200'},
    {id: 'D2', v: '[6,1,2]'},
    {id: 'D3', v: '[11,6,7]'},
    {id: 'D4', v: '错口径胜'},
    {id: 'D5', v: 'intern 泄露'},
    {id: 'D6', v: '垃圾入库'},
    {id: 'D7', v: '122 vs 108'},
    {id: 'D8', v: 'ghost 入账'},
    {id: 'D9', v: '越权窗口'},
    {id: 'D10', v: '明文出楼'},
  ];
  return (
    <div style={{width: 1120, margin: '90px auto 0'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18}}>
        {exps.map((e, i) => (
          <div
            key={e.id}
            style={{
              opacity: cells[i],
              padding: '16px 14px',
              borderRadius: 10,
              border: `1px solid ${i === 9 ? theme.danger : theme.panelBorder}`,
              background: i === 9 ? `${theme.danger}12` : theme.panel,
              textAlign: 'center',
              boxShadow: i === 9 ? `0 0 ${16 * last}px ${theme.danger}55` : 'none',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.text}}>{e.id}</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.danger, marginTop: 4}}>{e.v}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 60, textAlign: 'center', fontFamily: theme.serif, fontSize: 30, color: theme.text}}>
        单拎出来都不神奇，拆掉任何一个都有具体的坏法
      </div>
      <div style={{marginTop: 8, textAlign: 'center', fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>
        —— 工程组合创新的试金石
      </div>
    </div>
  );
};

/** 6-E 收尾：金句 + 信源卡 + 渐黑。 */
const EndingCard: React.FC<{at: number; fadeDur: number}> = ({at, fadeDur}) => {
  const lines = useStagger(5, {at, stride: 10, dur: DUR.f5});
  const out = useFadeOut(fadeDur, {frames: 90});
  const src = [
    '信源 · 钉定提交 6f643c216dee',
    '013 Context Layer 蓝图（重铸版）',
    '011 Horizon Context 精读笔记（冻结）',
    '原型 horizon_context_lab.py / _mcp.py · selftest 全绿',
    '工程图 · archify 12 图 70 章逐章回放',
  ];
  return (
    <AbsoluteFill style={{opacity: out, background: '#0E1116'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', fontFamily: theme.serif, fontSize: 44, color: theme.text}}>
        含义被治理好之前
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 320, textAlign: 'center', fontFamily: theme.serif, fontSize: 44, color: theme.blueprint}}>
        AI 的聪明都是租来的
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
        {src.map((s, i) => (
          <div key={s} style={{opacity: lines[i] * 0.85, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
            {s}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const P6Assembly: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-07');
  const bB = w('p6-08', 'p6-11b');
  const bC = w('p6-12', 'p6-17');
  const bD = w('p6-18', 'p6-21');
  const bE = w('p6-22', 'p6-24');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 评测考场">
        <SceneTag chapter="P6" tagline="总装与路线" accent={theme.grown} />
        <ExamDeck at={at('p6-03') - bA.from} kpiAt={at('p6-05') - bA.from} warnAt={at('p6-07') - bA.from} />
        <EvidenceBadge grade="thirdparty" />
        <PillarHUD lit={5} at={-30} />
      </Sequence>

      <Sequence {...bB} name="6-B 总装与缝合">
        <SceneTag chapter="P6" tagline="总装与路线" accent={theme.blueprint} />
        <ArchifyRecap
          slug="runtime-layering"
          caption="运行时分层 · 五子系统"
          cues={[
            {chapterId: 'memkb', at: at('p6-10') - bB.from, durationInFrames: dur('p6-10')},
          ]}
        />
        <ArchifyRecap
          slug="request-injection"
          caption="请求期注入现状"
          lead={false}
          cues={[{chapterId: 'tables', at: at('p6-11') - bB.from, durationInFrames: dur('p6-11')}]}
        />
        <ArchifyRecap
          slug="auto-channel"
          caption="双通道现状缺口"
          lead={false}
          cues={[{chapterId: 'auto', at: at('p6-11a') - bB.from, durationInFrames: dur('p6-11a')}]}
        />
        <ArchifyRecap
          slug="assembler-planner"
          caption="增量缝合方案"
          lead={false}
          cues={[{chapterId: 'grounding', at: at('p6-11b') - bB.from, durationInFrames: dur('p6-11b')}]}
        />
        <PillarHUD lit={5} at={-30} />
      </Sequence>

      <Sequence {...bC} name="6-C 十格试金石">
        <SceneTag chapter="P6" tagline="总装与路线" accent={theme.danger} />
        <TeardownDash at={at('p6-12') - bC.from} lastAt={at('p6-17') - bC.from} />
        <PillarHUD lit={5} at={-30} />
      </Sequence>

      <Sequence {...bD} name="6-D 双轨路线">
        <SceneTag chapter="P6" tagline="总装与路线" accent={theme.grown} />
        <ArchifyRecap
          slug="dual-track-roadmap"
          caption="样板间 × 本楼改造"
          cues={[
            {chapterId: 'design', at: at('p6-18') - bD.from, durationInFrames: dur('p6-18')},
            {chapterId: 'p0', at: at('p6-19') - bD.from, durationInFrames: dur('p6-19')},
            {chapterId: 'ph23', at: at('p6-21') - bD.from, durationInFrames: dur('p6-21')},
          ]}
        />
        <ArchifyRecap
          slug="evolution-levers"
          caption="第 7 杠杆 · 带开关"
          lead={false}
          cues={[{chapterId: 'seventh', at: at('p6-20') - bD.from, durationInFrames: dur('p6-20')}]}
        />
        <ArchifyYield
          cues={[
            {at: at('p6-18') - bD.from, durationInFrames: dur('p6-18')},
            {at: at('p6-19') - bD.from, durationInFrames: dur('p6-19')},
            {at: at('p6-20') - bD.from, durationInFrames: dur('p6-20')},
            {at: at('p6-21') - bD.from, durationInFrames: dur('p6-21')},
          ]}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, color: theme.danger}}>
            Phase 1–3 均在路线图上 · 未实现
          </div>
        </ArchifyYield>
        <PillarHUD lit={5} at={-30} />
      </Sequence>

      <Sequence {...bE} name="6-E 收尾与渐黑">
        <SceneTag chapter="P6" tagline="总装与路线" accent={theme.blueprint} />
        <EndingCard at={at('p6-22') - bE.from} fadeDur={bE.durationInFrames} />
        <PillarHUD lit={5} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
