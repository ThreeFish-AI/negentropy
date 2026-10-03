/** P5 拆机实验室（p5-01..26，7 镜 7 cue）——分镜 5-A…5-G，全片高潮：红绿消融对拍。
 *
 *  cue 清单（archify full，单行字面 at / dur 求和形态）与 lead 判定：
 *   5-A p5-01..04 ablation-panel / bench-open   —— 默认 lead：本幕首 cue，上一 cue 在
 *        P4 镜内（跨幕隔 SceneFade），非紧邻；
 *   5-B p5-05..08 ablation-panel / kill-thread   —— lead={false}：与 5-A 同 slug 跨镜
 *        背靠背（p5-04 末→p5-05 首紧邻，dur 求和恰无缝）；
 *   5-C p5-09..10 ablation-panel / date-slip     —— lead={false}：同 slug 跨镜背靠背
 *        （p5-08 末→p5-09 首紧邻）；
 *   5-D p5-11..13 ablation-panel / silent-miss   —— lead={false}：同上（p5-10→p5-11）；
 *   5-E p5-14..15 knock-walk-away / door-busy    —— lead={false}：与 5-D 背靠背
 *        （p5-13 末→p5-14 首紧邻，跨 slug 换图同判例·评审修复）；
 *   5-F p5-17..20 ablation-panel / burn-wait     —— 默认 lead：与 5-D 同 slug，但中间隔了
 *        5-E 换图镜（p5-14..16 空窗），非紧邻同图 ⇒ 入场恢复；
 *   5-G p5-21..25 ablation-panel / timeout-crash —— lead={false}：与 5-F 同 slug 跨镜
 *        背靠背（p5-20 末→p5-21 首紧邻）；p5-26 留作窗外收句。
 *
 *  ★要点：
 *  - 红绿专属语义（C 型素材映射契约 3）：ok=「机制在位」基线 / danger=「拆掉后」
 *    崩溃态，只给实验对拍与判读；SceneTag 走 mech（机制实验室），计费条 accent 金
 *    （P0 计费母题在 e5 复燃）。零 Lottie（ISSUE-202）。
 *  - 对拍面板主体由 ablation-panel / knock-walk-away 录制章承担（全屏独占 v4）；
 *    本文件在画框外缘挂仪器层——ArchifyClip 画框占 x311..1609 / y150..880，左缘
 *    311px 边距即 PillarHUD 同款常驻先例：右缘=实验台五开关（svg 拨杆件，本幕私有
 *    组件，跨 5-A..5-F 单实例常驻防切镜闪现），左下=e1..e5 实测读数卡（Counter
 *    数字跳变 2→0 / 1→0 / 真→假 / 5→0 / 0→600）。
 *  - 窗外句窗承载全屏自制装置（v4 三分法之 b/c 档）：p5-16 对话时间轴（绿侧弹开
 *    ×5 / 红侧强插＋「单写者规矩破」盖章）、p5-26 收句对账预告；5-G 左下角是
 *    「翻车小票」（安装条 120s 剪断 → Error 行打印 → 摘要 200 字二次特写 → 盖章）。
 *  - 顶部 y<56 空（章节条占用）；SceneTag top:64；底部内容压在 y≤872（字幕带之上）。
 */
import React from 'react';
import {useCurrentFrame, AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  useDraw,
  useEnter,
  useFadeOut,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useSpring,
  useStagger,
} from '../motion';

/** theme 色 + α（hex 后缀形态）：读 token 而非十进制复写，改值不漂移 */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 实验台五开关（svg 拨杆件，本幕私有组件；5-B..5-G 逐个复用） ──────────

/** 单个拨杆：底座＋滑槽＋旋钮（空间通道走弹簧）＋LED（ok=在位 / danger=拆掉，
 *  effects 通道走时长+缓动）。pull→release 之间为「拆掉」态；flash 时刻五路全红。 */
const RailSwitch: React.FC<{
  label: string;
  enterAt: number;
  lightUpAt: number;
  pullAt: number;
  releaseAt: number;
  flashAll: number;
}> = ({label, enterAt, lightUpAt, pullAt, releaseAt, flashAll}) => {
  const enter = useEnter('slideR', {at: enterAt, dur: DUR.f4, dist: 46});
  const downSnap = useSpring('snap', {at: pullAt, dur: DUR.f4});
  const upBack = useSpring('settle', {at: releaseAt, dur: DUR.f4});
  const pullIn = useProgress(pullAt, DUR.f2);
  const releaseIn = useProgress(releaseAt, DUR.f2);
  const lit = useProgress(lightUpAt, DUR.f3);

  const pulled = pullIn * (1 - releaseIn);
  const down = clamp01(Math.max(downSnap * (1 - upBack), flashAll));
  const red = clamp01(Math.max(pulled, flashAll));
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 13, height: 84, ...enter}}>
      <svg width={56} height={84} viewBox="0 0 56 84">
        <rect x={5} y={4} width={34} height={76} rx={9} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2.5} />
        <line x1={22} y1={19} x2={22} y2={65} stroke={theme.panelBorder} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
        <circle cx={22} cy={30 + down * 22} r={11} fill={theme.dim} stroke={theme.bg} strokeWidth={2.5} />
        {/* LED：在位 ok（5-A 绿灯基线）→ 拆掉 danger（红绿实验语义） */}
        <circle cx={47} cy={16} r={9} fill={theme.ok} opacity={0.16 * lit * (1 - red)} />
        <circle cx={47} cy={16} r={5.5} fill={theme.ok} opacity={lit * (1 - red)} />
        <circle cx={47} cy={16} r={5.5} fill={theme.danger} opacity={lit * red} />
      </svg>
      <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: red > 0.5 ? theme.danger : theme.text}}>
        {label}
      </span>
    </div>
  );
};

