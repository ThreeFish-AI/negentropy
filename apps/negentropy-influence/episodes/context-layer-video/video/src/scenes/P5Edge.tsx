/** P5 治理的边界（分镜 5-A…5-E）
 *  477 vs 48 → 三级对策台阶 → 脱敏审计 → 价值复引 → 通用化折损。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, useBreathe, useCount, useDraw, useFlowDash, useProgress, useSpring, useStagger} from '../motion';

/** 5-A 477 vs 48：全绿工序 + 上游紫烟 */
const Accident477: React.FC<{clashAt: number}> = ({clashAt}) => {
  const greens = useStagger(3, {at: 6, stride: 9});
  const smoke = useFlowDash({period: 50});
  const clash = useProgress(clashAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <div style={{opacity: greens[0], fontSize: 50}}>{'上游'}</div>
        <svg width={120} height={110}>
          <path d="M 16 84 Q 54 36 92 78" stroke={theme.activate} strokeWidth={7} fill="none" opacity={0.8}
            strokeDasharray={smoke.strokeDasharray} strokeDashoffset={smoke.strokeDashoffset} />
          <text x={20} y={34} fontSize={18} fill={theme.dim} fontFamily={theme.sans}>{'预聚合'}</text>
        </svg>
        {[['定义 ✓', greens[0]], ['公式 ✓', greens[1]], ['权限 ✓', greens[2]]].map(([t, o], i) => (
          <React.Fragment key={i}>
            <div style={{opacity: o as number}}>
              <Panel accent={theme.ok} style={{width: 160, padding: '16px 10px', textAlign: 'center'}}>
                <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.ok}}>{t as string}</div>
              </Panel>
            </div>
            {i < 2 ? <div style={{color: theme.dim, fontSize: 26}}>{'→'}</div> : null}
          </React.Fragment>
        ))}
      </div>
      <div style={{marginTop: 60, display: 'flex', alignItems: 'center', gap: 50, opacity: clash}}>
        <div style={{fontFamily: theme.mono, fontSize: 92, color: theme.danger}}>{'477'}</div>
        <div style={{fontSize: 44, color: theme.dim}}>{'vs'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 92, color: theme.ok}}>{'48'}</div>
      </div>
      <div style={{position: 'absolute', bottom: 300, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: clash}}>
        {'门禁保证权限——不保证算术'}
      </div>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: clash}}>
        {'第三方（Typedef）复现 · 生产事故'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-B 三级对策台阶 */
const ThreeStairs: React.FC = () => {
  const stairs = useStagger(3, {at: 4, stride: 16});
  const scan = useProgress(30, DUR.f5);
  const alarm = useProgress(64, DUR.f4);
  const net = useDraw(90, DUR.f6);
  const items = [
    {n: '一级 · 注册期扫描', d: '算式危险结构自动标记', cost: '便宜 · 先做'},
    {n: '二级 · 出口对账', d: '签名答案 vs 重算 → 报警', cost: '中等'},
    {n: '三级 · eval 兜底', d: '事后评分 + 血缘回溯', cost: '贵 · 后置'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 30}}>
        {items.map((s, i) => (
          <div key={i} style={{opacity: stairs[i], marginBottom: i * 70}}>
            <Panel accent={i === 0 ? theme.grown : theme.panelBorder} style={{width: 360, padding: '24px 22px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{s.n}</div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 10}}>{s.d}</div>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.grown, marginTop: 12}}>{s.cost}</div>
              {i === 0 && scan > 0.2 ? (
                <div style={{marginTop: 12}}>
                  <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.text}}>{'Σx ÷ COUNT(DISTINCT y)'}</div>
                  <div style={{height: 2.5, width: `${scan * 100}%`, background: theme.grown, marginTop: 8}} />
                </div>
              ) : null}
              {i === 1 && alarm > 0.3 ? (
                <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 20, color: theme.danger, opacity: alarm}}>{'🔔 对不上！'}</div>
              ) : null}
            </Panel>
          </div>
        ))}
      </div>
      {/* 三级血缘回溯网 */}
      <svg width={500} height={120} style={{position: 'absolute', right: 140, top: 200}}>
        <path d="M 20 100 C 140 20, 300 20, 460 90" stroke={theme.grown} strokeWidth={3} fill="none" {...net} />
        <text x={250} y={30} textAnchor="middle" fontSize={17} fill={theme.grown} fontFamily={theme.sans} opacity={net.strokeDashoffset < 0.5 ? 1 : 0.3}>
          {'错 → 回溯到做坏的那一环'}
        </text>
      </svg>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: stairs[2]}}>
        {'承认查不出所有错误——用评测兜底，不假装解决'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-C 出口脱敏 + 审计 */
const MaskAndAudit: React.FC = () => {
  const scan = useProgress(4, DUR.f5);
  const mask = useStagger(2, {at: 20, stride: 10});
  const logs = useStagger(3, {at: 46, stride: 9});
  const cells = ['本月', '活跃', '1,204', '138····', '人'];
  const rows = ['谁：intern · 何时 14:02', '身份：role=viewer', '看了：definitions/revenue'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <div style={{position: 'relative'}}>
          <Panel style={{width: 560, padding: '26px 34px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, display: 'flex', gap: 12}}>
              {cells.map((c, i) => {
                const sens = i === 3;
                const m = sens ? mask[0] : 1;
                return (
                  <span key={i} style={{background: sens && m > 0.5 ? theme.danger : 'transparent', color: sens && m > 0.5 ? 'transparent' : theme.text, borderRadius: 6, padding: '2px 6px'}}>
                    {c}
                  </span>
                );
              })}
            </div>
            <div style={{position: 'absolute', left: 0, top: 0, width: `${scan * 100}%`, height: 3, background: theme.grown, boxShadow: `0 0 12px ${theme.grown}`}} />
            <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 19, color: theme.grown, opacity: mask[1]}}>{'出口拦截 ✓'}</div>
          </Panel>
        </div>
        <div>
          <Panel accent={theme.grown} style={{width: 520, padding: '24px 30px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.grown}}>{'审计日志'}</div>
            {rows.map((r, i) => (
              <div key={i} style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 12, opacity: logs[i]}}>{r}</div>
            ))}
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 5-D 价值复引（星号常驻） */
const ValueRecap: React.FC = () => {
  const big = useCount({to: 86.3, at: 8, dur: 32});
  const show = useProgress(4, DUR.f4);
  const star = useBreathe({period: 110});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: show, textAlign: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 110, color: theme.text}}>
          <span style={{fontSize: 54, color: theme.dim}}>{'24.1% → '}</span>
          {big.toFixed(1) + '%'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 8}}>{'成本砍 2/3（Snowflake 自家基准）'}</div>
      </div>
      <div style={{position: 'absolute', top: 190, right: 240, fontFamily: theme.sans, fontSize: 20, color: theme.grown, border: `2px solid ${theme.grown}`, borderRadius: 10, padding: '8px 18px', opacity: 0.55 + star * 0.45}}>
        {'★ 他们的口径——你的基线自己测'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-E 通用化折损：一体浇筑 vs 后装闸机 */
const GenericTradeoff: React.FC<{quoteAt: number}> = ({quoteAt}) => {
  const tower = useDraw(4, DUR.f6);
  const addOn = useSpring('snap', {at: 44, dur: DUR.f4});
  const quote = useProgress(quoteAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 150, opacity: 1 - quote * 0.7}}>
        {/* 大厂：门禁一体浇筑 */}
        <div style={{textAlign: 'center'}}>
          <svg width={360} height={330}>
            <rect x={60} y={40} width={240} height={260} rx={10} fill="none" stroke={theme.blueprint} strokeWidth={5} {...tower} />
            <rect x={160} y={40} width={40} height={260} fill={theme.blueprint} opacity={0.9} style={{filter: `drop-shadow(0 0 10px ${theme.blueprint})`}} />
            <text x={180} y={330} textAnchor="middle" fontSize={20} fill={theme.dim} fontFamily={theme.sans}>
              {'大厂：门禁焊在引擎里（一体浇筑）'}
            </text>
          </svg>
        </div>
        {/* 自建：后装执行层 */}
        <div style={{textAlign: 'center'}}>
          <svg width={360} height={330}>
            <rect x={60} y={40} width={240} height={260} rx={10} fill="none" stroke={theme.panelBorder} strokeWidth={5} />
            <g style={{transform: `translateX(${(1 - addOn) * 90}px)`, opacity: addOn}}>
              <rect x={160} y={40} width={40} height={260} fill={theme.grown} style={{filter: `drop-shadow(0 0 ${addOn * 14}px ${theme.grown})`}} />
              <text x={180} y={26} textAnchor="middle" fontSize={18} fill={theme.grown} fontFamily={theme.sans}>{'执行层闸机（后装）'}</text>
            </g>
            <text x={180} y={330} textAnchor="middle" fontSize={20} fill={theme.dim} fontFamily={theme.sans}>
              {'自建：防线换个位置'}
            </text>
          </svg>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 250, fontFamily: theme.serif, fontSize: 46, color: theme.grown, opacity: quote}}>
        {'防线换了位置，纪律不能换。'}
      </div>
    </AbsoluteFill>
  );
};


/** 5-B 三级台阶 + 脱敏审计（合并镜：先台阶，后半审计交叉） */
const StairsAndAudit: React.FC<{maskAt: number}> = ({maskAt}) => {
  const phase = useProgress(maskAt - 8, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{opacity: 1 - phase * 0.92}}>
        <ThreeStairs />
      </div>
      <div style={{opacity: phase, position: 'absolute', inset: 0}}>
        <MaskAndAudit />
      </div>
    </AbsoluteFill>
  );
};

export const P5Edge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-08');
  const bB = w('p5-09', 'p5-14');
  const bC = w('p5-15', 'p5-19');
  const bD = w('p5-20', 'p5-23');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 477对48">
        <Accident477 clashAt={at('p5-06') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="5-B 三级对策与审计">
        <StairsAndAudit maskAt={at('p5-15') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="5-C 价值复引">
        <ValueRecap />
      </Sequence>
      <Sequence {...bD} name="5-D 通用化折损">
        <GenericTradeoff quoteAt={at('p5-23') - bD.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
