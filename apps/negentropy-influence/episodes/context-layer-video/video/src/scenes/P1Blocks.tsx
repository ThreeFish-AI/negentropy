/** P1 五块积木（分镜 1-A…1-E）
 *  两问开场 → 对象/目录 → 富化/治理/激活 → 正交演示 → 数据的一生。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 积木定义（1-B/1-C 复用） */
const BLOCKS = [
  {n: '1', name: '对象', q: '放什么', icon: '🗃️'},
  {n: '2', name: '目录', q: '怎么找', icon: '📋'},
  {n: '3', name: '富化', q: '怎么养', icon: '🌱'},
  {n: '4', name: '治理', q: '怎么信', icon: '🛡️'},
  {n: '5', name: '激活', q: '怎么用', icon: '🔌'},
];

/** 1-A 两个大问号 */
const TwoQuestions: React.FC = () => {
  const st = useStagger(2, {at: 2, stride: 10});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 90}}>
      {['放什么？', '怎么找？'].map((q, i) => (
        <div key={i} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 20}px)`, fontFamily: theme.serif, fontSize: 90, color: i === 0 ? theme.blueprint : theme.activate}}>
          {q}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 1-B 积木一二：对象抽屉 + 目录账本（指针不复制） */
const BlocksOneTwo: React.FC<{copyAt: number}> = ({copyAt}) => {
  const b1 = useSpring('settle', {at: 4});
  const b2 = useSpring('settle', {at: 22});
  const arrows = useStagger(3, {at: 44, stride: 8});
  const cross = useProgress(copyAt, DUR.f4);
  const sig = useStagger(4, {at: copyAt + 26, stride: 8});
  const sources = ['记忆', '知识', '技能'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 130, alignItems: 'center'}}>
        <div style={{opacity: b1, textAlign: 'center'}}>
          <Panel accent={theme.blueprint} style={{width: 330, padding: '28px 22px'}}>
            <div style={{fontSize: 56}}>{'🗃️'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.blueprint, marginTop: 10}}>{'① 对象存储'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 8}}>{'放什么：含义皆对象'}</div>
          </Panel>
        </div>
        {/* 目录账本：指针行 */}
        <div style={{opacity: b2}}>
          <Panel accent={theme.blueprint} style={{width: 560, padding: '26px 30px', position: 'relative'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.blueprint}}>{'② 目录 · 统一的账'}</div>
            {sources.map((s, i) => (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 22, opacity: arrows[i]}}>
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.text, width: 90}}>{s}</div>
                <svg width={220} height={20}>
                  <line x1={0} y1={10} x2={200 * arrows[i]} y2={10} stroke={theme.blueprint} strokeWidth={3} markerEnd="url(#arrowhead)" />
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill={theme.blueprint} />
                    </marker>
                  </defs>
                </svg>
                <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'→ 原处'}</div>
              </div>
            ))}
            {/* 抄写叉路被划掉 */}
            <div style={{position: 'absolute', right: 30, top: 90, fontFamily: theme.mono, fontSize: 19, color: theme.danger, opacity: cross}}>
              <span style={{textDecoration: cross > 0.5 ? 'line-through' : 'none'}}>{'复制一份'}</span>
              <span style={{marginLeft: 10}}>{'✗'}</span>
            </div>
          </Panel>
        </div>
      </div>
      {/* 四类信号标签 */}
      <div style={{position: 'absolute', bottom: 240, display: 'flex', gap: 22}}>
        {['它是什么', '跑得如何', '含义归谁', '大家爱用'].map((s, i) => (
          <div key={i} style={{opacity: sig[i]}}>
            <Panel style={{padding: '10px 20px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{s}</div>
            </Panel>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', bottom: 215, right: 240, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: cross}}>
        {'抄一份就有两份——两份迟早打架'}
      </div>
    </AbsoluteFill>
  );
};

/** 1-C 积木三四五落位，拼成机器 */
const BlocksRest: React.FC<{linkAt: number}> = ({linkAt}) => {
  const st = useStagger(3, {at: 4, stride: 12});
  const outline = useDraw(linkAt, DUR.f6);
  const glow = useProgress(linkAt + 20, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 26}}>
        {BLOCKS.slice(2).map((b, i) => (
          <div key={i} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 30}px)`}}>
            <Panel accent={theme.blueprint} style={{width: 250, padding: '26px 18px', textAlign: 'center'}}>
              <div style={{fontSize: 50}}>{b.icon}</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.blueprint, marginTop: 10}}>{`③④⑤ ${b.name}`}</div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 6}}>{b.q}</div>
            </Panel>
          </div>
        ))}
      </div>
      <svg width={1100} height={260} style={{position: 'absolute'}}>
        <rect x={120} y={80} width={860} height={120} rx={16} fill="none" stroke={theme.blueprint} strokeWidth={4} {...outline}
          style={{filter: `drop-shadow(0 0 ${glow * 16}px ${theme.blueprint})`}} />
        <text x={555} y={240} textAnchor="middle" fontSize={26} fill={theme.blueprint} fontFamily={theme.sans} opacity={glow}>
          {'五块拼成一台机器'}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/** 1-D 正交演示：音响三层换一层 */
