/** P3 承重墙上的闸机＝M2（逐页验放·客体轴）+ M3（承重墙拓扑·定义出口轴）。
 *  两者正交：M2 失效 = 人当场看到明文；M3 失效 = 受限口径从别的门静默溜出。
 *  W6 起本幕 26 句全由 archify 图主控（PageScanner/3-D 对照台/代码走廊②/金句卡
 *  退役），自制件仅存 3-A① 母图推近、SignVsWall（岛 p3-10）、TwoLayers（岛
 *  p3-14/15）。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useImpulse, useProgress, useShake, useSpring} from '../motion';
import {NumberedCard, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, MechZoom, PillarHUD, Stage} from '../components/devices';

/** 3-C 木牌 vs 焊死承重墙。
 *
 *  四拍全部由句边界给出（铁律⑤）：木牌立起（p3-09）→ 被绕过、抖一下并压暗（p3-10）
 *  → 闸机焊入承重墙（p3-12）→ 三方共用执法点（p3-13）。
 *  `useShake` 必须带 `decay: true`，否则忽略 `dur` 会抖满整镜 22.9s；但只加 decay
 *  又会让本镜露出 11.8s 静止窗 —— 所以抖动改成「在被绕过的那一句上打一次」。 */
const SignVsWall: React.FC<{
  at: number;
  bypassAt: number;
  weldAt: number;
  shareAt: number;
}> = ({at, bypassAt, weldAt, shareAt}) => {
  const rise = useSpring('settle', {at, dur: DUR.f6});
  const shake = useShake({at: bypassAt, active: true, amp: 8, decay: true, dur: DUR.f6});
  const failed = useProgress(bypassAt + 6, DUR.f5);
  const wall = useSpring('settle', {at: weldAt, dur: DUR.f6});
  const share = useProgress(shareAt, DUR.f5);
  return (
    <div style={{display: 'flex', gap: 80, alignItems: 'flex-end'}}>
      <div
        style={{
          textAlign: 'center',
          opacity: rise * (1 - 0.45 * failed),
          transform: `translateX(${shake}px) rotate(${shake * 0.6 - 16 * failed}deg)`,
        }}
      >
        <div style={{fontSize: 92}}>🪧</div>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.danger, marginTop: 12}}>
          外挂木牌「请勿踩踏」
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>绕开侧门即失效</div>
      </div>
      <div style={{textAlign: 'center'}}>
        <div
          style={{
            width: 360,
            height: 200 * wall,
            borderRadius: 8,
            background: `${theme.engine}22`,
            border: `3px solid ${theme.engine}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            opacity: wall,
          }}
        >
          🛂
        </div>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.engine,
            marginTop: 12,
            opacity: wall,
          }}
        >
          焊死在承重墙里的闸机
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: share}}>
          人 / BI / AI 共用同一执法点
        </div>
      </div>
    </div>
  );
};

/** 3-E 双层防线：检索层藏起来 ≠ 执行层拦得住 */
const TwoLayers: React.FC<{at: number; bumpAt: number}> = ({at, bumpAt}) => {
  const hide = useProgress(at, DUR.f6);
  // bumpAt：第二层的强调要落在讲第二层的那句上，写死 at+26 会提前 13.5s 压在第一层句上
  const bump = useImpulse({at: bumpAt, dur: DUR.f6});
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 22, width: 1180}}>
      <Panel accent={theme.dim} style={{padding: '22px 28px', opacity: 1 - 0.3 * hide}}>
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          第一层 · 检索层过滤（体验）
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 6}}>
          前台悄悄藏起机密词条 —— 但只是<span style={{color: theme.danger}}>藏起来</span>
        </div>
      </Panel>
      <Panel
        accent={theme.engine}
        style={{
          padding: '22px 28px',
          transform: `scale(${1 + 0.03 * bump})`,
          boxShadow: `0 0 ${26 * bump}px ${theme.engine}66`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
          第二层 · 执行层拒绝（底线）
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.engine, marginTop: 6}}>
          猜出指标名强行发起 → 编译那一秒 AccessDenied
        </div>
      </Panel>
    </div>
  );
};

export const P3Gate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 与 at 对称的取长辅助：非 beat 用途一律走它，不写 w('句id') 字面形态——
  // check_script 的 SCENE_CALL_RE 只认字面量，写字面量会把镜内叠加层登记成镜区间
  // （本仓既有约定，见 claude-code-explained-video/P6Ending.tsx）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-08');
  const bC = w('p3-09', 'p3-13');
  const bD = w('p3-13a', 'p3-13c');
  const bE = w('p3-14', 'p3-18');
  const bF = w('p3-19', 'p3-22');
  const bG = w('p3-23', 'p3-26');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 逐页验放闸机">
        <SceneTag chapter="M2" tagline="闸机的逐页验放规则" accent={theme.engine} />
        <Sequence
          from={at('p3-01') - bA.from}
          durationInFrames={at('p3-03') - at('p3-01')}
          name="3-A① 母图推近 · 各层电梯厅验放闸"
        >
          <Stage top={320}>
            <MechZoom focus="gate" spanInFrames={at('p3-03') - at('p3-01')}>
              <NumberedCard
                index={2}
                label="行列级策略"
                sub="客体轴 · 逐页验放"
                active
                accent={theme.engine}
                width={430}
                delay={at('p3-02') - at('p3-01')}
              />
              <NumberedCard
                index={3}
                label="语义级治理"
                sub="拓扑轴 · 焊死执法点"
                active
                accent={theme.engine}
                width={430}
                delay={at('p3-02') - at('p3-01') + 10}
              />
            </MechZoom>
          </Stage>
        </Sequence>
        {/* 3-A① 嵌套子窗 p3-01..02 与本 cue(p3-01) 的关系已核对：卡片入场锚在 p3-02，
            排在 cue 窗外——cue 窗内母图被画框遮、窗尾卸载即「装置登场」 */}
        <ArchifyRecap
          slug="evolution-timeline"
          caption="三阶段演进"
          cues={[
            {chapterId: 'stage-governed-enrich', at: at('p3-01') - bA.from, durationInFrames: dur('p3-01')},
          ]}
        />
        <ArchifyRecap
          slug="row-column-policy"
          caption="查询期行列级策略"
          cues={[{chapterId: 'perpage', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')}]}
        />
        {/* 3-A② 扫描仪已退役（p3-04 正演句由图接管）；p3-03(perpage 末 cue)→p3-04
            背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="query-time-policy"
          caption="查询瞬间的逐页验放"
          lead={false}
          cues={[
            {chapterId: 'instant-inspection', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 打码扣留与代理识别">
        {/* PageScanner 已退役（05/07 打码扣留与代理句由图接管）。p3-04(上镜
            query-time-policy 末 cue)→p3-05 跨镜背靠背 → 本实例补 lead={false}
            （p3-07 空窗重现章的弹入随之一并抑制——窗外全程有他图覆盖，切口无瞬现）；
            p3-05→06 属他实例**非末** cue 的交错，query-time-policy 首章照常入场 */}
        <ArchifyRecap
          slug="row-column-policy"
          caption="策略对象族 · 代理严拒面"
          lead={false}
          cues={[
            {chapterId: 'family', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'agentface', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
          ]}
        />
        <ArchifyRecap
          slug="query-time-policy"
          caption="查询瞬间的逐页验放"
          cues={[
            {chapterId: 'agent-recognized', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 木牌与承重墙">
        <SceneTag chapter="M3" tagline="语义级治理：闸机焊死承重墙" accent={theme.engine} />
        {/* 模式 b：木牌立起→压暗、焊墙、三方共用是贯穿 p3-09..p3-13 的连续演出，
            嵌套子窗会把「同一个闸机」拆成两次 mount；窗=本镜双实例全部 4 条 cue 窗，
            可见岛仅 p3-10（木牌被绕过的 shake payoff） */}
        <ArchifyYield
          cues={[
            {at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')},
            {at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')},
            {at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')},
            {at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')},
          ]}
        >
          <Stage>
            <SignVsWall
              at={at('p3-09') - bC.from}
              bypassAt={at('p3-10') - bC.from}
              weldAt={at('p3-12') - bC.from}
              shareAt={at('p3-13') - bC.from}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="engine-governance"
          caption="语义级治理执行"
          cues={[{chapterId: 'sign-vs-wall', at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')}, {chapterId: 'governed-path', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')}]}
        />
        {/* p3-10 是 SignVsWall 岛句（无 cue）→ 本实例首章照常入场；p3-13 属本实例
            空窗后重现章（enters 自动恢复入场），p3-12→13 背靠背无需处理 */}
        <ArchifyRecap
          slug="one-checkpoint"
          caption="三流合一执法点"
          cues={[
            {chapterId: 'sign-vs-wall', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')},
            {chapterId: 'shared-checkpoint', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 两种坏法对照台与出门行李标签">
        {/* 对照台+行李标签已退役（13a/13b/13c 全句由图接管）。p3-13(one-checkpoint
            末 cue)→p3-13a 跨镜背靠背 → 本实例补 lead={false} */}
        <ArchifyRecap
          slug="governance-demolition"
          caption="治理破坏台"
          lead={false}
          cues={[
            {chapterId: 'remove-mask', at: at('p3-13a') - bD.from, durationInFrames: dur('p3-13a')},
            {chapterId: 'wrong-placement', at: at('p3-13b') - bD.from, durationInFrames: dur('p3-13b')},
          ]}
        />
        {/* p3-13b→p3-13c 背靠背：跨实例必须 lead={false}，否则换图重放入场弹簧 */}
        <ArchifyRecap
          slug="open-interop"
          caption="开放互操作"
          lead={false}
          cues={[
            {chapterId: 'portable', at: at('p3-13c') - bD.from, durationInFrames: dur('p3-13c')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="3-E 双层防线剖面">
        {/* 模式 b：第一层 hide 状态从 p3-15 贯穿到镜尾，双层剖面是同一面墙；窗=本镜
            双实例全部 3 条 cue 窗，可见岛 p3-14/15（p3-18 的 bump 落在窗内随让位
            淡出——第二层的强调已由 impenetrable 图接管） */}
        <ArchifyYield
          cues={[
            {at: at('p3-16') - bE.from, durationInFrames: dur('p3-16')},
            {at: at('p3-17') - bE.from, durationInFrames: dur('p3-17')},
            {at: at('p3-18') - bE.from, durationInFrames: dur('p3-18')},
          ]}
        >
          <Stage>
            <TwoLayers at={at('p3-15') - bE.from} bumpAt={at('p3-18') - bE.from} />
          </Stage>
        </ArchifyYield>
        <EvidenceBadge grade="lab" at={at('p3-17') - bE.from} />
        <ArchifyRecap
          slug="engine-governance"
          caption="语义级治理"
          cues={[
            {chapterId: 'two-layer-defense', at: at('p3-16') - bE.from, durationInFrames: dur('p3-16')},
          ]}
        />
        {/* p3-15 是 TwoLayers 岛句（无 cue）；p3-16(two-layer-defense 末 cue)→p3-17
            背靠背跨实例 → lead={false} */}
        <ArchifyRecap
          slug="forced-query-intercept"
          caption="猜名强查执行层拦截"
          lead={false}
          cues={[
            {chapterId: 'guessed-name', at: at('p3-17') - bE.from, durationInFrames: dur('p3-17')},
            {chapterId: 'impenetrable', at: at('p3-18') - bE.from, durationInFrames: dur('p3-18')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="3-F 代码走廊② 执行层拒绝">
        {/* 代码走廊②已退役（19..22 全句由图接管）。p3-18(上镜 impenetrable 末 cue)→
            p3-19 跨镜背靠背 → intercepted 续章实例 lead={false}；p3-19→20、20→21 亦
            跨实例背靠背 → 后两实例同；p3-21→22 同实例连续换章由 enters 抑制 */}
        <ArchifyRecap
          slug="forced-query-intercept"
          caption="猜名强查执行层拦截"
          lead={false}
          cues={[
            {chapterId: 'intercepted', at: at('p3-19') - bF.from, durationInFrames: dur('p3-19')},
          ]}
        />
        <ArchifyRecap
          slug="governance-demolition"
          caption="治理破坏台"
          lead={false}
          cues={[
            {chapterId: 'rbac-ablation', at: at('p3-20') - bF.from, durationInFrames: dur('p3-20')},
          ]}
        />
        <ArchifyRecap
          slug="hidden-vs-blocked"
          caption="藏起来不等于拦得住"
          lead={false}
          cues={[
            {chapterId: 'teardown-leak', at: at('p3-21') - bF.from, durationInFrames: dur('p3-21')},
            {chapterId: 'hide-not-block', at: at('p3-22') - bF.from, durationInFrames: dur('p3-22')},
          ]}
        />
        <EvidenceBadge grade="lab" />
      </Sequence>

      <Sequence {...bG} name="3-G 编译期安全锁与收束金句">
        {/* 金句卡已退役（23..26 全句由图接管）。p3-22(上镜 hide-not-block 末 cue)→
            p3-23 跨镜背靠背 → lead={false}；p3-25 是 engine-governance 首章、前句
            p3-24 属本实例非末 cue（双图交错），照常入场；p3-26 空窗重现章的弹入随
            lead={false} 一并抑制——窗外有他图覆盖，切口无瞬现 */}
        <ArchifyRecap
          slug="compile-time-block"
          caption="编译那一秒的拦截"
          lead={false}
          cues={[
            {chapterId: 'ux-vs-lifeline', at: at('p3-23') - bG.from, durationInFrames: dur('p3-23')},
            {chapterId: 'no-backdoor', at: at('p3-24') - bG.from, durationInFrames: dur('p3-24')},
            {chapterId: 'compile-second', at: at('p3-26') - bG.from, durationInFrames: dur('p3-26')},
          ]}
        />
        <ArchifyRecap
          slug="engine-governance"
          caption="绕行仍被引擎拦截"
          cues={[
            {chapterId: 'bypass-intercepted', at: at('p3-25') - bG.from, durationInFrames: dur('p3-25')},
          ]}
        />
        <PillarHUD lit={3} at={at('p3-26') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
