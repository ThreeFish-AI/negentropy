/** P4 墙上的定时钟（p4-01..35，p4-03/p4-29 空号；6 镜 13 cue）——分镜 4-A…4-F。
 *
 *  ★ 空间契约：定时线装置族挂**上缘墙面**（ClockFace 母题 + 入口小格子 + 岗哨），
 *    与右缘后台线分轨；传送带（core 橙恒转底盘〔M-001〕）恒居左中锚位，
 *    「装置在动而传送带不停」的动效铁律落在 4-C 递条一拍。
 *  ★ 4-A 钟摆强调＝Remotion 原生 PendulumGlyph（Lottie clock-swing 因 headless ANGLE
 *    确定性挂死退役〔ISSUE-202〕；public/lottie/ 资产留档未用）。
 *  ★ archify 全屏独占两图接力：clock-four-layers 三镜（4-B/4-C/4-D——4-C 与 4-B
 *    帧相邻 ⇒ lead={false}，4-D 前有 p4-20 空窗 ⇒ 默认 lead）＋ clock-dedupe×
 *    clock-bad-jobs 双实例（4-E 内坏闹钟实例接前图末章帧相邻 ⇒ lead={false}）。
 *  ★ 空窗回落：p4-09 引子＋背对示意 / p4-13 塞条一拍 / p4-15..18 试锁双分支 /
 *    p4-20 消息条并列 / p4-22 四层总结卡 / p4-23 秒针扫格。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ClockFace} from '../components/clock-face';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  useBreathe,
  useDim,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useStagger,
  useTravel,
} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，由 Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 确定性透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影——text 白无彩（人一律无彩） */
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

/** 传送带底盘（core 橙恒转——本集恒定主视觉的「底」；带不停＝视觉动词） */
const BeltGlyph: React.FC<{x: number; y: number; spin: number; label?: string}> = ({
  x,
  y,
  spin,
  label,
}) => (
  <div style={{position: 'absolute', left: x, top: y}}>
    <LoopRing size={130} dotProgress={(spin * 3) % 1} showLabels={false} showExit={false} />
    <svg width={560} height={90} style={{position: 'absolute', left: 96, top: 38}}>
      <line x1={0} y1={8} x2={520} y2={8} stroke={theme.coreDeep} strokeWidth={10} strokeLinecap="round" />
      {/* 托盘：随进度轻移（带面上恒有活，never 停） */}
      <rect
        x={60 + (spin * 260) % 300}
        y={-26}
        width={96}
        height={26}
        rx={5}
        fill={theme.panel}
        stroke={theme.core}
        strokeWidth={3}
      />
    </svg>
    {label ? (
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 96,
          fontFamily: theme.sans,
          fontSize: 23,
          color: theme.dim,
        }}
      >
        {label}
      </div>
    ) : null}
  </div>
);

// ── 4-A 定时钟落墙（p4-01..08） ─────────────────────────────────────────

/** 七点叙事卡三小图标（dim——人在睡觉，钟照响） */
const LifeIcon: React.FC<{kind: 'sleep' | 'shower' | 'cook'; x: number; y: number; lit: number}> = ({
  kind,
  x,
  y,
  lit,
}) => {
  const c = theme.dim;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: lit}}>
      <svg width={64} height={64}>
        {kind === 'sleep' ? (
          <>
            <path d="M18 40 Q32 30 46 40 Q32 52 18 40 Z" fill="none" stroke={c} strokeWidth={3.5} />
            <text x={38} y={22} fontFamily={theme.mono} fontSize={18} fill={c}>
              {'z'}
            </text>
            <text x={48} y={14} fontFamily={theme.mono} fontSize={14} fill={c}>
              {'z'}
            </text>
          </>
        ) : null}
        {kind === 'shower' ? (
          <>
            <path d="M16 18 Q32 4 48 18" fill="none" stroke={c} strokeWidth={3.5} />
            <line x1={22} y1={30} x2={22} y2={40} stroke={c} strokeWidth={3} />
            <line x1={32} y1={30} x2={32} y2={44} stroke={c} strokeWidth={3} />
            <line x1={42} y1={30} x2={42} y2={38} stroke={c} strokeWidth={3} />
          </>
        ) : null}
        {kind === 'cook' ? (
          <>
            <path d="M14 30 H50 V44 Q50 54 32 54 Q14 54 14 44 Z" fill="none" stroke={c} strokeWidth={3.5} />
            <path d="M50 34 Q60 34 58 44" fill="none" stroke={c} strokeWidth={3} />
            <path d="M24 20 Q28 14 24 8" fill="none" stroke={c} strokeWidth={3} />
          </>
        ) : null}
      </svg>
    </div>
  );
};

