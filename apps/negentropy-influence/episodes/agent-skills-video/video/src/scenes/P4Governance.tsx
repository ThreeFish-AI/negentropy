/** P4 46 家的默契与分歧（p4-01..p4-25，镜 4-A..4-F）——徽章墙（官方名录 46 格）
 *  → 三家分叉（ge-eco 全屏窗 + 路径分叉）→ X5 遮蔽消融（拆警告→知情权盲区）→
 *  X2 严格宽容对比（4/12 拒载＝33%）→ X3 布尔翻转（true→'false'→误启用）→
 *  PR 悬案（gl-verdict 全屏窗）。主色治理紫；消融红绿契约色。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useCount,
  useDim,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {AblationPanel} from '../components/as-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 4-A：46 格客户端墙（8×6 网格点亮 46，余灰空位）+ 取数角标。 */
const BadgeWall: React.FC<{lightAt: number}> = ({lightAt}) => {
  const frame = useCurrentFrame();
  const lit = useCount({at: lightAt, dur: DUR.f6, to: 46});
  return (
    <div style={{position: 'relative'}}>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(8, 92px)', gap: 12}}>
        {Array.from({length: 48}).map((_, i) => {
          const on = i < 46;
          const p = progress(frame, lightAt + i * 2, DUR.f3);
          return (
            <div
              key={i}
              style={{
                height: 44,
                borderRadius: 9,
                background: on ? theme.panel : 'transparent',
                border: `1.5px solid ${on ? `${theme.gov}66` : `${theme.panelBorder}44`}`,
                opacity: on ? 0.35 + 0.65 * p : 0.35,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontFamily: theme.mono,
                color: on ? theme.gov : `${theme.dim}66`,
              }}
            >
              {on ? `client ${i + 1}` : '—'}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: -46,
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: 6,
          padding: '5px 12px',
          fontSize: 14.5,
          color: theme.dim,
        }}
      >
        官方 Showcase 收录 <span style={{color: theme.gov, fontFamily: theme.mono, fontSize: 18}}>
          {Math.round(lit)}
        </span> 家 · 取数 2026-09
      </div>
    </div>
  );
};

/** 4-B：三条目录路径分叉 + 「只定底线」紫章（窗外）；p4-04 ge-eco 全屏窗。 */
const PathFork: React.FC<{forkAt: number; stampAt: number}> = ({forkAt, stampAt}) => {
  const rows = useStagger(3, {at: forkAt, dur: DUR.f6, stride: 9});
  const stamp = useEnter('pop', {at: stampAt, dur: DUR.f5, springPreset: 'snap'});
  const rowsData = [
    {label: '项目级 .agents/skills/', w: '各家都扫'},
    {label: '用户级 ~/.agents/skills/', w: '多数扫'},
    {label: '自家专属路径', w: '部分扫'},
  ];
  return (
    <div style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 16}}>
      {rowsData.map((r, i) => (
        <div
          key={r.label}
          style={{
            opacity: rows[i],
            transform: `translateX(${24 * (1 - rows[i])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.text,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 8,
              padding: '9px 16px',
              background: theme.panel,
              minWidth: 320,
            }}
          >
            {r.label}
          </div>
          <span style={{fontSize: 14.5, color: theme.dim}}>{r.w}</span>
        </div>
      ))}
      <div
        style={{
          ...stamp,
          position: 'absolute',
          right: 10,
          top: -34,
          transform: `${stamp.transform} rotate(8deg)`,
          border: `2px solid ${theme.gov}`,
          color: theme.gov,
          borderRadius: 9,
          padding: '6px 16px',
          fontFamily: theme.serif,
          fontSize: 20,
          fontWeight: 700,
          background: theme.bg,
        }}
      >
        规范只定底线
      </div>
    </div>
  );
};

/** 4-C：X5 遮蔽消融——右绿警告在位（铃响）vs 左红拆警告（同名覆盖静默+盲区黑幕）。 */
const X5Shadow: React.FC<{bellAt: number; veilAt: number}> = ({bellAt, veilAt}) => {
  const bell = useImpulse({at: bellAt, dur: DUR.f4, peak: 1});
  const bellP = useProgress(bellAt + DUR.f4, DUR.f4);
  const veil = useDim({at: veilAt, to: 0.25, dur: DUR.f5});
  const shake = useShake({at: veilAt, amp: 3, decay: true, dur: DUR.f5});
  const pair = (ok: boolean) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
      {[
        {n: 'release-notes', src: '项目级'},
        {n: 'release-notes', src: '用户级'},
      ].map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: theme.mono,
            fontSize: 16,
            opacity: !ok && i === 1 ? veil : 1,
            transform: !ok && i === 1 ? `translateX(${shake}px)` : 'none',
          }}
        >
          <span style={{color: i === 0 ? theme.ok : theme.dim}}>{r.n}</span>
          <span style={{fontSize: 13, color: theme.dim}}>{r.src}</span>
          {ok && i === 1 ? (
            <span style={{fontSize: 13, color: theme.ok}}>🔔 覆盖警告</span>
          ) : null}
          {!ok && i === 1 ? <span style={{fontSize: 13, color: theme.danger}}>被静默覆盖</span> : null}
        </div>
      ))}
      {!ok ? (
        <div
          style={{
            marginTop: 10,
            border: `1.5px solid ${theme.danger}55`,
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 14,
            color: theme.danger,
          }}
        >
          用户视角：加载的是哪一版？无从知晓
        </div>
      ) : (
        <div style={{fontSize: 14, color: theme.dim, marginTop: 10, opacity: bellP}}>
          覆盖发生时 · 开发者知情
        </div>
      )}
    </div>
  );
  return (
    <AblationPanel leftTitle="拆掉覆盖警告（X5）" rightTitle="警告在位" width={900} height={230}>
      {pair(false)}
      {pair(true)}
      <div style={{fontSize: 15, color: theme.dim}}>
        有效技能一个没少：<span style={{color: theme.text}}>1 处覆盖悄悄生效</span>
        <span style={{marginLeft: 14, color: theme.ok, opacity: bell > 0 ? 1 : 0.4}}>🔔</span>
      </div>
    </AblationPanel>
  );
};

/** 4-D：X2 严格 vs 宽容——12 格双栏（严格 4 红叉、其中 1 格「为别家写」；宽容全绿）。 */
const X2StrictLenient: React.FC<{verdictAt: number; gapAt: number}> = ({verdictAt, gapAt}) => {
  const cells = useStagger(12, {at: verdictAt, dur: DUR.f6, stride: 3});
  const gap = useCount({at: gapAt, dur: DUR.f5, to: 33});
  const rejected = new Set([1, 4, 7, 9]);
  const foreign = 4;
  const col = (strict: boolean) => (
    <div style={{width: 380}}>
      <div style={{fontSize: 15, letterSpacing: 2, marginBottom: 12, color: strict ? theme.danger : theme.ok}}>
        {strict ? '严格口径 · 拒载 4' : '宽容口径 · 全载 12'}
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 78px)', gap: 9}}>
        {Array.from({length: 12}).map((_, i) => {
          const rej = strict && rejected.has(i);
          return (
            <div
              key={i}
              style={{
                height: 46,
                borderRadius: 8,
                background: theme.panel,
                border: `1.5px solid ${rej ? theme.danger : `${theme.ok}55`}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontFamily: theme.mono,
                color: rej ? theme.danger : theme.dim,
                opacity: cells[i],
                position: 'relative',
              }}
            >
              {rej ? '✗ 拒载' : '✓'}
              {i === foreign && rej ? (
                <span style={{fontSize: 10, color: theme.danger}}>为别家写</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {strict ? (
        <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 17, color: theme.danger}}>
          互操作面 −{Math.round(gap)}%
        </div>
      ) : null}
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'flex-start'}}>
      {col(true)}
      {col(false)}
    </div>
  );
};

/** 4-E：X3 布尔翻转——写入 true → 读出 'false' → 判定「有值＝真」→ 禁用技能误亮。 */
const X3BoolFlip: React.FC<{writeAt: number; readAt: number; onAt: number}> = ({
  writeAt,
  readAt,
  onAt,
}) => {
  const written = useReveal('enabled: true', {at: writeAt, cps: 14});
  const read = useReveal("enabled: 'false'", {at: readAt, cps: 14});
  const lamp = useEnter('pop', {at: onAt, dur: DUR.f4, springPreset: 'snap'});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
      <div
        style={{
          background: '#0B0E13',
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '20px 26px',
          fontFamily: theme.mono,
          fontSize: 19,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 420,
        }}
      >
        <div>
          <span style={{color: theme.dim}}>作者写入 </span>
          <span style={{color: theme.text}}>{written}</span>
        </div>
        <div>
          <span style={{color: theme.dim}}>读出字符串 </span>
          <span style={{color: theme.danger}}>{read}</span>
        </div>
      </div>
      <div style={{fontSize: 30, color: theme.dim}}>→</div>
      <div
        style={{
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '16px 22px',
          background: theme.panel,
          fontSize: 17,
          color: theme.text,
        }}
      >
        客户端判定：字符串有值
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.danger, marginTop: 6}}>
          bool('false') == True
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
        <div style={{...lamp, width: 74, height: 74, borderRadius: '50%', background: theme.ok, boxShadow: `0 0 34px ${theme.ok}77`}} />
        <div style={{fontSize: 14, color: theme.dim}}>被禁用的技能</div>
        <div style={{fontSize: 14, color: theme.danger}}>误启用</div>
      </div>
    </div>
  );
};