/** 仪器层（跨 5-A..5-F 单实例常驻）：右缘五开关轨＋顶部红绿图例。
 *  5-F p5-20 收束闪——五 LED 全红一瞬（flashAll）后随 release 全回绿：机器完整。 */
const SWITCHES = ['兜错', '记号', '或门', '忙锁', '兜底'] as const;

const LabInstruments: React.FC<{
  enterAt: number;
  lightUpAt: number;
  legendAt: number;
  pulls: number[];
  flashAt: number;
  span: number;
}> = ({enterAt, lightUpAt, legendAt, pulls, flashAt, span}) => {
  const fade = useFadeOut(span, {frames: 16});
  const flash = useImpulse({at: flashAt, dur: DUR.f5});
  const legend = useStagger(2, {at: legendAt, stride: 7, dur: DUR.f4});
  const legendRows = [
    {c: theme.ok, t: '机制在位'},
    {c: theme.danger, t: '拆掉后'},
  ] as const;
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {/* 顶部红绿图例（p5-04「绿色是基线，红色是拆掉之后」；画框顶 150 之上） */}
      <div style={{position: 'absolute', right: 28, top: 80, display: 'flex', gap: 28}}>
        {legendRows.map((ch, i) => (
          <div
            key={ch.t}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              opacity: legend[i],
              transform: `translateY(${(1 - legend[i]) * 14}px)`,
            }}
          >
            <span style={{width: 15, height: 15, borderRadius: 4, background: withAlpha(ch.c, 0.22), border: `2.5px solid ${ch.c}`}} />
            <span style={{fontFamily: theme.sans, fontSize: 22, color: ch.c}}>{ch.t}</span>
          </div>
        ))}
      </div>

      {/* 右缘实验台轨（画框右缘 1609 之外） */}
      <div style={{position: 'absolute', left: 1646, top: 232}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, paddingLeft: 2}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>{'实验台'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'e1–e5'}</span>
        </div>
        <div style={{position: 'absolute', left: -14, top: 66, width: 2, height: 448, background: theme.panelBorder}} />
        <div style={{marginTop: 18}}>
          {SWITCHES.map((lb, i) => (
            <RailSwitch
              key={lb}
              label={lb}
              enterAt={enterAt + i * 4}
              lightUpAt={lightUpAt}
              pullAt={pulls[i]}
              releaseAt={i < 4 ? pulls[i + 1] : flashAt + 10}
              flashAll={flash}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 左缘实测读数卡（e1..e5：基线数字在位绿 → 拆掉值崩溃红） ─────────────

/** e1 整面钟：指针停摆＋裂纹 path 一拍（p5-08「是整面钟」） */
const CrackClock: React.FC<{at: number}> = ({at}) => {
  const crack = useDraw(at, DUR.f4);
  const flash = useImpulse({at, dur: DUR.f5});
  return (
    <svg width={64} height={64} viewBox="0 0 64 64">
      <circle cx={32} cy={32} r={26} fill="none" stroke={theme.dim} strokeWidth={3} opacity={0.9} />
      <line x1={32} y1={32} x2={21} y2={24} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
      <line x1={32} y1={32} x2={45} y2={27} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
      <path
        d="M32 32 L27 20 L34 11 M32 32 L43 41 L39 54 M32 32 L21 44"
        fill="none"
        stroke={theme.danger}
        strokeWidth={2.5}
        strokeLinejoin="round"
        pathLength={crack.pathLength}
        strokeDasharray={crack.strokeDasharray}
        strokeDashoffset={crack.strokeDashoffset}
      />
      <circle cx={32} cy={32} r={26} fill="none" stroke={theme.danger} strokeWidth={3} opacity={0.7 * flash} />
    </svg>
  );
};

/** e2 日历翻页：当天页翻起（顶锚 scaleY）→ 露出次日页；九点标记灰掉 */
const FlipCalendar: React.FC<{at: number}> = ({at}) => {
  const flip = useProgress(at, DUR.f5);
  const gray = useProgress(at + DUR.f4, DUR.f3);
  return (
    <svg width={60} height={58} viewBox="0 0 60 58">
      <rect x={18} y={12} width={38} height={40} rx={4} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
      <g style={{transform: `scaleY(${1 - flip})`, transformOrigin: '37px 12px'}}>
        <rect x={12} y={12} width={38} height={40} rx={4} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
        <line x1={12} y1={20} x2={50} y2={20} stroke={theme.dim} strokeWidth={2} opacity={0.7} />
      </g>
      <circle cx={37} cy={37} r={8} fill="none" stroke={gray > 0.5 ? theme.panelBorder : theme.ok} strokeWidth={2} />
      <circle cx={37} cy={37} r={3.6} fill={gray > 0.5 ? theme.panelBorder : theme.ok} />
    </svg>
  );
};

/** e3 或门→与门：「或」（在位绿）被掰成「且」（崩溃红，旋入） */
const OrToAnd: React.FC<{at: number}> = ({at}) => {
  const morph = useProgress(at, DUR.f4);
  const slam = useSpring('snap', {at, dur: DUR.f4});
  return (
    <div style={{position: 'relative', width: 60, height: 62, fontFamily: theme.serif, fontWeight: 700}}>
      <span style={{position: 'absolute', inset: 0, fontSize: 50, lineHeight: '62px', textAlign: 'center', color: theme.ok, opacity: 1 - morph}}>
        {'或'}
      </span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          fontSize: 50,
          lineHeight: '62px',
          textAlign: 'center',
          color: theme.danger,
          opacity: morph,
          transform: `rotate(${(1 - slam) * -14}deg)`,
        }}
      >
        {'且'}
      </span>
    </div>
  );
};

/** e4 让行计数点：五点逐个亮绿（敲门弹开 ×5）→ 归零句全体灰掉 */
const KnockDots: React.FC<{at: number; zeroAt: number}> = ({at, zeroAt}) => {
  const frame = useCurrentFrame();
  const zero = useProgress(zeroAt, DUR.f3);
  return (
    <div style={{display: 'flex', gap: 7, alignItems: 'center'}}>
      {[0, 1, 2, 3, 4].map((i) => {
        const lit = clamp01((frame - (at + i * 7)) / 4) * (1 - zero);
        return (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              border: `2px solid ${lit > 0.5 ? theme.ok : theme.panelBorder}`,
              background: lit > 0.5 ? withAlpha(theme.ok, 0.5) : 'transparent',
            }}
          />
        );
      })}
    </div>
  );
};

