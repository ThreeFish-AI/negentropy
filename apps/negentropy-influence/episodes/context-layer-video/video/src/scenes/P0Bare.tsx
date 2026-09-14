/** P0 你的 AI 也在裸奔吗（分镜 0-A…0-B）
 *  三张对话卡（✓/?/✗）→「入职第一天」日历碎裂 → 大楼远景 → 蓝图纸片名。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useBreathe, useImpulse, useProgress, usePushIn, useSpring, useStagger} from '../motion';

/** 0-A 三卡 + 日历碎裂 */
const AssistantBare: React.FC<{crushAt: number}> = ({crushAt}) => {
  const cards = useStagger(3, {at: 4, stride: 12});
  const crush = useImpulse({at: crushAt, dur: DUR.f5});
  const frame = useCurrentFrame();
  const q = useBreathe({period: 110});
  const shards = 8;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{fontSize: 110, marginBottom: 30}}>{'🤖'}</div>
        <div style={{display: 'flex', gap: 40}}>
          {[
            {t: '写周报', s: '✓ 利索', c: theme.ok},
            {t: '查活跃用户', s: '? 不敢答', c: theme.dim},
            {t: '编一个数', s: '✗ 一本正经', c: theme.danger},
          ].map((c, i) => (
            <div key={i} style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 22}px)`}}>
              <Panel accent={c.c} style={{width: 280, padding: '22px 18px', textAlign: 'center'}}>
                <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{c.t}</div>
                <div style={{fontFamily: theme.sans, fontSize: 20, color: c.c, marginTop: 10}}>{c.s}</div>
              </Panel>
            </div>
          ))}
        </div>
        {/* 入职第一天日历：碎裂 */}
        <div style={{position: 'relative', marginTop: 44, height: 120}}>
          {frame < crushAt ? (
            <Panel accent={theme.blueprint} style={{padding: '16px 34px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.blueprint}}>{'📅 入职第一天'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6}}>{'（从未发生过）'}</div>
            </Panel>
          ) : (
            <svg width={420} height={120}>
              {Array.from({length: shards}, (_, i) => {
                const t = Math.min(1, (frame - crushAt) / 22);
                const ang = (i / shards) * Math.PI * 2;
                const d = t * 130;
                return (
                  <rect
                    key={i}
                    x={210 + Math.cos(ang) * d}
                    y={50 + Math.sin(ang) * d * 0.7}
                    width={22}
                    height={16}
                    fill={theme.blueprint}
                    opacity={Math.max(0, 1 - t)}
                    transform={`rotate(${t * 180 + i * 45} ${210 + Math.cos(ang) * d} ${50 + Math.sin(ang) * d * 0.7})`}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: q > 0.5 ? 1 : 0.7}}>
        {'没人给过它术语手册——每次都在从零猜'}
      </div>
    </AbsoluteFill>
  );
};

/** 0-B 大楼远景 → 蓝图纸片名 */
const BlueprintTitle: React.FC = () => {
  const tower = useProgress(2, DUR.f5);
  const zoomBack = useProgress(26, DUR.f5);
  const paper = useSpring('settle', {at: 40});
  const title = useProgress(56, DUR.f5);
  const scale = 1 + tower * 0.35 - zoomBack * 0.35;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', transform: `scale(${scale})`}}>
        <rect x={810} y={340} width={300} height={380} fill={theme.panel} stroke={theme.dim} strokeWidth={3} opacity={tower * (1 - zoomBack)} />
        {Array.from({length: 6}, (_, i) => (
          <rect key={i} x={840 + (i % 3) * 80} y={380 + Math.floor(i / 3) * 90} width={44} height={44} fill={theme.grown} opacity={tower * (1 - zoomBack) * 0.7} />
        ))}
        <text x={960} y={780} textAnchor="middle" fontSize={22} fill={theme.dim} fontFamily={theme.sans} opacity={tower * (1 - zoomBack)}>
          {'大厂内部：含义已是基础设施'}
        </text>
      </svg>
      {/* 蓝图纸展开 */}
      <div style={{opacity: paper, transform: `scale(${0.9 + 0.1 * paper})`}}>
        <div
          style={{
            width: 1100,
            height: 560,
            background: '#10151E',
            border: `3px solid ${theme.blueprint}`,
            borderRadius: 14,
            position: 'relative',
            opacity: 0.95,
          }}
        >
          {/* 蓝图网格 */}
          <svg width={1100} height={560} style={{position: 'absolute'}}>
            {Array.from({length: 11}, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 56} x2={1100} y2={i * 56} stroke={theme.blueprint} strokeWidth={1} opacity={0.12} />
            ))}
            {Array.from({length: 21}, (_, i) => (
              <line key={`v${i}`} x1={i * 55} y1={0} x2={i * 55} y2={560} stroke={theme.blueprint} strokeWidth={1} opacity={0.12} />
            ))}
          </svg>
          <div style={{position: 'absolute', width: '100%', top: 170, textAlign: 'center', opacity: title}}>
            <div style={{fontFamily: theme.serif, fontSize: 60, fontWeight: 700, color: theme.text}}>
              {'自己动手，给 AI 搭一个上下文层'}
            </div>
            <div style={{margin: '26px auto 0', height: 3, width: 560 * title, background: theme.blueprint}} />
            <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
              {'Context Layer · 上下文层系列'}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P0Bare: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p0-01', 'p0-05');
  const bB = w('p0-06', 'p0-10');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 裸奔助手">
        <AssistantBare crushAt={at('p0-04') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B 蓝图纸片名">
        <BlueprintTitle />
      </Sequence>
    </AbsoluteFill>
  );
};
