/** P3 规则与执法（p3-01..p3-21，21 句；storyboard v3「P3 规则与执法」节）。
 *
 *  10 镜 / 13 条 archify cue：
 *   3-B perpage@02 · 3-C family@03→instant-inspection@04（异 slug 背靠背，次实例 lead={false}）
 *   3-D single-point-bind@05→whoever-asks@06（同 slug 接力）· 3-E agent-recognized@08→agentface@09（异 slug，lead={false}）
 *   3-G teardown-leak@13→hide-not-block@14（同 slug，让尾窗）· 3-H sign-vs-wall@16→governed-path@17（同 slug）
 *   3-I guessed-name@18→two-layer-defense@19（异 slug，lead={false}）
 *
 *  archify full 全屏独占 ⇒ 同镜装置只住 cue 外句窗（ArchifyYield 让位）。装置窗对 cue 窗的
 *  三处小额偏移均为命名帧常量（时点仍由句边界推导，非写死绝对帧）：
 *   3-B 四术语卡先落、TERMS_HEAD 后 perpage 接棒（口播先报名目，图再展开）
 *   3-D 定义卡+紫挂扣先扣、CLASP_HEAD 后 single-point-bind 接棒（「策略挂上」母题拍点先落地）
 *   3-G hide-not-block 让出 p3-14 尾窗 ABLATION_TAIL 给消融装置——「执行层的拒绝是底线」
 *       收在绿墙落锁上；红侧 90→560 翻牌由 AblationPair 内置 meter 承担
 *
 *  已知门局限：3-G 动效列 `@count` 由 devices.AblationPair 的 meter 实现（幕级动效门不扫
 *  components/，预期 1 条 WARN——与「装置承担镜不写 @token」同类的假报，非真缺失）。
 *  自加元素：3-F 的 D5 拆除预告章（p3-12「把执行层的检查拆掉」的视觉落点，衔接 3-G）
 *  与求值巡游点（@travel 落点：判定进行中绕行、拆除预告出现即停）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useEnter,
  useProgress,
  useReveal,
  useShake,
  useSpring,
  useStagger,
  useTravel,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {AblationPair, DefinitionCard, EyeArray, QuoteCard, StateTrace} from '../components/devices';

/** #RRGGBB → rgba（devices 未导出 withAlpha 的本地替身；纯函数）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ── 装置窗偏移（archify full 独占下的小额编排常量） ─────────────────────────
const TERMS_HEAD = 30; // 3-B：四术语卡先落，随后 perpage 接棒
const CLASP_HEAD = 36; // 3-D：定义卡+紫挂扣先扣，随后 single-point-bind 接棒
const ABLATION_TAIL = 72; // 3-G：hide-not-block 让出 p3-14 尾窗给消融装置
const CLASP_SEATED = -30; // 3-J 回照：挂扣在 3-D 已扣上——负锚 = 入场前已完成

export const P3Policy: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 镜.from」。
  const bA = w('p3-01');
  const bB = w('p3-02');
  const bC = w('p3-03', 'p3-04');
  const bD = w('p3-05', 'p3-06');
  const bE = w('p3-07', 'p3-09');
  const bF = w('p3-10', 'p3-12');
  const bG = w('p3-13', 'p3-14');
  const bH = w('p3-15', 'p3-17');
  const bI = w('p3-18', 'p3-19');
  const bJ = w('p3-20', 'p3-21');
  // 3-F 走查四步锚在 p3-11 句窗的分数位（口播分句即步骤分界）
  const atP311 = (f: number) => at('p3-11') - bF.from + Math.round(dur('p3-11') * f);
  // 3-G 消融装置的尾窗起点（hide-not-block 让出的部分）
  const ablAt = at('p3-14') - bG.from + dur('p3-14') - ABLATION_TAIL;

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P3" tagline="规则与执法" accent={theme.conceptDeep} />

      {/* 3-A 谁可见：定义卡居中，人/报表工具/Agent 四周探出眼睛错峰睁亮 */}
      <Sequence {...bA} name="3-A 谁可见">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <DefinitionCard at={at('p3-01') - bA.from} title="净收入" />
        </AbsoluteFill>
        <EyeArray at={at('p3-01') - bA.from} />
      </Sequence>

      {/* 3-B 术语四连：四策略术语卡先落（@stagger），perpage 图接棒 */}
      <Sequence {...bB} name="3-B 术语四连">
        <ArchifyYield
          cues={[{at: at('p3-02') - bB.from + TERMS_HEAD, durationInFrames: dur('p3-02') - TERMS_HEAD}]}
        >
          <PolicyTerms at={at('p3-02') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="row-column-policy"
          caption="行·列策略族"
          cues={[
            {chapterId: 'perpage', at: at('p3-02') - bB.from + TERMS_HEAD, durationInFrames: dur('p3-02') - TERMS_HEAD},
          ]}
        />
      </Sequence>

      {/* 3-C 挂载位置：family（tag 绑定）→ instant-inspection（查询期求值）异 slug 接力 */}
      <Sequence {...bC} name="3-C 挂载位置">
        <ArchifyRecap
          slug="row-column-policy"
          caption="行·列策略族"
          cues={[{chapterId: 'family', at: at('p3-03') - bC.from, durationInFrames: dur('p3-03')}]}
        />
        <ArchifyRecap
          slug="query-time-policy"
          caption="查询期策略"
          lead={false}
          cues={[{chapterId: 'instant-inspection', at: at('p3-04') - bC.from, durationInFrames: dur('p3-04')}]}
        />
      </Sequence>

      {/* 3-D 两细节：定义卡母题紫挂扣先扣上（@spring），两章图接力 */}
      <Sequence {...bD} name="3-D 两细节">
        <ArchifyYield
          cues={[
            {at: at('p3-05') - bD.from + CLASP_HEAD, durationInFrames: dur('p3-05') - CLASP_HEAD},
            {at: at('p3-06') - bD.from, durationInFrames: dur('p3-06')},
          ]}
        >
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <DefinitionCard
              at={at('p3-05') - bD.from}
              enter="fade"
              title="净收入"
              claspAt={at('p3-05') - bD.from + 12}
              halo={0.5}
            />
          </AbsoluteFill>
        </ArchifyYield>
        <ArchifyRecap
          slug="multi-entry-single-truth"
          caption="多入口单一真相"
          cues={[
            {chapterId: 'single-point-bind', at: at('p3-05') - bD.from + CLASP_HEAD, durationInFrames: dur('p3-05') - CLASP_HEAD},
            {chapterId: 'whoever-asks', at: at('p3-06') - bD.from, durationInFrames: dur('p3-06')},
          ]}
        />
      </Sequence>

      {/* 3-E Agent 开关：人工=明文 / Agent=星号对照住无 cue 的 p3-07（遮罩扫过 + @reveal），两章图接力 */}
      <Sequence {...bE} name="3-E Agent 开关">
        <ArchifyYield
          cues={[
            {at: at('p3-08') - bE.from, durationInFrames: dur('p3-08')},
            {at: at('p3-09') - bE.from, durationInFrames: dur('p3-09')},
          ]}
        >
          <AgentSwitch
            at={at('p3-07') - bE.from}
            maskAt={at('p3-07') - bE.from + Math.round(dur('p3-07') * 0.45)}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="query-time-policy"
          caption="查询期策略"
          cues={[{chapterId: 'agent-recognized', at: at('p3-08') - bE.from, durationInFrames: dur('p3-08')}]}
        />
        <ArchifyRecap
          slug="row-column-policy"
          caption="行·列策略族"
          lead={false}
          cues={[{chapterId: 'agentface', at: at('p3-09') - bE.from, durationInFrames: dur('p3-09')}]}
        />
      </Sequence>

      {/* 3-F 走查：实习生查手机号四步状态走查（@travel 巡游点 + 步骤灯）；p3-12 落拆除预告章 */}
      <Sequence {...bF} name="3-F 走查">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'relative'}}>
            <StateTrace
              at={at('p3-10') - bF.from}
              inputs={[{label: '实习生 · 查手机号', sub: 'customers.phone'}]}
              engineTitle="治理引擎"
              engineTag="MASK · QUERY-TIME"
              stages={[
                {label: '请求进引擎', at: atP311(0.02)},
                {label: '命中该列掩码策略', at: atP311(0.3)},
                {label: '按策略主人规则判定', at: atP311(0.6)},
                {label: '带星号出引擎', at: atP311(0.85)},
              ]}
              output={{label: '出楼 · 掩码后', value: '✱✱✱✱', tone: theme.conceptDeep}}
              outputAt={atP311(0.92)}
              aside={{label: '策略主人', note: '≠ 提问者'}}
            />
            <EvalOrbit at={atP311(0.02)} offAt={at('p3-12') - bF.from} />
          </div>
        </AbsoluteFill>
        <TeardownChip at={at('p3-12') - bF.from} text="D5 · 即将拆除：执行层检查" />
      </Sequence>

      {/* 3-G 拆执行层：两章图让尾窗给红绿消融（左 90→560 泄露翻牌 / 右拦截墙落锁 @spring） */}
      <Sequence {...bG} name="3-G 拆执行层">
        <ArchifyYield
          cues={[
            {at: at('p3-13') - bG.from, durationInFrames: dur('p3-13')},
            {at: at('p3-14') - bG.from, durationInFrames: dur('p3-14') - ABLATION_TAIL},
          ]}
        >
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{position: 'relative'}}>
              <AblationPair
                at={ablAt}
                width={1560}
                left={{
                  tag: 'D5 · 拆执行层',
                  title: '明文泄露',
                  lines: ['实习生 → 查询计划', '执行层检查已拆除', '明文号码直出结果集'],
                  meter: {label: '明文值 · 本仓复算', from: 90, to: 560, at: ablAt + 10},
                  flow: {},
                }}
                right={{
                  tag: 'D5 · 门在位',
                  title: '当场被拒',
                  lines: ['同一请求 → 执行层', '掩码策略 · 查询期求值', '返回 blocked'],
                  flow: {},
                }}
              />
              <BlockWall at={ablAt + 28} />
            </div>
          </AbsoluteFill>
          <div style={{position: 'absolute', left: 84, bottom: 152}}>
            <EvidenceBadge level="filled" at={ablAt} note="D5 · 玩具原型实测" />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="hidden-vs-blocked"
          caption="藏 vs 拦"
          cues={[
            {chapterId: 'teardown-leak', at: at('p3-13') - bG.from, durationInFrames: dur('p3-13')},
            {chapterId: 'hide-not-block', at: at('p3-14') - bG.from, durationInFrames: dur('p3-14') - ABLATION_TAIL},
          ]}
        />
      </Sequence>

      {/* 3-H 执法位置：外挂（虚线抖动=漂移）vs 内嵌（一跳）拓扑住无 cue 的 p3-15，两章图接力 */}
      <Sequence {...bH} name="3-H 执法位置">
        <ArchifyYield
          cues={[
            {at: at('p3-16') - bH.from, durationInFrames: dur('p3-16')},
            {at: at('p3-17') - bH.from, durationInFrames: dur('p3-17')},
          ]}
        >
          <TopologyContrast at={at('p3-15') - bH.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="engine-governance"
          caption="引擎内治理"
          cues={[
            {chapterId: 'sign-vs-wall', at: at('p3-16') - bH.from, durationInFrames: dur('p3-16')},
            {chapterId: 'governed-path', at: at('p3-17') - bH.from, durationInFrames: dur('p3-17')},
          ]}
        />
      </Sequence>

      {/* 3-I 双层防线：检索层过滤 → 执行层再拒，异 slug 背靠背接力 */}
      <Sequence {...bI} name="3-I 双层防线">
        <ArchifyRecap
          slug="forced-query-intercept"
          caption="强制拦截"
          cues={[{chapterId: 'guessed-name', at: at('p3-18') - bI.from, durationInFrames: dur('p3-18')}]}
        />
        <ArchifyRecap
          slug="engine-governance"
          caption="引擎内治理"
          lead={false}
          cues={[{chapterId: 'two-layer-defense', at: at('p3-19') - bI.from, durationInFrames: dur('p3-19')}]}
        />
      </Sequence>

      {/* 3-J 规律金句：金句卡 @enter:pop + 定义卡母题短暂回照（挂扣已扣、微光 @breathe）+ 检验三连问角标 */}
      <Sequence {...bJ} name="3-J 规律金句">
        <JRecap at={at('p3-20') - bJ.from} />
        <QuoteCard
          at={at('p3-20') - bJ.from + 8}
          zh="强制力来自执行点"
          kicker="P3 · 一条底层规律"
          accent={theme.conceptDeep}
        />
        <TestChips at={at('p3-21') - bJ.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ── 3-B 四策略术语卡（反枚举：panel 底 + 编号，紫=策略族） ────────────────────

const POLICY_TERMS = [
  {n: '01', term: '掩码', tag: 'MASK', gloss: '按人打码敏感值'},
  {n: '02', term: '行访问', tag: 'ROW ACCESS', gloss: '无权的行整行扣掉'},
  {n: '03', term: '聚合约束', tag: 'AGGREGATION', gloss: '限制汇总粒度'},
  {n: '04', term: '投影限制', tag: 'PROJECTION', gloss: '某列不出现在结果'},
] as const;

const PolicyTerms: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(POLICY_TERMS.length, {at, stride: 7, dur: DUR.f3});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 20}}>
        {POLICY_TERMS.map((t, i) => (
          <div
            key={t.term}
            style={{
              width: 316,
              borderRadius: 12,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
              padding: '20px 22px',
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 22}px)`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.conceptDeep}}>{t.n}</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 12.5,
                  letterSpacing: 1,
                  color: theme.dim,
                  border: `1.5px solid ${theme.panelBorder}`,
                  borderRadius: 6,
                  padding: '2px 7px',
                }}
              >
                {t.tag}
              </span>
            </div>
            <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>
              {t.term}
            </div>
            <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{t.gloss}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-E 人工明文 / Agent 星号对照 ────────────────────────────────────────────

const PHONE = '138-0013-8000';
const DIGITS = PHONE.split('').filter((c) => c !== '-').length;

const QueryRow: React.FC<{
  e: {opacity: number; transform: string};
  label: string;
  en: string;
  value: string;
  valueColor: string;
  accent: string;
  right?: React.ReactNode;
}> = ({e, label, en, value, valueColor, accent, right}) => (
  <div
    style={{
      ...e,
      width: 940,
      borderRadius: 14,
      border: `2px solid ${accent}`,
      background: theme.panel,
      padding: '20px 30px',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
    }}
  >
    <div style={{width: 190, display: 'flex', flexDirection: 'column', gap: 6}}>
      <span style={{fontFamily: theme.sans, fontSize: 29, fontWeight: 600, color: theme.text}}>{label}</span>
      <span style={{fontFamily: theme.mono, fontSize: 13, letterSpacing: 2, color: theme.dim}}>{en}</span>
    </div>
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 44,
        letterSpacing: 3,
        color: valueColor,
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </div>
    {right ? <div style={{width: 240, display: 'flex', justifyContent: 'flex-end'}}>{right}</div> : <div style={{width: 240}} />}
  </div>
);

/** Agent 侧开关：拨杆 snap 到 ON + IS_AGENT_ACTIVATED 逐字打印。 */
const AgentToggle: React.FC<{at: number; tag: string}> = ({at, tag}) => {
  const s = useSpring('snap', {at, dur: DUR.f4});
  const frame = useCurrentFrame();
  const o = progress(frame, at, 4);
  return (
    <div style={{opacity: o, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9}}>
      <div
        style={{
          position: 'relative',
          width: 58,
          height: 27,
          borderRadius: 14,
          border: `2px solid ${theme.conceptDeep}`,
          background: withA(theme.conceptDeep, 0.16),
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2.5,
            left: 3 + (1 - Math.min(1, s)) * 30,
            width: 18,
            height: 18,
            borderRadius: 9,
            background: theme.conceptDeep,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 13.5,
          letterSpacing: 1,
          color: theme.conceptDeep,
          whiteSpace: 'nowrap',
          minHeight: 17,
        }}
      >
        {tag}
      </span>
    </div>
  );
};

const AgentSwitch: React.FC<{at: number; maskAt: number}> = ({at, maskAt}) => {
  const eHuman = useEnter('rise', {at, dur: DUR.f4, dist: 24});
  const eAgent = useEnter('rise', {at: at + 6, dur: DUR.f4, dist: 24});
  const sweep = useProgress(maskAt, 28);
  const tag = useReveal('IS_AGENT_ACTIVATED', {at: maskAt - 8, cps: 16});
  // 星号遮罩扫过：sweep 进度把数字逐位翻成 ✱（纯函数逐字符推导，帧驱动确定）
  let seen = 0;
  const masked = PHONE.split('')
    .map((c) => {
      if (c === '-') return c;
      seen += 1;
      return seen <= Math.round(sweep * DIGITS) ? '✱' : c;
    })
    .join('');
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
      <QueryRow e={eHuman} label="人工查询" en="HUMAN SESSION" value={PHONE} valueColor={theme.text} accent={theme.panelBorder} />
      <QueryRow
        e={eAgent}
        label="Agent 会话"
        en="AGENT SESSION"
        value={masked}
        valueColor={theme.conceptDeep}
        accent={theme.conceptDeep}
        right={<AgentToggle at={maskAt} tag={tag} />}
      />
    </AbsoluteFill>
  );
};

// ── 3-F 求值巡游点 / 拆除预告章 ──────────────────────────────────────────────

/** 引擎面板右上角「查询期求值」巡游点（@travel 落点）：四步判定进行中绕行，
 *  p3-12 拆除预告出现即停——执行层检查被拆，求值循环停转。 */
const ORBIT = {x: 1040, y: 56} as const;
const EvalOrbit: React.FC<{at: number; offAt: number}> = ({at, offAt}) => {
  const frame = useCurrentFrame();
  const pos = useTravel({cx: 0, cy: 0, r: 12, secPerLap: 1.5});
  const o = progress(frame, at, DUR.f3) * (1 - progress(frame, offAt, DUR.f3));
  return (
    <div style={{position: 'absolute', left: ORBIT.x, top: ORBIT.y, opacity: o}}>
      <svg width={40} height={40} viewBox="0 0 40 40">
        <circle cx={20} cy={20} r={12} fill="none" stroke={withA(theme.conceptDeep, 0.55)} strokeWidth={2} />
        <circle cx={20 + pos.x} cy={20 + pos.y} r={4.5} fill={theme.conceptDeep} />
      </svg>
    </div>
  );
};

const TeardownChip: React.FC<{at: number; text: string}> = ({at, text}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  const shake = useShake({at: at + 5, amp: 1.8, freq: 2.4, decay: true, dur: 26});
  return (
    <div
      style={{
        ...e,
        position: 'absolute',
        top: 104,
        left: '50%',
        transform: `${e.transform} translateX(-50%) translateX(${shake}px)`,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          padding: '8px 18px',
          borderRadius: 9,
          border: `2px dashed ${theme.danger}`,
          background: withA(theme.danger, 0.07),
          fontFamily: theme.mono,
          fontSize: 18,
          letterSpacing: 1,
          color: theme.danger,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ── 3-G 绿侧拦截墙（@spring：竖杆落下 + 横闩锁死右面板出口） ──────────────────

const BlockWall: React.FC<{at: number}> = ({at}) => {
  const s = useSpring('snap', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const o = progress(frame, at, 4);
  const seat = Math.min(1, s);
  return (
    <div style={{position: 'absolute', right: -14, top: 6, bottom: 6, width: 86, opacity: o}}>
      {[18, 55].map((x) => (
        <div
          key={x}
          style={{
            position: 'absolute',
            left: x,
            top: 0,
            bottom: 0,
            width: 13,
            borderRadius: 6,
            background: theme.ok,
            transform: `scaleY(${seat})`,
            transformOrigin: 'top',
            boxShadow: `0 0 16px ${withA(theme.ok, 0.4)}`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          top: '34%',
          height: 9,
          borderRadius: 4,
          background: theme.ok,
          transform: `scaleX(${seat})`,
          transformOrigin: 'left',
        }}
      />
    </div>
  );
};

// ── 3-H 外挂 vs 内嵌拓扑 ─────────────────────────────────────────────────────

const TBox: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  tone?: string;
  dashed?: boolean;
  shift?: number;
}> = ({x, y, w, h, label, sub, tone, dashed = false, shift = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: 10,
      border: `2px ${dashed ? 'dashed' : 'solid'} ${tone ? withA(tone, 0.75) : theme.panelBorder}`,
      background: withA(theme.text, 0.045),
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      transform: `translateX(${shift}px)`,
    }}
  >
    <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: tone ?? theme.text}}>{label}</span>
    {sub ? <span style={{fontFamily: theme.mono, fontSize: 13.5, color: theme.dim}}>{sub}</span> : null}
  </div>
);

const TopologyContrast: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(2, {at, stride: 9, dur: DUR.f5});
  const drift = useShake({at: at + 16, amp: 2.4, freq: 2.2});
  const frame = useCurrentFrame();
  const warnO = progress(frame, at + 30, DUR.f4);
  const noteO = progress(frame, at + 44, DUR.f4);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 44}}>
      {/* 外挂：语义层旁挂系统旁，每次查询两套对账——虚线抖动 = 定义漂移感 */}
      <div
        style={{
          width: 700,
          height: 380,
          opacity: st[0],
          transform: `translateY(${(1 - st[0]) * 24}px)`,
          borderRadius: 14,
          border: `2px dashed ${theme.panelBorder}`,
          background: theme.panel,
          position: 'relative',
        }}
      >
        <div style={{position: 'absolute', top: 18, left: 24, fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: theme.dim}}>
          {'SIDECAR · 外挂语义层'}
        </div>
        <svg width={700} height={380} viewBox="0 0 700 380" style={{position: 'absolute', inset: 0}}>
          <defs>
            <marker id="tc-a" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={withA(theme.dim, 0.8)} />
            </marker>
          </defs>
          <line x1={350} y1={112} x2={163} y2={196} stroke={withA(theme.dim, 0.65)} strokeWidth={2} markerEnd="url(#tc-a)" />
          <line x1={350} y1={112} x2={537} y2={196} stroke={withA(theme.dim, 0.65)} strokeWidth={2} markerEnd="url(#tc-a)" />
          <line x1={288} y1={236} x2={412} y2={236} stroke={withA(theme.dim, 0.75)} strokeWidth={2} strokeDasharray="7 7" />
        </svg>
        <TBox x={250} y={58} w={200} h={54} label="AI 应用" />
        <TBox x={48} y={200} w={230} h={74} label="语义层 · 旁挂" sub="定义在系统外" tone={theme.dim} dashed shift={drift} />
        <TBox x={422} y={200} w={230} h={74} label="查询引擎" sub="跑数" />
        <div
          style={{
            position: 'absolute',
            left: 218,
            top: 250,
            width: 264,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 14.5,
            color: theme.dim,
            opacity: noteO,
          }}
        >
          {'每次查询 · 两套对账'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: 168,
            padding: '4px 12px',
            borderRadius: 7,
            border: `1.5px dashed ${withA(theme.dim, 0.7)}`,
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.dim,
            opacity: warnO,
          }}
        >
          {'定义漂移风险'}
        </div>
      </div>
      {/* 内嵌：定义住在治理引擎里，查询时强制执行（一跳） */}
      <div
        style={{
          width: 700,
          height: 380,
          opacity: st[1],
          transform: `translateY(${(1 - st[1]) * 24}px)`,
          borderRadius: 14,
          border: `2.5px solid ${theme.conceptDeep}`,
          background: theme.panel,
          position: 'relative',
        }}
      >
        <div style={{position: 'absolute', top: 18, left: 24, fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: theme.conceptDeep}}>
          {'GOVERNED · 定义内嵌'}
        </div>
        <svg width={700} height={380} viewBox="0 0 700 380" style={{position: 'absolute', inset: 0}}>
          <defs>
            <marker id="tc-b" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={theme.conceptDeep} />
            </marker>
          </defs>
          <line x1={350} y1={112} x2={350} y2={192} stroke={theme.conceptDeep} strokeWidth={2.5} markerEnd="url(#tc-b)" />
        </svg>
        <TBox x={250} y={58} w={200} h={54} label="AI 应用" />
        <TBox x={90} y={196} w={520} h={92} label="治理引擎" sub="定义 · 策略 · 执行同点" tone={theme.conceptDeep} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 306,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 15.5,
            color: theme.text,
            opacity: noteO,
          }}
        >
          {'查询时强制执行 · 一跳'}
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 336, display: 'flex', justifyContent: 'center', gap: 14, opacity: noteO}}>
          {['不复制', '不缓存'].map((c) => (
            <span
              key={c}
              style={{
                padding: '3px 12px',
                borderRadius: 7,
                border: `1.5px solid ${withA(theme.conceptDeep, 0.55)}`,
                fontFamily: theme.mono,
                fontSize: 14,
                color: theme.conceptDeep,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-J 定义卡母题回照（挂扣已扣、微光 @breathe）+ 检验三连问角标 ────────────

const JRecap: React.FC<{at: number}> = ({at}) => {
  const glow = useBreathe({period: 190, base: 0.3, amp: 0.5});
  return (
    <AbsoluteFill style={{display: 'flex', justifyContent: 'center', alignItems: 'flex-start'}}>
      <div style={{marginTop: 64}}>
        <DefinitionCard at={at} enter="pop" title="净收入" claspAt={CLASP_SEATED} halo={glow} scale={0.5} />
      </div>
    </AbsoluteFill>
  );
};

const TEST_CHIPS = [
  {q: 'Q1', label: '策略挂在哪'},
  {q: 'Q2', label: '哪一层求值'},
  {q: 'Q3', label: '拆了会漏吗'},
] as const;

const TestChips: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(TEST_CHIPS.length, {at, stride: 8, dur: DUR.f4});
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 18});
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 158,
      }}
    >
      <div style={{...e, fontFamily: theme.mono, fontSize: 17, letterSpacing: 3, color: theme.dim, marginBottom: 14}}>
        {'绕开执行点 · 三连检验'}
      </div>
      <div style={{display: 'flex', gap: 18}}>
        {TEST_CHIPS.map((c, i) => (
          <div
            key={c.q}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 10,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 14}px)`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.conceptDeep}}>{c.q}</span>
            <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{c.label}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
