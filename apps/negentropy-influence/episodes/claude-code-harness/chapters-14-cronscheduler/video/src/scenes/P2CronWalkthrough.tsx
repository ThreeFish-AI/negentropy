/** P2 五段定时表（p2-01..p2-10，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  叙事链：2-A 任务卡特写（开帧四层链缩微全景锚一拍——回看密度刷新空间心智，
 *  随即推近）→ p2-01「一段定时写法／要办的事／两个开关」三件各词落位 stagger
 *  落定（表达式行／提示词条／双开关）〔M-005〕→ p2-02「五段」词落位五槽位自上
 *  而下逐槽点亮（分→时→日→月→星期，段名可数）、「五十年的老写法」词落位槽侧
 *  一枚纵深标尺一闪（年代字面只进角标）、表达式例打字机逐字符敲入、星号槽位
 *  泛微光 → 2-B 走查中景（Animated Worked Example）：p2-03「注册一个任务」词
 *  落位任务卡自特写位缩入链侧注册位〔M-005〕、「每两分钟，取一次日期」词落位
 *  卡面任务签「取日期」亮定 → p2-04「判时命中」词落位表盘指针到位一闪、
 *  「记账、入队」词落位账本添行（墨迹承 1-B 同款）→ p2-05「队列有活、锁也
 *  抢到」词落位双条件两枚检查签先后翻绿、「消息注入对话」词落位任务签沿
 *  注入口滑入环体 → p2-06「照常开工」词落位环体转一圈、结果条携日期串小签
 *  回报（字面进角标）、「全程没人碰过键盘」词落位画面边缘一双人手剪影全程
 *  静止悬空（重音镜——输入值旅程的零人工收点）→ 2-C 左绿右红等高裁决帧建立
 *  （与 P3 左红右绿互为镜像）：p2-07「反直觉」词落位日历翻页定格周一〔M-005〕、
 *  「任一命中就触发」词落位左帧或门演示——日签与周签两枚条件点任一压下即
 *  接通、「是或，不是且」词落位左帧任务灯亮（确认绿）＋右帧同日无灯（警示红
 *  静默）→ p2-08「像家规」词落位家规小卡一闪（A#4 落锚 ≤2s 即收）、
 *  「占一头就行」词落位或门单点接通再演示一拍 → 2-D 实测裁决定格（承 2-C
 *  帧体）：p2-09「只这一对」词落位日·星期两槽位高亮圈定、「分、时、月，仍
 *  全是且」词落位三槽位并列打上且门小签〔M-005〕→ p2-10「写或它响」词落位
 *  左帧九点到点、任务灯应声亮起（实测复演）、「改成且，它哑了」词落位右帧
 *  同刻指针过点、灯不亮（重音镜——e3 裁决 punch，绿勾红叉一帧对峙定格）、
 *  「静默漏掉」词落位右帧日历格一枚任务影淡出（漏跑的具象）。
 *
 *  空间契约：五槽位纵列次序与口播段名一致、打字机逐字符可追、两开关本镜只
 *    亮轮廓（回指留 P4）；任务签「取日期」四段旅程同签同形可追、双条件签
 *    次序=口播次序、人手剪影全程静止；左绿右红（e3 帧色序）、两帧等高（等高
 *    裁决）、或门演示单点接通；左右同一天同一时刻（唯一变量=写法）、绿勾红叉
 *    同帧对峙、镜尾边界签为结构签（裁决结构保留、口播原句不上屏）。
 *  红线落实：槽位文字成句禁、打字机一次成行禁；任务签中途换形禁、环体在
 *    注入前开工禁（顺序逆旁白）；右帧任务灯亮禁（改成且=哑）、家规卡常驻禁、
 *    左右时刻错位禁、右帧部分触发禁；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：1-D→2-A cut＋主装置缩微跨幕（链＋环体共同主体存活，不 morph）；
 *    2-D→3-A Morph Continuity（storyboard 登记）——同一主体=晴空蓝交付卡
 *    （四层链成员），2-D 末帧交付卡于缩微链暗态 → 3-A 首帧交付卡同形放大占屏、
 *    代码窗展开（放大后行低于可读阈值的回退判据不触发——StepWindow 行骨架
 *    26px 可读）。中间态：卡轮廓、晴空蓝描边、「有空」检查框恒定，仅尺度连续
 *    变化；身份线索两项保全。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  CronFieldCard,
  DeliveryProbe,
  LedgerCard,
  LoopRing,
  TaskChip,
  TimeChain,
  WatchFaceCard,
  useSecondTick,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn, useReveal} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 2-A 任务卡特写：五槽位 + 提示词条 + 双开关 + 表达式打字机 ────────────────

/** 2-A 全局位：开帧链缩微全景锚（一拍）→ 任务卡特写居中 */
const CHAIN_2A = {x: 1150, y: 130, w: 380, cardH: 110, gap: 18} as const;
const RING_2A = {x: 60, y: 90, size: 200} as const;
const CARD_2A = {x: 650, y: 210, w: 620, h: 580} as const;

