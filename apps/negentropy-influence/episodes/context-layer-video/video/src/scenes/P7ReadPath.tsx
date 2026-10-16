/** P7 读管线（p7-01..p7-34，34 句；storyboard v4「P7 读管线」节）。
 *
 *  11 镜 / 29 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   7-A 分析单元（fco-txn@p7-01 + hold@02：算子群→装配事务框定）
 *   7-B 三症状归位（fco-txn@p7-03 特写推进；承 7-A 链尾镜界背靠背 → lead=false）
 *   7-C 七段全貌（rp-open@p7-04 + hold@05/06，承 7-B → lead=false；p7-06 RequestCard
 *       变形 ContextRequest——Morph 卡→窄条→JSON，身份线索描边/圆角/标题位不变；
 *       Morph 窗内 recap 压至 0.12 让位（RecapDim，cue 时序不变））
 *   7-D Resolve（rp-resolve@p7-07 + hold@08/09；SevenStations① + 身份核验/权限上界装置）
 *   7-E Plan（rp-plan@p7-10 + hold@11；SevenStations② + 意图标签/各域预算比例条）
 *   7-F Retrieve（rp-retrieve@p7-12 + hold@13..16；SevenStations③ + 双路并行 + 目录条目卡
 *       自目录列表起飞落入 Retrieve 高亮框〔M-001 同物同形〕@p7-15 + 写读接头缝钢蓝闪@p7-16）
 *   7-G Fuse（rp-fuse@p7-17 + hold@18/19；SevenStations④ + RRF 角标 + 受治理定义行置顶）
 *   7-H Guard（rp-guard@p7-20 + hold@21..24；SevenStations⑤ + 五项检查灯 + 手机号表
 *       可见性/隐私双拒→橙分流进 dropped 盒（只进不改 X-001）+ 留痕记录行）
 *   7-I Compose（rp-compose@p7-25 + hold@26；SevenStations⑥ + 预算条按计划线填充/
 *       超线候选抽出 + 倒 U 小图压角）
 *   7-J Emit（rp-emit@p7-27 + hold@28/29；SevenStations⑦ + ContextBundle 三列展开
 *       uri@version 双标 + 版本号回溯箭头）
 *   7-K 轴归位（SevenStations 全亮回望 + FiveAxisMap 叠放 passedCount=5 + 七段轴色归类
 *       权威橙/供给蓝@p7-31..32 + 首尾对接箭头@p7-30 + 结论@p7-33 + 对账预告@p7-34）
 *  「蓝图·目标态 · 非仓库现状」角标自 p7-05 挂起至 7-J 幕内尾句。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useDraw, useEnter, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {CatalogCard} from '../components/CatalogCard';
import {SEVEN_STATIONS_GEOM, SevenStations} from '../components/SevenStations';
import {FiveAxisMap} from '../components/FiveAxisMap';
import {RequestCard} from '../components/RequestCard';
import {BlueprintTag, CatalogList, CATALOG_ADDRESS} from './P2Asset';

export const P7ReadPath: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p7-01', 'p7-02');
  const bB = w('p7-03');
  const bC = w('p7-04', 'p7-06');
  const bD = w('p7-07', 'p7-09');
  const bE = w('p7-10', 'p7-11');
  const bF = w('p7-12', 'p7-16');
  const bG = w('p7-17', 'p7-19');
  const bH = w('p7-20', 'p7-24');
  const bI = w('p7-25', 'p7-26');
  const bJ = w('p7-27', 'p7-29');
  const bK = w('p7-30', 'p7-34');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P7" tagline="读管线" accent={theme.concept} />
      {/* 「蓝图·目标态 · 非仓库现状」角标：p7-05 起挂起至 7-J 尾句 */}
      <Sequence from={at('p7-05')} durationInFrames={dur('p7-05', 'p7-29')} name="角标-蓝图目标态">
        <BlueprintTag at={0} note="非仓库现状" />
      </Sequence>

      {/* 7-A 分析单元：fco-txn 锚 + hold */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="7-A">
        <ArchifyRecap slug="blueprint--first-class-object" caption="读管线 · 装配事务" cues={[
          {chapterId: 'fco-txn', at: at('p7-01') - bA.from, durationInFrames: dur('p7-01')},
          {chapterId: 'fco-txn', at: at('p7-02') - bA.from, durationInFrames: dur('p7-02'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-B 三症状归位：fco-txn 特写推进（承 7-A 链尾镜界背靠背 → lead=false） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="7-B">
        <ArchifyRecap slug="blueprint--first-class-object" caption="读管线 · 三症状归位" lead={false} cues={[
          {chapterId: 'fco-txn', at: at('p7-03') - bB.from, durationInFrames: dur('p7-03')},
        ]} />
      </Sequence>

      {/* 7-C 七段全貌：rp-open 锚 + hold 链；p7-06 RequestCard → ContextRequest Morph */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="7-C">
        <RecapDim from={at('p7-06') - bC.from} dur={dur('p7-06')}>
          <ArchifyRecap slug="read-pipeline" caption="读管线 · 七段全貌" lead={false} cues={[
            {chapterId: 'rp-open', at: at('p7-04') - bC.from, durationInFrames: dur('p7-04')},
            {chapterId: 'rp-open', at: at('p7-05') - bC.from, durationInFrames: dur('p7-05'), fit: 'hold'},
            {chapterId: 'rp-open', at: at('p7-06') - bC.from, durationInFrames: dur('p7-06'), fit: 'hold'},
          ]} />
        </RecapDim>
        <Sequence from={at('p7-06') - bC.from} durationInFrames={dur('p7-06')} name="7-C-Morph">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <RequestCard mode="request" at={8} />
          </AbsoluteFill>
        </Sequence>
      </Sequence>

      {/* 7-D Resolve：站点① + 身份核验/权限上界（recap 后置遮盖） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="7-D">
        <SevenStations at={at('p7-07') - bD.from} station={1} />
        <ResolveStage
          a07={at('p7-07') - bD.from}
          a08={at('p7-08') - bD.from}
          a09={at('p7-09') - bD.from}
        />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ① Resolve" lead={false} cues={[
          {chapterId: 'rp-resolve', at: at('p7-07') - bD.from, durationInFrames: dur('p7-07')},
          {chapterId: 'rp-resolve', at: at('p7-08') - bD.from, durationInFrames: dur('p7-08'), fit: 'hold'},
          {chapterId: 'rp-resolve', at: at('p7-09') - bD.from, durationInFrames: dur('p7-09'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-E Plan：站点② + 意图/各域预算（recap 后置遮盖） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="7-E">
        <SevenStations at={at('p7-10') - bE.from} station={2} />
        <PlanStage a10={at('p7-10') - bE.from} a11={at('p7-11') - bE.from} />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ② Plan" lead={false} cues={[
          {chapterId: 'rp-plan', at: at('p7-10') - bE.from, durationInFrames: dur('p7-10')},
          {chapterId: 'rp-plan', at: at('p7-11') - bE.from, durationInFrames: dur('p7-11'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-F Retrieve：站点③ + 双路并行 + 目录条目卡接头飞行（recap 后置遮盖） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="7-F">
        <SevenStations at={at('p7-12') - bF.from} station={3} />
        <DualRetrieve
          a12={at('p7-12') - bF.from}
          a13={at('p7-13') - bF.from}
          a14={at('p7-14') - bF.from}
          a15={at('p7-15') - bF.from}
          a16={at('p7-16') - bF.from}
        />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ③ Retrieve" lead={false} cues={[
          {chapterId: 'rp-retrieve', at: at('p7-12') - bF.from, durationInFrames: dur('p7-12')},
          {chapterId: 'rp-retrieve', at: at('p7-13') - bF.from, durationInFrames: dur('p7-13'), fit: 'hold'},
          {chapterId: 'rp-retrieve', at: at('p7-14') - bF.from, durationInFrames: dur('p7-14'), fit: 'hold'},
          {chapterId: 'rp-retrieve', at: at('p7-15') - bF.from, durationInFrames: dur('p7-15'), fit: 'hold'},
          {chapterId: 'rp-retrieve', at: at('p7-16') - bF.from, durationInFrames: dur('p7-16'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-G Fuse：站点④ + RRF/信任重排 + 受治理行置顶（recap 后置遮盖） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="7-G">
        <SevenStations at={at('p7-17') - bG.from} station={4} />
        <FuseStage a17={at('p7-17') - bG.from} a18={at('p7-18') - bG.from} a19={at('p7-19') - bG.from} />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ④ Fuse" lead={false} cues={[
          {chapterId: 'rp-fuse', at: at('p7-17') - bG.from, durationInFrames: dur('p7-17')},
          {chapterId: 'rp-fuse', at: at('p7-18') - bG.from, durationInFrames: dur('p7-18'), fit: 'hold'},
          {chapterId: 'rp-fuse', at: at('p7-19') - bG.from, durationInFrames: dur('p7-19'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-H Guard：站点⑤ + 五项检查灯 + 双拒分流 dropped（recap 后置遮盖） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="7-H">
        <SevenStations at={at('p7-20') - bH.from} station={5} />
        <GuardStage
          a20={at('p7-20') - bH.from}
          a21={at('p7-21') - bH.from}
          a22={at('p7-22') - bH.from}
          a23={at('p7-23') - bH.from}
          a24={at('p7-24') - bH.from}
        />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ⑤ Guard" lead={false} cues={[
          {chapterId: 'rp-guard', at: at('p7-20') - bH.from, durationInFrames: dur('p7-20')},
          {chapterId: 'rp-guard', at: at('p7-21') - bH.from, durationInFrames: dur('p7-21'), fit: 'hold'},
          {chapterId: 'rp-guard', at: at('p7-22') - bH.from, durationInFrames: dur('p7-22'), fit: 'hold'},
          {chapterId: 'rp-guard', at: at('p7-23') - bH.from, durationInFrames: dur('p7-23'), fit: 'hold'},
          {chapterId: 'rp-guard', at: at('p7-24') - bH.from, durationInFrames: dur('p7-24'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-I Compose：站点⑥ + 预算条裁剪 + 倒 U 压角（recap 后置遮盖） */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="7-I">
        <SevenStations at={at('p7-25') - bI.from} station={6} />
        <ComposeStage a25={at('p7-25') - bI.from} a26={at('p7-26') - bI.from} />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ⑥ Compose" lead={false} cues={[
          {chapterId: 'rp-compose', at: at('p7-25') - bI.from, durationInFrames: dur('p7-25')},
          {chapterId: 'rp-compose', at: at('p7-26') - bI.from, durationInFrames: dur('p7-26'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-J Emit：站点⑦ + ContextBundle 三列 uri@version + 版本回溯（recap 后置遮盖） */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="7-J">
        <SevenStations at={at('p7-27') - bJ.from} station={7} />
        <EmitStage a27={at('p7-27') - bJ.from} a28={at('p7-28') - bJ.from} a29={at('p7-29') - bJ.from} />
        <ArchifyRecap slug="read-pipeline" caption="读管线 · ⑦ Emit" lead={false} cues={[
          {chapterId: 'rp-emit', at: at('p7-27') - bJ.from, durationInFrames: dur('p7-27')},
          {chapterId: 'rp-emit', at: at('p7-28') - bJ.from, durationInFrames: dur('p7-28'), fit: 'hold'},
          {chapterId: 'rp-emit', at: at('p7-29') - bJ.from, durationInFrames: dur('p7-29'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 7-K 轴归位：SevenStations 全亮 + FiveAxisMap 叠放 + 轴色归类 + 首尾对接 */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="7-K">
        <RecapSeven
          a30={at('p7-30') - bK.from}
          a31={at('p7-31') - bK.from}
          a32={at('p7-32') - bK.from}
          a33={at('p7-33') - bK.from}
          a34={at('p7-34') - bK.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** recap 让位包装（7-C Morph 专用）：Morph 窗内图回放压到 0.12（装置全屏可读），
 *  窗外满亮——纯 effects 通道（铁律③），cue 时序不受影响，仅显示层让位。 */
const RecapDim: React.FC<{from: number; dur: number; children: React.ReactNode}> = ({from, dur, children}) => {
  const frame = useCurrentFrame();
  const cover = progress(frame, from, 10) * (1 - progress(frame, from + dur - 12, 12));
  return <AbsoluteFill style={{opacity: 1 - 0.88 * clamp01(cover)}}>{children}</AbsoluteFill>;
};

/** 7-D 解析主体：核出运营专员 + 域可见双检 + 会话权限上界实时求值。 */
const ResolveStage: React.FC<{a07: number; a08: number; a09: number}> = ({a07, a08, a09}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(a07, 10);
  const chips = useStagger(2, {stride: 8, at: a08});
  const ceil = useProgress(a09, 12);
  const ceilFlash = useImpulse({at: a09 + 6, dur: 20, peak: 0.8});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 510,
          top: 210,
          width: 900,
          height: 320,
          borderRadius: 12,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: 24,
          boxSizing: 'border-box',
          opacity: enter,
        }}
      >
        <div style={{fontSize: 20, color: theme.dim}}>第 1 段 Resolve · 解析主体</div>
        <div style={{marginTop: 18, fontFamily: theme.mono, fontSize: 22, color: theme.concept}}>
          asker ＝ 运营专员 ✓
        </div>
        {/* 域可见双检 */}
        <div style={{display: 'flex', gap: 20, marginTop: 26}}>
          {[
            {t: '订单域 · 可见', ok: true},
            {t: '薪资域 · 不可见', ok: false},
          ].map((d, i) => (
            <span
              key={d.t}
              style={{
                fontSize: 21,
                color: d.ok ? theme.ok : theme.conceptDeep,
                border: `1.5px solid ${d.ok ? theme.ok : theme.conceptDeep}`,
                borderRadius: 8,
                padding: '8px 20px',
                background: theme.bg,
                opacity: chips[i],
              }}
            >
              {d.t} {d.ok ? '✓' : '✗'}
            </span>
          ))}
        </div>
        {/* 会话权限上界（实时求值） */}
        <div style={{marginTop: 30, opacity: ceil}}>
          <div style={{height: 14, borderRadius: 7, background: withAlpha(theme.conceptDeep, 0.25), border: `1.5px solid ${theme.conceptDeep}`, boxShadow: `0 0 ${12 * ceilFlash}px ${withAlpha(theme.conceptDeep, 0.6)}`}} />
          <div style={{marginTop: 10, fontSize: 16, color: theme.conceptDeep}}>会话权限上界 · 实时求值</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 7-E 定计划：意图标签 + 各域预算比例条（定义与核准查询多、知识文档少给）。 */
const PlanStage: React.FC<{a10: number; a11: number}> = ({a10, a11}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(a10, 10);
  const segs = useStagger(3, {stride: 8, at: a11});
  const segDef = [
    {t: '定义 · 核准查询', w: 400, c: theme.concept},
    {t: '会话', w: 150, c: theme.panelBorder},
    {t: '知识文档', w: 130, c: theme.panelBorder},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 220,
          width: 800,
          height: 320,
          borderRadius: 12,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: enter,
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontSize: 20, color: theme.dim}}>第 2 段 Plan · 定计划</div>
        <div style={{marginTop: 20, fontSize: 22, color: theme.text, border: `1.5px solid ${theme.concept}`, borderRadius: 8, padding: '10px 18px', background: theme.bg, display: 'inline-block'}}>
          意图 · 查一个指标的数
        </div>
        <div style={{marginTop: 30, fontSize: 17, color: theme.dim}}>各域 token 预算</div>
        <div style={{marginTop: 10, display: 'flex', width: 700, height: 52, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${theme.panelBorder}`}}>
          {segDef.map((s, i) => (
            <div
              key={s.t}
              style={{
                width: segs[i] * s.w,
                background: withAlpha(s.c, s.c === theme.concept ? 0.35 : 0.18),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: i === 0 ? theme.concept : theme.dim,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {segs[i] > 0.6 ? s.t : ''}
            </div>
          ))}
        </div>
        <div style={{marginTop: 14, fontSize: 15, color: theme.dim, opacity: segs[2]}}>预算主要给定义和核准查询 · 知识文档少给</div>
      </div>
    </AbsoluteFill>
  );
};

/** 7-F 取候选：精确路（题库命中）+ 召回路（150→重排→20）双路并行；目录条目卡自目录
 *  列表起飞落入 Retrieve 高亮框（与 2-G 产出的卡同物同形）；p7-16 写读接头缝钢蓝闪。 */
const RETRIEVE = {x: 870, y: 330, w: 180, h: 110} as const;
/** 目录列表（style 摆位 top 250）首槽中心：面板 14 padding + 表头 ~28 + 首行槽半高。 */
const LIST_SLOT = {x: 1549, y: 344} as const;

const DualRetrieve: React.FC<{a12: number; a13: number; a14: number; a15: number; a16: number}> = ({a12, a13, a14, a15, a16}) => {
  const frame = useCurrentFrame();
  const flow = useFlowDash({dash: 8, gap: 11, period: 26});
  const frameIn = useProgress(a12, 10);
  const hit = clamp01(progress(frame, a13, 14));
  const recall = clamp01(progress(frame, a14, 16));
  const fly = useSpring('settle', {at: a15, dur: 32});
  const landed = clamp01(progress(frame, a15 + 34, 5));
  const stampFlash = useImpulse({at: a15 + 32, dur: 18});
  const seamFlash = useImpulse({at: a16, dur: 26});
  const seamIn = clamp01(progress(frame, a16, 10));
  const fx = LIST_SLOT.x + (RETRIEVE.x + RETRIEVE.w / 2 - LIST_SLOT.x) * fly;
  const fy = LIST_SLOT.y + (RETRIEVE.y + RETRIEVE.h / 2 - LIST_SLOT.y) * fly - Math.sin(Math.PI * fly) * 110;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: frameIn}}>
      {/* 精确路：题库命中 */}
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 250,
          width: 190,
          height: 128,
          borderRadius: 9,
          border: `2px solid ${hit > 0.3 ? theme.ok : theme.panelBorder}`,
          background: theme.panel,
          opacity: hit,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>题库 · 精确路</span>
        <span style={{fontSize: 18, color: theme.ok}}>重复购买率 · 命中</span>
      </div>
      {/* 召回路：150 候选 → 重排 → 前 20 */}
      <div style={{position: 'absolute', left: 1250, top: 236, opacity: recall}}>
        {Array.from({length: 10}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: (i % 5) * 44,
              top: Math.floor(i / 5) * 56,
              width: 36,
              height: 48,
              borderRadius: 5,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: 0.85,
              transform: `scale(${1 - 0.25 * recall})`,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: -130,
            top: 116,
            fontSize: 16,
            color: theme.dim,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 7,
            padding: '4px 12px',
            background: theme.panel,
            whiteSpace: 'nowrap',
          }}
        >
          150 候选 · 重排截前 20
        </div>
      </div>
      {/* 汇流连线（行进虚线） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <path d={`M 528 314 C 660 314, 720 385, ${RETRIEVE.x - 4} 385`} fill="none" stroke={theme.ok} strokeWidth={2.5} opacity={hit} strokeDasharray="9 11" />
        <path d={`M 528 314 C 660 314, 720 385, ${RETRIEVE.x - 4} 385`} fill="none" stroke={theme.ok} strokeWidth={2.5} opacity={hit} {...flow} />
        <path d={`M 1244 300 C 1160 330, 1130 385, ${RETRIEVE.x + RETRIEVE.w + 4} 385`} fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={recall} strokeDasharray="9 11" />
        <path d={`M 1244 300 C 1160 330, 1130 385, ${RETRIEVE.x + RETRIEVE.w + 4} 385`} fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={recall} {...flow} />
      </svg>
      {/* Retrieve 高亮框 */}
      <div
        style={{
          position: 'absolute',
          left: RETRIEVE.x,
          top: RETRIEVE.y,
          width: RETRIEVE.w,
          height: RETRIEVE.h,
          borderRadius: 10,
          border: `2.5px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.concept,
          boxShadow: `0 0 ${10 + 16 * stampFlash}px ${withAlpha(theme.concept, 0.5)}`,
        }}
      >
        Retrieve
      </div>
      {/* 目录列表（2-G 接头锚的落点）+ 起飞脉冲 */}
      <CatalogList count={1} at={a12 - 30} style={{left: 1470, top: 250}} />
      <div
        style={{
          position: 'absolute',
          left: LIST_SLOT.x - 26,
          top: LIST_SLOT.y - 26,
          width: 52,
          height: 52,
          borderRadius: 30,
          border: `2px solid ${theme.concept}`,
          opacity: (1 - fly) * clamp01(progress(frame, a15 - 12, 8)),
          transform: `scale(${0.6 + fly * 0.8})`,
        }}
      />
      {/* 飞行中的目录条目卡（同物同形） */}
      <div style={{position: 'absolute', left: fx - 118, top: fy - 74, opacity: clamp01(fly) * (1 - landed)}}>
        <CatalogCard address={CATALOG_ADDRESS} />
      </div>
      {/* 落位盖章闪光 */}
      <div
        style={{
          position: 'absolute',
          left: RETRIEVE.x + RETRIEVE.w / 2 - 28,
          top: RETRIEVE.y + 12,
          opacity: (1 - landed * 0.4) * stampFlash,
          transform: `rotate(-10deg) scale(${1 + 0.4 * stampFlash})`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 12,
            border: `3px solid ${theme.ok}`,
            color: theme.ok,
            fontSize: 26,
            background: withAlpha(theme.ok, 0.14),
          }}
        >
          ✓
        </span>
      </div>
      {/* p7-16 写读接头缝钢蓝闪 */}
      <div style={{position: 'absolute', inset: 0, opacity: seamIn}}>
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          <line x1={960} y1={150} x2={960} y2={560} stroke={theme.concept} strokeWidth={2.5} strokeDasharray="10 9" opacity={0.4 + 0.6 * seamFlash} />
        </svg>
        <span style={{position: 'absolute', left: 876, top: 562, fontSize: 17, color: theme.concept, opacity: 0.5 + 0.5 * seamFlash}}>写 · 入册</span>
        <span style={{position: 'absolute', left: 988, top: 562, fontSize: 17, color: theme.concept, opacity: 0.5 + 0.5 * seamFlash}}>读 · 取用</span>
      </div>
    </AbsoluteFill>
  );
};

/** 7-G 融合重排：RRF 角标 + 按排名合成/信任重排 + 受治理定义行升至首位。 */
const FuseStage: React.FC<{a17: number; a18: number; a19: number}> = ({a17, a18, a19}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(a17, 10);
  const tagIn = clamp01(progress(frame, a18, 10));
  const swap = useSpring('settle', {at: a19, dur: 24});
  const rows = [
    {t: '受治理 · definitions「重复购买率」', hot: true},
    {t: '推断口径 · 会话里的说法', hot: false},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 560, top: 200, width: 800, height: 360, borderRadius: 12, border: `1.5px solid ${theme.panelBorder}`, background: theme.panel, padding: 24, boxSizing: 'border-box', opacity: enter}}>
        <div style={{fontSize: 20, color: theme.dim}}>第 4 段 Fuse · 融合重排</div>
        <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18}}>
          {rows.map((r, i) => {
            // 换位：受治理行升至首位（i=0 起点在下、换到上）
            const slotY = (i === 0 ? 1 - swap : i === 1 ? swap : 0) * 84;
            const y = 70 + slotY;
            return (
              <div
                key={r.t}
                style={{
                  position: 'absolute',
                  left: 24,
                  right: 24,
                  top: y,
                  height: 66,
                  borderRadius: 9,
                  border: `2px solid ${r.hot ? theme.concept : theme.panelBorder}`,
                  background: r.hot ? withAlpha(theme.concept, 0.1) : theme.bg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 20px',
                  boxSizing: 'border-box',
                  opacity: 0.55 + 0.45 * (i === 0 ? swap : 1 - swap * 0.2),
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, width: 60}}>#{i === 0 ? Math.round(1 + (1 - swap)) : Math.round(2 - swap)}</span>
                <span style={{fontSize: 20, color: r.hot ? theme.concept : theme.dim}}>{r.t}</span>
              </div>
            );
          })}
        </div>
        <div style={{position: 'absolute', left: 24, bottom: 18, display: 'flex', gap: 14}}>
          <span style={{fontSize: 16, color: theme.concept, border: `1.5px solid ${theme.concept}`, borderRadius: 6, padding: '3px 12px', background: theme.bg, opacity: tagIn}}>
            RRF · 按排名合成
          </span>
          <span style={{fontSize: 16, color: theme.dim, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 6, padding: '3px 12px', background: theme.bg, opacity: tagIn}}>
            再按信任分重排
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 7-H 检查拦截：五项检查灯 + 手机号表可见性/隐私双拒 → 橙分流进 dropped（只进不改，
 *  X-001 核对：落盒条目常驻、只进不改）+ 留痕记录行。 */
const GUARD_LAMPS = ['看得见吗', '在作用域内吗', '还有效吗', '涉个人隐私吗', '夹带指令吗'] as const;

const GuardStage: React.FC<{a20: number; a21: number; a22: number; a23: number; a24: number}> = ({a20, a21, a22, a23, a24}) => {
  const frame = useCurrentFrame();
  const frameIn = useProgress(a20, 8);
  const checks = useStagger(5, {stride: 6, at: a21});
  const reject = clamp01(progress(frame, a23, 8));
  const candIn = clamp01(progress(frame, a22, 10));
  const divert = clamp01(progress(frame, a23 + 10, 20));
  const caught = clamp01(progress(frame, a23 + 26, 8));
  const rows = useStagger(3, {stride: 9, at: a24});
  const boxC = {
    x: SEVEN_STATIONS_GEOM.dropped.x + SEVEN_STATIONS_GEOM.dropped.w / 2,
    y: SEVEN_STATIONS_GEOM.dropped.y + SEVEN_STATIONS_GEOM.dropped.h / 2,
  };
  // 拦截飞行：候选卡自 (1500,300) 沿弧线进 dropped 盒（几何取 SevenStations SSOT）
  const cx = 1500 + (boxC.x - 1500) * divert;
  const cy = 300 + (boxC.y - 300) * divert - Math.sin(Math.PI * divert) * 60;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: frameIn}}>
      {GUARD_LAMPS.map((t, i) => {
        const bad = (i === 0 || i === 3) && reject > 0.3;
        const on = i === 0 || i === 3 ? Math.max(checks[i], reject) : checks[i];
        return (
          <div key={t} style={{position: 'absolute', left: 385 + i * 225, top: 220, width: 190, opacity: checks[i] > 0 ? 1 : 0, textAlign: 'center'}}>
            <svg width={64} height={76} style={{display: 'block', margin: '0 auto'}}>
              <line x1={32} y1={0} x2={32} y2={16} stroke={theme.panelBorder} strokeWidth={3} />
              <circle
                cx={32}
                cy={40}
                r={22}
                fill={on > 0.3 ? withAlpha(bad ? theme.conceptDeep : theme.ok, 0.2) : 'transparent'}
                stroke={on > 0.3 ? (bad ? theme.conceptDeep : theme.ok) : theme.panelBorder}
                strokeWidth={3}
                opacity={0.45 + 0.55 * on}
              />
              {on > 0.5 ? (
                <text x={32} y={47} textAnchor="middle" fontSize={20} fill={bad ? theme.conceptDeep : theme.ok}>
                  {bad ? '✗' : '✓'}
                </text>
              ) : null}
            </svg>
            <div style={{fontSize: 17, color: bad ? theme.conceptDeep : theme.text, marginTop: 8}}>{t}</div>
          </div>
        );
      })}
      {/* 被拦候选：客户手机号表 → 橙分流道 → dropped 盒 */}
      <div
        style={{
          position: 'absolute',
          left: cx - 95,
          top: cy - 35,
          width: 190,
          height: 70,
          borderRadius: 8,
          border: `2px solid ${theme.conceptDeep}`,
          background: theme.panel,
          color: theme.conceptDeep,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: candIn * (1 - caught * 0.9),
          zIndex: 3,
        }}
      >
        客户手机号表
      </div>
      {/* 落盒定格条目（只进不改：落盒后常驻盒内，X-001） */}
      <div
        style={{
          position: 'absolute',
          left: boxC.x - 88,
          top: boxC.y - 16,
          width: 176,
          height: 32,
          borderRadius: 6,
          border: `1.5px solid ${theme.conceptDeep}`,
          color: theme.conceptDeep,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.panel,
          opacity: caught,
        }}
      >
        手机号表 · 1 条
      </div>
      {/* 留痕记录（何时/拦了什么/为什么） */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 330,
          width: 380,
          borderRadius: 10,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: '14px 20px',
          boxSizing: 'border-box',
          opacity: frameIn,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>dropped · 留痕记录</div>
        {['何时 · 本轮装配事务', '拦了 · 客户手机号表', '为何 · 可见性 + 隐私'].map((t, i) => (
          <div key={t} style={{fontSize: 18, color: theme.text, lineHeight: 2, opacity: rows[i]}}>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 7-I 裁剪：窗口 token 预算条按计划线填充、超线候选项依序抽出 + 倒 U 小图压角。 */
const ComposeStage: React.FC<{a25: number; a26: number}> = ({a25, a26}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(a25, 10);
  const fill = clamp01(progress(frame, a25 + 6, 26));
  const pull1 = clamp01(progress(frame, a25 + 26, 12));
  const pull2 = clamp01(progress(frame, a25 + 34, 12));
  const pulse = useImpulse({at: a26, dur: 24, peak: 1});
  const iconIn = clamp01(progress(frame, a26, 10));
  const rows = [
    {t: '重复购买率 · definitions', keep: true},
    {t: '核准查询 · 题库命中', keep: true},
    {t: '留存分析 · 不相干', keep: false, pull: pull1},
    {t: '订单明细 · 仅引用', keep: true},
    {t: '季度报表说明', keep: false, pull: pull2},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 560, top: 210, width: 800, height: 400, borderRadius: 12, border: `1.5px solid ${theme.panelBorder}`, background: theme.panel, padding: 24, boxSizing: 'border-box', opacity: enter}}>
        <div style={{fontSize: 20, color: theme.dim}}>第 6 段 Compose · 裁剪</div>
        {/* 预算条：填到计划线即止 */}
        <div style={{marginTop: 18, fontSize: 15, color: theme.dim}}>窗口 token 预算 · 计划线</div>
        <div style={{position: 'relative', marginTop: 8, height: 26, borderRadius: 7, border: `1.5px solid ${theme.panelBorder}`, background: theme.bg, overflow: 'hidden'}}>
          <div style={{width: `${fill * 84}%`, height: '100%', background: withAlpha(theme.concept, 0.5)}} />
          <div style={{position: 'absolute', left: '84%', top: 0, bottom: 0, width: 2.5, background: theme.conceptDeep}} />
        </div>
        {/* 候选行：超线依序抽出 */}
        <div style={{marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12}}>
          {rows.map((r, i) => {
            const pulled = r.pull ?? 0;
            return (
              <div
                key={r.t}
                style={{
                  height: 40,
                  borderRadius: 7,
                  border: `1.5px solid ${pulled > 0 ? theme.conceptDeep : theme.panelBorder}`,
                  background: r.keep ? theme.bg : theme.panel,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 16px',
                  fontSize: 17,
                  color: pulled > 0 ? theme.conceptDeep : theme.dim,
                  transform: `translateX(${pulled * 260}px)`,
                  opacity: (r.keep ? 0.95 : 0.8) * (1 - pulled * 0.85),
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{String(i + 1).padStart(2, '0')}</span>
                {r.t}
                {pulled > 0.4 ? <span style={{marginLeft: 'auto', fontSize: 14, color: theme.conceptDeep}}>超线 · 抽出</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* 倒 U 小图压角（硬约束在此段执行；脉冲走描边宽度，不引 blur 类滤镜） */}
      <div style={{position: 'absolute', left: 1420, top: 660, display: 'flex', alignItems: 'center', gap: 14, opacity: iconIn}}>
        <svg width={110} height={64}>
          <path d="M 6 54 Q 34 12 55 14 Q 84 18 104 50" fill="none" stroke={theme.conceptDeep} strokeWidth={3 + 2 * pulse} strokeLinecap="round" />
          <line x1={55} y1={8} x2={55} y2={58} stroke={theme.dim} strokeWidth={1.5} strokeDasharray="6 4" />
        </svg>
        <span style={{fontSize: 17, color: theme.conceptDeep, border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 7, padding: '5px 14px', background: theme.panel, boxShadow: `0 0 ${10 * pulse}px ${withAlpha(theme.conceptDeep, 0.6)}`}}>
          倒 U · 在此段执行
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 7-J 组装交付：ContextBundle 三列展开（每项 uri@version 双标）+ 版本号回溯箭头。 */
const EmitStage: React.FC<{a27: number; a28: number; a29: number}> = ({a27, a28, a29}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(a27, 10);
  const cols = useStagger(3, {stride: 10, at: a28});
  const back = useDraw(a29, 24);
  const COLS = [
    {t: '定义', uri: 'ctx://kb/metric/repurchase-rate@v1'},
    {t: '核准查询', uri: 'ctx://qa/repurchase-rate@v1'},
    {t: '订单表地址', uri: 'ctx://tbl/orders@v3'},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 660, top: 230, width: 600, height: 360, borderRadius: 12, border: `2.5px solid ${theme.concept}`, background: withAlpha(theme.concept, 0.08), padding: 24, boxSizing: 'border-box', opacity: enter}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.concept}}>ContextBundle</div>
        <div style={{marginTop: 22, display: 'flex', flexDirection: 'column', gap: 18}}>
          {COLS.map((c, i) => (
            <div key={c.t} style={{borderRadius: 9, border: `1.5px solid ${theme.panelBorder}`, background: theme.bg, padding: '12px 18px', opacity: cols[i], transform: `translateX(${(1 - cols[i]) * -20}px)`}}>
              <div style={{fontSize: 20, color: theme.text}}>{c.t}</div>
              <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.concept, marginTop: 6}}>{c.uri}</div>
            </div>
          ))}
        </div>
      </div>
      {/* 版本号回溯箭头：答案出问题能顺着查到哪一版定义 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: clamp01(1 - back.strokeDashoffset)}}>
        <path d="M 760 560 C 620 560, 560 500, 600 430" fill="none" stroke={theme.ok} strokeWidth={2.5} {...back} />
      </svg>
      <div style={{position: 'absolute', left: 380, top: 380, fontSize: 17, color: theme.ok, opacity: clamp01(1 - back.strokeDashoffset) * clamp01(progress(frame, a29 + 12, 8))}}>
        顺着版本号 · 查到是哪一版定义
      </div>
    </AbsoluteFill>
  );
};

/** 7-K 轴归位：全轨回望 + FiveAxisMap 叠放 + 七段轴色归类 + 首尾对接 + 结论 + 预告。 */
const AXIS_TAGS = ['权威', '装配', '检索', '检索', '权威', '装配', '装配'] as const;

const RecapSeven: React.FC<{a30: number; a31: number; a32: number; a33: number; a34: number}> = ({a30, a31, a32, a33, a34}) => {
  const frame = useCurrentFrame();
  // 横轨稳态回望：at 预锚 -70（入场+落章早已完成）——七段全亮是「状态」非「动作」
  const arrow = useDraw(a30, 24);
  const outIn = clamp01(progress(frame, a30 + 10, 12));
  const tagsA = useStagger(4, {stride: 7, at: a31});
  const tagsB = useStagger(3, {stride: 7, at: a32});
  const assetTag = useProgress(a32 + 14, 10);
  const conclusion = useEnter('rise', {at: a33, dur: 16});
  const preview = useProgress(a34, 10);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* FiveAxisMap 叠放（上）+ SevenStations 全亮（下） */}
      <FiveAxisMap built passedCount={5} at={0} />
      <SevenStations at={-70} station={7} />
      {/* 首尾对接：问题从左端进、带地址与版本的上下文包从右端出 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <g opacity={clamp01(progress(frame, a30, 10))}>
          <line x1={30} y1={679} x2={70} y2={679} stroke={theme.concept} strokeWidth={3} />
          <path d="M 70 672 L 84 679 L 70 686 Z" fill={theme.concept} />
          <text x={26} y={650} fill={theme.dim} fontSize={16}>问题</text>
        </g>
        <g>
          <path
            d="M 1808 679 C 1836 679, 1848 500, 1810 452"
            fill="none"
            stroke={theme.concept}
            strokeWidth={2.5}
            strokeLinecap="round"
            {...arrow}
          />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1590,
          top: 380,
          width: 300,
          height: 62,
          borderRadius: 9,
          border: `2px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.12),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.concept,
          opacity: outIn,
        }}
      >
        <span>ContextBundle</span>
        <span style={{fontSize: 12, color: theme.dim}}>uri@version</span>
      </div>
      {/* 七段轴色归类：权威橙 / 供给主轴钢蓝 */}
      {AXIS_TAGS.map((t, i) => {
        const k = i < 4 ? tagsA[i] : tagsB[i - 4];
        const auth = t === '权威';
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: SEVEN_STATIONS_GEOM.centers[i] - 52,
              top: 748,
              width: 104,
              height: 34,
              borderRadius: 7,
              border: `1.5px solid ${auth ? theme.conceptDeep : theme.concept}`,
              color: auth ? theme.conceptDeep : theme.concept,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              opacity: k,
              transform: `translateY(${(1 - k) * 10}px)`,
            }}
          >
            {t}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 1590,
          top: 748,
          width: 220,
          height: 34,
          borderRadius: 7,
          border: `1.5px dashed ${theme.concept}`,
          color: theme.concept,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          opacity: assetTag,
        }}
      >
        目录条目 · 资产轴
      </div>
      {/* 结论 + 对账预告 */}
      <div
        style={{
          ...conclusion,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 460,
          textAlign: 'center',
          fontSize: 30,
          color: theme.text,
          letterSpacing: 2,
        }}
      >
        ContextRequest → ContextBundle
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 170, display: 'flex', justifyContent: 'center', opacity: preview}}>
        <span style={{padding: '8px 26px', border: `1.5px solid ${theme.concept}`, borderRadius: 8, fontSize: 21, color: theme.concept, background: theme.panel, letterSpacing: 2}}>
          下一幕 · 逐条对账
        </span>
      </div>
    </AbsoluteFill>
  );
};
