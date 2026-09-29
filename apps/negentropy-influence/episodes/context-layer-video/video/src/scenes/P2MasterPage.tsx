/** P2 当版页制度：对象层（p2-01..p2-22，23 句；storyboard「P2 当版页制度」节）。
 *
 *  8 镜 / 5 条 archify cue：
 *   2-A 导览（装置：文档柜门）· 2-B ol-draft@04（PrintPage 锚 p2-05，cue 窗外先可见）· 2-C fan trap 装置（订单-事件连线）
 *   2-D ol-gov@13（全屏独占单句镜）· 2-E 代码走廊①（422 拒绝；CodePane 自 p2-14 起打印填半空窗）
 *   2-F ol-conflict@16→ol-full@18（前隔代码走廊，恢复入场）· 2-G ol-super@19→20（跨句扩到镜末填空窗）· 2-H 影子板收束
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {useEnter, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {WorkCard} from '../components/WorkCard';

export const P2MasterPage: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧，2-F 按 storyboard SSOT 收到 p2-18c）。镜内 cue/装置锚点
  // 一律「at(句id) - 所在镜.from」——ArchifyRecap 契约 + motion hooks 均按父 Sequence
  // 局部帧解释，漏减会双重偏移。
  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-04', 'p2-07');
  const bC = w('p2-08', 'p2-12');
  const bD = w('p2-13');
  const bE = w('p2-14', 'p2-15');
  const bF = w('p2-16', 'p2-18c');
  const bG = w('p2-19', 'p2-20');
  const bH = w('p2-21', 'p2-22');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P2" tagline="当版页制度 · 对象层" accent={theme.concept} />

      {/* 2-A 导览：受控文档库柜门开启 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="2-A">
        <VaultDoor at={at('p2-03') - bA.from} />
      </Sequence>

      {/* 2-B 当版页：打印机装置 + ol-draft */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="2-B">
        <PrintPage at={at('p2-05') - bB.from} />
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="对象 · 起草即受控" cues={[{chapterId: 'ol-draft', at: at('p2-04') - bB.from, durationInFrames: dur('p2-04')}]} />
      </Sequence>

      {/* 2-C fan trap 装置：三条事件挂上订单、金额翻倍 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="2-C">
        <FanTrap at={at('p2-10') - bC.from} />
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="filled" at={at('p2-10') - bC.from} note="对照 200 · 退化 440" />
        </div>
      </Sequence>

      {/* 2-D 锁一起：ol-gov 全屏独占（单句镜，不叠卡片层——与 cue 同窗的元素会被不透明画框罩住） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="2-D">
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="对象 · 过门受治理" cues={[{chapterId: 'ol-gov', at: at('p2-13') - bD.from, durationInFrames: dur('p2-13')}]} />
      </Sequence>

      {/* 2-E 代码走廊①：definitions 表 + 422（锚 p2-14：打印动效填掉 p2-14 半空窗，p2-14b 时四行已就位） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="2-E">
        <CodePane
          at={at('p2-14') - bE.from}
          lines={[
            'POST /interface/definitions  →  parse_definition(源文本)',
            '  ⚠ DefinitionParseError: Agent 规格缺少必填字段: name',
            '  ← HTTP 422（拒绝落库）',
            'materialize_all()  →  .agent/skills/<key>/SKILL.md（幂等投影）',
          ]}
          badge={{level: 'filled', note: '四类定义 · 一张表'}}
        />
      </Sequence>

      {/* 2-F 常驻记忆三问：档案柜 + 冲突/全生命周期（前隔 2-E 代码走廊，首章恢复入场） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="2-F">
        <CabinetQuestions at={at('p2-17') - bF.from} />
        <ArchifyRecap
          slug="blueprint--object-lifecycle"
          caption="常驻记忆 · 对象一生"
          cues={[
            {chapterId: 'ol-conflict', at: at('p2-16') - bF.from, durationInFrames: dur('p2-16')},
            {chapterId: 'ol-full', at: at('p2-18') - bF.from, durationInFrames: dur('p2-18')},
          ]}
        />
      </Sequence>

      {/* 2-G 版次随行（ol-super 跨句扩到镜末：p2-20 空窗由 hold 档末帧冻结补足） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="2-G">
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="被取代 · freshness 衰减" cues={[{chapterId: 'ol-super', at: at('p2-19') - bG.from, durationInFrames: dur('p2-19') + dur('p2-20')}]} />
      </Sequence>

      {/* 2-H 收束：影子板三标签 + 工卡第 2 格 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="2-H">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60}}>
          <div style={{display: 'flex', gap: 20}}>
            {['在册', '可查', '带版次'].map((t, i) => (
              <StampTag key={t} text={t} delay={i * 14} />
            ))}
          </div>
          <WorkCard stamps={2} totalSlots={7} highlightSlot={1} w={360} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const StampTag: React.FC<{text: string; delay: number}> = ({text, delay}) => {
  const e = useEnter('fall', {at: delay, dur: 16});
  return (
    <div style={{...e, padding: '10px 22px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 30, color: theme.ok, background: 'rgba(126,211,33,0.08)'}}>
      {text}
    </div>
  );
};

const VaultDoor: React.FC<{at: number}> = ({at}) => {
  const open = useSpring('settle', {at, dur: 40});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 420, height: 300}}>
        <div style={{position: 'absolute', inset: 0, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel}} />
        <div
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            left: 6,
            width: 200 - open * 176,
            background: theme.conceptDeep,
            opacity: 0.25,
            borderRadius: 8,
          }}
        />
        <div style={{position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 22, color: theme.dim}}>
          受控文档库 · 全公司唯一有效母本
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PrintPage: React.FC<{at: number}> = ({at}) => {
  const out = useSpring('settle', {at, dur: 50});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 300, height: 380}}>
        <div style={{position: 'absolute', top: 0, left: 20, right: 20, height: 60, background: theme.panelBorder, borderRadius: 6}} />
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 30,
            right: 30,
            height: 300 * out,
            background: '#F2F5FA',
            borderRadius: '0 0 6px 6px',
            overflow: 'hidden',
            padding: 14,
            boxSizing: 'border-box',
          }}
        >
          <div style={{fontSize: 16, color: '#171C26', lineHeight: 1.7}}>
            AMM 32-11-00
            <br />
            力矩值 45 N·m
            <br />
            <span style={{fontSize: 13, color: '#5a6472'}}>打印时刻 04:12 · 用毕即废</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FanTrap: React.FC<{at: number}> = ({at}) => {
  const grow = useSpring('settle', {at, dur: 45});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={760} height={300}>
        <rect x={40} y={40} width={190} height={64} rx={8} fill="none" stroke={theme.concept} strokeWidth={2} />
        <text x={70} y={78} fill={theme.concept} fontSize={22}>订单 $100</text>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line x1={230} y1={72} x2={400} y2={50 + i * 64} stroke={theme.conceptDeep} strokeWidth={2} />
            <rect x={400} y={20 + i * 64} width={190} height={56} rx={8} fill="none" stroke={theme.panelBorder} strokeWidth={1.5} />
            <text x={430} y={53 + i * 64} fill={theme.dim} fontSize={18}>事件 #{i + 1}</text>
          </g>
        ))}
        <line x1={590} y1={120} x2={680} y2={120} stroke={theme.conceptDeep} strokeWidth={2} />
        <text x={620} y={110} fill={theme.conceptDeep} fontSize={20}>×{Math.round(1 + grow * 2)}</text>
        <text x={300} y={280} fill={theme.conceptDeep} fontSize={26}>
          $100 → ${Math.round(100 + 200 * grow)}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

const CabinetQuestions: React.FC<{at: number}> = ({at}) => {
  const qs = useStagger(3, {stride: 30, at});
  const labels = ['谁有权写？', '写多厚？', '写满怎么办？'];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26}}>
      {labels.map((t, i) => (
        <div
          key={t}
          style={{
            opacity: qs[i],
            transform: `translateY(${(1 - qs[i]) * 18}px)`,
            padding: '18px 26px',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 10,
            background: theme.panel,
            fontSize: 26,
            color: theme.text,
          }}
        >
          {t}
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const CodePane: React.FC<{
  at: number;
  lines: string[];
  badge?: {level: 'dashed' | 'solid' | 'filled'; note?: string};
}> = ({at, lines, badge}) => {
  const rows = useStagger(lines.length, {stride: 12, at});
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 900, background: '#0B0E14', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, padding: '18px 24px', fontFamily: 'SF Mono, Menlo, monospace'}}>
        {lines.map((l, i) => (
          <div key={i} style={{opacity: rows[i], fontSize: 21, lineHeight: 1.9, color: l.includes('⚠') || l.includes('422') ? theme.conceptDeep : theme.text, whiteSpace: 'pre'}}>
            <span style={{color: theme.dim, marginRight: 14}}>{String(i + 1).padStart(2, '0')}</span>
            {l}
          </div>
        ))}
        {badge ? (
          <div style={{marginTop: 12}}>
            <EvidenceBadge level={badge.level} at={at + rows.length * 6} note={badge.note} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
