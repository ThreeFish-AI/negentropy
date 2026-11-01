/** P2 岔口与关卡（p2-01..p2-10，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  Morph Continuity（1-C→2-A，头注明示）：同一主体＝走廊＋行进中的模型气泡。
 *  起止态：1-C 末帧调用舱特写、气泡升起点远岔口微光 → 2-A 首帧气泡载响应包
 *  沿走廊行至岔口、岔口放大成中景主体。中间态：行进过程走廊墙体描边、中线
 *  四拍、设施壁构成逐帧不变，仅景别推进。身份线索：恒定蓝墙体＋陶土橙中线
 *  （保两项）。何时不该 morph：行进跳帧或气泡重绘，回退 cut＋气泡入场。
 *
 *  叙事链：2-A 岔口判读台：开帧走廊全貌一拍（岔口位高亮视框——坐标锚），
 *  p2-01「唯一的岔口」词落位分叉口立起（全走廊仅此一叉的高亮视框一拍）〔M-005〕；
 *  p2-02「判据只有一条」词落位判读台亮出（角标 tool_use block）、「有没有工具
 *  调用块」词落位包内调用块形轮廓闪现；p2-03 正反双分支同帧演（判据正反同帧
 *  ——planning §三构图纪律）：「有」词落位调用块高亮→箭头直行进执行段（确认
 *  绿点亮）、「没有」词落位调用块空缺→箭头靠边进收尾轨（恒定蓝点亮）——两
 *  分支先后各演一遍并置对照；p2-04「没人推着谁走」词落位失配边界字幕条亮出
 *  （走廊全程零推送装置——画面即陈述）、「岔口也只此一个」词落位镜头拉半档
 *  见走廊前后皆直道（无第二叉的空间证明，重音镜）〔M-003〕→ 2-B 执行段三
 *  车道：p2-05「权限闸」词落位闸门落下（角标 PreToolUse · permission）〔M-005〕；
 *  p2-06「删掉整个项目的命令」词落位一枚危险命令卡飞向闸门→弹开（警示红描边
 *  ＋「问过」签弹出）、「越界路径」词落位第二枚越界卡同样弹开（两类危险各演
 *  一次）、「拦下问过」词落位两签并置定格（拦截语义）；p2-07「慢活」词落位
 *  一件慢活卡滑入后台轨（恒定蓝）、「占位卡」词落位一张占位卡回执先发回对话
 *  列（先回执语义）、「事后钩」词落位干完后小钩掠过输出条一拍（角标
 *  background task · PostToolUse）→ 2-C 拉远全景：p2-08「收尾钩」「统计」词落位
 *  统计位翻页记数一拍（无调用轮的收官演示，角标 Stop hooks）；p2-09「周围变厚」
 *  词落位设施厚圈整圈增亮一档＋字幕卡亮出、「循环没变」词落位中线细线四拍
 *  节拍照走一格（变与不变同帧对照，重音镜）〔M-003〕；p2-10「挂点表」词落位
 *  挂点图例带亮出（每槽一格）、「位置感」词落位图例框定格一拍（本集主装置
 *  命名帧）。
 *
 *  空间契约（安全带实算）：2-A 迷你走廊 90..230 / 判读台 300..550 底 550 /
 *  并置条底 612；2-B 三车道 236..750 底 750 / 角标底 800 / 回执落位底 ≤ 740；
 *  2-C 环体组 180..661 底 661 / 统计位 320..410 / 字幕卡底 760 / while True
 *  角标底 660 / 图例带 770..845 底 845——全部 ≤ 860、装置 y ≥ 90。红线落实：
 *  直行＝确认绿/靠边＝恒定蓝恒定、两分支演示次序＝口播次序（先有后无）、
 *  全程零推送/牵引元素（失配边界守法）、第二分叉禁入镜、字幕条文字不成句、
 *  三车道 lane 语义恒定（拦红/直绿/后台蓝）、危险卡有弹开轨迹、危险卡过闸禁、
 *  占位卡先于结果回（先回执是机制红线）、后台轨用蓝不用绿、事后钩干完才钩、
 *  中线细线与 0-A 建锚逐像素同款、厚圈只增亮不变形、图例带＝槽位一格一物、
 *  环体随设施增厚变粗禁（X-001 逆旁白）、while True 只进小角标。词落位 =
 *  wa(id,f)。
 *
 *  承接登记：2-C→3-A morph（同一主体＝环体/走廊双态——推近回走廊可行走视角，
 *  展开的逆过程；详见 P3OneRealInput 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CorridorWalk, ForkDesk, LaneTrack, LoopRing, SlotRail, WhileTrueCard, ease} from '../components/motifs';
import {clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 2-A 岔口判读台：走廊全貌坐标锚 + 判据 + 正反双分支同帧 ──────────────────

/** 2-A 迷你走廊（全貌坐标锚）：y 90..230、中线 160、岔口位右端 */
const MINI = {x: 0, y: 90, w: 1920, h: 140} as const;
const MINI_MID = 160;
const FORK_X = 1660;

