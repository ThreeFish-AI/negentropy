/** P4 登记簿与扉页（p4-01..32，6 镜 14 cue）——分镜 4-A…4-F。
 *
 *  叙事链：登记簿自右缘开张（mech）＋一文件一记忆卡（头三行＋正文）→ 同名卡
 *  弹簧吸附合一（slug 点亮）→ Lottie page-flip 扉页目录首现 → memory-ledger
 *  结构图四接力 → four-memory-types 三接力 → two-layer-loading 五接力（空窗句
 *  回落缓存条／官方一句卡）→ 目录员小剧场（只报序号／噪声筛出／降级关键词）→
 *  grep 计数归零卡＋【三】引语卡＋官方口径卡。
 *  空间契约：登记簿与扉页恒挂右缘（mech，不触碰左中 core 台面锚区）；台面侧
 *  对比压暗让位。archify 背靠背：4-C 接 4-B（p4-09→p4-10 无空窗）lead={false}；
 *  4-D 首 run 接 4-C（p4-12→p4-14 无空窗）lead={false}，cache-stakes 在
 *  p4-18..19 空窗后 → 独立实例默认入场（ep1 5-C 同款拆分）；4-E／4-F 空窗后
 *  重现保持默认 lead。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {LottieEmphasis} from '../components/LottieEmphasis';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, useCount, useDim, useEnter, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行（P1–P6 同值，Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 4-A 登记簿开张＋一文件一记忆卡（p4-01..04） ─────────────────────────

/** 登记簿物件（右缘锚位，mech）：书脊＋扉页行——本幕的常驻底景 */
const LedgerBookBig: React.FC = () => (
  <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
    <rect
      x={1230}
      y={300}
      width={430}
      height={490}
      rx={12}
      fill={theme.panel}
      stroke={theme.mech}
      strokeWidth={5}
    />
    <line x1={1278} y1={322} x2={1278} y2={768} stroke={theme.mechDeep} strokeWidth={5} />
    {[0, 1, 2, 3, 4].map((i) => (
      <line
        key={i}
        x1={1314}
        y1={380 + i * 62}
        x2={1620}
        y2={380 + i * 62}
        stroke={theme.dim}
        strokeWidth={3}
        opacity={0.55}
      />
    ))}
  </svg>
);

/** 台面缩微（左中锚位 core；M-001 同契约：恒描边色＋绝对线宽） */
const BenchMini: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <AbsoluteFill style={{opacity}}>
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
      <rect
        x={150}
        y={660}
        width={380}
        height={100}
        rx={12}
        fill={theme.panel}
        stroke={theme.core}
        strokeWidth={4}
      />
    </svg>
    <div
      style={{
        position: 'absolute',
        left: 150,
        top: 772,
        width: 380,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 19,
        color: theme.dim,
      }}
    >
      {'台面 · 压缩管得着'}
    </div>
  </AbsoluteFill>
);

const HEADER_ROWS = [
  {zh: '缩进', key: 'name'},
  {zh: '用制表符', key: 'description'},
  {zh: '偏好', key: 'type'},
] as const;

/** 记忆卡：头部三行（名字／说明／类型）＋正文块；rowsP = 逐行展开进度 */
const MemoryCard: React.FC<{x: number; y: number; w: number; rowsP: number[]; ghost?: boolean}> = ({
  x,
  y,
  w,
  rowsP,
  ghost = false,
}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w}}>
    <Panel accent={ghost ? theme.panelBorder : theme.mech} style={{padding: '20px 26px'}}>
      {HEADER_ROWS.map((r, i) => (
        <div
          key={r.key}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
            marginTop: i === 0 ? 0 : 12,
            opacity: ghost ? 0.85 : rowsP[i],
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: i === 0 ? 34 : 26, fontWeight: i === 0 ? 700 : 500, color: theme.text}}>
            {r.zh}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{r.key}</span>
        </div>
      ))}
      <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, opacity: ghost ? 0.6 : Math.min(...rowsP, 1)}}>
        <div style={{height: 6, borderRadius: 3, background: theme.panelBorder}} />
        <div style={{height: 6, width: '72%', borderRadius: 3, background: theme.panelBorder}} />
        <div style={{height: 6, width: '45%', borderRadius: 3, background: theme.panelBorder}} />
      </div>
    </Panel>
  </div>
);

