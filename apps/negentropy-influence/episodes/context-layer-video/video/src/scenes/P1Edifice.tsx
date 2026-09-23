/** P1 大厦与五层（p1-01..26）——术语家谱 + 四路线格局 + 五正交层逐层点亮。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDim, useDraw, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, PillarHUD} from '../components/devices';

/** 1-A 术语家谱时间轴：主线生长 + 节点弹出 + 幻灭段压暗。 */
const Genealogy: React.FC<{at: number; doomAt: number}> = ({at, doomAt}) => {
  const line = useDraw(at, 70);
  const nodes = useStagger(4, {at: at + 10, stride: 16, dur: DUR.f5});
  const doom = useDim({at: doomAt, to: 0.35, dur: DUR.f5});
  const rail: {x: number; zh: string; sub: string}[] = [
    {x: 60, zh: '语义层', sub: 'Business Objects · 1990s'},
    {x: 430, zh: '无界面厂商幻灭', sub: '2020–23 · 不在执行路径上'},
    {x: 880, zh: '定名上下文层', sub: 'a16z · 2026-03-10'},
    {x: 1330, zh: '官方样板发布', sub: 'Snowflake Horizon Context · 2026-06-02'},
  ];
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: 80, top: 420, width: 1500}}>
      <svg width={1500} height={8} style={{position: 'absolute', top: 46}}>
        <line x1={0} y1={4} x2={1500} y2={4} stroke={theme.panelBorder} strokeWidth={4} />
        <line
          x1={0}
          y1={4}
          x2={1500}
          y2={4}
          stroke={theme.blueprint}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={line.strokeDashoffset}
        />
      </svg>
      {rail.map((n, i) => {
        const o = nodes[i];
        const doomed = i === 1;
        return (
          <div key={n.zh} style={{position: 'absolute', left: n.x - 40, top: 70, opacity: o * (doomed ? doom : 1)}}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: doomed ? theme.danger : theme.blueprint,
                position: 'absolute',
                top: -40,
                left: 36,
                opacity: o,
              }}
            />
            <div style={{fontFamily: theme.sans, fontSize: 25, color: doomed ? theme.danger : theme.text}}>{n.zh}</div>
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 2}}>{n.sub}</div>
            {doomed ? (
              <div style={{fontFamily: theme.mono, fontSize: 40, marginTop: -46, opacity: o * doom}}>🪦</div>
            ) : null}
            {i === 3 && progress(frame, doomAt + 40, DUR.f5) > 0 ? (
              <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.grown, marginTop: 4}}>
                Gartner：新的关键基础设施
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** 1-B 三种口径三卡。 */
const ThreeCamps: React.FC<{at: number}> = ({at}) => {
  const ps = useStagger(3, {at, stride: 9, dur: DUR.f5});
  const camps = [
    {zh: '全家桶都算', sub: '超集 · Atlan'},
    {zh: '独立一层', sub: '并行 · Airbyte'},
    {zh: '必须可执行', sub: '内核 · Cube'},
  ];
  return (
    <div style={{display: 'flex', gap: 44, justifyContent: 'center', paddingTop: 120}}>
      {camps.map((c, i) => (
        <div
          key={c.zh}
          style={{
            opacity: ps[i],
            transform: `translateY(${(1 - ps[i]) * 20}px)`,
            padding: '26px 34px',
            borderRadius: 12,
            border: `1px solid ${theme.panelBorder}`,
            background: theme.panel,
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{c.zh}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 6}}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
};

/** 1-E 理由双卡 + Gartner 预测数字。 */
const ReasonCards: React.FC<{at: number; gartnerAt: number}> = ({at, gartnerAt}) => {
  const s1 = useSpring('settle', {at, dur: DUR.f5});
  const s2 = useSpring('settle', {at: at + 10, dur: DUR.f5});
  const pct = useCount({from: 0, to: 60, at: gartnerAt, dur: DUR.f6});
  const g = useProgress(gartnerAt - 4, DUR.f5);
  return (
    <div style={{display: 'flex', gap: 56, justifyContent: 'center', alignItems: 'center', paddingTop: 130}}>
      <div style={{opacity: s1, transform: `translateY(${(1 - s1) * 16}px)`, padding: '22px 30px', borderRadius: 12, border: `2px solid ${theme.blueprint}`, background: `${theme.blueprint}10`}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>不绑引擎</div>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>才服务任意平台</div>
      </div>
      <div style={{opacity: s2, transform: `translateY(${(1 - s2) * 16}px)`, padding: '22px 30px', borderRadius: 12, border: `2px solid ${theme.activate}`, background: `${theme.activate}10`}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>治理前移</div>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 4}}>才防得住绕行</div>
      </div>
      <div style={{opacity: g, textAlign: 'center', padding: '20px 34px', borderRadius: 12, border: `2px solid ${theme.danger}66`, background: `${theme.danger}0E`}}>
        <div style={{fontFamily: theme.mono, fontSize: 64, color: theme.danger}}>{Math.round(pct)}%</div>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>纯 MCP 项目将因缺语义层失败</div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 2}}>Gartner · 2028 预测</div>
      </div>
    </div>
  );
};

/** 1-G 正交接件台：换掉索引总账模块，风控承重墙不动。 */
const SwapDeck: React.FC<{at: number}> = ({at}) => {
  const p = useProgress(at, 56);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 320, display: 'flex', justifyContent: 'center', gap: 40, alignItems: 'center'}}>
      <div style={{textAlign: 'center'}}>
        <div
          style={{
            padding: '20px 30px',
            borderRadius: 12,
            border: `2px solid ${p > 0.4 ? theme.grown : theme.blueprint}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.text,
            opacity: 0.4 + 0.6 * Math.abs(1 - 2 * p),
            transform: `translateX(${p * 40}px)`,
          }}
        >
          索引总账 · 换新
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 8}}>可独立替换</div>
      </div>
      <div style={{fontSize: 52, opacity: 0.4 + 0.6 * p}}> ⇄ </div>
      <div style={{textAlign: 'center'}}>
        <div
          style={{
            padding: '20px 30px',
            borderRadius: 12,
            border: `2px solid ${theme.activate}`,
            background: `${theme.activate}10`,
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.text,
            boxShadow: `0 0 ${18 * p}px ${theme.activate}44`,
          }}
        >
          风控承重墙 · 不动
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 8}}>正交 = 独立演进</div>
      </div>
    </div>
  );
};

export const P1Edifice: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-07');
  const bB = w('p1-08', 'p1-10');
  const bC = w('p1-11', 'p1-14');
  const bD = w('p1-15', 'p1-17');
  const bE = w('p1-18', 'p1-19');
  const bF = w('p1-20', 'p1-24');
  const bG = w('p1-25', 'p1-26');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 术语家谱时间轴">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <Genealogy at={at('p1-02') - bA.from} doomAt={at('p1-03') - bA.from} />
        <Footnote delay={20}>术语家谱：semantic layer → context layer</Footnote>
      </Sequence>

      <Sequence {...bB} name="1-B 三种口径">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <ThreeCamps at={at('p1-08') - bB.from} />
        <Footnote delay={70}>「每家的上下文层，都长成它正在卖的产品」</Footnote>
      </Sequence>

      <Sequence {...bC} name="1-C 四路线之一">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <ArchifyRecap
          slug="industry-landscape"
          caption="业界四路线格局"
          cues={[
            {chapterId: 'embedded', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')},
            {chapterId: 'code', at: at('p1-13') - bC.from, durationInFrames: dur('p1-13')},
          ]}
        />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bD} name="1-D 异类与落位">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <ArchifyRecap
          slug="industry-landscape"
          caption="业界四路线格局"
          lead={false}
          cues={[
            {chapterId: 'palantir', at: at('p1-15') - bD.from, durationInFrames: dur('p1-15')},
            {chapterId: 'independent', at: at('p1-16') - bD.from, durationInFrames: dur('p1-16')},
            {chapterId: 'bp', at: at('p1-17') - bD.from, durationInFrames: dur('p1-17')},
          ]}
        />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bE} name="1-E 理由与预测">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <ReasonCards at={at('p1-18') - bE.from} gartnerAt={at('p1-19') - bE.from} />
        <EvidenceBadge grade="vendor" />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bF} name="1-F 五层逐层点亮">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <ArchifyRecap
          slug="architecture"
          caption="五正交层总架构"
          cues={[
            {chapterId: 'store', at: at('p1-21') - bF.from, durationInFrames: dur('p1-21')},
            {chapterId: 'catalog', at: at('p1-22') - bF.from, durationInFrames: dur('p1-22')},
            {chapterId: 'gate', at: at('p1-23') - bF.from, durationInFrames: dur('p1-23')},
          ]}
        />
        <ArchifyYield
          cues={[
            {at: at('p1-21') - bF.from, durationInFrames: dur('p1-21')},
            {at: at('p1-22') - bF.from, durationInFrames: dur('p1-22')},
            {at: at('p1-23') - bF.from, durationInFrames: dur('p1-23')},
          ]}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: theme.sans, fontSize: 30, color: theme.text, letterSpacing: 6}}>
            放 · 找 · 养 · 信 · 用
          </div>
        </ArchifyYield>
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bG} name="1-G 正交接件台">
        <SceneTag chapter="P1" tagline="大厦与五层" accent={theme.blueprint} />
        <SwapDeck at={at('p1-25') - bG.from} />
        <ArchifyRecap
          slug="layer-mechanism-map"
          caption="五层 × 机制 × 实例脊柱"
          cues={[{chapterId: 'obj', at: at('p1-26') - bG.from, durationInFrames: dur('p1-26')}]}
        />
        <PillarHUD lit={0} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
