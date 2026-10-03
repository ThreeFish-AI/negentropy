/** P0 重发的账单（p0-01..13，3 镜 · scratchpad-anatomy 4 cue）——分镜 0-A…0-C。
 *
 *  ★ 系列开场换轴：本集不用 HarnessStack 落板、不挂 HarnessBadge 常驻条——
 *    全貌坐标装置（MapAnchor）在 0-C 首亮全图替代（五层栈只在 P6 收尾，
 *    常驻条由坐标 Chip 在后续各幕替位）。
 *  ★ cue 锚句（一章锚一句、全片唯一）：fixed-prefix@p0-01 · pair-interlock@p0-02 ·
 *    full-resend@p0-04 · heavy-results@p0-06。0-B 与 0-A 同图但 p0-05 装置窗隔断 →
 *    空窗后重现，lead 默认入场（契约=帧相邻才 false）。
 *  ★ fit 显式两处按 views focus 数 × dwell（多拍 1.1s、≤2 拍 1.6s）估算；B 档
 *    句隙 0.68 口径下复核（2026-10-03）：fixed-prefix 窗 3.39s（2.71+0.68）、
 *    storySec 3.25 → rate 0.96 自动档会选 stretch，显式 hold 压住（行为=末帧
 *    定格，无害）；full-resend 窗 4.14s（3.46+0.68）→ trim 仍成立。
 *    录制重派生 archify.manifest 后须对 storySec 复核这两处（ArchifyRecap 头注纪律）。
 *  ★ 图镜空窗句由窗外回落装置持有（嵌套句窗头 −DUR.f3：装置先渲染、ArchifyRecap
 *    压顶，画框入场期自其下淡入——4-D②「画框直接遮盖」的平滑化，不引 ArchifyYield；
 *    0-B 相邻装置接缝互不覆盖，尾部一律不延 +DUR.f3，防尾帧裸露硬切）：
 *    p0-03 纸在模型之外 / p0-05 写满拒收 / p0-07 千行文件≈几轮 / p0-08 token 卡 /
 *    p0-09 头号大户三巨块。
 *  ★ 0-C：MapAnchor 首亮全图（active='scratchpad'）+ 双问字卡两联（mech 点睛、
 *    第二问 @impulse）+ 草稿纸母题小样右下驻场 + p0-13 两问→两机制预告虚线。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {MapAnchor} from '../components/map-anchor';
import {
  DUR,
  useBreathe,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useShake,
  useSpring,
  useStagger,
} from '../motion';

/** 「永不触发」帧哨兵：未启用的一次性 impulse 在窗口内恒为 0（帧驱动确定性不变） */
const NEVER = 1 << 28;

// ── 1-A 空窗回落：纸在模型之外（p0-03） ─────────────────────────────────

/** 草稿纸（左·灰白系）与模型（右·core 恒定）之间只隔一只 dashed 空槽——
 *  「这张纸不在模型肚子里」的空间读法：模型内部只有装不进去的空位 */
