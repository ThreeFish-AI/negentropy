/** P5 补救梯（p5-01..36，6 镜 20 cue）——分镜 5-A…5-F。
 *
 *  叙事链：坑四「白干 · 到期」对账（deny）＋传送带急停熄火 → 三级梯分诊（图集）→
 *  先判断后写入（图集）→ 超长级＋瞬态级（图集二访）→ D3 对撞卡＋两路径方向对开 →
 *  退出协议（图集）＋官方同款回落＋收束题词。
 *  空间契约：底盘 LoopRing（core 橙〔M-001〕恒线宽）急停复用；对撞卡用 motifs 的
 *  ClashCard（D1/D2/D3 共用形态）；5-C 承 5-B、5-D 承 5-C 跨实例背靠背 lead={false}，
 *  5-F 由 5-E 自制装置隔开、lead 走默认。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CLASH, ClashCard, Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {PitCard} from './P3SkillDrawers';
import {
  DUR,
  useDim,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位（P1–P6 同值，见 references/08「HarnessBadge 共存」）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 5-A 坑四对账＋熄火演示（p5-01..03） ──────────────────────────────────

/** 程序窗格（无彩 dim）：熄火＝内容压暗到近黑＋deny 描边＋大 ✗（动效值由调用侧注入）。 */
const HaltWindow: React.FC<{dark: number; xSet: number}> = ({dark, xSet}) => (
  <div style={{position: 'absolute', left: 940, top: 390, width: 660, height: 350}}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 14,
        border: `3px solid ${theme.panelBorder}`,
        background: theme.panel,
        overflow: 'hidden',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 18px', borderBottom: `2px solid ${theme.panelBorder}`}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}} />
        ))}
      </div>
      <div style={{padding: '26px 30px', opacity: dark}}>
        {[0.9, 0.72, 0.84].map((wf, i) => (
          <div
            key={i}
            style={{
              width: `${100 * wf}%`,
              height: 14,
              borderRadius: 7,
              background: theme.dim,
              opacity: 0.4,
              marginTop: 22,
            }}
          />
        ))}
      </div>
    </div>
    {/* deny 描边与 ✗（熄火态覆盖层） */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 14,
        border: `3px solid ${theme.deny}`,
        opacity: xSet,
        pointerEvents: 'none',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 660,
        height: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.serif,
        fontSize: 110,
        fontWeight: 700,
        color: theme.deny,
        opacity: xSet,
      }}
    >
      {'✗'}
    </div>
  </div>
);

const CrashHalt: React.FC<{at1: number; at2: number; at3: number; dur2: number}> = ({at1, at2, at3, dur2}) => {
  const cardPulse = useImpulse({at: at1 + 2, dur: DUR.f6, peak: 1});
  // 急停时刻：p5-02 句中（先看到在转，再戛然而止）
  const stopAt = at2 + Math.round(dur2 * 0.4);
  const flash = useImpulse({at: stopAt, dur: DUR.f6, peak: 1});
  const dark = useDim({at: stopAt, to: 0.06, dur: DUR.f4});
  const xSet = useProgress(stopAt + 4, DUR.f4);
  const title = useEnter('fade', {at: at3, dur: DUR.f5});
  // 环上光点：急停帧前匀速巡游（全片同节律 2.5s/圈）、之后冻结在停点
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lap = (f: number) => (f / (fps * 2.5)) % 1;
  const dot = frame < stopAt ? lap(frame) : lap(stopAt);

  return (
    <AbsoluteFill>
      <PitCard n={4} title="白干" sub="到期" deny at={2} pulse={cardPulse} />

      {/* 底盘传送带（core 橙〔M-001〕恒线宽）：急停＝光点冻结＋deny 红闪 */}
      <div
        style={{
          position: 'absolute',
          left: 210,
          top: 440,
          boxShadow: `0 0 ${54 * flash}px ${theme.deny}`,
          borderRadius: 24,
        }}
      >
        <LoopRing size={380} dotProgress={dot} showLabels={false} showExit={false} />
      </div>

      <HaltWindow dark={dark} xSet={xSet} />

      {/* 题词（p5-03） */}
      <div style={{position: 'absolute', left: 0, top: 838, width: 1920, textAlign: 'center', ...title}}>
        <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>{'第五件 · 保台面'}</span>
      </div>

      <Footnote delay={at2}>{'Error: 529 overloaded'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 5-E D3 对撞＋两路径方向对开（p5-27..33） ────────────────────────────

/** 官方文档页样（对撞卡右槽）。 */
const OfficialDoc: React.FC<{mainO: number; subO: number}> = ({mainO, subO}) => (
  <Panel accent={theme.panelBorder} style={{width: '100%', boxSizing: 'border-box', padding: '26px 32px'}}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        paddingBottom: 12,
        borderBottom: `2px solid ${theme.panelBorder}`,
      }}
    >
      <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'官方文档'}</span>
      <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'retry'}</span>
    </div>
    <div style={{marginTop: 24, fontFamily: theme.serif, fontSize: 36, fontWeight: 600, color: theme.text, opacity: mainO}}>
      {'重试烧完 · 提示手动换'}
    </div>
    <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: subO}}>
      {'自动切换 · 仅自配降级链时'}
    </div>
  </Panel>
);

