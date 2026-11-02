/** P3 迟到的通知（p3-01..p3-10，4 镜）——分镜 3-A / 3-B / 3-C / 3-D。
 *
 *  叙事链：3-A 开帧走查舞台全景一拍（坐标锚：环体缩悬＋登记表驻位＋模型侧
 *  消息条三件全貌）→ @pushIn 推近通知卡特写：p3-01「后台跑完」词落位进度走满、
 *  安装任务卡收拢包成一张兰紫通知卡（morph 起点：描边色雾蓝→兰紫身份交接、
 *  任务签与编号签恒定可追）、「真结果」词落位登记表 bg_0001 行点亮抬升、「不补
 *  旧账」词落位旧消息条上补写箭头被红叉掐断（1-A 下路红叉同形回扣）→ p3-02
 *  前三栏逐栏点亮（任务号/状态/原命令 stagger）＋第四栏摘要亮 → p3-03「最长
 *  两百字」词落位摘要栏超长文本条被 200 字标线截断、「只留开头」词落位截断段
 *  淡出（截断动画可见，重音镜）→ 3-B 收集机制全景：环体居中照常旋转、p3-04
 *  「主循环自己」词落位环体转过登记表一整圈、「顺手查一遍」词落位表上完成行
 *  被扫过点亮 → p3-05「收进通知」词落位完成行抽升为通知卡（3-A 同形）、「合进
 *  同一条消息」词落位通知卡与当轮结果条并轨合入同一条消息条送进对话侧（合入
 *  动作可见）→ 3-C 两回合时间轴走查·回合一（Animated State Trace）：p3-06
 *  参数签贴上命令卡、命令卡沿时间轴向右出发 → 双闸门缩微位门①绿放行一闪 →
 *  后台轨开跑 → p3-07「占位回执」回执卡回到模型侧消息位（2-A 同形）、「预告」
 *  读配置调用块亮起排队 → 3-D 回合二＋同框定格（全片张力峰值二）：p3-08「快
 *  命令」「当场拿到」读配置结果条即时返回（无等待帧）→ p3-09「顺手收集」环体
 *  缩微位转过登记表一拍、「同框出现」安装通知卡与配置内容条并轨合入同框定格
 *  （1–2s punch——全片机制兑现帧）→ p3-10「一分钟都没干等」时长标尺压轴落定、
 *  「坎还在后头」轴尾小坎轮廓浮起（半透明，交给 P4）。
 *
 *  空间契约：四栏次序=口播次序、截断标线只作用于摘要栏（前三栏原样）、通知卡
 *    兰紫为唯一新主题色元素；环体转动与过表查收同步（每轮一次、顺手≠停下）、
 *    通知卡与 3-A 同形、合入后消息条内两件可辨；双泳道时间轴向单一（左→右）、
 *    任务签四段旅程同形同色、门①缩微位只闪放行（机制已讲不重演）；同框定格
 *    内两件等大并列、回合间无等待空档可核对。
 *
 *  红线落实：词落位 = wa(id,f)（⑧ 轮按句内字位复核；枚举类 cue 前置词窗早段
 *    ——p3-02 三栏 stagger 取 0.42/0.52/0.62 词窗前沿〔QA 教训 35〕）；y≥56 /
 *    bottom≥176；task_notification · turn 1 / turn 2 · npm install ·
 *    package.json · summary ≤ 200 只进角标。
 *
 *  承接登记：2-C→3-A morph（storyboard 登记）——同一主体=后台轨上的安装任务
 *    （npm install 命令卡＋bg_0001 签），进度连续走满、卡描边雾蓝→兰紫过渡。
 *    3-D→4-A SceneFade＋后台轨全局位重锚（Map-First 接管）；安装任务签同形
 *    复用为限制演示对象（镜间身份恒常）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  BackgroundTrack,
  LoopRing,
  PlaceholderReceipt,
  RegistryTable,
  RingExecSeg,
  STAGE,
  TaskNotificationCard,
  mixHex,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 任务签（npm install · bg_0001——四段旅程同形同色可追） */
