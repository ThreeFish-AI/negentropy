/** P4 重启之后（p4-01..p4-09，4 镜）——分镜 4-A / 4-B / 4-C / 4-D。
 *
 *  叙事链：4-A 进程边界框全景（拉远降压重锚——@pushIn 负增量）：一枚进程边界
 *  框罩住四层链与环体（框内=运行中的程序）→ p4-01「程序关掉」词落位进程框整体
 *  熄灭一拍（框内三卡随熄）〔M-005〕、「任务还活着吗」词落位框外磁盘文件仍
 *  发光（答案先给一半——发光即存活）→ p4-02「写进磁盘的，重启恢复」词落位写盘
 *  开关联线至框外磁盘、「只在内存的，一关就没」词落位另一任务签随框熄灭淡出
 *  （两档命运同帧对照）→ p4-03「活在进程里」词落位判时卡与进程框间一条生命线
 *  亮起（框熄=线断的预演）、「运行中的那个程序」词落位框缘一枚运行徽章呼吸
 *  一拍 → 4-B 停机时间轴：p4-04「只是任务定义」词落位磁盘文件旁「定义」小签
 *  亮出〔M-005〕、「一个也不补」词落位停机区间两枚到点标记相继划灰弃置（全程
 *  无回拨箭头）→ p4-05「像纸质日程本」词落位日程本帧一闪（A#6 落锚 ≤2s 即收）、
 *  「没人翻开本子」词落位日程本合页静止一拍 → p4-06「进程活着就照常跑」词落位
 *  重启线后下一匹配分钟点亮、环体缩微复亮转半圈 → 4-C 生产对照窗：p4-07 归属
 *  句词落位对照窗自下方升起（教学→生产的层切换事件）〔M-005〕、「一共三个」
 *  词落位建／列／删三卡 stagger 点亮（可数=3）→ p4-08「最多挂五十个」词落位
 *  五十格刻度尺整幅铺开、格位逐格点亮至满格基线（基线标尺）、「满七天，自动
 *  过期」词落位七天倒计时条自满格开始走（重音镜——双数字标尺同帧落定）→
 *  4-D 七天防线 punch：p4-09「没人认领」词落位周期任务签悬在条上（悬空位、
 *  无人接手）〔M-005〕、「悄悄烧钱」词落位费用刻度无声爬升、倒计时条同步烧蚀
 *  （静默烧蚀——无提示音无警报闪光，以静写险）、句尾余拍内条烧尽、任务签自动
 *  出列退场（口播无「烧尽」词锚——防线的具象终态，出列即「防住了」）。
 *
 *  空间契约：框内/框外明暗分工恒定（框内可熄、磁盘恒发光）、两档任务签同帧
 *    对照、「写盘」开关高亮可辨（回指）；停机区间到点标记有划灰轨迹（弃置
 *    可读）、重启后只亮「下一个」匹配分钟（不回补）、日程本帧 ≤2s；三卡可数
 *    （3）、刻度尺格位与口播数字一致（50）、倒计时条满格起点可读；烧蚀全程
 *    静默、费用刻度单调爬升、出列发生在条烧尽后。
 *  红线落实：框外磁盘熄灭禁（逆 durable 语义）、内存档任务签在框熄后残留禁；
 *    回拨/补跑箭头禁（逆「一个也不补」）、停机区间任务亮起禁；格位数字失真禁、
 *    倒计时条提前走完禁（过期演示留 4-D）；烧钱伴随警报红闪禁（逆「悄悄」）、
 *    任务签出列提前于七天禁；词落位 = wa(id,f)；y≥56 / bottom≥176；官方数字
 *    带现行口径日期锚角标。
 *
 *  承接登记：3-C→4-A SceneFade＋拉远重锚（承 ep2 3-C→4-A、ep11 同款判例），
 *    环体以〔M-001〕同形签名跨幕（暗态轮廓恒定）；4-D→5-A SceneFade＋环体
 *    定格收束主体回归（镜间身份恒常，非 morph——承 ep2 4-D→5-A 判例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  CapacityRuler,
  CronFieldCard,
  DowntimeAxis,
  LoopRing,
  NumberedCard,
  ProcessFrame,
  TaskChip,
  TimeChain,
  WeekBar,
} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 4-A 进程边界框全景：框内熄灭 / 框外磁盘发光 / 两档命运对照 ────────────────

/** 4-A 全局位：进程框罩链与环体（框内）/ 磁盘文件框外右 / 写盘开关连线 */
const FRAME_4A = {x: 120, y: 110, w: 1020, h: 700} as const;
const CHAIN_4A = {x: 620, y: 190, w: 440, cardH: 130, gap: 22} as const;
const RING_4A = {x: 190, y: 300, size: 400} as const;
const DISK_4A = {x: 1360, y: 280} as const;