const D3Clash: React.FC<{
  at27: number;
  at28: number;
  at29: number;
  at30: number;
  at31: number;
  at32: number;
  at33: number;
}> = ({at27, at28, at29, at30, at31, at32, at33}) => {
  const eL = useProgress(at27, DUR.f5);
  const eR = useProgress(at29, DUR.f5);
  const eA = useProgress(at29 + 2, DUR.f5);
  // 裁决：箭头相抵后右倾（官方轨胜出，spring 终态与标签语义同向）
  const tilt = useSpring('settle', {at: at29 + 2 + DUR.f5 + 4, dur: DUR.f6});
  const typed = useReveal('连续三次 · 自动切备用', {at: at28 + 2, cps: 6});
  const mainO = useProgress(at29 + 6, DUR.f4);
  const subO = useProgress(at30 + 2, DUR.f4);
  // 下层两路径方向对开（p5-31/32），p5-33 镜像轴揭示
  const leftPanel = useEnter('slideL', {at: at31, dur: DUR.f5, dist: 64});
  const rightPanel = useEnter('slideR', {at: at32, dur: DUR.f5, dist: 64});
  const mirror = useProgress(at33, DUR.f5);

  return (
    <AbsoluteFill>
      <ClashCard
        enter={[eL, eR, eA]}
        tilt={tilt}
        left={
          <Panel style={{width: '100%', boxSizing: 'border-box', padding: '26px 32px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 20,
                  color: theme.dim,
                  border: `2px solid ${theme.dim}`,
                  borderRadius: 6,
                  padding: '2px 10px',
                }}
              >
                {'D3'}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'开源项目作者 · 源码分析'}</span>
            </div>
            <div style={{marginTop: 22}}>
              <span style={{fontFamily: theme.serif, fontSize: 62, color: theme.panelBorder}}>{'“'}</span>
              <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 600, color: theme.text, whiteSpace: 'pre'}}>
                {typed}
              </div>
            </div>
          </Panel>
        }
        right={<OfficialDoc mainO={mainO} subO={subO} />}
      />

      {/* 两路径方向对开：输入侧降档 ↓ vs 输出侧升档 ↑（方向相背，各标触发条件） */}
      <div style={{position: 'absolute', left: 200, top: 700, width: 640, ...leftPanel}}>
        <Panel style={{padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24}}>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'输入超限 · 降预算'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>{'reduced max_tokens'}</div>
          </div>
          <div style={{marginLeft: 'auto', fontFamily: theme.sans, fontSize: 92, fontWeight: 700, color: theme.text, lineHeight: 1}}>
            {'↓'}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1080, top: 700, width: 640, ...rightPanel}}>
        <Panel style={{padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{fontFamily: theme.sans, fontSize: 92, fontWeight: 700, color: theme.text, lineHeight: 1}}>{'↑'}</div>
          <div style={{marginLeft: 'auto', textAlign: 'right'}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'输出掐断 · 抬预算'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>{'8K → 64K'}</div>
          </div>
        </Panel>
      </div>

      {/* 镜像轴＋「方向相反」（p5-33，终态停驻） */}
      <div style={{position: 'absolute', left: 880, top: 700, width: 160, height: 160, opacity: mirror}}>
        <div
          style={{
            position: 'absolute',
            left: 78,
            top: 6,
            width: 0,
            height: 118,
            borderLeft: `3px dashed ${theme.dim}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 124,
            width: 160,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 25,
            fontWeight: 600,
            color: theme.text,
          }}
        >
          {'方向相反'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 158,
            width: 160,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'别混着引'}
        </div>
      </div>

      <Footnote delay={at31}>{'reduced max_tokens vs 8K → 64K'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 5-F 退出协议回落（p5-35..36；p5-34 由图集承载） ─────────────────────

const ExitFallback: React.FC<{at36: number}> = ({at36}) => {
  const items = useStagger(2, {at: 0, stride: Math.max(2, at36), dur: DUR.f5});
  return (
    <AbsoluteFill>
      {/* 官方同款对照卡（dim 页样） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: items[0], transform: `translateY(${(1 - items[0]) * 22}px)`}}>
        <div style={{position: 'absolute', left: 460, top: 300}}>
          <Panel accent={theme.panelBorder} style={{width: 1000, boxSizing: 'border-box', padding: '26px 36px'}}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                paddingBottom: 12,
                borderBottom: `2px solid ${theme.panelBorder}`,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'官方文档'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'thrashing'}</span>
            </div>
            <div style={{marginTop: 24, fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.dim}}>
              {'反复撑爆 · 停手报错'}
            </div>
            <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'不硬塞 · 也不裸崩'}</div>
          </Panel>
        </div>
      </div>

      {/* 收束题词（mech 描边，压短形态，终态停驻〔M-003〕） */}
      <div style={{position: 'absolute', left: 260, top: 610, width: 1400, height: 250, opacity: items[1]}}>
        <Sequence from={at36} layout="none">
          <QuoteCard zh="每条退路 · 自带一道闸" accent={theme.mech} />
        </Sequence>
      </div>

      <Footnote delay={0}>{'[unrecoverable] · Autocompact is thrashing'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5RecoveryLadder: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-05', 'p5-11');
  const bC = w('p5-14', 'p5-18');
  const bD = w('p5-20', 'p5-26');
  const bE = w('p5-27', 'p5-33');
  const bF = w('p5-34', 'p5-36');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="5-A 崩溃熄火">
        <SceneTag chapter="Recovery Ladder" tagline="补救梯" />
        <CrashHalt
          at1={at('p5-01') - bA.from}
          at2={at('p5-02') - bA.from}
          at3={at('p5-03') - bA.from}
          dur2={dur('p5-02')}
        />
      </Sequence>

      {/* 前镜自制装置 → 首章默认入场 */}
      <Sequence {...bB} name="5-B 三级梯分诊">
        <ArchifyRecap
          slug="plan-recovery-ladder"
          caption="三级补救梯"
          cues={[
            {chapterId: 'ladder-mounted', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
            {chapterId: 'snap-truncated', at: at('p5-06') - bB.from, durationInFrames: dur('p5-06')},
            {chapterId: 'snap-overflow', at: at('p5-07') - bB.from, durationInFrames: dur('p5-07')},
            {chapterId: 'snap-transient', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')},
            {chapterId: 'three-catches', at: at('p5-09') - bB.from, durationInFrames: dur('p5-09')},
            {chapterId: 'layer-split', at: at('p5-10') - bB.from, durationInFrames: dur('p5-10')},
            {chapterId: 'truncation-last', at: at('p5-11') - bB.from, durationInFrames: dur('p5-11')},
          ]}
        />
      </Sequence>

      {/* 承 5-B 背靠背（p5-12/13 为句集空号）→ lead={false} */}
      <Sequence {...bC} name="5-C 先判断后写入">
        <ArchifyRecap
          slug="plan-truncation-order"
          caption="先判断后写入"
          lead={false}
          cues={[
            {chapterId: 'raise-budget', at: at('p5-14') - bC.from, durationInFrames: dur('p5-14')},
            {chapterId: 'resend-verbatim', at: at('p5-15') - bC.from, durationInFrames: dur('p5-15')},
            {chapterId: 'judge-before-write', at: at('p5-16') - bC.from, durationInFrames: dur('p5-16')},
            {chapterId: 'order-is-correctness', at: at('p5-17') - bC.from, durationInFrames: dur('p5-17')},
            {chapterId: 'continuation-capped', at: at('p5-18') - bC.from, durationInFrames: dur('p5-18')},
          ]}
        />
      </Sequence>

      {/* 承 5-C 背靠背（p5-19 为句集空号）→ lead={false}；同一图集二访（不同章节组） */}
      <Sequence {...bD} name="5-D 超长与瞬态">
        <ArchifyRecap
          slug="plan-recovery-ladder"
          caption="三级补救梯"
          lead={false}
          cues={[
            {chapterId: 'compact-then-retry', at: at('p5-20') - bD.from, durationInFrames: dur('p5-20')},
            {chapterId: 'compact-once-gate', at: at('p5-21') - bD.from, durationInFrames: dur('p5-21')},
            {chapterId: 'give-up-oversize', at: at('p5-22') - bD.from, durationInFrames: dur('p5-22')},
            {chapterId: 'backoff-with-jitter', at: at('p5-23') - bD.from, durationInFrames: dur('p5-23')},
            {chapterId: 'jitter-anti-avalanche', at: at('p5-24') - bD.from, durationInFrames: dur('p5-24')},
            {chapterId: 'official-ten-retries', at: at('p5-25') - bD.from, durationInFrames: dur('p5-25')},
            {chapterId: 'fallback-chain', at: at('p5-26') - bD.from, durationInFrames: dur('p5-26')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="5-E 口径对撞与方向">
        <D3Clash
          at27={at('p5-27') - bE.from}
          at28={at('p5-28') - bE.from}
          at29={at('p5-29') - bE.from}
          at30={at('p5-30') - bE.from}
          at31={at('p5-31') - bE.from}
          at32={at('p5-32') - bE.from}
          at33={at('p5-33') - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="5-F 退出协议">
        {/* 5-E 自制装置隔开 → 独立实例默认入场 */}
        <ArchifyRecap
          slug="plan-recovery-ladder"
          caption="三级补救梯"
          cues={[{chapterId: 'exit-protocol', at: at('p5-34') - bF.from, durationInFrames: dur('p5-34')}]}
        />
        <Sequence from={at('p5-35') - bF.from} name="5-F 官方同款回落">
          <ExitFallback at36={at('p5-36') - at('p5-35')} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5RecoveryLadder;

/** 场景代理路由名（Stage ⑧ 工单）→ 同一组件，供 Main.tsx 两侧命名互通。 */
export const P5Scene = P5RecoveryLadder;
