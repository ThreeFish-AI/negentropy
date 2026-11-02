/** P3 还得等你有空（p3-01..p3-08，3 镜）——分镜 3-A / 3-B / 3-C。
 *
 *  叙事链：3-A 交付线程循环特写（ECU——开帧四层链全景一拍、高亮交付卡位回看
 *  坐标，随即急推；Morph Continuity 承 2-D：同一交付卡晴空蓝描边＋「有空」
 *  检查框恒定、仅尺度连续变化）：p3-01「六行」词落位六行自上而下逐行点亮
 *  （行数可数——不多不少）〔M-005〕→ p3-02「队列空，走」词落位第一行分支闪、
 *  「锁抢不到，走」词落位第二行分支闪＋锁红光一拍、「零点二秒后再来」词落位
 *  计时小环转四分之一圈即返、「拿到锁再确认」词落位绿光下二次检查框亮（六行
 *  全亮=最精一步的完整骨架）→ p3-03「抢不到锁就是答案」词落位锁红光特写定格
 *  一拍——红光本身即答案（不该交付的语义色）〔M-003〕→ 3-B 左红右绿消融同屏
 *  （全片张力峰值）：p3-04「无视忙锁」词落位左轨实验签挂上（破坏实验开启）
 *  〔M-005〕、「到点硬塞」词落位消息条不等锁、直插回合窗 → p3-05「五个来回，
 *  一次没走」词落位左轨五枚绿点自 5 逐一熄灭至 0（走开重看 5→0 计数条同步
 *  跳落，基线标尺——重音镜·全片唯一大 punch）、「撞进正在进行的一轮」词落位
 *  回合窗内两道写入轨迹相撞、迸红色裂纹（承 1-D 焊点裂纹同款——硬焊死的
 *  崩点）→ p3-06「两方一起往对话里写」词落位回合窗内两条写入流交织对冲、
 *  「规矩，破了」词落位一枚「一次只许一方写」令牌小片（承 1-C 同款）裂开
 *  两半（p1-06 令牌伏笔回收）→ 3-C 闹钟回扣＋交付静候对照帧：p3-07「不管你
 *  正忙，照响」词落位左帧铃波纹穿过人形剪影（不停不等）〔M-005〕、「等你
 *  空下来」词落位右帧回合窗熄下、消息条方才滑入注入口（确认绿点亮——等的
 *  具象）→ p3-08「硬焊死」词落位 1-D 焊死两签复现一拍、「互相打架」词落位
 *  焊点崩开——两签弹开分立、队列带居中亮起（分家的空间陈述，幕点收束位）
 *  〔M-003〕。
 *
 *  空间契约：六行行数可数（不多不少）、红/绿互斥不同帧同亮、走开-回来循环
 *    单向；红左绿右（e4 帧色序——与 2-C/2-D 左绿右红互为镜像，勿混）、五枚
 *    绿点与计数 5→0 双口径对齐、回合窗「亮着」状态可见（正忙前提）；左右
 *    对照帧等高（闹钟不等 vs 交付等）、分立后两签间有队列带（隔开的实体）、
 *    确认绿只在注入成帧亮。
 *  红线落实：代码窗不显示完整源码文本（只留行骨架＋关键词位）、交付卡在
 *    红光期禁注入；右轨出现任何退化禁、左轨绿点残亮禁（走开归零即语义）、
 *    只给结论不给撞入过程禁；右帧在回合窗亮着时禁注入（逆机制）、闹钟帧
 *    禁常驻；词落位 = wa(id,f)；y≥56 / bottom≥176。
 *
 *  承接登记：2-D→3-A Morph（交付卡）；3-C→4-A SceneFade＋拉远重锚（承 ep2
 *    3-C→4-A、ep11 同款判例），环体以〔M-001〕同形签名跨幕（暗态轮廓恒定）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  ConditionSigns,
  DeliveryProbe,
  LockBadge,
  LoopRing,
  StepWindow,
  TaskChip,
  TimeChain,
  TokenChip,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 交付线程循环特写：六行代码窗 + 锁红绿交替 + 走开-计时-回来 ────────────

/** 3-A 全局位：代码窗居中偏左 / 锁特写右侧 / 交付卡身份签缩位（morph 身份线索） */
const CHAIN_3A = {x: 1250, y: 130, w: 430, cardH: 120, gap: 20} as const;
const WIN_3A = {x: 240, y: 170, w: 800, h: 400} as const;
const LOCK_3A = {x: 1120, y: 420} as const;
const DELIV_3A = {x: 240, y: 610, w: 480, h: 170} as const;

