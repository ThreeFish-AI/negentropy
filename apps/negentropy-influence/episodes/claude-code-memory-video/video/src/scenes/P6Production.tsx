/** P6 照进生产（p6-01..25，5 镜 4 cue 回看）——分镜 6-A…6-E。
 *
 *  ★ 本幕以场景层装置为主，含 4 个 archify 回看实例：6-A cheap-first@p6-03
 *    （空窗后重现 → lead 默认入场）与 6-D retreat-fix/prefix-hit/one-of-three
 *    @p6-14..16（三例 cue 收缩到语音段后实例间各隔 20 帧句隙＝空窗 → 均默认
 *    入场；勿回退 lead={false}——空窗后整框一帧瞬现）；双问回收／对照条／双标尺／
 *    卡片墙／五规律卡／收尾栈为场景层自制装置。
 *  ★ 顶部行共存：本集 seeded motifs 的 SceneTag 在左上（left:72 top:64），与
 *    HarnessBadge（left:64 top:64）同格重叠，且 6-A 右上还驻 MapAnchorChip——
 *    SceneTag 以包裹层平移到 Badge 右侧（x≈732，Badge 五 chip 实宽至 ~713），
 *    三件同帧共存；ep1 的解法是把 SceneTag 右置，本集 motifs 已左置，故由
 *    本幕包裹层适配，不改共享层。
 *  ★ 6-E 收尾：HarnessStackP6（复制件，层序读 series-layers.json，本集层=记忆
 *    管理高亮；mech 苔绿光环是本幕叠加的柔光，不动冻结件本体——分镜「记忆层
 *    苔绿点亮」与组件 core 高亮的折衷）。下期卡标题主段「谁来按下开始」与身份
 *    卡「一张草稿纸和一本卡片册」是 check_series 规则 8 受检硬编码（改标题先改
 *    series.json 再同步此串）。
 *  ★ 末 36 帧渐黑窗取整镜（6-E）时长——红线四：勿用末句时长（末句后还有句间
 *    停顿与片尾静默）。
 *  ★ p6-23 金句卡「一张草稿纸，一本卡片册」为口播原句（逗号形）；身份卡全名
 *    （「和」形）由 p6-25 身份卡承载——两串刻意不同，勿「统一」。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow, SENTENCE_GAP_FRAMES} from '../timing';
import type {SceneRange} from '../types';
import {Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {MapAnchorChip} from '../components/map-anchor';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  ACTIVE_INDEX,
  HarnessBadge,
  HarnessStackP6,
  LAYERS,
  NEXT_LAYER,
} from '../components/harness-stack';
import {
  DUR,
  clamp01,
  progress,
  useBreathe,
  useCount,
  useDim,
  useEnter,
  useFadeOut,
  useFlowDash,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P1–P5 同值（顶边 y<56 归 frozen ChapterProgress）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 官方口径小胶囊（【官】证据分级——ok 绿=经官方文档互证） */
const OfficialPill: React.FC<{text?: string; style?: React.CSSProperties}> = ({
  text = '官方文档',
  style,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: '3px 12px',
      borderRadius: 999,
      border: `1px solid ${withAlpha(theme.ok, 0.75)}`,
      color: theme.ok,
      fontFamily: theme.sans,
      fontSize: 17,
      ...style,
    }}
  >
    {text}
  </span>
);

// ── 6-A 双问回收与「教学四层 vs 生产五层」对照 ──────────────────────────

/** P0 双问回收：两联卡同帧点亮（p6-01），p6-02 逐条落答案（mech 点睛）。 */
const QCARDS = [
  {tag: '第一问', q: '凭什么跑一整天不崩？', a: '便宜的先跑 · 贵的殿后'},
  {tag: '第二问', q: '凭什么第二天还记得你？', a: '目录常驻 · 正文按需'},
] as const;

/** 教学四层（P1 已立的管线名，灰白系）＝生产五层的前四层 */
const TEACH_LAYERS = ['落盘收据', '裁中段', '换地址', '模型摘要'] as const;

