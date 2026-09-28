/** P4 会签与放行：治理层（p4-01..p4-26，27 句；storyboard「P4 会签与放行」节）。
 *
 *  7 镜 / 10 条 archify cue：
 *   4-A 会签栏装置 + fm-gov@03 · 4-B 只减不增计数器 · 4-C 韦恩图交集
 *   4-D RII 底稿/保留单 + fm-unverified@15 · 4-E 477 vs 48 装置
 *   4-F tm-poison@21→tm-inject@22 · 4-G 数字墙 + tm-token@24→tm-deputy@25→tm-gate@26（接力）
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
import {WorkCard} from '../components/WorkCard';

export const P4Signoff: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-08');
  const bC = w('p4-09', 'p4-11');
  const bD = w('p4-12', 'p4-16');
  const bE = w('p4-17', 'p4-19c');
  const bF = w('p4-20', 'p4-23');
  const bG = w('p4-24', 'p4-26');
  const bZ = w('p4-26');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P4" tagline="会签与放行 · 治理层" accent={theme.conceptDeep} />

      {/* 4-A 会签栏四格 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="4-A">
        <SignoffRow at={at('p4-03') - bA.from} />
        <ArchifyRecap slug="failure-map" caption="治理层 · 四机构一道墙" cues={[{chapterId: 'fm-gov', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')}]} />
      </Sequence>

      {/* 4-B 只减不增 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="4-B">
        <ShrinkCounter at={at('p4-05') - bB.from} />
      </Sequence>

      {/* 4-C 韦恩图交集 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="4-C">
        <VennIntersect at={at('p4-09b') - bC.from} />
      </Sequence>

      {/* 4-D RII 底稿/保留单 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="4-D">
        <RIIProof at={at('p4-14') - bD.from} />
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 80}}>
          <div style={{padding: '14px 26px', border: `2px solid ${theme.ok}`, borderRadius: 10, background: 'rgba(126,211,33,0.06)'}}>
            <div style={{fontSize: 30, color: theme.ok}}>人 ← 会签</div>
            <div style={{fontSize: 30, color: theme.ok, marginTop: 6}}>答案 ← 放行</div>
          </div>
        </AbsoluteFill>
        <ArchifyRecap slug="failure-map" caption="未验证断言" cues={[{chapterId: 'fm-unverified', at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')}]} />
      </Sequence>

      {/* 4-E 477 vs 48 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="4-E">
        <Crash477 at={at('p4-18') - bE.from} />
        <div style={{position: 'absolute', bottom: 90, left: 80}}>
          <EvidenceBadge level="solid" at={at('p4-18') - bE.from} note="第三方复现 · 玩具版 4 vs 3" />
        </div>
      </Sequence>

      {/* 4-F 供给面投毒 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="4-F">
        <ArchifyRecap
          slug="blueprint--mcp-threat-model"
          caption="供给面 · 自述不可信"
          cues={[
            {chapterId: 'tm-poison', at: at('p4-21') - bF.from, durationInFrames: dur('p4-21')},
            {chapterId: 'tm-inject', at: at('p4-22') - bF.from, durationInFrames: dur('p4-22')},
          ]}
        />
      </Sequence>

      {/* 4-G 四家不验签 + 三底线 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="4-G">
        <NumbersWall at={at('p4-24') - bG.from} />
        <ArchifyRecap
          slug="blueprint--mcp-threat-model"
          caption="治理门 · 三级链路"
          cues={[
            {chapterId: 'tm-token', at: at('p4-24') - bG.from, durationInFrames: dur('p4-24')},
            {chapterId: 'tm-deputy', at: at('p4-25') - bG.from, durationInFrames: dur('p4-25')},
            {chapterId: 'tm-gate', at: at('p4-26') - bG.from, durationInFrames: dur('p4-26')},
          ]}
        />
      </Sequence>

      {/* 幕尾第 4 格：底锚不遮 4-G 全屏 archify（同 1-Z 先例） */}
      <Sequence from={bZ.from} durationInFrames={bZ.durationInFrames} name="4-Z">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 90}}>
          <WorkCard stamps={4} totalSlots={7} highlightSlot={3} w={320} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const SignoffRow: React.FC<{at: number}> = ({at}) => {
  const stamps = useStagger(4, {stride: 22, at});
  const labels = ['执照', '机型授权', '必检复核', '客户代表'];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 22}}>
        {labels.map((t, i) => (
          <div key={t} style={{width: 170, height: 150, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 14}}>
            <span style={{position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontSize: 20, color: theme.dim}}>{t}</span>
            <div style={{width: 64, height: 64, borderRadius: 32, border: `3px solid ${theme.ok}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.ok, fontSize: 22, transform: `scale(${stamps[i]})`, opacity: stamps[i]}}>已签</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ShrinkCounter: React.FC<{at: number}> = ({at}) => {
  // 反模式 X-001 核对：口播「只会更少」⇒ 计数器只减不加
  const s1 = useSpring('settle', {at: at + 6, dur: 20});
  const s2 = useSpring('settle', {at: at + 20, dur: 20});
  const s3 = useSpring('settle', {at: at + 34, dur: 20});
  const n = 12 - Math.round(s1 * 3 + s2 * 4 + s3 * 5);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18}}>
      <div style={{fontSize: 110, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>{n}<span style={{fontSize: 40, color: theme.dim}}> 人</span></div>
      <div style={{fontSize: 24, color: theme.dim}}>每加一道会签 · 能关这张卡的人只会更少</div>
      <div style={{display: 'flex', gap: 10}}>
        {[s1, s2, s3].map((s, i) => (
          <div key={i} style={{width: 90, height: 8, background: theme.panelBorder, borderRadius: 4, overflow: 'hidden'}}>
            <div style={{width: `${s * 100}%`, height: '100%', background: theme.conceptDeep}} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const VennIntersect: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: 24});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={640} height={340} style={e}>
        <circle cx={250} cy={170} r={130} fill="rgba(91,141,201,0.18)" stroke={theme.concept} strokeWidth={2} />
        <circle cx={390} cy={170} r={130} fill="rgba(245,166,35,0.15)" stroke={theme.conceptDeep} strokeWidth={2} />
        <text x={160} y={60} fill={theme.concept} fontSize={20}>用户有的</text>
        <text x={420} y={60} fill={theme.conceptDeep} fontSize={20}>任务允许的</text>
        <text x={292} y={178} fill={theme.ok} fontSize={24} fontWeight={700}>交集</text>
        <text x={200} y={320} fill={theme.dim} fontSize={20}>缺一不可 · 只减不增 · 实时求值</text>
      </svg>
    </AbsoluteFill>
  );
};

const RIIProof: React.FC<{at: number}> = ({at}) => {
  const slap = useSpring('settle', {at, dur: 14});
  const retain = useSpring('settle', {at: at + 40, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70}}>
      <div style={{transform: `scale(${slap}) rotate(-3deg)`, padding: '22px 30px', background: '#F2F5FA', borderRadius: 8, color: '#171C26', boxShadow: '0 12px 40px rgba(0,0,0,0.5)'}}>
        <div style={{fontSize: 20, color: '#5a6472'}}>带版次底稿</div>
        <div style={{fontSize: 44, fontWeight: 700}}>45 N·m · rev.D</div>
        <div style={{fontSize: 16, color: '#5a6472', marginTop: 6}}>校准证书 №A-1123</div>
      </div>
      <div style={{transform: `scale(${retain}) rotate(4deg)`, padding: '18px 26px', border: `2.5px dashed ${theme.conceptDeep}`, borderRadius: 8}}>
        <div style={{fontSize: 24, color: theme.conceptDeep}}>保留单</div>
        <div style={{fontSize: 18, color: theme.dim, marginTop: 4}}>未经核准 · 跟着飞机走</div>
      </div>
    </AbsoluteFill>
  );
};

const Crash477: React.FC<{at: number}> = ({at}) => {
  const grow = useSpring('settle', {at, dur: 45});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 120, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>{Math.round(48 + 429 * grow)}</div>
        <div style={{fontSize: 22, color: theme.dim}}>跨天相加 · 重复计数</div>
      </div>
      <div style={{fontSize: 40, color: theme.dim}}>vs</div>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 120, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>48</div>
        <div style={{fontSize: 22, color: theme.dim}}>真实答案</div>
      </div>
    </AbsoluteFill>
  );
};

const NumbersWall: React.FC<{at: number}> = ({at}) => {
  const rows = useStagger(3, {stride: 14, at});
  const data = [
    ['98,380', '份社区技能扫描'],
    ['157', '份确认恶意'],
    ['632', '个漏洞'],
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14}}>
      {data.map(([n, t], i) => (
        <div key={t} style={{opacity: rows[i], display: 'flex', gap: 20, alignItems: 'baseline'}}>
          <span style={{fontSize: 58, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums', minWidth: 260, textAlign: 'right'}}>{n}</span>
          <span style={{fontSize: 24, color: theme.dim}}>{t}</span>
        </div>
      ))}
      <div style={{opacity: rows[2], display: 'flex', gap: 18, marginTop: 10}}>
        {['Claude', 'Cursor', 'Codex', 'VS Code'].map((c) => (
          <span key={c} style={{padding: '6px 14px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 6, fontSize: 19, color: theme.dim, textDecoration: 'line-through'}}>{c}</span>
        ))}
        <span style={{fontSize: 19, color: theme.conceptDeep}}>零验签</span>
      </div>
    </AbsoluteFill>
  );
};