/** e5 计费条（accent 金，P0 计费母题复燃）：随 0→600 烧涨 */
const BurnBar: React.FC<{at: number; frames: number}> = ({at, frames}) => {
  const p = useProgress(at, frames, 'accelerate');
  return (
    <div style={{marginTop: 10}}>
      <div style={{fontFamily: theme.mono, fontSize: 16, color: p > 0 ? theme.accent : theme.dim}}>{'计费'}</div>
      <div style={{width: '100%', height: 10, borderRadius: 5, background: theme.panel, border: `2px solid ${theme.panelBorder}`, marginTop: 4}}>
        <div style={{width: `${p * 100}%`, height: '100%', borderRadius: 4, background: theme.accent}} />
      </div>
    </div>
  );
};

/** 实测读数卡：数字通道 Counter 在 crash 锚跳变（基线绿→拆掉红），跳变点微震
 *  （仪器受震）；e3 用文本模式（真→假）。sub 为判读关键词，跳变后浮现。 */
const VerdictCard: React.FC<{
  enterAt: number;
  tag: string;
  term: string;
  from?: number;
  to?: number;
  textFrom?: string;
  textTo?: string;
  unit?: string;
  jumpAt: number;
  jumpFrames?: number;
  sub: string;
  glyph?: React.ReactNode;
  extra?: React.ReactNode;
  top?: number;
}> = ({enterAt, tag, term, from, to, textFrom, textTo, unit = '', jumpAt, jumpFrames = 26, sub, glyph, extra, top = 640}) => {
  const enter = useEnter('slideL', {at: enterAt, dur: DUR.f5, dist: 40});
  const crash = useProgress(jumpAt, DUR.f3);
  const subIn = useProgress(jumpAt + 8, DUR.f4);
  const rattle = useShake({at: jumpAt, decay: true, amp: 4, dur: DUR.f6});
  const hot = crash > 0.5;
  return (
    <div style={{position: 'absolute', left: 24, top, ...enter}}>
      <Panel style={{width: 276, boxSizing: 'border-box', padding: '14px 18px 16px'}}>
        <div style={{position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>{tag}</div>
          {glyph ? <span style={{position: 'absolute', right: 0, top: -8}}>{glyph}</span> : null}
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, transform: `translateX(${rattle}px)`}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>{term}</span>
          {textFrom !== undefined ? (
            <span style={{position: 'relative', display: 'inline-block', width: 58, textAlign: 'center'}}>
              <span style={{fontFamily: theme.sans, fontSize: 50, fontWeight: 700, color: theme.ok, opacity: 1 - crash}}>{textFrom}</span>
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  fontFamily: theme.sans,
                  fontSize: 50,
                  fontWeight: 700,
                  color: theme.danger,
                  opacity: crash,
                }}
              >
                {textTo}
              </span>
            </span>
          ) : (
            <Counter
              from={from ?? 0}
              to={to ?? 0}
              start={jumpAt}
              frames={jumpFrames}
              style={{fontSize: 54, fontWeight: 700, color: hot ? theme.danger : theme.ok}}
            />
          )}
          {unit ? <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{unit}</span> : null}
        </div>
        {extra}
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 8, opacity: subIn}}>{sub}</div>
      </Panel>
    </div>
  );
};