const DualRecall: React.FC<{
  at01: number;
  at02: number;
  at03: number;
  at04: number;
  at04b: number;
  at05: number;
}> = ({at01, at02, at03, at04, at04b, at05}) => {
  // 阶段一：双问卡同帧 fade（分镜 @enter:fade），p6-02 答案行错峰落位
  const both = useEnter('fade', {at: at01, dur: DUR.f5});
  const answers = useStagger(2, {at: at02 + 4, dur: DUR.f5, stride: 14});
  const s1Out = useProgress(at03 - DUR.f4, DUR.f4);
  // 阶段二：对照条（分镜 @stagger 两列逐层点亮）＋层计数 4→5（@count）
  // p6-03 让位骨架回看图镜（compact-pipeline cheap-first），对照条从 p6-04 进场
  const headIn = useProgress(at04, DUR.f4);
  const leftRows = useStagger(4, {at: at04 + 6, dur: DUR.f4, stride: 7});
  const rightRows = useStagger(5, {at: at04, dur: DUR.f4, stride: 7});
  const fifthGlow = useImpulse({at: at04 + 26 + DUR.f6, dur: DUR.f6, peak: 1});
  const countAt = at04 + 26;
  const fiveOn = useProgress(countAt + DUR.f6 - 2, DUR.f4);
  const skeleton = useProgress(at04 + 34, DUR.f4);
  const chipB = useProgress(at04b, DUR.f4);
  const chip5 = useProgress(at05, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 阶段一：双问回收字卡（p6-03 起让位对照条） */}
      {QCARDS.map((c, i) => (
        <div
          key={c.tag}
          style={{
            position: 'absolute',
            left: 200 + i * 800,
            top: 300,
            width: 720,
            opacity: both.opacity * (1 - s1Out),
          }}
        >
          <Panel style={{padding: '30px 36px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
              {c.tag}
            </div>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 40,
                fontWeight: 700,
                color: theme.text,
                marginTop: 10,
              }}
            >
              {c.q}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginTop: 22,
                opacity: answers[i],
                transform: `translateY(${(1 - answers[i]) * 12}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 40,
                  fontWeight: 700,
                  color: theme.mech,
                  lineHeight: 1,
                }}
              >
                {'✓'}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.mech}}>
                {c.a}
              </span>
            </div>
          </Panel>
        </div>
      ))}

      {/* 阶段二：对照高亮条 */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: headIn}}>
        {/* 列头 */}
        <div
          style={{
            position: 'absolute',
            left: 250,
            top: 214,
            fontFamily: theme.sans,
            fontSize: 27,
            fontWeight: 600,
            color: theme.dim,
          }}
        >
          {'开源教学'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 872,
            top: 216,
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.dim,
          }}
        >
          {'vs'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1080,
            top: 214,
            fontFamily: theme.sans,
            fontSize: 27,
            fontWeight: 600,
            color: theme.text,
          }}
        >
          {'真实产品'}
        </div>

        {/* 左列：教学四层（灰白系） */}
        {TEACH_LAYERS.map((name, i) => (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: 250,
              top: 292 + i * 104,
              width: 520,
              opacity: leftRows[i],
              transform: `translateX(${(1 - leftRows[i]) * -18}px)`,
            }}
          >
            <Panel style={{padding: '16px 20px', minHeight: 92, boxSizing: 'border-box'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{name}</span>
              </div>
            </Panel>
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: 250,
            top: 726,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
            opacity: skeleton,
          }}
        >
          {'一副骨架'}
        </div>

        {/* 中枢：层计数 4→5（Counter 双层交叉淡化：灰白 4 → mech 5） */}
        <div style={{position: 'absolute', left: 810, top: 460, width: 210, textAlign: 'center'}}>
          <div style={{position: 'relative', height: 100}}>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 86,
                color: theme.dim,
                opacity: 1 - fiveOn,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Counter from={4} to={5} start={countAt} frames={DUR.f6} />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                fontFamily: theme.mono,
                fontSize: 86,
                color: theme.mech,
                opacity: fiveOn,
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 ${18 * fifthGlow}px ${withAlpha(theme.mech, 0.5 * fifthGlow)}`,
              }}
            >
              <Counter from={4} to={5} start={countAt} frames={DUR.f6} />
            </div>
          </div>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.dim,
              marginTop: 8,
              opacity: headIn,
            }}
          >
            {'层'}
          </div>
        </div>

        {/* 右列：生产五层——前四层同形，第五层 mech 高亮（p6-04 逆向分析句落位） */}
        {TEACH_LAYERS.map((name, i) => (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: 1080,
              top: 292 + i * 104,
              width: 560,
              opacity: rightRows[i],
              transform: `translateX(${(1 - rightRows[i]) * 18}px)`,
            }}
          >
            <Panel style={{padding: '16px 20px', minHeight: 92, boxSizing: 'border-box'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{name}</span>
              </div>
            </Panel>
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: 1080,
            top: 708,
            width: 560,
            opacity: rightRows[4],
            transform: `translateX(${(1 - rightRows[4]) * 18}px)`,
          }}
        >
          <Panel
            accent={theme.mech}
            style={{
              padding: '16px 20px',
              minHeight: 92,
              boxSizing: 'border-box',
              boxShadow: `0 0 ${20 * fifthGlow}px ${withAlpha(theme.mech, 0.4 * fifthGlow)}`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech}}>{'05'}</span>
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 29,
                  fontWeight: 700,
                  color: theme.mech,
                }}
              >
                {'独立回收系统'}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.dim,
                }}
              >
                {'contextCollapse'}
              </span>
            </div>
          </Panel>
        </div>

        {/* p6-04b／p6-05：预算与触发线两条注脚 chip */}
        <div
          style={{
            position: 'absolute',
            left: 1080,
            top: 826,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              padding: '5px 14px',
              borderRadius: 999,
              border: `1px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.text,
              opacity: chipB,
            }}
          >
            {'精确用量预算'}
          </span>
          <span
            style={{
              padding: '5px 14px',
              borderRadius: 999,
              border: `1px solid ${withAlpha(theme.accent, 0.8)}`,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.accent,
              opacity: chip5,
            }}
          >
            {'1M 窗口 · 967K'}
          </span>
          <span style={{opacity: chip5}}>
            <OfficialPill />
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-B 互证双标尺 ──────────────────────────────────────────────────────

/** 右侧双格：逆向分析与官方文档两个证据点收敛重合（【三】↔【官】互证） */
const VerifyCell: React.FC<{value: string; sub: string; conv: number; flash: number; merged: number}> = ({
  value,
  sub,
  conv,
  flash,
  merged,
}) => (
  <Panel style={{width: 345, height: 214, boxSizing: 'border-box', padding: '18px 22px'}}>
    <div style={{fontFamily: theme.mono, fontSize: 52, fontWeight: 700, color: theme.text}}>
      {value}
    </div>
    <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 2}}>{sub}</div>
    <svg width={300} height={64} style={{marginTop: 10}}>
      {/* 两个证据点：白=逆向分析，绿=官方文档；conv→1 时收敛到中心同点 */}
      <circle cx={150 - (1 - conv) * 96} cy={30} r={10} fill={theme.text} opacity={1 - merged * 0.85} />
      <circle cx={150 + (1 - conv) * 96} cy={30} r={10} fill={theme.ok} opacity={1 - merged * 0.85} />
      {/* 重合闪亮：ok 光环 + 合点（分镜 @impulse 双点重合） */}
      <circle
        cx={150}
        cy={30}
        r={18 + flash * 20}
        fill="none"
        stroke={theme.ok}
        strokeWidth={2.5}
        opacity={merged * (0.35 + 0.65 * flash)}
      />
      <circle cx={150} cy={30} r={11} fill={theme.ok} opacity={merged} />
      <text x={150 - (1 - conv) * 96} y={58} textAnchor="middle" fill={theme.dim} fontSize={14} fontFamily={theme.mono} opacity={1 - conv}>
        {'逆向'}
      </text>
      <text x={150 + (1 - conv) * 96} y={58} textAnchor="middle" fill={theme.dim} fontSize={14} fontFamily={theme.mono} opacity={1 - conv}>
        {'官方'}
      </text>
      <text x={150} y={60} textAnchor="middle" fill={theme.ok} fontSize={16} fontFamily={theme.sans} opacity={merged}>
        {'同一个数'}
      </text>
    </svg>
  </Panel>
);

const DualRulers: React.FC<{at07: number; at08: number; at09: number}> = ({at07, at08, at09}) => {
  const inL = useEnter('rise', {at: at07, dur: DUR.f5, dist: 26});
  // 左标尺水位（@count）：p6-07 起涨，p6-09 前一刻抵达 967K 触发线
  const riseDur = Math.max(DUR.f6, at09 - at07 - 12);
  const rise = useCount({from: 0, to: 967, at: at07 + 10, dur: riseDur});
  const flash = useImpulse({at: at09, dur: DUR.f6, peak: 1});
  // 右双格：p6-08 收敛，p6-09 重合闪亮
  const conv = useProgress(at08, DUR.f6);
  const merged = useProgress(at08 + DUR.f6, DUR.f3);
  const tagIn = useProgress(at09, DUR.f4);
  const TRACK_W = 660;

  return (
    <AbsoluteFill>
      {/* 左：1M 窗口标尺 + 967K 触发线（工况角标【官】） */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 300,
          width: 780,
          opacity: inL.opacity,
          transform: inL.transform,
        }}
      >
        <Panel style={{padding: '24px 30px', boxSizing: 'border-box'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
              {'窗口用量'}
            </span>
            <OfficialPill text="官方文档 · 工况" />
          </div>
          {/* 水位读数：左置于标题下（与右侧触发线标签「967K 才动手」分带，防随水位右移撞字） */}
          <div
            style={{
              position: 'absolute',
              left: 30,
              top: 76,
              fontFamily: theme.mono,
              fontSize: 40,
              fontWeight: 700,
              color: theme.accent,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {`${Math.round(rise)}K`}
          </div>
          {/* 标尺轨道 + 刻度 */}
          <div style={{position: 'relative', height: 96, marginTop: 92}}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: (i * TRACK_W) / 4 - 1,
                  top: 22,
                  width: 2,
                  height: 16,
                  background: theme.panelBorder,
                }}
              />
            ))}
            {['0', '250K', '500K', '750K', '1M'].map((t, i) => (
              <div
                key={t}
                style={{
                  position: 'absolute',
                  left: (i * TRACK_W) / 4 - 30,
                  top: 42,
                  width: 60,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 17,
                  color: theme.dim,
                }}
              >
                {t}
              </div>
            ))}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 8,
                width: TRACK_W,
                height: 14,
                borderRadius: 7,
                background: theme.panelBorder,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: 14,
                  width: clamp01(rise / 1000) * TRACK_W,
                  background: theme.accent,
                  borderRadius: 7,
                }}
              />
            </div>
            {/* 967K 触发线：水位抵达即闪亮 */}
            <div
              style={{
                position: 'absolute',
                left: 0.967 * TRACK_W - 2,
                top: -18,
                width: 4,
                height: 58,
                borderRadius: 2,
                background: theme.accent,
                boxShadow: `0 0 ${14 * flash + 4}px ${withAlpha(theme.accent, 0.35 + 0.55 * flash)}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0.967 * TRACK_W - 336,
                top: -58,
                width: 322,
                textAlign: 'right',
                fontFamily: theme.sans,
                fontSize: 24,
                fontWeight: 600,
                color: theme.accent,
              }}
            >
              {'967K 才动手'}
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: theme.mono,
              fontSize: 18,
              color: theme.dim,
            }}
          >
            {'1M 窗口 · 用到 96.7% 才触发'}
          </div>
        </Panel>
      </div>

      {/* 右：目录页双格上限（200 行／25KB）双点重合 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 300,
          width: 830,
          opacity: inL.opacity,
          transform: inL.transform,
        }}
      >
        <Panel style={{padding: '24px 30px', boxSizing: 'border-box'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
              {'目录页加载上限'}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
              {'.memory/MEMORY.md'}
            </span>
          </div>
          <div style={{display: 'flex', gap: 24, marginTop: 18}}>
            <VerifyCell value="200 行" sub="头 200 行" conv={conv} flash={flash} merged={merged} />
            <VerifyCell value="25KB" sub="字节上限" conv={conv} flash={flash} merged={merged} />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 26,
              marginTop: 14,
              fontFamily: theme.sans,
              fontSize: 18,
              color: theme.dim,
            }}
          >
            <span>
              <span style={{color: theme.text}}>{'● '}</span>
              {'逆向分析【三】'}
            </span>
            <span>
              <span style={{color: theme.ok}}>{'● '}</span>
              {'官方文档【官】'}
            </span>
          </div>
        </Panel>
      </div>

      {/* p6-09 顶注：两路证据指向同一个数 */}
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 228,
          opacity: tagIn,
          transform: `scale(${1 + 0.07 * flash})`,
        }}
      >
        <Panel
          accent={theme.ok}
          style={{padding: '10px 22px', boxShadow: `0 0 ${16 * flash}px ${withAlpha(theme.ok, 0.4 * flash)}`}}
        >
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.ok}}>
            {'两路证据 · 同一个数'}
          </span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-C 生产形态两帧：挑选帧 → 提取帧 ────────────────────────────────────

