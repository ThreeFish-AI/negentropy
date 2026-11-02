/** P1 四个角色（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 四层时间链主视觉首次亮出（全景坐标锚：环体〔M-001〕复亮居左
 *  ——陶土橙描边承系列锁定，环面仍无指针；环体右侧纵列四卡暗态轮廓：判时
 *  （带表盘）·队列·交付·执行接驳）→ p1-01「四个角色」词落位四卡暗态轮廓一次
 *  浮出〔M-005〕→ p1-02「判时的调度线程」词落位判时卡点火、表盘自刻度点亮
 *  ——@pushIn 急推判时表盘（planning §三「急推判时表盘特写」）、「程序退出时
 *  跟着退」词落位卡角一枚随行熄灭小签亮出又收〔M-006〕→ p1-03「每秒醒一次」
 *  词落位表盘以一秒节拍连闪、「逐个任务看表」词落位三枚任务小签依次过表、
 *  「不管程序在干嘛」词落位环体侧自转不停（两不相干的并行陈述）→ 1-B 队列卡
 *  账本特写（账本卡独立亮出——单句镜）：p1-04「第二个，队列」词落位队列卡自
 *  1-A 链位同形放大占屏〔M-005〕、「进来记账」词落位一枚到点任务签滑入、账本
 *  添一行墨迹落定、「不执行任何东西」词落位封条横贯卡下缘（〔M-003〕只记账
 *  不执行的封条态）→ 1-C 交付卡试探锁中景：p1-05「查两件事」词落位交付卡
 *  点火、探针伸出〔M-005〕、「队列有活」「程序有空」两枚检查签先后亮出（签文
 *  去问词）→ p1-06「一把锁」词落位锁特写一拍——红光（占用）/绿光（释放）
 *  交替演示、「一次只许一方持有」词落位令牌小片在环与探针间只归一方、
 *  「抢不到走开」词落位探针收回复位、计时环转起（重音镜）→ p1-07「执行的
 *  循环」词落位链尾执行接驳卡（注入口位）点亮〔M-005〕、「像用户消息进场」
 *  词落位绿光放行、一枚消息条沿注入口注入环体、「照常开工」词落位环体转
 *  一圈开工 → 1-D 驿站意象帧一闪＋机制对照：p1-08「快递驿站」词落位驿站意象
 *  帧一闪（A#5 落锚，≤2s 即收）→ p1-09「主动拉起执行」词落位切回机制画面——
 *  交付卡持消息条抵注入口待发（驿站等你上门 vs 主动拉起的对照帧）、
 *  「前提是有空」词落位「有空」检查框先亮、放行后消息条经注入口入环
 *  → p1-10「到点是一件事，有空是另一件」词落位两枚条件签并列升起、「硬焊死」
 *  词落位两签被一枚焊点烫在一块、焊点迸出裂纹一拍（钩子视觉——裂纹留 P3 崩开）。
 *
 *  空间契约：环体居左且无指针、四卡纵列次序恒定（判时→队列→交付→执行）、
 *    表盘只闪不执行；账本行为纯记录态（无执行元素）；令牌同一时刻只在一方、
 *    红/绿光互斥不同帧同亮、注入口为环体唯一入口；驿站帧 ≤2s 一闪即收、
 *    两条件签为关键词签非整句、焊点裂纹可见；y≥56 / bottom≥176。
 *
 *  红线落实：四卡一次全亮禁（幻灯片式）；环体不长出指针（时间感在环外）；
 *    账本卡不出现执行臂/出口箭头（越权逆「不执行任何东西」）；消息条不绕过
 *    注入口直接进环；词落位 = wa(id,f)；'Scheduler · Queue · Queue Processor
 *    · Consumer · daemon · agent_lock' 只进角标。
 *
 *  承接登记：0-B→1-A 判替换 cut＋屏位呼应（闹钟消隐屏位 = 判时卡亮起屏位，
 *    明暗反转 eye-trace）；1-D→2-A cut＋主装置缩微跨幕（链＋环体共同主体
 *    存活，不 morph——条件签与任务卡非同一主体）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  ConditionSigns,
  DeliveryProbe,
  LedgerCard,
  LockBadge,
  LoopRing,
  TaskChip,
  TimeChain,
  TokenChip,
  WatchFaceCard,
  useSecondTick,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（承 P0——P1 起画面零信源标识，本幕不挂；首尾既定署源位之外
 *  零信源痕迹——storyboard 反串线纪律。此组件仅 P0/P5 使用，本文件不挂） */

