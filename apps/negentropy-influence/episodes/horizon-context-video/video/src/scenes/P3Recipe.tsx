/** P3 菜谱：临出锅再勾芡（分镜 3-A…3-L）
 *  全片高潮：复印机陷阱 / 平均的平均 / 半可加 / 477 vs 48 → valid SQL ≠ valid analytics。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {ArchifyClip} from '../components/ArchifyClip';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {DUR, progress, useCount, useDim, useDraw, useFlowDash, useImpulse, useProgress, useShake, useSpring, useStagger} from '../motion';

const W = 1920;

/** 3-A 菜谱卡 + 上游芡水 */
const RecipeCard: React.FC<{ruinAt: number}> = ({ruinAt}) => {
  const steps = ['选料', '下锅', '临出锅再勾芡'];
  const st = useStagger(3, {at: 4, stride: 12});
  const pour = useProgress(ruinAt, DUR.f5);
  const stamp = useSpring('snap', {at: ruinAt + 12, dur: DUR.f4});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <Panel accent={theme.manual} style={{width: 720, padding: '38px 48px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 36, color: theme.manual}}>{'菜谱'}</div>
          {steps.map((s, i) => (
            <div key={i} style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginTop: 18, opacity: st[i]}}>
              {`${i + 1}. ${s}`}
            </div>
          ))}
        </Panel>
        {/* 上游芡水倾倒 */}
        <svg width={760} height={300} style={{position: 'absolute', left: -20, top: -240}}>
          <path d={`M 600 20 Q ${620 - pour * 260} ${60 + pour * 40} ${340} ${120 * pour}`} stroke={theme.dig} strokeWidth={10 * pour} fill="none" opacity={0.8} />
          <text x={430} y={40} fontSize={24} fill={theme.dig} fontFamily={theme.sans} opacity={pour}>
            {'上游已兑好的芡水'}
          </text>
        </svg>
        <div
          style={{
            position: 'absolute',
            right: -60,
            bottom: -46,
            fontFamily: theme.serif,
            fontSize: 40,
            color: theme.danger,
            border: `4px solid ${theme.danger}`,
            borderRadius: 10,
            padding: '6px 22px',
            opacity: stamp,
            transform: `rotate(${-12 + stamp * 6}deg) scale(${1.4 - 0.4 * stamp})`,
          }}
        >
          {'菜谱救不了'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 3-C 存好的数 vs 现场算式 + 一行分岔代码 */
const StoredVsLive: React.FC<{forkAt: number}> = ({forkAt}) => {
  const ice = useProgress(6, DUR.f5);
  const gear = useProgress(16, DUR.f5);
  const fork = useProgress(forkAt, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 120, opacity: 1 - fork * 0.85}}>
        <div style={{textAlign: 'center', opacity: ice}}>
          <div style={{fontSize: 90}}>{'🧊'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 10}}>{'存好的数：粒度被冻死'}</div>
        </div>
        <div style={{textAlign: 'center', opacity: gear}}>
          <div style={{fontSize: 90}}>{'⚙️'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.engine, marginTop: 10}}>{'指标 = 一段算式 · 现场重算'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', top: 560, opacity: fork}}>
        <CodeWalk
          width={1120}
          caption="本仓 lab · compile_query 内的一行分岔"
          lines={[
            'spec_rows = ([dict(r) for r in basis.rows]   if agg_before_join',
            '             else _naive_joined_rows(...))      # 先关联 → 行复制',
          ]}
          hi={[{line: 0, at: 8, color: theme.engine}, {line: 1, at: 26, color: theme.danger}]}
        />
      </div>
    </AbsoluteFill>
  );
};

