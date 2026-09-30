/** P5 上件前扫码（p5-01..21，6 镜 11 cue）——分镜 5-A…5-F。
 *
 *  叙事链：镜头拉远工坊全景（各幕装置小图标各归其位、活件滑向扫码队列）→
 *  三道扫码口（checkchain-order）→ 全绿通电与红灯拦截（p5-08 空窗句回落
 *  小卡「接入点会换 · 次序不乱」）→ 成本排序条（机器毫秒 vs 人分钟）→
 *  全景对账（execution-panorama 复用图，五句五接力）→ 官方安全不变量三连卡
 *  ＋金句「只能收紧 · 不能放松」＋对句小字「能加锁 · 不能配钥匙」。
 *  空间契约：内核恒居左中锚位（core，M-001：LoopRing 恒 core 恒线宽，只缩
 *  size），装置图标自上缘/右缘挂入（mech），拉远镜头不触碰内核母题形态。
 *  archify 两图全屏独占：5-B→5-C 同图跨镜背靠背（p5-05→p5-06 无空窗句），
 *  5-C 首实例 lead={false}；order-stable 在 p5-08 空窗后重现 → 独立实例默认入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, NumberedCard, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, useCount, useDim, useEnter, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行（P1–P6 同值，Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** LoopRing 巡游节律：2.5s/圈（全片同值） */
const LAP_FRAMES = 75;

/** 左中内核缩微：恒定锚 + 匀速巡游光点（锁芯恒静＝环不动，只有光点在走） */
const MiniCore: React.FC<{span: number; size: number; left: number; top: number}> = ({
  span,
  size,
  left,
  top,
}) => {
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  return (
    <div style={{position: 'absolute', left, top}}>
      <LoopRing size={size} dotProgress={laps} showLabels={false} showExit={false} />
    </div>
  );
};

// ── 5-A 镜头拉远：工坊全景母图缩略（p5-01..02） ──────────────────────────

/** 上缘装置图标（纯静态，无 hook）：号码簿 / 门禁 / 插线口——前三幕各归其位 */
const DeviceIcon: React.FC<{
  kind: 'ledger' | 'gate' | 'socket';
  name: string;
  sub: string;
  left: number;
  top: number;
}> = ({kind, name, sub, left, top}) => (
  <div style={{position: 'absolute', left, top}}>
    <Panel
      accent={theme.mech}
      style={{width: 230, boxSizing: 'border-box', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14}}
    >
      <svg width={56} height={44}>
        {kind === 'ledger'
          ? [0, 1, 2].map((i) => (
              <g key={i}>
                <rect x={2} y={4 + i * 15} width={16} height={9} rx={2} fill={theme.mech} opacity={0.9} />
                <line x1={26} y1={8.5 + i * 15} x2={54} y2={8.5 + i * 15} stroke={theme.dim} strokeWidth={4} />
              </g>
            ))
          : null}
        {kind === 'gate' ? (
          <g>
            <rect x={4} y={2} width={8} height={40} rx={2} fill={theme.deny} />
            <rect x={24} y={2} width={8} height={40} rx={2} fill={theme.mech} />
            <rect x={44} y={2} width={8} height={40} rx={2} fill={theme.dim} opacity={0.7} />
          </g>
        ) : null}
        {kind === 'socket' ? (
          <g stroke={theme.mech} strokeWidth={3} fill="none">
            <rect x={4} y={4} width={18} height={14} rx={3} />
            <rect x={34} y={4} width={18} height={14} rx={3} />
            <rect x={34} y={26} width={18} height={14} rx={3} />
            <rect x={4} y={26} width={18} height={14} rx={3} />
            <circle cx={28} cy={22} r={3} fill={theme.mech} stroke="none" />
          </g>
        ) : null}
      </svg>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>{name}</div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 3}}>{sub}</div>
      </div>
    </Panel>
  </div>
);

/** 右缘扫码口队列（5-B 由 archify 全屏展开，此处只作全景预告位） */
const SCAN_QUEUE = [
  {zh: '外形', x: 1560},
  {zh: '认领', x: 1655},
  {zh: '许可', x: 1750},
] as const;

