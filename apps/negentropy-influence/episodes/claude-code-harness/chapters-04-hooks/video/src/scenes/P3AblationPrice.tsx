/** P3 钩子值多少钱（p3-01..p3-10，3 镜）——分镜 3-A / 3-B / 3-C（全片张力峰值）。
 *
 *  叙事链：实验 5 左红右绿消融同屏（双轨框架即坐标锚）——「直接忽略」左轨开关
 *  闭合到红位、「其余全开」齐亮绿（只动一个开关的实验口径）→「风平浪静」左轨
 *  表面帧照常收尾（任务完成签亮起——假绿帧：表面与右轨无差）→「数字露馅」左
 *  轨数字帧翻红：续跑 stop_continued 1→0 跳变、检查点 checkpoints 5/5→4/5 掉
 *  格（重音镜——表面帧随翻红连续降档压暗，数字层高亮）、「只过四个」第五格
 *  熄灭定格 → 教训短签「退出权 · 也是扩展点」贴上左轨、服务完本拍退役〔M-006〕
 *  → 3-B 实验 4 拔回调动画：右半画幅承在位态（环体微缩护栏在位、PreToolUse
 *  挂点下双回调卡），左半操作手（灰）将权限回调卡自挂点串上摘走（摘除轨迹可
 *  见、缺口虚位留痕、串 -1）→「越界」写出箭头冲出工作区范围框（边界蓝承 ep2
 *  签名——冲出不弹回、无闸门语义）、读数越界 0→1 翻红（重音镜）→「一处都没
 *  问」问询气泡两处虚影同时熄灭、读数问询 2→0 →「拔闸门」挂点缺口扩大成环体
 *  护栏缺口、「不是特权，是配置」摘下的回调卡翻面显示「配置」签（定格半拍）
 *  → 3-C 中置对仗字卡：左联「挂上 ＝ 质检 + 安全」（确认绿）/ 右联「拔下 ＝
 *  当场退化」（警示红）等高对仗定格（重音镜）→「真实的 Claude Code」拉远
 *  （@pushIn 负增量降压重锚生产全景）、生产剪影入画、「长什么样」剪影上问号
 *  亮起（幕尾悬念半拍收暗）。
 *
 *  空间契约：幕间承接（2-C→3-A 判续不 morph）——Stop 紫钩与续跑指令以同形
 *  签名在左轨回归（A-30：不整组换血）；红左绿右恒定不互换；假绿帧先于翻红帧
 *  （时序=口播：先平静后露馅）；读数 1→0 / 5→4 / 0→1 / 2→0 逐项=口播、带基线
 *  刻度（G1 note4：3-B 读数与 3-A 同款）；摘除轨迹可见（禁只给结论不给过程）；
 *  右半在位态全程无退化；两组实验读数不混轨。
 *
 *  红线落实：词落位 = 句首 + 句长比例；useCount 钳制（数据永不过冲）；教训短
 *  签 9 字形态「退出权 · 也是扩展点」（G1 note1——归一化 9 字以下不触 caption-
 *  dup）；y≥56 / bottom≥168。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {AblationTrack, CallbackCard, HookPoint, LoopRing, Panel, SceneTag, ringPt} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useEnter, useImpulse, useProgress, usePushIn} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const Foot3: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 168,
      textAlign: 'center',
      fontFamily: theme.mono,
      fontSize: 22,
      color: theme.dim,
      opacity: 0.85,
    }}
  >
    {children}
  </div>
);

/** 读数位（带基线标尺——3-A/3-B 同款形态〔G1 note4〕；useCount 钳制不过冲） */
const CountCell: React.FC<{label: string; en: string; value: number; color: string; base: string}> = ({label, en, value, color, base}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 5}}>
    <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>
      {label + ' · ' + en}
    </span>
    <span
      style={{
        fontFamily: theme.mono,
        fontSize: 52,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
    >
      {`${Math.round(value)}`}
    </span>
    {/* 基线标尺（底线 + 基准标签——Baseline-Anchored Counter） */}
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <div style={{width: 140, height: 3, background: withAlpha(color, 0.75), borderRadius: 2}} />
      <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{base}</span>
    </div>
  </div>
);

/** 检查点五格带（5/5 → 4/5：第五格熄灭定格） */
const CheckBand: React.FC<{x: number; y: number; lit: number; color: string; fifthOut: number}> = ({x, y, lit, color, fifthOut}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 7}}>
    {Array.from({length: 5}, (_, i) => {
      const on = clamp01(lit * 5 - i) * (i === 4 ? 1 - clamp01(fifthOut) : 1);
      return (
        <div
          key={i}
          style={{
            width: 46,
            height: 46,
            borderRadius: 7,
            border: `2.5px solid ${on > 0.5 ? color : theme.panelBorder}`,
            background: on > 0.5 ? withAlpha(color, 0.18) : 'transparent',
            opacity: 0.55 + 0.45 * on,
          }}
        />
      );
    })}
  </div>
);

