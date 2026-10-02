/** P4 背书与血缘（p4-01..p4-22，22 句无 p4-03；storyboard「P4 背书与血缘」节）。
 *
 *  8 镜 / 16 条 archify cue（一章锚一句）。cue 窗自 4-A 起跨镜背靠背连续成链
 *  （句窗含句间 gap 严格相接），链上除 4-A 首章与 4-E 空窗后重现的 miss-fallback
 *  外一律 lead={false}；链在 4-D 装置镜与 p4-12/14 两处空窗断开：
 *   4-A valid-sql-wrong-answer：syntax-pass@01 → business-fail@02
 *   4-B one-checkpoint sign-vs-checkpoint@04 + vqr-lifecycle signed-stamped@05；
 *      定义卡母题·签名盖章位（stampAt=p4-05）为 4-D② 基底层——两章 cue 全覆盖
 *      句窗、画框遮盖期不可见（首例 lead=false 连链故无入场瞬态）；可见读出由
 *      左缘四要素卡 + VQR 落章（@enter:fall + 青印脉冲）承担
 *   4-C one-checkpoint shared-checkpoint@06 + resolve-activation hit-reconcile@07；
 *      p4-08 空窗句画框卸载，命中路由亮线（@flowDash）装置入场
 *   4-D 纯装置：ReconcileCols 双列计数对账（@count）逐月打勾（@stagger）+ 实心徽
 *   4-E resolve-activation miss-fallback@11 + outside-eval@13（p4-12/14 空窗）：
 *      三条出路卡 / 代价卡 + 虚线徽（官方文档）
 *   4-F lineage-ledger engine-lane@16 + ledger-and-blind@17；p4-15 空窗句列级边
 *      逐条入账（@draw）；OpenLineage 角标自 p4-17 入、4-G 续挂（页缘可见）
 *   4-G lineage-ledger ingest-lane@17b + ghost-edge-pollution rejected@18 +
 *      upstream-traceback three-seconds@19；左缘三道闸指示（@spring，页缘可见）
 *   4-H ghost-edge-pollution fake-event@20+gate-removed@21 + upstream-traceback
 *      living-ledger@22；AblationPair 红绿同屏为 4-D② 基底层（三章 cue 全覆盖
 *      句窗，遮盖期不可见），页缘幽灵边呼吸 chip（@breathe）+ 实心徽承担可见读出
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {AblationPair, DefinitionCard} from '../components/devices';

/** #RRGGBB → rgba（theme 未导出 withAlpha 的本地替身，同 devices.tsx 惯例）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const P4Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-04', 'p4-05');
  const bC = w('p4-06', 'p4-08');
  const bD = w('p4-09', 'p4-10');
  const bE = w('p4-11', 'p4-14');
  const bF = w('p4-15', 'p4-17');
  const bG = w('p4-17b', 'p4-19');
  const bH = w('p4-20', 'p4-22');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P4" tagline="背书与血缘" accent={theme.conceptDeep} />

      {/* 4-A 失效面：两章接力（链首入场） */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="4-A 失效面">
        <ArchifyRecap slug="valid-sql-wrong-answer" caption="语法对 · 答案错" cues={[
          {chapterId: 'syntax-pass', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')},
          {chapterId: 'business-fail', at: at('p4-02') - bA.from, durationInFrames: dur('p4-02')},
        ]} />
      </Sequence>

      {/* 4-B 核准题库：sign-vs-checkpoint@04（接 4-A 链尾背靠背）→ signed-stamped@05。
          定义卡母题盖章位 = 基底层（被画框整镜遮盖，4-D② 范式）；左缘四要素卡 + VQR 落章可见 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="4-B 核准题库">
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <DefinitionCard
            at={at('p4-04') - bB.from}
            kicker="SEMANTIC VIEW · VQR"
            title="签字问答对"
            note="有人签字 · 存进语义视图"
            stampAt={at('p4-05') - bB.from}
          />
        </AbsoluteFill>
        <FourElements at={at('p4-04') - bB.from} sealAt={at('p4-05') - bB.from} />
        <ArchifyRecap slug="one-checkpoint" caption="核准题库 · 共用执法点" cues={[
          {chapterId: 'sign-vs-checkpoint', at: at('p4-04') - bB.from, durationInFrames: dur('p4-04')},
        ]} lead={false} />
        <ArchifyRecap slug="vqr-lifecycle" caption="签字盖章 · VQR" cues={[
          {chapterId: 'signed-stamped', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
        ]} lead={false} />
      </Sequence>

      {/* 4-C 命中短路：shared-checkpoint@06 → hit-reconcile@07（跨镜续链）；
          p4-08 空窗句画框卸载，命中路由亮线走查（@flowDash） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="4-C 命中短路">
        <HitRoute at={at('p4-08') - bC.from} />
        <ArchifyRecap slug="one-checkpoint" caption="核准题库 · 共用执法点" cues={[
          {chapterId: 'shared-checkpoint', at: at('p4-06') - bC.from, durationInFrames: dur('p4-06')},
        ]} lead={false} />
        <ArchifyRecap slug="resolve-activation" caption="命中 · 验证查询直行" cues={[
          {chapterId: 'hit-reconcile', at: at('p4-07') - bC.from, durationInFrames: dur('p4-07')},
        ]} lead={false} />
      </Sequence>

      {/* 4-D 对账走查：纯装置——题库响应 vs 引擎重算双列计数（@count）、逐月打勾（@stagger） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="4-D 对账走查">
        <ReconcileCols at09={at('p4-09') - bD.from} at10={at('p4-10') - bD.from} />
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="filled" at={at('p4-10') - bD.from} note="verified == 重算" />
        </div>
      </Sequence>

      {/* 4-E 三条出路：miss-fallback@11（空窗后重现，恢复入场）→ outside-eval@13；
          p4-12 三条出路卡 / p4-14 代价卡 + 虚线徽（官方文档）。
          两装置按句窗互斥（2-J 范式）：同为居中 AbsoluteFill 且无退场，滞留会在 p4-14
          同窗叠加——CostCard 整卡遮盖「未命中」中卡并切左右卡（评审修复，实证帧 15171） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="4-E 三条出路">
        <Sequence from={at('p4-12') - bE.from} durationInFrames={dur('p4-12')} name="4-E-exits">
          {/* 窗即 p4-12：局部帧 0 = 句首；末 8 帧自淡出让位——p4-13 的 outside-eval
              是空窗后重现章，画框入场弹簧头两帧全透明，硬切会留 ~2 帧空底 */}
          <ThreeExits at={0} until={dur('p4-12')} />
        </Sequence>
        <Sequence from={at('p4-14') - bE.from} durationInFrames={dur('p4-14')} name="4-E-cost">
          {/* 窗即 p4-14：局部帧 0 = 句首 */}
          <CostCard at={0} />
        </Sequence>
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="dashed" at={at('p4-14') - bE.from} note="官方文档 · 优化代价" />
        </div>
        <ArchifyRecap slug="resolve-activation" caption="未命中 · 三条出路" cues={[
          {chapterId: 'miss-fallback', at: at('p4-11') - bE.from, durationInFrames: dur('p4-11')},
          {chapterId: 'outside-eval', at: at('p4-13') - bE.from, durationInFrames: dur('p4-13')},
        ]} />
      </Sequence>

      {/* 4-F 血缘账本：engine-lane@16 → ledger-and-blind@17（空窗后链重启，恢复入场）；
          p4-15 空窗句列级边逐条入账（@draw）；OpenLineage 角标自 p4-17 起入（页缘可见） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="4-F 血缘账本">
        <LineageEdges at={at('p4-15') - bF.from} />
        <OpenLineageChip at={at('p4-17') - bF.from} />
        <ArchifyRecap slug="lineage-ledger" caption="血缘账本 · 列级记账" cues={[
          {chapterId: 'engine-lane', at: at('p4-16') - bF.from, durationInFrames: dur('p4-16')},
          {chapterId: 'ledger-and-blind', at: at('p4-17') - bF.from, durationInFrames: dur('p4-17')},
        ]} />
      </Sequence>

      {/* 4-G 三道闸：ingest-lane@17b → rejected@18 → three-seconds@19（跨镜续链）；
          左缘三道闸指示条页缘可见（@spring 逐道落锁；p4-18 拒收态） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="4-G 三道闸">
        <TriGates at={at('p4-17b') - bG.from} rejectAt={at('p4-18') - bG.from} />
        {/* 续挂（背靠背，装置层 lead 语义）：4-F 实例镜尾已满显，-999 预置满显
            跳过淡入，否则镜界闪灭 ~8 帧再重渐入（与 ArchifyClip lead={false} 同构） */}
        <OpenLineageChip at={-999} />
        <ArchifyRecap slug="lineage-ledger" caption="血缘账本 · 外部摄取" cues={[
          {chapterId: 'ingest-lane', at: at('p4-17b') - bG.from, durationInFrames: dur('p4-17b')},
        ]} lead={false} />
        <ArchifyRecap slug="ghost-edge-pollution" caption="解析闸 · 当场拒收" cues={[
          {chapterId: 'rejected', at: at('p4-18') - bG.from, durationInFrames: dur('p4-18')},
        ]} lead={false} />
        <ArchifyRecap slug="upstream-traceback" caption="沿账回溯 · 三秒定位" cues={[
          {chapterId: 'three-seconds', at: at('p4-19') - bG.from, durationInFrames: dur('p4-19')},
        ]} lead={false} />
      </Sequence>

      {/* 4-H 拆闸消融：fake-event@20 → gate-removed@21 → living-ledger@22（跨镜续链）。
          AblationPair 红绿同屏 = 基底层（被画框整镜遮盖，4-D② 范式）；页缘幽灵边呼吸
          chip（@breathe）+ 实心徽承担红绿对照的可见读出 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="4-H 拆闸消融">
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <AblationPair
            width={1240}
            at={at('p4-20') - bH.from}
            left={{
              tag: 'D8 · 拆闸',
              title: '解析闸关掉',
              lines: ['虚构事件推入摄取口', 'gate 缺位 · 未解析放行', 'ghost_edge 写入账本'],
              meter: {label: '虚构边入账', from: 0, to: 1, suffix: ' 条', at: at('p4-21') - bH.from},
              flow: {label: '污染从入口开始'},
            }}
            right={{
              tag: '闸在',
              title: '三道全拒',
              lines: ['鉴权 ✓ · 可解析 ✗', '整事件拒绝 · 不入账', '账本里没有虚构的边'],
              meter: {label: '虚构边入账', from: 0, to: 0, suffix: ' 条'},
              flow: {},
            }}
          />
        </AbsoluteFill>
        <GhostEdge at={at('p4-21') - bH.from} />
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="filled" at={at('p4-21') - bH.from} note="D8 · 拆闸对照" />
        </div>
        <ArchifyRecap slug="ghost-edge-pollution" caption="幽灵边污染 · 拆闸" cues={[
          {chapterId: 'fake-event', at: at('p4-20') - bH.from, durationInFrames: dur('p4-20')},
          {chapterId: 'gate-removed', at: at('p4-21') - bH.from, durationInFrames: dur('p4-21')},
        ]} lead={false} />
        <ArchifyRecap slug="upstream-traceback" caption="台账活的可信" cues={[
          {chapterId: 'living-ledger', at: at('p4-22') - bH.from, durationInFrames: dur('p4-22')},
        ]} lead={false} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 4-B 四要素卡 + VQR 落章

/** 左缘四要素卡（题/查询/验证人/日期）——画框（x311..1609）页缘外的可见读出。 */
const FourElements: React.FC<{at: number; sealAt: number}> = ({at, sealAt}) => {
  const rows = useStagger(4, {at, stride: 9, dur: DUR.f4});
  const items = [
    {k: 'QUESTION', t: '一道题', s: '自然语言问句'},
    {k: 'VERIFIED SQL', t: '验证过的查询', s: '签核版 · 非现场生成'},
    {k: 'VERIFIER', t: '验证人', s: '有人签字'},
    {k: 'DATE', t: '验证日期', s: '何时验证'},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 244,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {items.map((it, i) => (
        <div
          key={it.k}
          style={{
            width: 264,
            borderRadius: 12,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            padding: '15px 18px',
            opacity: rows[i],
            transform: `translateY(${(1 - rows[i]) * -22}px)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 13, letterSpacing: 2, color: theme.verify}}>{it.k}</div>
          <div style={{marginTop: 6, fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text}}>{it.t}</div>
          <div style={{marginTop: 4, fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{it.s}</div>
        </div>
      ))}
      <VqrSeal at={sealAt} />
    </div>
  );
};

/** VQR 落章（青）：盖章落印 `@enter:fall` + 印记脉冲——devices.SignStamp 的页缘可见化身。 */
const VqrSeal: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('fall', {at, dur: DUR.f5, dist: 54});
  const s = useSpring('settle', {at, dur: DUR.f5});
  const pulse = useImpulse({at: at + 4, dur: 16, peak: 1});
  return (
    <div
      style={{
        ...e,
        position: 'relative',
        width: 104,
        height: 104,
        transform: `${e.transform} scale(${0.7 + 0.3 * s})`,
      }}
    >
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `2.5px solid ${theme.verify}`}} />
      <div style={{position: 'absolute', inset: 9, borderRadius: '50%', border: `1.5px dashed ${withA(theme.verify, 0.55)}`}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2.5px solid ${theme.verify}`,
          transform: `scale(${1 + 0.32 * pulse})`,
          opacity: 0.6 * pulse,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 15, letterSpacing: 1, color: theme.verify}}>{'VERIFIED'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 12, color: withA(theme.verify, 0.75)}}>{'VQR'}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 4-C 命中路由亮线

/** 命中路由亮线（p4-08 空窗句）：新问题 → 核准题库（命中）→ 验证过的查询直行。
 *  路由连线 = useFlowDash 行进虚线（`@flowDash`）。 */
const HitRoute: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 30, restBottom: 570});
  const flow = useFlowDash({dash: 10, gap: 12, period: 26});
  const frame = useCurrentFrame();
  const hit = progress(frame, at + 8, DUR.f4);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...e, display: 'flex', alignItems: 'center', gap: 0}}>
        <div style={{width: 300, borderRadius: 14, border: `2px solid ${theme.panelBorder}`, background: theme.panel, padding: '22px 24px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 14, letterSpacing: 2, color: theme.dim}}>{'NEW QUESTION'}</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text, lineHeight: 1.4}}>
            {/* caption-dup-ok: 查询卡承载口播中的原问句——「有人问」的装置语义需要问句原文 */}
            {'上个月活跃用户多少？'}
          </div>
        </div>
        <svg width={110} height={40} viewBox="0 0 110 40">
          <line x1={4} y1={20} x2={88} y2={20} stroke={theme.verify} strokeWidth={2.5} opacity={0.9} {...flow} />
          <polygon points="88,12 106,20 88,28" fill={theme.verify} />
        </svg>
        <div
          style={{
            width: 330,
            borderRadius: 14,
            border: `2px solid ${withA(theme.verify, 0.4 + 0.6 * hit)}`,
            background: theme.panel,
            padding: '22px 24px',
            position: 'relative',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 14, letterSpacing: 2, color: theme.dim}}>{'VQR · 核准题库'}</div>
          <div style={{marginTop: 10, display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'扫题库'}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.verify,
                border: `1.5px solid ${withA(theme.verify, 0.6)}`,
                borderRadius: 6,
                padding: '2px 9px',
                opacity: hit,
                transform: `scale(${0.8 + 0.2 * hit})`,
              }}
            >
              {'HIT'}
            </span>
          </div>
        </div>
        <svg width={110} height={40} viewBox="0 0 110 40">
          <line x1={4} y1={20} x2={88} y2={20} stroke={theme.verify} strokeWidth={2.5} opacity={0.9} {...flow} />
          <polygon points="88,12 106,20 88,28" fill={theme.verify} />
        </svg>
        <div style={{width: 360, borderRadius: 14, border: `2px solid ${theme.verify}`, background: withA(theme.verify, 0.07), padding: '22px 24px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 14, letterSpacing: 2, color: theme.dim}}>{'VERIFIED SQL'}</div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.verify}}>{'验证过的查询'}</div>
          <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'直接执行 · 不经现场生成'}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 4-D 对账双列

/** 对账双列（storyboard 实现映射：ReconcileCols）——题库响应 vs 引擎重算，
 *  逐月双列计数（`@count`）、对勾错峰（`@stagger`）。 */
const ReconcileCols: React.FC<{at09: number; at10: number}> = ({at09, at10}) => {
  const frame = useCurrentFrame();
  const panel = progress(frame, at09, DUR.f5);
  const verdict = progress(frame, at10, DUR.f4);
  const rows = [
    {m: '第 1 月', v: 200},
    {m: '第 2 月', v: 150},
    {m: '第 3 月', v: 300},
  ];
  return (
    <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24}}>
      <div style={{fontFamily: theme.mono, fontSize: 18, letterSpacing: 4, color: theme.dim, opacity: panel}}>
        {'RECONCILE · 逐月对账'}
      </div>
      <div
        style={{
          width: 1180,
          borderRadius: 16,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: panel,
          transform: `translateY(${(1 - panel) * 18}px)`,
        }}
      >
        <div style={{display: 'flex', gap: 26, padding: '20px 26px 10px'}}>
          <div style={{width: 110}} />
          <div style={{flex: 1, textAlign: 'right'}}>
            <div style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: theme.verify}}>{'核准题库 · 验证查询响应'}</div>
            <div style={{marginTop: 3, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'响应含验证人 · 日期'}</div>
          </div>
          <div style={{width: 26}} />
          <div style={{flex: 1, textAlign: 'right'}}>
            <div style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: theme.text}}>{'引擎重算 · 对照'}</div>
            <div style={{marginTop: 3, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'玩具原型独立复算'}</div>
          </div>
          <div style={{width: 46}} />
        </div>
        {rows.map((r, i) => (
          <ReconcileRow key={r.m} label={r.m} value={r.v} at={at09 + 6 + i * 10} checkAt={at10 + i * 8} />
        ))}
      </div>
      <div
        style={{
          opacity: verdict,
          transform: `translateY(${(1 - verdict) * 12}px)`,
          padding: '12px 30px',
          borderRadius: 10,
          border: `2px solid ${theme.verify}`,
          background: withA(theme.verify, 0.07),
          fontFamily: theme.mono,
          fontSize: 26,
          color: theme.verify,
        }}
      >
        {'verified == 重算 · 逐月一致'}
      </div>
    </AbsoluteFill>
  );
};

