/** P4 目录与正文（p4-01..23，6 镜 11 cue）——分镜 4-A…4-E。
 *
 *  本幕为全图链：五镜全部由 archify 工程图主控——memory-file-anatomy 三章落镜 /
 *  cache-economics 三章 / recall-loop 两章 / sidecar-selection 三章；镜间均有回落
 *  装置句窗隔断（非帧相邻）→ 实例一律 lead 默认入场（契约=帧相邻才 false，见
 *  ArchifyClip）。cue 落镜以文末图集预算表为权威源；anchor 句全片唯一、
 *  at/dur 独立重算不沿镜累加。
 *
 *  空窗句由场景层回落装置持有（archify 全屏独占，装置只住窗外句窗）：
 *  - 4-A2 p4-05 四类两例（分镜画面注：用户类「tab 缩进」/参考类「bug 在哪个模块」）
 *  - 4-B p4-07..10 缓存经济学开卷：问题卡 → 全部塞进被否（danger 章「否」）→ 计费规则预告
 *  - 4-C p4-14 分层成形 / p4-16 正文按需注入（放前面=搅坏前缀）
 *  - 4-D p4-18b 挑卡实例走查：问句 → 目录扫描 → 只进一张
 *  - 4-E p4-21..22 安全阀（ok 章）+ 当前请求天平；p4-23 收束字卡右缘叠加（勿复述整句）
 *
 *  色契约：mech 苔绿=卡片册·记忆；accent 金=计费·成本（本幕主轴「账单金」）；
 *  danger=否决；ok=机制在位（安全阀）。chrome：SceneTag 全幕驻场（y64，与
 *  archify 画框 top150 纵向避让）+ MapAnchorChip（cardfile，幕首短暂驻场）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {MapAnchorChip} from '../components/map-anchor';
import {DUR, useDim, useDraw, useEnter, useFlowDash, useImpulse, useProgress, useSpring, useStagger} from '../motion';

// ── 4-A2 p4-05 空窗：四类两例点亮 ─────────────────────────────────────────

/** 四类色标卡的两例（用户类/参考类），mech 苔绿标签 + 引号便签体关键词 */
const TypeExamples: React.FC<{span: number; atRef: number}> = ({span, atRef}) => {
  const u = useEnter('rise', {at: 4, dur: DUR.f3, springPreset: 'settle'});
  const r = useEnter('rise', {at: atRef, dur: DUR.f3, springPreset: 'settle'});
  const out = useProgress(span - DUR.f4, DUR.f4);
  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 272,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 28,
          color: theme.dim,
        }}
      >
        {'四类 · 各答一问 · 两例'}
      </div>
      {[0, 1].map((i) => {
        const e = i === 0 ? u : r;
        const tag = i === 0 ? '用户类' : '参考类';
        return (
          <div
            key={i}
            style={{position: 'absolute', left: 520 + i * 480, top: 360, opacity: e.opacity, transform: e.transform}}
          >
            <Panel accent={theme.mech} style={{width: 400, padding: '24px 30px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.mech, letterSpacing: 2}}>
                {tag}
              </div>
              <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 12, lineHeight: 1.5}}>
                {i === 0 ? '「缩进用 tab' : '「卡顿的 bug'}
              </div>
              <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, lineHeight: 1.5}}>
                {i === 0 ? '不用空格」' : '在哪个模块」'}
              </div>
            </Panel>
          </div>
        );
      })}
      <Footnote delay={2}>{'.memory/ · MEMORY.md'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-B p4-07..10 空窗：缓存经济学开卷回落 ──────────────────────────────

/** 开卷三拍：真问题（带着记忆·还不贵）→ 最直白做法被否（塞满指令区·无关白付）→ 计费规则预告（复印店） */
const CostQuestion: React.FC<{
  span: number;
  atQ: number;
  atNaive: number;
  atVeto: number;
  atRule: number;
}> = ({span, atQ, atNaive, atVeto, atRule}) => {
  const q = useEnter('rise', {at: atQ, dur: DUR.f4, springPreset: 'settle'});
  const chips = useStagger(6, {at: atNaive, dur: DUR.f3, stride: 4});
  // 「否」章：spatial 用 snap 弹入（过冲=盖章顿感），辉光走 impulse 包络（effects 不吃弹簧）
  const veto = useSpring('snap', {at: atVeto, dur: DUR.f4});
  const vetoO = useProgress(atVeto, DUR.f3);
  const vetoGlow = useImpulse({at: atVeto, dur: DUR.f5, peak: 24});
  const note = useProgress(atVeto + 6, DUR.f4);
  const rule = useEnter('rise', {at: atRule, dur: DUR.f4, springPreset: 'settle'});
  const out = useProgress(span - DUR.f4, DUR.f4);

  const NAIVE: {label: string; lit: boolean}[] = [
    {label: '用户偏好', lit: true},
    {label: '工具用法', lit: false},
    {label: '环境配置', lit: false},
    {label: 'bug 参考', lit: true},
    {label: '术语表', lit: false},
    {label: '团队流程', lit: false},
  ];

  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      {/* 左列：真问题 → 计费规则预告（accent 金=本幕计费主轴） */}
      <div style={{position: 'absolute', left: 150, top: 300, width: 600, opacity: q.opacity, transform: q.transform}}>
        <Panel accent={theme.accent} style={{padding: '26px 32px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, letterSpacing: 2}}>{'真问题'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 600, color: theme.text, marginTop: 12}}>
            {'每轮带着记忆'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 600, color: theme.accent, marginTop: 4}}>
            {'还不贵？'}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 150, top: 620, width: 600, opacity: rule.opacity, transform: rule.transform}}>
        <Panel accent={theme.accent} style={{padding: '22px 32px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.accent, letterSpacing: 1}}>
            {'接口计费规则'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 10}}>
            {'想象一家复印店'}
          </div>
        </Panel>
      </div>

      {/* 右列：最直白的做法——全部塞进指令区，无关白付，盖「否」章 */}
      <div style={{position: 'absolute', left: 860, top: 250, width: 680}}>
        <Panel style={{padding: '22px 24px', minHeight: 400}}>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, letterSpacing: 1}}>
            {'最直白的做法 · 全部塞进指令区'}
          </div>
          {NAIVE.map((c, i) => {
            const p = chips[i];
            const col = i % 3;
            const row = Math.floor(i / 3);
            return (
              <div
                key={c.label}
                style={{
                  position: 'absolute',
                  left: 24 + col * 214,
                  top: 76 + row * 84,
                  opacity: p * (c.lit ? 1 : 0.55),
                  transform: `translateY(${(1 - p) * 14}px)`,
                }}
              >
                <div
                  style={{
                    width: 198,
                    height: 62,
                    borderRadius: 10,
                    border: `2px solid ${c.lit ? theme.mech : theme.panelBorder}`,
                    background: theme.panel,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{fontFamily: theme.sans, fontSize: 24, color: c.lit ? theme.text : theme.dim}}>
                    {c.label}
                  </div>
                  {!c.lit ? <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'无关'}</div> : null}
                </div>
              </div>
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: 262,
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.dim,
              opacity: note,
            }}
          >
            {'无关占比越大 · '}
            <span style={{color: theme.accent}}>{'每轮白付'}</span>
          </div>
        </Panel>
        {/* 否决章（danger）：旋转盖在卡片堆上 */}
        <div
          style={{
            position: 'absolute',
            left: 430,
            top: 130,
            opacity: vetoO,
            transform: `rotate(-12deg) scale(${1.18 - 0.18 * veto})`,
          }}
        >
          <div
            style={{
              border: `5px solid ${theme.danger}`,
              borderRadius: 14,
              padding: '4px 30px',
              fontFamily: theme.serif,
              fontSize: 66,
              fontWeight: 700,
              color: theme.danger,
              boxShadow: `0 0 ${vetoGlow}px ${theme.danger}66`,
              background: theme.bg,
            }}
          >
            {'否'}
          </div>
        </div>
      </div>

      <Footnote delay={2}>{'prompt cache'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-C p4-14 空窗：分层成形（快窗 ~3.5s） ──────────────────────────────

/** 规则条（前缀相同→缓存价）压出两张层卡：目录页·常驻（mech）/ 记忆正文·按需 */
const LayerTease: React.FC<{span: number}> = ({span}) => {
  const rule = useEnter('fade', {at: 1, dur: DUR.f3});
  const cards = useStagger(2, {at: 16, dur: DUR.f4, stride: 9, easing: 'decelerate'});
  const out = useProgress(span - DUR.f4, DUR.f4);
  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      <div
        style={{
          position: 'absolute',
          left: 650,
          top: 300,
          width: 620,
          height: 64,
          borderRadius: 999,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          fontFamily: theme.mono,
          fontSize: 25,
          opacity: rule.opacity,
        }}
      >
        <span style={{color: theme.text}}>{'前缀相同'}</span>
        <span style={{color: theme.dim}}>{'→'}</span>
        <span style={{color: theme.accent}}>{'缓存价'}</span>
      </div>
      {[
        {title: '目录页', tags: ['小而稳', '常驻'], mech: true, top: 430},
        {title: '记忆正文', tags: ['大而多变', '按需'], mech: false, top: 585},
      ].map((c, i) => {
        const p = cards[i];
        return (
          <div
            key={c.title}
            style={{position: 'absolute', left: 640, top: c.top, width: 640, opacity: p, transform: `translateY(${(1 - p) * 22}px)`}}
          >
            <Panel accent={c.mech ? theme.mech : theme.panelBorder} style={{padding: '20px 30px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
                <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.text}}>
                  {c.title}
                </div>
                {c.tags.map((t, j) => (
                  <div
                    key={t}
                    style={{
                      fontFamily: theme.mono,
                      fontSize: 20,
                      padding: '5px 14px',
                      borderRadius: 999,
                      border: `1px solid ${j === 1 ? (c.mech ? theme.mech : theme.accent) : theme.panelBorder}`,
                      color: j === 1 ? (c.mech ? theme.mech : theme.accent) : theme.dim,
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── 4-C p4-16 空窗：正文按需注入当轮提问 ────────────────────────────────

/** 上：指令区·前缀不变（目录页盖缓存价章）；下：当轮提问按需注入记忆正文；警示：放前面=搅坏前缀 */
const BodyOnDemand: React.FC<{span: number}> = ({span}) => {
  const atInject = Math.round(span * 0.34);
  const atWarn = Math.round(span * 0.66);
  const head = useEnter('rise', {at: 2, dur: DUR.f4, springPreset: 'settle'});
  const turn = useEnter('rise', {at: 12, dur: DUR.f4, springPreset: 'settle'});
  const inject = useSpring('snap', {at: atInject, dur: DUR.f4});
  const injectO = useProgress(atInject, DUR.f3);
  const arrow = useDraw(atInject, DUR.f5);
  const warn = useEnter('pop', {at: atWarn, dur: DUR.f4});
  return (
    <AbsoluteFill>
      {/* 指令区：头部固定块（目录页·苔绿·缓存价章） */}
      <div style={{position: 'absolute', left: 480, top: 268, width: 960, opacity: head.opacity, transform: head.transform}}>
        <Panel accent={theme.mech} style={{padding: '18px 28px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
            {'指令区 · 前缀不变'}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: 12}}>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 28,
                fontWeight: 600,
                color: theme.text,
                border: `2px solid ${theme.mech}`,
                borderRadius: 10,
                padding: '8px 22px',
              }}
            >
              {'目录页'}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.accent,
                border: `2px solid ${theme.accent}`,
                borderRadius: 8,
                padding: '5px 14px',
                transform: 'rotate(-6deg)',
              }}
            >
              {'缓存价'}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>{'···'}</div>
          </div>
        </Panel>
      </div>

      {/* 注入箭头（mech，描线） */}
      <svg width={40} height={56} style={{position: 'absolute', left: 940, top: 398}}>
        <line x1={20} y1={0} x2={20} y2={40} stroke={theme.mech} strokeWidth={4} {...arrow} />
        <polygon points="10,38 30,38 20,54" fill={theme.mech} opacity={1 - arrow.strokeDashoffset} />
      </svg>

      {/* 当轮提问：记忆正文按需弹入 */}
      <div style={{position: 'absolute', left: 480, top: 470, width: 960, opacity: turn.opacity, transform: turn.transform}}>
        <Panel style={{padding: '18px 28px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
            {'当轮提问 · 本来每次就不同'}
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: 12, height: 64}}>
            <div
              style={{
                width: 300,
                height: 56,
                borderRadius: 10,
                border: `2px dashed ${theme.panelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.dim,
                opacity: 1 - injectO * 0.7,
              }}
            >
              {'留给这一轮'}
            </div>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 28,
                fontWeight: 600,
                color: theme.text,
                border: `2px solid ${theme.text}`,
                borderRadius: 10,
                padding: '8px 22px',
                opacity: injectO,
                transform: `scale(${0.72 + 0.28 * inject})`,
              }}
            >
              {'记忆正文'}
            </div>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.accent,
                border: `1px solid ${theme.accent}`,
                borderRadius: 999,
                padding: '5px 14px',
                opacity: injectO,
              }}
            >
              {'按需注入'}
            </div>
          </div>
        </Panel>
      </div>

      {/* 警示条：放前面=搅坏前缀（danger） */}
      <div style={{position: 'absolute', left: 660, top: 700, width: 600, opacity: warn.opacity, transform: warn.transform}}>
        <div
          style={{
            border: `2px solid ${theme.danger}`,
            borderRadius: 12,
            background: theme.panel,
            padding: '14px 24px',
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.danger,
          }}
        >
          {'放前面 → 搅坏前缀'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D p4-18b 空窗：挑卡实例走查 ───────────────────────────────────────

/** 三段走查：你问「卡顿修好了吗」→ 目录扫描锁定 bug 卡 → 正文只进这一张 */
const PickExample: React.FC<{span: number}> = ({span}) => {
  const atScan = 8;
  const atPick = Math.round(span * 0.45);
  const q = useEnter('rise', {at: 2, dur: DUR.f4, springPreset: 'settle'});
  const cat = useEnter('rise', {at: 8, dur: DUR.f4, springPreset: 'settle'});
  const res = useEnter('rise', {at: atPick + 6, dur: DUR.f4, springPreset: 'settle'});
  const scan = useProgress(atScan, DUR.f6, 'linear');
  const pick = useProgress(atPick, DUR.f4);
  const flow = useFlowDash({dash: 12, gap: 10, period: 26});
  const flowO = useProgress(atPick - 6, DUR.f4);

  const ROWS = ['偏好 · tab 缩进', '流程 · 归档约定', '卡顿 bug · 在哪个模块', '工具 · 用法备忘'];
  const HIT = 2;

  return (
    <AbsoluteFill>
      {/* 问句卡 */}
      <div style={{position: 'absolute', left: 140, top: 360, width: 440, opacity: q.opacity, transform: q.transform}}>
        <Panel style={{padding: '22px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>{'你问'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.text, marginTop: 10}}>{'「卡顿修好了吗」'}</div>
        </Panel>
      </div>

      {/* 问句 → 目录 */}
      <svg width={70} height={40} style={{position: 'absolute', left: 588, top: 430, opacity: cat.opacity}}>
        <line x1={0} y1={20} x2={54} y2={20} stroke={theme.dim} strokeWidth={4} {...flow} />
        <polygon points="54,12 70,20 54,28" fill={theme.dim} />
      </svg>

      {/* 目录：扫描游标扫过四行后锁定命中行（mech） */}
      <div style={{position: 'absolute', left: 660, top: 260, width: 500, opacity: cat.opacity, transform: cat.transform}}>
        <Panel style={{padding: '18px 22px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>{'目录'}</div>
          <div style={{position: 'relative', height: 4 * 62 - 8, marginTop: 10}}>
            {ROWS.map((row, i) => {
              const hit = i === HIT;
              return (
                <div
                  key={row}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: i * 62,
                    width: 456,
                    height: 54,
                    borderRadius: 8,
                    border: `2px solid ${hit && pick > 0.15 ? theme.mech : theme.panelBorder}`,
                    background: hit ? `${theme.mech}${pick > 0.15 ? '26' : '00'}` : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 18px',
                    opacity: hit ? 1 : 0.6,
                  }}
                >
                  <div style={{fontFamily: theme.sans, fontSize: 24, color: hit ? theme.text : theme.dim}}>{row}</div>
                  {hit ? (
                    <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.mech, opacity: pick}}>{'挑中'}</div>
                  ) : null}
                </div>
              );
            })}
            {/* 扫描游标：线性扫过四行，锁定后淡出 */}
            <div
              style={{
                position: 'absolute',
                left: -6,
                top: scan * (4 * 62 - 20),
                width: 468,
                height: 6,
                borderRadius: 3,
                background: theme.mech,
                opacity: (1 - pick) * 0.85,
              }}
            />
          </div>
        </Panel>
      </div>

      {/* 目录 → 选中卡（mech 流动虚线） */}
      <svg width={110} height={40} style={{position: 'absolute', left: 1168, top: 452, opacity: flowO}}>
        <line x1={0} y1={20} x2={94} y2={20} stroke={theme.mech} strokeWidth={4} {...flow} />
        <polygon points="94,12 110,20 94,28" fill={theme.mech} />
      </svg>

      {/* 选中卡：正文只进这一张 */}
      <div style={{position: 'absolute', left: 1290, top: 390, width: 450, opacity: res.opacity, transform: res.transform}}>
        <Panel accent={theme.mech} style={{padding: '22px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>{'挑中'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.text, marginTop: 10}}>{'bug 卡'}</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 12}}>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 20,
                color: theme.mech,
                border: `1px solid ${theme.mech}`,
                borderRadius: 999,
                padding: '4px 14px',
              }}
            >
              {'正文 ×1'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'只进这一张'}</div>
          </div>
        </Panel>
      </div>

      <Footnote delay={2}>{'side-query'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-E p4-21..23 空窗：安全阀 + 当前请求天平；p4-23 收束字卡右缘叠加 ──

/** 左：注入内容盖「背景知识·非新命令」章（ok=机制在位）；右：冲突天平当前请求胜出 */
const SafetyValve: React.FC<{
  atStamp: number;
  atBalance: number;
  atTilt: number;
  atDim: number;
}> = ({atStamp, atBalance, atTilt, atDim}) => {
  const doc = useEnter('rise', {at: 2, dur: DUR.f4, springPreset: 'settle'});
  const stamp = useSpring('snap', {at: atStamp, dur: DUR.f4});
  const stampO = useProgress(atStamp, DUR.f3);
  const stampGlow = useImpulse({at: atStamp, dur: DUR.f5, peak: 22});
  const pans = useStagger(2, {at: atBalance, dur: DUR.f4, stride: 8});
  const tilt = useSpring('settle', {at: atTilt, dur: DUR.f5});
  const verdict = useProgress(atTilt + DUR.f5, DUR.f4);
  const dim = useDim({at: atDim, to: 0.35});
  return (
    <AbsoluteFill style={{opacity: dim}}>
      {/* 注入内容卡 + 安全阀章 */}
      <div style={{position: 'absolute', left: 210, top: 330, width: 620, opacity: doc.opacity, transform: doc.transform}}>
        <Panel style={{padding: '26px 32px', minHeight: 240}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>{'注入内容'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 36, color: theme.text, marginTop: 14}}>{'挑回的记忆'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 10}}>
            {'随本轮提问进入对话'}
          </div>
        </Panel>
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 60,
            opacity: stampO,
            transform: `rotate(-10deg) scale(${1.16 - 0.16 * stamp})`,
          }}
        >
          <div
            style={{
              border: `4px solid ${theme.ok}`,
              borderRadius: 12,
              padding: '10px 26px',
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 38,
              fontWeight: 700,
              color: theme.ok,
              background: theme.bg,
              boxShadow: `0 0 ${stampGlow}px ${theme.ok}55`,
            }}
          >
            <div>{'背景知识'}</div>
            <div>{'非新命令'}</div>
          </div>
        </div>
      </div>

      {/* 冲突天平：当前请求压下（胜），旧记忆抬起 */}
      <svg width={600} height={70} style={{position: 'absolute', left: 1080, top: 506}}>
        <polygon points="300,0 268,64 332,64" fill={theme.panelBorder} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 1080,
          top: 400,
          width: 600,
          height: 120,
          transformOrigin: '300px 106px',
          transform: `rotate(${-9 * tilt}deg)`,
        }}
      >
        <div style={{position: 'absolute', left: 20, right: 20, top: 102, height: 8, borderRadius: 4, background: theme.panelBorder}} />
        <div style={{position: 'absolute', left: 30, top: 34, opacity: pans[0], transform: `translateY(${(1 - pans[0]) * 14}px)`}}>
          <div
            style={{
              width: 220,
              height: 68,
              borderRadius: 12,
              border: `2px solid ${theme.text}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 26,
              fontWeight: 600,
              color: theme.text,
            }}
          >
            {'当前请求'}
          </div>
        </div>
        <div style={{position: 'absolute', right: 30, top: 34, opacity: pans[1] * 0.75, transform: `translateY(${(1 - pans[1]) * 14}px)`}}>
          <div
            style={{
              width: 220,
              height: 68,
              borderRadius: 12,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.dim,
            }}
          >
            {'旧记忆'}
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1080,
          top: 610,
          width: 600,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.text,
          opacity: verdict,
        }}
      >
        {'以当前请求为准'}
      </div>

      <Footnote delay={2}>{'fallback'}</Footnote>
    </AbsoluteFill>
  );
};

/** p4-23 收束字卡：右缘叠加（分镜 4-E），关键词两联——常驻=mech / 按需=accent，勿复述整句 */
const ClosingCard: React.FC = () => {
  const e = useEnter('slideR', {at: 3, dur: DUR.f5, dist: 70, springPreset: 'settle'});
  const glow = useImpulse({at: DUR.f5, dur: DUR.f6, peak: 20});
  return (
    <div style={{position: 'absolute', right: 110, top: 340, width: 460, opacity: e.opacity, transform: e.transform}}>
      <Panel accent={theme.mech} style={{padding: '30px 36px', boxShadow: `0 0 ${glow}px ${theme.mech}33`}}>
        {[
          {key: '有什么', val: '常驻', color: theme.mech},
          {key: '是什么', val: '按需', color: theme.accent},
        ].map((row, i) => (
          <div key={row.key}>
            {i === 1 ? <div style={{height: 2, background: theme.panelBorder, margin: '18px 0'}} /> : null}
            <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
              <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.text}}>{`「${row.key}」`}</div>
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 26,
                  color: row.color,
                  border: `2px solid ${row.color}`,
                  borderRadius: 999,
                  padding: '6px 22px',
                }}
              >
                {row.val}
              </div>
            </div>
          </div>
        ))}
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 20, letterSpacing: 2}}>
          {'全部经济学'}
        </div>
      </Panel>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4CatalogBody: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-04');
  const bA2 = w('p4-05', 'p4-06');
  const bB = w('p4-07', 'p4-13');
  const bC = w('p4-14', 'p4-16');
  const bD = w('p4-17', 'p4-18b'); // 分镜 4-D「p4-17..18b」（narration 权威 id）
  const bE = w('p4-20', 'p4-23');

  return (
    <AbsoluteFill>
      {/* chrome：SceneTag 全幕驻场（与 archify 画框 top150 纵向避让）；chip 幕首短暂驻场 */}
      <SceneTag chapter="Memory" tagline="目录与正文" accent={theme.mech} />
      <MapAnchorChip active="cardfile" />

      <Sequence {...bA} name="4-A 卡片册解剖">
        {/* 前镜 3-D 为场景镜 → 本实例首章默认入场；图 7 的 index-rebuild 章由
            4-A2 的全景图 write-rebuild 章同语义覆盖（一镜一图，不双挂） */}
        <ArchifyRecap
          slug="memory-file-anatomy"
          caption="记忆卡片册"
          cues={[
            {chapterId: 'one-file', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')},
            {chapterId: 'frontmatter', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')},
            {chapterId: 'four-types', at: at('p4-04') - bA.from, durationInFrames: dur('p4-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bA2} name="4-A2 写入全景回看">
        {/* 前镜 4-A2 为图镜 → lead={false}；p4-05 是写入例句（write-rebuild 章「写文件
            +索引重建」的具象锚），p4-06 空窗由两例装置持有 */}
        <ArchifyRecap
          slug="recall-loop"
          caption="四环节全景"
          lead={false}
          cues={[
            {chapterId: 'write-rebuild', at: at('p4-05') - bA2.from, durationInFrames: dur('p4-05')},
          ]}
        />
        <Sequence from={at('p4-06') - bA2.from} durationInFrames={dur('p4-06')} name="4-A2 四类两例">
          <TypeExamples span={dur('p4-06')} atRef={Math.round(dur('p4-06') * 0.4)} />
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="4-B 复印店账单">
        {/* p4-06..10 空窗由开卷装置持有（~24s 隔断=空窗后重现）→ lead 默认入场；p4-11 起三章接力 */}
        <Sequence durationInFrames={at('p4-11') - bB.from} name="4-B 账单开卷回落">
          <CostQuestion
            span={at('p4-11') - bB.from}
            atQ={2}
            atNaive={at('p4-08') - bB.from}
            atVeto={at('p4-08') + Math.round(dur('p4-08') * 0.62) - bB.from}
            atRule={at('p4-10') - bB.from}
          />
        </Sequence>
        <ArchifyRecap
          slug="cache-economics"
          caption="缓存经济学"
          cues={[
            {chapterId: 'prefix-hit', at: at('p4-11') - bB.from, durationInFrames: dur('p4-11')},
            {chapterId: 'one-char', at: at('p4-12') - bB.from, durationInFrames: dur('p4-12'), fit: 'hold'},
            {chapterId: 'two-lanes', at: at('p4-13') - bB.from, durationInFrames: dur('p4-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 两层加载">
        {/* p4-14 前窗分层成形（隔断=空窗后重现 → lead 默认入场）、p4-15 图章、p4-16 后窗正文按需 */}
        <Sequence durationInFrames={at('p4-15') - bC.from} name="4-C 分层成形">
          <LayerTease span={at('p4-15') - bC.from} />
        </Sequence>
        <ArchifyRecap
          slug="recall-loop"
          caption="记忆回路"
          cues={[
            {chapterId: 'two-channels', at: at('p4-15') - bC.from, durationInFrames: dur('p4-15')},
          ]}
        />
        <Sequence from={at('p4-16') - bC.from} durationInFrames={dur('p4-16')} name="4-C 正文按需">
          <BodyOnDemand span={dur('p4-16')} />
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="4-D 旁路挑选">
        {/* 实例首章空窗后重现（p4-16 装置窗隔断）→ lead 默认入场；p4-17→p4-18 两章
            帧相邻由实例内自动抑制换章弹入；p4-18b 实例走查 */}
        <ArchifyRecap
          slug="sidecar-selection"
          caption="旁路挑选"
          cues={[
            {chapterId: 'sidecar-pick', at: at('p4-17') - bD.from, durationInFrames: dur('p4-17')},
            {chapterId: 'budget-funnel', at: at('p4-18') - bD.from, durationInFrames: dur('p4-18')},
          ]}
        />
        <Sequence from={at('p4-18b') - bD.from} durationInFrames={dur('p4-18b')} name="4-D 挑卡实例">
          <PickExample span={dur('p4-18b')} />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="4-E 降级与安全阀">
        {/* fallback-valve 锚 p4-20（p4-18b 装置窗隔断=空窗后重现 → lead 默认入场）；
            p4-21..22 安全阀+天平，p4-23 收束字卡右缘叠加（装置压暗让位） */}
        <ArchifyRecap
          slug="sidecar-selection"
          caption="旁路挑选"
          cues={[
            {chapterId: 'fallback-valve', at: at('p4-20') - bE.from, durationInFrames: dur('p4-20')},
          ]}
        />
        <Sequence
          from={at('p4-21') - bE.from}
          durationInFrames={dur('p4-21') + dur('p4-22') + dur('p4-23')}
          name="4-E 安全阀与天平"
        >
          <SafetyValve
            atStamp={Math.round(dur('p4-21') * 0.55)}
            atBalance={dur('p4-21') + 6}
            atTilt={dur('p4-21') + Math.round(dur('p4-22') * 0.45)}
            atDim={dur('p4-21') + dur('p4-22')}
          />
        </Sequence>
        <Sequence from={at('p4-23') - bE.from} durationInFrames={dur('p4-23')} name="4-E 收束字卡">
          <ClosingCard />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4CatalogBody;
