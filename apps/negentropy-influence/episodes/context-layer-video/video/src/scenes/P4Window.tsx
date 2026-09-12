/** P4 一个窗口 + 一个插头（分镜 4-A…4-H）
 *  唯一窗口 → 不装懂 → 四因子 → 对数封顶 → USB-C → 四工具 → 原型实测 → 收束。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, progress, useCount, useDraw, useImpulse, useProgress, useSpring, useStagger, useTravel} from '../motion';

/** 4-A 唯一窗口：三 AI 排队 */
const SingleWindow: React.FC = () => {
  const queue = useStagger(3, {at: 4, stride: 10});
  const booth = useSpring('settle', {at: 26});
  const inq = useProgress(44, DUR.f5);
  const out = useProgress(58, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        {[
          {x: 260, icon: '💬'},
          {x: 380, icon: '👨‍💻'},
          {x: 500, icon: '📊'},
        ].map((v, i) => (
          <text key={i} x={v.x + i * 60} y={560} fontSize={54} opacity={queue[i]}>{v.icon}</text>
        ))}
        <line x1={580} y1={580} x2={580 + 240 * inq} y2={580} stroke={theme.activate} strokeWidth={3} strokeDasharray="8 7" opacity={inq} />
      </svg>
      <div style={{position: 'absolute', left: 880, top: 380, opacity: booth}}>
        <Panel accent={theme.activate} style={{width: 340, padding: '30px 26px', textAlign: 'center'}}>
          <div style={{fontSize: 56}}>{'🛎️'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.activate, marginTop: 10}}>{'resolve'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>{'问询 · 唯一窗口'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 14, opacity: inq}}>{'(question, role)'}</div>
        </Panel>
      </div>
      {/* 输出的上下文包 */}
      <div style={{position: 'absolute', right: 220, top: 360, opacity: out}}>
        <Panel accent={theme.activate} style={{width: 360, padding: '22px 24px'}}>
          {['top-k 条目', '说明书', '签名问答 ?'].map((c, i) => (
            <div key={i} style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: i ? 10 : 0}}>{'· ' + c}</div>
          ))}
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: out}}>
        {'每多一个入口，就多一套绕过治理的野路子'}
      </div>
    </AbsoluteFill>
  );
};

/** 4-B 不装懂：无覆盖显式警告 */
const NoCoverage: React.FC<{warnAt: number}> = ({warnAt}) => {
  const scan = useProgress(4, DUR.f5);
  const frame = useCurrentFrame();
  const warn = useImpulse({at: warnAt, dur: DUR.f4});
  const warnO = useProgress(warnAt, DUR.f4);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1000, height: 380}}>
        {/* 目录墙 */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(8, 110px)', gap: 14}}>
          {Array.from({length: 16}, (_, i) => (
            <div key={i} style={{height: 74, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 8, opacity: 0.5}} />
          ))}
        </div>
        {/* 扫描线 */}
        <div style={{position: 'absolute', left: 0, top: -10, width: `${scan * 100}%`, height: 3, background: theme.activate, boxShadow: `0 0 14px ${theme.activate}`}} />
        {/* 警告条 */}
        <div
          style={{
            position: 'absolute',
            left: 220,
            top: 150,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.grown,
            background: theme.panel,
            border: `3px solid ${theme.grown}`,
            borderRadius: 12,
            padding: '16px 30px',
            opacity: warnO,
            transform: `translateY(${(1 - warnO) * 20}px) scale(${1 + warn * 0.05})`,
          }}
        >
          {'⚠ 此域无权威定义——不静默拿猜的凑数'}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: warnO}}>
        {'宁可说「不熟」，不装懂'}
      </div>
      {frame > warnAt + 200 ? null : null}
    </AbsoluteFill>
  );
};

