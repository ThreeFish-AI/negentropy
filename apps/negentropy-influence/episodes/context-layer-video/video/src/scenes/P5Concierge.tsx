/** P5 前台与插座（p5-01..26）——激活层：前台 top-k / 核准题库 M4 / resolve 契约 / 插座护照 / 治理≠验证。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useCount, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {BuildingSection, EvidenceBadge, NumberClash, PillarHUD} from '../components/devices';

/** 5-A 前台窗口：整墙档案库虚化退后，只递两三页。 */
const ConciergeDesk: React.FC<{at: number; slideAt: number; crashAt: number}> = ({at, slideAt, crashAt}) => {
  const push = useProgress(at, DUR.f6);
  const slide = useProgress(slideAt, DUR.f5);
  const crash = useCount({from: 86, to: 10, at: crashAt, dur: DUR.f6});
  const crashO = useProgress(crashAt - 4, DUR.f5);
  const archive = ['订单表', '客户表', '事件流', '库存表', '合同库', '日志仓', '指标册', '术语典'];
  return (
    <div style={{position: 'relative', height: '100%'}}>
      <div style={{position: 'absolute', left: 60, top: 130, opacity: 0.25 + 0.45 * (1 - push), filter: `blur(${push * 1.5}px)`}}>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 150px)', gap: 12}}>
          {archive.map((a) => (
            <div key={a} style={{padding: '14px 0', textAlign: 'center', borderRadius: 6, border: `1px solid ${theme.panelBorder}`, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
              {a}
            </div>
          ))}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 8, textAlign: 'center'}}>整座档案库 · 砸向实习生 = 上下文超载</div>
      </div>
      <div style={{position: 'absolute', right: 170, top: 210, transform: `translateX(${(1 - slide) * 60}px)`, opacity: slide}}>
        <div style={{width: 320, padding: '20px 24px', borderRadius: '12px 12px 4px 4px', border: `2px solid ${theme.activate}`, background: theme.panel, boxShadow: `0 12px 40px ${theme.activate}33`}}>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.activate}}>top-k · 只递最精准的两三页</div>
          {['净收入 · governed', '活跃客户 · governed', '口径警告 ×1'].map((p, i) => (
            <div key={p} style={{fontFamily: theme.mono, fontSize: 16, color: i === 2 ? theme.dim : theme.text, padding: '6px 0', borderBottom: i < 2 ? `1px dashed ${theme.panelBorder}` : 'none'}}>
              {p}
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: 430, top: 620, opacity: crashO, display: 'flex', gap: 20, alignItems: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 48, color: theme.danger}}>{Math.round(crash)}%</div>
        <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>
          最强通用模型 · 真实企业库
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>Spider 2.0 · 86.6→10.1 · Colrows 分析</div>
        </div>
      </div>
    </div>
  );
};

/** 5-B 核准题库：盖章底稿 vs 未核准水印。 */
const StampDeck: React.FC<{at: number; missAt: number; capAt: number}> = ({at, missAt, capAt}) => {
  const stamp = useSpring('snap', {at, dur: DUR.f4});
  const glow = useImpulse({at: at + 6, dur: DUR.f6});
  const miss = useProgress(missAt, DUR.f5);
  const cap = useCount({from: 0, to: 20, at: capAt, dur: DUR.f4});
  const capO = useProgress(capAt - 4, DUR.f5);
  const duo = useStagger(2, {at: at - 6, stride: 12, dur: DUR.f5});
  return (
    <div style={{display: 'flex', gap: 60, justifyContent: 'center', paddingTop: 120}}>
      <div style={{width: 430, padding: '24px 28px', borderRadius: 12, border: `2px solid ${theme.grown}`, background: theme.panel, position: 'relative', opacity: duo[0], transform: `translateY(${(1 - duo[0]) * 16}px)`}}>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>VQR · verified_query</div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 6}}>「上月净收入是多少？」</div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 10}}>verified_by: data-team · verified_at: 2026-08</div>
        <div style={{position: 'absolute', right: 18, top: 14, transform: `rotate(-14deg) scale(${0.6 + 0.4 * stamp})`, opacity: stamp, border: `3px solid ${theme.grown}`, borderRadius: 8, padding: '4px 10px', fontFamily: theme.sans, fontSize: 19, color: theme.grown, boxShadow: `0 0 ${14 * glow}px ${theme.grown}66`}}>
          已核准 ✓
        </div>
      </div>
      <div style={{width: 430, padding: '24px 28px', borderRadius: 12, border: `1px dashed ${theme.panelBorder}`, background: theme.panel, opacity: miss * duo[1], transform: `translateY(${(1 - duo[1]) * 16}px)`, position: 'relative'}}>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>现场推算的回答</div>
        <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 8}}>可用，但绝不冒充已背书</div>
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-10deg)', opacity: miss * 0.5, border: `2px solid ${theme.danger}`, borderRadius: 12, fontFamily: theme.sans, fontSize: 30, color: theme.danger, letterSpacing: 6}}>
          未经核准
        </div>
      </div>
      <div style={{opacity: capO, textAlign: 'center', alignSelf: 'center', padding: '16px 24px', borderRadius: 12, border: `2px solid ${theme.danger}55`}}>
        <div style={{fontFamily: theme.mono, fontSize: 38, color: theme.danger}}>&gt; {Math.round(cap)} 条</div>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim}}>反直觉上限 · 越多越慢</div>
      </div>
    </div>
  );
};

