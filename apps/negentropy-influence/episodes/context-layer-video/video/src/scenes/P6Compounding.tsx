/** P6 复利轴：老师傅（p6-01..p6-28，28 句；storyboard v3「P6 复利轴」节）。
 *
 *  7 镜 / 6 条 archify cue：
 *   6-A el-six@p6-01（开轴句先回放六面杠杆；剖面高亮让位一拍，recap 后置遮盖）
 *       + LampTrio 三在线三盏灯（新组件）+ 制度挂墙标语牌（灰）对照
 *   6-B LampTrio 只亮一盏（缺两，missingAt 橙警示）→ 修复补亮 → 提交点最后落章（绿）
 *   6-C 覆盖率条 9685<5%（v2 迁移）+ 虚线徽 · 双轨（v2 迁移，签字章只落手册轨）
 *   6-D 技术请示单高光（v2 迁移，全片戏剧高点）：停工/慢镜图钉/挂起牌/引用计数 200:5 天平
 *   6-E lc2-l5@p6-19 → hold@p6-20（复利链装置让位；p6-21 空窗给便签原料句）+
 *       ol-draft@p6-22（草稿区句正对起草态；recap 后置遮盖落章装置）
 *   6-F el-six@p6-23（stretch）→ el-sm@p6-24（dur=p4-24 前段 110f，trim；镜内背靠背自动抑制）
 *       + 判词条「经营的是回路不是仓库」@p6-24 后段
 *   6-G 三维拼图合体（v2 迁移，标签更新为 v3 口径）+ 问题卡打字机「每一轮怎么装配出来？」
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useProgress, useReveal, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {HangarCrossSection} from '../components/HangarCrossSection';
import {LampTrio} from '../components/LampTrio';

export const P6Compounding: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p6-01', 'p6-05');
  const bB = w('p6-06', 'p6-08');
  const bC = w('p6-09', 'p6-13');
  const bD = w('p6-14', 'p6-18');
  const bE = w('p6-19', 'p6-22');
  const bF = w('p6-23', 'p6-24');
  const bG = w('p6-25', 'p6-28');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P6" tagline="复利轴 · 老师傅" accent={theme.ok} />

      {/* 6-A 开轴三在线：el-six 盖 p6-01（开轴句回放六面杠杆；剖面高亮让位一拍）→ 三盏灯逐盏点亮 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="6-A">
        <Sequence from={0} durationInFrames={dur('p6-01')} name="6-A-hangar">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <HangarCrossSection built highlight="compounding" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p6-02') - bA.from} name="6-A-dev">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 120}}>
            <LampTrio at={0} onAt={[at('p6-03') - at('p6-02') + 8, at('p6-03') - at('p6-02') + 46, at('p6-03') - at('p6-02') + 84]} />
            <WallPlaque at={at('p6-05') - at('p6-02')} />
          </AbsoluteFill>
          <Chips at={at('p6-04') - at('p6-02')} texts={['到点触发', '有人消费', '攒够有标记']} accent={theme.ok} note="缺一件 · 回路不存在" />
        </Sequence>
        <ArchifyRecap slug="evolution-levers" caption="复利轴 · 六面杠杆" cues={[
          {chapterId: 'el-six', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
        ]} />
      </Sequence>

      {/* 6-B 断链与修复：只亮一盏（缺两）→ 补亮两盏 → 提交点最后落章 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="6-B">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 120}}>
          <LampTrio
            at={0}
            onAt={[8, at('p6-07') - bB.from + 40, at('p6-07') - bB.from + 110]}
            missingAt={12}
          />
          <CommitStamp at={at('p6-08') - bB.from} />
        </AbsoluteFill>
      </Sequence>

      {/* 6-C 富化现实：覆盖率条（v2 迁移）+ 虚线徽 → 双轨（签字章只落手册轨） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="6-C">
        <Sequence from={0} durationInFrames={dur('p6-09', 'p6-10')} name="6C-bar">
          <CoverageBar at={0} />
          <div style={{position: 'absolute', bottom: 150, left: 80}}>
            <EvidenceBadge level="dashed" at={at('p6-10') - at('p6-09')} note="9,685 表 · 自报口径" />
          </div>
        </Sequence>
        <Sequence from={at('p6-11') - bC.from} name="6-C-track">
          <DualTrack at={0} stampAt={at('p6-13') - at('p6-11')} />
        </Sequence>
      </Sequence>

      {/* 6-D 技术请示单高光（全片戏剧高点）：停工 / 慢镜图钉 / 挂起牌 / 引用天平 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="6-D">
        <TechRequest at={0} haltAt={at('p6-15') - bD.from} pinAt={at('p6-16') - bD.from} citeAt={at('p6-18') - bD.from} />
      </Sequence>

      {/* 6-E 复利链：lc2-l5@19 → hold@20（链装置让位；21 空窗给便签原料句）+ ol-draft@22（recap 后置遮盖） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="6-E">
        <Sequence from={at('p6-20') - bE.from} durationInFrames={dur('p6-20', 'p6-21')} name="6-E-chain">
          <CompoundChain at={0} notesAt={at('p6-21') - at('p6-20')} />
        </Sequence>
        <Sequence from={at('p6-22') - bE.from} name="6-E-stamp">
          <DraftSeal at={0} />
        </Sequence>
        <ArchifyRecap slug="lifecycle" caption="L5 沉淀回灌 · 进化环" cues={[
          {chapterId: 'lc2-l5', at: at('p6-19') - bE.from, durationInFrames: dur('p6-19')},
          {chapterId: 'lc2-l5', at: at('p6-20') - bE.from, durationInFrames: dur('p6-20'), fit: 'hold'},
        ]} />
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="草稿区 · 起草态" cues={[
          {chapterId: 'ol-draft', at: at('p6-22') - bE.from, durationInFrames: dur('p6-22')},
        ]} />
      </Sequence>

      {/* 6-F 进化杠杆：el-six@23（stretch）→ el-sm@24 前段（trim）；判词条用 p6-24 后段 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="6-F">
        <ArchifyRecap
          slug="evolution-levers"
          caption="六面杠杆 · 八态状态机"
          cues={[
            {chapterId: 'el-six', at: at('p6-23') - bF.from, durationInFrames: dur('p6-23')},
            {chapterId: 'el-sm', at: at('p6-24') - bF.from, durationInFrames: dur('p6-24') - 33},
          ]}
        />
        <Sequence from={at('p6-24') - bF.from + dur('p6-24') - 33} name="6-F-strip">
          <JudgeStrip text="经营的是回路 · 不是仓库" accent={theme.ok} />
        </Sequence>
      </Sequence>

      {/* 6-G 拼图转场：五源投影+五轴+六段两环合体 + 问题卡打字机 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="6-G">
        <PuzzleMerge at={0} />
        <QuestionCard at={at('p6-27') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 挂墙标语牌（灰）：制度挂在墙上 ≠ 有人在干。 */
