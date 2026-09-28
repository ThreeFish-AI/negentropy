/** P3 抽屉与手册（p3-01..24，5 镜 16 cue）——分镜 3-A…3-E。
 *
 *  叙事链：坑三「全款付费」对账（大部头拼进垫纸的滚屏反例）→ 抽屉两层（图集）→
 *  注册表按名查找（图集）→ 两层寿命差（图集）→ 官方延伸双例小卡＋收束题词。
 *  空间契约：台面（coreDeep 大矩形，DESK 锚位）恒居中央恒静〔M-001〕；mech 紫垫纸层
 *  承装大部头；装置动效只作用于台面内容物。中段三镜（3-B/3-C/3-D）全屏图集承载，
 *  自制装置只在首尾两镜出现——3-C 承 3-B、3-D 承 3-C，两实例 lead={false}。
 *
 *  本文件另承载本路三幕共用的两个小形态：PitCard（坑位对账卡，P4/P5 复用）与
 *  PadSheet（垫纸层，P4 复用）——几何一律从 motifs 的 DESK 推导，不散抄数字。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DESK, DeskPlane, Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useCount, useEnter, useProgress, useReveal, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行的左侧（P1–P6 同值，见 references/08「HarnessBadge 共存」）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 坑位编号 → 中文数字（对账卡「坑三」用） */
const ZH_NUM = ['一', '二', '三', '四'] as const;

/** 坑位对账卡（各幕开坑回顾的共用形态，与 P1/P2 同款紧凑胶囊——chrome 对齐
 *  P1TodoCard/P2SideDesk 的既定形态：mono 编号 mech + sans 标签，left 96 / top 132）。
 *  本路扩展：deny 档（危险复盘）与 sub 徽标、pulse 辉光（数值由调用侧注入，
 *  动效锚点留在场景时序里）。 */
export const PitCard: React.FC<{
  n: number;
  title: string;
  sub?: string;
  deny?: boolean;
  at?: number;
  pulse?: number;
  style?: React.CSSProperties;
}> = ({n, title, sub, deny = false, at = 0, pulse = 0, style}) => {
  const e = useEnter('fade', {at, dur: DUR.f5});
  const c = deny ? theme.deny : theme.mech;
  return (
    <div style={{position: 'absolute', left: 96, top: 132, ...e, ...style}}>
      <Panel
        accent={c}
        style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          boxShadow: pulse > 0.02 ? `0 0 ${46 * pulse}px ${c}` : undefined,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 26, color: c}}>{`坑${ZH_NUM[n - 1] ?? n}`}</span>
        <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{title}</span>
        {sub ? (
          <span
            style={{
              fontFamily: theme.sans,
              fontSize: 24,
              color: c,
              border: `2px solid ${c}`,
              borderRadius: 8,
              padding: '2px 10px',
            }}
          >
            {sub}
          </span>
        ) : null}
      </Panel>
    </div>
  );
};

/** 垫纸（系统提示层）：台面内的 mech 紫装置层——P3 大部头与 P4 写死串的承装面。
 *  几何从 DESK 推导（P4 复用同款，勿散抄数字）；面色是 mech 5% 的确定性 hex 派生。 */
const PAD_INSET = 34;
export const PadSheet: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: DESK.left + PAD_INSET,
      top: DESK.top + PAD_INSET,
      width: DESK.w - PAD_INSET * 2,
      height: DESK.h - PAD_INSET * 2,
      borderRadius: 10,
      border: `3px solid ${theme.mech}`,
      background: '#9C90EE0D',
      opacity,
    }}
  />
);

// ── 3-A 坑三对账＋大部头反例（p3-01..04） ────────────────────────────────

/** 三份大部头（无彩 dim——装置才有颜色）：行宽各册固定形态，帧驱动可复现。 */
const BOOKS = [
  {label: '样式规范', widths: [0.92, 0.66, 0.84, 0.58, 0.78, 0.5]},
  {label: '数据库规范', widths: [0.86, 0.74, 0.62, 0.8, 0.54, 0.7]},
  {label: '接口规范', widths: [0.78, 0.9, 0.6, 0.72, 0.82, 0.56]},
] as const;

const BOOK_W = 268;
const BOOK_X = [528, 818, 1108] as const;