const TaskSign: React.FC<{x: number; y: number; p?: number; dim?: boolean}> = ({x, y, p = 1, dim = false}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 14px',
      borderRadius: 8,
      border: `2.5px solid ${dim ? withAlpha(theme.dim, 0.6) : withAlpha(theme.mech, 0.85)}`,
      background: withAlpha(theme.panel, 0.97),
      opacity: clamp01(p),
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.text}}>{'npm install'}</span>
    <span
      style={{
        padding: '1px 8px',
        borderRadius: 5,
        border: `2px solid ${dim ? withAlpha(theme.dim, 0.6) : theme.mech}`,
        fontFamily: theme.mono,
        fontSize: 12,
        fontWeight: 700,
        color: dim ? theme.dim : theme.mech,
      }}
    >
      {'bg_0001'}
    </span>
  </div>
);

// ── 3-A 通知卡出生：全景一拍 → 推近包卡 + 四栏点亮 + 200 字截断 ─────────────

/** 通知卡位（推近后近满幅）；对照条右侧静态层 */
const NCARD = {x: 620, y: 250, w: 680, h: 420} as const;

const ThreeA: React.FC<{atFull: number; atRow: number; atNoBack: number; atCols: number[]; atTrunc: number; atTruncFade: number; atZoom: number}> = ({atFull, atRow, atNoBack, atCols, atTrunc, atTruncFade, atZoom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 开帧全景一拍（坐标锚）→ @pushIn 推近通知卡（真结果回归起聚焦本集第二主角）
  const zoomP = clamp01(progress(frame, atZoom, 24));
  const o = {x: NCARD.x + NCARD.w / 2, y: NCARD.y + NCARD.h / 2};
  const c = {x: 940, y: 470};
  const z = 1 + (1.2 - 1) * zoomP;
  const zoomTf = `translate(${(c.x - o.x) * zoomP}px, ${(c.y - o.y) * zoomP}px) scale(${z})`;
  // p3-01「后台跑完」：轨上进度走满（2-C 承接 0.42 → 1 连续无跳变）+ 包卡 morph
  const wrap = clamp01(progress(frame, atFull + 6, 20));
  const progFull = clamp01(0.42 + 0.58 * clamp01(progress(frame, atFull, 16)));
  // 描边色身份交接：雾蓝 → 兰紫（后台世界 → 通知世界）
  const edge = mixHex(theme.mech, theme.notify, wrap);
  // 「真结果」：登记表 bg_0001 行点亮抬升（表上一行→独立卡的出生动作）
  const rowGlow = clamp01(progress(frame, atRow, 16));
  // 「不补旧账」：旧消息条上补写箭头被红叉掐断（1-A 下路红叉同形回扣）
  const cutP = Math.sin(Math.PI * clamp01(progress(frame, atNoBack, 18)));
  // p3-02 四栏 stagger（次序=口播：任务号→状态→原命令→摘要）
  const colsP = atCols.reduce((acc, a) => acc + clamp01(progress(frame, a, 10)), 0);
  // p3-03：200 字标线截断 + 截断段淡出（重音镜）
  const trunc = clamp01(progress(frame, atTrunc, 14));
  const truncFade = clamp01(progress(frame, atTruncFade, 16));
  // 环体缩悬（全景锚件——照常旋转）
  const dotPos = (frame / (fps * 2.5)) % 1;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: zoomTf, transformOrigin: `${o.x}px ${o.y}px`}}>
        {/* 环体缩悬顶角（坐标锚——照常旋转，解放态） */}
        <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y, opacity: 1 - 0.6 * zoomP}}>
          <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dotPos} />
          <RingExecSeg size={STAGE.ring.size} segP={1} freeP={1} />
        </div>
        {/* 登记表驻位（bg_0001 行：运行中 → 完成点亮抬升） */}
        <RegistryTable x={STAGE.registry.x} y={STAGE.registry.y} w={STAGE.registry.w} h={STAGE.registry.h} litP={0.9} rowP={1} state="running" doneP={rowGlow} dimP={0.25 * zoomP} />
        {/* 后台线程轨（承接 2-C——进度连续走满，morph 起点） */}
        <BackgroundTrack x={STAGE.track.x} y={STAGE.track.y} w={STAGE.track.w} litP={1} cardT={0.48 + 0.3 * clamp01(progress(frame, atFull, 16))} progP={progFull} flowT={frame / 40} flowP={1 - wrap} />
        {/* 安装任务卡收拢 → 通知卡出生（同一 DOM 层推进：任务签持续在卡内可追） */}
        <div style={{position: 'absolute', left: NCARD.x + 30, top: NCARD.y - 130 + wrap * 130, opacity: 1 - wrap}}>
          <TaskSign x={0} y={0} p={1} />
        </div>
        <TaskNotificationCard
          x={NCARD.x}
          y={NCARD.y}
          w={NCARD.w}
          h={NCARD.h}
          litP={wrap}
          colsP={colsP}
          truncP={trunc}
          truncFadeP={truncFade}
          glowP={clamp01(progress(frame, atFull + 14, DUR.f5))}
          edge={edge}
        />
        {/* 模型侧旧消息条（右上缩位——「不补旧账」判例：补写箭头被红叉掐断） */}
        <div style={{position: 'absolute', left: 1260, top: 170, width: 400, opacity: 0.85}}>
          <div style={{padding: '10px 16px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.panelBorder, 0.9)}`, background: withAlpha(theme.panel, 0.94), fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'messages · turn 1'}
          </div>
          {cutP > 0.03 ? (
            <svg width={300} height={70} viewBox="0 0 300 70" style={{marginTop: 8, opacity: cutP}}>
              <path d="M 10 40 Q 120 8 230 34" fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeDasharray="7 6" />
              <path d="M 222 26 L 236 36 L 220 44" fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              <line x1={216} y1={16} x2={252} y2={54} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" />
              <line x1={252} y1={16} x2={216} y2={54} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" />
            </svg>
          ) : null}
        </div>
      </div>
      {/* 对照位（静态层——zoom 外：原命令超长输出条 vs 摘要短条） */}
      <div style={{position: 'absolute', left: 1360, top: 560, width: 480, opacity: clamp01(progress(frame, atTrunc - 6, DUR.f5))}}>
        <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'原命令输出 · 超长'}</div>
        <div style={{position: 'relative', height: 46, borderRadius: 7, border: `2px solid ${withAlpha(theme.dim, 0.5)}`, background: withAlpha(theme.panel, 0.9), marginTop: 6}}>
          {Array.from({length: 6}, (_, i) => (
            <div key={`lo${i}`} style={{position: 'absolute', left: 8, top: 6 + i * 6.4, width: 300 + ((i * 53) % 140), height: 3, borderRadius: 2, background: withAlpha(theme.dim, 0.5)}} />
          ))}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.notify, marginTop: 14, whiteSpace: 'nowrap'}}>{'摘要 · ≤ 200'}</div>
        <div style={{position: 'relative', height: 26, borderRadius: 7, border: `2px solid ${withAlpha(theme.notify, 0.6)}`, background: withAlpha(theme.panel, 0.9), marginTop: 6}}>
          <div style={{position: 'absolute', left: 8, top: 10, width: 210, height: 4, borderRadius: 2, background: withAlpha(theme.notify, 0.65)}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'task_notification · summary ≤ 200'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 过表查收：环体每圈扫表 + 完成行抽升为通知卡 + 合入同一消息条 ─────────

/** 环体居中位；登记表左下驻位；模型侧消息条右缘 */
const RING_3B = {x: 760, y: 150, size: 400} as const;
const REG_3B = {x: 180, y: 600, w: 460, h: 220} as const;
const MSG_3B = {x: 1350, y: 300, w: 460} as const;

const ThreeB: React.FC<{atLap: number; atSweep: number; atLift: number; atMerge: number}> = ({atLap, atSweep, atLift, atMerge}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 环体转过登记表一整圈（转动可见——lap 起点对齐登记表方位，过表时点同步）
  // 环心 (960,350) r=154；登记表在左下——光点行至 135°（左下）方位即「过表」
  const lapStart = atLap - 30;
  const dotPos = (Math.max(frame, lapStart) - lapStart) / (fps * 2.5);
  // 「顺手查一遍」：光点行至表方位（135°=0.625 圈）时完成行被扫过点亮
  const sweep = clamp01(progress(frame, atSweep, 14));
  // 「收进通知」：完成行抽升为通知卡（3-A 同形——表上一行→独立卡的出生）
  const lift = clamp01(progress(frame, atLift, 24));
  // 「合进同一条消息」：通知卡与当轮结果条并轨合入同一条消息条送进对话侧
  const merge = clamp01(progress(frame, atMerge, 26));
  // 环体「交结果」时点位（0°=右侧）与登记表之间的顺路收集通路
  const pathLit = clamp01(progress(frame, atLap, 18));
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕居中转动主体（每圈过表查收——照常旋转不停） */}
      <div style={{position: 'absolute', left: RING_3B.x, top: RING_3B.y}}>
        <LoopRing size={RING_3B.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        <RingExecSeg size={RING_3B.size} segP={1} freeP={1} />
      </div>
      {/* 顺路收集通路（环「交结果」点位 ↔ 登记表——虚线常亮） */}
      <svg width={700} height={400} viewBox="0 0 700 400" style={{position: 'absolute', left: 260, top: 400, overflow: 'visible', opacity: pathLit * 0.8}}>
        <path d="M 640 40 C 520 80 420 180 300 250" fill="none" stroke={withAlpha(theme.mech, 0.55)} strokeWidth={3.5} strokeDasharray="11 9" pathLength={1} strokeDashoffset={1 - pathLit} />
      </svg>
      {/* 登记表驻位（bg_0001 行完成待收 → 扫过点亮 → 抽升出生） */}
      <RegistryTable x={REG_3B.x} y={REG_3B.y} w={REG_3B.w} h={REG_3B.h} litP={0.95} rowP={1} state="done" doneP={Math.max(sweep, lift)} mini={false} />
      {/* 抽升出生的通知卡（3-A 同形缩档——沿收集通路飞向消息条） */}
      {lift > 0.02 ? (
        <div style={{position: 'absolute', left: 520 + merge * 700, top: 520 - lift * 190 - merge * 130, opacity: clamp01(lift * 1.5)}}>
          <TaskNotificationCard x={0} y={0} w={300} h={170} litP={1} colsP={4} mini glowP={0.7} />
        </div>
      ) : null}
      {/* 模型侧消息条（右缘——当轮结果条 + 通知卡并轨合入同一条消息） */}
      <div style={{position: 'absolute', left: MSG_3B.x, top: MSG_3B.y, width: MSG_3B.w, opacity: clamp01(progress(frame, atMerge - 6, DUR.f5))}}>
        <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'对话 · 当轮消息'}</div>
        <div
          style={{
            marginTop: 8,
            padding: '14px 18px',
            borderRadius: 10,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.95),
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: 0.4 + 0.6 * merge,
          }}
        >
          {/* 当轮结果条（环体交回的既有件） */}
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{width: 12, height: 12, borderRadius: 3, background: withAlpha(theme.core, 0.8)}} />
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.text, whiteSpace: 'nowrap'}}>{'tool_result · 当轮'}</span>
          </div>
          {/* 合入的通知卡（缩档同形——与当轮结果条同条可辨两件） */}
          {merge > 0.35 ? (
            <div style={{opacity: clamp01(merge * 2 - 0.7)}}>
              <TaskNotificationCard x={0} y={0} w={400} h={120} litP={1} colsP={4} mini glowP={0.5} />
            </div>
          ) : null}
        </div>
        {/* 送进对话侧（合入后消息条整体右移一档——动作可见） */}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'registry 扫描 · 顺路收集'}
      </div>
    </AbsoluteFill>
  );
};

