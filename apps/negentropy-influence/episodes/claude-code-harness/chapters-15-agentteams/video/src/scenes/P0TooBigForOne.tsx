/** P0 干不完的活（p0-01..p0-08，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：一枚橙色环体
 *  〔M-001〕居中缓转（本集主角全局位 = STAGE.ring 全景坐标锚）→ p0-01「多开
 *  几个」词落位四模块大任务卡自上压下、环体被压得一沉〔M-005〕→ p0-02「认证、
 *  数据库、接口、测试」四词落位四签 stagger 依次贴上卡面、首签「认证」落卡面
 *  同时一枚同款目标小卡自卡面投入环内消息列底（同签两实体：任务签=计划、环内
 *  小卡=进行中目标）〔M-005〕→ p0-03「挤出了记忆」词落位环内消息条逐层堆高、
 *  最早的目标小卡「认证」被挤出顶边坠落出环 → 0-B CU 推近：p0-04「上下文
 *  窗口」词落位额度框闭合点亮、术语签
 *  贴上（首现术语，重音镜 1–2s punch）〔M-005〕〔M-003〕、「一次装得下」词落位
 *  框内消息条与框顶相抵定格（满而不溢即额度）→ 0-C MS 环侧帮手位：p0-05
 *  「子代理」「干完就回」词落位小卡弹出→吐一枚结论小签→缩回消失〔M-005〕→
 *  p0-06「不能问、不能改、不能等」三词落位三封条逐条贴上、「不记得」词落位
 *  第四封条 → p0-07「一直在线」「随时说话」词落位一枚剪影点亮品红（队友预告·
 *  本集主题色首亮）→ p0-08「恰恰是错的那种」词落位直觉组法虚线预演一闪——四枚
 *  剪影围拢一条共享消息列（高亮 ≤1s 后降为暗态轮廓留驻至幕界——morph 起点
 *  帧，末帧轮廓在场）。
 *
 *  空间契约：0-A 单主体环体居中、任务卡位于字幕安全区上方、署源角标右下恒定
 *    不抢焦；0-B 额度框单圈完整、术语签 ≤6 字、框内消息条不溢出（共享与溢出
 *    是 P1 的事）；0-C 剪影排一行等距、品红仅亮一枚、虚线预演 ≤1s、封条在
 *    p0-06 前不预贴。
 *  红线落实：环体〔M-001〕描边承系列锁定值；静止纯文字卡禁（每拍均有状态
 *    推进）；词落位 = wa(id,f)；y≥56 / bottom≥176；「上下文窗口」术语签 ≤6
 *    字；署源角标右下 bottom 168 不进字幕区。
 *
 *  承接登记：0-C→1-A morph（同一主体 = 直觉组法：四剪影+中央虚列）：0-C 末帧
 *    预演围拢拓扑（象限位 + 中央列位）= 1-A 首帧实线主体出演位（虚线描边变实、
 *    剪影升为节点卡，布局象限逐帧不变）；幕间 SceneFade 隔断下走同构入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, STAGE, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn, useSpring} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，豁免登记于工作区配置）：右下常驻，一次淡入后恒定
 *  不抢焦；bottom 168 避开字幕条（承 ep1–ep14 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 168,
      fontFamily: theme.mono,
      fontSize: 22,
      letterSpacing: 1,
      color: theme.dim,
      opacity: 0.85 * clamp01(lit),
    }}
  >
    Learn Claude Code
  </div>
);

/** 四模块签（0-A 任务卡签位 / 2-D 走查任务卡同款同序——跨镜同源可追） */
const MODULES = ['认证', '数据库', '接口', '测试'] as const;

// ── 0-A 冷启动：环体居中缓转 + 四模块大任务卡压下 + 消息堆高挤出 ────────────

const CARD_0A = {x: 520, y: 44, w: 880, h: 196} as const;
/** 环内目标小卡（同签两实体：卡面任务签=计划、环内小卡=进行中目标）——p0-02
 *  首签落卡面同时自卡面投入环内消息列底，p0-03 被堆高的消息条顶出环顶 */
const GOAL_W = 128;
const GOAL_H = 46;

