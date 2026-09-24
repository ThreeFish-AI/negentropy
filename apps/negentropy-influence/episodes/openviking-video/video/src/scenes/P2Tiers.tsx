/** P2 标签与导览（p2-01..15）——L0/L1/L2 目录级分层 + 新鲜度漏斗 + 成本公式。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useCount, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, LibraryHUD} from '../components/devices';

/** 2-D 成本账单：等式滚动 + 兄弟文件简介卡陪翻。 */
const CostBill: React.FC<{at: number; boomAt: number}> = ({at, boomAt}) => {
  const docs = useCount({from: 0, to: 72, at, dur: DUR.f6});
  const dirs = useCount({from: 0, to: 53, at: at + 6, dur: DUR.f6});
  const calls = useCount({from: 0, to: 125, at: at + 12, dur: DUR.f6});
  const siblings = useStagger(4, {at: boomAt, stride: 7, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 260, display: 'flex', gap: 70, justifyContent: 'center', alignItems: 'flex-start'}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.mint, marginBottom: 18}}>入库成本公式</div>
        <div
          style={{
            display: 'flex',
            gap: 22,
            alignItems: 'center',
            padding: '26px 38px',
            borderRadius: 14,
            border: `2px solid ${theme.peri}`,
            background: `${theme.peri}0C`,
            fontFamily: theme.mono,
            fontSize: 44,
          }}
        >
          <span style={{color: theme.peri}}>{docs}</span>
          <span style={{color: theme.dim, fontSize: 24}}>文档</span>
          <span style={{color: theme.dim}}>+</span>
          <span style={{color: theme.peri}}>{dirs}</span>
          <span style={{color: theme.dim, fontSize: 24}}>目录</span>
          <span style={{color: theme.dim}}>=</span>
          <span style={{color: theme.mint}}>{calls}</span>
          <span style={{color: theme.dim, fontSize: 24}}>次调用</span>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 14}}>标签白送 · L0 零次调用</div>
      </div>
      <div style={{paddingTop: 30}}>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginBottom: 10}}>祖先架重印：兄弟文件陪写简介</div>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 300,
              padding: '9px 18px',
              borderRadius: 8,
              border: `1px dashed ${theme.rose}55`,
              color: theme.rose,
              fontFamily: theme.mono,
              fontSize: 17,
              marginBottom: 8,
              opacity: siblings[i - 1],
              transform: `rotate(${(siblings[i - 1] - 1) * 4}deg)`,
            }}
          >
            重写简介 · sibling-{i}
          </div>
        ))}
      </div>
    </div>
  );
};

export const P2Tiers: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-03');
  const bB = w('p2-05', 'p2-08');
  const bC = w('p2-09', 'p2-13');
  const bD = w('p2-14', 'p2-15');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 标签与导览">
        <SceneTag chapter="P2" tagline="标签与导览" accent={theme.mint} />
        <ArchifyRecap
          slug="tiering-l0-l1-l2"
          caption="L0 标签 · L1 导览 · L2 原文"
          cues={[{chapterId: 'layers', at: at('p2-01') - bA.from, durationInFrames: dur('p2-01')}, {chapterId: 'layers', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02'), fit: 'hold'}, {chapterId: 'layers', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03'), fit: 'hold'}]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="2-B 生成链 · 代码走廊①">
        <SceneTag chapter="P2" tagline="标签与导览" accent={theme.mint} />
        <ArchifyRecap
          slug="tiering-l0-l1-l2"
          caption="导览一次 · 标签白送"
          lead={false}
          cues={[
            {chapterId: 'gen', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
            {chapterId: 'cut', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')},
          ]}
        />
        <ArchifyRecap
          slug="ingest-phase"
          caption="编目相流水线"
          lead={false}
          cues={[{chapterId: 'summarize', at: at('p2-05') - bB.from, durationInFrames: dur('p2-05')}, {chapterId: 'summarize', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06'), fit: 'hold'}]}
        />
        <div style={{position: 'absolute', left: 430, top: 640, width: 1060}}>
          <TerminalLog
            prompt="uv run openviking_lab.py --selftest"
            lines={[
              {text: 'S2 编目：72 本书、53 个书架，LLM 调用 125 次（文件 1 次 + 目录 1 次，L0 零次）', color: theme.mint, at: at('p2-08') - bB.from},
            ]}
            caption="lab S2 · 成本结构实测"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="2-C 采样与新鲜度">
        <SceneTag chapter="P2" tagline="标签与导览" accent={theme.mint} />
        <ArchifyRecap
          slug="tiering-l0-l1-l2"
          caption="采样闸"
          lead={false}
          cues={[{chapterId: 'sample', at: at('p2-09') - bC.from, durationInFrames: dur('p2-09')}, {chapterId: 'sample', at: at('p2-10') - bC.from, durationInFrames: dur('p2-10'), fit: 'hold'}]}
        />
        <ArchifyRecap
          slug="freshness-bubbling"
          caption="新鲜度漏斗"
          lead={false}
          cues={[
            {chapterId: 'funnel', at: at('p2-11') - bC.from, durationInFrames: dur('p2-11')},
            {chapterId: 'small', at: at('p2-12') - bC.from, durationInFrames: dur('p2-12')},
            {chapterId: 'wide', at: at('p2-13') - bC.from, durationInFrames: dur('p2-13')},
          ]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bD} name="2-D 成本账单">
        <SceneTag chapter="P2" tagline="标签与导览" accent={theme.peri} />
        <CostBill at={at('p2-14') - bD.from} boomAt={at('p2-15') - bD.from} />
        <EvidenceBadge grade="lab" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