/** 磁盘文件小图（框外持久层——恒发光；durable 语义载体） */
const DiskFile: React.FC<{x: number; y: number; size: number; litP: number; glowP?: number}> = ({x, y, size, litP, glowP = 0}) => {
  const lit = clamp01(litP);
  const glow = clamp01(glowP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity: lit}}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{filter: glow > 0.05 ? `drop-shadow(0 0 ${14 * glow}px ${withAlpha(theme.ok, 0.55)})` : 'none'}}>
        <rect x={30} y={44} width={140} height={112} rx={14} fill={withAlpha(theme.panel, 0.97)} stroke={withAlpha(theme.ok, 0.85)} strokeWidth={4} />
        <circle cx={100} cy={100} r={30} fill="none" stroke={withAlpha(theme.ok, 0.7)} strokeWidth={3.5} />
        <circle cx={100} cy={100} r={8} fill={withAlpha(theme.ok, 0.7)} />
        <rect x={52} y={58} width={60} height={8} rx={4} fill={withAlpha(theme.dim, 0.5)} />
        <rect x={52} y={72} width={40} height={8} rx={4} fill={withAlpha(theme.dim, 0.35)} />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: size - 8, textAlign: 'center', fontFamily: theme.mono, fontSize: 15, color: theme.ok, whiteSpace: 'nowrap'}}>{'磁盘 · durable'}</div>
    </div>
  );
};

