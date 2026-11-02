/** P0 一句「行」不算数（p0-01..p0-09，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：三环编队
 *  （主橙环〔M-001〕居中 + 两侧品红队友环——承 ep15 同款签名）之间口信气泡
 *  往来穿梭（灰白信壳、无编号）→ p0-01「差点闯祸」词落位其中一句「行」气泡
 *  急停放大悬停画面中央、边缘警示红晕渗出〔M-005〕（其余气泡降速退层）→
 *  p0-02「口信满天飞」词落位背景气泡流加速穿梭一拍、「最悬的」词落位悬停
 *  「行」再脉冲一次（重音镜 1–2s punch：全片钩子物首亮）→ 0-B 左右分屏问题
 *  现场：p0-03「关机，和审批」两词落位两区标题签先后点亮 → p0-04「直接掐掉」
 *  词落位左区执行流剪断、文件碎片悬空抖动定格（事故态）→ p0-05「先商量」词
 *  落位三步微缩预演签（发请求→等收尾→再动手）→ p0-06「审批同款」词落位右区
 *  同款三步链复贴（报计划→批→动手）、两链中缝同构亮线接通 → 0-C 两条场景线
 *  收拢：p0-07 两端节点先立、连线铺出 → p0-08「会漏/认错单/算两回」三词落位
 *  三道裂缝逐枚裂开（P3 三道检查的预埋）→ p0-09「一单一号」词落位靛蓝编号
 *  徽章自连线中点升起、放大定格悬停（登记表装置的种子形态首亮，重音镜）。
 *
 *  空间契约：三环等距同款、悬停「行」为唯一红晕元素且位于字幕安全区上方、
 *  署源角标右下角恒定不抢焦；左右分屏等高、预演签 ≤6 字/步、事故碎片有断点
 *  可辨；结构卡三节点单线、徽章为唯一靛蓝元素、裂缝图标关键词化。
 *  红线落实：静止纯文字卡禁（每拍均有状态推进）；右区不提前于 p0-06 点亮；
 *  掐断动作不显示为安全收尾态；徽章不提前于 p0-09 升起；裂缝图标不常驻高亮
 *  （P3 正源）；词落位 = wa(id,f)；y≥56 / bottom≥176；署源角标右下不进字幕区。
 *
 *  承接登记：0-C→1-A morph（同一主体 = 靛蓝编号徽章：0-C 末帧悬于连线中点
 *    放大定格 → 1-A 首帧同位在场、随后落位表头「编号」列签，色相/圆形轮廓/
 *    屏位居中逐帧不变——见 P1RegistryTable 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CrackIcon, LoopRing, STAGE, TeammateRing, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useShake} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，豁免登记于工作区配置）：右下常驻，一次淡入后恒定
 *  不抢焦；bottom 176 避开字幕条（承 ep1–ep15 SourceCredit 形态） */
