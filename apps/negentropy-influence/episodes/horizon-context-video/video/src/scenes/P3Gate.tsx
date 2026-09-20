/** P3 承重墙上的闸机＝M2（逐页验放·客体轴）+ M3（承重墙拓扑·定义出口轴）。
 *  两者正交：M2 失效 = 人当场看到明文；M3 失效 = 受限口径从别的门静默溜出。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {clamp01, DUR, progress, useImpulse, useProgress, useShake, useSpring} from '../motion';
import {NumberedCard, Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, MechZoom, PillarHUD, SplitCompare, Stage} from '../components/devices';

const ROWS = [
  {name: '张明', plan: 'ENTERPRISE', phone: '138****2041', amt: '¥ 90'},
  {name: '李静', plan: 'PRO', phone: '139****7788', amt: '¥ 560'},
  {name: '王磊', plan: 'FREE', phone: '137****3120', amt: '¥ 24'},
];

/** 行距（几何量，非时点）——`verdict` 的逐行时机由扫描条 y 与它换算，不另立时间源 */
const ROW_PITCH = 86;

/** 3-A/3-B 逐页验放扫描仪：同一装置演两遍。
 *
 *  省略 `maskAt`/`holdAt` = 3-A 的「正演一次」：扫描线横扫、逐行亮放行章，不打码不扣留；
 *  两者都给 = 3-B 的「拆一次 / 坏给你看」。两镜用同一个 `Stage top`，让跨镜的装置落在
 *  同一像素位置（planning §三 硬纪律「每个装置演三遍」）。
 *  `verdict` 刻意**不带独立时点**：逐行放行完全由扫描条自身位置派生，避免同一事件出现
 *  第二个可失配的真值源。 */