/** 3-C 复印机陷阱 */
const CopierTrap: React.FC<{sumAt: number}> = ({sumAt}) => {
  const frame = useCurrentFrame();
  const inP = progress(frame, 4, 18);
  const copies = useStagger(3, {at: 26, stride: 8});
  const sum = useCount({to: 300, at: sumAt, dur: 26});
  const boom = useShake({at: sumAt + 26, dur: DUR.f5, amp: 10});
  const red = frame >= sumAt + 24;
  return (
    <div style={{width: '100%', height: '100%', transform: `translateX(${boom}px)`, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 80}}>{'🖨️'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'一对多关联'}</div>
        </div>
        <svg width={280} height={240}>
          <rect x={200} y={70} width={70} height={110} rx={8} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} opacity={inP} />
          <text x={205} y={135} fontSize={26} fill={theme.text} fontFamily={theme.mono} opacity={inP}>
            {'$100'}
          </text>
        </svg>
        <div style={{display: 'flex', gap: 18}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{opacity: copies[i], transform: `translateY(${(1 - copies[i]) * 26}px)`}}>
              <Panel accent={theme.danger} style={{width: 150, padding: '22px 10px', textAlign: 'center'}}>
                <div style={{fontFamily: theme.mono, fontSize: 30, color: copies[i] > 0.9 ? theme.danger : theme.text}}>{'$100'}</div>
                <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 6}}>{`副本${i + 1}`}</div>
              </Panel>
            </div>
          ))}
        </div>
        <div style={{textAlign: 'center'}}>
          <div style={{fontSize: 70}}>{'🧾'}</div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 44,
              fontWeight: 700,
              color: red ? theme.danger : theme.text,
              textShadow: red ? `0 0 22px ${theme.danger}` : undefined,
            }}
          >
            {`$${Math.round(sum)}`}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'会计求和'}</div>
        </div>
      </div>
    </div>
  );
};