const FourA: React.FC<{atZoomOut: number; atOff: number; atDisk: number; atWire: number; atVanish: number; atLife: number; atBadge: number}> = ({atZoomOut, atOff, atDisk, atWire, atVanish, atLife, atBadge}) => {
  const frame = useCurrentFrame();
  // 拉远降压重锚（@pushIn 负增量——自 P3 峰值拉远：scale 1.22→1）
  const pushTf = usePushIn(atZoomOut, {scale: -0.18, dur: DUR.f6});
  // 进程框整体熄灭一拍（p4-01「程序关掉」——框内三卡随熄、框体轮廓驻留）
  const off = clamp01(progress(frame, atOff, 18));
  // 框外磁盘仍发光（p4-01 尾「任务还活着吗」——答案先给一半：发光即存活）
  const diskLit = clamp01(progress(frame, atDisk, 14));
  // 写盘开关联线至框外磁盘（p4-02「写进磁盘的，重启恢复」）
  const wire = clamp01(progress(frame, atWire, 18));
  // 内存档任务签随框熄灭淡出（p4-02「只在内存的，一关就没」——两档命运同帧对照）
  const vanish = clamp01(progress(frame, atVanish, 16));
  // 生命线（p4-03「活在进程里」——判时卡与框间；框熄=线断的预演）
  const life = clamp01(progress(frame, atLife, 16));
  // 运行徽章呼吸（p4-03「运行中的那个程序」——框缘）
  const badge = clamp01(progress(frame, atBadge, DUR.f4));
  const breathe = 0.5 + 0.5 * Math.sin(frame / 9);
  return (
    <AbsoluteFill style={{transform: pushTf}}>
      {/* 进程边界框（罩住链与环体——框内=运行中的程序） */}
      <ProcessFrame x={FRAME_4A.x} y={FRAME_4A.y} w={FRAME_4A.w} h={FRAME_4A.h} litP={clamp01(progress(frame, 4, DUR.f5))} offP={off} badgeP={badge} badgeBreathe={breathe} lifeP={life} />
      {/* 环体〔M-001〕（框内左——随框熄灭、暗态轮廓恒定跨幕签名） */}
      <div style={{position: 'absolute', left: RING_4A.x, top: RING_4A.y, opacity: 1 - 0.66 * off}}>
        <LoopRing size={RING_4A.size} nodes={[]} showExit={false} />
      </div>
      {/* 四层链（框内右——三卡随框熄灭：判时/队列/交付；执行接驳接环体） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: 1 - 0.66 * off}}>
        <TimeChain x={CHAIN_4A.x} y={CHAIN_4A.y} w={CHAIN_4A.w} cardH={CHAIN_4A.cardH} gap={CHAIN_4A.gap} outlineP={1} lits={[1, 1, 1, 1]} />
      </div>
      {/* 磁盘文件（框外右——恒发光：durable 持久层；写盘开关联线落点） */}
      <DiskFile x={DISK_4A.x} y={DISK_4A.y} size={190} litP={diskLit} glowP={diskLit * (0.6 + 0.4 * Math.sin(frame / 11))} />
      {/* 写盘开关联线（任务卡双开关 → 框外磁盘——回指 2-A 伏笔位；开关高亮） */}
      {wire > 0.03 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path d={`M ${CHAIN_4A.x + 60} ${CHAIN_4A.y + CHAIN_4A.cardH * 3 + 90} Q ${DISK_4A.x - 140} ${CHAIN_4A.y + 520} ${DISK_4A.x + 20} ${DISK_4A.y + 60}`} fill="none" stroke={withAlpha(theme.ok, 0.8)} strokeWidth={4} strokeDasharray="12 9" pathLength={1} strokeDashoffset={1 - wire} />
        </svg>
      ) : null}
      {/* 两档任务签（同帧对照：写盘档（磁盘旁·常亮）/ 内存档（框内·随框熄灭淡出）） */}
      <div style={{position: 'absolute', left: DISK_4A.x - 60, top: DISK_4A.y + 230}}>
        <TaskChip x={0} y={0} label={'写盘 · 留'} litP={wire} />
      </div>
      <div style={{position: 'absolute', left: CHAIN_4A.x + 500, top: CHAIN_4A.y + 40, opacity: (1 - 0.66 * off) * (1 - vanish)}}>
        <TaskChip x={0} y={0} label={'内存 · 没'} litP={clamp01(progress(frame, atOff + 4, 10))} tone="dim" />
      </div>
      {/* 写盘开关高亮（任务卡双开关缩微——durable 角标回指 2-A） */}
      <div style={{position: 'absolute', left: CHAIN_4A.x - 40, top: CHAIN_4A.y + CHAIN_4A.cardH * 3 + 60, opacity: 1 - 0.4 * off}}>
        <CronFieldCard x={0} y={0} w={170} h={150} litP={0.9} slotPs={[0, 0, 0, 0, 0]} hintP={0} switchPs={[0.4, 1]} diskHLP={wire} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'durable / session-only · .scheduled_tasks.json'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 停机时间轴：划灰弃置 + 日程本帧 + 重启后复亮 ─────────────────────────

const AXIS_4B = {x: 240, y: 200} as const;
const DISK_4B = {x: 200, y: 620} as const;
const RING_4B = {x: 640, y: 580, size: 210} as const;

/** 日程本小图（A#6 落锚——纸本计划；合页静止=没人翻开） */
const PlannerBook: React.FC<{x: number; y: number; litP: number; shutP: number}> = ({x, y, litP, shutP}) => {
  const lit = clamp01(litP);
  const shut = clamp01(shutP);
  if (lit <= 0.02) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 300, height: 200, opacity: lit}}>
      <svg width={300} height={200} viewBox="0 0 300 200">
        {/* 本体（摊开 → 合页静止：右半页 rotateX 收合的近似 = 透明度+位移收合） */}
        <rect x={30} y={30} width={110} height={140} rx={9} fill={withAlpha(theme.panel, 0.96)} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3.5} />
        <rect
          x={146}
          y={30 + shut * 26}
          width={110 - shut * 34}
          height={140 - shut * 34}
          rx={9}
          fill={withAlpha(theme.panel, 0.96)}
          stroke={withAlpha(theme.dim, 0.7)}
          strokeWidth={3.5}
          opacity={1 - 0.25 * shut}
        />
        <line x1={143} y1={30} x2={143} y2={170} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} />
        {[0, 1, 2].map((r) => (
          <line key={`pl${r}`} x1={48} y1={62 + r * 32} x2={122} y2={62 + r * 32} stroke={withAlpha(theme.dim, 0.45)} strokeWidth={2.5} />
        ))}
        <text x={91} y={192} textAnchor="middle" fontFamily={theme.mono} fontSize={13} fill={theme.dim}>
          计划跨年都在
        </text>
      </svg>
    </div>
  );
};

