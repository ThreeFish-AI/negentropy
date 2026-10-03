/** P6 刻意做小（p6-01..p6-16，镜 6-A..6-D）——五规律卡墙逐张点亮（第六格
 *  空框描边：留白即答案）→ dt-gate 守门哲学回响 + 全屏金句「刻意不做」
 *  + 46 家名单墙淡影 + 三枚留白标签飘出边缘 → 三句如实护栏
 *  （allowed-tools 行动小字）→ 开场目录树同机位回扣（已读亮的目录行）+
 *  my-rules 两行必填敲定 → 末 beat 渐黑收尾（SceneFade 幕间已管、末幕自管）。
 *  幕主色 concept/deny 交替：卡墙靛紫交替、金句账本金、护栏治理紫；〔M-003〕
 *  目录树在 6-D 以 P0 同机位同色复现（全片首尾锚）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useDim,
  useDraw,
  useEnter,
  useFadeOut,
  useProgress,
  usePushIn,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {MENU_ROWS, Stage} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

// ── 6-A 五规律卡墙 ────────────────────────────────────────────────────────

/** 五条规律：句 id（点亮锚）+ 编号 + ≤6 字关键词 + 该幕标志画面缩略。
 *  缩略不进口播，只留各幕的标志图形（菜单行/招牌/门牌/文本页/空框）。 */
const RULES = [
  {id: 'p6-02', n: '01', keyword: '按使用付费', thumb: 'menu'},
  {id: 'p6-03', n: '02', keyword: '一句话路由', thumb: 'sign'},
  {id: 'p6-04', n: '03', keyword: '门牌即身份', thumb: 'door'},
  {id: 'p6-05', n: '04', keyword: '文本非代码', thumb: 'page'},
  {id: 'p6-06', n: '05', keyword: '互操作优先', thumb: 'blank'},
] as const;

/** 缩略①菜单行（P2 标志画面）：三行菜名+一句话，中间一行金色=常驻的那一行。 */
const MenuRowThumb: React.FC = () => (
  <div style={{width: 212, display: 'flex', flexDirection: 'column', gap: 9}}>
    {[0, 1, 2].map((i) => {
      const hot = i === 1;
      return (
        <div key={i} style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: hot ? theme.concept : theme.panelBorder,
            }}
          />
          <span
            style={{
              width: 56,
              height: 9,
              borderRadius: 3,
              background: hot ? theme.concept : `${theme.dim}55`,
            }}
          />
          <span
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              background: hot ? `${theme.concept}59` : `${theme.panelBorder}55`,
            }}
          />
        </div>
      );
    })}
  </div>
);

/** 缩略②招牌（P3）：靛框吊臂招牌，一句话独扛路由。 */
const SignThumb: React.FC = () => (
  <div
    style={{
      position: 'relative',
      width: 176,
      border: `2.5px solid ${theme.conceptDeep}`,
      borderRadius: 8,
      background: theme.panel,
      padding: '16px 14px 12px',
      textAlign: 'center',
    }}
  >
    {/* 吊臂 */}
    <div style={{position: 'absolute', top: -11, left: 20, width: 4, height: 11, background: theme.panelBorder}} />
    <div style={{position: 'absolute', top: -11, right: 20, width: 4, height: 11, background: theme.panelBorder}} />
    <div style={{fontFamily: theme.mono, fontSize: 14.5, color: theme.conceptDeep}}>一句话</div>
    <div style={{fontFamily: theme.mono, fontSize: 11.5, color: theme.dim, marginTop: 4}}>description</div>
  </div>
);

/** 缩略③门牌（P1）：靛底门牌，name 与户口登记名逐字一致。 */
const DoorThumb: React.FC = () => (
  <div style={{width: 158, background: theme.conceptDeep, borderRadius: 10, padding: '10px 16px', textAlign: 'center'}}>
    <div style={{fontSize: 10.5, color: theme.bg, opacity: 0.72, letterSpacing: 2}}>户口登记名</div>
    <div style={{fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.bg, marginTop: 2}}>name</div>
  </div>
);

