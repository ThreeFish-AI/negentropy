/** P1 调模型之前（p1-01..p1-09，3 镜）——分镜 1-A / 1-B / 1-C。
 *
 *  Morph Continuity（0-C→1-A，头注明示）：同一主体＝陶土橙环体＋环外设施
 *  暗格圈。起止态：0-C 末帧环体居中细线呼吸态、暗格圈轮廓整圈在位 → 1-A
 *  首帧恒定蓝走廊墙体自环体两侧展开成可行走环形走廊（环体即走廊中线，细线
 *  四拍不变）、暗格圈化为走廊外侧设施壁。中间态：展开过程环体描边色/线宽/
 *  圆度逐帧不变（仅周边墙体生长——CorridorWalk wallP 通道），暗格轮廓连续
 *  无重绘（暗格圈→设施壁同格同位）。身份线索：陶土橙中线＋四拍微光（保两项）。
 *  何时不该 morph：展开跳帧或墙体重绘抖动，回退 cut＋走廊淡入。
 *
 *  叙事链：1-A 环形走廊主视觉首次亮出（全景坐标锚——本集主装置全局位）：
 *  @pushIn（动机：p1-01「先站到输入口」——镜头随行进视角推近岗亭）、p1-01
 *  「一句话进门」词落位输入气泡落入入口〔M-005〕、「先过一道输入钩子」词落位
 *  岗亭灯亮、亭内挂钩小形探出；p1-02「看一眼再放行」词落位扫描线自岗亭掠过
 *  气泡一拍（单向）、「门口的事」词落位岗亭贴「门外」小签（亭体明确驻环外位
 *  ——不占循环的空间陈述）〔M-003〕→ 1-B 走廊中段三间准备室特写：p1-03
 *  「三道准备」词落位三间门牌轮廓齐立〔M-005〕；p1-04「塞进对话」词落位室①
 *  亮——两枚消息条（到点检查单/后台干完的活计）先后滑进对话列（角标 cron ·
 *  background tasks 随条）；p1-05「打包压短」词落位室②亮——大输出长条打捆
 *  成小包（捆带勒紧一拍，角标 compact）、「再裁历史」词落位历史列尾端裁短
 *  一截（裁切线闪过）；p1-06「拼进」「底座」词落位室③亮——记忆/技能清单/
 *  已连服务三小卡依次归位拼进底板（角标 system prompt）＋第三枚设施格滑入
 *  槽位（三道准备三站挂点齐）；每室亮起时一枚设施格自室顶滑入环边对应挂点槽
 *  （合流紫归位动效——与 0-C 示例同款同色）→ 1-C 调用舱特写：p1-07「恢复垫」
 *  词落位缓冲垫裹上舱体一拍（角标 error recovery）〔M-005〕；p1-08 四词各
 *  落位一徽章点亮（限流/超载/超长/再压——四档梯子逐档可数）；p1-09「到这里，
 *  模型才开口」词落位舱门开启、模型气泡自舱内升起（开口第一帧）、「岔口」
 *  词落位远处岔口微光增强一拍（下一站预告）〔M-003〕。
 *
 *  空间契约（安全带实算）：走廊 150..410（墙 194/366、中线 280）/ 设施壁带
 *  130..176 / 挂点槽带 388..422；1-A 岗亭 436..576 底 576 / 角标底 620；
 *  1-B 三室 450..730 底 730 / 归位道 390..436；1-C 调用舱 169..391 / 徽章组
 *  397..479 底 479 / 岔口微光 y 280——全部 ≤ 860、装置 y ≥ 130。红线落实：
 *  走廊中线＝陶土橙细线全片锚定、岗亭驻环外（门外语义）、气泡单向进门、
 *  扫描线单向禁双向往返、墙体描边色恒定蓝不漂移、三室点亮次序＝口播次序
 *  （①②③ 一句一室）、归位动效与 0-C 同款同色、设施格不越槽位、消息条/小卡
 *  文字不成句、四徽章点亮次序＝口播次序、舱体驻「调模型」拍位、岔口仅微光
 *  预告不展开、恢复垫不盖舱门（垫框留门缝）。词落位 = wa(id,f)。
 *
 *  承接登记：1-C→2-A morph（同一主体＝走廊＋行进中的模型气泡——气泡载响应
 *  包沿走廊行至岔口；详见 P2ForkAndGates 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CorridorWalk, GateBooth, MechanismSil, PrepRoom, RecoveryPad, ease} from '../components/motifs';
import {clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 走廊全局位（P1–P3 近景走廊态共用——镜间身份恒常）：y 150..410、中线 280 */
const CORR = {x: 0, y: 150, w: 1920, h: 260} as const;
const MID_Y = 280;

