/** P1 工序卡（p1-01..27，6 镜 7 cue）——分镜 1-A…1-F。
 *
 *  ★ 本幕空间契约：DeskPlane 台面（coreDeep 大矩形〔M-001〕，本集恒定主视觉）恒居画面
 *    中央、框体恒静——工序卡是第一件钉进台面上缘的 mech 紫装置，「安排台面」的动效全部
 *    作用于台面内容物，不触碰装置形体。师傅剪影（text 白无彩）立于台面后侧。
 *  ★ 1-E 是三连反转对撞卡的第一次出场（D1）：左＝拆源码引语（归属角标「开源项目作者 ·
 *    源码分析」）、右＝官方文档页，两箭头相撞后右倾——官方轨胜出的终态与标签语义同向。
 *  archify 三图全屏独占：1-C 三态卡 / 1-D 换卡规矩＋催更回路（承 1-C 跨镜背靠背，
 *    lead={false}；p1-13／p1-16 空窗句回落自制小卡）/ 1-F p1-26 全景一瞥（对开小卡经
 *    ArchifyYield 让位，窗列表与 cue 同步但独立字面量）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ClashCard, DeskPlane, Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, useCount, useEnter, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到与 SceneTag 同行
 *  （P1–P6 同值，由 Integrate 统一核对——08「HarnessBadge 共存」定案）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 确定性透明度（帧驱动的底色渐显；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影（text 白，人一律无彩）——立于台面后侧（台面顶缘线即其落脚处） */
const Person: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.88,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={theme.text} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
  </svg>
);

/** 台面后景（框体恒静〔M-001〕＋师傅剪影）：1-A/1-B 共用，P2 另有本地版 */
const DeskStage: React.FC = () => (
  <>
    <DeskPlane />
    <Person x={560} y={110} scale={0.9} />
    <div
      style={{
        position: 'absolute',
        left: 536,
        top: 292,
        width: 168,
        textAlign: 'center',
        fontFamily: theme.sans,
        fontSize: 22,
        color: theme.dim,
      }}
    >
      {'师傅'}
    </div>
  </>
);