const TwoA: React.FC<{atZoom: number; atExpr: number; atHint: number; atSwitches: number; atFive: number; atRuler: number; atType: number}> = ({atZoom, atExpr, atHint, atSwitches, atFive, atRuler, atType}) => {
  const frame = useCurrentFrame();
  // @pushIn 压向任务卡（开帧链缩微全景锚一拍 → 推近本幕主角）
  const pushTf = usePushIn(atZoom, {scale: 0.24, dur: DUR.f6});
  const stageIn = 1 - clamp01(progress(frame, atZoom, 14));
  // 三件 stagger 落定：表达式行（+打字机）/ 提示词条 / 双开关（只亮轮廓——回指留 P4）
  const exprP = clamp01(progress(frame, atExpr, DUR.f4));
  const hintP = clamp01(progress(frame, atHint, DUR.f4));
  const swPs: [number, number] = [clamp01(progress(frame, atSwitches, DUR.f4)), clamp01(progress(frame, atSwitches + 6, DUR.f4))];
  // 五槽位自上而下逐槽点亮（分→时→日→月→星期——段名可数）
  const five = clamp01(progress(frame, atFive, 56));
  const slotPs = [0, 1, 2, 3, 4].map((i) => clamp01((five * 5 - i) / 1)) as [number, number, number, number, number];
  // 纵深标尺一闪（五十年的老写法——年代字面只进角标）
  const ruler = Math.sin(Math.PI * clamp01(progress(frame, atRuler, 18)));
  // 打字机逐字符敲入（表达式例——逐字符可追）
  const typed = useReveal('*/2 * * * *', {at: atType, framesPerChar: 5});
  return (
    <AbsoluteFill>
      {/* 开帧缩微全景锚（一拍——链＋环体跨幕共同主体存活） */}
      <div style={{position: 'absolute', inset: 0, opacity: stageIn}}>
        <div style={{position: 'absolute', left: RING_2A.x, top: RING_2A.y, opacity: 0.5}}>
          <LoopRing size={RING_2A.size} nodes={[]} showExit={false} />
        </div>
        <TimeChain x={CHAIN_2A.x} y={CHAIN_2A.y} w={CHAIN_2A.w} cardH={CHAIN_2A.cardH} gap={CHAIN_2A.gap} outlineP={1} lits={[1, 1, 1, 1]} dimP={0.35} />
      </div>
      {/* 任务卡特写（推近后主角——中性件中性描边；三件 stagger + 五槽逐槽点亮） */}
      <div style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, transform: pushTf, transformOrigin: '960px 500px'}}>
        <CronFieldCard x={CARD_2A.x} y={CARD_2A.y} w={CARD_2A.w} h={CARD_2A.h} litP={clamp01(progress(frame, atZoom + 4, 12))} slotPs={slotPs} typedN={typed.length} hintP={hintP} switchPs={swPs} starGlowP={exprP} />
        {/* 纵深标尺（卡右侧——一闪：五十年老写法的年代纵深，字面只进角标） */}
        {ruler > 0.03 ? (
          <div style={{position: 'absolute', left: CARD_2A.x + CARD_2A.w + 36, top: CARD_2A.y + 120, opacity: ruler, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
            <div style={{width: 4, height: 300, borderRadius: 2, background: `linear-gradient(180deg, transparent, ${withAlpha(theme.sched, 0.7)})`}} />
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, writingMode: 'vertical-rl', letterSpacing: 2, whiteSpace: 'nowrap'}}>{'五十年'}</div>
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'cron · 0 9 * * * · */5 * * * * · Unix crontab'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 走查中景：任务签「取日期」沿四层链四段旅程（端到端） ──────────────────

/** 2-B 走查舞台：表盘（链首·顶）→ 账本 → 交付卡 → 注入口 → 环体（右） */
const WATCH_2B = {x: 190, y: 90, size: 220} as const;
const LEDGER_2B = {x: 130, y: 350, w: 470, h: 200} as const;
const DELIV_2B = {x: 130, y: 590, w: 470, h: 250} as const;
const RING_2B = {x: 1160, y: 300, size: 430} as const;
const PORT_2B = {x: 660, y: 640} as const;

/** 任务签四段旅程插值（注册位→判时→账本→交付→注入口→环心——分段线性，
 *  飞行三段避让：先爬升后平移再降落由分段路径自然给出） */
const JOURNEY: {x: number; y: number}[] = [
  {x: 460, y: 120}, // 注册位（链侧上方）
  {x: 300, y: 200}, // 判时表盘
  {x: 350, y: 450}, // 账本末行
  {x: 350, y: 715}, // 交付卡消息条位
  {x: 760, y: 660}, // 注入口
  {x: 1290, y: 480}, // 环心（注入后）
];

const TwoB: React.FC<{atReg: number; atTag: number; atHit: number; atRow: number; atCond: number; atInject: number; atRun: number; atResult: number; atHands: number}> = ({atReg, atTag, atHit, atRow, atCond, atInject, atRun, atResult, atHands}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tick = useSecondTick();
  // 任务卡自特写位缩入链侧注册位（p2-03「注册一个任务」——缩微任务卡落注册位）
  const reg = clamp01(progress(frame, atReg, 20));
  // 任务签「取日期」亮定（p2-03 尾——全程同签同形可追）
  const tagLit = clamp01(progress(frame, atTag, DUR.f4));
  // 判时命中：表盘指针到位一闪（p2-04「判时命中」——needleT 抵点 + 闪峰）
  const hit = Math.sin(Math.PI * clamp01(progress(frame, atHit, 16)));
  const needleT = frame >= atHit ? Math.min(1, 0.55 + (frame - atHit) / 30) : 0.55;
  // 账本添行（墨迹承 1-B 同款）
  const row = clamp01(progress(frame, atRow, 18));
  // 双条件两枚检查签先后翻绿（次序=口播：队列有活→程序有空）
  const c1 = clamp01(progress(frame, atCond, DUR.f4));
  const c2 = clamp01(progress(frame, atCond + 10, DUR.f4));
  // 任务签沿注入口滑入环体（p2-05「消息注入对话」）
  const inject = clamp01(progress(frame, atInject, 26));
  // 环体转一圈开工（p2-06「照常开工」——注入后转一圈；注入前禁开工）
  const dotPos = inject >= 1 ? ((frame - atInject - 26) / (fps * 2.5)) % 1 : undefined;
  const runLap = clamp01(progress(frame, atRun, 46));
  // 结果条携日期串小签回报（p2-06「取日期，报结果」）
  const result = clamp01(progress(frame, atResult, 16));
  // 人手剪影全程静止悬空（p2-06「全程没人碰过键盘」——一次未落键）
  const hands = clamp01(progress(frame, atHands, 14));
  // 旅程位置（分段线性：0..5 段插值——journeyT 0..1 全程）
  const legs = JOURNEY.length - 1;
  // 首段：任务签亮定（atTag）后自注册位走向表盘；此后随判时→账本→注入逐段下行
  const preHit = Math.min(0.6, Math.max(0, (frame - atTag) / Math.max(1, atHit - atTag)) * 0.6);
  const journeyT = Math.min(legs, frame >= atHit ? 0.6 + ((Math.min(frame, atInject + 26) - atHit) / Math.max(1, atInject + 26 - atHit)) * (legs - 0.6) : preHit);
  const legI = Math.min(legs - 1, Math.floor(journeyT));
  const legF = journeyT - legI;
  const chipX = JOURNEY[legI].x + (JOURNEY[legI + 1].x - JOURNEY[legI].x) * legF;
  const chipY = JOURNEY[legI].y + (JOURNEY[legI + 1].y - JOURNEY[legI].y) * legF;
  // 注入后任务签隐入环体（消息条形态在环内点亮）
  const chipGone = inject > 0.85;
  return (
    <AbsoluteFill>
      {/* 链路连线（表盘→账本→交付→注入口——竖向连线 + 流光） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line x1={300} y1={WATCH_2B.y + WATCH_2B.size + 8} x2={300} y2={LEDGER_2B.y} stroke={withAlpha(theme.dim, 0.45)} strokeWidth={3.5} />
        <line x1={300} y1={LEDGER_2B.y + LEDGER_2B.h} x2={300} y2={DELIV_2B.y} stroke={withAlpha(theme.dim, 0.45)} strokeWidth={3.5} />
        <line x1={360} y1={DELIV_2B.y + DELIV_2B.h - 40} x2={PORT_2B.x} y2={PORT_2B.y} stroke={withAlpha(theme.dim, 0.45)} strokeWidth={3.5} strokeDasharray="10 8" />
        {/* 注入口→环体（消息条最后一段——注入时点亮） */}
        <line x1={PORT_2B.x + 40} y1={PORT_2B.y} x2={RING_2B.x + 30} y2={RING_2B.y + RING_2B.size / 2} stroke={withAlpha(inject > 0.2 ? theme.ok : theme.dim, inject > 0.2 ? 0.75 : 0.4)} strokeWidth={inject > 0.2 ? 5 : 3.5} strokeLinecap="round" />
        {inject > 0.05 && inject < 0.95 ? <circle cx={PORT_2B.x + 40 + (RING_2B.x - PORT_2B.x - 10) * inject} cy={PORT_2B.y + (RING_2B.y + RING_2B.size / 2 - PORT_2B.y) * inject} r={8} fill={theme.queue} opacity={0.9} /> : null}
      </svg>
      {/* 判时表盘（链首——每秒一闪贯穿；判时命中时指针到位一闪） */}
      <div style={{position: 'absolute', left: WATCH_2B.x, top: WATCH_2B.y}}>
        <WatchFaceCard size={WATCH_2B.size} litP={1} flashT={tick} glow={0.55 + 0.45 * hit} needleT={needleT} />
      </div>
      <div style={{position: 'absolute', left: WATCH_2B.x + WATCH_2B.size + 16, top: WATCH_2B.y + 70, fontFamily: theme.mono, fontSize: 15, color: theme.sched, whiteSpace: 'nowrap'}}>{'判时 · 每秒'}</div>
      {/* 队列账本（添行——墨迹承 1-B 同款） */}
      <LedgerCard x={LEDGER_2B.x} y={LEDGER_2B.y} w={LEDGER_2B.w} h={LEDGER_2B.h} litP={1} rowP={row} rowText={'*/2 · 取日期'} rows={3} glowP={row} mini />
      {/* 交付卡（双条件先后翻绿——次序=口播） */}
      <DeliveryProbe x={DELIV_2B.x} y={DELIV_2B.y} w={DELIV_2B.w} h={DELIV_2B.h} litP={1} probeP={0.5} check1P={c1} check2P={c2} msgP={inject < 0.5 ? 1 : 0} idleP={0} mini />
      {/* 注入口签（交付卡与环体之间——环体唯一入口） */}
      <div style={{position: 'absolute', left: PORT_2B.x - 30, top: PORT_2B.y - 64, fontFamily: theme.mono, fontSize: 14, color: inject > 0.2 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>注入口</div>
      {/* 环体〔M-001〕（右——执行宿主；注入后照常开工转一圈，环上无指针） */}
      <div style={{position: 'absolute', left: RING_2B.x, top: RING_2B.y}}>
        <LoopRing size={RING_2B.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        {runLap > 0.05 ? (
          <div style={{position: 'absolute', left: 0, top: RING_2B.size / 2 - 20, width: RING_2B.size, textAlign: 'center', fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: theme.text, opacity: clamp01(runLap), whiteSpace: 'nowrap'}}>
            开工
          </div>
        ) : null}
        {/* 环内消息条点亮（注入后的任务签——消息形态在环内） */}
        {chipGone ? (
          <div style={{position: 'absolute', left: RING_2B.size / 2 - 76, top: RING_2B.size / 2 + 26, opacity: clamp01(runLap)}}>
            <TaskChip x={0} y={0} label={'取日期'} litP={1} mini />
          </div>
        ) : null}
      </div>
      {/* 结果条（环旁——携日期串小签回报；字面进角标） */}
      {result > 0.03 ? (
        <div style={{position: 'absolute', left: RING_2B.x - 130, top: RING_2B.y + 40, opacity: result, transform: `translateY(${(1 - result) * 16}px)`}}>
          <div style={{padding: '8px 18px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`, background: withAlpha(theme.panel, 0.96), fontFamily: theme.mono, fontSize: 17, color: theme.text, whiteSpace: 'nowrap'}}>
            {'date · 周一 09:00'}
          </div>
        </div>
      ) : null}
      {/* 注册位任务卡（缩微——p2-03 缩入链侧） */}
      {reg > 0.02 && reg < 0.98 ? (
        <div style={{position: 'absolute', left: 420 - (1 - reg) * 500, top: 90 - (1 - reg) * -80, opacity: Math.sin(Math.PI * reg) * 0.9}}>
          <CronFieldCard x={0} y={0} w={210} h={190} litP={1} slotPs={[1, 1, 1, 1, 1]} hintP={1} switchPs={[1, 1]} typedN={10} />
        </div>
      ) : null}
      {/* 任务签「取日期」（旅程主角——同签同形可追；亮定后随旅程飞行） */}
      {!chipGone ? <TaskChip x={chipX - 52} y={chipY - 20} label={'取日期'} litP={tagLit} /> : null}
      {/* 人手剪影（画面左缘——全程静止悬空、一次未落键） */}
      {hands > 0.03 ? (
        <svg width={220} height={160} viewBox="0 0 220 160" style={{position: 'absolute', left: 30, top: 870, opacity: hands * 0.8, pointerEvents: 'none'}}>
          <g fill="none" stroke={withAlpha(theme.dim, 0.85)} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M 30 130 L 30 76 Q 30 64 41 64 Q 52 64 52 76 L 52 82" />
            <path d="M 52 82 L 52 68 Q 52 56 63 56 Q 74 56 74 68 L 74 84" />
            <path d="M 74 84 L 74 74 Q 74 64 84 64 Q 94 64 94 74 L 94 96" />
            <path d="M 94 96 Q 96 116 82 126 L 58 138 Q 40 142 34 128 Z" />
            <path d="M 150 130 L 150 76 Q 150 64 161 64 Q 172 64 172 76 L 172 82" />
            <path d="M 172 82 L 172 68 Q 172 56 183 56 Q 194 56 194 68 L 194 84" />
            <path d="M 194 84 L 194 74 Q 194 64 204 64 Q 214 64 214 74 L 214 96" />
            <path d="M 214 96 Q 216 116 202 126 L 178 138 Q 160 142 154 128 Z" />
          </g>
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'*/2 * * * * · date · [Scheduled] run date'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 「或／且」对比帧建立：左绿右红等高裁决帧 + 家规小卡一闪 ────────────────

/** 2-C/2-D 共用帧体：左帧（x 200）/ 日历（中央）/ 右帧（x 1080）——两帧等高等大 */
const FRAME_L = {x: 200, y: 240, w: 620, h: 440} as const;
const FRAME_R = {x: 1100, y: 240, w: 620, h: 440} as const;
const CAL_2C = {x: 840, y: 130, w: 240, h: 240} as const;

/** 周一日历小页（月历格——「一」号格挂周一签） */
const MondayCal: React.FC<{x: number; y: number; w: number; h: number; litP: number; flipP: number; ghostP?: number}> = ({x, y, w, h, litP, flipP, ghostP = 0}) => {
  const lit = clamp01(litP);
  const flip = clamp01(flipP);
  const ghost = clamp01(ghostP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit, transform: `rotateX(${(1 - flip) * -70}deg)`, transformOrigin: '50% 0%'}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 12, border: `3px solid ${withAlpha(theme.dim, 0.7)}`, background: withAlpha(theme.panel, 0.96)}}>
        <div style={{height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.85)}`, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          周一
        </div>
        {/* 日期格（一号位——周一签 + 任务影（2-D 漏跑具象淡出）） */}
        <div style={{position: 'relative', margin: 12, height: h - 80, borderRadius: 8, border: `2px dashed ${withAlpha(theme.dim, 0.5)}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <span style={{position: 'absolute', left: 10, top: 6, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>01</span>
          <span style={{padding: '6px 16px', borderRadius: 8, border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: ghost > 0.05 ? 1 - ghost * 0.85 : 1}}>
            到点任务
          </span>
          {ghost > 0.03 ? <div style={{position: 'absolute', inset: 8, borderRadius: 6, background: withAlpha(theme.danger, 0.08), opacity: ghost}} /> : null}
        </div>
      </div>
    </div>
  );
};

/** 单帧（或写法左绿 / 且写法右红——等高等大；帧内：表达式签 + 或门/且门 + 任务灯） */
const GateFrame: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  tone: 'ok' | 'danger';
  expr: string;
  litP: number;
  gateP: number;
  lampP: number;
  lampFlash?: number;
  crossP?: number;
}> = ({x, y, w, h, tone, expr, litP, gateP, lampP, lampFlash = 0, crossP = 0}) => {
  const lit = clamp01(litP);
  const gate = clamp01(gateP);
  const lamp = clamp01(lampP);
  const flash = clamp01(lampFlash);
  const cross = clamp01(crossP);
  const on = tone === 'ok' ? theme.ok : theme.danger;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 14, border: `3.5px solid ${withAlpha(on, 0.55)}`, background: withAlpha(theme.panel, 0.95)}}>
        {/* 帧头：写法签（表达式字面——mono） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 62, padding: '0 20px', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.85)}`}}>
          <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: on, whiteSpace: 'nowrap'}}>{tone === 'ok' ? '或' : '且'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>{expr}</span>
        </div>
        {/* 门演示区（或=两枚条件点任一压下即接通 / 且=两枚全压才接通——对照图标） */}
        <div style={{position: 'relative', height: 210, margin: '18px 26px 0'}}>
          <svg width={w - 52} height={210} viewBox={`0 0 ${w - 52} 210`} style={{overflow: 'visible'}}>
            {/* 两条条件臂（日签/周签——mono 标注） */}
            {[0, 1].map((k) => {
              const yy = 46 + k * 96;
              const armP = tone === 'ok' ? (k === 0 ? Math.min(1, gate * 2) : Math.max(0, gate * 2 - 1) * 0.5) : gate;
              return (
                <g key={`arm${k}`}>
                  <line x1={10} y1={yy} x2={150} y2={yy} stroke={withAlpha(theme.dim, 0.6)} strokeWidth={4} />
                  <circle cx={10} cy={yy} r={15} fill={armP > 0.35 ? withAlpha(on, 0.75) : withAlpha(theme.dim, 0.35)} stroke={on} strokeWidth={3} opacity={0.5 + 0.5 * armP} />
                  <text x={10} y={yy - 24} textAnchor="middle" fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
                    {k === 0 ? '日 1' : '周 1'}
                  </text>
                </g>
              );
            })}
            {/* 汇流门（或门弧形 / 且门平直——对照图标） */}
            <path
              d={tone === 'ok' ? `M 160 46 Q 210 46 210 ${46 + Math.min(1, gate * 1.2) * 50}` : `M 160 46 L 210 ${46 + gate * 96} L 210 142 L 160 142`}
              fill="none"
              stroke={on}
              strokeWidth={4.5}
              strokeLinecap="round"
              opacity={0.4 + 0.6 * gate}
            />
            <line x1={210} y1={tone === 'ok' ? 96 : 142} x2={268} y2={tone === 'ok' ? 96 : 142} stroke={on} strokeWidth={4.5} strokeLinecap="round" opacity={0.4 + 0.6 * gate} />
          </svg>
          {/* 任务灯（帧右——或写法命中亮（确认绿辉光）／且写法同日静默（警示红轮廓不亮）） */}
          <div style={{position: 'absolute', right: 6, top: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: `4px solid ${lamp > 0.3 || tone === 'danger' ? on : withAlpha(theme.dim, 0.6)}`,
                background: lamp > 0.3 && tone === 'ok' ? theme.ok : 'transparent',
                boxShadow: lamp > 0.3 && tone === 'ok' ? `0 0 ${18 + 14 * flash}px ${withAlpha(theme.ok, 0.8)}` : 'none',
                opacity: tone === 'danger' ? 0.75 : 1,
              }}
            />
            <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: tone === 'danger' ? theme.danger : lamp > 0.3 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>
              {tone === 'ok' ? '任务灯' : '同刻 · 无灯'}
            </span>
          </div>
        </div>
        {/* 实测裁决标记（2-D——左帧绿勾 / 右帧红叉 + 铃波纹；同帧对峙定格） */}
        {cross > 0.03 ? (
          <div style={{position: 'absolute', right: 96, top: 74, width: 100, height: 100}}>
            {tone === 'ok' ? (
              <>
                {[0, 1].map((k) => {
                  const p = clamp01(cross * 1.5 - k * 0.4);
                  if (p <= 0.02 || p >= 0.98) return null;
                  return <span key={`gw${k}`} style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${withAlpha(theme.ok, 0.6 * (1 - p))}`, transform: `scale(${0.5 + p * (1.2 + k * 0.3)})`}} />;
                })}
                <svg width={100} height={100} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0}}>
                  <path d="M 24 52 L 44 72 L 78 32" fill="none" stroke={theme.ok} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={cross} />
                </svg>
              </>
            ) : (
              <svg width={100} height={100} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0}}>
                <line x1={24} y1={24} x2={76} y2={76} stroke={theme.danger} strokeWidth={9} strokeLinecap="round" opacity={cross} />
                <line x1={76} y1={24} x2={24} y2={76} stroke={theme.danger} strokeWidth={9} strokeLinecap="round" opacity={cross} />
              </svg>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const TwoC: React.FC<{atCal: number; atOr: number; atVerdict: number; atRule: number; atOne: number}> = ({atCal, atOr, atVerdict, atRule, atOne}) => {
  const frame = useCurrentFrame();
  // 日历翻页定格周一（p2-07「反直觉」——翻页 rotateX 落定）
  const calLit = clamp01(progress(frame, atCal - 8, DUR.f5));
  const flip = clamp01(progress(frame, atCal, 16));
  // 或门演示（p2-07「任一命中就触发」——左帧日签先压下接通）
  const gate = clamp01(progress(frame, atOr, 22));
  // 左亮右静默（p2-07「是或，不是且」——左帧任务灯亮确认绿、右帧同日无灯）
  const lampL = clamp01(progress(frame, atVerdict, DUR.f4));
  // 家规小卡一闪（p2-08「像家规」——A#4 落锚 ≤2s 即收）
  const rule = Math.min(clamp01(progress(frame, atRule, 10)), 1 - clamp01(progress(frame, atRule + 40, 10)));
  // 单点接通再演示一拍（p2-08「占一头就行」——周签单独压下也接通）
  const one = Math.sin(Math.PI * clamp01(progress(frame, atOne, 18)));
  const gateOne = gate + one * 0.3;
  return (
    <AbsoluteFill>
      {/* 左帧（或写法——确认绿） */}
      <GateFrame x={FRAME_L.x} y={FRAME_L.y} w={FRAME_L.w} h={FRAME_L.h} tone="ok" expr="0 9 1 * 1" litP={clamp01(progress(frame, atOr - 12, 14))} gateP={gateOne} lampP={lampL} lampFlash={one} />
      {/* 右帧（且写法——同日静默警示红：门不合、灯不亮） */}
      <GateFrame x={FRAME_R.x} y={FRAME_R.y} w={FRAME_R.w} h={FRAME_R.h} tone="danger" expr="0 9 1 * 1 且" litP={clamp01(progress(frame, atOr - 8, 14))} gateP={clamp01(gate * 0.4)} lampP={0} />
      {/* 周一日历（中央——翻页定格） */}
      <MondayCal x={CAL_2C.x} y={CAL_2C.y} w={CAL_2C.w} h={CAL_2C.h} litP={calLit} flipP={flip} />
      {/* 家规小卡（一闪即收——周末或下雨天；只作或语义锚，不剧场化） */}
      {rule > 0.03 ? (
        <div style={{position: 'absolute', left: CAL_2C.x - 130, top: CAL_2C.y + 300, width: 500, opacity: rule}}>
          <div style={{padding: '14px 24px', borderRadius: 11, border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`, background: withAlpha(theme.panel, 0.96)}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>家规 · 占一头就行</div>
            <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 4, whiteSpace: 'nowrap'}}>{'周末 或 下雨 → 零食'}</div>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'0 9 1 * 1 · cron_matches · DOM / DOW'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-D 实测裁决定格（承 2-C 帧体）：绿勾红叉对峙 + 边界结构签 ────────────────

const SLOTS_2D = {x: 580, y: 92, w: 760, h: 96} as const;
const CONDSIGN_2D = {x: 960, y: 742} as const;

const TwoD: React.FC<{atHL: number; atAnd: number; atLeftGo: number; atRightMiss: number; atGhost: number}> = ({atHL, atAnd, atLeftGo, atRightMiss, atGhost}) => {
  const frame = useCurrentFrame();
  // 日·星期两槽位高亮圈定（p2-09「只这一对」——sched 圈定）
  const hl = clamp01(progress(frame, atHL, 14));
  // 三槽位并列打上且门小签（p2-09「分、时、月，仍全是且」——全点接通对照图标）
  const and = clamp01(progress(frame, atAnd, 16));
  // 左帧九点到点即响（p2-10「写或它响」——任务灯应声亮起，实测复演）
  const lampL = clamp01(progress(frame, atLeftGo, DUR.f4));
  const goFlash = Math.sin(Math.PI * clamp01(progress(frame, atLeftGo + 2, 16)));
  // 右帧同刻指针过点灯不亮（p2-10「改成且，它哑了」——重音镜 punch）
  const miss = clamp01(progress(frame, atRightMiss, 14));
  // 右帧日历格任务影淡出（p2-10「静默漏掉」——漏跑的具象）
  const ghost = clamp01(progress(frame, atGhost, 16));
  const slots = [
    {n: '分', hl: false},
    {n: '时', hl: false},
    {n: '日', hl: true},
    {n: '月', hl: false},
    {n: '星期', hl: true},
  ];
  return (
    <AbsoluteFill>
      {/* 五槽位迷你横排（顶部中央——日·星期 sched 圈定 + 分/时/月 且门小签） */}
      <div style={{position: 'absolute', left: SLOTS_2D.x, top: SLOTS_2D.y, width: SLOTS_2D.w, display: 'flex', gap: 14}}>
        {slots.map((s) => {
          const inHL = s.hl && hl > 0.03;
          const inAnd = !s.hl && and > 0.03;
          return (
            <div
              key={`sd${s.n}`}
              style={{
                flex: 1,
                height: SLOTS_2D.h,
                borderRadius: 10,
                border: `2.5px ${inHL ? 'solid' : 'dashed'} ${inHL ? theme.sched : inAnd ? theme.danger : withAlpha(theme.dim, 0.45)}`,
                background: inHL ? withAlpha(theme.sched, 0.1) : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: inHL ? `0 0 ${14 * hl}px ${withAlpha(theme.sched, 0.45)}` : 'none',
                opacity: inHL || inAnd ? 1 : 0.62,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text}}>{s.n}</span>
              {inAnd ? (
                <span style={{padding: '2px 10px', borderRadius: 6, border: `2px solid ${theme.danger}`, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.danger, opacity: and, whiteSpace: 'nowrap'}}>且</span>
              ) : inHL ? (
                <span style={{padding: '2px 10px', borderRadius: 6, border: `2px solid ${theme.sched}`, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.sched, opacity: hl, whiteSpace: 'nowrap'}}>或</span>
              ) : (
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>*</span>
              )}
            </div>
          );
        })}
      </div>
      {/* 左帧（或写法——绿勾 + 铃波纹：写或它响） */}
      <GateFrame x={FRAME_L.x} y={FRAME_L.y} w={FRAME_L.w} h={FRAME_L.h} tone="ok" expr="0 9 1 * 1" litP={1} gateP={1} lampP={lampL} lampFlash={goFlash} crossP={lampL} />
      {/* 右帧（且写法——红叉：同刻过点灯不亮、任务影淡出） */}
      <GateFrame x={FRAME_R.x} y={FRAME_R.y} w={FRAME_R.w} h={FRAME_R.h} tone="danger" expr="0 9 1 * 1 且" litP={1} gateP={0.35 + miss * 0.1} lampP={0} crossP={miss} />
      {/* 周一日历（中央——右帧镜像的漏跑具象：任务影淡出由右侧日历格承载） */}
      <MondayCal x={CAL_2C.x + 14} y={CAL_2C.y + 130} w={212} h={212} litP={1} flipP={1} ghostP={ghost * 0.9} />
      {/* 缩微链暗层（跨幕存活——2-D 末帧交付卡于此暗态，为 3-A morph 起点） */}
      <TimeChain x={1560} y={150} w={300} cardH={88} gap={14} mini outlineP={1} lits={[1, 1, 1, 1]} dimP={0.62} />
      {/* 镜尾边界签（结构签——裁决结构保留、口播原句不上屏） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: CONDSIGN_2D.y, display: 'flex', justifyContent: 'center', gap: 18, opacity: clamp01(progress(frame, atAnd + 8, DUR.f4))}}>
        <span style={{padding: '7px 20px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.sched, 0.85)}`, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.sched, background: withAlpha(theme.panel, 0.95), whiteSpace: 'nowrap'}}>
          {'日 · 星期 → 或'}
        </span>
        <span style={{padding: '7px 20px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`, fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.danger, background: withAlpha(theme.panel, 0.95), whiteSpace: 'nowrap'}}>
          {'分 · 时 · 月 → 且'}
        </span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'0 9 1 * 1 · cron_matches · DOM / DOW'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2CronWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-06');
  const bC = w('p2-07', 'p2-08');
  const bD = w('p2-09', 'p2-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atZoom={wa('p2-01', 0.06) - bA.from}
          atExpr={wa('p2-01', 0.3) - bA.from}
          atHint={wa('p2-01', 0.58) - bA.from}
          atSwitches={wa('p2-01', 0.8) - bA.from}
          atFive={wa('p2-02', 0.24) - bA.from}
          atRuler={wa('p2-02', 0.65) - bA.from}
          atType={wa('p2-01', 0.3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atReg={wa('p2-03', 0.3) - bB.from}
          atTag={wa('p2-03', 0.62) - bB.from}
          atHit={wa('p2-04', 0.38) - bB.from}
          atRow={wa('p2-04', 0.72) - bB.from}
          atCond={wa('p2-05', 0.35) - bB.from}
          atInject={wa('p2-05', 0.72) - bB.from}
          atRun={wa('p2-06', 0.18) - bB.from}
          atResult={wa('p2-06', 0.45) - bB.from}
          atHands={wa('p2-06', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atCal={wa('p2-07', 0.24) - bC.from}
          atOr={wa('p2-07', 0.66) - bC.from}
          atVerdict={wa('p2-07', 0.9) - bC.from}
          atRule={wa('p2-08', 0.08) - bC.from}
          atOne={wa('p2-08', 0.8) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <TwoD
          atHL={wa('p2-09', 0.22) - bD.from}
          atAnd={wa('p2-09', 0.65) - bD.from}
          atLeftGo={wa('p2-10', 0.45) - bD.from}
          atRightMiss={wa('p2-10', 0.62) - bD.from}
          atGhost={wa('p2-10', 0.9) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2CronWalkthrough;
