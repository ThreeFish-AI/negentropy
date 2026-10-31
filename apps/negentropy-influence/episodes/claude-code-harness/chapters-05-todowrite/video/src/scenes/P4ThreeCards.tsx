/** P4 真实产品的形态（p4-01..p4-08，3 镜）——分镜 4-A / 4-B / 4-C。
 *
 *  ★ 4-A 拉远全景（@pushIn 负增量——自 P3 峰值降压重锚）：三卡对照横列——
 *    教学版卡（左，承 P2 走查舞台缩微：紫色计数器与「固定三轮」签在位）→
 *    产品卡（中，暗待）→ 官方卡（右，暗待）；环体〔M-001〕缩悬教学版卡侧；
 *    「没有固定三轮」教学版卡「固定三轮」签打「教学设定」划线角标（差异三
 *    的视觉裁决）、归属句期间中右两卡微光预告（讲到才亮面）。
 *  ★ 4-B 产品卡+官方卡依次点亮（次序=口播）：产品卡展开事件触发条件链——
 *    节点一「3+ 待办全完成」（3+ 计数签）→ 节点二「验证还缺着」→ 接通触发
 *    提示签（事件触发 ≠ 轮数计数的形态差）；官方卡亮起 + 日期角标 2026-10-31
 *    同拍贴上 + 状态签翻至「关」位（默认不启用）+ 一条细线回指教学版/产品卡
 *    的清单装置（消换名断桥的视觉回扣）；「不需要书面清单」官方卡内脑图标
 *    不带清单卡直接走三步小示意 + 三步微勾。
 *  ★ 4-C 争议天平：横梁左盘「补丁」右盘「必需」各坐一枚清单卡缩微（两盘等
 *    重悬置不落盘——争议无裁决）；后景版本漂移曲线——能力演进横轴（恒左→
 *    右）、答案珠沿曲线游移不停（不给终态）；「根子」支点下方「规划靠谱吗」
 *    估量签；「规律更值钱」天平与曲线整体降为暗层、衬线体「规律」签亮起
 *    （回扣 3-D 金句、为 P5 让路）。
 *
 *  空间契约：三卡等大横列、教学版卡承 P2 走查视觉缩微（非新建）、划线只打
 *  在「三轮」签上、中右卡不提前亮面；两卡点亮次序=口播次序、日期角标只在
 *  官方卡、回指细线单一；官方卡无否定性红叉（禁引申为官方否定）、产品卡触
 *  发条件不写成轮数；天平任一盘不下沉、答案珠全程游移不定格、能力轴恒左→
 *  右、「版本漂移」字样只留视觉层。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；TodoWriteTool /
 *  verification nudge / CLAUDE_CODE_ENABLE_TASKS=0 等英文只进角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BrainGlyph, DebateScale, LoopRing, NagCounter} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 三卡几何（等大横列——4-A/4-B 共用） */
const CARDS = {w: 520, h: 560, y: 200, xs: [80, 700, 1320]} as const;

// ── 4-A 拉远全景：三卡轮廓 + 划线角标 ──────────────────────────────────