const OrthogonalDemo: React.FC<{swapAt: number}> = ({swapAt}) => {
  const layers = useStagger(3, {at: 4, stride: 10});
  const frame = useCurrentFrame();
  const pull = progress(frame - swapAt, 0, 18);
  const badge = useImpulse({at: swapAt + 20, dur: DUR.f4});
  const names = ['装修', '功放', '音箱'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
        {names.map((n, i) => {
          const isSpeaker = i === 2;
          const dy = isSpeaker ? -pull * 140 : 0;
          return (
            <div key={i} style={{opacity: layers[i], transform: `translateY(${dy}px)`}}>
              <Panel
                accent={isSpeaker && pull > 0.3 ? theme.activate : theme.panelBorder}
                style={{width: isSpeaker ? 520 : 480, padding: '20px 26px', textAlign: 'center'}}
              >
                <div style={{fontFamily: theme.sans, fontSize: 26, color: isSpeaker && pull > 0.3 ? theme.activate : theme.text}}>
                  {n + (isSpeaker ? ' · 换掉' : ' · 不动')}
                </div>
              </Panel>
              {isSpeaker && pull > 0.4 ? (
                <div style={{textAlign: 'center', marginTop: 8, opacity: badge, fontFamily: theme.sans, fontSize: 22, color: theme.activate}}>
                  {'✓ 其余两层纹丝不动'}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: badge}}>
        {'换任何一块，别的块不用动——工程生存术'}
      </div>
    </AbsoluteFill>
  );
};

/** 1-E 数据的一生：光点过五站 */
const LifeOfDatum: React.FC = () => {
  const frame = useCurrentFrame();
  const p = progress(Math.max(0, frame - 10), 0, 90);
  const lit = useStagger(5, {at: 10, stride: 16});
  const land = useSpring('snap', {at: 96, dur: DUR.f5});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1700} height={300}>
        <line x1={130} y1={150} x2={1570} y2={150} stroke={theme.panelBorder} strokeWidth={4} />
        {BLOCKS.map((b, i) => {
          const x = 170 + i * 340;
          return (
            <g key={i}>
              <circle cx={x} cy={150} r={34} fill={theme.panel} stroke={lit[i] > 0.5 ? theme.blueprint : theme.panelBorder} strokeWidth={4}
                style={{filter: `drop-shadow(0 0 ${lit[i] * 14}px ${theme.blueprint})`}} />
              <text x={x} y={158} textAnchor="middle" fontSize={26}>{b.icon}</text>
              <text x={x} y={226} textAnchor="middle" fontSize={24} fill={theme.text} fontFamily={theme.sans} opacity={lit[i]}>
                {b.name}
              </text>
              <text x={x} y={258} textAnchor="middle" fontSize={18} fill={theme.dim} fontFamily={theme.sans} opacity={lit[i]}>
                {b.q}
              </text>
            </g>
          );
        })}
        {/* 光点巡游 */}
        <circle cx={170 + p * 1360} cy={150} r={14} fill={theme.activate} style={{filter: `drop-shadow(0 0 12px ${theme.activate})`}} opacity={p < 1 ? 1 : 0} />
      </svg>
      <div style={{position: 'absolute', bottom: 260, fontFamily: theme.sans, fontSize: 30, color: theme.text, opacity: land, transform: `scale(${1 + land * 0.05})`}}>
        {'🤲 交到 AI 手上'}
      </div>
    </AbsoluteFill>
  );
};

export const P1Blocks: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-11');
  const bC = w('p1-12', 'p1-17');
  const bD = w('p1-18', 'p1-21');
  const bE = w('p1-22', 'p1-26');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 两问">
        <TwoQuestions />
      </Sequence>
      <Sequence {...bB} name="1-B 对象与目录">
        <BlocksOneTwo copyAt={at('p1-09') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="1-C 三四五积木">
        <BlocksRest linkAt={at('p1-17') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="1-D 正交演示">
        <OrthogonalDemo swapAt={at('p1-19') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="1-E 数据的一生">
        <LifeOfDatum />
      </Sequence>
    </AbsoluteFill>
  );
};
