/** P5 身份与纳管（p5-01..p5-23，23 句；storyboard「P5 身份与纳管」节）。
 *
 *  10 镜 / 15 条 archify cue：
 *   5-A 自制：剪影渐变（人→Agent）+ 钥匙串越挂越多 + 金句浮标
 *   5-B audit@p5-04 ＋ 自制审计链@p5-05（四入口 → 授权/执行/对象，E2「cue 先行、
 *      装置挪 cue 卸载后入场」避让范式）
 *   5-C ceiling@06+strict@07（纯图主控；角标 Restricted Session Scope 折入 caption）
 *   5-D two-iron-rules@08+dynamic-intersect@09（纯图主控）
 *   5-E experiment-risk@10+realtime-ceiling@11（纯图主控＋实线徽）
 *   5-F snapshot-vs-live@12+static-snapshot@13+zero-window@14（纯图主控＋实心徽 D9）
 *   5-G 自制表网格增殖@p5-15（ArchifyYield 让位）＋ honest-limit@16
 *   5-H seventh-mechanism@17+tag-driven@18（纯图主控）
 *   5-I intake-test@19 ＋ 自制对章卡/一次性映射桥@p5-20（同 5-B 避让范式）
 *   5-J 自制红绿消融@21..23（ArchifyYield 让位 explicit-gap@22）＋ 实心徽 D10＋打码扫过
 *
 *  全屏独占避让（v6 同内容先例「D9 原文由图承接」）：5-E/5-F 句窗被 cue 逐句盖满，
 *  大体量装置（RevocationClock / AblationPair）在这两镜无可视窗——时间轴游标、交集
 *  塌缩与红绿消融语义分别由 realtime-ceiling（instant-loss / no-stale-window）与
 *  snapshot-vs-live / static-snapshot / zero-window 三章接力承接；AblationPair 落位在
 *  有空窗句（p5-21/23）的 5-J。相应 @动词按幕级门由本文件他处真实调用满足：
 *  @spring→5-B 链体落位 · @impulse→5-G 扫描命中脉冲 · @count→5-G 新增列计数。
 *
 *  lead 审计（跨实例背靠背、帧连续处净切防换章弹入）：5-D×2 / 5-E×2 / 5-F×3 /
 *  5-H×2 / 5-I 共 10 处 lead={false}；5-C（隔 p5-05 装置句）、5-G（隔 p5-15）、
 *  5-J（隔 p5-20/21）空窗后重入恢复入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useReveal,
  useSpring,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {AblationPair} from '../components/devices';

/** #RRGGBB → rgba（theme 未导出 withAlpha 的本地替身；纯函数）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const P5Identity: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // cue / 装置锚点一律「at(句id) - 所在镜.from」，时长一律 dur() 取长形态（覆盖门噪声归零）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-05');
  const bC = w('p5-06', 'p5-07');
  const bD = w('p5-08', 'p5-09');
  const bE = w('p5-10', 'p5-11');
  const bF = w('p5-12', 'p5-14');
  const bG = w('p5-15', 'p5-16');
  const bH = w('p5-17', 'p5-18');
  const bI = w('p5-19', 'p5-20');
  const bJ = w('p5-21', 'p5-23');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P5" tagline="身份与纳管" accent={theme.conceptDeep} />

      <Sequence {...bA} name="5-A 假设改写">
        <AssumptionShift a1={at('p5-01') - bA.from} span1={dur('p5-01')} a2={at('p5-02') - bA.from} a3={at('p5-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="5-B 识别">
        <ArchifyRecap slug="agent-identity" caption="身份机制 · 识别归因" cues={[{chapterId: 'audit', at: at('p5-04') - bB.from, durationInFrames: dur('p5-04')}]} />
        <AuditChain at={at('p5-05') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="5-C 天花板">
        <ArchifyRecap slug="agent-identity" caption="权限天花板 · Restricted Session Scope" cues={[
          {chapterId: 'ceiling', at: at('p5-06') - bC.from, durationInFrames: dur('p5-06')},
          {chapterId: 'strict', at: at('p5-07') - bC.from, durationInFrames: dur('p5-07')},
        ]} />
      </Sequence>

      <Sequence {...bD} name="5-D 交集">
        <ArchifyRecap slug="venn-intersection" caption="权限交集 · 只减不增" lead={false} cues={[{chapterId: 'two-iron-rules', at: at('p5-08') - bD.from, durationInFrames: dur('p5-08')}]} />
        <ArchifyRecap slug="zero-window-sequence" caption="交集实时求值" lead={false} cues={[{chapterId: 'dynamic-intersect', at: at('p5-09') - bD.from, durationInFrames: dur('p5-09')}]} />
      </Sequence>

      <Sequence {...bE} name="5-E 时间线走查">
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="solid" at={at('p5-10') - bE.from} note="Classmethod 实测" />
        </div>
        <ArchifyRecap slug="zero-window-sequence" caption="越权窗口实验" lead={false} cues={[{chapterId: 'experiment-risk', at: at('p5-10') - bE.from, durationInFrames: dur('p5-10')}]} />
        <ArchifyRecap slug="revocation-timeline" caption="回收即时生效" lead={false} cues={[{chapterId: 'realtime-ceiling', at: at('p5-11') - bE.from, durationInFrames: dur('p5-11')}]} />
      </Sequence>

      <Sequence {...bF} name="5-F 拆天花板">
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="filled" at={at('p5-12') - bF.from} note="D9 · 快照 vs 实时" />
        </div>
        <ArchifyRecap slug="agent-identity" caption="快照 vs 实时双钟" lead={false} cues={[{chapterId: 'snapshot-vs-live', at: at('p5-12') - bF.from, durationInFrames: dur('p5-12')}]} />
        <ArchifyRecap slug="revocation-timeline" caption="快照冻结 · 越权窗口" lead={false} cues={[{chapterId: 'static-snapshot', at: at('p5-13') - bF.from, durationInFrames: dur('p5-13')}]} />
        <ArchifyRecap slug="zero-window-sequence" caption="窗口压到零" lead={false} cues={[{chapterId: 'zero-window', at: at('p5-14') - bF.from, durationInFrames: dur('p5-14')}]} />
      </Sequence>

      <Sequence {...bG} name="5-G 焦虑">
        <ArchifyYield cues={[{at: at('p5-16') - bG.from, durationInFrames: dur('p5-16')}]}>
          <SchemaGrid at={at('p5-15') - bG.from} span={dur('p5-15')} />
        </ArchifyYield>
        <ArchifyRecap slug="classification-tagging" caption="分类引擎 · 能力边界" cues={[{chapterId: 'honest-limit', at: at('p5-16') - bG.from, durationInFrames: dur('p5-16')}]} />
      </Sequence>

      <Sequence {...bH} name="5-H 四步纳管">
        <ArchifyRecap slug="tag-gate-linkage" caption="第七机制 · 纳管" lead={false} cues={[{chapterId: 'seventh-mechanism', at: at('p5-17') - bH.from, durationInFrames: dur('p5-17')}]} />
        <ArchifyRecap slug="classification-tagging" caption="分类到自动纳管" lead={false} cues={[{chapterId: 'tag-driven', at: at('p5-18') - bH.from, durationInFrames: dur('p5-18')}]} />
      </Sequence>

      <Sequence {...bI} name="5-I 映射闸">
        <ArchifyRecap slug="tag-gate-linkage" caption="进楼考验 · 映射闸" lead={false} cues={[{chapterId: 'intake-test', at: at('p5-19') - bI.from, durationInFrames: dur('p5-19')}]} />
        <MappingBridge at={at('p5-20') - bI.from} />
      </Sequence>

      <Sequence {...bJ} name="5-J 拆映射">
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="filled" at={at('p5-21') - bJ.from} note="D10 · 拆映射" />
        </div>
        <ArchifyYield cues={[{at: at('p5-22') - bJ.from, durationInFrames: dur('p5-22')}]}>
          <TeardownStage at21={at('p5-21') - bJ.from} at23={at('p5-23') - bJ.from} />
        </ArchifyYield>
        <ArchifyRecap slug="classification-tagging" caption="未映射 = 保护缺口" cues={[{chapterId: 'explicit-gap', at: at('p5-22') - bJ.from, durationInFrames: dur('p5-22')}]} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ── 5-A 假设改写 ───────────────────────────────────────────────────────────

const KEYS = ['查询', '写入', '建表', '授权', '管理员'] as const;
/** 五把钥匙挂点：环心(270,170) r124 下半弧 35°..145° 均布（弓心落在弧上）。 */
const KEY_PTS = [
  {x: 371, y: 241},
  {x: 327, y: 279},
  {x: 270, y: 294},
  {x: 213, y: 279},
  {x: 169, y: 241},
] as const;