/** 卡片墙几何：6 列 × 4 行（列序=修改时间序，扫描游标自左向右） */
const WALL = {x: 170, y: 250, cols: 6, rows: 4, cw: 150, ch: 116, gap: 12} as const;
const WALL_W = WALL.cols * WALL.cw + (WALL.cols - 1) * WALL.gap; // 960

/** 选中卡（列散布 1..5，扫描依次点亮）与犹豫卡的下标（行 r 列 c → r*6+c） */
const SELECTED = [1, 8, 15, 22, 23] as const;
const HESITANT = 10;
const CARD_LABELS: Record<number, string> = {
  1: 'tab 缩进',
  8: 'bug 在哪',
  10: '临时口头约定',
  15: '常用命令',
  22: '项目结构',
  23: '评审口径',
};
/** 卡中心 x 的通过进度阈值（扫描游标越过中心即点亮） */
const passP = (idx: number) => ((idx % WALL.cols) * (WALL.cw + WALL.gap) + WALL.cw / 2) / WALL_W;

/** 扫描审阅人形（模型自己读着挑——text 白，无彩）；定位由包裹层持有 */
const Reviewer: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div style={style}>
    <svg width={40} height={52} viewBox="0 0 40 52">
      <circle cx={20} cy={10} r={9} fill={theme.text} />
      <path d="M4 52 Q4 24 20 22 Q36 24 36 52 Z" fill={theme.text} />
    </svg>
  </div>
);

