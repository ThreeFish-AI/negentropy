/** P3 三道门禁（p3-01..29，8 镜 12 cue）——分镜 3-A…3-H。
 *
 *  叙事链：安全债到期（引语卡回放）→ 三道闸门（three-gates）→ 危险品按词辨认 →
 *  官方次序条（deny→ask→allow 首中即决）→ 倒置假想＋金句 → 拆墙双联画
 *  （fence-to-intercom）→ 拒绝回执（denied-receipt）→ 产品面速览。
 *  空间契约：装置自右缘挂入（mech），不触碰左中 core 内核锚位；三道门次序
 *  锁死永不换位——焊死门 deny／规则门 mech／对讲机 dim。
 *  archify 两图全屏独占：3-B 的 p3-03 装置预览与 3-G 的 p3-24 引子卡经
 *  ArchifyYield 让位；3-F/3-G 尾段无自制装置共存，直接整镜回放。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, GateRouter, NumberedCard, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  useBreathe,
  useDim,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useSpring,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行（P1–P6 同值，Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 3-A 债到期卡（p3-01..02） ────────────────────────────────────────────

const DebtDue: React.FC<{atWarn: number}> = ({atWarn}) => {
  // 到期脉冲：sin 包络一次冲击，deny 辉光随包络涨落后归零
  const pulse = useImpulse({at: 4, dur: DUR.f6, peak: 1});
  const card = useEnter('rise', {at: 2, dur: DUR.f5, dist: 34, restBottom: 640});
  // 上一版末尾警告（p2-27「不归它管」）引语回放：mono 逐字流出
  const warn = useReveal('safe_path ∄ bash', {at: atWarn + 4, cps: 9});

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...card}}>
        <div style={{position: 'absolute', left: 560, top: 330}}>
          <Panel
            accent={theme.deny}
            style={{
              width: 800,
              boxSizing: 'border-box',
              padding: '34px 40px',
              boxShadow: `0 0 ${44 * pulse}px ${theme.deny}`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', gap: 20}}>
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'#2'}</span>
              <span style={{fontFamily: theme.serif, fontSize: 60, fontWeight: 700, color: theme.deny}}>
                {'安全债'}
              </span>
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 28,
                  color: theme.bg,
                  background: theme.deny,
                  borderRadius: 8,
                  padding: '4px 14px',
                }}
              >
                {'到期'}
              </span>
            </div>
          </Panel>
        </div>
        {/* 引语卡：上一版末尾的警告原句（口播回指已删，画面代言） */}
        <div style={{position: 'absolute', left: 620, top: 560}}>
          <Panel style={{width: 680, boxSizing: 'border-box', padding: '18px 28px'}}>
            <span style={{fontFamily: theme.serif, fontSize: 44, color: theme.panelBorder}}>{'“'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim, whiteSpace: 'pre'}}>
              {warn}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.panelBorder}}>{'▍'}</span>
          </Panel>
        </div>
      </div>
      <Footnote delay={atWarn + 4}>{'bash 不受 safe_path 保护'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-B p3-03 空窗句：三道门禁装置推入（archify 接管前的一现） ──────────

const GatesSneak: React.FC = () => {
  const wrap = useEnter('rise', {at: 0, dur: DUR.f5, dist: 40, restBottom: 720});
  const drops = useStagger(3, {at: 2, stride: 5, dur: DUR.f4});
  const dot = useProgress(2 + 2 * 5 + DUR.f4 + 4, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...wrap}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 236,
            width: 1920,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 48,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          {'三道门禁'}
        </div>
        {/* 母题 GateRouter：闸门落下 + 请求光点被第一道（焊死门）拦下 */}
        <div style={{position: 'absolute', left: 400, top: 400}}>
          <GateRouter gates={drops} travel={dot} blockedBy={0} />
        </div>
      </div>
      <Footnote delay={2 + 2 * 5 + DUR.f4}>{'check_permission()'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-C 危险品名册：按词辨认（p3-11..12） ───────────────────────────────

const ROSTER_CMD = 'rm -rf dist';
const ROSTER_CPS = 10;

const WordRoster: React.FC<{atContrast: number}> = ({atContrast}) => {
  const title = useProgress(2, DUR.f4);
  const card = useEnter('fade', {at: 6, dur: DUR.f5});
  const typed = useReveal(ROSTER_CMD, {at: 10, cps: ROSTER_CPS});
  // 命令位的「删字」打满即命中：`rm` 两字 → 由 cps 推导，不写死帧数
  const hitAt = 10 + Math.ceil((2 / ROSTER_CPS) * 30);
  const hit = useImpulse({at: hitAt, dur: DUR.f6});
  const hitSet = useProgress(hitAt, DUR.f3);
  // 对照行：词内含 del 的 model / delimiter 灰置不报
  const contrast = useEnter('rise', {at: atContrast, dur: DUR.f5, dist: 24, restBottom: 660});
  const contrastDim = useDim({at: atContrast + DUR.f5, to: 0.35, dur: DUR.f5});

  const cmd = typed.slice(0, 2);
  const rest = typed.slice(2);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 190,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 48,
          fontWeight: 700,
          opacity: title,
        }}
      >
        <span style={{color: theme.deny}}>{'按词'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span style={{color: theme.dim}}>{'不按串'}</span>
      </div>

      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...card}}>
        <div style={{position: 'absolute', left: 420, top: 310}}>
          <Panel style={{width: 1080, boxSizing: 'border-box', padding: '26px 34px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 40, whiteSpace: 'pre'}}>
              <span style={{color: theme.core}}>{'$ '}</span>
              <span
                style={{
                  color: hitSet > 0.5 ? theme.bg : theme.deny,
                  background: hitSet > 0.5 ? theme.deny : 'transparent',
                  borderRadius: 6,
                  padding: '2px 8px',
                  boxShadow: hitSet > 0.5 ? `0 0 ${26 * hit}px ${theme.deny}` : 'none',
                }}
              >
                {cmd}
              </span>
              <span style={{color: theme.text}}>{rest}</span>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 10}}>
              {'命令位 · 命中'}
            </div>
          </Panel>
        </div>

        {/* 对照行：变量名 / 参数词只含「del」子串，不站在命令位 → 灰置不报 */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: contrast.opacity, transform: contrast.transform}}>
          <div style={{position: 'absolute', left: 420, top: 560, display: 'flex', alignItems: 'center', gap: 24}}>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, opacity: contrastDim}}>
              {'对照'}
            </span>
            {['model', 'delimiter'].map((w) => (
              <span
                key={w}
                style={{
                  fontFamily: theme.mono,
                  fontSize: 32,
                  color: theme.dim,
                  opacity: contrastDim,
                  border: `2px dotted ${theme.panelBorder}`,
                  borderRadius: 8,
                  padding: '6px 16px',
                }}
              >
                {w}
              </span>
            ))}
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, opacity: contrastDim}}>
              {'词内含 del · 不报'}
            </span>
          </div>
        </div>
      </div>
      <Footnote delay={10}>{'DESTRUCTIVE_COMMAND_WORD'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-D 官方对齐卡：次序条 + 开洞反例（p3-14..16） ───────────────────────

const ORDER_SEGS = [
  {zh: '拒绝', en: 'deny', color: theme.deny},
  {zh: '询问', en: 'ask', color: theme.dim},
  {zh: '放行', en: 'allow', color: theme.ok},
] as const;

const OfficialOrder: React.FC<{atHole: number}> = ({atHole}) => {
  const doc = useEnter('fade', {at: 2, dur: DUR.f5});
  const lit = useStagger(ORDER_SEGS.length, {at: 8, stride: 14, dur: DUR.f5});
  // 首中即决：打点钉在第一段（求值从左起，第一个命中就定案）
  const pinAt = 8 + 14 + DUR.f5;
  const pin = useImpulse({at: pinAt, dur: DUR.f6});
  // 反例：Bash(aws *) 想在拒绝上开洞 → 划掉 + 抖动（decay 归零）
  const strike = useProgress(atHole, DUR.f5);
  const shake = useShake({at: atHole, amp: 6, decay: true, dur: DUR.f6});
  const holeLabel = useProgress(atHole + DUR.f4, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...doc}}>
        {/* 官方文档页样（零信源标识：只有「官方文档」页眉） */}
        <div style={{position: 'absolute', left: 460, top: 200}}>
          <Panel style={{width: 1000, boxSizing: 'border-box', padding: '24px 36px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottom: `2px solid ${theme.panelBorder}`}}>
              <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'官方文档'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'permissions'}</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 24}}>
              {ORDER_SEGS.map((s, i) => (
                <React.Fragment key={s.en}>
                  {i > 0 ? (
                    <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.panelBorder, opacity: lit[i]}}>
                      {'→'}
                    </span>
                  ) : null}
                  <div
                    style={{
                      width: 240,
                      textAlign: 'center',
                      padding: '16px 0',
                      borderRadius: 12,
                      border: `2px solid ${lit[i] > 0.5 ? s.color : theme.panelBorder}`,
                      background: i === 0 && lit[i] > 0.5 ? theme.panel : 'transparent',
                      opacity: 0.45 + 0.55 * lit[i],
                    }}
                  >
                    <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: lit[i] > 0.5 ? s.color : theme.dim}}>
                      {s.zh}
                    </div>
                    <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 4}}>{s.en}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
            {/* 首中即决打点：钉在「拒绝」段上方 */}
            <div
              style={{
                position: 'absolute',
                left: 66,
                top: 118,
                fontFamily: theme.sans,
                fontSize: 24,
                color: theme.deny,
                opacity: 0.4 + 0.6 * pin,
                textShadow: `0 0 ${14 * pin}px ${theme.deny}`,
              }}
            >
              {'▼ 首中即决'}
            </div>
          </Panel>
        </div>

        {/* 反例卡：具体放行想在拒绝上开洞 → 被划掉 */}
        <div style={{position: 'absolute', left: 610, top: 620, transform: `translateX(${shake}px)`}}>
          <Panel accent={theme.deny} style={{width: 700, boxSizing: 'border-box', padding: '22px 30px'}}>
            <div style={{position: 'relative', display: 'inline-block'}}>
              <span style={{fontFamily: theme.mono, fontSize: 36, color: theme.text}}>
                {'Bash(aws *)  →  allow'}
              </span>
              <div
                style={{
                  position: 'absolute',
                  left: -6,
                  top: 30,
                  height: 4,
                  width: 560 * strike,
                  background: theme.deny,
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.deny, marginTop: 12, opacity: holeLabel}}>
              {'放行 不能在拒绝上开洞'}
            </div>
          </Panel>
        </div>
      </div>
      <Footnote delay={8}>{'deny → ask → allow · 首中即决'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-E 闸门倒置假想卡（p3-17..18） ──────────────────────────────────────

/** 倒置条三 chip 的原始 / 倒置 x（px）——「放行」挪到最前 */
const INVERT_X = [480, 820, 1160] as const;
const INVERT_SWAP = [1160, 820, 480] as const;

const InvertedGates: React.FC<{atFlip: number; atEscape: number; atRevert: number; atQuote: number}> = ({
  atFlip,
  atEscape,
  atRevert,
  atQuote,
}) => {
  // 弹转（snap 过冲钳在 1：chip 不冲出行程，过冲感交给回正的第二段弹簧）
  const flip = Math.min(1, useSpring('snap', {at: atFlip, dur: DUR.f6}));
  const revert = Math.min(1, useSpring('settle', {at: atRevert, dur: DUR.f6}));
  const factor = flip * (1 - revert);
  // 拒绝表上的命令（deny 点）穿过挪到最前的「放行」被放走
  const escape = useProgress(atEscape, DUR.f6, 'accelerate');
  const escapeAt = atEscape + DUR.f6;
  const flash = useImpulse({at: escapeAt, dur: DUR.f6});
  const shake = useShake({at: escapeAt, amp: 7, decay: true, dur: DUR.f6});
  const hint = useProgress(atFlip + DUR.f5, DUR.f4);

  const chip = (i: number) => {
    const s = ORDER_SEGS[i];
    const x = INVERT_X[i] + (INVERT_SWAP[i] - INVERT_X[i]) * factor;
    return (
      <div
        key={s.en}
        style={{
          position: 'absolute',
          left: x,
          top: 420,
          width: 260,
          textAlign: 'center',
          padding: '20px 0',
          borderRadius: 12,
          border: `3px solid ${s.color}`,
          background: theme.panel,
          opacity: i === 2 ? 0.55 + 0.45 * factor : 1,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: s.color}}>{s.zh}</div>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 2}}>{s.en}</div>
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 240,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 44,
          fontWeight: 700,
          color: theme.dim,
          opacity: hint,
        }}
      >
        {'次序倒过来 ？'}
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `translateX(${shake}px)`}}>
        {INVERT_X.map((_, i) => chip(i))}
        {/* 被放走的危险命令：deny 点从左侧穿过「放行」扬长而去（透明度随行程淡入，无硬门） */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <circle
            cx={380 + (1500 - 380) * escape}
            cy={486}
            r={14}
            fill={theme.deny}
            opacity={escape}
          />
          {/* 放走红闪：一次性冲击的扩散环 */}
          <circle cx={380 + (1500 - 380) * escape} cy={486} r={14 + 26 * flash} fill="none" stroke={theme.deny} strokeWidth={4} opacity={flash} />
          <text
            x={1548}
            y={494}
            fontFamily={theme.sans}
            fontSize={26}
            fontWeight={700}
            fill={theme.deny}
            opacity={clamp01((escape - 0.9) * 10)}
          >
            {'放走'}
          </text>
        </svg>
      </div>
      {/* 回正后的金句定格（M-003 终态：句中点抽帧仍可读出） */}
      <Sequence from={atQuote} layout="none">
        <div style={{position: 'absolute', left: 360, top: 640, width: 1200, height: 200}}>
          <QuoteCard zh="铁门 · 永在对讲机前" />
        </div>
      </Sequence>
      <Footnote delay={atFlip}>{'deny → ask → allow'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-G p3-24 引子：回执卡概念（2D 小字） ────────────────────────────────

const ReceiptIntro: React.FC = () => {
  const card = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 760, top: 420, ...card}}>
        {/* 收据形态：上沿锯齿（radial 渐变的 dashed 呈现省略，用 dashed 边即可读） */}
        <Panel
          accent={theme.dim}
          style={{
            width: 400,
            boxSizing: 'border-box',
            padding: '20px 28px',
            borderStyle: 'dashed',
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>{'回执'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 8}}>{'tool_result'}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-G p3-26..28 回落：被拒回灌对话列表 + 分工伏笔 ─────────────────────

const RECEIPT_ROWS = [
  {role: 'user', text: '清理项目', color: theme.dim},
  {role: 'assistant', text: 'tool_use · bash', color: theme.text},
  {role: 'tool_result', text: 'Permission denied.', color: theme.deny},
] as const;

const ReceiptFallback: React.FC<{atSplit: number}> = ({atSplit}) => {
  const list = useEnter('rise', {at: 2, dur: DUR.f5, dist: 36, restBottom: 700});
  const rows = useStagger(RECEIPT_ROWS.length, {at: 2 + DUR.f5, stride: 10, dur: DUR.f4});
  const master = useEnter('fade', {at: 8, dur: DUR.f5});
  // 工坊门常驻呼吸（mech）：分工伏笔「门禁 · 工坊执行」
  const doorIn = useProgress(atSplit, DUR.f5);
  const breathe = useBreathe({period: 60, base: 0.55, amp: 0.45});
  const splitTag = useProgress(atSplit + DUR.f4, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 对话列表（滚动追加感：整卡升起 + 逐条落账） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...list}}>
        <div style={{position: 'absolute', left: 860, top: 240}}>
          <Panel style={{width: 640, boxSizing: 'border-box', padding: '20px 26px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, paddingBottom: 10, borderBottom: `2px solid ${theme.panelBorder}`}}>
              {'messages'}
            </div>
            {RECEIPT_ROWS.map((r, i) => (
              <div
                key={r.role}
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  borderLeft: `4px solid ${r.color}`,
                  background: r.role === 'tool_result' ? theme.panel : 'transparent',
                  opacity: rows[i],
                  transform: `translateY(${(1 - rows[i]) * 14}px)`,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{`[${r.role}]  `}</span>
                <span style={{fontFamily: theme.mono, fontSize: 24, color: r.color}}>{r.text}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      {/* 师傅看得见自己被拒（text 白，无彩） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...master}}>
        <svg width={200} height={240} style={{position: 'absolute', left: 620, top: 330}}>
          <circle cx={100} cy={44} r={34} fill={theme.text} opacity={0.9} />
          <path d="M20 240 Q20 96 100 88 Q180 96 180 240 Z" fill={theme.text} opacity={0.9} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 590,
            width: 200,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            color: theme.dim,
          }}
        >
          {'看得见'}
        </div>
      </div>

      {/* 工坊门（mech 描边）+ 分工伏笔题词 */}
      <div style={{position: 'absolute', left: 220, top: 300, opacity: doorIn}}>
        <div
          style={{
            width: 170,
            height: 280,
            borderRadius: '14px 14px 0 0',
            border: `4px solid ${theme.mech}`,
            borderBottom: 'none',
            background: theme.panel,
            boxShadow: `0 0 ${22 * breathe}px ${theme.mech}`,
            position: 'relative',
          }}
        >
          <div style={{position: 'absolute', right: 18, top: 128, width: 12, height: 12, borderRadius: 999, background: theme.mech, opacity: breathe}} />
          <div style={{position: 'absolute', left: 24, top: 40, width: 100, height: 2, background: theme.mechDeep}} />
          <div style={{position: 'absolute', left: 24, top: 200, width: 100, height: 2, background: theme.mechDeep}} />
        </div>
        <div
          style={{
            marginTop: 18,
            width: 170,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 30,
            fontWeight: 700,
            color: theme.mech,
            opacity: splitTag,
          }}
        >
          {'门禁 · 工坊执行'}
        </div>
      </div>
      <Footnote delay={2 + DUR.f5 + 2 * 10}>{'tool_result: Permission denied.'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-H 产品面速览（p3-29） ──────────────────────────────────────────────

const ProductGlance: React.FC = () => {
  const cards = useStagger(2, {at: 4, stride: 8, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 460, top: 420, display: 'flex', gap: 80}}>
        <div style={{opacity: cards[0], transform: `translateY(${(1 - cards[0]) * 18}px)`}}>
          <NumberedCard index={1} label={'默认免批'} sub={'cwd read'} active={cards[0] > 0.5} width={420} />
        </div>
        <div style={{opacity: cards[1], transform: `translateY(${(1 - cards[1]) * 18}px)`}}>
          <NumberedCard index={2} label={'模式多档'} sub={'Shift+Tab'} active={cards[1] > 0.5} width={420} />
        </div>
      </div>
      <Footnote delay={4}>{'Shift+Tab'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3ThreeGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-09');
  const bC = w('p3-11', 'p3-12');
  const bD = w('p3-14', 'p3-16');
  const bE = w('p3-17', 'p3-18');
  const bF = w('p3-19', 'p3-23');
  const bG = w('p3-24', 'p3-28');
  const bH = w('p3-29');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 安全债到期">
        <SceneTag chapter="Permission Gates" tagline="三道门禁" />
        <DebtDue atWarn={at('p3-02') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="3-B 三道门禁">
        {/* 可见岛 p3-03；窗 = 本镜 6 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p3-04') - bB.from, durationInFrames: dur('p3-04')},
            {at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
            {at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
            {at: at('p3-09') - bB.from, durationInFrames: dur('p3-09')},
          ]}
        >
          {/* 多挂 f3 帧：让位淡出盖满后再卸载 */}
          <Sequence durationInFrames={dur('p3-03') + DUR.f3}>
            <GatesSneak />
          </Sequence>
        </ArchifyYield>
        {/* 前镜（2-E 围墙）无图 → 首章默认入场；章内背靠背自动抑制换章弹入 */}
        <ArchifyRecap
          slug="three-gates"
          caption="三道门禁"
          cues={[
            {chapterId: 'welded-gate', at: at('p3-04') - bB.from, durationInFrames: dur('p3-04')},
            {chapterId: 'bash-scope', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'rule-gate', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {chapterId: 'intercom-gate', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
            {chapterId: 'order-locked', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
            {chapterId: 'one-line-join', at: at('p3-09') - bB.from, durationInFrames: dur('p3-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 危险品名册">
        <WordRoster atContrast={at('p3-12') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="3-D 官方次序条">
        <OfficialOrder atHole={at('p3-16') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="3-E 倒置假想与金句">
        <InvertedGates
          atFlip={at('p3-17') - bE.from + 4}
          atEscape={at('p3-17') - bE.from + Math.round(dur('p3-17') * 0.45)}
          atRevert={at('p3-18') - bE.from + 2}
          atQuote={at('p3-18') - bE.from + Math.round(dur('p3-18') * 0.5)}
        />
      </Sequence>

      <Sequence {...bF} name="3-F 拆墙双联画">
        {/* 3-E 自制装置隔开两实例 → 默认入场；五句五接力无空窗 */}
        <ArchifyRecap
          slug="fence-to-intercom"
          caption="拆墙换门"
          cues={[
            {chapterId: 'quiet-big-day', at: at('p3-19') - bF.from, durationInFrames: dur('p3-19')},
            {chapterId: 'fence-removed', at: at('p3-20') - bF.from, durationInFrames: dur('p3-20')},
            {chapterId: 'downgrade-ask', at: at('p3-21') - bF.from, durationInFrames: dur('p3-21')},
            {chapterId: 'wall-to-intercom', at: at('p3-22') - bF.from, durationInFrames: dur('p3-22')},
            {chapterId: 'net-effect', at: at('p3-23') - bF.from, durationInFrames: dur('p3-23')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="3-G 拒绝回执">
        {/* 可见岛 p3-24；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p3-25') - bG.from, durationInFrames: dur('p3-25')}]}>
          <Sequence durationInFrames={dur('p3-24') + DUR.f3}>
            <ReceiptIntro />
          </Sequence>
        </ArchifyYield>
        {/* 3-F net-effect（p3-23）与本章隔 p3-24 空窗句 → 独立实例默认入场 */}
        <ArchifyRecap
          slug="fence-to-intercom"
          caption="拆墙换门"
          cues={[{chapterId: 'denied-receipt', at: at('p3-25') - bG.from, durationInFrames: dur('p3-25')}]}
        />
        <Sequence from={at('p3-26') - bG.from} name="3-G 回落：看得见被拒">
          <ReceiptFallback atSplit={at('p3-27') - at('p3-26')} />
        </Sequence>
      </Sequence>

      <Sequence {...bH} name="3-H 产品面速览">
        <ProductGlance />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3ThreeGates;
