/** P5 机位时间与工卡夹：激活层（p5-01..p5-27，28 句；storyboard「P5 机位时间」节）。
 *
 *  9 镜 / 9 条 archify cue：
 *   5-A 计时器烧钱装置 · 5-B 裁纸刀 + ae-k1@04 · 5-C 46/19 工具墙 + ae-k2@07
 *   5-D ae-k3@12 · 5-E ae-k4@14→ae-k5@15 + 交接班折行 · 5-F ae-knobs@17
 *   5-G ae-ch@19 · 5-H ae-guard@21→ae-llm@22 · 5-I 三维拼图收口 + 第 5 格
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {useEnter, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {WorkCard} from '../components/WorkCard';

export const P5Tarmac: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P5" tagline="机位时间与工卡夹 · 激活层" accent={theme.concept} />

      {/* 5-A 计时器 */}
      <Sequence from={0} durationInFrames={dur('p5-01', 'p5-03')} name="5-A">
        <BurnClock at={at('p5-03')} />
      </Sequence>

      {/* 5-B 最小够用 */}
      <Sequence from={at('p5-04')} durationInFrames={dur('p5-04', 'p5-06')} name="5-B">
        <PaperCut at={at('p5-04')} />
        <ArchifyRecap slug="assembly-economics" caption="旋钮一 · 预算分配" cues={[{chapterId: 'ae-k1', at: at('p5-04'), durationInFrames: dur('p5-04', 'p5-06')}]} />
      </Sequence>

      {/* 5-C 渐进披露 + 46/19 */}
      <Sequence from={at('p5-07')} durationInFrames={dur('p5-07', 'p5-11')} name="5-C">
        <ToolWall46 at={at('p5-10')} />
        <div style={{position: 'absolute', bottom: 90, left: 80}}>
          <EvidenceBadge level="solid" at={at('p5-10')} note="Llama 3.1 8B · 16k 窗" />
        </div>
        <ArchifyRecap slug="assembly-economics" caption="旋钮二 · 渐进披露" cues={[{chapterId: 'ae-k2', at: at('p5-07'), durationInFrames: dur('p5-07', 'p5-09')}]} />
      </Sequence>

      {/* 5-D JIT */}
      <Sequence from={at('p5-12')} durationInFrames={dur('p5-12', 'p5-13')} name="5-D">
        <ArchifyRecap slug="assembly-economics" caption="旋钮三 · 预取 vs 按需" cues={[{chapterId: 'ae-k3', at: at('p5-12'), durationInFrames: dur('p5-12', 'p5-13')}]} />
      </Sequence>

      {/* 5-E 缓存与压缩 */}
      <Sequence from={at('p5-14')} durationInFrames={dur('p5-14', 'p5-16')} name="5-E">
        <ArchifyRecap
          slug="assembly-economics"
          caption="旋钮四缓存 · 旋钮五压缩"
          cues={[
            {chapterId: 'ae-k4', at: at('p5-14'), durationInFrames: dur('p5-14')},
            {chapterId: 'ae-k5', at: at('p5-15'), durationInFrames: dur('p5-15', 'p5-16')},
          ]}
        />
      </Sequence>

      {/* 5-F 五旋钮命名 */}
      <Sequence from={at('p5-17')} durationInFrames={dur('p5-17', 'p5-18')} name="5-F">
        <KnobNaming at={at('p5-17')} />
        <ArchifyRecap slug="assembly-economics" caption="装配经济学 · 命名" cues={[{chapterId: 'ae-knobs', at: at('p5-17'), durationInFrames: dur('p5-17', 'p5-18')}]} />
      </Sequence>

      {/* 5-G 检索前置 */}
      <Sequence from={at('p5-19')} durationInFrames={dur('p5-19', 'p5-20')} name="5-G">
        <ArchifyRecap slug="assembly-economics" caption="双通道 · 统一融合" cues={[{chapterId: 'ae-ch', at: at('p5-19'), durationInFrames: dur('p5-19', 'p5-20')}]} />
      </Sequence>

      {/* 5-H resolve 总入口 */}
      <Sequence from={at('p5-21')} durationInFrames={dur('p5-21', 'p5-24')} name="5-H">
        <ResolveGate at={at('p5-21')} />
        <ArchifyRecap
          slug="assembly-economics"
          caption="出口守卫 · 入窗"
          cues={[
            {chapterId: 'ae-guard', at: at('p5-21'), durationInFrames: dur('p5-21')},
            {chapterId: 'ae-llm', at: at('p5-22'), durationInFrames: dur('p5-22', 'p5-24')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 5-I 拼图收口 + 第 5 格 */}
      <Sequence from={at('p5-25')} durationInFrames={dur('p5-25', 'p5-27')} name="5-I">
        <PuzzleMerge at={at('p5-25')} />
        <AbsoluteFill style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 56}}>
          <WorkCard stamps={5} totalSlots={7} highlightSlot={4} w={320} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

