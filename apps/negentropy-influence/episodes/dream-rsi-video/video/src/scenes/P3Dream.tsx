/** P3 机制二：沙盘做梦（p3-01..19）——dream 冰蓝夜主场（幕基调切换）：
 *  3-A 翻账推演装置 · 3-B 两条规则图（archify）· 3-C 确定与免费（archify）
 *  · 3-D 沙盘边界围栏 · 3-E 四章程对撞（archify）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe, useDraw, useEnter, useReveal} from '../motion';
import {Backdrop, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 3-A：台账页翻开、当年结果逐行显影被「抄录」；生成/评审两图标挂灰色「未调用」牌。 */
const LedgerReplay: React.FC<{copyAt: number}> = ({copyAt}) => {
  const frame = useCurrentFrame();
  const lines = ['山谷 B · 第 3 营地', '挖到：稳定突破 s=0.80', '诊断：方向可行'];
  const revealed = [
    useReveal(lines[0], {at: copyAt, cps: 14}),
    useReveal(lines[1], {at: copyAt + DUR.f5, cps: 14}),
    useReveal(lines[2], {at: copyAt + DUR.f5 * 2, cps: 14}),
  ];
  const tags = useEnter('fall', {at: copyAt + DUR.f4, dist: 26});
  const copyLine = useDraw(copyAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 台账页（左）与沙盘抄录页（右），中间抄录线 */}
      <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
        <Panel accent={theme.dream} style={{padding: '26px 36px', minWidth: 430, minHeight: 250}}>
          <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dream}}>台账 · 山谷 B 页</div>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.text, marginTop: 16, lineHeight: 2}}>
            {revealed.map((l, i) => (
              <div key={i}>{l || ' '}</div>
            ))}
          </div>
        </Panel>
        <svg width={160} height={60} viewBox="0 0 160 60">
          <line x1={6} y1={30} x2={154} y2={30} stroke={theme.dream} strokeWidth={3} {...copyLine} />
        </svg>
        <Panel style={{padding: '26px 36px', minWidth: 430, minHeight: 250}}>
          <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dim}}>沙盘 · 抄录结果</div>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim, marginTop: 16, lineHeight: 2}}>
            {revealed.map((l, i) => (
              <div key={i}>{l || ' '}</div>
            ))}
          </div>
        </Panel>
      </div>
      {/* 「未调用」牌：免费的本质 */}
      <div style={{position: 'absolute', right: 150, top: 180, display: 'flex', gap: 18, ...tags}}>
        {['生成 agent', '评审器'].map((t) => (
          <Panel key={t} style={{padding: '10px 20px', opacity: 0.75}}>
            <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>{t} · 未调用</span>
          </Panel>
        ))}
      </div>
      <Footnote delay={10}>evaluating a new strategy requires only reading past records（§2）</Footnote>
    </AbsoluteFill>
  );
};

/** 3-D：沙盘边界发光围栏；圈外灰雾 + 问号浮标（P6 伏笔）。 */
const SandboxFence: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const glow = useBreathe({period: DUR.f6 * 2.4, amp: 0.33, base: 0.68, offset: at});
  const fence = useDraw(at, DUR.f6);
  const fog = progress(frame, at + DUR.f4, DUR.f5);
  const q = useEnter('pop', {at: at + DUR.f5, dist: 12});
  return (
    <AbsoluteFill>
      {/* 圈内：已探索区（微亮网格）；圈外：纯灰雾 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 760px 430px at 50% 46%, transparent 62%, #3a3f4a${Math.round(fog * 200).toString(16).padStart(2, '0')} 100%)`,
        }}
      />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <ellipse
          cx={960}
          cy={497}
          rx={700}
          ry={390}
          fill="none"
          stroke={theme.dream}
          strokeWidth={3 + glow * 2}
          opacity={0.5 + glow * 0.5}
          {...fence}
        />
      </svg>
      {/* 问号浮标（圈外三枚，P6 伏笔标记） */}
      <div style={{position: 'absolute', left: 250, top: 200, ...q}}>
        <span style={{fontFamily: theme.serif, fontSize: 54, color: '#5a6270'}}>？</span>
      </div>
      <div style={{position: 'absolute', right: 230, top: 260, ...q}}>
        <span style={{fontFamily: theme.serif, fontSize: 44, color: '#5a6270'}}>？</span>
      </div>
      <div style={{position: 'absolute', left: 420, bottom: 190, ...q}}>
        <span style={{fontFamily: theme.serif, fontSize: 40, color: '#5a6270'}}>？</span>
      </div>
      <div style={{position: 'absolute', bottom: 240, width: '100%', textAlign: 'center'}}>
        <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>
          只覆盖队伍真正走过的地方 —— 圈外一无所知
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const P3Dream: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const b3B = w('p3-06', 'p3-09');
  const b3C = w('p3-10', 'p3-11');
  const b3E = w('p3-15', 'p3-19');
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop tint={theme.dream} opacity={0.1} />
      <SceneTag chapter="P3" tagline="机制二 · 沙盘做梦（确定性重放）" accent={theme.dream} />
      <Sequence {...w('p3-01', 'p3-05')} name="3-A 沙盘推演">
        <LedgerReplay copyAt={at('p3-04') - w('p3-01', 'p3-05').from} />
      </Sequence>
      <Sequence {...b3B} name="3-B 两条规则">
        <ArchifyRecap
          slug="determinism-proof"
          caption="翻台账的两条规则"
          cues={[
            {chapterId: 'reset', at: at('p3-06') - b3B.from, durationInFrames: dur('p3-06')},
            {chapterId: 'nonroot', at: at('p3-07') - b3B.from, durationInFrames: dur('p3-07')},
            {chapterId: 'root', at: at('p3-08') - b3B.from, durationInFrames: dur('p3-08')},
          ]}
        />
      </Sequence>
      <Sequence {...b3C} name="3-C 确定与免费">
        <ArchifyRecap
          slug="two-phase-loop"
          caption="夜里做梦：历史钉上沙盘"
          lead={false}
          cues={[{chapterId: 'offline', at: at('p3-10') - b3C.from, durationInFrames: dur('p3-10')}]}
        />
      </Sequence>
      <Sequence {...w('p3-12', 'p3-14')} name="3-D 沙盘边界">
        <SandboxFence at={0} />
      </Sequence>
      <Sequence {...b3E} name="3-E 四章程对撞">
        <ArchifyRecap
          slug="four-charters"
          caption="四章程同树分高下"
          cues={[
            {chapterId: 'one-tree', at: at('p3-16') - b3E.from, durationInFrames: dur('p3-16')},
            {chapterId: 'scores', at: at('p3-17') - b3E.from, durationInFrames: dur('p3-17')},
            {chapterId: 'takeaway', at: at('p3-19') - b3E.from, durationInFrames: dur('p3-19')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
