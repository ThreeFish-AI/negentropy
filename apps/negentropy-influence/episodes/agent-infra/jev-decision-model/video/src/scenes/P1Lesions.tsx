/** P1 四个病灶（storyboard §P1；镜 1-A..1-F = p1-01..p1-26，26 句）。
 *
 *  archify cue 清单（6 条，与分镜逐条对应；at/dur 一律由句边界独立重算）：
 *    1-A  ls-lesions @ p1-01（幕首例，默认 lead）
 *    1-C  tr-base    @ p1-08（默认 lead）
 *    1-C  tr-rlhf    @ p1-10（默认 lead；p1-09 为 Remotion 间隙 ⇒ 实例内自然恢复入场）
 *    1-E  ls-specs   @ p1-16（默认 lead）
 *    1-E  ls-rows12  @ p1-18（默认 lead）
 *    1-E  ls-mech    @ p1-21（默认 lead）
 *
 *  本幕局部装置（全 px 定位；内容 y≥56、底缘 ≤~910 避开字幕带）：
 *    BoardFrame/StickyNote  公告栏 + 贴纸（1-A 病灶面 / 1-E 翻面贴硬要求）
 *    ToneBubble+ProbRuler   语气气泡 vs 概率刻度尺 + 对照卡（1-B）
 *    TokenTypewriter        逐字吐字机＋秒计时器＋价签（1-C 左）
 *    LikeAudience           观众席点赞潮＋弹幕条（1-C 右）
 *    DocQuoteCard/ScaleDuel 官方文档卡 vs 优化目标天平（1-D）
 *    IfaceCard              POST /v1/systemone 两栏＋计费/价签/延迟（1-F）
 *    MechMapMini            右下机制地图小徽（1-E 末缩入，1-F 常驻 m1 呼吸）
 *    Badge                  三级角标本地实现（本幕只用 虚线=官方自报 / 实线=第三方实测 两档；
 *                           「我们复算」实心徽本幕无锚点，不实现——共用组件落地后可再收敛）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {CodeCard, Panel} from '../components/motifs';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

// ── 句窗口 API：at('句id') / dur('句id') 相对本镜起点（动效锚点一律由此推导） ──

type BeatApi = {
  win: {from: number; durationInFrames: number};
  at: (id: string) => number;
  dur: (id: string) => number;
  /** 本 beat 全局起点（覆盖门 cue 形态 `at('id') - bX.from` 用） */
  from: number;
};

const beatOf = (scene: SceneRange, a: string, b: string): BeatApi => {
  const win = beatWindow(scene.sentences, scene.from, a, b);
  return {
    win,
    at: (id) => beatWindow(scene.sentences, scene.from, id).from - win.from,
    dur: (id) => beatWindow(scene.sentences, scene.from, id).durationInFrames,
    from: win.from,
  };
};

// ── 三级角标（本地实现；全片图例在 0-C） ────────────────────────────────────

const Badge: React.FC<{kind: 'official' | 'third'; label: string; at?: number}> = ({
  kind,
  label,
  at = 0,
}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f3);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8, opacity: o}}>
      <svg width={22} height={22} viewBox="0 0 24 24">
        {/* 虚线描边圆徽＝官方自报；实线描边圆徽（带芯点）＝第三方实测 */}
        <circle
          cx={12}
          cy={12}
          r={9}
          fill="none"
          stroke={theme.dim}
          strokeWidth={kind === 'third' ? 2.4 : 1.8}
          strokeDasharray={kind === 'official' ? '3.5 3.5' : undefined}
        />
        {kind === 'third' ? <circle cx={12} cy={12} r={3} fill={theme.dim} /> : null}
      </svg>
      <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{label}</span>
    </div>
  );
};

// ── 主播剪影（base dim 中性光，不丑化） ────────────────────────────────────