const BurnClock: React.FC<{at: number}> = ({at}) => {
  const tick = useSpring('settle', {at, dur: 120});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 84, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>${(1200 + tick * 3400).toFixed(0)}</div>
        <div style={{fontSize: 22, color: theme.dim}}>机位时间 · 每分钟都在烧</div>
      </div>
      <div style={{width: 260, height: 60, border: `2px solid ${theme.concept}`, borderRadius: 10, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: theme.dim}}>
        工卡夹 · 就一块
      </div>
    </AbsoluteFill>
  );
};

const PaperCut: React.FC<{at: number}> = ({at}) => {
  const cut = useSpring('settle', {at, dur: 30});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 46}}>
      <div style={{width: 200, height: 300, background: theme.panelBorder, borderRadius: 6, position: 'relative', overflow: 'hidden'}}>
        {Array.from({length: 28}, (_, i) => (
          <div key={i} style={{position: 'absolute', left: 8, right: 8, top: 8 + i * 10, height: 5, background: theme.bg, opacity: 0.55}} />
        ))}
      </div>
      <div style={{fontSize: 48, color: theme.concept}}>✂</div>
      <div style={{width: 110, height: 74, background: '#F2F5FA', borderRadius: 4, transform: `translateX(${cut * 30}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#171C26'}}>
        本卡 4 页
      </div>
    </AbsoluteFill>
  );
};

const ToolWall46: React.FC<{at: number}> = ({at}) => {
  const cells = useStagger(46, {stride: 2, at, dur: 3});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 860, height: 360, display: 'grid', gridTemplateColumns: 'repeat(16,1fr)', gap: 6}}>
        {cells.map((k, i) => {
          const bad = i < 46;
          const good = i >= 50 && i < 69;
          return (
            <div
              key={i}
              style={{
                height: 34,
                borderRadius: 4,
                opacity: (bad || good ? k : 0) * 0.9,
                background: bad ? theme.conceptDeep : good ? theme.ok : 'transparent',
                border: bad || good ? 'none' : `1px dashed ${theme.panelBorder}`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const KnobNaming: React.FC<{at: number}> = ({at}) => {
  const knobs = useStagger(5, {stride: 12, at});
  const names = ['预算分配', '渐进披露', '预取按需', '缓存排序', '压缩分级'];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 18}}>
        {names.map((t, i) => (
          <div key={t} style={{opacity: knobs[i], width: 150, padding: '16px 10px', border: `2px solid ${theme.concept}`, borderRadius: 10, textAlign: 'center'}}>
            <div style={{fontSize: 30, color: theme.concept}}>{i + 1}</div>
            <div style={{fontSize: 20, color: theme.text, marginTop: 6}}>{t}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ResolveGate: React.FC<{at: number}> = ({at}) => {
  const open = useSpring('settle', {at, dur: 26});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={820} height={260}>
        <text x={40} y={130} fill={theme.dim} fontSize={22}>问题</text>
        <rect x={110} y={80} width={120} height={100} rx={10} fill="none" stroke={theme.concept} strokeWidth={2} />
        <text x={132} y={136} fill={theme.concept} fontSize={20}>总入口</text>
        <path d={`M 230 130 L ${330 + open * 60} 130`} stroke={theme.ok} strokeWidth={3} />
        <rect x={400} y={70} width={200} height={120} rx={10} fill="rgba(126,211,33,0.08)" stroke={theme.ok} strokeWidth={2} />
        <text x={424} y={120} fill={theme.ok} fontSize={20}>配好料的上下文</text>
        <text x={424} y={152} fill={theme.dim} fontSize={16}>top-k · 指令 · 底稿? · 告警</text>
        <path d="M 600 130 L 700 130" stroke={theme.ok} strokeWidth={3} />
        <text x={712} y={136} fill={theme.text} fontSize={22}>模型</text>
      </svg>
    </AbsoluteFill>
  );
};

const PuzzleMerge: React.FC<{at: number}> = ({at}) => {
  const parts = useStagger(3, {stride: 18, at});
  const labels = ['五源', '五层', '五段'];
  const colors = [theme.concept, theme.conceptDeep, theme.ok];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex'}}>
        {labels.map((t, i) => (
          <div
            key={t}
            style={{
              width: 190,
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
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