const ReconcileRow: React.FC<{label: string; value: number; at: number; checkAt: number}> = ({
  label,
  value,
  at,
  checkAt,
}) => {
  const left = useCount({to: value, at, dur: 30});
  const right = useCount({to: value, at: at + 4, dur: 30});
  const frame = useCurrentFrame();
  const ok = progress(frame, checkAt, DUR.f3);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        height: 92,
        padding: '0 26px',
        borderTop: `1.5px solid ${theme.panelBorder}`,
      }}
    >
      <span style={{width: 110, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{label}</span>
      <span style={{flex: 1, textAlign: 'right', fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 46, color: theme.verify}}>
        {Math.round(left)}
      </span>
      <span style={{width: 26, textAlign: 'center', fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'↔'}</span>
      <span style={{flex: 1, textAlign: 'right', fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 46, color: theme.text}}>
        {Math.round(right)}
      </span>
      <span
        style={{
          width: 46,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 38,
          fontWeight: 700,
          color: theme.verify,
          opacity: ok,
          transform: `scale(${0.6 + 0.4 * ok})`,
        }}
      >
        {'✓'}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────── 4-E 三条出路 / 代价卡

/** 三条出路（p4-12 空窗句）：panel 底 + 编号反枚举并列；「静默瞎猜」划线除名。
 *  until（窗长）给出时末 8 帧自淡出——窗外下一句是空窗后重现的 archify 章，
 *  画框入场弹簧头两帧全透明，无退场会在句界硬切出 ~2 帧空底（评审修复）。 */
const ThreeExits: React.FC<{at: number; until?: number}> = ({at, until}) => {
  const st = useStagger(3, {at, stride: 8, dur: DUR.f4});
  const frame = useCurrentFrame();
  const chipO = progress(frame, at + 26, DUR.f4);
  const fadeOut = until != null ? 1 - progress(frame, until - 8, 8) : 1;
  const exits = [
    {n: '01', t: '命中题库', s: '直接执行验证查询', a: theme.verify},
    {n: '02', t: '未命中', s: '走现算 · 用治理定义', a: theme.concept},
    {n: '03', t: '无治理覆盖', s: '明确告警 · 不硬猜', a: theme.conceptDeep},
  ];
  return (
    <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, opacity: fadeOut}}>
      <div style={{display: 'flex', gap: 26}}>
        {exits.map((x, i) => (
          <div
            key={x.n}
            style={{
              width: 380,
              borderRadius: 14,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
              padding: '24px 28px',
              position: 'relative',
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 24}px)`,
            }}
          >
            <div style={{position: 'absolute', left: 0, top: 24, bottom: 24, width: 3, background: x.a}} />
            <div style={{fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: x.a}}>{x.n}</div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>{x.t}</div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{x.s}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          opacity: chipO,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '10px 28px',
          border: `1.5px dashed ${withA(theme.dim, 0.6)}`,
          borderRadius: 10,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, textDecoration: 'line-through'}}>{'静默瞎猜'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'✗ 不在选项里'}</span>
      </div>
    </AbsoluteFill>
  );
};

/** 代价卡（p4-14 空窗句）：官方手册如实标注的优化代价——两条计数（`@count`）。 */
const CostCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f5, dist: 28, restBottom: 680});
  const runs = useCount({to: 4, at: at + 6, dur: 26});
  const over = useCount({to: 20, at: at + 14, dur: 26});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          ...e,
          width: 780,
          borderRadius: 14,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: '30px 38px',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 16, letterSpacing: 3, color: theme.dim}}>
          {'OPTIMIZER COST · 官方手册如实标注'}
        </div>
        <div style={{display: 'flex', alignItems: 'stretch', gap: 38, marginTop: 26}}>
          <div style={{flex: 1}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
              <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 76, color: theme.text}}>{'≤ '}{Math.round(runs)}</span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'次'}</span>
            </div>
            <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'每条验证查询 · 至多运行次数'}</div>
          </div>
          <div style={{width: 0, borderLeft: `1.5px solid ${theme.panelBorder}`}} />
          <div style={{flex: 1}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
              <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 76, color: theme.text}}>{'> '}{Math.round(over)}</span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'条'}</span>
            </div>
            <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'受影响查询超过 · 明显拖慢'}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 4-F 列级边逐条入账

/** 列级边逐条入账（p4-15 空窗句）：指标 → 中间表列 → 源表列，派生边逐条描画
 *  （`@draw`，血缘=紫）；边即账本条目。 */
const LineageEdges: React.FC<{at: number}> = ({at}) => {
  const head = useEnter('rise', {at, dur: DUR.f4, dist: 24});
  const d1 = useDraw(at + 10, 18);
  const d2 = useDraw(at + 26, 18);
  const frame = useCurrentFrame();
  const n = (delay: number) => {
    const p = progress(frame, at + delay, DUR.f4);
    return {opacity: p, transform: `translateY(${(1 - p) * 20}px)`};
  };
  const node = (style: React.CSSProperties, kicker: string, title: string, delay: number) => (
    <div
      style={{
        width: 380,
        borderRadius: 12,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panel,
        padding: '16px 22px',
        ...n(delay),
        ...style,
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 14, letterSpacing: 2, color: theme.dim}}>{kicker}</div>
      <div style={{marginTop: 6, fontFamily: theme.sans, fontSize: 29, fontWeight: 600, color: theme.text}}>{title}</div>
    </div>
  );
  const edge = (draw: {pathLength: 1; strokeDasharray: 1; strokeDashoffset: number}, delay: number) => {
    const tip = progress(frame, at + delay + 14, 4);
    const label = progress(frame, at + delay + 6, DUR.f3);
    return (
      <svg width={380} height={84} viewBox="0 0 380 84">
        <line x1={190} y1={6} x2={190} y2={62} stroke={theme.conceptDeep} strokeWidth={2.5} {...draw} />
        <polygon points="182,58 198,58 190,74" fill={theme.conceptDeep} opacity={tip} />
        <text x={206} y={40} fill={theme.dim} fontSize={15} fontFamily={theme.mono} opacity={label}>
          {'SQL · 自动记边'}
        </text>
      </svg>
    );
  };
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...head, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 16, letterSpacing: 4, color: theme.dim}}>{'LINEAGE · 派生关系账本'}</div>
        <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>{'这个数从哪来？'}</div>
        <div style={{marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          {node({borderColor: theme.concept}, 'METRIC', '指标 · 眼前的数', 2)}
          {edge(d1, 10)}
          {node({}, 'TABLE · COLUMN', '中间表 · 列', 16)}
          {edge(d2, 26)}
          {node({}, 'SOURCE · COLUMN', '源表 · 列', 32)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** OpenLineage 角标（开放事件协议）——右下页缘可见，4-F 尾与 4-G 各挂一件成连续。 */
const OpenLineageChip: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        right: 76,
        bottom: 158,
        opacity: o,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        border: `1.5px solid ${withA(theme.conceptDeep, 0.55)}`,
        borderRadius: 8,
        background: theme.panel,
      }}
    >
      <div style={{width: 10, height: 10, borderRadius: 2, border: `2px solid ${theme.conceptDeep}`}} />
      <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.conceptDeep}}>{'OpenLineage'}</span>
      <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'开放事件协议'}</span>
    </div>
  );
};

// ─────────────────────────────────────────────── 4-G 三道闸指示

/** 三道闸指示（左缘页缘可见）：闸门逐道落锁（`@spring`）；p4-18 解析失败整事件拒收
 *  （拒收=拦截侧，ok 绿）。 */
const TriGates: React.FC<{at: number; rejectAt: number}> = ({at, rejectAt}) => {
  const frame = useCurrentFrame();
  const s1 = useSpring('snap', {at: at + 4, dur: DUR.f4});
  const s2 = useSpring('snap', {at: at + 14, dur: DUR.f4});
  const s3 = useSpring('snap', {at: at + 24, dur: DUR.f4});
  const springs = [s1, s2, s3];
  const gates = [
    {t: '鉴权', en: 'AUTH', x: 0},
    {t: '可解析', en: 'PARSEABLE', x: 1},
    {t: '对象可解析', en: 'OBJ · PARSEABLE', x: 2},
  ];
  const capO = progress(frame, at + 38, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 330,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {gates.map((g, i) => {
        const s = springs[i];
        const passed = progress(frame, at + 10 + i * 12, DUR.f3);
        const rejected = i === 1 && frame >= rejectAt;
        return (
          <div
            key={g.en}
            style={{
              width: 264,
              borderRadius: 12,
              border: `1.5px solid ${rejected ? theme.ok : theme.panelBorder}`,
              background: theme.panel,
              padding: '14px 18px',
              opacity: 0.25 + 0.75 * Math.max(passed, s),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* 闸门图标：双柱 + 落杆（snap 弹簧砸落） */}
            <svg width={54} height={44} viewBox="0 0 54 44">
              <line x1={8} y1={6} x2={8} y2={40} stroke={rejected ? theme.ok : theme.conceptDeep} strokeWidth={3} />
              <line x1={46} y1={6} x2={46} y2={40} stroke={rejected ? theme.ok : theme.conceptDeep} strokeWidth={3} />
              <line
                x1={8}
                y1={6}
                x2={46}
                y2={6}
                stroke={rejected ? theme.ok : theme.conceptDeep}
                strokeWidth={4}
                transform={`translate(0, ${(1 - Math.min(1, s)) * -16})`}
                opacity={0.3 + 0.7 * Math.min(1, s)}
              />
            </svg>
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>{g.t}</span>
              <span style={{fontFamily: theme.mono, fontSize: 13, letterSpacing: 1, color: theme.dim}}>{g.en}</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: rejected ? theme.ok : theme.verify,
                  opacity: rejected ? 1 : passed,
                }}
              >
                {rejected ? '✗ 整事件拒收' : '✓ 通过'}
              </span>
            </div>
          </div>
        );
      })}
      <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, opacity: capO}}>{'全过才入账'}</span>
    </div>
  );
};

// ─────────────────────────────────────────────── 4-H 幽灵边呼吸 chip

/** 幽灵边呼吸 chip（页缘可见）：虚构边在账本入口闪烁（`@breathe`，danger 红）。 */
const GhostEdge: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f4);
  const breathe = useBreathe({period: 34, base: 0.45, amp: 0.55});
  return (
    <div style={{position: 'absolute', left: 500, bottom: 156, opacity: o, display: 'flex', alignItems: 'center', gap: 14}}>
      <svg width={150} height={34} viewBox="0 0 150 34">
        <circle cx={14} cy={17} r={7} fill="none" stroke={theme.danger} strokeWidth={2} strokeDasharray="3 3" opacity={0.5 + 0.5 * breathe} />
        <line x1={26} y1={17} x2={118} y2={17} stroke={theme.danger} strokeWidth={2.5} strokeDasharray="7 7" opacity={0.45 + 0.55 * breathe} />
        <circle cx={132} cy={17} r={7} fill="none" stroke={theme.danger} strokeWidth={2} strokeDasharray="3 3" opacity={0.5 + 0.5 * breathe} />
      </svg>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.danger,
          textShadow: `0 0 ${10 * breathe}px ${withA(theme.danger, 0.5 * breathe)}`,
        }}
      >
        {'ghost_edge · 虚构边'}
      </span>
    </div>
  );
};