/** 单册大部头：册脊标签逐字流出 + 内页行条错峰滚出；hot＝被点名携带（边框提亮的持续态）。 */
const SpecBook: React.FC<{
  label: string;
  widths: readonly number[];
  enter: number;
  hot: number;
  at: number;
}> = ({label, widths, enter, hot, at}) => {
  const typed = useReveal(label, {at: at + 4, cps: 7});
  const bars = useStagger(widths.length, {at: at + 10, stride: 7, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: BOOK_W, opacity: enter, transform: `translateY(${(1 - enter) * 18}px)`}}>
      <Panel accent={hot > 0.4 ? theme.text : theme.panelBorder} style={{padding: '18px 20px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text, letterSpacing: 1}}>
          {typed}
        </div>
        <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 13}}>
          {widths.map((wf, i) => (
            <div
              key={i}
              style={{
                height: 9,
                width: `${100 * wf}%`,
                background: theme.dim,
                borderRadius: 3,
                opacity: 0.34 * bars[i],
              }}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
};

const CostOfKnowledge: React.FC<{at2: number; at3: number; at4: number; dur2: number; dur4: number}> = ({
  at2,
  at3,
  at4,
  dur2,
  dur4,
}) => {
  const desk = useProgress(at2, DUR.f5); // 台面/垫纸整层浮现（框体自身恒静，无形状动效）
  const bookEnters = useStagger(BOOKS.length, {at: at2 + 4, stride: 12, dur: DUR.f4});
  const hots = useStagger(BOOKS.length, {at: at3, stride: 12, dur: DUR.f4});
  // 「六千多行」叙事口径数字卡（p3-02 句窗内滚到位）
  const lines = useCount({to: 6000, at: at2 + 6, dur: Math.max(DUR.f6, dur2)});
  // p3-04 每轮付费刻度累积（句窗内逐轮点亮、末轮填满＝持续态陈述〔M-003〕）
  const rounds = useCount({to: 6, at: at4, dur: dur4});
  const litRounds = Math.round(rounds);

  return (
    <AbsoluteFill>
      <PitCard n={3} title="全款付费" at={2} />

      {/* 台面恒静〔M-001〕＋mech 垫纸层＝大部头的承装面 */}
      <DeskPlane opacity={desk} />
      <PadSheet opacity={desk} />
      <div style={{position: 'absolute', left: 540, top: 318, fontFamily: theme.sans, fontSize: 22, color: theme.dim, opacity: desk}}>
        {'垫纸'}
      </div>

      {/* 三大部头拼进垫纸（滚屏逐行） */}
      {BOOKS.map((b, i) => (
        <div key={b.label} style={{position: 'absolute', left: BOOK_X[i], top: 386}}>
          <SpecBook label={b.label} widths={b.widths} enter={bookEnters[i]} hot={hots[i]} at={at2 + 4 + i * 12} />
        </div>
      ))}

      {/* 「六千多行」数字卡（叙事口径） */}
      <div style={{position: 'absolute', left: 1492, top: 320, width: 372, opacity: desk}}>
        <Panel style={{padding: '22px 26px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 60, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            {`${Math.round(lines).toLocaleString('en-US')}+`}
          </div>
          <div style={{marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{'多行'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'叙事口径'}</span>
          </div>
        </Panel>
      </div>

      {/* 每轮付费刻度：一轮一根、逐轮点亮（p3-04） */}
      <div style={{position: 'absolute', left: 1492, top: 520, width: 372, opacity: desk}}>
        <Panel style={{padding: '22px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'每轮照付'}</div>
          <div style={{marginTop: 16, display: 'flex', gap: 8}}>
            {Array.from({length: 6}, (_, i) => (
              <div
                key={i}
                style={{
                  width: 40,
                  height: 12,
                  borderRadius: 3,
                  background: theme.text,
                  opacity: i < litRounds ? 0.92 : 0.16,
                }}
              />
            ))}
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'无关 · 也照付'}</div>
        </Panel>
      </div>

      <Footnote delay={at2}>{'system prompt'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-E 官方延伸双例（p3-21..24） ────────────────────────────────────────

const EXTS = [
  {no: '例一', label: '子目录惰性', sub: '首触目录才加载'},
  {no: '例二', label: '先收后展', sub: '外部工具定义'},
] as const;

const OfficialExtensions: React.FC<{at22: number; at23: number; at24: number}> = ({at22, at23, at24}) => {
  const kicker = useEnter('fade', {at: 2, dur: DUR.f5});
  const cards = useStagger(EXTS.length, {at: at22, stride: Math.max(2, at23 - at22), dur: DUR.f4});
  const moral = useEnter('fade', {at: at24, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 172, width: 1920, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, ...kicker}}>
        <div style={{width: 130, height: 2, background: theme.panelBorder}} />
        <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.dim}}>{'官方延伸'}</span>
        <div style={{width: 130, height: 2, background: theme.panelBorder}} />
      </div>

      {EXTS.map((x, i) => (
        <div
          key={x.no}
          style={{
            position: 'absolute',
            left: 364 + i * (560 + 72),
            top: 330,
            width: 560,
            opacity: cards[i],
            transform: `translateY(${(1 - cards[i]) * 22}px)`,
          }}
        >
          <Panel accent={cards[i] > 0.5 ? theme.mech : theme.panelBorder} style={{padding: '24px 30px', minHeight: 150}}>
            <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{x.no}</div>
            <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 600, color: theme.text, marginTop: 8}}>{x.label}</div>
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 8}}>{x.sub}</div>
          </Panel>
        </div>
      ))}

      {/* 收束题词（压短形态，终态停驻） */}
      <div style={{position: 'absolute', left: 0, top: 640, width: 1920, textAlign: 'center', ...moral}}>
        <span style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.text}}>{'先知道 · 再递手册'}</span>
      </div>

      <Footnote delay={at22}>{'deferred by default'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3SkillDrawers: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-09');
  const bC = w('p3-10', 'p3-14');
  const bD = w('p3-15', 'p3-20');
  const bE = w('p3-21', 'p3-24');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 坑三对账">
        <SceneTag chapter="Skill Drawers" tagline="抽屉与手册" />
        <CostOfKnowledge
          at2={at('p3-02') - bA.from}
          at3={at('p3-03') - bA.from}
          at4={at('p3-04') - bA.from}
          dur2={dur('p3-02')}
          dur4={dur('p3-04')}
        />
      </Sequence>

      {/* 前镜自制装置 → 首章默认入场；章内背靠背自动抑制换章弹入 */}
      <Sequence {...bB} name="3-B 抽屉两层">
        <ArchifyRecap
          slug="plan-skill-layers"
          caption="抽屉两层"
          cues={[
            {chapterId: 'drawer-labels', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'manual-inside', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {chapterId: 'cheap-catalog', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
            {chapterId: 'costly-fulltext', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
            {chapterId: 'split-in-time', at: at('p3-09') - bB.from, durationInFrames: dur('p3-09')},
          ]}
        />
      </Sequence>

      {/* 承 3-B 背靠背 → 本镜实例 lead={false}（storyboard 清单） */}
      <Sequence {...bC} name="3-C 注册表按名取">
        <ArchifyRecap
          slug="plan-skill-registry"
          caption="注册表按名取"
          lead={false}
          cues={[
            {chapterId: 'name-only', at: at('p3-10') - bC.from, durationInFrames: dur('p3-10')},
            {chapterId: 'startup-scan', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')},
            {chapterId: 'name-for-fulltext', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')},
            {chapterId: 'no-path-to-forge', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')},
            {chapterId: 'designed-away', at: at('p3-14') - bC.from, durationInFrames: dur('p3-14')},
          ]}
        />
      </Sequence>

      {/* 承 3-C 背靠背 → 本镜实例 lead={false} */}
      <Sequence {...bD} name="3-D 两层寿命差">
        <ArchifyRecap
          slug="plan-skill-lifespan"
          caption="两层寿命差"
          lead={false}
          cues={[
            {chapterId: 'lifespan-split', at: at('p3-15') - bD.from, durationInFrames: dur('p3-15')},
            {chapterId: 'manual-in-history', at: at('p3-16') - bD.from, durationInFrames: dur('p3-16')},
            {chapterId: 'compact-sweeps', at: at('p3-17') - bD.from, durationInFrames: dur('p3-17')},
            {chapterId: 'label-stays', at: at('p3-18') - bD.from, durationInFrames: dur('p3-18')},
            {chapterId: 're-paste-budget', at: at('p3-19') - bD.from, durationInFrames: dur('p3-19')},
            {chapterId: 'pair-not-either', at: at('p3-20') - bD.from, durationInFrames: dur('p3-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="3-E 官方延伸双例">
        <OfficialExtensions
          at22={at('p3-22') - bE.from}
          at23={at('p3-23') - bE.from}
          at24={at('p3-24') - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3SkillDrawers;

/** 场景代理路由名（Stage ⑧ 工单）→ 同一组件，供 Main.tsx 两侧命名互通。 */
export const P3Paper = P3SkillDrawers;
