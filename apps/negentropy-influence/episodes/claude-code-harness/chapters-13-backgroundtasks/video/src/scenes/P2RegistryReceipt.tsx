/** P2 占位回执（p2-01..p2-08，3 镜）——分镜 2-A / 2-B / 2-C。
 *
 *  叙事链：2-A 走查舞台全景（每幕首镜全景坐标锚）：环体〔M-001〕缩悬顶角
 *  （「执行」段无砖、照常旋转——承 1-D 右轨解放态）→ p2-01「三件事」词落位
 *  三枚步骤签浮出（①交线程 ②发编号 ③回回执）→ p2-02「另开的一条并行执行线」
 *  词落位后台线程轨自环体执行段旁岔出铺成、安装命令卡滑入轨上开跑 → p2-03
 *  「从零零零一递增」词落位登记表首行落下（bg_0001 count-up 0000→0001 · 状态
 *  运行中）→ p2-04「占位回执」词落位回执卡自轨端弹出、沿通路飞回模型侧落定
 *  （卡面 code.py 实文）→ 步骤签①②③随各自拍退役 → 2-B 小票插曲（类比 A#3
 *  机制位）：p2-05「先递小票」小票卡递出、「当场闭合」订单板勾亮 → p2-06「叫号
 *  广播」声波纹扩散一拍、「新事件」新事件卡点亮（独立一张、与旧小票并排）、
 *  旧小票原样静置 → p2-07「凭记忆取」记忆小图补上小票虚影、「用掉了」名额槽位
 *  盖不可逆章 → 2-C 双线并行帧（幕尾钩单句镜）：p2-08「转头干下一件」词落位
 *  模型转身一拍、「在后台赶路」词落位后台轨流光加速一拍——前景转身与背景
 *  赶路双层并行定格（「不等的工作分工」首次同帧成立）。
 *
 *  空间契约：登记表三列结构与列名恒定、三件事点火次序=口播次序、bg_0001 与
 *    口播读法（零零零一）一致；小票与新事件卡两卡并排可辨（旧账不可改/新事件
 *    自进场）、边界小卡对照两行、登记表缩微联动不抢焦；前景模型侧与后台轨
 *    双层可辨（谁在等/谁在跑）、占位回执卡与 2-A 同形；禁进度条本镜走满
 *    （赶路≠到达，不剧透 P3）、模型侧出现等待姿态。
 *
 *  红线落实：词落位 = wa(id,f)（⑧ 轮按句内字位复核一轮通过；词级实测复核留
 *    ⑨ 轮 QA）；y≥56 / bottom≥176；bg_0001 · daemon thread ·
 *    BackgroundTasks.start · registry + lock 只进角标；回执卡面 code.py 实文
 *    （caption-dup-ok 登记）。
 *
 *  承接登记：1-D→2-A SceneFade＋走查舞台全景重锚——环体〔M-001〕同形签名
 *    回归（非 morph，承 ep2 3-C→4-A 判例）；后台轨自 1-D 右轨同形延伸入 P2
 *    舞台（镜间身份恒常）。2-C→3-A morph（storyboard 登记）——同一主体=
 *    后台轨上的安装任务，进度连续走满、任务签与编号签恒定可追、描边色
 *    雾蓝→兰紫过渡（后台世界→通知世界的身份交接）。
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
} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 步骤签（①交线程 ②发编号 ③回回执——随各自拍退役〔M-006〕） */
const StepTag: React.FC<{k: string; t: string; p: number; outP: number}> = ({k, t, p, outP}) => {
  const lit = clamp01(p);
  const out = clamp01(outP);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 18px',
        borderRadius: 9,
        border: `2.5px solid ${lit > 0.35 ? withAlpha(theme.mech, 0.9) : withAlpha(theme.dim, 0.5)}`,
        background: lit > 0.35 ? withAlpha(theme.panel, 0.95) : 'transparent',
        opacity: (0.35 + 0.65 * lit) * (1 - out),
        transform: `translateY(${(1 - lit) * -14}px)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: lit > 0.35 ? theme.mech : theme.dim}}>{k}</span>
      <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: lit > 0.35 ? theme.text : theme.dim}}>{t}</span>
    </div>
  );
};

// ── 2-A 走查舞台全景：环体缩悬 + 登记表首亮 + 轨岔出 + 回执弹出 ─────────────

const TwoA: React.FC<{atSteps: number[]; atRail: number; atCardRun: number; atRow: number; atIdCount: number; atReceipt: number; atStepOut: number[]}> = ({atSteps, atRail, atCardRun, atRow, atIdCount, atReceipt, atStepOut}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 环体缩悬顶角（解放态——承 1-D 右轨：无砖、照常旋转）
  const dotPos = (frame / (fps * 2.5)) % 1;
  // 三枚步骤签浮出（①②③ stagger）
  const stepPs = atSteps.map((a) => clamp01(progress(frame, a, DUR.f4)));
  const stepOuts = atStepOut.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 后台线程轨：自环体执行段旁岔出铺成（描线）+ 命令卡滑入开跑
  const railLit = clamp01(progress(frame, atRail, 22));
  const cardIn = clamp01(progress(frame, atCardRun, 20));
  const cardT = 0.06 + 0.1 * clamp01(progress(frame, atCardRun + 10, 200));
  // 登记表首行落下（bg_0001 count-up 0000→0001 · 运行中）
  const rowP = clamp01(progress(frame, atRow, 16));
  const idCount = Math.round(clamp01(progress(frame, atIdCount, 12)));
  const idText = `bg_${String(idCount).padStart(4, '0')}`;
  // 回执卡自轨端弹出、沿通路飞回模型侧落定（飞回轨迹：轨端 → 模型侧）
  const fly = clamp01(progress(frame, atReceipt, 30));
  const flyX = STAGE.track.x + STAGE.track.w - 380 + (STAGE.model.x - 320 - (STAGE.track.x + STAGE.track.w - 380)) * fly;
  const flyY = STAGE.track.y - 40 + (STAGE.model.y - 200 - (STAGE.track.y - 40)) * fly;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕缩悬顶角（解放态自此贯穿——描边/线宽承系列锁定） */}
      <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        <RingExecSeg size={STAGE.ring.size} segP={clamp01(progress(frame, 4, DUR.f5))} freeP={1} />
      </div>
      {/* 三枚步骤签（表右上——点火次序=口播，随各自拍退役） */}
      <div style={{position: 'absolute', left: STAGE.registry.x + 40, top: 128, display: 'flex', gap: 18}}>
        <StepTag k="①" t="交线程" p={stepPs[0]} outP={stepOuts[0]} />
        <StepTag k="②" t="发编号" p={stepPs[1]} outP={stepOuts[1]} />
        <StepTag k="③" t="回回执" p={stepPs[2]} outP={stepOuts[2]} />
      </div>
      {/* 登记表（舞台中央首亮——三列空架 → 首行落下） */}
      <RegistryTable x={STAGE.registry.x} y={STAGE.registry.y} w={STAGE.registry.w} h={STAGE.registry.h} litP={clamp01(progress(frame, 6, DUR.f5))} rowP={rowP} idText={idText} state={rowP > 0.5 ? 'running' : 'empty'} />
      {/* 后台线程轨（表侧横带——自环体执行段旁岔出；命令卡滑入开跑） */}
      <BackgroundTrack x={STAGE.track.x} y={STAGE.track.y} w={STAGE.track.w} litP={railLit} cardT={cardIn > 0.05 ? cardT : -1} progP={0.08 + 0.3 * clamp01(progress(frame, atCardRun + 12, 400))} flowT={frame / 40} flowP={railLit > 0.9 ? 0.5 : 0} />
      {/* 轨端 → 模型侧通路（回执卡的飞回路径——虚线） */}
      <svg width={600} height={300} viewBox="0 0 600 300" style={{position: 'absolute', left: STAGE.track.x + STAGE.track.w - 400, top: STAGE.track.y - 240, overflow: 'visible', opacity: railLit * 0.75}}>
        <path d="M 400 240 C 480 200 520 120 470 60" fill="none" stroke={withAlpha(theme.mech, 0.5)} strokeWidth={3} strokeDasharray="10 9" pathLength={1} strokeDashoffset={1 - railLit} />
      </svg>
      {/* 模型侧（右缘——模型图标 + 占位回执卡位） */}
      <div style={{position: 'absolute', left: STAGE.model.x, top: STAGE.model.y - 60, opacity: clamp01(progress(frame, 8, DUR.f5))}}>
        <svg width={90} height={90} viewBox="0 0 90 90">
          <rect x={8} y={14} width={74} height={62} rx={12} fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3} />
          <circle cx={30} cy={38} r={7} fill={withAlpha(theme.core, 0.85)} />
          <circle cx={60} cy={38} r={7} fill={withAlpha(theme.core, 0.85)} />
          <path d="M 28 58 Q 45 68 62 58" fill="none" stroke={withAlpha(theme.core, 0.85)} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, textAlign: 'center', marginTop: 4, whiteSpace: 'nowrap'}}>{'模型侧'}</div>
      </div>
      {/* 占位回执卡（轨端弹出 → 沿通路飞回 → 模型侧落定） */}
      {fly > 0.02 ? (
        <div style={{position: 'absolute', left: flyX, top: flyY, opacity: clamp01(fly * 1.6), transform: `scale(${0.9 + 0.1 * Math.min(1, fly * 1.4)}) rotate(${(1 - fly) * -4}deg)`}}>
          <PlaceholderReceipt x={0} y={0} w={340} litP={1} compact glowP={fly > 0.95 ? 0.8 : 0} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'bg_0001 · daemon thread · BackgroundTasks.start · registry + lock'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-B 小票插曲（类比 A#3 机制位）：递票闭合 + 叫号新事件 + 名额不可逆 ──────

/** 柜台全局位（左）；订单板（右上）；小票/新事件卡并排（柜台上方） */
const COUNTER = {x: 300, y: 560, w: 520} as const;
const BOARD = {x: 1240, y: 190, w: 460, h: 300} as const;
const TICKET = {x: 360, y: 300} as const;
const NEWEV = {x: 760, y: 270} as const;

const TwoB: React.FC<{atTicket: number; atClose: number; atCall: number; atNewEv: number; atKeep: number; atMemo: number; atStamp: number}> = ({atTicket, atClose, atCall, atNewEv, atKeep, atMemo, atStamp}) => {
  const frame = useCurrentFrame();
  // 小票卡递出（店员 → 客 = 占位回执同形变体、票面同款 bg_0001 编号签）
  const ticket = clamp01(progress(frame, atTicket, 16));
  // 订单板「当场闭合」勾亮
  const close = clamp01(progress(frame, atClose, 14));
  // 叫号广播：声波纹扩散一拍（三圈确定性扩散）
  const callP = clamp01(progress(frame, atCall, 20));
  // 新事件卡点亮（独立一张、与旧小票并排）
  const newEv = clamp01(progress(frame, atNewEv, 14));
  // 旧小票原样静置（不可改写的具象——静置即陈述）
  const keep = clamp01(progress(frame, atKeep, 14));
  // 边界一：小票丢了还能凭记忆取 → 记忆小图补上小票虚影
  const memo = clamp01(progress(frame, atMemo, 16));
  // 边界二：名额用掉不退 → 名额槽位盖不可逆章（用掉即终态）
  const stamp = clamp01(progress(frame, atStamp, 14));
  // 登记表驻位缩微联动（行状态随小票闭合同步——syncP 一拍）
  const sync = Math.sin(Math.PI * clamp01(progress(frame, atClose + 4, 20)));
  return (
    <AbsoluteFill>
      {/* 柜台 + 店员（机制位类比——柜台小图，不剧场化） */}
      <div style={{position: 'absolute', left: COUNTER.x, top: COUNTER.y, width: COUNTER.w, opacity: clamp01(progress(frame, 2, DUR.f5))}}>
        <svg width={COUNTER.w} height={120} viewBox={`0 0 ${COUNTER.w} 120`}>
          <rect x={0} y={52} width={COUNTER.w} height={54} rx={10} fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} />
          {/* 店员（柜台后——半身剪影，递票姿态静态） */}
          <circle cx={90} cy={26} r={15} fill={withAlpha(theme.dim, 0.75)} />
          <path d="M 72 42 L 108 42 L 112 74 L 68 74 Z" fill={withAlpha(theme.dim, 0.75)} />
        </svg>
      </div>
      {/* 小票卡（占位回执同形变体——递出后原样静置） */}
      <div style={{position: 'absolute', left: TICKET.x, top: TICKET.y + (1 - ticket) * 60, opacity: ticket}}>
        <PlaceholderReceipt x={0} y={0} w={330} litP={1} compact glowP={keep > 0.3 ? 0.35 : 0} />
        {/* 小票虚影（凭记忆取——丢了还有记忆可对：dashed 虚影浮于小票上方） */}
        {memo > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: -64,
              width: 250,
              padding: '6px 12px',
              borderRadius: 8,
              border: `2px dashed ${withAlpha(theme.dim, 0.75)}`,
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: memo * 0.9,
              transform: `translateY(${(1 - memo) * -12}px)`,
            }}
          >
            {'记忆 · bg_0001'}
          </div>
        ) : null}
      </div>
      {/* 记忆小图（小票左侧——凭记忆取的具象） */}
      {memo > 0.02 ? (
        <svg width={70} height={70} viewBox="0 0 70 70" style={{position: 'absolute', left: TICKET.x - 92, top: TICKET.y - 8, opacity: memo}}>
          <path d="M 12 22 Q 35 6 58 22 L 58 56 Q 35 44 12 56 Z" fill={withAlpha(theme.panel, 0.95)} stroke={withAlpha(theme.dim, 0.8)} strokeWidth={3} />
          <line x1={35} y1={14} x2={35} y2={48} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2} />
        </svg>
      ) : null}
      {/* 新事件卡（叫号广播点亮——独立一张、与旧小票并排可辨） */}
      {newEv > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: NEWEV.x,
            top: NEWEV.y,
            width: 300,
            padding: '10px 16px',
            borderRadius: 10,
            border: `3px solid ${theme.notify}`,
            background: withAlpha(theme.panel, 0.97),
            boxShadow: `0 0 ${16 * newEv}px ${withAlpha(theme.notify, 0.4)}`,
            opacity: newEv,
            transform: `translateY(${(1 - newEv) * 18}px)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.notify, whiteSpace: 'nowrap'}}>{'new event'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.text, marginTop: 2, whiteSpace: 'nowrap'}}>{'餐好了 · 叫号'}</div>
        </div>
      ) : null}
      {/* 叫号广播声波纹（新事件卡右侧——三圈确定性扩散一拍） */}
      {callP > 0.03 && callP < 0.97 ? (
        <svg width={180} height={120} viewBox="0 0 180 120" style={{position: 'absolute', left: NEWEV.x + 300, top: NEWEV.y - 24, opacity: Math.sin(Math.PI * callP)}}>
          {[0, 1, 2].map((i) => {
            const rp = clamp01(callP * 2.2 - i * 0.5);
            return <circle key={`wav${i}`} cx={20} cy={60} r={12 + rp * 56} fill="none" stroke={withAlpha(theme.notify, 0.75 * (1 - rp))} strokeWidth={3} />;
          })}
        </svg>
      ) : null}
      {/* 订单板（右上——订单行 + 当场闭合勾亮） */}
      <div
        style={{
          position: 'absolute',
          left: BOARD.x,
          top: BOARD.y,
          width: BOARD.w,
          height: BOARD.h,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
          background: withAlpha(theme.panel, 0.92),
          padding: '16px 20px',
          opacity: clamp01(progress(frame, 4, DUR.f5)),
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, whiteSpace: 'nowrap'}}>{'订单板'}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 18}}>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.mech}}>{'bg_0001'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, whiteSpace: 'nowrap'}}>{'一份安装'}</span>
          <span style={{flex: 1}} />
          {/* 勾亮（当场闭合——订单与小票两讫） */}
          {close > 0.02 ? (
            <svg width={34} height={34} viewBox="0 0 20 20" style={{opacity: close}}>
              <path d="M 3 10.5 L 8 15.5 L 17 4.5" fill="none" stroke={theme.ok} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span style={{width: 22, height: 22, borderRadius: 5, border: `2.5px solid ${withAlpha(theme.dim, 0.6)}`}} />
          )}
        </div>
        {/* 名额槽位（用掉即终态——不可逆章盖落） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 26}}>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, whiteSpace: 'nowrap'}}>{'名额槽'}</span>
          <span
            style={{
              width: 60,
              height: 30,
              borderRadius: 6,
              border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
              background: withAlpha(theme.panel, 0.9),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.dim,
            }}
          >
            {'01'}
          </span>
          {/* 不可逆章（用掉了——rotate 落章、终态常驻） */}
          {stamp > 0.02 ? (
            <span
              style={{
                padding: '3px 12px',
                borderRadius: 7,
                border: `2.5px solid ${theme.danger}`,
                fontFamily: theme.sans,
                fontSize: 15,
                fontWeight: 700,
                color: theme.danger,
                whiteSpace: 'nowrap',
                transform: `rotate(${-10 + 3 * stamp}deg) scale(${0.7 + 0.3 * stamp})`,
                opacity: stamp * 0.95,
              }}
            >
              {'已用 · 不退'}
            </span>
          ) : null}
        </div>
      </div>
      {/* 失配边界小卡（两行对照——低饱和不抢焦） */}
      <div
        style={{
          position: 'absolute',
          left: 640,
          top: 640,
          padding: '10px 20px',
          borderRadius: 10,
          border: `2px dashed ${withAlpha(theme.dim, 0.6)}`,
          fontFamily: theme.sans,
          fontSize: 18,
          color: theme.dim,
          lineHeight: 1.7,
          whiteSpace: 'nowrap',
          opacity: clamp01(progress(frame, atMemo - 6, DUR.f5)) * 0.92,
        }}
      >
        {'小票丢了 · 凭记忆取'}
        <br />
        {'名额用掉 · 不退'}
      </div>
      {/* 登记表驻位缩微联动（行状态随小票闭合同步——syncP 一拍，不抢焦） */}
      <RegistryTable x={1420} y={600} w={380} h={190} mini litP={0.85} rowP={1} state="running" syncP={sync} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'bg_0001 · 占位回执'}
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 双线并行帧（幕尾钩）：前景转身 + 背景赶路双层定格 ────────────────────