const FIVE_SLOTS = ['分钟', '小时', '日', '月', '星期'];

const ClockWall: React.FC<{
  atSeven: number;
  atBell: number;
  atMount: number;
  atTable: number;
  atSlots: number;
  span: number;
}> = ({atSeven, atBell, atMount, atTable, atSlots, span}) => {
  const inAll = useEnter('fade', {at: 2, dur: DUR.f5});
  // 秒针巡行（useTravel 在组件顶层；角度换算 0=12 点顺时针）
  const sec = useTravel({cx: 0, cy: 0, r: 1, secPerLap: 3});
  // 到点自己响：铃弧一次性脉冲 + 钟组轻弹（effects 不吃弹簧——包络即强调）
  const ring = useImpulse({at: atBell, dur: DUR.f6, peak: 1});
  const mount = useProgress(atMount, DUR.f4);
  // 五格依次点亮 + 老写法徽标
  const slots = useStagger(FIVE_SLOTS.length, {at: atSlots, stride: 7, dur: DUR.f4});
  const oldBadge = useProgress(atSlots + FIVE_SLOTS.length * 7 + 4, DUR.f4);
  // 传送带恒转（线性——机械感是主题）
  const spin = useProgress(0, Math.max(1, span), 'linear');
  const sevenIn = useProgress(atSeven, DUR.f5);
  const tableIn = useProgress(atTable, DUR.f5);

  return (
    <AbsoluteFill style={{...inAll}}>
      {/* 上缘墙面（定时线装置族的挂载带） */}
      <svg width={1920} height={140} style={{position: 'absolute', left: 0, top: 120}}>
        <line x1={720} y1={64} x2={1200} y2={64} stroke={theme.panelBorder} strokeWidth={4} />
      </svg>

      {/* 钟组：钟面 + 壁挂座 + 响铃弧（到点脉冲） */}
      <div
        style={{
          position: 'absolute',
          left: 780,
          top: 128,
          width: 360,
          height: 260,
          transform: `scale(${1 + 0.035 * ring})`,
        }}
      >
        <svg width={360} height={260}>
          <rect x={152} y={44} width={56} height={12} rx={5} fill="none" stroke={theme.dim} strokeWidth={3} />
          {/* 铃弧：左孪两条，deny 永不入场——提醒不是故障 */}
          <g opacity={ring}>
            <path d="M64 118 Q40 96 64 74" fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
            <path d="M296 118 Q320 96 296 74" fill="none" stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
            <path d="M92 100 Q78 88 92 78" fill="none" stroke={theme.mech} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
            <path d="M268 100 Q282 88 268 78" fill="none" stroke={theme.mech} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
          </g>
        </svg>
        <ClockFace cx={180} cy={150} r={104} secDeg={sec.angle + 90} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 226,
            width: 360,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.mech,
            opacity: mount,
          }}
        >
          {'定时钟'}
        </div>
      </div>

      {/* 钟摆强调（Lottie 点缀之二）：挂在钟面正下、随到点响起摆动 */}
      {/* 钟摆强调（原 Lottie clock-swing 在 headless ANGLE 渲染确定性崩 tab——实测禁用后
          同段 100 帧全过；改 Remotion 原生摆锤：运动层铁律（动效走 motion hooks）更优，零资产依赖） */}
      <PendulumGlyph at={atBell - 4} left={852} top={350} />

      {/* 七点闹钟叙事卡（左）：三枚 dim 生活图标，钟照响不误 */}
      <div style={{position: 'absolute', left: 150, top: 200, opacity: sevenIn}}>
        <Panel accent={theme.mech} style={{width: 480, padding: '22px 28px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {'闹钟 · 七点'}
          </div>
          <div style={{position: 'relative', height: 84, marginTop: 18}}>
            <LifeIcon kind="sleep" x={30} y={8} lit={1} />
            <LifeIcon kind="shower" x={190} y={8} lit={1} />
            <LifeIcon kind="cook" x={350} y={8} lit={1} />
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.mech,
              opacity: 0.35 + 0.65 * clamp01(ring * 2),
            }}
          >
            {'照响不误'}
          </div>
        </Panel>
      </div>

      {/* 五格时间表（右）：五框依次点亮 + 老写法徽标 */}
      <div style={{position: 'absolute', left: 1330, top: 200, opacity: tableIn}}>
        <Panel style={{width: 440, padding: '22px 28px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {'时间表 · 五格'}
          </div>
          <div style={{display: 'flex', gap: 14, marginTop: 20, height: 96}}>
            {FIVE_SLOTS.map((s, i) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  border: `3px solid ${slots[i] > 0.1 ? theme.mech : theme.panelBorder}`,
                  background: slots[i] > 0.1 ? withAlpha(theme.mechDeep, 0.4 * slots[i]) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 26,
                  fontWeight: 600,
                  color: slots[i] > 0.1 ? theme.mech : theme.dim,
                  opacity: 0.35 + 0.65 * slots[i],
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.dim,
              border: `2px dashed ${theme.panelBorder}`,
              borderRadius: 8,
              padding: '6px 14px',
              display: 'inline-block',
              opacity: oldBadge,
            }}
          >
            {'老写法 · 用了五十年'}
          </div>
        </Panel>
      </div>

      {/* 传送带 + 师傅（左中锚位，背对钟——触发权不在人手里） */}
      <BeltGlyph x={180} y={716} spin={spin} label="传送带 · 不停" />
      <Person x={640} y={660} scale={0.9} />
    </AbsoluteFill>
  );
};

