/** P2 规章手册＝M1（p2-01..36）——唯一的**双不变量**机制：
 *  口径单点（声明锁）与查询期重算（计算锁）可各自独立失效，故必须并列演两遍。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, NumberClash, PillarHUD, Stage} from '../components/devices';

/** 2-A 五段式抽屉柜 */
const FiveDrawers: React.FC = () => {
  const ps = useStagger(5, {at: 10, stride: 8, dur: DUR.f5});
  const rows = ['TABLES 核准账本', 'RELATIONSHIPS 勾稽路径', 'FACTS 原始凭证量', 'DIMENSIONS 切片维度', 'METRICS 官方指标'];
  return (
    <div style={{width: 1000}}>
      {rows.map((r, i) => (
        <div
          key={r}
          style={{
            marginBottom: 12,
            padding: '20px 26px',
            borderRadius: 10,
            border: `2px solid ${theme.manual}`,
            background: `${theme.manual}12`,
            fontFamily: theme.sans,
            fontSize: 30,
            color: theme.text,
            opacity: ps[i],
            transform: `translateX(${(1 - ps[i]) * 40}px)`,
          }}
        >
          {r}
        </div>
      ))}
    </div>
  );
};

/** 2-C 双保险锁：声明锁常绿，计算锁被拧开 → 数字翻倍 */
const DoubleLock: React.FC<{breakAt: number}> = ({breakAt}) => {
  const open = useSpring('snap', {at: breakAt, dur: DUR.f6});
  const n = useCount({from: 200, to: 440, at: breakAt + 4, dur: DUR.f6});
  const broken = useProgress(breakAt, DUR.f3);
  const lock = (name: string, sub: string, ok: boolean, rot: number) => (
    <div style={{textAlign: 'center'}}>
      <div
        style={{
          width: 190,
          height: 190,
          borderRadius: 18,
          border: `3px solid ${ok ? theme.ok : theme.danger}`,
          background: `${ok ? theme.ok : theme.danger}14`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 76,
          transform: `rotate(${rot}deg)`,
        }}
      >
        {ok ? '🔒' : '🔓'}
      </div>
      <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 28, color: theme.text}}>{name}</div>
      <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{sub}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 70}}>
      {lock('声明锁', '五段式 + 注册校验门', true, 0)}
      {lock('计算锁', '查询期按 grain 重算', broken < 0.5, -18 * open)}
      <div style={{textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>手册一字未改，算出来的钱</div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 86,
            color: broken > 0.5 ? theme.danger : theme.ok,
          }}
        >
          {Math.round(n)}
        </div>
      </div>
    </div>
  );
};

/** 2-E 复印机陷阱：一张 100 进去、三张副本出来。
 *  `sumAt` 必须单独传（铁律⑤）：300 的爆红要落在说出「虚增成了三百块」的那句上，
 *  写死 `at + 26` 会提前 8.3s 压到前两句。 */
const CopierTrap: React.FC<{at: number; sumAt: number}> = ({at, sumAt}) => {
  const ps = useStagger(3, {at: at + 8, stride: 7, dur: DUR.f5});
  const total = useCount({from: 100, to: 300, at: sumAt, dur: DUR.f6});
  const boom = useImpulse({at: sumAt + 4, dur: DUR.f6});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 46}}>
      <div
        style={{
          width: 230,
          padding: '26px 0',
          textAlign: 'center',
          borderRadius: 12,
          border: `2px solid ${theme.manual}`,
          background: `${theme.manual}14`,
          fontFamily: theme.mono,
          fontSize: 40,
          color: theme.manual,
        }}
      >
        $100 订单
      </div>
      <div style={{fontSize: 56}}>🖨️</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 210,
              padding: '12px 0',
              textAlign: 'center',
              borderRadius: 8,
              border: `2px dashed ${theme.danger}`,
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.danger,
              opacity: ps[i],
              transform: `translateX(${(1 - ps[i]) * -20}px)`,
            }}
          >
            副本 {i + 1} · $100
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 82,
          color: theme.danger,
          transform: `scale(${1 + 0.16 * boom})`,
        }}
      >
        ${Math.round(total)}
      </div>
    </div>
  );
};