const TwoC: React.FC<{atTurn: number; atFlow: number}> = ({atTurn, atFlow}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 前景模型转身（一拍——手持占位回执、转身面向下一件任务位）
  const turn = clamp01(progress(frame, atTurn, 16));
  // 背景后台轨流光加速一拍（赶路的动态语义——流光强度抬 + 卡位前移一档）
  const flowBoost = Math.sin(Math.PI * clamp01(progress(frame, atFlow, 22)));
  const flowT = frame / (40 - 14 * flowBoost);
  const cardT = 0.3 + 0.18 * clamp01(progress(frame, 0, 420)) + 0.06 * flowBoost;
  // 环体缩微驻位（模型侧身后——已无等待砖，照常旋转）
  const dotPos = (frame / (fps * 2.5)) % 1;
  return (
    <AbsoluteFill>
      {/* 背景层：后台线程轨（安装命令卡仍在轨上爬行——进度未满不剧透 P3） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.92}}>
        <BackgroundTrack x={280} y={700} w={1360} litP={1} cardT={cardT} progP={0.42 + 0.2 * clamp01(progress(frame, 0, 380)) + 0.05 * flowBoost} flowT={flowT} flowP={0.55 + 0.45 * flowBoost} endCap />
      </div>
      {/* 前景层：模型侧（手持占位回执 → 转身面向下一件任务位） */}
      <div style={{position: 'absolute', left: 420, top: 300, width: 560, height: 320}}>
        <div style={{position: 'absolute', left: 0, top: 30, transform: `translateX(${turn * 120}px)`}}>
          <svg width={100} height={110} viewBox="0 0 100 110">
            <g transform={`rotate(${turn * 14} 50 60)}`}>
              <circle cx={50} cy={22} r={17} fill={withAlpha(theme.dim, 0.85)} />
              <path d="M 30 42 L 70 42 L 76 96 L 58 96 L 52 66 L 46 96 L 26 96 Z" fill={withAlpha(theme.dim, 0.85)} />
              {/* 手持回执（臂弯上的 bg_0001 小票——转身随行） */}
              <rect x={66} y={48} width={30} height={20} rx={4} fill={withAlpha(theme.panel, 1)} stroke={withAlpha(theme.mech, 0.9)} strokeWidth={2.5} />
            </g>
          </svg>
          {/* 转身指向弧（一拍——面向下一件任务位的读法辅助） */}
          {turn > 0.3 ? (
            <svg width={80} height={60} viewBox="0 0 80 60" style={{position: 'absolute', left: 96, top: 30, opacity: clamp01(turn * 1.6 - 0.5)}}>
              <path d="M 6 30 Q 40 6 70 26" fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeDasharray="7 6" strokeLinecap="round" />
              <path d="M 62 18 L 72 27 L 60 33" fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </div>
        {/* 占位回执卡（手持件——与 2-A 同形） */}
        <div style={{position: 'absolute', left: 60 + turn * 120, top: 176, opacity: 1}}>
          <PlaceholderReceipt x={0} y={0} w={330} litP={1} compact />
        </div>
        {/* 下一件任务位（新调用块轮廓待发——转身面向的落点） */}
        <div
          style={{
            position: 'absolute',
            left: 330,
            top: 40,
            width: 190,
            height: 84,
            borderRadius: 10,
            border: `3px dashed ${withAlpha(theme.tool, 0.6 + 0.3 * turn)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: 0.35 + 0.5 * turn,
          }}
        >
          {'下一件 · 待发'}
        </div>
      </div>
      {/* 环体缩微驻位（顶角——照常旋转） */}
      <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y, opacity: 0.5}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dotPos} />
        <RingExecSeg size={STAGE.ring.size} segP={1} freeP={1} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'daemon thread · bg_0001'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P2RegistryReceipt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-07');
  const bC = w('p2-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <TwoA
          atSteps={[0.78, 0.9, 0.98].map((f) => wa('p2-01', f) - bA.from)}
          atRail={wa('p2-02', 0.58) - bA.from}
          atCardRun={wa('p2-02', 0.74) - bA.from}
          atRow={wa('p2-03', 0.34) - bA.from}
          atIdCount={wa('p2-03', 0.42) - bA.from}
          atReceipt={wa('p2-04', 0.24) - bA.from}
          atStepOut={[
            wa('p2-03', 0.08) - bA.from,
            wa('p2-04', 0.08) - bA.from,
            wa('p2-04', 0.6) - bA.from,
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <TwoB
          atTicket={wa('p2-05', 0.5) - bB.from}
          atClose={wa('p2-05', 0.76) - bB.from}
          atCall={wa('p2-06', 0.24) - bB.from}
          atNewEv={wa('p2-06', 0.5) - bB.from}
          atKeep={wa('p2-06', 0.72) - bB.from}
          atMemo={wa('p2-07', 0.42) - bB.from}
          atStamp={wa('p2-07', 0.84) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <TwoC atTurn={wa('p2-08', 0.36) - bC.from} atFlow={wa('p2-08', 0.8) - bC.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2RegistryReceipt;
