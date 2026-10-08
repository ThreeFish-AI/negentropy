/** P0 两类时间（p0-01..18，4 镜 2 cue）——分镜 0-A…0-D。
 *
 *  cue 清单（2，全落 timing-panorama——本集首尾幕的幕级锚）：
 *   0-A two-kinds-of-time@p0-04（全图首闪·预告态，默认入场）
 *   0-D two-devices-lit@p0-17（全图二闪·两支路点亮态；与首闪隔 12 句空窗，
 *     画框已卸载 ⇒ 默认入场，lead={false} 会全不透明一帧瞬现——ArchifyRecap 契约）
 *
 *  ★ 0-A 开场（系列片头铺开，2026-10-08，沿 ep1 先例 0fed97ec5）：五层栈落板/
 *    本集层点亮职责已由系列片头 components/series-intro.tsx 吸收（压 leadIn 时段）——
 *    scene 侧补工坊描线（useDraw）、传送带底盘首现与常驻条 Badge（BADGE_STYLE
 *    top:64）直接淡入；HarnessStackP0 退役（Badge 位置迁移随落板一并退役，
 *    「压暗舞台作栈背景」亦随之去除）。
 *  ★ 恒定空间契约自此幕生效：传送带（LoopRing，core 橙恒描边〔M-001〕）恒居
 *    左中锚位 RING=(330,540)；装置族自右缘（后台线）/上缘（定时线）挂入
 *    （0-D 双剪影：滚筒右缘、钟盘上缘，双线分轨）。
 *  ★ 0-B 停等段（p0-07..09）以静写闷〔M-002〕：带面静止（光点冻结隐去）、
 *    计时/计费匀速滚涨、零强调脉冲；deny 点睛只在 p0-10 收口。
 *  ★ 0-D 金句预埋小卡衬线定格〔M-003〕（caption-dup-ok 留痕，见行内注释）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
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
  progress,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P1–P5 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 传送带底盘左中锚位（cx 330 / cy 540）与巡游节律——全片恒定位恒速（空间契约）。 */
const RING = {size: 300, left: 180, top: 390} as const;
const LAP_FRAMES = 75;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（师傅 = text 白，无彩——空间契约「师傅一律无彩」） */
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

// ── 0-A 工坊开卷：描线 + 底盘首现 + 常驻条 Badge 直入 ─────────────────────

/** 常驻条 Badge：片头渐出后直接淡入（f3 起手 + f4 时长，早于工坊描线）。 */
const BadgeIn: React.FC = () => {
  const badgeIn = useProgress(DUR.f3, DUR.f4);
  return <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />;
};

/** 工坊舞台：轮廓描线生长（通宵不打烊灯牌）→ 师傅剪影立于带侧 → 传送带底盘
 *  首现（core 橙恒转，〔M-001〕首锚）；全程保持满亮度（原 p0-03 起压暗作栈背景已随栈退役）。 */
