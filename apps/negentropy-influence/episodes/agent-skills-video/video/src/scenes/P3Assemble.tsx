/** P3 按需装配（p3-01..26）——三级渐进披露、目录契约、玩具库账本、书脊墙。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useProgress} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {CodeWalk} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {ActHUD, CostWall, LedgerBars, SpineRow} from '../components/devices';

/** 3-A 扫描光带。 */
const ScanBand: React.FC<{at: number}> = ({at}) => {
  const p = useProgress(at, DUR.f6);
  return (
    <div style={{position: 'relative', width: 1240, height: 220}}>
      <div style={{position: 'absolute', left: 0, top: 40}}>
        <SpineRow
          names={['pdf-tools', 'md-tables', 'code-review', 'data-analysis', 'meeting', 'tool-06', 'tool-07', 'tool-08', 'tool-09', 'tool-10']}
          at={0}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: p * 900,
          top: 0,
          width: 90,
          height: 190,
          background: `linear-gradient(90deg, ${theme.spine}00, ${theme.spine}55, ${theme.spine}00)`,
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, fontFamily: theme.sans, fontSize: 25, color: theme.spine, textAlign: 'center', opacity: p}}>
        这排书脊在 AI 眼里 = 一份目录（available_skills）
      </div>
    </div>
  );
};

/** 3-B 三层预算卡。 */
const TierBudget: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const tiers = [
    {h: '第一层 · 书脊', b: '名字 + 描述，每次开工都扫一遍', n: '≈100 计量单位/条', c: theme.spine},
    {h: '第二层 · 整本', b: '被选中才读完整正文', n: '<5000 单位 · <500 行', c: theme.book},
    {h: '第三层 · 附录', b: '正文提到哪页才翻哪页', n: '按需', c: theme.forge},
  ];
  return (
    <div style={{display: 'flex', gap: 26, alignItems: 'stretch'}}>
      {tiers.map((t, i) => {
        const p = progress(frame, at + i * 8, DUR.f4);
        return (
          <div
            key={t.h}
            style={{
              width: 360,
              padding: '22px 26px',
              borderRadius: 12,
              background: theme.panel,
              border: `2px solid ${t.c}88`,
              opacity: p,
              transform: `translateY(${(1 - p) * 30}px)`,
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 29, color: t.c}}>{t.h}</div>
            <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text, marginTop: 12, lineHeight: 1.5}}>{t.b}</div>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: t.c, marginTop: 14}}>{t.n}</div>
          </div>
        );
      })}
    </div>
  );
};

/** 3-C 目录契约。 */
const CatalogContract: React.FC<{at: number}> = ({at}) => {
  const arrow = useDraw(at + 6, DUR.f5);
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div
        style={{
          width: 470,
          padding: '24px 28px',
          borderRadius: 12,
          background: theme.panel,
          border: `2px solid ${theme.spine}88`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.spine, marginBottom: 12}}>{'<available_skills>'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, lineHeight: 1.7}}>
          书脊 ×N（目录）
          <div style={{color: theme.dim, fontSize: 21}}>「要用哪本，就照这里写的路去取」</div>
        </div>
      </div>
      <svg width={220} height={80} viewBox="0 0 220 80">
        <path d="M10 40 H 200" stroke={theme.ok} strokeWidth={4} fill="none" {...arrow} />
        <path d="M186 28 L 206 40 L 186 52" stroke={theme.ok} strokeWidth={4} fill="none" {...arrow} />
      </svg>
      <div
        style={{
          width: 430,
          padding: '24px 28px',
          borderRadius: 12,
          background: theme.panel,
          border: `2px solid ${theme.ok}88`,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.ok,
          lineHeight: 1.6,
        }}
      >
        那条路必须真走得通（读文件 / 专用工具）
        <div style={{color: theme.danger, fontSize: 22, marginTop: 8}}>柜子空着 → 连目录都别挂</div>
      </div>
    </div>
  );
};

