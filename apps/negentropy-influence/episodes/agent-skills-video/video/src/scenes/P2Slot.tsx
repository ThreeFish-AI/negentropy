/** P2 一格一本（p2-01..22）——技能 = 文件夹 = 柜中一格；书脊 = 名字 + 描述；名字 = 格子标签。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useImpulse, useProgress, useStagger} from '../motion';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {CabinetGrid, Stage} from '../components/devices';

/** 2-B 书脊两行 + 三个反例卡。 */
const SpineAnatomy: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const bads = [
    {n: 'PDF-Processing', why: '大写'},
    {n: '-pdf', why: '短横线打头'},
    {n: 'pdf--processing', why: '两条连写'},
  ];
  return (
    <div style={{display: 'flex', gap: 80, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
        <div
          style={{
            width: 110,
            height: 300,
            borderRadius: 8,
            background: `${theme.spine}22`,
            border: `2.5px solid ${theme.spine}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 26,
            gap: 10,
            writingMode: 'horizontal-tb',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, writingMode: 'vertical-rl', letterSpacing: 3}}>
            name: pdf-tools
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, writingMode: 'vertical-rl', maxHeight: 170}}>
            描述：做什么 · 什么时候用（≤1024 字符）
          </div>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.spine}}>书脊 = 名字 + 描述（两项必填）</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.danger}}>名字的三个反例</div>
        {bads.map((b, i) => {
          const p = progress(frame, at + i * 7, DUR.f4);
          return (
            <div
              key={b.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 18px',
                borderRadius: 8,
                border: `2px solid ${theme.danger}77`,
                background: `${theme.danger}10`,
                opacity: p,
                transform: `translateX(${(1 - p) * 24}px)`,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.danger}}>{b.n}</div>
              <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>✗ {b.why}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 2-C 名字 vs 格子标签逐字对齐。 */
const MatchRun: React.FC<{at: number; okAt: number}> = ({at, okAt}) => {
  const frame = useCurrentFrame();
  const name = 'pdf-tools';
  const chars = name.split('');
  const ok = useImpulse({at: okAt, dur: DUR.f4, peak: 1});
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 10}}>
        {chars.map((c, i) => {
          const p = progress(frame, at + i * 4, DUR.f3);
          return (
            <div
              key={i}
              style={{
                width: 54,
                height: 54,
                borderRadius: 8,
                border: `2px solid ${theme.spine}99`,
                background: `${theme.spine}${p > 0.6 ? '30' : '12'}`,
                color: theme.text,
                fontFamily: theme.mono,
                fontSize: 27,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: p,
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>书脊上的名字</div>
      <div style={{display: 'flex', gap: 10, transform: `scale(${1 + ok * 0.04})`}}>
        {chars.map((c, i) => {
          const p = progress(frame, at + 8 + i * 4, DUR.f3);
          return (
            <div
              key={i}
              style={{
                width: 54,
                height: 54,
                borderRadius: 8,
                border: `2px solid ${theme.book}99`,
                background: `${theme.book}${p > 0.6 ? '30' : '12'}`,
                color: theme.text,
                fontFamily: theme.mono,
                fontSize: 27,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: p,
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>格子标签（文件夹名）</div>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.ok,
            border: `2px solid ${theme.ok}99`,
            borderRadius: 10,
            padding: '8px 18px',
            opacity: ok > 0.1 ? 1 : 0.15,
          }}
        >
          ✓ 一字不差 → 唯一性白送
        </div>
      </div>
    </div>
  );
};

/** 2-D 借唯一性三连卡。 */
const ReasonSteps: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(3, {at, dur: DUR.f4, stride: 8});
  const steps = [
    ['同一柜子里', '不可能有两个同名格子', theme.spine],
    ['名字 = 格子标签', '文件系统的唯一性白送', theme.book],
    ['唯一的防撞名保证', '但只管得住同一个柜子', theme.danger],
  ];
  return (
    <div style={{display: 'flex', gap: 24}}>
      {steps.map(([h, b, c], i) => (
        <Panel key={h} accent={`${c}88`} style={{width: 340, padding: '22px 24px', opacity: st[i], transform: `translateY(${(1 - st[i]) * 26}px)`}}>
          <div style={{fontFamily: theme.serif, fontSize: 28, color: c}}>{h}</div>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.text, marginTop: 12, lineHeight: 1.5}}>{b}</div>
        </Panel>
      ))}
    </div>
  );
};

/** 2-E 附录拆分。 */
const AppendixSplit: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const tabs = ['scripts/ 脚本', 'references/ 参考资料', 'assets/ 模板'];
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div
        style={{
          width: 420,
          padding: '24px 28px',
          borderRadius: 10,
          background: theme.panel,
          border: `2px solid ${theme.book}77`,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.text,
          lineHeight: 1.8,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.book}}>SKILL.md 正文</div>
        <div style={{color: theme.dim}}>第一步…第二步…</div>
        <div style={{color: theme.ok}}>「返回非 200 时翻 references/api-errors.md」</div>
        <div style={{color: theme.dim, fontSize: 20}}>（引用只走一层）</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        {tabs.map((t, i) => {
          const p = progress(frame, at + i * 8, DUR.f4);
          return (
            <div
              key={t}
              style={{
                padding: '12px 22px',
                borderRadius: 8,
                border: `2px solid ${theme.book}88`,
                background: `${theme.book}14`,
                color: theme.book,
                fontFamily: theme.sans,
                fontSize: 24,
                opacity: p,
                transform: `translateX(${(1 - p) * 40}px)`,
              }}
            >
              {t}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 2-E 幕尾问句。 */
const HookQuestion: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f5);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 200, textAlign: 'center', opacity: o}}>
      <span style={{fontFamily: theme.serif, fontSize: 34, color: theme.spine}}>
        {'柜里装了几十本，AI 每次都得全读吗？'}
      </span>
    </div>
  );
};

export const P2Slot: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-09');
  const bC = w('p2-10', 'p2-13');
  const bD = w('p2-14', 'p2-18');
  const bE = w('p2-19', 'p2-22');
  const slots = [
    {label: 'pdf-tools', spine: 'pdf-tools'},
    {label: 'md-tables', spine: 'md-tables'},
    {label: 'code-review', spine: 'code-review'},
    {label: 'data-analysis', spine: 'data-analysis'},
    {label: 'meeting-notes', spine: 'meeting-notes'},
    {label: 'tool-06', spine: 'tool-06'},
    {label: 'tool-07', spine: 'tool-07'},
    {label: 'tool-08', spine: 'tool-08'},
    {label: 'tool-09', spine: 'tool-09'},
    {label: 'tool-10', spine: 'tool-10'},
    {label: 'tool-11', spine: 'tool-11'},
    {label: 'tool-12', spine: 'tool-12'},
  ];
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 手册柜正面">
        <SceneTag chapter="P2" tagline="一格一本" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')}]}>
          <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
            <CabinetGrid slots={slots} at={at('p2-01') - bA.from} />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="package-and-validation"
          caption="一个技能 = 一个文件夹"
          cues={[{chapterId: 'package', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')}]}
        />
        <Footnote delay={30}>技能说明文件 = 那本手册（SKILL.md）</Footnote>
      </Sequence>

      <Sequence {...bB} name="2-B 书脊与反例">
        <SceneTag chapter="P2" tagline="一格一本" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')}]}>
          <SpineAnatomy at={at('p2-05') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="package-and-validation"
          caption="两项必填：名字 + 描述"
          cues={[{chapterId: 'required', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')}]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 名字=格子标签">
        <SceneTag chapter="P2" tagline="一格一本" accent={theme.spine} />
        <ArchifyYield
          cues={[
            {at: at('p2-10') - bC.from, durationInFrames: dur('p2-10')},
            {at: at('p2-12') - bC.from, durationInFrames: dur('p2-12')},
          ]}
        >
          <MatchRun at={at('p2-10') - bC.from} okAt={at('p2-10') - bC.from + 26} />
        </ArchifyYield>
        <ArchifyRecap
          slug="package-and-validation"
          caption="名字必须等于文件夹名"
          cues={[
            {chapterId: 'name-rule', at: at('p2-10') - bC.from, durationInFrames: dur('p2-10')},
            {chapterId: 'optional', at: at('p2-12') - bC.from, durationInFrames: dur('p2-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 借唯一性">
        <SceneTag chapter="P2" tagline="一格一本" accent={theme.spine} />
        <Stage>
          <ReasonSteps at={at('p2-14') - bD.from} />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="2-E 附录拆分">
        <SceneTag chapter="P2" tagline="一格一本" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p2-21') - bE.from, durationInFrames: dur('p2-21')}]}>
          <AppendixSplit at={at('p2-19') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="package-and-validation"
          caption="长内容拆进附录，引用只走一层"
          cues={[{chapterId: 'to-prompt-gap', at: at('p2-21') - bE.from, durationInFrames: dur('p2-21')}]}
        />
        <HookQuestion at={at('p2-22') - bE.from + 10} />
      </Sequence>
    </AbsoluteFill>
  );
};