const WallPlaque: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 16});
  return (
    <div style={{...enter, width: 240, padding: '22px 24px', border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, textAlign: 'center'}}>
      <div style={{fontSize: 22, color: theme.dim}}>制度挂墙</div>
      <div style={{fontSize: 17, color: theme.panelBorder, marginTop: 10}}>蒙尘 · 无人执行</div>
      <div style={{marginTop: 14, height: 40, background: withAlpha(theme.panelBorder, 0.25), borderRadius: 4}} />
    </div>
  );
};

/** 角标 chip 组（6-A 三件套）。 */
const Chips: React.FC<{at: number; texts: string[]; accent: string; note?: string}> = ({at, texts, accent, note}) => {
  const marks = useStagger(texts.length, {stride: 12, at});
  const noteP = useProgress(at + texts.length * 12 + 6, 12);
  return (
    <div style={{position: 'absolute', bottom: 180, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14}}>
      {texts.map((t, i) => (
        <span key={t} style={{opacity: marks[i], padding: '6px 16px', border: `1.5px solid ${accent}`, borderRadius: 999, fontSize: 19, color: accent}}>
          {t}
        </span>
      ))}
      {note ? <span style={{fontSize: 19, color: theme.conceptDeep, opacity: noteP}}>{note}</span> : null}
    </div>
  );
};

