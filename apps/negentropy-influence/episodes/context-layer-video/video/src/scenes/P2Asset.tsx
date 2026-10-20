/** P2 资产轴（p2-01..p2-40 含 03b/c、07b、08b、29b、36b/c、37b..d，50 句；
 *  storyboard v5「P2 资产轴」节）。
 *
 *  15 镜 / 16 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   2-A 开轴（FiveAxisMap highlight=asset 幕首重锚 + 七类资产卡入列@p2-02..03，
 *       每卡带「固定地址 · 带出处 · 带权限」三小标 + p2-03b/c 技能目录/知识库白话小卡）
 *   2-B 请求连五类（装置：RequestCard〔M-001〕连出五线到资产卡@p2-05..07 + 卡缘
 *       「已动用」小签累积 + p2-07b 技能目录/知识库灰置卡待亮）
 *   2-C ig-open@p2-08 + hold@08b + ig-ingest@p2-09 + hold@10。**取舍（简报「反过来」）**：
 *       纳管走查 narration 与 ig-* 章图解逐句对应（八图已随 v7 字重渲），archify 章是
 *       讲解主体 → 自研登记装置删除、recap 全亮为画面主体；p2-08b「目录＝引用层」
 *       标牌缩为画框外右带补注。「蓝图·目标态」角标自 p2-08 挂起至 2-G
 *   2-D ig-normalize@p2-11 + hold@12（同上取舍：归一装置删除；「归一不调用 LLM」
 *       角标缩为画框外左带补注@p2-12；承 2-C 链尾背靠背 → lead=false）
 *   2-E ig-classify@p2-13（同上取舍：分类装置删除；lead=false）
 *   2-F ig-tier@p2-14 + hold@15（同上取舍：分级装置删除；lead=false）
 *   2-G ig-tag@p2-16 + hold@17/18（半反过来：p2-16 章图全亮承「打标/向量/地址」；
 *       p2-17 起压暗暗底，CatalogCard 弹出→飞落目录列表——全片接头锚〔M-001 同物
 *       同形〕移到 recap 之后 z 序在上；RecapDimSpan 泛化；lead=false）
 *   2-H 口径纪律（装置：算什么/按什么次序算双栏卡 + 「口径只存一份 · 用时现算」章
 *       + 实验预告槽）
 *   2-I fan trap 破坏实验（消融对照：¥100 订单 ×3 事件先连后聚 → ¥300、整月 200/440
 *       对撞 + 实心徽 + 「查询语法完全合法」对勾常亮）
 *   2-J 正确次序（先聚后连回 ¥200 绿 + 回扣条@p2-26）
 *   2-K lmm-seam@p2-27 + hold@28（跨轴组合；M1 角标走画框外左余量）
 *   2-L 代码走廊①（CodePane：definitions 表四类定义 + 校验 422 + 实心徽 + p2-29b
 *       422 回扣行「重复购买率 · 汇总式缺失 → 注册即拒（目标态）」 + 渲染产物
 *       投影箭头@p2-32）
 *   2-M 常驻块三问（Core Block 挂窗口顶部 + 示例行写入@p2-34 + 三问标签@p2-35）
 *   2-N 写入纪律（三条写入路径＝代理工具自写/管理端修改/尾部追加@p2-36..36b +
 *       「先扫描 · 后自编」时序小标@p2-36c + 防注入扫描@p2-37 + 注入样例试写入
 *       被拦@p2-37b + 两级预算第一级「记忆 ≤ 30% 硬帽（装配侧）」角标@p2-37c +
 *       「对账见 P8」钩子标@p2-37d + 2048 单块封顶截断标记@p2-38）
 *   2-O ol-gov@p2-39 + hold@40（三标签收束前景 + FiveAxisMap 推进 passedCount=1
 *       权威轴待亮转场）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useEnter, useFlowDash, useImpulse, useProgress, usePushIn, useReveal, useSpring, useStagger} from '../motion';
import {Counter, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {CatalogCard} from '../components/CatalogCard';
import {FiveAxisMap} from '../components/FiveAxisMap';
import {RequestCard} from '../components/RequestCard';

/** recap 让位包装（RecapDim 泛化，承 P7ReadPath 同形 helper）：from 句界起 10 帧缓暗、
 *  to 句界止 12 帧缓回（纯 effects 通道·铁律③，禁弹簧）——首句满亮、其余句画框压至
 *  0.16 作装置暗底；cue 时序不动，仅显示层让位。 */
const RecapDimSpan: React.FC<{from: number; to: number; children: React.ReactNode}> = ({from, to, children}) => {
  const frame = useCurrentFrame();
  const cover = progress(frame, from, 10) * (1 - progress(frame, to, 12));
  return <AbsoluteFill style={{opacity: 1 - 0.84 * clamp01(cover)}}>{children}</AbsoluteFill>;
};

/** 目录条目卡地址（纳管产出的固定地址；P7 接头飞行取同一张卡）。 */
export const CATALOG_ADDRESS = 'ctx://kb/metric/repurchase-rate';