/** 3-D 官方案例角标卡 */
const OfficialCase: React.FC = () => {
  const card = useSpring('settle', {at: 4});
  const flip = useProgress(26, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: card}}>
        <Panel style={{width: 980, padding: '36px 48px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'Snowflake 工程博客 · Sam Waters 案例'}</div>
          <div style={{marginTop: 26, display: 'flex', justifyContent: 'center', gap: 60, alignItems: 'baseline'}}>
            <div>
              <div style={{fontFamily: theme.mono, fontSize: 60, color: theme.text}}>{'$100'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'真实订单'}</div>
            </div>
            <div style={{fontSize: 40, color: theme.dim, opacity: flip}}>{'→'}</div>
            <div>
              <div style={{fontFamily: theme.mono, fontSize: 60, color: theme.danger, opacity: flip}}>{'$300'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'查询结果'}</div>
            </div>
          </div>
          <div style={{marginTop: 24, fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: flip}}>
            {'连大模型自己写查询，也容易在同一处栽跟头（TPC-DS 实测）'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 3-E/3-F 复现双栏 + 去重安全（合成画面） */
const LabCompare: React.FC<{mode: 'sum' | 'distinct'; leftAt: number; rightAt: number}> = ({mode, leftAt, rightAt}) => {
  const lv = useCount({to: 200, at: leftAt, dur: 30});
  const rv = useCount({to: mode === 'sum' ? 440 : 3, at: rightAt, dur: 30});
  const boom = useImpulse({at: rightAt + 30, dur: DUR.f4});
  const fix = useProgress(rightAt + 44, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 70, alignItems: 'stretch'}}>
        <Panel accent={theme.engine} style={{width: 400, padding: '30px 30px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.engine}}>{'引擎 · 先各自聚合'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.engine, marginTop: 18}}>
            {mode === 'sum' ? Math.round(lv) : 3}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 10}}>
            {mode === 'sum' ? '一月收入（正确）' : '去重计数（对照）'}
          </div>
        </Panel>
        <Panel
          accent={theme.danger}
          style={{width: 400, padding: '30px 30px', textAlign: 'center', transform: `translateX(${boom * 8}px)`}}
        >
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.danger}}>{'朴素 · 先关联再算'}</div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 62,
              color: theme.danger,
              marginTop: 18,
              textShadow: `0 0 ${boom * 24}px ${theme.danger}`,
            }}
          >
            {mode === 'sum' ? Math.round(rv) : 3}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 10}}>
            {mode === 'sum' ? '一月收入（中招）' : '行翻倍 · 计数不动'}
          </div>
        </Panel>
      </div>
      {mode === 'sum' ? (
        <div style={{marginTop: 40, opacity: fix}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.engine}}>{'解法：先各自算，再合并——复印机没东西可印'}</div>
        </div>
      ) : (
        <div style={{marginTop: 40, opacity: fix, fontFamily: theme.sans, fontSize: 26, color: theme.engine}}>
          {'数的是集合，不是行'}
        </div>
      )}
      <div style={{position: 'absolute', bottom: 210, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {mode === 'sum' ? '本仓原型实测输出 · B1' : '本仓原型实测输出 · A3'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-G 平均的平均：不等宽教室天平 */
const ClassroomScale: React.FC<{tiltAt: number}> = ({tiltAt}) => {
  const rooms = useStagger(2, {at: 4, stride: 12});
  const bars = useStagger(2, {at: 30, stride: 12});
  const tilt = useProgress(tiltAt, DUR.f6);
  const angle = tilt * 14;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 90}}>
        {[{n: '2 人', w: 120}, {n: '200 人', w: 420}].map((r, i) => (
          <div key={i} style={{opacity: rooms[i], textAlign: 'center'}}>
            <div style={{width: r.w, height: 110, border: `3px solid ${theme.panelBorder}`, borderRadius: 8, position: 'relative'}}>
              <div style={{fontSize: 40, lineHeight: '100px'}}>{i === 0 ? '👥' : '👥👥👥'}</div>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 10}}>{r.n + ' 的班'}</div>
            <div
              style={{
                width: 90,
                height: 26 * bars[i] + 4,
                background: theme.dig,
                marginTop: 12,
                borderRadius: 4,
                opacity: bars[i],
              }}
            />
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'平均分'}</div>
          </div>
        ))}
      </div>
      {/* 等权天平失衡 */}
      <svg width={900} height={200} style={{marginTop: 30}} viewBox="0 0 900 200">
        <g transform={`rotate(${angle} 450 60)`}>
          <line x1={150} y1={60} x2={750} y2={60} stroke={theme.text} strokeWidth={5} />
          <rect x={110} y={30} width={60} height={26} rx={4} fill={theme.dig} />
          <rect x={730} y={30} width={60} height={26} rx={4} fill={theme.dig} />
        </g>
        <polygon points="450,60 430,110 470,110" fill={theme.panelBorder} />
        <text x={450} y={160} textAnchor="middle" fontSize={26} fill={theme.danger} fontFamily={theme.sans} opacity={tilt}>
          {'两班的平均，被再平均——话语权放大一百倍'}
        </text>
      </svg>
      <div style={{position: 'absolute', bottom: 215, fontFamily: theme.mono, fontSize: 22, color: theme.dim, opacity: tilt}}>
        {'官方案例：16.0（错） vs 4.8（真实）'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-H 客单价：分子分母各自聚合再相除 */
const AovFormula: React.FC<{ghostAt: number}> = ({ghostAt}) => {
  const num = useProgress(6, DUR.f5);
  const den = useProgress(16, DUR.f5);
  const div = useSpring('settle', {at: 28});
  const ghost = useProgress(ghostAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
        <div style={{textAlign: 'center', opacity: num}}>
          <div style={{width: 300, height: 20 * num, background: theme.engine, borderRadius: 4}} />
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.engine, marginTop: 12}}>{'Σ 收入'}</div>
        </div>
        <div style={{fontSize: 60, color: theme.text, opacity: div}}>{'÷'}</div>
        <div style={{textAlign: 'center', opacity: den}}>
          <div style={{width: 300, height: 20 * den, background: theme.engine, borderRadius: 4}} />
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.engine, marginTop: 12}}>{'Σ 单数'}</div>
        </div>
        <div style={{fontSize: 60, color: theme.text, opacity: div}}>{'='}</div>
        <div style={{fontFamily: theme.mono, fontSize: 70, color: theme.engine, opacity: div}}>{'108.33'}</div>
      </div>
      <div
        style={{
          marginTop: 60,
          fontFamily: theme.mono,
          fontSize: 40,
          color: theme.danger,
          opacity: ghost,
          transform: `translateY(${-ghost * 30}px)`,
        }}
      >
        {'月均值的均值 = 122.22 ✗'}
      </div>
      <div style={{position: 'absolute', bottom: 210, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: ghost}}>
        {'本仓原型实测输出 · B2'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-I 银行卡余额：可加 vs 不可加 */
const BalanceCards: React.FC<{weirdAt: number}> = ({weirdAt}) => {
  const two = useStagger(2, {at: 4, stride: 10});
  const ok = useProgress(26, DUR.f4);
  const weird = useShake({at: weirdAt, dur: DUR.f5, amp: 8});
  const q = useProgress(weirdAt + 16, DUR.f4);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80}}>
        <div style={{textAlign: 'center', opacity: two[0]}}>
          <div style={{display: 'flex', gap: 14}}>
            {['卡A', '卡B'].map((c) => (
              <div key={c} style={{width: 150, height: 96, border: `3px solid ${theme.ok}`, borderRadius: 12, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 24, color: theme.text}}>
                {c}
              </div>
            ))}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.ok, marginTop: 16, opacity: ok}}>{'跨账户相加 ✓ 总资产'}</div>
        </div>
        <div style={{textAlign: 'center', opacity: two[1], transform: `translateX(${weird}px)`}}>
          <div style={{display: 'flex', gap: 14, position: 'relative'}}>
            {['今天', '昨天'].map((c) => (
              <div key={c} style={{width: 150, height: 96, border: `3px solid ${theme.danger}`, borderRadius: 12, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 24, color: theme.text}}>
                {c}
              </div>
            ))}
            <div style={{position: 'absolute', right: -46, top: 26, fontSize: 52, color: theme.danger, opacity: q}}>{'?'}</div>
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.danger, marginTop: 16, opacity: q}}>{'跨天相加 = ？'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 215, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: q}}>
        {'服务器数同理：同一天可加，跨天不可加'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-J 末快照 vs 求和 */
const LastSnapshot: React.FC<{sumShowAt: number}> = ({sumShowAt}) => {
  const axis = useProgress(2, DUR.f5);
  const pts = [2, 4, 5, 6, 7];
  const lastGlow = useProgress(22, DUR.f5);
  const sumMode = useProgress(sumShowAt, DUR.f5);
  const total = useCount({to: 24, at: sumShowAt + 8, dur: 24});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1200} height={340}>
        <line x1={100} y1={250} x2={100 + 1000 * axis} y2={250} stroke={theme.dim} strokeWidth={3} />
        {pts.map((v, i) => {
          const x = 160 + i * 200;
          const lit = i === pts.length - 1 ? lastGlow : sumMode;
          return (
            <g key={i}>
              <circle cx={x} cy={250 - v * 24} r={13} fill={lit > 0.5 ? (i === pts.length - 1 ? theme.engine : theme.danger) : theme.panelBorder}
                style={{filter: `drop-shadow(0 0 ${(i === pts.length - 1 ? lastGlow : sumMode) * 14}px ${i === pts.length - 1 ? theme.engine : theme.danger})`}} />
              <text x={x} y={286} textAnchor="middle" fontSize={20} fill={theme.dim} fontFamily={theme.mono} opacity={axis}>
                {`日${i + 1}`}
              </text>
            </g>
          );
        })}
        <text x={1120} y={140} textAnchor="end" fontSize={30} fill={theme.engine} fontFamily={theme.mono} opacity={lastGlow * (1 - sumMode)}>
          {'末快照 = 7 ✓'}
        </text>
        <text x={1120} y={140} textAnchor="end" fontSize={30} fill={theme.danger} fontFamily={theme.mono} opacity={sumMode}>
          {`求和 = ${Math.round(total)} ✗`}
        </text>
      </svg>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: sumMode}}>
        {'本仓原型实测输出 · B4'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-K 477 vs 48 事故复盘 */
const PipelineAccident: React.FC<{clashAt: number}> = ({clashAt}) => {
  const greens = useStagger(3, {at: 6, stride: 10});
  const smoke = useFlowDash({period: 60});
  const clash = useProgress(clashAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
        <div style={{opacity: greens[0], fontSize: 54}}>{'上游'}</div>
        <svg width={130} height={120}>
          <path d="M 20 90 Q 60 40 100 84" stroke={theme.dig} strokeWidth={7} fill="none" opacity={0.75} strokeDasharray={smoke.strokeDasharray} strokeDashoffset={smoke.strokeDashoffset} />
          <text x={24} y={40} fontSize={20} fill={theme.dig} fontFamily={theme.sans}>{'预聚合'}</text>
        </svg>
        {[['定义 ✓', greens[0]], ['公式 ✓', greens[1]], ['权限 ✓', greens[2]]].map(([t, o], i) => (
          <React.Fragment key={i}>
            <div style={{opacity: o as number}}>
              <Panel accent={theme.ok} style={{width: 170, padding: '18px 10px', textAlign: 'center'}}>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.ok}}>{t as string}</div>
              </Panel>
            </div>
            {i < 2 ? <div style={{color: theme.dim, fontSize: 28}}>→</div> : null}
          </React.Fragment>
        ))}
      </div>
      <div style={{marginTop: 70, display: 'flex', alignItems: 'center', gap: 60, opacity: clash}}>
        <div style={{fontFamily: theme.mono, fontSize: 96, color: theme.danger}}>{'477'}</div>
        <div style={{fontSize: 48, color: theme.dim}}>{'vs'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 96, color: theme.ok}}>{'48'}</div>
        <svg width={90} height={100}>
          <path d="M 10 50 L 40 50 L 55 20 L 70 80 L 80 50" stroke={theme.danger} strokeWidth={4} fill="none" opacity={clash} />
        </svg>
      </div>
      <div style={{position: 'absolute', bottom: 215, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: clash}}>
        {'第三方（Typedef）复现 · 生产事故'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-L 题眼金句：valid SQL ≠ valid analytics */
const VerdictQuote: React.FC = () => {
  const back = useProgress(4, DUR.f5);
  const quote = useProgress(18, DUR.f5);
  const impulse = useImpulse({at: 30, dur: DUR.f5});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: back * 0.9}}>
        <Panel accent={theme.manual} style={{width: 560, padding: '22px 30px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 24, color: theme.manual}}>{'菜谱：临出锅再勾芡'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 10}}>{'卡角：芡水早就兑好了'}</div>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 480,
          fontFamily: theme.serif,
          fontSize: 62,
          color: theme.text,
          opacity: quote,
          transform: `scale(${1 + impulse * 0.04})`,
          textAlign: 'center',
        }}
      >
        <span style={{color: theme.engine}}>{'SQL 完全合法'}</span>
        <span style={{color: theme.dim}}>{'，'}</span>
        <span style={{color: theme.danger}}>{'分析完全错误'}</span>
      </div>
      <div style={{position: 'absolute', bottom: 240, fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: quote}}>
        {'—— AI 时代最容易漏掉的一道质检'}
      </div>
    </AbsoluteFill>
  );
};