/** 提交点最后落章（6-B）：防同一件事记两遍。 */
const CommitStamp: React.FC<{at: number}> = ({at}) => {
  const seal = useSpring('settle', {at: at + 8, dur: 14});
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{position: 'relative', width: 260, height: 170, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{fontSize: 22, color: theme.dim}}>提交点</span>
        <span
          style={{
            position: 'absolute',
            right: -18,
            top: -16,
            padding: '6px 14px',
            border: `3px solid ${theme.ok}`,
            borderRadius: 8,
            color: theme.ok,
            fontSize: 21,
            transform: `rotate(10deg) scale(${seal})`,
            opacity: seal,
            background: withAlpha(theme.bg, 0.9),
          }}
        >
          最后写
        </span>
      </div>
      <div style={{fontSize: 18, color: theme.dim, marginTop: 12, opacity: seal}}>防的 · 同一件事记两遍</div>
    </div>
  );
};

/** 覆盖率条（v2 迁移）：9685 张表，人工精修 <5%。 */
const CoverageBar: React.FC<{at: number}> = ({at}) => {
  const grow = useSpring('settle', {at: at + 20, dur: 40});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16}}>
      <div style={{fontSize: 64, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>&lt; {(5 * (0.4 + 0.6 * grow)).toFixed(1)}%</div>
      <div style={{width: 640, height: 26, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 13, overflow: 'hidden'}}>
        <div style={{width: `${5 * (0.4 + 0.6 * grow)}%`, height: '100%', background: theme.conceptDeep, opacity: 0.8}} />
      </div>
      <div style={{fontSize: 22, color: theme.dim}}>人工精修覆盖 · 九千多张表</div>
    </AbsoluteFill>
  );
};

