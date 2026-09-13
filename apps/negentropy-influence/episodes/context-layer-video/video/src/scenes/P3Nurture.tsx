/** P3 养上下文：双轨与冲突（分镜 3-A…3-E）
 *  写不动 → 双轨汇流 → 纠错环 → 自动选反事实 → CONFLICT 裁决 + 诚实金句。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {CodeWalk} from '../components/CodeWalk';
import {DUR, progress, useCount, useDraw, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 3-A 写不动：金漆刷墙 + 新表涌入 */
const CantKeepUp: React.FC = () => {
  const paint = useProgress(6, DUR.f6);
  const pct = useCount({to: 5, at: 20, dur: 26});
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1300} height={520}>
        {/* 墙：仅一小角被刷金 */}
        <rect x={80} y={60} width={1140} height={360} rx={12} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} />
        <rect x={80} y={60} width={Math.max(2, 170 * paint)} height={360} rx={12} fill={theme.grown} opacity={0.5} />
        <text x={108} y={250} fontSize={26} fill={theme.grown} fontFamily={theme.sans} opacity={paint}>
          {'人工写下的部分'}
        </text>
        {/* 新表涌入 */}
        {frame > 40
          ? [0, 1, 2, 3].map((k) => {
              const t = ((frame - 40 + k * 24) % 96) / 96;
              return (
                <text key={k} x={1240 - t * 1100} y={100 + k * 90} fontSize={34} opacity={0.85 - t * 0.3}>
                  {'📄'}
                </text>
              );
            })
          : null}
      </svg>
      <div style={{position: 'absolute', bottom: 300, fontFamily: theme.mono, fontSize: 40, color: theme.grown}}>
        {`覆盖率 < ${Math.round(pct)}%`}
      </div>
      <div style={{position: 'absolute', bottom: 215, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {'9,685 张表 · Snowflake 内部实测口径'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-B 双轨：人写 + 机器草稿 + 痕迹挖掘 */
const DualTrack: React.FC = () => {
  const left = useSpring('settle', {at: 4});
  const draft = useStagger(3, {at: 30, stride: 8});
  const right = useProgress(50, DUR.f5);
  const particles = useStagger(6, {at: 60, stride: 6});
  const merge = useImpulse({at: 92, dur: DUR.f5});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 130, alignItems: 'center'}}>
        <div style={{textAlign: 'center', opacity: left}}>
          <div style={{fontSize: 90}}>{'✍️'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.grown, marginTop: 10}}>{'人写金标准'}</div>
          <div style={{marginTop: 10, width: 220, height: 18, border: `2px solid ${theme.panelBorder}`, borderRadius: 9, overflow: 'hidden'}}>
            <div style={{width: '100%', height: '100%', background: theme.grown}} />
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>{'权威满格'}</div>
          {['机器生成草稿', '人审转正'].map((d, i) => (
            <div key={i} style={{opacity: draft[i + 1] ?? draft[i], marginTop: 8, fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>
              {'· ' + d}
            </div>
          ))}
        </div>
        <svg width={120} height={360}>
          <line x1={30} y1={180} x2={90} y2={180} stroke={theme.activate} strokeWidth={4} opacity={merge > 0 ? 1 : 0.25} />
          <text x={60} y={160} textAnchor="middle" fontSize={20} fill={theme.dim} fontFamily={theme.sans} opacity={0.8}>
            {'汇入'}
          </text>
        </svg>
        <div style={{textAlign: 'center', opacity: right}}>
          <div style={{fontSize: 90}}>{'⛏️'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.activate, marginTop: 10}}>{'痕迹挖掘'}</div>
          <div style={{marginTop: 10, width: 220, height: 18, border: `2px solid ${theme.panelBorder}`, borderRadius: 9, overflow: 'hidden'}}>
            <div style={{width: '45%', height: '100%', background: theme.activate}} />
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>{'权威打折'}</div>
        </div>
      </div>
      {/* 查询日志粒子 */}
      <svg width={500} height={160} style={{position: 'absolute', right: 150, bottom: 260}}>
        {particles.map((p, i) => (
          <circle key={i} cx={40 + (i % 3) * 60} cy={30 + Math.floor(i / 3) * 46} r={8} fill={theme.activate} opacity={p} />
        ))}
        <text x={250} y={140} fontSize={18} fill={theme.dim} fontFamily={theme.sans} opacity={particles[5]}>
          {'查询记录 · 报表定义'}
        </text>
      </svg>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: merge}}>
        {'快、覆盖长尾——但权威打折'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-C 纠错环 */
const SelfCorrect: React.FC<{fixAt: number; passAt: number; codeAt: number}> = ({fixAt, passAt, codeAt}) => {
  const exam = useSpring('settle', {at: 4});
  const wrong = useImpulse({at: 22, dur: DUR.f4});
  const fixes = useStagger(2, {at: fixAt, stride: 10});
  const pass = useSpring('snap', {at: passAt, dur: DUR.f4});
  const ring = useDraw(passAt + 6, DUR.f6);
  const code = useProgress(codeAt, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: exam}}>
        <Panel style={{width: 780, padding: '34px 44px', position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'金标准考卷 · 活跃用户 = ?'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.text, marginTop: 16}}>
            {'挖掘口径: '}
            <span style={{color: theme.danger}}>{'数事件 [6,1,2]'}</span>
            <span style={{opacity: wrong, fontSize: 38}}>{'  ✗'}</span>
          </div>
          <div style={{display: 'flex', gap: 24, marginTop: 24}}>
            {['补同义词', '调热度'].map((f, i) => (
              <div key={i} style={{opacity: fixes[i]}}>
                <Panel accent={theme.grown} style={{padding: '12px 22px'}}>
                  <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.grown}}>{'↻ ' + f}</div>
                </Panel>
              </div>
            ))}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.ok, marginTop: 24, opacity: pass}}>
            {'重排后: 数人 [3,1,2] ✓'}
          </div>
          <svg width={780} height={120} style={{position: 'absolute', left: 0, top: 240}}>
            <path d="M 390 16 C 640 16, 640 104, 400 104" stroke={theme.grown} strokeWidth={3} fill="none" {...ring} />
            <text x={560} y={66} fontSize={18} fill={theme.grown} fontFamily={theme.sans} opacity={pass}>
              {'定期再考'}
            </text>
          </svg>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 620, opacity: code}}>
        <CodeWalk
          width={900}
          caption="本仓 lab · eval 环的两行"
          lines={[
            'e.synonyms = tuple(sorted(e.synonyms + (q,)))   # 定义级：补词',
            'e.popularity = 50                               # 对的条目：升热度',
            'e.popularity = 120                              # 错的条目：降热度',
          ]}
          hi={[{line: 0, at: 6, color: theme.grown}, {line: 1, at: 20, color: theme.grown}, {line: 2, at: 34, color: theme.grown}]}
        />
      </div>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: pass}}>
        {'本仓原型实测输出 · C4'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-D 自动选反事实（错卡登座） */
const AutoWrong: React.FC<{throneAt: number}> = ({throneAt}) => {
  const clash = useStagger(2, {at: 4, stride: 14});
  const bars = useStagger(2, {at: 26, stride: 10});
  const throne = useSpring('settle', {at: throneAt, dur: DUR.f6});
  const fall = useProgress(throneAt + 8, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 110}}>
        <div style={{textAlign: 'center', transform: `translateY(${fall * 90}px)`, opacity: clash[0] * (1 - fall * 0.7)}}>
          <Panel accent={theme.ok} style={{width: 350, padding: '24px 20px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{'数人的（对）'}</div>
            <div style={{marginTop: 14, width: 300, height: 20, border: `2px solid ${theme.panelBorder}`, borderRadius: 6}}>
              <div style={{width: `${7 * bars[0]}%`, height: '100%', background: theme.ok}} />
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6}}>{'3 人使用 · [3,1,2]'}</div>
          </Panel>
        </div>
        <div style={{textAlign: 'center', opacity: clash[1] * (1 - fall * 0.1)}}>
          <Panel accent={theme.danger} style={{width: 350, padding: '24px 20px', transform: `scale(${1 + throne * 0.13})`, boxShadow: `0 0 ${18 + throne * 30}px ${theme.danger}55`}}>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{'数事件的（错）'}</div>
            <div style={{marginTop: 14, width: 300, height: 20, border: `2px solid ${theme.panelBorder}`, borderRadius: 6}}>
              <div style={{width: `${96 * bars[1]}%`, height: '100%', background: theme.danger}} />
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.danger, marginTop: 6}}>{'500 人使用 · [6,1,2]'}</div>
          </Panel>
        </div>
      </div>
      <div style={{position: 'absolute', top: 200, fontFamily: theme.sans, fontSize: 34, color: theme.danger, opacity: throne}}>
        {'👑 按热度自动选 → 错的赢了'}
      </div>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: throne}}>
        {'本仓原型实测输出 · D4'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-E CONFLICT 卡片 + 诚实金句 */
const ConflictHonesty: React.FC<{judgeAt: number; quoteAt: number}> = ({judgeAt, quoteAt}) => {
  const cards = useStagger(2, {at: 4, stride: 12});
  const lamp = useSpring('settle', {at: judgeAt, dur: DUR.f5});
  const quote = useProgress(quoteAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 56, alignItems: 'center', opacity: 1 - quote * 0.85}}>
        {[
          {who: '登录派 · 市场部', def: '登录过 = 活跃', c: theme.blueprint},
          {who: '下单派 · 增长部', def: '下过单 = 活跃', c: theme.danger},
        ].map((d, i) => (
          <div key={i} style={{opacity: cards[i]}}>
            <Panel accent={d.c} style={{width: 420, padding: '26px 28px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: d.c}}>{d.who}</div>
              <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.text, marginTop: 12}}>{d.def}</div>
              <div style={{marginTop: 16, height: 46, border: `2px dashed ${theme.danger}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>{'数字区：刻意空白'}</span>
              </div>
            </Panel>
          </div>
        ))}
        <svg width={120} height={420}>
          <text x={60} y={190} textAnchor="middle" fontSize={96} fill={theme.danger}>{'?'}</text>
          <g opacity={lamp} transform={`translate(0, ${(1 - lamp) * -120})`}>
            <text x={60} y={310} textAnchor="middle" fontSize={48}>{'💡'}</text>
            <text x={60} y={360} textAnchor="middle" fontSize={18} fill={theme.text} fontFamily={theme.sans}>{'等人裁决'}</text>
          </g>
        </svg>
      </div>
      <div style={{position: 'absolute', bottom: 230, fontFamily: theme.serif, fontSize: 46, color: theme.grown, opacity: quote}}>
        {'「我不懂的时候，我说我不懂。」'}
      </div>
    </AbsoluteFill>
  );
};

export const P3Nurture: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-10');
  const bC = w('p3-11', 'p3-17');
  const bD = w('p3-18', 'p3-27');
  const bE = w('p3-28', 'p3-34');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 写不动">
        <CantKeepUp />
      </Sequence>
      <Sequence {...bB} name="3-B 双轨">
        <DualTrack />
      </Sequence>
      <Sequence {...bC} name="3-C 纠错环与代码">
        <SelfCorrect fixAt={at('p3-15') - bC.from - 16} passAt={at('p3-16') - bC.from} codeAt={at('p3-15') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="3-D 自动选反事实">
        <AutoWrong throneAt={at('p3-24') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="3-E 冲突见人">
        <ConflictHonesty judgeAt={at('p3-30') - bE.from} quoteAt={at('p3-34') - bE.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
