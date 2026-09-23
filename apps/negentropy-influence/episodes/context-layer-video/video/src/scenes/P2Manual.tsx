/** P2 规章手册（p2-01..28）——对象层 M1 双不变量：口径单点 × 查询期重算。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, NumberClash, PillarHUD} from '../components/devices';

/** 2-A 规章手册：翻开五段式章节 + 当场套算。 */
const ManualBook: React.FC<{at: number; calcAt: number}> = ({at, calcAt}) => {
  const open = useSpring('settle', {at, dur: DUR.f6});
  const calc = useCount({from: 0, to: 200, at: calcAt, dur: DUR.f6});
  const chapters = ['TABLES', 'RELATIONSHIPS', 'FACTS', 'DIMENSIONS', 'METRICS'];
  return (
    <div style={{display: 'flex', gap: 60, justifyContent: 'center', alignItems: 'center', paddingTop: 100}}>
      <div
        style={{
          width: 480,
          padding: '30px 36px',
          borderRadius: '4px 18px 18px 4px',
          border: `2px solid ${theme.blueprint}`,
          background: `${theme.blueprint}0D`,
          transform: `perspective(1200px) rotateY(${(1 - open) * -18}deg)`,
          opacity: open,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>规章手册</div>
        <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginBottom: 14}}>语义视图 · Semantic View</div>
        {chapters.map((c, i) => (
          <div key={c} style={{fontFamily: theme.mono, fontSize: 19, color: i === 4 ? theme.blueprint : theme.dim, padding: '5px 0', borderBottom: `1px solid ${theme.panelBorder}`}}>
            {i + 1}. {c}
          </div>
        ))}
      </div>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 62}}>🧮</div>
        <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.grown, marginTop: 8}}>= {calc}</div>
        <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 4}}>翻到哪条 · 当场按原始凭证套算</div>
      </div>
    </div>
  );
};

/** 2-B 双失效面：声明锁 / 计算锁 + 先祖三厂商卡。 */
const TwinLocks: React.FC<{at: number}> = ({at}) => {
  const l1 = useDraw(at, 26);
  const l2 = useDraw(at + 12, 26);
  const cards = useStagger(3, {at: at + 20, stride: 8, dur: DUR.f5});
  const vendors = [
    {n: 'Looker', d: '对称聚合可显式关闭'},
    {n: 'dbt MetricFlow', d: '遇扇形连接直接拒答'},
    {n: 'Cube', d: '无预聚合回退底表'},
  ];
  const lock = (lk: {pathLength: 1; strokeDasharray: 1; strokeDashoffset: number}, label: string, sub: string) => (
    <div style={{textAlign: 'center'}}>
      <svg width={70} height={84} viewBox="0 0 70 84">
        <rect x={8} y={34} width={54} height={44} rx={8} fill={`${theme.panel}`} stroke={lk.strokeDashoffset < 1 ? theme.activate : theme.panelBorder} strokeWidth={2.5} />
        <path d="M22 34 V22 a13 13 0 0 1 26 0 V34" fill="none" stroke={theme.dim} strokeWidth={3} {...lk} />
      </svg>
      <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 4}}>{label}</div>
      <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{sub}</div>
    </div>
  );
  return (
    <div style={{paddingTop: 90, paddingLeft: 140, display: 'flex', gap: 70, alignItems: 'flex-start'}}>
      {lock(l1, '声明锁 · 口径单点', '权威规章只印一本')}
      {lock(l2, '计算锁 · 查询期重算', '不是抄死的数字')}
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 60}}>
        {vendors.map((v, i) => (
          <div key={v.n} style={{opacity: cards[i], padding: '12px 20px', borderRadius: 8, border: `1px solid ${theme.panelBorder}`, background: theme.panel}}>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.text}}>{v.n}</span>
            <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginLeft: 12}}>{v.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 2-C 复印机陷阱：$100 进 → 三张副本 → 求和滚到 $300。
 *  爆红必须落在说出「放大成三百」的 p2-11 上（铁律⑤：时点由句边界推导）。 */
const CopierTrap: React.FC<{at: number; sumAt: number}> = ({at, sumAt}) => {
  const ps = useStagger(3, {at: at + 10, stride: 7, dur: DUR.f5});
  const total = useCount({from: 100, to: 300, at: sumAt, dur: DUR.f6});
  const boom = useImpulse({at: sumAt + 4, dur: DUR.f6});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 46, justifyContent: 'center', paddingTop: 60}}>
      <div style={{width: 220, padding: '24px 0', textAlign: 'center', borderRadius: 12, border: `2px solid ${theme.blueprint}`, background: `${theme.blueprint}12`, fontFamily: theme.mono, fontSize: 38, color: theme.blueprint}}>
        $100 订单
      </div>
      <div style={{fontSize: 54}}>🖨️</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{width: 200, padding: '10px 0', textAlign: 'center', borderRadius: 8, border: `2px dashed ${theme.danger}`, fontFamily: theme.mono, fontSize: 24, color: theme.danger, opacity: ps[i], transform: `translateX(${(1 - ps[i]) * -20}px)`}}>
            送货单 {i + 1}
          </div>
        ))}
      </div>
      <div style={{textAlign: 'center', transform: `scale(${1 + 0.1 * boom})`}}>
        <div style={{fontFamily: theme.mono, fontSize: 58, color: theme.danger, textShadow: `0 0 ${16 * boom}px ${theme.danger}88`}}>${total}</div>
        <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim}}>先连接再求和 · 复印了三份</div>
      </div>
    </div>
  );
};