export const P2Asset: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p2-01', 'p2-03c');
  const bB = w('p2-04', 'p2-07b');
  const bC = w('p2-08', 'p2-10');
  const bD = w('p2-11', 'p2-12');
  const bE = w('p2-13');
  const bF = w('p2-14', 'p2-15');
  const bG = w('p2-16', 'p2-18');
  const bH = w('p2-19', 'p2-20');
  const bI = w('p2-21', 'p2-24');
  const bJ = w('p2-25', 'p2-26');
  const bK = w('p2-27', 'p2-28');
  const bL = w('p2-29', 'p2-32');
  const bM = w('p2-33', 'p2-35');
  const bN = w('p2-36', 'p2-38');
  const bO = w('p2-39', 'p2-40');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P2" tagline="资产轴" accent={theme.concept} />

      {/* 「蓝图·目标态」角标：纳管段（2-C..2-G，p2-08..p2-18）全程挂起 */}
      <Sequence from={at('p2-08')} durationInFrames={dur('p2-08', 'p2-18')} name="角标-蓝图目标态">
        <BlueprintTag at={0} />
      </Sequence>

      {/* 2-A 开轴：FiveAxisMap 高亮资产轴 + 七类资产卡入列 + 白话小卡@p2-03b/c */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="2-A">
        <FiveAxisMap built highlight="asset" at={6} />
        <SevenAssets a02={at('p2-02') - bA.from} a03={at('p2-03') - bA.from} />
        <PlainCards a03b={at('p2-03b') - bA.from} a03c={at('p2-03c') - bA.from} />
      </Sequence>

      {/* 2-B 请求连五类：RequestCard 五线 + 卡缘「已动用」小签累积 + 灰置卡@p2-07b */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="2-B">
        <RequestFiveAssets
          a04={at('p2-04') - bB.from}
          a05={at('p2-05') - bB.from}
        />
        <PendingAssets a07b={at('p2-07b') - bB.from} />
      </Sequence>

      {/* 2-C 纳管总览与登记：ig-open（p2-08b hold 补锚）→ ig-ingest；archify 章为讲解
          主体（取舍「反过来」，见文件头）——登记装置删除，p2-08b 引用层标牌走右带补注 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="2-C">
        <ArchifyRecap slug="ingest-pipeline" caption="纳管管线 · 总览与登记" cues={[
          {chapterId: 'ig-open', at: at('p2-08') - bC.from, durationInFrames: dur('p2-08')},
          {chapterId: 'ig-open', at: at('p2-08b') - bC.from, durationInFrames: dur('p2-08b'), fit: 'hold'},
          {chapterId: 'ig-ingest', at: at('p2-09') - bC.from, durationInFrames: dur('p2-09')},
          {chapterId: 'ig-ingest', at: at('p2-10') - bC.from, durationInFrames: dur('p2-10'), fit: 'hold'},
        ]} />
        <ReferenceLayerTag a08b={at('p2-08b') - bC.from} />
      </Sequence>

      {/* 2-D 归一段：ig-normalize 锚 + hold（同上取舍：装置删除，无 LLM 角标走左带补注；
          承 2-C 链尾背靠背 → lead=false） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="2-D">
        <ArchifyRecap slug="ingest-pipeline" caption="纳管管线 · 归一段" lead={false} cues={[
          {chapterId: 'ig-normalize', at: at('p2-11') - bD.from, durationInFrames: dur('p2-11')},
          {chapterId: 'ig-normalize', at: at('p2-12') - bD.from, durationInFrames: dur('p2-12'), fit: 'hold'},
        ]} />
        <MarginNote at={at('p2-12') - bD.from} title="归一 · 不调用 LLM" sub="蓝图设计" />
      </Sequence>

      {/* 2-E 分类段：ig-classify 锚（同上取舍：装置删除；承 2-D 链尾背靠背 → lead=false） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="2-E">
        <ArchifyRecap slug="ingest-pipeline" caption="纳管管线 · 分类段" lead={false} cues={[
          {chapterId: 'ig-classify', at: at('p2-13') - bE.from, durationInFrames: dur('p2-13')},
        ]} />
      </Sequence>

      {/* 2-F 分级段：ig-tier 锚 + hold（同上取舍：装置删除；承 2-E 链尾背靠背 → lead=false） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="2-F">
        <ArchifyRecap slug="ingest-pipeline" caption="纳管管线 · 分级段" lead={false} cues={[
          {chapterId: 'ig-tier', at: at('p2-14') - bF.from, durationInFrames: dur('p2-14')},
          {chapterId: 'ig-tier', at: at('p2-15') - bF.from, durationInFrames: dur('p2-15'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 2-G 入册段：ig-tag 锚 + hold 链。p2-16 章图全亮承「打标/向量/地址」；p2-17 起
          压暗暗底，目录条目卡接头锚（〔M-001 同物同形〕弹出→飞落目录列表）后置在上 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="2-G">
        <RecapDimSpan from={at('p2-17') - bG.from} to={at('p2-18') - bG.from + dur('p2-18')}>
          <ArchifyRecap slug="ingest-pipeline" caption="纳管管线 · 打标索引段" lead={false} cues={[
            {chapterId: 'ig-tag', at: at('p2-16') - bG.from, durationInFrames: dur('p2-16')},
            {chapterId: 'ig-tag', at: at('p2-17') - bG.from, durationInFrames: dur('p2-17'), fit: 'hold'},
            {chapterId: 'ig-tag', at: at('p2-18') - bG.from, durationInFrames: dur('p2-18'), fit: 'hold'},
          ]} />
        </RecapDimSpan>
        <CatalogEmit a17={at('p2-17') - bG.from} a18={at('p2-18') - bG.from} />
      </Sequence>

      {/* 2-H 口径纪律 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="2-H">
        <CaliberCard a19={at('p2-19') - bH.from} a20={at('p2-20') - bH.from} />
      </Sequence>

      {/* 2-I fan trap 破坏实验 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="2-I">
        <FanTrapCrash
          a21={at('p2-21') - bI.from}
          a22={at('p2-22') - bI.from}
          a23={at('p2-23') - bI.from}
          a24={at('p2-24') - bI.from}
        />
      </Sequence>

      {/* 2-J 正确次序（同装置对照侧） */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="2-J">
        <FanTrapFixed a25={at('p2-25') - bJ.from} a26={at('p2-26') - bJ.from} />
      </Sequence>

      {/* 2-K 跨轴机制：lmm-seam 锚 + hold；M1 角标走画框外左余量 */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="2-K">
        <SeamMarginTag a27={at('p2-27') - bK.from} />
        <ArchifyRecap slug="blueprint--layer-mechanism-map" caption="资产轴 · 跨轴组合" cues={[
          {chapterId: 'lmm-seam', at: at('p2-27') - bK.from, durationInFrames: dur('p2-27')},
          {chapterId: 'lmm-seam', at: at('p2-28') - bK.from, durationInFrames: dur('p2-28'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 2-L 注册校验：代码走廊①（真实仓码）+ p2-29b 422 回扣行（目标态） */}
      <Sequence from={bL.from} durationInFrames={bL.durationInFrames} name="2-L">
        <CodePane
          at={at('p2-29') - bL.from}
          lines={[
            'interface/definitions · 四类定义收进同一张表',
            "  kind: 'skill_template' | 'routine' | 'skill' | 'agent'",
            '校验：表间引用对得上 · 不绕成圈 · 指标必填汇总式',
            '  ⚠ 校验未过 → HTTP 422（拒绝落库）',
            'materialize_all() → 盘上技能文件 ＝ 该表渲染产物',
          ]}
          badge={{level: 'filled', note: '本仓校验门 · 422'}}
        />
        <GateCallbackRow a29b={at('p2-29b') - bL.from} />
        <TableToPage a32={at('p2-32') - bL.from} />
      </Sequence>

      {/* 2-M 常驻块三问：Core Block 建立 */}
      <Sequence from={bM.from} durationInFrames={bM.durationInFrames} name="2-M">
        <CoreBlockSetup
          a33={at('p2-33') - bM.from}
          a34={at('p2-34') - bM.from}
          a35={at('p2-35') - bM.from}
        />
      </Sequence>

      {/* 2-N 写入纪律：三路径点名 + 先扫描后自编 + 防注入拦截 + 30% 硬帽/P8 钩子 + 2048 截断 */}
      <Sequence from={bN.from} durationInFrames={bN.durationInFrames} name="2-N">
        <CoreBlockDiscipline
          a36={at('p2-36') - bN.from}
          a36b={at('p2-36b') - bN.from}
          a36c={at('p2-36c') - bN.from}
          a37={at('p2-37') - bN.from}
          a37b={at('p2-37b') - bN.from}
          a37c={at('p2-37c') - bN.from}
          a37d={at('p2-37d') - bN.from}
          a38={at('p2-38') - bN.from}
        />
      </Sequence>

      {/* 2-O 轴收束：ol-gov 锚 + hold（recap 先挂）；三标签前景（后置覆盖）+ 导航图推进转场 */}
      <Sequence from={bO.from} durationInFrames={bO.durationInFrames} name="2-O">
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="资产轴 · 受治理状态" cues={[
          {chapterId: 'ol-gov', at: at('p2-39') - bO.from, durationInFrames: dur('p2-39')},
          {chapterId: 'ol-gov', at: at('p2-40') - bO.from, durationInFrames: dur('p2-40'), fit: 'hold'},
        ]} />
        <Sequence from={0} durationInFrames={dur('p2-39')} name="2-O-三标签">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            {['已登记', '可寻址', '带版本'].map((t, i) => (
              <StampTag key={t} text={t} delay={i * 14} />
            ))}
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p2-40') - bO.from} durationInFrames={dur('p2-40')} name="2-O-推进">
          <AdvanceMap />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 「蓝图·目标态」角标（P2 纳管段 / P7 全幕共用；SceneTag 右侧小标）。 */
export const BlueprintTag: React.FC<{at: number; note?: string}> = ({at, note}) => {
  const o = useProgress(at, 10);
  return (
    <div
      style={{
        position: 'absolute',
        left: 460,
        top: 72,
        opacity: o,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <svg width={14} height={14} style={{transform: `rotate(45deg) scale(${o})`}}>
        <rect x={2} y={2} width={10} height={10} fill="none" stroke={theme.concept} strokeWidth={2} />
      </svg>
      <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.concept, letterSpacing: 1}}>
        蓝图 · 目标态{note ? ` · ${note}` : ''}
      </span>
    </div>
  );
};

/** 目录列表（2-G 飞落目标 / 7-F 起飞点——写读两条管线的接头锚落位，SSOT 同文件）：
 *  2×4 槽位缩样卡架，count 为已入册条数（余槽虚线待命）。 */
export const CatalogList: React.FC<{
  count: number;
  at?: number;
  style?: React.CSSProperties;
}> = ({count, at, style}) => {
  const ins = useSpring('settle', {at: at ?? -1000, dur: 20});
  const slots = 8;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1470,
        top: 360,
        width: 330,
        height: 430,
        borderRadius: 10,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panel,
        opacity: ins,
        padding: 14,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        gap: 10,
        ...style,
      }}
    >
      <div style={{gridColumn: '1 / span 2', fontFamily: theme.mono, fontSize: 15, color: theme.dim, letterSpacing: 1}}>
        目录列表 · {Math.max(0, count)}/{slots}
      </div>
      {Array.from({length: slots}, (_, i) =>
        i < Math.max(0, Math.min(count, slots)) ? (
          <CatalogCard key={i} small address={CATALOG_ADDRESS} />
        ) : (
          <div
            key={i}
            style={{border: `1.5px dashed ${theme.panelBorder}`, borderRadius: 7, opacity: 0.6}}
          />
        ),
      )}
    </div>
  );
};

/** 2-A 七类资产卡逐类入列（每卡带「固定地址 · 带出处 · 带权限」三小标）。 */
const ASSET_KINDS = [
  'definitions',
  'memory',
  '技能目录',
  '知识库',
  '血缘',
  '核准问答对',
  '标签与策略',
] as const;

const SevenAssets: React.FC<{a02: number; a03: number}> = ({a02, a03}) => {
  const frame = useCurrentFrame();
  const header = clamp01(progress(frame, a02 - 6, 12));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 428, textAlign: 'center', fontSize: 20, color: theme.dim, opacity: header}}>
        七类受治理资产 · 固定地址 · 带出处 · 带权限
      </div>
      {ASSET_KINDS.map((k, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const gx = 464 + col * 254 + (row === 1 ? 127 : 0);
        const gy = 496 + row * 130;
        const p = clamp01(progress(frame, a02 + i * 7, 16));
        // 七类点名句（p2-03）：描边逐卡加深为钢蓝实线（点名完成态）
        const named = clamp01(progress(frame, a03 + i * 4, 8));
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: gx,
              top: gy,
              width: 230,
              height: 108,
              borderRadius: 9,
              border: `1.5px solid ${named > 0.3 ? theme.concept : theme.panelBorder}`,
              background: theme.panel,
              boxShadow: named > 0.3 ? `0 0 ${14 * named}px ${withAlpha(theme.concept, 0.3)}` : 'none',
              opacity: p,
              transform: `translateY(${(1 - p) * 20}px)`,
              padding: '12px 16px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 18, color: named > 0.3 ? theme.concept : theme.text}}>{k}</span>
            <span style={{fontSize: 13, color: theme.dim}}>固定地址 · 带出处 · 带权限</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 2-A 白话小卡：技能目录（用到才展开正文）/ 知识库（文档 + 资料块）随卡浮出（p2-03b/c）。
 *  悬在对应资产卡正上方（卡 x 对齐、卡顶 496 之上的空档），随句弹入。 */
const PlainCards: React.FC<{a03b: number; a03c: number}> = ({a03b, a03c}) => {
  const frame = useCurrentFrame();
  const cards = [
    {t: '技能目录', s: '用到才展开正文', x: 972, k: clamp01(progress(frame, a03b, 12))},
    {t: '知识库', s: '文档 ＋ 资料块', x: 1226, k: clamp01(progress(frame, a03c, 12))},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {cards.map((c) => (
        <div
          key={c.t}
          style={{
            position: 'absolute',
            left: c.x,
            top: 458,
            width: 230,
            height: 34,
            borderRadius: 7,
            border: `1.5px solid ${theme.concept}`,
            background: withAlpha(theme.concept, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: c.k,
            transform: `translateY(${(1 - c.k) * -10}px)`,
          }}
        >
          <span style={{fontSize: 15, color: theme.concept}}>{c.t}</span>
          <span style={{fontSize: 14, color: theme.dim}}>{c.s}</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 2-B 灰置卡：技能目录 / 知识库两类待亮（装配/检索幕再点亮，p2-07b）。 */
const PendingAssets: React.FC<{a07b: number}> = ({a07b}) => {
  const ins = useStagger(2, {stride: 12, at: a07b});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {[
        {t: '技能目录', note: '装配幕点亮'},
        {t: '知识库', note: '检索幕点亮'},
      ].map((c, i) => (
        <div
          key={c.t}
          style={{
            position: 'absolute',
            left: 680 + i * 300,
            top: 700,
            width: 260,
            height: 64,
            borderRadius: 9,
            border: `1.5px dashed ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            opacity: ins[i],
            transform: `translateY(${(1 - ins[i]) * 12}px)`,
          }}
        >
          <span style={{fontSize: 19, color: theme.dim}}>{c.t}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, opacity: 0.8}}>{c.note}</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 2-B 请求连五类：RequestCard 连出五线逐一被资产卡接住，卡缘「已动用」小签累积。 */
const REQ_TARGETS = ['定义', '核准问答对', '血缘', '标签与策略', '记忆'] as const;

const RequestFiveAssets: React.FC<{a04: number; a05: number}> = ({a04, a05}) => {
  const frame = useCurrentFrame();
  const intro = clamp01(progress(frame, a04, 12));
  const lines = useStagger(5, {stride: 18, at: a05});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 580, top: 170, opacity: intro}}>
        <RequestCard at={a04} passed={[...REQ_TARGETS]} />
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {REQ_TARGETS.map((_, i) => {
          const cx = 320 + i * 320 + 130;
          return (
            <path
              key={i}
              d={`M 960 380 C 960 470, ${cx} 430, ${cx} 548`}
              fill="none"
              stroke={theme.concept}
              strokeWidth={2}
              opacity={lines[i] * 0.85}
              pathLength={1}
              strokeDasharray={lines[i]}
              strokeDashoffset={1 - lines[i]}
            />
          );
        })}
      </svg>
      {REQ_TARGETS.map((t, i) => {
        const hot = lines[i] > 0.35;
        return (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: 320 + i * 320,
              top: 550,
              width: 260,
              height: 96,
              borderRadius: 9,
              border: `2px solid ${hot ? theme.concept : theme.panelBorder}`,
              background: hot ? withAlpha(theme.concept, 0.1) : theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: hot ? theme.concept : theme.dim,
              opacity: 0.4 + 0.6 * lines[i],
              boxShadow: hot ? `0 0 ${16 * lines[i]}px ${withAlpha(theme.concept, 0.35)}` : 'none',
            }}
          >
            {t}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 2-C 目录＝引用层标牌（p2-08b，画框外右带补注——管线末端在画框内，标牌从框缘
 *  引出细线示意挂接；ADR-1 指针不副本）。 */
const ReferenceLayerTag: React.FC<{a08b: number}> = ({a08b}) => {
  const enter = useEnter('slideR', {at: a08b, dur: 16});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          ...enter,
          position: 'absolute',
          left: 1640,
          top: 470,
          width: 250,
          padding: '14px 16px',
          borderRadius: 10,
          border: `2px solid ${theme.concept}`,
          background: theme.panel,
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontSize: 22, color: theme.concept}}>目录 ＝ 引用层</div>
        <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 10}}>ADR-1 · 指针不副本</div>
        <div style={{fontSize: 14, color: theme.dim, marginTop: 6}}>指针统一登记于此</div>
      </div>
      {/* 挂接细线：标牌 → 画框右缘（311..1609 为 archify 画框带） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <line x1={1609} y1={506} x2={1640} y2={506} stroke={theme.concept} strokeWidth={2} strokeDasharray="4 5" />
      </svg>
    </AbsoluteFill>
  );
};

/** 画框外左带补注（2-D「归一不调用 LLM」角标的缩置形态——archify 章为讲解主体，
 *  装置缩为框外细条）。 */
const MarginNote: React.FC<{at: number; title: string; sub?: string}> = ({at, title, sub}) => {
  const enter = useEnter('rise', {at, dur: 16});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          ...enter,
          position: 'absolute',
          left: 36,
          top: 520,
          width: 250,
          padding: '12px 14px',
          borderRadius: 8,
          border: `1.5px solid ${theme.ok}`,
          background: theme.panel,
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontSize: 17, color: theme.ok, lineHeight: 1.6}}>{title} ✓</div>
        {sub ? <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 6}}>{sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** 2-G 入册段：目录条目卡弹出→盖章→飞落目录列表（M-001 接头锚，p2-17..18 压暗暗底
 *  之上的前景装置）；打标/向量/地址三步由 ig-tag 章图全亮段（p2-16）承担。 */
const CatalogEmit: React.FC<{a17: number; a18: number}> = ({a17, a18}) => {
  const frame = useCurrentFrame();
  const cardPop = clamp01(progress(frame, a17, 12));
  const stampFlash = useImpulse({at: a17 + 14, dur: 18, peak: 1});
  const fly = useSpring('settle', {at: a17 + 26, dur: 30});
  const landed = clamp01(progress(frame, a17 + 58, 5));
  const glow = useImpulse({at: a18, dur: 26, peak: 1});
  const tagIn = clamp01(progress(frame, a18 + 8, 10));
  // 飞行弧线：管线末端 (1018,544) → 目录列表首槽中心 (1557,447)，抛物线抬升 90px
  const fx = 1018 + (1557 - 1018) * fly;
  const fy = 544 + (447 - 544) * fly - Math.sin(Math.PI * fly) * 90;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 目录条目卡：末端弹出（地址/版次双标）→ 盖章 → 飞落目录列表 */}
      <div style={{position: 'absolute', left: 900, top: 470, opacity: cardPop * (1 - landed)}}>
        <CatalogCard at={a17} address={CATALOG_ADDRESS} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1044,
          top: 496,
          opacity: (1 - landed) * stampFlash,
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
      {/* 飞行中的目录条目卡（弧线） */}
      <div style={{position: 'absolute', left: fx - 118, top: fy - 74, opacity: clamp01(fly) * (1 - landed)}}>
        <CatalogCard address={CATALOG_ADDRESS} />
      </div>
      {/* 目录列表：首件入库 */}
      <CatalogList count={Math.round(landed)} at={a17} style={{left: 1470, top: 360}} />
      <div
        style={{
          position: 'absolute',
          left: 1470,
          top: 810,
          fontSize: 17,
          color: theme.concept,
          border: `1.5px solid ${theme.concept}`,
          borderRadius: 7,
          padding: '4px 14px',
          background: theme.panel,
          opacity: tagIn,
        }}
      >
        读管线取用的就是它
      </div>
      {/* 落位脉冲环（p2-18 双闪） */}
      <div
        style={{
          position: 'absolute',
          left: 1557 - 30,
          top: 447 - 30,
          width: 60,
          height: 60,
          borderRadius: 34,
          border: `2.5px solid ${theme.concept}`,
          opacity: glow * 0.9,
          transform: `scale(${1 + glow * 0.9})`,
        }}
      />
    </AbsoluteFill>
  );
};

/** 2-H 口径纪律：算什么 / 按什么次序算 双栏卡 + 「口径只存一份 · 用时现算」章 + 预告槽。 */
const CaliberCard: React.FC<{a19: number; a20: number}> = ({a19, a20}) => {
  const frame = useCurrentFrame();
  const cardIn = useProgress(a19, 10);
  const stamp = useSpring('snap', {at: a19 + 16, dur: 14});
  const slotIn = clamp01(progress(frame, a20, 12));
  return (
    <AbsoluteFill style={{pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 860, opacity: cardIn}}>
        <div style={{borderRadius: 12, border: `2px solid ${theme.concept}`, background: theme.panel, overflow: 'hidden'}}>
          <div style={{padding: '14px 26px', borderBottom: `1.5px solid ${theme.panelBorder}`, fontSize: 21, color: theme.dim}}>
            口径卡 · 重复购买率
          </div>
          <div style={{padding: '22px 26px', borderBottom: `1.5px solid ${theme.panelBorder}`}}>
            <div style={{fontSize: 17, color: theme.dim, marginBottom: 8}}>上半栏 · 算什么</div>
            <div style={{fontSize: 27, color: theme.text}}>按客户去重的付款订单 ÷ 付款订单</div>
          </div>
          <div style={{padding: '22px 26px'}}>
            <div style={{fontSize: 17, color: theme.dim, marginBottom: 8}}>下半栏 · 按什么次序算</div>
            <div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
              {['① 先各自汇总', '② 再连接'].map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 ? <span style={{fontSize: 22, color: theme.dim}}>→</span> : null}
                  <span style={{fontSize: 24, color: theme.concept, border: `1.5px solid ${theme.concept}`, borderRadius: 7, padding: '6px 16px', background: theme.bg}}>{s}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: -26,
            top: -20,
            padding: '8px 18px',
            border: `2.5px solid ${theme.ok}`,
            borderRadius: 9,
            fontSize: 20,
            color: theme.ok,
            background: theme.panel,
            transform: `rotate(5deg) scale(${stamp})`,
            opacity: stamp,
          }}
        >
          口径只存一份 · 用时现算
        </div>
      </div>
      {/* 实验预告槽 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 190,
          display: 'flex',
          justifyContent: 'center',
          opacity: slotIn,
        }}
      >
        <span style={{padding: '7px 22px', border: `1.5px dashed ${theme.conceptDeep}`, borderRadius: 8, fontSize: 19, color: theme.conceptDeep, background: theme.panel}}>
          次序错了会怎样 · 破坏实验预告
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-I fan trap 破坏实验（消融对照定式）：¥100 订单 ×3 事件先连后聚 → ¥300，
 *  整月 200/440 对撞 + 实心徽 + 「查询语法完全合法」对勾常亮。 */
const FanTrapCrash: React.FC<{a21: number; a22: number; a23: number; a24: number}> = ({a21, a22, a23, a24}) => {
  const frame = useCurrentFrame();
  const struct = useStagger(4, {stride: 7, at: a21});
  const links = useStagger(3, {stride: 6, at: a22});
  const crash = clamp01(progress(frame, a22 + 10, 22));
  const spike = useImpulse({at: a22 + 16, dur: 22, peak: 1});
  const month = clamp01(progress(frame, a23, 14));
  const verdict = clamp01(progress(frame, a24, 12));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 订单卡 + 三条事件记录卡 */}
      <div style={{position: 'absolute', left: 260, top: 330, width: 220, height: 110, borderRadius: 10, border: `2px solid ${theme.text}`, background: theme.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: struct[0]}}>
        <span style={{fontSize: 17, color: theme.dim}}>订单</span>
        <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.text}}>¥100</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 830,
            top: 250 + i * 120,
            width: 240,
            height: 84,
            borderRadius: 9,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: theme.dim,
            opacity: struct[i + 1],
          }}
        >
          事件记录 #{i + 1}
        </div>
      ))}
      {/* 先连后聚：三条连线全部挂上订单 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={480}
            y1={385}
            x2={826}
            y2={292 + i * 120}
            stroke={theme.conceptDeep}
            strokeWidth={2.5}
            opacity={links[i] * 0.9}
            pathLength={1}
            strokeDasharray={links[i]}
            strokeDashoffset={1 - links[i]}
          />
        ))}
      </svg>
      {/* 金额跳变：¥100 → ¥300 */}
      <div style={{position: 'absolute', left: 260, top: 480, display: 'flex', alignItems: 'baseline', gap: 16, opacity: crash}}>
        <span style={{fontSize: 22, color: theme.dim}}>记成</span>
        <span style={{fontSize: 52, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 ${16 * spike}px ${withAlpha(theme.conceptDeep, 0.8)}`}}>
          ¥<Counter from={100} to={300} start={a22 + 10} frames={26} />
        </span>
        <span style={{fontSize: 20, color: theme.conceptDeep}}>×3</span>
      </div>
      {/* 整月对照 200 vs 440 + 实心徽 */}
      <div style={{position: 'absolute', left: 1240, top: 250, opacity: month}}>
        <div style={{fontSize: 18, color: theme.dim, marginBottom: 12}}>整月对照</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{fontSize: 17, color: theme.dim, width: 96}}>正确</span>
            <div style={{width: 160, height: 26, borderRadius: 6, border: `1.5px solid ${theme.ok}`}}>
              <div style={{width: '45%', height: '100%', background: withAlpha(theme.ok, 0.5)}} />
            </div>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.ok}}>¥200</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{fontSize: 17, color: theme.dim, width: 96}}>算出</span>
            <div style={{width: 160, height: 26, borderRadius: 6, border: `1.5px solid ${theme.conceptDeep}`}}>
              <div style={{width: '100%', height: '100%', background: withAlpha(theme.conceptDeep, 0.5)}} />
            </div>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.conceptDeep}}>¥440</span>
          </div>
        </div>
        <div style={{marginTop: 22}}>
          <EvidenceBadge level="filled" at={a23} note="对照 200 · 退化 440" />
        </div>
      </div>
      {/* 「查询语法完全合法」对勾常亮 */}
      <div style={{position: 'absolute', left: 260, top: 640, display: 'flex', gap: 14, alignItems: 'center', opacity: verdict}}>
        <span style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: `2.5px solid ${theme.ok}`, color: theme.ok, fontSize: 19, background: withAlpha(theme.ok, 0.12)}}>✓</span>
        <span style={{fontSize: 23, color: theme.text, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, padding: '8px 20px', background: theme.panel}}>查询语法完全合法</span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-J 正确次序（同装置对照侧）：先各自汇总再连接 → ¥100 / 整月 ¥200（绿）+ 回扣条。 */
const FanTrapFixed: React.FC<{a25: number; a26: number}> = ({a25, a26}) => {
  const frame = useCurrentFrame();
  const merge = useStagger(3, {stride: 6, at: a25});
  const joined = useSpring('settle', {at: a25 + 26, dur: 22});
  const ok = clamp01(progress(frame, a25 + 30, 12));
  const recall = useEnter('rise', {at: a26, dur: 16});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 240 - joined * 60,
            top: 250 + i * 120 + (1 - merge[i]) * 20,
            width: 240,
            height: 84,
            borderRadius: 9,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: theme.dim,
            opacity: 0.4 + 0.6 * merge[i] * (1 - joined * 0.55),
          }}
        >
          事件记录 #{i + 1}
        </div>
      ))}
      {/* 三事件先聚成一单 */}
      <div style={{position: 'absolute', left: 700, top: 330, width: 220, height: 110, borderRadius: 10, border: `2px solid ${theme.ok}`, background: withAlpha(theme.ok, 0.1), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: joined}}>
        <span style={{fontSize: 17, color: theme.dim}}>先汇总 · 一单</span>
        <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.ok}}>¥100</span>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: ok}}>
        <line x1={920} y1={385} x2={1120} y2={385} stroke={theme.ok} strokeWidth={2.5} />
        <path d="M 1120 377 L 1136 385 L 1120 393 Z" fill={theme.ok} />
      </svg>
      {/* 再挂订单 */}
      <div style={{position: 'absolute', left: 1150, top: 330, width: 220, height: 110, borderRadius: 10, border: `2px solid ${theme.ok}`, background: theme.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: ok}}>
        <span style={{fontSize: 17, color: theme.dim}}>订单</span>
        <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.ok}}>¥100</span>
      </div>
      <div style={{position: 'absolute', left: 1150, top: 490, fontFamily: theme.mono, fontSize: 30, color: theme.ok, opacity: ok}}>
        整月 ¥200
      </div>
      {/* 回扣条：重复购买率同一个问题 */}
      <div style={{...recall, position: 'absolute', left: 0, right: 0, bottom: 190, display: 'flex', justifyContent: 'center'}}>
        <span style={{padding: '8px 24px', border: `1.5px solid ${theme.concept}`, borderRadius: 8, fontSize: 20, color: theme.concept, background: theme.panel}}>
          重复购买率 ＝ 订单 × 客户 连表 · 同一个问题
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-K M1 跨轴角标（画框外左余量）。 */
const SeamMarginTag: React.FC<{a27: number}> = ({a27}) => {
  const frame = useCurrentFrame();
  const o = useProgress(a27, 12);
  const glowIn = clamp01(progress(frame, a27 + 20, 12));
  return (
    <div
      style={{
        position: 'absolute',
        left: 36,
        top: 520,
        width: 266,
        padding: '12px 14px',
        borderRadius: 8,
        border: `1.5px solid ${theme.concept}`,
        background: theme.panel,
        opacity: o,
        boxSizing: 'border-box',
      }}
    >
      <div style={{fontSize: 16, color: theme.concept, lineHeight: 1.6}}>M1 口径单点</div>
      <div style={{fontSize: 15, color: theme.dim, lineHeight: 1.6, marginTop: 6}}>＝ 资产 × 权威 × 装配</div>
      <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 8}}>蓝图 §3.3</div>
      <div style={{fontSize: 14, color: theme.dim, marginTop: 10, opacity: glowIn}}>机制多跨在几条轴上</div>
    </div>
  );
};

