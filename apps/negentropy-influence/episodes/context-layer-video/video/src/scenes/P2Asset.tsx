/** P2 资产轴：库房与五道关（p2-01..p2-42，42 句；storyboard「P2 资产轴：库房与五道关」节）。
 *
 *  13 镜 / 18 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   2-A 开轴（剖面高亮库房；七类资产入柜@p2-03、五源→投影箭头@p2-04）
 *   2-B ig-open@p2-05（hold；「蓝图·目标态」角标自 p2-05 挂起至 p2-21 纳管段末）
 *   2-C ig-ingest hold 链@p2-06..08（承 2-B 尾镜界背靠背 → lead=false）· IntakeLine① + 收货
 *       登记台（recap 后置=画框遮盖范式，装置让位图回放）
 *   2-D ig-normalize hold 链@p2-09..11（承 2-C 链尾背靠背 → lead=false）· IntakeLine② + 开箱规整台
 *   2-E ig-classify hold 链@p2-12..13（承 2-D 链尾背靠背 → lead=false）· IntakeLine③ + 分类挂牌位
 *   2-F ig-tier hold 链@p2-14..16（p2-14 缺省 + 15/16 hold；p2-17 留空窗给库位牌指针特写；
 *       承 2-E 链尾背靠背 → lead=false）· IntakeLine④ + 上架分层（recap 后置遮盖）
 *   2-G ig-tag hold 链@p2-18..19（p2-20..21 留空窗给目录条目卡弹出→盖章→飞落货架——
 *       M-001 接头锚，P7 回桥段依赖其可见）· IntakeLine⑤ + 画格台
 *   2-H 当版页打印机（p2-22..25 纯装置：页出/页脚时刻走字/用毕入废纸盒/红叉角标）
 *   2-I 金额对撞 fan trap（p2-26..30；实心徽@p2-28「对照 200 · 退化 440」）
 *   2-J lmm-seam@p2-31（stretch）→ 同章 hold@p2-32（首句 stretch、余句同章 hold 定式）
 *   2-K 代码走廊①（CodePane@p2-34 + 表→当版页投影箭头@p2-35 + 实心徽）
 *   2-L 常驻记忆档案柜（p2-37..39 三问/两路/两档封顶）+ ol-full@p2-36 → @p2-40（档案柜 recap 后置；
 *       p2-36 引入句先 hold 一拍，37..39 空窗给档案柜装置）
 *   2-M 收束（影子板三标签@p2-41 + 剖面推进切放行席位@p2-42）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useDraw, useFlowDash, useImpulse, useProgress, usePushIn, useReveal, useSpring, useStagger} from '../motion';
import {Counter, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {CatalogShelf, HangarCrossSection} from '../components/HangarCrossSection';
import {CatalogCard} from '../components/CatalogCard';
import {IntakeLine} from '../components/IntakeLine';

export const P2Asset: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05');
  const bC = w('p2-06', 'p2-08');
  const bD = w('p2-09', 'p2-11');
  const bE = w('p2-12', 'p2-13');
  const bF = w('p2-14', 'p2-17');
  const bG = w('p2-18', 'p2-21');
  const bH = w('p2-22', 'p2-25');
  const bI = w('p2-26', 'p2-30');
  const bJ = w('p2-31', 'p2-32');
  const bK = w('p2-33', 'p2-35');
  const bL = w('p2-36', 'p2-40');
  const bM = w('p2-41', 'p2-42');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P2" tagline="资产轴 · 库房与五道关" accent={theme.concept} />

      {/* 「蓝图·目标态」角标：纳管段（2-B..2-G，p2-05..p2-21）全程挂起 */}
      <Sequence from={at('p2-05')} durationInFrames={dur('p2-05', 'p2-21')} name="角标-蓝图目标态">
        <BlueprintTag at={0} />
      </Sequence>

      {/* 2-A 开轴：剖面高亮库房 + 七类资产入柜 + 五源投影箭头 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="2-A">
        <HangarCrossSection built highlight="asset" at={0} />
        <SevenAssets a3={at('p2-03') - bA.from} a4={at('p2-04') - bA.from} />
      </Sequence>

      {/* 2-B 五道关总览：ig-open 单句镜（hold 播完冻结收台） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="2-B">
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="纳管管线 · 总览"
          cues={[{chapterId: 'ig-open', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')}]}
        />
      </Sequence>

      {/* 2-C 第一关登记：ig-ingest hold 链（recap 后置=画框遮盖，登记台装置让位） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="2-C">
        <IntakeLine station={1} at={at('p2-07') - bC.from} />
        <RegistryDesk a7={at('p2-07') - bC.from} a8={at('p2-08') - bC.from} />
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="第一关 · 登记"
          cues={[
            {chapterId: 'ig-ingest', at: at('p2-06') - bC.from, durationInFrames: dur('p2-06')},
            {chapterId: 'ig-ingest', at: at('p2-07') - bC.from, durationInFrames: dur('p2-07'), fit: 'hold'},
            {chapterId: 'ig-ingest', at: at('p2-08') - bC.from, durationInFrames: dur('p2-08'), fit: 'hold'},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 2-D 第二关归一：ig-normalize hold 链（规整台装置让位；承 2-C 链尾背靠背） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="2-D">
        <IntakeLine station={2} at={at('p2-10') - bD.from} />
        <NormalizeBench a10={at('p2-10') - bD.from} a11={at('p2-11') - bD.from} />
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="第二关 · 归一"
          cues={[
            {chapterId: 'ig-normalize', at: at('p2-09') - bD.from, durationInFrames: dur('p2-09')},
            {chapterId: 'ig-normalize', at: at('p2-10') - bD.from, durationInFrames: dur('p2-10'), fit: 'hold'},
            {chapterId: 'ig-normalize', at: at('p2-11') - bD.from, durationInFrames: dur('p2-11'), fit: 'hold'},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 2-E 第三关分类：ig-classify hold 链（挂牌位装置让位；承 2-D 链尾背靠背） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="2-E">
        <IntakeLine station={3} at={at('p2-13') - bE.from} />
        <TagRack a13={at('p2-13') - bE.from} />
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="第三关 · 分类"
          cues={[
            {chapterId: 'ig-classify', at: at('p2-12') - bE.from, durationInFrames: dur('p2-12')},
            {chapterId: 'ig-classify', at: at('p2-13') - bE.from, durationInFrames: dur('p2-13'), fit: 'hold'},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 2-F 第四关分级：ig-tier hold 链（p2-17 空窗留库位牌指针特写；承 2-E 链尾背靠背） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="2-F">
        <IntakeLine station={4} at={at('p2-16') - bF.from} />
        <TierRack a16={at('p2-16') - bF.from} a17={at('p2-17') - bF.from} />
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="第四关 · 分级"
          cues={[
            {chapterId: 'ig-tier', at: at('p2-14') - bF.from, durationInFrames: dur('p2-14')},
            {chapterId: 'ig-tier', at: at('p2-15') - bF.from, durationInFrames: dur('p2-15'), fit: 'hold'},
            {chapterId: 'ig-tier', at: at('p2-16') - bF.from, durationInFrames: dur('p2-16'), fit: 'hold'},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 2-G 第五关入册：ig-tag hold 链（p2-20..21 空窗留给目录条目卡弹出→盖章→飞落货架——
          M-001 接头锚，P7 桥段依赖其可见） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="2-G">
        <IntakeLine station={5} at={at('p2-19') - bG.from} />
        <IndexDesk a19={at('p2-19') - bG.from} a20={at('p2-20') - bG.from} a21={at('p2-21') - bG.from} />
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="第五关 · 入册"
          cues={[
            {chapterId: 'ig-tag', at: at('p2-18') - bG.from, durationInFrames: dur('p2-18')},
            {chapterId: 'ig-tag', at: at('p2-19') - bG.from, durationInFrames: dur('p2-19'), fit: 'hold'},
          ]}
        />
      </Sequence>

      {/* 2-H 当版页打印机 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="2-H">
        <PrintBench a22={at('p2-22') - bH.from} a23={at('p2-23') - bH.from} a24={at('p2-24') - bH.from} a25={at('p2-25') - bH.from} />
      </Sequence>

      {/* 2-I 金额对撞（fan trap 反例消融对照） */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="2-I">
        <AmountCrash a27={at('p2-27') - bI.from} a28={at('p2-28') - bI.from} a29={at('p2-29') - bI.from} a30={at('p2-30') - bI.from} />
      </Sequence>

      {/* 2-J 接缝：lmm-seam 首句 stretch、余句同章 hold */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="2-J">
        <ArchifyRecap
          slug="blueprint--layer-mechanism-map"
          caption="机制 · 跨轴接缝"
          cues={[
            {chapterId: 'lmm-seam', at: at('p2-31') - bJ.from, durationInFrames: dur('p2-31')},
            {chapterId: 'lmm-seam', at: at('p2-32') - bJ.from, durationInFrames: dur('p2-32'), fit: 'hold'},
          ]}
        />
      </Sequence>

      {/* 2-K 本仓骨架：代码走廊①（真实仓码） */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="2-K">
        <CodePane
          at={at('p2-34') - bK.from}
          lines={[
            'POST /interface/definitions  →  parse_definition(源文本)',
            '  ⚠ DefinitionParseError: Agent 规格缺少必填字段: name',
            '  ← HTTP 422（拒绝落库）',
            'materialize_all()  →  .agent/skills/<key>/SKILL.md（幂等投影）',
          ]}
          badge={{level: 'filled', note: '四类定义 · 一张表'}}
        />
        <TableToPage a35={at('p2-35') - bK.from} />
      </Sequence>

      {/* 2-L 常驻记忆：档案柜三问 + 对象一生收（p2-36 引入句先 hold 一拍，37..39 空窗给档案柜） */}
      <Sequence from={bL.from} durationInFrames={bL.durationInFrames} name="2-L">
        <MemoryCabinet a37={at('p2-37') - bL.from} a38={at('p2-38') - bL.from} a39={at('p2-39') - bL.from} />
        <ArchifyRecap
          slug="blueprint--object-lifecycle"
          caption="常驻记忆 · 对象一生"
          cues={[
            {chapterId: 'ol-full', at: at('p2-36') - bL.from, durationInFrames: dur('p2-36')},
            {chapterId: 'ol-full', at: at('p2-40') - bL.from, durationInFrames: dur('p2-40')},
          ]}
        />
      </Sequence>

      {/* 2-M 收束：影子板三标签 + 剖面推进切放行席位 */}
      <Sequence from={bM.from} durationInFrames={bM.durationInFrames} name="2-M">
        <Sequence from={0} durationInFrames={dur('p2-41')} name="2-M-影子板">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            {['在册', '可查', '带版次'].map((t, i) => (
              <StampTag key={t} text={t} delay={i * 14} />
            ))}
          </AbsoluteFill>
        </Sequence>
        <Sequence from={dur('p2-41')} durationInFrames={dur('p2-42')} name="2-M-推进">
          <FocusAuthority />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 「蓝图·目标态」角标（P2 纳管段 / P7 全幕共用；SceneTag 右侧小标）。 */
export const BlueprintTag: React.FC<{at: number}> = ({at}) => {
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
      <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.concept, letterSpacing: 1}}>蓝图 · 目标态</span>
    </div>
  );
};

