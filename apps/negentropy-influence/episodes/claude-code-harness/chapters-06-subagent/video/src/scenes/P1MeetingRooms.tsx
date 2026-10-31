/** P1 一间新会议室（p1-01..p1-10，4 镜）——分镜 1-A / 1-B / 1-C / 1-D。
 *
 *  叙事链：1-A 两间会议室剖面首亮（Map-First 全景坐标锚 + @pushIn 负增量拉远）：
 *  左主会场钢蓝（0-A 面板收拢为一室剖面、消息条整齐）、右紫室空置弹出、单向
 *  通道右→左、主会场内工具表纵列（五件 + 新卡位）、环体〔M-001〕缩悬主会场上角
 *  ——「一间会议室」词落位右室弹出、「只把结论带回」结论小卡沿通道预演飞一个
 *  来回、「多了一件」工具表第六卡（task）亮出 → 1-B 紫室内部装配特写（承后续
 *  CU 机位）：全新空消息列表放入、任务描述卡落底独占、SUB_SYSTEM 标签贴上、
 *  同形小环体亮起转动（同色同描边小尺度——同机制同形的身份线索）、五件工具卡
 *  stagger 入位（次序=口播列举）→ 1-C 工具列特写：第六位空槽虚线呼吸高亮
 *  （缺席轮廓）+ 单层封条（递归一层）+ 「三十轮」计数环 1→30 亮出、到点顶格
 *  红线一闪 → 1-D 拉回剖面（@pushIn 回流聚焦）：紫室消息条快速堆高→整层淡出
 *  （空态首复现）、结论卡沿通道飞回落成两条（钢蓝落账确认绿各一闪）、环体
 *  「执行」段外侧「派活→回流」支线短弧亮起 + 脉冲一次（主环本体不动）。
 *
 *  空间契约：主会场左/紫室右全片恒定方位、通道单向右→左、紫室空态三现同形
 *  （1-B 末 / 1-D 末 / 2-C 末互证）；小环体与主环同色同描边（身份线索两项）；
 *  第六卡不提前于 p1-02 亮、五卡入位次序=口播次序、空槽为唯一虚线元素、
 *  计数环刻度上限 30。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；task / SUB_SYSTEM /
 *  SUB_TOOLS / range(30) 只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CountRing, LoopRing, MeetingRooms, RoomMessageList, ToolSlotRow, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 剖面全局位（1-A/1-D/2-A/3-A 共用——全片主装置世界坐标锚） */
const STAGE = {x: 230, y: 210, w: 1460, h: 560} as const;

// ── 1-A 剖面首亮：右室弹出 + 通道预演 + 第六卡 ──────────────────────────