/** 坑对账卡（「坑N · 标签」mech 点亮）——每幕开幕对账的共用形态 */
const PitCard: React.FC<{index: string; zh: string; at: number}> = ({index, zh, at}) => {
  const e = useEnter('fade', {at, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', left: 96, top: 132, ...e}}>
      <Panel accent={theme.mech} style={{padding: '12px 24px', display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.mech}}>{index}</span>
        <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{zh}</span>
      </Panel>
    </div>
  );
};

// ── 1-A 工序卡首现：一张 mech 紫卡片自上下落钉入台面上缘 ─────────────────

const STEPS = 5;

/** 工序卡本体（mech 描边＋钉）：rows 为各条目显形进度（0 = 空） */
const TodoCardFace: React.FC<{rows: readonly number[]; compact?: boolean}> = ({rows, compact = false}) => {
  const rowH = compact ? 36 : 52;
  const pad = compact ? 10 : 16;
  return (
    <Panel accent={theme.mech} style={{padding: 0, overflow: 'hidden'}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: compact ? 42 : 54,
          padding: `0 ${pad + 4}px`,
          borderBottom: `2px solid ${withAlpha(theme.mech, 0.4)}`,
        }}
      >
        {/* 钉：卡钉在台面上缘的读法 */}
        <svg width={22} height={22}>
          <circle cx={11} cy={11} r={7} fill={theme.mech} />
          <circle cx={11} cy={11} r={10} fill="none" stroke={theme.mech} strokeWidth={2} opacity={0.45} />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: compact ? 24 : 28, fontWeight: 600, color: theme.text}}>
          {'工序卡'}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: compact ? 15 : 18, color: theme.dim, marginLeft: 'auto'}}>
          {'5 steps'}
        </span>
      </div>
      <div style={{padding: pad}}>
        {Array.from({length: STEPS}, (_, i) => {
          const p = rows[i] ?? 0;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                height: rowH,
                opacity: p,
                transform: `translateX(${(1 - p) * 14}px)`,
              }}
            >
              {/* 待办空格图标（三态之前的默认态） */}
              <svg width={compact ? 16 : 20} height={compact ? 16 : 20}>
                <rect
                  x={2}
                  y={2}
                  width={compact ? 12 : 16}
                  height={compact ? 12 : 16}
                  rx={4}
                  fill="none"
                  stroke={theme.dim}
                  strokeWidth={2.5}
                />
              </svg>
              <span style={{fontFamily: theme.mono, fontSize: compact ? 15 : 18, color: theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div
                style={{
                  width: compact ? 220 : 360,
                  height: 3,
                  borderRadius: 2,
                  background: theme.panelBorder,
                }}
              />
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const TodoPinning: React.FC<{atCard: number; atSteps: number; stepsWin: number}> = ({
  atCard,
  atSteps,
  stepsWin,
}) => {
  const fall = useEnter('fall', {at: atCard, dur: DUR.f5, dist: 130, springPreset: 'settle'});
  const rows = useStagger(STEPS, {at: atSteps, fit: {total: Math.max(1, stepsWin)}});
  return (
    <div style={{position: 'absolute', left: 780, top: 238, width: 560, ...fall}}>
      <TodoCardFace rows={rows} />
    </div>
  );
};

// ── 1-B 「什么都不执行」三连否 ───────────────────────────────────────────

/** 图标 glyph（读文件／跑命令／内存／进度）——纯几何，无文字 */
const Glyph: React.FC<{kind: 'file' | 'term' | 'chip' | 'bar'; color: string}> = ({kind, color}) => {
  const s = {stroke: color, strokeWidth: 5, fill: 'none', strokeLinejoin: 'round' as const};
  return (
    <svg width={84} height={84}>
      {kind === 'file' ? (
        <>
          <path d="M18 6 H50 L66 22 V78 H18 Z" {...s} />
          <path d="M50 6 V22 H66" {...s} />
        </>
      ) : null}
      {kind === 'term' ? (
        <>
          <rect x={8} y={14} width={68} height={56} rx={8} {...s} />
          <path d="M22 32 L32 42 L22 52" {...s} strokeLinecap="round" />
          <line x1={40} y1={52} x2={58} y2={52} {...s} strokeLinecap="round" />
        </>
      ) : null}
      {kind === 'chip' ? (
        <>
          <rect x={22} y={22} width={40} height={40} rx={5} {...s} />
          <rect x={32} y={32} width={20} height={20} rx={3} {...s} />
          {[0, 1, 2].map((i) => (
            <g key={i} {...s} strokeLinecap="round">
              <line x1={30 + i * 12} y1={22} x2={30 + i * 12} y2={10} />
              <line x1={30 + i * 12} y1={62} x2={30 + i * 12} y2={74} />
            </g>
          ))}
        </>
      ) : null}
      {kind === 'bar' ? (
        <>
          <rect x={6} y={28} width={72} height={28} rx={8} {...s} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={13 + i * 15} y={35} width={11} height={14} rx={3} fill={color} />
          ))}
        </>
      ) : null}
    </svg>
  );
};