/** 三准备室全局位（廊侧下排——室顶贴走廊挂点槽带） */
const ROOMS = [
  {x: 170, y: 450},
  {x: 670, y: 450},
  {x: 1170, y: 450},
] as const;
const ROOM_W = 470;
const ROOM_H = 280;

// ── 1-A 走廊亮出 + 入口岗亭 + 输入气泡进门 ──────────────────────────────────

const OneA: React.FC<{atBubble: number; atLamp: number; atScan: number; atSign: number; atGo: number}> = ({
  atBubble,
  atLamp,
  atScan,
  atSign,
  atGo,
}) => {
  const frame = useCurrentFrame();
  // @pushIn（1-A 推近岗亭——行进视角；A-09 与 2-C 拉远分属两幕）
  const push = usePushIn(6, {scale: 0.05, dur: 40});
  // 输入气泡：自左沿中线飞向入口（单向进门）→ 放行后沿中线前行
  const enter = ease(clamp01(progress(frame, atBubble, 22)));
  const go = ease(clamp01(progress(frame, atGo, 26)));
  const bx = -70 + enter * 310 + go * 420;
  // 墙体自环体（画面中部）两侧展开贯屏——morph 展开通道
  const wallGrow = ease(clamp01(progress(frame, 2, 30)));
  // 设施壁（0-C 暗格圈化来——同格同位，暗格轮廓态）
  const cells = Array.from({length: 18}, () => 0.32);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '360px 420px'}}>
        <CorridorWalk x={CORR.x} y={CORR.y} w={CORR.w} h={CORR.h} wallP={wallGrow} t={frame} cells={cells} />
        {/* 输入气泡（一句话——沿中线单向进门） */}
        <div
          style={{
            position: 'absolute',
            left: bx - 46,
            top: MID_Y - 22,
            width: 92,
            height: 44,
            borderRadius: 12,
            border: `3px solid ${theme.text}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          一句话
        </div>
        {/* 入口岗亭（驻环外——门口的事不占循环） */}
        <GateBooth
          x={110}
          y={436}
          lampP={clamp01(progress(frame, atLamp, 12))}
          hookP={clamp01(progress(frame, atLamp + 6, 12))}
          scanP={ease(clamp01(progress(frame, atScan, 14)))}
          doorSignP={clamp01(progress(frame, atSign, 12))}
        />
        {/* 岗亭角标（只进角标不口播） */}
        <div style={{position: 'absolute', left: 110, top: 596, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
          UserPromptSubmit
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 三间准备室：注入滑槽 / 压缩管线 / 系统提示词底座 ─────────────────────

/** 室① 注入滑槽：两枚消息条先后滑进对话列（竖条） */
const RoomInject: React.FC<{litP: number; slipPs: readonly number[]}> = ({litP, slipPs}) => {
  const slips = [
    {label: '到点检查单', tag: 'cron'},
    {label: '后台干完的活计', tag: 'background tasks'},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: litP}}>
      {/* 对话列（竖条——注入目标） */}
      <div
        style={{
          position: 'absolute',
          right: 26,
          top: 14,
          width: 150,
          height: 190,
          borderRadius: 10,
          border: `3px solid ${withAlpha(theme.merge, 0.6)}`,
          background: withAlpha(theme.panel, 0.95),
        }}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 8, textAlign: 'center', fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>对话列</div>
      </div>
      {/* 两枚消息条（沿滑槽滑进——先后次序=口播） */}
      {slips.map((s, i) => {
        const sp = ease(clamp01(slipPs[i] ?? 0));
        return (
          <div
            key={`ms${i}`}
            style={{
              position: 'absolute',
              left: 30 + (1 - sp) * -240,
              top: 40 + i * 96,
              width: 240,
              height: 62,
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.merge, 0.5 + 0.5 * sp)}`,
              background: withAlpha(theme.panel, 0.98),
              padding: '8px 14px',
              opacity: sp,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{s.label}</div>
            <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap', marginTop: 3}}>{s.tag}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 室② 压缩管线：大输出长条打捆成小包（捆带勒紧）+ 历史列尾端裁短 */
const RoomCompact: React.FC<{litP: number; bundleP: number; cutP: number}> = ({litP, bundleP, cutP}) => {
  const bundle = ease(clamp01(bundleP));
  const cut = ease(clamp01(cutP));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: litP}}>
      {/* 大输出长条 → 打捆成小包（长度收缩 + 捆带勒紧一拍） */}
      <div style={{position: 'absolute', left: 30, top: 26, width: 260, height: 120}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 34,
            width: 240 - bundle * 168,
            height: 44,
            borderRadius: 8,
            border: `3px solid ${withAlpha(theme.merge, 0.5 + 0.5 * bundle)}`,
            background: withAlpha(theme.merge, 0.12),
          }}
        />
        {/* 捆带（勒紧一拍——scaleY 收束） */}
        {[0.36, 0.62].map((rx, i) => (
          <div
            key={`bd${i}`}
            style={{
              position: 'absolute',
              left: (240 - bundle * 168) * rx,
              top: 28,
              width: 9,
              height: 56,
              borderRadius: 4,
              background: theme.merge,
              opacity: bundle,
              transform: `scaleY(${0.6 + 0.4 * bundle})`,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 0, top: 96, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>compact</div>
      </div>
      {/* 历史列（竖条——尾端裁短一截） */}
      <div
        style={{
          position: 'absolute',
          right: 30,
          top: 20,
          width: 118,
          height: 186,
          borderRadius: 9,
          border: `3px solid ${withAlpha(theme.dim, 0.6)}`,
          background: withAlpha(theme.panel, 0.95),
          overflow: 'hidden',
        }}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 8, textAlign: 'center', fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>历史列</div>
        {/* 裁切线（闪过）+ 尾端裁短 */}
        {cut > 0.02 && cut < 0.98 ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: 96, height: 3, background: theme.danger, opacity: 0.9}} />
        ) : null}
        <div style={{position: 'absolute', left: 12, right: 12, bottom: 12, height: 60 - cut * 44, borderRadius: 6, background: withAlpha(theme.dim, 0.3)}} />
      </div>
    </div>
  );
};