/** 5-D 插座与护照 + 三重边界天平。 */
const SocketPassport: React.FC<{at: number; balAt: number}> = ({at, balAt}) => {
  const cable = useDraw(at, 34);
  const plug = useSpring('snap', {at: at + 30, dur: DUR.f4});
  const bal = useProgress(balAt, DUR.f6);
  return (
    <div style={{display: 'flex', gap: 90, justifyContent: 'center', alignItems: 'center', paddingTop: 110}}>
      <div style={{textAlign: 'center'}}>
        <svg width={300} height={150} viewBox="0 0 300 150">
          <path d="M10 75 H220" stroke={theme.activate} strokeWidth={5} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={cable.strokeDashoffset} />
          <rect x={232} y={45} width={44} height={60} rx={8} fill={theme.panel} stroke={theme.activate} strokeWidth={3} opacity={plug} />
          <rect x={276} y={62} width={16} height={26} rx={3} fill={theme.activate} opacity={plug} />
        </svg>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>标准插座 · MCP</div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>开放语义规范 · 定义带得出楼</div>
      </div>
      <div style={{width: 460}}>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text, marginBottom: 14}}>三重边界</div>
        {[
          {t: '可携带', v: 1},
          {t: '可执行', v: 0.66 * bal},
          {t: '已验证', v: 0.33 * bal},
        ].map((b, i) => (
          <div key={b.t} style={{display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0'}}>
            <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, width: 76}}>{b.t}</span>
            <div style={{flex: 1, height: 14, borderRadius: 7, background: theme.panelBorder, overflow: 'hidden'}}>
              <div style={{width: `${b.v * 100}%`, height: '100%', background: i === 0 ? theme.grown : theme.danger}} />
            </div>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{i === 0 ? '✓' : i === 1 ? '不保证' : '更稀缺'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 5-E 治理≠验证：477 vs 48 对撞 + 地基塌方剖面。 */
const CollapseDeck: React.FC<{at: number; collapseAt: number}> = ({at, collapseAt}) => {
  const sink = useProgress(collapseAt, DUR.f6);
  return (
    <div style={{display: 'flex', gap: 80, justifyContent: 'center', alignItems: 'center', paddingTop: 80}}>
      <NumberClash badLabel="算出来的" bad="477" goodLabel="正确答案" good="48" at={at} />
      <div style={{transform: `translateY(${sink * 18}px)`, opacity: 1 - sink * 0.25}}>
        <BuildingSection focus="objects" collapsed={sink > 0.4} scale={0.62} halo={0.3} />
      </div>
    </div>
  );
};

export const P5Concierge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-08');
  const bB = w('p5-09', 'p5-14');
  const bC = w('p5-15', 'p5-18');
  const bD = w('p5-19', 'p5-21');
  const bE = w('p5-22', 'p5-25');
  const bF = w('p5-26', 'p5-26');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 前台窗口">
        <SceneTag chapter="P5" tagline="前台与插座" accent={theme.activate} />
        <ArchifyYield cues={[{at: at('p5-06') - bA.from, durationInFrames: dur('p5-06')}]}>
          <ConciergeDesk at={at('p5-01') - bA.from} slideAt={at('p5-04') - bA.from} crashAt={at('p5-06') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="collect-phase"
          caption="检索与发现出口"
          cues={[{chapterId: 'search', at: at('p5-06') - bA.from, durationInFrames: dur('p5-06')}]}
        />
        <EvidenceBadge grade="thirdparty" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="5-B 核准题库">
        <SceneTag chapter="P5" tagline="前台与插座" accent={theme.activate} />
        <StampDeck at={at('p5-10') - bB.from} missAt={at('p5-12') - bB.from} capAt={at('p5-14') - bB.from} />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="5-C 前台契约 · 代码走廊⑩">
        <SceneTag chapter="P5" tagline="前台与插座" accent={theme.activate} />
        <ArchifyRecap
          slug="assembler-planner"
          caption="resolve 契约 · 统一激活"
          cues={[
            {chapterId: 'router', at: at('p5-15') - bC.from, durationInFrames: dur('p5-15')},
            {chapterId: 'fusion', at: at('p5-16') - bC.from, durationInFrames: dur('p5-16')},
            {chapterId: 'guard', at: at('p5-18') - bC.from, durationInFrames: dur('p5-18')},
          ]}
        />
        <div style={{position: 'absolute', left: 430, top: 620, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_mcp.py --selftest"
            lines={[
              {text: '[PASS] T5: 引擎层 RBAC 经 MCP 仍生效: plan is a PRIVATE fact', color: theme.grown, at: at('p5-18') - bC.from},
            ]}
            caption="mcp T5 · 出口兜底"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bD} name="5-D 插座与护照">
        <SceneTag chapter="P5" tagline="前台与插座" accent={theme.activate} />
        <SocketPassport at={at('p5-19') - bD.from} balAt={at('p5-20') - bD.from} />
        <EvidenceBadge grade="thirdparty" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bE} name="5-E 治理不等于验证">
        <SceneTag chapter="P5" tagline="前台与插座" accent={theme.danger} />
        <CollapseDeck at={at('p5-23a') - bE.from} collapseAt={at('p5-24') - bE.from} />
        <Footnote delay={90}>typedef 生产复现 · 独立于厂商</Footnote>
        <EvidenceBadge grade="thirdparty" />
        <PillarHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bF} name="5-F 收束钩子">
        <SceneTag chapter="P5" tagline="前台与插座" accent={theme.activate} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 400, textAlign: 'center', fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          装备齐了，整栋楼立得住吗？——去验收
        </div>
        <PillarHUD lit={5} at={6} />
      </Sequence>
    </AbsoluteFill>
  );
};