const NothingExec: React.FC<{atIcons: number; atCross: number; atCells: number; cellsWin: number}> = ({
  atIcons,
  atCross,
  atCells,
  cellsWin,
}) => {
  const mini = useProgress(2, DUR.f5);
  const icons = useStagger(4, {at: atIcons, stride: 10, dur: DUR.f4});
  const crossIn = useProgress(atCross - 6, DUR.f4);
  const pulse = useImpulse({at: atCross, dur: DUR.f4, peak: 1});
  const cells = useCount({from: 0, to: 18, at: atCells, dur: Math.max(1, cellsWin), ease: 'linear'});
  const filled = Math.round(cells);

  const tiles: {kind: 'file' | 'term' | 'chip' | 'bar'; zh: string; deny: boolean}[] = [
    {kind: 'file', zh: '读文件', deny: true},
    {kind: 'term', zh: '跑命令', deny: true},
    {kind: 'chip', zh: '内存', deny: false},
    {kind: 'bar', zh: '进度', deny: false},
  ];
  return (
    <AbsoluteFill>
      {/* 工序卡常驻缩小态（钉在台面上缘） */}
      <div style={{position: 'absolute', left: 520, top: 250, width: 420, opacity: mini}}>
        <TodoCardFace rows={[1, 1, 1, 1, 1]} compact />
      </div>

      {/* 题词：本镜主断言（关键词，不复述口播；置于台面上缘之上、工序卡之上） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 196,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 42,
          fontWeight: 600,
          color: theme.text,
          opacity: mini,
        }}
      >
        {'不执行'}
      </div>

      {/* 四图标：两否（deny 打叉）两亮（mech） */}
      {tiles.map((t, i) => {
        const p = icons[i];
        const hot = !t.deny;
        return (
          <div
            key={t.zh}
            style={{
              position: 'absolute',
              left: 350 + i * 320,
              top: 500,
              opacity: p,
              transform: `translateY(${(1 - p) * 18}px)`,
            }}
          >
            <Panel
              accent={hot ? theme.mech : theme.panelBorder}
              style={{width: 260, height: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 26}}
            >
              <div style={{position: 'relative'}}>
                <Glyph kind={t.kind} color={hot ? theme.mech : theme.dim} />
                {t.deny ? (
                  <svg
                    width={84}
                    height={84}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      opacity: crossIn,
                      transform: `scale(${0.8 + 0.25 * pulse})`,
                      filter: `drop-shadow(0 0 ${10 * pulse}px ${withAlpha(theme.deny, 0.8 * pulse)})`,
                    }}
                  >
                    <line x1={14} y1={14} x2={70} y2={70} stroke={theme.deny} strokeWidth={9} strokeLinecap="round" />
                    <line x1={70} y1={14} x2={14} y2={70} stroke={theme.deny} strokeWidth={9} strokeLinecap="round" />
                  </svg>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontFamily: theme.sans,
                  fontSize: 26,
                  color: hot ? theme.mech : theme.dim,
                }}
              >
                {t.zh}
              </div>
            </Panel>
          </div>
        );
      })}

      {/* 实景卡：终端进度条逐格推进（mono） */}
      <div style={{position: 'absolute', left: 700, top: 764, opacity: mini}}>
        <Panel style={{width: 520, padding: '14px 20px'}}>
          <div style={{display: 'flex', gap: 8}}>
            {Array.from({length: 18}, (_, i) => (
              <div
                key={i}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: i < filled ? theme.mech : 'transparent',
                  border: `2px solid ${i < filled ? theme.mech : theme.panelBorder}`,
                }}
              />
            ))}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-E D1 反转对撞卡 ────────────────────────────────────────────────────

/** 拆源码引语卡（左槽）：mono 引语逐字流出＋归属角标（【三】归属句的画面对位） */
const SourceQuoteCard: React.FC<{quote: string; atAttr: number; atQuote: number; atCost: number; cost: string}> = ({
  quote,
  atAttr,
  atQuote,
  atCost,
  cost,
}) => {
  const attr = useProgress(atAttr, DUR.f4);
  const line = useReveal(quote, {at: atQuote + 4, cps: 9});
  const costIn = useProgress(atCost, DUR.f4);
  return (
    <Panel style={{width: '100%', height: 380, boxSizing: 'border-box', padding: '26px 32px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, opacity: attr}}>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 21,
            color: theme.dim,
            border: `2px solid ${theme.dim}`,
            borderRadius: 6,
            padding: '2px 10px',
          }}
        >
          {'【三】'}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{'开源项目作者 · 源码分析'}</span>
      </div>
      <div style={{marginTop: 34, minHeight: 120}}>
        <span style={{fontFamily: theme.serif, fontSize: 64, color: theme.panelBorder}}>{'“'}</span>
        <div style={{fontFamily: theme.mono, fontSize: 36, lineHeight: 1.8, color: theme.text, whiteSpace: 'pre'}}>
          {line}
        </div>
      </div>
      <div
        style={{
          marginTop: 40,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: costIn,
        }}
      >
        {'↘ '}
        {cost}
      </div>
    </Panel>
  );
};

/** 官方文档页样（右槽）：dim 页样＋口径关键词 */
const DocPageCard: React.FC<{zh: string; sub: string; note: string; atNote: number}> = ({zh, sub, note, atNote}) => {
  const noteIn = useProgress(atNote, DUR.f4);
  return (
    <Panel
      accent={theme.panelBorder}
      style={{width: '100%', height: 380, boxSizing: 'border-box', padding: '22px 30px'}}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: `2px solid ${theme.panelBorder}`}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{width: 11, height: 11, borderRadius: 999, background: theme.panelBorder}} />
        ))}
        <span style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'docs'}</span>
      </div>
      <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 52, fontWeight: 700, color: theme.text}}>{zh}</div>
      <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>{sub}</div>
      <div
        style={{
          marginTop: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: noteIn,
        }}
      >
        <span style={{color: theme.ok}}>{'✓'}</span>
        {note}
      </div>
    </Panel>
  );
};