const WorkshopStage: React.FC<{at02: number; span: number}> = ({at02, span}) => {
  // 工坊大轮廓描线：beat 级动作（约 1.5s），落时长标尺外保留显式帧数（铁律④）
  const outline = useDraw(4, 46);
  const lampIn = useProgress(52, DUR.f4);
  const personIn = useProgress(at02 - 6, DUR.f5);
  // 底盘描线与首圈巡游：draw 期光点骑在描线头上，此后匀速绕行
  const ringDraw = useProgress(at02 + 4, 46, 'decelerate');
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M110 730 L110 262 L1500 262 L1500 730"
          fill="none"
          stroke={theme.dim}
          strokeWidth={3}
          opacity={0.85}
          {...outline}
        />
      </svg>
      {/* 通宵不打烊灯牌（dim） */}
      <div style={{position: 'absolute', left: 1330, top: 292, opacity: lampIn}}>
        <Panel style={{padding: '8px 18px', display: 'flex', gap: 10, alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'24h'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'不打烊'}</span>
        </Panel>
      </div>
      {/* 传送带底盘首现（core 橙恒转——本集恒定主视觉的「底」） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top}}>
        <LoopRing size={RING.size} draw={ringDraw} dotProgress={ringDraw + laps} showLabels={false} />
      </div>
      {/* 师傅剪影立于带侧（text 白无彩） */}
      <Person x={512} y={550} color={theme.text} opacity={0.92 * personIn} />
      {/* 角标 while True（分镜 0-A 声明；p0-04 cue 窗内随 yield 让位） */}
      <Footnote delay={10}>{'while True'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-B 慢活卡带：停等 + 白烧的钱 ────────────────────────────────────────

/** 慢活压带：巨型包裹（mech 线框）压住静止的底盘；师傅干站；计时/计费人色时间
 *  （dim 灰）匀速滚涨——p0-07..09 以静写闷〔M-002〕，零强调脉冲；p0-10 deny 点睛。 */
const SlowJobBelt: React.FC<{at05: number; at07: number; at10: number; span: number}> = ({
  at05,
  at07,
  at10,
  span,
}) => {
  // 巨型包裹落带（mech 线框）
  const pkg = useEnter('fall', {at: 4, dur: DUR.f5, dist: 130});
  const pkgIn = useProgress(4, DUR.f4);
  // 计时骨架 p0-05 末进场；数字自 p0-07「命令一跑」匀速滚涨到 10:00
  const frameIn = useProgress(at05 + 8, DUR.f4);
  const rollFor = Math.max(1, span - at07);
  const secs = useCount({to: 600, at: at07, dur: rollFor, ease: 'linear'});
  const bill = useProgress(at07, rollFor, 'linear');
  const burnCard = useProgress(at10, DUR.f4);
  // 「白烧」deny 点睛：停等段收口后唯一的一次性强调
  const burn = useImpulse({at: at10 + 4, dur: DUR.f6, peak: 1});
  const mm = Math.floor(secs / 60);
  const ss = Math.floor(secs % 60);

  return (
    <AbsoluteFill>
      {/* 底盘静止：光点隐去（带面静止的画面代言）；「停等」小标 */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top, opacity: 0.85}}>
        <LoopRing size={RING.size} showLabels={false} showExit={false} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: RING.left,
          top: RING.top + RING.size + 14,
          width: RING.size,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
        }}
      >
        {'停等'}
      </div>

      {/* 巨型包裹（mech 蓝线框，压带不动） */}
      <div style={{position: 'absolute', left: 210, top: 450, ...pkg}}>
        <svg width={240} height={170}>
          <rect x={4} y={4} width={232} height={162} rx={10} fill="none" stroke={theme.mech} strokeWidth={4} />
          <line x1={82} y1={4} x2={82} y2={166} stroke={theme.mech} strokeWidth={3} opacity={0.6} />
          <line x1={158} y1={4} x2={158} y2={166} stroke={theme.mech} strokeWidth={3} opacity={0.6} />
          <text
            x={120}
            y={92}
            textAnchor="middle"
            fontFamily={theme.sans}
            fontSize={30}
            fontWeight={600}
            fill={theme.mech}
            opacity={pkgIn}
          >
            {'慢活'}
          </text>
        </svg>
      </div>

      {/* 师傅干站带侧（text 白无彩，静） */}
      <Person x={512} y={550} color={theme.text} opacity={0.92} />

      {/* 计时器：人色时间（dim 灰）数字滚涨 */}
      <div style={{position: 'absolute', left: 1150, top: 236, opacity: frameIn}}>
        <Panel style={{width: 560, boxSizing: 'border-box', padding: '22px 30px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'计时'}</div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 76,
              color: theme.dim,
              fontVariantNumeric: 'tabular-nums',
              marginTop: 6,
            }}
          >
            {`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`}
          </div>
        </Panel>
      </div>

      {/* 计费条：随秒匀速累积（dim——白烧的钱的「账」） */}
      <div style={{position: 'absolute', left: 1150, top: 470, opacity: frameIn}}>
        <Panel style={{width: 560, boxSizing: 'border-box', padding: '20px 30px'}}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.dim,
            }}
          >
            <span>{'计费'}</span>
            <span style={{fontFamily: theme.mono}}>{'按秒'}</span>
          </div>
          <div
            style={{
              marginTop: 14,
              height: 24,
              borderRadius: 12,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.bg,
              overflow: 'hidden',
            }}
          >
            <div style={{width: `${bill * 100}%`, height: '100%', background: theme.dim, opacity: 0.75}} />
          </div>
        </Panel>
      </div>

      {/* p0-10 记忆点小字卡：「白烧的钱」（deny 红点睛「白烧」） */}
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 782,
          opacity: burnCard,
        }}
      >
        <Panel accent={theme.deny} style={{padding: '18px 34px'}}>
          <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>
            <span
              style={{
                color: theme.deny,
                display: 'inline-block',
                transform: `translateY(${-4 * burn}px) scale(${1 + 0.07 * burn})`,
                textShadow: `0 0 ${26 * burn}px ${withAlpha(theme.deny, 0.9)}`,
              }}
            >
              {'白烧'}
            </span>
            {'的钱'}
          </span>
        </Panel>
      </div>

      <Footnote delay={8}>{'pip install · npm run build'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-C 到点的活：日历墙 + 空台面 ────────────────────────────────────────

/** 日历墙挂上缘（mech 蓝刻度网格——定时线装置族的墙面）；九点整刻度高亮 →
 *  p0-14 翻页一天过去、九点再亮但带上无活（漏触发）；空台面留白呼吸（dim 低频）。 */
const CAL = {x: 220, y: 84, w: 1480, h: 150, cellW: 96, cellH: 100, cellGap: 8, nine: 2} as const;
const HOURS = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18'] as const;

const CalendarDue: React.FC<{at12: number; at14: number}> = ({at12, at14}) => {
  const frame = useCurrentFrame();
  const wallIn = useProgress(2, DUR.f4);
  // 九点整刻度高亮（一次性）：p0-12「每天早上」点亮，此后常亮
  const nineHold = progress(frame, at12 + 4, DUR.f4);
  const nine = useImpulse({at: at12 + 4, dur: DUR.f6, peak: 1});
  // 日历翻页：p0-14 中段两相（合页 → 新页），beat 级动作显式帧数
  const flipA = progress(frame, at14 + 8, 14);
  const flipB = progress(frame, at14 + 24, 14);
  const dayNext = flipA >= 1;
  // 翻页后九点再亮（但带上无活）
  const nineAgain = useImpulse({at: at14 + 42, dur: DUR.f6, peak: 1});
  // 空台面留白呼吸（dim 低频——「空无一人」被看见）
  const empt = useBreathe({period: 150, amp: 0.5, base: 0.5});
  // 「你说一句 · 它动一下」对白气泡（dim 灰人色）
  const bubble = useProgress(at14 + 52, DUR.f5);

  const glow = Math.max(nine, nineAgain);
  const gridX = CAL.x + 170;

  return (
    <AbsoluteFill>
      {/* 日历墙（上缘 mech 蓝刻度网格） */}
      <div style={{position: 'absolute', left: CAL.x, top: CAL.y, opacity: wallIn}}>
        <Panel style={{width: CAL.w, height: CAL.h, boxSizing: 'border-box', padding: '12px 16px'}}>
          <div style={{display: 'flex', gap: CAL.cellGap, alignItems: 'center'}}>
            {/* 日期页（翻页一天过去） */}
            <div
              style={{
                width: 146,
                height: CAL.cellH,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: 10,
                fontFamily: theme.sans,
                fontSize: 32,
                color: theme.dim,
                transform: `scaleX(${dayNext ? flipB : 1 - flipA})`,
              }}
            >
              {dayNext ? '明天' : '今天'}
            </div>
            {HOURS.map((h, i) => {
              const isNine = i === CAL.nine;
              return (
                <div
                  key={h}
                  style={{
                    width: CAL.cellW,
                    height: CAL.cellH,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    border: `2px solid ${isNine && nineHold > 0 ? theme.mech : theme.panelBorder}`,
                    background:
                      isNine && nineHold > 0 ? withAlpha(theme.mech, 0.12 + 0.2 * glow) : 'transparent',
                    fontFamily: theme.mono,
                    fontSize: 26,
                    color: isNine && nineHold > 0 ? theme.mech : theme.dim,
                    boxShadow: isNine && glow > 0.05 ? `0 0 ${16 * glow}px ${withAlpha(theme.mech, 0.5 * glow)}` : undefined,
                  }}
                >
                  {`${h}:00`}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* 空台面：底盘暗态无人放活（光点隐去）、师傅剪影缺席；留白呼吸 */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top, opacity: 0.4}}>
        <LoopRing size={RING.size} showLabels={false} showExit={false} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <rect
          x={RING.left - 44}
          y={RING.top - 40}
          width={RING.size + 88}
          height={RING.size + 84}
          rx={18}
          fill="none"
          stroke={theme.dim}
          strokeWidth={2.5}
          strokeDasharray="12 10"
          opacity={wallIn * (0.22 + 0.22 * empt)}
        />
      </svg>

      {/* p0-14 对白气泡（dim 灰人色——触发权攥在用户手里的老规矩） */}
      <div style={{position: 'absolute', left: 660, top: 770, opacity: bubble}}>
        <Panel style={{padding: '16px 30px', borderRadius: 18}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>
            {'你说一句 · 它动一下'}
          </span>
        </Panel>
      </div>

      <Footnote delay={12}>{'0 9 * * *'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-D 悬念立碑：双问 + 划掉 + 两装置剪影 + 金句预埋 ────────────────────

/** 主问题双联对开（mech 点睛「等」「按」）→ 答案卡双双划掉（dim 划线）→
 *  两装置预告剪影（滚筒右缘／钟盘上缘——双线分轨）＋金句预埋小卡定格〔M-003〕。 */
const TwoQuestions: React.FC<{at16: number; at18: number; span: number}> = ({at16, at18, span}) => {
  // 双联字卡对开（p0-15 立碑句）
  const left = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 80});
  const right = useEnter('slideR', {at: 8, dur: DUR.f5, dist: 80});
  // 答案卡进场 + 双双划掉（dim 划线，decelerate）
  const strikeIn = useProgress(at16 - 6, DUR.f4);
  const strike1 = useProgress(at16 + 8, DUR.f5, 'decelerate');
  const strike2 = useProgress(at16 + 22, DUR.f5, 'decelerate');
  // 两装置预告剪影：archify 二闪窗（p0-17）收尾处滑入（窗外不可见，衔接零跳变）
  const hangAt = at18 - DUR.f5;
  const drum = useEnter('slideR', {at: hangAt, dur: DUR.f5, dist: 90});
  const clock = useEnter('slideR', {at: hangAt + 6, dur: DUR.f5, dist: 90});
  const glowD = useBreathe({period: 46, amp: 0.4, base: 0.6});
  const glowC = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 15});
  // p0-18 金句预埋小卡（衬线预告态，定格到幕尾）
  const seed = useProgress(at18 + 10, DUR.f5);
  // 底盘暗态衬底（恒定锚位在场）
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);

  const strikeCard = (x: number, label: string, p: number) => (
    <div style={{position: 'absolute', left: x, top: 528, opacity: strikeIn}}>
      <Panel style={{width: 360, boxSizing: 'border-box', padding: '18px 24px', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>{label}</span>
      </Panel>
      <svg width={360} height={16} viewBox="0 0 360 16" style={{position: 'absolute', left: 0, top: 44}}>
        <line
          x1={22}
          y1={8}
          x2={338}
          y2={8}
          stroke={theme.dim}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - p}
        />
      </svg>
    </div>
  );

  return (
    <AbsoluteFill>
      {/* 底盘暗态（无活——两问悬置中） */}
      <div style={{position: 'absolute', left: RING.left, top: RING.top, opacity: 0.35}}>
        <LoopRing size={RING.size} dotProgress={laps * 0.4} showLabels={false} showExit={false} />
      </div>

      {/* 主问题双联字卡（mech 点睛「等」「按」二字） */}
      <div style={{position: 'absolute', left: 500, top: 252, ...left}}>
        <Panel style={{width: 460, boxSizing: 'border-box', padding: '26px 0', textAlign: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.text}}>
            <span style={{color: theme.mech}}>{'等'}</span>
            {'不等？'}
          </span>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1000, top: 252, ...right}}>
        <Panel style={{width: 460, boxSizing: 'border-box', padding: '26px 0', textAlign: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.text}}>
            {'谁'}
            <span style={{color: theme.mech}}>{'按'}</span>
            {'开始？'}
          </span>
        </Panel>
      </div>

      {/* 答案卡双双划掉（dim——不是更快的机器／更多的工坊） */}
      {strikeCard(680, '更快的机器', strike1)}
      {strikeCard(1080, '更多的工坊', strike2)}

      {/* 清洗槽滚筒剪影（后台线 → 右缘挂入，mech 常驻辉光） */}
      <div style={{position: 'absolute', left: 1560, top: 430, ...drum}}>
        <svg width={170} height={190}>
          <circle cx={85} cy={85} r={76} fill="none" stroke={theme.mech} strokeWidth={5} />
          <circle cx={85} cy={85} r={44} fill="none" stroke={theme.mech} strokeWidth={3.5} opacity={0.75} />
          <line x1={57} y1={85} x2={113} y2={85} stroke={theme.mech} strokeWidth={3} opacity={0.6} />
        </svg>
        <div
          style={{
            width: 170,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.mech,
            textShadow: `0 0 ${14 * glowD}px ${withAlpha(theme.mech, 0.5 * glowD)}`,
          }}
        >
          {'清洗槽'}
        </div>
      </div>

      {/* 定时钟盘剪影（定时线 → 上缘墙面，九点位时针；mech 常驻辉光） */}
      <div style={{position: 'absolute', left: 870, top: 76, ...clock}}>
        <svg width={150} height={150}>
          <circle cx={75} cy={75} r={66} fill="none" stroke={theme.mech} strokeWidth={5} />
          {Array.from({length: 12}, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={75 + 54 * Math.sin(a)}
                y1={75 - 54 * Math.cos(a)}
                x2={75 + 62 * Math.sin(a)}
                y2={75 - 62 * Math.cos(a)}
                stroke={theme.mech}
                strokeWidth={3}
                opacity={0.7}
              />
            );
          })}
          {/* 时针指 9 点、分针指 12 点（到点语义） */}
          <line x1={75} y1={75} x2={75 - 30} y2={75} stroke={theme.mech} strokeWidth={4.5} strokeLinecap="round" />
          <line x1={75} y1={75} x2={75} y2={40} stroke={theme.mech} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
        <div
          style={{
            width: 150,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.mech,
            textShadow: `0 0 ${14 * glowC}px ${withAlpha(theme.mech, 0.5 * glowC)}`,
          }}
        >
          {'定时钟'}
        </div>
      </div>

      {/* p0-18 金句预埋小卡（衬线预告态——收尾回来对账的伏笔） */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 712,
          opacity: seed,
          transform: `translateY(${(1 - seed) * 16}px)`,
        }}
      >
        {/* caption-dup-ok: 金句预埋小卡，主字压短非逐字（storyboard 0-D 豁免在案） */}
        <Panel style={{width: 600, boxSizing: 'border-box', padding: '22px 0', textAlign: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>
            {'没有平行宇宙'}
          </span>
        </Panel>
      </div>

      <Footnote delay={30}>{'run_in_background · cron'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0TwoTimes: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-10');
  const bC = w('p0-11', 'p0-14');
  const bD = w('p0-15', 'p0-18');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 工坊开卷（Badge 直入）">
        <SceneTag chapter="Two Times" tagline="两类时间" />
        {/* 可见岛 p0-01..03（工坊/底盘）；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-04') - bA.from, durationInFrames: dur('p0-04')}]}>
          <WorkshopStage at02={at('p0-02') - bA.from} span={bA.durationInFrames} />
        </ArchifyYield>
        {/* 常驻条 Badge 直接淡入，延伸到镜尾 */}
        <BadgeIn />
        {/* cue 1/2：timing-panorama/two-kinds-of-time（全图首闪·预告态；本镜首图 → 默认入场） */}
        <ArchifyRecap
          slug="timing-panorama"
          caption="时机全景"
          cues={[
            {chapterId: 'two-kinds-of-time', at: at('p0-04') - bA.from, durationInFrames: dur('p0-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="0-B 慢活卡带">
        <HarnessBadge style={BADGE_STYLE} />
        <SlowJobBelt
          at05={at('p0-05') - bB.from}
          at07={at('p0-07') - bB.from}
          at10={at('p0-10') - bB.from}
          span={bB.durationInFrames}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 到点的活">
        <HarnessBadge style={BADGE_STYLE} />
        <CalendarDue at12={at('p0-12') - bC.from} at14={at('p0-14') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="0-D 悬念立碑">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-15..16 / p0-18（剪影+p0-17 闪后）；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-17') - bD.from, durationInFrames: dur('p0-17')}]}>
          <TwoQuestions at16={at('p0-16') - bD.from} at18={at('p0-18') - bD.from} span={bD.durationInFrames} />
        </ArchifyYield>
        {/* cue 2/2：timing-panorama/two-devices-lit（全图二闪·两支路点亮态；与首闪隔 12 句空窗 → 默认入场） */}
        <ArchifyRecap
          slug="timing-panorama"
          caption="时机全景"
          cues={[
            {chapterId: 'two-devices-lit', at: at('p0-17') - bD.from, durationInFrames: dur('p0-17')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0TwoTimes;