/** 3-D 复印机 + 官方案例卡（交叉淡出合一镜） */
const CopierWithCase: React.FC<{sumAt: number; caseAt: number}> = ({sumAt, caseAt}) => {
  const toCase = useProgress(caseAt - 6, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{opacity: 1 - toCase}}>
        <CopierTrap sumAt={sumAt} />
      </div>
      <div style={{opacity: toCase, position: 'absolute', inset: 0}}>
        <OfficialCase />
      </div>
    </AbsoluteFill>
  );
};

/** 3-E 复现证据：代码分岔点亮 + 真实 B1 终端输出 + 解法小图 */
const LabEvidence: React.FC<{leftAt: number; rightAt: number; fixAt: number}> = ({leftAt, rightAt, fixAt}) => {
  const fuse = useProgress(leftAt, DUR.f5);
  const fix = useProgress(fixAt, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 40, alignItems: 'stretch', opacity: 1 - fix * 0.9}}>
        <div style={{opacity: fuse}}>
          <CodeWalk
            width={560}
            caption=""
            lines={['# 同一份玩具数据，两种算法', 'agg_before_join=True   → 200  ✓', 'agg_before_join=False  → 440  ✗']}
            hi={[{line: 1, at: 6, color: theme.engine}, {line: 2, at: 18, color: theme.danger}]}
          />
        </div>
        <TerminalLog
          width={560}
          prompt="uv run python horizon_context_lab.py --selftest"
          caption="本仓原型实测输出 · B1"
          lines={[
            {text: '[PASS] B1: fan trap: 引擎 Jan=200 vs 朴素 Jan=440', color: theme.engine, at: 12, bold: true},
            {text: '  （o1 的 3 条事件把 $100 变 $300）', color: theme.dim, at: 26},
          ]}
        />
      </div>
      <div style={{position: 'absolute', bottom: 200, opacity: fix, fontFamily: theme.sans, fontSize: 26, color: theme.engine}}>
        {'解法：先各自算，再合并——复印机没东西可印'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-G 平均的平均 + 客单价（教室天平 → 公式条交叉） */
const AvgSuite: React.FC<{tiltAt: number; ghostAt: number}> = ({tiltAt, ghostAt}) => {
  const phase = useProgress(ghostAt - 10, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{opacity: 1 - phase}}>
        <ClassroomScale tiltAt={tiltAt} />
      </div>
      <div style={{opacity: phase, position: 'absolute', inset: 0}}>
        <AovFormula ghostAt={10} />
      </div>
    </AbsoluteFill>
  );
};