/** 缩略④文本页（P1/P2）：SKILL.md 被解释的正文——自由格式的行。 */
const PageThumb: React.FC = () => (
  <div
    style={{
      width: 122,
      border: `1.5px solid ${theme.panelBorder}`,
      borderRadius: 6,
      background: theme.panel,
      padding: '10px 12px',
    }}
  >
    <div style={{fontFamily: theme.mono, fontSize: 10.5, color: theme.dim, marginBottom: 7}}>SKILL.md</div>
    <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
      {[0.94, 0.72, 0.86, 0.55].map((wd, i) => (
        <div
          key={i}
          style={{
            width: `${wd * 100}%`,
            height: 5,
            borderRadius: 3,
            background: i === 1 ? theme.dim : `${theme.dim}44`,
          }}
        />
      ))}
    </div>
  </div>
);

/** 缩略⑤空框（P4/P5 互操作留白）：刻意没装的那一格。 */
const BlankThumb: React.FC = () => (
  <div style={{width: 158, height: 88, border: `2px dashed ${theme.panelBorder}`, borderRadius: 8}} />
);

/** 规律卡：编号 + 关键词 + 缩略；点亮 = 边框换靛/紫 + 辉光 + 缩略浮现
 *  （弹簧只走空间位移，边框/辉光/浮字走 progress——铁律③）。 */
const RuleCard: React.FC<{
  n: string;
  keyword: string;
  accent: string;
  litAt: number;
  entered: number;
  children?: React.ReactNode;
}> = ({n, keyword, accent, litAt, entered, children}) => {
  const frame = useCurrentFrame();
  const pop = useSpring('settle', {at: litAt, dur: DUR.f5}); // 空间：点亮轻弹
  const lit = progress(frame, litAt, DUR.f4); // 效果：边框/辉光/浮字
  return (
    <div
      style={{
        width: 372,
        height: 268,
        boxSizing: 'border-box',
        background: theme.panel,
        border: `1.5px solid ${lit > 0 ? accent : theme.panelBorder}`,
        borderRadius: 12,
        padding: '16px 20px 14px',
        opacity: entered,
        transform: `translateY(${(1 - entered) * -18}px) scale(${0.985 + 0.015 * pop})`,
        boxShadow: lit > 0 ? `0 0 ${Math.round(10 + 22 * lit)}px ${accent}2e` : 'none',
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 19, color: lit > 0 ? accent : theme.dim, letterSpacing: 2}}>
        {n}
      </div>
      <div
        style={{
          height: 118,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 10,
          opacity: lit,
          transform: `translateY(${(1 - lit) * 10}px)`,
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontSize: 23,
          fontWeight: 600,
          color: lit > 0 ? theme.text : theme.dim,
          marginTop: 12,
          letterSpacing: 1,
        }}
      >
        {keyword}
      </div>
    </div>
  );
};

/** 第六格空框：p6-06 后半句描边点亮——留白即答案（靛紫交替的第 6 格=紫）。
 *  底框常驻极淡虚线占位，deny 描边走 pathLength（useDraw）从无到有。 */
const BLANK_RECT = 'M 14 2 H 358 Q 370 2 370 14 V 254 Q 370 266 358 266 H 14 Q 2 266 2 254 V 14 Q 2 2 14 2 Z';
const BlankCell: React.FC<{at: number; entered: number}> = ({at, entered}) => {
  const frame = useCurrentFrame();
  const draw = useDraw(at, DUR.f6);
  const labelP = progress(frame, at + 8, DUR.f4);
  return (
    <div
      style={{
        width: 372,
        height: 268,
        boxSizing: 'border-box',
        position: 'relative',
        border: `1.5px dashed ${theme.panelBorder}55`,
        borderRadius: 12,
        opacity: entered,
        transform: `translateY(${(1 - entered) * -18}px)`,
      }}
    >
      <svg width={372} height={268} viewBox="0 0 372 268" style={{position: 'absolute', left: 0, top: 0}}>
        <path d={BLANK_RECT} fill={`${theme.deny}0a`} stroke={theme.deny} strokeWidth={2.5} strokeLinecap="round" {...draw} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 34,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 21,
          color: theme.deny,
          opacity: labelP,
          letterSpacing: 2,
        }}
      >
        留白即答案
      </div>
    </div>
  );
};

/** 卡墙编排：p6-01 六格收拢落位 → p6-02..06 每句点亮一张（靛/紫交替）→
 *  p6-06 后半句第六格空框描边。 */