// ── p5-16 窗外全屏装置：对话时间轴对拍（绿侧弹开 ×5 / 红侧强插） ──────────

/** 绿侧基线：通知块敲门→弹开×5（确定性循环帧数），回合盒完整走完 */
const GreenLane: React.FC<{win: number}> = ({win}) => {
  const frame = useCurrentFrame();
  const startAt = 14;
  const cyc = Math.max(30, Math.floor((win - startAt - 30) / 5));
  const aEnd = cyc * 0.46;
  const t = frame - startAt;
  const doneAt = startAt + 5 * cyc + 6;

  let x = -140;
  let vis = 0;
  let squash = 1;
  if (t >= 0 && t < 5 * cyc) {
    // 恰五轮敲门（t<5cyc 防第六轮逼近起步），末轮弹开退场含在窗内
    vis = 1;
    const ph = t % cyc;
    if (ph < aEnd) {
      const p = ph / aEnd;
      x = -140 + (352 - -140) * p * p; // 加速逼近（352=触碰位：块右缘贴回合盒）
    } else if (ph < aEnd + 5) {
      x = 352;
      squash = 0.82; // 触壁压扁一拍
    } else {
      const rp = Math.min(1, (ph - aEnd - 5) / (cyc - aEnd - 5));
      x = 352 - rp * rp * 640; // 加速弹开退场
    }
  }
  const roundP = clamp01(t / (5 * cyc + 16)); // 回合推进，敲满五次恰走完
  const doneIn = useProgress(doneAt, DUR.f4);
  const doneFlash = useImpulse({at: doneAt, dur: DUR.f5});

  return (
    <Panel accent={theme.ok} style={{width: 740, height: 420, boxSizing: 'border-box', position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.ok, 0.045), borderRadius: 12}} />
      <div style={{position: 'relative', padding: '18px 24px 0'}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.ok}}>{'在位 · 让行 5 次'}</span>
      </div>
      {/* 时间轴泳道（clip 防退场块漏出） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 740, height: 420, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 40, top: 195, width: 660, height: 2, background: theme.panelBorder}} />
        {/* 回合盒：进行中的一轮持续填充 */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 150,
            width: 190,
            height: 64,
            borderRadius: 10,
            border: `2.5px solid ${doneIn > 0.5 ? theme.ok : theme.dim}`,
            background: theme.panel,
          }}
        >
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6}}>{'一轮进行中'}</div>
          <div style={{margin: '6px 10px 0', height: 8, borderRadius: 4, background: theme.panelBorder, opacity: 0.5}}>
            <div style={{width: `${roundP * 100}%`, height: '100%', borderRadius: 4, background: theme.ok, opacity: 0.55 + 0.45 * doneFlash}} />
          </div>
        </div>
        {/* 通知块：敲门→弹开（基线不插队） */}
        <div
          style={{
            position: 'absolute',
            left: x,
            top: 156,
            width: 118,
            height: 52,
            borderRadius: 9,
            border: `2.5px solid ${theme.dim}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: vis,
            transform: `scaleX(${squash})`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'消息'}</span>
        </div>
        {/* 让行计数点 */}
        <div style={{position: 'absolute', left: 44, top: 268, display: 'flex', gap: 10, alignItems: 'center'}}>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'让行'}</span>
          {[0, 1, 2, 3, 4].map((i) => {
            const lit = t >= i * cyc + aEnd;
            return (
              <span
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 99,
                  border: `2px solid ${lit ? theme.ok : theme.panelBorder}`,
                  background: lit ? withAlpha(theme.ok, 0.5) : 'transparent',
                }}
              />
            );
          })}
        </div>
        {/* 收束：回合完整 */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 300,
            padding: '7px 18px',
            borderRadius: 999,
            border: `2.5px solid ${theme.ok}`,
            fontFamily: theme.sans,
            fontSize: 22,
            fontWeight: 600,
            color: theme.ok,
            opacity: doneIn,
          }}
        >
          {'回合完整'}
        </div>
      </div>
    </Panel>
  );
};

/** 红侧拆掉：通知块无视忙锁强插进进行中的一轮 → 盒内两支写光标同闪 → 盖章 */
const RedLane: React.FC<{win: number}> = ({win}) => {
  const frame = useCurrentFrame();
  const startAt = 14;
  const tImpact = Math.round(win * 0.3);
  const t = frame - startAt;
  const approach = clamp01(t / tImpact);
  const inBox = t >= tImpact;
  const x = inBox ? 500 : -140 + (500 - -140) * approach * approach;

  const hit = useImpulse({at: startAt + tImpact, dur: DUR.f5});
  const twoIn = useProgress(startAt + tImpact + 16, DUR.f4);
  const stampAt = startAt + Math.round(win * 0.52);
  const stampS = useSpring('snap', {at: stampAt, dur: DUR.f5});
  const stampO = useProgress(stampAt, DUR.f3);
  const cursorA = inBox && frame % 14 < 7;
  const cursorB = inBox && frame % 14 >= 7;
  const roundP = clamp01(t / (tImpact * 0.92)); // 强插后回合卡死在半程

  return (
    <Panel accent={theme.danger} style={{width: 740, height: 420, boxSizing: 'border-box', position: 'relative', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.danger, 0.045), borderRadius: 12}} />
      <div style={{position: 'relative', padding: '18px 24px 0'}}>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.danger}}>{'拆掉 · 硬注入 0 让行'}</span>
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 740, height: 420, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 40, top: 195, width: 660, height: 2, background: theme.panelBorder}} />
        {/* 回合盒：强插后边框转红、填充卡死 */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 150,
            width: 190,
            height: 64,
            borderRadius: 10,
            border: `2.5px solid ${inBox ? theme.danger : theme.dim}`,
            background: theme.panel,
            boxShadow: inBox ? `0 0 ${18 * hit}px ${withAlpha(theme.danger, 0.55)}` : 'none',
          }}
        >
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6}}>{'一轮进行中'}</div>
          <div style={{margin: '6px 10px 0', height: 8, borderRadius: 4, background: theme.panelBorder, opacity: 0.5}}>
            <div style={{width: `${roundP * 100}%`, height: '100%', borderRadius: 4, background: inBox ? theme.danger : theme.dim}} />
          </div>
          {/* 两支写光标交替闪＝两方同写 */}
          <span style={{position: 'absolute', left: 20, bottom: 8, width: 3, height: 14, background: theme.text, opacity: cursorA ? 1 : 0.15}} />
          <span style={{position: 'absolute', left: 168, bottom: 8, width: 3, height: 14, background: theme.text, opacity: cursorB ? 1 : 0.15}} />
        </div>
        {/* 通知块：一路插进盒内（压在回合上），命中后转红 */}
        <div
          style={{
            position: 'absolute',
            left: x,
            top: 156,
            width: 118,
            height: 52,
            borderRadius: 9,
            border: `2.5px solid ${inBox ? theme.danger : theme.dim}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: t >= 0 ? 1 : 0,
            transform: `scaleX(${inBox && t < tImpact + 6 ? 0.86 : 1})`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 18, color: inBox ? theme.danger : theme.dim}}>{'消息'}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 112,
            width: 190,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 600,
            color: theme.danger,
            opacity: twoIn,
          }}
        >
          {'两方同写'}
        </div>
        {/* 盖章：单写者规矩破 */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 292,
            padding: '8px 20px',
            borderRadius: 10,
            border: `3px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.1),
            fontFamily: theme.sans,
            fontSize: 25,
            fontWeight: 700,
            color: theme.danger,
            opacity: stampO,
            transform: `rotate(-5deg) scale(${1.6 - 0.6 * stampS})`,
          }}
        >
          {'单写者规矩破'}
        </div>
      </div>
    </Panel>
  );
};

const DialogueTimeline: React.FC<{win: number}> = ({win}) => {
  const inL = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 60});
  const inR = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 60});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 170, top: 236, ...inL}}>
        <GreenLane win={win} />
      </div>
      <div style={{position: 'absolute', left: 1010, top: 236, ...inR}}>
        <RedLane win={win} />
      </div>
    </AbsoluteFill>
  );
};

// ── 5-G 左下「翻车小票」：120s 剪断 → Error 行 → 200 字二次特写 → 盖章 ────

/** 剪刀件（deny 红）：落下＋剪切旋转一拍 */
const ScissorsGlyph: React.FC<{at: number}> = ({at}) => {
  const on = useProgress(at, DUR.f3);
  const snip = useImpulse({at, dur: DUR.f4});
  return (
    <svg width={26} height={26} viewBox="0 0 26 26" style={{opacity: on, transform: `rotate(${-24 + snip * 26}deg)`}}>
      <circle cx={6} cy={20} r={3.4} fill="none" stroke={theme.danger} strokeWidth={2} />
      <circle cx={6} cy={6} r={3.4} fill="none" stroke={theme.danger} strokeWidth={2} />
      <line x1={9} y1={8.4} x2={23} y2={22} stroke={theme.danger} strokeWidth={2.4} strokeLinecap="round" />
      <line x1={9} y1={17.6} x2={23} y2={4} stroke={theme.danger} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
};

const TRACK_W = 212;

const ReceiptFail: React.FC<{
  at22: number;
  d22: number;
  at23: number;
  at24: number;
  d24: number;
  at25: number;
  d25: number;
}> = ({at22, d22, at23, at24, d24, at25, d25}) => {
  const enter = useEnter('slideL', {at: 4, dur: DUR.f5, dist: 40});
  // ① 安装条：向 10 分钟端生长，到 120s 档（20%）被剪断，余段（虚线）从未发生
  const cutA = at22 + Math.round(d22 * 0.62);
  const growA = useProgress(at22 + 4, Math.round(d22 * 0.42));
  const snipA = useImpulse({at: cutA, dur: DUR.f4});
  const fallA = useProgress(cutA, DUR.f5, 'accelerate');
  // 通知带回的超时错误行（mono 打印）
  const errIn = useProgress(at23, DUR.f3);
  const err = useReveal('Error: Timeout (120s)', {at: at23 + 6, cps: 15});
  // ② 摘要条：铺满长日志后在 200 字档二次剪断（句内推近＝特写）
  const cutC = at24 + Math.round(d24 * 0.55);
  const fillC = useProgress(at24 + 4, Math.round(d24 * 0.38));
  const snipC = useImpulse({at: cutC, dur: DUR.f4});
  const fallC = useProgress(cutC, DUR.f5, 'accelerate');
  const zoomIn = useProgress(at24, DUR.f4);
  const zoomOut = useProgress(at25, DUR.f4);
  // 收句盖章
  const stampAt = at25 + Math.round(d25 * 0.35);
  const stampS = useSpring('snap', {at: stampAt, dur: DUR.f5});
  const stampO = useProgress(stampAt, DUR.f3);

  return (
    <div style={{position: 'absolute', left: 24, top: 508, ...enter}}>
      <div style={{transform: `scale(${1 + 0.055 * zoomIn * (1 - zoomOut)})`, transformOrigin: '0% 85%'}}>
        <Panel style={{width: 276, boxSizing: 'border-box', padding: '14px 18px 16px', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>{'两处翻车'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'教学版'}</span>
          </div>

          {/* ① 安装条：120s 处剪断 */}
          <div style={{marginTop: 12}}>
            <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'① 装框架 · 10 分钟'}</div>
            <div style={{position: 'relative', width: TRACK_W, height: 12, marginTop: 7}}>
              <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 12, borderRadius: 6, background: theme.panel, border: `2px solid ${theme.panelBorder}`}} />
              <div style={{position: 'absolute', left: 0, top: 0, height: 12, borderRadius: 6, width: growA * 0.2 * TRACK_W, background: theme.dim, opacity: 0.85}} />
              <div
                style={{
                  position: 'absolute',
                  left: `calc(20% + 2px)`,
                  right: 0,
                  top: 0,
                  height: 12,
                  borderRadius: 6,
                  border: `2px dashed ${theme.panelBorder}`,
                  opacity: 0.55,
                }}
              />
              <div style={{position: 'absolute', left: '20%', top: -3, width: 2.5, height: 18, background: theme.danger}} />
              {/* 被剪下的生长尖：坠落淡出 */}
              <div
                style={{
                  position: 'absolute',
                  left: 0.2 * TRACK_W - 13,
                  top: 0,
                  width: 13,
                  height: 12,
                  borderRadius: 4,
                  background: theme.dim,
                  opacity: (1 - fallA) * clamp01(growA),
                  transform: `translateY(${fallA * fallA * 30}px) rotate(${fallA * 28}deg)`,
                }}
              />
              <span style={{position: 'absolute', left: 0.2 * TRACK_W + 6, top: 15, fontFamily: theme.mono, fontSize: 14, color: theme.danger}}>{'120s'}</span>
              <span style={{position: 'absolute', right: 0, top: 15, fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'10min'}</span>
              <div style={{position: 'absolute', left: 0.2 * TRACK_W - 34, top: -22}}>
                <ScissorsGlyph at={cutA} />
              </div>
              <div style={{position: 'absolute', left: '20%', top: -6, width: 2.5, height: 24, background: theme.danger, opacity: snipA}} />
            </div>
          </div>

          {/* 通知带回的错误行 */}
          <div style={{marginTop: 20, fontFamily: theme.mono, fontSize: 20, color: theme.danger, opacity: errIn, minHeight: 26}}>{err}</div>

          {/* ② 摘要条：200 字档二次剪断 */}
          <div style={{marginTop: 14}}>
            <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'② 摘要 · 200 字'}</div>
            <div style={{position: 'relative', width: TRACK_W, height: 12, marginTop: 7}}>
              <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 12, borderRadius: 6, background: theme.panel, border: `2px solid ${theme.panelBorder}`}} />
              <div style={{position: 'absolute', left: 0, top: 0, height: 12, borderRadius: 6, width: fillC * 0.45 * TRACK_W, background: theme.dim, opacity: 0.7}} />
              <div
                style={{
                  position: 'absolute',
                  left: '45%',
                  right: 0,
                  top: 0,
                  height: 12,
                  borderRadius: 6,
                  background: theme.dim,
                  opacity: (1 - fallC * 0.9) * fillC,
                  transform: `translateY(${fallC * fallC * 26}px)`,
                }}
              />
              <div style={{position: 'absolute', left: '45%', top: -3, width: 2.5, height: 18, background: theme.danger}} />
              <span style={{position: 'absolute', left: 'calc(45% + 6px)', top: 15, fontFamily: theme.mono, fontSize: 14, color: theme.danger}}>{'200字'}</span>
              <span style={{position: 'absolute', right: 0, top: 15, fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'长日志'}</span>
              <div style={{position: 'absolute', left: 0.45 * TRACK_W - 34, top: -22}}>
                <ScissorsGlyph at={cutC} />
              </div>
              <div style={{position: 'absolute', left: '45%', top: -6, width: 2.5, height: 24, background: theme.danger, opacity: snipC}} />
            </div>
          </div>

          {/* 收句盖章（p5-25「没解决自己的例子」） */}
          <div
            style={{
              position: 'absolute',
              right: 10,
              bottom: 8,
              padding: '5px 12px',
              borderRadius: 8,
              border: `3px solid ${theme.danger}`,
              background: withAlpha(theme.danger, 0.08),
              fontFamily: theme.sans,
              fontSize: 20,
              fontWeight: 700,
              color: theme.danger,
              opacity: stampO,
              transform: `rotate(-7deg) scale(${1.55 - 0.55 * stampS})`,
              whiteSpace: 'nowrap',
            }}
          >
            {'没解决自己的例子'}
          </div>
          <div style={{height: 30}} />
        </Panel>
      </div>
    </div>
  );
};

// ── p5-26 窗外收句：两边摆上桌（一半印证 / 一半翻案，P6 对账桌预告） ──────

const HandoffChip: React.FC<{color: string; text: string; side: 'L' | 'R'}> = ({color, text, side}) => {
  const enter = useEnter(side === 'L' ? 'slideL' : 'slideR', {at: 14, dur: DUR.f5, dist: 140});
  const pos = side === 'L' ? {left: 680} : {left: 1080};
  return (
    <div style={{position: 'absolute', top: 448, ...pos, ...enter}}>
      <Panel accent={color} style={{padding: '10px 26px'}}>
        <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color}}>{text}</span>
      </Panel>
    </div>
  );
};

const Handoff: React.FC = () => {
  const grow = useProgress(6, DUR.f5, 'decelerate');
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 580,
          top: 506,
          width: 760,
          height: 3,
          background: theme.panelBorder,
          transform: `scaleX(${grow})`,
        }}
      />
      <HandoffChip color={theme.ok} text="一半印证" side="L" />
      <HandoffChip color={theme.danger} text="一半翻案" side="R" />
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5AblationLab: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（句起始帧，幕内相对）；dur() = 单句取长（cue 扩窗用求和形态）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-08');
  const bC = w('p5-09', 'p5-10');
  const bD = w('p5-11', 'p5-13');
  const bE = w('p5-14', 'p5-16');
  const bF = w('p5-17', 'p5-20');
  const bG = w('p5-21', 'p5-26');
  // 仪器层跨 5-A..5-F 单实例常驻（horizon P5 同款：跨镜 HUD 提出镜外，防切镜重闪）
  const bLab = w('p5-02', 'p5-20');

  return (
    <AbsoluteFill>
      <SceneTag chapter="P5" tagline="拆机实验室" accent={theme.mech} />

      <Sequence {...bLab} name="5-AF 实验台仪器层">
        <LabInstruments
          enterAt={at('p5-02') - bLab.from}
          lightUpAt={at('p5-04') - bLab.from}
          legendAt={at('p5-04') - bLab.from + 4}
          pulls={[at('p5-05'), at('p5-09'), at('p5-11'), at('p5-14'), at('p5-17')].map((f) => f - bLab.from)}
          flashAt={at('p5-20') - bLab.from + 6}
          span={bLab.durationInFrames}
        />
      </Sequence>

      <Sequence {...bA} name="5-A 实验台开台">
        {/* 本幕首 cue；上一 cue 在 P4 镜内（跨幕隔 SceneFade）⇒ 默认 lead */}
        <ArchifyRecap
          slug="ablation-panel"
          caption="拆机面板"
          cues={[{chapterId: 'bench-open', at: at('p5-01') - bA.from, durationInFrames: dur('p5-01') + dur('p5-02') + dur('p5-03') + dur('p5-04')}]}
        />
        <Footnote delay={at('p5-03') - bA.from}>{'e1–e5 · 一次只拆一个'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="5-B 开关一·兜错">
        {/* kill-thread 与 5-A bench-open 同 slug 跨镜背靠背（p5-04 末→p5-05 首紧邻）⇒ lead={false} */}
        <ArchifyRecap
          slug="ablation-panel"
          caption="拆机面板"
          lead={false}
          cues={[{chapterId: 'kill-thread', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05') + dur('p5-06') + dur('p5-07') + dur('p5-08')}]}
        />
        <VerdictCard
          enterAt={at('p5-06') - bB.from}
          tag="e1 · 兜错"
          term="触发"
          from={2}
          to={0}
          unit="次"
          jumpAt={at('p5-07') - bB.from + Math.round(dur('p5-07') * 0.55)}
          sub="流水线死 · 整面钟停"
          glyph={<CrackClock at={at('p5-08') - bB.from + Math.round(dur('p5-08') * 0.5)} />}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 开关二·记号">
        {/* date-slip 同 slug 跨镜背靠背（p5-08→p5-09）⇒ lead={false} */}
        <ArchifyRecap
          slug="ablation-panel"
          caption="拆机面板"
          lead={false}
          cues={[{chapterId: 'date-slip', at: at('p5-09') - bC.from, durationInFrames: dur('p5-09') + dur('p5-10')}]}
        />
        <VerdictCard
          enterAt={at('p5-09') - bC.from + Math.round(dur('p5-09') * 0.45)}
          tag="e2 · 记号"
          term="次日触发"
          from={1}
          to={0}
          unit="次"
          jumpAt={at('p5-10') - bC.from + Math.round(dur('p5-10') * 0.45)}
          sub="只记时分 · 九点哑火"
          glyph={<FlipCalendar at={at('p5-10') - bC.from + Math.round(dur('p5-10') * 0.28)} />}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 开关三·或门">
        {/* silent-miss 同 slug 跨镜背靠背（p5-10→p5-11）⇒ lead={false} */}
        <ArchifyRecap
          slug="ablation-panel"
          caption="拆机面板"
          lead={false}
          cues={[{chapterId: 'silent-miss', at: at('p5-11') - bD.from, durationInFrames: dur('p5-11') + dur('p5-12') + dur('p5-13')}]}
        />
        <VerdictCard
          enterAt={at('p5-11') - bD.from + Math.round(dur('p5-11') * 0.5)}
          tag="e3 · 或门"
          term="周一照常"
          textFrom="真"
          textTo="假"
          jumpAt={at('p5-12') - bD.from + Math.round(dur('p5-12') * 0.5)}
          sub="静默 · 零响"
          glyph={<OrToAnd at={at('p5-11') - bD.from + Math.round(dur('p5-11') * 0.62)} />}
        />
      </Sequence>

      <Sequence {...bE} name="5-E 开关四·忙锁">
        {/* 与 5-D 背靠背（p5-13 末=p5-14 始，跨 slug 换图同判例）→ lead={false}；
            cue 窗止于 p5-15 末 */}
        <ArchifyRecap
          slug="knock-walk-away"
          caption="敲门走开"
          lead={false}
          cues={[{chapterId: 'door-busy', at: at('p5-14') - bE.from, durationInFrames: dur('p5-14') + dur('p5-15')}]}
        />
        {/* p5-15 读数卡（窗内句）；p5-16 窗外句由全屏装置接手（v4 三分法窗外句窗档） */}
        <Sequence from={at('p5-15') - bE.from} durationInFrames={dur('p5-15')} name="5-E 让行读数">
          <VerdictCard
            enterAt={4}
            tag="e4 · 忙锁"
            term="让行"
            from={5}
            to={0}
            unit="次"
            jumpAt={Math.round(dur('p5-15') * 0.5)}
            sub="硬注入 · 零让行"
            glyph={<KnockDots at={6} zeroAt={Math.round(dur('p5-15') * 0.5)} />}
          />
        </Sequence>
        <Sequence from={at('p5-16') - bE.from} durationInFrames={dur('p5-16')} name="5-E 单写者规矩破">
          <DialogueTimeline win={dur('p5-16')} />
        </Sequence>
      </Sequence>

      <Sequence {...bF} name="5-F 开关五·兜底">
        {/* burn-wait 与 5-D silent-miss 同 slug，但中间隔 5-E 换图镜（p5-14..16 空窗）
            ⇒ 非紧邻同图，恢复入场（默认 lead） */}
        <ArchifyRecap
          slug="ablation-panel"
          caption="拆机面板"
          cues={[{chapterId: 'burn-wait', at: at('p5-17') - bF.from, durationInFrames: dur('p5-17') + dur('p5-18') + dur('p5-19') + dur('p5-20')}]}
        />
        <VerdictCard
          enterAt={at('p5-17') - bF.from + Math.round(dur('p5-17') * 0.5)}
          tag="e5 · 兜底"
          term="阻塞"
          from={0}
          to={600}
          unit="秒"
          jumpAt={at('p5-19') - bF.from + Math.round(dur('p5-19') * 0.45)}
          jumpFrames={36}
          sub="白等十分钟 · 计费照跑"
          extra={<BurnBar at={at('p5-19') - bF.from + Math.round(dur('p5-19') * 0.45)} frames={36} />}
          top={624}
        />
      </Sequence>

      <Sequence {...bG} name="5-G 两处翻车">
        {/* timeout-crash 与 5-F burn-wait 同 slug 跨镜背靠背（p5-20 末→p5-21 首紧邻）
            ⇒ lead={false}；cue 窗止于 p5-25 末，p5-26 留给收句 */}
        <ArchifyRecap
          slug="ablation-panel"
          caption="拆机面板"
          lead={false}
          cues={[{chapterId: 'timeout-crash', at: at('p5-21') - bG.from, durationInFrames: dur('p5-21') + dur('p5-22') + dur('p5-23') + dur('p5-24') + dur('p5-25')}]}
        />
        <ReceiptFail
          at22={at('p5-22') - bG.from}
          d22={dur('p5-22')}
          at23={at('p5-23') - bG.from}
          at24={at('p5-24') - bG.from}
          d24={dur('p5-24')}
          at25={at('p5-25') - bG.from}
          d25={dur('p5-25')}
        />
        <Sequence from={at('p5-26') - bG.from} durationInFrames={dur('p5-26')} name="5-G 收句·两边摆上桌">
          <Handoff />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5AblationLab;