const AssumptionShift: React.FC<{a1: number; span1: number; a2: number; a3: number}> = ({a1, span1, a2, a3}) => {
  const frame = useCurrentFrame();
  // 剪影渐变铺满 p5-01 窗（「Agent 改变了这个假设」当句兑现）
  const m = progress(frame, a1 + 6, Math.max(DUR.f6, span1 - 6));
  const card = useEnter('rise', {at: a1, dur: DUR.f5, dist: 30});
  const ring = useDraw(a2, DUR.f6);
  const quote = useEnter('rise', {at: a3, dur: DUR.f5, dist: 26});
  const tally = progress(frame, a2 + KEYS.length * 13 + 8, DUR.f4);
  // row：剪影卡（360）左 · 钥匙串（540）右并排居中；金句浮标悬于两者下方不叠
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 150}}>
      {/* 剪影卡：人 → Agent（紫 = 身份层） */}
      <div
        style={{
          ...card,
          width: 360,
          height: 430,
          borderRadius: 16,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          position: 'relative',
        }}
      >
        <span style={{position: 'absolute', top: 22, left: 26, fontFamily: theme.mono, fontSize: 15, letterSpacing: 3, color: theme.dim}}>
          {'WHO ASKS'}
        </span>
        <svg width={360} height={430} viewBox="0 0 360 430">
          <g opacity={1 - m}>
            <circle cx={180} cy={168} r={46} fill="none" stroke={withA(theme.text, 0.75)} strokeWidth={4} />
            <path d="M 92 322 Q 180 214 268 322" fill="none" stroke={withA(theme.text, 0.75)} strokeWidth={4} />
          </g>
          <g opacity={m}>
            <line x1={180} y1={118} x2={180} y2={86} stroke={theme.conceptDeep} strokeWidth={4} />
            <circle cx={180} cy={79} r={7} fill={theme.conceptDeep} />
            <rect x={124} y={118} width={112} height={104} rx={16} fill="none" stroke={theme.conceptDeep} strokeWidth={4} />
            <rect x={150} y={158} width={14} height={14} fill={theme.conceptDeep} />
            <rect x={196} y={158} width={14} height={14} fill={theme.conceptDeep} />
            <line x1={158} y1={202} x2={202} y2={202} stroke={theme.conceptDeep} strokeWidth={4} />
          </g>
        </svg>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 30, height: 40}}>
          <span style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: theme.sans, fontSize: 29, color: theme.dim, opacity: 1 - m}}>
            {'默认：人'}
          </span>
          <span style={{position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: theme.mono, fontSize: 25, letterSpacing: 2, color: theme.conceptDeep, opacity: m}}>
            {'实际：AGENT'}
          </span>
        </div>
      </div>
      {/* 钥匙串：环描画 + 五把钥匙错峰抖落（@enter:fall，逐把组件化让 hooks 合法居顶层） */}
      <div style={{width: 540, height: 460, position: 'relative'}}>
        <svg width={540} height={460} viewBox="0 0 540 460" style={{position: 'absolute', inset: 0}}>
          <circle cx={270} cy={170} r={124} fill="none" stroke={withA(theme.dim, 0.85)} strokeWidth={5} {...ring} />
        </svg>
        {KEYS.map((label, i) => (
          <KeyTag key={label} label={label} at={a2 + i * 13} x={KEY_PTS[i].x} y={KEY_PTS[i].y} />
        ))}
        <div style={{position: 'absolute', left: 0, right: 0, top: 426, textAlign: 'center', opacity: tally, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
          {'继承权限 × 5'}
        </div>
      </div>
      {/* 金句浮标（caption-dup-ok：storyboard 指定复述 p5-03 金句） */}
      <div style={{...quote, position: 'absolute', left: 0, right: 0, bottom: 196, textAlign: 'center'}}>
        <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.concept}}>
          {'「不该拿着你全部的钥匙」'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const KeyTag: React.FC<{label: string; at: number; x: number; y: number}> = ({label, at, x, y}) => {
  const e = useEnter('fall', {at, dur: DUR.f5, dist: 64});
  return (
    <div
      style={{
        ...e,
        position: 'absolute',
        left: x - 34,
        top: y - 13,
        width: 68,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <svg width={30} height={96} viewBox="0 0 30 96">
        <circle cx={15} cy={13} r={10} fill="none" stroke={theme.conceptDeep} strokeWidth={4} />
        <rect x={11} y={22} width={8} height={66} fill={theme.conceptDeep} />
        <rect x={19} y={64} width={9} height={6} fill={theme.conceptDeep} />
        <rect x={19} y={76} width={7} height={6} fill={theme.conceptDeep} />
      </svg>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 6,
          padding: '2px 7px',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
};

// ── 5-B 审计链（识别层：四入口 → 授权/执行/对象） ──────────────────────────

const ENTRIES = ['SQL', 'API', 'APP', 'AGENT'] as const;
const CHAIN = [
  {label: '授权', sub: 'AUTHZ'},
  {label: '执行', sub: 'EXEC'},
  {label: '对象', sub: 'OBJECT'},
] as const;

const AuditChain: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const settle = useSpring('settle', {at: at + 4, dur: DUR.f5}); // 链体落位（@spring，几何通道）
  const flow = useFlowDash({dash: 10, gap: 13, period: 26}); // 链路行进虚线（@flowDash）
  const head = progress(frame, at, DUR.f4);
  const tagO = progress(frame, at + 3, DUR.f4);
  const entries = ENTRIES.map((_, i) => progress(frame, at + i * 5, DUR.f3));
  const nodes = CHAIN.map((_, i) => progress(frame, at + 8 + i * 12, DUR.f4));
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <div
        style={{
          position: 'absolute',
          top: 96,
          right: 120,
          opacity: tagO,
          fontFamily: theme.mono,
          fontSize: 17,
          color: theme.dim,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 7,
          padding: '5px 10px',
        }}
      >
        {'agent_type · agents_info'}
      </div>
      {/* 四入口：Agent 入口紫描边（身份层） */}
      <div style={{display: 'flex', gap: 20}}>
        {ENTRIES.map((t, i) => {
          const agent = t === 'AGENT';
          return (
            <div
              key={t}
              style={{
                opacity: entries[i],
                width: 150,
                height: 62,
                borderRadius: 10,
                border: `2px solid ${agent ? theme.conceptDeep : theme.panelBorder}`,
                background: agent ? withA(theme.conceptDeep, 0.1) : theme.panel,
                boxShadow: agent ? `0 0 16px ${withA(theme.conceptDeep, 0.35)}` : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 21, letterSpacing: 2, color: agent ? theme.conceptDeep : theme.dim}}>{t}</span>
            </div>
          );
        })}
      </div>
      {/* 审计链：节点错峰、连线随行进虚线逐节亮 */}
      <div style={{display: 'flex', alignItems: 'center', opacity: head, transform: `translateY(${(1 - settle) * 34}px)`}}>
        {CHAIN.map((n, i) => (
          <React.Fragment key={n.label}>
            {i > 0 ? (
              <svg width={140} height={24} viewBox="0 0 140 24" style={{opacity: nodes[i]}}>
                <line x1={4} y1={12} x2={118} y2={12} stroke={theme.conceptDeep} strokeWidth={2.5} opacity={0.85} {...flow} />
                <polygon points="118,4 136,12 118,20" fill={theme.conceptDeep} opacity={0.9} />
              </svg>
            ) : null}
            <div
              style={{
                opacity: nodes[i],
                width: 250,
                height: 140,
                borderRadius: 12,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                padding: '18px 22px',
                position: 'relative',
              }}
            >
              <span style={{position: 'absolute', top: 14, left: 18, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{position: 'absolute', top: 16, right: 18, fontFamily: theme.mono, fontSize: 13, letterSpacing: 1, color: theme.dim}}>
                {n.sub}
              </span>
              <div style={{marginTop: 46, fontFamily: theme.sans, fontSize: 38, fontWeight: 600, color: theme.text}}>{n.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-G 表网格增殖（供给焦虑：新列浮起 · 人工追不上 · 扫描波次） ────────────

const NEW_COLS = [
  {c: 4, tag: '+phone'},
  {c: 9, tag: '+ssn'},
  {c: 14, tag: '+…'},
] as const;

const SchemaGrid: React.FC<{at: number; span: number}> = ({at, span}) => {
  const frame = useCurrentFrame();
  const COLS = 18;
  const ROWS = 8;
  const CELL = 40;
  const GAP = 8;
  const W = COLS * (CELL + GAP) - GAP;
  const H = ROWS * (CELL + GAP) - GAP;
  // 波次命中 +phone 的点亮锚（评审 H 轮）：扫描线 84 帧周期（sweepX 同式反解），过
  // +phone 列中心（c=4 → x = 4×48+20 = 212）在 t≈23 与 t≈107 两轮——锚第二轮过境，
  // 波扫到列上的瞬间点亮（原锚 0.66×span 与波相位脱钩，走远后芯片才亮）
  const hitAt = at + 84 + Math.round(((NEW_COLS[0].c * (CELL + GAP) + CELL / 2 + 40) / (W + 80)) * 84);
  const flow = useFlowDash({dash: 12, gap: 16, period: 30}); // 扫描波行进（@flowDash）
  const flash = useImpulse({at: hitAt, dur: 16, peak: 1}); // 波次命中 +phone 的点亮脉冲（@impulse）
  const pending = useCount({to: NEW_COLS.length, at: at + 16, dur: 42}); // 新增待保护列计数（@count）
  const appear = progress(frame, at, DUR.f4);
  const droop = progress(frame, at + 30, Math.max(DUR.f6, span - 30)); // 标签员渐疲
  const hit = progress(frame, hitAt, DUR.f3);
  const sweepX = (((Math.max(0, frame - at) % 84) / 84) * (W + 80)) - 40; // 波次循环扫过
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 64, opacity: appear}}>
        {/* 人工标签员：渐疲下垂 */}
        <div
          style={{
            width: 190,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            paddingTop: 46,
            transform: `translateY(${6 + 16 * droop}px) rotate(${2.5 * droop}deg)`,
          }}
        >
          <svg width={120} height={150} viewBox="0 0 120 150">
            <circle cx={60} cy={34} r={20} fill="none" stroke={withA(theme.text, 0.6)} strokeWidth={3.5} />
            <path d="M 22 118 Q 60 52 98 118" fill="none" stroke={withA(theme.text, 0.6)} strokeWidth={3.5} />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={80 + i * 3} y={98 - i * 10} width={26} height={13} rx={2.5} fill={theme.panel} stroke={withA(theme.dim, 0.7)} strokeWidth={1.5} />
            ))}
          </svg>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'人工登记'}</span>
        </div>
        {/* 表网格：暗格铺底 + 新列浮起 + 扫描波 */}
        <div style={{position: 'relative', width: W, paddingTop: 44}}>
          {NEW_COLS.map((nc, i) => {
            const p = progress(frame, at + 18 + i * 22, DUR.f5);
            const lit = i === 0 && hit >= 1;
            return (
              <div key={nc.tag} style={{position: 'absolute', top: 4, left: nc.c * (CELL + GAP) - 8, opacity: p}}>
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 15,
                    color: lit ? theme.conceptDeep : theme.dim,
                    border: `1.5px solid ${lit ? theme.conceptDeep : withA(theme.dim, 0.5)}`,
                    borderRadius: 6,
                    padding: '2px 8px',
                    whiteSpace: 'nowrap',
                    boxShadow: lit ? `0 0 ${10 * flash}px ${withA(theme.conceptDeep, 0.55 * flash)}` : 'none',
                  }}
                >
                  {nc.tag}
                </span>
              </div>
            );
          })}
          <div style={{position: 'relative', width: W, height: H}}>
            {Array.from({length: COLS * ROWS}, (_, i) => {
              const r = Math.floor(i / COLS);
              const c = i % COLS;
              const p = progress(frame, at + r * 2 + Math.floor(c / 3), DUR.f3);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: c * (CELL + GAP),
                    top: r * (CELL + GAP),
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    background: withA(theme.text, 0.055),
                    opacity: p,
                  }}
                />
              );
            })}
            {NEW_COLS.map((nc, i) => {
              const p = progress(frame, at + 18 + i * 22, DUR.f5);
              return (
                <div
                  key={nc.tag + i}
                  style={{
                    position: 'absolute',
                    left: nc.c * (CELL + GAP),
                    top: 0,
                    width: CELL,
                    height: H,
                    borderRadius: 4,
                    border: `1.5px solid ${withA(theme.dim, 0.5)}`,
                    background: withA(theme.text, 0.06),
                    opacity: p,
                    transform: `translateY(${(1 - p) * 26}px)`,
                  }}
                />
              );
            })}
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
              <line x1={sweepX} y1={0} x2={sweepX} y2={H} stroke={theme.conceptDeep} strokeWidth={3} opacity={0.9} {...flow} />
            </svg>
          </div>
        </div>
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18, opacity: appear}}>
        <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'每日新增 · 待保护列'}</span>
        <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 46, color: theme.text}}>×{Math.round(pending)}</span>
        <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'人工登记追不上'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-I 对章卡 + 一次性映射桥 ──────────────────────────────────────────────