const TwoA: React.FC<{
  atTravel: number;
  atFrame: number;
  atDesk: number;
  atBlock: number;
  atYes: number;
  atNo: number;
  atBoth: number;
  atStrip: number;
  atPull: number;
}> = ({atTravel, atFrame, atDesk, atBlock, atYes, atNo, atBoth, atStrip, atPull}) => {
  const frame = useCurrentFrame();
  // 气泡载响应包沿走廊行至岔口（morph 行进段——走廊构成不变仅景别推进）
  const travel = ease(clamp01(progress(frame, atTravel, 26)));
  const bx = 120 + travel * (FORK_X - 120);
  // 岔口高亮视框（一拍即收——impulse 锁存：sin 包络起 0 归 0）
  const frameP = Math.sin(Math.PI * clamp01(progress(frame, atFrame, 16)));
  // 判读台亮出 + 调用块轮廓闪现
  const deskP = ease(clamp01(progress(frame, atDesk, 16)));
  const blockFlash = Math.sin(Math.PI * clamp01(progress(frame, atBlock, 12)));
  // 正反双分支：先「有」后「无」各演一遍 → 并置对照定格
  const yes = ease(clamp01(progress(frame, atYes, 14)));
  const no = ease(clamp01(progress(frame, atNo, 14)));
  const both = clamp01(progress(frame, atBoth, 14));
  // 失配边界字幕条 + 拉半档（走廊前后皆直道的空间证明）
  const strip = clamp01(progress(frame, atStrip, 12));
  const pull = ease(clamp01(progress(frame, atPull, 22)));
  // 演示态：「有」段块实+热；「无」段块空缺（blockP 二值切换，中途无插值灰度）
  const blockSolid = no > 0.3 ? 0 : Math.max(blockFlash, yes);
  const blockHot = no > 0.3 ? 0 : yes;
  const goP = no > 0.3 ? 0.25 : yes;
  const sideP = no;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.06 * pull})`, transformOrigin: '960px 430px'}}>
        {/* 迷你走廊全貌（坐标锚——恒定蓝墙体+陶土橙中线） */}
        <CorridorWalk x={MINI.x} y={MINI.y} w={MINI.w} h={MINI.h} t={frame} cells={Array.from({length: 18}, () => 0.32)} />
        {/* 行进气泡（载响应包——沿中线行至岔口） */}
        <div
          style={{
            position: 'absolute',
            left: bx - 40,
            top: MINI_MID - 24,
            width: 80,
            height: 48,
            borderRadius: 13,
            border: `3px solid ${theme.core}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.core,
            whiteSpace: 'nowrap',
          }}
        >
          响应包
        </div>
        {/* 岔口位（右端——高亮视框一拍 + 分叉微形） */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path d={`M ${FORK_X - 120} ${MINI_MID} L ${FORK_X} ${MINI_MID - 34}`} fill="none" stroke={withAlpha(theme.loop, 0.85)} strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${FORK_X - 120} ${MINI_MID} L ${FORK_X} ${MINI_MID + 34}`} fill="none" stroke={withAlpha(theme.loop, 0.5)} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="9 7" />
          {frameP > 0.05 ? (
            <g>
              <circle cx={FORK_X} cy={MINI_MID} r={26} fill="none" stroke={theme.loop} strokeWidth={3} opacity={frameP} />
              <circle cx={FORK_X} cy={MINI_MID} r={9} fill={theme.loop} opacity={frameP} />
            </g>
          ) : null}
          {/* 拉半档：走廊前后皆直道（两端直行微光——无第二叉的空间证明） */}
          {pull > 0.3 ? (
            <g opacity={(pull - 0.3) / 0.7}>
              <path d="M 150 106 L 60 106" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3.5} strokeLinecap="round" />
              <path d="M 60 106 L 74 98 M 60 106 L 74 114" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3.5} strokeLinecap="round" />
              <path d="M 1770 106 L 1860 106" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3.5} strokeLinecap="round" />
              <path d="M 1860 106 L 1846 98 M 1860 106 L 1846 114" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3.5} strokeLinecap="round" />
            </g>
          ) : null}
        </svg>
        {/* 岔口判读台（中景主体——响应包展开位 + 双分支） */}
        <div style={{position: 'absolute', left: 660, top: 300}}>
          <ForkDesk
            x={0}
            y={0}
            w={600}
            h={250}
            frameP={frameP}
            deskP={deskP}
            blockP={blockSolid}
            blockHotP={blockHot}
            goP={goP}
            sideP={sideP}
            bothP={both}
          />
          {/* 判据角标（只进角标不口播） */}
          <div style={{position: 'absolute', right: 0, top: -34, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: deskP * 0.9}}>
            tool_use block
          </div>
        </div>
      </div>
      {/* 失配边界字幕条（驻安全带上方——走廊全程零推送装置的画面陈述） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 210,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: strip,
        }}
      >
        {'无人推送 · 岔口唯一'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 执行段三车道：权限闸弹开 / 直行 / 后台轨 + 占位卡回执 ────────────────

/** 三车道全局位（LaneTrack 默认）：lane①闸道 236..386 / lane②直行 452..582 / lane③后台 640..750 */
const DANGER_X = 1500;
const GATE_X = 375;

/** 危险命令卡（飞向闸门→弹开——有弹开轨迹红线） */
const DangerCard: React.FC<{y: number; flyP: number; bounceP: number; hot: number; label: string}> = ({y, flyP, bounceP, hot, label}) => {
  const fly = ease(clamp01(flyP));
  const bounce = ease(clamp01(bounceP));
  // 轨迹：自右飞向闸门 → 弹开坠回（弹开位移 = 向右上弹起再落）
  const tx = DANGER_X + (GATE_X - DANGER_X) * fly + bounce * 300;
  const ty = y - Math.sin(Math.PI * bounce) * 60;
  return (
    <div
      style={{
        position: 'absolute',
        left: tx - 90,
        top: ty - 26,
        width: 180,
        height: 52,
        borderRadius: 9,
        border: `3px solid ${hot > 0.3 ? theme.danger : withAlpha(theme.danger, 0.55)}`,
        background: withAlpha(theme.panel, 0.97),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.sans,
        fontSize: 17,
        fontWeight: 700,
        color: theme.danger,
        whiteSpace: 'nowrap',
        boxShadow: hot > 0.05 ? `0 0 ${18 * hot}px ${withAlpha(theme.danger, 0.55 * hot)}` : 'none',
        transform: `rotate(${bounce * 8}deg)`,
      }}
    >
      {label}
    </div>
  );
};

const TwoB: React.FC<{
  atGate: number;
  atD1: number;
  atB1: number;
  atD2: number;
  atB2: number;
  atSigns: number;
  atSlow: number;
  atReceipt: number;
  atHook: number;
}> = ({atGate, atD1, atB1, atD2, atB2, atSigns, atSlow, atReceipt, atHook}) => {
  const frame = useCurrentFrame();
  const gate = ease(clamp01(progress(frame, atGate, 16)));
  // 两枚危险卡（拦截 cue 前置：飞卡在句内前段起、弹开在词落位）
  const d1 = clamp01(progress(frame, atD1, 14));
  const b1 = ease(clamp01(progress(frame, atB1, 16)));
  const d2 = clamp01(progress(frame, atD2, 14));
  const b2 = ease(clamp01(progress(frame, atB2, 16)));
  const hot1 = Math.sin(Math.PI * clamp01(progress(frame, atB1, 10)));
  const hot2 = Math.sin(Math.PI * clamp01(progress(frame, atB2, 10)));
  // 「问过」两签并置定格
  const signs = clamp01(progress(frame, atSigns, 12));
  // 慢活卡滑入后台轨（恒定蓝——不占循环等待）
  const slow = ease(clamp01(progress(frame, atSlow, 22)));
  // 占位卡回执先发回对话列（先回执是机制红线——先于结果回）
  const receipt = ease(clamp01(progress(frame, atReceipt, 20)));
  // 干完后事后钩掠过输出条一拍（体量检查示意）
  const hook = Math.sin(Math.PI * clamp01(progress(frame, atHook, 14)));
  return (
    <AbsoluteFill>
      <LaneTrack gateP={gate} gateHotP={Math.max(hot1, hot2)} />
      {/* 危险卡两枚（一类一个：删库命令 / 越界路径——各演一次弹开） */}
      <DangerCard y={310} flyP={d1} bounceP={b1} hot={hot1} label="删除项目的命令" />
      <DangerCard y={310} flyP={d2} bounceP={b2} hot={hot2} label="越界路径" />
      {/* 「问过」两签并置定格（拦截语义——闸门侧） */}
      {signs > 0.02 ? (
        <div style={{position: 'absolute', left: GATE_X - 70, top: 400, display: 'flex', gap: 10, opacity: signs}}>
          {[0, 1].map((k) => (
            <div
              key={`qk${k}`}
              style={{
                padding: '4px 14px',
                borderRadius: 8,
                border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
                background: withAlpha(theme.panel, 0.98),
                fontFamily: theme.sans,
                fontSize: 16,
                fontWeight: 700,
                color: theme.danger,
                whiteSpace: 'nowrap',
                transform: `translateY(${(1 - signs) * -10}px)`,
              }}
            >
              问过
            </div>
          ))}
        </div>
      ) : null}
      {/* 常规件直行（确认绿——lane②方向流光） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line x1={200} y1={517} x2={1720} y2={517} stroke={withAlpha(theme.ok, 0.7)} strokeWidth={4} strokeDasharray="18 22" strokeDashoffset={-frame * 1.2} strokeLinecap="round" />
        {/* 慢活卡滑入后台轨（恒定蓝描边——旁侧慢道） */}
        {/* 事后钩（掠过输出条一拍） */}
        {hook > 0.05 ? (
          <path
            d={`M ${1500 - hook * 260} 668 q 20 -26 40 0`}
            fill="none"
            stroke={theme.loop}
            strokeWidth={4.5}
            strokeLinecap="round"
            opacity={hook}
          />
        ) : null}
      </svg>
      {/* 慢活卡（滑入后台轨） */}
      <div
        style={{
          position: 'absolute',
          left: 600 + slow * 620,
          top: 664,
          width: 170,
          height: 50,
          borderRadius: 9,
          border: `3px solid ${theme.loop}`,
          background: withAlpha(theme.panel, 0.97),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 17,
          fontWeight: 700,
          color: theme.loop,
          whiteSpace: 'nowrap',
          opacity: slow,
        }}
      >
        慢活
      </div>
      {/* 后台轨输出条（干完的输出——事后钩掠过对象） */}
      <div style={{position: 'absolute', left: 1500, top: 700, width: 220, height: 14, borderRadius: 7, background: withAlpha(theme.loop, 0.3)}} />
      {/* 占位卡回执（先发回对话列——对话列小位在 lane② 左端） */}
      <div
        style={{
          position: 'absolute',
          left: 160 + receipt * 0,
          top: 452 - receipt * 96,
          width: 150,
          height: 46,
          borderRadius: 9,
          border: `2.5px dashed ${withAlpha(theme.ok, 0.8)}`,
          background: withAlpha(theme.panel, 0.96),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 15,
          fontWeight: 700,
          color: theme.ok,
          whiteSpace: 'nowrap',
          opacity: receipt,
        }}
      >
        占位卡 · 回执
      </div>
      {/* 对话列小位（回执目的地——lane② 上方） */}
      <div style={{position: 'absolute', left: 140, top: 340, width: 190, height: 60, borderRadius: 10, border: `2.5px dashed ${withAlpha(theme.dim, 0.6)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
        对话列
      </div>
      {/* 三车道角标（只进角标） */}
      <div style={{position: 'absolute', left: 300, top: 780, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
        PreToolUse · permission
      </div>
      <div style={{position: 'absolute', left: 1300, top: 780, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
        background task · PostToolUse
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 拉远全景：环体 + 设施厚圈 + 收尾统计位 + while True 角标 + 挂点图例带 ──

/** 2-C 环体全局位：环心 (960,410)、size 460、槽圈 r 238 */
const RC = {x: 730, y: 180, size: 460} as const;
const RC_C = {cx: 960, cy: 410} as const;
const RC_SLOT_R = 238;

const TwoC: React.FC<{atStat: number; atThick: number; atCard: number; atStep: number; atLegend: number; atFreeze: number}> = ({
  atStat,
  atThick,
  atCard,
  atStep,
  atLegend,
  atFreeze,
}) => {
  const frame = useCurrentFrame();
  // @pushIn 负增量（拉远才见整圈全貌——厚与细的同帧对照；A-09 方向反转防线）
  const pull = usePushIn(0, {scale: -0.06, dur: 34});
  // 收尾钩统计位翻页记数（无调用轮的收官演示——离散跳格）
  const statP = clamp01(progress(frame, atStat, 12));
  const statN = Math.round(statP);
  // 厚圈增亮一档 + 字幕卡
  const thick = clamp01(progress(frame, atThick, 18));
  const card = clamp01(progress(frame, atCard, 14));
  // 中线四拍节拍照走一格（变与不变同帧对照——细线与 0-A 同款）
  const stepP = clamp01(progress(frame, atStep, 16));
  const stepIdx = Math.min(3, Math.floor(stepP * 4));
  // 挂点图例带（每槽一格）+ 定格一拍
  const legend = clamp01(progress(frame, atLegend, 16));
  const freeze = Math.sin(Math.PI * clamp01(progress(frame, atFreeze, 14)));
  // 槽位圈：上半圈已驻格全览（P1 三格亮 + 本幕全亮成厚圈）
  const litPs = Array.from({length: 18}, () => 1);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull, transformOrigin: '960px 460px'}}>
        <LoopRing size={RC.size} nodes={[]} showExit={false} dotProgress={(frame / 96) % 1} />
        {/* 中线四拍节拍照（走一格——循环没变的帧上证据） */}
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {[0, 1, 2, 3].map((k) => {
            const a = ((-90 + k * 90) * Math.PI) / 180;
            const px = RC_C.cx + (RC.size / 2 - 46) * Math.cos(a);
            const py = RC_C.cy + (RC.size / 2 - 46) * Math.sin(a);
            return <circle key={`bs${k}`} cx={px} cy={py} r={k === stepIdx ? 13 : 8} fill={theme.core} opacity={k === stepIdx ? 1 : 0.4} />;
          })}
        </svg>
        {/* 挂点槽圈（全亮成厚圈——只增亮不变形） */}
        <SlotRail cx={RC_C.cx} cy={RC_C.cy} r={RC_SLOT_R} n={18} outlineP={1} litPs={litPs} thickP={thick} />
        {/* 收尾钩统计位（角标 Stop hooks——翻页记数一拍） */}
        <div style={{position: 'absolute', left: 1380, top: 320, width: 260, opacity: 0.35 + 0.65 * statP}}>
          <div style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>收尾钩 · 统计</div>
          <div style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.loop, fontVariantNumeric: 'tabular-nums', marginTop: 6}}>
            {`${statN} 轮`}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', marginTop: 4, opacity: 0.85}}>Stop hooks</div>
        </div>
        {/* 字幕卡「周围变厚」（关键词压缩复述——承 ep19 3-C 判例） */}
        <div
          style={{
            position: 'absolute',
            left: 170,
            top: 690,
            padding: '10px 26px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.merge, 0.4 + 0.6 * card)}`,
            background: withAlpha(theme.panel, 0.96),
            fontFamily: theme.serif,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: card,
            transform: `translateY(${(1 - card) * 14}px)`,
          }}
        >
          周围变厚 · 循环没变
        </div>
        {/* while True 小角标（环体旁——契约允许的英文小角标） */}
        <div style={{position: 'absolute', left: 1240, top: 620, fontFamily: theme.mono, fontSize: 17, fontWeight: 700, color: theme.loop, whiteSpace: 'nowrap', opacity: 0.9}}>
          while True
        </div>
        {/* 挂点图例带（每槽一格——本集主装置命名帧） */}
        <div style={{position: 'absolute', left: 360, top: 772, width: 1200, opacity: legend}}>
          <div style={{display: 'flex', gap: 6, marginBottom: 8}}>
            {Array.from({length: 18}, (_, i) => (
              <div
                key={`lg${i}`}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 7,
                  border: `2.5px solid ${withAlpha(theme.merge, 0.75)}`,
                  background: withAlpha(theme.merge, 0.14),
                }}
              />
            ))}
          </div>
          <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'挂点表 · 每槽一格 · 位置感'}
          </div>
        </div>
        {/* 图例框定格一拍（命名帧强调） */}
        {freeze > 0.05 ? (
          <div
            style={{
              position: 'absolute',
              left: 352,
              top: 764,
              width: 1216,
              height: 92,
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.merge, 0.85 * freeze)}`,
              opacity: freeze,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2ForkAndGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-07');
  const bC = w('p2-08', 'p2-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atTravel={wa('p2-01', 0.05) - bA.from}
          atFrame={wa('p2-01', 0.4) - bA.from}
          atDesk={wa('p2-02', 0.15) - bA.from}
          atBlock={wa('p2-02', 0.6) - bA.from}
          atYes={wa('p2-03', 0.12) - bA.from}
          atNo={wa('p2-03', 0.55) - bA.from}
          atBoth={wa('p2-03', 0.85) - bA.from}
          atStrip={wa('p2-04', 0.22) - bA.from}
          atPull={wa('p2-04', 0.7) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atGate={wa('p2-05', 0.45) - bB.from}
          atD1={wa('p2-06', 0.14) - bB.from}
          atB1={wa('p2-06', 0.32) - bB.from}
          atD2={wa('p2-06', 0.5) - bB.from}
          atB2={wa('p2-06', 0.66) - bB.from}
          atSigns={wa('p2-06', 0.84) - bB.from}
          atSlow={wa('p2-07', 0.1) - bB.from}
          atReceipt={wa('p2-07', 0.42) - bB.from}
          atHook={wa('p2-07', 0.78) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC
          atStat={wa('p2-08', 0.3) - bC.from}
          atThick={wa('p2-09', 0.32) - bC.from}
          atCard={wa('p2-09', 0.42) - bC.from}
          atStep={wa('p2-09', 0.74) - bC.from}
          atLegend={wa('p2-10', 0.18) - bC.from}
          atFreeze={wa('p2-10', 0.64) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2ForkAndGates;