/** 2-D 末快照时间闸：七天余额条「求和」堆叠 vs「末快照」只亮期末。 */
const SnapshotGate: React.FC<{at: number; clashAt: number}> = ({at, clashAt}) => {
  const frame = useCurrentFrame();
  const days = [2, 4, 5, 3, 6, 4, 5];
  return (
    <div style={{paddingTop: 70, paddingLeft: 200}}>
      <div style={{display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 26}}>
        {days.map((d, i) => {
          const p = progress(frame, at + i * 3, DUR.f4);
          const isLast = i === days.length - 1;
          return (
            <div key={i} style={{textAlign: 'center'}}>
              <div style={{width: 82, height: 26 * d * p, borderRadius: 5, background: isLast ? theme.grown : `${theme.blueprint}77`, boxShadow: isLast ? `0 0 18px ${theme.grown}88` : 'none'}} />
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 6}}>周{['一', '二', '三', '四', '五', '六', '日'][i]}</div>
            </div>
          );
        })}
      </div>
      <NumberClash badLabel="拆掉末快照 · 一月" bad="11" goodLabel="正确末快照 · 一月" good="5" at={clashAt} />
    </div>
  );
};

/** 2-E 三条字段纪律三卡。 */
const DisciplineCards: React.FC<{at: number}> = ({at}) => {
  const ps = useStagger(3, {at, stride: 10, dur: DUR.f5});
  const cards = [
    {t: '① 同义词必填', d: '没挂门牌的房间，AI 根本搜不到'},
    {t: '② 说明书随定义走', d: '写死在提示词里 = 第二个口径源'},
    {t: '③ 问答带签名溯源', d: '谁核的、何时核，随对象携带'},
  ];
  return (
    <div style={{display: 'flex', gap: 40, justifyContent: 'center', paddingTop: 120}}>
      {cards.map((c, i) => (
        <div key={c.t} style={{opacity: ps[i], transform: `translateY(${(1 - ps[i]) * 22}px)`, width: 330, padding: '24px 28px', borderRadius: 12, border: `1px solid ${theme.panelBorder}`, background: theme.panel}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.grown}}>{c.t}</div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 8}}>{c.d}</div>
        </div>
      ))}
    </div>
  );
};

