/** P1 包裹与门牌（p1-01..p1-14，镜 1-A..1-D）——格式契约（dt-spec 全屏回放
 *  + 六字段属性卡：两行靛蓝必填、四行灰显盖「可选」章、引语卡）→ 身份规则
 *  （门牌↔目录名/name 逐字亮绿、登记处图章、café 归一+中文名）→ X1 消融
 *  （lc-strict 全屏对照 + 周报合并行静默蒸发、目录 6→5、零告警红章）→ 钩子
 *  （镜头拉远，账本条探出半格 t1=454）。
 *  幕主色门牌靛（身份幕）；〔M-001〕菜单卡在本幕 1-C 首次完整亮出。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useDraw,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {SceneTag} from '../components/motifs';
import {LedgerBar, MENU_ROWS, Plaque, SkillMenuCard, Stage} from '../components/e1-motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 幕内图章（可选/登记处/零告警共用形态）：@impulse 盖下——透明度走时长缓动、
 *  缩径走 snap 弹簧（落章微过冲）、落章帧一圈冲击环（useImpulse 包络起落）。 */
const Stamp: React.FC<{at: number; text: string; color: string; size?: number; sub?: string}> = ({
  at,
  text,
  color,
  size = 28,
  sub,
}) => {
  const frame = useCurrentFrame();
  const o = progress(frame, at, DUR.f3);
  const s = useSpring('snap', {at, dur: DUR.f4});
  const ring = useImpulse({at: at + DUR.f4, dur: DUR.f5, peak: 1});
  return (
    <div style={{position: 'relative', opacity: o, transform: `rotate(-7deg) scale(${1.5 - 0.5 * s})`}}>
      <div
        style={{
          border: `3px solid ${color}`,
          color,
          borderRadius: 10,
          padding: sub ? '7px 22px 6px' : '8px 24px',
          background: `${theme.bg}cc`,
          textAlign: 'center',
        }}
      >
        <div style={{fontSize: size, letterSpacing: 5, fontWeight: 700, fontFamily: theme.sans, whiteSpace: 'nowrap'}}>
          {text}
        </div>
        {sub && <div style={{fontSize: 13, letterSpacing: 2, marginTop: 2, opacity: 0.75}}>{sub}</div>}
      </div>
      {/* 落章冲击环：包络一起一落，只闪不驻留 */}
      <div
        style={{
          position: 'absolute',
          inset: -8,
          border: `2px solid ${color}`,
          borderRadius: 14,
          opacity: 0.7 * ring,
          transform: `scale(${1 + 0.28 * ring})`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

/** 1-A 格式契约：六字段属性卡（frontmatter 版式）。name/description 两行随
 *  p1-02 靛蓝「必填」高亮，四行 p1-03 灰显并盖「可选」章+底注；p1-04 右侧
 *  浮出规范原话引语卡（正文零格式限制）。dt-spec 全屏窗内整卡让位。 */
const FIELDS = [
  {key: 'name', required: true},
  {key: 'description', required: true},
  {key: 'license', required: false},
  {key: 'compatibility', required: false},
  {key: 'metadata', required: false},
  {key: 'allowed-tools', required: false},
] as const;

const FieldCard: React.FC<{revealAt: number; hlAt: number; optAt: number; quoteAt: number}> = ({
  revealAt,
  hlAt,
  optAt,
  quoteAt,
}) => {
  const frame = useCurrentFrame();
  const st = useStagger(6, {at: revealAt, dur: DUR.f3, stride: 6});
  const hl = useStagger(2, {at: hlAt, dur: DUR.f4, stride: 9});
  const grayP = progress(frame, optAt, DUR.f4);
  const noteP = progress(frame, optAt + DUR.f5, DUR.f4);
  const quoteS = useSpring('settle', {at: quoteAt, dur: DUR.f6});
  const quoteO = progress(frame, quoteAt, DUR.f5);
  const row = (f: (typeof FIELDS)[number], i: number, hot: number) => (
    <div
      key={f.key}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: '9px 14px',
        borderRadius: 8,
        border: `1.5px solid ${theme.panelBorder}`,
        opacity: st[i],
        transform: `translateX(${(1 - st[i]) * -16}px)`,
      }}
    >
      {/* 必填底色随 p1-02 亮出（overlay 平滑，效果通道不吃弹簧） */}
      {f.required && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: `${theme.conceptDeep}26`,
            opacity: hot,
            pointerEvents: 'none',
          }}
        />
      )}
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 17,
          minWidth: 170,
          color: f.required ? (hot > 0 ? theme.conceptDeep : theme.text) : grayP > 0.5 ? theme.dim : theme.text,
        }}
      >
        {f.key}:
      </span>
      {/* 值域占位条 */}
      <span
        style={{
          flex: 1,
          height: 11,
          borderRadius: 6,
          background: f.required ? `${theme.conceptDeep}44` : `${theme.panelBorder}44`,
        }}
      />
      {f.required && (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: theme.bg,
            background: theme.conceptDeep,
            borderRadius: 99,
            padding: '2.5px 12px',
            opacity: hot,
          }}
        >
          必填
        </span>
      )}
    </div>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 64}}>
      {/* 六字段属性卡 */}
      <div style={{width: 620}}>
        <div style={{fontSize: 15, color: theme.dim, letterSpacing: 2, marginBottom: 12}}>属性卡 · 六字段</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          {row(FIELDS[0], 0, hl[0])}
          {row(FIELDS[1], 1, hl[1])}
          {/* 四行可选组：p1-03 整组盖「可选」章 */}
          <div style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6}}>
            {FIELDS.slice(2).map((f, k) => row(f, k + 2, 0))}
            <div
              style={{
                position: 'absolute',
                inset: -6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Stamp at={optAt} text="可选" color={theme.dim} size={26} />
            </div>
          </div>
        </div>
        <div style={{marginTop: 14, fontSize: 14.5, color: theme.dim, opacity: noteP}}>一个都不用记</div>
      </div>
      {/* p1-04 引语卡：规范原话（正文零格式限制） */}
      <div
        style={{
          width: 430,
          borderLeft: `4px solid ${theme.conceptDeep}`,
          paddingLeft: 24,
          opacity: quoteO,
          transform: `translateY(${(1 - quoteS) * 22}px)`,
        }}
      >
        <div style={{fontSize: 15, color: theme.dim, letterSpacing: 2, marginBottom: 12}}>规范原话</div>
        <div style={{fontFamily: theme.serif, fontSize: 33, lineHeight: 1.62, color: theme.text, fontWeight: 700}}>
          写任何有助于完成任务的内容
        </div>
        <div style={{marginTop: 16, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <span style={{fontFamily: theme.mono, fontSize: 14.5, color: theme.conceptDeep}}>SKILL.md</span>
          <span style={{fontSize: 14, color: theme.dim}}>正文 · 零格式限制</span>
        </div>
      </div>
    </div>
  );
};

/** 逐字字符列：目录名行与 name 行共用；lit[i] 到位后翻绿（扫描式比对）。 */
const CharRow: React.FC<{text: string; lit: number[]; base: string}> = ({text, lit, base}) => (
  <div style={{display: 'flex', flexDirection: 'row', gap: 2}}>
    {text.split('').map((c, i) => (
      <span
        key={i}
        style={{
          fontFamily: theme.mono,
          fontSize: 25,
          minWidth: 17,
          textAlign: 'center',
          color: lit[i] > 0 ? theme.ok : base,
        }}
      >
        {c}
      </span>
    ))}
  </div>
);

/** 1-B 身份规则：门牌（户口登记名）与目录名/name 字段逐字比对、逐字亮绿
 *  （p1-06 绿线描过）；p1-07 「发牌机构」划空 +「登记处」章压下；p1-08/08a
 *  参考实现归一：café 两种 Unicode 写法重叠归一 + 中文名合法行。 */
const NAME = 'shift-swap';

const IdentityRule: React.FC<{
  plaqueAt: number;
  matchAt: number;
  stampAt: number;
  normAt: number;
  zhAt: number;
}> = ({plaqueAt, matchAt, stampAt, normAt, zhAt}) => {
  const frame = useCurrentFrame();
  const plaque = useSpring('settle', {at: plaqueAt, dur: DUR.f6});
  const plaqueO = progress(frame, plaqueAt, DUR.f6); // opacity 走时长缓动（effects 不变量）
  const chars = useStagger(NAME.length, {at: matchAt, dur: DUR.f3, stride: 5});
  const matchAll = chars[NAME.length - 1];
  const drawn = useDraw(matchAt, DUR.f6);
  const strikeP = progress(frame, stampAt, DUR.f4);
  const normP = progress(frame, normAt, DUR.f5);
  const mergeP = progress(frame, normAt + DUR.f5, DUR.f5);
  const zh = progress(frame, zhAt, DUR.f4);
  const tagStyle: React.CSSProperties = {
    fontFamily: theme.mono,
    fontSize: 13,
    color: theme.dim,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 5,
    padding: '2px 8px',
  };
  const folder = (
    <svg width={38} height={29} viewBox="0 0 44 34">
      <path
        d="M2 8 Q2 4 6 4 H16 L20 9 H38 Q42 9 42 13 V29 Q42 33 38 33 H6 Q2 33 2 29 Z"
        fill={`${theme.conceptDeep}26`}
        stroke={theme.conceptDeep}
        strokeWidth={2}
      />
    </svg>
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
      {/* 上：门牌特写 ↔ 目录名/name 逐字比对 */}
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 92}}>
        {/* 门牌 = 户口登记名；登记处章在 p1-07 压下 */}
        <div style={{position: 'relative', opacity: plaqueO, transform: `translateY(${(1 - plaque) * -24}px)`}}>
          <Plaque variant="door" title={NAME} width={300} />
          {/* 不设发牌机构：划空标签 */}
          <div style={{position: 'relative', marginTop: 18, width: 132, opacity: strikeP}}>
            <div
              style={{
                fontSize: 13.5,
                color: theme.dim,
                border: `1.5px solid ${theme.panelBorder}`,
                borderRadius: 6,
                padding: '4px 12px',
                textAlign: 'center',
              }}
            >
              发牌机构
            </div>
            <div
              style={{
                position: 'absolute',
                left: -4,
                top: '50%',
                height: 2,
                background: theme.dim,
                borderRadius: 2,
                width: `${strikeP * 110}%`,
              }}
            />
          </div>
          <div style={{position: 'absolute', right: -38, bottom: 4}}>
            <Stamp at={stampAt} text="登记处" sub="文件系统" color={theme.conceptDeep} size={24} />
          </div>
        </div>
        {/* 比对列：上=目录名（文件夹），下=name 字段；同名逐字亮绿 */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14}}>
            <div
              style={{
                width: 64,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
              }}
            >
              {folder}
              <span style={{fontSize: 12, color: theme.dim}}>目录名</span>
            </div>
            <CharRow text={NAME} lit={chars} base={theme.text} />
          </div>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14}}>
            <div style={{width: 64, display: 'flex', justifyContent: 'center', flexShrink: 0}}>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 14,
                  color: theme.conceptDeep,
                  border: `1.5px solid ${theme.conceptDeep}66`,
                  borderRadius: 6,
                  padding: '3px 9px',
                }}
              >
                name
              </span>
            </div>
            <CharRow text={NAME} lit={chars} base={theme.dim} />
          </div>
          {/* 逐字一致绿线：随比对描过（pathLength 归一化描线） */}
          <svg width={196} height={10} style={{marginLeft: 78}}>
            <line x1={2} y1={5} x2={194} y2={5} stroke={theme.ok} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} {...drawn} />
          </svg>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginLeft: 78,
              opacity: matchAll,
              transform: `scale(${0.92 + 0.08 * matchAll})`,
            }}
          >
            <span style={{fontSize: 18, color: theme.ok}}>✓</span>
            <span style={{fontSize: 15, color: theme.ok, border: `1.5px solid ${theme.ok}55`, borderRadius: 99, padding: '3px 14px'}}>
              逐字一致
            </span>
          </div>
        </div>
      </div>
      {/* 下：参考实现归一面板 */}
      <div
        style={{
          width: 900,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '16px 24px',
          opacity: normP,
          transform: `translateY(${(1 - normP) * 20}px)`,
        }}
      >
        <div style={{fontSize: 14, color: theme.dim, letterSpacing: 2, marginBottom: 12}}>参考实现 · 归一</div>
        <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 44}}>
          {/* café 两种写法：NFD 行上移重叠归一（@travel 合并） */}
          <div style={{position: 'relative', width: 340, height: 104}}>
            <div style={{position: 'absolute', top: 0, left: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <span style={tagStyle}>NFC</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 30,
                  color: mergeP > 0.85 ? theme.conceptDeep : theme.text,
                }}
              >
                {'café'}
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                top: 52,
                left: 0,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                transform: `translateY(${-52 * mergeP}px)`,
                opacity: 1 - 0.9 * mergeP,
              }}
            >
              <span style={tagStyle}>NFD</span>
              <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>{'café'}</span>
            </div>
            {/* 归一标签：重叠完成后亮出 */}
            <div
              style={{
                position: 'absolute',
                right: -4,
                top: 10,
                fontSize: 14,
                color: theme.conceptDeep,
                border: `1.5px solid ${theme.conceptDeep}66`,
                borderRadius: 99,
                padding: '3px 12px',
                opacity: Math.max(0, (mergeP - 0.85) / 0.15),
              }}
            >
              同一名字
            </div>
          </div>
          {/* p1-08a 中文名行 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: zh,
              transform: `translateX(${(1 - zh) * 18}px)`,
            }}
          >
            {folder}
            <span style={{fontSize: 26, color: theme.text}}>周报合并</span>
            <span style={{fontSize: 20, color: theme.ok}}>✓</span>
            <span style={{fontSize: 13.5, color: theme.dim}}>中文名 · 合法</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** 1-C X1 消融：一枚规矩牌 name = 目录名（p1-09 亮出）下左右对照——左完好
 *  态（绿框·六行俱在）、右拆解态（红框·规矩被划掉改信属性卡）：「周报合并」
 *  行无声淡出、目录计数 6→5（p1-11）；p1-13「零告警」红章盖在拆解侧。
 *  p1-12 全屏 lc-strict 对照期间整装置经 ArchifyYield 让位。 */
const X1Ablation: React.FC<{
  ruleAt: number;
  rowsAt: number;
  breakAt: number;
  vanishAt: number;
  zeroAt: number;
}> = ({ruleAt, rowsAt, breakAt, vanishAt, zeroAt}) => {
  const frame = useCurrentFrame();
  const rule = useSpring('settle', {at: ruleAt, dur: DUR.f5});
  const panels = useSpring('settle', {at: rowsAt, dur: DUR.f6});
  const ruleO = progress(frame, ruleAt, DUR.f5); // opacity 走时长缓动（effects 不变量）
  const panelsO = progress(frame, rowsAt, DUR.f6);
  const st = useStagger(6, {at: rowsAt + DUR.f4, dur: DUR.f3, stride: 5});
  const strikeP = progress(frame, breakAt, DUR.f5);
  const cnt = Math.round(useCount({from: 6, to: 5, at: vanishAt, dur: DUR.f5}));
  const sides = [
    {label: '完好', color: theme.ok, count: 6, ablated: false},
    {label: '拆解', color: theme.danger, count: cnt, ablated: true},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28}}>
      {/* 规矩牌：p1-10 尾被红笔划掉 + 改信属性卡（拆解的世界） */}
      <div style={{position: 'relative', opacity: ruleO, transform: `translateY(${(1 - rule) * -16}px)`}}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 19,
            color: theme.conceptDeep,
            border: `1.5px solid ${theme.conceptDeep}66`,
            borderRadius: 8,
            padding: '8px 22px',
            background: theme.panel,
          }}
        >
          name = 目录名
        </div>
        <div
          style={{
            position: 'absolute',
            left: -6,
            top: '52%',
            height: 2.5,
            background: theme.danger,
            borderRadius: 2,
            width: `${strikeP * 108}%`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            right: -6,
            fontSize: 14,
            color: theme.danger,
            letterSpacing: 2,
            opacity: strikeP,
            transform: `translateY(${(1 - strikeP) * 8}px)`,
          }}
        >
          改信属性卡
        </div>
      </div>
      {/* 左右对照面板 */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          gap: 90,
          opacity: panelsO,
          transform: `translateY(${(1 - panels) * 24}px)`,
        }}
      >
        {sides.map((sd) => (
          <div
            key={sd.label}
            style={{
              position: 'relative',
              width: 470,
              background: theme.panel,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 12,
              padding: '14px 20px 12px',
            }}
          >
            {/* 拆解瞬间框色翻面：完好→绿 / 拆解→红（overlay 平滑过渡） */}
            <div
              style={{
                position: 'absolute',
                inset: -1.5,
                border: `1.5px solid ${sd.color}`,
                borderRadius: 12,
                opacity: strikeP,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -13,
                right: 16,
                fontSize: 14,
                fontFamily: theme.mono,
                letterSpacing: 4,
                color: sd.color,
                background: theme.bg,
                padding: '1px 10px',
                opacity: strikeP,
              }}
            >
              {sd.label}
            </div>
            {/* 目录计数：拆解侧 6→5（@count） */}
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8}}>
              <span style={{fontSize: 14, color: theme.dim}}>目录</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 24,
                  fontWeight: 700,
                  color: sd.count < 6 ? theme.danger : theme.text,
                }}
              >
                {sd.count}
              </span>
              <span style={{fontSize: 14, color: theme.dim}}>行</span>
            </div>
            {MENU_ROWS.map((r, i) => {
              const gone = sd.ablated && r.id === 'report-merger' ? progress(frame, vanishAt, DUR.f5) : 0;
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '5.5px 0',
                    opacity: st[i] * (1 - gone),
                    filter: gone > 0.5 ? 'blur(1px)' : undefined,
                  }}
                >
                  <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.conceptDeep, minWidth: 128}}>{r.id}</span>
                  <span
                    style={{
                      fontSize: 15,
                      color: gone > 0 ? theme.dim : theme.text,
                      textDecoration: gone > 0.6 ? 'line-through' : undefined,
                    }}
                  >
                    {r.label}
                  </span>
                </div>
              );
            })}
            {/* 零告警红章：盖在拆解侧（p1-13） */}
            {sd.ablated && (
              <div style={{position: 'absolute', right: -26, bottom: -30}}>
                <Stamp at={zeroAt} text="零告警" color={theme.danger} size={32} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/** M-001 首亮包装：技能菜单卡在 1-C 首次完整亮出（右上常驻锚自此贯穿）；
 *  X1 打点（周报合并行静默消失）与消融主装置同帧；全屏 lc-strict 窗内
 *  dimmed 让位（布尔由帧推导，常驻锚不与画框抢焦点）。 */
const MenuAnchor: React.FC<{appearAt: number; vanishAt: number; yieldAt: number; yieldDur: number}> = ({
  appearAt,
  vanishAt,
  yieldAt,
  yieldDur,
}) => {
  const frame = useCurrentFrame();
  const cover = progress(frame, yieldAt, DUR.f3) * (1 - progress(frame, yieldAt + yieldDur, DUR.f3));
  return (
    <SkillMenuCard appearAt={appearAt} vanishedRow="report-merger" vanishAt={vanishAt} dimmed={cover > 0.5} />
  );
};

/** 1-D 钩子：门牌悬停（呼吸浮动）+ 镜头拉远——「登记免费」小字与问句
 *  「账从哪算起？」浮出；账从哪算起，交给 P2。 */
const HookPull: React.FC<{freeAt: number; pullAt: number; qAt: number}> = ({freeAt, pullAt, qAt}) => {
  const frame = useCurrentFrame();
  const freeP = progress(frame, freeAt, DUR.f4);
  const pull = useProgress(pullAt, DUR.f6, 'decelerate');
  const qP = progress(frame, qAt, DUR.f4);
  const hover = useBreathe({period: 90, amp: 0.45});
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        transform: `scale(${1.12 - 0.12 * pull})`,
      }}
    >
      <div style={{fontSize: 16, color: theme.dim, letterSpacing: 3, opacity: freeP}}>登记免费</div>
      {/* 门牌悬停：慢呼吸上下浮动 */}
      <div style={{transform: `translateY(${(hover - 0.55) * -10}px)`}}>
        <Plaque variant="door" title={NAME} width={320} />
      </div>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 38,
          color: theme.concept,
          fontWeight: 700,
          opacity: qP,
          transform: `translateY(${(1 - qP) * 14}px)`,
        }}
      >
        账从哪算起？
      </div>
    </div>
  );
};