const AnchorBust: React.FC<{x: number; y: number; scale?: number; halo?: number}> = ({
  x,
  y,
  scale = 1,
  halo = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 220,
      height: 210,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }}
  >
    {halo > 0 ? (
      <div
        style={{
          position: 'absolute',
          left: -46,
          top: -34,
          width: 312,
          height: 278,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.dim}30 0%, transparent 64%)`,
          opacity: halo,
        }}
      />
    ) : null}
    <svg width={220} height={210} viewBox="0 0 220 210">
      <circle cx={110} cy={72} r={44} fill={theme.dim} />
      <path d="M 34 210 Q 34 128 110 128 Q 186 128 186 210 Z" fill={theme.dim} />
    </svg>
  </div>
);

// ── 公告栏（1-A 病灶面 / 1-E 硬要求面共用几何） ────────────────────────────

const BOARD = {x: 360, y: 150, w: 1200, h: 660} as const;
const SLOT = {w: 545, h: 246} as const;
const slotPos = (r: number, c: number): {left: number; top: number} => ({
  left: BOARD.x + 44 + c * (SLOT.w + 22),
  top: BOARD.y + 118 + r * (SLOT.h + 24),
});

const BoardFrame: React.FC<{title: string; children?: React.ReactNode}> = ({title, children}) => (
  <div style={{position: 'absolute', left: BOARD.x, top: BOARD.y, width: BOARD.w, height: BOARD.h}}>
    <Panel style={{width: '100%', height: '100%', borderRadius: 18}}>
      <div
        style={{
          position: 'absolute',
          left: 46,
          top: 32,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 2,
        }}
      >
        {title}
      </div>
      {children}
    </Panel>
  </div>
);

/** 空槽位（四格待贴） */
const BoardSlots: React.FC = () => (
  <>
    {[0, 1].map((r) =>
      [0, 1].map((c) => {
        const p = slotPos(r, c);
        return (
          <div
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: SLOT.w,
              height: SLOT.h,
              border: `2px dashed ${theme.panelBorder}`,
              borderRadius: 12,
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: 14,
                bottom: 10,
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.panelBorder,
              }}
            >
              {String(r * 2 + c + 1).padStart(2, '0')}
            </div>
          </div>
        );
      }),
    )}
  </>
);

/** 贴纸：拍上（snap 弹簧）+ 可选格黄扫光（1-E 第一条） */
const StickyNote: React.FC<{
  left: number;
  top: number;
  w: number;
  h: number;
  rotate: number;
  at: number;
  border: string;
  bg: string;
  textColor: string;
  indexColor: string;
  index: string;
  text: string;
  fontSize?: number;
  sweepAt?: number;
}> = ({left, top, w, h, rotate, at, border, bg, textColor, indexColor, index, text, fontSize = 34, sweepAt}) => {
  const frame = useCurrentFrame();
  const slap = useSpring('snap', {at, dur: DUR.f4}); // spatial：拍上的过冲手感
  const o = progress(frame, at, 4); // effects：时长+缓动
  const sweepP = sweepAt !== undefined ? progress(frame, sweepAt + 8, 16) : 0; // 线性扫光
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: w,
        height: h,
        opacity: o,
        transform: `rotate(${rotate}deg) scale(${1.16 - 0.16 * slap})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: bg,
          border: `3px solid ${border}`,
          borderRadius: 8,
          boxShadow: '0 10px 26px rgba(0,0,0,0.38)',
          padding: '16px 22px 14px',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 19, color: indexColor, letterSpacing: 1}}>
          {index}
        </div>
        <div
          style={{
            fontFamily: theme.sans,
            fontWeight: 700,
            fontSize,
            color: textColor,
            marginTop: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </div>
        {/* 扫光带（格黄）：随句掠过贴纸 */}
        {sweepAt !== undefined ? (
          <div style={{position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden', pointerEvents: 'none'}}>
            <div
              style={{
                position: 'absolute',
                left: -160 + (w + 320) * sweepP,
                top: 0,
                width: 130,
                height: '100%',
                background: `linear-gradient(100deg, transparent, ${theme.slot}52, transparent)`,
              }}
            />
          </div>
        ) : null}
      </div>
      {/* 胶带 */}
      <div
        style={{
          position: 'absolute',
          left: w / 2 - 45,
          top: -11,
          width: 90,
          height: 22,
          background: 'rgba(255,255,255,0.16)',
          transform: 'rotate(-4deg)',
          borderRadius: 2,
        }}
      />
    </div>
  );
};

// ── 机制地图小徽（全片机制进度器的本幕实例） ───────────────────────────────
//  章序口径＝分镜「m1–m4 逐幕高亮」的幕序（P2 预报单 / P3 封卡 / P4 记分牌 / P6 三道闸），
//  与 lesions-to-specs 图内 M 徽同名；1-E 末「地图缩为右下角小徽」由本组件承接。

const MECH = [
  {id: 'm1', label: '预报单'},
  {id: 'm2', label: '封卡'},
  {id: 'm3', label: '记分牌'},
  {id: 'm4', label: '三道闸'},
] as const;

const MechMapMini: React.FC<{enterAt?: number; glowId?: string; glowAt?: number}> = ({
  enterAt,
  glowId,
  glowAt,
}) => {
  const frame = useCurrentFrame();
  const enter = useSpring('settle', {at: enterAt ?? 0, dur: DUR.f5});
  const o = enterAt === undefined ? 1 : progress(frame, enterAt, DUR.f3);
  // 一次完整呼吸周期（beat 级动作，显式帧数——不落时长标尺）
  const glow = glowAt !== undefined ? Math.sin(Math.PI * progress(frame, glowAt, 44)) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        bottom: 168,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        opacity: o,
        transform: `scale(${1.45 - 0.45 * enter})`, // 「缩为右下角小徽」的落位
        transformOrigin: 'right bottom',
        zIndex: 30,
      }}
    >
      {MECH.map((m) => {
        const hot = glowId === m.id && glow > 0;
        return (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 11px',
              borderRadius: 999,
              border: `1.5px solid ${theme.text}`,
              background: theme.panel,
              transform: hot ? `scale(${1 + 0.05 * glow})` : undefined,
              boxShadow: hot ? `0 0 ${18 * glow}px ${theme.slot}` : undefined,
            }}
          >
            <div style={{width: 7, height: 7, borderRadius: '50%', background: theme.text}} />
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.text}}>
              {`${m.id} ${m.label}`}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── 1-A 病灶公告栏（p1-01..03） ────────────────────────────────────────────

const LESION_STEPS = ['解析', '校验', '防脱轨'] as const;

const BeatA: React.FC<{b: BeatApi}> = ({b}) => {
  const frame = useCurrentFrame();
  const slap = useSpring('snap', {at: b.at('p1-02'), dur: DUR.f4});
  const stickO = progress(frame, b.at('p1-02'), 4);
  const steps = useStagger(4, {at: b.at('p1-03'), stride: 7, dur: DUR.f3});
  const s1 = slotPos(0, 0);
  return (
    <AbsoluteFill>
      <BoardFrame title={'应急办 · 病灶公告'}>
        <BoardSlots />
        {/* 病灶一贴纸：base dim 底 + 警示红描边（p1-02 拍上） */}
        <div
          style={{
            position: 'absolute',
            left: s1.left + (SLOT.w - 440) / 2,
            top: s1.top + 18,
            width: 440,
            height: 124,
            opacity: stickO,
            transform: `scale(${1.16 - 0.16 * slap})`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: theme.dim,
              border: `3px solid ${theme.danger}`,
              borderRadius: 8,
              boxShadow: '0 10px 26px rgba(0,0,0,0.38)',
              padding: '14px 22px',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.bg, letterSpacing: 1}}>
              {'病灶 01'}
            </div>
            <div
              style={{
                fontFamily: theme.sans,
                fontWeight: 700,
                fontSize: 36,
                color: theme.bg,
                marginTop: 6,
              }}
            >
              {'自由文本'}
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 440 / 2 - 45,
              top: -11,
              width: 90,
              height: 22,
              background: 'rgba(255,255,255,0.16)',
              transform: 'rotate(-4deg)',
              borderRadius: 2,
            }}
          />
        </div>
        {/* 三道虚线小工序 + 末端警示红叉（p1-03） */}
        {LESION_STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div
              style={{
                position: 'absolute',
                left: s1.left + 38 + i * 150,
                top: s1.top + 172,
                width: 118,
                height: 44,
                border: `2px dashed ${theme.dim}`,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.dim,
                opacity: steps[i],
              }}
            >
              {s}
            </div>
            {i < 2 ? (
              <div
                style={{
                  position: 'absolute',
                  left: s1.left + 38 + i * 150 + 122,
                  top: s1.top + 184,
                  fontFamily: theme.sans,
                  fontSize: 20,
                  color: theme.dim,
                  opacity: steps[i],
                }}
              >
                {'→'}
              </div>
            ) : null}
          </React.Fragment>
        ))}
        <svg
          width={28}
          height={28}
          viewBox="0 0 28 28"
          style={{position: 'absolute', left: s1.left + 38 + 3 * 150 + 4, top: s1.top + 180, opacity: steps[3]}}
        >
          <line x1={5} y1={5} x2={23} y2={23} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
          <line x1={23} y1={5} x2={5} y2={23} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
        </svg>
      </BoardFrame>
    </AbsoluteFill>
  );
};

