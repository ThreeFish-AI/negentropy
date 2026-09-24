/** P0 经验之困（p0-01..28）——老师傅的经验孤岛 → 两条老路 → 第三条路与轻量蒸馏定义。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, FunnelBurst, NoteBubbles, Stage} from '../components/devices';

/** 0-B 能力章 vs 上锁的规矩牌。 */
const CapabilityWall: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(3, {at, dur: DUR.f4, stride: 5});
  const caps = ['会写代码', '会读文件', '自己干完活'];
  const rules = ['报销流程', '评审口径', '环境坑点'];
  return (
    <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        {caps.map((c, i) => (
          <div
            key={c}
            style={{
              padding: '12px 26px',
              borderRadius: 10,
              border: `2px solid ${theme.ok}77`,
              background: `${theme.ok}14`,
              color: theme.ok,
              fontFamily: theme.sans,
              fontSize: 27,
              opacity: st[i],
              transform: `translateX(${(1 - st[i]) * -26}px)`,
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim}}>却不懂 →</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        {rules.map((r) => (
          <div
            key={r}
            style={{
              padding: '12px 26px',
              borderRadius: 10,
              border: `2px dashed ${theme.danger}88`,
              color: theme.danger,
              fontFamily: theme.sans,
              fontSize: 27,
            }}
          >
            {r} 🔒
          </div>
        ))}
      </div>
    </div>
  );
};

/** 0-C 引语卡 + 带价签的「上下文」。 */
const ContextCost: React.FC<{at: number}> = ({at}) => {
  const rise = useSpring('settle', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const chars = '把活干好所需的上下文'.split('');
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center'}}>
      <div
        style={{
          maxWidth: 1080,
          padding: '22px 34px',
          borderRadius: 12,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderLeft: `6px solid ${theme.spine}`,
          fontFamily: theme.serif,
          fontSize: 30,
          color: theme.text,
          lineHeight: 1.6,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 30}px)`,
        }}
      >
        「AI 越来越能干，却常常缺少把活干好所需的上下文。」
        <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}> — agentskills.io</span>
      </div>
      <div style={{display: 'flex', gap: 10}}>
        {chars.map((c, i) => {
          const p = progress(frame, at + 26 + i * 2, DUR.f3);
          return (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: p}}>
              <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.forge}}>¥</div>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  border: `1.5px solid ${theme.spine}88`,
                  background: `${theme.spine}1E`,
                  color: theme.text,
                  fontFamily: theme.sans,
                  fontSize: 27,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 0-E 文件夹飞入柜格 + 家谱线。 */
const FolderDrop: React.FC<{at: number}> = ({at}) => {
  const drop = useSpring('settle', {at, dur: DUR.f5});
  const line = useDraw(at + 10, DUR.f6);
  const stops: [string, string][] = [
    ['Anthropic 开发', theme.forge],
    ['开放标准发布', theme.spine],
    ['一大批 AI 产品支持', theme.book],
  ];
  return (
    <div style={{display: 'flex', gap: 100, alignItems: 'center'}}>
      <div
        style={{
          width: 240,
          height: 190,
          borderRadius: 12,
          border: `3px solid ${theme.book}`,
          background: `${theme.book}1E`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.book,
          opacity: drop,
          transform: `translateY(${(1 - drop) * -60}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 34}}> skill-name/ </div>
        <div style={{fontSize: 21, color: theme.dim}}>一个技能 = 一个文件夹</div>
      </div>
      <svg width={640} height={190} viewBox="0 0 640 190">
        <path d="M20 95 L600 95" stroke={theme.dim} strokeWidth={2} fill="none" {...line} />
        {stops.map(([t], i) => (
          <circle key={t} cx={70 + i * 250} cy={95} r={8} fill={stops[i][1]} opacity={line.strokeDashoffset < 1 - i * 0.3 ? 1 : 0.25} />
        ))}
      </svg>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
        {stops.map(([t, c], i) => (
          <div key={t} style={{fontFamily: theme.sans, fontSize: 24, color: c, opacity: line.strokeDashoffset < 1 - i * 0.3 ? 1 : 0.25}}>
            {i + 1}. {t}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 0-F 轻量蒸馏定义卡：左「大脑锁定」右「读到的文字」。 */
const DefineCard: React.FC<{at: number; lockAt: number}> = ({at, lockAt}) => {
  const frame = useCurrentFrame();
  const left = progress(frame, at, DUR.f5);
  const right = progress(frame, at + 12, DUR.f5);
  const lock = useImpulse({at: lockAt, dur: DUR.f4, peak: 1});
  return (
    <div style={{display: 'flex', gap: 34, alignItems: 'center'}}>
      <div
        style={{
          width: 420,
          padding: '24px 28px',
          borderRadius: 12,
          border: `2.5px solid ${theme.danger}99`,
          background: `${theme.danger}12`,
          opacity: left,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.danger}}>
          模型本身 <span style={{fontSize: 40, transform: `scale(${1 + lock * 0.3})`, display: 'inline-block'}}>🔒</span>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 10}}>一个参数都不改 · 不训练</div>
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim}}>只改 →</div>
      <div
        style={{
          width: 420,
          padding: '24px 28px',
          borderRadius: 12,
          border: `2.5px solid ${theme.book}99`,
          background: `${theme.book}14`,
          opacity: right,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.book}}>它读到的文字</div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 10}}>一个文件夹就能带走 → 所以「轻量」</div>
      </div>
    </div>
  );
};