// ── 两回合时间轴（3-C/3-D 共用几何：横向轴 + 上泳道模型侧 + 下泳道后台轨） ────

const AXIS = {x1: 220, x2: 1720, y: 540} as const;
const LANE_TOP = {y: 330} as const; // 上泳道：模型侧消息条
const LANE_BOT = {y: 690} as const; // 下泳道：后台轨
const R1_X = 320; // 回合一：命令出发点
const GATE_X = 760; // 双闸门缩微位
const BG_START_X = 960; // 后台轨开跑位
const R2_X = 1180; // 回合二：读配置出发点

/** 时间轴骨架（双泳道 + 轴线 + 回合分界） */
const TimelineBase: React.FC<{litP: number; round2P: number}> = ({litP, round2P}) => (
  <svg width={1920} height={560} viewBox="0 0 1920 560" style={{position: 'absolute', left: 0, top: 300, opacity: litP, pointerEvents: 'none'}}>
    {/* 主时间轴（左→右单向） */}
    <line x1={AXIS.x1} y1={AXIS.y - 300} x2={AXIS.x2} y2={AXIS.y - 300} stroke={withAlpha(theme.panelBorder, 1)} strokeWidth={4} strokeLinecap="round" />
    <path d={`M ${AXIS.x2 - 22} ${AXIS.y - 312} L ${AXIS.x2} ${AXIS.y - 300} L ${AXIS.x2 - 22} ${AXIS.y - 288}`} fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    {/* 回合分界虚线（回合一 | 回合二） */}
    <line x1={1080} y1={AXIS.y - 350} x2={1080} y2={AXIS.y - 180} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} strokeDasharray="9 8" />
    {/* 泳道标签 */}
    <text x={AXIS.x1 - 10} y={LANE_TOP.y - 290} textAnchor="end" fontFamily={theme.sans} fontSize={19} fontWeight={700} fill={theme.dim}>
      模型侧
    </text>
    <text x={AXIS.x1 - 10} y={LANE_BOT.y - 290} textAnchor="end" fontFamily={theme.sans} fontSize={19} fontWeight={700} fill={theme.mech}>
      后台轨
    </text>
    {/* 回合标签 */}
    <text x={R1_X + 40} y={AXIS.y - 356} fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
      turn 1
    </text>
    {round2P > 0.3 ? (
      <text x={R2_X + 60} y={AXIS.y - 356} fontFamily={theme.mono} fontSize={15} fill={theme.dim} opacity={round2P}>
        turn 2
      </text>
    ) : null}
  </svg>
);