const D1Clash: React.FC<{
  atLeft: number;
  atAttr: number;
  atQuote: number;
  atRight: number;
  atArrows: number;
  atTilt: number;
  atReason: number;
  atCost: number;
  stripSteps: {zh: string; at: number}[];
}> = ({atLeft, atAttr, atQuote, atRight, atArrows, atTilt, atReason, atCost, stripSteps}) => {
  const eL = useProgress(atLeft, DUR.f5, 'decelerate');
  const eR = useProgress(atRight, DUR.f5, 'decelerate');
  const eA = useProgress(atArrows, DUR.f5);
  const tilt = useSpring('settle', {at: atTilt, dur: DUR.f5});
  // 口径三档的点亮进度：顶层逐个调用（铁律①），经 props 注入递进条
  const s0 = useProgress(stripSteps[0].at, DUR.f4);
  const s1 = useProgress(stripSteps[1].at, DUR.f4);
  const s2 = useProgress(stripSteps[2].at, DUR.f4);
  const strip = (
    <div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 26, alignItems: 'center'}}>
        {stripSteps.map((st, i) => {
          const p = [s0, s1, s2][i];
          return (
            <React.Fragment key={st.zh}>
              {i > 0 ? (
                <svg width={44} height={16} style={{opacity: p}}>
                  <path d="M2 8 H30 M24 2 L34 8 L24 14" fill="none" stroke={theme.dim} strokeWidth={3} />
                </svg>
              ) : null}
              <div style={{opacity: 0.25 + 0.75 * p}}>
                <Panel accent={p > 0.5 ? theme.coreDeep : theme.panelBorder} style={{padding: '8px 26px'}}>
                  <span style={{fontFamily: theme.sans, fontSize: 27, color: p > 0.5 ? theme.text : theme.dim}}>
                    {st.zh}
                  </span>
                </Panel>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <ClashCard
        enter={[eL, eR, eA]}
        tilt={tilt}
        left={
          <SourceQuoteCard
            quote="两套并存 · 交互式默认任务图"
            atAttr={atAttr}
            atQuote={atQuote}
            atCost={atCost}
            cost="占台面"
          />
        }
        right={<DocPageCard zh="默认禁用" sub="四个新工具接管" note="盯得住" atNote={atReason} />}
        strip={strip}
      />
    </AbsoluteFill>
  );
};

// ── 1-F 收束：工具 ≠ 规划 ＋ 同一开关翻转 ────────────────────────────────

const ToolNotPlanning: React.FC<{atCards: number; atDim: number; atSwitch: number}> = ({
  atCards,
  atDim,
  atSwitch,
}) => {
  const cards = useStagger(2, {at: atCards, stride: 12, dur: DUR.f5});
  // 左卡划暗（工具被关掉）：划线宽 + 压暗，停驻终态〔M-003〕
  const dimP = useProgress(atDim, DUR.f5);
  // 拨杆翻转：空间通道走弹簧（settle 终态 = 「如今 · 关掉换旧」——终态与标签语义同向）
  const s = useSpring('settle', {at: atSwitch, dur: DUR.f5});
  const travel = 244;

  const card = (zh: string, accent: string) => (
    <Panel accent={accent} style={{width: 380, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <span style={{fontFamily: theme.sans, fontSize: 56, fontWeight: 700, color: theme.text}}>{zh}</span>
    </Panel>
  );
  return (
    <AbsoluteFill>
      {/* 左：工具（mech）→ 划暗 */}
      <div style={{position: 'absolute', left: 560, top: 380, opacity: cards[0] * (1 - 0.55 * dimP)}}>
        {card('工具', theme.mech)}
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 118,
            height: 7,
            width: 320 * dimP,
            background: theme.dim,
            borderRadius: 4,
          }}
        />
      </div>
      {/* 中：≠ */}
      <div
        style={{
          position: 'absolute',
          left: 940,
          top: 472,
          width: 40,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 64,
          color: theme.dim,
          opacity: cards[0],
        }}
      >
        {'≠'}
      </div>
      {/* 右：规划（台面上的字样恒亮——mini coreDeep 台面切面承载） */}
      <div style={{position: 'absolute', left: 980, top: 380, opacity: cards[1]}}>
        {card('规划', theme.coreDeep)}
        <div
          style={{
            position: 'absolute',
            left: 40,
            bottom: -18,
            width: 300,
            height: 9,
            borderRadius: 5,
            background: theme.coreDeep,
          }}
        />
      </div>

      {/* 同一开关（mono 拨杆）：两年前强制开 → 如今关掉换旧 */}
      <div style={{position: 'absolute', left: 780, top: 730}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: 360,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          <span>{'两年前'}</span>
          <span>{'如今'}</span>
        </div>
        <div
          style={{
            position: 'relative',
            width: 360,
            height: 66,
            borderRadius: 33,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
          }}
        >
          {/* 状态标签：同位交叉淡化（布尔硬门禁用） */}
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.dim,
              opacity: 1 - s,
            }}
          >
            {'强制开'}
          </span>
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.text,
              opacity: s,
            }}
          >
            {'关掉换旧'}
          </span>
          {/* 拨杆（mech 紫端帽 = 开关本体是装置） */}
          <div
            style={{
              position: 'absolute',
              left: 7 + travel * s,
              top: 7,
              width: 52,
              height: 52,
              borderRadius: 999,
              background: theme.mechDeep,
              border: `3px solid ${theme.mech}`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 计划模式产品锚卡：批准闸门 deny 红锁＋「一个字不落盘」封条 */
const PlanModeAnchor: React.FC<{at: number}> = ({at}) => {
  const rise = useEnter('rise', {at, dur: DUR.f5, dist: 40, restBottom: 800});
  return (
    <div style={{position: 'absolute', left: 570, top: 360, ...rise}}>
      <Panel accent={theme.deny} style={{width: 780, height: 380, position: 'relative'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 44}}>
          <svg width={72} height={82}>
            <path d="M20 38 V26 Q20 6 36 6 Q52 6 52 26 V38" fill="none" stroke={theme.deny} strokeWidth={8} />
            <rect x={8} y={38} width={56} height={40} rx={9} fill={withAlpha(theme.deny, 0.22)} stroke={theme.deny} strokeWidth={6} />
            <circle cx={36} cy={55} r={6} fill={theme.deny} />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 700, color: theme.text}}>{'计划模式'}</span>
        </div>
        {/* 封条：横贯卡面的 deny 虚线条带 */}
        <div
          style={{
            position: 'absolute',
            left: 90,
            top: 236,
            width: 600,
            height: 62,
            border: `3px dashed ${theme.deny}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: withAlpha(theme.danger, 0.08),
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 600, color: theme.text}}>
            {'批准前 · 一个字不落盘'}
          </span>
        </div>
      </Panel>
    </div>
  );
};

/** p1-13 空窗回落：过渡小卡（「忙起来会忘」） */
const GapCard: React.FC = () => {
  const e = useEnter('pop', {at: 2, dur: DUR.f4, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...e}}>
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 430,
        }}
      >
        <Panel style={{width: 600, padding: '30px 36px', display: 'flex', alignItems: 'center', gap: 22}}>
          {/* 时钟 glyph（dim——教学注记件，无彩） */}
          <svg width={54} height={54}>
            <circle cx={27} cy={27} r={22} fill="none" stroke={theme.dim} strokeWidth={4} />
            <path d="M27 15 V27 L36 33" fill="none" stroke={theme.dim} strokeWidth={4} strokeLinecap="round" />
          </svg>
          <span style={{fontFamily: theme.serif, fontSize: 38, fontWeight: 600, color: theme.text}}>{'忙起来会忘'}</span>
        </Panel>
      </div>
    </div>
  );
};

/** p1-16 空窗回落：教学自陈徽标条（dim 置底，不占字幕安全带） */
const TeachingBadge: React.FC = () => {
  const e = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', left: 0, top: 760, width: 1920, ...e}}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            border: `2px dashed ${theme.panelBorder}`,
            borderRadius: 10,
            padding: '10px 28px',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
            letterSpacing: 2,
          }}
        >
          {'教学设计 · 产品源码无此款'}
        </div>
      </div>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1TodoCard: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-04');
  const bB = w('p1-05', 'p1-08');
  const bC = w('p1-09');
  const bD = w('p1-10', 'p1-16');
  const bE = w('p1-17', 'p1-23');
  const bF = w('p1-24', 'p1-27');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="1-A 工序卡钉入">
        <SceneTag chapter="todo_write" tagline="工序卡" />
        <DeskStage />
        <PitCard index="坑一" zh="跑偏" at={at('p1-01') - bA.from} />
        <TodoPinning atCard={at('p1-03') - bA.from} atSteps={at('p1-04') - bA.from} stepsWin={dur('p1-04')} />
        <Footnote delay={at('p1-03') - bA.from}>{'todo_write'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="1-B 什么都不执行">
        <DeskStage />
        <NothingExec
          atIcons={at('p1-06') - bB.from}
          atCross={at('p1-06') - bB.from + Math.round(dur('p1-06') * 0.55)}
          atCells={at('p1-06') - bB.from}
          cellsWin={dur('p1-06') + dur('p1-07') + dur('p1-08')}
        />
        <Footnote delay={2}>{'CURRENT_TODOS · terminal render'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="1-C 三态卡">
        {/* 前镜无图 → 首章默认入场 */}
        <ArchifyRecap
          slug="plan-todo-states"
          caption="工序卡三态"
          cues={[
            {chapterId: 'three-states', at: at('p1-09') - bC.from, durationInFrames: dur('p1-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 换卡规矩与催更回路">
        {/* 承 1-C 跨镜背靠背 → lead={false}（分镜背靠背清单）；实例内 p1-13 空窗后
            nag-counter 自动恢复入场（ArchifyRecap 空窗判定） */}
        <ArchifyRecap
          slug="plan-todo-swap"
          caption="整表替换与催更"
          lead={false}
          cues={[
            {chapterId: 'whole-swap', at: at('p1-10') - bD.from, durationInFrames: dur('p1-10')},
            {chapterId: 'validate-first', at: at('p1-11') - bD.from, durationInFrames: dur('p1-11')},
            {chapterId: 'no-half-card', at: at('p1-12') - bD.from, durationInFrames: dur('p1-12')},
            {chapterId: 'nag-counter', at: at('p1-14') - bD.from, durationInFrames: dur('p1-14')},
            {chapterId: 'reset-on-send', at: at('p1-15') - bD.from, durationInFrames: dur('p1-15')},
          ]}
        />
        {/* p1-13 空窗回落：过渡小卡（窗＝本句，勿越入后续 cue 窗） */}
        <Sequence from={at('p1-13') - bD.from} durationInFrames={dur('p1-13')} name="1-D 忘性小卡">
          <GapCard />
        </Sequence>
        {/* p1-16 空窗回落：教学自陈徽标条（dim 置底；本镜末句，窗即余量） */}
        <Sequence from={at('p1-16') - bD.from} durationInFrames={dur('p1-16')} name="1-D 教学自陈徽标条">
          <TeachingBadge />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="1-E D1 反转对撞">
        <D1Clash
          atLeft={at('p1-17') - bE.from}
          atAttr={at('p1-18') - bE.from}
          atQuote={at('p1-19') - bE.from}
          atRight={at('p1-20') - bE.from}
          atArrows={at('p1-20') - bE.from + 10}
          atTilt={at('p1-21') - bE.from}
          atReason={at('p1-22') - bE.from}
          atCost={at('p1-23') - bE.from}
          stripSteps={[
            {zh: '并存', at: at('p1-19') - bE.from},
            {zh: '反转', at: at('p1-20') - bE.from},
            {zh: '全关', at: at('p1-21') - bE.from},
          ]}
        />
        <Footnote delay={at('p1-18') - bE.from}>
          {'isTodoV2Enabled() · TodoWrite disabled by default · CLAUDE_CODE_ENABLE_TASKS=0'}
        </Footnote>
      </Sequence>

      <Sequence {...bF} name="1-F 工具与规划收束">
        {/* 可见岛 p1-24..25 / p1-27；窗 = 本镜 1 条 cue 窗（独立字面量，勿 spread cue） */}
        <ArchifyYield
          cues={[{at: at('p1-26') - bF.from, durationInFrames: dur('p1-26')}]}
        >
          {/* 多挂 f3 帧：让位淡出盖满后再卸载，避免装置一帧消失 */}
          <Sequence durationInFrames={at('p1-26') - bF.from + DUR.f3}>
            <ToolNotPlanning
              atCards={at('p1-24') - bF.from}
              atDim={at('p1-24') - bF.from + DUR.f5}
              atSwitch={at('p1-25') - bF.from + DUR.f3}
            />
          </Sequence>
        </ArchifyYield>
        {/* 1-D 之后隔 p1-16..25 长空档 → 默认入场 */}
        <ArchifyRecap
          slug="plan-panorama"
          caption="全景一瞥"
          cues={[
            {chapterId: 'tool-fade', at: at('p1-26') - bF.from, durationInFrames: dur('p1-26')},
          ]}
        />
        <Sequence from={at('p1-27') - bF.from} name="1-F 计划模式锚卡">
          <PlanModeAnchor at={2} />
        </Sequence>
        <Footnote delay={at('p1-27') - bF.from}>{'plan mode'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1TodoCard;
