/** P1 每天重新入职的天才（分镜 1-A…1-D）
 *  实习生记忆清零 → 三病灶 → Horizon Context 命名 + 三句递进 → 入职包命名帧。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 1-A 实习生每日记忆清零 → AI 助手同款 */
const Amnesia: React.FC = () => {
  const frame = useCurrentFrame();
  const days = Math.floor(frame / 16);
  const wipe = progress(frame % 16, 0, 6);
  const aiAt = 66;
  const ai = useSpring('settle', {at: aiAt});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 160, alignItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 120}}>{'🧑‍💼'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 8}}>{'实习生'}</div>
          <div
            style={{
              marginTop: 14,
              fontFamily: theme.mono,
              fontSize: 24,
              color: wipe > 0.5 ? theme.danger : theme.dim,
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 10,
              padding: '8px 18px',
            }}
          >
            {'记忆: '}
            <span style={{opacity: 1 - wipe}}>{'████'}</span>
            <span style={{opacity: wipe}}>{'····'}</span>
          </div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {`第 ${days + 1} 天 · 从零开始`}
          </div>
        </div>
        <div style={{textAlign: 'center', opacity: ai, transform: `translateY(${(1 - ai) * 20}px)`}}>
          <div style={{fontSize: 120}}>{'🤖'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 8}}>{'AI 助手'}</div>
          <div
            style={{
              marginTop: 14,
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.danger,
              border: `2px solid ${theme.danger}66`,
              borderRadius: 10,
              padding: '8px 18px',
            }}
          >
            {'记忆: ····'}
          </div>
          <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            {'进公司时，就是这个状态'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 1-B 三病灶：散落 / 漂移 / 翻墙 */
const ThreeSores: React.FC<{jumpAt: number}> = ({jumpAt}) => {
  const st = useStagger(3, {at: 8, stride: 10});
  const frame = useCurrentFrame();
  const jumpP = progress(frame - jumpAt, 0, 16);
  const titles = ['含义散落', '外挂词典漂移', '外挂治理拦不住'];
  const subs = ['二十个看板二十种算法', '两层系统来回对账', '翻墙直查，告示管不着'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 44}}>
        {titles.map((t, i) => (
          <div key={i} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 30}px)`}}>
            <Panel accent={theme.panelBorder} style={{width: 380, padding: '30px 24px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{`0${i + 1}`}</div>
              <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text, marginTop: 10}}>
                {t}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 12}}>{subs[i]}</div>
            </Panel>
          </div>
        ))}
      </div>
      {/* 第三卡上的翻墙小人（弧线越过告示） */}
      {jumpP > 0 && jumpP < 1 ? (
        <svg width={1920} height={1080} style={{position: 'absolute'}}>
          <path
            d={`M ${1180 + 240 * jumpP} ${730 - Math.sin(jumpP * Math.PI) * 120} L ${1182 + 240 * jumpP} ${732 - Math.sin(jumpP * Math.PI) * 120}`}
            stroke={theme.danger}
            strokeWidth={8}
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

/** 1-C 命名帧：三卡收拢成楼 + 三句递进 */
const NamingAndLadder: React.FC<{ladderAt: number}> = ({ladderAt}) => {
  const frame = useCurrentFrame();
  const merge = useSpring('settleSoft', {at: 2});
  const nameAt = 30;
  const nameO = useProgress(nameAt, DUR.f5);
  const st = useStagger(3, {at: ladderAt, stride: 12});
  const thirdGlow = useProgress(ladderAt + 30, DUR.f5);
  const steps = ['没有上下文，AI 在猜', '上下文进了平台，AI 能干活', '上下文被治理，AI 才值得信'];
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <rect
          x={760}
          y={300}
          width={400}
          height={300 * merge}
          rx={10}
          fill="none"
          stroke={theme.manual}
          strokeWidth={4}
          opacity={merge}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: 240,
          width: '100%',
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 54,
          color: theme.manual,
          opacity: nameO,
          textShadow: `0 0 ${18 * thirdGlow}px ${theme.manual}55`,
        }}
      >
        {'Horizon Context'}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 660,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 60,
        }}
      >
        {steps.map((s, i) => (
          <div key={i} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 24}px)`}}>
            <Panel
              accent={i === 2 && thirdGlow > 0 ? theme.manual : theme.panelBorder}
              style={{width: 420, padding: '24px 20px', textAlign: 'center'}}
            >
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{`第${i + 1}句`}</div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 26,
                  marginTop: 8,
                  color: i === 2 && thirdGlow > 0 ? theme.manual : theme.text,
                }}
              >
                {s}
              </div>
            </Panel>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', bottom: 220, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: st[2]}}>
        {'含义不是文件，是装进系统里的一套制度'}
      </div>
      {frame < 2 ? null : null}
    </AbsoluteFill>
  );
};

/** 1-D 入职包命名帧（全片视觉锚） */
const OnboardPack: React.FC = () => {
  const open = useSpring('settleSoft', {at: 4});
  const st = useStagger(5, {at: 26, stride: 7});
  const pulse = useImpulse({at: 62, dur: DUR.f6});
  const items = [
    {icon: '📕', label: '手册', sub: '语义视图'},
    {icon: '🧮', label: '算法纪律', sub: '查询时重算'},
    {icon: '🎫', label: '门禁卡', sub: '引擎级权限'},
    {icon: '📓', label: '观察笔记', sub: '使用痕迹'},
    {icon: '🔔', label: '问询处', sub: '检索排序'},
  ];
  const wHalf = 300 + 220 * open;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <rect
          x={960 - wHalf}
          y={430}
          width={wHalf * 2}
          height={240}
          rx={18}
          fill={theme.panel}
          stroke={theme.manual}
          strokeWidth={4}
        />
        <line x1={960} y1={434} x2={960} y2={670} stroke={theme.manual} strokeWidth={3} opacity={open} />
      </svg>
      <div style={{position: 'absolute', top: 330, fontFamily: theme.serif, fontSize: 40, color: theme.manual, opacity: open}}>
        {'永远最新的入职包'}
      </div>
      <div style={{display: 'flex', gap: 30, marginTop: 180}}>
        {items.map((it, i) => (
          <div key={i} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 18}px) scale(${1 + pulse * 0.05})`}}>
            <Panel style={{width: 190, padding: '20px 10px', textAlign: 'center'}}>
              <div style={{fontSize: 44}}>{it.icon}</div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 6}}>{it.label}</div>
              <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 4}}>{it.sub}</div>
            </Panel>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const P1Intern: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-07');
  const bB = w('p1-08', 'p1-16');
  const bC = w('p1-17', 'p1-22');
  const bD = w('p1-23', 'p1-27');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 记忆清零">
        <Amnesia />
      </Sequence>
      <Sequence {...bB} name="1-B 三病灶">
        <ThreeSores jumpAt={at('p1-16') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="1-C 命名与三句">
        <NamingAndLadder ladderAt={at('p1-19') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="1-D 入职包命名帧">
        <OnboardPack />
      </Sequence>
    </AbsoluteFill>
  );
};