const FourA: React.FC<{atOut: number; atLine: number; atGlowMid: number; atGlowRight: number}> = ({atOut, atLine, atGlowMid, atGlowRight}) => {
  const frame = useCurrentFrame();
  // 拉远降压（pushIn 负增量——自 P3 峰值重锚三卡全景）
  const pull = usePushIn(atOut, {scale: -0.05, dur: DUR.f6});
  // 三卡轮廓自远处亮起（仅轮廓、卡面待命）
  const outline = useProgress(atOut, DUR.f6);
  // 「固定三轮」签打「教学设定」划线角标（划线只打在「三轮」签上）
  const strike = useProgress(atLine, DUR.f4, 'accelerate');
  const strikeFlash = useImpulse({at: atLine + DUR.f4, dur: DUR.f5, peak: 1});
  // 归属句期间中右两卡微光预告（讲到才亮面——微光≠亮面）
  const glowMid = useProgress(atGlowMid, DUR.f5);
  const glowRight = useProgress(atGlowRight, DUR.f5);
  const names = [
    {zh: '教学版', en: 'teaching', glow: 0},
    {zh: '产品', en: 'product', glow: glowMid},
    {zh: '官方', en: 'official', glow: glowRight},
  ];
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: pull}}>
        {names.map((n, i) => (
          <div key={n.en} style={{position: 'absolute', left: CARDS.xs[i], top: CARDS.y, width: CARDS.w, height: CARDS.h}}>
            <div
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                borderRadius: 16,
                border: `3px ${i === 0 ? 'solid' : 'dashed'} ${withAlpha(theme.dim, 0.55 + 0.35 * outline)}`,
                background: i === 0 ? withAlpha(theme.panel, 0.55) : 'transparent',
                opacity: 0.35 + 0.65 * outline,
                boxShadow: n.glow > 0.01 ? `0 0 ${26 * n.glow}px ${withAlpha(theme.dim, 0.35 * n.glow)}` : 'none',
                padding: '20px 24px',
              }}
            >
              <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
                <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{n.zh}</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{n.en}</span>
              </div>
              {/* 教学版卡内部：承 P2 走查舞台缩微（紫色计数器 + 「固定三轮」签在位） */}
              {i === 0 ? (
                <>
                  <div style={{marginTop: 22, opacity: outline}}>
                    <NagCounter x={0} y={0} w={330} count={3} lit={outline} scale={0.92} />
                  </div>
                  {/* 「固定三轮」签（划线打在「三轮」上） */}
                  <div style={{position: 'relative', display: 'inline-block', marginTop: 26, opacity: outline}}>
                    <span
                      style={{
                        fontFamily: theme.sans,
                        fontSize: 25,
                        fontWeight: 600,
                        color: theme.text,
                        border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
                        borderRadius: 8,
                        padding: '6px 16px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {'固定三轮'}
                    </span>
                    {/* 划线（教学设定角标——差异三的视觉裁决） */}
                    <span
                      style={{
                        position: 'absolute',
                        left: 4,
                        right: 4,
                        top: '52%',
                        height: 4,
                        background: theme.danger,
                        borderRadius: 2,
                        transform: `scaleX(${strike})`,
                        transformOrigin: 'left center',
                      }}
                    />
                  </div>
                  {strike > 0.9 ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 300,
                        top: 400,
                        fontFamily: theme.sans,
                        fontSize: 19,
                        color: theme.dim,
                        opacity: strikeFlash * 0.9,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {'教学设定 · 非产品行为'}
                    </div>
                  ) : null}
                </>
              ) : (
                /* 中右卡：暗待（微光预告≠亮面——讲到才亮） */
                <div
                  style={{
                    marginTop: 40,
                    fontFamily: theme.sans,
                    fontSize: 21,
                    color: withAlpha(theme.dim, 0.7),
                    textAlign: 'center',
                  }}
                >
                  {'待讲'}
                </div>
              )}
            </div>
          </div>
        ))}
        {/* 环体缩悬教学版卡侧（教学版循环位置锚——M-001 同形签名） */}
        <div style={{position: 'absolute', left: 560 - 105, top: 240, opacity: outline * 0.75}}>
          <LoopRing size={210} nodes={[]} showExit={false} />
        </div>
        {/* 读向签（左→右：教学版 → 产品 → 官方） */}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: outline * 0.5}}>
          <line x1={630} y1={CARDS.y - 34} x2={1250} y2={CARDS.y - 34} stroke={theme.dim} strokeWidth={2.5} strokeDasharray="10 9" />
          <path d={`M ${1244} ${CARDS.y - 42} L ${1266} ${CARDS.y - 34} L ${1244} ${CARDS.y - 26} Z`} fill={theme.dim} />
        </svg>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: outline * 0.85}}>
        {'教学版 ↔ 真实产品 ↔ 官方文档'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 产品卡条件链 + 官方卡状态签（依次点亮，次序=口播） ───────────────

const FourB: React.FC<{
  atProd: number;
  atNode1: number;
  atNode2: number;
  atFire: number;
  atOff: number;
  atDate: number;
  atSwitch: number;
  atLink: number;
  atDemo: number;
  atTicks: number;
}> = ({atProd, atNode1, atNode2, atFire, atOff, atDate, atSwitch, atLink, atDemo, atTicks}) => {
  const frame = useCurrentFrame();
  // 产品卡亮起（「教学设定」——承接 4-A 划线语义：真实触发另有其形）
  const prod = useProgress(atProd, DUR.f5);
  // 条件链：节点一（3+ 待办全完成）→ 节点二（验证还缺着）→ 接通触发提示签
  const n1 = useProgress(atNode1, DUR.f4);
  const n2 = useProgress(atNode2, DUR.f4);
  const fire = useProgress(atFire, DUR.f5);
  const fireFlash = useImpulse({at: atFire + DUR.f4, dur: DUR.f5, peak: 1});
  // 官方卡亮起 + 日期角标同拍贴上
  const off = useProgress(atOff, DUR.f5);
  const date = useProgress(atDate, DUR.f3);
  // 状态签翻至「关」位（默认不启用——flip 连续翻转，禁二态突变）
  const flip = useProgress(atSwitch, DUR.f5, 'decelerate');
  // 一条细线回指教学版/产品卡的清单装置（回指细线单一）
  const link = useProgress(atLink, DUR.f5, 'decelerate');
  // 官方卡内小示意：脑图标不带清单卡直接走三步（+ 三步微勾）
  const demo = useProgress(atDemo, DUR.f5);
  const ticks = [clamp01(progress(frame, atTicks, DUR.f3)), clamp01(progress(frame, atTicks + 5, DUR.f3)), clamp01(progress(frame, atTicks + 10, DUR.f3))];
  const cardShell = (i: number, lit: number) => (
    <div style={{position: 'absolute', left: CARDS.xs[i], top: CARDS.y, width: CARDS.w, height: CARDS.h}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 16,
          border: `3px solid ${lit > 0.4 ? withAlpha(theme.text, 0.6) : withAlpha(theme.dim, 0.4)}`,
          background: withAlpha(theme.panel, 0.4 + 0.4 * lit),
          padding: '20px 24px',
          opacity: 0.45 + 0.55 * lit,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, position: 'relative'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {i === 1 ? '产品' : '官方'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{i === 1 ? 'product' : 'official docs'}</span>
          {/* 日期角标（只在官方卡——截至口径钉点） */}
          {i === 2 ? (
            <span
              style={{
                position: 'absolute',
                right: 0,
                top: 4,
                fontFamily: theme.mono,
                fontSize: 15,
                color: theme.dim,
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: 6,
                padding: '2px 8px',
                opacity: date,
                whiteSpace: 'nowrap',
              }}
            >
              {'2026-10-31'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      {/* 教学版卡（暗层在场——4-A 缩微轮廓；缩微 dim ≥0.35 底线〔QA-3〕） */}
      <div style={{position: 'absolute', left: CARDS.xs[0], top: CARDS.y, width: CARDS.w, height: CARDS.h, opacity: 0.35}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3px dashed ${withAlpha(theme.dim, 0.5)}`,
            padding: '20px 24px',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'教学版（已讲）'}</span>
          <div style={{marginTop: 24, opacity: 0.8}}>
            <NagCounter x={0} y={0} w={330} count={3} lit={1} scale={0.85} />
          </div>
        </div>
      </div>
      {/* ── 产品卡：事件触发条件链（事件触发 ≠ 轮数计数的形态差） ── */}
      {cardShell(1, prod)}
      <div style={{position: 'absolute', left: CARDS.xs[1] + 28, top: CARDS.y + 90, width: CARDS.w - 56, opacity: prod}}>
        {/* 节点一：3+ 待办全完成（3+ 计数签） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 10,
            border: `2.5px solid ${n1 > 0.4 ? theme.mech : theme.panelBorder}`,
            background: n1 > 0.4 ? withAlpha(theme.mech, 0.1) : 'transparent',
            opacity: 0.45 + 0.55 * n1,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 18, fontWeight: 700, color: theme.mech}}>{'3+'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'待办全完成'}</span>
        </div>
        {/* 连线（节点一 → 节点二） */}
        <svg width={40} height={40} style={{display: 'block', margin: '4px 0 4px 24px', opacity: n2}}>
          <line x1={20} y1={2} x2={20} y2={34} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} />
          <path d="M 13 28 L 20 38 L 27 28 Z" fill={withAlpha(theme.dim, 0.7)} />
        </svg>
        {/* 节点二：验证还缺着 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 10,
            border: `2.5px solid ${n2 > 0.4 ? theme.mech : theme.panelBorder}`,
            background: n2 > 0.4 ? withAlpha(theme.mech, 0.1) : 'transparent',
            opacity: 0.45 + 0.55 * n2,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'验证还缺着'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'missing'}</span>
        </div>
        {/* 接通 → 触发提示签（事件触发形态） */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderRadius: 10,
            border: `2.5px solid ${theme.nag}`,
            background: withAlpha(theme.nag, 0.12 + 0.1 * fire),
            opacity: fire,
            boxShadow: fireFlash > 0.01 ? `0 0 ${20 * fireFlash}px ${withAlpha(theme.nag, 0.55)}` : 'none',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text}}>{'追加验证提示'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'verification nudge'}</span>
        </div>
        {/* 形态差注脚（事件触发 ≠ 轮数计数） */}
        <div style={{marginTop: 14, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: fire}}>
          {'事件触发 · 非轮数计数'}
        </div>
      </div>
      {/* ── 官方卡：状态签 + 小示意 ── */}
      {cardShell(2, off)}
      <div style={{position: 'absolute', left: CARDS.xs[2] + 28, top: CARDS.y + 90, width: CARDS.w - 56, opacity: off}}>
        {/* 状态签（翻至「关」位——默认不启用；无红叉，中性关位） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 18px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.dim, 0.6)}`,
            background: withAlpha(theme.panel, 0.7),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'任务工具'}</span>
          {/* 开关位（连续翻转：开 → 关；QA-11 禁二态突变） */}
          <div
            style={{
              width: 74,
              height: 36,
              borderRadius: 999,
              border: `2.5px solid ${theme.dim}`,
              position: 'relative',
              transform: `translateX(${(1 - flip) * 0}px)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                left: 3 + 36 * (1 - flip),
                width: 26,
                height: 26,
                borderRadius: 999,
                background: flip > 0.5 ? theme.dim : theme.ok,
                opacity: 0.9,
              }}
            />
          </div>
          <span style={{fontFamily: theme.sans, fontSize: 20, color: flip > 0.5 ? theme.dim : theme.ok}}>
            {flip > 0.5 ? '关' : '开'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'ENABLE_TASKS=0'}</span>
        </div>
        {/* 小示意：脑图标不带清单卡直接走三步（三步微勾） */}
        <div style={{marginTop: 22, opacity: demo}}>
          <BrainGlyph cx={110} cy={330} size={110} lit={demo} />
          <div style={{position: 'absolute', left: 200, top: 44, display: 'flex', flexDirection: 'column', gap: 10}}>
            {['第一步', '第二步', '第三步'].map((s, i) => (
              <div key={s} style={{display: 'flex', alignItems: 'center', gap: 10, opacity: 0.4 + 0.6 * ticks[i]}}>
                <svg width={22} height={22} viewBox="0 0 22 22">
                  <path d="M 4 11 L 9 16 L 18 5" fill="none" stroke={theme.ok} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={ticks[i]} />
                  <circle cx={11} cy={11} r={9} fill="none" stroke={withAlpha(theme.dim, 0.6)} strokeWidth={2} />
                </svg>
                <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{position: 'absolute', left: 0, top: 190, fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>
            {'不带书面清单 · 直接做多步'}
          </div>
        </div>
      </div>
      {/* 回指细线（单一——官方卡 → 产品卡/教学版卡的清单装置；消换名断桥的视觉回扣） */}
      {link > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path
            d={`M ${CARDS.xs[2] + 10} ${CARDS.y + 250} Q ${CARDS.xs[1] + 380} ${CARDS.y + 330}, ${CARDS.xs[1] + 120} ${CARDS.y + 268}`}
            fill="none"
            stroke={withAlpha(theme.mech, 0.3 * link)}
            strokeWidth={2}
            strokeDasharray="8 8"
          />
          <path
            d={`M ${CARDS.xs[2] + 10} ${CARDS.y + 250} Q ${CARDS.xs[1] + 380} ${CARDS.y + 330}, ${CARDS.xs[1] + 120} ${CARDS.y + 268}`}
            fill="none"
            stroke={withAlpha(theme.mech, 0.75 * link)}
            strokeWidth={3}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - link}
          />
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: off * 0.85}}>
        {'官方文档口径 · 截至 2026-10-31'}
      </div>
    </AbsoluteFill>
  );
};

// ── 4-C 争议天平 + 版本漂移曲线 ────────────────────────────────────────

const FourC: React.FC<{atScale: number; atPanL: number; atPanR: number; atRoot: number; atAxis: number; atDim: number; atLaw: number}> = ({
  atScale,
  atPanL,
  atPanR,
  atRoot,
  atAxis,
  atDim,
  atLaw,
}) => {
  const frame = useCurrentFrame();
  // 天平落位 + 两盘各点火（「补丁」「必需」）
  const scaleLit = useProgress(atScale, DUR.f5);
  const beam = useProgress(atScale + DUR.f3, DUR.f5);
  const panL = useProgress(atPanL, DUR.f4);
  const panR = useProgress(atPanR, DUR.f4);
  // 「根子」支点下方估量签
  const root = useProgress(atRoot, DUR.f5);
  // 能力轴滚动 + 答案珠游移（恒不停——不给终态）
  const axis = (frame - atAxis) / 90;
  const bead = 0.5 + 0.45 * Math.sin((frame - atAxis) / 34);
  // 「规律更值钱」：天平与曲线整体降暗层 + 衬线「规律」签亮起
  const dim = useProgress(atDim, DUR.f5);
  const law = useProgress(atLaw, DUR.f5);
  const lawFlash = useImpulse({at: atLaw + DUR.f4, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      <DebateScale cx={960} cy={440} lit={scaleLit} beamLit={beam} panL={panL} panR={panR} axisScroll={axis} bead={bead} dim={dim} />
      {/* 支点下方「规划靠谱吗？」估量签（根子） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 812,
          display: 'flex',
          justifyContent: 'center',
          opacity: root * (1 - dim),
        }}
      >
        <div
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`,
            fontFamily: theme.sans,
            fontSize: 23,
            color: theme.text,
          }}
        >
          {'根子：模型规划靠不靠谱？'}
        </div>
      </div>
      {/* 「规律更值钱」：暗层压上后衬线「规律」签亮起（回扣 3-D 金句、为 P5 让路） */}
      <AbsoluteFill style={{background: theme.bg, opacity: 0.68 * dim, pointerEvents: 'none'}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 430,
          display: 'flex',
          justifyContent: 'center',
          opacity: law,
          transform: `scale(${1 + 0.05 * lawFlash})`,
        }}
      >
        <div
          style={{
            padding: '26px 70px',
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.mech, 0.6)}`,
            background: withAlpha(theme.panel, 0.92),
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            boxShadow: lawFlash > 0.01 ? `0 0 ${30 * lawFlash}px ${withAlpha(theme.mech, 0.45)}` : 'none',
          }}
        >
          {'规律更值钱'}
        </div>
      </div>
      {/* 暗层下的天平底注（视觉层保留「版本漂移」字样——口播避撞） */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 18, color: theme.dim, opacity: (1 - dim) * 0.8}}>
        {'版本漂移 · 答案随版本游移'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P4ThreeCards: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-05');
  const bC = w('p4-06', 'p4-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A">
        <FourA
          atOut={wa('p4-01', 0.2) - bA.from}
          atLine={wa('p4-02', 0.42) - bA.from}
          atGlowMid={wa('p4-02', 0.72) - bA.from}
          atGlowRight={wa('p4-02', 0.9) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="4-B">
        <FourB
          atProd={wa('p4-03', 0.08) - bB.from}
          atNode1={wa('p4-03', 0.34) - bB.from}
          atNode2={wa('p4-03', 0.62) - bB.from}
          atFire={wa('p4-03', 0.86) - bB.from}
          atOff={wa('p4-04', 0.3) - bB.from}
          atDate={wa('p4-04', 0.42) - bB.from}
          atSwitch={wa('p4-04', 0.7) - bB.from}
          atLink={wa('p4-04', 0.92) - bB.from}
          atDemo={wa('p4-05', 0.22) - bB.from}
          atTicks={wa('p4-05', 0.66) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="4-C">
        <FourC
          atScale={wa('p4-06', 0.14) - bC.from}
          atPanL={wa('p4-06', 0.42) - bC.from}
          atPanR={wa('p4-06', 0.6) - bC.from}
          atRoot={wa('p4-07', 0.08) - bC.from}
          atAxis={wa('p4-07', 0.4) - bC.from}
          atDim={wa('p4-08', 0.34) - bC.from}
          atLaw={wa('p4-08', 0.62) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4ThreeCards;