/** 3-H 余额可加性 → 末快照时间轴（交叉） */
const SemiAdditive: React.FC<{weirdAt: number; snapAt: number}> = ({weirdAt, snapAt}) => {
  const phase = useProgress(snapAt - 8, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{opacity: 1 - phase}}>
        <BalanceCards weirdAt={weirdAt} />
      </div>
      <div style={{opacity: phase, position: 'absolute', inset: 0}}>
        <LastSnapshot sumShowAt={14} />
      </div>
    </AbsoluteFill>
  );
};

export const P3Recipe: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-08');
  const bC = w('p3-09', 'p3-12');
  const bD = w('p3-13', 'p3-19');
  const bE = w('p3-20', 'p3-25');
  const bF = w('p3-26', 'p3-27');
  const bG = w('p3-28', 'p3-34');
  const bH = w('p3-35', 'p3-41');
  const bI = w('p3-42', 'p3-47');
  const bJ = w('p3-48', 'p3-51');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A archify声明执行">
        <ArchifyClip file="declaration-execution.webm" leadSec={3.53} caption="declaration-execution" />
      </Sequence>
      <Sequence {...bB} name="3-B 菜谱与芡水">
        <RecipeCard ruinAt={at('p3-07') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="3-C 算式与分岔代码">
        <StoredVsLive forkAt={at('p3-11') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="3-D 复印机与案例">
        <CopierWithCase sumAt={at('p3-16') - bD.from} caseAt={at('p3-18') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="3-E 复现双卡">
        <LabEvidence leftAt={at('p3-20') - bE.from} rightAt={at('p3-20') - bE.from + 14} fixAt={at('p3-23') - bE.from} />
      </Sequence>
      <Sequence {...bF} name="3-F 去重安全">
        <LabCompare mode="distinct" leftAt={at('p3-26') - bF.from} rightAt={at('p3-26') - bF.from + 10} />
      </Sequence>
      <Sequence {...bG} name="3-G 平均的平均">
        <AvgSuite tiltAt={at('p3-31') - bG.from} ghostAt={at('p3-34') - bG.from} />
      </Sequence>
      <Sequence {...bH} name="3-H 半可加">
        <SemiAdditive weirdAt={at('p3-37') - bH.from} snapAt={at('p3-40') - bH.from} />
      </Sequence>
      <Sequence {...bI} name="3-I 477对48">
        <PipelineAccident clashAt={at('p3-43') - bI.from} />
      </Sequence>
      <Sequence {...bJ} name="3-J 题眼金句">
        <VerdictQuote />
      </Sequence>
    </AbsoluteFill>
  );
};
