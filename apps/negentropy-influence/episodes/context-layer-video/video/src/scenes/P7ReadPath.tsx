/** P7 读路径：七道工序（p7-01..p7-31，31 句；storyboard「P7 读路径：七道工序」节）。
 *
 *  10 镜 / 14 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   7-A fco-objects@p7-01（stretch）→ fco-txn@p7-02（跨 p7-02..03 hold——末帧含 symptoms，
 *       p7-03 三症状句正对冻结终态）· 7-B rp-open hold 链@p7-04..05（承 7-A 尾镜界背靠背 →
 *       lead=false；问题卡在顶部安全带恒可读）+ 七道工序横轨建立@p7-06
 *   7-C rp-resolve@p7-07 + 门禁核验叠角（p7-08 刷证/订单域✓薪资域✗/绿栏、p7-09 权限实时）
 *   7-D rp-plan@p7-10 + 领班排程板（p7-11 预算条切分各域）
 *   7-E rp-retrieve@p7-12 → hold@p7-17（写读拼缝句）+ ig-tag@p7-15（「还记得那张目录条目卡吗」
 *       ——回放 P2 第五关制卡现场；双路取料/条目卡桥段装置 p7-13..14、p7-16 留空窗保可读，
 *       recap 后置=画框遮盖）+ p7-17 写读拼缝闪钢蓝
 *   7-F rp-fuse@p7-18 + 台面摊开重排（p7-19 权威页压过声量页置顶）
 *   7-G rp-guard@p7-20 → hold@p7-21b（五检查白话翻译句）+ 五项检查灯（p7-21）+ 客户手机号表
 *       拦截走橙分流道进 dropped 留痕盒（p7-22，只进不改 X-001 核对）+ p7-23 留痕记录条目滚出
 *   7-H rp-compose@p7-24 + 工卡夹装夹（p7-25 预算红线扫过、超线页抽出——倒 U 执法）
 *   7-I rp-emit@p7-26 + 交付开工（p7-27 递包、p7-28 地址+版次双标亮 uri@version）
 *   7-J 全轨回望（七格全章稳态）+ 问题卡与答案包首尾对接（p7-30）+ 色调转灰预告下一幕
 *  幕级常驻件：走查问题卡（p7-04 起挂起至幕末，顶部安全带以下）+「蓝图·目标态」角标全幕。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {clamp01, progress, useDraw, useEnter, useFlowDash, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {CatalogShelf} from '../components/HangarCrossSection';
import {CatalogCard} from '../components/CatalogCard';
import {SEVEN_STATIONS_GEOM, SevenStations} from '../components/SevenStations';
import {BlueprintTag} from './P2Asset';

export const P7ReadPath: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p7-01', 'p7-03');
  const bB = w('p7-04', 'p7-06');
  const bC = w('p7-07', 'p7-09');
  const bD = w('p7-10', 'p7-11');
  const bE = w('p7-12', 'p7-17');
  const bF = w('p7-18', 'p7-19');
  const bG = w('p7-20', 'p7-23');
  const bH = w('p7-24', 'p7-25');
  const bI = w('p7-26', 'p7-28');
  const bJ = w('p7-29', 'p7-31');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P7" tagline="读路径 · 七道工序" accent={theme.concept} />
      {/* 「蓝图·目标态」角标：全幕常驻（SceneTag 右侧小标） */}
      <BlueprintTag at={6} />

      {/* 走查问题卡：p7-04 起挂起至幕末（顶部安全带以下，archify 画框上方恒可见） */}
      <Sequence from={at('p7-04')} durationInFrames={scene.durationInFrames - at('p7-04')} name="问题卡-贯穿">
        <QuestionCard at={0} />
      </Sequence>

      {/* 7-A 装配事务 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="7-A">
        <ArchifyRecap
          slug="blueprint--first-class-object"
          caption="每轮装配事务"
          cues={[
            {chapterId: 'fco-objects', at: at('p7-01') - bA.from, durationInFrames: dur('p7-01')},
            {chapterId: 'fco-txn', at: at('p7-02') - bA.from, durationInFrames: dur('p7-02') + dur('p7-03')},
          ]}
        />
      </Sequence>

      {/* 7-B 走查问题：rp-open hold 链（p7-04 走查设问起回放总览；问题卡顶部安全带恒可读） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="7-B">
        <ArchifyRecap
          slug="read-pipeline"
          caption="读路径 · 总览"
          cues={[
            {chapterId: 'rp-open', at: at('p7-04') - bB.from, durationInFrames: dur('p7-04')},
            {chapterId: 'rp-open', at: at('p7-05') - bB.from, durationInFrames: dur('p7-05'), fit: 'hold'},
          ]}
          lead={false}
        />
        <Sequence from={at('p7-06') - bB.from} durationInFrames={dur('p7-06')} name="7-B-横轨">
          <SevenStations at={0} station={1} />
        </Sequence>
      </Sequence>

      {/* 7-C 第一道 Resolve：门禁核验（盖章 1） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="7-C">
        <ArchifyRecap
          slug="read-pipeline"
          caption="① 解析主体"
          cues={[{chapterId: 'rp-resolve', at: at('p7-07') - bC.from, durationInFrames: dur('p7-07')}]}
        />
        <Sequence from={at('p7-08') - bC.from} durationInFrames={dur('p7-08', 'p7-09')} name="7-C-门禁">
          <GateCheck a8={0} a9={at('p7-09') - at('p7-08')} />
          <SevenStations at={0} station={1} />
        </Sequence>
      </Sequence>

      {/* 7-D 第二道 Plan：领班派工排程（盖章 2） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="7-D">
        <ArchifyRecap
          slug="read-pipeline"
          caption="② 定计划"
          cues={[{chapterId: 'rp-plan', at: at('p7-10') - bD.from, durationInFrames: dur('p7-10')}]}
        />
        <Sequence from={at('p7-11') - bD.from} durationInFrames={dur('p7-11')} name="7-D-排程">
          <DispatchBoard at={0} />
          <SevenStations at={0} station={2} />
        </Sequence>
      </Sequence>

      {/* 7-E 第三道 Retrieve：rp-retrieve@12 → ig-tag@15（回放 P2 制卡现场）→ rp-retrieve hold@17
          （写读拼缝句）；双路取料/条目卡桥段（p7-13..14、16）留空窗保可读，recap 后置遮盖 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="7-E">
        <DualRetrieve
          a13={at('p7-13') - bE.from}
          a14={at('p7-14') - bE.from}
          a16={at('p7-16') - bE.from}
          a17={at('p7-17') - bE.from}
        />
        <Sequence from={at('p7-16') - bE.from} durationInFrames={dur('p7-16', 'p7-17')} name="7-E-横轨">
          <SevenStations at={0} station={3} />
        </Sequence>
        <ArchifyRecap
          slug="read-pipeline"
          caption="③ 取料 · 双路"
          cues={[
            {chapterId: 'rp-retrieve', at: at('p7-12') - bE.from, durationInFrames: dur('p7-12')},
            {chapterId: 'rp-retrieve', at: at('p7-17') - bE.from, durationInFrames: dur('p7-17'), fit: 'hold'},
          ]}
        />
        <ArchifyRecap
          slug="ingest-pipeline"
          caption="目录条目卡 · 制卡回放"
          cues={[{chapterId: 'ig-tag', at: at('p7-15') - bE.from, durationInFrames: dur('p7-15'), fit: 'hold'}]}
        />
      </Sequence>

      {/* 7-F 第四道 Fuse：台面摊开重排（盖章 4） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="7-F">
        <ArchifyRecap
          slug="read-pipeline"
          caption="④ 融合重排"
          cues={[{chapterId: 'rp-fuse', at: at('p7-18') - bF.from, durationInFrames: dur('p7-18')}]}
        />
        <Sequence from={at('p7-19') - bF.from} durationInFrames={dur('p7-19')} name="7-F-台面">
          <FuseTable at={0} />
          <SevenStations at={0} station={4} />
        </Sequence>
      </Sequence>

      {/* 7-G 第五道 Guard：rp-guard@20 → hold@p7-21b（五检查白话翻译句）；五灯/拦截/留痕盒
          （p7-21..23）留空窗保可读，recap 后置遮盖 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="7-G">
        <GuardLamps a21={at('p7-21') - bG.from} a22={at('p7-22') - bG.from} a23={at('p7-23') - bG.from} />
        <Sequence from={at('p7-22') - bG.from} durationInFrames={dur('p7-22', 'p7-23')} name="7-G-横轨">
          <SevenStations at={0} station={5} />
        </Sequence>
        <ArchifyRecap
          slug="read-pipeline"
          caption="⑤ 过闸 · 五项检查"
          cues={[
            {chapterId: 'rp-guard', at: at('p7-20') - bG.from, durationInFrames: dur('p7-20')},
            {chapterId: 'rp-guard', at: at('p7-21b') - bG.from, durationInFrames: dur('p7-21b'), fit: 'hold'},
          ]}
        />
      </Sequence>

      {/* 7-H 第六道 Compose：预算红线执法（盖章 6） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="7-H">
        <ArchifyRecap
          slug="read-pipeline"
          caption="⑥ 裁剪 · 装夹"
          cues={[{chapterId: 'rp-compose', at: at('p7-24') - bH.from, durationInFrames: dur('p7-24')}]}
        />
        <Sequence from={at('p7-25') - bH.from} durationInFrames={dur('p7-25')} name="7-H-装夹">
          <ClampFolder at={0} />
          <SevenStations at={0} station={6} />
        </Sequence>
      </Sequence>

      {/* 7-I 第七道 Emit：交付开工（盖章 7） */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="7-I">
        <ArchifyRecap
          slug="read-pipeline"
          caption="⑦ 交付 · Emit"
          cues={[{chapterId: 'rp-emit', at: at('p7-26') - bI.from, durationInFrames: dur('p7-26')}]}
        />
        <DeliverBundle a27={at('p7-27') - bI.from} a28={at('p7-28') - bI.from} />
        <Sequence from={at('p7-27') - bI.from} durationInFrames={dur('p7-27', 'p7-28')} name="7-I-横轨">
          <SevenStations at={0} station={7} />
        </Sequence>
      </Sequence>

      {/* 7-J 走查收束：全轨回望 + 首尾对接 + 色调转灰 */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="7-J">
        <Recap
          a29={at('p7-29') - bJ.from}
          a30={at('p7-30') - bJ.from}
          a31={at('p7-31') - bJ.from}
          shotDur={bJ.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 走查示例问题卡（全幕贯穿）：打字机入场后常驻顶部安全带以下。 */
const QuestionCard: React.FC<{at: number}> = ({at}) => {
  const text = useReveal('上季度 · 华东区 · 重复购买率', {at: at + 6, cps: 10});
  const o = useProgress(at, 10);
  return (
    <div
      style={{
        position: 'absolute',
        left: 630,
        top: 66,
        width: 660,
        height: 58,
        borderRadius: 10,
        border: `2px solid ${theme.concept}`,
        background: withAlpha(theme.concept, 0.1),
        opacity: o,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: 27,
        color: theme.text,
        letterSpacing: 1,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.concept}}>Q</span>
      {text}
    </div>
  );
};

/** 7-C 门禁核验：工卡刷证 + 域权限双检（订单域✓/薪资域✗）+ 绿栏放行 + 权限天花板实时求值。 */
const GateCheck: React.FC<{a8: number; a9: number}> = ({a8, a9}) => {
  const frame = useCurrentFrame();
  const swipe = clamp01(progress(frame, a8 + 4, 18));
  const chips = useStagger(2, {stride: 8, at: a8 + 14});
  const bar = clamp01(progress(frame, a8 + 26, 14));
  const ceil = clamp01(progress(frame, a9, 12));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 权限天花板（p7-09）：实时求值 */}
      <div
        style={{
          position: 'absolute',
          left: 510,
          top: 186,
          width: 900,
          height: 16,
          borderRadius: 8,
          background: withAlpha(theme.conceptDeep, 0.25),
          border: `1.5px solid ${theme.conceptDeep}`,
          opacity: ceil,
        }}
      />
      <div style={{position: 'absolute', left: 510, top: 152, fontSize: 17, color: theme.conceptDeep, opacity: ceil}}>权限天花板 · 实时求值</div>
      {/* 刷证台 */}
      <div
        style={{
          position: 'absolute',
          left: 510,
          top: 230,
          width: 900,
          height: 300,
          borderRadius: 12,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontSize: 20, color: theme.dim}}>工位① · 门禁核验</div>
        {/* 刷证槽 + 工卡滑过 */}
        <div style={{position: 'relative', marginTop: 22, width: 420, height: 84}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: 9, border: `2px solid ${theme.panelBorder}`, background: theme.bg}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 38, height: 6, background: theme.panelBorder}} />
          <div
            style={{
              position: 'absolute',
              left: -150 + swipe * 400,
              top: 22,
              width: 96,
              height: 58,
              borderRadius: 6,
              border: `2px solid ${theme.concept}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 14,
              color: theme.concept,
            }}
          >
            工卡
          </div>
        </div>
        {/* 域权限双检 */}
        <div style={{display: 'flex', gap: 20, marginTop: 26}}>
          {[
            {t: '订单域', mark: '✓', ok: true},
            {t: '薪资域', mark: '✗', ok: false},
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
              {d.t} {d.mark}
            </span>
          ))}
        </div>
        {/* 绿栏放行 */}
        <div style={{marginTop: 26, width: 420, height: 34, borderRadius: 7, border: `1.5px solid ${withAlpha(theme.ok, 0.7)}`, overflow: 'hidden'}}>
          <div style={{width: `${bar * 100}%`, height: '100%', background: withAlpha(theme.ok, 0.5)}} />
        </div>
        <div style={{marginTop: 8, fontSize: 16, color: theme.ok, opacity: bar}}>放行</div>
      </div>
    </AbsoluteFill>
  );
};

/** 7-D 领班派工排程板：本卡任务 + 预算条按域切分。 */
const DispatchBoard: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(at, 10);
  const segs = useStagger(3, {stride: 8, at: at + 8});
  const segDef = [
    {t: '订单域', w: 385, c: theme.concept},
    {t: '知识库', w: 175, c: theme.panelBorder},
    {t: '记忆', w: 140, c: theme.panelBorder},
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
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontSize: 20, color: theme.dim}}>工位② · 派工排程</span>
          <span style={{fontSize: 17, color: theme.concept, border: `1.5px solid ${theme.concept}`, borderRadius: 7, padding: '3px 12px'}}>领班</span>
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 22,
            color: theme.text,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 8,
            padding: '10px 18px',
            background: theme.bg,
            display: 'inline-block',
          }}
        >
          本卡 · 重复购买率
        </div>
        <div style={{marginTop: 30, fontSize: 17, color: theme.dim}}>预算 · 分域</div>
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
                fontSize: 17,
                color: i === 0 ? theme.concept : theme.dim,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {segs[i] > 0.6 ? s.t : ''}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 7-E 双路取料：精确路（题库命中）+ 召回路（150 候选）汇入 Retrieve；目录条目卡自货架
 *  起飞弧线落入 Retrieve 高亮框（同物同形 + 同一盖章闪光）；p7-17 写读拼缝闪钢蓝。 */
const RETRIEVE = {x: 870, y: 330, w: 180, h: 110};
const SHELF_SLOT = {x: 1639, y: 267};
const DualRetrieve: React.FC<{a13: number; a14: number; a16: number; a17: number}> = ({a13, a14, a16, a17}) => {
  const frame = useCurrentFrame();
  const flow = useFlowDash({dash: 8, gap: 11, period: 26});
  const hit = clamp01(progress(frame, a13, 14));
  const recall = clamp01(progress(frame, a14, 16));
  const fly = useSpring('settle', {at: a16, dur: 32});
  const landed = clamp01(progress(frame, a16 + 34, 5));
  const stampFlash = useImpulse({at: a16 + 32, dur: 18});
  const seamFlash = useImpulse({at: a17, dur: 26});
  const seamIn = clamp01(progress(frame, a17, 10));
  const fx = SHELF_SLOT.x + (RETRIEVE.x + RETRIEVE.w / 2 - SHELF_SLOT.x) * fly;
  const fy = SHELF_SLOT.y + (RETRIEVE.y + RETRIEVE.h / 2 - SHELF_SLOT.y) * fly - Math.sin(Math.PI * fly) * 110;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
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
        <span style={{fontSize: 19, color: theme.ok}}>重复购买率 · 命中</span>
      </div>
      {/* 召回路：150 候选 → top 20 */}
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
            left: -110,
            top: 108,
            fontSize: 17,
            color: theme.dim,
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 7,
            padding: '4px 12px',
            background: theme.panel,
          }}
        >
          150 候选 · 重排截断
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
      {/* 目录货架（P2 接头锚的物理落点）+ 起飞脉冲 */}
      <CatalogShelf count={1} at={a13 - 40} style={{left: 1550, top: 170}} />
      <div
        style={{
          position: 'absolute',
          left: SHELF_SLOT.x - 26,
          top: SHELF_SLOT.y - 26,
          width: 52,
          height: 52,
          borderRadius: 30,
          border: `2px solid ${theme.concept}`,
          opacity: (1 - fly) * clamp01(progress(frame, a16 - 12, 8)),
          transform: `scale(${0.6 + fly * 0.8})`,
        }}
      />
      {/* 飞行中的目录条目卡（同物同形：钢蓝 2px + 版次 + 地址） */}
      <div style={{position: 'absolute', left: fx - 118, top: fy - 74, opacity: clamp01(fly) * (1 - landed)}}>
        <CatalogCard address="ctx://kb/amm/32-11" />
      </div>
      {/* 落位盖章闪光（与工位③盖章同一拍） */}
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
      {/* p7-17 写读拼缝闪钢蓝 */}
      <div style={{position: 'absolute', inset: 0, opacity: seamIn}}>
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          <line x1={960} y1={150} x2={960} y2={560} stroke={theme.concept} strokeWidth={2.5} strokeDasharray="10 9" opacity={0.4 + 0.6 * seamFlash} />
        </svg>
        <span style={{position: 'absolute', left: 880, top: 562, fontSize: 17, color: theme.concept, opacity: 0.5 + 0.5 * seamFlash}}>写 · 入库</span>
        <span style={{position: 'absolute', left: 985, top: 562, fontSize: 17, color: theme.concept, opacity: 0.5 + 0.5 * seamFlash}}>读 · 取用</span>
      </div>
    </AbsoluteFill>
  );
};

/** 7-F 台面摊开重排：多页摊开，权威页压过声量页置顶。 */
const FuseTable: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const fan = useStagger(4, {stride: 7, at});
  const swap = useSpring('settle', {at: at + 16, dur: 24});
  const pages = [
    {t: '声量 · 引用 ×200', hot: false},
    {t: '普通页', hot: false},
    {t: '普通页', hot: false},
    {t: '权威 · v3', hot: true},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 台面 */}
      <div style={{position: 'absolute', left: 560, top: 430, width: 800, height: 10, borderRadius: 5, background: theme.panelBorder, opacity: fan[0]}} />
      {pages.map((p, i) => {
        // 置顶重排：权威页（i=3）与声量页（i=0）换位
        const slotFrom = i < 2 ? i : i;
        const target = i === 3 ? 0 : i === 0 ? 3 : i;
        const x0 = 700 + slotFrom * 130;
        const x1 = 700 + target * 130;
        const x = x0 + (x1 - x0) * swap;
        const lift = (i === 3 ? swap : i === 0 ? -swap * 0.4 : 0) * 26;
        return (
          <div
            key={p.t}
            style={{
              position: 'absolute',
              left: x,
              top: 240 - lift,
              width: 150,
              height: 190,
              borderRadius: 8,
              border: `2px solid ${p.hot ? theme.concept : theme.panelBorder}`,
              background: theme.panel,
              opacity: fan[i] * (p.hot ? 1 : 0.8),
              transform: `rotate(${(i - 1.5) * 5}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: p.hot ? 19 : 16,
              color: p.hot ? theme.concept : theme.dim,
              textAlign: 'center',
              padding: 8,
              boxSizing: 'border-box',
              zIndex: p.hot ? 2 : 1,
            }}
          >
            {p.t}
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 470,
          fontSize: 19,
          color: theme.concept,
          border: `1.5px solid ${theme.concept}`,
          borderRadius: 7,
          padding: '4px 14px',
          background: theme.panel,
          opacity: clamp01(progress(frame, at + 30, 10)),
        }}
      >
        权威 &gt; 声量
      </div>
    </AbsoluteFill>
  );
};