// ── 1-A 四层链首亮：环体复亮居左 + 四卡轮廓浮出 + 判时表盘急推 ─────────────

/** 1-A 全局位：环体居左复亮 / 四卡纵列右侧 / 判时表盘居链首 */
const RING_1A = {x: 150, y: 300, size: 440} as const;
const CHAIN_1A = {x: 830, y: 160, w: 470, cardH: 140, gap: 24} as const;
const WATCH_1A = {x: 1370, y: 120, size: 230} as const;

const OneA: React.FC<{atCards: number; atZoom: number; atQuit: number; atFlash: number; atTasks: number; atSpin: number}> = ({atCards, atZoom, atQuit, atFlash, atTasks, atSpin}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 四卡暗态轮廓一次浮出（p1-01「四个角色」——stagger 内含在 TimeChain outlineP）
  const cards = clamp01(progress(frame, atCards, 22));
  // 判时卡点火（p1-02「判时的调度线程」）+ 表盘自刻度点亮
  const schedLit = clamp01(progress(frame, atZoom, 14));
  // 急推判时表盘（@pushIn——p1-02 点名第一个角色；定格位预算：z=1.3 中心表盘）
  const pushTf = usePushIn(atZoom, {scale: 0.3, dur: DUR.f6});
  // 随行熄灭小签（p1-02「程序退出时跟着退」——卡角亮出又收〔M-006〕）
  const quit = Math.sin(Math.PI * clamp01(progress(frame, atQuit, 20)));
  // 表盘每秒一闪（p1-03「每秒醒一次」起——判时线程醒来的节律）
  const flashOn = frame >= atFlash;
  const tick = useSecondTick();
  // 三枚任务小签依次过表（p1-03「逐个任务看表」——stagger 次序=口播）
  const taskPs = [0, 1, 2].map((i) => clamp01(progress(frame, atTasks + i * 12, DUR.f5)));
  const taskFly = clamp01(progress(frame, atTasks + 14, 60));
  // 环体自转不停（p1-03「不管程序在干嘛」——两不相干的并行陈述；环上无指针）
  const dotPos = frame >= atSpin ? (frame - atSpin) / (fps * 2.5) % 1 : -1;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕复亮居左（描边承系列锁定——环面仍无指针，时间感不在环上） */}
      <div style={{position: 'absolute', left: RING_1A.x, top: RING_1A.y, opacity: clamp01(progress(frame, 2, DUR.f5))}}>
        <LoopRing size={RING_1A.size} nodes={[]} showExit={false} dotProgress={dotPos >= 0 ? dotPos : undefined} />
      </div>
      {/* 急推容器（判时表盘特写——@pushIn；包含链首卡与表盘） */}
      <div style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, transform: pushTf, transformOrigin: '1485px 235px'}}>
        {/* 四卡纵列（暗态轮廓一次浮出 → 判时卡点火；次序恒定判时→队列→交付→执行） */}
        <TimeChain x={CHAIN_1A.x} y={CHAIN_1A.y} w={CHAIN_1A.w} cardH={CHAIN_1A.cardH} gap={CHAIN_1A.gap} outlineP={cards} lits={[schedLit, 0, 0, 0]} hot={schedLit > 0.4 ? 0 : -1} />
        {/* 判时表盘（长春花蓝——居链首；点火时自刻度点亮，此后每秒一闪） */}
        <div style={{position: 'absolute', left: WATCH_1A.x, top: WATCH_1A.y, opacity: schedLit}}>
          <WatchFaceCard size={WATCH_1A.size} litP={schedLit} flashT={flashOn ? tick : 0.5} glow={0.3 + 0.7 * schedLit} flashP={flashOn ? 1 : 0} />
        </div>
        {/* 随行熄灭小签（判时卡右上角——「程序退出时跟着退」：亮出又收） */}
        {quit > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: CHAIN_1A.x + CHAIN_1A.w - 120,
              top: CHAIN_1A.y - 46,
              padding: '5px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 600,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: quit,
            }}
          >
            {'程序退出 · 跟着退'}
          </div>
        ) : null}
        {/* 三枚任务小签依次过表（表盘左侧——过表即被看一眼，stagger） */}
        <div style={{position: 'absolute', left: WATCH_1A.x - 150, top: WATCH_1A.y + 26, display: 'flex', flexDirection: 'column', gap: 12}}>
          {['t1', 't2', 't3'].map((t, i) => {
            const p = taskPs[i];
            const fly = i === 2 ? taskFly : 0;
            return (
              <div
                key={t}
                style={{
                  padding: '4px 12px',
                  borderRadius: 7,
                  border: `2px solid ${p > 0.35 ? withAlpha(theme.sched, 0.85) : withAlpha(theme.dim, 0.45)}`,
                  fontFamily: theme.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: p > 0.35 ? theme.sched : theme.dim,
                  background: withAlpha(theme.panel, 0.95),
                  whiteSpace: 'nowrap',
                  opacity: 0.4 + 0.6 * p,
                  transform: `translateX(${fly * 40}px)`,
                }}
              >
                {`任务 ${i + 1}`}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Scheduler · daemon'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 队列账本特写（单句镜——账本卡自 1-A 链位同形放大占屏） ────────────────

/** 1-B 账本卡占屏位（morph 起点 = 1-A 链内队列卡位——同形放大） */
const LEDGER_1B = {x: 610, y: 230, w: 700, h: 440} as const;

const OneB: React.FC<{atLedger: number; atRow: number; atSeal: number}> = ({atLedger, atRow, atSeal}) => {
  const frame = useCurrentFrame();
  // 同形放大（自链位缩放至占屏——morph：卡轮廓恒定、仅尺度连续变化）
  const grow = clamp01(progress(frame, atLedger, 20));
  const s = 0.45 + 0.55 * grow;
  // 到点任务签滑入 + 账本添一行墨迹落定
  const slide = clamp01(progress(frame, atRow - 8, 16));
  const row = clamp01(progress(frame, atRow, 18));
  // 封条横贯卡下缘（只记账不执行——封条态持续可读）
  const seal = clamp01(progress(frame, atSeal, 16));
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: LEDGER_1B.x + (LEDGER_1B.w * (1 - s)) / 2,
          top: LEDGER_1B.y + (LEDGER_1B.h * (1 - s)) / 2,
          width: LEDGER_1B.w * s,
          height: LEDGER_1B.h * s,
          transformOrigin: '50% 50%',
        }}
      >
        <LedgerCard x={0} y={0} w={LEDGER_1B.w} h={LEDGER_1B.h} litP={1} rowP={row} sealP={seal} glowP={row} rows={4} />
        {/* 滑入中的到点任务签（rowP 落定前的入场轨迹——自卡右上滑入末行） */}
        {slide > 0.02 && slide < 0.98 ? (
          <TaskChip x={LEDGER_1B.w - 300 - slide * 120} y={64 + (1 - slide) * -60} label={'到点任务'} litP={slide} mini />
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Queue'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 交付卡试探锁中景：探针 + 双检查签 + 令牌 + 注入口 ────────────────────

/** 1-C 全局位：环体左缩 / 队列卡缩微右上 / 交付卡中 / 锁在环右缘 / 注入口接环 */
const RING_1C = {x: 120, y: 320, size: 360} as const;
const LEDGER_1C = {x: 1010, y: 120, w: 360, h: 170} as const;
const DELIV_1C = {x: 800, y: 420, w: 560, h: 320} as const;
const LOCK_1C = {x: 430, y: 470} as const;
const PORT_1C = {x: 560, y: 500} as const;

const OneC: React.FC<{
  atDeliver: number;
  atProbe: number;
  atChk1: number;
  atChk2: number;
  atLock: number;
  atToken: number;
  atBack: number;
  atExec: number;
  atGreen: number;
  atRun: number;
}> = ({atDeliver, atProbe, atChk1, atChk2, atLock, atToken, atBack, atExec, atGreen, atRun}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 交付卡点火（p1-05「交付线程」）+ 探针伸出（「查两件事」）
  const deliverLit = clamp01(progress(frame, atDeliver, 14));
  const probe = clamp01(progress(frame, atProbe, 18));
  // 双检查签先后亮出（次序=口播：队列有活 → 程序有空——签文去问词）
  const c1 = clamp01(progress(frame, atChk1, DUR.f4));
  const c2 = clamp01(progress(frame, atChk2, DUR.f4));
  // 锁红绿交替演示（p1-06 一把锁：先红（占用）一拍、再绿（释放）一拍——互斥不同帧同亮）
  const lockGlow = Math.sin(Math.PI * clamp01(progress(frame, atLock, 40)));
  const lockTone: 'red' | 'green' | 'off' = frame < atLock + 20 ? 'red' : frame < atLock + 48 ? 'green' : 'green';
  const lockShow = clamp01(progress(frame, atLock, 12));
  // 令牌在环与探针间只归一方（p1-06「一次只许一方持有」——holderT 随演示交替）
  const tokenHold = frame < atLock + 20 ? 0.15 : 0.85;
  const tokenLit = clamp01(progress(frame, atToken, 14));
  // 抢不到走开：探针收回复位、计时环转起（p1-06 尾）
  const retract = clamp01(progress(frame, atBack, 16));
  const idleOn = clamp01(progress(frame, atBack + 4, DUR.f4));
  // 链尾执行接驳卡（注入口位）点亮（p1-07「执行的循环」——执行=循环本身）
  const execLit = clamp01(progress(frame, atExec, 16));
  // 绿光放行 + 消息条沿注入口注入环体（p1-07「像用户消息进场」）
  const green = clamp01(progress(frame, atGreen, 14));
  const inject = clamp01(progress(frame, atGreen + 8, 24));
  // 环体转一圈开工（p1-07「照常开工」——注入后转一圈）
  const runLap = clamp01(progress(frame, atRun, 50));
  const dotPos = inject >= 1 ? ((frame - atGreen - 32) / (fps * 2.5)) % 1 : undefined;
  // 环体右缘坐标（锁/注入口挂位）
  const rcx = RING_1C.x + RING_1C.size / 2;
  const rcy = RING_1C.y + RING_1C.size / 2;
  const rr = RING_1C.size / 2 - 46;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕左缩（执行宿主位——注入后照常开工转一圈；环上无指针） */}
      <div style={{position: 'absolute', left: RING_1C.x, top: RING_1C.y, opacity: 0.95}}>
        <LoopRing size={RING_1C.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        {/* 回合窗读法（环心标注——「执行」位：接驳点亮后显形） */}
        {execLit > 0.3 ? (
          <div style={{position: 'absolute', left: 0, top: RING_1C.size / 2 - 18, width: RING_1C.size, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: withAlpha(theme.text, execLit), whiteSpace: 'nowrap'}}>
            {runLap > 0.05 ? '开工' : '循环'}
          </div>
        ) : null}
      </div>
      {/* 队列卡缩微（右上——链成员跨镜存活） */}
      <LedgerCard x={LEDGER_1C.x} y={LEDGER_1C.y} w={LEDGER_1C.w} h={LEDGER_1C.h} litP={0.9} rowP={1} mini rows={2} />
      {/* 锁（环右缘——红/绿交替演示，互斥） */}
      <LockBadge x={LOCK_1C.x} y={LOCK_1C.y} size={96} tone={lockShow > 0.4 ? lockTone : 'off'} glowP={lockGlow} />
      {/* 注入口（交付卡与环体之间——环体唯一入口；执行接驳点亮 + 绿光放行 + 消息条注入） */}
      <div style={{position: 'absolute', left: PORT_1C.x, top: PORT_1C.y - 40, width: 200, height: 120}}>
        <svg width={200} height={120} viewBox="0 0 200 120" style={{overflow: 'visible'}}>
          {/* 注入口箭头位（指向环） */}
          <path d="M 10 60 L 90 60" stroke={withAlpha(execLit > 0.3 ? theme.ok : theme.dim, 0.7)} strokeWidth={5} strokeLinecap="round" />
          <path d="M 78 46 L 94 60 L 78 74" fill="none" stroke={withAlpha(execLit > 0.3 ? theme.ok : theme.dim, 0.7)} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          {/* 注入口小卡框（链尾执行接驳位） */}
          <rect x={98} y={18} width={94} height={84} rx={10} fill={withAlpha(theme.panel, 0.97)} stroke={execLit > 0.3 ? withAlpha(theme.core, 0.9) : withAlpha(theme.dim, 0.5)} strokeWidth={3} strokeDasharray={execLit > 0.3 ? undefined : '8 7'} />
          <text x={145} y={52} textAnchor="middle" fontFamily={theme.sans} fontSize={17} fontWeight={700} fill={execLit > 0.3 ? theme.text : theme.dim} opacity={0.4 + 0.6 * execLit}>
            执行
          </text>
          <text x={145} y={76} textAnchor="middle" fontFamily={theme.mono} fontSize={11} fill={theme.dim}>
            注入口
          </text>
          {/* 绿光放行灯（注入口下——放行帧点亮，确认绿） */}
          {green > 0.05 ? <circle cx={145} cy={94} r={7} fill={theme.ok} opacity={green} /> : null}
        </svg>
        {/* 注入中的消息条（沿注入口滑入环体——from 交付卡侧 to 环缘；不绕过注入口） */}
        {inject > 0.02 && inject < 1 ? (
          <TaskChip x={140 + (1 - inject) * 150} y={40} label={'到点消息'} litP={Math.sin(Math.PI * inject) * 0.8 + 0.2} mini />
        ) : null}
      </div>
      {/* 交付卡（中——晴空蓝；探针/双检查签/计时环/消息条） */}
      <DeliveryProbe
        x={DELIV_1C.x}
        y={DELIV_1C.y}
        w={DELIV_1C.w}
        h={DELIV_1C.h}
        litP={deliverLit}
        probeP={probe}
        retractP={retract}
        check1P={c1}
        check2P={c2}
        idleP={idleOn}
        idleT={(frame % 22) / 22}
        msgP={green > 0.3 && inject < 0.6 ? 0 : 0.9}
      />
      {/* 令牌小片（环与探针间——一次只许一方持有；演示交替归属） */}
      <TokenChip x={LOCK_1C.x + 130} y={LOCK_1C.y - 130} litP={tokenLit} holderT={tokenHold} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'Queue Processor · Consumer · agent_lock'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 驿站帧一闪 + 机制对照 + 条件签焊死（P3 崩点伏笔） ─────────────────────

const CONDS_1D = {x: 960, y: 660} as const;

/** 驿站意象帧（A#5 落锚——门面 + 入库格 + 取件小图；≤2s 一闪即收不剧场化） */
const StationFlash: React.FC<{litP: number}> = ({litP}) => {
  const lit = clamp01(litP);
  if (lit <= 0.02) return null;
  return (
    <div style={{position: 'absolute', left: 660, top: 180, width: 600, height: 500, opacity: lit, transform: `scale(${0.94 + 0.06 * lit})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 16, border: `3.5px solid ${withAlpha(theme.dim, 0.7)}`, background: withAlpha(theme.panel, 0.96)}} />
      {/* 门楣（驿站字号——视觉层类比锚，不进口播以外扩展） */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 76, borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.9)}`}}>
        <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text, letterSpacing: 4}}>驿站</span>
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'drop-off'}</span>
      </div>
      {/* 入库格（货架格——包裹存放位） */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: 24}}>
        {Array.from({length: 6}, (_, i) => {
          const filled = i < 2;
          return (
            <div
              key={`st${i}`}
              style={{
                height: 78,
                borderRadius: 8,
                border: `2.5px dashed ${filled ? withAlpha(theme.queue, 0.8) : withAlpha(theme.dim, 0.45)}`,
                background: filled ? withAlpha(theme.queue, 0.1) : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filled ? <span style={{width: 40, height: 28, borderRadius: 5, border: `2.5px solid ${theme.queue}`, background: withAlpha(theme.panel, 0.95)}} /> : null}
            </div>
          );
        })}
      </div>
      {/* 取件小图（角标位——你有空再取） */}
      <div style={{position: 'absolute', right: 24, bottom: 18, display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>
        <svg width={26} height={26} viewBox="0 0 26 26">
          <path d="M 4 20 Q 4 24 9 24 Q 13 24 13 20" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={2.5} strokeLinecap="round" />
          <rect x={5} y={8} width={16} height={12} rx={3} fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={2.5} />
        </svg>
        {'有空再取'}
      </div>
    </div>
  );
};

const OneD: React.FC<{atStation: number; atCut: number; atFree: number; atInject2: number; atSigns: number; atWeld: number; atCrack: number}> = ({atStation, atCut, atFree, atInject2, atSigns, atWeld, atCrack}) => {
  const frame = useCurrentFrame();
  // 驿站意象帧一闪（≤2s 即收——A#5 落锚；atCut 切回机制画面）
  const stationLit = Math.min(clamp01(progress(frame, atStation, 10)), 1 - clamp01(progress(frame, atCut, 8)));
  // 机制对照画面（切回后：交付卡持消息条抵注入口待发——承 1-C 简化位）
  const backLit = clamp01(progress(frame, atCut, 12));
  // 「有空」检查框先亮（p1-09「前提是有空」——检查框在消息条之前）
  const free = clamp01(progress(frame, atFree, DUR.f4));
  // 放行后消息条经注入口入环（p1-09 尾）
  const inject = clamp01(progress(frame, atInject2, 22));
  // 两枚条件签并列升起（p1-10 首拍——关键词签非整句）
  const signs = clamp01(progress(frame, atSigns, 18));
  // 焊点烫在一块 + 迸裂纹一拍（钩子视觉——裂纹留 P3 崩开）
  const weld = clamp01(progress(frame, atWeld, 14));
  const crack = clamp01(progress(frame, atCrack, 12));
  return (
    <AbsoluteFill>
      {/* 驿站帧（一闪即收） */}
      <StationFlash litP={stationLit} />
      {/* 机制对照画面（驿站等你上门 vs 主动拉起——缩微链位 + 环体 + 注入口） */}
      <div style={{position: 'absolute', inset: 0, opacity: backLit}}>
        <div style={{position: 'absolute', left: RING_1C.x, top: RING_1C.y + 30, opacity: 0.9}}>
          <LoopRing size={RING_1C.size} nodes={[]} showExit={false} />
        </div>
        <TimeChain x={930} y={150} w={330} cardH={96} gap={16} mini outlineP={1} lits={[1, 1, 1, 1]} dimP={0.3} />
        {/* 注入口位（交付卡与环体之间——消息条待发） */}
        <div style={{position: 'absolute', left: PORT_1C.x - 20, top: PORT_1C.y - 30, width: 240, height: 140}}>
          {/* 有空检查框（先亮——消息条放行前提） */}
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 0,
              padding: '5px 16px',
              borderRadius: 8,
              border: `2.5px solid ${free > 0.35 ? theme.ok : withAlpha(theme.dim, 0.55)}`,
              fontFamily: theme.sans,
              fontSize: 18,
              fontWeight: 700,
              color: free > 0.35 ? theme.ok : theme.dim,
              background: free > 0.35 ? withAlpha(theme.ok, 0.1) : 'transparent',
              whiteSpace: 'nowrap',
              opacity: 0.5 + 0.5 * free,
            }}
          >
            {'有空'}
          </div>
          {/* 待发→放行→注入的消息条（抵注入口——经注入口入环，不绕行） */}
          <svg width={240} height={120} viewBox="0 0 240 120" style={{overflow: 'visible'}}>
            <path d="M 10 74 L 96 74" stroke={withAlpha(inject > 0.3 ? theme.ok : theme.dim, 0.7)} strokeWidth={5} strokeLinecap="round" />
            <path d="M 84 60 L 100 74 L 84 88" fill="none" stroke={withAlpha(inject > 0.3 ? theme.ok : theme.dim, 0.7)} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <TaskChip x={110 + inject * 40} y={58} label={'到点消息'} litP={inject < 1 ? 0.95 : 1 - clamp01(inject - 0.85)} mini />
        </div>
        {/* 交付卡缩位（持消息条待发——承 1-C 同件） */}
        <DeliveryProbe x={820} y={400} w={460} h={250} litP={1} check1P={1} check2P={free} msgP={inject < 0.9 ? 1 : 0} probeP={0.4} idleP={0.6} idleT={(frame % 22) / 22} />
      </div>
      {/* 两枚条件签（镜尾并列升起 → 焊死 → 迸裂纹——P3 崩点伏笔） */}
      <ConditionSigns x={CONDS_1D.x} y={CONDS_1D.y} litP={signs} weldP={weld} crackP={crack} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'durable / session-only · 到点 ≠ 有空'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1FourRoles: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04');
  const bC = w('p1-05', 'p1-07');
  const bD = w('p1-08', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atCards={wa('p1-01', 0.76) - bA.from}
          atZoom={wa('p1-02', 0.24) - bA.from}
          atQuit={wa('p1-02', 0.72) - bA.from}
          atFlash={wa('p1-03', 0.05) - bA.from}
          atTasks={wa('p1-03', 0.4) - bA.from}
          atSpin={wa('p1-03', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atLedger={wa('p1-04', 0.16) - bB.from}
          atRow={wa('p1-04', 0.48) - bB.from}
          atSeal={wa('p1-04', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atDeliver={wa('p1-05', 0.18) - bC.from}
          atProbe={wa('p1-05', 0.45) - bC.from}
          atChk1={wa('p1-05', 0.68) - bC.from}
          atChk2={wa('p1-05', 0.88) - bC.from}
          atLock={wa('p1-06', 0.22) - bC.from}
          atToken={wa('p1-06', 0.42) - bC.from}
          atBack={wa('p1-06', 0.83) - bC.from}
          atExec={wa('p1-07', 0.24) - bC.from}
          atGreen={wa('p1-07', 0.5) - bC.from}
          atRun={wa('p1-07', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atStation={wa('p1-08', 0.22) - bD.from}
          atCut={wa('p1-09', 0.08) - bD.from}
          atFree={wa('p1-09', 0.8) - bD.from}
          atInject2={wa('p1-09', 0.92) - bD.from}
          atSigns={wa('p1-10', 0.12) - bD.from}
          atWeld={wa('p1-10', 0.6) - bD.from}
          atCrack={wa('p1-10', 0.82) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1FourRoles;
