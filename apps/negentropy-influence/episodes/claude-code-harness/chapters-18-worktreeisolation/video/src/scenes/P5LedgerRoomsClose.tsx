/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  幕间转场（4-D→5-A，头注明示）：语义断裂（生产对照→收束定格）走 SceneFade；
 *  账本房间主装置以同形签名回归（镜间身份恒常，非 morph，承 ep2 4-D→5-A /
 *  ep15–17 形态）。
 *
 *  叙事链：5-A 账本房间定格收束：p5-01「任务管目标，房管施工」词落位金句卡
 *  （衬线体）淡入、两半句各压一拍重读排版〔M-005〕、「各改各的线」词落位
 *  两侧分支线各闪一拍 → p5-02「房号写在任务文件里」词落位任务卡上文件小图标
 *  翻开、房号字段落入文件页〔M-005〕、「重启也丢不了」词落位重启循环小签
 *  转过一圈、房号仍在文件页（状态入文件的机制陈述〔M-003〕）→ p5-03「那道
 *  默认拒绝」词落位门卡①微缩形回闪一拍（回扣，与 3-B 同款）、「护住收尾」
 *  词落位门卡①描边定格 → 5-B 房内工具卡摊开：p5-04「件件都是自家手写的」
 *  词落位四枚工具卡（读写/跑命令/建房/拆房）逐张翻面亮「自产」小戳（stagger）
 *  〔M-005〕→ p5-05「外面那些现成的工具」词落位视线推窗外（@travel）+ 远处
 *  工具货架剪影浮起、「不改一行代码」词落位「0 行改动」问号小签浮起（不
 *  展开）、「下期」词落位下期签点亮 → 5-C 片尾署源卡：p5-06 卡随口播同拍
 *  淡入、两行先后落定（署源专名口播例外随行）；p5-07 期间卡片静持（漂移
 *  警示由口播承载，卡面零复述），全片在此卡收束（黑场前最后画面）。
 *
 *  空间契约（安全带实算）：5-A 账本底 580 / 双房底 500 / 任务卡特写位底
 *  800 / 门卡①微缩底 800 / 环体底 270；5-B 房框底 670 / 货架底 ≈ 640 / 下期
 *  签底 ≈ 700——全部 ≤ 860；travel 缩放 0.82 后房框底 ≈ 643 仍 ≤ 860。
 *  红线落实：金句卡刻意复述（收束定格仪式，caption-dup-ok 登记）；主装置
 *  同形拓扑回归（承 0-C/2-A——拓扑禁变形）；门卡①微缩与 3-B 同款；货架为
 *  剪影禁显机制名与细节（只点问题）；「自产」戳与「0 行改动」签为关键词
 *  小签；署源卡为最后画面、卡面 ≤3 行信息、字号不低于可读阈值；下期预告
 *  只点问题。词落位 = wa(id,f)；y≥100 ≥ 56；尾幕渐黑窗 = 末镜总时长。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BranchLine, ExitGateCard, LedgerBlock, Panel, RoomCard, TaskCard, WorkRing} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';
import {ease} from '../components/motifs';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 账本房间定格收束 + 金句卡 + 房号入文件 + 门卡①回扣 ────────────────────

/** 5-A 布局（安全带实算见头注——主装置同形拓扑承 0-C/2-A） */
const CLOSE_5A = {
  ledger: {x: 850, y: 200, w: 220, h: 380},
  rooms: [
    {x: 380, y: 330, w: 210, h: 170, name: '认证房'},
    {x: 1400, y: 330, w: 210, h: 170, name: '界面房'},
  ],
  lines: [
    {x1: 850, y1: 415, x2: 590, y2: 415},
    {x1: 1070, y1: 415, x2: 1400, y2: 415},
  ],
  ring: {x: 1080, y: 100, size: 170},
  mainDir: {x: 1180, y: 600},
  quote: {x: 330, y: 116},
  card: {x: 1130, y: 560, w: 430, h: 240},
  gate: {x: 660, y: 600},
} as const;