/** 4-C 四因子天平 + 出身压秤 */
const FourFactor: React.FC = () => {
  const pans = useStagger(4, {at: 6, stride: 9});
  const origin = useProgress(56, DUR.f6);
  const tilt = origin * 10;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 30}}>
        {[
          {l: '相关', w: '0.4'},
          {l: '权威', w: '0.3'},
          {l: '常用', w: '0.2'},
          {l: '新鲜', w: '0.1'},
        ].map((f, i) => (
          <div key={i} style={{opacity: pans[i], textAlign: 'center'}}>
            <Panel accent={i === 1 ? theme.grown : theme.panelBorder} style={{padding: '16px 26px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{f.l}</div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 4}}>{f.w}</div>
            </Panel>
          </div>
        ))}
      </div>
      {/* 出身压秤 */}
      <svg width={900} height={260} style={{marginTop: 50}} viewBox="0 0 900 260">
        <g transform={`rotate(${tilt} 450 70)`}>
          <line x1={200} y1={70} x2={700} y2={70} stroke={theme.text} strokeWidth={5} />
          <rect x={140} y={30} width={110} height={34} rx={6} fill={theme.grown} />
          <rect x={650} y={40} width={110} height={24} rx={6} fill={theme.danger} opacity={0.6} />
        </g>
        <polygon points="450,70 430,120 470,120" fill={theme.panelBorder} />
        <text x={195} y={24} textAnchor="middle" fontSize={19} fill={theme.grown} fontFamily={theme.sans}>
          {'人写 · 权威高'}
        </text>
        <text x={705} y={24} textAnchor="middle" fontSize={19} fill={theme.dim} fontFamily={theme.sans}>
          {'机器挖 · 打折'}
        </text>
        <text x={450} y={180} textAnchor="middle" fontSize={24} fill={theme.text} fontFamily={theme.sans} opacity={origin}>
          {'排序不是平等的——出身写在分数里'}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

/** 4-D 对数封顶 + tie-break */
const LogCeiling: React.FC<{flipAt: number; tieAt: number}> = ({flipAt, tieAt}) => {
  const grow = useStagger(2, {at: 6, stride: 12});
  const flip = useImpulse({at: flipAt, dur: DUR.f4});
  const logMode = useProgress(flipAt, DUR.f5);
  const tie = useStagger(3, {at: tieAt, stride: 9});
  const lin = (v: number) => v;
  const log = (v: number) => Math.log10(1 + v * 9);
  const bars = [
    {label: '爆款', v: 1.0},
    {label: '常项', v: 0.25},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <svg width={1000} height={420}>
        <line x1={100} y1={360} x2={940} y2={360} stroke={theme.dim} strokeWidth={3} />
        <line x1={100} y1={360} x2={100} y2={40} stroke={theme.dim} strokeWidth={3} />
        <text x={520} y={404} textAnchor="middle" fontSize={20} fill={theme.dim} fontFamily={theme.sans}>
          {'刻度：' + (logMode > 0.5 ? '对数 + 封顶（差距被压缩）' : '线性（爆款碾压）')}
        </text>
        {bars.map((b, i) => {
          const val = (logMode > 0.5 ? log(b.v) : lin(b.v)) * 300;
          return (
            <g key={i} opacity={grow[i]}>
              <rect x={260 + i * 380} y={360 - val} width={110} height={val} rx={8}
                fill={i === 0 ? (logMode > 0.5 ? theme.activate : theme.danger) : theme.dim}
                style={{transform: `scaleY(${1 + (i === 0 ? flip * 0.04 : 0)})`, transformOrigin: '360px 360px'}} />
              <text x={315 + i * 380} y={392 - 370 + 370} textAnchor="middle" fontSize={21} fill={theme.text} fontFamily={theme.sans}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* tie-break 三级判序 */}
      <div style={{position: 'absolute', bottom: 240, display: 'flex', gap: 22}}>
        {['分数同 → 看权威', '权威同 → 看新旧', '再同 → 按名字'].map((t, i) => (
          <div key={i} style={{opacity: tie[i]}}>
            <Panel style={{padding: '12px 20px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{t}</div>
            </Panel>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', bottom: 210, right: 240, fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: tie[2]}}>
        {'确定性：同样的提问，永远同样的答案'}
      </div>
    </AbsoluteFill>
  );
};

/** 4-E USB-C 插头：治理灯全亮 */
const UsbcPlug: React.FC = () => {
  const slide = useProgress(4, DUR.f5);
  const snapIn = useSpring('snap', {at: 20, dur: DUR.f4});
  const lamps = useStagger(8, {at: 30, stride: 5});
  const devices = useStagger(3, {at: 70, stride: 12});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 机身 */}
      <div style={{position: 'relative', width: 900, height: 420, border: `4px solid ${theme.blueprint}`, borderRadius: 18, background: theme.panel}}>
        <div style={{position: 'absolute', left: 40, top: 40, fontFamily: theme.sans, fontSize: 24, color: theme.blueprint}}>
          {'上下文层 · MCP 服务'}
        </div>
        {/* 治理灯 */}
        <div style={{position: 'absolute', left: 40, top: 110, display: 'grid', gridTemplateColumns: 'repeat(4, 80px)', gap: 20}}>
          {Array.from({length: 8}, (_, i) => (
            <div key={i} style={{width: 80, height: 80, borderRadius: 40, background: lamps[i] > 0.5 ? theme.activate : theme.panel,
              border: `3px solid ${theme.activate}`, opacity: 0.4 + lamps[i] * 0.6,
              boxShadow: lamps[i] > 0.5 ? `0 0 ${14 * lamps[i]}px ${theme.activate}` : 'none'}} />
          ))}
        </div>
        {/* 插口 */}
        <div style={{position: 'absolute', right: -26, top: 180, width: 52, height: 84, background: '#0B0E13', border: `3px solid ${theme.activate}`, borderRadius: 10}} />
      </div>
      {/* 插头 */}
      <svg width={400} height={120} style={{position: 'absolute', right: 200 - slide * 260, top: 500}}>
        <rect x={40} y={30} width={150 * slide + 40} height={44} rx={10} fill={theme.activate} />
        <rect x={0} y={38} width={52} height={28} rx={6} fill={theme.activate}
          style={{filter: `drop-shadow(0 0 ${snapIn * 18}px ${theme.activate})`}} />
        <text x={210} y={64} fontSize={26} fill={theme.activate} fontFamily={theme.mono} opacity={snapIn}>
          {'MCP'}
        </text>
      </svg>
      {/* 异形设备接入 */}
      <div style={{position: 'absolute', bottom: 220, display: 'flex', gap: 60}}>
        {['💬 聊天助手', '🧑‍💻 编程体', '📊 报表机'].map((d, i) => (
          <div key={i} style={{opacity: devices[i], transform: `translateY(${(1 - devices[i]) * 16}px)`, fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
            {d}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 4-F 四工具卡 */
const FourTools: React.FC = () => {
  const cards = useStagger(4, {at: 4, stride: 10});
  const demo = useProgress(60, DUR.f6);
  const tools = [
    {n: '列目录', d: '按权限过滤后下发', icon: '📋'},
    {n: '问询', d: '问题 → 上下文包', icon: '🛎️'},
    {n: '执行', d: '引擎层二次验权', icon: '⚙️'},
    {n: '反馈', d: '踩/赞改热度', icon: '🔁'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 36}}>
        {tools.map((t, i) => (
          <div key={i} style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 26}px)`}}>
            <Panel accent={i === 2 ? theme.grown : theme.activate} style={{width: 270, padding: '26px 20px', textAlign: 'center'}}>
              <div style={{fontSize: 46}}>{t.icon}</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 10}}>{t.n}</div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 8}}>{t.d}</div>
              {i === 2 && demo > 0.3 ? (
                <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 17, color: theme.grown, opacity: demo}}>{'🛡 RBAC 再查一遍'}</div>
              ) : null}
            </Panel>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 4-G 原型实测输出面板 */
const LabOutput: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    {'id': 'T2', 't': 'tools/list 四工具齐全', 'hot': false},
    {'id': 'T5', 't': '引擎层 RBAC 经 MCP 仍生效: plan is a PRIVATE fact', 'hot': true},
    {'id': 'T6', 't': 'feedback down 后 \'sales\' 解析 governed → legacy', 'hot': true},
    {'id': 'T6b', 't': 'feedback up 恢复 governed 优先', 'hot': false},
    {'id': 'T8', 't': '子进程 stdio 往返: 2 响应行, active_customers=[3,1,2]', 'hot': false},
    {'id': '--', 't': 'SELFTEST PASSED ✔', 'hot': false},
  ];
  const shown = Math.min(lines.length, Math.floor(frame / 14) + 1);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <Panel style={{width: 1180, padding: '30px 38px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginBottom: 16}}>{'$ uv run --no-project python horizon_context_mcp.py --selftest'}</div>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} style={{fontFamily: theme.mono, fontSize: 22, marginTop: 12, color: l.hot ? theme.activate : theme.dim,
            textShadow: l.hot && frame - i * 14 < 18 ? `0 0 16px ${theme.activate}` : undefined}}>
            {`[${l.id === '--' ? 'OK' : 'PASS'}] ${l.t}`}
          </div>
        ))}
      </Panel>
      <div style={{position: 'absolute', bottom: 215, right: 220, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
        {'本仓原型实测输出 · 328 行零依赖'}
      </div>
    </AbsoluteFill>
  );
};

/** 4-H 收束：五积木全景，窗口与插头高亮 */
const CollectFrame: React.FC = () => {
  const all = useStagger(5, {at: 4, stride: 8});
  const hi = useProgress(40, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 24}}>
        {[
          {n: '对象', i: '🗃️'},
          {n: '目录', i: '📋'},
          {n: '富化', i: '🌱'},
          {n: '治理', i: '🛡️'},
          {n: '激活', i: '🔌'},
        ].map((b, k) => {
          const isHi = k === 4;
          return (
            <div key={k} style={{opacity: all[k], transform: `scale(${1 + (isHi ? hi * 0.18 : 0)})`}}>
              <Panel accent={isHi && hi > 0.3 ? theme.activate : theme.panelBorder} style={{width: 200, padding: '24px 14px', textAlign: 'center',
                boxShadow: isHi ? `0 0 ${hi * 26}px ${theme.activate}66` : 'none'}}>
                <div style={{fontSize: 44}}>{b.i}</div>
                <div style={{fontFamily: theme.sans, fontSize: 22, color: isHi && hi > 0.3 ? theme.activate : theme.dim, marginTop: 8}}>{b.n}</div>
              </Panel>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', bottom: 250, fontFamily: theme.serif, fontSize: 42, color: theme.activate, opacity: hi}}>
        {'一个窗口对内，一根插头对外。'}
      </div>
    </AbsoluteFill>
  );
};

export const P4Window: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p4-01', 'p4-08');
  const bB = w('p4-09', 'p4-10');
  const bC = w('p4-11', 'p4-15');
  const bD = w('p4-16', 'p4-20');
  const bE = w('p4-21', 'p4-24');
  const bF = w('p4-25', 'p4-28');
  const bG = w('p4-29', 'p4-34');
  const bH = w('p4-35', 'p4-38');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 唯一窗口">
        <SingleWindow />
      </Sequence>
      <Sequence {...bB} name="4-B 不装懂">
        <NoCoverage warnAt={at('p4-10') - bB.from} />
      </Sequence>
      <Sequence {...bC} name="4-C 四因子">
        <FourFactor />
      </Sequence>
      <Sequence {...bD} name="4-D 对数封顶">
        <LogCeiling flipAt={at('p4-18') - bD.from} tieAt={at('p4-19') - bD.from} />
      </Sequence>
      <Sequence {...bE} name="4-E USB-C插头">
        <UsbcPlug />
      </Sequence>
      <Sequence {...bF} name="4-F 四工具">
        <FourTools />
      </Sequence>
      <Sequence {...bG} name="4-G 原型实测">
        <LabOutput />
      </Sequence>
      <Sequence {...bH} name="4-H 收束">
        <CollectFrame />
      </Sequence>
    </AbsoluteFill>
  );
};