/** 2-F 班级平均分天平：先除后加 vs 先聚后除 */
const AvgScale: React.FC<{at: number}> = ({at}) => {
  const tilt = useSpring('settle', {at, dur: DUR.f6});
  const ghost = useProgress(at + 14, DUR.f6);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
      <div style={{textAlign: 'center', transform: `translateY(${-14 * tilt}px)`}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>先除后加（平均的平均）</div>
        <div style={{fontFamily: theme.mono, fontSize: 72, color: theme.danger, opacity: 1 - 0.45 * ghost}}>
          122
        </div>
      </div>
      <div style={{fontSize: 52, opacity: 0.7}}>⚖️</div>
      <div style={{textAlign: 'center', transform: `translateY(${14 * tilt}px)`}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>先聚后除（真实客单价）</div>
        <div style={{fontFamily: theme.mono, fontSize: 72, color: theme.ok}}>108</div>
      </div>
    </div>
  );
};

/** 2-G 末快照时间闸 */
const LastSnapshot: React.FC<{at: number; clashAt: number}> = ({at, clashAt}) => {
  const frame = useCurrentFrame();
  const days = [5, 6, 7, 4, 6, 5, 7];
  return (
    <div>
      <div style={{display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 22}}>
        {days.map((d, i) => {
          const p = progress(frame, at + i * 3, DUR.f4);
          const isLast = i === days.length - 1;
          return (
            <div key={i} style={{textAlign: 'center'}}>
              <div
                style={{
                  width: 84,
                  height: 26 * d * p,
                  borderRadius: 5,
                  background: isLast ? theme.ok : `${theme.engine}77`,
                  boxShadow: isLast ? `0 0 18px ${theme.ok}88` : 'none',
                }}
              />
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 6}}>{d}</div>
            </div>
          );
        })}
      </div>
      {/* clashAt：24 vs 7 要落在 p2-30（说出「虚增到二十四」）上，写死 at+26 会提前 9.3s */}
      <NumberClash badLabel="七天求和" bad="24" goodLabel="末快照" good="7" at={clashAt} />
    </div>
  );
};

