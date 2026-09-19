/** P4 盖章底稿＝M4（应答层验证锚定）+ 全楼台账＝M5（端到端列级血缘）。
 *  M4 与 M1 正交：**手册完全正确，模型仍可能按错的那一页算**。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useProgress, useShake, useSpring, useStagger} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge, PillarHUD, Stage} from '../components/devices';

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

/** 4-E 入账三道闸 */
const ThreeGates: React.FC<{at: number}> = ({at}) => {
  const ps = useStagger(3, {at, stride: 10, dur: DUR.f5});
  const reject = useShake({at: at + 34, active: true, amp: 7, dur: DUR.f6});
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
            {chapterId: 'hit-reconcile', at: at('p4-07') - bB.from, durationInFrames: w('p4-07').durationInFrames},
            {chapterId: 'miss-fallback', at: at('p4-09') - bB.from, durationInFrames: w('p4-09').durationInFrames},
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
          cues={[{chapterId: 'outside-eval', at: 0, durationInFrames: bC.durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bD} name="4-D 全楼出入库台账">
        <SceneTag chapter="M5" tagline="端到端列级血缘：全楼出入库台账" accent={theme.engine} />
        <ArchifyRecap
          slug="lineage-ledger"
          caption="引擎执行自动沉淀"
          cues={[{chapterId: 'engine-lane', at: at('p4-13') - bD.from, durationInFrames: w('p4-13').durationInFrames}]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 三道闸与代码走廊③">
        <Stage top={350}>
          <ThreeGates at={at('p4-14a') - bE.from} />
          <CodeWalk
            title="M5 摄取门 · 外部血缘三道闸"
            lines={[
              'def ingest_external_lineage(event, *, has_ingest_privilege=True,',
              '                            strict_resolve=True):',
              '    if not has_ingest_privilege:  raise LineageIngestError("no INGEST")',
              '    if event["eventType"] != "COMPLETE": raise LineageIngestError("not COMPLETE")',
              '    if strict_resolve and not resolvable(obj): raise LineageIngestError("unresolved")',
            ]}
            hi={[{line: 4, at: 20, color: theme.engine}]}
            caption="horizon_context_lab.py :710"
            width={1220}
          />
          <TerminalLog
            lines={[
              {text: '[PASS] 三道闸：非 COMPLETE / 对象不可解析 / 无权限 → 整事件拒绝', color: theme.ok},
              {text: '[LEAK] 拆掉解析闸 → 虚构对象 raw.y->ghost.x 混入正式账本', color: theme.danger, bold: true},
            ]}
            width={1220}
          />
          <EvidenceBadge grade="lab" />
        </Stage>
        <ArchifyRecap
          slug="lineage-ledger"
          caption="OpenLineage 摄取三道闸"
          variant="inset"
          cues={[{chapterId: 'ingest-lane', at: at('p4-15') - bE.from, durationInFrames: w('p4-15').durationInFrames}]}
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
            {chapterId: 'ledger-and-blind', at: at('p4-20') - bF.from, durationInFrames: w('p4-20').durationInFrames},
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
