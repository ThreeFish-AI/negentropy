/** P0 三个自信的错（p0-01..p0-23，24 句；storyboard「P0 三个自信的错」节）。
 *
 *  7 镜 / 7 条 archify cue：
 *   0-A 夜机坪（纯装置：机库夜灯+工卡首现）
 *   0-B fm-stale@p0-03 · 0-C fm-conflict@p0-07 · 0-D fm-auth@p0-10（全屏独占；B→C→D 镜界背靠背，链首 0-B 恢复入场）
 *   0-E fm-breach@p0-14（背靠背 0-D 尾故 false）· fm-all@p0-16（空窗 p0-15 后重现，拆独立实例恢复入场）
 *   0-F fm-unverified@p0-19 + il-gap@p0-21（隔句空窗均入场）
 *   0-G 发工卡（装置收口：卡面格线亮起）
 *  三级证据徽（锚句被图框覆盖的一律前移空窗句「先播完再被遮、露终态」）：
 *  0-E 双 solid@p0-15（p0-16 被 fm-all 盖）· 0-F solid@p0-18 + dashed@p0-20（避 fm-unverified@p0-19 / il-gap@p0-21）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {useEnter, usePushIn, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {WorkCard} from '../components/WorkCard';

const hash = (i: number, salt = 1): number =>
  Math.abs(Math.sin(i * 127.1 + salt * 311.7)) % 1;

export const P0Errors: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bB = w('p0-03', 'p0-06');
  const bC = w('p0-07', 'p0-09');
  const bD = w('p0-10', 'p0-13');
  const bE = w('p0-14', 'p0-17');
  const bF = w('p0-18', 'p0-21');
  const bG = w('p0-22', 'p0-23');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P0" tagline="三个自信的错" accent={theme.concept} />

      {/* 0-A 夜机坪：机位灯呼吸 + 工卡特写首现 */}
      <Sequence from={0} durationInFrames={dur('p0-01', 'p0-02')} name="0-A">
        <NightApron at01={at('p0-01')} />
      </Sequence>

      {/* 0-B/0-C/0-D 三件错：archify 全屏独占，镜界背靠背（链首 0-B 恢复入场） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="0-B">
        <ArchifyRecap slug="failure-map" caption="失效一 · 过期供给" cues={[
              {chapterId: 'fm-stale', at: at('p0-03') - bB.from, durationInFrames: dur('p0-03')},
              {chapterId: 'fm-stale', at: at('p0-04') - bB.from, durationInFrames: dur('p0-04'), fit: 'hold'},
              {chapterId: 'fm-stale', at: at('p0-05') - bB.from, durationInFrames: dur('p0-05'), fit: 'hold'},
              {chapterId: 'fm-stale', at: at('p0-06') - bB.from, durationInFrames: dur('p0-06'), fit: 'hold'},
            ]} />
      </Sequence>
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="0-C">
        <ArchifyRecap slug="failure-map" caption="失效二 · 口径打架" cues={[
              {chapterId: 'fm-conflict', at: at('p0-07') - bC.from, durationInFrames: dur('p0-07')},
              {chapterId: 'fm-conflict', at: at('p0-08') - bC.from, durationInFrames: dur('p0-08'), fit: 'hold'},
              {chapterId: 'fm-conflict', at: at('p0-09') - bC.from, durationInFrames: dur('p0-09'), fit: 'hold'},
            ]} lead={false} />
      </Sequence>
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="0-D">
        <ArchifyRecap slug="failure-map" caption="失效三 · 代理越权" cues={[
              {chapterId: 'fm-auth', at: at('p0-10') - bD.from, durationInFrames: dur('p0-10')},
              {chapterId: 'fm-auth', at: at('p0-11') - bD.from, durationInFrames: dur('p0-11'), fit: 'hold'},
              {chapterId: 'fm-auth', at: at('p0-12') - bD.from, durationInFrames: dur('p0-12'), fit: 'hold'},
              {chapterId: 'fm-auth', at: at('p0-13') - bD.from, durationInFrames: dur('p0-13'), fit: 'hold'},
            ]} lead={false} />
      </Sequence>

      {/* 0-E 换成 AI：fm-breach 接力 0-D 链尾（背靠背 false），证据徽 + 数字对撞 + 八失效全景 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="0-E">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28}}>
          <div style={{display: 'flex', gap: 40, alignItems: 'flex-end'}}>
            <NumCrash from={19} to={85} at={at('p0-17') - bE.from} label="共享资料库 → 递对证据页" />
          </div>
          <div style={{display: 'flex', gap: 24}}>
            <EvidenceBadge level="solid" at={at('p0-15') - bE.from} note="FinanceBench" />
            {/* 同锚 p0-15 并列入场：p0-16 语义句被 fm-all 图框整窗盖住，前移空窗句先播完再被遮 */}
            <EvidenceBadge level="solid" at={at('p0-15') - bE.from} note="同模型对照" />
          </div>
        </AbsoluteFill>
        <ArchifyRecap slug="failure-map" caption="权限穿透" cues={[
          {chapterId: 'fm-breach', at: at('p0-14') - bE.from, durationInFrames: dur('p0-14')},
        ]} lead={false} />
        <ArchifyRecap slug="failure-map" caption="八失效总览" cues={[
          {chapterId: 'fm-all', at: at('p0-16') - bE.from, durationInFrames: dur('p0-16')},
        ]} />
      </Sequence>

      {/* 0-F 崩崖 + 97/4 断层（崩崖+solid 徽前移 p0-18 空窗句先播完，p0-19 起被 fm-unverified 盖、p0-20 露终态；il-gap 与 fm-unverified 隔整句空窗，恢复入场） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="0-F">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
          <CliffLine at={at('p0-18') - bF.from} />
          <div style={{display: 'flex', gap: 18, alignItems: 'center'}}>
            <EvidenceBadge level="solid" at={at('p0-18') - bF.from} note="Spider 2.0" />
            <EvidenceBadge level="dashed" at={at('p0-20') - bF.from} note="n=1000 · 方法论未公开" />
          </div>
        </AbsoluteFill>
        <ArchifyRecap slug="failure-map" caption="失效四 · 未验证断言" cues={[{chapterId: 'fm-unverified', at: at('p0-19') - bF.from, durationInFrames: dur('p0-19')}]} />
        <ArchifyRecap slug="blueprint--industry-landscape" caption="落地断层" cues={[{chapterId: 'il-gap', at: at('p0-21') - bF.from, durationInFrames: dur('p0-21')}]} />
      </Sequence>

      {/* 0-G 发工卡 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="0-G">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <WorkCard stamps={0} totalSlots={7} highlightSlot={0} label="给 AI 的工卡" />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 夜机坪：地平线 + 呼吸机位灯（〔M-002〕以静写闷——匀速，不加强调）。 */
const NightApron: React.FC<{at01: number}> = ({at01}) => {
  const f = useCurrentFrame();
  const push = usePushIn(at01, {scale: 1.06, dur: 90});
  const lamps = useStagger(7, {stride: 6, at: 6});
  return (
    <AbsoluteFill style={{transform: push}}>
      <div style={{position: 'absolute', bottom: 120, left: 0, right: 0, height: 2, background: theme.panelBorder}} />
      {lamps.map((k, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: 124 + hash(i) * 60,
            left: `${10 + i * 13}%`,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: theme.concept,
            opacity: (k * 0.5 + 0.25) * (0.7 + 0.3 * Math.sin(f / 40 + i)),
          }}
        />
      ))}
      <div style={{position: 'absolute', right: '18%', top: '26%', width: 320}}>
        <WorkCard stamps={0} totalSlots={7} w={320} label="WORKCARD No.013" />
      </div>
    </AbsoluteFill>
  );
};

/** 19→85 数字对撞（口播只念数，画面翻牌）。 */
const NumCrash: React.FC<{from: number; to: number; at: number; label: string}> = ({from, to, at, label}) => {
  const prog = useSpring('settle', {at, dur: 45});
  const val = Math.round(from + (to - from) * prog);
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{fontSize: 120, fontWeight: 700, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>{val}%</div>
      <div style={{fontSize: 20, color: theme.dim}}>{label}</div>
    </div>
  );
};

/** 崩崖折线：87 → 10 下坠。 */
const CliffLine: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 24});
  const pts = [0, 12, 24, 36, 48, 60].map((x, i) => `${x + 20},${60 + Math.min(110, i * 28)}`).join(' ');
  return (
    <svg width={320} height={190} style={enter}>
      <polyline points={pts} fill="none" stroke={theme.conceptDeep} strokeWidth={4} strokeLinecap="round" />
      <circle cx={80} cy={170} r={5} fill={theme.conceptDeep} />
      <text x={30} y={52} fill={theme.dim} fontSize={18}>87%</text>
      <text x={96} y={180} fill={theme.conceptDeep} fontSize={18}>10%</text>
    </svg>
  );
};
