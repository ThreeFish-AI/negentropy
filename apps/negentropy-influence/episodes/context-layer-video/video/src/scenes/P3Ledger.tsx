/** P3 总账与双轨（p3-01..26）——目录层 M5 台账 + ADR-1 逻辑视图 + 富化层双轨与冲突契约。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useCount, useProgress, useReveal, useShake, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, PillarHUD} from '../components/devices';

/** 3-B 导览图 vs 复制库房：逻辑视图防脑裂对比台 + 四层信号旗。 */
const ViewVsCopy: React.FC<{at: number; flagAt: number}> = ({at, flagAt}) => {
  const left = useProgress(at, DUR.f6);
  const right = useSpring('settle', {at: at + 14, dur: DUR.f6});
  const flags = useStagger(4, {at: flagAt, stride: 7, dur: DUR.f4});
  const sig = ['结构 · 有什么怎么连', '运行 · 查询与新鲜度', '语义 · 定义与指标', '行为 · 热度与用法'];
  return (
    <div style={{paddingTop: 80, paddingLeft: 150}}>
      <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
        <div style={{opacity: left, width: 430, padding: '22px 26px', borderRadius: 12, border: `2px solid ${theme.blueprint}`, background: `${theme.blueprint}0C`}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.blueprint}}>全楼导览图（逻辑视图）</div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>只放目录卡和指路牌，指回原处</div>
        </div>
        <div style={{fontSize: 40}}>vs</div>
        <div style={{opacity: right, transform: `translateY(${(1 - right) * 14}px)`, width: 430, padding: '22px 26px', borderRadius: 12, border: `2px dashed ${theme.danger}`, background: `${theme.danger}0A`}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.danger}}>楼外复制库房（物理复制）</div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 6}}>同一事实两份 → 谁新谁旧？脑裂</div>
        </div>
      </div>
      <div style={{display: 'flex', gap: 26, marginTop: 70}}>
        {sig.map((s, i) => (
          <div key={s} style={{opacity: flags[i], padding: '10px 18px', borderRadius: 999, border: `1px solid ${theme.grown}55`, fontFamily: theme.sans, fontSize: 17, color: theme.grown}}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 3-C 双轨两角色 + <5% 覆盖数字。 */
const TwinTrack: React.FC<{at: number; pctAt: number}> = ({at, pctAt}) => {
  const s1 = useSpring('settle', {at, dur: DUR.f5});
  const s2 = useSpring('settle', {at: at + 10, dur: DUR.f5});
  const pct = useCount({from: 100, to: 5, at: pctAt, dur: DUR.f6});
  const o = useProgress(pctAt - 4, DUR.f5);
  const role = (t: number, emoji: string, zh: string, sub: string, c: string) => (
    <div style={{opacity: t, transform: `translateY(${(1 - t) * 18}px)`, width: 400, padding: '22px 28px', borderRadius: 14, border: `2px solid ${c}66`, background: `${c}0C`, textAlign: 'center'}}>
      <div style={{fontSize: 52}}>{emoji}</div>
      <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, marginTop: 6}}>{zh}</div>
      <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 4}}>{sub}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', gap: 60, justifyContent: 'center', alignItems: 'center', paddingTop: 110}}>
      {role(s1, '🖨️', '速记秘书 · 显式轨', 'Autopilot · 把现成报表起草成规章', theme.grown)}
      {role(s2, '🔭', '见习助教 · 隐式轨', 'Cortex Sense · 从查询习惯偷师，不碰数据行', theme.blueprint)}
      <div style={{opacity: o, textAlign: 'center', padding: '18px 30px', borderRadius: 12, border: `2px solid ${theme.danger}55`, background: `${theme.danger}0A`}}>
        <div style={{fontFamily: theme.mono, fontSize: 56, color: theme.danger}}>&lt;{Math.round(pct)}%</div>
        <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>人工覆盖 · 9,685 张表</div>
        <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>Snowflake 内部实测</div>
      </div>
    </div>
  );
};

/** 3-D CONFLICT 听证卡：并列两定义、数字栏刻意留白、拒答待裁。 */
const ConflictCard: React.FC<{at: number; shakeAt: number}> = ({at, shakeAt}) => {
  const o = useProgress(at, DUR.f5);
  const blank = useReveal('数值：＿＿＿＿（留白等人裁决）', {at: at + 16, cps: 10});
  const shake = useShake({at: shakeAt, dur: DUR.f4, amp: 7});
  return (
    <div style={{transform: `translateX(${shake}px)`, display: 'flex', justifyContent: 'center', paddingTop: 110, opacity: o}}>
      <div style={{width: 760, borderRadius: 16, border: `2px solid ${theme.danger}`, background: theme.panel, overflow: 'hidden'}}>
        <div style={{padding: '12px 24px', background: `${theme.danger}18`, fontFamily: theme.sans, fontSize: 20, color: theme.danger, letterSpacing: 1}}>
          CONFLICT · needs_adjudication · 拒答待裁
        </div>
        <div style={{display: 'flex'}}>
          <div style={{flex: 1, padding: '20px 24px', borderRight: `1px solid ${theme.panelBorder}`}}>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.grown}}>governed · authority 1.0</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, marginTop: 6}}>count_distinct(orders.customer_id)</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 4}}>人工审过 · 数客户</div>
          </div>
          <div style={{flex: 1, padding: '20px 24px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.blueprint}}>inferred · authority &lt;1.0</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, marginTop: 6}}>count(events.id) by total</div>
            <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 4}}>日志拼装 · 数事件</div>
          </div>
        </div>
        <div style={{padding: '18px 24px', borderTop: `1px dashed ${theme.danger}66`, textAlign: 'center', fontFamily: theme.mono, fontSize: 26, color: theme.danger, letterSpacing: 4}}>
          {blank}
        </div>
      </div>
    </div>
  );
};