/** 双闸门缩微位（门①绿放行一闪——机制已讲不重演：只闪放行不重扫） */
const MiniGate: React.FC<{greenP: number}> = ({greenP}) => (
  <div style={{position: 'absolute', left: GATE_X - 40, top: AXIS.y - 100, opacity: 0.5 + 0.5 * clamp01(greenP)}}>
    <svg width={80} height={64} viewBox="0 0 80 64">
      <line x1={8} y1={58} x2={8} y2={10} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} strokeLinecap="round" />
      <line x1={72} y1={58} x2={72} y2={10} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={4} strokeLinecap="round" />
      <line x1={8} y1={10} x2={72} y2={10} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} />
      {greenP > 0.02 ? (
        <g opacity={clamp01(greenP)}>
          <circle cx={40} cy={40} r={10} fill={theme.ok} />
          <circle cx={40} cy={40} r={16} fill="none" stroke={withAlpha(theme.ok, 0.5)} strokeWidth={2.5} />
        </g>
      ) : null}
    </svg>
  </div>
);

// ── 3-C 回合一：参数签贴上 + 命令卡出发 + 回执回位 + 读配置预告排队 ──────────

const ThreeC: React.FC<{atParam: number; atSend: number; atGreen: number; atRun: number; atReceipt: number; atQueue: number}> = ({atParam, atSend, atGreen, atRun, atReceipt, atQueue}) => {
  const frame = useCurrentFrame();
  // 参数签贴上命令卡（带上了后台参数）
  const param = clamp01(progress(frame, atParam, 12));
  // 命令卡沿时间轴向右出发 → 过闸（门①绿放行一闪）→ 落入后台轨开跑
  const send = clamp01(progress(frame, atSend, 26));
  const travelX = R1_X + (BG_START_X - R1_X) * send;
  const greenFlash = Math.sin(Math.PI * clamp01(progress(frame, atGreen, 10)));
  const runP = clamp01(progress(frame, atRun, 400));
  // 「占位回执」：回执卡回到模型侧消息位（2-A 同形）
  const receipt = clamp01(progress(frame, atReceipt, 20));
  // 「预告」：读配置调用块亮起排队（下一回合伏笔）
  const queue = clamp01(progress(frame, atQueue, 14));
  return (
    <AbsoluteFill>
      <TimelineBase litP={clamp01(progress(frame, 2, DUR.f5))} round2P={0} />
      {/* 模型侧（左缘发起位——图标 + 消息位） */}
      <div style={{position: 'absolute', left: 150, top: LANE_TOP.y - 60, opacity: clamp01(progress(frame, 4, DUR.f4))}}>
        <svg width={70} height={70} viewBox="0 0 90 90">
          <rect x={8} y={14} width={74} height={62} rx={12} fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3} />
          <circle cx={32} cy={38} r={6} fill={withAlpha(theme.core, 0.85)} />
          <circle cx={58} cy={38} r={6} fill={withAlpha(theme.core, 0.85)} />
          <path d="M 30 58 Q 45 66 60 58" fill="none" stroke={withAlpha(theme.core, 0.85)} strokeWidth={3} strokeLinecap="round" />
        </svg>
      </div>
      {/* 出发中的命令卡（npm install + bg_0001 任务签 + 参数签——四段旅程第 1 段） */}
      <div style={{position: 'absolute', left: travelX, top: AXIS.y - 120, opacity: send > 0.02 ? 1 : 0}}>
        <TaskSign x={0} y={0} p={Math.min(1, send * 3)} />
        {/* 参数签（run_in_background——贴上后随卡同行） */}
        {param > 0.02 ? (
          <span
            style={{
              position: 'absolute',
              left: 20,
              top: -30,
              padding: '3px 10px',
              borderRadius: 6,
              border: `2px solid ${theme.mech}`,
              background: theme.panel,
              fontFamily: theme.mono,
              fontSize: 12,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
              opacity: param,
            }}
          >
            {'run_in_background'}
          </span>
        ) : null}
      </div>
      <MiniGate greenP={greenFlash} />
      {/* 后台轨（下泳道——安装任务开跑，进度条起爬不剧透走满） */}
      <BackgroundTrack x={BG_START_X} y={LANE_BOT.y} w={AXIS.x2 - BG_START_X} litP={clamp01(progress(frame, atRun - 4, 16))} cardT={0.08 + 0.3 * runP} progP={0.05 + 0.32 * runP} flowT={frame / 40} flowP={0.6} mini />
      {/* 占位回执卡（回到模型侧消息位——2-A 同形） */}
      {receipt > 0.02 ? (
        <div style={{position: 'absolute', left: 260, top: LANE_TOP.y - 20, opacity: receipt, transform: `translateY(${(1 - receipt) * 16}px)`}}>
          <PlaceholderReceipt x={0} y={0} w={330} litP={1} compact />
        </div>
      ) : null}
      {/* 读配置调用块（预告排队——下一回合伏笔，package.json 角标） */}
      {queue > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 640,
            top: LANE_TOP.y - 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            borderRadius: 9,
            border: `2.5px dashed ${withAlpha(theme.tool, 0.8)}`,
            background: withAlpha(theme.panel, 0.9),
            opacity: queue,
            transform: `translateY(${(1 - queue) * 12}px)`,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text}}>{'读配置'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'package.json'}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'turn 1 · run_in_background · bg_0001'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 回合二＋同框定格：即时返回 + 顺手收集 + 同框 punch + 一分钟标尺 ──────