const MappingBridge: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const draw = useDraw(at + 4, DUR.f6); // 桥接描画（@draw）
  const left = progress(frame, at, DUR.f5);
  const right = progress(frame, at + 8, DUR.f5);
  const apex = progress(frame, at + 30, DUR.f4);
  const chipA = progress(frame, at + 38, DUR.f4);
  const chipB = progress(frame, at + 48, DUR.f4);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <div
          style={{
            opacity: left,
            transform: `translateY(${(1 - left) * 24}px)`,
            width: 400,
            height: 250,
            borderRadius: 16,
            border: `2px solid ${withA(theme.concept, 0.7)}`,
            background: theme.panel,
            padding: '30px 34px',
            position: 'relative',
          }}
        >
          <span style={{position: 'absolute', top: 24, left: 30, fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: theme.concept}}>
            {'CLASSIFY · 分类引擎'}
          </span>
          <div style={{marginTop: 62, fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>{'机器管发现'}</div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'系统标签 · 持续扫描'}</div>
        </div>
        <div style={{position: 'relative', width: 460, height: 260}}>
          <svg width={460} height={260} viewBox="0 0 460 260">
            <line x1={30} y1={92} x2={30} y2={236} stroke={withA(theme.dim, 0.8)} strokeWidth={3} />
            <line x1={430} y1={92} x2={430} y2={236} stroke={withA(theme.dim, 0.8)} strokeWidth={3} />
            <path d="M 30 90 Q 230 -40 430 90" fill="none" stroke={theme.conceptDeep} strokeWidth={3.5} {...draw} />
          </svg>
          <div style={{position: 'absolute', left: 0, right: 0, top: 2, display: 'flex', justifyContent: 'center', opacity: apex}}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 17,
                letterSpacing: 1,
                color: theme.conceptDeep,
                background: theme.panel,
                border: `1.5px solid ${withA(theme.conceptDeep, 0.65)}`,
                borderRadius: 7,
                padding: '5px 12px',
              }}
            >
              {'一次性映射'}
            </span>
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12}}>
            <span style={{opacity: chipA, fontFamily: theme.mono, fontSize: 16, color: theme.dim, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 6, padding: '3px 9px'}}>
              {'系统标签'}
            </span>
            <span style={{opacity: chipA, color: theme.dim, fontSize: 18}}>{'→'}</span>
            <span style={{opacity: chipB, fontFamily: theme.mono, fontSize: 16, color: theme.conceptDeep, border: `1.5px solid ${withA(theme.conceptDeep, 0.6)}`, borderRadius: 6, padding: '3px 9px'}}>
              {'治理标签'}
            </span>
          </div>
        </div>
        <div
          style={{
            opacity: right,
            transform: `translateY(${(1 - right) * 24}px)`,
            width: 400,
            height: 250,
            borderRadius: 16,
            border: `2px solid ${withA(theme.conceptDeep, 0.7)}`,
            background: theme.panel,
            padding: '30px 34px',
            position: 'relative',
          }}
        >
          <span style={{position: 'absolute', top: 24, left: 30, fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: theme.conceptDeep}}>
            {'GOVERN · 治理规则'}
          </span>
          <div style={{marginTop: 62, fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>{'人管定规'}</div>
          <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'掩码绑定 · 组织规则'}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-J 红绿消融（拆映射）＋ 明文/星号扫过 ────────────────────────────────

const TeardownStage: React.FC<{at21: number; at23: number}> = ({at21, at23}) => (
  <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36}}>
    <AblationPair
      at={at21}
      width={1560}
      minHeight={430}
      left={{
        tag: 'D10',
        title: '拆掉映射 · 只分类不绑策略',
        lines: ['新列 phone → 系统标签 CONTACT_INFO', '系统标签 → 治理标签：无映射', '查询命中 → 明文出楼'],
        flow: {},
      }}
      right={{
        tag: '映射在位',
        title: '一次性映射 → 自动打码',
        lines: ['系统标签 CONTACT_INFO → 治理标签 pii', '治理标签 pii → MASK 策略', '次日查询 → 打码值'],
        flow: {},
      }}
    />
    <MaskSweep at={at23} />
  </AbsoluteFill>
);

const PLAIN = '13800002041';

const MaskSweep: React.FC<{at: number}> = ({at}) => {
  const stars = useReveal('*'.repeat(PLAIN.length), {at, framesPerChar: 2}); // 星号左起逐位铺开（@reveal）
  const frame = useCurrentFrame();
  const done = progress(frame, at, PLAIN.length * 2 + 4);
  const color = done >= 1 ? theme.ok : theme.danger; // 明文出楼=泄露红 → 打码完成=拦截绿
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 22,
        padding: '16px 30px',
        borderRadius: 12,
        border: `2px solid ${withA(color, 0.55)}`,
        background: theme.panel,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'次日查询 · phone'}</span>
      <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 42, color}}>
        {stars + PLAIN.slice(stars.length)}
      </span>
    </div>
  );
};