/** 提取帧箭头（fire-and-forget：mech 流光虚线，发出不等结果）；定位由包裹层持有 */
const FireArrow: React.FC = () => {
  const dash = useFlowDash({dash: 14, gap: 16, period: 26});
  return (
    <svg width={460} height={130} viewBox="0 0 460 130">
      <path
        d="M 12 78 C 140 24 320 24 434 74"
        stroke={theme.mech}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dash.strokeDasharray}
        strokeDashoffset={dash.strokeDashoffset}
      />
      <polygon points="452,80 420,58 426,92" fill={theme.mech} />
    </svg>
  );
};

const ProdShapes: React.FC<{at10: number; at10b: number; dur10b: number; at11: number}> = ({
  at10,
  at10b,
  dur10b,
  at11,
}) => {
  const pickOut = useProgress(at11, DUR.f4);
  const wallIn = useProgress(at10, DUR.f5);
  const cards = useStagger(WALL.cols * WALL.rows, {at: at10 + 4, dur: DUR.f2, stride: 1});
  const rules = useStagger(3, {at: at10 + 8, dur: DUR.f4, stride: 9});
  // 扫描游标（分镜 @travel）：p6-10b 全窗线性扫过卡片墙
  const scanP = useProgress(at10b, Math.max(1, dur10b), 'linear');
  const scanGate = useProgress(at10b - 2, DUR.f3);
  const scanX = WALL.x + scanP * WALL_W;
  const selCount = SELECTED.reduce((n, i) => n + (scanP >= passP(i) ? 1 : 0), 0);
  // 犹豫章：游标越过犹豫卡中心时弹落（snap 过冲=「盖章」手感）
  const stampF = at10b + passP(HESITANT) * Math.max(1, dur10b);
  const stampO = useProgress(stampF, DUR.f4);
  const stampS = useSpring('snap', {at: stampF, dur: DUR.f5});
  // 提取帧三件错峰：回合卡 → 箭头 → 受限进程
  const ex = useStagger(3, {at: at11 + DUR.f4 + 2, dur: DUR.f5, stride: 10});
  const hookPop = useSpring('settle', {at: at11 + DUR.f4 + 10, dur: DUR.f5});
  const hookNote = useProgress(at11 + DUR.f4 + 16, DUR.f4);

  return (
    <AbsoluteFill>
      {/* ── 挑选帧（p6-10..p6-10b，at11 起让位提取帧） ── */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: wallIn * (1 - pickOut)}}>
        {/* 卡片墙（按修改时间排序） */}
        {Array.from({length: WALL.cols * WALL.rows}, (_, i) => {
          const c = i % WALL.cols;
          const r = Math.floor(i / WALL.cols);
          const isSel = (SELECTED as readonly number[]).includes(i);
          const selOn = isSel && scanP >= passP(i) ? 1 : 0;
          const isHes = i === HESITANT;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: WALL.x + c * (WALL.cw + WALL.gap),
                top: WALL.y + r * (WALL.ch + WALL.gap),
                width: WALL.cw,
                opacity: cards[i],
              }}
            >
              <Panel
                accent={isSel && selOn ? theme.mech : theme.panelBorder}
                style={{width: WALL.cw, boxSizing: 'border-box', padding: '10px 12px', minHeight: WALL.ch}}
              >
                <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>
                  {`M${String(i + 1).padStart(2, '0')}`}
                </div>
                {CARD_LABELS[i] ? (
                  <div
                    style={{
                      fontFamily: theme.sans,
                      fontSize: 19,
                      marginTop: 8,
                      color: isHes ? theme.dim : selOn ? theme.text : theme.dim,
                      fontWeight: selOn ? 600 : 400,
                    }}
                  >
                    {CARD_LABELS[i]}
                  </div>
                ) : (
                  <div
                    style={{
                      height: 8,
                      width: '78%',
                      borderRadius: 4,
                      background: theme.panelBorder,
                      marginTop: 12,
                    }}
                  />
                )}
              </Panel>
              {/* 犹豫卡：盖「拿不准就不选」章（danger 拦截语义） */}
              {isHes ? (
                <div
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: 34,
                    transform: `rotate(-8deg) scale(${0.8 + 0.2 * stampS})`,
                    opacity: stampO,
                    border: `2px solid ${theme.danger}`,
                    borderRadius: 8,
                    padding: '4px 10px',
                    background: withAlpha(theme.bg, 0.72 * stampO),
                    fontFamily: theme.sans,
                    fontSize: 17,
                    fontWeight: 700,
                    color: theme.danger,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {'拿不准就不选'}
                </div>
              ) : null}
            </div>
          );
        })}
        {/* 扫描游标 + 审阅人形 */}
        <div
          style={{
            position: 'absolute',
            left: scanX - 1,
            top: WALL.y - 10,
            width: 2,
            height: WALL.rows * (WALL.ch + WALL.gap) - WALL.gap + 20,
            background: theme.text,
            opacity: 0.62 * scanGate,
          }}
        />
        <Reviewer
          style={{position: 'absolute', left: scanX - 20, top: WALL.y - 66, opacity: 0.92 * scanGate}}
        />
      </div>

      {/* 挑选帧右侧规则面板 */}
      <div
        style={{
          position: 'absolute',
          left: 1190,
          top: 250,
          width: 560,
          opacity: wallIn * (1 - pickOut),
        }}
      >
        <Panel style={{padding: '24px 28px', boxSizing: 'border-box'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {'模型自己挑'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 6}}>
            {'读着挑 · 不靠相似度检索'}
          </div>
          <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10}}>
            {['按修改时间排序 · 全量扫描', '拿不准就不选', '最多回 5 条'].map((t, i) => (
              <div
                key={t}
                style={{
                  fontFamily: theme.mono,
                  fontSize: 20,
                  color: i === 1 ? theme.danger : theme.dim,
                  opacity: rules[i],
                  transform: `translateX(${(1 - rules[i]) * 14}px)`,
                }}
              >
                {i === 2 ? `最多回 5 条 · 选中 ${selCount}/5` : t}
              </div>
            ))}
          </div>
          {/* 五槽位：选中数随扫描推进点亮（帧推导，无状态） */}
          <div style={{display: 'flex', gap: 10, marginTop: 16}}>
            {[0, 1, 2, 3, 4].map((j) => (
              <div
                key={j}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  border: `2px solid ${j < selCount ? theme.mech : theme.panelBorder}`,
                  background: j < selCount ? withAlpha(theme.mech, 0.16) : 'transparent',
                }}
              />
            ))}
          </div>
        </Panel>
      </div>

      {/* ── 提取帧（p6-11）── */}
      {/* 交叉淡入：与挑选帧退场同期（勿改回 1-pickOut——子件 at11+9 才入场，
          反向 fade 会让提取帧在登场前归零、整镜空台，2026-10-03 评审抽帧实锤） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: pickOut}}>
        {/* 回合结束卡 + 挂钩弹起（分镜 @enter:pop → settle 弹起） */}
        <div
          style={{
            position: 'absolute',
            left: 170,
            top: 320,
            width: 480,
            opacity: ex[0],
            transform: `translateY(${(1 - ex[0]) * 18}px)`,
          }}
        >
          <Panel style={{padding: '24px 30px', boxSizing: 'border-box', minHeight: 330}}>
            <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
              {'回合结束'}
            </div>
            {[92, 70, 80, 44].map((wd, i) => (
              <div
                key={i}
                style={{
                  height: 14,
                  width: `${wd}%`,
                  borderRadius: 7,
                  background: theme.panelBorder,
                  marginTop: 16,
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                right: 26,
                top: 226,
                opacity: hookPop,
                transform: `translateY(${(1 - hookPop) * 26}px)`,
              }}
            >
              <svg width={92} height={72} viewBox="0 0 92 72">
                <path
                  d="M22 6 L22 44 Q22 64 48 64 Q70 64 70 46"
                  stroke={theme.mech}
                  strokeWidth={9}
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 17,
                  color: theme.dim,
                  marginTop: 2,
                  opacity: hookNote,
                }}
              >
                {'stop hook'}
              </div>
            </div>
          </Panel>
        </div>

        {/* fire-and-forget 箭头（@flowDash：发出不等结果） */}
        <div
          style={{
            position: 'absolute',
            left: 682,
            top: 396,
            opacity: ex[1],
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 40,
              top: -36,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.mech,
              whiteSpace: 'nowrap',
            }}
          >
            {'发出不等结果'}
          </div>
          <FireArrow />
        </div>

        {/* 受限进程卡（角标：不写对话记录 · 最多五轮） */}
        <div
          style={{
            position: 'absolute',
            left: 1170,
            top: 320,
            width: 580,
            opacity: ex[2],
            transform: `translateY(${(1 - ex[2]) * 18}px)`,
          }}
        >
          <Panel style={{padding: '24px 30px', boxSizing: 'border-box', minHeight: 330}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
              <svg width={50} height={58} viewBox="0 0 50 58">
                <rect
                  x={7}
                  y={26}
                  width={36}
                  height={27}
                  rx={6}
                  stroke={theme.dim}
                  strokeWidth={4}
                  fill="none"
                />
                <path
                  d="M15 26 v-7 a10 10 0 0 1 20 0 v7"
                  stroke={theme.dim}
                  strokeWidth={4}
                  fill="none"
                />
              </svg>
              <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
                {'受限进程'}
              </div>
            </div>
            <div style={{display: 'flex', gap: 14, marginTop: 24}}>
              {['不写对话记录', '最多五轮'].map((t) => (
                <span
                  key={t}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 999,
                    border: `1px solid ${theme.panelBorder}`,
                    fontFamily: theme.sans,
                    fontSize: 22,
                    color: theme.dim,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.dim,
                marginTop: 26,
              }}
            >
              {'后台提取 · 下一回合才用'}
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-D 五规律卡翻页 ────────────────────────────────────────────────────

const LAWS = [
  {name: '代价阶梯', verdict: '可逆先跑 · 有损殿后', tag: '成本'},
  {name: '配对完整', verdict: '裁剪不拆散配对', tag: '结构'},
  {name: '前缀稳定', verdict: '位置定缓存命运', tag: '经济学'},
  {name: '垃圾优先', verdict: '死于写错 · 非记不住', tag: '治理'},
  {name: '索引正文分离', verdict: '目录常驻 · 正文按需', tag: '检索'},
] as const;

/** 单卡：rotateX 翻上（同 P0/P2 翻牌手法）；判词行随卡同帧，域 chip 后亮 */
const LawCard: React.FC<{
  index: number;
  law: (typeof LAWS)[number];
  at: number;
  vAt: number;
  until: number;
}> = ({index, law, at, vAt, until}) => {
  // spatial 走弹簧（rotateX）、effects 走时长+缓动（opacity）——运动层铁律③
  const flip = useSpring('settle', {at, dur: DUR.f5});
  const flipO = useProgress(at, DUR.f5);
  const activeP = useProgress(vAt, DUR.f4) * (1 - useProgress(until, DUR.f4));
  const dimP = useProgress(until, DUR.f4);
  return (
    <div style={{perspective: 640, height: 104}}>
      <div
        style={{
          transformOrigin: '50% 100%',
          transform: `rotateX(${(1 - flip) * -72}deg)`,
          opacity: flipO * (1 - 0.32 * dimP),
        }}
      >
        <div style={{position: 'relative'}}>
          <Panel style={{padding: '18px 26px', boxSizing: 'border-box', minHeight: 104}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
              <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
                {law.name}
              </span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'|'}</span>
              {/* 判词行（分镜 @enter:rise——随翻卡同帧浮出） */}
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{law.verdict}</span>
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '6px 16px',
                  borderRadius: 999,
                  border: `1px solid ${theme.panelBorder}`,
                  fontFamily: theme.sans,
                  fontSize: 21,
                  color: theme.dim,
                  boxShadow: `0 0 ${12 * activeP}px ${withAlpha(theme.core, 0.5 * activeP)}`,
                }}
              >
                {law.tag}
              </span>
            </div>
          </Panel>
          {/* 激活描边覆盖层（尾区 core 橙，与 map-anchor 尾区色契约同源） */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 14,
              border: `2px solid ${theme.core}`,
              opacity: activeP,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};

const FiveLaws: React.FC<{
  at12: number;
  at13: number;
  end14: number;
  end15: number;
  end16: number;
  at17: number;
}> = ({at12, at13, end14, end15, end16, at17}) => {
  const headIn = useProgress(at12, DUR.f4);
  // 总括句与首卡同帧（分镜）；卡 2..4 在各判词句语音段末翻上——回看 cue 收缩到
  // 语音段（句窗含 20 帧句隙），句隙里卡完整可见（弹簧 f5=12 帧，画框边界即
  // 卸载、无出场动画）；卡 5 随 p6-17（该句无 cue，全程可见）。
  const flipAts = [at12 + 8, end14, end15, end16, at17];
  const vAts = [at13, end14, end15, end16, at17];
  const untils = [end14, end15, end16, at17, at17 + DUR.f6 * 3];
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 156,
          fontFamily: theme.serif,
          fontSize: 40,
          fontWeight: 700,
          color: theme.text,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * 12}px)`,
        }}
      >
        {'五条带得走的规律'}
      </div>
      <div style={{position: 'absolute', left: 330, top: 236, width: 1260}}>
        {LAWS.map((law, i) => (
          <div key={law.name} style={{marginBottom: 26}}>
            <LawCard index={i} law={law} at={flipAts[i]} vAt={vAts[i]} until={untils[i]} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── 6-E 边界与收尾 ──────────────────────────────────────────────────────

const DISPUTES = [
  {title: '窗口大小之争', q: '压缩会被终结吗？', sides: ['会 · 纸越做越大', '不会 · 盯账单与注意力']},
  {title: '提取时机之争', q: '放会话尾，还是每一轮？', sides: ['会话尾 · 低干扰', '每一轮 · 及时性']},
] as const;

const GUARD_CONDS = ['单个助手', '消息列表式对话', '调用配对结果的接口'] as const;

/** 信源卡四条（系列惯例：右下小字；官方文档取数日 2026-09-30，gl-notes C 型快照） */
const SRC_LINES = [
  '官方文档 · code.claude.com · 2026-09-30 取数',
  'Anthropic 工程博客',
  '第三方源码分析已逐处标注',
  '画面数字均为实测口径',
] as const;

const Finale: React.FC<{
  at18: number;
  at19: number;
  at20: number;
  at21: number;
  at23: number;
  at24: number;
  at25: number;
  span: number;
}> = ({at18, at19, at20, at21, at23, at24, at25, span}) => {
  const cards = useStagger(2, {at: at18, dur: DUR.f5, stride: 8});
  const sides1 = useProgress(at19, DUR.f5);
  const sides2 = useProgress(at20, DUR.f5);
  const sides = [sides1, sides2];
  const guardIn = useProgress(at21, DUR.f5);
  const conds = useStagger(3, {at: at21 + 6, dur: DUR.f4, stride: 8});
  const outOfScope = useProgress(at21 + 26, DUR.f4);
  // 金句卡（p6-23）与对句（p6-24）；p6-25 让位收尾栈
  // 阶段一在金句卡登场时压暗，并在 p6-25 收尾栈入场前完全清场（残影叠压五层栈）
  const phase1Dim = useDim({at: at23, to: 0.12, dur: DUR.f5});
  const phase1Gone = useProgress(at25 - DUR.f4, DUR.f4);
  const phase1 = phase1Dim * (1 - phase1Gone);
  const quoteIn = useEnter('rise', {at: at23, dur: DUR.f5, springPreset: 'settleSoft', dist: 22});
  const subIn = useProgress(at24 + 2, DUR.f4);
  const quoteOut = useProgress(at25 - DUR.f5, DUR.f5);
  // 收尾：栈放大居中 + 身份卡/下期卡/信源卡（p6-25）
  const stackIn = useProgress(at25, DUR.f5);
  const idIn = useProgress(at25 + 6, DUR.f5);
  const nextIn = useProgress(at25 + 14, DUR.f5);
  const srcs = useStagger(4, {at: at25 + DUR.f5, dur: DUR.f3, stride: 4});
  // 记忆层 mech 呼吸光环（分镜 @breathe 记忆层脉冲——叠加层，不动冻结件）
  const breath = useBreathe({period: 46, amp: 0.5, base: 0.5});
  const keep = useFadeOut(span, {frames: 36});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 坐标装置尾区收束（chip 形态：全屏三分卡与争议/收尾卡几何冲突） */}
      <MapAnchorChip active="tail" enterAt={0} />

      {/* 阶段一：两争议悬置双面卡（不裁决）+ 边界护栏卡 */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: phase1}}>
        {DISPUTES.map((d, i) => (
          <div
            key={d.title}
            style={{
              position: 'absolute',
              left: 170 + i * 840,
              top: 172,
              width: 740,
              opacity: cards[i],
              transform: `translateY(${(1 - cards[i]) * 16}px)`,
            }}
          >
            <Panel style={{padding: '22px 28px', boxSizing: 'border-box'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: theme.text}}>
                  {d.title}
                </span>
                <span
                  style={{
                    padding: '3px 12px',
                    borderRadius: 999,
                    border: `1px solid ${theme.panelBorder}`,
                    fontFamily: theme.sans,
                    fontSize: 17,
                    color: theme.dim,
                  }}
                >
                  {'悬置 · 不裁决'}
                </span>
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>
                {d.q}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginTop: 18,
                  opacity: sides[i],
                  transform: `translateY(${(1 - sides[i]) * 12}px)`,
                }}
              >
                {[0, 1].map((s) => (
                  <React.Fragment key={s}>
                    {s === 1 ? (
                      <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'vs'}</span>
                    ) : null}
                    <div
                      style={{
                        flex: 1,
                        border: `1px solid ${theme.panelBorder}`,
                        borderRadius: 10,
                        padding: '12px 16px',
                        fontFamily: theme.sans,
                        fontSize: 23,
                        color: theme.text,
                        background: theme.bg,
                      }}
                    >
                      {d.sides[s]}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </Panel>
          </div>
        ))}

        {/* 边界护栏卡：成立前提三条件（标签用「成立前提」，防与 §9.1「成立工况」相撞） */}
        <div
          style={{
            position: 'absolute',
            left: 330,
            top: 528,
            width: 1260,
            opacity: guardIn,
            transform: `translateY(${(1 - guardIn) * 16}px)`,
          }}
        >
          <Panel
            accent={theme.ok}
            style={{padding: '20px 28px', boxSizing: 'border-box'}}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
              <span
                style={{
                  padding: '6px 16px',
                  borderRadius: 999,
                  border: `1px solid ${withAlpha(theme.ok, 0.75)}`,
                  fontFamily: theme.sans,
                  fontSize: 21,
                  color: theme.ok,
                  whiteSpace: 'nowrap',
                }}
              >
                {'成立前提'}
              </span>
              {GUARD_CONDS.map((c, i) => (
                <span
                  key={c}
                  style={{
                    padding: '6px 18px',
                    borderRadius: 999,
                    border: `1px solid ${theme.panelBorder}`,
                    fontFamily: theme.sans,
                    fontSize: 23,
                    color: theme.text,
                    opacity: conds[i],
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 19,
                color: theme.dim,
                marginTop: 14,
                opacity: outOfScope,
              }}
            >
              {'Out-of-Scope · 超出范围另当别论'}
            </div>
          </Panel>
        </div>
      </div>

      {/* 阶段二：金句卡（衬线，口播原句逗号形）+ 对句 + mech 点睛线 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 380,
          width: 1920,
          textAlign: 'center',
          opacity: quoteIn.opacity * (1 - quoteOut),
          transform: quoteIn.transform,
        }}
      >
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 58,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 6,
          }}
        >
          {/* caption-dup-ok: 金句卡刻意逐字复述 p6-23 口播原句（storyboard 2-D「刻意逐字」） */}
          {'一张草稿纸，一本卡片册'}
        </div>
        <div
          style={{
            width: 148,
            height: 4,
            borderRadius: 2,
            background: theme.mech,
            margin: '26px auto 0',
            opacity: subIn,
          }}
        />
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.dim,
            marginTop: 24,
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 10}px)`,
          }}
        >
          {'会话内 · 省 ｜ 跨会话 · 挑'}
        </div>
      </div>

      {/* 阶段三：五层 Harness 栈放大居中（记忆层 mech 光环）+ 身份/下期/信源卡 */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: stackIn}}>
        {/* mech 呼吸光环：第 3 行（记忆管理）背后（层高 72 + 间距 8 → 行距 80） */}
        <div
          style={{
            position: 'absolute',
            left: 462,
            top: 298 + 2 * 80 - 8,
            width: 436,
            height: 88,
            borderRadius: 14,
            background: withAlpha(theme.mech, 0.05 + 0.07 * breath),
            boxShadow: `0 0 ${26 * breath}px ${withAlpha(theme.mech, 0.2 * breath)}`,
          }}
        />
        <div style={{position: 'absolute', left: 470, top: 298}}>
          <HarnessStackP6 at={at25 + 2} nextBreathAt={at25 + DUR.f6} />
        </div>
        {/* 系列标语压栈底（几何推导：栈高 5×72+4×8=392，+30 安全距） */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 298 + 392 + 30,
            width: 420,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 22,
            color: theme.dim,
            letterSpacing: 3,
          }}
        >
          {'Claude Code Harness Engineering'}
        </div>

        {/* 系列身份卡：标题主段为 check_series 规则 8 受检硬编码（文件头） */}
        <div
          style={{
            position: 'absolute',
            left: 1010,
            top: 292,
            width: 810,
            opacity: idIn,
            transform: `translateY(${(1 - idIn) * 18}px)`,
          }}
        >
          <Panel accent={theme.core} style={{padding: '26px 32px', boxSizing: 'border-box'}}>
            <div style={{fontFamily: theme.serif, fontSize: 21, color: theme.dim, letterSpacing: 3}}>
              {'Claude Code Harness Engineering'}
            </div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 20, whiteSpace: 'nowrap'}}>
              <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>
                {LAYERS[ACTIVE_INDEX - 1]?.layer ?? ''}
              </span>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.panelBorder}}>{'|'}</span>
              <span
                style={{
                  fontFamily: theme.serif,
                  fontSize: 40,
                  fontWeight: 700,
                  color: theme.core,
                }}
              >
                {'一张草稿纸和一本卡片册'}
              </span>
            </div>
          </Panel>
        </div>

        {/* 下期卡：标题主段受检硬编码（规则 8）；层短名走 series-layers 数据 */}
        <div
          style={{
            position: 'absolute',
            left: 1010,
            top: 492,
            width: 810,
            opacity: nextIn,
            transform: `translateY(${(1 - nextIn) * 18}px)`,
          }}
        >
          <div
            style={{
              width: 810,
              boxSizing: 'border-box',
              padding: '20px 32px',
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 14,
              background: theme.panel,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, letterSpacing: 2}}>
              {`下期 · ${NEXT_LAYER?.layer ?? ''}`}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 36, fontWeight: 700, color: theme.text, marginTop: 10}}>
              {'谁来按下开始'}
            </div>
          </div>
        </div>

        {/* 信源卡四条（右下小字，bottom 180 ≥ 150 避字幕带） */}
        <div
          style={{
            position: 'absolute',
            right: 72,
            bottom: 180,
            textAlign: 'right',
            fontFamily: theme.mono,
            fontSize: 17,
            lineHeight: 1.9,
            color: theme.dim,
          }}
        >
          {SRC_LINES.map((s, i) => (
            <div key={s} style={{opacity: srcs[i]}}>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* 末 36 帧渐黑（红线四：窗取整镜 6-E 时长，勿用末句时长） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6Production: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-05');
  const bB = w('p6-07', 'p6-09');
  const bC = w('p6-10', 'p6-11');
  const bD = w('p6-12', 'p6-17');
  const bE = w('p6-18', 'p6-25');

  // 常驻系列条：6-E 金句卡（p6-23）起隐藏——收尾栈放大时五层信息已在栈上
  const frame = useCurrentFrame();
  const badgeO = 1 - progress(frame, at('p6-23'), DUR.f4);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />

      <Sequence {...bA} name="6-A 双问回收与对照">
        {/* SceneTag 平移到 Badge 右侧共存（文件头「顶部行共存」说明） */}
        <div style={{transform: 'translateX(660px)'}}>
          <SceneTag chapter="Production" tagline="照进生产" accent={theme.mech} />
        </div>
        <MapAnchorChip active="tail" enterAt={4} />
        <DualRecall
          at01={at('p6-01') - bA.from}
          at02={at('p6-02') - bA.from}
          at03={at('p6-03') - bA.from}
          at04={at('p6-04') - bA.from}
          at04b={at('p6-04b') - bA.from}
          at05={at('p6-05') - bA.from}
        />
        {/* p6-03 骨架回看：四层管线全景回放（空窗后重现 → lead 默认入场） */}
        <ArchifyRecap
          slug="compact-pipeline"
          caption="开源教学骨架"
          cues={[
            {chapterId: 'cheap-first', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')},
          ]}
        />
        <Footnote delay={6}>{'contextCollapse'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="6-B 互证双标尺">
        <DualRulers at07={at('p6-07') - bB.from} at08={at('p6-08') - bB.from} at09={at('p6-09') - bB.from} />
        <Footnote delay={4}>{'MEMORY.md · 头 200 行 / 25KB'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="6-C 生产形态两帧">
        <ProdShapes
          at10={at('p6-10') - bC.from}
          at10b={at('p6-10b') - bC.from}
          dur10b={dur('p6-10b')}
          at11={at('p6-11') - bC.from}
        />
        <Footnote delay={4}>{'stop hook · fire-and-forget'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="6-D 五规律卡">
        <FiveLaws
          at12={at('p6-12') - bD.from}
          at13={at('p6-13') - bD.from}
          end14={at('p6-14') + dur('p6-14') - SENTENCE_GAP_FRAMES - bD.from}
          end15={at('p6-15') + dur('p6-15') - SENTENCE_GAP_FRAMES - bD.from}
          end16={at('p6-16') + dur('p6-16') - SENTENCE_GAP_FRAMES - bD.from}
          at17={at('p6-17') - bD.from}
        />
        {/* 规律回看：三条规律各锚回其机制图（章可重放、锚句唯一）；cue 收缩到
            语音段（句窗含 20 帧句隙，让给五规律卡翻页——画框无出场动画、
            Sequence 边界即卸载），实例间隔 20 帧＝空窗 → 三例均默认入场 */}
        <ArchifyRecap
          slug="pairing-interlock"
          caption="规律 · 结构"
          cues={[
            {chapterId: 'retreat-fix', at: at('p6-14') - bD.from, durationInFrames: dur('p6-14') - SENTENCE_GAP_FRAMES},
          ]}
        />
        <ArchifyRecap
          slug="cache-economics"
          caption="规律 · 经济学"
          cues={[
            // 3.9s 窗 × storySec 5.57s → rate 1.43 落 trim（显式留痕）：bill 终拍
            // 不到达，取舍＝规律回看拍到 cacheHit/fullPrice 证据链即足
            {chapterId: 'prefix-hit', at: at('p6-15') - bD.from, durationInFrames: dur('p6-15') - SENTENCE_GAP_FRAMES, fit: 'trim'},
          ]}
        />
        <ArchifyRecap
          slug="memory-gates"
          caption="规律 · 治理"
          cues={[
            {chapterId: 'one-of-three', at: at('p6-16') - bD.from, durationInFrames: dur('p6-16') - SENTENCE_GAP_FRAMES},
          ]}
        />
        <Footnote delay={4}>{'LSM-tree · B-tree'}</Footnote>
      </Sequence>

      <Sequence {...bE} name="6-E 边界与收尾">
        <Finale
          at18={at('p6-18') - bE.from}
          at19={at('p6-19') - bE.from}
          at20={at('p6-20') - bE.from}
          at21={at('p6-21') - bE.from}
          at23={at('p6-23') - bE.from}
          at24={at('p6-24') - bE.from}
          at25={at('p6-25') - bE.from}
          span={bE.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6Production;
