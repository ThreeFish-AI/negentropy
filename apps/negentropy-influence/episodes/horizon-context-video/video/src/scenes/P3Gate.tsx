/** P3 承重墙上的闸机＝M2（逐页验放·客体轴）+ M3（承重墙拓扑·定义出口轴）。
 *  两者正交：M2 失效 = 人当场看到明文；M3 失效 = 受限口径从别的门静默溜出。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useImpulse, useProgress, useShake, useSpring} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, PillarHUD, SplitCompare, Stage} from '../components/devices';

const ROWS = [
  {name: '张明', plan: 'ENTERPRISE', phone: '138****2041', amt: '¥ 90'},
  {name: '李静', plan: 'PRO', phone: '139****7788', amt: '¥ 560'},
  {name: '王磊', plan: 'FREE', phone: '137****3120', amt: '¥ 24'},
];

/** 3-A/3-B 逐页验放扫描仪：机密列打码、越权行整条扣留 */
const PageScanner: React.FC<{maskAt: number; holdAt: number}> = ({maskAt, holdAt}) => {
  const frame = useCurrentFrame();
  const scan = useProgress(2, DUR.f6);
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
        const masked = progress(frame, maskAt + i * 3, DUR.f4);
        const held = i === 0 ? progress(frame, holdAt, DUR.f4) : 0;
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
              border: `2px solid ${held > 0.4 ? theme.danger : theme.panelBorder}`,
              background: held > 0.4 ? `${theme.danger}14` : theme.panel,
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
          </div>
        );
      })}
    </div>
  );
};

/** 3-C 木牌 vs 焊死承重墙 */
const SignVsWall: React.FC<{at: number}> = ({at}) => {
  const shake = useShake({at, active: true, amp: 8, dur: DUR.f6});
  const wall = useSpring('settle', {at: at + 12, dur: DUR.f6});
  return (
    <div style={{display: 'flex', gap: 80, alignItems: 'flex-end'}}>
      <div style={{textAlign: 'center', transform: `translateX(${shake}px) rotate(${shake * 0.6}deg)`}}>
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
          }}
        >
          🛂
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.engine, marginTop: 12}}>
          焊死在承重墙里的闸机
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>人 / BI / AI 共用同一执法点</div>
      </div>
    </div>
  );
};

/** 3-E 双层防线：检索层藏起来 ≠ 执行层拦得住 */
const TwoLayers: React.FC<{at: number}> = ({at}) => {
  const hide = useProgress(at, DUR.f6);
  const bump = useImpulse({at: at + 26, dur: DUR.f6});
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
        <ArchifyRecap
          slug="row-column-policy"
          caption="查询期行列级策略"
          cues={[{chapterId: 'perpage', at: at('p3-03') - bA.from, durationInFrames: w('p3-03').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 打码扣留与代理识别">
        <Stage top={360}>
          <PageScanner maskAt={at('p3-05') - bB.from} holdAt={at('p3-05') - bB.from + 14} />
        </Stage>
        <ArchifyRecap
          slug="row-column-policy"
          caption="策略对象族 · 代理严拒面"
          variant="inset"
          cues={[
            {chapterId: 'family', at: at('p3-05') - bB.from, durationInFrames: w('p3-05').durationInFrames},
            {chapterId: 'agentface', at: at('p3-07') - bB.from, durationInFrames: w('p3-07').durationInFrames},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 木牌与承重墙">
        <SceneTag chapter="M3" tagline="语义级治理：闸机焊死承重墙" accent={theme.engine} />
        <Stage top={380}>
          <SignVsWall at={at('p3-09') - bC.from} />
        </Stage>
        <ArchifyRecap
          slug="engine-governance"
          caption="语义级治理执行"
          variant="inset"
          cues={[{chapterId: 'governed-path', at: at('p3-12') - bC.from, durationInFrames: w('p3-12').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 两种坏法对照台与出门行李标签">
        <Stage top={250}>
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
      </Sequence>

      <Sequence {...bE} name="3-E 双层防线剖面">
        <Stage top={280}>
          <TwoLayers at={at('p3-15') - bE.from} />
        </Stage>
        <EvidenceBadge grade="lab" at={at('p3-17') - bE.from} />
      </Sequence>

      <Sequence {...bF} name="3-F 代码走廊② 执行层拒绝">
        <Stage top={150}>
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
          <TerminalLog
            lines={[
              {text: '[PASS] 装回执行层 → intern 请求 blocked', color: theme.ok},
              {text: '[LEAK] 拆掉 enforce_rbac → intern 按 plan 拿到 [90, 560]', color: theme.danger, bold: true},
              {text: '泄露对照：藏起来 ≠ 拦得住', color: theme.dim},
            ]}
            width={1180}
          />
          <EvidenceBadge grade="lab" />
        </Stage>
      </Sequence>

      <Sequence {...bG} name="3-G 编译期安全锁与收束金句">
        <Stage top={300}>
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
            {chapterId: 'bypass-intercepted', at: at('p3-25') - bG.from, durationInFrames: w('p3-25').durationInFrames},
          ]}
        />
        <PillarHUD lit={3} at={at('p3-26') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