/** M-002 探出：账本条（h=54）从底缘整条滑入（t1=454 已常驻、t2/t3 归零）。 */
const LedgerPeek: React.FC<{peekAt: number}> = ({peekAt}) => {
  const p = useProgress(peekAt, DUR.f6, 'decelerate');
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 54, transform: `translateY(${54 - 54 * p}px)`, zIndex: 40}}>
      <LedgerBar t1={454} t2={0} t3={0} sum={454} />
    </div>
  );
};

export const P1Doorplate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-04');
  const bB = w('p1-05', 'p1-08a');
  const bC = w('p1-09', 'p1-13');
  const bD = w('p1-14');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 格式契约">
        <SceneTag chapter="P1" tagline="包裹与门牌" accent={theme.conceptDeep} />
        {/* dt-spec 全屏回放承载规范面；窗外属性卡+引语卡主场（一条 cue 对一条窗） */}
        <ArchifyYield cues={[{at: at('p1-01') - bA.from, durationInFrames: dur('p1-01')}]}>
          <Stage>
            <FieldCard
              revealAt={at('p1-02') - bA.from}
              hlAt={at('p1-02') - bA.from + Math.round(dur('p1-02') * 0.6)}
              optAt={at('p1-03') - bA.from + Math.round(dur('p1-03') * 0.35)}
              quoteAt={at('p1-04') - bA.from + Math.round(dur('p1-04') * 0.55)}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="dual-track"
          caption="格式契约 · 六字段"
          cues={[
            {chapterId: 'dt-spec', at: at('p1-01') - bA.from, durationInFrames: dur('p1-01'), },
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 身份规则">
        <SceneTag chapter="P1" tagline="包裹与门牌" accent={theme.conceptDeep} />
        <Stage>
          <IdentityRule
            plaqueAt={at('p1-05') - bB.from + Math.round(dur('p1-05') * 0.2)}
            matchAt={at('p1-06') - bB.from + Math.round(dur('p1-06') * 0.3)}
            stampAt={at('p1-07') - bB.from + Math.round(dur('p1-07') * 0.45)}
            normAt={at('p1-08') - bB.from + Math.round(dur('p1-08') * 0.55)}
            zhAt={at('p1-08a') - bB.from + Math.round(dur('p1-08a') * 0.4)}
          />
        </Stage>
      </Sequence>

      <Sequence {...bC} name="1-C X1 消融">
        <SceneTag chapter="P1" tagline="包裹与门牌" accent={theme.conceptDeep} />
        {/* lc-strict 全屏对照挂 p1-12；消融主装置 p1-09..11 讲解、p1-13 总结 */}
        <ArchifyYield cues={[{at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')}]}>
          <Stage>
            <X1Ablation
              ruleAt={at('p1-09') - bC.from + Math.round(dur('p1-09') * 0.25)}
              rowsAt={at('p1-10') - bC.from + Math.round(dur('p1-10') * 0.12)}
              breakAt={at('p1-10') - bC.from + Math.round(dur('p1-10') * 0.62)}
              vanishAt={at('p1-11') - bC.from + Math.round(dur('p1-11') * 0.3)}
              zeroAt={at('p1-13') - bC.from + Math.round(dur('p1-13') * 0.35)}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="lifecycle"
          caption="对照组 · 官方校验器"
          cues={[
            {chapterId: 'lc-strict', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12'), },
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 钩子">
        <SceneTag chapter="P1" tagline="包裹与门牌" accent={theme.conceptDeep} />
        <Stage>
          <HookPull
            freeAt={at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.12)}
            pullAt={at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.52)}
            qAt={at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.66)}
          />
        </Stage>
        <LedgerPeek peekAt={at('p1-14') - bD.from + Math.round(dur('p1-14') * 0.62)} />
      </Sequence>

      {/* M-001 首亮后右上常驻（storyboard 契约「P1 首亮后右上常驻，P6 合页」）：
       *  幕级单实例跨 1-C..1-D，at 值仍以 bC.from 为原点——避免分镜各挂一份在
       *  镜界重放入场弹簧、1-D 整镜无锚断档 */}
      <Sequence from={bC.from} durationInFrames={scene.durationInFrames - bC.from}>
        <MenuAnchor
          appearAt={at('p1-09') - bC.from + Math.round(dur('p1-09') * 0.15)}
          vanishAt={at('p1-11') - bC.from + Math.round(dur('p1-11') * 0.3)}
          yieldAt={at('p1-12') - bC.from}
          yieldDur={dur('p1-12')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
