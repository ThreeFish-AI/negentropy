/** P1 排工板（p1-01..19，5 镜 11 cue）——分镜 1-A…1-E。
 *
 *  ★ 空间契约：排工板母题居中（mech 金协作中枢）；传送带母题（LoopRing，
 *    core 橙恒定描边〔M-001〕）恒居左中锚位、此处小尺寸露一角；物件自右缘挂入。
 *  ★ 1-A 的 3D 卡片磁吸是本集唯二 3D 点缀之一（planning §3）：只做直角体
 *    Slab3D、读感来自转物体不动相机、面色走深底族概念色只走棱线；3D 组件
 *    零 motion hook，运动量（seat/opacity）由本幕以 prop 注入。
 *  archify 三图（task-board / board-vs-todo / dependency-unlock）全屏独占：
 *    一章锚一句；跨实例背靠背（含镜界）后挂实例关入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, SceneTag, useRingDot} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {SHELL_FACES, Slab3D, Stage3D} from '../components/solids-3d';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, useEnter, useFlowDash, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 与 SceneTag 同行
 *  （P1–P6 须同值，由组装方统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 排工板母题（本集新件 · 协作中枢） ───────────────────────────────────

export type BoardCard = {title: string; status?: string};

/** 排工板：mech 金板框 + 活卡钉板。cards 全量渲染；每卡透明度/缩放由调用方
 *  以数值数组注入（map 内禁 hook——铁律①的调用方侧解法）。 */
export const TaskBoard: React.FC<{
  cards: BoardCard[];
  /** 每卡入场进度 0..1（缺省全 1） */
  enters?: number[];
  width?: number;
}> = ({cards, enters, width = 600}) => (
  <div
    style={{
      width,
      background: theme.panel,
      border: `3px solid ${theme.mech}`,
      borderRadius: 16,
      padding: '16px 22px 20px',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: 10,
        borderBottom: `2px solid ${theme.panelBorder}`,
      }}
    >
      <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.mech}}>
        {'排工板'}
      </span>
      <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'.tasks/'}</span>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14}}>
      {cards.map((c, i) => {
        const p = enters?.[i] ?? 1;
        return (
          <div
            key={c.title}
            style={{
              position: 'relative',
              background: theme.bg,
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 10,
              padding: '26px 16px 12px',
              textAlign: 'center',
              opacity: p,
              transform: `scale(${0.9 + 0.1 * p})`,
            }}
          >
            {/* 钉：mech 圆点（卡与板的连接件——「钉上板」的读法来源） */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 8,
                width: 10,
                height: 10,
                marginLeft: -5,
                borderRadius: 999,
                background: theme.mech,
              }}
            />
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>
              {c.title}
            </div>
            {c.status ? (
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 4}}>
                {c.status}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
);

/** 1-A 板上四张子活（呼应 P0 的「重构整个后端」拆解——大目标先拆开） */
const DEBUT_CARDS: BoardCard[] = [
  {title: '认证', status: 'pending'},
  {title: '数据库', status: 'pending'},
  {title: '路由', status: 'blocked'},
  {title: '测试', status: 'pending'},
];

// ── 1-A 3D 卡片磁吸（唯二 3D 点缀之一） ────────────────────────────────

const SNAP = {cardW: 220, cardH: 138, canvasW: 540, canvasH: 360} as const;

/** 3D 磁吸：一张方卡从右上悬空位吸落到板面。seat 0 = 悬空（带偏航），1 = 贴板。
 *  零 motion hook——seat/opacity 由调用方注入（solids-3d 宪法）。 */
const CardSnap3D: React.FC<{seat: number; opacity: number}> = ({seat, opacity}) => {
  const s = clamp01(seat);
  // 起点：右上远处（x+150 / y-112 / z+230，偏航 38°）→ 终点：板心贴面（yaw 8° 静置角）
  const x = (1 - s) * 150;
  const y = (1 - s) * -112;
  const z = 16 + (1 - s) * 230;
  const yaw = 8 + (1 - s) * 30;
  return (
    <Stage3D width={SNAP.canvasW} height={SNAP.canvasH} style={{opacity}}>
      <group rotation={[(-10 * Math.PI) / 180, (yaw * Math.PI) / 180, 0]} position={[x, y, 0]}>
        {/* 板面（磁吸目标）：深底暗板 + 中性棱线——概念色不上面（读色契约） */}
        <Slab3D
          width={SNAP.cardW + 200}
          height={SNAP.cardH + 160}
          depth={8}
          skin={{face: SHELL_FACES[3], edge: theme.panelBorder, noEdges: false}}
        />
        {/* 飞卡：面色深底族、mech 只走棱线 */}
        <Slab3D
          width={SNAP.cardW}
          height={SNAP.cardH}
          depth={12}
          position={[0, 0, z]}
          skin={{face: SHELL_FACES[0], edge: theme.mech}}
        />
      </group>
    </Stage3D>
  );
};

// ── 1-A 排工板首现 ──────────────────────────────────────────────────────

/** 次序示意：屋顶卡初始在上（错序）→ deny 短闪 → 翻正沉到地基卡下方 */
const OrderDemo: React.FC<{at: number}> = ({at}) => {
  const inL = useEnter('pop', {at, dur: DUR.f4});
  const deny = useImpulse({at: at + DUR.f4, dur: DUR.f5});
  const flip = useSpring('settle', {at: at + DUR.f4 + 8, dur: DUR.f6});
  const done = useProgress(at + DUR.f4 + 8 + DUR.f5, DUR.f4);
  const shift = flip * 92;
  const card = (label: string, y: number, hot: number) => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: y,
        width: 208,
        padding: '18px 0',
        textAlign: 'center',
        borderRadius: 10,
        background: withAlpha(theme.danger, 0.22 * deny),
        border: `2px solid ${hot > 0.5 ? theme.mech : deny > 0.15 ? theme.deny : theme.panelBorder}`,
        boxShadow: `0 0 ${18 * deny}px ${withAlpha(theme.danger, 0.6 * deny)}`,
      }}
    >
      <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
        {label}
      </span>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: 1460, top: 330, width: 208, height: 210, ...inL}}>
      {/* 翻正：屋顶（初始在上）沉到地基下方——先地基后屋顶 */}
      {card('屋顶', 8 + shift, 0)}
      {card('地基', 104 - shift, done)}
      <div
        style={{
          position: 'absolute',
          left: -96,
          top: 96,
          width: 88,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: done,
        }}
      >
        {'先 ↓'}
      </div>
    </div>
  );
};

