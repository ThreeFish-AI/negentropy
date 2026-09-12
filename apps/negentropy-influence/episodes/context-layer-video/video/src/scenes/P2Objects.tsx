/** P2 万物皆对象（分镜 2-A…2-G）
 *  维基条目 → 同义词隐形 → 说明书 → 签名问答 → 词条的一生状态机 → 全景金句。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useDim, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 2-A 维基条目标准身材 */
const WikiEntry: React.FC<{focusAt: number}> = ({focusAt}) => {
  const card = useSpring('settle', {at: 4});
  const fields = useStagger(6, {at: 14, stride: 5});
  const focus = useStagger(3, {at: focusAt, stride: 10});
  const names = ['id / name', 'synonyms 同义词', 'spec 正文', 'instructions 说明书', 'verified 签名问答', 'visibility 权限'];
  const hot = [1, 3, 4];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: card}}>
        <Panel accent={theme.grown} style={{width: 900, padding: '34px 44px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.grown}}>{'条目：毛收入'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'kind: metric · v4'}</div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 24}}>
            {names.map((n, i) => {
              const hi = hot.includes(i);
              return (
                <div
                  key={i}
                  style={{
                    opacity: fields[i],
                    border: `2px solid ${hi && focus[hot.indexOf(i)] > 0.5 ? theme.grown : theme.panelBorder}`,
                    borderRadius: 10,
                    padding: '14px 18px',
                    boxShadow: hi ? `0 0 ${focus[hot.indexOf(i)] * 14}px ${theme.grown}44` : 'none',
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 19, color: hi ? theme.grown : theme.dim}}>{n}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: focus[2]}}>
        {'三个字段决定它是死数据还是活上下文'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-B 同义词：隐形条目 */
const SynonymInvisible: React.FC<{missAt: number}> = ({missAt}) => {
  const def = useSpring('settle', {at: 4});
  const bubbles = useStagger(3, {at: 16, stride: 9});
  const frame = useCurrentFrame();
  const missT = progress(frame - missAt, 0, 20);
  const hitT = progress(frame - 20, 0, 18);
  const qs = ['营收', '销售额', '进账'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        {qs.map((q, i) => {
          const hit = i < 2;
          const fly = hit ? hitT : missT;
          return (
            <div
              key={i}
              style={{
                opacity: bubbles[i],
                transform: `translateX(${fly * 180}px)`,
              }}
            >
              <Panel accent={hit ? theme.grown : theme.panelBorder} style={{padding: '16px 30px'}}>
                <div style={{fontFamily: theme.sans, fontSize: 28, color: hit ? theme.grown : theme.dim}}>{'“' + q + '”'}</div>
              </Panel>
            </div>
          );
        })}
        {/* 检索窗玻璃 */}
        <div style={{position: 'relative'}}>
          <div
            style={{
              width: 20,
              height: 320,
              background: 'linear-gradient(180deg, rgba(163,217,119,0.12), rgba(163,217,119,0.03))',
              border: `3px solid ${theme.grown}55`,
              borderRadius: 8,
            }}
          />
          {missT > 0.6 ? (
            <svg width={90} height={110} style={{position: 'absolute', left: -34, top: 40}}>
              <path d="M 10 20 L 45 55 M 45 20 L 10 55 M 8 80 L 50 80" stroke={theme.danger} strokeWidth={4} opacity={Math.min(1, (missT - 0.6) * 4)} />
            </svg>
          ) : null}
        </div>
        <div style={{opacity: def}}>
          <Panel accent={theme.grown} style={{width: 300, padding: '24px 20px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'revenue'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.grown, marginTop: 8}}>{'synonyms: 营收/销售额'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.danger, marginTop: 6, opacity: missT}}>{'缺“进账” → 隐形'}</div>
          </Panel>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: missT}}>
        {'不是检索差——是没人告诉它这是一回事'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-C 说明书随定义走 */
const InstructionsTravel: React.FC = () => {
  const ver = useProgress(8, DUR.f5);
  const old = useDim({at: 50, to: 0.3});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90}}>
        <div>
          <Panel accent={theme.grown} style={{width: 560, padding: '28px 32px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.grown}}>
              {'定义卡 · v' + (ver > 0.5 ? '4' : '3')}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 16, opacity: ver > 0.5 ? 1 : 0.6}}>
              {'⚠ 注意：先聚合再相除'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 10}}>
              {ver > 0.5 ? '说明书同步更新 ✓' : '说明书 v3'}
            </div>
          </Panel>
        </div>
        <div style={{width: 460}}>
          {['提示词 A', '提示词 B', '提示词 C'].map((p, i) => (
            <div key={i} style={{marginBottom: 18, opacity: old + 0.4}}>
              <Panel style={{padding: '18px 22px'}}>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{p + ' · 过期蒙灰'}</div>
              </Panel>
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
        {'定义改了，提示词没人知道——错就永远留在那'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-D 签名问答 */
const SignedQA: React.FC<{hitAt: number}> = ({hitAt}) => {
  const card = useSpring('settle', {at: 4});
  const sig = useProgress(20, DUR.f5);
  const hit = useImpulse({at: hitAt, dur: DUR.f4});
  const glow = useProgress(hitAt, DUR.f4);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: card}}>
        <Panel accent={glow > 0.5 ? theme.activate : theme.panelBorder} style={{width: 840, padding: '32px 42px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'verified_queries[0]'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginTop: 12}}>{'Q：月收入是多少？'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 26, color: glow > 0.5 ? theme.activate : theme.dim, marginTop: 10}}>{'A: {01:200, 02:150, 03:300}'}</div>
          <svg width={700} height={50} style={{marginTop: 10}}>
            <path d={`M 20 30 C ${80 + 540 * sig} 6, ${160 + 560 * sig} 52, ${120 + 560 * sig} 28`} stroke={theme.activate} strokeWidth={3} fill="none" />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.activate, opacity: sig, marginTop: 4}}>
            {'签名: 数据组 · 2026-08-20'}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', right: 250, top: 280, opacity: glow, transform: `scale(${1 + hit * 0.1})`}}>
        <Panel accent={theme.activate} style={{padding: '14px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.activate}}>{'⚡ 命中 → 念答案'}</div>
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: glow}}>
        {'最便宜的信任来源'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-E/2-F/2-G 词条的一生状态机（三段共用轨道） */
const LIFE_TRACK = [
  {id: 'draft', x: 200, label: '草稿', color: theme.dim},
  {id: 'gate', x: 520, label: '校验门+评审', color: theme.blueprint},
  {id: 'governed', x: 860, label: '受治理', color: theme.grown},
  {id: 'conflict', x: 1180, label: '冲突', color: theme.danger},
  {id: 'rejected', x: 1520, label: '退场', color: theme.dim},
];

const Lifecycle: React.FC<{phase: 1 | 2 | 3; quoteAt: number}> = ({phase, quoteAt}) => {
  const frame = useCurrentFrame();
  const checks = useStagger(3, {at: 10, stride: 10});
  const rejectFlash = useImpulse({at: 40, dur: DUR.f4});
  const stamp = useSpring('snap', {at: 64, dur: DUR.f4});
  const fork = phase >= 2 ? useProgress(10, DUR.f5) : 0;
  const lamp = phase >= 2 ? useSpring('settle', {at: 40, dur: DUR.f5}) : 0;
  const superseded = phase >= 2 ? useProgress(80, DUR.f5) : 0;
  const allLit = phase === 3 ? useStagger(5, {at: 2, stride: 4}) : null;
  const quote = useProgress(quoteAt, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1720} height={520}>
        {/* 主轨道 */}
        <line x1={200} y1={300} x2={1520} y2={300} stroke={theme.panelBorder} strokeWidth={5} />
        {/* 冲岔与缓行线 */}
        {phase >= 2 ? (
          <>
            <path d={`M 860 300 C 980 300, 1000 220, 1180 220`} stroke={theme.danger} strokeWidth={3} fill="none" opacity={fork} strokeDasharray={fork < 1 ? '7 7' : undefined} />
            <path d={`M 1180 220 C 1380 220, 1420 300, 1520 300`} stroke={theme.danger} strokeWidth={3} fill="none" opacity={fork * 0.6} />
            <path d={`M 860 300 C 1000 380, 1240 380, 1420 380 L 1520 380`} stroke={theme.dim} strokeWidth={3} fill="none" opacity={superseded} strokeDasharray="4 8" />
          </>
        ) : null}
        {LIFE_TRACK.map((n, i) => {
          const lit = allLit ? allLit[i] : i === 0 ? 1 : 0;
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.id === 'conflict' ? 220 : 300} r={26 + (i === 2 ? 8 : 0)} fill={theme.panel}
                stroke={n.color} strokeWidth={4} opacity={0.35 + lit * 0.65} />
              <text x={n.x} y={n.id === 'conflict' ? 228 : 308} textAnchor="middle" fontSize={22} fill={n.color} fontFamily={theme.sans} opacity={0.5 + lit * 0.5}>
                {n.label}
              </text>
            </g>
          );
        })}
        {/* 光点：phase1 走 draft→governed；phase2 静止展示岔道 */}
        {phase === 1 ? <circle cx={200 + Math.min(1, frame / 90) * 660} cy={300} r={13} fill={theme.grown} style={{filter: `drop-shadow(0 0 10px ${theme.grown})`}} /> : null}
        {/* phase1：三道检查 + 拒收支路 */}
        {phase === 1 ? (
          <>
            {['表存在?', '指向唯一键?', '名字唯一?'].map((c, i) => (
              <g key={i} opacity={checks[i]}>
                <rect x={470 + i * 4} y={120 + i * 34} width={0} height={0} />
                <text x={520} y={130 + i * 34} fontSize={20} fill={checks[i] > 0.9 ? theme.ok : theme.dim} fontFamily={theme.mono}>
                  {(checks[i] > 0.9 ? '✓ ' : '… ') + c}
                </text>
              </g>
            ))}
            <text x={520} y={250} fontSize={20} fill={theme.danger} fontFamily={theme.mono} opacity={rejectFlash}>
              {'✗ 校验不过 → 拒收（不进运行时）'}
            </text>
            <text x={860} y={380} textAnchor="middle" fontSize={26} fill={theme.grown} fontFamily={theme.sans} opacity={stamp}>
              {'盖章 · 转正'}
            </text>
          </>
        ) : null}
        {/* phase2：裁决灯 + 取代标签 */}
        {phase >= 2 ? (
          <>
            <g opacity={lamp} transform={`translate(0, ${(1 - lamp) * -120})`}>
              <text x={1180} y={130} textAnchor="middle" fontSize={44}>{'💡'}</text>
              <text x={1180} y={170} textAnchor="middle" fontSize={19} fill={theme.text} fontFamily={theme.sans}>
                {'人工裁决：胜者回站 · 败者退场'}
              </text>
            </g>
            <text x={1290} y={424} fontSize={19} fill={theme.dim} fontFamily={theme.sans} opacity={superseded}>
              {'已被取代：可搜到 · 排序靠后（老了，不是错了）'}
            </text>
          </>
        ) : null}
      </svg>
      {phase === 3 ? (
        <div style={{position: 'absolute', bottom: 250, fontFamily: theme.serif, fontSize: 44, color: theme.grown, opacity: quote}}>
          {'「谁说了算」从人情问题，变成流程问题。'}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const P2Objects: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-06', 'p2-10');
  const bC = w('p2-11', 'p2-14');
  const bD = w('p2-15', 'p2-17');
  const bE = w('p2-18', 'p2-22');
  const bF = w('p2-23', 'p2-28');
  const bG = w('p2-29', 'p2-32');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 条目身材">
        <WikiEntry focusAt={at('p2-05') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="2-B 同义词隐形">
        <SynonymInvisible missAt={at('p2-10') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="2-C 说明书">
        <InstructionsTravel />
      </Sequence>
      <Sequence {...bD} name="2-D 签名问答">
        <SignedQA hitAt={at('p2-17') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="2-E 出生与转正">
        <Lifecycle phase={1} quoteAt={9999} />
      </Sequence>
      <Sequence {...bF} name="2-F 岔道与取代">
        <Lifecycle phase={2} quoteAt={9999} />
      </Sequence>
      <Sequence {...bG} name="2-G 全景金句">
        <Lifecycle phase={3} quoteAt={at('p2-32') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