const PaperAside: React.FC = () => {
  const sheet = useEnter('rise', {at: 0, dur: DUR.f5, dist: 26});
  const node = useEnter('fade', {at: 10, dur: DUR.f5});
  const slot = useBreathe({period: 110, amp: 0.22, base: 0.5});
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g style={{opacity: sheet.opacity, transform: sheet.transform}}>
          <rect x={560} y={350} width={320} height={350} rx={8} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2.5} />
          {/* 开头固定的指令条 */}
          <rect x={588} y={380} width={264} height={22} rx={3} fill={theme.dim} opacity={0.5} />
          {[210, 158, 210, 158, 210].map((wd, i) => (
            <rect key={i} x={588} y={428 + i * 46} width={wd} height={14} rx={3} fill={theme.text} opacity={0.25} />
          ))}
          <text x={720} y={738} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
            {'草稿纸'}
          </text>
        </g>
        <g style={{opacity: node.opacity}}>
          <rect x={1140} y={400} width={340} height={300} rx={20} fill={theme.bg} stroke={theme.core} strokeWidth={2.5} />
          {/* 模型内部：装不下纸的空槽（呼吸吸引视线——纸每次都得重新递进来） */}
          <rect x={1210} y={468} width={200} height={164} rx={8} fill="none" stroke={theme.dim} strokeWidth={2} strokeDasharray="9 9" opacity={slot} />
          <text x={1310} y={738} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.core}>
            {'模型'}
          </text>
        </g>
      </svg>
      <Footnote delay={2}>{'messages'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-A 空窗回落：写满拒收（p0-05） ─────────────────────────────────────

/** 纸面写满（指令条+人话条+两块巨型结果块顶到纸边）→ 拒收红章盖下 */
const STAMP_ROWS: {w: string; h: number; kind: 'cmd' | 'talk' | 'big'}[] = [
  {w: '100%', h: 26, kind: 'cmd'},
  {w: '58%', h: 20, kind: 'talk'},
  {w: '44%', h: 20, kind: 'talk'},
  {w: '92%', h: 148, kind: 'big'},
  {w: '52%', h: 20, kind: 'talk'},
  {w: '38%', h: 20, kind: 'talk'},
  {w: '92%', h: 184, kind: 'big'},
  {w: '60%', h: 20, kind: 'talk'},
];

const stampRowStyle = (k: 'cmd' | 'talk' | 'big'): React.CSSProperties =>
  k === 'cmd'
    ? {border: `1.5px solid ${theme.dim}`, opacity: 0.55}
    : k === 'talk'
      ? {background: theme.text, opacity: 0.22}
      : {background: theme.dim, border: `1.5px solid ${theme.panelBorder}`, opacity: 0.3};

const RejectStamp: React.FC<{span: number}> = ({span}) => {
  const fill = useStagger(STAMP_ROWS.length, {at: 2, stride: 9, dur: DUR.f4});
  const atStamp = Math.round(span * 0.46);
  const stampIn = useProgress(atStamp - 3, 4);
  const slam = useSpring('snap', {at: atStamp, dur: DUR.f5});
  const shakeX = useShake({at: atStamp + 8, decay: true, dur: DUR.f5, amp: 5, freq: 1.4});
  const flash = useImpulse({at: atStamp + 4, dur: 16});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 760, top: 250, width: 400}}>
        <Panel style={{height: 560, padding: 20, boxShadow: `0 0 ${36 * flash}px ${theme.danger}`}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {STAMP_ROWS.map((r, i) => (
              <div key={i} style={{width: r.w, height: r.h * fill[i], borderRadius: 4, ...stampRowStyle(r.kind)}} />
            ))}
          </div>
        </Panel>
        {/* 拒收红章：先见形（快淡入）再拍落（snap 弹簧）＋落章余抖（错误语义） */}
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 195,
            width: 380,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 1,
            color: theme.danger,
            border: `5px solid ${theme.danger}`,
            borderRadius: 12,
            padding: '12px 10px',
            background: theme.bg,
            opacity: stampIn,
            transform: `translateX(${shakeX}px) rotate(-8deg) scale(${1.7 - 0.7 * slam})`,
          }}
        >
          {'prompt_too_long'}
        </div>
      </div>
      <Footnote delay={2}>{'prompt_too_long'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 空窗回落：千行文件 ≈ 几轮对话（p0-07） ──────────────────────────

const FILE_LINES = 12;

/** 一个上千行文件块（行线逐条落）顶得上好几轮对话（小药丸对置）——体量对读 */
const FileEquation: React.FC = () => {
  const block = useEnter('rise', {at: 0, dur: DUR.f5, dist: 30});
  const lines = useStagger(FILE_LINES, {at: 4, stride: 5, dur: DUR.f3});
  const pills = useStagger(4, {at: 10, stride: 9, dur: DUR.f4});
  const eq = useEnter('pop', {at: 26, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 600, top: 300, opacity: block.opacity, transform: block.transform}}>
        <div style={{width: 340, height: 470, borderRadius: 10, border: `2px solid ${theme.panelBorder}`, background: theme.panel, padding: 18}}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'千行文件 · 1000+ 行'}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 22, marginTop: 18}}>
            {Array.from({length: FILE_LINES}, (_, i) => (
              <div key={i} style={{height: 4, width: i % 2 === 0 ? '100%' : '72%', background: theme.text, opacity: 0.22 * lines[i]}} />
            ))}
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 950, top: 452, width: 200, textAlign: 'center', opacity: eq.opacity, transform: eq.transform}}>
        <div style={{fontFamily: theme.serif, fontSize: 92, fontWeight: 700, color: theme.text, lineHeight: 1}}>{'≈'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 10}}>{'顶得上'}</div>
      </div>
      <div style={{position: 'absolute', left: 1170, top: 330}}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 310,
              height: 54,
              borderRadius: 999,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
              marginLeft: i % 2 === 0 ? 0 : 44,
              marginBottom: 28,
              opacity: pills[i],
            }}
          />
        ))}
        <div style={{width: 354, textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'几轮对话'}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 空窗回落：计费单位 token（p0-08） ───────────────────────────────

/** accent 金=计费轴：token≈字数 只是教学近似，与真实计费不是一回事 */
const TokenCard: React.FC<{span: number}> = ({span}) => {
  const enter = useEnter('rise', {at: 2, dur: DUR.f6, dist: 30});
  const pulse = useImpulse({at: Math.round(span * 0.42), dur: DUR.f6});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 660, top: 380, opacity: enter.opacity, transform: enter.transform}}>
        <Panel accent={theme.accent} style={{width: 600, padding: '36px 44px', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 20}}>
            <span style={{fontFamily: theme.mono, fontSize: 60, fontWeight: 700, color: theme.text}}>{'token'}</span>
            <span style={{fontFamily: theme.serif, fontSize: 38, color: theme.dim, textShadow: `0 0 ${26 * pulse}px ${theme.accent}`}}>{'≈ 字数'}</span>
          </div>
          <div style={{height: 1, background: theme.panelBorder, marginTop: 22}} />
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 18}}>{'教学近似 · 非真实计费'}</div>
          <div
            style={{
              position: 'absolute',
              top: -16,
              left: 44,
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.accent,
              border: `1.5px solid ${theme.accent}`,
              borderRadius: 999,
              padding: '4px 14px',
              background: theme.panel,
            }}
          >
            {'计费单位'}
          </div>
        </Panel>
      </div>
      <Footnote delay={2}>{'token ≈ chars'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 空窗回落：头号大户三巨块（p0-09） ───────────────────────────────

const TRIO: {label: string; h: number; left: number}[] = [
  {label: '读文件', h: 430, left: 470},
  {label: '测试日志', h: 330, left: 810},
  {label: '多文件搜索', h: 265, left: 1150},
];

/** 工具结果三巨块（读文件/测试日志/多文件搜索）+ 金章「纸面头号大户」 */
const TopHolder: React.FC<{span: number}> = ({span}) => {
  const blocks = useStagger(TRIO.length, {at: 2, stride: 14, dur: DUR.f4});
  const atBadge = Math.round(span * 0.34);
  const badgeIn = useProgress(atBadge, DUR.f3);
  const badge = useSpring('snap', {at: atBadge, dur: DUR.f5});
  const glow = useBreathe({period: 130, amp: 0.4, base: 0.6});
  return (
    <AbsoluteFill>
      {TRIO.map((b, i) => {
        const p = blocks[i];
        const lines = Math.floor((b.h - 78) / 26);
        return (
          <div key={b.label} style={{position: 'absolute', left: b.left, top: 812 - b.h, opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
            <div style={{width: 300, height: b.h, borderRadius: 10, border: `2px solid ${theme.panelBorder}`, background: theme.panel, padding: 16}}>
              <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{b.label}</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 22, marginTop: 16}}>
                {Array.from({length: lines}, (_, j) => (
                  <div key={j} style={{height: 4, width: j % 2 === 0 ? '100%' : '68%', background: theme.text, opacity: 0.16}} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {/* 金章：accent=账单/占用金（「头号大户」是纸面经济账，非危险语义） */}
      <div style={{position: 'absolute', left: 860, top: 316, opacity: badgeIn, transform: `scale(${0.7 + 0.3 * badge})`}}>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.accent,
            border: `2.5px solid ${theme.accent}`,
            borderRadius: 999,
            padding: '10px 28px',
            background: theme.panel,
            boxShadow: `0 0 ${10 + 26 * glow}px ${theme.accent}`,
          }}
        >
          {'纸面头号大户'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 0-C 双问字卡 + 坐标首亮 + 草稿纸母题小样 ────────────────────────────

/** 双问字卡：问句主体 serif + mech 苔绿点睛短语；glowAt 给一次 impulse 辉光（第二问） */
const QuestionCard: React.FC<{
  index: string;
  lead: string;
  hot: string;
  tail: string;
  at: number;
  glowAt?: number;
  left: number;
}> = ({index, lead, hot, tail, at, glowAt, left}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 30});
  const glow = useImpulse({at: glowAt ?? NEVER, dur: DUR.f6});
  return (
    <div style={{position: 'absolute', left, top: 540, opacity: e.opacity, transform: e.transform}}>
      <Panel style={{width: 560, padding: '24px 34px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 3}}>{index}</div>
        <div style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.text, marginTop: 14, lineHeight: 1.35}}>
          {lead}
          <span style={{color: theme.mech, textShadow: `0 0 ${28 * glow}px ${theme.mech}`}}>{hot}</span>
          {tail}
        </div>
      </Panel>
    </div>
  );
};

/** 草稿纸母题小样：右下驻场，纸张+行线几何（灰白系）；行线逐条落=「新的一张」 */
const ScratchSample: React.FC<{at: number; stride: number}> = ({at, stride}) => {
  const enter = useEnter('pop', {at, dur: DUR.f5});
  const lines = useStagger(7, {at: at + 8, stride, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 1560, top: 682, width: 280, opacity: enter.opacity, transform: enter.transform}}>
      <svg width={280} height={210}>
        <rect x={8} y={8} width={252} height={186} rx={6} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
        {/* 装订边距线 */}
        <line x1={36} y1={10} x2={36} y2={192} stroke={theme.panelBorder} strokeWidth={2} />
        {Array.from({length: 7}, (_, i) => (
          <line
            key={i}
            x1={50}
            y1={36 + i * 22}
            x2={50 + 178 * (i % 3 === 2 ? 0.62 : 1)}
            y2={36 + i * 22}
            stroke={theme.dim}
            strokeWidth={2}
            opacity={0.75 * lines[i]}
          />
        ))}
      </svg>
      <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 6}}>{'scratchpad'}</div>
    </div>
  );
};

/** 0-C 主舞台：MapAnchor 全图首亮（M-001 恒定锚）压底，双问卡与母题小样浮上；
 *  p0-13 两问各引一条虚线指向其机制层（问一→草稿纸层 text 白点、问二→卡片册层 mech 点） */
const OneCTwoQuestions: React.FC<{
  atQ1: number;
  atQ2: number;
  glowQ2: number;
  atMotif: number;
  motifStride: number;
  atLinks: number;
}> = ({atQ1, atQ2, glowQ2, atMotif, motifStride, atLinks}) => {
  const linkA = useDraw(atLinks, DUR.f5);
  const linkB = useDraw(atLinks + 7, DUR.f5);
  const dotA = useProgress(atLinks + DUR.f5, DUR.f3);
  const dotB = useProgress(atLinks + 7 + DUR.f5, DUR.f3);
  return (
    <AbsoluteFill>
      <MapAnchor active="scratchpad" />
      <QuestionCard index="问一" lead="凭什么" hot="跑一整天不崩" tail="？" at={atQ1} left={380} />
      <QuestionCard index="问二" lead="凭什么" hot="第二天还记得你" tail="？" at={atQ2} glowAt={glowQ2} left={980} />
      <ScratchSample at={atMotif} stride={motifStride} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M680 538 C655 480, 570 445, 478 398" fill="none" stroke={theme.dim} strokeWidth={3} opacity={0.85} {...linkA} />
        <path d="M1240 538 C1220 480, 1052 448, 948 398" fill="none" stroke={theme.dim} strokeWidth={3} opacity={0.85} {...linkB} />
        <circle cx={470} cy={392} r={6} fill={theme.text} opacity={0.9 * dotA} />
        <circle cx={940} cy={392} r={6} fill={theme.mech} opacity={0.9 * dotB} />
      </svg>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0Scratchpad: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-09');
  const bC = w('p0-10', 'p0-13');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 草稿纸解剖">
        <SceneTag chapter="Scratchpad" tagline="重发的账单" accent={theme.mech} />
        {/* 空窗回落（窗外句窗 ±f3：句前 -f3 藏在画框下淡入、句后 +f3 被下一画框/装置压住） */}
        <Sequence from={at('p0-03') - bA.from - DUR.f3} durationInFrames={dur('p0-03') + DUR.f3 * 2} name="0-A 纸在模型之外回落">
          <PaperAside />
        </Sequence>
        <Sequence from={at('p0-05') - bA.from - DUR.f3} durationInFrames={dur('p0-05') + DUR.f3 * 2} name="0-A 写满拒收回落">
          <RejectStamp span={dur('p0-05')} />
        </Sequence>
        {/* 全片首图：首章默认入场；p0-03 空窗后 full-resend 重现恢复入场（实例内自动） */}
        <ArchifyRecap
          slug="scratchpad-anatomy"
          caption="草稿纸解剖"
          cues={[
            {chapterId: 'fixed-prefix', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01'), fit: 'hold'},
            {chapterId: 'pair-interlock', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},
            {chapterId: 'full-resend', at: at('p0-04') - bA.from, durationInFrames: dur('p0-04'), fit: 'trim'},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="0-B 大头与拒收">
        {/* 0-B 相邻回落装置 footprint 互不覆盖：尾部不延 +DUR.f3（仅首窗保留头 −f3
            先于画框渲染），否则前装置尾帧裸露后整块硬切消失。 */}
        <Sequence from={at('p0-07') - bB.from - DUR.f3} durationInFrames={dur('p0-07') + DUR.f3} name="0-B 千行文件回落">
          <FileEquation />
        </Sequence>
        <Sequence from={at('p0-08') - bB.from} durationInFrames={dur('p0-08')} name="0-B 计费单位回落">
          <TokenCard span={dur('p0-08')} />
        </Sequence>
        <Sequence from={at('p0-09') - bB.from} durationInFrames={dur('p0-09')} name="0-B 头号大户回落">
          <TopHolder span={dur('p0-09')} />
        </Sequence>
        {/* 前镜虽同为 scratchpad-anatomy 实例，但 p0-05 装置窗隔断＝空窗后重现 →
            lead 默认入场（帧相邻才 false，契约见 ArchifyClip）。heavy-results 3 拍
            vs 3.5s 窗 rate≈0.93 → 自动 stretch */}
        <ArchifyRecap
          slug="scratchpad-anatomy"
          caption="草稿纸解剖"
          cues={[
            {chapterId: 'heavy-results', at: at('p0-06') - bB.from, durationInFrames: dur('p0-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 双问字卡">
        <OneCTwoQuestions
          atQ1={at('p0-10') + Math.round(dur('p0-10') * 0.58) - bC.from}
          atQ2={at('p0-11') + Math.round(dur('p0-11') * 0.3) - bC.from}
          glowQ2={at('p0-11') + Math.round(dur('p0-11') * 0.72) - bC.from}
          atMotif={at('p0-12') - bC.from}
          motifStride={34}
          atLinks={at('p0-13') - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0Scratchpad;
