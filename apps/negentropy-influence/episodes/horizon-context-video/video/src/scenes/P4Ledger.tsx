/** P4 盖章底稿＝M4（应答层验证锚定）+ 全楼台账＝M5（端到端列级血缘）。
 *  M4 与 M1 正交：**手册完全正确，模型仍可能按错的那一页算**。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useFlowDash, useProgress, useShake, useSpring, useStagger} from '../motion';
import {NumberedCard, Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {AskCard, EvidenceBadge, MechZoom, PillarHUD, Stage} from '../components/devices';

/** 4-A 引用错手册：手册对的，翻错了页 */
const WrongPage: React.FC<{at: number}> = ({at}) => {
  const flip = useSpring('settle', {at, dur: DUR.f6});
  const bad = useProgress(at + 16, DUR.f5);
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div
        style={{
          width: 340,
          height: 240,
          borderRadius: 12,
          border: `3px solid ${theme.manual}`,
          background: `${theme.manual}16`,
          boxShadow: `0 0 34px ${theme.manual}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{fontSize: 64}}>📖</div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.manual, marginTop: 10}}>
          手册本身完全正确
        </div>
      </div>
      <div style={{fontSize: 46, color: theme.dim, transform: `rotate(${flip * 8}deg)`}}>→</div>
      <div
        style={{
          padding: '26px 34px',
          borderRadius: 12,
          border: `2px solid ${theme.danger}`,
          background: `${theme.danger}12`,
          opacity: bad,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>模型翻到了</div>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.danger, marginTop: 6}}>
          错误的那一页
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.danger, marginTop: 12}}>
          选错关联条件 / 误解提问意图
        </div>
      </div>
    </div>
  );
};

/** 4-B 盖章底稿 + 对账双栏 */
const StampedAnswer: React.FC<{at: number}> = ({at}) => {
  const stamp = useSpring('snap', {at, dur: DUR.f6});
  const rows = useStagger(3, {at: at + 12, stride: 6, dur: DUR.f4});
  const data = [['2026-01', '200', '200'], ['2026-02', '150', '150'], ['2026-03', '300', '300']];
  return (
    <div style={{display: 'flex', gap: 54, alignItems: 'flex-start'}}>
      <div
        style={{
          position: 'relative',
          width: 420,
          padding: '30px 32px',
          borderRadius: 12,
          border: `2px solid ${theme.manual}`,
          background: `${theme.manual}12`,
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>核准题库底稿</div>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 14, lineHeight: 1.7}}>
          verified_by: data-governance
          <br />
          verified_at: 2026-03-11
        </div>
        <div
          style={{
            position: 'absolute',
            right: 22,
            bottom: 18,
            width: 116,
            height: 116,
            borderRadius: '50%',
            border: `4px solid ${theme.manual}`,
            color: theme.manual,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.serif,
            fontSize: 26,
            transform: `scale(${0.4 + 0.6 * stamp}) rotate(${-14 * stamp}deg)`,
            opacity: stamp,
          }}
        >
          已核准
        </div>
      </div>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 12}}>
          底稿公式在当前数据上重算一遍 · 完全对账
        </div>
        {data.map((r, i) => (
          <div
            key={r[0]}
            style={{
              display: 'flex',
              gap: 34,
              fontFamily: theme.mono,
              fontSize: 28,
              color: theme.text,
              padding: '8px 0',
              opacity: rows[i],
            }}
          >
            <span style={{width: 130, color: theme.dim}}>{r[0]}</span>
            <span style={{width: 100}}>{r[1]}</span>
            <span style={{width: 100, color: theme.engine}}>{r[2]}</span>
            <span style={{color: theme.ok}}>✓</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 4-C 半堵墙：验证缺口只砌了一半 */
const HalfWall: React.FC = () => {
  const build = useProgress(4, DUR.f6);
  const brick = (filled: boolean, i: number) => (
    <div
      key={i}
      style={{
        width: 118,
        height: 44,
        borderRadius: 4,
        border: `2px ${filled ? 'solid' : 'dashed'} ${filled ? theme.manual : theme.dim}`,
        background: filled ? `${theme.manual}22` : 'transparent',
        opacity: filled ? build : 0.4,
      }}
    />
  );
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center'}}>
        <div style={{display: 'flex', gap: 8}}>{[0, 1, 2, 3].map((i) => brick(false, i))}</div>
        <div style={{display: 'flex', gap: 8}}>{[4, 5, 6, 7].map((i) => brick(false, i))}</div>
        <div style={{display: 'flex', gap: 8}}>{[8, 9, 10, 11].map((i) => brick(true, i))}</div>
        <div style={{display: 'flex', gap: 8}}>{[12, 13, 14, 15].map((i) => brick(true, i))}</div>
      </div>
      <div style={{marginTop: 24, fontFamily: theme.sans, fontSize: 32, color: theme.text}}>
        这堵验证的墙，目前<span style={{color: theme.manual}}>只砌了一半</span>
      </div>
      <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
        另一半（事后评分）是独立开关，不在这座楼里
      </div>
    </div>
  );
};

/** 4-D 全息管道台账：列级管网 + 落桌翻开的台账 + 对象解析门。
 *
 *  两个时点都由句边界给出（铁律⑤）：管网通流与台账翻开落在 p4-12（「每滴水从哪个水池
 *  流向哪个龙头」），解析门落下与虚构对象被弹回落在 p4-14（「绝不是废纸都收」）。
 *  `useFlowDash` 常驻流动，保证本子镜 469 帧全程有运动（ISSUE-187 ①）；`useShake`
 *  必须同时给 `decay: true` 与 `dur`，否则忽略 dur 会抖满整个子镜。
 *  弹回的行程取**本句时长的比例**而非写死帧数——TTS 重测后自动重定时。 */
const LANES = [
  {src: 'raw.orders', dst: 'bi.board.gmv'},
  {src: 'raw.customers', dst: 'ai.agent.seg'},
  {src: 'raw.events', dst: 'bi.board.dau'},
];
const TRACE = [
  'raw.orders.amt    →  dwh.f_order.amt    →  bi.board.gmv',
  'raw.customers.id  →  dwh.d_cust.id      →  ai.agent.seg',
  'raw.events.ts     →  dwh.f_event.ts     →  bi.board.dau',
  'dwh.f_order.amt   →  ai.agent.metric    →  （引擎原生记录）',
];

const PipeLedger: React.FC<{
  openAt: number;
  labelSpan: number;
  gateAt: number;
  rejectSpan: number;
}> = ({openAt, labelSpan, gateAt, rejectSpan}) => {
  const flow = useFlowDash({dash: 10, gap: 14, period: 40});
  const open = useSpring('snap', {at: openAt, dur: DUR.f6});
  const rows = useStagger(4, {at: openAt, fit: {total: labelSpan}, dur: DUR.f5});
  const gate = useSpring('snap', {at: gateAt, dur: DUR.f6});
  const half = Math.max(1, Math.round(rejectSpan * 0.5));
  const travel = useProgress(gateAt, half, 'decelerate');
  const bounce = useShake({at: gateAt + half, active: true, amp: 7, decay: true, dur: DUR.f6});
  const rejected = useProgress(gateAt + half, DUR.f5);
  return (
    <div style={{width: 1240}}>
      <div style={{position: 'relative', height: 194}}>
        <svg width={1240} height={194}>
          {LANES.map((l, i) => (
            <g key={l.src}>
              <rect
                x={0}
                y={12 + i * 50}
                width={170}
                height={36}
                rx={8}
                fill={theme.panel}
                stroke={theme.engine}
                strokeWidth={2}
              />
              <rect
                x={1070}
                y={12 + i * 50}
                width={170}
                height={36}
                rx={8}
                fill={theme.panel}
                stroke={theme.engine}
                strokeWidth={2}
              />
              <text x={12} y={35 + i * 50} fill={theme.dim} fontSize={17} fontFamily={theme.mono}>
                {l.src}
              </text>
              <text x={1082} y={35 + i * 50} fill={theme.dim} fontSize={17} fontFamily={theme.mono}>
                {l.dst}
              </text>
              <path
                d={`M 170 ${30 + i * 50} C 480 ${30 + i * 50}, 760 ${30 + i * 50}, 1070 ${30 + i * 50}`}
                stroke={theme.engine}
                strokeWidth={3}
                fill="none"
                opacity={0.8}
                {...flow}
              />
            </g>
          ))}
          {/* 交叉的那一条：同一列被另一条链路消费，正是「列级」而非「表级」的意思 */}
          <path
            d="M 170 80 C 520 80, 720 30, 1070 30"
            stroke={theme.dig}
            strokeWidth={3}
            fill="none"
            opacity={0.75}
            {...flow}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 210 + travel * 460,
            top: 156,
            padding: '8px 14px',
            borderRadius: 8,
            border: `2px dashed ${rejected > 0.4 ? theme.danger : theme.dim}`,
            background: rejected > 0.4 ? `${theme.danger}14` : 'transparent',
            fontFamily: theme.mono,
            fontSize: 18,
            color: rejected > 0.4 ? theme.danger : theme.dim,
            opacity: travel > 0 ? 1 : 0,
            transform: `translateX(${bounce}px)`,
          }}
        >
          raw.y → ghost.x
          {rejected > 0.4 ? '  · 对象不可解析 · 拒收' : ''}
        </div>
      </div>
      <div style={{position: 'relative', marginTop: 22}}>
        <div
          style={{
            height: 5,
            borderRadius: 3,
            background: theme.engine,
            boxShadow: `0 0 ${18 * gate}px ${theme.engine}`,
            transform: `translateY(${(1 - gate) * -40}px)`,
            opacity: gate,
            marginBottom: 12,
          }}
        />
        <Panel
          accent={theme.engine}
          style={{
            padding: '18px 26px',
            transform: `scaleY(${0.06 + 0.94 * open})`,
            transformOrigin: 'top center',
            opacity: open,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginBottom: 10}}>
            全楼出入库台账 · 谁生产 / 谁转手 / 谁消费（列级）
          </div>
          {TRACE.map((t, i) => (
            <div
              key={t}
              style={{
                fontFamily: theme.mono,
                fontSize: 21,
                color: theme.text,
                padding: '7px 0',
                opacity: rows[i],
                transform: `translateX(${(1 - rows[i]) * -18}px)`,
              }}
            >
              {t}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
};

/** 4-E 入账三道闸。
 *  `rejectAt` 单独传（铁律⑤）：第三道闸弹回要落在说出「当场拒收」的那句上。
 *  `useShake` 必须带 `decay: true`，否则忽略 `dur` 会抖满整镜 24.8s。 */
const ThreeGates: React.FC<{at: number; rejectAt: number}> = ({at, rejectAt}) => {
  const ps = useStagger(3, {at, stride: 10, dur: DUR.f5});
  const reject = useShake({at: rejectAt, active: true, amp: 7, decay: true, dur: DUR.f6});
  const gates = ['有 INGEST 权限？', '是 COMPLETE 事件？', '对象在楼里可解析？'];
  return (
    <div style={{display: 'flex', gap: 22, alignItems: 'center'}}>
      {gates.map((g, i) => (
        <React.Fragment key={g}>
          <div
            style={{
              padding: '20px 24px',
              borderRadius: 10,
              border: `2px solid ${i === 2 ? theme.danger : theme.engine}`,
              background: `${i === 2 ? theme.danger : theme.engine}12`,
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.text,
              opacity: ps[i],
              transform: i === 2 ? `translateX(${reject}px)` : 'none',
            }}
          >
            {g}
          </div>
          {i < 2 ? <span style={{color: theme.dim, fontSize: 28}}>→</span> : null}
        </React.Fragment>
      ))}
      <div
        style={{
          marginLeft: 16,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.danger,
          opacity: ps[2],
        }}
      >
        任一不满足 → 整事件拒绝
      </div>
    </div>
  );
};

export const P4Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-09');
  const bC = w('p4-09a');
  const bD = w('p4-10', 'p4-14');
  const bE = w('p4-14a', 'p4-18');
  const bF = w('p4-19', 'p4-24');
  const bG = w('p4-25', 'p4-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 引用错手册">
        <SceneTag chapter="M4" tagline="应答层验证锚定：核准题库与盖章底稿" accent={theme.manual} />
        <Stage top={290}>
          <WrongPage at={at('p4-02') - bA.from} />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="4-B 盖章底稿与重算对账">
        <Stage top={380}>
          <StampedAnswer at={at('p4-06') - bB.from} />
        </Stage>
        <ArchifyRecap
          slug="resolve-activation"
          caption="应答层验证锚定"
          variant="inset"
          cues={[
            {chapterId: 'hit-reconcile', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'miss-fallback', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 半堵墙">
        <Stage top={370}>
          <HalfWall />
        </Stage>
        <ArchifyRecap
          slug="resolve-activation"
          caption="墙外的评测闭环"
          variant="inset"
          cues={[
            {chapterId: 'outside-eval', at: at('p4-09a') - bC.from, durationInFrames: dur('p4-09a')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="4-D 全楼出入库台账">
        <SceneTag chapter="M5" tagline="端到端列级血缘：全楼出入库台账" accent={theme.engine} />
        <Sequence
          from={at('p4-10') - bD.from}
          durationInFrames={at('p4-12') - at('p4-10')}
          name="4-D① 母图推近 · 地下机房台账层"
        >
          <Stage top={320}>
            <MechZoom focus="ledger" spanInFrames={at('p4-12') - at('p4-10')}>
              <AskCard
                at={0}
                kicker="第二个挑战"
                body="数据在全公司流转 —— 如何确保合理、合法、合规？"
              />
              <NumberedCard
                index={5}
                label="端到端列级血缘"
                sub="引擎原生 · 列级生产消费"
                active
                accent={theme.engine}
                width={430}
                delay={at('p4-11') - at('p4-10')}
              />
            </MechZoom>
          </Stage>
        </Sequence>
        {/* 装置跨过 archify 锚句连续存在（flowDash 相位不断），靠画框不透明底色遮住；
            故宽度 ≤1240、Stage top + 高度 ≤ 880，且 ArchifyRecap 必须写在其后 */}
        <Sequence
          from={at('p4-12') - bD.from}
          durationInFrames={bD.durationInFrames - (at('p4-12') - bD.from)}
          name="4-D② 全息管道台账与对象解析门"
        >
          <Stage top={300}>
            <PipeLedger
              openAt={0}
              labelSpan={dur('p4-12')}
              gateAt={at('p4-14') - at('p4-12')}
              rejectSpan={dur('p4-14')}
            />
          </Stage>
        </Sequence>
        <ArchifyRecap
          slug="lineage-ledger"
          caption="引擎执行自动沉淀"
          cues={[{chapterId: 'engine-lane', at: at('p4-13') - bD.from, durationInFrames: dur('p4-13')}]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 三道闸与代码走廊③">
        <Stage top={350}>
          <ThreeGates
            at={at('p4-14a') - bE.from}
            rejectAt={at('p4-16') - bE.from}
          />
          <CodeWalk
            title="M5 摄取门 · 外部血缘三道闸"
            lines={[
              'def ingest_external_lineage(event, *, has_ingest_privilege=True, strict_resolve=True):',
              '    if not has_ingest_privilege:  raise LineageIngestError("no INGEST")',
              '    if event["eventType"] != "COMPLETE": raise LineageIngestError("not COMPLETE")',
              '    if strict_resolve and not resolvable(obj): raise LineageIngestError("unresolved")',
            ]}
            hi={[{line: 3, at: at('p4-17') - bE.from, color: theme.engine}]}
            caption="horizon_context_lab.py :710"
            width={1220}
          />
          {/* 终端行 = selftest 原文逐字摘录（含前导两空格）；本镜纵向预算紧，不留 prompt 行 */}
          <TerminalLog
            lines={[
              {
                text: "  [PASS] E1b: 摄取三道闸: 非 COMPLETE / 对象不可解析 / 无 INGEST 权限 → 整事件拒绝 ['rejected', 'rejected', 'rejected']（账本零污染）",
                color: theme.ok,
                at: at('p4-16') - bE.from,
              },
              {
                text: '  [PASS] D8: 拆血缘解析闸 → 虚构对象入账（raw.y→ghost.x）——账本与真实数据流脱钩，事后对账从此不可信',
                color: theme.danger,
                bold: true,
                at: at('p4-17') - bE.from,
              },
            ]}
            width={1220}
          />
          {/* top=335：本镜有 inset 画框（y∈[56,315]），默认 44 会被整块压住 */}
          <EvidenceBadge grade="lab" top={335} />
        </Stage>
        <ArchifyRecap
          slug="lineage-ledger"
          caption="OpenLineage 摄取三道闸"
          variant="inset"
          cues={[{chapterId: 'ingest-lane', at: at('p4-15') - bE.from, durationInFrames: dur('p4-15')}]}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 逆流溯源与双柱">
        <Stage top={380}>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 84}}>🔦</div>
            <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 34, color: theme.text}}>
              顺着台账，三秒定位到源头
            </div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
              谁生产、谁清洗、AI 何时引用哪一列 —— 清清楚楚
            </div>
          </div>
        </Stage>
        <ArchifyRecap
          slug="lineage-ledger"
          caption="单一账本与盲区"
          variant="inset"
          cues={[
            {chapterId: 'ledger-and-blind', at: at('p4-20') - bF.from, durationInFrames: dur('p4-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="4-G 信任资产四方印鉴">
        <Stage top={300}>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 56,
              color: theme.text,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            答错有拦截，答对有底稿，
            <br />
            <span style={{color: theme.manual}}>出了疑问随时翻账本对质</span>
          </div>
        </Stage>
        <PillarHUD lit={5} at={at('p4-28') - bG.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