const LedgerOpen: React.FC<{at02: number; at03: number; at04: number}> = ({at02, at03, at04}) => {
  const book = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 320, easing: 'decelerate'});
  const rowsP = useStagger(HEADER_ROWS.length, {at: at02, stride: 7, dur: DUR.f4});
  // 同名合并：settle 弹簧吃局部帧（铁律②）；过冲经 min(1,·) 钳行程
  const raw = useSpring('settle', {at: at03, dur: DUR.f5});
  const t = Math.min(1, raw);
  const dupX = 1020 - t * 420;
  const dupFade = 1 - clamp01((t - 0.82) / 0.18);
  const slugLit = clamp01((t - 0.7) / 0.3);
  const dimB = useDim({at: at04, to: 0.32, dur: DUR.f5});

  return (
    <AbsoluteFill>
      <BenchMini opacity={dimB} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...book}}>
        <LedgerBookBig />
        <div
          style={{
            position: 'absolute',
            left: 1230,
            top: 810,
            width: 430,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.mech,
          }}
        >
          {'登记簿'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1230,
            top: 848,
            width: 430,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'.memory/'}
        </div>
      </div>

      <MemoryCard x={560} y={320} w={360} rowsP={rowsP} />
      {/* p4-03 同名卡自右侧吸附合一：重叠即去重（同名＝同一文件） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: dupFade}}>
        <MemoryCard x={dupX} y={330} w={360} rowsP={[1, 1, 1]} ghost />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 620,
          width: 360,
          opacity: slugLit,
          transform: `translateY(${(1 - slugLit) * 10}px)`,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '8px 18px',
            borderRadius: 999,
            border: `2px solid ${theme.mech}`,
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.mech,
            boxShadow: `0 0 ${14 * slugLit}px ${theme.mechDeep}`,
          }}
        >
          {'slug: indent-style'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-B 扉页目录首现（p4-05）＋结构图（p4-06..09） ──────────────────────

const INDEX_ROWS = [
  {idx: '01', name: '偏好', desc: '用制表符'},
  {idx: '02', name: '反馈', desc: '口径一致'},
  {idx: '03', name: '项目', desc: '进行到'},
  {idx: '04', name: '线索', desc: '去哪找'},
] as const;

const IndexRow: React.FC<{idx: string; name: string; desc: string; at: number}> = ({idx, name, desc, at}) => {
  const revealed = useReveal(desc, {at, cps: 10});
  return (
    <div style={{display: 'flex', alignItems: 'baseline', gap: 20, height: 54}}>
      <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{idx}</span>
      <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{name}</span>
      <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{revealed}</span>
    </div>
  );
};

const IndexFirstPage: React.FC = () => {
  const rise = useEnter('rise', {at: 2, dur: DUR.f5, dist: 60, easing: 'decelerate'});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 290, width: 760, ...rise}}>
        <Panel accent={theme.mechDeep} style={{padding: '24px 34px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.mech, letterSpacing: 1}}>
              {'MEMORY.md'}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'index'}</span>
          </div>
          <div style={{marginTop: 14, height: 2, background: theme.panelBorder}} />
          <div style={{marginTop: 12}}>
            {INDEX_ROWS.map((r, i) => (
              <IndexRow key={r.idx} idx={r.idx} name={r.name} desc={r.desc} at={10 + i * 8} />
            ))}
          </div>
        </Panel>
      </div>
      {/* 翻页脉冲（page-flip 点缀）：锚扉页右上角，p4-05 句首 +8 帧起跳 */}
      <LottieEmphasis
        src="lottie/page-flip.json"
        at={8}
        duration={30}
        style={{position: 'absolute', left: 1210, top: 200, width: 150, height: 150, opacity: 0.95}}
      />
    </AbsoluteFill>
  );
};

// ── 4-D 空窗回落：缓存条（p4-18..19）＋官方一句卡（p4-21） ──────────────

/** 命中打点：缓存命中的一次性确认闪（ok＝确认瞬间瞬态语义） */
const CacheDot: React.FC<{at: number; x: number; y: number}> = ({at, x, y}) => {
  const g = useImpulse({at, dur: DUR.f5});
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
      <circle cx={x} cy={y} r={8 + 7 * g} fill={theme.ok} opacity={0.55 + 0.45 * (1 - g)} />
      <circle cx={x} cy={y} r={12 + 26 * g} fill="none" stroke={theme.ok} strokeWidth={3} opacity={(1 - g) * 0.8} />
    </svg>
  );
};