// ── 4-B p4-09 空窗回落：引子小字 + 钟与师傅背对示意 ────────────────────

const BackToBack: React.FC = () => {
  const intro = useEnter('fade', {at: 2, dur: DUR.f5});
  const wall = useDraw(DUR.f4, DUR.f5);
  const labels = useProgress(DUR.f5 + DUR.f5, DUR.f4);
  return (
    <AbsoluteFill style={{...intro}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 230,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 40,
          fontWeight: 700,
          color: theme.text,
        }}
      >
        {'有意思的不是钟本身'}
      </div>
      {/* 钟面 mech（左）· 师傅 text 白（右）· 中隔一道墙线 */}
      <ClockFace cx={720} cy={560} r={78} secDeg={137} />
      <Person x={1108} y={470} scale={1} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M930 400 V740"
          stroke={theme.dim}
          strokeWidth={5}
          fill="none"
          pathLength={wall.pathLength}
          strokeDasharray={wall.strokeDasharray}
          strokeDashoffset={wall.strokeDashoffset}
        />
        {/* 墙线斜纹（静态叠加——描画与纹理分置两元素） */}
        {Array.from({length: 6}, (_, i) => (
          <line
            key={i}
            x1={930}
            y1={430 + i * 56}
            x2={956}
            y2={410 + i * 56}
            stroke={theme.panelBorder}
            strokeWidth={3}
            opacity={labels * 0.9}
          />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 760,
          width: 320,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.mech,
          opacity: labels,
        }}
      >
        {'钟 · 只认表'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1040,
          top: 760,
          width: 320,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: labels,
        }}
      >
        {'师傅 · 台面'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C p4-13 空窗回落：请求条塞入入口小格子一拍 ───────────────────────

const SlotDrop: React.FC = () => {
  const dash = useFlowDash({dash: 8, gap: 11, period: 20});
  const drop = useProgress(DUR.f4, DUR.f5, 'decelerate');
  const grid = useProgress(2, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 入口小格子（上缘墙面族）：3×2 空格，第一格接条 */}
      <div style={{position: 'absolute', left: 780, top: 300, opacity: grid}}>
        {Array.from({length: 2}, (_, r) =>
          Array.from({length: 3}, (_, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * 130,
                top: r * 130,
                width: 108,
                height: 108,
                borderRadius: 12,
                border: `3px solid ${r === 0 && c === 0 ? theme.mech : theme.panelBorder}`,
                background: theme.panel,
              }}
            />
          )),
        )}
      </div>
      {/* 请求条：自钟侧飞入落入第一格（decelerate——存条是收纳不是弹射） */}
      <div
        style={{
          position: 'absolute',
          left: 300 + 460 * drop,
          top: 360,
          opacity: clamp01(drop * 2),
        }}
      >
        <div
          style={{
            width: 96,
            height: 44,
            borderRadius: 6,
            background: theme.panel,
            border: `3px solid ${theme.mech}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.mech,
          }}
        >
          {'0 9'}
        </div>
      </div>
      <svg width={1920} height={200} style={{position: 'absolute', left: 0, top: 260}}>
        <path
          d="M620 130 H770"
          stroke={theme.mech}
          strokeWidth={4}
          fill="none"
          strokeDasharray={dash.strokeDasharray}
          strokeDashoffset={dash.strokeDashoffset}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 640,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: grid,
        }}
      >
        {'到点 · 塞一张请求条'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C p4-15..18 空窗回落：岗哨试锁双分支 ─────────────────────────────

const LockSentry: React.FC<{atSentry: number; atTry: number; atGot: number; atBusy: number}> = ({
  atSentry,
  atTry,
  atGot,
  atBusy,
}) => {
  const sentryIn = useProgress(atSentry, DUR.f5);
  const tryIn = useProgress(atTry, DUR.f5);
  // 锁图标呼吸（mech——岗哨的持续在场感）
  const lockGlow = useBreathe({period: 46, amp: 0.3, base: 0.7});
  // 拿得到＝空：锁环抬起 + 条子递上传送带（flowDash 路径 + 平移）
  const open = useProgress(atGot, DUR.f4);
  const pass = useProgress(atGot + DUR.f3, DUR.f5);
  const okFlash = useImpulse({at: atGot + DUR.f5, dur: DUR.f5, peak: 1});
  const dash = useFlowDash({dash: 9, gap: 12, period: 16});
  // 拿不到＝忙：这一拍跳过（deny 暗闪 + 传送带侧压暗）
  const busy = useProgress(atBusy, DUR.f4);
  const skipFlash = useImpulse({at: atBusy, dur: DUR.f5, peak: 1});
  const dimBelt = useDim({at: atBusy, to: 0.45, dur: DUR.f5});

  return (
    <AbsoluteFill>
      {/* 存条格（左，mech 暗档） */}
      <div style={{position: 'absolute', left: 300, top: 470, opacity: sentryIn}}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: i * 26,
              top: i * 8,
              width: 120,
              height: 64,
              borderRadius: 8,
              border: `3px solid ${theme.mechDeep}`,
              background: theme.panel,
              opacity: 0.55 + 0.15 * i,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 0, top: 110, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
          {'存条的格子'}
        </div>
      </div>

      {/* 岗哨 + 锁（中）：怎么判忙闲？去拿那把干活锁 */}
      <div style={{position: 'absolute', left: 790, top: 400, opacity: sentryIn}}>
        <div
          style={{
            width: 220,
            height: 150,
            borderRadius: '14px 14px 0 0',
            border: `3px solid ${theme.mech}`,
            borderBottom: 'none',
            background: theme.panel,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 10,
          }}
        >
          <svg width={92} height={104}>
            {/* 锁体 + 锁环（拿得到 ⇒ 锁环抬起 open 像素） */}
            <path
              d={`M26 ${58 - 22 * open} A20 20 0 0 1 66 ${58 - 22 * open}`}
              fill="none"
              stroke={theme.mech}
              strokeWidth={7}
              opacity={lockGlow}
            />
            <rect x={20} y={56} width={52} height={40} rx={8} fill={theme.panel} stroke={theme.mech} strokeWidth={5} />
            <circle cx={46} cy={74} r={5} fill={theme.mech} />
          </svg>
        </div>
        <div
          style={{
            marginTop: 10,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.mech,
            opacity: sentryIn * (1 - busy * 0.7),
          }}
        >
          {'岗哨 · 试锁'}
        </div>
        <div
          style={{
            marginTop: 6,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
            opacity: tryIn,
          }}
        >
          {'acquire(blocking=False)'}
        </div>
      </div>

      {/* 分支 A（p4-17）：拿得到＝空——条子递上传送带，ok 一闪 */}
      <svg width={1920} height={300} style={{position: 'absolute', left: 0, top: 460}}>
        <path
          d="M1030 170 H1420"
          stroke={theme.mech}
          strokeWidth={4}
          fill="none"
          opacity={1 - busy}
          strokeDasharray={dash.strokeDasharray}
          strokeDashoffset={dash.strokeDashoffset}
        />
        <rect
          x={1030 + 330 * clamp01(pass)}
          y={132}
          width={86}
          height={40}
          rx={6}
          fill={theme.panel}
          stroke={theme.mech}
          strokeWidth={3}
          opacity={(open > 0.5 ? 1 : 0) * (1 - busy)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 392,
          fontFamily: theme.sans,
          fontSize: 25,
          fontWeight: 600,
          color: theme.ok,
          opacity: okFlash * (1 - busy),
        }}
      >
        {'空 · 递上传送带'}
      </div>

      {/* 传送带收条（右，core 恒转——收条一拍带不停） */}
      <div style={{opacity: dimBelt}}>
        <div style={{position: 'absolute', left: 1440, top: 540}}>
          <svg width={280} height={70}>
            <line x1={0} y1={18} x2={260} y2={18} stroke={theme.coreDeep} strokeWidth={9} strokeLinecap="round" />
            <rect
              x={40 + 30 * clamp01(pass)}
              y={-8}
              width={78}
              height={24}
              rx={5}
              fill={theme.panel}
              stroke={theme.core}
              strokeWidth={3}
            />
          </svg>
        </div>
      </div>

      {/* 分支 B（p4-18）：拿不到＝忙——这一拍跳过（deny 暗闪） */}
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 392,
          fontFamily: theme.sans,
          fontSize: 25,
          fontWeight: 600,
          color: withAlpha(theme.deny, 0.5 + 0.5 * skipFlash),
          opacity: busy,
        }}
      >
        {'忙 · 这一拍跳过'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D p4-20 空窗回落：钟话条与人话条同色同轨并列 ─────────────────────

const StreamMerge: React.FC = () => {
  const bars = useStagger(2, {at: 4, stride: 18, dur: DUR.f5});
  const track = useProgress(DUR.f6, DUR.f5);
  const rows = [
    {who: '人说', border: theme.panelBorder, fill: theme.text},
    {who: '钟说', border: theme.mech, fill: theme.mech},
  ];
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 300,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 600,
          color: theme.text,
          opacity: track,
        }}
      >
        {'同一条流 · 听不出差别'}
      </div>
      <div style={{position: 'absolute', left: 560, top: 420, width: 800}}>
        {rows.map((r, i) => (
          <div
            key={r.who}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              marginBottom: 34,
              opacity: bars[i],
              transform: `translateX(${(1 - bars[i]) * (i === 0 ? -40 : 40)}px)`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, width: 70}}>{r.who}</span>
            <div
              style={{
                flex: 1,
                height: 58,
                borderRadius: 12,
                background: theme.panel,
                border: `3px solid ${r.border}`,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 20,
                fontFamily: theme.mono,
                fontSize: 24,
                color: r.fill,
              }}
            >
              {i === 0 ? '[user] 看一眼结果' : '[Scheduled] 该跑了'}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D p4-22 空窗回落：四层总结卡 ──────────────────────────────────────

const FOUR_LAYERS: [string, string][] = [
  ['判时', '钟'],
  ['存条', '格子'],
  ['判闲', '岗哨'],
  ['干活', '传送带'],
];

const FourLayersCard: React.FC = () => {
  const cells = useStagger(FOUR_LAYERS.length, {at: 4, stride: 10, dur: DUR.f4});
  const strip = useProgress(4 + FOUR_LAYERS.length * 10 + 6, DUR.f4);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <Panel style={{width: 1360, padding: '30px 36px'}}>
        <div style={{display: 'flex', gap: 26}}>
          {FOUR_LAYERS.map(([verb, dev], i) => (
            <div key={verb} style={{flex: 1, opacity: cells[i], transform: `translateY(${(1 - cells[i]) * 20}px)`}}>
              <Panel accent={theme.mechDeep} style={{padding: '20px 14px', textAlign: 'center'}}>
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{`0${i + 1}`}</div>
                <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text, marginTop: 6}}>
                  {verb}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.mech, marginTop: 8}}>{dev}</div>
              </Panel>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 26,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 25,
            color: theme.dim,
            opacity: strip,
          }}
        >
          {'每层只干一件事 · 没有谁顺便看表'}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

// ── 4-E p4-23 空窗回落：秒针扫过六十格，同一分钟命中格连闪 ─────────────

const MINUTE_CELLS = 12;

const MinuteScan: React.FC = () => {
  const sec = useTravel({cx: 0, cy: 0, r: 1, secPerLap: 2});
  const deg = sec.angle + 90;
  const markIn = useImpulse({at: DUR.f3, dur: DUR.f6, peak: 1});
  const dial = useProgress(2, DUR.f4);
  // 命中格连闪：手到格亮（纯函数 per-cell——铁律①的 map 形态）
  const cells = Array.from({length: MINUTE_CELLS}, (_, i) => {
    const cellDeg = (i * 360) / MINUTE_CELLS;
    let d = Math.abs(deg - cellDeg) % 360;
    if (d > 180) d = 360 - d;
    return {cellDeg, lit: d < 22 ? 1 - d / 22 : 0};
  });
  const cx = 960;
  const cy = 500;
  return (
    <AbsoluteFill style={{opacity: dial}}>
      <ClockFace cx={cx} cy={cy} r={150} secDeg={deg} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {cells.map((c, i) => {
          const rad = ((c.cellDeg - 90) * Math.PI) / 180;
          const x1 = cx + 196 * Math.cos(rad);
          const y1 = cy + 196 * Math.sin(rad);
          const x2 = cx + 232 * Math.cos(rad);
          const y2 = cy + 232 * Math.sin(rad);
          const isMark = i === 2; // 当前分钟命中格（mech 常亮 + 起始脉冲）
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isMark ? theme.mech : c.lit > 0 ? theme.mechDeep : theme.panelBorder}
                strokeWidth={isMark ? 10 : 7}
                opacity={isMark ? 0.5 + 0.5 * markIn : 0.35 + 0.65 * c.lit}
              />
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 800,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 27,
          color: theme.text,
          opacity: dial,
        }}
      >
        <span style={{color: theme.mech}}>{'每秒都醒'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span>{'最小刻度是分钟'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-F 官方对齐卡：轮间触发时间轴（p4-32..35） ─────────────────────────

type TurnSeg = {x: number; w: number; kind: 'user' | 'sched' | 'busy'};

const TURN_SEGS: TurnSeg[] = [
  {x: 240, w: 300, kind: 'user'},
  {x: 560, w: 120, kind: 'sched'},
  {x: 700, w: 300, kind: 'user'},
  {x: 1000, w: 120, kind: 'sched'},
  {x: 1140, w: 520, kind: 'busy'},
  {x: 1690, w: 0, kind: 'sched'},
];

const TurnTimeline: React.FC<{atBars: number; atBusy: number}> = ({atBars, atBusy}) => {
  const bars = useStagger(TURN_SEGS.length, {at: atBars, stride: 9, dur: DUR.f4});
  // 时间轴推进（进度是测量不是动效——线性）
  const wipe = useProgress(atBars, TURN_SEGS.length * 9 + DUR.f5, 'linear');
  // busy 段置灰（定时话条等本轮结束）
  const busy = useDim({at: atBusy, to: 0.4, dur: DUR.f5});
  const pills = useProgress(atBars - DUR.f4, DUR.f4);
  const insertIn = useProgress(atBars + TURN_SEGS.length * 9, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 300, width: 1920, textAlign: 'center', opacity: pills}}>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 25,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 999,
            padding: '6px 22px',
            margin: '0 12px',
          }}
        >
          {'每秒检查'}
        </span>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 25,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 999,
            padding: '6px 22px',
            margin: '0 12px',
          }}
        >
          {'低优先级'}
        </span>
      </div>

      {/* 时间轴基线 + 进度擦除（core——测量色） */}
      <svg width={1920} height={360} style={{position: 'absolute', left: 0, top: 420}}>
        <line x1={220} y1={160} x2={1700} y2={160} stroke={theme.panelBorder} strokeWidth={5} />
        <line
          x1={220}
          y1={160}
          x2={220 + 1480 * clamp01(wipe)}
          y2={160}
          stroke={theme.coreDeep}
          strokeWidth={5}
        />
      </svg>
      {TURN_SEGS.map((s, i) => {
        if (s.w === 0) return null;
        const isSched = s.kind === 'sched';
        const e = bars[i];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.kind === 'busy' ? 130 : 138,
              width: s.w,
              height: isSched ? 44 : 60,
              borderRadius: 10,
              background: isSched ? withAlpha(theme.mechDeep, 0.5) : theme.panel,
              border: `3px ${isSched ? 'solid' : 'solid'} ${isSched ? theme.mech : theme.dim}`,
              opacity: e * (s.kind === 'busy' ? busy : 1),
              transform: `translateY(${(1 - e) * 18}px)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 22,
              color: isSched ? theme.mech : theme.dim,
            }}
          >
            {s.kind === 'busy' ? '本轮 · 说一半' : isSched ? '钟' : '你'}
          </div>
        );
      })}
      {/* 定时话只插在两轮之间（绝不在半截打断） */}
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 240,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.mech,
          opacity: insertIn,
        }}
      >
        {'只在两轮之间 · 插话'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1160,
          top: 240,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: insertIn,
        }}
      >
        {'等本轮结束 · 再递进来'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────


// ── 4-A 钟摆强调（Remotion 原生，替代 Lottie clock-swing）──────────────────
/** 吊杆+摆锤：进场 12 帧内升起，随后等幅缓摆（正弦衰减）——到点响起的物理感。 */
const PendulumGlyph: React.FC<{at: number; left: number; top: number}> = ({at, left, top}) => {
  const rise = useEnter('rise', {at, dur: DUR.f4, dist: 26});
  // 摆动相位：0→1 线性走完 240 帧（~3 次完整摆衰减）；窗尽钳 1 ⇒ deg=0 归正中
  const t = useProgress(at + DUR.f4, 240, 'linear');
  const deg = 26 * Math.sin(t * Math.PI * 6) * Math.exp(-t * 1.6); // 衰减摆
  return (
    <div style={{position: 'absolute', left, top, width: 216, height: 302, opacity: rise.opacity * 0.95}}>
      <svg width={216} height={302} viewBox="0 0 216 302">
        <g transform={`rotate(${deg} 108 8)`} style={{transformOrigin: '108px 8px'}}>
          <line x1={108} y1={8} x2={108} y2={238} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
          <circle cx={108} cy={252} r={26} fill={theme.panel} stroke={theme.mech} strokeWidth={5} />
          <circle cx={108} cy={252} r={7} fill={theme.mech} />
        </g>
        <circle cx={108} cy={8} r={9} fill={theme.panelBorder} />
      </svg>
    </div>
  );
};

export const P4Clock: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-08');
  const bB = w('p4-09', 'p4-11');
  const bC = w('p4-12', 'p4-19');
  const bD = w('p4-20', 'p4-22');
  const bE = w('p4-23', 'p4-31');
  const bF = w('p4-32', 'p4-35');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 定时钟落墙">
        <SceneTag chapter="cron" tagline="墙上的定时钟" />
        <ClockWall
          atSeven={at('p4-04') - bA.from}
          atBell={at('p4-05') - bA.from}
          atMount={at('p4-06') - bA.from}
          atTable={at('p4-07') - bA.from}
          atSlots={at('p4-08') - bA.from}
          span={bA.durationInFrames}
        />
        <Footnote delay={at('p4-01') - bA.from}>{'0 9 * * * · cron · Unix · 50 years'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="4-B 四层总图首现">
        {/* P4 首个 archify 实例 → 默认 lead */}
        <ArchifyRecap
          slug="clock-four-layers"
          caption="四层解耦"
          cues={[
            {chapterId: 'clock-blind', at: at('p4-10') - bB.from, durationInFrames: dur('p4-10')},
            {chapterId: 'four-roles', at: at('p4-11') - bB.from, durationInFrames: dur('p4-11')},
          ]}
        />
        <Sequence from={at('p4-09') - bB.from} durationInFrames={dur('p4-09')} name="4-B 背对示意一现">
          <BackToBack />
        </Sequence>
        <Footnote delay={at('p4-09') - bB.from}>{'cron_scheduler_loop · cron_queue · agent_lock · [Scheduled]'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="4-C 前三层单向链">
        {/* 与 4-B 同图帧相邻（four-roles 末帧 ⇄ tick-keeper 首帧）⇒ lead={false} */}
        <ArchifyRecap
          slug="clock-four-layers"
          caption="四层解耦"
          lead={false}
          cues={[
            {chapterId: 'tick-keeper', at: at('p4-12') - bC.from, durationInFrames: dur('p4-12')},
            {chapterId: 'slot-keeper', at: at('p4-14') - bC.from, durationInFrames: dur('p4-14')},
            {chapterId: 'lock-is-state', at: at('p4-19') - bC.from, durationInFrames: dur('p4-19')},
          ]}
        />
        <Sequence from={at('p4-13') - bC.from} durationInFrames={dur('p4-13')} name="4-C 塞条一拍">
          <SlotDrop />
        </Sequence>
        <Sequence
          from={at('p4-15') - bC.from}
          durationInFrames={dur('p4-15') + dur('p4-16') + dur('p4-17') + dur('p4-18')}
          name="4-C 岗哨试锁双分支"
        >
          <LockSentry
            atSentry={0}
            atTry={at('p4-16') - at('p4-15')}
            atGot={at('p4-17') - at('p4-15')}
            atBusy={at('p4-18') - at('p4-15')}
          />
        </Sequence>
        <Footnote delay={at('p4-12') - bC.from}>{'sleep(1) · agent_lock.acquire(blocking=False)'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="4-D 第四层收话">
        {/* lock-is-state 末帧隔 p4-20 空窗 ⇒ 默认 lead（空窗后恢复入场） */}
        <ArchifyRecap
          slug="clock-four-layers"
          caption="四层解耦"
          cues={[
            {chapterId: 'same-stream', at: at('p4-21') - bD.from, durationInFrames: dur('p4-21')},
          ]}
        />
        <Sequence from={at('p4-20') - bD.from} durationInFrames={dur('p4-20')} name="4-D 消息条并列">
          <StreamMerge />
        </Sequence>
        <Sequence from={at('p4-22') - bD.from} durationInFrames={dur('p4-22')} name="4-D 四层总结卡">
          <FourLayersCard />
        </Sequence>
        <Footnote delay={at('p4-20') - bD.from}>{'[Scheduled] {prompt}'}</Footnote>
      </Sequence>

      <Sequence {...bE} name="4-E 防重放＋坏闹钟">
        {/* 前图（same-stream）隔 p4-22/p4-23 空窗 ⇒ 默认 lead */}
        <ArchifyRecap
          slug="clock-dedupe"
          caption="带日期去重"
          cues={[
            {chapterId: 'sixty-glances', at: at('p4-24') - bE.from, durationInFrames: dur('p4-24')},
            {chapterId: 'date-plus-minute', at: at('p4-25') - bE.from, durationInFrames: dur('p4-25')},
            {chapterId: 'hhmm-trap', at: at('p4-26') - bE.from, durationInFrames: dur('p4-26')},
            {chapterId: 'one-key-two-errors', at: at('p4-27') - bE.from, durationInFrames: dur('p4-27')},
          ]}
        />
        {/* 坏闹钟实例接前图末章（one-key-two-errors）帧相邻 ⇒ lead={false} */}
        <ArchifyRecap
          slug="clock-bad-jobs"
          caption="坏任务三层防护"
          lead={false}
          cues={[
            {chapterId: 'validate-first', at: at('p4-28') - bE.from, durationInFrames: dur('p4-28')},
            {chapterId: 'quarantine-bad', at: at('p4-30') - bE.from, durationInFrames: dur('p4-30')},
            {chapterId: 'fire-and-delete', at: at('p4-31') - bE.from, durationInFrames: dur('p4-31')},
          ]}
        />
        <Sequence from={at('p4-23') - bE.from} durationInFrames={dur('p4-23')} name="4-E 秒针扫格一现">
          <MinuteScan />
        </Sequence>
        <Footnote delay={at('p4-23') - bE.from}>{'minute_marker · validate_cron · recurring=False'}</Footnote>
      </Sequence>

      <Sequence {...bF} name="4-F 轮间触发时间轴">
        <TurnTimeline atBars={at('p4-33') - bF.from} atBusy={at('p4-35') - bF.from} />
        <Footnote delay={at('p4-32') - bF.from}>{'low priority · between your turns'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4Clock;
