/** P4 来访与档案卡（p4-01..20）——两阶段提交 + 相似≠同一 + 实测。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, LibraryHUD} from '../components/devices';

/** 4-C 像 vs 是：两张过敏卡被相似度弹簧拉向合并、锁定前急停。 */
const AllergyMerge: React.FC<{at: number; stopAt: number}> = ({at, stopAt}) => {
  const pull = useSpring('settle', {at, dur: DUR.f6});
  const stop = useImpulse({at: stopAt, dur: DUR.f6});
  const warn = useProgress(stopAt, DUR.f4);
  const gap = 340 - 240 * pull;
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 300, textAlign: 'center'}}>
      <div style={{display: 'flex', justifyContent: 'center', gap: gap, alignItems: 'center'}}>
        {[
          {who: '妈妈', note: '对花生过敏'},
          {who: '女儿', note: '对花生过敏'},
        ].map((c, i) => (
          <div
            key={c.who}
            style={{
              width: 300,
              padding: '22px 26px',
              borderRadius: 12,
              border: `2px solid ${theme.rose}`,
              background: `${theme.rose}0D`,
              transform: `scale(${1 + 0.08 * stop}) translateX(${(1 - pull) * 0}px)`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{c.who}</div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.rose, marginTop: 8}}>{c.note}</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 10}}>相似度 0.98{ i === 0 ? '' : ''}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 26, display: 'flex', justifyContent: 'center', gap: 60, alignItems: 'center'}}>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger, opacity: warn}}>✕ 合并 = 丢了一个人的过敏史</div>
      </div>
      <div style={{marginTop: 34, fontFamily: theme.serif, fontSize: 40, color: theme.mint}}>像和是，从来不是一回事</div>
    </div>
  );
};

/** 4-E 残余风险双卡：咖啡 vs 饮品并存。 */
const DualCards: React.FC<{at: number}> = ({at}) => {
  const [a, b] = useStagger(2, {at, stride: 9, dur: DUR.f5});
  const cards = [
    {f: 'preferences/alice/咖啡.md', v: '拿铁'},
    {f: 'preferences/alice/饮品.md', v: '拿铁'},
  ];
  return (
    <div style={{display: 'flex', gap: 40, justifyContent: 'center', marginTop: 18}}>
      {cards.map((c, i) => (
        <div
          key={c.f}
          style={{
            width: 330,
            padding: '14px 20px',
            borderRadius: 10,
            border: `1px dashed ${theme.peri}88`,
            background: `${theme.peri}0A`,
            opacity: i === 0 ? a : b,
            transform: `translateY(${(1 - (i === 0 ? a : b)) * 16}px)`,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{c.f}</div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 6}}>偏好 = {c.v}</div>
        </div>
      ))}
    </div>
  );
};

export const P4Memory: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-08');
  const bC = w('p4-09', 'p4-12');
  const bD = w('p4-13', 'p4-16');
  const bE = w('p4-17', 'p4-20');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 两阶段 · 装订">
        <SceneTag chapter="P4" tagline="来访与档案卡" accent={theme.mint} />
        <ArchifyRecap
          slug="session-commit-two-phase"
          caption="归档是事实 · 提炼是派生"
          cues={[
            {chapterId: 'live', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')}, {chapterId: 'live', at: at('p4-02') - bA.from, durationInFrames: dur('p4-02'), fit: 'hold'},
            {chapterId: 'archived', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
            {chapterId: 'p2', at: at('p4-04') - bA.from, durationInFrames: dur('p4-04')},
          ]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="4-B 盖章与封条">
        <SceneTag chapter="P4" tagline="来访与档案卡" accent={theme.mint} />
        <ArchifyRecap
          slug="session-commit-two-phase"
          caption=".done 提交点 · .failed 终态"
          lead={false}
          cues={[
            {chapterId: 'done', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')}, {chapterId: 'done', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06'), fit: 'hold'}, {chapterId: 'done', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07'), fit: 'hold'},
            {chapterId: 'failed', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
          ]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="4-C 像 vs 是">
        <SceneTag chapter="P4" tagline="来访与档案卡" accent={theme.rose} />
        <AllergyMerge at={at('p4-10') - bC.from} stopAt={at('p4-12') - bC.from} />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bD} name="4-D 身份裁决">
        <SceneTag chapter="P4" tagline="来访与档案卡" accent={theme.mint} />
        <ArchifyRecap
          slug="memory-identity"
          caption="相似只提名 · 卡名即身份"
          cues={[
            {chapterId: 'prefetch', at: at('p4-13') - bD.from, durationInFrames: dur('p4-13')},
            {chapterId: 'identity', at: at('p4-14') - bD.from, durationInFrames: dur('p4-14')},
            {chapterId: 'upsert', at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')}, {chapterId: 'upsert', at: at('p4-16') - bD.from, durationInFrames: dur('p4-16'), fit: 'hold'},
          ]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bE} name="4-E 实测 · 代码走廊③">
        <SceneTag chapter="P4" tagline="来访与档案卡" accent={theme.peri} />
        <DualCards at={at('p4-19') - bE.from} />
        <div style={{position: 'absolute', left: 430, top: 560, width: 1060}}>
          <TerminalLog
            prompt="uv run openviking_lab.py --selftest"
            lines={[
              {text: 'S6 偏好卡 1 张：{…/preferences/alice/咖啡.md: 拿铁}；事件卡 1 张', color: theme.mint, at: at('p4-18') - bE.from},
              {text: "     memory_diff[s2].updates = [{before: '喝美式咖啡', after: '拿铁'}]", color: theme.dim, at: at('p4-18') - bE.from + 20},
              {text: "S7 重投 s1 → {'skipped': True}；LLM 调用 7 次不变", color: theme.mint, at: at('p4-19') - bE.from},
            ]}
            caption="lab S6/S7 · 三次来访一张卡"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