const CacheBar: React.FC = () => {
  // 打点时点：缓存条窗（两句）起点 + 错峰（窗起点即句边界 p4-18，非写死全局帧）
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 360,
          top: 400,
          width: 1200,
          fontFamily: theme.sans,
          fontSize: 32,
          color: theme.mech,
        }}
      >
        {'目录常驻 · 前缀锁定'}
      </div>
      <div style={{position: 'absolute', left: 360, top: 470, width: 1200, height: 76}}>
        {/* 前缀锁定段：mech 描边＋斜纹暗记（panel 族面色，读作「已锁定」） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 600,
            height: 76,
            borderRadius: 10,
            border: `3px solid ${theme.mech}`,
            background: `repeating-linear-gradient(135deg, ${theme.mechDeep}33 0 14px, transparent 14px 28px), ${theme.panel}`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 20,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'system · prefix'}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 600,
            top: 0,
            width: 600,
            height: 76,
            borderRadius: 10,
            border: `3px solid ${theme.panelBorder}`,
            background: theme.panel,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 20,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'user turn'}</span>
        </div>
      </div>
      <CacheDot at={14} x={470} y={508} />
      <CacheDot at={34} x={610} y={508} />
      <CacheDot at={54} x={750} y={508} />
    </AbsoluteFill>
  );
};

const OfficialSegment: React.FC = () => {
  const fade = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 510, top: 380, width: 900, ...fade}}>
        <Panel style={{padding: '26px 36px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'docs · memory'}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: 18}}>
            <div style={{flex: 1}}>
              <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.text}}>{'垫纸'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
                {'system prompt'}
              </div>
            </div>
            <div style={{width: 3, height: 76, background: theme.panelBorder}} />
            <div style={{flex: 1}}>
              <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.mech}}>{'独立段落'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
                {'memory segment'}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-E 目录员小剧场（p4-23 引子／p4-25..27 回落） ─────────────────────

const KeeperIntro: React.FC = () => {
  const fade = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...fade}}>
        {/* 旁路小工位（SideDesk 母题·本幕局部）：右缘小桌＋目录员剪影（dim 灰置） */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <circle cx={1370} cy={478} r={30} fill="none" stroke={theme.dim} strokeWidth={4} />
          <path
            d="M1310 560 Q1370 520 1430 560"
            fill="none"
            stroke={theme.dim}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <rect x={1210} y={596} width={340} height={70} rx={10} fill={theme.panel} stroke={theme.dim} strokeWidth={4} />
          <line x1={1250} y1={610} x2={1250} y2={652} stroke={theme.dim} strokeWidth={3} opacity={0.6} />
          <line x1={1300} y1={610} x2={1300} y2={652} stroke={theme.dim} strokeWidth={3} opacity={0.6} />
          <line x1={1350} y1={610} x2={1350} y2={652} stroke={theme.dim} strokeWidth={3} opacity={0.6} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 1210,
            top: 692,
            width: 340,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.dim,
          }}
        >
          {'目录员'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1210,
            top: 730,
            width: 340,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'只看用户的话'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 噪声纸团：被筛出＝deny 淡出（一次性消隐） */
const CrumpleShred: React.FC<{x: number; at: number}> = ({x, at}) => {
  const fadeOut = useProgress(at, DUR.f5, 'accelerate');
  return (
    <svg width={90} height={70} style={{position: 'absolute', left: x, top: 0, opacity: 1 - fadeOut * 0.9}}>
      <path
        d="M18 30 L30 12 L48 20 L66 10 L74 30 L60 44 L70 58 L44 52 L26 60 L20 44 Z"
        fill="none"
        stroke={theme.deny}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  );
};

const TheaterBox: React.FC<{x: number; p: number; children: React.ReactNode}> = ({x, p, children}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: 420,
      width: 400,
      opacity: p,
      transform: `translateY(${(1 - p) * 20}px)`,
    }}
  >
    {children}
  </div>
);

