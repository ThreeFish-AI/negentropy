/** P5 一单走全程（p5-01..16，3 镜 10 cue）——分镜 5-A…5-C。
 *
 *  ★ 叙事链：全链五工序（核对→自检→节点把关→签字→执行，顺序定死）→
 *    「执行」门开单据驶入（ok 放行瞬态）＋顺序金句 → 四版对账（行数尺随
 *    v1..v4 各章逐格点亮 102/135/180/232）→ 方法论卡（骨架留 · 规模砍）
 *    ＋收束金句。
 *  ★ 空间契约：行数尺沿底边恒驻（y=880 与 archify 画框底缘齐平，占认可带
 *    [880,920]、字幕板顶缘之上——见 clinic.tsx LineGauge 落位铁三角）；「执行」
 *    门与链式角标 mech 青外设位；人无彩。
 *  ★ archify 两图全屏独占：preflight-chain 五章连播（p5-01..05 句句相邻）、
 *    four-version-ledger 五章连播（p5-09..13）。两实例首章前均有整句空窗
 *    （幕首句／p5-06..08 三句自制），全片无跨实例背靠背接缝，lead 一律走
 *    默认；章间换章弹入由实例内背靠背机制自动抑制。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LineGauge, QuoteCard, withAlpha} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useCount, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 轻量角标（P0 FootnoteGhost 同形制；英文标识符只落角标位） */
const FootnoteChip: React.FC<{x: number; y: number; at: number; children: React.ReactNode}> = ({
  x,
  y,
  at,
  children,
}) => {
  const e = useEnter('fade', {at, dur: DUR.f3});
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        ...e,
        padding: '4px 12px',
        border: `1.5px solid ${withAlpha(theme.dim, 0.5)}`,
        borderRadius: 5,
        fontFamily: theme.mono,
        fontSize: 16,
        color: theme.dim,
      }}
    >
      {children}
    </div>
  );
};

// ── 5-A 末道工序：执行门（p5-06） ───────────────────────────────────────

/** p5-06 空窗回落：「执行」双扇门开启、单据驶入，驶过门心 ok 绿放行瞬态；
 *  五工序链名落角标位（窗=本句，勿越 p5-07 金句窗） */
const DoorExec: React.FC<{at: number}> = ({at}) => {
  const stage = useProgress(at, DUR.f4);
  const open = useSpring('settle', {at: at + DUR.f4, dur: DUR.f5});
  // 单据等速驶入（机械感是主题——等速优先于缓动，运动层「逃生舱」惯例；行程 46 帧）
  const ride = useProgress(at + 26, 46, 'linear');
  const pass = useImpulse({at: at + 49, dur: DUR.f5, peak: 1}); // 驶过门心＝行程中点
  return (
    <div style={{position: 'absolute', inset: 0, opacity: stage}}>
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 292,
          width: 380,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 4,
        }}
      >
        {'执行'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 330,
          width: 380,
          height: 300,
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: '#0B0E13',
          border: `3px solid ${theme.mech}`,
          borderRadius: 12,
          boxShadow: `0 0 ${26 * pass}px ${withAlpha(theme.ok, 0.55 * pass)}`,
        }}
      >
        {/* 单据（铺在下层，门开后穿行） */}
        <div
          style={{
            position: 'absolute',
            top: 104,
            left: -64 + ride * 444,
            width: 64,
            height: 92,
            boxSizing: 'border-box',
            background: theme.panel,
            border: `2px solid ${theme.dim}`,
            borderRadius: 8,
            textAlign: 'center',
            paddingTop: 12,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{'单'}</div>
          <div
            style={{
              margin: '8px auto 0',
              width: 36,
              height: 3,
              background: withAlpha(theme.dim, 0.5),
            }}
          />
          <div
            style={{
              margin: '6px auto 0',
              width: 28,
              height: 3,
              background: withAlpha(theme.dim, 0.4),
            }}
          />
        </div>
        {/* 双扇门 mech，开启让行 */}
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: i * 190,
              width: 190,
              height: 300,
              boxSizing: 'border-box',
              background: '#171C26',
              border: `2px solid ${withAlpha(theme.mech, 0.8)}`,
              transform: `translateX(${(i === 0 ? -1 : 1) * open * 186}px)`,
            }}
          />
        ))}
        {/* ok 放行瞬态 */}
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            padding: '2px 12px',
            border: `2px solid ${theme.ok}`,
            borderRadius: 999,
            fontFamily: theme.sans,
            fontSize: 17,
            color: theme.ok,
            opacity: pass,
          }}
        >
          {'放行'}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 664,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
        }}
      >
        {'schema → validate → hooks → permission → run'}
      </div>
    </div>
  );
};