const FiveA: React.FC<{atQuote: number; atK1: number; atK2: number; atLines: number; atFile: number; atReboot: number; atGate: number; atLock: number}> = ({
  atQuote,
  atK1,
  atK2,
  atLines,
  atFile,
  atReboot,
  atGate,
  atLock,
}) => {
  const frame = useCurrentFrame();
  // 主装置全景回归（同形拓扑——stagger 淡入即定格）
  const inP = (i: number) => clamp01(progress(frame, 2 + i * 4, 10));
  // 金句卡淡入 + 两半句各压一拍重读
  const quote = clamp01(progress(frame, atQuote, 14));
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  // 两侧分支线各闪一拍
  const flashL = Math.sin(Math.PI * clamp01(progress(frame, atLines, 16)));
  const flashR = Math.sin(Math.PI * clamp01(progress(frame, atLines + 10, 16)));
  // 房号落入文件页（文件小图标翻开 + 字段值坠入）
  const fileOpen = clamp01(progress(frame, atFile, 12));
  const drop = ease(clamp01(progress(frame, atFile + 8, 16)));
  // 重启循环小签转过一圈（房号仍在文件页）
  const reboot = clamp01(progress(frame, atReboot, 26));
  // 门卡①微缩回闪（与 3-B 同款）
  const gate = clamp01(progress(frame, atGate, 10));
  const lock = clamp01(progress(frame, atLock, 12));
  // 工作目录指针回指主目录（收束语义）
  const swingBack = clamp01(progress(frame, atQuote + 10, 16));
  return (
    <AbsoluteFill>
      {/* 账本居中 + 房间分挂两侧 + 分支线各牵（同形拓扑回归） */}
      <LedgerBlock x={CLOSE_5A.ledger.x} y={CLOSE_5A.ledger.y} w={CLOSE_5A.ledger.w} h={CLOSE_5A.ledger.h} litP={inP(0)} slots={3} slotsLitP={[0.5, 0.5, 0.5]} />
      {CLOSE_5A.rooms.map((r, i) => (
        <div key={`cr${i}`}>
          <RoomCard x={r.x} y={r.y} w={r.w} h={r.h} litP={inP(i + 1)} name={r.name} nameLitP={inP(i + 1)} fileCardP={1} doorP={1} />
        </div>
      ))}
      {CLOSE_5A.lines.map((l, i) => (
        <BranchLine key={`cl${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} drawP={inP(i + 2)} litP={0.8} flashP={i === 0 ? flashL : flashR} />
      ))}
      {/* 环体旁挂位同形回归〔M-001〕——工作目录指针回指主目录（收束语义） */}
      <WorkRing
        x={CLOSE_5A.ring.x}
        y={CLOSE_5A.ring.y}
        size={CLOSE_5A.ring.size}
        litP={inP(4)}
        arcP={1}
        ptA={{x: CLOSE_5A.rooms[1].x + 100, y: CLOSE_5A.rooms[1].y - 4}}
        ptB={{x: CLOSE_5A.mainDir.x + 60, y: CLOSE_5A.mainDir.y}}
        swingP={swingBack}
        ptrP={1}
        tagP={1}
      />
      {/* 主目录签（指针回指靶点） */}
      <div style={{position: 'absolute', left: CLOSE_5A.mainDir.x, top: CLOSE_5A.mainDir.y, display: 'flex', alignItems: 'center', gap: 10, opacity: inP(4)}}>
        <svg width={36} height={30} viewBox="0 0 40 34">
          <path d="M3 4 h13 l5 6 h16 v20 h-34 z" fill={withAlpha(theme.dim, 0.18)} stroke={theme.dim} strokeWidth={2.6} />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>主目录</span>
      </div>
      {/* 金句卡（衬线体唯一主体——两半句各压一拍重读排版） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: CLOSE_5A.quote.x, top: CLOSE_5A.quote.y, zIndex: 3, opacity: quote, transform: `translateY(${(1 - quote) * 18}px)`}}>
          <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '28px 46px'}}>
            <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, whiteSpace: 'nowrap'}}>
              {/* caption-dup-ok: 金句卡刻意复述收束句（收束定格仪式，承 ep1/ep2/ep15–ep17 5-A 豁免先例——storyboard 5-A 行登记） */}
              <span style={{fontWeight: 700, color: theme.line, display: 'inline-block', transform: `scale(${1 + 0.06 * k1})`}}>任务管目标</span>
              <span>{' · '}</span>
              <span style={{fontWeight: 700, color: theme.guard, display: 'inline-block', transform: `scale(${1 + 0.06 * k2})`}}>房管施工</span>
            </div>
          </Panel>
        </div>
      ) : null}
      {/* 任务卡特写位（房号字段 + 内嵌「写入文件」小动画） */}
      <TaskCard
        x={CLOSE_5A.card.x}
        y={CLOSE_5A.card.y}
        w={CLOSE_5A.card.w}
        h={CLOSE_5A.card.h}
        id="task_014"
        title="认证重构"
        litP={inP(5)}
        pendingLitP={1}
        claimP={1}
        claimer="队友一"
        greenP={1}
        fieldWriteP={1}
        fieldValue="auth-refactor"
      />
      {/* 文件小页（卡右侧翻开——房号字段落入文件页；重启转一圈后仍在） */}
      {fileOpen > 0.02 ? (
        <div style={{position: 'absolute', left: CLOSE_5A.card.x + CLOSE_5A.card.w + 36, top: CLOSE_5A.card.y + 10, width: 190, height: 150, opacity: fileOpen}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.dim, 0.7)}`,
              background: withAlpha(theme.panel, 0.98),
              padding: '12px 16px',
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'task_014.md'}</div>
            {/* 落入中的房号字段值（自卡上坠入文件页） */}
            <div
              style={{
                marginTop: 18,
                padding: '5px 12px',
                borderRadius: 7,
                border: `2.5px solid ${withAlpha(theme.line, 0.85)}`,
                background: withAlpha(theme.line, 0.1),
                fontFamily: theme.mono,
                fontSize: 16,
                fontWeight: 700,
                color: theme.line,
                whiteSpace: 'nowrap',
                transform: `translateY(${(1 - drop) * -60}px)`,
                opacity: drop,
              }}
            >
              {'worktree: auth-refactor'}
            </div>
            <div style={{marginTop: 14, height: 8, borderRadius: 3, background: withAlpha(theme.dim, 0.3)}} />
            <div style={{marginTop: 10, height: 8, borderRadius: 3, width: 100, background: withAlpha(theme.dim, 0.22)}} />
          </div>
          {/* 重启循环小签（转过一圈——状态入文件、重启也丢不了） */}
          {reboot > 0.02 ? (
            <div style={{position: 'absolute', left: 40, top: -66, opacity: reboot}}>
              <svg width={64} height={64} viewBox="0 0 64 64">
                <path
                  d="M52 32 A 20 20 0 1 1 43.6 16.4"
                  fill="none"
                  stroke={theme.dim}
                  strokeWidth={5}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - reboot}
                />
                <path d="M43.6 8 L43.6 16.4 L52 16.4" fill="none" stroke={theme.dim} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{position: 'absolute', left: 68, top: 22, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
                重启 · 房号仍在
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {/* 门卡①微缩回扣（3-B 同款——默认拒绝） */}
      <ExitGateCard x={CLOSE_5A.gate.x} y={CLOSE_5A.gate.y} w={200} h={200} which={1} litP={gate} numP={gate} sinkP={lock} micro />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'房号绑在卡上 · 状态进文件 · 那道默认拒绝'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 房内工具卡摊开（件件自产）→ 视线推窗外：货架剪影 + 下期签 ───────────────

/** 5-B 布局（安全带实算：房框底 670 / 货架底 ≈ 640 / 下期签底 ≈ 700） */
const ROOM_5B = {x: 480, y: 170, w: 740, h: 500} as const;
const FAN_5B = [
  {x: 620, y: 330, rot: -16, label: '读写'},
  {x: 810, y: 300, rot: -5, label: '跑命令'},
  {x: 1000, y: 300, rot: 5, label: '建房'},
  {x: 1180, y: 330, rot: 16, label: '拆房'},
] as const;
const SHELF_5B = {x: 1330, y: 250, w: 440, h: 340} as const;

const FiveB: React.FC<{atFlip: number; atTravel: number; atZero: number; atNext: number}> = ({atFlip, atTravel, atZero, atNext}) => {
  const frame = useCurrentFrame();
  // 四枚工具卡逐张翻面亮「自产」小戳（stagger）
  const flip = (i: number) => clamp01(progress(frame, atFlip + i * 8, 14));
  // 视线推窗外（@travel——房整体左移缩、窗外货架浮起）
  const travel = ease(clamp01(progress(frame, atTravel, 20)));
  // 「0 行改动」问号小签（不展开）
  const zero = clamp01(progress(frame, atZero, 12));
  // 下期签点亮
  const next = clamp01(progress(frame, atNext, 10));
  return (
    <AbsoluteFill>
      {/* 房整体（travel：左移 -190 + 缩 0.82——房框底 670 → 170+ (670-170-500*0)... 实算：
          transform-origin 房框左上 (480,170)，底边 y=670 → 0.82 缩放后 170+(670-170)*0.82=580，
          再左移不出界，恒 ≤ 860） */}
      <div style={{position: 'absolute', inset: 0, transform: `translate(${-190 * travel}px, 0) scale(${1 - 0.18 * travel})`, transformOrigin: `${ROOM_5B.x}px ${ROOM_5B.y}px`}}>
        {/* 房框（大房一间——扇形摊开舞台） */}
        <RoomCard x={ROOM_5B.x} y={ROOM_5B.y} w={ROOM_5B.w} h={ROOM_5B.h} litP={1} name="房内" nameLitP={1} />
        {/* 房窗（右上——视线的出口） */}
        <div
          style={{
            position: 'absolute',
            left: ROOM_5B.x + ROOM_5B.w - 210,
            top: ROOM_5B.y + 50,
            width: 160,
            height: 130,
            borderRadius: 12,
            border: `3.5px solid ${withAlpha(theme.dim, 0.7)}`,
            background: withAlpha(theme.bg, 0.85),
            boxShadow: travel > 0.3 ? `0 0 ${28 * travel}px ${withAlpha(theme.dim, 0.4 * travel)}` : 'none',
          }}
        >
          <div style={{position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, background: withAlpha(theme.dim, 0.4)}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: 3, background: withAlpha(theme.dim, 0.4)}} />
        </div>
        {/* 四枚工具卡扇形摊开（翻面亮「自产」小戳） */}
        {FAN_5B.map((f, i) => {
          const fp = flip(i);
          return (
            <div
              key={`fan${i}`}
              style={{
                position: 'absolute',
                left: f.x,
                top: f.y,
                width: 170,
                height: 130,
                transform: `rotate(${f.rot}deg)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 12,
                  border: `3px solid ${withAlpha(theme.dim, 0.6)}`,
                  background: withAlpha(theme.panel, 0.97),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{f.label}</span>
                {/* 「自产」小戳（翻面亮出——件件自家手写） */}
                <span
                  style={{
                    padding: '3px 12px',
                    borderRadius: 7,
                    border: `2.5px solid ${withAlpha(theme.core, 0.4 + 0.6 * fp)}`,
                    background: fp > 0.4 ? withAlpha(theme.core, 0.14) : 'transparent',
                    fontFamily: theme.sans,
                    fontSize: 16,
                    fontWeight: 700,
                    color: fp > 0.4 ? theme.core : theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: fp,
                    transform: `rotate(-6deg) scale(${0.8 + 0.2 * fp})`,
                  }}
                >
                  自产
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* 窗外货架剪影（远处浮起——下期卡视觉层，剪影不显机制名） */}
      <div style={{position: 'absolute', left: SHELF_5B.x, top: SHELF_5B.y - (1 - travel) * 120, width: SHELF_5B.w, opacity: travel * 0.85}}>
        <svg width={SHELF_5B.w} height={SHELF_5B.h} viewBox={`0 0 ${SHELF_5B.w} ${SHELF_5B.h}`}>
          {[0, 1, 2].map((r) => (
            <g key={`sh${r}`}>
              <line x1={10} y1={70 + r * 110} x2={SHELF_5B.w - 10} y2={70 + r * 110} stroke={theme.dim} strokeWidth={7} strokeLinecap="round" opacity={0.75} />
              {Array.from({length: 5}, (_, c) => (
                <rect
                  key={`shb${r}-${c}`}
                  x={30 + c * 82 + (r % 2 === 0 ? 10 : 0)}
                  y={70 + r * 110 - 52 - (c % 3) * 8}
                  width={54}
                  height={52 + (c % 3) * 8}
                  rx={7}
                  fill="none"
                  stroke={theme.dim}
                  strokeWidth={3.5}
                  opacity={0.55}
                />
              ))}
            </g>
          ))}
        </svg>
        {/* 「0 行改动」问号小签（不展开） */}
        {zero > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: SHELF_5B.w / 2 - 110,
              top: -58,
              padding: '8px 20px',
              borderRadius: 10,
              border: `2.5px dashed ${withAlpha(theme.dim, 0.8)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: zero,
              transform: `translateY(${(1 - zero) * -12}px)`,
            }}
          >
            0 行改动？
          </div>
        ) : null}
      </div>
      {/* 下期签（点亮——只点问题不预告机制） */}
      <div style={{position: 'absolute', left: 1560, top: 640, opacity: next}}>
        <div
          style={{
            padding: '10px 30px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.text, 0.5 + 0.5 * next)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.serif,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            letterSpacing: 6,
          }}
        >
          下期
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'件件自家手写 · 外面那些现成的工具怎么接？'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位——豁免登记于工作区配置） ────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.3);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel accent={withAlpha(theme.line, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：窗 = 末镜总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5LedgerRoomsClose: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-05');
  const bC = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atQuote={wa('p5-01', 0.10) - bA.from}
          atK1={wa('p5-01', 0.28) - bA.from}
          atK2={wa('p5-01', 0.46) - bA.from}
          atLines={wa('p5-01', 0.88) - bA.from}
          atFile={wa('p5-02', 0.15) - bA.from}
          atReboot={wa('p5-02', 0.75) - bA.from}
          atGate={wa('p5-03', 0.40) - bA.from}
          atLock={wa('p5-03', 0.65) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atFlip={wa('p5-04', 0.52) - bB.from}
          atTravel={wa('p5-05', 0.24) - bB.from}
          atZero={wa('p5-05', 0.60) - bB.from}
          atNext={wa('p5-05', 0.06) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <CreditCard atCard={at('p5-06') - bC.from} durCard={span('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5LedgerRoomsClose;