const Theater: React.FC = () => {
  const cards = useStagger(3, {at: 4, stride: 12, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <TheaterBox x={230} p={cards[0]}>
        <Panel accent={theme.mech} style={{padding: '20px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'只报序号'}</div>
          <div style={{display: 'flex', gap: 12, marginTop: 18}}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                style={{
                  display: 'inline-block',
                  width: 44,
                  height: 44,
                  lineHeight: '44px',
                  textAlign: 'center',
                  borderRadius: 8,
                  border: `2px solid ${n === 5 ? theme.deny : theme.panelBorder}`,
                  fontFamily: theme.mono,
                  fontSize: 22,
                  color: n === 5 ? theme.deny : theme.dim,
                }}
              >
                {n}
              </span>
            ))}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.deny, marginTop: 12}}>{'max 5'}</div>
        </Panel>
      </TheaterBox>
      <TheaterBox x={760} p={cards[1]}>
        <Panel style={{padding: '20px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'噪声筛出'}</div>
          <div style={{position: 'relative', height: 70, marginTop: 18}}>
            <CrumpleShred x={10} at={26} />
            <CrumpleShred x={130} at={40} />
            <CrumpleShred x={250} at={54} />
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 12}}>
            {'tools: not visible'}
          </div>
        </Panel>
      </TheaterBox>
      <TheaterBox x={1290} p={cards[2]}>
        <Panel style={{padding: '20px 26px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>
            {'降级关键词'}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 18}}>
            {/* 备用钥匙：dim 灰置（降级路径） */}
            <svg width={64} height={40}>
              <circle cx={16} cy={20} r={11} fill="none" stroke={theme.dim} strokeWidth={3.5} />
              <line x1={27} y1={20} x2={56} y2={20} stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" />
              <line x1={46} y1={20} x2={46} y2={30} stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" />
              <line x1={54} y1={20} x2={54} y2={30} stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" />
            </svg>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'fallback'}</span>
          </div>
        </Panel>
      </TheaterBox>
    </AbsoluteFill>
  );
};

// ── 4-F grep 归零卡（p4-28）＋【三】引语卡与官方口径（p4-30..32） ───────

