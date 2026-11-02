/** P3 看见不等于抢到（p3-01..p3-13，5 镜）——分镜 3-A / 3-B / 3-C / 3-D / 3-E。
 *
 *  Morph Continuity（2-D→3-A，头注明示）：同一主体 = 「同一拍同一张卡」双影。
 *  起止态：2-D 末帧双影半透悬于任务墙上方 → 3-A 首帧双影落位分化为两个队友
 *  机体的视线连线、交汇于同一张空卡。中间态：渗入到落位过程双影数量恒为二、
 *  交汇点屏位逐帧不变，仅透明度与形态（影→视线线）变化。身份线索：双影恒为
 *  二 + 交汇屏位（保两项）。何时不该 morph：分化过程引起卡面重绘时回退 cut
 *  + 双视线入场。
 *
 *  叙事链：3-A 开帧走查舞台全局一拍（双影悬于任务墙上方——承 2-D 末态）→
 *  双影分化：p3-01「同一拍，两人扫到同一张空卡」两座值班钟同拍同落（钟摆
 *  同步对齐=同一拍的时序具象）、双视线同时接通交汇卡面 → p3-02「认领其实
 *  是三步」流水条三节点 stagger 铺出 → p3-03「快照」扫描定格框闪一拍、
 *  「隔着一道窗口」裂缝裂开、洋红窗口色亮出（主题色②首亮，重音镜——全片
 *  张力起点）→ 3-B 选座类比（≤3 句即收）：p3-04 界面亮出（座格落位、空座
 *  后点亮）→ p3-05 双光标同悬空座、锁座+下单两按钮融合成一枚不可分割按钮、
 *  落定一拍 → p3-06「教学版恰恰没有这把锁」界面切回流水条、按钮位碎散、
 *  裂缝窗口无护栏裸露（假成功伏笔）→ 3-C 左红右绿消融同屏（全片张力峰值）：
 *  p3-07「撤掉锁」护栏虚框抽出、「让两边交错认领」双轨迷你钟同拍同落、左轨
 *  两条写名箭头先后交错刺入同一张卡 → p3-08「日志两行」两条先后落行（归属
 *  队友一 / 队友二——双写口径）→ p3-09「双方都以为到手」两枚假成功签、
 *  「卡上只留一个名字——后写的那个」名字被后写者覆盖（覆盖轨迹可追，重音
 *  镜——终值归后写者）→ p3-10「同一件活干两遍」两条并行执行流虚影、「另一
 *  边还蒙在鼓里」先写者侧罩上暗罩 → 3-D @pushIn 右轨兑现：p3-11 重跑起拍、
 *  框内单人写名成功绿落定、框外一人被挡弹回（灰弹非红崩——有感知的失败）、
 *  双计数角标定格对照（重音镜）→ 3-E 感知对照+金句：p3-12 右半被挡签先亮、
 *  左半暗罩回闪（点火次序=口播次序）→ p3-13 金句卡「看见 ≠ 抢到」压屏定格、
 *  卡下压缩签、锁形图标问号点亮（悬念钩——P4 接棒位）。
 *
 *  空间契约：双视线同帧到达、双钟帧序严格同拍、流水条三节点单向、裂缝只在
 *  第二三步之间、洋红在本镜（3-A p3-03）前不出现、红左绿右恒定、左轨箭头
 *  交错有先后帧序（非同帧）、覆盖轨迹可追、右轨 3-C 只立基线不运行、选座
 *  类比即收、教学版侧禁显示下单失败弹窗（是假成功非失败）、框内同时至多
 *  一人、被挡为弹回非崩溃、计数口径与 narration 一致（写名 ×2 终值 1 名 ↔
 *  成功 ×1）、金句卡为唯一衬线体主体、点火次序右先左后。
 *  红线落实：虚构轮次计数禁（narration 未给轮数）、右轨双成功禁、被挡者
 *  暗罩无感知禁（那是左轨语义）、类比升格贯穿剧场禁、金句卡复述整句禁、
 *  锁问号提前于 p3-13 亮禁；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：3-E→4-A 幕间 SceneFade + 拉远重锚（消融裁决→生产结构剖视属
 *    语义断裂，承 ep2 3-C→4-A / ep15/ep16 形态）；位置呼应：3-E 末帧锁形
 *    问号屏位 = 4-A 首帧「写名间」门位（问号在此落成两道闩——悬念兑现）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  AblationSplit,
  AgentBody,
  CHECK_LANES,
  ClaimPipeline,
  CriticalSectionFrame,
  DutyClock,
  GhostPair,
  LookLine,
  NameTag,
  pendSwing,
  SeatPicker,
  TallyCounter,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 竞态显形：双影分化 → 双钟同拍 + 双视线交汇 + 流水条裂缝 ──────────────

/** 3-A 布局（安全带红线：机体底 ~560、流水条底 620+96=716、角标 -34 起 586，
 *  恒 ≤ 860。 */
