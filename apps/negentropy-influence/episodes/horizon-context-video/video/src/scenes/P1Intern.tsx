/** P1 每天重新入职的天才（p1-01..25）——guided-learn Phase 1「全貌解剖」：
 *  先给总类比与因果链，再给七机制全景；**任何单个机制都还没开始讲**。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useStagger} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {BuildingSection, PillarHUD, Stage} from '../components/devices';

/** 1-A 记忆条逐日清零。
 *
 *  每根柱子「整句攒满 → 句边界清零」：第 i 根在 [clearAts[i-1], clearAts[i]] 窗口内
 *  匀速涨满，到 clearAts[i] 被 3 帧抹平。清零点由 p1-03..p1-07 的句边界给出（铁律⑤），
 *  同一时刻恒有一根在涨 —— 既让「填满」真的读得出来，也不留整段静止。 */
const MemoryReset: React.FC<{clearAts: readonly number[]}> = ({clearAts}) => {
  const frame = useCurrentFrame();
  const days = ['周一', '周二', '周三', '周四', '周五'];
  return (
    <div style={{display: 'flex', gap: 30, alignItems: 'flex-end'}}>
      {days.map((d, i) => {
        const from = i === 0 ? 0 : clearAts[i - 1];
        const at = clearAts[i];
        const fill = progress(frame, from, at - from);
        const wipe = progress(frame, at, DUR.f2);
        const level = Math.max(0, fill - wipe);
        return (
          <div key={d} style={{textAlign: 'center'}}>
            <div
              style={{
                width: 110,
                height: 180,
                borderRadius: 8,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                display: 'flex',
                alignItems: 'flex-end',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${level * 100}%`,
                  background: `${theme.engine}99`,
                }}
              />
            </div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
              {d}
            </div>
          </div>
        );
      })}
      <div style={{marginLeft: 28, maxWidth: 460}}>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, lineHeight: 1.5}}>
          每天推门上班，
          <span style={{color: theme.danger}}>记忆全部清零</span>
        </div>
      </div>
    </div>
  );
};

/** 1-B 三病灶裂纹 */
const ThreeLesions: React.FC<{ats: readonly number[]}> = ({ats}) => {
  const frame = useCurrentFrame();
  const ps = ats.map((a) => progress(frame, a, DUR.f6));
  const items = [
    {t: '口径打架', s: '同一指标，二十个看板二十种算法', c: theme.danger},
    {t: '定义漂移', s: '外挂词典与底层分家，表一改就失效', c: theme.manual},
    {t: '门禁穿透', s: '规则贴在看板上，拦不住直查底表', c: theme.dig},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, width: 900}}>
      {items.map((it, i) => (
        <Panel
          key={it.t}
          accent={it.c}
          style={{
            padding: '22px 28px',
            opacity: ps[i],
            transform: `translateX(${(1 - ps[i]) * -26}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 32, color: it.c, fontWeight: 600}}>
            {`病灶 ${'①②③'[i]} · ${it.t}`}
          </div>
          <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            {it.s}
          </div>
        </Panel>
      ))}
    </div>
  );
};

/** 1-C 官方三句递进阶梯（英文原句只进角标） */
const OfficialLadder: React.FC<{at?: number}> = ({at = 0}) => {
  const ps = useStagger(3, {at, stride: 14, dur: DUR.f6});
  const rows = [
    {zh: '没有上下文，智能体只能瞎猜', en: 'Without context, an agent guesses.', c: theme.dim},
    {zh: '上下文原生植入平台，智能体才能真正行动', en: '…an agent acts.', c: theme.engine},
    {zh: '上下文也被严格治理，智能体才值得信任', en: '…an agent can be trusted.', c: theme.manual},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: 1180}}>
      {rows.map((r, i) => (
        <div
          key={r.zh}
          style={{
            marginLeft: i * 64,
            padding: '20px 28px',
            borderRadius: 10,
            border: `2px solid ${r.c}`,
            background: `${r.c}12`,
            opacity: ps[i],
            transform: `translateY(${(1 - ps[i]) * 16}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>{r.zh}</div>
          <div style={{marginTop: 6, fontFamily: theme.mono, fontSize: 19, color: r.c, opacity: 0.85}}>
            {r.en}
          </div>
        </div>
      ))}
    </div>
  );
};

export const P1Intern: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const bA = w('p1-01', 'p1-07');
  const bB = w('p1-08', 'p1-15');
  const bC = w('p1-16', 'p1-21');
  const bD = w('p1-22', 'p1-24');
  const bE = w('p1-25');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 失忆实习生记忆条">
        <SceneTag chapter="P1" tagline="每天重新入职的天才" accent={theme.engine} />
        <Stage top={280}>
          <MemoryReset
            clearAts={['p1-03', 'p1-04', 'p1-05', 'p1-06', 'p1-07'].map(
              (id) => at(id) - bA.from,
            )}
          />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="1-B 三病灶 + 病因链回放">
        <Stage top={370}>
          <ThreeLesions
            ats={[
              at('p1-08') - bB.from,
              at('p1-11') - bB.from,
              at('p1-14') - bB.from,
            ]}
          />
        </Stage>
        <ArchifyRecap
          slug="problem-to-mechanisms"
          caption="病因链与机制对位"
          variant="inset"
          cues={[
            {chapterId: 'cause-chain', at: at('p1-08') - bB.from, durationInFrames: w('p1-08').durationInFrames},
            {chapterId: 'encircle-pierce', at: at('p1-14') - bB.from, durationInFrames: w('p1-14').durationInFrames},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 命名帧与官方三句">
        <ArchifyRecap
          slug="problem-to-mechanisms"
          caption="铸入引擎 · 机制对位"
          cues={[
            {chapterId: 'engine-cast', at: at('p1-16') - bC.from, durationInFrames: w('p1-16').durationInFrames},
            {chapterId: 'answer-ledger', at: at('p1-17') - bC.from, durationInFrames: w('p1-17').durationInFrames},
            {chapterId: 'downgraded-lane', at: at('p1-21') - bC.from, durationInFrames: w('p1-21').durationInFrames},
          ]}
        />
        <Sequence
          from={at('p1-18') - bC.from}
          durationInFrames={w('p1-18', 'p1-20').durationInFrames}
          name="1-C 官方三句阶梯"
        >
          <Stage top={250}>
            <OfficialLadder />
          </Stage>
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="1-D 带教大厦剖面 + 组件全景">
        <Stage top={360}>
          <BuildingSection at={0} scale={0.82} />
        </Stage>
        <ArchifyRecap
          slug="component-panorama"
          caption="组件全景 · 四簇"
          variant="inset"
          cues={[
            {chapterId: 'caliber-spine', at: at('p1-22') - bD.from, durationInFrames: w('p1-22').durationInFrames},
            {chapterId: 'consumer-feed', at: at('p1-24') - bD.from, durationInFrames: w('p1-24').durationInFrames},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 七格承重列 HUD 首亮">
        <Stage top={300}>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 56,
              color: theme.text,
              textAlign: 'center',
            }}
          >
            七大承重机制
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
            接下来一层层拆解，每一条都当场拆坏给你看
          </div>
        </Stage>
        <PillarHUD lit={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