const GrepZero: React.FC = () => {
  // 计数滚动：句窗（p4-28）起点 +8 帧，44 帧滚到 0（显式帧窗注释——镜级动作）
  const roll = useCount({from: 128, to: 0, at: 8, dur: 44, ease: 'accelerate'});
  const zero = useImpulse({at: 52, dur: DUR.f5});
  const n = Math.max(0, Math.round(roll));
  const landed = n <= 0;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 580, top: 290, width: 760}}>
        <Panel accent={landed ? theme.deny : theme.panelBorder} style={{padding: '30px 40px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 28, color: theme.text}}>
            <span style={{color: theme.dim}}>{'$ '}</span>
            {'grep -r vector'}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: theme.mono,
              fontSize: 120,
              fontVariantNumeric: 'tabular-nums',
              color: landed ? theme.deny : theme.text,
              textShadow: landed ? `0 0 ${26 * zero}px ${theme.deny}` : 'none',
            }}
          >
            {n}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: landed ? theme.deny : theme.dim, marginTop: 8}}>
            {'向量命中'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

const ThirdQuote: React.FC<{at32: number}> = ({at32}) => {
  const revealed = useReveal('「挑选是模型自己来」', {at: 12, cps: 9});
  const official = useEnter('fade', {at: at32, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 460, top: 240, width: 1000}}>
        <Panel style={{padding: '26px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'【三】'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
              {'开源项目作者 · 源码分析'}
            </span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.text, marginTop: 22}}>
            <span style={{fontFamily: theme.serif, fontSize: 56, color: theme.panelBorder}}>{'“'}</span>
            {revealed}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 610, top: 640, width: 700, ...official}}>
        <Panel accent={theme.mech} style={{padding: '22px 32px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'docs'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, marginTop: 10}}>
            {'标准文件工具'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
            {'standard file tools'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4Ledger: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-04');
  const bB = w('p4-05', 'p4-09');
  const bC = w('p4-10', 'p4-12');
  const bD = w('p4-14', 'p4-21');
  const bE = w('p4-23', 'p4-27');
  const bF = w('p4-28', 'p4-32');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 登记簿开张">
        <SceneTag chapter="Memory Ledger" tagline="登记簿与扉页" />
        <LedgerOpen at02={at('p4-02') - bA.from} at03={at('p4-03') - bA.from} at04={at('p4-04') - bA.from} />
        <Footnote delay={2}>{'.memory/ · name / description / type'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="4-B 扉页目录首现">
        {/* 窗 = 本镜 4 条 cue 窗：archify 全屏期间扉页淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')},
            {at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
            {at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        >
          {/* 多挂 f3 盖满 ArchifyYield 淡出再卸载（1-A/2-A 同款先例）：句窗终点恰为
              p4-06 窗起点，只挂 dur 会在让位斜坡第 0 帧硬切漏背景 */}
          <Sequence from={0} durationInFrames={dur('p4-05') + DUR.f3}>
            <IndexFirstPage />
          </Sequence>
        </ArchifyYield>
        <ArchifyRecap
          slug="memory-ledger"
          caption="登记簿结构"
          cues={[
            {chapterId: 'not-handwritten', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')},
            {chapterId: 'full-rebuild', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'derived-vs-source', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
            {chapterId: 'index-cheap-files-precious', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 四问分型">
        {/* 4-B 末章（p4-09）与本镜首章（p4-10）跨实例背靠背 → lead={false} */}
        <ArchifyRecap
          slug="four-memory-types"
          caption="四问分型"
          lead={false}
          cues={[
            {chapterId: 'four-questions', at: at('p4-10') - bC.from, durationInFrames: dur('p4-10')},
            {chapterId: 'who-and-how', at: at('p4-11') - bC.from, durationInFrames: dur('p4-11')},
            {chapterId: 'what-and-where', at: at('p4-12') - bC.from, durationInFrames: dur('p4-12')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="4-D 两层加载">
        {/* 窗 = 本镜 5 条 cue 窗：空窗句（p4-18..19／p4-21）装置淡入淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p4-14') - bD.from, durationInFrames: dur('p4-14')},
            {at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')},
            {at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')},
            {at: at('p4-17') - bD.from, durationInFrames: dur('p4-17')},
            {at: at('p4-20') - bD.from, durationInFrames: dur('p4-20')},
          ]}
        >
          <Sequence from={at('p4-18') - bD.from} durationInFrames={dur('p4-18') + dur('p4-19')}>
            <CacheBar />
          </Sequence>
          <Sequence from={at('p4-21') - bD.from} durationInFrames={dur('p4-21')}>
            <OfficialSegment />
          </Sequence>
        </ArchifyYield>
        {/* 首 run 接 4-C（p4-12→p4-14 无空窗）跨实例背靠背 → lead={false} */}
        <ArchifyRecap
          slug="two-layer-loading"
          caption="两层加载"
          lead={false}
          cues={[
            {chapterId: 'two-tracks', at: at('p4-14') - bD.from, durationInFrames: dur('p4-14')},
            {chapterId: 'index-resident', at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')},
            {chapterId: 'body-on-demand', at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')},
            {chapterId: 'copy-not-pollute', at: at('p4-17') - bD.from, durationInFrames: dur('p4-17')},
          ]}
        />
        {/* cache-stakes 在 p4-18..19 空窗后重现 → 独立实例默认入场（ep1 5-C 同款拆分） */}
        <ArchifyRecap
          slug="two-layer-loading"
          caption="两层加载"
          cues={[{chapterId: 'cache-stakes', at: at('p4-20') - bD.from, durationInFrames: dur('p4-20')}]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 目录员旁路">
        <Sequence from={0} durationInFrames={dur('p4-23')}>
          <KeeperIntro />
        </Sequence>
        {/* 空窗后重现（p4-23 引子隔开）→ 默认 lead */}
        <ArchifyRecap
          slug="two-layer-loading"
          caption="两层加载"
          cues={[{chapterId: 'side-query', at: at('p4-24') - bE.from, durationInFrames: dur('p4-24')}]}
        />
        <Sequence from={at('p4-25') - bE.from} durationInFrames={dur('p4-25') + dur('p4-26') + dur('p4-27')}>
          <Theater />
        </Sequence>
        {/* 角标三件（storyboard 4-E）：side-query 在此，max 5／fallback 由 Theater 卡内承担 */}
        <Footnote delay={2}>{'side-query · max 5 · fallback'}</Footnote>
      </Sequence>

      <Sequence {...bF} name="4-F 模型挑选而非向量">
        <Sequence from={0} durationInFrames={dur('p4-28')}>
          <GrepZero />
        </Sequence>
        <ArchifyRecap
          slug="two-layer-loading"
          caption="两层加载"
          cues={[{chapterId: 'model-not-vectors', at: at('p4-29') - bF.from, durationInFrames: dur('p4-29')}]}
        />
        <Sequence from={at('p4-30') - bF.from} durationInFrames={dur('p4-30') + dur('p4-31') + dur('p4-32')}>
          {/* at32 锚须相对本子 Sequence（0 = p4-30 起点）而非 bF——bF 基准会超出
              序列寿命致官方口径卡恒零帧（2026-09-30 评审实录，remotion still 验证） */}
          <ThirdQuote at32={at('p4-32') - at('p4-30')} />
        </Sequence>
        <Footnote delay={2}>{'grep -r vector → 0 · Sonnet · standard file tools'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4Ledger;