/** 2-A 七类资产入柜 + 五源→投影箭头（map 内纯函数 progress，禁 hook）。 */
const ASSET_KINDS = ['定义', '记忆', '技能目录', '知识库', '血缘', '问答对', '标签策略'] as const;
const SevenAssets: React.FC<{a3: number; a4: number}> = ({a3, a4}) => {
  const frame = useCurrentFrame();
  const arrows = useProgress(a4, 16);
  const flow = useFlowDash({dash: 8, gap: 12, period: 30});
  const slotX = 167;
  const slotY = (i: number) => 516 + i * 36;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {ASSET_KINDS.map((k, i) => {
        const p = clamp01(progress(frame, a3 + i * 7, 16));
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: slotX,
              top: slotY(i) - (1 - p) * 350,
              width: 190,
              height: 30,
              borderRadius: 6,
              border: `1.5px solid ${theme.concept}`,
              background: theme.panel,
              opacity: p,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              color: theme.text,
            }}
          >
            {k}
          </div>
        );
      })}
      {/* 五源 → 投影位（身份规程→定义 / 工具技能→技能目录 / 手册→知识库） */}
      {['身份规程', '工具技能', '手册'].map((t, i) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: 150,
            top: 138 + i * 44,
            width: 132,
            height: 34,
            borderRadius: 6,
            border: `1.5px dashed ${theme.dim}`,
            color: theme.dim,
            background: theme.panel,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: arrows,
          }}
        >
          {t}
        </div>
      ))}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: arrows}}>
        {[0, 2, 3].map((slot, i) => (
          <g key={slot}>
            <path
              d={`M 292 ${160 + i * 44} C 420 ${170 + i * 44}, 420 ${slotY(slot) + 15}, ${slotX + 186} ${slotY(slot) + 15}`}
              fill="none"
              stroke={theme.dim}
              strokeWidth={2}
              strokeDasharray="7 8"
            />
            <path
              d={`M 292 ${160 + i * 44} C 420 ${170 + i * 44}, 420 ${slotY(slot) + 15}, ${slotX + 186} ${slotY(slot) + 15}`}
              fill="none"
              stroke={theme.dim}
              strokeWidth={2}
              opacity={0.65}
              {...flow}
            />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** 2-C 收货登记台：扫码逐项亮 + 台账落一行 + 指针虚线牵引回原箱（不搬本体）。 */
const SCAN_ROWS = ['件号 P/N', '批次 S/N', '供应商', '适航证 CoC'] as const;
const RegistryDesk: React.FC<{a7: number; a8: number}> = ({a7, a8}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(a7, 10);
  const ledger = useReveal('AMM-32-11 · 登记一行', {at: a8, cps: 14});
  const ledgerIn = clamp01(progress(frame, a8, 10));
  const pointerIn = clamp01(progress(frame, a8 + 16, 12));
  const flow = useFlowDash({dash: 7, gap: 10, period: 26});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 400,
          width: 1000,
          height: 400,
          borderRadius: 12,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: enter,
          padding: 20,
          boxSizing: 'border-box',
        }}
      >
        {/* 航材箱（本体不动） */}
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 130,
            width: 110,
            height: 92,
            borderRadius: 8,
            border: `2px solid ${theme.conceptDeep}`,
            background: withAlpha(theme.conceptDeep, 0.14),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: theme.conceptDeep,
          }}
        >
          航材箱
        </div>
        {/* 扫码逐项 */}
        {SCAN_ROWS.map((r, i) => {
          const rowIn = clamp01(progress(frame, a7 + 6 + i * 8, 10));
          const sweep = clamp01(progress(frame, a7 + 12 + i * 8, 16));
          return (
            <div key={r} style={{position: 'absolute', left: 210, top: 42 + i * 62, width: 430, height: 48, opacity: rowIn}}>
              <div style={{fontSize: 19, color: theme.text, marginBottom: 5}}>{r}</div>
              <div style={{position: 'relative', width: '100%', height: 12, borderRadius: 6, background: withAlpha(theme.concept, 0.1)}}>
                <div style={{position: 'absolute', left: 0, top: 0, width: `${sweep * 100}%`, height: '100%', borderRadius: 6, background: theme.concept, opacity: 0.8}} />
              </div>
            </div>
          );
        })}
        {/* 台账：账上先有一行 */}
        <div
          style={{
            position: 'absolute',
            left: 690,
            top: 60,
            width: 270,
            height: 210,
            borderRadius: 9,
            border: `1.5px solid ${theme.panelBorder}`,
            background: theme.bg,
            padding: 16,
            boxSizing: 'border-box',
            opacity: ledgerIn,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 12}}>台账</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.ok}}>{ledger}</div>
          <div style={{marginTop: 14, fontSize: 15, color: theme.dim}}>指针 · 不搬本体</div>
        </div>
        {/* 指针虚线：台账 → 原箱 */}
        <svg width={1000} height={400} style={{position: 'absolute', inset: 0, opacity: pointerIn}}>
          <path d="M 700 240 C 560 260, 300 260, 145 222" fill="none" stroke={theme.ok} strokeWidth={2} strokeDasharray="6 9" />
          <path d="M 700 240 C 560 260, 300 260, 145 222" fill="none" stroke={theme.ok} strokeWidth={2} opacity={0.7} {...flow} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