// ── 3-A 实验 5：忽略续跑（假绿帧 → 数字翻红） ──────────────────────────

const ShotA: React.FC<{atFrame: number; atSwitch: number; atOthers: number; atCalm: number; atRounds: number; atExpose: number; atLesson: number; lessonSpan: number}> = ({
  atFrame,
  atSwitch,
  atOthers,
  atCalm,
  atRounds,
  atExpose,
  atLesson,
  lessonSpan,
}) => {
  const frame = useCurrentFrame();
  // 双轨框架立起（「实测说话」）——左红右绿并置
  const frameIn = useEnter('rise', {at: atFrame, dur: DUR.f5, dist: 26, springPreset: 'settle'});
  // 左轨开关闭合到红位（「直接忽略」——只动这一个开关）；其余开关位齐亮绿一拍
  const swClosed = useProgress(atSwitch, DUR.f4);
  const swPunch = useImpulse({at: atSwitch + DUR.f3, dur: DUR.f4, peak: 0.08});
  const othersLit = useProgress(atOthers, DUR.f4);
  // 双轨轮次带同步（同一 progress——同值起跑、同拍演化〔QA-4〕）
  const rounds = useProgress(atRounds, DUR.f6, 'linear');
  // 假绿帧：任务完成签亮起（表面与右轨无差——叙事需要的第一拍）
  const calm = useProgress(atCalm, DUR.f4);
  // 数字露馅：表面帧连续降档压暗（QA-12 上层假绿让位）→ 数字层翻红
  const expose = useProgress(atExpose, DUR.f4);
  const surfaceDim = Math.max(0.3, 1 - expose * 0.7);
  // 续跑 1→0（跳变翻红）；检查点 5/5→4/5（第五格熄灭定格在「只过四个」）
  const stopN = 1 - useCount({from: 0, to: 1, at: atExpose, dur: DUR.f4});
  const cpN = 5 - useCount({from: 0, to: 1, at: atExpose + DUR.f2, dur: DUR.f4});
  const fifthOut = clamp01(progress(frame, atExpose + DUR.f4, DUR.f4));
  const exposePulse = useImpulse({at: atExpose, dur: DUR.f5, peak: 1});
  // 教训短签（9 字形态——G1 note1；M-006 服务完本拍退役：退场锚=入场点、
  // 退场因子只作用短签层）
  const lessonIn = useProgress(atLesson, DUR.f3);
  const lessonOut = useProgress(atLesson + lessonSpan - Math.round(lessonSpan * 0.4), Math.round(lessonSpan * 0.4));
  return (
    <AbsoluteFill>
      <SceneTag chapter="Ablation 5" tagline="忽略续跑" accent={theme.danger} />
      <div style={{...frameIn}}>
        {/* ── 左轨：忽略续跑（警示红——反例） ── */}
        <AblationTrack x={130} y={170} w={720} tag={'忽略续跑'} accent={theme.danger} lit={1} rounds={rounds} />
        {/* 左轨开关排（实验开关卡：续跑位拨到红 + 其余回调开关齐亮绿） */}
        <div style={{position: 'absolute', left: 160, top: 330, display: 'flex', gap: 14, alignItems: 'stretch'}}>
          <div style={{transform: `scale(${1 + swPunch})`}}>
            <Panel accent={theme.danger} style={{width: 196, padding: '10px 14px', position: 'relative'}}>
              <div style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text}}>{'续跑'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'stop_continued'}</div>
              {/* 拨杆槽（on → off：闭合到红位） */}
              <svg width={166} height={30} viewBox="0 0 166 30" style={{marginTop: 6}}>
                <rect x={4} y={11} width={158} height={9} rx={4.5} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} />
                <text x={6} y={8} fontFamily={theme.mono} fontSize={11} fill={theme.ok}>
                  on
                </text>
                <text x={140} y={8} fontFamily={theme.mono} fontSize={11} fill={theme.danger}>
                  off
                </text>
                <circle cx={16 + 136 * clamp01(swClosed)} cy={15.5} r={10} fill={theme.bg} stroke={swClosed > 0.5 ? theme.danger : theme.ok} strokeWidth={3.5} />
              </svg>
            </Panel>
          </div>
          {['注入', '权限', '日志', '查副作用'].map((k) => (
            <div
              key={k}
              style={{
                width: k.length > 2 ? 118 : 92,
                padding: '10px 12px',
                boxSizing: 'border-box',
                borderRadius: 14,
                border: `2.5px solid ${othersLit > 0.5 ? theme.ok : theme.panelBorder}`,
                background: othersLit > 0.5 ? withAlpha(theme.ok, 0.1) : 'transparent',
                opacity: 0.45 + 0.55 * othersLit,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.text}}>{k}</div>
              <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.ok, opacity: othersLit}}>{'on ✓'}</div>
            </div>
          ))}
        </div>
        {/* 左轨表面帧（假绿——任务完成签；翻红时连续降档压暗） */}
        <div style={{position: 'absolute', left: 160, top: 470, opacity: surfaceDim}}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              borderRadius: 10,
              border: `2.5px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.12),
              opacity: calm,
            }}
          >
            <span style={{width: 14, height: 14, borderRadius: 999, background: theme.ok}} />
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok}}>{'任务完成'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'surface'}</span>
          </div>
        </div>
        {/* 左轨读数位（续跑 1→0 翻红 + 检查点五格带——带基线标尺） */}
        <div style={{position: 'absolute', left: 160, top: 560, display: 'flex', gap: 100, opacity: 0.35 + 0.65 * clamp01(expose)}}>
          <CountCell label={'续跑'} en={'stop_continued'} value={stopN} color={theme.danger} base={'基线 1'} />
          <div>
            <CountCell label={'检查点'} en={'checkpoints'} value={cpN} color={theme.danger} base={'基线 5/5'} />
          </div>
        </div>
        <CheckBand x={475} y={648} lit={1} color={theme.danger} fifthOut={fifthOut} />
        {/* 翻红冲击（重音镜一拍） */}
        {exposePulse > 0.01 ? (
          <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
            <circle cx={400} cy={610} r={60 + 120 * exposePulse} fill="none" stroke={theme.danger} strokeWidth={4} opacity={exposePulse * 0.7} />
          </svg>
        ) : null}
        {/* ── 右轨：在位（确认绿——无任何退化） ── */}
        <AblationTrack x={1050} y={170} w={720} tag={'在位'} accent={theme.ok} lit={1} rounds={rounds} />
        <div style={{position: 'absolute', left: 1080, top: 330, display: 'flex', gap: 14, alignItems: 'stretch'}}>
          <Panel accent={theme.ok} style={{width: 196, padding: '10px 14px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text}}>{'续跑'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'stop_continued'}</div>
            <svg width={166} height={30} viewBox="0 0 166 30" style={{marginTop: 6}}>
              <rect x={4} y={11} width={158} height={9} rx={4.5} fill="none" stroke={theme.panelBorder} strokeWidth={2.5} />
              <circle cx={16} cy={15.5} r={10} fill={theme.bg} stroke={theme.ok} strokeWidth={3.5} />
              <circle cx={16} cy={15.5} r={3.5} fill={theme.ok} />
            </svg>
          </Panel>
          {['注入', '权限', '日志', '查副作用'].map((k) => (
            <div
              key={k}
              style={{
                width: k.length > 2 ? 118 : 92,
                padding: '10px 12px',
                boxSizing: 'border-box',
                borderRadius: 14,
                border: `2.5px solid ${theme.ok}`,
                background: withAlpha(theme.ok, 0.1),
                opacity: 0.9,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.text}}>{k}</div>
              <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.ok}}>{'on ✓'}</div>
            </div>
          ))}
        </div>
        {/* 右轨读数位（在位全绿——续跑 1 · 检查点 5/5 恒在，无退化） */}
        <div style={{position: 'absolute', left: 1080, top: 560, display: 'flex', gap: 100, opacity: 0.95}}>
          <CountCell label={'续跑'} en={'stop_continued'} value={1} color={theme.ok} base={'基线 1'} />
          <CountCell label={'检查点'} en={'checkpoints'} value={5} color={theme.ok} base={'基线 5/5'} />
        </div>
        <CheckBand x={1395} y={648} lit={1} color={theme.ok} fifthOut={0} />
        {/* 教训短签（9 字钉选形态；服务完本拍退役） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 800, display: 'flex', justifyContent: 'center', opacity: lessonIn * (1 - lessonOut), pointerEvents: 'none'}}>
          <Panel accent={theme.danger} style={{padding: '16px 36px', background: theme.bg}}>
            <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.danger}}>{'退出权 · 也是扩展点'}</span>
          </Panel>
        </div>
      </div>
      <Foot3>{'实验 5 · 忽略 Stop 续跑 ↔ 在位基线'}</Foot3>
    </AbsoluteFill>
  );
};

// ── 3-B 实验 4：摘回调（摘除轨迹 + 越界冲框 + 问询清零） ────────────────

/** 操作手（灰——简笔机械臂，叙事锚内的拟人幅度；reach 0..1 自底部伸向挂点串） */
const OpHand: React.FC<{reach: number}> = ({reach}) => (
  <svg width={520} height={640} viewBox="0 0 520 640" style={{position: 'absolute', left: 0, top: 240, overflow: 'visible'}}>
    <g stroke={theme.dim} strokeWidth={7} fill="none" strokeLinecap="round">
      {/* 臂（两段：底座 → 肘 → 爪；reach=1 时爪位 ≈ (330, 380)——挂点串下缘） */}
      <line x1={150} y1={600} x2={150 + 90 * reach} y2={600 - 260 * reach} />
      <line x1={150 + 90 * reach} y1={600 - 260 * reach} x2={150 + 180 * reach} y2={600 - 460 * reach} />
      {/* 夹爪（两指） */}
      <line x1={150 + 180 * reach - 13} y1={600 - 460 * reach} x2={150 + 180 * reach - 24} y2={600 - 460 * reach - 32} />
      <line x1={150 + 180 * reach + 13} y1={600 - 460 * reach} x2={150 + 180 * reach + 24} y2={600 - 460 * reach - 32} />
      <circle cx={150} cy={600} r={13} />
    </g>
  </svg>
);

const ShotB: React.FC<{atReach: number; atPluck: number; atOut: number; atAsk: number; atGap: number; atFlip: number}> = ({
  atReach,
  atPluck,
  atOut,
  atAsk,
  atGap,
  atFlip,
}) => {
  const frame = useCurrentFrame();
  // 操作手伸向 PreToolUse 挂点 → 摘出权限回调卡（摘除轨迹可见、串 -1）
  const reach = useProgress(atReach, DUR.f5, 'decelerate');
  const pluck = useProgress(atPluck, DUR.f5, 'accelerate');
  const pluckedX = -170 * pluck;
  const pluckedY = 235 * pluck;
  // 越界写出箭头（冲出工作区框——警示红尾迹；冲出不弹回、无闸门语义）
  const out = useProgress(atOut, DUR.f5, 'accelerate');
  const outFlash = useImpulse({at: atOut + DUR.f5, dur: DUR.f5, peak: 1});
  // 问询气泡两处虚影同时熄灭（同拍）；读数问询 2→0
  const askOut = useProgress(atAsk, DUR.f4);
  const askedN = 2 * (1 - useProgress(atAsk, DUR.f4));
  const outN = useCount({from: 0, to: 1, at: atOut + DUR.f4, dur: DUR.f4});
  // 「拔闸门」：挂点缺口扩大成环体护栏缺口（失护栏具象）
  const gap = useProgress(atGap, DUR.f5);
  // 「不是特权，是配置」：摘下的回调卡翻面显示「配置」签（定格半拍）
  const flip = useProgress(atFlip, DUR.f4);
  const flipGlow = useImpulse({at: atFlip + DUR.f4, dur: DUR.f5, peak: 1});
  // 右半在位态环体（微缩——PreToolUse 挂点下双回调卡全程在位无退化）
  const RING_R = {cx: 1480, cy: 430, size: 330} as const;
  const rr = RING_R.size / 2 - 46;
  const prePtR = ringPt(RING_R.cx, RING_R.cy, rr, 0);
  return (
    <AbsoluteFill>
      <SceneTag chapter="Ablation 4" tagline="摘除权限回调" accent={theme.danger} />
      {/* ── 右半：在位态（无退化） ── */}
      <div style={{position: 'absolute', left: 600, top: 120, fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok, opacity: 0.9}}>
        {'在位 · 对照'}
      </div>
      <div style={{position: 'absolute', left: RING_R.cx - RING_R.size / 2, top: RING_R.cy - RING_R.size / 2, opacity: 0.85}}>
        <LoopRing size={RING_R.size} nodes={[]} showExit={false} dotProgress={(frame / 102) % 1} />
      </div>
      <HookPoint cx={prePtR.x} cy={prePtR.y} lit={1} />
      {/* 在位双回调卡（权限 + 日志——恒在位） */}
      <div style={{position: 'absolute', left: prePtR.x - 96, top: prePtR.y + 30}}>
        <CallbackCard x={0} y={0} w={168} h={56} label={'权限'} sub={'perm'} lit={1} />
      </div>
      <div style={{position: 'absolute', left: prePtR.x + 88, top: prePtR.y + 30}}>
        <CallbackCard x={0} y={0} w={168} h={56} label={'日志'} sub={'log'} lit={1} />
      </div>
      <div style={{position: 'absolute', left: RING_R.cx - 70, top: RING_R.cy + 150, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
        {'PreToolUse'}
      </div>
      {/* ── 左半：摘回调（实验轨） ── */}
      <div style={{position: 'absolute', left: 130, top: 120, fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.danger}}>
        {'摘掉权限回调'}
      </div>
      {/* 工作区范围框（边界蓝承 ep2 签名 #4E9EFF——越界冲出的框界） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <rect x={150} y={220} width={700} height={400} rx={16} fill="none" stroke={'#4E9EFF'} strokeWidth={3} strokeDasharray="14 11" opacity={0.65} />
      </svg>
      <div style={{position: 'absolute', left: 170, top: 232, fontFamily: theme.mono, fontSize: 15, color: '#4E9EFF'}}>{'workspace'}</div>
      {/* 实验轨挂点（PreToolUse 微缩——左轨同签名回归） */}
      <HookPoint cx={400} cy={330} lit={1} />
      <div style={{position: 'absolute', left: 330, top: 360, fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'PreToolUse'}</div>
      {/* 回调串：日志卡恒挂 + 权限卡被摘走（缺口虚位留痕、串 -1） */}
      <div style={{position: 'absolute', left: 470, top: 300}}>
        <CallbackCard x={0} y={0} w={150} h={52} label={'日志'} sub={'log'} lit={1} />
      </div>
      {/* 摘走中的权限卡（随操作手拖出——摘除轨迹可见）+ 落位翻面 */}
      <div
        style={{
          position: 'absolute',
          left: 240 + pluckedX,
          top: 300 + pluckedY,
          transform: `rotate(${pluck * -12}deg)`,
        }}
      >
        <CallbackCard x={0} y={0} w={150} h={52} label={'权限'} sub={'perm'} lit={1 - pluck * 0.15} removed={0} flip={flip} flash={flipGlow * 0.6} />
      </div>
      {/* 缺口虚位（摘除留痕——位还在、回调没了；「拔闸门」缺口扩大成护栏缺口） */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          top: 300,
          width: 150 + 40 * clamp01(gap),
          height: 52,
          borderRadius: 10,
          border: `2.5px dashed ${clamp01(gap) > 0.5 ? theme.danger : theme.panelBorder}`,
          opacity: clamp01(Math.max(pluck, 0.001)) * 0.95,
        }}
      />
      {/* 环体护栏缺口（「拔闸门」——失护栏具象：缺口沿框上沿扩大警示红） */}
      {clamp01(gap) > 0.01 ? (
        <svg width={700} height={60} style={{position: 'absolute', left: 150, top: 190, overflow: 'visible'}}>
          <line
            x1={700}
            y1={30}
            x2={700 - 620 * clamp01(gap)}
            y2={30}
            stroke={theme.danger}
            strokeWidth={5}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - clamp01(gap)}
            opacity={0.8}
          />
        </svg>
      ) : null}
      {/* 操作手（灰——伸向挂点摘卡；摘出后随卡回收半程） */}
      <OpHand reach={reach * (1 - pluck * 0.45)} />
      {/* 越界写出箭头（自工作区冲出右框——警示红尾迹，冲出不弹回） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: clamp01(out) > 0.01 ? 1 : 0}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
          <line
            x1={420}
            y1={470}
            x2={420 + 640 * clamp01(out)}
            y2={470 - 60 * clamp01(out)}
            stroke={theme.danger}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.9}
          />
          {clamp01(out) > 0.95 ? <path d={`M ${1040} 396 L 1078 406 L 1044 424 Z`} fill={theme.danger} /> : null}
        </svg>
        {/* 冲出闪光（越过框界一拍） */}
        {outFlash > 0.01 ? (
          <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
            <circle cx={860} cy={440} r={20 + 70 * outFlash} fill="none" stroke={theme.danger} strokeWidth={4} opacity={outFlash} />
          </svg>
        ) : null}
      </div>
      {/* 问询气泡两处虚影（同时熄灭——同拍） */}
      {[0, 1].map((i) => (
        <div
          key={`ask${i}`}
          style={{
            position: 'absolute',
            left: 560 + i * 190,
            top: 540,
            width: 150,
            height: 58,
            borderRadius: 999,
            border: `2.5px dashed ${withAlpha(theme.dim, 0.6)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: (0.55 + 0.1 * Math.sin(frame / 7 + i)) * (1 - clamp01(askOut)),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'问询'}</span>
        </div>
      ))}
      {/* 读数条（越界 0→1 / 问询 2→0——带基线刻度，与 3-A 同款） */}
      <div style={{position: 'absolute', left: 190, top: 700, display: 'flex', gap: 120}}>
        <CountCell label={'越界'} en={'outside_writes'} value={outN} color={theme.danger} base={'基线 0'} />
        <CountCell label={'问询'} en={'asked'} value={askedN} color={theme.danger} base={'基线 2'} />
      </div>
      <Foot3>{'实验 4 · 摘除 _permission_hook'}</Foot3>
    </AbsoluteFill>
  );
};

