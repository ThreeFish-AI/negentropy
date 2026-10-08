/** P0 一个到一群（p0-01..15，3 镜 3 cue）——分镜 0-A…0-C。
 *
 *  cue 清单（3）：
 *   0-B board-vs-todo/todo-vanishes@p0-10（待办断电即失；本集首现实例，默认入场）
 *   0-C collab-panorama/one-to-many@p0-12（从一个到一群；空窗一句后，默认入场）
 *   0-C five-layer-dependency/series-vow@p0-15（系列立碑一闪＋章尾金句小卡；默认入场）
 *
 *  ★ 0-A 开场（系列片头铺开，2026-10-08，沿 ep1 先例 0fed97ec5）：五层栈落板/
 *    本集层「多 Agent 平台」点亮职责已由系列片头 components/series-intro.tsx 吸收
 *    （压 leadIn 时段）——scene 侧补常驻条 Badge 直接淡入、主问题字卡与「多 Agent」
 *    预告角标；HarnessStackP0 退役（Badge 顶边带冲突处理随落板一并退役）。
 *  ★ p0-04「前面亮灯的几个区」的指代由常驻条承接：片头末段本集站定格、前四站为已播
 *    实心态，Badge 直入后条带即那五个 chip，「前面亮灯的几个区」仍有物可指。
 *  ★ 恒定空间契约自此幕生效：传送带母题（LoopRing，core 橙恒定描边〔M-001〕）恒居
 *    左中锚位 RING（0-C 起）；五物件剪影按工坊分区自右缘／上缘挂入（环形预告位，
 *    不触碰锚位）。
 *  ★ 0-B 三重困境的第三行（待办断电即失）由 todo-vanishes 章承担——章标签与该行
 *    同文案，行卡在 p0-10 窗首让位画框（第三行的展开即回放本身，行卡只亮相交接）。
 *  ★ 0-B 子活卡按本集反枚举色彩契约落 panel 底＋编号＋mono 角标（auth/db/route/
 *    test），不逐卡配色；「滑出」由位移与压暗表达，deny 只留给断电即失的危险语义。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  useBreathe,
  useEnter,
  useImpulse,
  useProgress,
  useShake,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，本集各幕 Badge 统一 top:64。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 内核左中锚位与巡游节律——全系列恒定（与 P6 6-B/6-D 同位同尺同速）。 */
const RING = {size: 300, left: 180, top: 390} as const;
const LAP_FRAMES = 75;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（师傅 = text 白，一律无彩） */
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

// ── 0-A 开场：Badge 直入 + 主问题字卡 ────────────────────────────────────

/** 开卷（片头铺开简化版）：五层展示已在系列片头完成，本组件管常驻条 Badge 淡入、
 *  主问题字卡（「一个人」三字 mech 金点睛）与「多 Agent」预告角标。 */
