/** P6 路线图与诚实（分镜 6-A…6-D）
 *  P0 已完成卡墙 → 四级台阶 → 诚实两卡 → 金句收尾 + 信源卡 + 渐黑。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {DUR, useBreathe, useDraw, useFadeOut, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 6-A P0 已完成：机制卡墙 + 破坏实验 */
const P0Done: React.FC = () => {
  const mech = useStagger(6, {at: 4, stride: 6});
  const breaks = useStagger(7, {at: 44, stride: 4});
  const badge = useSpring('snap', {at: 76, dur: DUR.f4});
  const names = ['对象模型', '计算纪律', '引擎治理', '双轨富化', '检索排序', 'MCP 插头'];
  const bp = ['D1 440', 'D2 重复计数', 'D3 求和', 'D4 错口径胜', 'D5 越权', 'D6 坏定义', 'D7 122.22'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 280px)', gap: 18}}>
        {names.map((n, i) => (
          <div key={i} style={{opacity: mech[i]}}>
            <Panel accent={theme.grown} style={{padding: '18px 16px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.grown}}>{'✓ ' + n}</div>
            </Panel>
          </div>
        ))}
      </div>
      <div style={{display: 'flex', gap: 12, marginTop: 30}}>
        {bp.map((b, i) => (
          <div key={i} style={{opacity: breaks[i]}}>
            <Panel style={{padding: '10px 14px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.danger}}>{b}</div>
            </Panel>
          </div>
        ))}
      </div>
      <div style={{marginTop: 34, opacity: badge, transform: `scale(${0.8 + 0.2 * badge})`}}>
        <Panel accent={theme.ok} style={{padding: '14px 36px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.ok}}>{'SELFTEST PASSED ✔ · P0 机制验证完成'}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 6-B 路线图四级台阶（P0 实心，P1-P3 虚线） */
const Roadmap: React.FC = () => {
  const p0 = useImpulse({at: 8, dur: DUR.f5});
  const stairs = useStagger(3, {at: 26, stride: 12});
  const accept = useStagger(2, {at: 70, stride: 9});
  const dashes = useFlowDash({period: 80});
  const steps = [
    {n: 'P0 机制验证', s: '已完成', done: true},
    {n: 'P1 最小服务', s: '可部署 + 真客户端', done: false},
    {n: 'P2 信任自纠', s: '排序/裁决/反馈闭环', done: false},
    {n: 'P3 互操作', s: '开放规范导入导出', done: false},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 26}}>
        {steps.map((st, i) => (
          <div key={i} style={{marginBottom: i * 64, opacity: st.done ? 1 : stairs[i - 1]}}>
            <div
              style={{
                width: 250,
                height: 96,
                borderRadius: 12,
                border: `3px ${st.done ? 'solid' : 'dashed'} ${st.done ? theme.grown : theme.blueprint}`,
                background: st.done ? theme.grown : 'transparent',
                opacity: st.done ? 0.9 : 0.75,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: st.done ? `0 0 ${12 + p0 * 20}px ${theme.grown}88` : 'none',
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 22, color: st.done ? theme.bg : theme.blueprint}}>{st.n}</div>
              <div style={{fontFamily: theme.sans, fontSize: 15, color: st.done ? theme.bg : theme.dim, marginTop: 4}}>{st.s}</div>
            </div>
          </div>
        ))}
      </div>
      {/* 虚线呼吸流动 */}
      <svg width={1100} height={8} style={{position: 'absolute', bottom: 320}}>
        <line x1={60} y1={4} x2={1040} y2={4} stroke={theme.blueprint} strokeWidth={3} opacity={0.4}
          strokeDasharray={dashes.strokeDasharray} strokeDashoffset={dashes.strokeDashoffset} />
      </svg>
      {/* P1 验收小卡 */}
      <div style={{position: 'absolute', bottom: 240, display: 'flex', gap: 20}}>
        {['真实客户端经插头命中签名问答', '越权被拒 + 有审计'].map((a, i) => (
          <div key={i} style={{opacity: accept[i]}}>
            <Panel accent={theme.blueprint} style={{padding: '12px 18px'}}>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.blueprint}}>{'验收：' + a}</div>
            </Panel>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 6-C 诚实两卡 */
const TwoHonest: React.FC = () => {
  const done = useSpring('settle', {at: 4});
  const dashes = useFlowDash({period: 70});
  const sizes = useStagger(2, {at: 60, stride: 12});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 80}}>
        <div style={{opacity: done}}>
          <Panel accent={theme.grown} style={{width: 440, padding: '30px 30px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.grown}}>{'已完成：仅第零步'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 12}}>{'玩具域 · 机制自洽'}</div>
          </Panel>
        </div>
        <div style={{opacity: done}}>
          <Panel accent={theme.blueprint} style={{width: 440, padding: '30px 30px', textAlign: 'center', position: 'relative'}}>
            <svg width={380} height={4} style={{position: 'absolute', left: 30, top: 40}}>
              <line x1={0} y1={2} x2={380} y2={2} stroke={theme.blueprint} strokeWidth={3}
                strokeDasharray={dashes.strokeDasharray} strokeDashoffset={dashes.strokeDashoffset} />
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.blueprint, marginTop: 20}}>{'路线图：P1–P3'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 12}}>{'设计过 ≠ 已做到'}</div>
          </Panel>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 300, display: 'flex', gap: 60, alignItems: 'flex-end'}}>
        <div style={{opacity: sizes[0]}}>
          <Panel style={{padding: '16px 30px', textAlign: 'center'}}>
            <div style={{fontSize: 34}}>{'🤖'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>{'一两个 AI：目录 + 窗口就够'}</div>
          </Panel>
        </div>
        <div style={{opacity: sizes[1]}}>
          <Panel style={{padding: '26px 40px', textAlign: 'center'}}>
            <div style={{fontSize: 46}}>{'🤖🤖🤖'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>{'一群 AI：才值得全五块'}</div>
          </Panel>
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 215, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: sizes[1]}}>
        {'这两句的区别，比整个蓝图都重要'}
      </div>
    </AbsoluteFill>
  );
};

/** 6-D 金句收尾 + 信源卡 + 渐黑 */
const FinalQuote: React.FC<{durationInFrames: number}> = ({durationInFrames}) => {
  const quote = useProgress(4, DUR.f6);
  const punch = useImpulse({at: 22, dur: DUR.f5});
  const infra = useProgress(40, DUR.f5);
  const src = useProgress(66, DUR.f5);
  const fade = useFadeOut(durationInFrames, {frames: 96});
  return (
    <AbsoluteFill style={{opacity: fade}}>
      <div style={{position: 'absolute', top: 220, width: '100%', textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 56, color: theme.text, opacity: quote, transform: `scale(${1 + punch * 0.03})`}}>
          {'含义被治理好之前，'}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 64, color: theme.grown, marginTop: 20, opacity: quote}}>
          {'AI 的聪明都是租来的。'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 40, opacity: infra}}>
          {'上下文层不是补品，是基础设施——像数据库、像网络'}
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: src}}>
        <Panel style={{width: 1000, padding: '24px 40px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, lineHeight: 2.0}}>
            <div>{'设计蓝图：docs/reference/context-layer-blueprint.md @ cf6724d6 · 2026-09-12'}</div>
            <div>{'机制范本：docs/reference/paper-notes/horizon-context.md（六机制精读 + IEEE 引用链）'}</div>
            <div>{'原型代码：horizon_context_lab.py + horizon_context_mcp.py · selftest 全绿（30 项）'}</div>
            <div>{'工程图回放：docs/assets/architecture/paper-notes/（archify · 交互版可下载回放）'}</div>
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', bottom: 220, width: '100%', textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim, opacity: src}}>
        {'我是做引擎的程序员，我们下期见。'}
      </div>
    </AbsoluteFill>
  );
};

export const P6Road: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p6-01', 'p6-05');
  const bB = w('p6-06', 'p6-11');
  const bC = w('p6-12', 'p6-16');
  const bD = w('p6-17', 'p6-22');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A P0已完成">
        <P0Done />
      </Sequence>
      <Sequence {...bB} name="6-B 四级台阶">
        <Roadmap />
      </Sequence>
      <Sequence {...bC} name="6-C 诚实两卡">
        <TwoHonest />
      </Sequence>
      <Sequence {...bD} name="6-D 金句与信源">
        <FinalQuote durationInFrames={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
