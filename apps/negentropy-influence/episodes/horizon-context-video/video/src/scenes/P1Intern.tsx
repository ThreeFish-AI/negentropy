/** P1 每天重新入职的天才（p1-01..25）——guided-learn Phase 1「全貌解剖」：
 *  先给总类比与因果链，再给七机制全景；**任何单个机制都还没开始讲**。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {PillarHUD, Stage} from '../components/devices';

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

export const P1Intern: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-07');
  const bB = w('p1-08', 'p1-15');
  const bC = w('p1-16', 'p1-21');
  const bD = w('p1-22', 'p1-24');
  const bE = w('p1-25');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 失忆实习生记忆条">
        <SceneTag chapter="P1" tagline="每天重新入职的天才" accent={theme.engine} />
        {/* 模式 b：记忆柱攒满/清零是跨句连续状态（clearAts 贯穿 p1-03..07），拆子窗会断相；
            可见岛 p1-01/03/04/05，窗=amnesia-intern 两窗 + three-lesions 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')},
            {at: at('p1-06') - bA.from, durationInFrames: dur('p1-06')},
            {at: at('p1-07') - bA.from, durationInFrames: dur('p1-07')},
          ]}
        >
          <Stage>
            <MemoryReset
              clearAts={['p1-03', 'p1-04', 'p1-05', 'p1-06', 'p1-07'].map(
                (id) => at(id) - bA.from,
              )}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="amnesia-intern"
          caption="失忆实习生"
          cues={[
            {chapterId: 'daily-reset', at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')},
            {chapterId: 'dark-guess', at: at('p1-06') - bA.from, durationInFrames: dur('p1-06')},
          ]}
        />
        {/* p1-06(dark-guess)→p1-07 背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="mechanism-experiment-matrix"
          caption="七机制×十次拆坏"
          lead={false}
          cues={[
            {chapterId: 'three-lesions', at: at('p1-07') - bA.from, durationInFrames: dur('p1-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 三病灶 + 病因链回放">
        {/* ThreeLesions 已退役（p1-08..14 全部入 cue，仅 p1-15 空档无装置） */}
        <ArchifyRecap
          slug="problem-to-mechanisms"
          caption="病因链与机制对位"
          cues={[
            {chapterId: 'cause-chain', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
            {chapterId: 'encircle-pierce', at: at('p1-14') - bB.from, durationInFrames: dur('p1-14')},
          ]}
        />
        <ArchifyRecap
          slug="caliber-clash"
          caption="口径打架"
          lead={false}
          cues={[
            {chapterId: 'twenty-algorithms', at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')},
            {chapterId: 'owners-clash', at: at('p1-10') - bB.from, durationInFrames: dur('p1-10')},
          ]}
        />
        {/* p1-10(owners-clash)→p1-11 背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="dictionary-drift"
          caption="外挂词典的漂移一生"
          lead={false}
          cues={[
            {chapterId: 'dict-outside', at: at('p1-11') - bB.from, durationInFrames: dur('p1-11')},
            {chapterId: 'schema-changed', at: at('p1-12') - bB.from, durationInFrames: dur('p1-12')},
            {chapterId: 'stale-manual', at: at('p1-13') - bB.from, durationInFrames: dur('p1-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 命名帧与官方三句">
        {/* OfficialLadder 已退役（p1-18..20 由 three-claims-stack 图接管）。
            p1-21(downgraded-lane) 是本实例空窗后重现，enters 自动恢复入场。 */}
        <ArchifyRecap
          slug="problem-to-mechanisms"
          caption="铸入引擎 · 机制对位"
          cues={[
            {chapterId: 'engine-cast', at: at('p1-16') - bC.from, durationInFrames: dur('p1-16')},
            {chapterId: 'answer-ledger', at: at('p1-17') - bC.from, durationInFrames: dur('p1-17')},
            {chapterId: 'downgraded-lane', at: at('p1-21') - bC.from, durationInFrames: dur('p1-21')},
          ]}
        />
        {/* p1-17(answer-ledger)→p1-18 背靠背跨实例 → lead={false}；后接 p1-20→21
            背靠背，但 p1-21 属先挂载实例的空窗重现（enters 自动入场），无需再处理 */}
        <ArchifyRecap
          slug="three-claims-stack"
          caption="官方三句递进"
          lead={false}
          cues={[
            {chapterId: 'guess-only', at: at('p1-18') - bC.from, durationInFrames: dur('p1-18')},
            {chapterId: 'native-act', at: at('p1-19') - bC.from, durationInFrames: dur('p1-19')},
            {chapterId: 'governed-trust', at: at('p1-20') - bC.from, durationInFrames: dur('p1-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 带教大厦剖面 + 组件全景">
        {/* p1-22/24 背靠背全句入 cue（p1-23 是跳号句，无空档）——剖面装置退役，
            大厦剖面母图由 P3 3-A① 的 MechZoom 推近与 PillarHUD 承担
            （P4/P5 同款嵌套已随全屏化一并退役） */}
        <ArchifyRecap
          slug="component-panorama"
          caption="组件全景 · 四簇"
          cues={[
            {chapterId: 'caliber-spine', at: at('p1-22') - bD.from, durationInFrames: dur('p1-22')},
            {chapterId: 'consumer-feed', at: at('p1-24') - bD.from, durationInFrames: dur('p1-24')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 七格承重列 HUD 首亮">
        {/* 装置 yield p1-25（本镜单句=全镜让位）；PillarHUD 按纪律保持在 wrapper 外 */}
        <ArchifyYield
          cues={[{at: at('p1-25') - bE.from, durationInFrames: dur('p1-25')}]}
        >
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
        </ArchifyYield>
        <PillarHUD lit={0} />
        {/* p1-24(consumer-feed, 1-D)→p1-25 跨镜背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="mechanism-experiment-matrix"
          caption="七机制×十次拆坏"
          lead={false}
          cues={[
            {chapterId: 'ten-teardowns', at: at('p1-25') - bE.from, durationInFrames: dur('p1-25')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