const ThreeA: React.FC<{atZoom: number; atLines: number; atL1: number; atL2: number; atL3: number; atL4: number; atRed: number}> = ({atZoom, atLines, atL1, atL2, atL3, atL4, atRed}) => {
  const frame = useCurrentFrame();
  // 急推（开帧链全景一拍·高亮交付卡位 → ECU：@pushIn 递进逼近——P3 特写行程）
  const pushTf = usePushIn(atZoom, {scale: 0.28, dur: DUR.f6});
  const stageIn = 1 - clamp01(progress(frame, atZoom, 12));
  // 六行逐行点亮（行数可数——p3-01「六行」起 stagger，每行 ~10f）
  const linesOn = clamp01(progress(frame, atLines, 62));
  const lp = (i: number) => clamp01(linesOn * 6 - i);
  const linePs: [number, number, number, number, number, number] = [lp(0), lp(1), lp(2), lp(3), lp(4), lp(5)];
  // 分支行闪（行1 队列空走 / 行2 锁抢不到走——闪峰 sin）
  const b1 = Math.sin(Math.PI * clamp01(progress(frame, atL1, 12)));
  const b2 = Math.sin(Math.PI * clamp01(progress(frame, atL2, 12)));
  // 计时小环转四分之一圈即返（p3-02「零点二秒后再来」——0→1→0.25 圈往返）
  const lap = clamp01(progress(frame, atL3, 26));
  const idleT = lap < 0.6 ? lap / 0.6 * 0.25 : 0.25;
  // 绿光下二次检查框亮（p3-02「拿到锁再确认」——行4 尾「再确认」签）
  const confirm = clamp01(progress(frame, atL4, DUR.f4));
  // 锁红绿交替（行2 分支红光一拍 → 再确认绿光；p3-03 尾红光特写定格——互斥）
  const tone: 'red' | 'green' | 'off' = frame >= atRed ? 'red' : frame >= atL4 ? 'green' : frame >= atL2 && frame < atL2 + 14 ? 'red' : 'off';
  const glow = frame >= atRed ? clamp01(progress(frame, atRed, 12)) : Math.max(Math.sin(Math.PI * clamp01(progress(frame, atL2, 16))), confirm);
  return (
    <AbsoluteFill>
      {/* 开帧链全景锚（一拍——高亮交付卡位回看坐标；缩微链跨镜存活） */}
      <div style={{position: 'absolute', inset: 0, opacity: stageIn}}>
        <TimeChain x={CHAIN_3A.x} y={CHAIN_3A.y} w={CHAIN_3A.w} cardH={CHAIN_3A.cardH} gap={CHAIN_3A.gap} outlineP={1} lits={[1, 1, 1, 1]} hot={2} dimP={0.25} />
      </div>
      {/* 急推容器（交付卡 ECU——代码窗 + 锁 + 身份签缩位） */}
      <div style={{position: 'absolute', inset: 0, transform: pushTf, transformOrigin: '640px 400px'}}>
        {/* 六行代码窗（行骨架＋关键词位——禁完整源码文本） */}
        <StepWindow x={WIN_3A.x} y={WIN_3A.y} w={WIN_3A.w} h={WIN_3A.h} litP={clamp01(progress(frame, atZoom + 6, 12))} linePs={linePs} branchPs={[b1, b2]} confirmP={confirm} redP={frame >= atRed ? 1 : 0} />
        {/* 锁特写（窗右——红/绿交替演示；p3-03 尾红光定格=答案） */}
        <LockBadge x={LOCK_3A.x} y={LOCK_3A.y} size={130} tone={tone} glowP={glow} />
        {/* 走开-计时-回来（计时小环——转四分之一圈即返；卡右下） */}
        {lap > 0.02 ? (
          <div style={{position: 'absolute', left: LOCK_3A.x + 20, top: LOCK_3A.y + 190, opacity: clamp01(lap * 3)}}>
            <svg width={90} height={90} viewBox="0 0 90 90">
              <circle cx={32} cy={32} r={24} fill="none" stroke={withAlpha(theme.queue, 0.8)} strokeWidth={4} />
              <line x1={32} y1={32} x2={32 + 24 * Math.sin(idleT * Math.PI * 2)} y2={32 - 24 * Math.cos(idleT * Math.PI * 2)} stroke={theme.queue} strokeWidth={3.5} strokeLinecap="round" />
              <text x={62} y={36} fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
                0.2s
              </text>
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', marginTop: 2}}>{'走开 · 计时 · 回来'}</div>
          </div>
        ) : null}
        {/* 交付卡身份签缩位（morph 身份线索：晴空蓝描边 +「有空」检查框恒在） */}
        <DeliveryProbe x={DELIV_3A.x} y={DELIV_3A.y} w={DELIV_3A.w} h={DELIV_3A.h} litP={1} check2P={confirm} idleP={lap > 0.02 ? 1 : 0} idleT={idleT} probeP={0.3} mini />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'QueueProcessor.step'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 左红右绿消融同屏（全片张力峰值） ─────────────────────────────────────

/** 3-B 双轨位（红左绿右——与 2-C/2-D 左绿右红互为镜像） */
const LANE_L = {x: 170, y: 160, w: 660, h: 600} as const;
const LANE_R = {x: 1090, y: 160, w: 660, h: 600} as const;

/** 回合窗（环上一段正亮=正在进行的一轮——迷你环体 + 亮弧段；右轨走完熄下）。
 *  `busyP` 亮弧显形（正忙态可见）；`crashP` 撞入轨迹相撞迸裂纹；`weaveP` 两条
 *  写入流交织对冲；`dimP` 走完熄下（3-C 静候注入帧的空下来） */
const TurnWindow: React.FC<{x: number; y: number; size: number; busyP: number; dimP?: number; crashP?: number; weaveP?: number; injectP?: number}> = ({x, y, size, busyP, dimP = 0, crashP = 0, weaveP = 0, injectP = 0}) => {
  const busy = clamp01(busyP);
  const dim = clamp01(dimP);
  const crash = clamp01(crashP);
  const weave = clamp01(weaveP);
  const inject = clamp01(injectP);
  const c = size / 2;
  const r = size / 2 - 30;
  const a0 = (-20 * Math.PI) / 180;
  const a1 = (100 * Math.PI) / 180;
  const x0 = c + r * Math.cos(a0);
  const y0 = c + r * Math.sin(a0);
  const x1 = c + r * Math.cos(a1);
  const y1 = c + r * Math.sin(a1);
  // 撞点（亮弧中点）
  const mx = c + r * Math.cos((a0 + a1) / 2);
  const my = c + r * Math.sin((a0 + a1) / 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      {/* 迷你环体（core 陶土橙恒定——环上无指针） */}
      <circle cx={c} cy={c} r={r} fill="none" stroke={theme.core} strokeWidth={5} opacity={0.85 - 0.5 * dim} />
      {/* 亮弧段（正在进行的一轮——busy 态可见前提） */}
      <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke={theme.core} strokeWidth={9} strokeLinecap="round" opacity={busy * (1 - dim)} />
      <text x={c} y={c + r + 30} textAnchor="middle" fontFamily={theme.sans} fontSize={16} fontWeight={700} fill={theme.dim} opacity={dim > 0.5 ? 1 : 0.65}>
        {dim > 0.5 ? '回合窗 · 空' : '回合窗 · 进行中'}
      </text>
      {/* 撞入轨迹（两道写入轨迹相撞——crash 起自两侧向撞点会聚、迸裂纹） */}
      {crash > 0.02 ? (
        <>
          <line x1={c - 110} y1={my - 90} x2={c - 110 + (mx - c + 110) * crash} y2={my - 90 + (my - (my - 90)) * crash} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
          <line x1={c + 130} y1={my + 60} x2={c + 130 + (mx - c - 130) * crash} y2={my + 60 - 60 * crash} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
          {/* 迸红色裂纹（承 1-D 焊点裂纹同款——硬焊死的崩点） */}
          {[0, 1, 2, 3, 4].map((k) => {
            const ang = (k / 5) * Math.PI * 2 + 0.4;
            const inner = 10 + 12 * crash;
            const outer = inner + 26 * crash;
            return <line key={`cr${k}`} x1={mx + inner * Math.cos(ang)} y1={my + inner * Math.sin(ang)} x2={mx + outer * Math.cos(ang)} y2={my + outer * Math.sin(ang)} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" opacity={crash} />;
          })}
        </>
      ) : null}
      {/* 交织对冲（两条写入流在窗内交错——weave） */}
      {weave > 0.02 ? (
        <>
          <path d={`M ${c - 60} ${c - 60} Q ${c} ${c} ${c + 60} ${c + 60}`} fill="none" stroke={withAlpha(theme.danger, 0.85)} strokeWidth={4} strokeDasharray="10 7" opacity={weave} />
          <path d={`M ${c + 60} ${c - 60} Q ${c} ${c} ${c - 60} ${c + 60}`} fill="none" stroke={withAlpha(theme.danger, 0.85)} strokeWidth={4} strokeDasharray="10 7" opacity={weave} />
        </>
      ) : null}
      {/* 空闲注入（3-C 静候帧——回合窗熄下后消息条滑入，确认绿） */}
      {inject > 0.02 ? (
        <>
          <line x1={c - 150} y1={c} x2={c - 150 + (c - r - 8 - (c - 150)) * inject} y2={c} stroke={theme.ok} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
          {inject > 0.9 ? <circle cx={c - r + 4} cy={c} r={8} fill={theme.ok} opacity={clamp01(inject - 0.9) * 10} /> : null}
        </>
      ) : null}
    </svg>
  );
};

/** 单轨（消融双轨同构——迷你链交付位 + 回合窗 + 五枚绿点 + 计数条 + 轨名签） */
const AblationLane: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  tone: 'danger' | 'ok';
  name: string;
  sub: string;
  litP: number;
  dotsGone: number;
  countP: number;
  busyP: number;
  crashP?: number;
  weaveP?: number;
  forceP?: number;
  busyDim?: number;
  injectP?: number;
}> = ({x, y, w, h, tone, name, sub, litP, dotsGone, countP, busyP, crashP = 0, weaveP = 0, forceP = 0, busyDim = 0, injectP = 0}) => {
  const lit = clamp01(litP);
  const gone = clamp01(dotsGone);
  const count = clamp01(countP);
  const on = tone === 'danger' ? theme.danger : theme.ok;
  const litCount = 5 - Math.round(gone * 5);
  const twSize = 240;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 15, border: `3.5px solid ${withAlpha(on, 0.55)}`, background: withAlpha(theme.panel, 0.95)}}>
        {/* 轨头：实验签（左=无视忙锁·警示红 / 右=非阻塞在位·确认绿） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 64, padding: '0 20px', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.85)}`}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: on, whiteSpace: 'nowrap'}}>{name}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{sub}</span>
        </div>
        {/* 迷你链交付位（链成员存活——交付卡缩微 + 检查框） */}
        <div style={{position: 'absolute', left: 24, top: 84}}>
          <DeliveryProbe x={0} y={0} w={300} h={150} litP={1} check1P={1} check2P={tone === 'ok' ? 1 : 0} probeP={tone === 'ok' ? 0.35 : 0} mini />
        </div>
        {/* 回合窗（右——左轨亮着被硬插 / 右轨正常走完；3-C 静候由场景另置） */}
        <TurnWindow x={w - twSize - 40} y={90} size={twSize} busyP={busyP} dimP={busyDim} crashP={crashP} weaveP={weaveP} injectP={injectP} />
        {/* 硬插消息条（左轨——不等锁、直插回合窗） */}
        {forceP > 0.02 ? (
          <div style={{position: 'absolute', left: 330, top: 150 + forceP * 40, opacity: clamp01(forceP)}}>
            <TaskChip x={0} y={0} label={'硬塞消息'} litP={1} tone="danger" mini />
          </div>
        ) : null}
        {/* 五枚绿点（五次走开重看——右轨依次点亮保持 / 左轨自 5 逐一熄灭归零） */}
        <div style={{position: 'absolute', left: 32, bottom: 118, display: 'flex', gap: 18, alignItems: 'center'}}>
          {Array.from({length: 5}, (_, i) => {
            const onDot = i < litCount;
            return (
              <span
                key={`dt${i}`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `3px solid ${onDot ? theme.ok : withAlpha(theme.dim, 0.4)}`,
                  background: onDot ? theme.ok : 'transparent',
                  boxShadow: onDot ? `0 0 10px ${withAlpha(theme.ok, 0.6)}` : 'none',
                }}
              />
            );
          })}
          <span style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginLeft: 6, whiteSpace: 'nowrap'}}>{'走开重看'}</span>
        </div>
        {/* 计数条（walk_aways 5→0——双口径对齐；右轨恒 5、左轨跳落归零） */}
        <div style={{position: 'absolute', left: 32, right: 32, bottom: 62}}>
          <div style={{position: 'relative', height: 34, borderRadius: 8, border: `2.5px solid ${withAlpha(theme.ok, 0.6)}`, background: withAlpha(theme.panel, 0.9)}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(litCount / 5) * 100}%`, borderRadius: 6, background: withAlpha(theme.ok, 0.35) }} />
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, whiteSpace: 'nowrap'}}>
              {`walk_aways ${litCount}`}
            </div>
          </div>
          {/* 0↔5 基线刻度（基线标尺恒驻） */}
          <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 4, whiteSpace: 'nowrap'}}>
            <span>{'0'}</span>
            <span style={{color: count > 0.5 && tone === 'danger' ? theme.danger : theme.dim}}>{'基线 5'}</span>
            <span>{'5'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ThreeB: React.FC<{atTag: number; atForce: number; atDots: number; atCrash: number; atWeave: number; atSplit: number}> = ({atTag, atForce, atDots, atCrash, atWeave, atSplit}) => {
  const frame = useCurrentFrame();
  // 左轨实验签挂上（p3-04「无视忙锁」——破坏实验开启）
  const laneLit = clamp01(progress(frame, atTag - 10, 14));
  // 到点硬塞（p3-04「到点硬塞」——消息条不等锁、直插回合窗）
  const force = clamp01(progress(frame, atForce, 18));
  // 五枚绿点自 5 逐一熄灭至 0（p3-05「五个来回，一次没走」——重音镜·唯一大 punch）
  const gone = clamp01(progress(frame, atDots, 40));
  // 回合窗内两道写入轨迹相撞迸裂纹（p3-05「撞进正在进行的一轮」）
  const crash = clamp01(progress(frame, atCrash, 14));
  // 两条写入流交织对冲（p3-06「两方一起往对话里写」）
  const weave = clamp01(progress(frame, atWeave, 18));
  // 令牌裂开两半（p3-06「规矩，破了」——p1-06 令牌伏笔回收）
  const split = clamp01(progress(frame, atSplit, 16));
  return (
    <AbsoluteFill>
      {/* 左轨（无视忙锁——警示红；五枚绿点熄灭归零·注入撞进进行中的一轮） */}
      <AblationLane x={LANE_L.x} y={LANE_L.y} w={LANE_L.w} h={LANE_L.h} tone="danger" name={'无视忙锁'} sub={'inject_busy = true'} litP={laneLit} dotsGone={gone} countP={gone} busyP={1} crashP={crash} weaveP={weave} forceP={force} />
      {/* 右轨（非阻塞在位——确认绿；五次走开重看·零硬注入） */}
      <AblationLane x={LANE_R.x} y={LANE_R.y} w={LANE_R.w} h={LANE_R.h} tone="ok" name={'非阻塞在位'} sub={'walk_away → 0.2s retry'} litP={clamp01(progress(frame, 8, 14))} dotsGone={0} countP={0} busyP={0.6} />
      {/* 令牌小片（裂开两半——「一次只许一方写」的规矩破了；承 1-C 同款） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 812, display: 'flex', justifyContent: 'center', opacity: clamp01(progress(frame, atSplit - 6, 12))}}>
        <TokenChip x={0} y={0} litP={1} holderT={0.5} splitP={split} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'walk_aways 5→0 · inj_busy'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 闹钟回扣 + 交付静候对照帧：左闹钟照响 / 右空下来才注入 + 焊点崩开 ──────

const CONDS_3C = {x: 960, y: 780} as const;

const ThreeC: React.FC<{atBell: number; atWait: number; atReWeld: number; atBurst: number}> = ({atBell, atWait, atReWeld, atBurst}) => {
  const frame = useCurrentFrame();
  // 左帧铃波纹穿过人形剪影（p3-07「不管你正忙，照响」——不停不等）
  const bell = clamp01(progress(frame, atBell, 34));
  // 右帧回合窗熄下、消息条方才滑入（p3-07「等你空下来」——确认绿点亮=等的具象）
  const busyDim = clamp01(progress(frame, atWait - 8, 14));
  const inject = clamp01(progress(frame, atWait + 6, 22));
  // 焊死两签复现一拍（p3-08「硬焊死」）→ 崩开分立（「互相打架」）→ 队列带亮起
  const reweld = clamp01(progress(frame, atReWeld, 12));
  const burst = clamp01(progress(frame, atBurst, 16));
  // 队列带（居中隔开——分家的空间陈述：一条实体队列带隔开两签）
  const beltLit = clamp01(progress(frame, atBurst + 6, 14));
  return (
    <AbsoluteFill>
      {/* 左帧：闹钟照响（人形剪影埋头忙碌 + 耳边闹钟 + 铃波纹穿过不停不等） */}
      <div style={{position: 'absolute', left: 220, top: 180, width: 620, height: 460}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 14, border: `3px solid ${withAlpha(theme.dim, 0.5)}`, background: withAlpha(theme.panel, 0.95)}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 18px', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.85)}`}}>
            <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{'闹钟 · 照响'}</span>
          </div>
          {/* 人形剪影（埋头忙碌——伏案身形） */}
          <svg width={330} height={300} viewBox="0 0 330 300" style={{position: 'absolute', left: 40, top: 100}}>
            <g fill={withAlpha(theme.dim, 0.75)}>
              <circle cx={110} cy={92} r={34} />
              <path d="M 58 300 Q 58 150 110 138 Q 162 150 162 300 Z" />
              <path d="M 150 300 Q 150 190 196 178 Q 226 190 228 300 Z" />
            </g>
            {/* 案面（忙碌中的工作面） */}
            <line x1={20} y1={262} x2={310} y2={262} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={5} strokeLinecap="round" />
          </svg>
          {/* 耳边闹钟（小图 + 铃波纹穿过人形——不停不等） */}
          <svg width={210} height={210} viewBox="0 0 210 210" style={{position: 'absolute', right: 24, top: 74}}>
            {[0, 1, 2].map((k) => {
              const p = clamp01(bell * 1.5 - k * 0.36);
              if (p <= 0.01 || p >= 0.99) return null;
              return <circle key={`bw${k}`} cx={105} cy={105} r={40 + p * 70} fill="none" stroke={withAlpha(theme.text, 0.5 * (1 - p))} strokeWidth={4} />;
            })}
            <circle cx={105} cy={105} r={44} fill={withAlpha(theme.panel, 0.98)} stroke={withAlpha(theme.dim, 0.9)} strokeWidth={4.5} />
            <line x1={105} y1={105} x2={105} y2={74} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
            <line x1={105} y1={105} x2={126} y2={112} stroke={withAlpha(theme.text, 0.7)} strokeWidth={3} strokeLinecap="round" />
            <circle cx={81} cy={62} r={12} fill={withAlpha(theme.panel, 0.98)} stroke={withAlpha(theme.dim, 0.9)} strokeWidth={3.5} />
            <circle cx={129} cy={62} r={12} fill={withAlpha(theme.panel, 0.98)} stroke={withAlpha(theme.dim, 0.9)} strokeWidth={3.5} />
          </svg>
          {/* 波纹穿过提示（铃波纹径直穿过人形——不停不等） */}
          {bell > 0.3 ? (
            <div style={{position: 'absolute', left: 90, top: 96, fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(bell - 0.3)}}>
              {'不停 · 不等'}
            </div>
          ) : null}
        </div>
      </div>
      {/* 右帧：交付静候（回合窗走完熄下、空下来才注入——确认绿） */}
      <div style={{position: 'absolute', left: 1080, top: 180, width: 620, height: 460}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 14, border: `3px solid ${withAlpha(theme.queue, 0.55)}`, background: withAlpha(theme.panel, 0.95)}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: '0 18px', borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.85)}`}}>
            <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.queue, whiteSpace: 'nowrap'}}>{'交付 · 静候'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'wait → idle → inject'}</span>
          </div>
          {/* 回合窗（忙→走完熄下→空下来才注入；确认绿只在注入成帧亮） */}
          <TurnWindow x={190} y={110} size={250} busyP={1} dimP={busyDim} injectP={inject} />
          {/* 持消息条静候的交付卡（缩微——承 3-A 身份签） */}
          <DeliveryProbe x={30} y={300} w={330} h={140} litP={1} check1P={1} check2P={busyDim > 0.5 ? 1 : 0.2} msgP={inject < 0.9 ? 1 : 0} idleP={busyDim < 0.5 ? 1 : 0} idleT={(frame % 22) / 22} probeP={0.25} mini />
        </div>
      </div>
      {/* 焊死两签复现一拍 → 崩开分立（承 1-D ConditionSigns 同件——P3 幕点收束） */}
      <ConditionSigns x={CONDS_3C.x} y={CONDS_3C.y} litP={reweld} weldP={reweld} crackP={burst * 0.6} burstP={burst} />
      {/* 队列带（居中隔开——分家的空间陈述：两签之间一条实体队列带） */}
      {beltLit > 0.03 ? (
        <div style={{position: 'absolute', left: 880, top: CONDS_3C.y - 4, width: 160, height: 46, opacity: beltLit}}>
          <svg width={160} height={46} viewBox="0 0 160 46">
            <rect x={4} y={12} width={152} height={22} rx={11} fill={withAlpha(theme.panel, 0.97)} stroke={withAlpha(theme.queue, 0.8)} strokeWidth={3} />
            {Array.from({length: 4}, (_, i) => (
              <circle key={`qc${i}`} cx={26 + i * 36} cy={23} r={6.5} fill={withAlpha(theme.queue, 0.35 + 0.5 * beltLit)} />
            ))}
          </svg>
          <div style={{position: 'absolute', left: 0, right: 0, top: 44, textAlign: 'center', fontFamily: theme.mono, fontSize: 13, color: theme.queue, whiteSpace: 'nowrap'}}>{'queue'}</div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'闹钟 ≠ 交付线程 · 等空闲'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3BusyLockAblation: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-06');
  const bC = w('p3-07', 'p3-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atZoom={wa('p3-01', 0.06) - bA.from}
          atLines={wa('p3-01', 0.7) - bA.from}
          atL1={wa('p3-02', 0.08) - bA.from}
          atL2={wa('p3-02', 0.25) - bA.from}
          atL3={wa('p3-02', 0.5) - bA.from}
          atL4={wa('p3-02', 0.82) - bA.from}
          atRed={wa('p3-03', 0.5) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atTag={wa('p3-04', 0.62) - bB.from}
          atForce={wa('p3-04', 0.85) - bB.from}
          atDots={wa('p3-05', 0.5) - bB.from}
          atCrash={wa('p3-05', 0.8) - bB.from}
          atWeave={wa('p3-06', 0.42) - bB.from}
          atSplit={wa('p3-06', 0.8) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atBell={wa('p3-07', 0.45) - bC.from}
          atWait={wa('p3-07', 0.85) - bC.from}
          atReWeld={wa('p3-08', 0.6) - bC.from}
          atBurst={wa('p3-08', 0.85) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3BusyLockAblation;
