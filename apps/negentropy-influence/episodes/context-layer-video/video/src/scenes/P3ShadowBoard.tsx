/** P3 影子板与老师傅：目录与富化（p3-01..p3-26b，28 句；storyboard「P3 影子板」节）。
 *
 *  8 镜 / 6 条 archify cue：
 *   3-A rl-sys@02 · 3-B rl-cgave@05→07 + rl-store@08（接力；前扩填镜首/镜中空窗）· 3-C 代码走廊②（PG 汉字，自 p3-09 起打印）+ fm-split@11
 *   3-D <5% 覆盖率装置 · 3-E 双轨装置（手感不签字；锚 p3-16）· 3-F 技术请示单高光 + ol-conflict@22
 *   3-G lc-evolve@24→25（复利链，跨句扩到镜末填空窗）· 3-H 交接班板装置（草稿区→最后落章）
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {useEnter, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {CodePane} from './P2MasterPage';
import {WorkCard} from '../components/WorkCard';

export const P3ShadowBoard: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-08');
  const bC = w('p3-09', 'p3-12');
  const bD = w('p3-13', 'p3-15');
  const bE = w('p3-16', 'p3-18');
  const bF = w('p3-19', 'p3-23');
  const bG = w('p3-24', 'p3-25');
  const bH = w('p3-26', 'p3-26b');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P3" tagline="影子板与老师傅 · 目录与富化" accent={theme.concept} />

      {/* 3-A 影子板：工具入格 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="3-A">
        <ShadowBoard at={at('p3-03') - bA.from} />
        <ArchifyRecap slug="runtime-layering" caption="五子系统 · 指针相连" cues={[{chapterId: 'rl-sys', at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')}]} />
      </Sequence>

      {/* 3-B 信任信号：同一把尺 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="3-B">
        <ArchifyRecap
          slug="runtime-layering"
          caption="信任信号 · 同一把尺"
          cues={[
            // rl-cgave 前后跨句扩展（自 p3-05 起播、盖过 p3-07）填镜首/镜中空窗；三个 dur
            // 求和恰等于 at('p3-08')−at('p3-05')，收针即 rl-store 的 at——背靠背换章按
            // ArchifyRecap 契约不重放入场；fit 自动落 hold，原速播完由 endStill 冻结补足。
            {chapterId: 'rl-cgave', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05') + dur('p3-06') + dur('p3-07')},
            {chapterId: 'rl-store', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
          ]}
        />
      </Sequence>

      {/* 3-C 中文坑：代码走廊② + 割裂章（CodePane 锚 p3-09：行打印在 fm-split 窗前完成，cue 收后整版即时重现） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="3-C">
        <CodePane
          at={at('p3-09') - bC.from}
          lines={[
            "to_tsvector('english', '用户偏好先给结论，少铺垫')",
            "  → '少铺垫':2  '用户偏好先给结论':1   ← 连续汉字段 = 1 个 token",
            "plainto_tsquery('english','先给结论') @@ … → f",
            '关键词腿全空 · KB 无回退',
          ]}
          badge={{level: 'filled', note: 'PG 16.14 实测'}}
        />
        <ArchifyRecap slug="failure-map" caption="检索割裂" cues={[{chapterId: 'fm-split', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')}]} />
      </Sequence>

      {/* 3-D <5% 覆盖率 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="3-D">
        <CoverageBar at={at('p3-15') - bD.from} />
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="dashed" at={at('p3-15') - bD.from} note="9,685 表 · 自报口径" />
        </div>
      </Sequence>

      {/* 3-E 双轨：手册轨 vs 手感轨（锚 p3-16：「必须双轨」句起滑入，填镜首空窗） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="3-E">
        <DualTrack at={at('p3-16') - bE.from} />
      </Sequence>

      {/* 3-F 技术请示单：全片戏剧高点 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="3-F">
        <TechRequest at={at('p3-20') - bF.from} />
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="冲突 · 挂起待裁" cues={[{chapterId: 'ol-conflict', at: at('p3-22') - bF.from, durationInFrames: dur('p3-22')}]} />
      </Sequence>

      {/* 3-G 复利（lc-evolve 跨句扩到镜末：p3-25 空窗由 hold 档末帧冻结补足） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="3-G">
        <ArchifyRecap slug="lifecycle" caption="进化 · 一次发现全机队受益" cues={[{chapterId: 'lc-evolve', at: at('p3-24') - bG.from, durationInFrames: dur('p3-24') + dur('p3-25')}]} />
      </Sequence>

      {/* 3-H 交接班板：草稿区→最后落章 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="3-H">
        <HandoverBoard at={at('p3-26b') - bH.from} />
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 200}}>
          <WorkCard stamps={3} totalSlots={7} highlightSlot={2} w={340} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const ShadowBoard: React.FC<{at: number}> = ({at}) => {
  const cells = useStagger(8, {stride: 8, at});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 720, height: 380, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 14, padding: 18}}>
        {cells.map((k, i) => (
          <div
            key={i}
            style={{
              border: `2px dashed ${k > 0.05 ? theme.concept : theme.panelBorder}`,
              opacity: 0.35 + k * 0.65,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              color: theme.dim,
            }}
          >
            {['🔧', '🪛', '🔩', '📏', '🔋', '🧯', '💡', '🛞'][i]}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const CoverageBar: React.FC<{at: number}> = ({at}) => {
  const grow = useSpring('settle', {at, dur: 40});
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

const DualTrack: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('slideR', {at, dur: 30});
  return (
    <AbsoluteFill {...{style: {display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}}>
      <div style={{...e, display: 'flex', gap: 60, alignItems: 'center'}}>
        <div style={{padding: '20px 30px', border: `2px solid ${theme.concept}`, borderRadius: 10, fontSize: 28, color: theme.concept}}>手册轨<div style={{fontSize: 18, color: theme.dim, marginTop: 6}}>显式 · 可签字</div></div>
        <div style={{fontSize: 34, color: theme.dim}}>∥</div>
        <div style={{padding: '20px 30px', border: `2px dashed ${theme.dim}`, borderRadius: 10, fontSize: 28, color: theme.dim}}>手感轨<div style={{fontSize: 18, marginTop: 6}}>可提示 · 永不替手册签字</div></div>
      </div>
    </AbsoluteFill>
  );
};

const TechRequest: React.FC<{at: number}> = ({at}) => {
  const pin1 = useSpring('settle', {at: at + 10, dur: 12});
  const pin2 = useSpring('settle', {at: at + 22, dur: 12});
  const halt = useSpring('settle', {at: at + 34, dur: 20});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 780, padding: 28, background: theme.panel, border: `2px solid ${theme.conceptDeep}`, borderRadius: 12}}>
        <div style={{fontSize: 24, color: theme.conceptDeep, marginBottom: 18}}>技术请示单 · 停工挂起</div>
        <div style={{display: 'flex', gap: 22}}>
          {[
            {v: pin1, tag: 'AMM 32-11 rev.C', val: '45 N·m'},
            {v: pin2, tag: 'AMM 32-11 rev.D', val: '52 N·m'},
          ].map((p, i) => (
            <div key={i} style={{flex: 1, position: 'relative', background: '#0B0E14', borderRadius: 8, padding: '16px 18px', border: `1.5px solid ${theme.panelBorder}`}}>
              <div style={{fontSize: 18, color: theme.dim}}>{p.tag}</div>
              <div style={{fontSize: 40, color: theme.text, marginTop: 8, fontVariantNumeric: 'tabular-nums'}}>{p.val}</div>
              <div style={{position: 'absolute', top: -10, left: '50%', width: 14, height: 14, borderRadius: 7, background: theme.conceptDeep, transform: `scale(${p.v})`}} />
            </div>
          ))}
        </div>
        <div style={{marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, opacity: halt}}>
          <div style={{width: 18, height: 18, borderRadius: 4, background: theme.conceptDeep}} />
          <span style={{fontSize: 24, color: theme.conceptDeep}}>工序挂起 · 裁定回来前不动</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const HandoverBoard: React.FC<{at: number}> = ({at}) => {
  const notes = useStagger(4, {stride: 10, at});
  const seal = useSpring('settle', {at: at + 60, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 660, padding: 26, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 12}}>
        <div style={{fontSize: 22, color: theme.dim, marginBottom: 14}}>交接班纪要</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          {['已关闭工序 ×3 → 折成一行', '未关闭 · 一字不折', '保留项 · 一字不折', '异常发现 · 一字不折'].map((t, i) => (
            <div key={t} style={{opacity: notes[i], fontSize: 22, color: i === 0 ? theme.dim : theme.text, display: 'flex', gap: 12, alignItems: 'center'}}>
              <span style={{width: 10, height: 10, borderRadius: 5, background: i === 0 ? theme.dim : theme.ok}} />
              {t}
            </div>
          ))}
        </div>
        <div style={{marginTop: 18, textAlign: 'right'}}>
          <span style={{display: 'inline-block', padding: '6px 18px', border: `2.5px solid ${theme.ok}`, borderRadius: 8, color: theme.ok, fontSize: 26, transform: `rotate(-6deg) scale(${seal})`, opacity: seal}}>正式入档 · 最后一步</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