// ── 1-B 语气不是概率（p1-04..07） ──────────────────────────────────────────

const RX0 = 960; // 概率刻度尺左端
const RX1 = 1780; // 右端
const posOf = (t: number) => RX0 + t * (RX1 - RX0);

const BeatB: React.FC<{b: BeatApi}> = ({b}) => {
  const frame = useCurrentFrame();
  const rise = useEnter('rise', {at: b.at('p1-04'), springPreset: 'settle'});
  const quote = useReveal('「应该不会下太大」', {at: b.at('p1-04'), cps: 7});
  const moveP = useProgress(b.at('p1-05'), DUR.f5, 'decelerate');
  const dangerO = progress(frame, b.at('p1-05') + 6, DUR.f3);
  const flip = useSpring('settle', {at: b.at('p1-06'), dur: DUR.f5});
  const cardO = progress(frame, b.at('p1-06'), DUR.f3);
  const calls = useCount({to: 10000, at: b.at('p1-06'), dur: DUR.f6});
  const markP = useProgress(b.at('p1-07'), DUR.f5, 'decelerate');
  const markO = progress(frame, b.at('p1-07'), DUR.f3);
  // 气泡行程：主播台上方 → 刻度尺左端外侧（p1-05 被吸向刻度尺、停在外侧）
  const bx = 250 + (555 - 250) * moveP;
  const by = 185 + (425 - 185) * moveP;
  const ax = posOf(0.9);
  const b2x = posOf(0.9) + (posOf(0.42) - posOf(0.9)) * markP;
  return (
    <AbsoluteFill>
      {/* 主播台近景（base dim 中性光） */}
      <AnchorBust x={300} y={330} scale={1.1} />
      <Panel style={{position: 'absolute', left: 150, top: 560, width: 560, height: 130, borderRadius: 14}}>
        <div style={{position: 'absolute', left: 24, top: 20, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
          {'主播台'}
        </div>
        <div style={{position: 'absolute', left: 24, top: 58, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
          {'口头表把握'}
        </div>
      </Panel>
      {/* 语气气泡（引用样式；p1-04 逐字上浮 → p1-05 移向刻度尺外侧） */}
      <div style={{position: 'absolute', left: bx, top: by, width: 380, height: 128, ...rise, zIndex: 4}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 18,
            padding: '24px 26px 0',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text}}>{quote}</div>
        </div>
        {/* 警示红描边（停在外侧＝进不了概率刻度） */}
        <div
          style={{
            position: 'absolute',
            inset: -3,
            border: `3px solid ${theme.danger}`,
            borderRadius: 20,
            opacity: dangerO,
            pointerEvents: 'none',
          }}
        />
        {/* 气泡尾 */}
        <div
          style={{
            position: 'absolute',
            left: 56,
            top: 118,
            width: 20,
            height: 20,
            background: theme.panel,
            borderRight: `2px solid ${theme.panelBorder}`,
            borderBottom: `2px solid ${theme.panelBorder}`,
            transform: 'rotate(45deg)',
          }}
        />
        {/* 「语气」标签 */}
        <div
          style={{
            position: 'absolute',
            right: -14,
            top: -20,
            padding: '4px 14px',
            borderRadius: 999,
            border: `2px solid ${theme.dim}`,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.dim,
            background: theme.bg,
          }}
        >
          {'语气'}
        </div>
      </div>
      {/* 概率刻度尺 0–100%（柱青＝概率轴） */}
      <div
        style={{
          position: 'absolute',
          left: RX0,
          top: 470,
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.dim,
        }}
      >
        {'概率刻度 0–100%'}
      </div>
      <div style={{position: 'absolute', left: RX0, top: 548, width: RX1 - RX0, height: 3, background: theme.bar, opacity: 0.85}} />
      {Array.from({length: 11}, (_, i) => {
        const major = i % 5 === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: RX0 + i * 82 - 1,
              top: major ? 532 : 538,
              width: 2,
              height: major ? 18 : 8,
              background: theme.dim,
              opacity: 0.7,
            }}
          />
        );
      })}
      <div style={{position: 'absolute', left: RX0 - 10, top: 566, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
        {'0%'}
      </div>
      <div style={{position: 'absolute', left: RX1 - 34, top: 566, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
        {'100%'}
      </div>
      {/* p1-07：两个标记在尺上错位拉开（九成把握 ≠ 九成会对；不印中点数值——错位是示意） */}
      <div style={{position: 'absolute', left: ax - 1.5, top: 506, width: 3, height: 40, background: theme.dim, opacity: markO}} />
      <div
        style={{
          position: 'absolute',
          left: ax - 150,
          top: 468,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: markO,
        }}
      >
        {'「九成把握」'}
      </div>
      <div style={{position: 'absolute', left: b2x - 1.5, top: 548, width: 3, height: 40, background: theme.bar, opacity: markO}} />
      <div
        style={{
          position: 'absolute',
          left: b2x - 130,
          top: 596,
          width: 260,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.bar,
          opacity: markO,
        }}
      >
        {'「九成会对」'}
      </div>
      {/* 错位带（警示红虚线：语气与兑现的落差＝病灶） */}
      <div
        style={{
          position: 'absolute',
          left: b2x,
          top: 524,
          width: Math.max(0, ax - b2x),
          borderTop: `2.5px dashed ${theme.danger}`,
          opacity: markO * 0.9,
        }}
      />
      {/* p1-06 对照卡：黑盒探测（实线徽＋计数器） */}
      <div
        style={{
          position: 'absolute',
          left: 990,
          top: 628,
          width: 560,
          height: 132,
          opacity: cardO,
          transform: `scaleY(${0.1 + 0.9 * flip})`,
          transformOrigin: 'bottom',
        }}
      >
        <Panel style={{width: '100%', height: '100%', borderRadius: 14, padding: '18px 24px'}}>
          <Badge kind="third" label={'外测·黑盒探测'} at={b.at('p1-06') + 4} />
          <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 38, color: theme.text}}>
            {Math.round(calls).toLocaleString('en-US')}
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginLeft: 10}}>{' 次调用'}</span>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 慢贵与讨好（p1-08..11） ────────────────────────────────────────────

const TOKEN_CHARS = ['今', '晚', '有', '雨', '带', '伞'] as const;

const TokenDrop: React.FC<{x: number; y: number; at: number; char: string}> = ({x, y, at, char}) => {
  const enter = useEnter('fall', {at, dist: 96, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 80, height: 80, ...enter}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 10,
          border: `2px solid ${theme.dim}`,
          background: '#12161F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 34,
          color: theme.dim,
        }}
      >
        {char}
      </div>
    </div>
  );
};

