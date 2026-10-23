/** P0 三个失忆现场（p0-01..12）——冷开场：三孤岛 → 碎片箱 → 图书馆亮相。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDim, useDraw, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {LibraryHUD} from '../components/devices';

/** 0-A 三失忆现场：三块小屏依次点亮，研究员在屏间奔走。 */
const ThreeScreens: React.FC<{at: number; runAt: number}> = ({at, runAt}) => {
  const screens = useStagger(3, {at, stride: 10, dur: DUR.f5});
  const run = useProgress(runAt, DUR.f6);
  const items = [
    {t: '换窗口就忘口味', s: '记忆'},
    {t: '喂了文档仍答非所问', s: '文档'},
    {t: '流程下次从头学', s: '技能'},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 240, display: 'flex', gap: 56, justifyContent: 'center', alignItems: 'flex-start'}}>
      {items.map((it, i) => (
        <div
          key={it.s}
          style={{
            width: 300,
            padding: '26px 24px',
            borderRadius: 12,
            border: `2px solid ${i === 1 ? theme.rose : theme.panelBorder}`,
            background: theme.panel,
            opacity: screens[i],
            transform: `translateY(${(1 - screens[i]) * 26}px)`,
            textAlign: 'center',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.rose, letterSpacing: 2}}>失忆现场 {i + 1}</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 10}}>{it.t}</div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8}}>〔{it.s}〕</div>
        </div>
      ))}
      <div style={{position: 'absolute', top: 186, left: `${22 + run * 52}%`, opacity: run > 0 ? 1 : 0.25, fontSize: 40, transition: 'none'}}>
        🏃
      </div>
    </div>
  );
};

/** 0-B 三孤岛：三张卡片各飞入三座岛，岛间海面裂开。 */
const SplitIslands: React.FC<{at: number; crackAt: number}> = ({at, crackAt}) => {
  const [a, b, c] = useStagger(3, {at, stride: 9, dur: DUR.f5});
  const crack = useDraw(crackAt, 30);
  const fly = [
    {p: a, label: '记忆 → 记忆库'},
    {p: b, label: '文档 → 向量库'},
    {p: c, label: '技能 → 提示词'},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 230, display: 'flex', gap: 60, justifyContent: 'center', alignItems: 'flex-start'}}>
      {fly.map((f, i) => (
        <div key={i} style={{textAlign: 'center'}}>
          <div
            style={{
              width: 260,
              height: 150,
              borderRadius: '14px 14px 40% 40%',
              border: `2px solid ${theme.panelBorder}`,
              background: `linear-gradient(180deg, ${theme.panel} 60%, ${theme.rose}11)`,
              opacity: f.p,
              transform: `translateY(${(1 - f.p) * -30}px)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.text,
            }}
          >
            {f.label}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 10}}>三种规矩 · 互不相识</div>
        </div>
      ))}
      <svg width={1480} height={60} style={{position: 'absolute', top: 440, left: 220}}>
        <path d="M40 20 C 300 62, 460 -18, 740 30 S 1240 58, 1440 16" fill="none" stroke={theme.rose} strokeWidth={3} {...crack} />
      </svg>
    </div>
  );
};

/** 0-C 碎片箱：捞起的碎片高度雷同，真答案沉底压暗。 */
const ShredBin: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const bits = useStagger(9, {at, stride: 4, dur: DUR.f4});
  const dim = useDim({at: at + 40});
  const labels = ['退款', '退款流程', '旧流程', '退款', '审批', '旧版', '退款审批', '流程', '答案'];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 260, display: 'flex', justifyContent: 'center', alignItems: 'flex-start'}}>
      <div
        style={{
          width: 720,
          height: 300,
          borderRadius: 14,
          border: `2px solid ${theme.panelBorder}`,
          background: '#0B0E13',
          padding: 24,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignContent: 'flex-start',
        }}
      >
        {labels.map((l, i) => {
          const gold = i === 8;
          const p = bits[Math.min(i, 8)];
          return (
            <div
              key={i}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: `1px dashed ${gold ? theme.dim : theme.rose}66`,
                color: gold ? theme.dim : theme.rose,
                fontFamily: theme.mono,
                fontSize: 19,
                opacity: p * (gold ? dim : 1),
                transform: `translateY(${(1 - p) * 14}px)`,
              }}
            >
              {l}
            </div>
          );
        })}
        <div style={{width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 17, color: theme.danger, opacity: progress(frame, at + 60, DUR.f4)}}>
          捞漏的那一片 · 后面任何一步都救不回来
        </div>
      </div>
    </div>
  );
};

/** 0-D 图书馆亮相：碎岛拼合成剪影 + 定名卡。 */
const LibraryMerge: React.FC<{at: number}> = ({at}) => {
  const merge = useProgress(at, DUR.f6);
  const show = useProgress(at + 20, DUR.f5);
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 230, textAlign: 'center'}}>
      <svg width={900} height={300} viewBox="0 0 900 300" style={{opacity: 0.3 + 0.7 * merge}}>
        <g stroke={theme.mint} strokeWidth={3} fill={`${theme.mint}0F`}>
          <path d={`M ${450 - 380 * merge} 250 H ${450 - 240 * merge} V ${130 - 40 * merge} H ${450 - 380 * merge} Z`} />
          <path d={`M ${450 + 380 * merge} 250 H ${450 + 240 * merge} V ${130 - 40 * merge} H ${450 + 380 * merge} Z`} />
          <path d={`M ${450 - 170 * merge} 250 V ${70 - 30 * merge} H ${450 + 170 * merge} V 250`} />
          <path d={`M ${450 - 140 * merge} 110 H ${450 + 140 * merge}`} />
        </g>
      </svg>
      <div
        style={{
          marginTop: -40,
          opacity: show,
          transform: `translateY(${(1 - show) * 18}px)`,
          display: 'inline-block',
          padding: '18px 44px',
          borderRadius: 12,
          border: `2px solid ${theme.mint}`,
          background: `${theme.mint}12`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.mint}}>给 AI 修一座图书馆</div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>OpenViking · 上下文数据库 · viking://</div>
      </div>
    </div>
  );
};

export const P0Amnesia: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-07');
  const bC = w('p0-08', 'p0-09');
  const bD = w('p0-10', 'p0-12');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 三失忆现场">
        <SceneTag chapter="P0" tagline="三个失忆现场" accent={theme.rose} />
        <ThreeScreens at={at('p0-01') - bA.from} runAt={at('p0-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="0-B 三孤岛">
        <SceneTag chapter="P0" tagline="三个失忆现场" accent={theme.rose} />
        <SplitIslands at={at('p0-05') - bB.from} crackAt={at('p0-07') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="0-C 碎片箱">
        <SceneTag chapter="P0" tagline="三个失忆现场" accent={theme.rose} />
        <ShredBin at={at('p0-08') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="0-D 图书馆亮相">
        <SceneTag chapter="P0" tagline="三个失忆现场" accent={theme.mint} />
        <LibraryMerge at={at('p0-10') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