const ThreeD: React.FC<{atFast: number; atCollect: number; atSame: number; atRuler: number; atBump: number}> = ({atFast, atCollect, atSame, atRuler, atBump}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 回合一末态（承 3-C 定格：回执在消息位、读配置排队、后台任务在爬）——回合
  // 二开拍：读配置调用块出发 → 过闸（快命令）→ 配置内容条**即时**返回模型侧
  const fast = clamp01(progress(frame, atFast, 14));
  const cfgOut = clamp01(progress(frame, atFast - 2, 10));
  const cfgBack = clamp01(progress(frame, atFast + 4, 10));
  // 后台任务走满（回合二期间走完——进度连续承接 3-C 0.37 档）+ 通知卡点亮
  const bgDone = clamp01(progress(frame, atCollect, 20));
  // 「顺手收集」：环体缩微位转过登记表一拍（缩微走查联动）
  const ringDot = (frame / (fps * 2.5)) % 1;
  const lapFlash = Math.sin(Math.PI * clamp01(progress(frame, atCollect + 2, 16)));
  // 「同框出现」：安装通知卡与配置内容条并轨合入同框定格（等大并列——punch；
  // 微推 usePushIn 幕内真调用——机制兑现帧的聚焦语言，承 3-A @pushIn 词锚动机）
  const same = clamp01(progress(frame, atSame, 18));
  const punchPush = usePushIn(atSame, {scale: 0.05, dur: DUR.f6});
  // 「一分钟都没干等」：轴尾时长标尺压轴落定（主循环全程零等待的读法标尺）
  const ruler = clamp01(progress(frame, atRuler, 18));
  // 「坎还在后头」：轴尾小坎轮廓浮起（半透明，交给 P4）
  const bump = clamp01(progress(frame, atBump, 14));
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: punchPush, transformOrigin: '50% 55%'}}>
      <TimelineBase litP={1} round2P={1} />
      {/* 回合一末态驻位（承 3-C：回执 + 排队块虚化驻留） */}
      <div style={{position: 'absolute', left: 260, top: LANE_TOP.y - 20, opacity: 0.45}}>
        <PlaceholderReceipt x={0} y={0} w={330} litP={1} compact />
      </div>
      {/* 读配置调用块（回合二出发点——实线亮起） */}
      <div
        style={{
          position: 'absolute',
          left: R2_X + (1220 - R2_X) * cfgOut,
          top: LANE_TOP.y - 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.tool, 0.9)}`,
          background: withAlpha(theme.panel, 0.95),
          opacity: clamp01(progress(frame, atFast - 6, DUR.f4)),
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text}}>{'读配置'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'package.json'}</span>
      </div>
      {/* 配置内容条（即时返回——时间轴无等待帧：出发后 10 帧内回到模型侧） */}
      {cfgBack > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 1280 - cfgBack * 900,
            top: LANE_TOP.y - 26,
            padding: '6px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.tool, 0.85)}`,
            background: withAlpha(theme.panel, 0.96),
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: cfgBack,
          }}
        >
          {'{ "name": "app", … }'}
        </div>
      ) : null}
      {/* 后台轨（回合二期间走满 → 通知卡点亮；进度连续承接无跳变） */}
      <BackgroundTrack x={BG_START_X} y={LANE_BOT.y} w={AXIS.x2 - BG_START_X} litP={1} cardT={0.5} progP={0.5 + 0.5 * bgDone} flowT={frame / 40} flowP={1 - bgDone} mini />
      {/* 环体缩微位 + 登记表缩微（走查联动——顺手收集的一拍） */}
      <div style={{position: 'absolute', left: 1500, top: 120, opacity: 0.75}}>
        <LoopRing size={150} nodes={[]} showExit={false} dotProgress={ringDot} />
        <RingExecSeg size={150} segP={1} freeP={1} />
        <div style={{position: 'absolute', left: 170, top: 30}}>
          <RegistryTable x={0} y={0} w={240} h={120} mini litP={0.9} rowP={1} state={bgDone > 0.5 ? 'done' : 'running'} syncP={lapFlash} />
        </div>
      </div>
      {/* 回合二消息条（同框定格——配置内容条 + 安装通知卡两件等大并列，punch） */}
      {same > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 430,
            top: LANE_TOP.y + 40,
            width: 1060,
            padding: '16px 22px',
            borderRadius: 12,
            border: `3.5px solid ${withAlpha(theme.notify, 0.4 + 0.5 * same)}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            gap: 24,
            opacity: same,
            transform: `scale(${0.94 + 0.06 * same})`,
            boxShadow: same > 0.8 ? `0 0 ${26 * same}px ${withAlpha(theme.notify, 0.35)}` : 'none',
          }}
        >
          {/* 件一：配置内容条（与件二等大并列——禁一大一小暗示主次） */}
          <div style={{flex: 1, padding: '10px 14px', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.tool, 0.8)}`, fontFamily: theme.mono, fontSize: 15, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden'}}>
            {'package.json · 内容已回'}
          </div>
          {/* 件二：安装通知卡（兰紫点亮——同框兑现帧） */}
          <div style={{flex: 1}}>
            <TaskNotificationCard x={0} y={0} w={480} h={64} litP={1} colsP={4} mini glowP={same} />
          </div>
        </div>
      ) : null}
      {/* 一分钟时长标尺（轴尾压轴——回合全程零等待的读法标尺） */}
      {ruler > 0.02 ? (
        <svg width={1520} height={60} viewBox="0 0 1520 60" style={{position: 'absolute', left: 220, top: AXIS.y + 110, opacity: ruler}}>
          <line x1={R1_X} y1={30} x2={R1_X + (AXIS.x2 - 80 - R1_X) * ruler} y2={30} stroke={theme.text} strokeWidth={3.5} strokeLinecap="round" />
          <line x1={R1_X} y1={16} x2={R1_X} y2={44} stroke={theme.text} strokeWidth={3} />
          <line x1={AXIS.x2 - 80} y1={16} x2={AXIS.x2 - 80} y2={44} stroke={theme.text} strokeWidth={3} />
          <text x={(R1_X + AXIS.x2 - 80) / 2} y={14} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fontWeight={700} fill={theme.text}>
            一分钟 · 零干等
          </text>
        </svg>
      ) : null}
      {/* 轴尾小坎轮廓（半透明——坎还在后头，交给 P4） */}
      {bump > 0.02 ? (
        <svg width={120} height={70} viewBox="0 0 120 70" style={{position: 'absolute', left: AXIS.x2 - 90, top: AXIS.y - 120, opacity: bump * 0.55}}>
          <path d="M 8 62 L 40 22 L 60 42 L 86 10" fill="none" stroke={theme.danger} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 8" />
        </svg>
      ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'turn 2 · package.json · task_notification'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3NotificationWalkthrough: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-05');
  const bC = w('p3-06', 'p3-07');
  const bD = w('p3-08', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atZoom={wa('p3-01', 0.06) - bA.from}
          atFull={wa('p3-01', 0.12) - bA.from}
          atRow={wa('p3-01', 0.34) - bA.from}
          atNoBack={wa('p3-01', 0.76) - bA.from}
          atCols={[0.42, 0.52, 0.62, 0.86].map((f) => wa('p3-02', f) - bA.from)}
          atTrunc={wa('p3-03', 0.24) - bA.from}
          atTruncFade={wa('p3-03', 0.8) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atLap={wa('p3-04', 0.3) - bB.from}
          atSweep={wa('p3-04', 0.72) - bB.from}
          atLift={wa('p3-05', 0.24) - bB.from}
          atMerge={wa('p3-05', 0.56) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atParam={wa('p3-06', 0.62) - bC.from}
          atSend={wa('p3-06', 0.74) - bC.from}
          atGreen={wa('p3-06', 0.9) - bC.from}
          atRun={wa('p3-07', 0.02) - bC.from}
          atReceipt={wa('p3-07', 0.2) - bC.from}
          atQueue={wa('p3-07', 0.5) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD
          atFast={wa('p3-08', 0.44) - bD.from}
          atCollect={wa('p3-09', 0.16) - bD.from}
          atSame={wa('p3-09', 0.8) - bD.from}
          atRuler={wa('p3-10', 0.38) - bD.from}
          atBump={wa('p3-10', 0.82) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3NotificationWalkthrough;