const RuleWall: React.FC<{wallAt: number; litAts: number[]; blankAt: number}> = ({
  wallAt,
  litAts,
  blankAt,
}) => {
  const st = useStagger(6, {at: wallAt, dur: DUR.f4, stride: 6});
  const thumbs: Record<(typeof RULES)[number]['thumb'], React.FC> = {
    menu: MenuRowThumb,
    sign: SignThumb,
    door: DoorThumb,
    page: PageThumb,
    blank: BlankThumb,
  };
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 372px)', gap: '30px 34px'}}>
      {RULES.map((r, i) => {
        const Thumb = thumbs[r.thumb];
        return (
          <RuleCard
            key={r.id}
            n={r.n}
            keyword={r.keyword}
            accent={i % 2 === 0 ? theme.conceptDeep : theme.deny}
            litAt={litAts[i]}
            entered={st[i]}
          >
            <Thumb />
          </RuleCard>
        );
      })}
      <BlankCell at={blankAt} entered={st[5]} />
    </div>
  );
};

// ── 6-B 哲学：金句压场 + 46 家名单墙淡影 + 留白标签飘出 ──────────────────

/** p6-07 后半：全屏金句（衬线体账本金）以底幕直接遮盖 archify 画框（4-D②
 *  范式）；p6-08 名单墙淡影浮现；p6-09 三枚留白标签飘向边缘外（留给生态）。 */
const Philosophy: React.FC<{
  quoteAt: number;
  wallAt: number;
  labelAt: number;
  driftAt: number;
  driftDur: number;
}> = ({quoteAt, wallAt, labelAt, driftAt, driftDur}) => {
  const frame = useCurrentFrame();
  const backP = useProgress(quoteAt, DUR.f5); // 底幕淡入（盖画框）
  const zoom = usePushIn(quoteAt, {scale: 0.045}); // 金句缓推
  const wallP = useProgress(wallAt, DUR.f5);
  const chips = useStagger(46, {at: wallAt + 6, dur: DUR.f2, stride: 1}); // 名单逐格入墙
  const quoteDim = useDim({at: driftAt, to: 0.6, dur: DUR.f5}); // 标签出场时金句让位
  const drift = useProgress(driftAt, driftDur, 'accelerate'); // 标签加速离场
  const labelStride = Math.round((driftAt - labelAt) * 0.18);
  const labels = ['分发', '信任', '版本'];
  // 三枚标签的离场方向：左出 / 斜下出 / 右出——全留给画外的生态
  const labelDrift = [
    `translate(${-drift * 1020}px, ${-drift * 60}px)`,
    `translate(${drift * 260}px, ${drift * 560}px)`,
    `translate(${drift * 1020}px, ${-drift * 60}px)`,
  ];
  return (
    <>
      {/* 底幕：直接遮盖 archify 画框（全屏独占的让位范式） */}
      <AbsoluteFill style={{background: theme.bg, opacity: 0.94 * backP}} />
      {/* 金句：全片唯一一次全屏衬线金句 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 336,
          textAlign: 'center',
          opacity: backP * quoteDim,
          transform: zoom,
        }}
      >
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 58,
            fontWeight: 700,
            color: theme.concept,
            letterSpacing: 6,
          }}
        >
          刻意不做
        </div>
      </div>
      {/* 46 家名单墙（淡影）：计数 + 取数口径与 P0 同源 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 556,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: wallP * 0.9,
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 32, fontWeight: 700, color: theme.concept}}>46</span>
          <span style={{fontSize: 16, color: theme.dim}}>家</span>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>· 截至 2026-09-30</span>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(10, 82px)', gap: 8}}>
          {Array.from({length: 46}, (_, i) => (
            <div
              key={i}
              style={{
                height: 24,
                borderRadius: 5,
                border: `1px solid ${theme.panelBorder}`,
                background: `${theme.panelBorder}22`,
                opacity: chips[i] * (0.35 + ((i * 7) % 3) * 0.18),
              }}
            />
          ))}
        </div>
      </div>
      {/* 三枚留白标签：先依次亮起，再加速飘出画外（不展开=不占画内） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 796, display: 'flex', justifyContent: 'center', gap: 30}}>
        {labels.map((t, i) => {
          const ap = progress(frame, labelAt + i * labelStride, DUR.f4);
          return (
            <div
              key={t}
              style={{
                border: `1.5px dashed ${theme.deny}`,
                borderRadius: 8,
                padding: '8px 20px',
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.dim,
                opacity: ap * (1 - drift),
                transform: labelDrift[i],
              }}
            >
              {t}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ── 6-C 护栏：三句如实竖排 ────────────────────────────────────────────────

/** 护栏卡：护栏图形描线 + 标题（≤6 字）+ 注脚；p6-12 卡带 allowed-tools
 *  行动小字（逐字敲出）与「缺席」状态章。治理面统一紫。 */
const GuardCard: React.FC<{
  title: string;
  sub?: string;
  badge?: string;
  chip?: string;
  note?: string;
  noteAt?: number;
  litAt: number;
}> = ({title, sub, badge, chip, note, noteAt = 0, litAt}) => {
  const rail = useDraw(litAt, DUR.f5); // 护栏描线：两柱两栏
  const enter = useEnter('rise', {at: litAt, dur: DUR.f5, springPreset: 'settle', dist: 26});
  const typed = useReveal(note ?? '', {at: noteAt, cps: 16});
  return (
    <div
      style={{
        width: 800,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        background: theme.panel,
        border: `1.5px solid ${theme.deny}55`,
        borderRadius: 12,
        padding: '18px 26px',
        opacity: enter.opacity,
        transform: enter.transform,
      }}
    >
      <svg width={52} height={52} viewBox="0 0 52 52">
        <path
          d="M8 8 V44 M44 8 V44 M8 18 H44 M8 34 H44"
          fill="none"
          stroke={theme.deny}
          strokeWidth={3}
          strokeLinecap="round"
          {...rail}
        />
      </svg>
      <div style={{flex: 1}}>
        <div style={{fontSize: 26, fontWeight: 600, color: theme.text}}>{title}</div>
        {sub && <div style={{fontSize: 16, color: theme.dim, marginTop: 5}}>{sub}</div>}
        {note && (
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.deny, marginTop: 7}}>▸ {typed}</div>
        )}
      </div>
      {badge && (
        <div style={{display: 'flex', alignItems: 'baseline', gap: 4}}>
          <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.deny}}>{badge}</span>
          <span style={{fontSize: 14, color: theme.dim}}>家</span>
        </div>
      )}
      {chip && (
        <div
          style={{
            border: `1.5px solid ${theme.deny}`,
            borderRadius: 999,
            padding: '4px 14px',
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.deny,
          }}
        >
          {chip}
        </div>
      )}
    </div>
  );
};