const AA = {
  ghost: {x: 700, y: 64},
  mates: [
    {x: 300, y: 400},
    {x: 1450, y: 400},
  ],
  card: {x: 810, y: 230, w: 300, h: 190},
  pipe: {x: 360, y: 620, w: 1180},
  clockSize: 92,
} as const;

const ThreeA: React.FC<{atBeat: number; atEyes: number; atSteps: number[]; atSnap: number; atCrack: number}> = ({
  atBeat,
  atEyes,
  atSteps,
  atSnap,
  atCrack,
}) => {
  const frame = useCurrentFrame();
  // 双影分化（morph：影恒为二 → 两机体分立左右；交汇屏位=空卡中心逐帧不变）
  const split = clamp01(progress(frame, 4, 20));
  // 双钟同拍同落（钟摆同步对齐=同一拍——同一节律同相位）
  const sw = pendSwing(frame, atBeat);
  // 双视线同时接通（同帧到达——drawP 同值同拍）
  const eyes = clamp01(progress(frame, atEyes, 14));
  // 流水条三节点 stagger 铺出
  const steps: [number, number, number] = [
    clamp01(progress(frame, atSteps[0], 12)),
    clamp01(progress(frame, atSteps[1], 12)),
    clamp01(progress(frame, atSteps[2], 12)),
  ];
  // 快照定格框闪一拍（扫描帧冻结）
  const snap = Math.sin(Math.PI * clamp01(progress(frame, atSnap, 18)));
  // 裂缝裂开 + 洋红窗口色亮出（主题色②首亮——全片张力起点，重音镜）
  const crack = clamp01(progress(frame, atCrack, 18));
  const crackFlash = Math.sin(Math.PI * clamp01(progress(frame, atCrack, 30)));
  return (
    <AbsoluteFill>
      {/* 走查舞台缩微（开帧全局一拍——承 2-D 末态） */}
      <div style={{position: 'absolute', left: 640, top: 96, opacity: (1 - split) * 0.55}}>
        <GhostPair x={60} y={0} p={1 - split} fromX={60} />
      </div>
      {/* 双影 → 分化为两机体（左右分立——身份线索：双影恒为二 + 交汇屏位） */}
      {AA.mates.map((m, i) => {
        const fromX = AA.ghost.x + 60 + (i === 0 ? -30 : 150);
        const x = fromX + (m.x - fromX) * split;
        return (
          <div key={`am${i}`} style={{position: 'absolute', left: x, top: AA.ghost.y + (m.y - AA.ghost.y) * split, opacity: split}}>
            <AgentBody x={0} y={0} w={86} h={108} tone={theme.mate}>
              <div style={{position: 'absolute', left: -6, top: 6}}>
                <DutyClock x={0} y={0} size={AA.clockSize} litP={1} swing={sw} micro />
              </div>
            </AgentBody>
            <div style={{position: 'absolute', left: 4, top: 116, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>
              {i === 0 ? '队友一' : '队友二'}
            </div>
          </div>
        );
      })}
      {/* 中央同一张空卡（交汇点——名字签空位） */}
      <div style={{position: 'absolute', left: AA.card.x, top: AA.card.y, width: AA.card.w, height: AA.card.h}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
            boxShadow: crackFlash > 0.03 ? `0 0 ${30 * crackFlash}px ${withAlpha(theme.lock, 0.4 * crackFlash)}` : 'none',
          }}
        >
          <div style={{position: 'absolute', left: 16, top: 12, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'task_009'}</div>
          <div style={{position: 'absolute', left: 16, top: 44, fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>空卡</div>
          <div style={{position: 'absolute', left: 16, bottom: 16, width: 120, height: 12, borderRadius: 3, border: `2px dashed ${withAlpha(theme.dim, 0.5)}`}} />
        </div>
      </div>
      {/* 双视线（同时落下交汇卡面——同帧到达） */}
      <LookLine x1={AA.mates[0].x + 90} y1={AA.mates[0].y + 30} x2={AA.card.x + 40} y2={AA.card.y + 70} drawP={eyes} tone={theme.mate} />
      <LookLine x1={AA.mates[1].x + 40} y1={AA.mates[1].y + 30} x2={AA.card.x + 120} y2={AA.card.y + 70} drawP={eyes} tone={theme.mate} />
      {/* 认领三步流水条（读卡→查归属→写名字；第二三节点间=窗口裂缝位） */}
      <ClaimPipeline x={AA.pipe.x} y={AA.pipe.y} w={AA.pipe.w} stepsP={steps} snapP={snap} crackP={crack} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'TOCTOU · 扫描只是快照 · 查完到写入，隔着一道窗口'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 选座类比（即收镜）：空座 + 双光标同悬 + 合成一枚不可分割按钮 ──────────

const SEAT_3B = {x: 550, y: 150} as const;
const PIPE_3B = {x: 470, y: 726, w: 980} as const;

const ThreeB: React.FC<{atUI: number; atEmpty: number; atHover: number; atMerge: number; atSettle: number; atBack: number; atShatter: number}> = ({
  atUI,
  atEmpty,
  atHover,
  atMerge,
  atSettle,
  atBack,
  atShatter,
}) => {
  const frame = useCurrentFrame();
  // 选座界面亮出（座格 stagger 落位——落位先于点亮，seat 落位-点亮解耦）
  const ui = clamp01(progress(frame, atUI, 14));
  const seatIn = Array.from({length: 32}, (_, i) => clamp01(progress(frame, atUI + 4 + i, 5)));
  const emptyLit = clamp01(progress(frame, atEmpty, 12));
  // 双光标同悬（两个人同时看到同一个空座——不分先后）
  const hover = clamp01(progress(frame, atHover, 12));
  // 锁座+下单合成一步（融合动画——原子性具象）+ 落定一拍
  const merge = clamp01(progress(frame, atMerge, 18));
  const settle = Math.sin(Math.PI * clamp01(progress(frame, atSettle, 20)));
  // 教学版没有这把锁（切回流水条、按钮碎散、裂缝无护栏裸露）
  const back = clamp01(progress(frame, atBack, 14));
  const shatter = clamp01(progress(frame, atShatter, 20));
  return (
    <AbsoluteFill>
      {/* 选座界面（类比即收——3-B 内完整收束） */}
      <div style={{position: 'absolute', left: SEAT_3B.x, top: SEAT_3B.y, opacity: ui * (1 - back * 0.92), transform: `translateY(${back * -20}px)`}}>
        <SeatPicker x={0} y={0} seatIn={seatIn} emptyLitP={emptyLit} hoverP={hover} mergeP={merge} settleP={settle} shatterP={shatter * back} />
      </div>
      {/* 切回认领流水条（教学版——裂缝窗口无护栏裸露） */}
      {back > 0.02 ? (
        <div style={{position: 'absolute', left: PIPE_3B.x, top: PIPE_3B.y, opacity: back, transform: `translateY(${(1 - back) * 22}px)`}}>
          <ClaimPipeline x={0} y={0} w={PIPE_3B.w} stepsP={[1, 1, 1]} crackP={1} bareP={shatter} />
          {shatter > 0.3 ? (
            <div
              style={{
                position: 'absolute',
                left: PIPE_3B.w / 2 - 210,
                top: -76,
                padding: '8px 22px',
                borderRadius: 10,
                border: `2.5px dashed ${withAlpha(theme.lock, 0.85)}`,
                background: withAlpha(theme.panel, 0.97),
                fontFamily: theme.sans,
                fontSize: 21,
                fontWeight: 700,
                color: theme.lock,
                whiteSpace: 'nowrap',
                opacity: clamp01((shatter - 0.3) * 2),
              }}
            >
              教学版 · 没有这把锁
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'atomic · 看见，不等于抢到'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 撤锁消融（左轨主导演出——全片张力峰值；右轨只立基线不运行） ────────────

/** 轨内布局（左右同构——card/log/arrows 按 lane.x 平移；安全带：日志底
 *  lane.y+440+2×34 ≈ 658、执行流底 ~700，恒 ≤ 860）。 */
const laneOf = (side: 'L' | 'R') => {
  const lane = side === 'L' ? CHECK_LANES.left : CHECK_LANES.right;
  return {
    clock: {x: lane.x + 40, y: lane.y + 54},
    card: {x: lane.x + 250, y: lane.y + 190, w: 300, h: 190},
    log: {x: lane.x + 60, y: lane.y + 448},
    arrowA: {x1: lane.x + 30, y1: lane.y + 240, x2: lane.x + 244, y2: lane.y + 280},
    arrowB: {x1: lane.x + 30, y1: lane.y + 360, x2: lane.x + 244, y2: lane.y + 310},
    cs: {x: lane.x + 210, y: lane.y + 160, w: 380, h: 250},
  };
};

/** 写名箭头（自队友侧刺入卡面——reach 描线 + dig 刺入段） */
const WriteArrow: React.FC<{x1: number; y1: number; x2: number; y2: number; reach: number; label: string; dim?: boolean}> = ({
  x1,
  y1,
  x2,
  y2,
  reach,
  label,
  dim = false,
}) => {
  const r = clamp01(reach);
  const hx = x1 + (x2 - x1) * Math.min(1, r);
  const hy = y1 + (y2 - y1) * Math.min(1, r);
  const tone = dim ? theme.dim : theme.danger;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={withAlpha(tone, 0.9)} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - r} />
      {r > 0.9 ? (
        <>
          <path d={`M ${hx - 20} ${hy - 11} L ${hx + 6} ${hy} L ${hx - 20} ${hy + 11} Z`} fill={tone} />
          <text x={x1 - 8} y={y1 - 14} textAnchor="start" fontFamily={theme.sans} fontSize={17} fontWeight={700} fill={tone}>
            {label}
          </text>
        </>
      ) : null}
    </svg>
  );
};

const ThreeC: React.FC<{
  atRise: number;
  atRemove: number;
  atStabA: number;
  atStabB: number;
  atLog1: number;
  atLog2: number;
  atGot: number;
  atOverwrite: number;
  atTwin: number;
  atShroud: number;
}> = ({atRise, atRemove, atStabA, atStabB, atLog1, atLog2, atGot, atOverwrite, atTwin, atShroud}) => {
  const frame = useCurrentFrame();
  const L = laneOf('L');
  const R = laneOf('R');
  // 双轨立起
  const rise = clamp01(progress(frame, 4, 16));
  // 左轨护栏虚框抽出（撤掉锁——抽出有轨迹）
  const remove = clamp01(progress(frame, atRemove, 16));
  // 双轨迷你钟同拍同落（同拍触发基线——同相位）
  const sw = pendSwing(frame, atRemove + 6);
  // 两条写名箭头先后交错刺入（交错有先后帧序——非同帧）
  const stabA = clamp01(progress(frame, atStabA, 18));
  const stabB = clamp01(progress(frame, atStabB, 18));
  // 日志两行先后落行（双写口径：写名 ×2）
  const log1 = clamp01(progress(frame, atLog1, 12));
  const log2 = clamp01(progress(frame, atLog2, 12));
  // 「到手」假成功签 ×2
  const got = clamp01(progress(frame, atGot, 12));
  // 卡面名字被后写者覆盖（队友一写入 → 被划掉 → 队友二压上——覆盖轨迹可追）
  const write1 = clamp01(progress(frame, atStabA + 12, 12));
  const strike1 = clamp01(progress(frame, atOverwrite, 8));
  const write2 = clamp01(progress(frame, atOverwrite + 4, 12));
  // 同一件活干两遍（两条并行执行流虚影）+ 先写者侧暗罩（无感知具象）
  const twin = clamp01(progress(frame, atTwin, 18));
  const shroud = clamp01(progress(frame, atShroud, 16));
  return (
    <AbsoluteFill>
      <AblationSplit litP={rise} leftP={rise} rightP={rise} leftTitle="撤掉锁" leftSub="E4 · 实测" rightTitle="装回锁" rightSub="临界区在位 · 暂未运行" />
      {/* 双轨迷你钟（同拍触发基线——轨头） */}
      <DutyClock x={L.clock.x} y={L.clock.y} size={64} litP={rise} swing={sw} micro />
      <DutyClock x={R.clock.x} y={R.clock.y} size={64} litP={rise} swing={sw} micro />
      {/* 左轨：护栏虚框抽出（撤掉锁——虚框飞出轨外淡出） */}
      <div
        style={{
          position: 'absolute',
          left: L.card.x - 18,
          top: L.card.y - 18,
          width: L.card.w + 36,
          height: L.card.h + 36,
          borderRadius: 14,
          border: `3px dashed ${withAlpha(theme.dim, 0.85)}`,
          opacity: (1 - remove) * rise,
          transform: `translate(${-remove * 220}px, ${-remove * 110}px) rotate(${remove * -14}deg)`,
        }}
      />
      {/* 左轨：同款空卡（名字签位——写名 → 被后写者覆盖） */}
      <div style={{position: 'absolute', left: L.card.x, top: L.card.y, width: L.card.w, height: L.card.h, opacity: rise}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
          }}
        >
          <div style={{position: 'absolute', left: 16, top: 12, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'task_009'}</div>
          <div style={{position: 'absolute', left: 16, top: 42, fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.dim}}>空卡</div>
          {/* 覆盖轨迹：队友一（先写·被划掉）→ 队友二（后写·压上——终值归后写者） */}
          <div style={{position: 'absolute', left: 18, bottom: 18}}>
            <NameTag x={0} y={0} label="队友一" writeP={write1} strikeP={strike1} size={24} />
            <div style={{position: 'absolute', left: 0, top: 34}}>
              <NameTag x={0} y={0} label="队友二" writeP={write2} size={24} />
            </div>
          </div>
        </div>
        {/* 同一件活干两遍（两条并行执行流虚影——自卡底拖出） */}
        {twin > 0.02 ? (
          <svg width={L.card.w} height={150} viewBox={`0 0 ${L.card.w} 150`} style={{position: 'absolute', left: 0, top: L.card.h + 4, overflow: 'visible', opacity: rise}}>
            <path d={`M 70 0 C 70 50 40 70 40 130`} fill="none" stroke={withAlpha(theme.dim, 0.55)} strokeWidth={3.5} strokeDasharray="8 8" opacity={twin * (1 - shroud * 0.55)} />
            <path d={`M 210 0 C 210 50 240 70 240 130`} fill="none" stroke={withAlpha(theme.danger, 0.7)} strokeWidth={3.5} strokeDasharray="8 8" opacity={twin} />
          </svg>
        ) : null}
        {/* 先写者侧暗罩（蒙在鼓里——无感知具象；覆盖左箭头与左执行流起点） */}
        {shroud > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: -120,
              top: 10,
              width: 240,
              height: L.card.h + 140,
              borderRadius: 12,
              background: withAlpha(theme.bg, 0.72 * shroud),
              border: `2px dashed ${withAlpha(theme.danger, 0.4 * shroud)}`,
              pointerEvents: 'none',
            }}
          >
            <div style={{position: 'absolute', left: 0, right: 0, top: '46%', textAlign: 'center', fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: withAlpha(theme.dim, 0.9), whiteSpace: 'nowrap', opacity: shroud}}>
              蒙在鼓里
            </div>
          </div>
        ) : null}
      </div>
      {/* 左轨：两条写名箭头先后交错刺入（队友一 → 队友二，先后帧序） */}
      <WriteArrow x1={L.arrowA.x1} y1={L.arrowA.y1} x2={L.arrowA.x2} y2={L.arrowA.y2} reach={stabA} label="写名 · 队友一" dim={shroud > 0.4} />
      <WriteArrow x1={L.arrowB.x1} y1={L.arrowB.y1} x2={L.arrowB.x2} y2={L.arrowB.y2} reach={stabB} label="写名 · 队友二" />
      {/* 「到手」假成功签 ×2（两队友侧各一枚——双方都以为到手） */}
      {got > 0.02 ? (
        <>
          {[
            {x: L.arrowA.x1 - 10, y: L.arrowA.y1 - 66},
            {x: L.arrowB.x1 - 10, y: L.arrowB.y1 + 26},
          ].map((pt, i) => (
            <div
              key={`got${i}`}
              style={{
                position: 'absolute',
                left: pt.x,
                top: pt.y,
                padding: '5px 16px',
                borderRadius: 9,
                border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
                background: withAlpha(theme.danger, 0.12),
                fontFamily: theme.sans,
                fontSize: 18,
                fontWeight: 700,
                color: theme.danger,
                whiteSpace: 'nowrap',
                opacity: got * (i === 0 ? 1 - shroud * 0.55 : 1),
              }}
            >
              到手？
            </div>
          ))}
        </>
      ) : null}
      {/* 左轨：日志两行（归属先后落行——双写口径） */}
      <div style={{position: 'absolute', left: L.log.x, top: L.log.y, fontFamily: theme.mono, fontSize: 19, color: theme.text, whiteSpace: 'nowrap', opacity: rise}}>
        <div style={{opacity: log1}}>{'[claim] owner = 队友一'}</div>
        <div style={{marginTop: 10, opacity: log2}}>{'[claim] owner = 队友二'}</div>
        <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: log2 * 0.85}}>{'simulate_concurrent_claims · 写名 ×2'}</div>
      </div>
      {/* 右轨：同款空卡 + 洋红临界区框在位（只立基线不运行——dim 态） */}
      <div style={{position: 'absolute', left: R.card.x, top: R.card.y, width: R.card.w, height: R.card.h, opacity: rise * 0.9}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
          }}
        >
          <div style={{position: 'absolute', left: 16, top: 12, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'task_009'}</div>
          <div style={{position: 'absolute', left: 16, top: 42, fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.dim}}>空卡</div>
          <div style={{position: 'absolute', left: 16, bottom: 16, width: 120, height: 12, borderRadius: 3, border: `2px dashed ${withAlpha(theme.dim, 0.5)}`}} />
        </div>
      </div>
      <CriticalSectionFrame x={R.cs.x} y={R.cs.y} w={R.cs.w} h={R.cs.h} litP={rise * 0.8} laneP={0} runningP={0} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'左：撤锁 → 交错认领 · 日志两行 · 终值归后写者 ↔ 右：装锁基线'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 右轨兑现（@pushIn）：框内单人写名成功 + 框外被挡弹回 + 双计数 ─────────

const DD = {
  cs: {x: 640, y: 190, w: 640, h: 460},
  inMate: {x: 700, y: 300},
  outMate: {x: 320, y: 420},
  mini: {x: 110, y: 560},
  counters: {x: 1440, y: 260},
} as const;

const ThreeD: React.FC<{atRerun: number; atSuccess: number; atBounce: number; atCounters: number}> = ({
  atRerun,
  atSuccess,
  atBounce,
  atCounters,
}) => {
  const frame = useCurrentFrame();
  // 推近右轨排他窗口主角（@pushIn——P3 段每镜 ≤1 次推近）
  const push = usePushIn(2, {scale: 0.07, dur: 24});
  // 重跑起拍（右轨临界区运行）
  const rerun = clamp01(progress(frame, atRerun, 14));
  // 框内单人写名成功（确认绿落定）
  const success = clamp01(progress(frame, atSuccess, 16));
  const successFlash = Math.sin(Math.PI * clamp01(progress(frame, atSuccess, 26)));
  // 框外一人被挡弹回（灰弹非红崩——有感知的失败）
  const bounce = clamp01(progress(frame, atBounce, 22));
  const bounceX = DD.outMate.x + 40 + bounce * 150;
  const bounceY = DD.outMate.y - Math.sin(Math.PI * bounce) * 60;
  // 双计数角标定格对照（离散给值）
  const counters = clamp01(progress(frame, atCounters, 12));
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '62% 40%'}}>
      <CriticalSectionFrame x={DD.cs.x} y={DD.cs.y} w={DD.cs.w} h={DD.cs.h} litP={1} laneP={rerun} runningP={rerun} />
      {/* 框内：一名队友进入写名（单人——框内同时至多一人） */}
      <div style={{position: 'absolute', left: DD.inMate.x + 120 * (1 - rerun), top: DD.inMate.y, opacity: rerun}}>
        <AgentBody x={0} y={0} w={78} h={98} tone={theme.mate} />
        <div style={{position: 'absolute', left: 2, top: 106, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.mate, whiteSpace: 'nowrap'}}>队友一</div>
      </div>
      {/* 框内写名一步（名字签写入 + 成功绿落定） */}
      <div style={{position: 'absolute', left: DD.cs.x + 220, top: DD.cs.y + 150, opacity: rerun}}>
        <NameTag x={0} y={0} label="队友一" writeP={success} size={34} />
        {success > 0.6 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 46,
              padding: '6px 18px',
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.ok, 0.9)}`,
              background: withAlpha(theme.ok, 0.12),
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: clamp01((success - 0.6) * 2.5),
              boxShadow: successFlash > 0.03 ? `0 0 ${26 * successFlash}px ${withAlpha(theme.ok, 0.6 * successFlash)}` : 'none',
            }}
          >
            成功 ✓
          </div>
        ) : null}
      </div>
      {/* 框外：另一名被挡弹回（灰弹——有感知的失败，弹回有轨迹） */}
      {bounce > 0.02 ? (
        <div style={{position: 'absolute', left: bounceX, top: bounceY, transform: `rotate(${bounce * 12}deg)`, opacity: 1 - Math.max(0, bounce - 0.8) * 3}}>
          <AgentBody x={0} y={0} w={78} h={98} tone={theme.dim} />
          <div style={{position: 'absolute', left: -24, top: 106, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>队友二 · 被挡</div>
        </div>
      ) : null}
      {/* 被挡读出（弹回帧——灰弹非红崩） */}
      {bounce > 0.25 && bounce < 0.95 ? (
        <div style={{position: 'absolute', left: DD.cs.x - 180, top: DD.cs.y + 320, fontFamily: theme.mono, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap', opacity: Math.sin(Math.PI * bounce)}}>
          blocked · 当没领到
        </div>
      ) : null}
      {/* 左轨末态缩微驻侧对照（名字覆盖末态 + 双执行流 + 暗罩——静持） */}
      <div style={{position: 'absolute', left: DD.mini.x, top: DD.mini.y, opacity: 0.85, transform: 'scale(0.62)', transformOrigin: '0 0'}}>
        <div style={{position: 'relative', width: 320, height: 210}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.danger, 0.55)}`,
              background: withAlpha(theme.panel, 0.95),
            }}
          >
            <div style={{position: 'absolute', left: 14, top: 10, fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'task_009 · 左轨末态'}</div>
            <NameTag x={16} y={44} label="队友一" writeP={1} strikeP={1} size={22} />
            <NameTag x={16} y={80} label="队友二" writeP={1} size={22} />
            <div style={{position: 'absolute', left: 14, bottom: 14, fontFamily: theme.mono, fontSize: 13, color: theme.danger, whiteSpace: 'nowrap'}}>{'写名 ×2 · 终值 1 名'}</div>
          </div>
        </div>
      </div>
      {/* 双计数角标定格对照（左：写名 ×2 · 终值 1 名 ↔ 右：成功 ×1） */}
      <TallyCounter x={DD.counters.x} y={DD.counters.y} value={2} label={'写名（终值 1 名）'} litP={counters} tone={theme.danger} />
      <TallyCounter x={DD.counters.x} y={DD.counters.y + 130} value={1} label={'成功'} litP={counters} tone={theme.ok} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同场景重跑 · 只有一个人成功 · 被挡 = 当没领到'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-E 感知对照 + 金句卡（衬线体）+ 锁形问号（P4 接棒位） ────────────────────

const EE = {
  left: {x: 200, y: 250},
  right: {x: 1140, y: 250},
  quote: {x: 662, y: 300, w: 596},
} as const;

const ThreeE: React.FC<{atRight: number; atLeft: number; atQuote: number; atSub: number; atLock: number}> = ({
  atRight,
  atLeft,
  atQuote,
  atSub,
  atLock,
}) => {
  const frame = useCurrentFrame();
  // 右半被挡签先亮（点火次序 = 口播次序：右先左后）
  const rightLit = clamp01(progress(frame, atRight, 14));
  // 左半暗罩回闪一拍（无感知——3-C 暗罩回收）
  const leftLit = clamp01(progress(frame, atLeft, 12));
  const leftFlash = Math.sin(Math.PI * clamp01(progress(frame, atLeft, 22)));
  // 金句卡压屏定格（衬线体压缩形态——重音镜）
  const quote = clamp01(progress(frame, atQuote, DUR.f5));
  const quotePulse = Math.sin(Math.PI * clamp01(progress(frame, atQuote, 30)));
  // 卡下压缩签 + 锁形图标问号
  const sub = clamp01(progress(frame, atSub, 12));
  const lock = clamp01(progress(frame, atLock, 12));
  return (
    <AbsoluteFill>
      {/* 左半：无锁交错 · 暗罩无感知（红侧——承 3-C 空间色位） */}
      <div style={{position: 'absolute', left: EE.left.x, top: EE.left.y, opacity: leftLit * 0.95}}>
        <div
          style={{
            width: 480,
            height: 260,
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.danger, 0.5)}`,
            background: withAlpha(theme.panel, 0.94),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>无锁交错</div>
          <div
            style={{
              width: 320,
              height: 92,
              borderRadius: 10,
              border: `2px dashed ${withAlpha(theme.danger, 0.45 + 0.4 * leftFlash)}`,
              background: withAlpha(theme.bg, 0.5 + 0.25 * leftFlash),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
            }}
          >
            蒙在鼓里 · 无感知
          </div>
        </div>
      </div>
      {/* 右半：被挡弹回 · 有感知（绿侧） */}
      <div style={{position: 'absolute', left: EE.right.x, top: EE.right.y, opacity: rightLit}}>
        <div
          style={{
            width: 480,
            height: 260,
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.ok, 0.55)}`,
            background: withAlpha(theme.panel, 0.94),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>被挡弹回</div>
          <div
            style={{
              padding: '10px 26px',
              borderRadius: 10,
              border: `2.5px solid ${withAlpha(theme.ok, 0.85)}`,
              background: withAlpha(theme.ok, 0.1),
              fontFamily: theme.sans,
              fontSize: 21,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
            }}
          >
            当没领到 · 有感知
          </div>
        </div>
      </div>
      {/* 中央金句卡（衬线体——唯一衬线体主体；压屏定格） */}
      {quote > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: EE.quote.x,
            top: EE.quote.y,
            width: EE.quote.w,
            zIndex: 3,
            opacity: quote,
            transform: `translateY(${(1 - quote) * 22}px) scale(${1 + 0.03 * quotePulse})`,
          }}
        >
          <div
            style={{
              padding: '34px 40px',
              borderRadius: 16,
              border: `4px solid ${withAlpha(theme.text, 0.9)}`,
              background: withAlpha(theme.panel, 0.98),
              boxShadow: `0 0 ${30 * quote}px ${withAlpha(theme.text, 0.3 * quote)}`,
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 58, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
              看见 <span style={{color: theme.danger}}>≠</span> 抢到
            </div>
            {/* 卡下压缩签（查与写一口气做完——压缩形态） */}
            <div
              style={{
                marginTop: 16,
                fontFamily: theme.sans,
                fontSize: 22,
                fontWeight: 700,
                color: theme.lock,
                whiteSpace: 'nowrap',
                opacity: sub,
              }}
            >
              查与写 · 一口气做完
            </div>
            {/* 锁形图标（卡右下角——问号点亮：这把锁谁来上？） */}
            <div style={{position: 'absolute', right: 14, bottom: 12, display: 'flex', alignItems: 'center', gap: 4}}>
              <svg width={34} height={34} viewBox="0 0 34 34">
                <rect x={7} y={14} width={20} height={14} rx={4} fill="none" stroke={theme.lock} strokeWidth={3} />
                <path d="M12 14 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke={theme.lock} strokeWidth={3} />
              </svg>
              <span style={{fontFamily: theme.serif, fontSize: 26, fontWeight: 700, color: theme.lock, opacity: lock}}>？</span>
            </div>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'TOCTOU · 被挡不可怕，无感知才可怕'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3SeeNotGrab: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-06');
  const bC = w('p3-07', 'p3-10');
  const bD = w('p3-11', 'p3-11');
  const bE = w('p3-12', 'p3-13');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atBeat={wa('p3-01', 0.14) - bA.from}
          atEyes={wa('p3-01', 0.5) - bA.from}
          atSteps={[0.4, 0.55, 0.7].map((f) => wa('p3-02', f) - bA.from)}
          atSnap={wa('p3-03', 0.12) - bA.from}
          atCrack={wa('p3-03', 0.5) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atUI={wa('p3-04', 0.35) - bB.from}
          atEmpty={wa('p3-04', 0.62) - bB.from}
          atHover={wa('p3-05', 0.22) - bB.from}
          atMerge={wa('p3-05', 0.55) - bB.from}
          atSettle={wa('p3-05', 0.82) - bB.from}
          atBack={wa('p3-06', 0.3) - bB.from}
          atShatter={wa('p3-06', 0.55) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atRise={4}
          atRemove={wa('p3-07', 0.24) - bC.from}
          atStabA={wa('p3-07', 0.52) - bC.from}
          atStabB={wa('p3-07', 0.68) - bC.from}
          atLog1={wa('p3-08', 0.3) - bC.from}
          atLog2={wa('p3-08', 0.58) - bC.from}
          atGot={wa('p3-09', 0.2) - bC.from}
          atOverwrite={wa('p3-09', 0.56) - bC.from}
          atTwin={wa('p3-10', 0.22) - bC.from}
          atShroud={wa('p3-10', 0.6) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD atRerun={wa('p3-11', 0.2) - bD.from} atSuccess={wa('p3-11', 0.5) - bD.from} atBounce={wa('p3-11', 0.62) - bD.from} atCounters={wa('p3-11', 0.78) - bD.from} />
      </Sequence>
      <Sequence {...bE} name="3-E">
        <ThreeE
          atRight={wa('p3-12', 0.22) - bE.from}
          atLeft={wa('p3-12', 0.6) - bE.from}
          atQuote={wa('p3-13', 0.18) - bE.from}
          atSub={wa('p3-13', 0.55) - bE.from}
          atLock={wa('p3-13', 0.78) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3SeeNotGrab;