/** 双轨（v2 迁移）：手册轨（钢蓝）∥ 手感轨（暖灰虚线）；签字章只落手册轨。 */
const DualTrack: React.FC<{at: number; stampAt: number}> = ({at, stampAt}) => {
  const e1 = useEnter('slideR', {at, dur: 26});
  const e2 = useEnter('slideR', {at: at + 8, dur: 26});
  const stamp = useSpring('settle', {at: stampAt + 6, dur: 14});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44}}>
      <div style={{...e1, position: 'relative', width: 640, padding: '22px 30px', border: `2px solid ${theme.concept}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <div style={{fontSize: 28, color: theme.concept}}>手册轨 · 显式</div>
          <div style={{fontSize: 18, color: theme.dim, marginTop: 6}}>从报表起草规章</div>
        </div>
        <span style={{padding: '6px 16px', border: `2.5px solid ${theme.ok}`, borderRadius: 8, color: theme.ok, fontSize: 22, transform: `rotate(-8deg) scale(${stamp})`, opacity: stamp}}>可签字</span>
      </div>
      <div style={{...e2, width: 640, padding: '22px 30px', border: `2px dashed ${theme.dim}`, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <div style={{fontSize: 28, color: theme.dim}}>手感轨 · 隐式</div>
          <div style={{fontSize: 18, color: theme.dim, marginTop: 6}}>从使用习惯挖暗知识</div>
        </div>
        <span style={{fontSize: 19, color: theme.conceptDeep}}>可提示 · 永不替手册签字</span>
      </div>
    </AbsoluteFill>
  );
};

/** 技术请示单（v2 迁移升级）：停工急停 → 双页并排慢镜图钉 → 挂起牌 → 引用计数天平。 */
const TechRequest: React.FC<{at: number; haltAt: number; pinAt: number; citeAt: number}> = ({at, haltAt, pinAt, citeAt}) => {
  const enter = useEnter('rise', {at, dur: 20});
  const halt = useSpring('settle', {at: haltAt + 6, dur: 16});
  // 慢镜图钉：全片戏剧高点——每枚 26 帧（约为常规印章两倍的钉入时长）
  const pin1 = useSpring('settle', {at: pinAt + 10, dur: 26});
  const pin2 = useSpring('settle', {at: pinAt + 44, dur: 26});
  const tilt = useSpring('settle', {at: citeAt + 8, dur: 24});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...enter, width: 820, padding: 26, background: theme.panel, border: `2px solid ${theme.conceptDeep}`, borderRadius: 12}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontSize: 24, color: theme.conceptDeep}}>技术请示单</div>
          <span style={{fontSize: 21, color: theme.conceptDeep, opacity: halt, padding: '4px 14px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 6, transform: `rotate(${halt * -2}deg)`}}>停工 · 递工程裁决</span>
        </div>
        <div style={{display: 'flex', gap: 22, marginTop: 18}}>
          {[
            {v: pin1, tag: 'AMM 32-11 rev.C', val: '45 N·m', cite: '被引 ×5'},
            {v: pin2, tag: 'AMM 32-11 rev.D', val: '52 N·m', cite: '被引 ×200'},
          ].map((p, i) => (
            <div key={p.tag} style={{flex: 1, position: 'relative', background: theme.terminalBg, borderRadius: 8, padding: '16px 18px', border: `1.5px solid ${i === 1 && tilt > 0.4 ? theme.conceptDeep : theme.panelBorder}`, transform: `translateY(${i === 1 ? tilt * 10 : -tilt * 4}px)`}}>
              <div style={{fontSize: 18, color: theme.dim}}>{p.tag}</div>
              <div style={{fontSize: 40, color: theme.text, marginTop: 8, fontVariantNumeric: 'tabular-nums'}}>{p.val}</div>
              <div style={{fontSize: 16, color: i === 1 && tilt > 0.4 ? theme.conceptDeep : theme.dim, marginTop: 4}}>{p.cite}</div>
              {/* 慢镜图钉 */}
              <div style={{position: 'absolute', top: -12, left: '50%', width: 15, height: 15, borderRadius: 3, background: theme.conceptDeep, transform: `translateX(-50%) scale(${p.v}) rotate(45deg)`}} />
            </div>
          ))}
        </div>
        <div style={{marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, opacity: halt}}>
          <div style={{width: 18, height: 18, borderRadius: 4, background: theme.conceptDeep}} />
          <span style={{fontSize: 23, color: theme.conceptDeep}}>工序挂起 · 裁定回来前系统绝不自选</span>
        </div>
        {/* 引用计数天平（p6-18）：按引用量自动挑，赢的往往是错的 */}
        <div style={{marginTop: 14, display: 'flex', alignItems: 'center', gap: 16, opacity: tilt}}>
          <svg width={330} height={56}>
            <g transform={`rotate(${tilt * 14} 165 18)`}>
              <line x1={30} y1={18} x2={300} y2={18} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
            </g>
            <text x={70} y={48} fill={theme.ok} fontSize={16}>对 · ×5</text>
            <text x={218} y={48} fill={theme.conceptDeep} fontSize={16}>错 · ×200 压倒</text>
          </svg>
          <span style={{fontSize: 17, color: theme.dim}}>自动挑引用多的 · 常挑错</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 复利链（6-E）：漏油→可靠性报告→MPD 间隔→培训大纲四节点 + 机队剪影扩散。 */
const CompoundChain: React.FC<{at: number; notesAt: number}> = ({at, notesAt}) => {
  const nodes = useStagger(4, {stride: 22, at});
  const fleet = useStagger(5, {stride: 10, at: at + 80});
  const labels = ['一处漏油', '可靠性报告', '维修间隔', '培训大纲'];
  const notes = useProgress(notesAt, 14);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        {nodes.map((k, i) => (
          <div key={labels[i]} style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <div style={{opacity: k, width: 168, padding: '18px 12px', border: `2px solid ${theme.ok}`, borderRadius: 10, background: withAlpha(theme.ok, 0.05), textAlign: 'center'}}>
              <div style={{fontSize: 21, color: theme.ok}}>{`0${i + 1}`}</div>
              <div style={{fontSize: 20, color: theme.text, marginTop: 6}}>{labels[i]}</div>
            </div>
            {i < 3 ? <span style={{fontSize: 26, color: theme.ok, opacity: nodes[i + 1]}}>→</span> : null}
          </div>
        ))}
      </div>
      {/* 机队剪影复制扩散：一次发现全机队受益 */}
      <div style={{display: 'flex', gap: 26, alignItems: 'flex-end', opacity: fleet[0]}}>
        {[0, 1, 2, 3, 4].map((i) => (
          <svg key={i} width={92} height={34} style={{opacity: fleet[i]}}>
            <path d="M 8 24 L 40 12 L 66 12 L 84 20 L 84 26 L 8 26 Z" fill="none" stroke={theme.ok} strokeWidth={2} />
            <line x1={44} y1={12} x2={50} y2={2} stroke={theme.ok} strokeWidth={2} />
            <line x1={46} y1={8} x2={74} y2={8} stroke={theme.ok} strokeWidth={2} />
          </svg>
        ))}
        <span style={{fontSize: 18, color: theme.ok, marginLeft: 8}}>一次发现 · 全机队受益</span>
      </div>
      {/* 草稿区便签：先攒着，不到时候不算数 */}
      <div style={{display: 'flex', gap: 10, opacity: notes, alignItems: 'center'}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{width: 64, height: 64, background: theme.paper, borderRadius: 4, transform: `rotate(${(i - 1) * 5}deg)`, opacity: 0.85}} />
        ))}
        <span style={{fontSize: 19, color: theme.dim, marginLeft: 12}}>草稿区攒着 · 不到时候不算数</span>
      </div>
    </AbsoluteFill>
  );
};

/** 正式入档（6-E 尾）：最后一步落章。 */
const DraftSeal: React.FC<{at: number}> = ({at}) => {
  const seal = useSpring('settle', {at: at + 6, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 470, height: 240, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14}}>
        <div style={{fontSize: 24, color: theme.text}}>长期档案</div>
        <div style={{fontSize: 19, color: theme.dim}}>正式入档 · 最后一步</div>
        <span style={{padding: '8px 22px', border: `3px solid ${theme.ok}`, borderRadius: 8, color: theme.ok, fontSize: 26, transform: `rotate(-7deg) scale(${seal})`, opacity: seal}}>入档</span>
      </div>
    </AbsoluteFill>
  );
};

/** 三维拼图合体（v2 迁移，标签更新为 v3 口径：五源投影/五轴/六段两环）。 */
const PuzzleMerge: React.FC<{at: number}> = ({at}) => {
  const parts = useStagger(3, {stride: 18, at});
  const labels = ['五源投影', '五轴', '六段两环'];
  const colors = [theme.concept, theme.conceptDeep, theme.ok];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex'}}>
        {labels.map((t, i) => (
          <div
            key={t}
            style={{
              width: 200,
              height: 124,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 29,
              color: theme.bg,
              background: colors[i],
              opacity: parts[i],
              transform: `translateX(${(1 - parts[i]) * (i - 1) * 90}px)`,
              clipPath: i === 0 ? 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' : i === 1 ? 'polygon(12% 0, 88% 0, 76% 100%, 0% 100%)' : 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)',
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 问题卡打字机（6-G 悬念句；文案取 storyboard 挂起卡的短形，不复述整句）。 */
const QuestionCard: React.FC<{at: number}> = ({at}) => {
  const text = useReveal('每一轮怎么装配出来？', {at, cps: 7});
  const enter = useEnter('rise', {at, dur: 14});
  return (
    <div style={{position: 'absolute', bottom: 210, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <div style={{...enter, padding: '18px 36px', border: `2px solid ${theme.concept}`, borderRadius: 12, background: withAlpha(theme.bg, 0.9)}}>
        <span style={{fontSize: 32, color: theme.concept, letterSpacing: 1}}>{text}</span>
        <span style={{opacity: text.length >= 10 ? 1 : 0, color: theme.concept}}>▍</span>
      </div>
    </div>
  );
};

/** 判词条（收束通用形；带底幕遮断前一装置）。 */
const JudgeStrip: React.FC<{text: string; accent: string}> = ({text, accent}) => {
  const enter = useEnter('rise', {at: 4, dur: 18});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: withAlpha(theme.bg, 0.92)}}>
      <div style={{...enter, padding: '16px 40px', border: `2.5px solid ${accent}`, borderRadius: 12, fontSize: 34, color: accent, letterSpacing: 2, background: withAlpha(theme.bg, 0.85)}}>
        {text}
      </div>
    </AbsoluteFill>
  );
};