const BoardDebut: React.FC<{atOrder: number; atDepend: number}> = ({atOrder, atDepend}) => {
  const boardIn = useEnter('pop', {at: 4, dur: DUR.f5});
  const ringIn = useProgress(6, DUR.f4);
  // 3D 磁吸：首句中段一现，收敛后 2D 卡片逐张钉板
  const snapAt = 12;
  const seat = useProgress(snapAt, DUR.f6, 'decelerate');
  const d3out = useProgress(snapAt + DUR.f6 + 2, DUR.f4);
  const atCards = snapAt + DUR.f6 + 4;
  const cards = useStagger(DEBUT_CARDS.length, {at: atCards, stride: 5, dur: DUR.f4});
  const laps = useRingDot(2.5);
  // 「次序」字卡（p1-02：活和活之间有先后）
  const orderIn = useProgress(atOrder, DUR.f4);

  return (
    <AbsoluteFill>
      <SceneTag chapter="排工板" tagline="活放板上" />

      {/* 传送带母题露一角：左中锚位、小尺寸、恒 core 橙描边〔M-001〕 */}
      <div style={{position: 'absolute', left: 140, top: 420, opacity: ringIn}}>
        <LoopRing size={240} showLabels={false} dotProgress={laps} showExit={false} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 240,
            width: 240,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.dim,
            opacity: ringIn,
          }}
        >
          {'传送带'}
        </div>
      </div>

      {/* 排工板（居中——协作中枢空间契约） */}
      <div style={{position: 'absolute', left: 960 - 300, top: 350, ...boardIn}}>
        <TaskBoard cards={DEBUT_CARDS} enters={cards} />
      </div>

      {/* 3D 卡片磁吸一现：画布紧贴板区（Left 中偏上），只在出场窗口内挂载 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - SNAP.canvasW / 2,
          top: 470 - SNAP.canvasH / 2,
          width: SNAP.canvasW,
          height: SNAP.canvasH,
          pointerEvents: 'none',
        }}
      >
        <Sequence from={snapAt} durationInFrames={DUR.f6 + DUR.f4 + 2} layout="none">
          <CardSnap3D seat={seat} opacity={1 - d3out} />
        </Sequence>
      </div>

      {/* 「次序」字卡（p1-02） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 208,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 54,
          fontWeight: 700,
          color: theme.text,
          opacity: orderIn,
        }}
      >
        {'次序'}
      </div>

      {/* 次序示意（p1-03，右缘挂入——空间契约） */}
      <OrderDemo at={atDepend} />

      <Footnote delay={8}>{'.tasks/ · blockedBy'}</Footnote>
    </AbsoluteFill>
  );
};