/** 2-D 开箱规整台：散乱内容块归位吸附四格标签 + 「无 LLM · 手工规整」角标。 */
const NORM_CELLS = ['章节路径', '内容模块', '多模态', '摘要梯'] as const;
const NormalizeBench: React.FC<{a10: number; a11: number}> = ({a10, a11}) => {
  const frame = useCurrentFrame();
  const grid = useStagger(4, {stride: 8, at: a10});
  const blocks = useStagger(8, {stride: 5, at: a10 + 6});
  const tagIn = clamp01(progress(frame, a11, 12));
  // 8 块散料 → 每格 2 块归位（起止坐标表驱动，纯函数插值）
  const SPREAD = [
    {sx: 500, sy: 350}, {sx: 1380, sy: 340}, {sx: 620, sy: 800}, {sx: 1300, sy: 810},
    {sx: 830, sy: 330}, {sx: 1050, sy: 820}, {sx: 470, sy: 640}, {sx: 1420, sy: 620},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {NORM_CELLS.map((c, j) => {
        const gx = 560 + (j % 2) * 420;
        const gy = 440 + Math.floor(j / 2) * 220;
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: gx,
              top: gy,
              width: 380,
              height: 180,
              borderRadius: 10,
              border: `2px dashed ${grid[j] > 0.2 ? theme.concept : theme.panelBorder}`,
              background: theme.panel,
              opacity: grid[j],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              color: theme.text,
              transform: `translateY(${(1 - grid[j]) * 18}px)`,
            }}
          >
            {c}
          </div>
        );
      })}
      {SPREAD.map((b, i) => {
        const j = Math.floor(i / 2);
        const gx = 560 + (j % 2) * 420 + 70 + (i % 2) * 200;
        const gy = 440 + Math.floor(j / 2) * 220 + 60;
        const k = blocks[i];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: b.sx + (gx - b.sx) * k,
              top: b.sy + (gy - b.sy) * k,
              width: 110,
              height: 58,
              borderRadius: 7,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.bg,
              opacity: 0.4 + 0.6 * k,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 870 - 90,
          fontSize: 19,
          color: theme.ok,
          border: `1.5px solid ${theme.ok}`,
          borderRadius: 8,
          padding: '6px 18px',
          background: theme.panel,
          opacity: tagIn,
        }}
      >
        无 LLM · 手工规整 ✓
      </div>
    </AbsoluteFill>
  );
};

