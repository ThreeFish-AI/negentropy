/** P0 同一张桌子（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：0-A 系列片头交棒后冷启动直入（开篇视听合力 I-039）：同一目录窗口
 *  里一份配置文件卡摊开，p0-01「挤着」词落位三支异色光标（灰白族异亮度）同时
 *  落笔压上文件卡〔M-005〕→ p0-02「同一个配置文件」词落位同一行被两支笔先后
 *  改写（字符翻转叠写）→ p0-03「后写的盖掉先写的」词落位一段已完成字符整块
 *  被后笔覆盖褪色、「哪笔是谁的」词落位覆盖层上作者小色点全部溶解消失（归属
 *  不可辨的具象）→ 0-B 问题图：p0-04「任务板」「收件箱」两小卡先后亮起闪一拍
 *  〔M-005〕、「没人管」词落位两卡各退半档（暗层化）+ 中央「在哪干？」问号
 *  放大悬停一拍（钢青描边——唯一居中焦点）→ p0-05「不是让大家小心点」词落位
 *  「自觉」小签浮现即划掉、「一间独立的房」词落位答案位浮出一间房形轮廓初光
 *  （兰紫描边一闪，预告主装置）→ 0-C 答案图·主装置全局位首现：p0-06「一本账」
 *  词落位账本自底部立起落定〔M-005〕、「好几间房」词落位侧沿房槽 1→3 依次
 *  点亮轮廓（兰紫描边 stagger）、「机制是现成的」词落位各房细线牵回账本侧沿
 *  接通（挂靠拓扑成型）→ p0-07「一道守卫」词落位拆房侧位守卫小签亮出钢青
 *  描边一闪（半句钩，P3 兑现）〔M-003〕。
 *
 *  空间契约（安全带实算）：0-A 目录窗底 180+520=700 / 文件卡底 320+300=620；
 *  0-B 两小卡底 300+230=530 / 答案位房形底 560+190=750；0-C 账本体底
 *  250+420=670（房槽挂侧沿不出账本 y 域）、环体预留位底 430+150=580、守卫签
 *  底 ≈ 560+58=618——全部 ≤ 860；装置 y≥120 ≥ 56。署源角标右下角 bottom 176
 *  恒定不抢焦。计数与口播一致（三支光标）；「自觉」签为唯一红闪。
 *  红线落实：静止纯文字卡禁（每拍有状态推进）、光标禁拟人化动作、小卡文字
 *  禁成句、问号禁常驻剧场化（0-B 问题图、答案图在 0-C）、房内禁显字（P1 粮）、
 *  守卫签禁提前展开成卡；词落位 = wa(id,f)。
 *
 *  承接登记：0-C→1-A morph（同一主体 = 账本+房槽组：0-C 末帧账本居中小比例、
 *  三间房暗态轮廓挂侧 → 1-A 首帧同布局全局一拍 → 急推放大，房槽轮廓/细线
 *  拓扑/账本封面描边逐帧不变、仅尺度变化；见 P1LedgerAndRooms 头注 morph 段）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CursorArrow, GuardBadge, LedgerBlock, mixHex} from '../components/motifs';
import {DUR, clamp01, progress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，豁免登记于工作区配置 vibe-video.toml）：右下常驻，
 *  一次淡入后恒定不抢焦；bottom 176 避开字幕条（承 ep1–ep17 SourceCredit 形态） */
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

/** 三支光标色（灰白族异亮度——两支对口播两角色、一支泛指「几个」） */
const CURSOR_TONES = [
  theme.text,
  mixHex(theme.text, theme.dim, 0.34),
  mixHex(theme.text, theme.dim, 0.66),
] as const;

// ── 0-A 同目录互踩现场：目录窗 + 配置文件卡 + 三支光标叠写 ────────────────────

/** 0-A 布局（安全带实算：窗底 700 / 卡底 620，恒 ≤ 860） */
const WIN_0A = {x: 560, y: 180, w: 800, h: 520} as const;
const FILE_0A = {x: 640, y: 320, w: 640, h: 300} as const;
/** 三支光标进场位（卡顶上方，落笔行程 ~90px） */
const CURSORS_0A = [
  {x: 760, y: 210},
  {x: 880, y: 196},
  {x: 1000, y: 216},
] as const;
/** 争议行（卡内第 3 行——两支笔先后改写 / 后笔覆盖段） */
const ROW_Y_0A = 148;
const ROW_H_0A = 34;

