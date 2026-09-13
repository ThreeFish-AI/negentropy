/** P2 一本装订成册的公司手册（分镜 2-A…2-G）
 *  便利贴墙 → 手册五段式 → FK 校验门 → 同义词/说明书/签名FAQ → 私有标记。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useBreathe, useCount, useDim, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 2-A 便利贴墙：风吹掉两张 */
const StickyWall: React.FC<{fallAt: number}> = ({fallAt}) => {
  const frame = useCurrentFrame();
  const st = useStagger(12, {at: 2, stride: 2});
  const notes = [
    '净收入=？', '口径见群聊', '营收-退款', '老王说的', 'CASE WHEN…', '折扣规则',
    '按含税', '按不含税', '问财务', 'v3 最终版', 'v3_真最终', '以这版为准',
  ];
  const fall = (i: number) => {
    const t = progress(frame - fallAt - i * 6, 0, 22);
    return {t, x: Math.sin(t * Math.PI * 2) * 60, y: t * t * 420, rot: t * 160};
  };
  const dropping = [4, 8].map(fall);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 底行让出字幕安全带（bottom ≥ 160px）：整墙上移 + 单元略缩 */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 212px)', gap: 20, transform: 'translateY(-56px)'}}>
        {notes.map((n, i) => {
          const d = i === 4 ? dropping[0] : i === 8 ? dropping[1] : null;
          return (
            <div
              key={i}
              style={{
                opacity: st[i],
                transform: d
                  ? `translate(${d.x}px, ${d.y}px) rotate(${d.rot}deg)`
                  : `scale(${0.8 + 0.2 * st[i]})`,
                background: '#3A3320',
                border: `2px solid ${theme.manualDeep}`,
                borderRadius: 6,
                padding: '16px 12px',
                fontFamily: theme.mono,
                fontSize: 19,
                color: theme.dim,
                textAlign: 'center',
              }}
            >
              {n}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', bottom: 210, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: useProgress(fallAt + 20)}}>
        {'改一条规矩，要追着满墙改'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-B 手册五段式 + FK→键列 */
const ManualFive: React.FC<{fkAt: number}> = ({fkAt}) => {
  const book = useSpring('settle', {at: 3});
  const tabs = useStagger(5, {at: 22, stride: 5});
  const frame = useCurrentFrame();
  const fk = useProgress(fkAt, DUR.f5);
  const bad = useProgress(fkAt + 10, DUR.f4);
  const labels = ['TABLES', 'RELATIONSHIPS', 'FACTS', 'DIMENSIONS', 'METRICS'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 900 * book,
          opacity: book,
          border: `4px solid ${theme.manual}`,
          borderRadius: 16,
          background: theme.panel,
          padding: '40px 56px',
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.manual, textAlign: 'center'}}>
          {'语义视图 · 公司手册'}
        </div>
        <div style={{display: 'flex', gap: 14, marginTop: 34, justifyContent: 'center'}}>
          {labels.map((l, i) => (
            <div
              key={i}
              style={{
                opacity: tabs[i],
                fontFamily: theme.mono,
                fontSize: 19,
                color: i === 1 ? theme.manual : theme.dim,
                border: `2px solid ${i === 1 ? theme.manual : theme.panelBorder}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
            >
              {l}
            </div>
          ))}
        </div>
        {/* FK 连线：orders.customer_id → customers.id(钥匙) vs → customers.plan(红叉) */}
        <svg width={790} height={190} style={{marginTop: 30}}>
          <text x={20} y={40} fontSize={20} fill={theme.text} fontFamily={theme.mono}>
            {'orders.customer_id'}
          </text>
          <line x1={270} y1={34} x2={270 + 300 * fk} y2={34} stroke={theme.engine} strokeWidth={3} />
          <text x={300 * fk + 290} y={40} fontSize={20} fill={theme.engine} fontFamily={theme.mono} opacity={fk}>
            {'customers.id 🔑 ✓'}
          </text>
          <line x1={270} y1={120} x2={270 + 300 * bad} y2={120} stroke={theme.danger} strokeWidth={3} opacity={bad} />
          <text x={300 * bad + 290} y={126} fontSize={20} fill={theme.danger} fontFamily={theme.mono} opacity={bad}>
            {'customers.plan ✗'}
          </text>
          <text x={20} y={126} fontSize={20} fill={theme.dim} fontFamily={theme.mono} opacity={bad}>
            {'orders.referrer_id'}
          </text>
        </svg>
      </div>
      {frame > fkAt + 30 ? null : null}
    </AbsoluteFill>
  );
};

/** 2-C 校验门：坏定义被弹回（原型 D6 实测） */
const ValidationGate: React.FC<{hitAt: number}> = ({hitAt}) => {
  const frame = useCurrentFrame();
  const flyP = progress(frame, 6, Math.max(6, hitAt - 12), );
  const hit = useImpulse({at: hitAt, dur: DUR.f4});
  const back = useSpring('settleSoft', {at: hitAt + 4});
  const errLine = useProgress(hitAt + 10, DUR.f5);
  const x = 200 + flyP * 640 - hit * 0 + back * 0;
  const bounced = frame >= hitAt;
  const cardX = bounced ? 200 + 640 - 260 * back : x;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {/* 闸门 */}
        <rect x={1080} y={330} width={26} height={380} fill={theme.engine} opacity={0.9}
          style={{filter: `drop-shadow(0 0 ${(8 + hit * 26) * 1}px ${theme.engine})`}} />
        <text x={1093} y={310} textAnchor="middle" fontSize={26} fill={theme.engine} fontFamily={theme.sans}>
          {'结构校验门'}
        </text>
        {/* 坏定义卡 */}
        <g transform={`translate(${cardX}, 470)`}>
          <rect x={0} y={-60} width={330} height={130} rx={12} fill={theme.panel} stroke={theme.danger} strokeWidth={2} />
          <text x={18} y={-18} fontSize={20} fill={theme.text} fontFamily={theme.mono}>
            {'RELATIONSHIP "bad"'}
          </text>
          <text x={18} y={14} fontSize={18} fill={theme.dim} fontFamily={theme.mono}>
            {'orders → customers.plan'}
          </text>
          <text x={18} y={44} fontSize={18} fill={theme.danger} fontFamily={theme.mono}>
            {'非键列！'}
          </text>
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: 320,
          fontFamily: theme.mono,
          fontSize: 24,
          color: theme.danger,
          opacity: errLine,
        }}
      >
        {'✗ relationship bad: referenced column customers.plan is not PRIMARY KEY/UNIQUE'}
      </div>
      <div style={{position: 'absolute', bottom: 220, right: 200, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: errLine}}>
        {'本仓原型实测输出 · D6'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-D 同义词：三别名汇入一定义 */
const SynonymFunnel: React.FC = () => {
  const def = useSpring('settle', {at: 4});
  const st = useStagger(3, {at: 20, stride: 9});
  const hits = useCount({from: 0, to: 3, at: 20, dur: 30});
  const aliases = ['毛收入', '营收', '销售额'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
        {aliases.map((a, i) => (
          <div key={i} style={{opacity: st[i]}}>
            <Panel style={{width: 200, padding: '18px 12px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{a}</div>
            </Panel>
          </div>
        ))}
        <div style={{opacity: def}}>
          <Panel accent={theme.manual} style={{width: 340, padding: '26px 20px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'revenue'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.manual, marginTop: 8}}>
              {'命中 ' + Math.round(hits) + ' 个别名'}
            </div>
          </Panel>
        </div>
      </div>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {[330, 550, 770].map((x, i) => (
          <path
            key={i}
            d={`M ${x} 480 C ${x} 560, 1180 480, 1300 520`}
            stroke={theme.manual}
            strokeWidth={2.5}
            fill="none"
            opacity={st[i] * 0.7}
            strokeDasharray="8 6"
          />
        ))}
      </svg>
      <div style={{position: 'absolute', bottom: 210, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: st[2]}}>
        {'别名本身，也是被治理的内容'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-E 说明书：随定义版本化 vs 散落提示词蒙灰 */
const InstructionsDuel: React.FC = () => {
  const left = useSpring('settle', {at: 4});
  const right = useStagger(3, {at: 26, stride: 8});
  const grey = useDim({at: 50, to: 0.35});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80}}>
        <div style={{opacity: left, width: 560}}>
          <Panel accent={theme.manual} style={{padding: '28px 30px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.manual}}>{'定义卡 · v3 → v4'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, marginTop: 16}}>
              {'⚠ 先聚合再相除（随定义更新）'}
            </div>
          </Panel>
        </div>
        <div style={{width: 560}}>
          {['提示词A', '提示词B', '提示词C'].map((p, i) => (
            <div key={i} style={{opacity: right[i] * (i === 2 ? grey + 0.65 : 1), marginBottom: 18}}>
              <Panel style={{padding: '20px 24px', opacity: 0.55}}>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{p + ' · 无人维护'}</div>
              </Panel>
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 210, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: right[2]}}>
        {'改一次追不到人——错就留在那'}
      </div>
    </AbsoluteFill>
  );
};

/** 2-F 签名 FAQ */
const SignedFaq: React.FC<{hitAt: number}> = ({hitAt}) => {
  const card = useSpring('settle', {at: 4});
  const sig = useProgress(24, DUR.f6);
  const hit = useImpulse({at: hitAt, dur: DUR.f4});
  const glow = useProgress(hitAt, DUR.f5);
  const badge = useSpring('settle', {at: hitAt + 6});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: card}}>
        <Panel accent={glow > 0.5 ? theme.engine : theme.panelBorder} style={{width: 900, padding: '34px 44px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'VERIFIED QUERY'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, marginTop: 12}}>
            {'Q：revenue by month'}
          </div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 24,
              marginTop: 14,
              color: glow > 0.5 ? theme.engine : theme.dim,
              textShadow: glow > 0.5 ? `0 0 ${12 * glow}px ${theme.engine}` : undefined,
            }}
          >
            {'A: {01: 200, 02: 150, 03: 300}'}
          </div>
          <svg width={780} height={70} style={{marginTop: 16}}>
            <path
              d={`M 20 40 C ${60 + 600 * sig} 10, ${120 + 620 * sig} 66, ${80 + 640 * sig} 38`}
              stroke={theme.manual}
              strokeWidth={3}
              fill="none"
            />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.manual, marginTop: 6, opacity: sig}}>
            {'verified_by: data-team · verified_at: 2026-08-20'}
          </div>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 260,
          top: 300,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.engine,
          border: `2px solid ${theme.engine}`,
          borderRadius: 10,
          padding: '10px 20px',
          opacity: badge,
          transform: `scale(${0.85 + 0.15 * badge})`,
        }}
      >
        {'AI 命中 → 直接念答案' + (hit > 0.2 ? ' ⚡' : '')}
      </div>
    </AbsoluteFill>
  );
};
/** 2-G 私有锁标 + 收束金句 */
const PrivateLock: React.FC<{quoteAt: number}> = ({quoteAt}) => {
  const lock = useSpring('settle', {at: 6});
  const keyP = useProgress(24, DUR.f5);
  const quote = useProgress(quoteAt, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: lock}}>
        <Panel accent={theme.manual} style={{width: 620, padding: '30px 36px', position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'METRIC "revenue"'}</div>
          <div
            style={{
              position: 'absolute',
              right: -30,
              top: -26,
              fontSize: 40,
              transform: `rotate(${keyP * 90}deg)`,
            }}
          >
            {'🔓'}
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: theme.mono,
              fontSize: 18,
              color: theme.danger,
              border: `2px dashed ${theme.danger}88`,
              borderRadius: 8,
              padding: '8px 14px',
              display: 'inline-block',
            }}
          >
            {'PRIVATE · 仅特定角色可见'}
          </div>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 260,
          fontFamily: theme.serif,
          fontSize: 44,
          color: theme.manual,
          opacity: quote,
        }}
      >
        {'定义写一遍，全公司引用，没人再抄第二份。'}
      </div>
    </AbsoluteFill>
  );
};

export const P2Manual: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-09');
  const bC = w('p2-10', 'p2-12');
  const bD = w('p2-13', 'p2-16');
  const bE = w('p2-17', 'p2-19');
  const bF = w('p2-20', 'p2-22');
  const bG = w('p2-23', 'p2-25');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 便利贴墙">
        <StickyWall fallAt={at('p2-04') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="2-B 手册五段式">
        <ManualFive fkAt={at('p2-08') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="2-C 校验门">
        <ValidationGate hitAt={Math.max(30, at('p2-11') - bC.from - 10)} />
      </Sequence>
      <Sequence {...bD} name="2-D 同义词">
        <SynonymFunnel />
      </Sequence>
      <Sequence {...bE} name="2-E 说明书">
        <InstructionsDuel />
      </Sequence>
      <Sequence {...bF} name="2-F 签名FAQ">
        <SignedFaq hitAt={at('p2-22') - bF.from} />
      </Sequence>
      <Sequence {...bG} name="2-G 私有与金句">
        <PrivateLock quoteAt={at('p2-25') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
