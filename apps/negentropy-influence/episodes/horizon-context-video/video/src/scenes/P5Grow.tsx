/** P5 手册写不完，怎么办（分镜 5-A…5-G）
 *  覆盖率墙 → 双轨 → 纠错环 → 冲突反事实 → CONFLICT 卡片 → 前台四因子 → 价值数字。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useBreathe, useCount, useDraw, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 5-A 覆盖率墙：100 格亮 4 格 */
const CoverageWall: React.FC = () => {
  const grid = useStagger(100, {at: 1, stride: 1, dur: 2});
  const gold = useStagger(4, {at: 46, stride: 6});
  const pct = useCount({to: 5, at: 50, dur: 24});
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(10, 62px)', gap: 8}}>
        {Array.from({length: 100}, (_, i) => {
          const goldIdx = [12, 34, 57, 88].indexOf(i);
          return (
            <div
              key={i}
              style={{
                width: 62,
                height: 62,
                borderRadius: 6,
                background: goldIdx >= 0 && gold[goldIdx] > 0.5 ? theme.manual : theme.panel,
                border: `2px solid ${goldIdx >= 0 && gold[goldIdx] > 0.5 ? theme.manual : theme.panelBorder}`,
                opacity: grid[i],
                boxShadow: goldIdx >= 0 ? `0 0 ${10 * gold[goldIdx]}px ${theme.manual}` : 'none',
              }}
            />
          );
        })}
      </div>
      {/* 新表涌入 */}
      {frame > 60
        ? [0, 1, 2].map((k) => {
            const t = ((frame - 60 + k * 30) % 90) / 90;
            return (
              <div
                key={k}
                style={{
                  position: 'absolute',
                  right: 200 - t * 700,
                  top: 260 + k * 160,
                  fontSize: 40,
                  opacity: 0.8 * (1 - Math.abs(t - 0.5) * 0.8),
                }}
              >
                {'📄'}
              </div>
            );
          })
        : null}
      <div style={{position: 'absolute', bottom: 320, fontFamily: theme.mono, fontSize: 40, color: theme.manual}}>
        {`覆盖率 < ${Math.round(pct)}%`}
      </div>
      <div style={{position: 'absolute', bottom: 215, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {'9,685 张表 · Snowflake 内部实测口径'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-B 双轨：百科全书 vs 维基 */
const TwoTracks: React.FC = () => {
  const book = useSpring('settle', {at: 4});
  const wiki = useStagger(7, {at: 30, stride: 8});
  const authority = useStagger(2, {at: 70, stride: 12});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 140, alignItems: 'center'}}>
        <div style={{textAlign: 'center', opacity: book}}>
          <div style={{fontSize: 100}}>{'📚'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.manual, marginTop: 12}}>{'人写金标准'}</div>
          <div style={{marginTop: 14, width: 240, height: 20, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, overflow: 'hidden'}}>
            <div style={{width: `${100 * authority[0]}%`, height: '100%', background: theme.manual}} />
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{'authority = 1.0'}</div>
        </div>
        <svg width={140} height={300}>
          <line x1={10} y1={150} x2={130} y2={150} stroke={theme.dim} strokeWidth={3} opacity={authority[0] * 0.7 + 0.1} />
          <text x={70} y={130} textAnchor="middle" fontSize={22} fill={theme.dim} fontFamily={theme.sans}>
            {'汇入'}
          </text>
        </svg>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 100}}>{'🕸️'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dig, marginTop: 12}}>{'使用痕迹挖掘'}</div>
          <div style={{marginTop: 14, width: 240, height: 20, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, overflow: 'hidden'}}>
            <div style={{width: `${45 * authority[1]}%`, height: '100%', background: theme.dig}} />
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{'authority < 1.0'}</div>
        </div>
      </div>
      {/* 维基节点蔓延 */}
      <svg width={600} height={200} style={{position: 'absolute', right: 120, top: 180}}>
        {wiki.map((p, i) => {
          const x = 60 + (i % 4) * 140;
          const y = 40 + Math.floor(i / 4) * 90;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={10} fill={theme.dig} opacity={p} />
              {i > 0 ? (
                <line x1={x - 140} y1={y} x2={x - 14} y2={y} stroke={theme.dig} strokeWidth={2} opacity={p * 0.5} />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: authority[1]}}>
        {'百科全书 → 持续生长的维基百科'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-C 纠错环：考卷-错-修-对 */
const EvalLoop: React.FC<{fixAt: number; passAt: number}> = ({fixAt, passAt}) => {
  const exam = useSpring('settle', {at: 4});
  const wrong = useImpulse({at: 24, dur: DUR.f4});
  const fixes = useStagger(2, {at: fixAt, stride: 10});
  const pass = useSpring('snap', {at: passAt, dur: DUR.f4});
  const ring = useDraw(passAt + 8, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: exam}}>
        <Panel style={{width: 760, padding: '34px 44px', position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'金标准考卷 · 月活 = ?'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 36, color: theme.text, marginTop: 18}}>
            {'挖出口径作答: '}
            <span style={{color: theme.danger}}>{'[11, 6, 7]'}</span>
            <span style={{opacity: wrong, fontSize: 40}}>{'  ✗'}</span>
          </div>
          <div style={{display: 'flex', gap: 26, marginTop: 26}}>
            {['补同义词', '调低热度'].map((f, i) => (
              <div key={i} style={{opacity: fixes[i]}}>
                <Panel accent={theme.dig} style={{padding: '12px 22px'}}>
                  <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dig}}>{'↻ ' + f}</div>
                </Panel>
              </div>
            ))}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.ok, marginTop: 26, opacity: pass}}>
            {'重排后: [3, 1, 2] ✓'}
          </div>
          {/* 自纠环 */}
          <svg width={760} height={130} style={{position: 'absolute', left: 0, top: 250}}>
            <path d="M 380 20 C 620 20, 620 110, 390 110" stroke={theme.dig} strokeWidth={3} fill="none" {...ring} />
            <text x={560} y={74} fontSize={18} fill={theme.dig} fontFamily={theme.sans} opacity={pass}>
              {'再考'}
            </text>
          </svg>
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: pass}}>
        {'本仓原型实测输出 · C4'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-D 冲突反事实：自动选让错的赢 */
const AutoPicksWrong: React.FC<{throneAt: number}> = ({throneAt}) => {
  const clash = useStagger(2, {at: 4, stride: 14});
  const bars = useStagger(2, {at: 30, stride: 10});
  const throne = useSpring('settle', {at: throneAt, dur: DUR.f6});
  const glow = useBreathe({period: 100});
  const fall = useProgress(throneAt + 10, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 110}}>
        <div style={{textAlign: 'center', transform: `translateY(${fall * 90}px)`, opacity: clash[0] * (1 - fall * 0.7)}}>
          <Panel accent={theme.ok} style={{width: 340, padding: '24px 18px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{'市场部 · 登录过算'}</div>
            <div style={{marginTop: 16, width: 300, height: 22, border: `2px solid ${theme.panelBorder}`, borderRadius: 6}}>
              <div style={{width: `${8 * bars[0]}%`, height: '100%', background: theme.ok}} />
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{'3 人使用 · 正确 [3,1,2]'}</div>
          </Panel>
        </div>
        <div style={{textAlign: 'center', opacity: clash[1] * (1 - fall * 0.1)}}>
          <Panel accent={theme.danger} style={{width: 340, padding: '24px 18px', transform: `translateY(${-fall * 0}px) scale(${1 + throne * 0.12})`,
            boxShadow: `0 0 ${20 + glow * 26}px ${theme.danger}55`}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{'增长部 · 下过单算'}</div>
            <div style={{marginTop: 16, width: 300, height: 22, border: `2px solid ${theme.panelBorder}`, borderRadius: 6}}>
              <div style={{width: `${96 * bars[1]}%`, height: '100%', background: theme.danger}} />
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.danger, marginTop: 6}}>{'500 人使用 · 错误 [6,1,2]'}</div>
          </Panel>
        </div>
      </div>
      <div style={{position: 'absolute', top: 210, fontFamily: theme.sans, fontSize: 34, color: theme.danger, opacity: throne}}>
        {'👑 按热度自动选 → 错的赢了'}
      </div>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: throne}}>
        {'本仓原型实测输出 · D4'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-E CONFLICT 卡片：并列两定义、无数值、等裁决 */
const ConflictCard: React.FC<{judgeAt: number}> = ({judgeAt}) => {
  const cards = useStagger(2, {at: 4, stride: 12});
  const q = useBreathe({period: 90});
  const blankOpacity = useProgress(30, DUR.f5);
  const judge = useSpring('settle', {at: judgeAt, dur: DUR.f5});
  const win = useProgress(judgeAt + 12, DUR.f4);
  const defs = [
    {who: 'governed · 人写', def: 'count_distinct(customer)', color: theme.manual},
    {who: 'inferred · 挖掘', def: 'count(events)', color: theme.dig},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        {defs.map((d, i) => (
          <div key={i} style={{opacity: cards[i] * (i === 1 ? 1 - win * 0.75 : 1)}}>
            <Panel accent={d.color} style={{width: 430, padding: '26px 28px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: d.color}}>{d.who}</div>
              <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, marginTop: 12}}>{d.def}</div>
              {/* 数字区刻意空白 */}
              <svg width={370} height={54} style={{marginTop: 16}}>
                <rect x={2} y={4} width={366} height={44} rx={8} fill="none" stroke={theme.danger} strokeWidth={2} strokeDasharray="8 6" opacity={(i === 1 ? 1 - win : 1) * blankOpacity} />
                <text x={185} y={34} textAnchor="middle" fontSize={18} fill={theme.dim} fontFamily={theme.sans} opacity={0.8}>
                  {'（无数值——不诱导人）'}
                </text>
              </svg>
              {win > 0 && i === 0 ? (
                <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.ok, opacity: win}}>{'✓ 裁决胜出'}</div>
              ) : null}
              {win > 0 && i === 1 ? (
                <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.danger, opacity: win}}>{'✗ rejected'}</div>
              ) : null}
            </Panel>
          </div>
        ))}
      </div>
      {/* 中间问号 + 裁决灯 */}
      <svg width={300} height={500} style={{position: 'absolute'}}>
        <text x={150} y={190} textAnchor="middle" fontSize={110} fill={theme.danger} opacity={0.85}>
          {'?'}
        </text>
        <g opacity={judge} transform={`translate(0, ${(1 - judge) * -140})`}>
          <text x={150} y={330} textAnchor="middle" fontSize={52}>{'💡'}</text>
          <text x={150} y={384} textAnchor="middle" fontSize={20} fill={theme.text} fontFamily={theme.sans}>
            {'人工裁决'}
          </text>
        </g>
        <circle cx={150} cy={190} r={60 + q * 10} fill="none" stroke={theme.danger} strokeWidth={2} opacity={0.3 * (1 - judge)} />
      </svg>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: cards[1]}}>
        {'不装懂的诚实——与普通检索的分界线'}
      </div>
    </AbsoluteFill>
  );
};