const ZeroA: React.FC<{atCur: number; atRewrite: number; atCover: number; atDots: number}> = ({
  atCur,
  atRewrite,
  atCover,
  atDots,
}) => {
  const frame = useCurrentFrame();
  // 三支光标同时入场压上文件卡（「挤着」——同时落笔，先后仅半拍）
  const curIn = clamp01(progress(frame, atCur, DUR.f5));
  // 同一行被两支笔先后改写（字符翻转叠写——两段 sweep 各半）
  const rewrite = clamp01(progress(frame, atRewrite, 26));
  const sweep1 = Math.min(1, rewrite * 2);
  const sweep2 = Math.max(0, rewrite * 2 - 1);
  // 后笔覆盖：一段已完成字符整块被覆盖褪色
  const cover = clamp01(progress(frame, atCover, 22));
  // 覆盖层上作者小色点全部溶解（归属不可辨）
  const dots = clamp01(progress(frame, atDots, 20));
  return (
    <AbsoluteFill>
      {/* 目录窗口（深色中央——窗口条 + 文件清单 + 摊开的配置文件卡） */}
      <div
        style={{
          position: 'absolute',
          left: WIN_0A.x,
          top: WIN_0A.y,
          width: WIN_0A.w,
          height: WIN_0A.h,
          borderRadius: 16,
          border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
          background: withAlpha(theme.panel, 0.92),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 22px',
            borderBottom: `2px solid ${withAlpha(theme.panelBorder, 0.9)}`,
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{width: 12, height: 12, borderRadius: '50%', background: withAlpha(theme.dim, 0.5)}} />
          {'~/team-project'}
        </div>
        {/* 窗内文件清单（暗行——同一目录里的既有文件） */}
        {['src/', 'tests/', 'README.md', 'config.py'].map((f, i) => (
          <div
            key={`wf${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 26px',
              fontFamily: theme.mono,
              fontSize: 17,
              color: i === 3 ? theme.text : theme.dim,
              whiteSpace: 'nowrap',
              opacity: 0.85,
            }}
          >
            <span style={{color: theme.dim}}>{i < 2 ? '▸' : '·'}</span>
            {f}
          </div>
        ))}
      </div>
      {/* 配置文件卡摊开（角标 config.py——五段字符行） */}
      <div style={{position: 'absolute', left: FILE_0A.x, top: FILE_0A.y, width: FILE_0A.w, height: FILE_0A.h}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.dim, 0.7)}`,
            background: withAlpha(theme.panel, 0.98),
            padding: '16px 24px',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap', marginBottom: 12}}>
            {'config.py'}
          </div>
          {/* 常规行 ×3（上）+ 争议行 + 常规行 ×1（下）——字符条段 */}
          {[0, 1].map((r) => (
            <div key={`fr${r}`} style={{display: 'flex', gap: 8, height: ROW_H_0A, alignItems: 'center'}}>
              {Array.from({length: 11}, (_, i) => (
                <span
                  key={`fc${r}-${i}`}
                  style={{
                    width: 26 + ((r + i) % 3) * 10,
                    height: 12,
                    borderRadius: 3,
                    background: withAlpha(theme.dim, 0.3),
                  }}
                />
              ))}
            </div>
          ))}
          {/* 争议行（两支笔先后改写——sweep1 前半 / sweep2 后半覆盖；后笔覆盖段褪色） */}
          <div style={{position: 'relative', display: 'flex', gap: 8, height: ROW_H_0A, alignItems: 'center'}}>
            {Array.from({length: 11}, (_, i) => (
              <span
                key={`row2-${i}`}
                style={{
                  width: 26 + (i % 3) * 10,
                  height: 12,
                  borderRadius: 3,
                  background: withAlpha(theme.dim, 0.3),
                }}
              />
            ))}
            {/* 第一笔改写层（光标一色调——前 5 段） */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                width: 220 * sweep1,
                height: 20,
                borderRadius: 4,
                background: withAlpha(CURSOR_TONES[0], 0.32),
                border: `2px solid ${withAlpha(CURSOR_TONES[0], 0.6)}`,
                opacity: 1 - sweep2 * 0.75,
              }}
            />
            {/* 第二笔覆盖层（光标二色调——盖掉前笔；p0-03 整块褪色） */}
            <div
              style={{
                position: 'absolute',
                left: 120,
                top: 6,
                width: 300 * sweep2,
                height: 20,
                borderRadius: 4,
                background: withAlpha(CURSOR_TONES[1], 0.34),
                border: `2px solid ${withAlpha(CURSOR_TONES[1], 0.62)}`,
                opacity: 1 - cover * 0.8,
              }}
            />
            {/* 作者小色点（三枚——覆盖层上；「哪笔是谁的」全部溶解消失） */}
            {[0, 1, 2].map((d) => (
              <span
                key={`dot${d}`}
                style={{
                  position: 'absolute',
                  left: 150 + d * 90,
                  top: -14,
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  background: CURSOR_TONES[d],
                  opacity: (d === 2 ? curIn : sweep1) * (1 - dots),
                }}
              />
            ))}
          </div>
          {[0].map((r) => (
            <div key={`fr3-${r}`} style={{display: 'flex', gap: 8, height: ROW_H_0A, alignItems: 'center'}}>
              {Array.from({length: 9}, (_, i) => (
                <span
                  key={`fc3-${i}`}
                  style={{width: 26 + (i % 3) * 10, height: 12, borderRadius: 3, background: withAlpha(theme.dim, 0.24)}}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* 三支光标（灰白族异亮度——同时落笔压上文件卡，先后仅半拍） */}
      {CURSORS_0A.map((c, i) => (
        <CursorArrow
          key={`cur${i}`}
          x={c.x}
          y={c.y + (1 - clamp01(progress(frame, atCur + i * 3, DUR.f5))) * -90}
          tone={CURSOR_TONES[i]}
          litP={curIn}
        />
      ))}
      <SourceCredit lit={clamp01(progress(frame, 4, DUR.f5))} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同一个目录 · 三支笔 · 后写的盖掉先写的'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 问题图：任务板/收件箱小卡 + 「在哪干？」问号 + 答案位初光 ──────────────

/** 0-B 布局（安全带实算：小卡底 530 / 房形答案位底 750，恒 ≤ 860） */
const SIDE_0B = [
  {x: 330, y: 300, title: '任务板', sub: '谁干什么'},
  {x: 1250, y: 300, title: '收件箱', sub: '怎么说'},
] as const;
const QMARK_0B = {x: 872, y: 300} as const;
const ANSR_0B = {x: 900, y: 560, w: 170, h: 150} as const;

const ZeroB: React.FC<{atBoard: number; atInbox: number; atNobody: number; atSelf: number; atRoom: number}> = ({
  atBoard,
  atInbox,
  atNobody,
  atSelf,
  atRoom,
}) => {
  const frame = useCurrentFrame();
  // 两小卡先后亮起闪一拍（任务板 / 收件箱——机制名直陈非喻体）
  const board = clamp01(progress(frame, atBoard, DUR.f4));
  const inbox = clamp01(progress(frame, atInbox, DUR.f4));
  const boardFlash = Math.sin(Math.PI * clamp01(progress(frame, atBoard + DUR.f4, 16)));
  const inboxFlash = Math.sin(Math.PI * clamp01(progress(frame, atInbox + DUR.f4, 16)));
  // 「没人管」——两卡各退半档（暗层化）
  const nobody = clamp01(progress(frame, atNobody, 16));
  // 中央问号放大悬停一拍（钢青描边——唯一居中焦点）
  const qGrow = Math.sin(Math.PI * clamp01(progress(frame, atNobody + 6, 30)));
  // 「自觉」小签浮现即划掉（否定靠自觉）
  const selfP = clamp01(progress(frame, atSelf, 10));
  const selfStrike = clamp01(progress(frame, atSelf + 8, 10));
  // 答案位房形轮廓初光（兰紫描边一闪——预告主装置）
  const roomGlow = Math.sin(Math.PI * clamp01(progress(frame, atRoom, 26)));
  const roomHold = clamp01(progress(frame, atRoom + 10, 16));
  return (
    <AbsoluteFill>
      {/* 目录窗口压暗退后 */}
      <div style={{position: 'absolute', left: WIN_0A.x, top: WIN_0A.y, width: WIN_0A.w, height: WIN_0A.h, opacity: 0.16, transform: 'scale(0.94)'}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 16, border: `2px solid ${withAlpha(theme.panelBorder, 0.6)}`}} />
      </div>
      {/* 任务板 / 收件箱两小卡（等大对称——先后亮起闪一拍再退半档） */}
      {SIDE_0B.map((s, i) => {
        const lit = i === 0 ? board : inbox;
        const flash = i === 0 ? boardFlash : inboxFlash;
        return (
          <div
            key={`side${i}`}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: 340,
              height: 230,
              opacity: lit * (1 - nobody * 0.5),
              transform: `translateY(${(1 - lit) * 18}px)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 14,
                border: `3px solid ${withAlpha(theme.dim, 0.5 + 0.4 * lit)}`,
                background: withAlpha(theme.panel, 0.94),
                boxShadow: flash > 0.04 ? `0 0 ${24 * flash}px ${withAlpha(theme.dim, 0.5 * flash)}` : 'none',
              }}
            >
              <div style={{position: 'absolute', left: 22, top: 20, fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: lit > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
                {s.title}
              </div>
              <div style={{position: 'absolute', left: 22, top: 62, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>
                {s.sub}
              </div>
              {/* 卡内条目（两行暗签——不显成句文字） */}
              {[0, 1].map((r) => (
                <div
                  key={`sr${r}`}
                  style={{
                    position: 'absolute',
                    left: 22,
                    top: 108 + r * 44,
                    width: 240 - r * 60,
                    height: 14,
                    borderRadius: 4,
                    background: withAlpha(theme.dim, 0.26),
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {/* 中央「在哪干？」问号（钢青描边——放大悬停一拍） */}
      <div
        style={{
          position: 'absolute',
          left: QMARK_0B.x,
          top: QMARK_0B.y,
          opacity: clamp01(progress(frame, atNobody - 18, 16)),
        }}
      >
        <div
          style={{
            padding: '18px 34px',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.guard, 0.85)}`,
            background: withAlpha(theme.panel, 0.97),
            transform: `scale(${1 + 0.1 * qGrow})`,
            boxShadow: qGrow > 0.05 ? `0 0 ${30 * qGrow}px ${withAlpha(theme.guard, 0.4 * qGrow)}` : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>在哪干？</span>
        </div>
      </div>
      {/* 「自觉」小签浮现即划掉（唯一红闪——否定靠自觉） */}
      {selfP > 0.02 ? (
        <div style={{position: 'absolute', left: 1150, top: 480, opacity: selfP * (1 - selfStrike * 0.55)}}>
          <div style={{position: 'relative', padding: '8px 20px', borderRadius: 10, border: `2.5px dashed ${withAlpha(theme.dim, 0.8)}`, background: withAlpha(theme.panel, 0.96)}}>
            <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>靠自觉</span>
            {selfStrike > 0.02 ? (
              <span
                style={{
                  position: 'absolute',
                  left: -4,
                  top: '50%',
                  width: selfStrike * 118,
                  height: 3.5,
                  background: theme.danger,
                  transform: 'rotate(-8deg)',
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {/* 答案位：房形轮廓初光（兰紫描边一闪——预告主装置） */}
      <div style={{position: 'absolute', left: ANSR_0B.x, top: ANSR_0B.y, width: ANSR_0B.w, height: ANSR_0B.h, opacity: clamp01(progress(frame, atRoom, 12))}}>
        <svg width={ANSR_0B.w} height={ANSR_0B.h + 20} viewBox={`0 0 ${ANSR_0B.w} ${ANSR_0B.h + 20}`} style={{overflow: 'visible'}}>
          <path
            d={`M6 ${ANSR_0B.h * 0.36} L ${ANSR_0B.w / 2} 4 L ${ANSR_0B.w - 6} ${ANSR_0B.h * 0.36} Z`}
            fill="none"
            stroke={theme.line}
            strokeWidth={4}
            opacity={0.35 + 0.65 * Math.max(roomGlow, roomHold * 0.8)}
          />
          <rect
            x={10}
            y={ANSR_0B.h * 0.36}
            width={ANSR_0B.w - 20}
            height={ANSR_0B.h * 0.6}
            rx={6}
            fill={roomHold > 0.4 ? withAlpha(theme.line, 0.08) : 'transparent'}
            stroke={theme.line}
            strokeWidth={4}
            opacity={0.35 + 0.65 * Math.max(roomGlow, roomHold * 0.8)}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: ANSR_0B.h + 26,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.line,
            whiteSpace: 'nowrap',
            opacity: roomHold,
          }}
        >
          一间独立的房
        </div>
      </div>
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'任务板管谁干什么 · 收件箱管怎么说 · 在哪干，没人管'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 答案图：主装置全局位首现（账本立起 + 房槽挂侧 + 细线接通 + 守卫半句钩）─

/** 0-C 布局（安全带实算：账本体 250+420=670 / 环体预留位底 430+150=580 /
 *  守卫签底 ≈ 618，恒 ≤ 860；房槽挂右缘不出账本 y 域） */
const LEDGER_0C = {x: 790, y: 250, w: 280, h: 420} as const;
const RINGSLOT_0C = {x: 1230, y: 430, size: 150} as const;
const GUARD_0C = {x: 420, y: 560, size: 150} as const;

const ZeroC: React.FC<{atLedger: number; atSlots: number; atLinks: number; atGuard: number}> = ({
  atLedger,
  atSlots,
  atLinks,
  atGuard,
}) => {
  const frame = useCurrentFrame();
  // 账本自底部立起落定（「一本账」）
  const rise = clamp01(progress(frame, atLedger, 22));
  // 房槽 1→3 依次点亮轮廓（兰紫描边 stagger）
  const slot = (i: number) => clamp01(progress(frame, atSlots + i * 7, 12));
  // 各房细线牵回账本侧沿接通（挂靠拓扑成型）
  const link = clamp01(progress(frame, atLinks, 18));
  // 拆房侧位守卫小签亮出钢青描边一闪（半句钩，P3 兑现）
  const guard = clamp01(progress(frame, atGuard, 10));
  const guardFlash = Math.sin(Math.PI * clamp01(progress(frame, atGuard + 6, 24)));
  // 房槽绝对位（与 LedgerBlock 同式：cy = h*0.3 + i*h*0.28，自 y 起）
  const slotCys = [0, 1, 2].map((i) => LEDGER_0C.y + LEDGER_0C.h * 0.3 + i * LEDGER_0C.h * 0.28);
  return (
    <AbsoluteFill>
      {/* 账本（一本账——自底部立起，侧沿房槽暗态→兰紫点亮） */}
      <LedgerBlock
        x={LEDGER_0C.x}
        y={LEDGER_0C.y}
        w={LEDGER_0C.w}
        h={LEDGER_0C.h}
        riseP={rise}
        slots={3}
        slotsLitP={[slot(0), slot(1), slot(2)]}
      />
      {/* 细线各牵回账本侧沿（挂靠拓扑——自房槽左缘到账本右缘同 y 位） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {slotCys.map((cy, i) => {
          const x1 = LEDGER_0C.x + LEDGER_0C.w - 10;
          return (
            <line
              key={`lk${i}`}
              x1={x1 + 34}
              y1={cy + 25 + 12}
              x2={x1 + 34 - 44 * link}
              y2={cy}
              stroke={theme.line}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.55 * slot(i) * link}
            />
          );
        })}
      </svg>
      {/* 环体位预留（下幕入场——dashed 圈位，非环体本体） */}
      <div style={{position: 'absolute', left: RINGSLOT_0C.x, top: RINGSLOT_0C.y, opacity: 0.4}}>
        <svg width={RINGSLOT_0C.size} height={RINGSLOT_0C.size} viewBox={`0 0 ${RINGSLOT_0C.size} ${RINGSLOT_0C.size}`}>
          <circle
            cx={RINGSLOT_0C.size / 2}
            cy={RINGSLOT_0C.size / 2}
            r={RINGSLOT_0C.size / 2 - 30}
            fill="none"
            stroke={theme.dim}
            strokeWidth={2.5}
            strokeDasharray="7 8"
            opacity={clamp01(progress(frame, atLinks, 20)) * 0.7}
          />
        </svg>
        <div style={{position: 'absolute', left: 6, top: RINGSLOT_0C.size + 6, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.7}}>
          下幕入场
        </div>
      </div>
      {/* 拆房侧位守卫小签（暗态→p0-07 钢青描边一闪） */}
      <GuardBadge x={GUARD_0C.x} y={GUARD_0C.y} size={GUARD_0C.size} litP={0.35 + 0.65 * guard} flashP={guardFlash} label="拆房 · 守卫" />
      <SourceCredit />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'一本账 · 好几间房 · 机制是现成的'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0SharedDesk: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-05');
  const bC = w('p0-06', 'p0-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atCur={wa('p0-01', 0.26) - bA.from}
          atRewrite={wa('p0-02', 0.68) - bA.from}
          atCover={wa('p0-03', 0.14) - bA.from}
          atDots={wa('p0-03', 0.56) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atBoard={wa('p0-04', 0.06) - bB.from}
          atInbox={wa('p0-04', 0.39) - bB.from}
          atNobody={wa('p0-04', 0.88) - bB.from}
          atSelf={wa('p0-05', 0.30) - bB.from}
          atRoom={wa('p0-05', 0.84) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atLedger={wa('p0-06', 0.06) - bC.from}
          atSlots={wa('p0-06', 0.42) - bC.from}
          atLinks={wa('p0-06', 0.80) - bC.from}
          atGuard={wa('p0-07', 0.82) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0SharedDesk;