const HEARTS: [number, number][] = [
  [0, 0], [2, 0], [4, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [4, 2], [6, 2],
];

const BeatC: React.FC<{b: BeatApi}> = ({b}) => {
  const frame = useCurrentFrame();
  const tagPop = useSpring('snap', {at: b.at('p1-09'), dur: DUR.f4});
  const tagO = progress(frame, b.at('p1-09'), 4);
  const dmP = useProgress(b.at('p1-11'), 50, 'linear'); // 等速掠过：机械感的弹幕
  const dmO = progress(frame, b.at('p1-11'), 6);
  const halo = useBreathe({period: 96, base: 0.35, amp: 0.3});
  // 秒计时器：跨 p1-09..p1-11 持续递增（beat 级水位，显式帧数）
  const timer = useCount({from: 0, to: 8, at: b.at('p1-09'), dur: 240});
  const rows = [300, 380, 460];
  return (
    <AbsoluteFill>
      {/* 左：逐字吐字机（token 方块掉落 + 秒计时器） */}
      <Panel style={{position: 'absolute', left: 130, top: 180, width: 750, height: 520, borderRadius: 16}}>
        <div style={{position: 'absolute', left: 36, top: 26, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
          {'逐字吐字机'}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 36,
            top: 22,
            fontFamily: theme.mono,
            fontSize: 26,
            color: theme.dim,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {`${timer.toFixed(1)} s`}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 92,
            width: 670,
            height: 330,
            background: '#0B0E13',
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 10,
          }}
        >
          {/* 槽位与掉落的 token */}
          {TOKEN_CHARS.map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 55 + i * 96,
                top: 218,
                width: 80,
                height: 80,
                border: `2px dashed ${theme.panelBorder}`,
                borderRadius: 10,
              }}
            />
          ))}
          {TOKEN_CHARS.map((c, i) => (
            <TokenDrop key={c} x={55 + i * 96} y={218} at={b.at('p1-08') + 50 + i * 21} char={c} />
          ))}
        </div>
      </Panel>
      {/* p1-09 价签「以秒计」（警示红） */}
      <div
        style={{
          position: 'absolute',
          left: 716,
          top: 146,
          width: 216,
          height: 72,
          opacity: tagO,
          transform: `rotate(7deg) scale(${1.2 - 0.2 * tagPop})`,
          zIndex: 4,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: theme.danger,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontWeight: 700,
            fontSize: 30,
            color: theme.bg,
            boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 12,
              width: 10,
              height: 10,
              borderRadius: '50%',
              border: `2.5px solid ${theme.bg}`,
            }}
          />
          {'以秒计'}
        </div>
      </div>
      {/* 右：观众席点赞潮涌向主播（base dim） */}
      {rows.map((y, r) =>
        Array.from({length: 7}, (_, i) => (
          <div
            key={`${r}-${i}`}
            style={{
              position: 'absolute',
              left: 1020 + i * 80 + r * 26,
              top: y,
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: theme.dim,
              opacity: 0.34 + 0.1 * ((i + r) % 3),
            }}
          />
        )),
      )}
      {HEARTS.map(([c, r], i) => {
        const sx = 1020 + c * 80 + r * 26 + 15;
        const sy = rows[r] - 4;
        const p = (((frame + i * 13) % 62) + 62) % 62 / 62;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sx + (1596 - sx) * p,
              top: sy + (300 - sy) * p,
              fontFamily: theme.sans,
              fontSize: 17 + (i % 3) * 3,
              color: theme.dim,
              opacity: Math.sin(Math.PI * p) * 0.9,
            }}
          >
            {'♥'}
          </div>
        );
      })}
      <AnchorBust x={1580} y={240} scale={0.78} halo={halo * 0.8} />
      {/* p1-11 弹幕条「自信的胡话」以警示红掠过 */}
      <div
        style={{
          position: 'absolute',
          left: 1950 - 1060 * dmP,
          top: 552,
          height: 54,
          padding: '0 28px',
          borderRadius: 999,
          border: `2px solid ${theme.danger}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          fontFamily: theme.sans,
          fontWeight: 700,
          fontSize: 26,
          color: theme.danger,
          letterSpacing: 2,
          opacity: dmO,
          zIndex: 4,
        }}
      >
        {'自信的胡话'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-D 回马枪与公道话（p1-12..15） ────────────────────────────────────────

const BeatD: React.FC<{b: BeatApi}> = ({b}) => {
  const frame = useCurrentFrame();
  const cardIn = useEnter('slideL', {at: b.at('p1-12'), dist: 90, springPreset: 'settle'});
  const sig = useReveal('co-inventor(RLHF) = founder', {at: b.at('p1-13'), cps: 14});
  const sigO = progress(frame, b.at('p1-13'), DUR.f3);
  const tiltP = useProgress(b.at('p1-14'), DUR.f5, 'decelerate');
  const crackP = progress(frame, b.at('p1-14') + 12, DUR.f5);
  const okIn = useEnter('rise', {at: b.at('p1-15'), springPreset: 'settle'});
  const okPop = useSpring('snap', {at: b.at('p1-15') + 4, dur: DUR.f4});
  // 天平几何（SVG 局部坐标；θ>0 右端下沉，取负让「讨人喜欢」端压下）
  const theta = -3.5 * tiltP;
  const rad = (theta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const exL = 420 - 255 * cos;
  const eyL = 96 - 255 * sin;
  const exR = 420 + 255 * cos;
  const eyR = 96 + 255 * sin;
  const g = 56 * crackP;
  const Pan: React.FC<{ex: number; ey: number; color: string}> = ({ex, ey, color}) => (
    <g>
      <line x1={ex - 14} y1={ey} x2={ex - 78} y2={ey + 104} stroke={theme.panelBorder} strokeWidth={2} />
      <line x1={ex + 14} y1={ey} x2={ex + 78} y2={ey + 104} stroke={theme.panelBorder} strokeWidth={2} />
      <path
        d={`M ${ex - 96} ${ey + 104} Q ${ex} ${ey + 168} ${ex + 96} ${ey + 104} Z`}
        fill={theme.panel}
        stroke={color}
        strokeWidth={3}
      />
    </g>
  );
  return (
    <AbsoluteFill>
      {/* 左：官方文档引用卡（p1-12 滑入） */}
      <div style={{position: 'absolute', left: 140, top: 200, width: 700, height: 420, ...cardIn}}>
        <Panel style={{width: '100%', height: '100%', borderRadius: 16, padding: '30px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <Badge kind="official" label={'官方自报'} at={b.at('p1-13') + 6} />
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'官方文档'}</span>
          </div>
          <div style={{marginTop: 56, fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text}}>
            {'联合发明人＝创始人'}
          </div>
          {/* p1-13 署名打字机落定 */}
          <div style={{marginTop: 72, opacity: sigO}}>
            <div
              style={{
                width: 560,
                borderBottom: `2px dotted ${theme.panelBorder}`,
                paddingBottom: 12,
                fontFamily: theme.mono,
                fontSize: 26,
                color: theme.dim,
                whiteSpace: 'pre',
              }}
            >
              {sig}
            </div>
          </div>
        </Panel>
      </div>
      {/* 右：优化目标天平（讨人喜欢 vs 值得信任） */}
      <svg width={840} height={560} viewBox="0 0 840 560" style={{position: 'absolute', left: 950, top: 170}}>
        <rect x={414} y={96} width={12} height={340} fill={theme.panelBorder} />
        <circle cx={420} cy={96} r={9} fill={theme.dim} />
        <g transform={`rotate(${theta} 420 96)`}>
          <rect x={165} y={88} width={510} height={16} rx={8} fill={theme.panelBorder} />
        </g>
        <Pan ex={exL} ey={eyL} color={theme.dim} />
        <Pan ex={exR} ey={eyR} color={theme.bar} />
        {/* 底座两半：中缝裂隙拉开（p1-14） */}
        <rect x={300 - g / 2} y={432} width={114} height={48} rx={6} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
        <rect x={426 + g / 2} y={432} width={114} height={48} rx={6} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
      </svg>
      {/* 两端标签（跟随梁端移动） */}
      <div
        style={{
          position: 'absolute',
          left: 950 + exL - 96,
          top: 170 + eyL + 186,
          width: 192,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 600,
          color: theme.dim,
        }}
      >
        {'讨人喜欢'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 950 + exR - 96,
          top: 170 + eyR + 186,
          width: 192,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 600,
          color: theme.bar,
        }}
      >
        {'值得信任'}
      </div>
      {/* 裂隙关键词「两个优化目标」：从底座中缝上方浮出（恰好悬在两盘之间） */}
      <div
        style={{
          position: 'absolute',
          left: 950 + 420 - 170,
          top: 530,
          width: 340,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 27,
          fontWeight: 700,
          color: theme.text,
          opacity: crackP,
        }}
      >
        {'两个优化目标'}
      </div>
      {/* p1-15 公道话小卡：纯聊天＝正解（确认绿✓） */}
      <div style={{position: 'absolute', left: 1440, top: 664, width: 384, height: 104, ...okIn}}>
        <Panel style={{width: '100%', height: '100%', borderRadius: 14}}>
          <div
            style={{
              position: 'absolute',
              left: 26,
              top: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              fontFamily: theme.sans,
              fontSize: 28,
              fontWeight: 600,
              color: theme.text,
            }}
          >
            {'纯聊天＝正解'}
          </div>
          <svg
            width={38}
            height={38}
            viewBox="0 0 38 38"
            style={{
              position: 'absolute',
              right: 22,
              top: 33,
              transform: `scale(${0.5 + 0.5 * okPop})`,
            }}
          >
            <circle cx={19} cy={19} r={17} fill={theme.ok} />
            <path d="M 10 19.5 L 16.5 26 L 28 13.5" fill="none" stroke={theme.bg} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-E 四条硬要求换卡（p1-16..21） ────────────────────────────────────────

const REQS = ['只填格', '报几成兑现几成', '一屏全单作答', '秒回且便宜'] as const;

const BeatE: React.FC<{b: BeatApi; scene: SceneRange}> = ({b, scene}) => {
  const frame = useCurrentFrame();
  // 覆盖门正则只认裸 `at('id') - bX.from` / `dur('id')` 全局帧形态（cue 字面量专用）
  const at = (id: string) => beatWindow(scene.sentences, scene.from, id).from;
  const dur = (id: string) => beatWindow(scene.sentences, scene.from, id).durationInFrames;
  const flip = useSpring('settle', {at: b.at('p1-17'), dur: DUR.f5});
  const boardO = progress(frame, b.at('p1-17'), 5);
  // 贴纸时点：#1 随翻面落定；#2 在 p1-18（ls-rows12 讲 r2）的图窗内拍上、
  // 回公告栏时已贴好（分镜只写「p1-19/20 贴第三、四条」，第二条由对照链镜承担）；
  // #3 @p1-19、#4 @p1-20 逐句贴上。
  const stickAt = [
    b.at('p1-17') + 10,
    b.at('p1-18') + b.dur('p1-18'),
    b.at('p1-19'),
    b.at('p1-20'),
  ];
  // 机制地图小徽：p1-21 章节放完后缩入右下角（取窗口尾部显式帧数）
  const miniAt = b.at('p1-21') + b.dur('p1-21') - 34;
  return (
    <AbsoluteFill>
      <ArchifyYield
        cues={[
          {at: b.at('p1-16'), durationInFrames: b.dur('p1-16')},
          {at: b.at('p1-18'), durationInFrames: b.dur('p1-18')},
          {at: b.at('p1-21'), durationInFrames: b.dur('p1-21')},
        ]}
      >
        <AbsoluteFill style={{perspective: 1200}}>
          <div style={{position: 'absolute', inset: 0, opacity: boardO, transform: `rotateY(${(1 - flip) * 82}deg)`}}>
            <BoardFrame title={'应急办 · 新岗位要求'}>
              <BoardSlots />
              {REQS.map((text, i) => {
                const s = slotPos(i < 2 ? 0 : 1, i % 2);
                return (
                  <StickyNote
                    key={text}
                    left={s.left + (SLOT.w - 460) / 2}
                    top={s.top + 62}
                    w={460}
                    h={118}
                    rotate={i % 2 === 0 ? -1.6 : 1.2}
                    at={stickAt[i]}
                    border={theme.slot}
                    bg={'#1B2231'} // panel 微亮派生（贴纸与栏底拉开）
                    textColor={theme.text}
                    indexColor={theme.slot}
                    index={`硬要求 ${String(i + 1).padStart(2, '0')}`}
                    text={text}
                    sweepAt={i === 0 ? b.at('p1-17') : undefined}
                  />
                );
              })}
            </BoardFrame>
          </div>
        </AbsoluteFill>
      </ArchifyYield>
      <ArchifyRecap
        slug="lesions-to-specs"
        caption="四个病灶，四条硬要求，四个机制"
        cues={[
          {chapterId: 'ls-specs', at: at('p1-16') - b.from, durationInFrames: dur('p1-16')},
          {chapterId: 'ls-rows12', at: at('p1-18') - b.from, durationInFrames: dur('p1-18')},
          {chapterId: 'ls-mech', at: at('p1-21') - b.from, durationInFrames: dur('p1-21')},
        ]}
      />
      {/* 机制地图缩为右下角小徽（置于 ArchifyRecap 之后：叠在冻结末帧之上） */}
      <MechMapMini enterAt={miniAt} />
    </AbsoluteFill>
  );
};

// ── 1-F 接口与价签（p1-22..26） ────────────────────────────────────────────

const BeatF: React.FC<{b: BeatApi}> = ({b}) => {
  const frame = useCurrentFrame();
  const inL = useEnter('slideL', {at: b.at('p1-22'), dist: 90, springPreset: 'settle'});
  const inR = useEnter('slideR', {at: b.at('p1-22'), dist: 90, springPreset: 'settle'});
  const readHot = useImpulse({at: b.at('p1-23'), dur: DUR.f6, peak: 1});
  const readO = progress(frame, b.at('p1-23'), DUR.f3);
  const penOk = progress(frame, b.at('p1-23') + 6, DUR.f3);
  const penPop = useSpring('snap', {at: b.at('p1-23') + 6, dur: DUR.f4});
  const price = useCount({from: 0, to: 4.2, at: b.at('p1-24'), dur: DUR.f5});
  const pricePop = useSpring('settle', {at: b.at('p1-24'), dur: DUR.f5});
  const priceO = progress(frame, b.at('p1-24'), DUR.f3);
  const latO = progress(frame, b.at('p1-25'), DUR.f4);
  return (
    <AbsoluteFill>
      {/* 请求栏（资料进） */}
      <div style={{position: 'absolute', left: 200, top: 196, width: 680, ...inL}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.gate, marginBottom: 10}}>
          {'请求 · 资料进'}
        </div>
        <CodeCard
          lines={['POST /v1/systemone', '', '{', '  "state": { … },', '  "questions": [ … ]', '}']}
          width={680}
          accent={theme.gate}
          framesPerLine={4}
          showLineNumbers={false}
        />
      </div>
      {/* 响应栏（单出） */}
      <div style={{position: 'absolute', left: 1040, top: 196, width: 680, ...inR}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.gate, marginBottom: 10}}>
          {'响应 · 单出'}
        </div>
        <CodeCard
          lines={['200 OK', '', '{', '  "model": "…",', '  "answers": [ … ],', '  "usage": { … }', '}']}
          width={680}
          accent={theme.gate}
          framesPerLine={4}
          showLineNumbers={false}
        />
      </div>
      {/* 计费行：只亮「读」侧（闸品）；「落笔免费」盖确认绿勾 */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 620,
          width: 1520,
          display: 'flex',
          gap: 24,
          opacity: progress(frame, b.at('p1-22') + 10, DUR.f4),
        }}
      >
        <div
          style={{
            flex: 1,
            height: 104,
            borderRadius: 14,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '0 30px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius: 14,
              border: `2px solid ${theme.gate}`,
              opacity: readO,
              boxShadow: `0 0 ${26 * readHot}px ${theme.gate}`,
              pointerEvents: 'none',
            }}
          />
          <span style={{fontFamily: theme.mono, fontSize: 36, fontWeight: 700, color: theme.gate}}>{'读'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{'按资料计费'}</span>
        </div>
        <div
          style={{
            flex: 1,
            height: 104,
            borderRadius: 14,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '0 30px',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 36, fontWeight: 700, color: theme.text}}>{'落笔'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{'免费'}</span>
          <svg width={26} height={26} viewBox="0 0 26 26" style={{marginLeft: 4}}>
            <path
              d="M 4 22 L 4 16 L 16 4 L 22 10 L 10 22 Z"
              fill="none"
              stroke={theme.dim}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </svg>
          <svg
            width={34}
            height={34}
            viewBox="0 0 38 38"
            style={{marginLeft: 'auto', opacity: penOk, transform: `scale(${0.5 + 0.5 * penPop})`}}
          >
            <circle cx={19} cy={19} r={17} fill={theme.ok} />
            <path d="M 10 19.5 L 16.5 26 L 28 13.5" fill="none" stroke={theme.bg} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {/* p1-24 价签角标（官方自报 · 虚线徽） */}
      <div
        style={{
          position: 'absolute',
          left: 1452,
          top: 118,
          width: 356,
          opacity: priceO,
          transform: `rotate(6deg) scale(${1.18 - 0.18 * pricePop})`,
          zIndex: 5,
        }}
      >
        <div
          style={{
            background: theme.panel,
            border: `2px dashed ${theme.dim}`,
            borderRadius: 10,
            padding: '14px 18px',
          }}
        >
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
            <span style={{fontFamily: theme.mono, fontSize: 40, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
              {`${price.toFixed(1)}¢`}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'/ 百万计费单位'}</span>
          </div>
          <div style={{marginTop: 8}}>
            <Badge kind="official" label={'官方自报'} at={b.at('p1-24') + 6} />
          </div>
        </div>
      </div>
      {/* p1-25 延迟行：双口径小注并排（官方／外测） */}
      <div
        style={{
          position: 'absolute',
          left: 610,
          top: 760,
          width: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 30,
          opacity: latO,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.text}}>{'延迟 ≈ 0.x s'}</span>
        <Badge kind="official" label={'官方口径'} at={b.at('p1-25') + 4} />
        <Badge kind="third" label={'外测口径'} at={b.at('p1-25') + 8} />
      </div>
      {/* p1-26 机制地图 m1 呼吸一次（P2 预告） */}
      <MechMapMini glowId="m1" glowAt={b.at('p1-26')} />
    </AbsoluteFill>
  );
};

// ── 幕组件：六镜沿 beat 切，句区间连续无交叠 ────────────────────────────────

export const P1Lesions: React.FC<{scene: SceneRange}> = ({scene}) => {
  // 全局帧 at/dur：覆盖门 cue 字面量专用形态（装置动效用各 beat 的相对帧 bX.at/bX.dur）
  const at = (id: string) => beatWindow(scene.sentences, scene.from, id).from;
  const dur = (id: string) => beatWindow(scene.sentences, scene.from, id).durationInFrames;
  const A = beatOf(scene, 'p1-01', 'p1-03');
  const B = beatOf(scene, 'p1-04', 'p1-07');
  const C = beatOf(scene, 'p1-08', 'p1-11');
  const D = beatOf(scene, 'p1-12', 'p1-15');
  const E = beatOf(scene, 'p1-16', 'p1-21');
  const F = beatOf(scene, 'p1-22', 'p1-26');
  return (
    <AbsoluteFill>
      <Sequence {...A.win} name="1-A 病灶公告栏">
        <ArchifyYield cues={[{at: A.at('p1-01'), durationInFrames: A.dur('p1-01')}]}>
          <BeatA b={A} />
        </ArchifyYield>
        <ArchifyRecap
          slug="lesions-to-specs"
          caption="四个病灶，四条硬要求，四个机制"
          cues={[{chapterId: 'ls-lesions', at: at('p1-01') - A.from, durationInFrames: dur('p1-01')}]}
        />
      </Sequence>
      <Sequence {...B.win} name="1-B 语气不是概率">
        <BeatB b={B} />
      </Sequence>
      <Sequence {...C.win} name="1-C 慢贵与讨好">
        <ArchifyYield
          cues={[
            {at: C.at('p1-08'), durationInFrames: C.dur('p1-08')},
            {at: C.at('p1-10'), durationInFrames: C.dur('p1-10')},
          ]}
        >
          <BeatC b={C} />
        </ArchifyYield>
        <ArchifyRecap
          slug="rlhf-rlvr-rlcd"
          caption="同一个底座，三条后训练路径"
          cues={[
            {chapterId: 'tr-base', at: at('p1-08') - C.from, durationInFrames: dur('p1-08')},
            {chapterId: 'tr-rlhf', at: at('p1-10') - C.from, durationInFrames: dur('p1-10')},
          ]}
        />
      </Sequence>
      <Sequence {...D.win} name="1-D 回马枪与公道话">
        <BeatD b={D} />
      </Sequence>
      <Sequence {...E.win} name="1-E 四条硬要求换卡">
        <BeatE b={E} scene={scene} />
      </Sequence>
      <Sequence {...F.win} name="1-F 接口与价签">
        <BeatF b={F} />
      </Sequence>
    </AbsoluteFill>
  );
};