/** 6-C 编排：p6-10..12 每句升起一张护栏卡（如实口径，不辩护）。 */
const GuardStack: React.FC<{g1: number; g2: number; g3: number; noteAt: number}> = ({
  g1,
  g2,
  g3,
  noteAt,
}) => {
  const frame = useCurrentFrame();
  const head = progress(frame, g1, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
          letterSpacing: 4,
          opacity: head,
          marginBottom: 4,
        }}
      >
        三句如实
      </div>
      <GuardCard litAt={g1} title="自报登记" sub="无第三方复核" badge="46" />
      <GuardCard litAt={g2} title="行为可能不同" sub="扩展互不兼容 · 描述可能截短" />
      <GuardCard
        litAt={g3}
        title="信任与防篡改"
        chip="缺席"
        note="装前看 allowed-tools"
        noteAt={noteAt}
      />
    </div>
  );
};

// ── 6-D 收尾：目录树同机位回扣 + my-rules 两行必填 + 渐黑 ─────────────────

/** 开场目录树复现（〔M-003〕P0 同机位同编排）：六文件夹落位 → p6-14 每格
 *  亮出「已读亮的目录行」（name 常驻 + description 一句话，M-001 同源夹具注）。
 *  「凭什么？」回声随答案点亮而让位。 */