const FourB: React.FC<{atSweep: number; atDef: number; atDrop1: number; atDrop2: number; atBook: number; atShut: number; atRestart: number; atNext: number}> = ({atSweep, atDef, atDrop1, atDrop2, atBook, atShut, atRestart, atNext}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 时间轴推进（自左向右——sweep 全程线性）
  const sweep = clamp01(progress(frame, atSweep, 130));
  // 停机区间灰掉 + 两枚到点标记相继划灰弃置
  const gray = clamp01(progress(frame, atDrop1 - 16, 14));
  const drop1 = clamp01(progress(frame, atDrop1, 12));
  const drop2 = clamp01(progress(frame, atDrop2, 12));
  // 「定义」小签（p4-04「只是任务定义」——是定义、不是执行）
  const defSign = clamp01(progress(frame, atDef, DUR.f4));
  // 日程本帧一闪（≤2s 即收）+ 合页静止一拍
  const book = Math.min(clamp01(progress(frame, atBook, 10)), 1 - clamp01(progress(frame, atBook + 46, 10)));
  const shut = clamp01(progress(frame, atShut, 12));
  // 重启线竖起 + 下一匹配分钟点亮 + 环体缩微复亮转半圈
  const restart = clamp01(progress(frame, atRestart - 8, 12));
  const next = clamp01(progress(frame, atNext, 14));
  const relap = clamp01(progress(frame, atNext + 4, 44));
  const dotPos = next > 0.3 ? (relap * 0.5) % 1 : undefined;
  return (
    <AbsoluteFill>
      {/* 停机时间轴（横贯——sched 系时间感载体；划灰弃置 danger、下一分钟 ok） */}
      <DowntimeAxis x={AXIS_4B.x} y={AXIS_4B.y} w={1440} litP={clamp01(progress(frame, 4, DUR.f5))} sweepP={sweep} grayP={gray} dropPs={[drop1, drop2]} restartP={restart} nextP={next} />
      {/* 磁盘 + 「定义」小签（是定义、不是执行——存档面恒在） */}
      <DiskFile x={DISK_4B.x} y={DISK_4B.y} size={140} litP={1} glowP={0.5 + 0.3 * Math.sin(frame / 12)} />
      {defSign > 0.03 ? (
        <div style={{position: 'absolute', left: DISK_4B.x + 170, top: DISK_4B.y + 56, opacity: defSign}}>
          <span style={{padding: '5px 16px', borderRadius: 8, border: `2.5px solid ${withAlpha(theme.ok, 0.8)}`, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.ok, background: withAlpha(theme.panel, 0.95), whiteSpace: 'nowrap'}}>{'只是定义'}</span>
        </div>
      ) : null}
      {/* 日程本帧（一闪即收——A#6 落锚；合页=没人翻开） */}
      <PlannerBook x={1180} y={190} litP={book} shutP={shut} />
      {/* 环体缩微复亮（重启线后转半圈——活进程的回报；暗态轮廓跨幕恒定） */}
      <div style={{position: 'absolute', left: RING_4B.x, top: RING_4B.y, opacity: 0.35 + 0.6 * next}}>
        <LoopRing size={RING_4B.size} nodes={[]} showExit={false} dotProgress={dotPos} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'停机错过 · 不补跑'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 生产对照窗：三工具卡 + 五十格刻度尺 + 七天倒计时条 ────────────────────

const TOOLS_4C = {x: 300, y: 200} as const;
const RULER_4C = {x: 370, y: 520} as const;
const WEEK_4C = {x: 470, y: 660} as const;

const FourC: React.FC<{atWindow: number; atTools: number; atCells: number; atDays: number}> = ({atWindow, atTools, atCells, atDays}) => {
  const frame = useCurrentFrame();
  // 生产对照窗自下方升起（教学→生产的层切换事件）
  const winLit = clamp01(progress(frame, atWindow, 18));
  // 建／列／删三卡 stagger 点亮（可数=3——NumberedCard stagger）
  const tPs = [0, 1, 2].map((i) => clamp01(progress(frame, atTools + i * 9, DUR.f4)));
  // 五十格刻度尺整幅铺开 + 逐格点亮至满格基线
  const fill = clamp01(progress(frame, atCells, 14));
  const cells = clamp01(progress(frame, atCells + 8, 50));
  // 七天倒计时条自满格开始走（重音镜——双数字标尺同帧落定）
  const days = clamp01(progress(frame, atDays, 16));
  const walk = 1 - days * 0.12;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: winLit, transform: `translateY(${(1 - winLit) * 40}px)`}}>
        {/* 窗头（生产对照——归属句视觉层；工况签） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          {'生产对照'}
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 14}}>{'source-checked'}</span>
        </div>
        {/* 三工具卡（建／列／删——中性件中性描边；可数=3） */}
        <div style={{position: 'absolute', left: TOOLS_4C.x, top: TOOLS_4C.y, display: 'flex', gap: 40}}>
          {[
            {n: 1, t: '建'},
            {n: 2, t: '列'},
            {n: 3, t: '删'},
          ].map((c, i) => (
            <div key={`tc${c.n}`} style={{opacity: tPs[i]}}>
              <NumberedCard index={c.n} label={c.t} active={tPs[i] > 0.4} sub={['CronCreate', 'CronList', 'CronDelete'][i]} width={190} accent={theme.text} />
            </div>
          ))}
        </div>
        {/* 五十格上限刻度尺（中性描边＋警示红满格基线点缀——不占双主题色） */}
        <CapacityRuler x={RULER_4C.x} y={RULER_4C.y} w={1180} litP={1} fillP={fill} cellsP={cells} />
        {/* 七天倒计时条（中性＋警示红点缀；自满格开始走） */}
        <WeekBar x={WEEK_4C.x} y={WEEK_4C.y} w={980} litP={clamp01(progress(frame, atDays - 4, 12))} walkP={walk} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'CronCreate / CronList / CronDelete · 50 / 会话 · 7 天 / 周期 · 官方口径 2026-10'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D 七天防线 punch：无人认领烧钱 + 条烧尽出列 ─────────────────────────────

const WEEK_4D = {x: 470, y: 430} as const;

const FourD: React.FC<{atHang: number; atBurn: number; atOut: number}> = ({atHang, atBurn, atOut}) => {
  const frame = useCurrentFrame();
  // 无人认领任务签悬空（p4-09「没人认领」——悬空位、无人接手）
  const hang = clamp01(progress(frame, atHang, 14));
  // 悄悄烧钱：费用刻度无声爬升 + 条身同步烧蚀（静默——无警报元素）
  const burn = clamp01(progress(frame, atBurn, 46));
  const walk = 1 - burn * 0.88;
  const fee = burn;
  // 句尾余拍：条烧尽、任务签自动出列退场（无词锚——span 尾自动推进）
  const out = clamp01(progress(frame, atOut, 20));
  return (
    <AbsoluteFill>
      {/* 倒计时条特写（烧蚀推进——以静写险：费用刻度单调爬升、全程静默） */}
      <WeekBar x={WEEK_4D.x} y={WEEK_4D.y} w={980} h={64} litP={1} walkP={Math.max(0.12, walk - out * 0.12)} burnP={burn} feeP={fee} hangP={hang} outP={out} />
      {/* 烧尽读数（右端角注——出列即「防住了」，不设词锚） */}
      {out > 0.5 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 620, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.danger, opacity: clamp01(out - 0.5), whiteSpace: 'nowrap'}}>
          {'过期 · 自动出列'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'7 天 · 无人认领 · 静默过期'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4DurableTimeline: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-06');
  const bC = w('p4-07', 'p4-08');
  const bD = w('p4-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atZoomOut={wa('p4-01', 0.05) - bA.from}
          atOff={wa('p4-01', 0.35) - bA.from}
          atDisk={wa('p4-01', 0.7) - bA.from}
          atWire={wa('p4-02', 0.28) - bA.from}
          atVanish={wa('p4-02', 0.75) - bA.from}
          atLife={wa('p4-03', 0.3) - bA.from}
          atBadge={wa('p4-03', 0.75) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atSweep={4}
          atDef={wa('p4-04', 0.28) - bB.from}
          atDrop1={wa('p4-04', 0.8) - bB.from}
          atDrop2={wa('p4-04', 0.94) - bB.from}
          atBook={wa('p4-05', 0.15) - bB.from}
          atShut={wa('p4-05', 0.6) - bB.from}
          atRestart={wa('p4-06', 0.5) - bB.from}
          atNext={wa('p4-06', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atWindow={wa('p4-07', 0.5) - bC.from}
          atTools={wa('p4-07', 0.9) - bC.from}
          atCells={wa('p4-08', 0.5) - bC.from}
          atDays={wa('p4-08', 0.78) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="4-D">
        <FourD
          atHang={wa('p4-09', 0.45) - bD.from}
          atBurn={wa('p4-09', 0.8) - bD.from}
          atOut={span('p4-09') - 26}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4DurableTimeline;