export const P0Gap: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-07');
  const bC = w('p0-08', 'p0-11');
  const bD = w('p0-12', 'p0-16');
  const bE = w('p0-17', 'p0-22');
  const bF = w('p0-23', 'p0-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 老师傅">
        <SceneTag chapter="P0" tagline="经验之困" accent={theme.forge} />
        <div style={{position: 'absolute', left: 360, top: 470, display: 'flex', alignItems: 'center', gap: 30}}>
          <div style={{fontSize: 120}}>🧓</div>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, maxWidth: 380, lineHeight: 1.6}}>
            老师傅
            <div style={{fontSize: 24, color: theme.dim}}>经验只在一个人脑子里</div>
          </div>
        </div>
        <NoteBubbles items={['哪步会卡', '哪个接口其实坏了', '找谁最快']} at={at('p0-02') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="0-B 能干却不懂规矩">
        <SceneTag chapter="P0" tagline="经验之困" accent={theme.forge} />
        <Stage>
          <CapabilityWall at={at('p0-05') - bB.from} />
        </Stage>
      </Sequence>

      <Sequence {...bC} name="0-C 缺口与成本">
        <SceneTag chapter="P0" tagline="经验之困" accent={theme.forge} />
        <EvidenceBadge grade="official" />
        <Stage>
          <ContextCost at={at('p0-08') - bC.from} />
        </Stage>
        <Footnote delay={40}>上下文 = 此刻眼前的全部文字 · 每个字都有成本</Footnote>
      </Sequence>

      <Sequence {...bD} name="0-D 两条老路">
        <SceneTag chapter="P0" tagline="经验之困" accent={theme.forge} />
        <ArchifyYield
          cues={[
            {at: at('p0-12') - bD.from, durationInFrames: dur('p0-12')},
            {at: at('p0-15') - bD.from, durationInFrames: dur('p0-15')},
          ]}
        >
          <OldRoads at={at('p0-12') - bD.from} burstAt={at('p0-15') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="handbook-cabinet"
          caption="手册柜总览：两条老路与第三条路"
          cues={[
            {chapterId: 'old-empty', at: at('p0-12') - bD.from, durationInFrames: dur('p0-12')},
            {chapterId: 'old-stuff', at: at('p0-15') - bD.from, durationInFrames: dur('p0-15')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="0-E 第三条路">
        <SceneTag chapter="P0" tagline="经验之困" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p0-20') - bE.from, durationInFrames: dur('p0-20')}]}>
          <FolderDrop at={at('p0-17') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="handbook-cabinet"
          caption="第三条路：打包成文件夹"
          cues={[{chapterId: 'third-road', at: at('p0-20') - bE.from, durationInFrames: dur('p0-20')}]}
        />
      </Sequence>

      <Sequence {...bF} name="0-F 轻量蒸馏定义">
        <SceneTag chapter="P0" tagline="经验之困" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p0-25') - bF.from, durationInFrames: dur('p0-25')}]}>
          <DefineCard at={at('p0-23') - bF.from} lockAt={at('p0-24') - bF.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="handbook-cabinet"
          caption="轻量蒸馏：不改模型，只改读到的"
          cues={[{chapterId: 'light-distill', at: at('p0-25') - bF.from, durationInFrames: dur('p0-25')}]}
        />
        <Footnote delay={30}>淬炼 · 轻量蒸馏 · 按需装配 —— 本集三站</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 0-D 老路一问号雨 + 老路二漏斗。 */
const OldRoads: React.FC<{at: number; burstAt: number}> = ({at, burstAt}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', gap: 90, height: '72%', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>老路一 · 什么都不给</div>
        {['？', '？', '？', '？'].map((q, i) => {
          const p = progress(frame, at + i * 6, DUR.f4);
          return (
            <div key={i} style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim, opacity: p * 0.8, marginLeft: i * 26}}>
              {q}
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.danger}}>老路二 · 全塞进开场白</div>
        <FunnelBurst at={burstAt} />
      </div>
    </div>
  );
};
