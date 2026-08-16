import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, Pill} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/** 4-A：体检中心 + 刷分作弊 */
const Checkup: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inflate = interpolate(frame, [30, 60], [30, 96], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 100, alignItems: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              width: 340,
              height: 420,
              borderRadius: 20,
              border: `3px solid ${theme.harness}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 18,
              opacity: spring({frame, fps, config: {damping: 200}}),
            }}
          >
            <div style={{fontSize: 90}}>🏥</div>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.harness, fontWeight: 700}}>
              进化体检中心
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>「系统说自己进化了」</div>
          </div>
        </div>
        <div style={{width: 480, padding: 34, borderRadius: 20, background: theme.panel, border: `3px solid ${theme.danger}`}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>练过的题册上的分数</div>
          <div style={{marginTop: 16, height: 26, borderRadius: 13, background: theme.panelBorder}}>
            <div style={{width: `${inflate}%`, height: '100%', borderRadius: 13, background: theme.danger}} />
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 48, fontWeight: 900, color: theme.danger}}>
            {Math.round(inflate)} 分
          </div>
          <div
            style={{
              marginTop: 14,
              display: 'inline-block',
              transform: `rotate(-8deg) scale(${inflate > 80 ? 1 : 0.1})`,
              border: `4px solid ${theme.danger}`,
              borderRadius: 10,
              color: theme.danger,
              fontFamily: theme.sans,
              fontWeight: 900,
              fontSize: 30,
              padding: '4px 14px',
            }}
          >
            刷分 ≠ 变强
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 4-B：六条体检指标 */
const SixTargets: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    {icon: '🆕', zh: '新任务涨分', en: 'Held-out gain'},
    {icon: '🧠', zh: '老任务不忘', en: 'Backward retention'},
    {icon: '⏳', zh: '持续稳定', en: 'Longitudinal stability'},
    {icon: '💰', zh: '性价比', en: 'Improvement efficiency'},
    {icon: '🧩', zh: '路径归因', en: 'Path attribution'},
    {icon: '🛡️', zh: '安全不退化', en: 'Safety non-regression'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{marginBottom: 40}}>
        <div style={{fontFamily: theme.sans, fontSize: 36, color: theme.exp, fontWeight: 700}}>
          自我进化 · 六条硬指标
        </div>
      </FadeUp>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
        {rows.map((r, i) => {
          const enter = interpolate(frame, [i * 8, i * 8 + 12], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          const stamp = interpolate(frame - i * 8, [6, 12], [1.5, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={r.zh}
              style={{
                display: 'flex',
                gap: 18,
                alignItems: 'center',
                padding: '20px 30px',
                borderRadius: 16,
                background: theme.panel,
                border: `2px solid ${enter > 0.9 ? theme.harness : theme.panelBorder}`,
                opacity: enter,
                transform: `scale(${enter > 0.9 ? stamp : 0.8})`,
                minWidth: 560,
              }}
            >
              <span style={{fontSize: 44}}>{r.icon}</span>
              <span style={{fontFamily: theme.sans, fontSize: 29, color: theme.text, fontWeight: 700}}>{r.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 'auto'}}>{r.en}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 4-C：同一 AI 跑两遍成绩差异 */
const FlakyRuns: React.FC = () => {
  const frame = useCurrentFrame();
  const runA = interpolate(frame, [10, 34], [0, 0.92], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  const runB = interpolate(frame, [30, 54], [0, 0.31], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 110, alignItems: 'flex-end', height: 480}}>
        {[
          {label: '第一次跑', v: runA, color: theme.ok},
          {label: '第二次跑', v: runB, color: theme.danger},
        ].map((r) => (
          <div key={r.label} style={{textAlign: 'center'}}>
            <div
              style={{
                width: 190,
                height: 380 * r.v,
                borderRadius: '14px 14px 0 0',
                background: `linear-gradient(180deg, ${r.color}, ${r.color}55)`,
              }}
            />
            <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>{r.label}</div>
            <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 900, color: r.color}}>
              {Math.round(r.v * 100)} 分
            </div>
          </div>
        ))}
      </div>
      <FadeUp delay={58} style={{marginTop: 40}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.danger}}>
          一次考得好，可能只是运气好
        </div>
        <div style={{marginTop: 10, fontFamily: theme.mono, fontSize: 22, color: theme.dim, textAlign: 'center'}}>
          tau-bench：repeated-run reliability ≪ single-run success
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 4-D：T0→T1→T2 纵向体检 */
const Longitudinal: React.FC = () => {
  const frame = useCurrentFrame();
  const points = [
    {t: 'T0', label: '改进前', color: theme.dim},
    {t: 'T1', label: '改进后', color: theme.harness},
    {t: 'T2', label: '过段时间', color: theme.exp},
  ];
  const lineGrow = interpolate(frame, [10, 70], [0, 1], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative', width: 1300, height: 400}}>
        <svg width="1300" height="400" style={{position: 'absolute', inset: 0}}>
          <line
            x1={80}
            y1={200}
            x2={80 + lineGrow * 1140}
            y2={200}
            stroke={theme.exp}
            strokeWidth={6}
            pathLength={1}
            strokeDasharray="14 10"
          />
        </svg>
        {points.map((p, i) => {
          const enter = spring({frame: frame - i * 18, fps: 30, config: {damping: 200}});
          return (
            <div
              key={p.t}
              style={{
                position: 'absolute',
                left: 80 + i * 570,
                top: 110,
                textAlign: 'center',
                opacity: enter,
                transform: `scale(${0.7 + enter * 0.3})`,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: theme.panel,
                  border: `4px solid ${p.color}`,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 38,
                  color: p.color,
                  fontFamily: theme.mono,
                  fontWeight: 700,
                }}
              >
                {p.t}
              </div>
              <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 26, color: p.color}}>{p.label}</div>
              <div style={{marginTop: 6, fontSize: 34}}>🩺</div>
            </div>
          );
        })}
        {/* 旧题重考循环 */}
        <FadeUp delay={60} style={{position: 'absolute', right: 60, top: 300}}>
          <Pill color={theme.exp}>留着旧题 · 反复重考</Pill>
        </FadeUp>
      </div>
      <FadeUp delay={70} style={{position: 'absolute', bottom: 92}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
          SIP-Bench：追着同一个进化的 AI 反复体检
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 4-E：题库腐烂 */
const RotBench: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const decay = interpolate(frame, [20, 70], [1, 0.3], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 100, alignItems: 'center'}}>
        <div
          style={{
            width: 380,
            padding: 30,
            borderRadius: 18,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            opacity: decay,
            filter: `saturate(${decay})`,
            textAlign: 'center',
          }}
        >
          <div style={{fontSize: 64}}>📄</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>2024 年的考题</div>
          <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 22, color: '#6a7a5a'}}>
            模型都见过了 · 分数虚高
          </div>
        </div>
        <div style={{fontSize: 64, color: theme.ok, opacity: spring({frame: frame - 30, fps, config: {damping: 200}})}}>
          🚚
        </div>
        <div
          style={{
            width: 380,
            padding: 30,
            borderRadius: 18,
            background: theme.panel,
            border: `3px solid ${theme.ok}`,
            textAlign: 'center',
            opacity: spring({frame: frame - 36, fps, config: {damping: 200}}),
          }}
        >
          <div style={{fontSize: 64}}>🆕</div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 26, color: theme.ok}}>持续换新的考题</div>
          <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
            SWE-bench-Live / SWE-rebench
          </div>
        </div>
      </div>
      <FadeUp delay={60} style={{marginTop: 60}}>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          连考题本身，都得持续换新 —— 不然分数会腐烂
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P4Eval: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p4-01', 'p4-04')} name="4-A 体检中心">
        <Checkup />
      </Sequence>
      <Sequence {...w('p4-05', 'p4-11')} name="4-B 六条指标">
        <SixTargets />
      </Sequence>
      <Sequence {...w('p4-12', 'p4-14')} name="4-C 稳定性">
        <FlakyRuns />
      </Sequence>
      <Sequence {...w('p4-15', 'p4-18')} name="4-D 纵向协议">
        <Longitudinal />
      </Sequence>
      <Sequence {...w('p4-19', 'p4-21')} name="4-E 题库腐烂">
        <RotBench />
      </Sequence>
    </AbsoluteFill>
  );
};