const PanoramaPull: React.FC<{span: number; at02: number}> = ({span, at02}) => {
  // 拉远（decelerate）：beat 级镜头动作 ~1.6s，标尺六档无对应 → 显式帧数（铁律④注释保留）
  const pull = useProgress(0, 48, 'decelerate');
  const scale = 1.24 - 0.24 * pull;
  // 活件（一次工具调用）：自内核侧滑向扫码口队列（p5-02「活件上机器前」）
  const piece = useEnter('slideR', {at: at02, dur: DUR.f6, dist: 780});

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: '960px 540px',
        }}
      >
        <MiniCore span={span} size={300} left={150} top={420} />
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 742,
            width: 300,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.core,
          }}
        >
          {'主循环'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 780,
            width: 300,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'while True'}
        </div>

        {/* 装置自上缘挂入（mech）——连线是「挂在循环外」的静态虚线，不动画化内核 */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <g stroke={theme.mech} strokeWidth={3} strokeDasharray="6 10" opacity={0.45} fill="none">
            <path d="M300 466 C 420 420, 560 380, 700 352" />
            <path d="M300 466 C 500 400, 700 366, 990 352" />
            <path d="M300 466 C 560 420, 820 372, 1280 352" />
          </g>
          {/* 传送带流向扫码口的静态引导线（core，恒虚线） */}
          <line x1={410} y1={584} x2={1540} y2={584} stroke={theme.core} strokeWidth={4} strokeDasharray="10 12" opacity={0.4} />
          {/* 扫码口队列预告位 */}
          <text x={1663} y={478} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
            {'扫码口'}
          </text>
          {SCAN_QUEUE.map((q) => (
            <g key={q.zh}>
              <rect x={q.x} y={505} width={16} height={96} rx={5} fill="none" stroke={theme.mech} strokeWidth={3} />
              <text x={q.x + 8} y={632} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fill={theme.dim}>
                {q.zh}
              </text>
            </g>
          ))}
        </svg>

        <DeviceIcon kind="ledger" name={'号码簿'} sub={'dispatch'} left={640} top={240} />
        <DeviceIcon kind="gate" name={'门禁'} sub={'permission'} left={930} top={240} />
        <DeviceIcon kind="socket" name={'插线口'} sub={'hooks'} left={1220} top={240} />

        {/* 活件：一次工具调用（落位扫码队列头，入场自内核侧 560 → 落位 1340） */}
        <div style={{position: 'absolute', left: 1340, top: 540, width: 200, ...piece}}>
          <Panel
            accent={theme.core}
            style={{width: 200, boxSizing: 'border-box', padding: '12px 18px', textAlign: 'center'}}
          >
            <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text}}>{'tool_use'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>{'bash'}</div>
          </Panel>
        </div>
      </div>

      {/* 题词（不随镜头缩放）：随拉远落定浮现 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 140,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          fontWeight: 700,
          color: theme.text,
          opacity: clamp01(pull * 3),
        }}
      >
        {'一次调用的旅程'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C p5-08 空窗句回落：次序不乱小卡 ──────────────────────────────────

const OrderShiftCard: React.FC = () => {
  const card = useEnter('pop', {at: 2, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...card}}>
        <div style={{position: 'absolute', left: 510, top: 420}}>
          <Panel
            accent={theme.mech}
            style={{width: 900, boxSizing: 'border-box', padding: '26px 36px', textAlign: 'center'}}
          >
            <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>
              {'接入点会换 · 次序不乱'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 10}}>
              {'权限门 · 第 226 行 → 钩子口 · 第 236 行'}
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 成本排序条（p5-10..11） ─────────────────────────────────────────

/** 轴几何：机器段 220..640（毫秒刻度，密）／人段 640..1700（分钟刻度，疏）——
 *  刻度跨距夸张对比是分镜指令：相邻刻度所代表的时间量级差即成本差。 */
const AXIS = {y: 525, h: 30, mx0: 220, mx1: 640, hx0: 640, hx1: 1700} as const;
const MS_TICKS = [
  {x: 220, label: '0'},
  {x: 325, label: '50'},
  {x: 430, label: '100'},
  {x: 535, label: '150'},
  {x: 640, label: '200 ms'},
] as const;
const MIN_TICKS = [
  {x: 640, label: '0'},
  {x: 993, label: '1 min'},
  {x: 1346, label: '5 min'},
  {x: 1700, label: '10 min'},
] as const;

const CostAxis: React.FC = () => {
  const segs = useStagger(2, {at: 4, stride: 22, dur: DUR.f5});
  // 毫秒刻度滚动：机器段展开完随即读数扫到 200ms（帧驱动，无随机）
  const ms = useCount({from: 0, to: 200, at: 4 + 22 + DUR.f5, dur: DUR.f6});
  const [mach, human] = segs;

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 机器快扫段（mech）：宽度随 stagger 展开 */}
        <rect
          x={AXIS.mx0}
          y={AXIS.y}
          width={(AXIS.mx1 - AXIS.mx0) * mach}
          height={AXIS.h}
          rx={8}
          fill={theme.mech}
          opacity={0.28 + 0.72 * mach}
        />
        {/* 人应答段（dim 人色）：跨距夸张——同屏宽度代表的时间量级差三个数量级以上 */}
        <rect
          x={AXIS.hx0}
          y={AXIS.y}
          width={(AXIS.hx1 - AXIS.hx0) * human}
          height={AXIS.h}
          rx={8}
          fill={theme.dim}
          opacity={0.22 + 0.5 * human}
        />
        {MS_TICKS.map((t, i) => (
          <g key={t.label} opacity={mach}>
            <line x1={t.x} y1={555} x2={t.x} y2={568} stroke={theme.mech} strokeWidth={3} />
            <text
              x={t.x - (i === MS_TICKS.length - 1 ? 8 : 0)}
              y={596}
              textAnchor={i === MS_TICKS.length - 1 ? 'end' : 'middle'}
              fontFamily={theme.mono}
              fontSize={18}
              fill={theme.dim}
            >
              {t.label}
            </text>
          </g>
        ))}
        {MIN_TICKS.map((t, i) => (
          <g key={t.label} opacity={human}>
            <line x1={t.x} y1={555} x2={t.x} y2={568} stroke={theme.dim} strokeWidth={3} />
            <text
              x={t.x + (i === 0 ? 8 : 0)}
              y={596}
              textAnchor={i === 0 ? 'start' : 'middle'}
              fontFamily={theme.mono}
              fontSize={18}
              fill={theme.dim}
            >
              {t.label}
            </text>
          </g>
        ))}
        {/* 人色剪影：问人是唯一花你时间的一步 */}
        <g opacity={human} fill={theme.dim}>
          <circle cx={1741} cy={505} r={11} />
          <path d="M1720 548 Q1720 522 1741 520 Q1762 522 1762 548 Z" />
        </g>
      </svg>

      {/* 毫秒读数（机器段展开后滚动） */}
      <div
        style={{
          position: 'absolute',
          left: 220,
          top: 428,
          width: 420,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 44,
          fontWeight: 700,
          color: theme.mech,
          opacity: mach,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {`${Math.round(ms)} ms`}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 220,
          top: 640,
          width: 420,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 28,
          fontWeight: 700,
          color: theme.mech,
          opacity: mach,
        }}
      >
        {'机器快扫'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 640,
          top: 640,
          width: 1060,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 28,
          fontWeight: 700,
          color: theme.dim,
          opacity: human,
        }}
      >
        {'人应答'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1300,
          top: 448,
          width: 400,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.panelBorder,
          opacity: human,
        }}
      >
        {'刻度夸张 · 非等距'}
      </div>

      {/* 题词：排序因果 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 716,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 42,
          fontWeight: 700,
          color: theme.text,
        }}
      >
        <span style={{color: theme.mech}}>{'越便宜越靠前'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span style={{color: theme.dim}}>{'人的时间最后'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-F 官方安全不变量三连卡＋金句（p5-17..21） ─────────────────────────

const INVARIANTS = [
  {zh: '绕不过拒绝询问', en: 'decision ≠ bypass'},
  {zh: '阻断压过放行', en: 'block > allow'},
  {zh: '沉默 ≠ 批准', en: 'silence ≠ approve'},
] as const;

const SafetyInvariants: React.FC<{atQuote: number}> = ({atQuote}) => {
  const doc = useEnter('fade', {at: 2, dur: DUR.f5});
  const cards = useStagger(INVARIANTS.length, {at: 8, stride: 18, dur: DUR.f4});
  // 金句落定格时三连卡退后（M-003：终态停驻，一次性特效只作入场）
  const dim = useDim({at: atQuote, to: 0.3, dur: DUR.f5});
  const pair = useProgress(atQuote + DUR.f5, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: dim}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...doc}}>
          {/* 官方文档页样（零信源标识：只有「官方文档」页眉） */}
          <div style={{position: 'absolute', left: 210, top: 200}}>
            <Panel style={{width: 1500, boxSizing: 'border-box', padding: '24px 36px'}}>
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
                <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>
                  {'hooks · safety invariants'}
                </span>
              </div>
              <div style={{display: 'flex', gap: 24, marginTop: 24}}>
                {INVARIANTS.map((v, i) => (
                  <div
                    key={v.zh}
                    style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 20}px)`}}
                  >
                    <NumberedCard index={i + 1} label={v.zh} sub={v.en} active={cards[i] > 0.5} width={440} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* 金句定格（p5-21 收拢句；caption-dup-ok：定格记忆点，主字已压短非逐字） */}
      <Sequence from={atQuote} layout="none">
        <div style={{position: 'absolute', left: 260, top: 480, width: 1400, height: 320}}>
          <QuoteCard zh="只能收紧 · 不能放松" />
        </div>
      </Sequence>
      {/* 对句小字（画面代言，口播已删） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 822,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 30,
          color: theme.dim,
          opacity: pair,
        }}
      >
        {'能加锁 · 不能配钥匙'}
      </div>
      <Footnote delay={8}>
        {"Hook decisions don't bypass permission rules · exit 2 · staying silent doesn't approve it"}
      </Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5CheckChain: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-05');
  const bC = w('p5-06', 'p5-09');
  const bD = w('p5-10', 'p5-11');
  const bE = w('p5-12', 'p5-16');
  const bF = w('p5-17', 'p5-21');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="5-A 全景拉远">
        <SceneTag chapter="Check Chain" tagline="上件前扫码" />
        <PanoramaPull span={bA.durationInFrames} at02={at('p5-02') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="5-B 三道扫码口">
        {/* 前镜（5-A 自制装置）无图 → 首章默认入场；实例内三章背靠背自动抑制换章弹入 */}
        <ArchifyRecap
          slug="checkchain-order"
          caption="校验链"
          cues={[
            {chapterId: 'scan-form', at: at('p5-03') - bB.from, durationInFrames: dur('p5-03')},
            {chapterId: 'scan-claim', at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')},
            {chapterId: 'scan-permit', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 全绿通电与红灯拦截">
        {/* 可见岛 p5-08；窗 = 本镜 3 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p5-06') - bC.from, durationInFrames: dur('p5-06')},
            {at: at('p5-07') - bC.from, durationInFrames: dur('p5-07')},
            {at: at('p5-09') - bC.from, durationInFrames: dur('p5-09')},
          ]}
        >
          {/* 多挂 f3 帧：让位淡出盖满后再卸载 */}
          <Sequence from={at('p5-08') - bC.from} durationInFrames={dur('p5-08') + DUR.f3}>
            <OrderShiftCard />
          </Sequence>
        </ArchifyYield>
        {/* 5-B scan-permit（p5-05）与本镜首章（p5-06）跨实例背靠背 → lead={false} */}
        <ArchifyRecap
          slug="checkchain-order"
          caption="校验链"
          lead={false}
          cues={[
            {chapterId: 'green-relay', at: at('p5-06') - bC.from, durationInFrames: dur('p5-06')},
            {chapterId: 'red-halt', at: at('p5-07') - bC.from, durationInFrames: dur('p5-07')},
          ]}
        />
        {/* p5-08 空窗后重现 → 独立实例、默认入场 */}
        <ArchifyRecap
          slug="checkchain-order"
          caption="校验链"
          cues={[{chapterId: 'order-stable', at: at('p5-09') - bC.from, durationInFrames: dur('p5-09')}]}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 成本排序条">
        <CostAxis />
      </Sequence>

      <Sequence {...bE} name="5-E 全景对账">
        {/* 5-D 自制装置隔开两实例 → 默认入场；五句五接力无空窗（复用图，与 P0 同 slug 同 caption） */}
        <ArchifyRecap
          slug="execution-panorama"
          caption="执行全景"
          cues={[
            {chapterId: 'recount', at: at('p5-12') - bE.from, durationInFrames: dur('p5-12')},
            {chapterId: 'debt-ledger', at: at('p5-13') - bE.from, durationInFrames: dur('p5-13')},
            {chapterId: 'device-per-chapter', at: at('p5-14') - bE.from, durationInFrames: dur('p5-14')},
            {chapterId: 'skeleton-verbatim', at: at('p5-15') - bE.from, durationInFrames: dur('p5-15')},
            {chapterId: 'vow-cashed', at: at('p5-16') - bE.from, durationInFrames: dur('p5-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="5-F 安全不变量">
        <SafetyInvariants atQuote={at('p5-21') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5CheckChain;