const ZeroA: React.FC<{atPress: number; atSeal: number[]; atStack: number; atSqueeze: number}> = ({atPress, atSeal, atStack, atSqueeze}) => {
  const frame = useCurrentFrame();
  // 大任务卡自上压下（spring 空间通道——压下的重量感）
  const press = useSpring('settle', {at: atPress, dur: DUR.f6});
  // 环体被压得一沉（容器 translateY 承载——描边契约不动）
  const sink = clamp01(progress(frame, atPress + 6, 16)) * 26;
  // 环体居中缓转（主角常态节律）
  const dot = useRingDot(2.5);
  // 消息条逐层堆高（p0-03 前半——自列底逐条点亮 5 条，把驻列底的目标小卡一路顶向环顶）
  const stack = clamp01(progress(frame, atStack, 30));
  const stackN = Math.round(stack * 5);
  // 目标小卡投入（p0-02 首签落卡面同时——自卡面认证签位飞入环内消息列底）
  const drop = clamp01(progress(frame, atSeal[0] + 4, 18));
  // 最早目标卡被挤出顶边坠落出环（p0-03 后半——向上抛出淡出）
  const squeeze = clamp01(progress(frame, atSqueeze, 26));
  // 小卡轨迹：卡面签位 → 环内列底位（sink 后）→ 随堆高逐格上移 → 挤出环顶抛出
  const fromX = 638 - GOAL_W / 2;
  const fromY = 122;
  const homeX = STAGE.ring.x + STAGE.ring.size / 2 - GOAL_W / 2;
  const homeY = STAGE.ring.y + 26 + 218;
  const goalX = fromX + (homeX - fromX) * drop + squeeze * 150;
  const goalY = fromY + (homeY - fromY) * drop - stackN * 36 - squeeze * 300;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕居中缓转（全局位 STAGE.ring——本集主角全景坐标锚） */}
      <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y + sink}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dot} />
        {/* 环内消息条竖列（空架 → 自列底逐层堆高：条目压底、顶上的是进行中目标） */}
        <div style={{position: 'absolute', left: STAGE.ring.size / 2 - 84, top: 130, width: 168}}>
          {Array.from({length: 5}, (_, k) => {
            // k=0 为底条（先亮），自底往上排——堆高即「底下又记了新的」
            const on = k < stackN;
            return (
              <div
                key={`msg${k}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: (4 - k) * 36,
                  height: 26,
                  borderRadius: 6,
                  background: on ? withAlpha(theme.dim, 0.5) : 'transparent',
                  border: `2px ${on ? 'solid' : 'dashed'} ${on ? withAlpha(theme.dim, 0.75) : withAlpha(theme.panelBorder, 0.9)}`,
                  opacity: on ? 0.95 : 0.55,
                }}
              />
            );
          })}
        </div>
      </div>
      {/* 目标小卡「认证」（进行中目标——投入环内列底 → 被堆高顶出环顶坠落出环） */}
      <div
        style={{
          position: 'absolute',
          left: goalX,
          top: goalY,
          width: GOAL_W,
          height: GOAL_H,
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.core, 0.9)}`,
          background: withAlpha(theme.panel, 0.97),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 21,
          fontWeight: 700,
          color: theme.text,
          opacity: drop * ((1 - squeeze) * 0.95 + 0.05),
          transform: `rotate(${squeeze * -14}deg)`,
        }}
      >
        认证
      </div>
      {/* 四模块大任务卡（自上压下——标题 + 四签位虚线待落） */}
      <div
        style={{
          position: 'absolute',
          left: CARD_0A.x,
          top: CARD_0A.y,
          width: CARD_0A.w,
          height: CARD_0A.h,
          borderRadius: 16,
          border: `3px solid ${withAlpha(theme.core, 0.7)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '20px 30px',
          opacity: press,
          transform: `translateY(${(1 - press) * -90}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>大任务 · 重构后端</span>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'一个代理 · 顺着做'}</span>
        </div>
        <div style={{display: 'flex', gap: 22, marginTop: 26}}>
          {MODULES.map((m, i) => {
            // 四签 stagger 依次贴上卡面（虚线待落 → 实底贴上）
            const seal = clamp01(progress(frame, atSeal[i], DUR.f4));
            return (
              <div
                key={`md${i}`}
                style={{
                  width: 176,
                  height: 62,
                  borderRadius: 10,
                  border: `${seal > 0.4 ? '3px solid' : '2.5px dashed'} ${seal > 0.4 ? withAlpha(theme.core, 0.85) : withAlpha(theme.dim, 0.6)}`,
                  background: seal > 0.4 ? withAlpha(theme.core, 0.14) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 24,
                  fontWeight: 700,
                  color: seal > 0.4 ? theme.text : theme.dim,
                  opacity: 0.5 + 0.5 * seal,
                  transform: `translateY(${(1 - seal) * 10}px)`,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>
      </div>
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'干不完的活 · 环体内即对话记忆'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 额度框 CU：被挤出的目标卡悬停 + 容量边界线点亮 + 术语签 ─────────────

const RING_0B = {x: 720, y: 190, size: 480} as const;
const TERM_0B = {x: 1230, y: 208} as const;

const ZeroB: React.FC<{atFrame: number; atTerm: number; atFull: number}> = ({atFrame, atTerm, atFull}) => {
  const frame = useCurrentFrame();
  // CU 推近（额度框特写——decelerate 推近一拍）
  const push = usePushIn(atFrame, {scale: 0.08, dur: DUR.f6});
  // 额度框闭合点亮（虚线外套 → 实线描线闭合：容量边界线）
  const ring = clamp01(progress(frame, atFrame, 26));
  // 术语签贴框（首现术语——重音镜 1–2s punch：贴上 + 辉光一拍）
  const term = clamp01(progress(frame, atTerm, DUR.f4));
  const termGlow = Math.sin(Math.PI * clamp01(progress(frame, atTerm, 40)));
  // 框内消息条与框顶相抵定格（满而不溢——顶条上移抵住内缘，微光一拍）
  const full = clamp01(progress(frame, atFull, 18));
  const cx = RING_0B.x + RING_0B.size / 2;
  const cy = RING_0B.y + RING_0B.size / 2;
  const r = RING_0B.size / 2 - 46;
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '50% 46%'}}>
      {/* 环体 + 消息条堆高态（承 0-A 末帧：5 条满栈） */}
      <div style={{position: 'absolute', left: RING_0B.x, top: RING_0B.y}}>
        <LoopRing size={RING_0B.size} nodes={[]} showExit={false} />
        <div style={{position: 'absolute', left: RING_0B.size / 2 - 84, top: 132, width: 168}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={`bmsg${i}`}
              style={{
                height: 26,
                marginTop: 10,
                borderRadius: 6,
                background: withAlpha(theme.dim, 0.5),
                border: `2px solid ${withAlpha(theme.dim, 0.75)}`,
                // 顶条与框顶相抵（p0-04「一次装得下」——最顶条上移抵住额度框内缘）
                transform: i === 0 ? `translateY(${-full * 14}px)` : 'none',
                boxShadow: i === 0 && full > 0.5 ? `0 0 ${10 * termGlow}px ${withAlpha(theme.dim, 0.8)}` : 'none',
              }}
            />
          ))}
        </div>
      </div>
      {/* 被挤出的目标卡悬停半空（暗态——已坠出环体、悬在额度框外上侧） */}
      <div
        style={{
          position: 'absolute',
          left: 1130,
          top: 96,
          width: 128,
          height: 46,
          borderRadius: 9,
          border: `2.5px solid ${withAlpha(theme.dim, 0.6)}`,
          background: withAlpha(theme.panel, 0.9),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 21,
          fontWeight: 700,
          color: theme.dim,
          opacity: 0.55,
          transform: 'rotate(-8deg)',
        }}
      >
        认证
      </div>
      {/* 额度框（容量边界线：环外圈同心灵虚线 → 实线闭合点亮） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <circle
          cx={cx}
          cy={cy}
          r={r + 58}
          fill="none"
          stroke={withAlpha(theme.dim, 0.9)}
          strokeWidth={4}
          strokeDasharray={ring < 0.99 ? '2 14' : undefined}
          pathLength={1}
          strokeDashoffset={1 - ring}
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.35 + 0.65 * ring}
        />
      </svg>
      {/* 术语签（≤6 字——贴框右上缘，首现术语 punch 辉光） */}
      <div
        style={{
          position: 'absolute',
          left: TERM_0B.x,
          top: TERM_0B.y,
          padding: '10px 22px',
          borderRadius: 10,
          border: `3px solid ${withAlpha(theme.text, 0.9)}`,
          background: withAlpha(theme.panel, 0.98),
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: term,
          transform: `translateY(${(1 - term) * 12}px) scale(${1 + 0.05 * termGlow})`,
          boxShadow: termGlow > 0.05 ? `0 0 ${24 * termGlow}px ${withAlpha(theme.text, 0.5)}` : 'none',
        }}
      >
        上下文窗口
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'上下文窗口 = 一次装得下的对话额度'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 环侧帮手位：子代理弹出即走 + 四封条 + 剪影排（品红预告 + 虚线预演） ──

const RING_0C = {x: 300, y: 190, size: 360} as const;
const SUBCARD_0C = {x: 830, y: 210, w: 250, h: 128} as const;
const SEALS_0C = {x: 830, y: 402, w: 430, h: 56} as const;
/** 剪影坐席一行（等距四枚）与 p0-08 围拢象限位（= 1-A 节点同构位，morph 前提） */
const SEATS_0C = [
  {x: 620, y: 640},
  {x: 920, y: 640},
  {x: 1220, y: 640},
  {x: 1520, y: 640},
] as const;
const HUDDLE_0C = [
  {x: 872, y: 306},
  {x: 1308, y: 316},
  {x: 872, y: 652},
  {x: 1308, y: 652},
] as const;
/** 中央共享消息列位（预演虚列与 1-A 实线列同位——morph 屏位不变的前提） */
const COL_0C = {x: 1086, y: 430, w: 96, h: 344} as const;

const ZeroC: React.FC<{
  atPop: number;
  atSpit: number;
  atRetract: number;
  atSeal: number[];
  atLit: number;
  atPreview: number;
}> = ({atPop, atSpit, atRetract, atSeal, atLit, atPreview}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 子代理小卡弹出（spring）→ 吐结论小签 → 缩回消失（用完即走）
  const pop = useSpring('settle', {at: atPop, dur: DUR.f6});
  const spit = clamp01(progress(frame, atSpit, DUR.f4));
  const retract = clamp01(progress(frame, atRetract, 16));
  // 虚线预演（高亮 ≤1s → 句尾降为暗态轮廓留驻至幕界——0-C→1-A morph 起点帧在场）
  const prev = clamp01(progress(frame, atPreview, 12));
  const prevDim = clamp01(progress(frame, atPreview + 26, 12));
  const prevHi = prev * (1 - 0.68 * prevDim); // 0.9 亮虚线 → ~0.29 暗态轮廓留驻
  // 剪影围拢（一旦围拢保持围列象限位——末帧轮廓在场、坐席行不再回位）
  const huddle = clamp01(progress(frame, atPreview, 14));
  const sealLabels = ['不能问', '不能改', '不能等', '不记得'];
  return (
    <AbsoluteFill>
      {/* 环体（居左缓转——环侧帮手位；预演起退为陪衬一档） */}
      <div style={{position: 'absolute', left: RING_0C.x, top: RING_0C.y, opacity: 1 - 0.35 * prev}}>
        <LoopRing size={RING_0C.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 子代理小卡（环侧弹出 → 吐结论签 → 缩回消失——一次性的，用完即走） */}
      <div
        style={{
          position: 'absolute',
          left: SUBCARD_0C.x,
          top: SUBCARD_0C.y,
          width: SUBCARD_0C.w,
          opacity: pop * (1 - retract),
          transform: `translateX(${(1 - pop) * -60 + retract * 40}px)`,
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.dim, 0.8)}`,
            background: withAlpha(theme.panel, 0.97),
            padding: '16px 20px',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.dim}}>子代理 · 一次性</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 6}}>{'干完就回一句结论'}</div>
        </div>
        {/* 结论小签（吐出——自卡右缘滑出） */}
        <div
          style={{
            position: 'absolute',
            left: SUBCARD_0C.w - 20,
            top: 76,
            padding: '6px 16px',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: spit * (1 - retract),
            transform: `translateX(${spit * 96}px)`,
          }}
        >
          结论 · 建好了
        </div>
      </div>
      {/* 封条四枚（纵列——三封条 stagger + 第四封条收尾） */}
      {sealLabels.map((s, i) => {
        const seal = clamp01(progress(frame, atSeal[i], DUR.f4));
        return (
          <div
            key={`seal${i}`}
            style={{
              position: 'absolute',
              left: SEALS_0C.x,
              top: SEALS_0C.y + i * 72,
              width: SEALS_0C.w,
              height: SEALS_0C.h,
              borderRadius: 10,
              border: `2.5px dashed ${withAlpha(theme.danger, 0.55)}`,
              background: withAlpha(theme.panel, 0.95),
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '0 20px',
              opacity: seal,
              transform: `translateX(${(1 - seal) * -26}px)`,
            }}
          >
            <span style={{width: 14, height: 14, borderRadius: '50%', background: withAlpha(theme.danger, 0.85), opacity: 0.85}} />
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{s}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 'auto', whiteSpace: 'nowrap'}}>
              {i < 3 ? '中途' : '队伍'}
            </span>
          </div>
        );
      })}
      {/* 队友剪影排（一行等距四枚坐席暗态；p0-07 首枚点亮品红——本集主题色首亮） */}
      {SEATS_0C.map((s, i) => {
        const lit = i === 0 ? clamp01(progress(frame, atLit, DUR.f5)) : 0;
        const hx = s.x + (HUDDLE_0C[i].x - s.x) * huddle;
        const hy = s.y + (HUDDLE_0C[i].y - s.y) * huddle;
        return (
          <div
            key={`cut${i}`}
            style={{
              position: 'absolute',
              left: hx,
              top: hy,
              width: 120,
              height: 132,
              borderRadius: '60px 60px 18px 18px',
              border: `3px solid ${lit > 0.3 ? theme.mate : withAlpha(theme.panelBorder, 0.95)}`,
              background: lit > 0.3 ? withAlpha(theme.mate, 0.16) : withAlpha(theme.panel, 0.8),
              boxShadow: lit > 0.3 ? `0 0 ${18 * lit}px ${withAlpha(theme.mate, 0.5)}` : 'none',
              opacity: 0.9 - 0.35 * prevDim,
            }}
          />
        );
      })}
      {/* 中央共享消息列（虚线预演——直觉组法一闪：谁都看得见全部；高亮后降暗态留驻） */}
      <div
        style={{
          position: 'absolute',
          left: COL_0C.x,
          top: COL_0C.y,
          width: COL_0C.w,
          height: COL_0C.h,
          borderRadius: 12,
          border: `3px dashed ${withAlpha(theme.dim, 0.8)}`,
          opacity: prevHi * 0.95,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          padding: '12px 0',
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={`pc${i}`} style={{height: 16, margin: '0 14px', borderRadius: 4, background: withAlpha(theme.dim, 0.4)}} />
        ))}
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'子代理 vs 队友 · 剪影 = 坐席虚位'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0TooBigForOne: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-04');
  const bC = w('p0-05', 'p0-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atPress={wa('p0-01', 0.42) - bA.from}
          atSeal={[wa('p0-02', 0.35), wa('p0-02', 0.5), wa('p0-02', 0.65), wa('p0-02', 0.8)].map((v) => v - bA.from)}
          atStack={wa('p0-03', 0.35) - bA.from}
          atSqueeze={wa('p0-03', 0.8) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atFrame={bB.from * 0 + Math.round(span('p0-04') * 0.2)}
          atTerm={wa('p0-04', 0.45) - bB.from}
          atFull={wa('p0-04', 0.75) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atPop={wa('p0-05', 0.35) - bC.from}
          atSpit={wa('p0-05', 0.72) - bC.from}
          atRetract={wa('p0-06', 0.02) - bC.from}
          atSeal={[wa('p0-06', 0.12), wa('p0-06', 0.3), wa('p0-06', 0.48), wa('p0-06', 0.82)].map((v) => v - bC.from)}
          atLit={wa('p0-07', 0.45) - bC.from}
          atPreview={wa('p0-08', 0.55) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0TooBigForOne;