export const P2Manual: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-04');
  const bB = w('p2-05', 'p2-08');
  const bC = w('p2-09', 'p2-09b');
  const bD = w('p2-10', 'p2-13');
  const bE = w('p2-14', 'p2-20');
  const bF = w('p2-21', 'p2-26');
  const bG = w('p2-27', 'p2-31');
  const bH = w('p2-32', 'p2-36');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 便利贴到五段式抽屉柜">
        <SceneTag chapter="M1" tagline="规章手册：只印一本且当场套算" accent={theme.manual} />
        {/* 模式 b：五层抽屉入场后常驻（跨句连续状态），cue 窗淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
          ]}
        >
          <Stage top={200}>
            <FiveDrawers />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="evolution-timeline"
          caption="三阶段演进"
          cues={[
            {chapterId: 'stage-objects', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
          ]}
        />
        {/* declare 章锚「五段式分工」句（p2-04）；与上图 p2-03 背靠背 → lead={false} */}
        <ArchifyRecap
          slug="declaration-execution"
          caption="声明相 / 执行相"
          lead={false}
          cues={[
            {chapterId: 'declare', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 代码走廊① 注册校验门">
        {/* 模式 b：CodeWalk 高亮行跨句累积（代码走廊阅读面），cue 窗淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
          ]}
        >
          <Stage>
            <CodeWalk
              title="M1 声明相 · 注册期结构校验门"
              lines={[
                'def validate_view(view, tables):',
                '    for r in view.relationships:',
                '        for c in r.to_cols:',
                '            if c not in pks.get(r.to_table, set()):   # FK 必须指向 PK/UNIQUE',
                '                errors.append(f"relationship {r.name}: referenced column "',
                '                              f"{r.to_table}.{c} is not PRIMARY KEY/UNIQUE")',
              ]}
              hi={[
                {line: 3, at: 18, color: theme.manual},
                {line: 4, at: 26, color: theme.danger},
                {line: 5, at: 26, color: theme.danger},
              ]}
              caption="horizon_context_lab.py :235"
              width={1120}
            />
            {/* 终端行 = selftest 原文逐字摘录（含前导两空格）；改措辞须同步 narration/source-notes */}
            <TerminalLog
              lines={[
                {
                  text: '  [PASS] D6: 拆结构校验（relationship 指向非键列）→ relationship bad: referenced column customers.plan is not PRIMARY KEY/UNIQUE—— 无门则垃圾定义静默入库（行数失控的注册期引信）',
                  color: theme.ok,
                  bold: true,
                  at: at('p2-07') - bB.from,
                },
              ]}
              width={1120}
            />
          </Stage>
        </ArchifyYield>
        <EvidenceBadge grade="lab" />
        <ArchifyRecap
          slug="declaration-execution"
          caption="声明相 / 执行相"
          cues={[
            {chapterId: 'gate', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 双保险锁">
        {/* 模式 b：断锁翻数是跨句连续状态；p2-09/p2-09b payoff 窗装置可见，仅 p2-09a 让位 */}
        <ArchifyYield
          cues={[
            {at: at('p2-09a') - bC.from, durationInFrames: dur('p2-09a')},
          ]}
        >
          <Stage>
            <DoubleLock breakAt={at('p2-09b') - bC.from} />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="declaration-execution"
          caption="口径单点 × 查询期重算"
          cues={[
            {chapterId: 'recompute', at: at('p2-09a') - bC.from, durationInFrames: dur('p2-09a')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="2-D 死数字 vs 临机现算">
        <Stage top={280}>
          <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 96}}>🧊</div>
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, marginTop: 14}}>
                宽表里冻住的死数字
              </div>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 40, color: theme.dim}}>vs</div>
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 96}}>⚙️</div>
              <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.engine, marginTop: 14}}>
                只存算式，临机现算
              </div>
            </div>
          </div>
        </Stage>
      </Sequence>

      <Sequence {...bE} name="2-E 复印机陷阱">
        {/* 模式 b：副本逐张累积 + 爆红计数是跨句连续状态，cue 窗淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
            {at: at('p2-19') - bE.from, durationInFrames: dur('p2-19')},
            {at: at('p2-20') - bE.from, durationInFrames: dur('p2-20')},
          ]}
        >
          <Stage>
            <CopierTrap at={at('p2-15') - bE.from} sumAt={at('p2-17') - bE.from} />
            <div style={{marginTop: 20}}>
              <NumberClash
                badLabel="直接关联求和"
                bad="440"
                goodLabel="先聚后联"
                good="200"
                at={at('p2-20') - bE.from}
              />
            </div>
          </Stage>
        </ArchifyYield>
        <EvidenceBadge grade="lab" at={at('p2-20') - bE.from} />
        <ArchifyRecap
          slug="fan-trap"
          caption="复印机陷阱"
          cues={[
            {chapterId: 'copy-inflate', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17')},
            {chapterId: 'aggregate-first', at: at('p2-19') - bE.from, durationInFrames: dur('p2-19')},
            {chapterId: 'measured-440', at: at('p2-20') - bE.from, durationInFrames: dur('p2-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="2-F 去重安全与派生先聚后除">
        {/* 模式 b：天平倾斜/幽灵淡化是跨句连续状态，窗=双实例全部 3 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
            {at: at('p2-25') - bF.from, durationInFrames: dur('p2-25')},
            {at: at('p2-26') - bF.from, durationInFrames: dur('p2-26')},
          ]}
        >
          <Stage>
            <NumberClash badLabel="不做去重安全" bad="6" goodLabel="按集合去重" good="3" at={at('p2-22') - bF.from} />
            <div style={{marginTop: 46}}>
              <AvgScale at={at('p2-24') - bF.from} />
            </div>
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="dedup-safety"
          caption="去重安全"
          cues={[
            {chapterId: 'set-vs-rows', at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
          ]}
        />
        <ArchifyRecap
          slug="mean-of-means"
          caption="平均的平均"
          cues={[
            {chapterId: 'wrong-avg-of-avg', at: at('p2-25') - bF.from, durationInFrames: dur('p2-25')},
            {chapterId: 'measured-122-108', at: at('p2-26') - bF.from, durationInFrames: dur('p2-26')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="2-G 半可加末快照与关系消歧">
        {/* 模式 b：天数条逐根点亮/对撞常驻是跨句连续状态，窗=双实例全部 3 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p2-28') - bG.from, durationInFrames: dur('p2-28')},
            {at: at('p2-30') - bG.from, durationInFrames: dur('p2-30')},
            {at: at('p2-31') - bG.from, durationInFrames: dur('p2-31')},
          ]}
        >
          <Stage>
            <LastSnapshot at={at('p2-28') - bG.from} clashAt={at('p2-30') - bG.from} />
            <Panel
              accent={theme.engine}
              style={{marginTop: 26, padding: '18px 26px', width: 1020}}
            >
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>
                买家 / 推荐人双路径 → 必须显式声明走哪一条（USING 消歧）
              </span>
            </Panel>
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="last-snapshot-gate"
          caption="末快照"
          cues={[
            {chapterId: 'semi-additive', at: at('p2-28') - bG.from, durationInFrames: dur('p2-28')},
            {chapterId: 'snapshot-vs-sum', at: at('p2-30') - bG.from, durationInFrames: dur('p2-30')},
          ]}
        />
        <ArchifyRecap
          slug="dual-path-disambiguation"
          caption="关系消歧"
          lead={false}
          cues={[
            {chapterId: 'two-paths', at: at('p2-31') - bG.from, durationInFrames: dur('p2-31')},
          ]}
        />
      </Sequence>

      <Sequence {...bH} name="2-H 题眼金句与手册徽章">
        {/* 模式 b：金句静态常驻，cue 窗淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p2-32') - bH.from, durationInFrames: dur('p2-32')},
            {at: at('p2-33') - bH.from, durationInFrames: dur('p2-33')},
          ]}
        >
          <Stage>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 62,
                color: theme.text,
                textAlign: 'center',
                lineHeight: 1.45,
              }}
            >
              查询在语法上完全正确，
              <br />
              <span style={{color: theme.danger}}>业务分析上可能彻底错误</span>
            </div>
          </Stage>
        </ArchifyYield>
        <PillarHUD lit={1} at={at('p2-36') - bH.from} />
        <ArchifyRecap
          slug="valid-sql-wrong-answer"
          caption="语法 × 业务"
          cues={[
            {chapterId: 'syntax-pass', at: at('p2-32') - bH.from, durationInFrames: dur('p2-32')},
            {chapterId: 'business-fail', at: at('p2-33') - bH.from, durationInFrames: dur('p2-33')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