export const P4Governance: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string) => w(a).durationInFrames;
  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-08');
  const bC = w('p4-09', 'p4-12');
  const bD = w('p4-13', 'p4-18');
  const bE = w('p4-19', 'p4-22');
  const bF = w('p4-23', 'p4-25');
  const close = useEnter('pop', {at: at('p4-25') - bF.from, dur: DUR.f5, springPreset: 'snap'});
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 46 家阵列">
        <SceneTag chapter="P4" tagline="46 家的默契与分歧" accent={theme.gov} />
        <BadgeWall lightAt={at('p4-02') - bA.from} />
      </Sequence>
      <Sequence {...bB} name="4-B 三家分叉">
        <SceneTag chapter="P4" tagline="46 家的默契与分歧" accent={theme.gov} />
        <PathFork forkAt={at('p4-07') - bB.from} stampAt={at('p4-08') - bB.from} />
        <ArchifyRecap
          slug="governance"
          caption="生态层 · 三家实现分叉"
          cues={[
            {chapterId: 'ge-eco', at: at('p4-04') - bB.from, durationInFrames: dur('p4-04')},
            {chapterId: 'gl-guide', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
          ]}
        />
      </Sequence>
      <Sequence {...bC} name="4-C X5 遮蔽消融">
        <SceneTag chapter="P4" tagline="46 家的默契与分歧" accent={theme.gov} />
        <X5Shadow bellAt={at('p4-10') - bC.from} veilAt={at('p4-11') - bC.from} />
      </Sequence>
      <Sequence {...bD} name="4-D X2 严格宽容">
        <SceneTag chapter="P4" tagline="46 家的默契与分歧" accent={theme.gov} />
        <X2StrictLenient verdictAt={at('p4-15') - bD.from} gapAt={at('p4-17') - bD.from} />
        <ArchifyRecap
          slug="governance"
          caption="指南层 · 宽容校验"
          cues={[
            {chapterId: 'gl-guide', at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')},
          ]}
        />
      </Sequence>
      <Sequence {...bE} name="4-E X3 布尔翻转">
        <SceneTag chapter="P4" tagline="46 家的默契与分歧" accent={theme.gov} />
        <X3BoolFlip
          writeAt={at('p4-20') - bE.from}
          readAt={at('p4-21') - bE.from}
          onAt={at('p4-22') - bE.from}
        />
      </Sequence>
      <Sequence {...bF} name="4-F PR 悬案">
        <SceneTag chapter="P4" tagline="46 家的默契与分歧" accent={theme.gov} />
        <div
          style={{
            ...close,
            position: 'absolute',
            left: '50%',
            bottom: 170,
            transform: `${close.transform} translateX(-50%)`,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              border: `1.5px solid ${theme.gov}77`,
              borderRadius: 999,
              padding: '12px 30px',
              fontFamily: theme.serif,
              fontSize: 24,
              color: theme.gov,
              background: theme.panel,
            }}
          >
            生态先行 · 条文追认
          </span>
        </div>
        <ArchifyRecap
          slug="governance"
          caption="治理悬案 · 开放提案"
          cues={[
            {chapterId: 'gl-verdict', at: at('p4-23') - bF.from, durationInFrames: dur('p4-23')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