// ── 5-B 四版对账（p5-08..13） ───────────────────────────────────────────

/** 行数尺：p5-08 全景复现（全虚），四格随 v1..v4 各章句头逐格点亮（useCount） */
const LedgerGauge: React.FC<{
  atIntro: number;
  atV1: number;
  atV2: number;
  atV3: number;
  atV4: number;
}> = ({atIntro, atV1, atV2, atV3, atV4}) => {
  const enter = useProgress(atIntro, DUR.f5);
  const c1 = useCount({to: 1, at: atV1, dur: DUR.f4});
  const c2 = useCount({to: 1, at: atV2, dur: DUR.f4});
  const c3 = useCount({to: 1, at: atV3, dur: DUR.f4});
  const c4 = useCount({to: 1, at: atV4, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: enter}}>
      <LineGauge lit={Math.round(c1 + c2 + c3 + c4)} />
    </div>
  );
};

/** p5-08 自制全景复现引题（窗=本句） */
const IntroHead: React.FC<{at: number}> = ({at}) => {
  const e = useProgress(at, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 460,
        width: 1920,
        textAlign: 'center',
        fontFamily: theme.sans,
        fontSize: 36,
        color: theme.text,
        letterSpacing: 6,
        opacity: e,
      }}
    >
      {'四版对账'}
    </div>
  );
};

// ── 5-C 方法论卡（p5-14..16） ───────────────────────────────────────────

/** 三组数字对（教学版 ↔ 真实产品）：点位 4↔27／表与来源 1↔8／把关 3↔一串工序 */
const PAIRS = [
  {label: '点位', l: 4, r: '27'},
  {label: '表 · 来源', l: 1, r: '8'},
  {label: '把关', l: 3, r: '一串工序'},
] as const;