const OneA: React.FC<{atPush: number; atRoom: number; atFly: number; atSix: number; atSixPop: number}> = ({
  atPush,
  atRoom,
  atFly,
  atSix,
  atSixPop,
}) => {
  // @pushIn 负增量（动机：装置首亮拉远、读全两室拓扑）
  const pull = usePushIn(atPush, {scale: -0.05, dur: DUR.f6});
  // 「一间会议室」右室弹出成形
  const room = useProgress(atRoom, DUR.f5, 'decelerate');
  // 「只把结论带回」结论小卡沿通道预演飞一个来回（0→1 去程、1→2 回程）
  const flyRaw = useProgress(atFly, DUR.f6 + DUR.f5, 'linear');
  const fly = flyRaw <= 1 ? flyRaw : 2 - flyRaw;
  // 「多了一件」第六卡亮出（task——本集机制入口）+ 弹出脉冲
  const six = useProgress(atSix, DUR.f4);
  const sixPop = useImpulse({at: atSixPop, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '50% 46%'}}>
        <MeetingRooms
          x={STAGE.x}
          y={STAGE.y}
          w={STAGE.w}
          h={STAGE.h}
          rightOpen={room}
          leftBars={4}
          counterVal={4}
          ringLit={1}
          flyReturn={fly}
          taskLit={six}
        />
      </div>
      {/* 第六卡 task 角标注（弹出脉冲——派活的工具，本集机制入口） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.x + 150,
          top: STAGE.y + 262,
          padding: '4px 12px',
          borderRadius: 7,
          border: `2px solid ${theme.mech}`,
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.mech,
          whiteSpace: 'nowrap',
          opacity: six,
          boxShadow: sixPop > 0.05 ? `0 0 ${20 * sixPop}px ${withAlpha(theme.mech, 0.5)}` : 'none',
        }}
      >
        {'task · 派活'}
      </div>
      {/* 通道单向注（角标性质） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.8}}>
        {'单向通道 · 右 → 左'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 紫室内部装配特写：空列表 / 描述卡 / 标签 / 小环体 / 五工具卡 ──────

const OneB: React.FC<{atList: number; atDesc: number; atRing: number; atTag: number; atTools: number}> = ({
  atList,
  atDesc,
  atRing,
  atTag,
  atTools,
}) => {
  const frame = useCurrentFrame();
  // 全新空消息列表自上而下放入
  const list = useProgress(atList, DUR.f5, 'decelerate');
  // 任务描述卡落底独占
  const desc = useProgress(atDesc, DUR.f5, 'decelerate');
  // 同形小环体亮起转动（同款陶土橙描边、尺度小于主环——身份线索两项保持）
  const ring = useProgress(atRing, DUR.f5);
  const dot = useRingDot(2.5, atRing);
  // 「独立的系统提示」标签贴上（仅四字不成句）
  const tag = useProgress(atTag, DUR.f4);
  // 五件工具卡 stagger 入位（次序=口播列举次序：跑/读/写/改/找）
  const five = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atTools + i * 6, DUR.f4)));
  return (
    <AbsoluteFill>
      {/* 室内消息列表面板（空态基准形——1-D/2-C 空态三现之首） */}
      <div style={{position: 'absolute', left: 220, top: 150, opacity: 0.35 + 0.65 * list, transform: `translateY(${(1 - list) * -36}px)`}}>
        <RoomMessageList x={0} y={0} w={720} h={660} lit={1} tagLit={tag} descLit={desc} msgs={0} counter={0} />
      </div>
      {/* 小环体（子代理自己的循环——同色同描边、尺度小于主环） */}
      <div style={{position: 'absolute', left: 1010, top: 210, opacity: ring}}>
        <LoopRing size={230} draw={ring} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      <div style={{position: 'absolute', left: 1010, top: 460, width: 230, textAlign: 'center', fontFamily: theme.sans, fontSize: 19, color: theme.dim, opacity: ring}}>
        {'自己的循环'}
      </div>
      {/* 五件工具卡（SUB_TOOLS 角标——stagger 入位） */}
      <div style={{position: 'absolute', left: 1010, top: 530}}>
        <ToolSlotRow x={0} y={0} w={330} cardH={44} gap={7} five={five} sixMode="empty" slotLit={0} />
      </div>
      <div style={{position: 'absolute', left: 1385, top: 530, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: five[4]}}>
        {'SUB_TOOLS'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'装配 · 新会议室内部'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 工具列特写：空槽虚线 + 单层封条 + 30 轮计数环 ────────────────────

const OneC: React.FC<{atSlot: number; atSeal: number; atTicks: number; atTop: number}> = ({atSlot, atSeal, atTicks, atTop}) => {
  const frame = useCurrentFrame();
  // 空槽虚线框呼吸高亮（「唯独没有」——与主会场 task 卡同形的缺席轮廓）
  const breathe = 0.55 + 0.45 * Math.sin(frame / 6);
  const slotLit = useProgress(atSlot, DUR.f4) * breathe;
  // 单层封条小标（「锁死在一层」——递归一层的具象）
  const seal = useProgress(atSeal, DUR.f4);
  // 计数环刻度 1→30 亮出（数据本体：读数钳制、永不越 30）
  const count = 30 * clamp01(progress(frame, atTicks, DUR.f6 + DUR.f4));
  // 到点顶格红线一闪
  const topFlash = useImpulse({at: atTop, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      {/* 工具列满幅（五卡纵列 + 第六位空槽——唯一虚线元素） */}
      <div style={{position: 'absolute', left: 300, top: 120}}>
        <ToolSlotRow x={0} y={0} w={430} cardH={96} gap={18} five={[1, 1, 1, 1, 1]} sixMode="empty" slotLit={slotLit} seal={seal} />
      </div>
      {/* 三十轮计数环（兜底预算——range(30) 角标） */}
      <div style={{position: 'absolute', left: 1180, top: 330}}>
        <CountRing cx={150} cy={150} r={140} lit={1} count={count} topFlash={topFlash} />
      </div>
      <div style={{position: 'absolute', left: 1180, top: 640, width: 300, textAlign: 'center', fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'range(30) · 到点即止'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'唯独没有 · 派活'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 拉回剖面：堆高→清空→回流两条 + 环体支线 ─────────────────────────

const OneD: React.FC<{atStack: number; atClear: number; atFly: number; atLand: number; atBranch: number; atPulse: number; atFreeze: number}> = ({
  atStack,
  atClear,
  atFly,
  atLand,
  atBranch,
  atPulse,
  atFreeze,
}) => {
  const frame = useCurrentFrame();
  // 紫室消息条快速堆高（内部过程）→ 整层同步淡出（「用完就清空」——空态首复现）
  const stack = clamp01(progress(frame, atStack, DUR.f5));
  const clear = useProgress(atClear, DUR.f5);
  const roomBars = 12 * stack * (1 - clear);
  // 结论卡沿通道飞回落成两条（@pushIn 回流聚焦）
  const push = usePushIn(atFly - DUR.f3, {scale: 0.04, dur: DUR.f6});
  const fly = clamp01(progress(frame, atFly, DUR.f6));
  const land = useProgress(atLand, DUR.f5);
  const landFlash = useImpulse({at: atLand + DUR.f3, dur: DUR.f5, peak: 1});
  // 环体「执行」段外侧支线短弧亮起（主环本体不动）+ 脉冲一次（「真跑一遍」钩子拍）
  const branch = useProgress(atBranch, DUR.f5);
  const branchPulse = useImpulse({at: atPulse, dur: DUR.f6, peak: 1});
  // 计数角标定格（钩子拍）
  const freeze = useProgress(atFreeze, DUR.f4);
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '38% 50%'}}>
        <MeetingRooms
          x={STAGE.x}
          y={STAGE.y}
          w={STAGE.w}
          h={STAGE.h}
          rightOpen={1}
          leftBars={4}
          leftAdd={land}
          leftAddFlash={landFlash}
          counterVal={2 * land}
          counterFlash={freeze}
          roomBars={roomBars}
          roomClear={clear}
          ringLit={1}
          ringDot={dot}
          branchLit={branch}
          branchPulse={branchPulse}
          channelFlow={fly}
          flyReturn={fly}
        />
      </div>
      {/* 支线注（角标——派活→回流） */}
      <div
        style={{
          position: 'absolute',
          left: STAGE.x + 585,
          top: STAGE.y + 118,
          fontFamily: theme.mono,
          fontSize: 14,
          color: theme.steel,
          whiteSpace: 'nowrap',
          opacity: branch,
        }}
      >
        {'派活 → 回流'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.75}}>
        {'跑完只交回一条结论'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1MeetingRooms: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-05');
  const bC = w('p1-06', 'p1-07');
  const bD = w('p1-08', 'p1-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atPush={0}
          atRoom={wa('p1-01', 0.42) - bA.from}
          atFly={wa('p1-01', 0.7) - bA.from}
          atSix={wa('p1-02', 0.44) - bA.from}
          atSixPop={wa('p1-02', 0.52) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atList={wa('p1-03', 0.42) - bB.from}
          atDesc={wa('p1-03', 0.72) - bB.from}
          atRing={wa('p1-04', 0.1) - bB.from}
          atTag={wa('p1-04', 0.48) - bB.from}
          atTools={wa('p1-05', 0.22) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atSlot={wa('p1-06', 0.08) - bC.from}
          atSeal={wa('p1-06', 0.6) - bC.from}
          atTicks={wa('p1-07', 0.26) - bC.from}
          atTop={wa('p1-07', 0.66) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="1-D">
        <OneD
          atStack={wa('p1-08', 0.1) - bD.from}
          atClear={wa('p1-09', 0.32) - bD.from}
          atFly={wa('p1-08', 0.2) - bD.from}
          atLand={wa('p1-08', 0.66) - bD.from}
          atBranch={wa('p1-09', 0.66) - bD.from}
          atPulse={wa('p1-10', 0.44) - bD.from}
          atFreeze={wa('p1-10', 0.6) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1MeetingRooms;