/** 5-F 前台问询处：四因子 + 签名 FAQ 短路 */
const FrontDesk: React.FC<{faqAt: number}> = ({faqAt}) => {
  const bubble = useProgress(2, DUR.f5);
  const weights = useStagger(4, {at: 18, stride: 9});
  const pages = useSpring('settle', {at: 58});
  const faq = useImpulse({at: faqAt, dur: DUR.f4});
  const faqShow = useProgress(faqAt, DUR.f4);
  const factors = [
    {label: '相关', w: 0.4},
    {label: '权威', w: 0.3},
    {label: '常用', w: 0.2},
    {label: '新鲜', w: 0.1},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <path d={`M 240 ${620 - bubble * 200} Q 500 300 780 480`} stroke={theme.dim} strokeWidth={3} fill="none" opacity={bubble} strokeDasharray="9 8" />
        <circle cx={240} cy={620 - bubble * 200} r={26} fill={theme.manual} opacity={bubble} />
        <text x={240} y={700 - bubble * 200} textAnchor="middle" fontSize={24} fill={theme.dim} fontFamily={theme.sans}>
          {'问题'}
        </text>
      </svg>
      {/* 窗口 */}
      <div style={{position: 'absolute', left: 800, top: 360}}>
        <Panel accent={theme.manual} style={{width: 320, padding: '26px 24px', textAlign: 'center'}}>
          <div style={{fontSize: 54}}>{'🛎️'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.manual, marginTop: 8}}>{'问询处'}</div>
        </Panel>
      </div>
      {/* 四因子砝码 */}
      <div style={{position: 'absolute', left: 640, top: 120, display: 'flex', gap: 34}}>
        {factors.map((f, i) => (
          <div key={i} style={{opacity: weights[i], textAlign: 'center'}}>
            <Panel style={{padding: '12px 20px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{f.label}</div>
              <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 4}}>{`${f.w}`}</div>
            </Panel>
            <div style={{width: 3, height: 20, background: theme.dim, margin: '6px auto 0'}} />
          </div>
        ))}
      </div>
      {/* 抽出的 top-2 页 */}
      <div style={{position: 'absolute', right: 260, top: 340, display: 'flex', gap: 20, opacity: pages}}>
        {['定义页', '说明书'].map((p, i) => (
          <div key={i} style={{transform: `rotate(${(i - 0.5) * 8}deg)`}}>
            <Panel accent={theme.manual} style={{width: 200, padding: '20px 14px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text}}>{p}</div>
            </Panel>
          </div>
        ))}
      </div>
      {/* 签名 FAQ 短路 */}
      <div
        style={{
          position: 'absolute',
          right: 200,
          top: 620,
          opacity: faqShow,
          transform: `scale(${1 + faq * 0.08})`,
        }}
      >
        <Panel accent={theme.ok} style={{padding: '18px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.ok}}>{'⚡ 命中签名 FAQ → 直接念答案'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>{'带署名与日期'}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 5-G 价值数字（厂商基准角标常驻） */
const ValueNumbers: React.FC = () => {
  const big = useCount({to: 86.3, at: 10, dur: 36});
  const bigShow = useProgress(6, DUR.f4);
  const smalls = useStagger(3, {at: 54, stride: 10});
  const star = useBreathe({period: 120});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: bigShow, textAlign: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 130, color: theme.text, fontWeight: 700}}>
          <span style={{color: theme.dim, fontSize: 60}}>{'24.1% → '}</span>
          {big.toFixed(1) + '%'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 10}}>{'答对率（Snowflake 自家基准）'}</div>
      </div>
      <div style={{display: 'flex', gap: 40, marginTop: 80}}>
        {[
          {t: '查询成本', v: '$1.76 → $0.59'},
          {t: '未覆盖区反超人工', v: '+10 个百分点'},
          {t: '整站搭建', v: '数月 → 一天'},
        ].map((c, i) => (
          <div key={i} style={{opacity: smalls[i]}}>
            <Panel style={{width: 330, padding: '22px 18px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.text}}>{c.v}</div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 8}}>{c.t}</div>
            </Panel>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 180,
          right: 240,
          fontFamily: theme.sans,
          fontSize: 20,
          color: theme.manual,
          border: `2px solid ${theme.manual}`,
          borderRadius: 10,
          padding: '8px 18px',
          opacity: 0.55 + star * 0.45,
        }}
      >
        {'★ 厂商自家基准 · 增益端无第三方复现'}
      </div>
    </AbsoluteFill>
  );
};

export const P5Grow: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p5-01', 'p5-05');
  const bB = w('p5-06', 'p5-10');
  const bC = w('p5-11', 'p5-15');
  const bD = w('p5-16', 'p5-22');
  const bE = w('p5-23', 'p5-25');
  const bF = w('p5-26', 'p5-30');
  const bG = w('p5-31', 'p5-36');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 覆盖率墙">
        <CoverageWall />
      </Sequence>
      <Sequence {...bB} name="5-B 双轨">
        <TwoTracks />
      </Sequence>
      <Sequence {...bC} name="5-C 纠错环">
        <EvalLoop fixAt={at('p5-15') - bC.from - 24} passAt={at('p5-15') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D 自动选反事实">
        <AutoPicksWrong throneAt={at('p5-22') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="5-E CONFLICT卡片">
        <ConflictCard judgeAt={at('p5-25') - bE.from} />
      </Sequence>
      <Sequence {...bF} name="5-F 前台四因子">
        <FrontDesk faqAt={at('p5-30') - bF.from} />
      </Sequence>
      <Sequence {...bG} name="5-G 价值数字">
        <ValueNumbers />
      </Sequence>
    </AbsoluteFill>
  );
};