/** 两列对照（骨架留＝core 环形母题；规模砍＝dim 划线）＋三组数字对逐组点亮 */
const MethodCard: React.FC<{atCols: number; atPairs: number}> = ({atCols, atPairs}) => {
  const cols = useStagger(2, {at: atCols, stride: 10, dur: DUR.f5});
  const rows = useStagger(PAIRS.length, {at: atPairs, stride: 12, dur: DUR.f5});
  const n1l = useCount({to: PAIRS[0].l, at: atPairs + 4, dur: DUR.f5});
  const n1r = useCount({to: Number(PAIRS[0].r), at: atPairs + 4, dur: DUR.f5});
  const n2l = useCount({to: PAIRS[1].l, at: atPairs + 16, dur: DUR.f5});
  const n2r = useCount({to: Number(PAIRS[1].r), at: atPairs + 16, dur: DUR.f5});
  const n3l = useCount({to: PAIRS[2].l, at: atPairs + 28, dur: DUR.f5});
  const leftTexts = [String(Math.round(n1l)), String(Math.round(n2l)), String(Math.round(n3l))];
  const rightTexts = [String(Math.round(n1r)), String(Math.round(n2r)), PAIRS[2].r];
  const panel: React.CSSProperties = {
    flex: 1,
    height: 170,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    background: theme.panel,
    border: `2px solid ${theme.panelBorder}`,
    borderRadius: 12,
  };
  return (
    <>
      <div style={{position: 'absolute', left: 380, top: 210, width: 1180, display: 'flex', gap: 24}}>
        <div
          style={{
            ...panel,
            opacity: cols[0],
            transform: `translateX(${(1 - cols[0]) * -28}px)`,
          }}
        >
          <svg width={92} height={92} viewBox="0 0 92 92">
            <circle cx={46} cy={46} r={38} fill="none" stroke={theme.core} strokeWidth={4} />
            <circle cx={46} cy={46} r={5} fill={theme.core} />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text}}>{'骨架 · 留'}</div>
        </div>
        <div
          style={{
            ...panel,
            opacity: cols[1],
            transform: `translateX(${(1 - cols[1]) * 28}px)`,
          }}
        >
          <svg width={92} height={92} viewBox="0 0 92 92">
            <line x1={14} y1={26} x2={78} y2={26} stroke={theme.dim} strokeWidth={8} />
            <line x1={14} y1={46} x2={78} y2={46} stroke={theme.dim} strokeWidth={8} opacity={0.7} />
            <line x1={14} y1={66} x2={78} y2={66} stroke={theme.dim} strokeWidth={8} opacity={0.5} />
            <line x1={8} y1={84} x2={84} y2={8} stroke={theme.dim} strokeWidth={4} />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text}}>{'规模 · 砍'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, top: 452, width: 1920}}>
        {PAIRS.map((p, i) => (
          <div
            key={p.label}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 22,
              height: 86,
              opacity: rows[i],
              transform: `translateY(${(1 - rows[i]) * 14}px)`,
            }}
          >
            <span
              style={{
                width: 150,
                textAlign: 'right',
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
              }}
            >
              {p.label}
            </span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 46,
                color: theme.text,
                fontVariantNumeric: 'tabular-nums',
                width: 60,
                textAlign: 'right',
              }}
            >
              {leftTexts[i]}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 28, color: theme.dim}}>{'↔'}</span>
            <span
              style={{
                fontFamily: i === 2 ? theme.sans : theme.mono,
                fontSize: i === 2 ? 32 : 46,
                color: theme.text,
                width: i === 2 ? 160 : 60,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {rightTexts[i]}
            </span>
          </div>
        ))}
      </div>
    </>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5Preflight: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-07');
  const bB = w('p5-08', 'p5-13');
  const bC = w('p5-14', 'p5-16');

  return (
    <AbsoluteFill>
      {/* 首章（p5-01）为幕首句、P4 末镜为自制 → 无跨实例背靠背 → lead 走默认；
          五章句句相邻＝实例内背靠背，换章弹入由实例内机制自动抑制 */}
      <Sequence {...bA} name="5-A 全链五工序">
        <Sequence from={at('p5-06') - bA.from} durationInFrames={dur('p5-06')}>
          <DoorExec at={2} />
        </Sequence>
        <QuoteCard x={420} y={600} at={at('p5-07') - bA.from} width={1080}>
          {'核对 · 自检 · 把关 · 都在签字前'}
        </QuoteCard>
        <ArchifyRecap
          slug="preflight-chain"
          caption="全链五工序"
          cues={[
            {chapterId: 'full-chain', at: at('p5-01') - bA.from, durationInFrames: dur('p5-01')},
            {chapterId: 'cheap-first', at: at('p5-02') - bA.from, durationInFrames: dur('p5-02')},
            {chapterId: 'semantic-check', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')},
            {chapterId: 'mid-gate', at: at('p5-04') - bA.from, durationInFrames: dur('p5-04')},
            {chapterId: 'ask-last', at: at('p5-05') - bA.from, durationInFrames: dur('p5-05')},
          ]}
        />
      </Sequence>

      {/* 首章（p5-09）前隔 p5-06..08 三句自制 → lead 走默认；行数尺居底边带
          （y=880，与 archify 画框底缘齐平、占认可带 [880,920]），逐格点亮不被画框遮挡 */}
      <Sequence {...bB} name="5-B 四版对账">
        <LedgerGauge
          atIntro={2}
          atV1={at('p5-09') - bB.from}
          atV2={at('p5-10') - bB.from}
          atV3={at('p5-11') - bB.from}
          atV4={at('p5-12') - bB.from}
        />
        <Sequence from={at('p5-08') - bB.from} durationInFrames={dur('p5-08')}>
          <IntroHead at={4} />
          <FootnoteChip x={246} y={64} at={2}>
            {'执行行：只换过一次 · 教学版'}
          </FootnoteChip>
        </Sequence>
        <ArchifyRecap
          slug="four-version-ledger"
          caption="四版对账"
          cues={[
            {chapterId: 'v1-base', at: at('p5-09') - bB.from, durationInFrames: dur('p5-09')},
            {chapterId: 'v2-table', at: at('p5-10') - bB.from, durationInFrames: dur('p5-10')},
            // v3-gates 落 trim 留痕（契约同 P4 recall-loop）：p5-11 窗 2.30s vs
            // storySec 3.21s → rate 1.40，原速播＋裁尾约 0.9s（v3 版收束拍让位给 v4 起句）
            {chapterId: 'v3-gates', at: at('p5-11') - bB.from, durationInFrames: dur('p5-11'), fit: 'trim'},
            {chapterId: 'v4-hooks', at: at('p5-12') - bB.from, durationInFrames: dur('p5-12')},
            {chapterId: 'ledger', at: at('p5-13') - bB.from, durationInFrames: dur('p5-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 方法论">
        <MethodCard atCols={at('p5-14') - bC.from} atPairs={at('p5-15') - bC.from} />
        <QuoteCard x={560} y={730} at={at('p5-16') - bC.from} width={800}>
          {'保骨架 · 砍规模'}
        </QuoteCard>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5Preflight;