const DirTreeReprise: React.FC<{fallAt: number; lineAt: number}> = ({fallAt, lineAt}) => {
  const st = useStagger(6, {at: fallAt, dur: DUR.f4, stride: 7}); // 与 P0 DirTree 同编排
  const lit = useStagger(6, {at: lineAt, dur: DUR.f4, stride: 5}); // 目录行逐行点亮
  const echo = useDim({at: lineAt, to: 0.3, dur: DUR.f5}); // 问题让位给机制答案
  return (
    <div style={{position: 'relative', width: 940}}>
      {/* 开场问题回声 */}
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 25,
          color: theme.dim,
          marginBottom: 12,
          paddingLeft: 8,
          opacity: st[0] * echo,
        }}
      >
        凭什么？
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginBottom: 16, paddingLeft: 8}}>
        .agents/skills/
      </div>
      {/* 树干线 */}
      <div style={{position: 'absolute', left: 26, top: 96, bottom: 10, width: 2, background: theme.panelBorder}} />
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 286px)', gap: '24px 22px'}}>
        {MENU_ROWS.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              paddingLeft: 26,
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * -22}px)`,
            }}
          >
            {/* 文件夹图形（P0 同款） */}
            <svg width={44} height={34} viewBox="0 0 44 34">
              <path
                d="M2 8 Q2 4 6 4 H16 L20 9 H38 Q42 9 42 13 V29 Q42 33 38 33 H6 Q2 33 2 29 Z"
                fill={`${theme.conceptDeep}26`}
                stroke={theme.conceptDeep}
                strokeWidth={2}
              />
            </svg>
            <div>
              <div style={{fontFamily: theme.mono, fontSize: 16.5, color: theme.text}}>{r.id}</div>
              <div style={{fontSize: 13, color: theme.dim, marginTop: 2}}>SKILL.md</div>
              {/* 已读亮的目录行：全片看完后，观众认得的常驻一行 */}
              <div style={{display: 'flex', alignItems: 'center', gap: 7, marginTop: 4}}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: theme.concept,
                    opacity: 0.2 + 0.8 * lit[i],
                  }}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    color: lit[i] > 0.45 ? theme.concept : theme.dim,
                    opacity: 0.5 + 0.5 * lit[i],
                  }}
                >
                  {r.note}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** p6-15 用户端新建技能（右=客户端/用户端）：面板升起 → 光标敲出两行必填
 *  → 「规矩可携带」章弹出。name/description 键位走门牌靛（身份字段）。 */
const NS_LINE1 = 'name: my-rules';
const NS_LINE2 = 'description: …';
const NewSkill: React.FC<{atIn: number; type1At: number; type2At: number; chipAt: number}> = ({
  atIn,
  type1At,
  type2At,
  chipAt,
}) => {
  const enter = useEnter('rise', {at: atIn, dur: DUR.f5, springPreset: 'settle', dist: 24});
  const l1 = useReveal(NS_LINE1, {at: type1At, cps: 14});
  const l2 = useReveal(NS_LINE2, {at: type2At, cps: 14});
  const blink = useBreathe({period: 16, amp: 0.5, base: 0.5}); // 光标闪烁（gallery 同款口径）
  const chip = useEnter('pop', {at: chipAt, dur: DUR.f4});
  const done1 = l1.length >= NS_LINE1.length;
  const cursor = (
    <span
      style={{
        display: 'inline-block',
        width: 9,
        height: 20,
        background: theme.concept,
        marginLeft: 3,
        verticalAlign: -3,
        opacity: blink,
      }}
    />
  );
  return (
    <div
      style={{
        width: 430,
        boxSizing: 'border-box',
        background: theme.panel,
        border: `1.5px solid ${theme.conceptDeep}55`,
        borderRadius: 12,
        padding: '16px 20px 14px',
        opacity: enter.opacity,
        transform: enter.transform,
      }}
    >
      {/* 头行：新文件夹落进约定目录 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12}}>
        <svg width={34} height={26} viewBox="0 0 44 34">
          <path
            d="M2 8 Q2 4 6 4 H16 L20 9 H38 Q42 9 42 13 V29 Q42 33 38 33 H6 Q2 33 2 29 Z"
            fill={`${theme.conceptDeep}26`}
            stroke={theme.conceptDeep}
            strokeWidth={2.5}
          />
        </svg>
        <span style={{fontFamily: theme.mono, fontSize: 14.5, color: theme.dim}}>.agents/skills/my-rules/</span>
      </div>
      {/* 两行必填：逐字敲出 */}
      <div style={{fontFamily: theme.mono, fontSize: 17, lineHeight: 1.9, whiteSpace: 'pre'}}>
        <div>
          <span style={{color: theme.conceptDeep}}>{l1.slice(0, 5)}</span>
          <span style={{color: theme.text}}>{l1.slice(5)}</span>
          {!done1 && cursor}
        </div>
        <div>
          <span style={{color: theme.conceptDeep}}>{l2.slice(0, 12)}</span>
          <span style={{color: theme.text}}>{l2.slice(12)}</span>
          {done1 && cursor}
        </div>
      </div>
      {/* 收束章：规矩从此可携带 */}
      <div style={{marginTop: 14, opacity: chip.opacity, transform: chip.transform}}>
        <span
          style={{
            display: 'inline-block',
            border: `1.5px solid ${theme.concept}`,
            borderRadius: 999,
            padding: '5px 16px',
            fontSize: 15,
            color: theme.concept,
          }}
        >
          规矩可携带
        </span>
      </div>
    </div>
  );
};

/** 渐黑遮罩：末 36 帧淡至全黑，窗取**末 beat 总时长**（红线四——勿用末句
 *  时长，否则 p6-13 起就黑屏）；置于本镜 DOM 末位，盖过全部装置与章节条。 */
const FadeMask: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span);
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, zIndex: 90}} />;
};

// ── 幕组装 ───────────────────────────────────────────────────────────────

export const P6Deliberate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-07', 'p6-09');
  const bC = w('p6-10', 'p6-12');
  const bD = w('p6-13', 'p6-16');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 卡墙">
        <SceneTag chapter="P6" tagline="刻意做小" accent={theme.deny} />
        <Stage>
          <RuleWall
            wallAt={at('p6-01') - bA.from + Math.round(dur('p6-01') * 0.3)}
            litAts={RULES.map((r) => at(r.id) - bA.from + Math.round(dur(r.id) * 0.18))}
            blankAt={at('p6-06') - bA.from + Math.round(dur('p6-06') * 0.55)}
          />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="6-B 哲学">
        {/* dt-gate 章回放：刻意不做=守门哲学的回响（p5-D 同章再现）；金句
            底幕在后半句直接遮盖画框（4-D② 让位范式） */}
        <ArchifyRecap
          slug="dual-track"
          caption="守门哲学 · 回响"
          cues={[
            {chapterId: 'dt-gate', at: at('p6-07') - bB.from, durationInFrames: dur('p6-07'), },
          ]}
        />
        <Philosophy
          quoteAt={at('p6-07') - bB.from + Math.round(dur('p6-07') * 0.58)}
          wallAt={at('p6-08') - bB.from + Math.round(dur('p6-08') * 0.3)}
          labelAt={at('p6-09') - bB.from + Math.round(dur('p6-09') * 0.12)}
          driftAt={at('p6-09') - bB.from + Math.round(dur('p6-09') * 0.62)}
          driftDur={Math.round(dur('p6-09') * 0.38)}
        />
        {/* 章节条置于最后：不被金句底幕压住 */}
        <SceneTag chapter="P6" tagline="刻意做小" accent={theme.concept} />
      </Sequence>

      <Sequence {...bC} name="6-C 护栏">
        <SceneTag chapter="P6" tagline="刻意做小" accent={theme.deny} />
        <Stage>
          <GuardStack
            g1={at('p6-10') - bC.from + Math.round(dur('p6-10') * 0.25)}
            g2={at('p6-11') - bC.from + Math.round(dur('p6-11') * 0.25)}
            g3={at('p6-12') - bC.from + Math.round(dur('p6-12') * 0.25)}
            noteAt={at('p6-12') - bC.from + Math.round(dur('p6-12') * 0.62)}
          />
        </Stage>
      </Sequence>

      <Sequence {...bD} name="6-D 收尾">
        <SceneTag chapter="P6" tagline="刻意做小" accent={theme.conceptDeep} />
        {/* 左=标准侧目录树回扣，右=用户端自建技能（空间语义） */}
        <Stage>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 64}}>
            <DirTreeReprise
              fallAt={at('p6-13') - bD.from + Math.round(dur('p6-13') * 0.3)}
              lineAt={at('p6-14') - bD.from + Math.round(dur('p6-14') * 0.3)}
            />
            <NewSkill
              atIn={at('p6-15') - bD.from + Math.round(dur('p6-15') * 0.12)}
              type1At={at('p6-15') - bD.from + Math.round(dur('p6-15') * 0.38)}
              type2At={at('p6-15') - bD.from + Math.round(dur('p6-15') * 0.68)}
              chipAt={at('p6-15') - bD.from + Math.round(dur('p6-15') * 0.88)}
            />
          </div>
        </Stage>
        {/* 末幕渐黑自管（SceneFade 对末幕 fadeOut=0，不会双重渐黑） */}
        <FadeMask span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