const SourceCredit: React.FC<{lit?: number}> = ({lit = 1}) => (
  <div
    style={{
      position: 'absolute',
      right: 72,
      bottom: 176,
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

// ── 0-A 冷启动：三环编队 + 口信气泡穿梭 + 「行」急停悬停泛红 ────────────────

/** 背景口信气泡轨迹（确定性正弦往返——三环之间穿梭，无随机）：横穿带 y 320..560 */
const BUBBLES_0A = [
  {cx: 560, amp: 300, y: 330, speed: 1.7, ph: 0.0},
  {cx: 1360, amp: 280, y: 388, speed: 1.3, ph: 2.1},
  {cx: 700, amp: 340, y: 452, speed: 2.1, ph: 4.0},
  {cx: 1220, amp: 260, y: 520, speed: 1.1, ph: 1.2},
  {cx: 960, amp: 380, y: 288, speed: 1.9, ph: 5.2},
  {cx: 480, amp: 220, y: 560, speed: 1.5, ph: 3.3},
] as const;

/** 灰白信壳气泡（口信——无编号的薄信封） */
const NoteBubble: React.FC<{x: number; y: number; o?: number; hot?: number}> = ({x, y, o = 1, hot = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: x - 44,
      top: y - 26,
      width: 88,
      height: 52,
      borderRadius: 9,
      border: `2.5px solid ${hot > 0.3 ? withAlpha(theme.danger, 0.9) : withAlpha(theme.dim, 0.7)}`,
      background: withAlpha(theme.panel, 0.95),
      opacity: clamp01(o),
      boxShadow: hot > 0.05 ? `0 0 ${30 * hot}px ${withAlpha(theme.danger, 0.55 * hot)}` : 'none',
    }}
  >
    <svg width={88} height={52} viewBox="0 0 88 52">
      <path d="M6 10 L44 32 L82 10" fill="none" stroke={hot > 0.3 ? theme.danger : withAlpha(theme.dim, 0.7)} strokeWidth={2.5} />
    </svg>
  </div>
);

const ZeroA: React.FC<{atHover: number; atRush: number; atPulse: number}> = ({atHover, atRush, atPulse}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  // 「行」急停放大悬停（p0-01「差点闯祸」词落位——自轨迹位插值到屏中央）
  const hover = clamp01(progress(frame, atHover, 12));
  // 边缘警示红晕渗出（急停后红晕渐显并保持——唯一红晕元素）
  const ooze = clamp01(progress(frame, atHover + 8, 20));
  // 背景气泡降速退层（suppression——「行」成为唯一焦点）
  const calm = clamp01(progress(frame, atHover, 14));
  // 「口信满天飞」加速穿梭一拍（rush 脉冲后回落）
  const rush = Math.sin(Math.PI * clamp01(progress(frame, atRush, 26)));
  // 「最悬的」再脉冲一次（重音镜收束）
  const pulse = Math.sin(Math.PI * clamp01(progress(frame, atPulse, 20)));
  // 背景气泡速度系数：1 → 急停降 0.25 → rush 峰 1.8 → 回落
  const speedK = (1 - 0.75 * calm) * (1 + 0.8 * rush);
  // 「行」气泡：轨迹位（cx 960 带上往返）→ 中央悬停位
  const rawT = Math.sin(frame / 46);
  const flyX = 620 + rawT * 320;
  const flyY = 420 + Math.cos(frame / 63) * 26;
  const hangX = flyX + (960 - flyX) * hover;
  const hangY = flyY + (408 - flyY) * hover;
  const scale = 1 + hover * (0.9 + 0.05 * pulse);
  return (
    <AbsoluteFill>
      {/* 三环编队（承 ep15 同款签名：主橙环居中、两侧品红队友环同尺寸同转速） */}
      <div style={{position: 'absolute', left: STAGE.ring.x, top: STAGE.ring.y}}>
        <LoopRing size={STAGE.ring.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {STAGE.mates.map((m, i) => (
        <div key={`mt${i}`} style={{position: 'absolute', left: m.x, top: m.y}}>
          <TeammateRing size={m.size} dotProgress={(dot + 0.33 * (i + 1)) % 1} />
        </div>
      ))}
      {/* 背景口信气泡流（灰白信壳穿梭——加速一拍的可读实现：相位随 speedK 推进） */}
      {BUBBLES_0A.map((b, i) => {
        // 确定性往返：phase = frame·speed·speedK + ph（speedK 变速即时生效）
        const t = Math.sin(frame * 0.021 * b.speed * speedK + b.ph);
        const x = b.cx + t * b.amp;
        return <NoteBubble key={`bub${i}`} x={x} y={b.y} o={0.85 - 0.5 * calm + 0.15 * rush} />;
      })}
      {/* 「行」气泡（急停放大悬停中央——唯一红晕元素） */}
      <div
        style={{
          position: 'absolute',
          left: hangX,
          top: hangY,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div
          style={{
            width: 168,
            height: 118,
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.danger, 0.25 + 0.75 * ooze)}`,
            background: withAlpha(theme.panel, 0.98),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.serif,
            fontSize: 58,
            fontWeight: 700,
            color: theme.text,
            boxShadow: ooze > 0.03 ? `0 0 ${44 * ooze + 20 * pulse}px ${withAlpha(theme.danger, 0.6 * ooze + 0.25 * pulse)}` : 'none',
          }}
        >
          行
        </div>
      </div>
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'口信 · 无编号 · 答应过 ≠ 办妥'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 分屏问题现场：关机（硬掐事故）/ 审批（高风险等点头）+ 三步预演链 ──────

/** 分屏安全带红线（ep15 底环侵入返工教训）：容器 topY 200 + CHAIN_0B.y 590 +
 *  签高 ~54 = 绝对底边 844，恒 ≤ 860（字幕带上方 160px 带之上）；往下挪
 *  任一常量须同步核算。 */
const HALF_0B = {leftX: 110, rightX: 990, w: 820, topY: 200} as const;
const CHAIN_0B = {y: 590, stepW: 218} as const;

/** 三步微缩预演签链（0-B 左右两列同构——一次铺成 / 复贴点亮） */
const MiniChain: React.FC<{x: number; labels: readonly string[]; lit: number; copy?: number}> = ({x, labels, lit, copy = 0}) => (
  <div style={{position: 'absolute', left: x, top: CHAIN_0B.y, opacity: Math.max(lit, copy * 0.2), display: 'flex', alignItems: 'center', gap: 14}}>
    {labels.map((s, i) => (
      <React.Fragment key={`mc${i}`}>
        <div
          style={{
            width: CHAIN_0B.stepW,
            padding: '10px 0',
            textAlign: 'center',
            borderRadius: 10,
            border: `2.5px solid ${lit > 0.3 ? withAlpha(theme.dim, 0.8) : withAlpha(theme.panelBorder, 0.9)}`,
            background: withAlpha(theme.panel, 0.96),
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 600,
            color: lit > 0.3 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          {s}
        </div>
        {i < labels.length - 1 ? <span style={{color: theme.dim, fontSize: 22}}>→</span> : null}
      </React.Fragment>
    ))}
  </div>
);

const ZeroB: React.FC<{atTitleL: number; atTitleR: number; atCut: number; atChainL: number; atChainR: number; atBridge: number}> = ({
  atTitleL,
  atTitleR,
  atCut,
  atChainL,
  atChainR,
  atBridge,
}) => {
  const frame = useCurrentFrame();
  // 两区标题签先后点亮（p0-03「关机，和审批」两词）
  const tL = clamp01(progress(frame, atTitleL, DUR.f4));
  const tR = clamp01(progress(frame, atTitleR, DUR.f4));
  // 左区剪断（p0-04「直接掐掉」——执行流戛然断点 + 文件碎片悬空抖动一拍定格）
  const cut = clamp01(progress(frame, atCut, 10));
  const shake = useShake({at: atCut + 4, amp: 4, decay: true, dur: 26});
  // 三步预演签（p0-05 左链一次铺成 / p0-06 右链复贴）
  const chainL = clamp01(progress(frame, atChainL, 18));
  const chainR = clamp01(progress(frame, atChainR, 18));
  // 两链中缝同构亮线（结构相同的空间陈述〔M-003〕）
  const bridge = clamp01(progress(frame, atBridge, 14));
  return (
    <AbsoluteFill>
      {/* 左区 · 关机（队友执行流被硬掐——事故现场） */}
      <div style={{position: 'absolute', left: HALF_0B.leftX, top: HALF_0B.topY, width: HALF_0B.w}}>
        <div
          style={{
            display: 'inline-block',
            padding: '8px 24px',
            borderRadius: 10,
            border: `3px solid ${tL > 0.3 ? withAlpha(theme.danger, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: tL > 0.3 ? theme.text : theme.dim,
            opacity: 0.45 + 0.55 * tL,
          }}
        >
          关机
        </div>
        {/* 品红队友环体（执行流主体——被硬掐者） */}
        <div style={{position: 'absolute', left: 60, top: 110, opacity: 0.9}}>
          <TeammateRing size={230} dotProgress={(frame / 88) % 1} opacity={1 - 0.55 * cut} />
        </div>
        {/* 执行流条（横向流程——cut 剪断：右段断开坠落成断点） */}
        <div style={{position: 'absolute', left: 330, top: 200, width: 460}}>
          <div style={{height: 12, borderRadius: 6, background: withAlpha(theme.mate, 0.55), width: 460 - cut * 210}} />
          {cut > 0.3 ? (
            <div style={{position: 'absolute', left: 460 - cut * 210, top: 0}}>
              <svg width={54} height={26} viewBox="0 0 54 26">
                <path d="M4 13 L24 4 M4 13 L24 22 M50 13 L30 4 M50 13 L30 22" stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
              </svg>
            </div>
          ) : null}
        </div>
        {/* 写到一半的文件碎片（半截文件卡 + 光标断点——悬空抖动一拍定格） */}
        <div style={{position: 'absolute', left: 300, top: 300, transform: `translateY(${shake}px)`}}>
          <div
            style={{
              width: 260,
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.danger, 0.7 * cut + 0.25)}`,
              background: withAlpha(theme.panel, 0.96),
              padding: '12px 16px',
              opacity: 0.55 + 0.45 * cut,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>report.md · 写一半</div>
            {[0, 1, 2, 3].map((i) => (
              <div key={`fr${i}`} style={{height: 10, marginTop: 8, borderRadius: 3, background: i < 2 ? withAlpha(theme.dim, 0.5) : 'transparent', border: i < 2 ? 'none' : `2px dashed ${withAlpha(theme.panelBorder, 0.8)}`}} />
            ))}
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.danger, marginTop: 6, opacity: cut}}>{'▍断点'}</div>
          </div>
        </div>
        {/* 三步微缩预演签（发请求 → 等收尾 → 再动手——一次铺成） */}
        <MiniChain x={0} labels={['发请求', '等收尾', '再动手']} lit={chainL} />
      </div>
      {/* 右区 · 审批（高风险计划卡等点头） */}
      <div style={{position: 'absolute', left: HALF_0B.rightX, top: HALF_0B.topY, width: HALF_0B.w}}>
        <div
          style={{
            display: 'inline-block',
            padding: '8px 24px',
            borderRadius: 10,
            border: `3px solid ${tR > 0.3 ? withAlpha(theme.danger, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: tR > 0.3 ? theme.text : theme.dim,
            opacity: 0.45 + 0.55 * tR,
          }}
        >
          审批
        </div>
        {/* 队友举「高风险」计划卡（右侧队友位——等主代理点头） */}
        <div style={{position: 'absolute', left: 60, top: 110, opacity: 0.9}}>
          <TeammateRing size={230} dotProgress={(frame / 88) % 1} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 300,
            top: 216,
            width: 420,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.mate, 0.8)}`,
            background: withAlpha(theme.panel, 0.97),
            padding: '14px 18px',
            transform: `rotate(-2deg)`,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text}}>计划</span>
            <span
              style={{
                padding: '3px 12px',
                borderRadius: 7,
                border: `2.5px solid ${withAlpha(theme.danger, 0.9)}`,
                fontFamily: theme.sans,
                fontSize: 16,
                fontWeight: 700,
                color: theme.danger,
                whiteSpace: 'nowrap',
              }}
            >
              高风险
            </span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>{'plan_approval · 等一个点头'}</div>
        </div>
        {/* 主代理侧空白点头位（虚线圆——点头未发生；置于计划卡下方净空区） */}
        <div
          style={{
            position: 'absolute',
            left: 330,
            top: 400,
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: `3px dashed ${withAlpha(theme.core, 0.55)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 17,
            color: theme.dim,
            opacity: 0.8,
          }}
        >
          点头位
        </div>
        {/* 同款三步链复贴（报计划 → 批 → 动手） */}
        <MiniChain x={0} labels={['报计划', '批', '动手']} lit={chainR} copy={0.2} />
      </div>
      {/* 两链中缝同构亮线（p0-06「审批同款」——结构相同的空间陈述） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line
          x1={960}
          y1={CHAIN_0B.y - 26}
          x2={960}
          y2={CHAIN_0B.y + 82}
          stroke={withAlpha(theme.text, 0.85)}
          strokeWidth={4}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - bridge}
          opacity={bridge}
        />
      </svg>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'两件事同一结构 · 一方发请求，一方给回复'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 收拢结构卡：请求 →（编号徽章）→ 回复 + 三裂缝预埋 + 徽章首亮 ──────────

const CARD_0C = {x: 460, y: 300, w: 1000} as const;
const NODE_0C = {y: 60} as const;
const CRACKS_0C = [
  {x: 470, y: 620, label: '漏'},
  {x: 900, y: 640, label: '认错单'},
  {x: 1330, y: 620, label: '重复生效'},
] as const;

const ZeroC: React.FC<{atNodeL: number; atNodeR: number; atCracks: number[]; atBadge: number}> = ({atNodeL, atNodeR, atCracks, atBadge}) => {
  const frame = useCurrentFrame();
  // 结构卡入场（收拢——分屏两线压成一张卡）
  const card = clamp01(progress(frame, 2, 14));
  // 两端节点先立（p0-07「一方发请求」/「一方给回复」）
  const nL = clamp01(progress(frame, atNodeL, DUR.f4));
  const nR = clamp01(progress(frame, atNodeR, DUR.f4));
  // 连线铺出（右节点立起后自左向右描线）
  const line = clamp01(progress(frame, atNodeR + 4, 14));
  // 三裂缝逐枚裂开（p0-08「会漏/认错单/算两回」三词——P3 预埋，非常驻高亮）
  // 靛蓝编号徽章自连线中点升起、放大定格悬停（p0-09「一单一号」——重音镜）
  const badge = clamp01(progress(frame, atBadge, 16));
  const badgeGlow = Math.sin(Math.PI * clamp01(progress(frame, atBadge + 14, 26)));
  return (
    <AbsoluteFill>
      {/* 结构卡（三节点单线——请求 →（编号徽章）→ 回复） */}
      <div
        style={{
          position: 'absolute',
          left: CARD_0C.x,
          top: CARD_0C.y,
          width: CARD_0C.w,
          opacity: card,
          transform: `scale(${0.88 + 0.12 * card})`,
        }}
      >
        {/* 左节点 · 请求 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: NODE_0C.y,
            padding: '12px 30px',
            borderRadius: 12,
            border: `3px solid ${nL > 0.3 ? withAlpha(theme.dim, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: nL > 0.3 ? theme.text : theme.dim,
            opacity: 0.4 + 0.6 * nL,
            transform: `translateY(${(1 - nL) * 16}px)`,
          }}
        >
          请求
        </div>
        {/* 右节点 · 回复 */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: NODE_0C.y,
            padding: '12px 30px',
            borderRadius: 12,
            border: `3px solid ${nR > 0.3 ? withAlpha(theme.dim, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: nR > 0.3 ? theme.text : theme.dim,
            opacity: 0.4 + 0.6 * nR,
            transform: `translateY(${(1 - nR) * 16}px)`,
          }}
        >
          回复
        </div>
        {/* 连线（自左向右描线——两端节点之间） */}
        <svg width={CARD_0C.w} height={140} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <line
            x1={150}
            y1={NODE_0C.y + 26}
            x2={CARD_0C.w - 150}
            y2={NODE_0C.y + 26}
            stroke={withAlpha(theme.dim, 0.85)}
            strokeWidth={4}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - line}
          />
        </svg>
        {/* 靛蓝编号徽章（连线中点升起——morph 主体首亮：色相/圆形轮廓/屏位居中
            逐帧不变，1-A 展开成表后落位「编号」列签） */}
        <div
          style={{
            position: 'absolute',
            left: CARD_0C.w / 2 - 44,
            top: NODE_0C.y - 62 - badge * 26,
            transform: `scale(${0.5 + 0.5 * badge})`,
            opacity: badge,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              border: `5px solid ${theme.req}`,
              background: withAlphaM0(theme.req, 0.16),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 30,
              fontWeight: 700,
              color: theme.text,
              boxShadow: badgeGlow > 0.03 ? `0 0 ${36 * badgeGlow}px ${withAlpha(theme.req, 0.6)}` : 'none',
            }}
          >
            №
          </div>
        </div>
      </div>
      {/* 卡下缘三道裂缝图标位（p0-08 逐枚裂开显形——口信三种坏法，P3 预埋） */}
      {CRACKS_0C.map((c, i) => (
        <CrackIcon key={`ck${i}`} x={c.x} y={c.y} crackP={clamp01(progress(frame, atCracks[i], 16))} label={c.label} />
      ))}
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'一本一单一号的账 · request_id'}
      </div>
    </AbsoluteFill>
  );
};

const withAlphaM0 = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0RiskyOk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-06');
  const bC = w('p0-07', 'p0-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA atHover={wa('p0-01', 0.18) - bA.from} atRush={wa('p0-02', 0.25) - bA.from} atPulse={wa('p0-02', 0.58) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atTitleL={wa('p0-03', 0.35) - bB.from}
          atTitleR={wa('p0-03', 0.52) - bB.from}
          atCut={wa('p0-04', 0.3) - bB.from}
          atChainL={wa('p0-05', 0.22) - bB.from}
          atChainR={wa('p0-06', 0.05) - bB.from}
          atBridge={wa('p0-06', 0.4) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atNodeL={wa('p0-07', 0.18) - bC.from}
          atNodeR={wa('p0-07', 0.38) - bC.from}
          atCracks={[wa('p0-08', 0.14), wa('p0-08', 0.3), wa('p0-08', 0.65)].map((v) => v - bC.from)}
          atBadge={wa('p0-09', 0.42) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0RiskyOk;