/** 2-L 422 回扣行（p2-29b）：校验门回扣「重复购买率」示意行——没写怎么汇总 → 注册即拒
 *  （目标态，蓝图设计口径；与本仓 CodePane 的 422 门同形对读）。 */
const GateCallbackRow: React.FC<{a29b: number}> = ({a29b}) => {
  const enter = useEnter('rise', {at: a29b, dur: 16});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          ...enter,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 742,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span style={{fontSize: 19, color: theme.concept, border: `1.5px solid ${theme.concept}`, borderRadius: 8, padding: '7px 16px', background: theme.panel}}>
          重复购买率
        </span>
        <span style={{fontSize: 17, color: theme.dim}}>汇总式缺失</span>
        <svg width={64} height={22}>
          <line x1={0} y1={11} x2={50} y2={11} stroke={theme.conceptDeep} strokeWidth={2.5} />
          <path d="M 50 5 L 62 11 L 50 17 Z" fill={theme.conceptDeep} />
        </svg>
        <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.conceptDeep, border: `2px solid ${theme.conceptDeep}`, borderRadius: 8, padding: '6px 16px', background: withAlpha(theme.conceptDeep, 0.1)}}>
          422 · 注册即拒
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, border: `1.5px dashed ${theme.dim}`, borderRadius: 6, padding: '4px 10px', background: theme.panel}}>
          目标态 · 蓝图
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-L 表 → 盘上技能文件投影箭头（渲染产物口径）。 */
const TableToPage: React.FC<{a32: number}> = ({a32}) => {
  const k = useProgress(a32, 14);
  const flow = useFlowDash({dash: 7, gap: 10, period: 26});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 838, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, opacity: k}}>
        <span style={{fontSize: 19, color: theme.text, border: `1.5px solid ${theme.concept}`, borderRadius: 8, padding: '7px 18px', background: theme.panel}}>definitions 注册表</span>
        <svg width={140} height={24}>
          <line x1={0} y1={12} x2={124} y2={12} stroke={theme.concept} strokeWidth={2.5} strokeDasharray="8 8" />
          <line x1={0} y1={12} x2={124} y2={12} stroke={theme.concept} strokeWidth={2.5} opacity={0.7} {...flow} />
          <path d="M 124 12 l -10 -6 v 12 Z" fill={theme.concept} />
        </svg>
        <span style={{fontSize: 19, color: theme.dim, border: `1.5px dashed ${theme.dim}`, borderRadius: 8, padding: '7px 18px', background: theme.panel}}>盘上技能文件 · 渲染产物</span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-M 常驻块三问：Core Block 挂窗口顶部 + 示例行写入 + 三问标签。 */