export const P3Assemble: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-05');
  const bB = w('p3-06', 'p3-11');
  const bC = w('p3-12', 'p3-14');
  const bD = w('p3-15', 'p3-20');
  const bE = w('p3-21', 'p3-26');
  const selftestLines = [
    '$ agent_skills_lab.py --selftest',
    '[M3 发现] ✔ 共载入 19 个技能',
    '[M4 目录] ✔ 1113 tokens / 19 技能 ≈ 59 tokens/技能',
    '[会话账本] ✔ 渐进披露 {catalog: 1113, instructions: 203,',
    '             resources: 1005, total: 2321}',
    '[会话账本] ✔ vs 全量预载 total=39222（16.9×）',
    'SELFTEST PASSED ✔',
  ];
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 书脊扫描">
        <SceneTag chapter="P3" tagline="按需装配" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')}]}>
          <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
            <ScanBand at={at('p3-02') - bA.from} />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="progressive-disclosure"
          caption="第一层：书脊常驻"
          cues={[{chapterId: 'tier1', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')}]}
        />
        <ActHUD lit={2} />
      </Sequence>

      <Sequence {...bB} name="3-B 三层预算">
        <SceneTag chapter="P3" tagline="按需装配" accent={theme.spine} />
        <ArchifyYield
          cues={[
            {at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
            {at: at('p3-10') - bB.from, durationInFrames: dur('p3-10')},
          ]}
        >
          <TierBudget at={at('p3-06') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="progressive-disclosure"
          caption="第二层整本 / 第三层附录"
          cues={[
            {chapterId: 'tier2', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
            {chapterId: 'tier3', at: at('p3-10') - bB.from, durationInFrames: dur('p3-10')},
          ]}
        />
        <Footnote delay={40}>口径注：规范说每条约一百，另一份官方指南说五十到一百 → 只当量级</Footnote>
      </Sequence>

      <Sequence {...bC} name="3-C 目录契约">
        <SceneTag chapter="P3" tagline="按需装配" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')}]}>
          <CatalogContract at={at('p3-12') - bC.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="progressive-disclosure"
          caption="目录承诺的取书之路必须存在"
          cues={[{chapterId: 'contract', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')}]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 玩具库账本">
        <SceneTag chapter="P3" tagline="按需装配" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p3-17') - bD.from, durationInFrames: dur('p3-17')}]}>
          <Ledger
            lines={selftestLines}
            hiAt={at('p3-17') - bD.from + 8}
            at={at('p3-15') - bD.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="cost-structure"
          caption="账本：2321 vs 39222"
          cues={[{chapterId: 'ledger', at: at('p3-17') - bD.from, durationInFrames: dur('p3-17')}]}
        />
      </Sequence>

      <Sequence {...bE} name="3-E 书脊墙">
        <SceneTag chapter="P3" tagline="按需装配" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p3-22') - bE.from, durationInFrames: dur('p3-22')}]}>
          <CostWall books={30} draws={2} at={at('p3-21') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="cost-structure"
          caption="书脊墙 vs 按次付费"
          cues={[{chapterId: 'wall-vs-pay', at: at('p3-22') - bE.from, durationInFrames: dur('p3-22')}]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 3-D 终端走廊 + 账柱合体。 */
const Ledger: React.FC<{lines: string[]; at: number; hiAt: number}> = ({lines, at, hiAt}) => {
  const frame = useCurrentFrame();
  const hi = [
    {line: 5, at: hiAt, color: theme.ok},
    {line: 6, at: hiAt + 4, color: theme.danger},
  ];
  return (
    <div style={{display: 'flex', gap: 50, alignItems: 'center'}}>
      <CodeWalk title="原型实测（玩具技能库）" lines={lines} hi={hi} width={860} />
      <LedgerBars
        at={hiAt}
        max={39222}
        bars={[
          {label: '按需装配', value: 2321, color: theme.ok},
          {label: '全部预塞', value: 39222, color: theme.danger},
        ]}
      />
      <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.forge, transform: 'rotate(-6deg)'}}>
        16.9×
      </div>
    </div>
  );
};