export const P2Manual: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-06', 'p2-08');
  const bC = w('p2-09', 'p2-13');
  const bD = w('p2-14', 'p2-17');
  const bE = w('p2-18', 'p2-23');
  const bF = w('p2-24', 'p2-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A 规章手册与计算器">
        <SceneTag chapter="P2" tagline="规章手册" accent={theme.blueprint} />
        <ArchifyYield cues={[{at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')}]}>
          <ManualBook at={at('p2-01') - bA.from} calcAt={at('p2-05') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="collect-phase"
          caption="语义视图 · 受治理对象"
          cues={[{chapterId: 'semview', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')}]}
        />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bB} name="2-B 双失效面">
        <SceneTag chapter="P2" tagline="规章手册" accent={theme.blueprint} />
        <TwinLocks at={at('p2-06') - bB.from} />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bC} name="2-C 复印机陷阱 · 代码走廊①">
        <SceneTag chapter="P2" tagline="规章手册" accent={theme.blueprint} />
        <CopierTrap at={at('p2-09') - bC.from} sumAt={at('p2-11') - bC.from} />
        <div style={{position: 'absolute', left: 430, top: 640, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D1: 拆 agg-before-join → Jan 440（对照 200）', color: theme.grown, at: at('p2-13') - bC.from},
            ]}
            caption="lab D1 · fan trap 破坏实验"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bD} name="2-D 末快照 · 代码走廊②">
        <SceneTag chapter="P2" tagline="规章手册" accent={theme.blueprint} />
        <SnapshotGate at={at('p2-14') - bD.from} clashAt={at('p2-17') - bD.from} />
        <div style={{position: 'absolute', left: 430, top: 640, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D3: 拆 NON ADDITIVE → [11,6,7]（对照 [5,6,7]）', color: theme.grown, at: at('p2-17') - bD.from},
            ]}
            caption="lab D3 · 半可加破坏实验"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bE} name="2-E 金句与三纪律 · 代码走廊③">
        <SceneTag chapter="P2" tagline="规章手册" accent={theme.blueprint} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 170, textAlign: 'center', fontFamily: theme.serif, fontSize: 40, color: theme.text}}>
          语法全对，业务答案全错
        </div>
        <DisciplineCards at={at('p2-19') - bE.from} />
        <div style={{position: 'absolute', left: 430, top: 660, width: 1060}}>
          <TerminalLog
            prompt="uv run horizon_context_lab.py --selftest"
            lines={[
              {text: '[PASS] D6: relationship bad: customers.plan is not PRIMARY KEY/UNIQUE', color: theme.danger, at: at('p2-23') - bE.from},
            ]}
            caption="lab D6 · 注册期校验门"
          />
        </div>
        <PillarHUD lit={0} at={-30} />
      </Sequence>

      <Sequence {...bF} name="2-F 词条一生 · 代码走廊④">
        <SceneTag chapter="P2" tagline="规章手册" accent={theme.blueprint} />
        <ArchifyRecap
          slug="object-lifecycle"
          caption="词条的一生"
          cues={[{chapterId: 'full', at: at('p2-24') - bF.from, durationInFrames: dur('p2-24')}]}
        />
        <div style={{position: 'absolute', right: 90, top: 560, width: 640, display: 'flex', flexDirection: 'column', gap: 12}}>
          <OssieTag at={at('p2-25') - bF.from} />
          <TerminalLog
            prompt="POST /definitions"
            lines={[{text: '422 Unprocessable Entity — parse_definition 拒收', color: theme.grown, at: at('p2-26') - bF.from}]}
            caption="本仓注册表 · 非法注册拒收"
          />
        </div>
        <PillarHUD lit={1} at={at('p2-27') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 2-F Ossie 护照角标卡。 */
const OssieTag: React.FC<{at: number}> = ({at}) => {
  const o = useProgress(at, DUR.f5);
  return (
    <div style={{opacity: o, padding: '12px 18px', borderRadius: 8, border: `1px solid ${theme.grown}66`, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
      Apache Ossie · 开放语义规范 · 50+ 组织
    </div>
  );
};