const CoreBlockSetup: React.FC<{a33: number; a34: number; a35: number}> = ({a33, a34, a35}) => {
  const frame = useCurrentFrame();
  const winIn = useProgress(a33, 10);
  const blockIn = useSpring('settle', {at: a33 + 10, dur: 22});
  const profile = useReveal('运营专员 · 负责华东区', {at: a34, cps: 10});
  const qs = useStagger(3, {stride: 12, at: a35});
  return (
    <AbsoluteFill style={{pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 1000, height: 620, borderRadius: 14, border: `2px solid ${theme.panelBorder}`, background: theme.bg, opacity: winIn, padding: 20, boxSizing: 'border-box'}}>
        <div style={{fontSize: 17, color: theme.dim}}>模型窗口 · 每一轮</div>
        {/* Core Block：常驻画像块 */}
        <div
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: 56,
            height: 150,
            borderRadius: 10,
            border: `2.5px solid ${theme.concept}`,
            background: withAlpha(theme.concept, 0.1),
            padding: '14px 20px',
            boxSizing: 'border-box',
            transform: `translateY(${(1 - blockIn) * -60}px)`,
            opacity: blockIn,
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.concept}}>Core Block · 常驻画像块</span>
            <span style={{fontSize: 14, color: theme.dim}}>每一轮都在</span>
          </div>
          <div style={{marginTop: 26, fontFamily: theme.mono, fontSize: 24, color: theme.text}}>
            {profile}
            <span style={{opacity: profile.length >= 12 ? 1 : 0}}>▍</span>
          </div>
        </div>
        {/* 三问标签 */}
        {['谁能写', '写多大', '写满了怎么办'].map((t, i) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: 60 + i * 300,
              top: 300,
              width: 250,
              height: 64,
              borderRadius: 8,
              border: `1.5px solid ${theme.concept}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: theme.text,
              opacity: qs[i],
              transform: `translateY(${(1 - qs[i]) * 16}px)`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 2-N 写入纪律：三条写入路径（代理工具自写 / 管理端修改 / 尾部追加）逐一点名汇入
 *  块体 + p2-36c「先扫描 · 后自编」时序小标 + 防注入扫描与 p2-37b 注入样例试写入被拦
 *  + p2-37c/d 两级预算第一级「记忆 ≤ 30% 硬帽（装配侧）」角标与「对账见 P8」钩子标
 *  + p2-38 第二级 2048 单块封顶截断（metadata.truncated，不静默丢弃）。 */
const WRITE_PATHS = ['代理 · 工具自写', '管理端 · 修改', '尾部 · 追加'] as const;

const CoreBlockDiscipline: React.FC<{
  a36: number; a36b: number; a36c: number; a37: number; a37b: number; a37c: number; a37d: number; a38: number;
}> = ({a36, a36b, a36c, a37, a37b, a37c, a37d, a38}) => {
  const frame = useCurrentFrame();
  const paths = useStagger(3, {stride: 8, at: a36});
  const named = useStagger(3, {stride: 10, at: a36b});
  const orderIn = clamp01(progress(frame, a36c, 12));
  const audits = useStagger(3, {stride: 8, at: a36 + 18});
  const scan = useProgress(a37, 12);
  const attempt = clamp01(progress(frame, a37b, 10));
  const blockFlash = useImpulse({at: a37b + 8, dur: 20, peak: 0.8});
  const capIn = clamp01(progress(frame, a37c, 12));
  const hookIn = clamp01(progress(frame, a37d, 12));
  const fill = clamp01(progress(frame, a38, 20));
  const truncated = clamp01(progress(frame, a38 + 22, 12));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 「先扫描 · 后自编」时序小标（p2-36c：放开自写得排在防注入之后） */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 244,
          fontSize: 16,
          color: theme.concept,
          border: `1.5px solid ${theme.concept}`,
          borderRadius: 7,
          padding: '5px 14px',
          background: theme.panel,
          opacity: orderIn,
        }}
      >
        ① 防注入扫描 → ② 代理自写
      </div>
      {/* 三条写入路径汇入块体（p2-36 建卡 · p2-36b 逐一点名提亮） */}
      {WRITE_PATHS.map((p, i) => (
        <React.Fragment key={p}>
          <div
            style={{
              position: 'absolute',
              left: 200,
              top: 300 + i * 96,
              width: 220,
              height: 60,
              borderRadius: 8,
              border: `1.5px solid ${named[i] > 0.3 ? theme.concept : theme.panelBorder}`,
              background: named[i] > 0.3 ? withAlpha(theme.concept, 0.1) : theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 19,
              color: named[i] > 0.3 ? theme.concept : theme.text,
              opacity: 0.55 * paths[i] + 0.45 * named[i] * paths[i],
            }}
          >
            {p}
          </div>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: paths[i]}}>
            <path d={`M 424 ${330 + i * 96} C 540 ${330 + i * 96}, 560 ${420}, 700 420`} fill="none" stroke={theme.concept} strokeWidth={2} strokeDasharray="7 8" opacity={0.8} />
          </svg>
        </React.Fragment>
      ))}
      {/* Core Block 块体 + 审计行 */}
      <div
        style={{
          position: 'absolute',
          left: 710,
          top: 280,
          width: 460,
          height: 280,
          borderRadius: 10,
          border: `2.5px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.08),
          boxShadow: `0 0 ${18 * blockFlash}px ${withAlpha(theme.conceptDeep, 0.5)}`,
          padding: '16px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.concept}}>Core Block</div>
        <div style={{marginTop: 16}}>
          {['audit · 写入 1 行', 'audit · 写入 2 行', 'audit · 写入 3 行'].map((t, i) => (
            <div key={t} style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, lineHeight: 2, opacity: audits[i]}}>
              {t}
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', bottom: 14, left: 20, fontSize: 14, color: theme.dim, opacity: truncated}}>
          metadata.truncated
        </div>
      </div>
      {/* 防注入扫描：外部文字夹带命令 → 一律不当命令执行；p2-37b 注入样例试写入被拦 */}
      <div
        style={{
          position: 'absolute',
          left: 1270,
          top: 300,
          width: 400,
          borderRadius: 10,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: '16px 20px',
          boxSizing: 'border-box',
          opacity: scan,
        }}
      >
        <div style={{fontSize: 16, color: theme.dim, marginBottom: 12}}>防注入扫描</div>
        <div style={{fontSize: 18, color: theme.conceptDeep, border: `1.5px dashed ${theme.conceptDeep}`, borderRadius: 7, padding: '8px 12px'}}>
          外部文字 · 夹带命令
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 12}}>
          <span style={{fontSize: 22, color: theme.ok}}>→</span>
          <span style={{fontSize: 18, color: theme.ok, border: `1.5px solid ${theme.ok}`, borderRadius: 7, padding: '6px 14px', background: withAlpha(theme.ok, 0.1)}}>
            不当命令执行 ✓
          </span>
        </div>
        <div style={{marginTop: 12, opacity: attempt}}>
          <div style={{fontSize: 15, color: theme.conceptDeep, border: `1.5px dashed ${theme.conceptDeep}`, borderRadius: 6, padding: '4px 10px', display: 'inline-block'}}>
            样例 · 试写入常驻块
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 14}}>
            <span style={{fontSize: 20, color: theme.conceptDeep}}>→</span>
            <span style={{fontSize: 16, color: theme.conceptDeep, border: `2px solid ${theme.conceptDeep}`, borderRadius: 7, padding: '4px 12px', background: withAlpha(theme.conceptDeep, 0.12)}}>
              ✗ 拦下 · 不进窗口
            </span>
          </div>
        </div>
      </div>
      {/* 两级预算 · 第一级在装配侧：记忆 ≤ 30% 硬帽（p2-37c）+ 对账见 P8 钩子标（p2-37d） */}
      <div style={{position: 'absolute', left: 1270, top: 588, width: 400, opacity: capIn}}>
        <div style={{fontSize: 15, color: theme.dim, marginBottom: 8}}>两级预算 · 第一级在装配侧</div>
        <div style={{border: `2px solid ${theme.conceptDeep}`, borderRadius: 9, padding: '10px 16px', background: theme.panel, display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.conceptDeep}}>记忆 ≤ 30%</span>
          <span style={{fontSize: 15, color: theme.dim}}>装配侧硬帽</span>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 15,
            color: theme.dim,
            border: `1.5px dashed ${theme.dim}`,
            borderRadius: 8,
            padding: '6px 14px',
            background: theme.panel,
            opacity: hookIn,
          }}
        >
          生产里用没用上 → 对账见 P8
        </div>
      </div>
      {/* 第二级：单块 2048 token 上限条 + 按比例截断（p2-38） */}
      <div style={{position: 'absolute', left: 710, top: 640, width: 460}}>
        <div style={{fontSize: 15, color: theme.dim, marginBottom: 8}}>第二级 · 单块上限 2048 token</div>
        <div style={{position: 'relative', height: 26, borderRadius: 7, border: `1.5px solid ${theme.panelBorder}`, background: theme.bg, overflow: 'hidden'}}>
          <div style={{width: `${Math.min(100, fill * 118)}%`, height: '100%', background: withAlpha(fill > 0.84 ? theme.conceptDeep : theme.concept, 0.55)}} />
          <div style={{position: 'absolute', left: '84%', top: 0, bottom: 0, width: 2.5, background: theme.conceptDeep}} />
        </div>
        <div style={{fontSize: 16, color: theme.conceptDeep, marginTop: 10, opacity: truncated}}>
          写满按比例截断 · 标记亮起 · 不静默丢弃
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-O 三标签（资产轴要义）。 */
const StampTag: React.FC<{text: string; delay: number}> = ({text, delay}) => {
  const e = useSpring('settle', {at: delay, dur: 16});
  return (
    <div style={{opacity: e, padding: '10px 24px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 30, color: theme.ok, background: withAlpha(theme.ok, 0.08), transform: `translateY(${(1 - e) * 18}px)`}}>
      {text}
    </div>
  );
};

/** 2-O 导航图推进转场：资产轴走完（passedCount=1）、权威轴待亮。 */
const AdvanceMap: React.FC = () => {
  const push = usePushIn(0, {scale: 0.1, dur: 40});
  const o = useProgress(0, 8);
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <div style={{transform: push, opacity: o}}>
        <FiveAxisMap built highlight="authority" passedCount={1} at={4} />
      </div>
    </AbsoluteFill>
  );
};

/** 代码走廊终端（v3 P2Asset 原件迁移；真实仓码的画布，场景按走廊清单换行文）。 */
export const CodePane: React.FC<{
  at: number;
  lines: string[];
  badge?: {level: 'dashed' | 'solid' | 'filled'; note?: string};
}> = ({at, lines, badge}) => {
  const rows = useStagger(lines.length, {stride: 12, at});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 900, background: theme.terminalBg, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, padding: '18px 24px', fontFamily: theme.mono}}>
        {lines.map((l, i) => (
          <div key={i} style={{opacity: rows[i], fontSize: 21, lineHeight: 1.9, color: l.includes('⚠') || l.includes('422') ? theme.conceptDeep : theme.text, whiteSpace: 'pre'}}>
            <span style={{color: theme.dim, marginRight: 14}}>{String(i + 1).padStart(2, '0')}</span>
            {l}
          </div>
        ))}
        {badge ? (
          <div style={{marginTop: 12}}>
            <EvidenceBadge level={badge.level} at={at + (lines.length - 1) * 12 + 5} note={badge.note} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