/** 2-E 分类挂牌位：三枚治理牌挂上（形态/所属域/谁能看）。 */
const TAG3 = ['形态', '所属域', '谁能看'] as const;
const TagRack: React.FC<{a13: number}> = ({a13}) => {
  const drops = useStagger(3, {stride: 13, at: a13, dur: 16});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 575, top: 372, width: 770, height: 12, borderRadius: 6, background: theme.panelBorder}} />
      {TAG3.map((t, i) => {
        const k = drops[i];
        return (
          <div key={t} style={{position: 'absolute', left: 575 + i * 270, top: 384, opacity: Math.min(1, k * 2)}}>
            <svg width={230} height={54}>
              <line x1={115} y1={0} x2={115} y2={40} stroke={theme.panelBorder} strokeWidth={2} />
              <circle cx={115} cy={44} r={4} fill={theme.dim} />
            </svg>
            <div
              style={{
                width: 230,
                height: 130,
                marginTop: 6,
                borderRadius: 9,
                border: `2px solid ${k > 0.5 ? theme.concept : theme.panelBorder}`,
                background: theme.panel,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transform: `translateY(${(1 - Math.max(0, k)) * -54}px) rotate(${(1 - k) * -5}deg)`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>治理字段 {i + 1}</span>
              <span style={{fontSize: 27, color: theme.text}}>{t}</span>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 2-F 上架分层：L0 抽屉/L1 货架/L2 库位牌三层架 + 架侧基线标尺 + 库位牌=指针特写。 */
const TierRack: React.FC<{a16: number; a17: number}> = ({a16, a17}) => {
  const frame = useCurrentFrame();
  const layers = useStagger(3, {stride: 9, at: a16});
  const items = useStagger(5, {stride: 6, at: a16 + 8});
  const zoom = clamp01(progress(frame, a17, 14));
  const ptrIn = clamp01(progress(frame, a17 + 10, 12));
  const layersDef = [
    {name: 'L0 · 抽屉', sub: '≤ 256 字符', y: 430},
    {name: 'L1 · 货架', sub: '≤ 4000 字符', y: 556},
    {name: 'L2 · 库位牌', sub: '指针 · 本体在外', y: 682},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {layersDef.map((l, i) => (
        <div
          key={l.name}
          style={{
            position: 'absolute',
            left: 330,
            top: l.y,
            width: 720,
            height: 108,
            borderRadius: 10,
            border: `2px solid ${layers[i] > 0.2 ? theme.concept : theme.panelBorder}`,
            background: theme.panel,
            opacity: layers[i],
            transform: i === 2 ? `scale(${1 + 0.1 * zoom}) translateX(${zoom * 40}px)` : undefined,
            transformOrigin: 'left center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 26px',
            boxSizing: 'border-box',
          }}
        >
          <span style={{fontSize: 24, color: theme.text}}>{l.name}</span>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{l.sub}</span>
        </div>
      ))}
      {/* 物件按体积分流入层 */}
      {[0, 1, 2, 3, 4].map((i) => {
        const layer = i < 2 ? 0 : i < 4 ? 1 : 2;
        const tx = 360 + (i % 2) * 54;
        const ty = layersDef[layer].y + 34;
        const k = items[i];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 180 + (tx - 180) * k,
              top: 660 + (ty - 660) * k - (i === 4 ? 0 : 0),
              width: i === 4 ? 84 : 44,
              height: i === 4 ? 40 : 44,
              borderRadius: i === 4 ? 7 : 5,
              border: `1.5px solid ${i === 4 ? theme.conceptDeep : theme.panelBorder}`,
              background: theme.bg,
              opacity: 0.35 + 0.65 * k,
            }}
          />
        );
      })}
      {/* 基线标尺（Baseline-Anchored：刻度恒常驻） */}
      <div style={{position: 'absolute', left: 1110, top: 430, width: 4, height: 360, background: theme.panelBorder, borderRadius: 2, opacity: layers[1]}} />
      {[430, 646].map((y, i) => (
        <div key={y} style={{position: 'absolute', left: 1092, top: y, width: 40, height: 2, background: theme.dim, opacity: layers[1]}} />
      ))}
      <div style={{position: 'absolute', left: 1062, top: 410, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: layers[1]}}>256</div>
      <div style={{position: 'absolute', left: 1062, top: 652, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: layers[1]}}>4000</div>
      <div style={{position: 'absolute', left: 1040, top: 810, fontSize: 16, color: theme.dim, opacity: layers[1]}}>基线 · 字符上限</div>
      {/* p2-17 库位牌 = 指针特写：虚线牵到外部本体 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: ptrIn}}>
        <path d="M 1090 736 C 1220 740, 1260 760, 1330 776" fill="none" stroke={theme.conceptDeep} strokeWidth={2} strokeDasharray="6 8" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1340,
          top: 746,
          width: 190,
          height: 64,
          borderRadius: 9,
          border: `1.5px dashed ${theme.conceptDeep}`,
          color: theme.conceptDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          opacity: ptrIn,
        }}
      >
        本体 · 外部
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 700,
          fontSize: 17,
          color: theme.conceptDeep,
          border: `1.5px solid ${theme.conceptDeep}`,
          borderRadius: 7,
          padding: '4px 12px',
          background: theme.panel,
          opacity: ptrIn,
        }}
      >
        凭牌取
      </div>
    </AbsoluteFill>
  );
};

/** 2-G 画格台：轮廓格画成/信封盖上/地址编好 + 目录条目卡弹出→盖章→飞落货架首件。 */
const IndexDesk: React.FC<{a19: number; a20: number; a21: number}> = ({a19, a20, a21}) => {
  const frame = useCurrentFrame();
  const gridDraw = useDraw(a19, 22);
  const sealFlap = clamp01(progress(frame, a19 + 18, 12));
  const addr = useReveal('ctx://kb/amm/32-11', {at: a19 + 30, cps: 16});
  const cardPop = clamp01(progress(frame, a20, 12));
  const stampFlash = useImpulse({at: a20 + 14, dur: 18, peak: 1});
  const fly = useSpring('settle', {at: a20 + 26, dur: 30});
  const landed = clamp01(progress(frame, a20 + 58, 5));
  const glow = useImpulse({at: a21, dur: 26, peak: 1});
  // 飞行弧线：台口 (1018,544) → 货架首槽 (1549,427)，抛物线抬升 90px
  const fx = 1018 + (1549 - 1018) * fly;
  const fy = 544 + (427 - 544) * fly - Math.sin(Math.PI * fly) * 90;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 画格台 */}
      <div style={{position: 'absolute', left: 300, top: 400, width: 560, height: 340}}>
        <svg width={560} height={340}>
          <path
            d="M 20 20 H 540 V 320 H 20 Z M 20 126 H 540 M 20 232 H 540 M 193 20 V 320 M 366 20 V 320"
            fill="none"
            stroke={theme.concept}
            strokeWidth={2}
            {...gridDraw}
          />
        </svg>
        {/* 信封盖上 */}
        <div
          style={{
            position: 'absolute',
            left: 220,
            top: 60,
            width: 120,
            height: 74,
            borderRadius: 8,
            border: `2px solid ${theme.dim}`,
            background: theme.panel,
            opacity: sealFlap,
            transform: `scaleY(${0.2 + 0.8 * sealFlap})`,
          }}
        />
        <div style={{position: 'absolute', left: 26, top: 128, fontFamily: theme.mono, fontSize: 18, color: theme.ok}}>{addr}</div>
        <div style={{position: 'absolute', left: 26, bottom: 4, fontSize: 16, color: theme.dim, opacity: sealFlap}}>画格 · 打信封 · 编地址</div>
      </div>
      {/* 目录条目卡：台口弹出（版次/地址双标亮）→ 盖章 → 飞落货架 */}
      <div style={{position: 'absolute', left: 900, top: 470, opacity: cardPop * (1 - landed)}}>
        <CatalogCard at={a20} address="ctx://kb/amm/32-11" />
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
      {/* 飞行中的卡（弧线） */}
      <div style={{position: 'absolute', left: fx - 118, top: fy - 74, opacity: clamp01(fly) * (1 - landed)}}>
        <CatalogCard address="ctx://kb/amm/32-11" />
      </div>
      {/* 目录货架：首件入库（catalogCount 递增表达） */}
      <CatalogShelf count={Math.round(landed)} at={a19} style={{left: 1460, top: 330}} />
      <div
        style={{
          position: 'absolute',
          left: 1470,
          top: 780,
          fontSize: 17,
          color: theme.concept,
          border: `1.5px solid ${theme.concept}`,
          borderRadius: 7,
          padding: '4px 14px',
          background: theme.panel,
          opacity: clamp01(progress(frame, a21, 10)),
        }}
      >
        接头锚 · 记住这张卡
      </div>
      {/* 落架脉冲环（p2-21「记住这张卡」） */}
      <div
        style={{
          position: 'absolute',
          left: 1549 - 30,
          top: 427 - 30,
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

/** 2-H 当版页打印机：页出 → 页脚打印时刻走字 → 用毕入废纸盒 → 红叉角标。 */
const PrintBench: React.FC<{a22: number; a23: number; a24: number; a25: number}> = ({a22, a23, a24, a25}) => {
  const frame = useCurrentFrame();
  const body = clamp01(progress(frame, a22, 12));
  const out = useSpring('settle', {at: a23, dur: 45});
  const secs = Math.min(47, Math.floor(Math.max(0, frame - a24) / 3));
  const stampIn = clamp01(progress(frame, a24, 10));
  const bin = clamp01(progress(frame, a24 + 34, 14));
  const crossIn = clamp01(progress(frame, a25, 12));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 打印机本体 */}
      <div style={{position: 'absolute', left: 660, top: 330, width: 360, height: 170, borderRadius: 12, border: `2px solid ${theme.panelBorder}`, background: theme.panel, opacity: body}}>
        <div style={{position: 'absolute', left: 60, bottom: 0, width: 240, height: 10, background: theme.bg, borderRadius: 5}} />
        <div style={{position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', fontSize: 19, color: theme.dim}}>受控文档库 · 打印口</div>
        <div style={{position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>唯一母本的当版页输出</div>
      </div>
      {/* 页出 */}
      <div
        style={{
          position: 'absolute',
          left: 740,
          top: 500,
          width: 220,
          height: 300 * out,
          background: theme.paper,
          borderRadius: '0 0 6 6',
          overflow: 'hidden',
          padding: 14,
          boxSizing: 'border-box',
          opacity: (1 - bin) * (out > 0.02 ? 1 : 0),
          transform: `translate(${bin * 240}px, ${bin * 120}px) rotate(${bin * -14}deg) scale(${1 - bin * 0.25})`,
        }}
      >
        <div style={{fontSize: 17, color: theme.paperInk, lineHeight: 1.8}}>
          AMM 32-11-00
          <br />
          力矩值 45 N·m
          <br />
          <span style={{fontSize: 13, color: theme.paperInkDim, opacity: stampIn}}>打印时刻 04:12:{String(secs).padStart(2, '0')} · 用毕即废</span>
        </div>
      </div>
      {/* 废纸盒 */}
      <div style={{position: 'absolute', left: 1080, top: 620, width: 210, height: 130, borderRadius: 10, border: `2px solid ${theme.panelBorder}`, background: theme.panel, opacity: body}}>
        <div style={{position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', fontSize: 15, color: theme.dim}}>废纸盒</div>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 26 + i * 18,
              top: 44 + i * 22,
              width: 150,
              height: 66,
              background: theme.paper,
              borderRadius: 4,
              opacity: (0.35 + i * 0.2) * bin,
              transform: `rotate(${(i - 1) * 6}deg)`,
            }}
          />
        ))}
      </div>
      {/* 红叉角标：背下的力矩值 = 错 */}
      <div style={{position: 'absolute', left: 640, top: 840 - 90, display: 'flex', gap: 18, alignItems: 'center', opacity: crossIn}}>
        <span style={{fontSize: 22, color: theme.conceptDeep, border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 8, padding: '8px 18px', background: theme.panel}}>
          背下的力矩值 ✗
        </span>
        <span style={{fontSize: 19, color: theme.dim}}>要用 · 当场回母本取数</span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-I 金额对撞（fan trap 反例消融对照定式）：左=先连接再汇总（退化）右=先汇总再连接（对照）。 */
const AmountCrash: React.FC<{a27: number; a28: number; a29: number; a30: number}> = ({a27, a28, a29, a30}) => {
  const frame = useCurrentFrame();
  const struct = useStagger(3, {stride: 7, at: a27});
  const crash = clamp01(progress(frame, a28, 22));
  const right = clamp01(progress(frame, a29, 20));
  const verdict = clamp01(progress(frame, a30, 12));
  const spike = useImpulse({at: a28 + 8, dur: 22, peak: 1});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 左：先连接 · 再汇总（橙） */}
      <div style={{position: 'absolute', left: 180, top: 360, width: 720, height: 400, borderRadius: 12, border: `2px solid ${withAlpha(theme.conceptDeep, 0.8)}`, background: theme.panel, opacity: struct[0]}}>
        <div style={{padding: '14px 22px', fontSize: 21, color: theme.conceptDeep}}>先连接 · 再汇总</div>
        <svg width={720} height={330} style={{position: 'absolute', inset: 0, top: 44}}>
          <rect x={40} y={26} width={170} height={54} rx={8} fill="none" stroke={theme.text} strokeWidth={2} />
          <text x={62} y={60} fill={theme.text} fontSize={19}>订单 $100</text>
          {[0, 1, 2].map((i) => (
            <g key={i} opacity={struct[i]}>
              <line x1={210} y1={53} x2={430} y2={36 + i * 56} stroke={theme.conceptDeep} strokeWidth={2} />
              <rect x={430} y={12 + i * 56} width={150} height={46} rx={7} fill="none" stroke={theme.panelBorder} strokeWidth={1.5} />
              <text x={452} y={41 + i * 56} fill={theme.dim} fontSize={16}>事件 #{i + 1}</text>
            </g>
          ))}
          <text x={610} y={44} fill={theme.conceptDeep} fontSize={30} opacity={crash}>×3</text>
          <text x={240} y={300} fill={theme.conceptDeep} fontSize={27} opacity={crash}>
            $100 → ${Math.round(100 + 200 * crash)}
          </text>
        </svg>
      </div>
      {/* 右：先汇总 · 再连接（绿） */}
      <div style={{position: 'absolute', left: 1020, top: 360, width: 720, height: 400, borderRadius: 12, border: `2px solid ${withAlpha(theme.ok, 0.8)}`, background: theme.panel, opacity: right}}>
        <div style={{padding: '14px 22px', fontSize: 21, color: theme.ok}}>先汇总 · 再连接</div>
        <svg width={720} height={330} style={{position: 'absolute', inset: 0, top: 44}}>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={40} y={12 + i * 56} width={150} height={46} rx={7} fill="none" stroke={theme.panelBorder} strokeWidth={1.5} />
              <text x={62} y={41 + i * 56} fill={theme.dim} fontSize={16}>事件 #{i + 1}</text>
              <text x={210} y={41 + i * 56} fill={theme.ok} fontSize={16} opacity={right}>= $100</text>
            </g>
          ))}
          <line x1={210} y1={82} x2={430} y2={82} stroke={theme.ok} strokeWidth={2} opacity={right} />
          <rect x={430} y={55} width={170} height={54} rx={8} fill="none" stroke={theme.text} strokeWidth={2} opacity={right} />
          <text x={452} y={89} fill={theme.text} fontSize={19} opacity={right}>订单 $100</text>
          <text x={240} y={300} fill={theme.ok} fontSize={27} opacity={right}>
            整月 $200
          </text>
        </svg>
      </div>
      {/* 整月对照（左橙翻倍） + 尖刺 */}
      <div style={{position: 'absolute', left: 240, top: 800, display: 'flex', gap: 26, alignItems: 'baseline', opacity: crash}}>
        <span style={{fontSize: 24, color: theme.dim}}>整月</span>
        <span style={{fontSize: 40, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 ${14 * spike}px ${withAlpha(theme.conceptDeep, 0.8)}`}}>
          $<Counter from={200} to={440} start={a28} frames={26} />
        </span>
        <span style={{fontSize: 20, color: theme.dim}}>↖ ×3 尖刺</span>
      </div>
      {/* 判词条 + 实心徽 */}
      <div style={{position: 'absolute', left: 1020, top: 800, display: 'flex', gap: 30, alignItems: 'center', opacity: verdict}}>
        <span style={{fontSize: 23, color: theme.text, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, padding: '8px 20px', background: theme.panel}}>语法合法 · 答案全错</span>
      </div>
      <div style={{position: 'absolute', left: 180, top: 300, opacity: crash}}>
        <EvidenceBadge level="filled" at={a28} note="对照 200 · 退化 440" />
      </div>
    </AbsoluteFill>
  );
};

/** 2-K 表→打印页投影箭头（盘上文件 = 这张表打印的当版页）。 */
const TableToPage: React.FC<{a35: number}> = ({a35}) => {
  const k = useProgress(a35, 14);
  const flow = useFlowDash({dash: 7, gap: 10, period: 26});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 828, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, opacity: k}}>
        <span style={{fontSize: 19, color: theme.text, border: `1.5px solid ${theme.concept}`, borderRadius: 8, padding: '7px 18px', background: theme.panel}}>definitions 表</span>
        <svg width={140} height={24}>
          <line x1={0} y1={12} x2={124} y2={12} stroke={theme.concept} strokeWidth={2.5} strokeDasharray="8 8" />
          <line x1={0} y1={12} x2={124} y2={12} stroke={theme.concept} strokeWidth={2.5} opacity={0.7} {...flow} />
          <path d="M 124 12 l -10 -6 v 12 Z" fill={theme.concept} />
        </svg>
        <span style={{fontSize: 19, color: theme.dim, border: `1.5px dashed ${theme.dim}`, borderRadius: 8, padding: '7px 18px', background: theme.panel}}>盘上文件 · 当版页</span>
      </div>
    </AbsoluteFill>
  );
};

/** 2-L 常驻记忆档案柜：三问标签 + 两路答案 + 厚度两档封顶/截断标记。 */
const MemoryCabinet: React.FC<{a37: number; a38: number; a39: number}> = ({a37, a38, a39}) => {
  const frame = useCurrentFrame();
  const qs = useStagger(3, {stride: 12, at: a37});
  const ans = clamp01(progress(frame, a38, 14));
  const gauge = clamp01(progress(frame, a39, 14));
  const seal = clamp01(progress(frame, a39 + 14, 10));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 档案柜 */}
      <div style={{position: 'absolute', left: 460, top: 380, width: 640, height: 430, borderRadius: 12, border: `2px solid ${theme.panelBorder}`, background: theme.panel, padding: 18, boxSizing: 'border-box'}}>
        <div style={{fontSize: 22, color: theme.text, marginBottom: 14}}>技术档案 · 常驻记忆</div>
        {/* 三问标签 */}
        {['谁写', '多厚', '写满'].map((t, i) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: 34,
              top: 90 + i * 74,
              width: 150,
              height: 56,
              borderRadius: 8,
              border: `1.5px solid ${theme.concept}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              color: theme.text,
              background: theme.bg,
              opacity: qs[i],
              transform: `translateY(${(1 - qs[i]) * 16}px)`,
            }}
          >
            {t}
          </div>
        ))}
        {/* 两路答案 */}
        <div style={{position: 'absolute', left: 230, top: 96, width: 380, display: 'flex', flexDirection: 'column', gap: 16, opacity: ans}}>
          <div style={{fontSize: 18, color: theme.text, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, padding: '8px 14px', background: theme.bg}}>
            两路 · 笔笔留痕
          </div>
          <div style={{fontSize: 18, color: theme.text, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, padding: '8px 14px', background: theme.bg}}>
            自编 · 先过防注入
          </div>
          <div style={{fontSize: 16, color: theme.dim}}>常驻 · 不挤占检索</div>
        </div>
      </div>
      {/* 厚度两档封顶标尺 */}
      <div style={{position: 'absolute', left: 1180, top: 390, width: 4, height: 380, background: theme.panelBorder, borderRadius: 2, opacity: gauge}} />
      {[0.35, 0.72].map((f, i) => (
        <div key={i} style={{position: 'absolute', left: 1160, top: 390 + f * 380, width: 44, height: 3, background: theme.dim, opacity: gauge}} />
      ))}
      <div style={{position: 'absolute', left: 1120, top: 380, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: gauge}}>档 1</div>
      <div style={{position: 'absolute', left: 1120, top: 390 + 0.72 * 380, fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: gauge}}>档 2 · 封顶</div>
      <div style={{position: 'absolute', left: 1120, top: 800, fontSize: 16, color: theme.dim, opacity: gauge}}>厚度两档封顶</div>
      {/* 截断标记章（写满按比例截断 · 标记在案） */}
      <div
        style={{
          position: 'absolute',
          left: 1330,
          top: 560,
          fontSize: 19,
          color: theme.conceptDeep,
          border: `2px solid ${theme.conceptDeep}`,
          borderRadius: 9,
          padding: '8px 16px',
          background: theme.panel,
          transform: `rotate(-5deg) scale(${seal})`,
          opacity: seal,
        }}
      >
        截断 · 标记在案
      </div>
    </AbsoluteFill>
  );
};

/** 2-M 影子板三标签（资产轴要义）。 */
const StampTag: React.FC<{text: string; delay: number}> = ({text, delay}) => {
  const e = useSpring('settle', {at: delay, dur: 16});
  return (
    <div style={{opacity: e, padding: '10px 24px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 30, color: theme.ok, background: withAlpha(theme.ok, 0.08), transform: `translateY(${(1 - e) * 18}px)`}}>
      {text}
    </div>
  );
};

/** 2-M 剖面推进切放行席位（下一间工位）。 */
const FocusAuthority: React.FC = () => {
  const push = usePushIn(0, {scale: 0.1, dur: 70});
  return (
    <div style={{position: 'absolute', inset: 0, transformOrigin: '28% 58%', transform: push}}>
      <HangarCrossSection built highlight="authority" at={0} />
    </div>
  );
};

/** 代码走廊终端（v2 P2MasterPage 原件迁移；P5 代码走廊②同款复用）。 */
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
            <EvidenceBadge level={badge.level} at={at + (rows.length - 1) * 12 + 5} note={badge.note} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
