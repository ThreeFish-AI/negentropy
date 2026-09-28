/** P0 人肉循环（p0-01..16，5 镜 2 cue）——分镜 0-A…0-E。
 *
 *  cue 清单（2）：
 *   0-C execution-panorama/belt-lap@p0-06（全景一瞥，默认 lead）
 *   0-E five-layer-dependency/layer-preview@p0-15（悬念立碑一闪，默认 lead）
 *
 *  ★ 0-A 的 3D 五层栈由 components/harness-stack.tsx 的 HarnessStackP0 承担
 *    （落板/本集层呼吸/缩退全在其内）；scene 侧只补主问题字卡与角标。
 *  ★ Badge 顶边带冲突处理：frozen ChapterProgress 占 y14–42，HarnessStackP0 内置
 *    交叉淡入的常驻条钉在 top:12（EP1 发布时形态）——本集各幕 Badge 已定案下移
 *    top:64（见 P1/P2 BADGE_STYLE 注释）。故 0-A 在 crossAt 处把整个
 *    HarnessStackP0 包一层 5 帧淡杀（内置 top:12 条在可见前归零），同时以同拍
 *    淡入本幕自己的 top:64 Badge，完成位置迁移且零双影（shared 组件不改的
 *    调用点侧解法）。
 *  ★ 恒定空间契约自此幕生效：内核（LoopRing，core 橙恒描边〔M-001〕）恒居左中
 *    锚位 RING = (330, 540)；装置（mech 青）自右缘挂入（0-E 三剪影）。
 *  ★ 0-B 是「无循环世界」——刻意不出现 LoopRing（循环尚不存在）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, SceneTag, Terminal} from '../components/motifs';
import {HarnessBadge, HarnessStackP0, harnessStackCrossAt} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  useBreathe,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P1/P2 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 内核左中锚位（cx 330 / cy 540）与巡游节律——与 P1 1-G、P2 全幕同位同尺同速。 */
const RING = {size: 300, left: 180, top: 390} as const;
const LAP_FRAMES = 75;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（人=dim 灰 / 师傅=text 白，一律无彩） */
const Person: React.FC<{x: number; y: number; color: string; scale?: number; opacity?: number}> = ({
  x,
  y,
  color,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

/** 金句卡衬底：给定格 QuoteCard 一层深底 scrim，压住背后的环/剪影保证可读。 */
const QuoteScrim: React.FC<{children: React.ReactNode}> = ({children}) => {
  const o = useProgress(DUR.f2, DUR.f4);
  return <AbsoluteFill style={{background: withAlpha(theme.bg, 0.88 * o)}}>{children}</AbsoluteFill>;
};

// ── 0-A 五层栈开卷 + 主问题字卡 ──────────────────────────────────────────

/** 开卷：3D 栈落板/呼吸/缩退在 HarnessStackP0；本组件只管「凭什么敢」字卡、
 *  Badge 位置迁移（见文件头）与 while True 预告角标。 */
const OpeningStack: React.FC<{durA: number}> = ({durA}) => {
  // 缩退锚：句内 60% 处（栈高亮+两次呼吸约 65 帧完成，先于缩退；句长实测 ≥4s）
  const recedeAt = Math.max(70, Math.round(durA * 0.6));
  const crossAt = harnessStackCrossAt(recedeAt);
  // 内置 top:12 常驻条可见前的整层淡杀（f3：比内置 8 帧交叉快，残影峰值 ~0.15 后归零）
  const kill = useProgress(crossAt, DUR.f3);
  // 同拍淡入 top:64 的本集 Badge（帧数对齐内置交叉 8 帧）
  const badgeIn = useProgress(crossAt, 8);

  // 主问题字卡：栈呼吸收束后进场，句尾自淡出（SceneFade 只管幕间）
  const atCard = Math.round(durA * 0.38);
  const cardIn = useProgress(atCard, DUR.f5);
  const cardOut = useProgress(durA - DUR.f5, DUR.f5);
  // 「敢」字 deny 红点睛：一次性强调（sin 包络自衰减）
  const gan = useImpulse({at: atCard + DUR.f3, dur: DUR.f6, peak: 1});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{opacity: 1 - kill}}>
        <HarnessStackP0 recedeAt={recedeAt} />
      </div>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />

      {/* 主问题字卡（≤6 字形态；「敢」字红点睛） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 764,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 66,
          fontWeight: 700,
          color: theme.text,
          opacity: cardIn * (1 - cardOut),
          transform: `translateY(${(1 - cardIn) * 18}px)`,
        }}
      >
        <span>{'凭什么'}</span>
        <span
          style={{
            color: theme.deny,
            display: 'inline-block',
            transform: `translateY(${-4 * gan}px) scale(${1 + 0.08 * gan})`,
            textShadow: `0 0 ${26 * gan}px ${withAlpha(theme.deny, 0.9)}`,
          }}
        >
          {'敢'}
        </span>
        <span>{'？'}</span>
      </div>

      <Footnote delay={Math.round(durA * 0.42)}>{'while True'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-B 无循环世界分屏 ───────────────────────────────────────────────────

/** 左：师傅吐一条命令即停；右：人工回路（你跑命令、贴输出的往复箭头，dim 人色）。 */
const NoLoopSplit: React.FC<{at03: number; at04: number; span: number}> = ({at03, at04, span}) => {
  const frame = useCurrentFrame();
  const left = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 46});
  const right = useEnter('slideR', {at: at03 - DUR.f4, dur: DUR.f5, dist: 46});
  // 终端：p0-02 句内敲一条命令即冻住（「吐完就停」的落点）
  const TYPE_AT = 14;
  const FREEZE_AT = TYPE_AT + Math.ceil((13 / 11) * 30) + 2;
  const stopped = useProgress(FREEZE_AT + 4, DUR.f4);
  // 人工回路：三段往复箭头行进虚线（dim——人开口才上色）
  const flow = useFlowDash({dash: 12, gap: 14, period: 42});
  const midlayer = useProgress(at04 + DUR.f3, DUR.f5);
  // 来回计数：帧驱动确定性（3s 一个来回，自 p0-03 起算）
  const laps = Math.max(0, Math.floor((frame - at03 - DUR.f5) / 90));

  const relay = (x1: number, y1: number, x2: number, y2: number, label: string, lx: number, ly: number) => (
    <g key={`${x1}-${y1}-${label}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.dim} strokeWidth={4} {...flow} />
      <circle cx={x2} cy={y2} r={6} fill={theme.dim} />
      <text x={lx} y={ly} fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
        {label}
      </text>
    </g>
  );

  return (
    <AbsoluteFill>
      {/* 左屏：无循环 */}
      <div style={{position: 'absolute', left: 96, top: 236, ...left}}>
        <Panel style={{width: 828, height: 608, boxSizing: 'border-box'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              padding: '18px 26px 12px',
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'无循环'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'no loop'}</span>
          </div>
          <Person x={352} y={318} color={theme.text} />
          <div style={{position: 'absolute', left: 118, top: 528}}>
            <Terminal
              width={592}
              height={216}
              cps={11}
              freezeCursorAt={FREEZE_AT}
              lines={[{text: 'cat notes.md', delay: TYPE_AT, prompt: '$'}]}
            />
          </div>
          {/* 摊手停住：命令敲完即冻结，一枚「停」戳 */}
          <div
            style={{
              position: 'absolute',
              right: 26,
              top: 540,
              opacity: stopped,
              transform: `rotate(-8deg) scale(${0.8 + 0.2 * stopped})`,
              border: `3px solid ${theme.dim}`,
              borderRadius: 10,
              padding: '8px 18px',
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 700,
              color: theme.dim,
            }}
          >
            {'停'}
          </div>
        </Panel>
      </div>

      {/* 右屏：人工回路 */}
      <div style={{position: 'absolute', left: 996, top: 236, ...right}}>
        <Panel style={{width: 828, height: 608, boxSizing: 'border-box'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              padding: '18px 26px 12px',
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'人肉回路'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'human relay'}</span>
          </div>
          <svg width={776} height={430} style={{position: 'absolute', left: 26, top: 120}}>
            {/* 模型（上）→ 终端（右下）：命令 */}
            {relay(214, 96, 560, 250, '命令', 348, 150)}
            {/* 终端 → 你（左下）：输出 */}
            {relay(560, 300, 300, 372, '输出', 452, 366)}
            {/* 你 → 模型：贴回 */}
            {relay(236, 356, 176, 150, '贴回', 96, 262)}
            <circle cx={176} cy={76} r={26} fill={theme.text} />
            <path d="M116 96 Q116 20 176 16 Q236 20 236 96 Z" fill={theme.text} />
            <text x={176} y={140} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
              {'模型'}
            </text>
            <rect x={522} y={248} width={96} height={58} rx={8} fill="none" stroke={theme.dim} strokeWidth={3} />
            <text x={570} y={285} textAnchor="middle" fontFamily={theme.mono} fontSize={22} fill={theme.dim}>
              {'sh'}
            </text>
          </svg>
          <Person x={226} y={330} color={theme.dim} scale={0.78} />
          {/* 来回计数（帧驱动 meter） */}
          <div
            style={{
              position: 'absolute',
              right: 30,
              bottom: 26,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.dim,
              fontVariantNumeric: 'tabular-nums',
              opacity: frame >= at03 + DUR.f5 ? 1 : 0,
            }}
          >
            {`来回 ×${laps}`}
          </div>
        </Panel>
      </div>

      {/* p0-04：你 = 中间层 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 878,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 34,
          fontWeight: 600,
          opacity: midlayer,
        }}
      >
        <span style={{color: theme.dim}}>{'你 = '}</span>
        <span style={{color: theme.text}}>{'中间层'}</span>
      </div>

      <Footnote delay={TYPE_AT}>{'cat'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-C while True 落下，把「人」换下场 ──────────────────────────────────

/** 「人肉循环」字卡淡出 → while True 字卡（mono）落下换人下场；循环三拍微缩首现
 *  （LoopRing 首锚〔M-001〕，左中锚位）。p0-06 的全景一瞥让位由幕组装层 ArchifyYield 承担。 */
const WhileTrueDrop: React.FC<{dur05: number; at07: number; span: number}> = ({dur05, at07, span}) => {
  // 旧世界退场：p0-05 后半，「人肉循环」卡与「你」一同下场
  const oldIn = useProgress(2, DUR.f4);
  const oldOut = useProgress(Math.round(dur05 * 0.52), DUR.f5);
  const youOut = useProgress(Math.round(dur05 * 0.42), DUR.f5);
  // while True 卡下落换人（本镜唯一 token：字卡下落）
  const wt = useEnter('fall', {at: Math.round(dur05 * 0.34), dur: DUR.f5, dist: 120});
  // 环首现：beat 级描线（~1.4s，落在时长标尺外，保留显式帧数）
  const ringDraw = useProgress(4, 42, 'decelerate');
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  const v1Tag = useProgress(at07 + DUR.f3, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 内核左中锚位：循环三拍微缩首现（恒色恒线宽，M-001） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} dotProgress={ringDraw + laps} showLabels={false} />
      </div>

      {/* 旧卡「人肉循环」居中退场 */}
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 430,
          width: 400,
          textAlign: 'center',
          opacity: oldIn * (1 - oldOut),
        }}
      >
        <Panel style={{padding: '22px 30px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 40, fontWeight: 600, color: theme.dim}}>{'人肉循环'}</span>
        </Panel>
      </div>
      {/* 「你」在环边被换下场 */}
      <Person x={508} y={452} color={theme.dim} scale={0.72} opacity={oldIn * (1 - youOut)} />

      {/* while True 卡落下接管中心 */}
      <div style={{position: 'absolute', left: 742, top: 418, ...wt}}>
        <Panel accent={theme.core} style={{padding: '20px 34px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 54, fontWeight: 700, color: theme.core}}>{'while True'}</span>
        </Panel>
      </div>

      {/* p0-07：第一代用法收论 */}
      <div
        style={{
          position: 'absolute',
          left: RING.left - 20,
          top: RING.top + RING.size + 18,
          width: RING.size + 40,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 28,
          opacity: v1Tag,
        }}
      >
        <span style={{color: theme.dim}}>{'人 = '}</span>
        <span style={{color: theme.core}}>{'循环'}</span>
      </div>

      <Footnote delay={2}>{'while True'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-D 三债三卡 + 循环体膨胀滚屏 ────────────────────────────────────────

const DEBTS = [
  {no: '01', zh: '能力债', en: 'capability', accent: theme.mech},
  {no: '02', zh: '安全债', en: 'safety', accent: theme.deny},
  {no: '03', zh: '扩展债', en: 'extension', accent: theme.mech},
] as const;

/** 循环体基线（膨胀前）与膨胀追加行（p0-12 起，日志/约束/自动动作叠进框体） */
const LOOP_BASE = ['while True:', '    msg = ask(model)', '    for c in msg.tools:', '        run(c)'] as const;
const LOOP_ADDS = ['    + log()', '    + guard()', '    + auto_save()', '    + retry()'] as const;

/** 三债开账：三卡并列（stagger 骨架 → 逐句激活）；while True 框体膨胀滚屏 +
 *  rm -rf 危险卡闪现（不口播）。 */
const ThreeDebts: React.FC<{at09: number; at10: number; at11: number; at12: number; at13: number}> = ({
  at09,
  at10,
  at11,
  at12,
  at13,
}) => {
  // 三卡骨架依次入场（p0-08 开账句）
  const slots = useStagger(DEBTS.length, {at: DUR.f3, stride: 6, dur: DUR.f4});
  // 逐句激活（帧序即口播序：能力 p0-09 / 安全 p0-10 / 扩展 p0-12）
  const actCap = useProgress(at09, DUR.f4);
  const actSafe = useProgress(at10, DUR.f4);
  const actExt = useProgress(at12, DUR.f4);
  const acts = [actCap, actSafe, actExt];

  // 膨胀滚屏：基线行 p0-08 句内流出，追加行 p0-12 起逐行叠进
  const base0 = useReveal(LOOP_BASE[0], {at: 8, cps: 14});
  const base1 = useReveal(LOOP_BASE[1], {at: 22, cps: 16});
  const base2 = useReveal(LOOP_BASE[2], {at: 36, cps: 16});
  const base3 = useReveal(LOOP_BASE[3], {at: 50, cps: 16});
  const bases = [base0, base1, base2, base3];
  const add0 = useReveal(LOOP_ADDS[0], {at: at12 + 2, cps: 12});
  const add1 = useReveal(LOOP_ADDS[1], {at: at12 + 26, cps: 12});
  const add2 = useReveal(LOOP_ADDS[2], {at: at12 + 50, cps: 12});
  const add3 = useReveal(LOOP_ADDS[3], {at: at12 + 74, cps: 12});
  const adds = [add0, add1, add2, add3];

  // 危险卡：p0-11（删库句）rm -rf 红闪（sin 包络自衰减），随后退为常驻暗条
  const danger = useImpulse({at: at11, dur: DUR.f6, peak: 1});
  const dangerRest = useProgress(at11 + DUR.f5, DUR.f4);
  // p0-13「认不出来了」：框体过载——微胀 + 渐糊（effects 通道，时长+缓动）
  const overload = useProgress(at13, DUR.f6);

  return (
    <AbsoluteFill>
      {/* 三债三卡并列 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 176,
          width: 1920,
          display: 'flex',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        {DEBTS.map((d, i) => {
          const a = acts[i];
          return (
            <div key={d.no} style={{opacity: slots[i], transform: `translateY(${(1 - slots[i]) * 20}px)`}}>
              <Panel
                accent={a > 0.5 ? d.accent : theme.panelBorder}
                style={{
                  width: 372,
                  boxSizing: 'border-box',
                  padding: '18px 24px',
                  boxShadow: a > 0.5 ? `0 0 ${16 * a}px ${withAlpha(d.accent, 0.5 * a)}` : undefined,
                }}
              >
                <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
                  <span style={{fontFamily: theme.mono, fontSize: 24, color: a > 0.5 ? d.accent : theme.dim}}>
                    {d.no}
                  </span>
                  <span
                    style={{
                      fontFamily: theme.sans,
                      fontSize: 36,
                      fontWeight: 700,
                      color: a > 0.5 ? theme.text : theme.dim,
                    }}
                  >
                    {d.zh}
                  </span>
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 6}}>{d.en}</div>
              </Panel>
            </div>
          );
        })}
      </div>

      {/* 安全债的实证：rm -rf 危险卡闪现（不口播，deny） */}
      <div
        style={{
          position: 'absolute',
          left: 852,
          top: 262,
          opacity: Math.max(danger, 0.75 * dangerRest),
          transform: `scale(${0.86 + 0.14 * Math.max(danger, dangerRest)}) rotate(-4deg)`,
        }}
      >
        <Panel accent={theme.deny} style={{padding: '8px 18px', background: withAlpha(theme.deny, 0.12)}}>
          <span style={{fontFamily: theme.mono, fontSize: 28, fontWeight: 700, color: theme.deny}}>{'rm -rf'}</span>
        </Panel>
      </div>

      {/* while True 框体：膨胀滚屏 → 过载渐糊 */}
      <div
        style={{
          position: 'absolute',
          left: 596,
          top: 452,
          transform: `scale(${1 + 0.06 * overload})`,
          transformOrigin: '50% 20%',
          filter: `blur(${1.8 * overload}px)`,
        }}
      >
        <Panel accent={overload > 0.5 ? theme.panelBorder : theme.core} style={{width: 728, height: 380, boxSizing: 'border-box'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 20px',
              borderBottom: `2px solid ${theme.panelBorder}`,
              opacity: 1 - 0.35 * overload,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 26, fontWeight: 700, color: theme.core}}>{'while True'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'loop body'}</span>
          </div>
          <div style={{padding: '16px 22px', fontFamily: theme.mono, fontSize: 26, lineHeight: 1.72}}>
            {bases.map((ln, i) => (
              <div key={`b${i}`} style={{color: i === 0 ? theme.core : theme.text, whiteSpace: 'pre'}}>
                {ln ? ln : ' '}
              </div>
            ))}
            {adds.map((ln, i) => (
              <div key={`a${i}`} style={{color: theme.dim, whiteSpace: 'pre'}}>
                {ln ? ln : ' '}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Footnote delay={DUR.f3}>{'while True'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-E 悬念立碑：三债三挂法 ─────────────────────────────────────────────

/** 三层装置剪影（mech 青，右缘挂入，不触碰左中内核锚位）。 */
const HANGS = [
  {zh: '号码簿', en: 'registry'},
  {zh: '门禁', en: 'gate'},
  {zh: '插线口', en: 'hooks'},
] as const;

const Monument: React.FC<{at16: number; span: number}> = ({at16, span}) => {
  const cardIn = useProgress(2, DUR.f4);
  // 「更聪明的循环」划线否掉（decelerate；否定语义走 deny）
  const strike = useProgress(DUR.f5, DUR.f5, 'decelerate');
  // 内核恒在（左中锚位，draw=1 承 0-C 终态）＋匀速巡游
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  // 三剪影右缘挂入（p0-16，错峰 5 帧）+ 常驻辉光（mech，相位错峰）
  const hang0 = useEnter('slideR', {at: at16 + 2, dur: DUR.f5, dist: 60});
  const hang1 = useEnter('slideR', {at: at16 + 7, dur: DUR.f5, dist: 60});
  const hang2 = useEnter('slideR', {at: at16 + 12, dur: DUR.f5, dist: 60});
  const hangs = [hang0, hang1, hang2];
  const glow0 = useBreathe({period: 46, amp: 0.4, base: 0.6});
  const glow1 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 15});
  const glow2 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 30});
  const glows = [glow0, glow1, glow2];

  return (
    <AbsoluteFill>
      {/* 内核左中锚位（装置永不触碰） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} dotProgress={laps} showLabels={false} />
      </div>

      {/* 悬念卡：更聪明的循环 → 划线否掉 */}
      <div style={{position: 'absolute', left: 706, top: 400, width: 460, opacity: cardIn}}>
        <Panel style={{padding: '24px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 42, fontWeight: 600, color: theme.dim}}>{'更聪明的循环'}</span>
        </Panel>
        <svg width={460} height={16} viewBox="0 0 460 16" style={{position: 'absolute', left: 0, top: 44}}>
          <line
            x1={26}
            y1={8}
            x2={434}
            y2={8}
            stroke={theme.deny}
            strokeWidth={6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - strike}
          />
        </svg>
      </div>

      {/* 三层装置剪影：自右缘挂入（p0-16 与金句卡同场，mech 常驻辉光） */}
      {HANGS.map((h, i) => (
        <div key={h.zh} style={{position: 'absolute', left: 1548, top: 286 + i * 150, ...hangs[i]}}>
          <Panel
            accent={theme.mech}
            style={{
              width: 268,
              boxSizing: 'border-box',
              padding: '14px 20px',
              boxShadow: `0 0 ${18 * glows[i]}px ${withAlpha(theme.mech, 0.45 * glows[i])}`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
              <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.mech}}>{h.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{h.en}</span>
            </div>
          </Panel>
        </div>
      ))}

      {/* p0-16 金句卡定格（caption-dup-ok：压短形态记忆点，storyboard 已豁免） */}
      <Sequence from={at16} durationInFrames={Math.max(1, span - at16)}>
        <QuoteScrim>
          <QuoteCard zh="三债三挂法 · 循环一行不改" />
        </QuoteScrim>
      </Sequence>

      <Footnote delay={DUR.f4}>{'while True'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0HumanLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01');
  const bB = w('p0-02', 'p0-04');
  const bC = w('p0-05', 'p0-07');
  const bD = w('p0-08', 'p0-13');
  const bE = w('p0-14', 'p0-16');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 五层栈开卷（3D）">
        <SceneTag chapter="Human Loop" tagline="人肉循环" />
        <OpeningStack durA={bA.durationInFrames} />
      </Sequence>

      <Sequence {...bB} name="0-B 无循环分屏">
        <HarnessBadge style={BADGE_STYLE} />
        <NoLoopSplit at03={at('p0-03') - bB.from} at04={at('p0-04') - bB.from} span={bB.durationInFrames} />
      </Sequence>

      <Sequence {...bC} name="0-C while True 换人下场">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-05 / p0-07；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-06') - bC.from, durationInFrames: dur('p0-06')}]}>
          <WhileTrueDrop dur05={dur('p0-05')} at07={at('p0-07') - bC.from} span={bC.durationInFrames} />
        </ArchifyYield>
        {/* cue 1/2：execution-panorama/belt-lap（全景一瞥；前镜无图 → 默认入场） */}
        <ArchifyRecap
          slug="execution-panorama"
          caption="执行全景"
          cues={[{chapterId: 'belt-lap', at: at('p0-06') - bC.from, durationInFrames: dur('p0-06')}]}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 三债三卡">
        <HarnessBadge style={BADGE_STYLE} />
        <ThreeDebts
          at09={at('p0-09') - bD.from}
          at10={at('p0-10') - bD.from}
          at11={at('p0-11') - bD.from}
          at12={at('p0-12') - bD.from}
          at13={at('p0-13') - bD.from}
        />
      </Sequence>

      <Sequence {...bE} name="0-E 悬念立碑">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-14 / p0-16；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-15') - bE.from, durationInFrames: dur('p0-15')}]}>
          <Monument at16={at('p0-16') - bE.from} span={bE.durationInFrames} />
        </ArchifyYield>
        {/* cue 2/2：five-layer-dependency/layer-preview（立碑一闪；p0-06 后空窗长 → 默认入场） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[{chapterId: 'layer-preview', at: at('p0-15') - bE.from, durationInFrames: dur('p0-15')}]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0HumanLoop;