const OpeningStack: React.FC<{at05: number; durA: number}> = ({at05, durA}) => {
  // 常驻条：片头渐出后直接淡入（f3 起手 + f4 时长）；p0-04 前已就位，供「前面亮灯的几个区」指代
  const badgeIn = useProgress(DUR.f3, DUR.f4);

  // 主问题字卡：p0-05 问句落地，句尾自淡出（SceneFade 只管幕间）
  const cardIn = useProgress(at05 + DUR.f2, DUR.f5);
  const cardOut = useProgress(durA - DUR.f5, DUR.f5);
  // 「一个人」金点睛：一次性强调（sin 包络自衰减）
  const spark = useImpulse({at: at05 + DUR.f4, dur: DUR.f6, peak: 1});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />

      {/* 主问题字卡（≤6 字形态；「一个人」三字 mech 金点睛） */}
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
        <span
          style={{
            color: theme.mech,
            display: 'inline-block',
            transform: `translateY(${-4 * spark}px) scale(${1 + 0.06 * spark})`,
            textShadow: `0 0 ${26 * spark}px ${withAlpha(theme.mech, 0.9)}`,
          }}
        >
          {'一个人'}
        </span>
        <span>{'干不完？'}</span>
      </div>

      {/* 预告角标：p0-05 问句落地同拍出现（下一句即揭题） */}
      <Footnote delay={at05 + DUR.f3}>{'多 Agent'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-B 台面溢出装置 ─────────────────────────────────────────────────────

/** 四张子活卡（panel 底＋编号＋mono 角标；「重构整个后端」拆出的四路） */
const SUBTASKS = [
  {no: '01', zh: '认证', en: 'auth', x: 168, y: 486, rot: -2},
  {no: '02', zh: '数据库', en: 'db', x: 344, y: 502, rot: 1.5},
  {no: '03', zh: '路由', en: 'route', x: 520, y: 486, rot: -1},
  {no: '04', zh: '测试', en: 'test', x: 668, y: 502, rot: 2},
] as const;

/** 台面溢出：师傅台面（coreDeep）＋子活卡堆叠滑落＋三重困境行推进（右列）。 */
const OverflowBench: React.FC<{
  at06: number;
  at07: number;
  at08: number;
  at09: number;
  at10: number;
  dur06: number;
}> = ({at06, at07, at08, at09, at10, dur06}) => {
  // 「重构整个后端」字卡：p0-06 开句即立
  const parentIn = useProgress(2, DUR.f4);
  // 子活卡四张弹入：p0-06 中段「一起动」
  const subs = useStagger(SUBTASKS.length, {at: Math.round(at06 + dur06 * 0.45), stride: 5, dur: DUR.f4});
  // 物件滑落抖动（decay）：p0-07「认证的细节早滑出了台面」
  const shake = useShake({at: at07, amp: 4, decay: true, dur: DUR.f5});
  // 认证卡滑出（位移+压暗，不用色相表否定）；路由卡同拍点亮（修到路由）
  const authOff = useProgress(at07 + DUR.f3, DUR.f5);
  const routeOn = useProgress(at07 + DUR.f4, DUR.f4);
  // 三行推进：摆不下（p0-08）／串行（p0-09，箭头依次）／断电即失（p0-10 窗首交接）
  const row1 = useProgress(at08, DUR.f4);
  const row2 = useProgress(at09, DUR.f4);
  const arrows = useStagger(SUBTASKS.length - 1, {at: at09 + 4, stride: 9, dur: DUR.f4});
  // 第三行锚 p0-10 边界前一个 token（EP1 同款前置锚法）：完整亮相后由同文案章接管
  const row3 = useProgress(at10 - DUR.f6, DUR.f4);

  const rowCard = (
    on: number,
    accent: string,
    label: string,
    top: number,
    children: React.ReactNode,
  ) => (
    <div
      style={{
        position: 'absolute',
        left: 940,
        top,
        opacity: on,
        transform: `translateX(${(1 - on) * 26}px)`,
      }}
    >
      <Panel accent={accent} style={{width: 840, boxSizing: 'border-box', padding: '16px 24px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          {children}
          <span
            style={{
              fontFamily: theme.sans,
              fontSize: 34,
              fontWeight: 600,
              color: accent === theme.panelBorder ? theme.text : accent,
            }}
          >
            {label}
          </span>
        </div>
      </Panel>
    </div>
  );

  return (
    <AbsoluteFill>
      {/* 师傅 + 台面（coreDeep 底材——内核细节色，仅此一处作台面） */}
      <Person x={352} y={278} color={theme.text} scale={0.85} />
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 470,
          width: 720,
          height: 190,
          borderRadius: 14,
          background: theme.coreDeep,
          boxShadow: `0 0 0 2px ${withAlpha(theme.coreDeep, 0.6)}`,
        }}
      />

      {/* 「重构整个后端」字卡（拆分源） */}
      <div style={{position: 'absolute', left: 150, top: 214, opacity: parentIn}}>
        <Panel accent={theme.coreDeep} style={{padding: '12px 22px'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {'重构整个后端'}
          </span>
        </Panel>
      </div>

      {/* 子活卡四张：弹入堆上台面 → p0-07 认证滑出、路由点亮 */}
      <div style={{position: 'absolute', left: 0, top: 0, transform: `translateX(${shake}px)`}}>
        {SUBTASKS.map((t, i) => {
          const on = subs[i];
          const off = i === 0 ? authOff : 0;
          const hot = i === 2 ? routeOn : 0;
          return (
            <div
              key={t.en}
              style={{
                position: 'absolute',
                left: t.x - off * 420,
                top: t.y + off * 90,
                transform: `rotate(${t.rot}deg) translateY(${(1 - on) * 22}px)`,
                opacity: on * (1 - 0.8 * off),
              }}
            >
              <Panel
                accent={hot > 0.5 ? theme.text : theme.panelBorder}
                style={{
                  width: 158,
                  boxSizing: 'border-box',
                  padding: '10px 14px',
                  boxShadow: hot > 0.5 ? `0 0 ${12 * hot}px ${withAlpha(theme.text, 0.3 * hot)}` : undefined,
                }}
              >
                <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                  <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{t.no}</span>
                  <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{t.en}</span>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text, marginTop: 2}}>
                  {t.zh}
                </div>
              </Panel>
            </div>
          );
        })}
      </div>

      {/* 三重困境行推进（第三行由 todo-vanishes 章承担，行卡窗首交接后隐入画框） */}
      {rowCard(
        row1,
        theme.panelBorder,
        '台面摆不下',
        292,
        <svg width={84} height={56} viewBox="0 0 84 56">
          <rect x={4} y={30} width={76} height={18} rx={4} fill="none" stroke={theme.dim} strokeWidth={3} />
          <rect x={10} y={16} width={16} height={10} rx={2} fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <rect x={32} y={16} width={16} height={10} rx={2} fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <rect x={54} y={12} width={16} height={10} rx={2} fill="none" stroke={theme.dim} strokeWidth={2.5} transform="rotate(14 62 17)" />
        </svg>,
      )}
      {rowCard(
        row2,
        theme.panelBorder,
        '一双手串行',
        436,
        <svg width={560} height={40} viewBox="0 0 560 40">
          {['auth', 'db', 'route', 'test'].map((t, i) => (
            <g key={t}>
              <rect
                x={16 + i * 180}
                y={6}
                width={78}
                height={28}
                rx={6}
                fill="none"
                stroke={theme.dim}
                strokeWidth={2.5}
              />
              <text
                x={55 + i * 180}
                y={26}
                textAnchor="middle"
                fontFamily={theme.mono}
                fontSize={17}
                fill={theme.dim}
              >
                {t}
              </text>
            </g>
          ))}
          {[0, 1, 2].map((i) => {
            const p = arrows[i];
            return (
              <g key={i} opacity={p}>
                <line
                  x1={102 + i * 180}
                  y1={20}
                  x2={102 + i * 180 + 68 * p}
                  y2={20}
                  stroke={theme.dim}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                {p > 0.9 ? (
                  <path
                    d={`M${170 + i * 180} 14 l8 6 l-8 6`}
                    fill="none"
                    stroke={theme.dim}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>,
      )}
      {rowCard(
        row3,
        theme.deny,
        '待办断电即失',
        580,
        <svg width={56} height={56} viewBox="0 0 56 56">
          <circle cx={28} cy={28} r={20} fill="none" stroke={theme.deny} strokeWidth={4} />
          <line x1={28} y1={12} x2={28} y2={26} stroke={theme.deny} strokeWidth={4} strokeLinecap="round" />
        </svg>,
      )}
    </AbsoluteFill>
  );
};

// ── 0-C 五物件立碑 ───────────────────────────────────────────────────────

/** 五物件剪影（mech 金，工坊分区环形预告位：上缘 → 右缘，不触碰左中锚位）。 */
const HANGS = [
  {zh: '板', kind: 'board', x: 1050, y: 118},
  {zh: '格子', kind: 'mailbox', x: 1330, y: 236},
  {zh: '班次', kind: 'dial', x: 1518, y: 412},
  {zh: '隔间', kind: 'booth', x: 1554, y: 592},
  {zh: '插口', kind: 'socket', x: 1518, y: 752},
] as const;

/** 剪影 glyph（mech 线稿，56×56）——预告位只给形不给义，标签 p0-13..14 逐件挂上。 */
const Glyph: React.FC<{kind: (typeof HANGS)[number]['kind']}> = ({kind}) => {
  const s = {stroke: theme.mech, strokeWidth: 4, fill: 'none', strokeLinecap: 'round' as const};
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      {kind === 'board' ? (
        <>
          <rect x={6} y={6} width={44} height={44} rx={5} {...s} />
          <rect x={14} y={14} width={12} height={9} rx={2} {...s} strokeWidth={3} />
          <rect x={14} y={29} width={12} height={9} rx={2} {...s} strokeWidth={3} />
          <rect x={32} y={14} width={12} height={9} rx={2} {...s} strokeWidth={3} />
          <rect x={32} y={29} width={12} height={9} rx={2} {...s} strokeWidth={3} />
        </>
      ) : null}
      {kind === 'mailbox' ? (
        <>
          <rect x={6} y={14} width={44} height={30} rx={4} {...s} />
          <line x1={6} y1={28} x2={50} y2={28} {...s} strokeWidth={3} />
          <line x1={14} y1={21} x2={30} y2={21} {...s} strokeWidth={3} />
        </>
      ) : null}
      {kind === 'dial' ? (
        <>
          <circle cx={28} cy={30} r={18} {...s} />
          <line x1={28} y1={30} x2={28} y2={16} {...s} />
          <circle cx={28} cy={30} r={3.5} fill={theme.mech} stroke="none" />
        </>
      ) : null}
      {kind === 'booth' ? (
        <>
          <rect x={10} y={6} width={36} height={44} rx={3} {...s} />
          <line x1={30} y1={6} x2={30} y2={50} {...s} strokeWidth={3} />
          <circle cx={38} cy={30} r={2.5} fill={theme.mech} stroke="none" />
        </>
      ) : null}
      {kind === 'socket' ? (
        <>
          <rect x={10} y={12} width={36} height={32} rx={8} {...s} />
          <circle cx={22} cy={26} r={3} {...s} strokeWidth={3} />
          <circle cx={34} cy={26} r={3} {...s} strokeWidth={3} />
          <line x1={28} y1={44} x2={28} y2={52} {...s} strokeWidth={3} />
        </>
      ) : null}
    </svg>
  );
};

/** 章尾金句衬线小卡（叠在 series-vow 章窗尾段定格，压短形态——
 *  「还是原来那一条」的记忆点） */
const VowQuote: React.FC = () => {
  const o = useProgress(2, DUR.f4);
  const underline = useProgress(10, 24, 'decelerate');
  return (
    <AbsoluteFill style={{background: withAlpha(theme.bg, 0.86 * o), pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 430,
          width: 1920,
          textAlign: 'center',
          opacity: o,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '18px 44px',
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 14,
            background: theme.panel,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, letterSpacing: 4}}>
            {'还是那一条'}
          </div>
          <svg width={200} height={8} viewBox="0 0 200 8" style={{marginTop: 10}}>
            <line
              x1={8}
              y1={4}
              x2={192}
              y2={4}
              stroke={theme.core}
              strokeWidth={4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - underline}
            />
          </svg>
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 立碑：「更聪明的师傅」划线否掉 → 五物件剪影右缘挂入（mech 常驻辉光）→
 *  p0-13..14 逐件挂标签。传送带母题恒居左中锚位（〔M-001〕恒色恒线宽）。 */
const Monument: React.FC<{at11: number; at14: number; dur11: number; span: number}> = ({
  at11,
  at14,
  dur11,
  span,
}) => {
  const cardIn = useProgress(2, DUR.f4);
  // 划线否掉（decelerate；否定语义走 deny）
  const strike = useProgress(at11 + 6, DUR.f5, 'decelerate');
  const cardOut = useProgress(at11 + Math.round(dur11 * 0.62), DUR.f5);
  // 内核恒在（左中锚位）＋匀速巡游
  const ringDraw = useProgress(4, 36, 'decelerate');
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  // 五剪影右缘滑入（p0-11 后半，错峰 6 帧）
  const e0 = useEnter('slideR', {at: at11 + 20, dur: DUR.f5, dist: 60});
  const e1 = useEnter('slideR', {at: at11 + 26, dur: DUR.f5, dist: 60});
  const e2 = useEnter('slideR', {at: at11 + 32, dur: DUR.f5, dist: 60});
  const e3 = useEnter('slideR', {at: at11 + 38, dur: DUR.f5, dist: 60});
  const e4 = useEnter('slideR', {at: at11 + 44, dur: DUR.f5, dist: 60});
  const enters = [e0, e1, e2, e3, e4];
  // 常驻辉光（mech，相位错峰）
  const g0 = useBreathe({period: 46, amp: 0.4, base: 0.6});
  const g1 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 9});
  const g2 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 18});
  const g3 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 27});
  const g4 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 36});
  const glows = [g0, g1, g2, g3, g4];
  // p0-14 逐件挂标签（板／格子／班次／隔间／插口，各 ≤2 字）
  const labels = useStagger(HANGS.length, {at: at14 + 2, stride: 12, dur: DUR.f4});

  return (
    <AbsoluteFill>
      {/* 内核左中锚位（装置永不触碰） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} dotProgress={(ringDraw + laps) % 1} showLabels={false} />
      </div>

      {/* 悬念卡：更聪明的师傅 → 划线否掉 → 退场 */}
      <div style={{position: 'absolute', left: 706, top: 330, width: 460, opacity: cardIn * (1 - cardOut)}}>
        <Panel style={{padding: '24px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 42, fontWeight: 600, color: theme.dim}}>
            {'更聪明的师傅'}
          </span>
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

      {/* 五物件剪影：自右缘挂入（mech 常驻辉光）→ p0-13..14 逐件挂标签 */}
      {HANGS.map((h, i) => (
        <div key={h.zh} style={{position: 'absolute', left: h.x, top: h.y, ...enters[i]}}>
          <Panel
            accent={theme.mech}
            style={{
              width: 208,
              boxSizing: 'border-box',
              padding: '12px 14px',
              boxShadow: `0 0 ${16 * glows[i]}px ${withAlpha(theme.mech, 0.42 * glows[i])}`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <Glyph kind={h.kind} />
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 30,
                  fontWeight: 700,
                  color: theme.mech,
                  opacity: labels[i],
                  transform: `translateX(${(1 - labels[i]) * 12}px)`,
                }}
              >
                {h.zh}
              </div>
            </div>
          </Panel>
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0OneToCrowd: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-10');
  const bC = w('p0-11', 'p0-15');

  // 0-C 章尾金句小卡：series-vow 章窗后段起（先让画框入场，再由记忆点接管定格）
  const vowFrom = at('p0-15') - bC.from + Math.round(dur('p0-15') * 0.52);
  const vowSpan = Math.max(1, bC.durationInFrames - vowFrom);

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 开场字卡（Badge 直入）">
        <SceneTag chapter="One to Many" tagline="一个到一群" />
        <OpeningStack at05={at('p0-05') - bA.from} durA={bA.durationInFrames} />
      </Sequence>

      <Sequence {...bB} name="0-B 台面溢出">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-06..09；窗 = 本镜 1 条 cue 窗（p0-10） */}
        <ArchifyYield cues={[{at: at('p0-10') - bB.from, durationInFrames: dur('p0-10')}]}>
          <OverflowBench
            at06={at('p0-06') - bB.from}
            at07={at('p0-07') - bB.from}
            at08={at('p0-08') - bB.from}
            at09={at('p0-09') - bB.from}
            at10={at('p0-10') - bB.from}
            dur06={dur('p0-06')}
          />
        </ArchifyYield>
        {/* cue 1/3：board-vs-todo/todo-vanishes（本集首现实例 → 默认入场；
            第三行「待办断电即失」由章标签承担） */}
        <ArchifyRecap
          slug="board-vs-todo"
          caption="板与待办"
          cues={[{chapterId: 'todo-vanishes', at: at('p0-10') - bB.from, durationInFrames: dur('p0-10')}]}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 五物件立碑">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-11 / p0-13..14；窗 = 本镜 2 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p0-12') - bC.from, durationInFrames: dur('p0-12')},
            {at: at('p0-15') - bC.from, durationInFrames: dur('p0-15')},
          ]}
        >
          <Monument
            at11={at('p0-11') - bC.from}
            at14={at('p0-14') - bC.from}
            dur11={dur('p0-11')}
            span={bC.durationInFrames}
          />
        </ArchifyYield>
        {/* cue 2/3：collab-panorama/one-to-many（p0-10 后空窗一句 → 默认入场） */}
        <ArchifyRecap
          slug="collab-panorama"
          caption="协作全景"
          cues={[{chapterId: 'one-to-many', at: at('p0-12') - bC.from, durationInFrames: dur('p0-12')}]}
        />
        {/* cue 3/3：five-layer-dependency/series-vow（p0-12 后空窗两句 → 默认入场） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[{chapterId: 'series-vow', at: at('p0-15') - bC.from, durationInFrames: dur('p0-15')}]}
        />
        {/* 章尾金句小卡：叠在 series-vow 窗后段定格 */}
        <Sequence from={vowFrom} durationInFrames={vowSpan} name="0-C 章尾金句">
          <VowQuote />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0OneToCrowd;