// ── 3-C 对仗字卡 + 拉远（生产剪影预告） ─────────────────────────────────

const ShotC: React.FC<{atHang: number; atPluck: number; atPull: number; atQ: number; atDim: number}> = ({atHang, atPluck, atPull, atQ, atDim}) => {
  const frame = useCurrentFrame();
  // 两联等高对仗（画面只放关键词——字面与口播不逐字相同）
  const hangLit = useProgress(atHang, DUR.f4);
  const pluckLit = useProgress(atPluck, DUR.f4);
  const settlePulse = useImpulse({at: atPluck + DUR.f4, dur: DUR.f5, peak: 0.04});
  // 拉远（@pushIn 负增量——降压重锚生产全景；字卡缩小让位）
  const pull = usePushIn(atPull, {scale: -0.07, dur: DUR.f6});
  // 生产剪影（增长条暗影 + 徽标暗影——P4 预告，不显可读机制细节）
  const silhouette = useProgress(atPull + DUR.f4, DUR.f5);
  const q = useProgress(atQ, DUR.f4);
  const qBreathe = 0.7 + 0.3 * Math.sin(frame / 16);
  const dimAll = useProgress(atDim, DUR.f4);
  return (
    <AbsoluteFill style={{transform: pull}}>
      {/* 对仗字卡（中置——两联等高；左绿右红恒定） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center', gap: 60, opacity: 1 - 0.55 * clamp01(silhouette)}}>
        <div
          style={{
            width: 560,
            height: 220,
            boxSizing: 'border-box',
            borderRadius: 18,
            border: `3.5px solid ${theme.ok}`,
            background: withAlpha(theme.ok, 0.08 + 0.07 * hangLit),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: 0.4 + 0.6 * hangLit,
            transform: `scale(${1 + settlePulse})`,
            boxShadow: hangLit > 0.9 ? `0 0 ${26 * hangLit}px ${withAlpha(theme.ok, 0.4)}` : 'none',
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>{'挂上'}</span>
          <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.ok}}>{'＝ 质检 + 安全'}</span>
        </div>
        <div
          style={{
            width: 560,
            height: 220,
            boxSizing: 'border-box',
            borderRadius: 18,
            border: `3.5px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.08 + 0.07 * pluckLit),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: 0.4 + 0.6 * pluckLit,
            transform: `scale(${1 + settlePulse})`,
            boxShadow: pluckLit > 0.9 ? `0 0 ${26 * pluckLit}px ${withAlpha(theme.danger, 0.4)}` : 'none',
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>{'拔下'}</span>
          <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.danger}}>{'＝ 当场退化'}</span>
        </div>
      </div>
      {/* 生产剪影（远处渐显——增长条暗影 + 徽标暗影；不剧透 P4 细节） */}
      <div style={{position: 'absolute', left: 260, top: 700, opacity: 0.4 * silhouette, pointerEvents: 'none'}}>
        <div style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
          {Array.from({length: 26}, (_, i) => (
            <div
              key={`s${i}`}
              style={{
                width: i < 4 ? 54 : 20,
                height: 66,
                borderRadius: 6,
                border: `2px solid ${withAlpha(theme.mech, 0.5)}`,
                background: 'transparent',
              }}
            />
          ))}
          <div style={{width: 30, height: 66, borderRadius: 6, border: `2px dashed ${withAlpha(theme.mech, 0.4)}`}} />
        </div>
        {/* 剪影问号（「长什么样」——幕尾悬念打光） */}
        {q > 0.01 ? (
          <span
            style={{
              position: 'absolute',
              left: 640,
              top: -110,
              fontFamily: theme.serif,
              fontSize: 110,
              fontWeight: 700,
              color: theme.mech,
              opacity: q * qBreathe,
              textShadow: `0 0 ${34 * q}px ${withAlpha(theme.mech, 0.6)}`,
            }}
          >
            ?
          </span>
        ) : null}
      </div>
      {/* 半拍收暗（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.7 * dimAll, pointerEvents: 'none'}} />
      <Foot3>{'挂上 ↔ 拔下 · 生产版预告'}</Foot3>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3AblationPrice: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-08');
  const bC = w('p3-09', 'p3-10');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ShotA
          atFrame={wa('p3-01', 0.1) - bA.from}
          atSwitch={wa('p3-01', 0.5) - bA.from}
          atOthers={wa('p3-01', 0.82) - bA.from}
          atCalm={wa('p3-02', 0.25) - bA.from}
          atRounds={wa('p3-02', 0.5) - bA.from}
          atExpose={wa('p3-03', 0.12) - bA.from}
          atLesson={wa('p3-04', 0.3) - bA.from}
          lessonSpan={dur('p3-04')}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ShotB
          atReach={wa('p3-05', 0.18) - bB.from}
          atPluck={wa('p3-05', 0.75) - bB.from}
          atOut={wa('p3-06', 0.3) - bB.from}
          atAsk={wa('p3-07', 0.35) - bB.from}
          atGap={wa('p3-08', 0.22) - bB.from}
          atFlip={wa('p3-08', 0.7) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ShotC
          atHang={wa('p3-09', 0.1) - bC.from}
          atPluck={wa('p3-09', 0.5) - bC.from}
          atPull={wa('p3-10', 0.35) - bC.from}
          atQ={wa('p3-10', 0.75) - bC.from}
          atDim={at('p3-10') + dur('p3-10') - Math.min(10, dur('p3-10') / 4) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3AblationPrice;