/** 室③ 系统提示词底座：底板 + 三枚小卡位（记忆形/清单形/服务形）归位拼装 */
const RoomBase: React.FC<{litP: number; cardPs: readonly number[]}> = ({litP, cardPs}) => {
  const cards = [
    {i: 11, label: '记忆'},
    {i: 2, label: '技能清单'},
    {i: 17, label: '已连服务'},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, opacity: litP}}>
      {/* 底板（system prompt 这块底座） */}
      <div
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: 96,
          height: 96,
          borderRadius: 10,
          border: `3px solid ${withAlpha(theme.merge, 0.75)}`,
          background: withAlpha(theme.merge, 0.08),
        }}
      />
      {/* 三小卡（形态件——依次归位拼进底板，stagger 次序=口播） */}
      {cards.map((c, i) => {
        const cp = ease(clamp01(cardPs[i] ?? 0));
        return (
          <div
            key={`bc${i}`}
            style={{
              position: 'absolute',
              left: 52 + i * 146 + (1 - cp) * (i - 1) * 40,
              top: 108 + (1 - cp) * -54,
              width: 118,
              height: 72,
              borderRadius: 9,
              border: `2.5px solid ${withAlpha(theme.merge, 0.4 + 0.6 * cp)}`,
              background: withAlpha(theme.panel, 0.98),
              opacity: cp,
            }}
          >
            <div style={{position: 'absolute', left: 0, right: 0, top: 4, display: 'flex', justifyContent: 'center'}}>
              <MechanismSil x={59} y={21} i={c.i} size={34} litP={1} flyP={1} />
            </div>
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 7, textAlign: 'center', fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
              {c.label}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 30, top: 24, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>system prompt</div>
    </div>
  );
};

const OneB: React.FC<{
  atPlaques: number;
  atRoom1: number;
  atSlips: number;
  atSlot1: number;
  atRoom2: number;
  atBundle: number;
  atCut: number;
  atSlot2: number;
  atRoom3: number;
  atCards: number;
  atSlot3: number;
}> = ({atPlaques, atRoom1, atSlips, atSlot1, atRoom2, atBundle, atCut, atSlot2, atRoom3, atCards, atSlot3}) => {
  const frame = useCurrentFrame();
  const plaquePs = [0, 1, 2].map((k) => clamp01(progress(frame, atPlaques + k * 6, 10)));
  const room1 = clamp01(progress(frame, atRoom1, 12));
  const room2 = clamp01(progress(frame, atRoom2, 12));
  const room3 = clamp01(progress(frame, atRoom3, 12));
  const slipPs = [clamp01(progress(frame, atSlips, 16)), clamp01(progress(frame, atSlips + 12, 16))];
  const cardPs = [0, 1, 2].map((k) => clamp01(progress(frame, atCards + k * 8, 14)));
  // 挂点槽带：暗态细槽 → 三站归位后三格点亮（P2 起下半圈续亮）
  const slotPs = Array.from({length: 18}, (_, i) =>
    i === 3 ? clamp01(progress(frame, atSlot1, 14)) : i === 7 ? clamp01(progress(frame, atSlot2, 14)) : i === 15 ? clamp01(progress(frame, atSlot3, 14)) : 0,
  );
  // 设施壁：三室对应的格随室亮（暗格轮廓态→点亮）
  const cells = slotPs.map((s) => Math.max(0.32, s));
  return (
    <AbsoluteFill>
      <CorridorWalk x={CORR.x} y={CORR.y} w={CORR.w} h={CORR.h} t={frame} cells={cells} slotPs={slotPs} />
      {/* 三间准备室（沿廊侧依次排开——一句一室对位） */}
      <PrepRoom x={ROOMS[0].x} y={ROOMS[0].y} w={ROOM_W} h={ROOM_H} plaqueP={plaquePs[0]} litP={room1} slotP={clamp01(progress(frame, atSlot1, 14))} tag="①">
        <RoomInject litP={room1} slipPs={slipPs} />
      </PrepRoom>
      <PrepRoom x={ROOMS[1].x} y={ROOMS[1].y} w={ROOM_W} h={ROOM_H} plaqueP={plaquePs[1]} litP={room2} slotP={clamp01(progress(frame, atSlot2, 14))} tag="②">
        <RoomCompact litP={room2} bundleP={clamp01(progress(frame, atBundle, 18))} cutP={clamp01(progress(frame, atCut, 14))} />
      </PrepRoom>
      <PrepRoom x={ROOMS[2].x} y={ROOMS[2].y} w={ROOM_W} h={ROOM_H} plaqueP={plaquePs[2]} litP={room3} slotP={clamp01(progress(frame, atSlot3, 14))} tag="③">
        <RoomBase litP={room3} cardPs={cardPs} />
      </PrepRoom>
      {/* 室顶滑入槽位的归位道可视化（三站挂点齐的帧上面——走廊槽带已点亮三格） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'门口一道 · 准备三道 · 三站挂点齐'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 调用舱 + 恢复垫四徽章 + 舱门开启 + 远处岔口微光 ─────────────────────

const OneC: React.FC<{atPad: number; atBadges: number; atDoor: number; atFork: number}> = ({atPad, atBadges, atDoor, atFork}) => {
  const frame = useCurrentFrame();
  const pad = clamp01(progress(frame, atPad, 16));
  // 四徽章：限流(退一步)/超载(换备用)/超长(提额续接)/再压(小压块)——次序=口播
  const badgePs = [0, 1, 2, 3].map((k) => clamp01(progress(frame, atBadges + k * 13, 10)));
  const actPs = [0, 1, 2, 3].map((k) => clamp01(progress(frame, atBadges + k * 13 + 8, 14)));
  const door = ease(clamp01(progress(frame, atDoor, 18)));
  // 模型气泡自舱内升起（开口第一帧）
  const rise = ease(clamp01(progress(frame, atDoor + 10, 20)));
  const forkGlow = clamp01(progress(frame, atFork, 14));
  // 调用舱驻「调模型」拍位——环上该段以 SegArc 同族橙叠放标注（舱体骑跨中线）
  return (
    <AbsoluteFill>
      <CorridorWalk x={CORR.x} y={CORR.y} w={CORR.w} h={CORR.h} t={frame} cells={Array.from({length: 18}, () => 0.32)} slotPs={Array.from({length: 18}, (_, i) => (i === 3 || i === 7 || i === 15 ? 1 : 0))} />
      {/* 「调模型」拍位标注（环上段弧——舱体骑跨处） */}
      <div style={{position: 'absolute', left: 810, top: 60, padding: '3px 14px', borderRadius: 8, border: `2.5px solid ${withAlpha(theme.core, 0.7)}`, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap', opacity: pad}}>
        调模型
      </div>
      {/* 调用舱 + 恢复垫 + 四徽章 */}
      <RecoveryPad
        x={810}
        y={185}
        w={300}
        h={190}
        padP={pad}
        doorP={door}
        badges={badgePs.map((litP, k) => ({litP, actP: actPs[k]}))}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 20, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          调用舱
        </div>
      </RecoveryPad>
      {/* 恢复垫角标（只进角标） */}
      <div style={{position: 'absolute', left: 1150, top: 200, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
        error recovery
      </div>
      {/* 模型气泡（舱门开启后自舱内升起——开口第一帧） */}
      {rise > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 960 - 40,
            top: 185 + 60 - rise * 130,
            width: 80,
            height: 52,
            borderRadius: 14,
            border: `3px solid ${theme.core}`,
            background: withAlpha(theme.panel, 0.97),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 16,
            fontWeight: 700,
            color: theme.core,
            whiteSpace: 'nowrap',
            opacity: rise,
          }}
        >
          模型
        </div>
      ) : null}
      {/* 远处岔口微光（P2 承接位——仅微光预告不成分叉形态） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g opacity={0.25 + 0.75 * forkGlow}>
          <circle cx={1790} cy={MID_Y} r={10 + 8 * forkGlow} fill={theme.loop} opacity={0.35 + 0.45 * forkGlow} />
          <circle cx={1790} cy={MID_Y} r={26} fill="none" stroke={withAlpha(theme.loop, 0.5)} strokeWidth={2.5} opacity={forkGlow} />
        </g>
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'裹一层恢复垫 · 模型才开口'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1BeforeTheCall: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-06');
  const bC = w('p1-07', 'p1-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atBubble={wa('p1-01', 0.32) - bA.from}
          atLamp={wa('p1-01', 0.68) - bA.from}
          atScan={wa('p1-02', 0.18) - bA.from}
          atSign={wa('p1-02', 0.55) - bA.from}
          atGo={wa('p1-02', 0.78) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atPlaques={wa('p1-03', 0.3) - bB.from}
          atRoom1={wa('p1-04', 0.3) - bB.from}
          atSlips={wa('p1-04', 0.5) - bB.from}
          atSlot1={wa('p1-04', 0.86) - bB.from}
          atRoom2={wa('p1-05', 0.18) - bB.from}
          atBundle={wa('p1-05', 0.28) - bB.from}
          atCut={wa('p1-05', 0.68) - bB.from}
          atSlot2={wa('p1-05', 0.9) - bB.from}
          atRoom3={wa('p1-06', 0.24) - bB.from}
          atCards={wa('p1-06', 0.36) - bB.from}
          atSlot3={wa('p1-06', 0.82) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC
          atPad={wa('p1-07', 0.3) - bC.from}
          atBadges={wa('p1-08', 0.12) - bC.from}
          atDoor={wa('p1-09', 0.2) - bC.from}
          atFork={wa('p1-09', 0.72) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1BeforeTheCall;
