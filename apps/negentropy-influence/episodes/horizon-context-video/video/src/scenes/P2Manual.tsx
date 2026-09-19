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
        <Stage top={200}>
          <FiveDrawers />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="2-B 代码走廊① 注册校验门">
        <Stage top={350}>
          <CodeWalk
            title="M1 声明相 · 注册期结构校验门"
            lines={[
              'def validate_view(view, tables):',
              '    for r in view.relationships:',
              '        col = tables[r.to_table].columns[r.to_col]',
              '        if not col.is_key:            # FK 必须指向 PK/UNIQUE',
              '            errors.append(f"relationship bad: {r.to_col}")',
            ]}
            hi={[{line: 3, at: 18, color: theme.manual}, {line: 4, at: 26, color: theme.danger}]}
            caption="horizon_context_lab.py :235"
            width={1120}
          />
          <TerminalLog
            lines={[
              {text: '$ python horizon_context_lab.py --selftest', color: theme.dim},
              {text: '✗ relationship bad: customers.plan is not PRIMARY KEY/UNIQUE', color: theme.danger, bold: true},
              {text: '[PASS] 坏定义在注册期被拒 —— 不留运行时隐患', color: theme.ok},
            ]}
            width={1120}
          />
          {/* top=335：本镜有 inset 画框（y∈[56,315]），默认 44 会被整块压住 */}
          <EvidenceBadge grade="lab" top={335} />
        </Stage>
        <ArchifyRecap
          slug="declaration-execution"
          caption="声明相 / 执行相"
          variant="inset"
          cues={[
            {chapterId: 'gate', at: at('p2-07') - bB.from, durationInFrames: dur('p2-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="2-C 双保险锁">
        <Stage top={400}>
          <DoubleLock breakAt={at('p2-09b') - bC.from} />
        </Stage>
        <ArchifyRecap
          slug="declaration-execution"
          caption="口径单点 × 查询期重算"
          variant="inset"
          cues={[
            {chapterId: 'declare', at: at('p2-09') - bC.from, durationInFrames: dur('p2-09')},
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
        <Stage top={230}>
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
          <EvidenceBadge grade="lab" at={at('p2-20') - bE.from} />
        </Stage>
      </Sequence>

      <Sequence {...bF} name="2-F 去重安全与派生先聚后除">
        <Stage top={230}>
          <NumberClash badLabel="不做去重安全" bad="6" goodLabel="按集合去重" good="3" at={at('p2-22') - bF.from} />
          <div style={{marginTop: 46}}>
            <AvgScale at={at('p2-24') - bF.from} />
          </div>
        </Stage>
      </Sequence>

      <Sequence {...bG} name="2-G 半可加末快照与关系消歧">
        <Stage top={220}>
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
      </Sequence>

      <Sequence {...bH} name="2-H 题眼金句与手册徽章">
        <Stage top={330}>
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
        <PillarHUD lit={1} at={at('p2-36') - bH.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