// ── mono 引语卡（自陈 / 官方共用形态） ──────────────────────────────────

/** 徽标 + mono 逐字引语（两行封顶——useReveal 不可进 map，铁律①） */
const MonoQuote: React.FC<{
  badge: string;
  badgeColor: string;
  line1: string;
  line2?: string;
  line2Color?: string;
  at: number;
  cps?: number;
  width?: number;
}> = ({badge, badgeColor, line1, line2, line2Color, at, cps = 15, width = 1180}) => {
  const card = useEnter('fade', {at, dur: DUR.f5});
  const r1 = useReveal(line1, {at: at + 4, cps});
  const r2 = useReveal(line2 ?? '', {at: at + DUR.f5, cps});
  return (
    <div style={{...card}}>
      <Panel style={{width, padding: '28px 38px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <span
            style={{
              fontFamily: theme.sans,
              fontSize: 22,
              color: badgeColor,
              border: `2px solid ${badgeColor}`,
              borderRadius: 6,
              padding: '2px 10px',
            }}
          >
            {badge}
          </span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 40, lineHeight: 1.7, marginTop: 20, minHeight: 140}}>
          <span style={{fontFamily: theme.serif, fontSize: 58, color: theme.panelBorder}}>{'“'}</span>
          <div style={{color: theme.text, whiteSpace: 'pre'}}>{r1}</div>
          {line2 ? (
            <div style={{color: line2Color ?? theme.mech, whiteSpace: 'pre'}}>{r2}</div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
};

// ── 1-D 认领与锁 ────────────────────────────────────────────────────────

/** 双伸手同卡：两师傅剪影同时伸手抢同一张活，后到者 deny 红短闪。
 *  布局用统一局部坐标（根 680×240）：臂/剪影/卡全部相对根定位，杜绝嵌套偏移累计。 */
const DoubleReach: React.FC<{at: number; out?: number}> = ({at, out = 0}) => {
  const cardIn = useEnter('pop', {at, dur: DUR.f4});
  const reachL = useProgress(at + 6, DUR.f5, 'decelerate');
  const reachR = useProgress(at + 6 + DUR.f4, DUR.f5, 'decelerate');
  const deny = useImpulse({at: at + 6 + DUR.f5 + 4, dur: DUR.f5});
  const silhouette = (x: number) => (
    <svg width={64} height={110} style={{position: 'absolute', left: x, top: 76}}>
      <circle cx={32} cy={22} r={18} fill={theme.text} opacity={0.92} />
      <path d="M8 104 Q8 44 32 40 Q56 44 56 104 Z" fill={theme.text} opacity={0.92} />
    </svg>
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: 960 - 340,
        top: 540,
        width: 680,
        height: 240,
        opacity: cardIn.opacity * (1 - out),
        transform: cardIn.transform,
      }}
    >
      {/* 两臂（text 白，无彩——师傅剪影与手一律无彩） */}
      <svg width={680} height={240} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d={`M104 118 L${104 + 216 * reachL} 118`}
          stroke={theme.text}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M${104 + 216 * reachL} 118 l28 0`}
          stroke={theme.text}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M576 118 L${576 - 216 * reachR} 118`}
          stroke={theme.text}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M${576 - 216 * reachR} 118 l-28 0`}
          stroke={theme.text}
          strokeWidth={10}
          strokeLinecap="round"
        />
      </svg>
      {silhouette(60)}
      {silhouette(556)}
      {/* 中央：同一张活（先到者 mech 认领、后到者 deny 闪） */}
      <div
        style={{
          position: 'absolute',
          left: 220,
          top: 30,
          width: 240,
          padding: '20px 0',
          textAlign: 'center',
          borderRadius: 10,
          background: theme.bg,
          border: `2px solid ${deny > 0.15 ? theme.deny : theme.mech}`,
          boxShadow: `0 0 ${22 * deny}px ${withAlpha(theme.danger, 0.55 * deny)}`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text}}>
          {'同一张活'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 20,
            marginTop: 6,
            color: deny > 0.15 ? theme.deny : theme.mech,
          }}
        >
          {deny > 0.15 ? '领不走' : '已认领'}
        </div>
      </div>
    </div>
  );
};

/** p1-14..15 自制段：教学自陈（+双伸手）→ 官方文件锁引语 */
const ClaimScene: React.FC<{atSelf: number; atOfficial: number; span: number}> = ({
  atSelf,
  atOfficial,
  span,
}) => {
  const selfOut = useProgress(atOfficial, DUR.f4);
  const reachAt = Math.min(atSelf + 14, atOfficial - 2);
  return (
    <AbsoluteFill>
      {/* 教学版自陈（mono 引语态，官方卡入场时淡出） */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 590,
          top: 260,
          opacity: 1 - selfOut,
        }}
      >
        <MonoQuote
          badge="教学版自陈"
          badgeColor={theme.dim}
          line1={'没有文件锁，并发认领'}
          line2={'可能出现竞争'}
          at={atSelf}
        />
      </div>
      <DoubleReach at={reachAt} out={selfOut} />
      {/* 官方引语卡（产品文件锁） */}
      <div style={{position: 'absolute', left: 960 - 590, top: 300}}>
        <Sequence from={atOfficial} durationInFrames={Math.max(1, span - atOfficial)} layout="none">
          <MonoQuote
            badge="官"
            badgeColor={theme.core}
            line1={'Task claiming uses file locking'}
            line2={'to prevent race conditions'}
            at={0}
          />
        </Sequence>
      </div>
      <Footnote delay={atSelf}>{'claim_task · owner'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-E 状态滞后与活锁 ──────────────────────────────────────────────────

/** 活锁小动画：两张卡互相等待，deny 箭头绕圈死转（useFlowDash 行进虚线） */
const LivelockLoop: React.FC<{at: number}> = ({at}) => {
  const inL = useEnter('fade', {at, dur: DUR.f5});
  const flow = useFlowDash({dash: 12, gap: 10, period: 26});
  const node = (label: string, x: number, sub: string) => (
    <div style={{position: 'absolute', left: x, top: 40, width: 250, ...inL}}>
      <Panel style={{padding: '20px 12px', textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>
          {label}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 5}}>
          {sub}
        </div>
      </Panel>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: 1210, top: 300, width: 700, height: 300}}>
      {node('干完了', 0, '状态没改')}
      {node('等着它', 450, '永远等')}
      <svg width={700} height={300} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 上弧：干完了 → 等着它（依赖指向） */}
        <path
          d="M250 96 C 340 30, 360 30, 450 96"
          fill="none"
          stroke={theme.deny}
          strokeWidth={4}
          {...flow}
        />
        {/* 下弧：等着它 → 干完了（回去查状态，又没改） */}
        <path
          d="M450 156 C 360 226, 340 226, 250 156"
          fill="none"
          stroke={theme.deny}
          strokeWidth={4}
          {...flow}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 300,
          top: 118,
          width: 100,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          fontWeight: 700,
          color: theme.deny,
          opacity: inL.opacity,
        }}
      >
        {'死等'}
      </div>
    </div>
  );
};

/** p1-17 官方限制卡 + 活锁（p1-18 让位前的自制段） */
const LagScene: React.FC<{span: number}> = ({span}) => {
  const atLoop = 16;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 150, top: 300}}>
        <MonoQuote
          badge="官"
          badgeColor={theme.core}
          line1={'Task status can lag: teammates'}
          line2={'sometimes fail to mark tasks'}
          at={2}
          width={980}
        />
      </div>
      <Sequence from={atLoop} durationInFrames={Math.max(1, span - atLoop)} layout="none">
        <LivelockLoop at={0} />
      </Sequence>
      <Footnote delay={4}>{'Task status can lag'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1TaskBoard: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-08');
  const bC = w('p1-09', 'p1-12');
  const bD = w('p1-13', 'p1-16');
  const bE = w('p1-17', 'p1-19');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="1-A 排工板首现（3D 磁吸一现）">
        <BoardDebut atOrder={at('p1-02') - bA.from} atDepend={at('p1-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="1-B 一文件一活与两层账本">
        {/* 首图与 P0 末图隔多句空窗 → 默认入场 */}
        <ArchifyRecap
          slug="task-board"
          caption="排工板"
          cues={[
            {chapterId: 'file-per-task', at: at('p1-04') - bB.from, durationInFrames: dur('p1-04')},
            {chapterId: 'six-fields', at: at('p1-05') - bB.from, durationInFrames: dur('p1-05')},
            {chapterId: 'three-states', at: at('p1-06') - bB.from, durationInFrames: dur('p1-06')},
          ]}
        />
        {/* 与前图跨实例背靠背（p1-06 末 = p1-07 始）→ 关入场 */}
        <ArchifyRecap
          slug="board-vs-todo"
          caption="板与待办"
          lead={false}
          cues={[
            {chapterId: 'two-layers', at: at('p1-07') - bB.from, durationInFrames: dur('p1-07')},
            {chapterId: 'crash-resume', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 依赖检查与解锁播报">
        {/* 与 1-B 末图跨实例背靠背（含镜界）→ 关入场；四章接力无空窗 */}
        <ArchifyRecap
          slug="dependency-unlock"
          caption="依赖与解锁"
          lead={false}
          cues={[
            {chapterId: 'gate-before-start', at: at('p1-09') - bC.from, durationInFrames: dur('p1-09')},
            {chapterId: 'missing-blocked', at: at('p1-10') - bC.from, durationInFrames: dur('p1-10')},
            {chapterId: 'bad-premise', at: at('p1-11') - bC.from, durationInFrames: dur('p1-11')},
            {chapterId: 'unlock-broadcast', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 认领与锁">
        {/* 与 1-C 末图跨实例背靠背（含镜界换图）→ 关入场 */}
        <ArchifyRecap
          slug="task-board"
          caption="排工板"
          lead={false}
          cues={[{chapterId: 'claim-owner', at: at('p1-13') - bD.from, durationInFrames: dur('p1-13')}]}
        />
        <Sequence
          from={at('p1-14') - bD.from}
          durationInFrames={Math.max(1, at('p1-16') - at('p1-14'))}
        >
          <ClaimScene
            atSelf={0}
            atOfficial={at('p1-15') - at('p1-14')}
            span={at('p1-16') - at('p1-14')}
          />
        </Sequence>
        <Sequence from={at('p1-16') - bD.from} name="1-D 金句卡">
          <QuoteCard zh="人人能看 · 一人撕卡" />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="1-E 状态滞后">
        <Sequence durationInFrames={at('p1-18') - bE.from}>
          <LagScene span={at('p1-18') - bE.from} />
        </Sequence>
        {/* 1-C 末图后隔四句空窗 → 默认入场 */}
        <ArchifyRecap
          slug="dependency-unlock"
          caption="依赖与解锁"
          cues={[
            {chapterId: 'lag-livelock', at: at('p1-18') - bE.from, durationInFrames: dur('p1-18')},
          ]}
        />
        <Sequence from={at('p1-19') - bE.from} name="1-E 金句卡">
          <QuoteCard zh="挡得住前提 · 挡不住忘单" />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1TaskBoard;