export const P3Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-07');
  const bB = w('p3-08', 'p3-11');
  const bC = w('p3-12', 'p3-18');
  const bD = w('p3-19', 'p3-24');
  const bE = w('p3-25', 'p3-26');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 机房出入库台账 · 代码走廊⑤">
        <SceneTag chapter="P3" tagline="总账与双轨" accent={theme.blueprint} />
        <ArchifyRecap
          slug="collect-phase"
          caption="汇聚 → 统一目录"
          cues={[
            {chapterId: 'collect', at: at('p3-01') - bA.from, durationInFrames: dur('p3-01')},
            {chapterId: 'open', at: at('p3-06') - bA.from, durationInFrames: dur('p3-06')},
          ]}
        />
        <div style={{position: 'absolute', left: 430, top: 640, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D8: 拆血缘解析闸 → 虚构对象入账（raw.y→ghost.x）', color: theme.danger, at: at('p3-07') - bA.from},
            ]}
            caption="lab D8 · 台账脱钩实验"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={1} at={-30} />
      </Sequence>

      <Sequence {...bB} name="3-B 导览图与四信号">
        <SceneTag chapter="P3" tagline="总账与双轨" accent={theme.blueprint} />
        <ViewVsCopy at={at('p3-08') - bB.from} flagAt={at('p3-11') - bB.from} />
        <PillarHUD lit={1} at={-30} />
      </Sequence>

      <Sequence {...bC} name="3-C 双轨两角色">
        <SceneTag chapter="P3" tagline="总账与双轨" accent={theme.grown} />
        <ArchifyYield
          cues={[
            {at: at('p3-15') - bC.from, durationInFrames: dur('p3-15')},
            {at: at('p3-16') - bC.from, durationInFrames: dur('p3-16')},
            {at: at('p3-17') - bC.from, durationInFrames: dur('p3-18')},
          ]}
        >
          <TwinTrack at={at('p3-12') - bC.from} pctAt={at('p3-13') - bC.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="collect-phase"
          caption="富化现状"
          cues={[{chapterId: 'enrich', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')}]}
        />
        <ArchifyRecap
          slug="architecture"
          caption="双轨编纂 + eval 自纠环"
          lead={false}
          cues={[
            {chapterId: 'explicit', at: at('p3-15') - bC.from, durationInFrames: dur('p3-15')},
            {chapterId: 'implicit', at: at('p3-16') - bC.from, durationInFrames: dur('p3-16')},
            {chapterId: 'eval', at: at('p3-17') - bC.from, durationInFrames: dur('p3-17')},
          ]}
        />
        <EvidenceBadge grade="vendor" />
        <PillarHUD lit={1} at={-30} />
      </Sequence>

      <Sequence {...bD} name="3-D 冲突听证 · 代码走廊⑥">
        <SceneTag chapter="P3" tagline="总账与双轨" accent={theme.danger} />
        <ArchifyYield cues={[{at: at('p3-21') - bD.from, durationInFrames: dur('p3-21')}]}>
          <ConflictCard at={at('p3-19') - bD.from} shakeAt={at('p3-22') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="object-lifecycle"
          caption="conflict 岔道"
          cues={[{chapterId: 'conflict', at: at('p3-21') - bD.from, durationInFrames: dur('p3-21')}]}
        />
        <div style={{position: 'absolute', left: 430, top: 640, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D4: 冲突改 auto_popularity → 错误口径胜出 [6,1,2]（对照 [3,1,2]）', color: theme.danger, at: at('p3-22') - bD.from},
            ]}
            caption="lab D4 · 自动选反事实"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={1} at={-30} />
      </Sequence>

      <Sequence {...bE} name="3-E 口诀收束">
        <SceneTag chapter="P3" tagline="总账与双轨" accent={theme.grown} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', fontFamily: theme.serif, fontSize: 40, color: theme.text, letterSpacing: 4}}>
          台账记流水 · 双轨养含义 · 冲突人裁决
        </div>
        <Footnote delay={30}>裁决权永远在人类手里</Footnote>
        <PillarHUD lit={3} at={8} />
      </Sequence>
    </AbsoluteFill>
  );
};