const PageScanner: React.FC<{
  scanAt: number;
  scanSpan: number;
  maskAt?: number;
  holdAt?: number;
  verdict?: boolean;
}> = ({scanAt, scanSpan, maskAt, holdAt, verdict = false}) => {
  const frame = useCurrentFrame();
  const scan = useProgress(scanAt, scanSpan, 'linear');
  return (
    <div style={{position: 'relative', width: 1180}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: 3,
          background: theme.engine,
          boxShadow: `0 0 18px ${theme.engine}`,
          transform: `translateY(${scan * 300}px)`,
        }}
      />
      {ROWS.map((r, i) => {
        const masked = maskAt === undefined ? 0 : progress(frame, maskAt + i * 3, DUR.f4);
        const held = holdAt !== undefined && i === 0 ? progress(frame, holdAt, DUR.f4) : 0;
        const pass = verdict
          ? clamp01((scan * 300 - (i * ROW_PITCH + ROW_PITCH / 2)) / 18)
          : 0;
        return (
          <div
            key={r.name}
            style={{
              display: 'flex',
              gap: 26,
              alignItems: 'center',
              padding: '18px 26px',
              marginBottom: 12,
              borderRadius: 10,
              border: `2px solid ${
                held > 0.4 ? theme.danger : pass > 0.5 ? theme.engine : theme.panelBorder
              }`,
              background:
                held > 0.4 ? `${theme.danger}14` : pass > 0.5 ? `${theme.engine}12` : theme.panel,
              fontFamily: theme.mono,
              fontSize: 28,
              color: theme.text,
              opacity: 1 - 0.55 * held,
              transform: `translateX(${held * 60}px)`,
            }}
          >
            <span style={{width: 100}}>{r.name}</span>
            <span style={{width: 220, color: theme.dim}}>{r.plan}</span>
            <span style={{width: 260, color: masked > 0.5 ? theme.dim : theme.text}}>
              {masked > 0.5 ? '███████████' : r.phone}
            </span>
            <span style={{width: 140}}>{r.amt}</span>
            {held > 0.4 ? (
              <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.danger}}>越权行已扣留</span>
            ) : null}
            {pass > 0 && held <= 0.4 ? (
              <span
                style={{fontFamily: theme.sans, fontSize: 22, color: theme.engine, opacity: pass}}
              >
                实时核验 · 放行
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

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
        <ArchifyRecap
          slug="row-column-policy"
          caption="查询期行列级策略"
          cues={[{chapterId: 'perpage', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')}]}
        />
        {/* top 与 3-B 同值：正演一次与拆一次落在同一像素位置，读成同一个装置 */}
        <Sequence
          from={at('p3-04') - bA.from}
          durationInFrames={dur('p3-04')}
          name="3-A② 逐页验放扫描仪 · 正演一次"
        >
          <Stage top={360}>
            <PageScanner scanAt={0} scanSpan={dur('p3-04')} verdict />
          </Stage>
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="3-B 打码扣留与代理识别">
        <Stage top={430}>
          <PageScanner
            scanAt={at('p3-05') - bB.from}
            scanSpan={DUR.f6}
            maskAt={at('p3-05') - bB.from}
            holdAt={at('p3-05') - bB.from + 14}
          />
        </Stage>
        <ArchifyRecap
          slug="row-column-policy"
          caption="策略对象族 · 代理严拒面"
          variant="inset"
          cues={[
            {chapterId: 'family', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'agentface', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 木牌与承重墙">
        <SceneTag chapter="M3" tagline="语义级治理：闸机焊死承重墙" accent={theme.engine} />
        <Stage top={430}>
          <SignVsWall
            at={at('p3-09') - bC.from}
            bypassAt={at('p3-10') - bC.from}
            weldAt={at('p3-12') - bC.from}
            shareAt={at('p3-13') - bC.from}
          />
        </Stage>
        <ArchifyRecap
          slug="engine-governance"
          caption="语义级治理执行"
          variant="inset"
          cues={[{chapterId: 'sign-vs-wall', at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')}, {chapterId: 'governed-path', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')}]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 两种坏法对照台与出门行李标签">
        <Stage top={430}>
          <SplitCompare
            at={at('p3-13a') - bD.from}
            left={{title: '拆掉验放规则（M2 失效）', body: '人当场看到不该看的明文', tone: theme.danger}}
            right={{title: '闸机装错地方（M3 失效）', body: '受限口径从别的门静悄悄溜出去', tone: theme.manual}}
          />
          <Panel accent={theme.engine} style={{marginTop: 34, padding: '22px 30px', width: 1180}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
              🧳 出门行李标签：数据被共享出楼，策略标签也一路跟着走
            </span>
          </Panel>
        </Stage>
        <ArchifyRecap
          slug="governance-demolition"
          caption="治理破坏台"
          variant="inset"
          cues={[
            {chapterId: 'remove-mask', at: at('p3-13a') - bD.from, durationInFrames: dur('p3-13a')},
            {chapterId: 'wrong-placement', at: at('p3-13b') - bD.from, durationInFrames: dur('p3-13b')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="3-E 双层防线剖面">
        <Stage top={430}>
          <TwoLayers at={at('p3-15') - bE.from} bumpAt={at('p3-18') - bE.from} />
        </Stage>
        <EvidenceBadge grade="lab" at={at('p3-17') - bE.from} />
        <ArchifyRecap
          slug="engine-governance"
          caption="语义级治理"
          variant="inset"
          cues={[
            {chapterId: 'two-layer-defense', at: at('p3-16') - bE.from, durationInFrames: dur('p3-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="3-F 代码走廊② 执行层拒绝">
        <Stage top={430}>
          <CodeWalk
            title="M2 执行面 · 查询编译期的 RBAC 拒绝"
            lines={[
              'def compile_query(view, metric_name, ..., enforce_rbac=True):',
              '    if enforce_rbac:',
              '        if metric.visibility == "PRIVATE" and role not in ALLOWED:',
              '            raise AccessDenied(f"metric {metric_name} is PRIVATE")',
            ]}
            hi={[{line: 1, at: 16, color: theme.engine}, {line: 3, at: 26, color: theme.danger}]}
            caption="horizon_context_lab.py :378 内 :397"
            width={1180}
          />
          {/* 终端行 = selftest 原文逐字摘录（含前导两空格）；改措辞须同步 narration/source-notes */}
          <TerminalLog
            prompt="uv run --no-project python horizon_context_lab.py --selftest"
            lines={[
              {
                text: '  [PASS] C2: RBAC 双层: 检索层对 intern 过滤 plan 建议（["dim_filtered (PRIVATE): [\'plan\']"]，降级总量 {(): 650}）；直闯执行层 → AccessDenied（引擎是最后防线）',
                color: theme.ok,
                at: at('p3-20') - bF.from,
              },
              {
                text: '  [PASS] D5: 拆 RBAC → intern 按 plan 拿到 [90,560]（泄露发生）；装回 → blocked',
                color: theme.danger,
                bold: true,
                at: at('p3-21') - bF.from,
              },
            ]}
            width={1180}
          />
          <EvidenceBadge grade="lab" />
        </Stage>
        <ArchifyRecap
          slug="governance-demolition"
          caption="治理破坏台"
          variant="inset"
          cues={[
            {chapterId: 'rbac-ablation', at: at('p3-20') - bF.from, durationInFrames: dur('p3-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="3-G 编译期安全锁与收束金句">
        <Stage top={430}>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 58,
              color: theme.text,
              textAlign: 'center',
              lineHeight: 1.45,
            }}
          >
            语义层再灵活，
            <br />
            <span style={{color: theme.engine}}>也绝不会成为绕开安全底线的后门</span>
          </div>
        </Stage>
        <ArchifyRecap
          slug="engine-governance"
          caption="绕行仍被引擎拦截"
          variant="inset"
          cues={[
            {chapterId: 'bypass-intercepted', at: at('p3-25') - bG.from, durationInFrames: dur('p3-25')},
          ]}
        />
        <PillarHUD lit={3} at={at('p3-26') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