/** 7-G 五项检查灯 + 拦截分流：候选「客户手机号表」在隐私项被拦、走橙道进 dropped 盒；留痕条目滚出。 */
const LAMPS = ['可见性', '作用域', '效力', '隐私', '指令越权'] as const;
const GuardLamps: React.FC<{a21: number; a22: number; a23: number}> = ({a21, a22, a23}) => {
  const frame = useCurrentFrame();
  const checks = useStagger(5, {stride: 6, at: a21});
  const candIn = clamp01(progress(frame, a22, 10));
  const divert = clamp01(progress(frame, a22 + 10, 20));
  const caught = clamp01(progress(frame, a22 + 26, 8));
  const rows = useStagger(3, {stride: 9, at: a23});
  const boxC = {
    x: SEVEN_STATIONS_GEOM.dropped.x + SEVEN_STATIONS_GEOM.dropped.w / 2,
    y: SEVEN_STATIONS_GEOM.dropped.y + SEVEN_STATIONS_GEOM.dropped.h / 2,
  };
  // 拦截飞行：候选卡自 (1500,300) 沿弧线进 dropped 盒（几何取 SevenStations SSOT）
  const cx = 1500 + (boxC.x - 1500) * divert;
  const cy = 300 + (boxC.y - 300) * divert - Math.sin(Math.PI * divert) * 60;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {LAMPS.map((t, i) => {
        const bad = i === 3;
        const on = bad ? clamp01(progress(frame, a22 + 20, 8)) : checks[i];
        return (
          <div key={t} style={{position: 'absolute', left: 385 + i * 225, top: 240, width: 190, opacity: checks[i] > 0 ? 1 : 0, textAlign: 'center'}}>
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
            <div style={{fontSize: 18, color: bad ? theme.conceptDeep : theme.text, marginTop: 8}}>{t}</div>
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
          top: 350,
          width: 380,
          borderRadius: 10,
          border: `1.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: '14px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 10}}>dropped · 留痕</div>
        {['何时 · 04:12', '拦了 · 手机号表', '为何 · 隐私'].map((t, i) => (
          <div key={t} style={{fontSize: 18, color: theme.text, lineHeight: 2, opacity: rows[i]}}>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 7-H 工卡夹装夹：预算红线自上而下扫描、超线页被抽出、余页装夹。 */
const ClampFolder: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const enter = useProgress(at, 10);
  const sweep = clamp01(progress(frame, at + 6, 34));
  const lineY = 220 + sweep * 300;
  // 五页：底部三页越线被抽出（错峰），顶部两页装夹
  const pages = [0, 1, 2, 3, 4].map((i) => ({y: 300 + i * 44, pull: i >= 2 ? clamp01(progress(frame, at + 24 + (i - 2) * 7, 16)) : 0}));
  const clampShut = clamp01(progress(frame, at + 52, 14));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 760, top: 220, width: 400, height: 320, opacity: enter}}>
        {/* 页堆 */}
        {pages.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 40 + p.pull * 480,
              top: p.y - 220 + 220,
              width: 320 - i * 14,
              height: 36,
              borderRadius: 6,
              border: `1.5px solid ${p.pull > 0 ? theme.conceptDeep : theme.panelBorder}`,
              background: theme.panel,
              opacity: (p.pull > 0 ? 0.9 : 0.85) * (1 - p.pull * 0.85),
            }}
          />
        ))}
        {/* 装夹翻盖（余页夹住） */}
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 286,
            width: 360,
            height: 12,
            borderRadius: 6,
            background: theme.concept,
            transform: `translateY(${-40 * (1 - clampShut)}px)`,
            opacity: clampShut,
          }}
        />
        <div style={{position: 'absolute', left: 20, top: 540 - 220, fontSize: 17, color: theme.dim}}>工卡夹 · 装夹</div>
      </div>
      {/* 预算红线（倒 U 执法）：自上而下扫描 */}
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: lineY,
          width: 520,
          height: 3,
          background: theme.conceptDeep,
          boxShadow: `0 0 10px ${withAlpha(theme.conceptDeep, 0.8)}`,
          opacity: sweep > 0 && sweep < 1 ? 1 : 0.4,
        }}
      />
      <div style={{position: 'absolute', left: 1230, top: lineY - 12, fontFamily: theme.mono, fontSize: 16, color: theme.conceptDeep}}>预算红线</div>
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 580,
          fontSize: 18,
          color: theme.conceptDeep,
          border: `1.5px solid ${theme.conceptDeep}`,
          borderRadius: 7,
          padding: '4px 14px',
          background: theme.panel,
          opacity: clamp01(progress(frame, at + 30, 10)),
        }}
      >
        倒 U · 在此执法
      </div>
    </AbsoluteFill>
  );
};

/** 7-I 交付开工：问题进 / 配好料的 ContextBundle 出，地址+版次双标（uri@version）。 */
const DeliverBundle: React.FC<{a27: number; a28: number}> = ({a27, a28}) => {
  const frame = useCurrentFrame();
  const enter = clamp01(progress(frame, a27, 12));
  const flow = useFlowDash({dash: 8, gap: 11, period: 26});
  const tags = useStagger(2, {stride: 8, at: a28});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 问题 → 包 → 机位 */}
      <div style={{position: 'absolute', left: 560, top: 340, width: 170, height: 64, borderRadius: 9, border: `1.5px solid ${theme.panelBorder}`, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: theme.dim, opacity: enter}}>
        问 · 这头进
      </div>
      <div
        style={{
          position: 'absolute',
          left: 820,
          top: 270,
          width: 280,
          height: 200,
          borderRadius: 12,
          border: `2.5px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.1),
          opacity: enter,
          padding: 18,
          boxSizing: 'border-box',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.concept}}>ContextBundle</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14}}>
          {Array.from({length: 8}, (_, i) => (
            <div key={i} style={{height: 34, borderRadius: 5, border: `1.5px solid ${i < 7 ? theme.ok : theme.panelBorder}`, color: i < 7 ? theme.ok : theme.dim, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {i < 7 ? '✓' : ''}
            </div>
          ))}
        </div>
        <div style={{marginTop: 12, fontSize: 15, color: theme.dim}}>配好料 · 刚好够这一轮</div>
      </div>
      <div style={{position: 'absolute', left: 1190, top: 340, width: 170, height: 64, borderRadius: 9, border: `1.5px solid ${theme.panelBorder}`, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: theme.dim, opacity: enter}}>
        机位 · 那头出
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: enter}}>
        <line x1={734} y1={372} x2={814} y2={372} stroke={theme.concept} strokeWidth={2.5} strokeDasharray="9 11" />
        <line x1={734} y1={372} x2={814} y2={372} stroke={theme.concept} strokeWidth={2.5} opacity={0.7} {...flow} />
        <line x1={1106} y1={372} x2={1186} y2={372} stroke={theme.concept} strokeWidth={2.5} strokeDasharray="9 11" />
        <line x1={1106} y1={372} x2={1186} y2={372} stroke={theme.concept} strokeWidth={2.5} opacity={0.7} {...flow} />
      </svg>
      {/* 地址 + 版次双标（uri@version） */}
      <div style={{position: 'absolute', left: 820, top: 500, display: 'flex', gap: 16}}>
        {['uri · ctx://kb/…', 'version · v1'].map((t, i) => (
          <span
            key={t}
            style={{
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.concept,
              border: `1.5px solid ${theme.concept}`,
              borderRadius: 7,
              padding: '5px 14px',
              background: theme.panel,
              opacity: tags[i],
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 7-J 全轨回望：七格全章稳态 + 问题卡→答案包首尾对接 + 色调转灰（预告下一幕）。 */
const Recap: React.FC<{a29: number; a30: number; a31: number; shotDur: number}> = ({a29, a30, a31, shotDur}) => {
  const frame = useCurrentFrame();
  const arrow = useDraw(a30, 24);
  const answerIn = clamp01(progress(frame, a30 + 10, 12));
  // 色调转灰：预告下一幕（实拍感），只用饱和度、不加 blur
  const gray = clamp01(progress(frame, a31, Math.max(12, shotDur - a31 - 6)));
  return (
    <AbsoluteFill style={{filter: `saturate(${1 - 0.35 * gray})`, pointerEvents: 'none'}}>
      {/* 横轨稳态回望：at 预锚 -70（slide+stamp 早已完成）——七格全章为「状态」非「动作」 */}
      <SevenStations at={a29 - 70} station={7} />
      {/* 首尾对接：问题卡（幕级常驻件）→ 答案包 */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <path d="M 1080 130 C 1300 150, 1420 190, 1470 236" fill="none" stroke={theme.concept} strokeWidth={3} {...arrow} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1350,
          top: 240,
          width: 320,
          height: 64,
          borderRadius: 10,
          border: `2px solid ${theme.concept}`,
          background: withAlpha(theme.concept, 0.12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.concept,
          opacity: answerIn,
        }}
      >
        答案包 · uri@version
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 560,
          textAlign: 'center',
          fontSize: 22,
          color: theme.dim,
          opacity: clamp01(progress(frame, a30 + 20, 12)),
        }}
      >
        蓝图画的读路径
      </div>
    </AbsoluteFill>
  );
};
