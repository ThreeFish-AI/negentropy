/** P5 三道门（p5-01..23，5 镜 · archify 三图 11 cue）——分镜 5-A…5-E。
 *
 *  本幕是卡片册层的「守门」半场：提取时机（图10 一章）→ 三句穿门走查（图11
 *  五章接力，全片高潮）→ 便签对置（场景镜）→ 事务整理（图12 四章）→ 界线卡
 *  收束（场景镜：界线 + 官方两席定位 + 卡片册母题合拢苔绿 breathe）。
 *  lead 清单（跨实例接缝，契约=帧相邻才 false）：5-B 前镜 5-A 末章帧相邻 →
 *  lead={false}；5-A 幕界后首镜 / 5-D 前镜场景镜 / 5-E 空窗后重现（p5-20
 *  装置窗隔断）→ lead 默认 true。
 *  图镜空窗由嵌套句窗装置持有画面（无 ArchifyYield 的嵌套范式）：
 *  5-A 前窗=提取时机开卷（时钟+快照相机）；5-D 前窗=查重门三盏比对灯、
 *  后窗=事务三步收束（10→0 破坏回声）。色契约：mech 苔绿=卡片册/跨会话；
 *  danger 红=拦截/破坏；底座灰白=草稿纸域。零随机零 Date.now，全帧驱动。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {MapAnchorChip} from '../components/map-anchor';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useBreathe, useDraw, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';

/** 时钟巡游节律：2.5s/圈（系列恒定节拍同值） */
const CLOCK_LAP = 75;

const rad = (deg: number): number => (deg * Math.PI) / 180;

// ── 5-A 前窗：提取时机开卷（p5-01 空窗回落，p5-03 起让位图10） ───────────

const ExtractPrelude: React.FC<{enterAt: number; chipsAt: number; flashAt: number}> = ({
  enterAt,
  chipsAt,
  flashAt,
}) => {
  const e = useEnter('rise', {at: enterAt, dist: 34, springPreset: 'settle'});
  const chips = useStagger(3, {at: chipsAt, dur: DUR.f3, stride: 8});
  const flash = useImpulse({at: flashAt, dur: DUR.f5, peak: 1});
  const frame = useCurrentFrame();
  // 时针：chipsAt 起恒速巡游（帧驱动，确定性）
  const hand = (Math.max(0, frame - chipsAt) / CLOCK_LAP) * 360;
  const hx = 60 + Math.sin(rad(hand)) * 34;
  const hy = 60 - Math.cos(rad(hand)) * 34;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <Panel style={{position: 'absolute', left: 370, top: 296, width: 1180, padding: '30px 42px'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
          <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>
            {'提取时机'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'extract'}</span>
        </div>
        {/* 候选散落：三句偏好伏笔（5-B 穿门走查的同三句） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 16, marginTop: 26}}>
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'候选散落'}</span>
          {['缩进偏好', '测试库', '任务备注'].map((t, i) => (
            <div
              key={t}
              style={{
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: 8,
                padding: '6px 16px',
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                opacity: chips[i],
                transform: `translateY(${(1 - chips[i]) * 12}px)`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        {/* 每轮告一段落 → 压缩前快照 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 30, marginTop: 30}}>
          <svg width={120} height={120} viewBox="0 0 120 120">
            <circle cx={60} cy={60} r={50} fill="none" stroke={theme.panelBorder} strokeWidth={5} />
            {[0, 90, 180, 270].map((a) => (
              <line
                key={a}
                x1={60 + Math.sin(rad(a)) * 40}
                y1={60 - Math.cos(rad(a)) * 40}
                x2={60 + Math.sin(rad(a)) * 48}
                y2={60 - Math.cos(rad(a)) * 48}
                stroke={theme.dim}
                strokeWidth={4}
              />
            ))}
            <line x1={60} y1={60} x2={hx} y2={hy} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
            <circle cx={60} cy={60} r={5} fill={theme.mech} />
          </svg>
          <span style={{fontFamily: theme.mono, fontSize: 38, color: theme.dim}}>{'→'}</span>
          <svg width={150} height={112} viewBox="0 0 150 112">
            <rect x={27} y={30} width={96} height={62} rx={10} fill="none" stroke={theme.text} strokeWidth={4} />
            <rect x={55} y={18} width={40} height={14} rx={4} fill="none" stroke={theme.text} strokeWidth={4} />
            <circle cx={75} cy={61} r={16} fill="none" stroke={theme.mech} strokeWidth={4} />
            {flash > 0.02 ? (
              <circle
                cx={75}
                cy={61}
                r={26 + 10 * flash}
                fill="none"
                stroke={theme.mech}
                strokeWidth={3}
                opacity={flash * 0.9}
              />
            ) : null}
          </svg>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.mech}}>
              {'压缩前快照'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 8}}>
              {'每轮告一段落 · 自动触发'}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};

// ── 5-C 便签对置（p5-11..14 场景镜） ────────────────────────────────────

const MinutesVsSticky: React.FC<{
  atLeft: number;
  atRight: number;
  atLeftLine: number;
  atRightLine: number;
  atStrip: number;
  atBlade: number;
  atRule: number;
}> = ({atLeft, atRight, atLeftLine, atRightLine, atStrip, atBlade, atRule}) => {
  const left = useEnter('rise', {at: atLeft, dist: 36, springPreset: 'settle'});
  const right = useEnter('rise', {at: atRight, dist: 36, springPreset: 'settle'});
  const leftLine = useProgress(atLeftLine, DUR.f5);
  const rightLine = useProgress(atRightLine, DUR.f5);
  const leftChip = useEnter('pop', {at: atLeftLine + DUR.f5, dur: DUR.f3});
  const rightChip = useEnter('pop', {at: atRightLine + DUR.f5, dur: DUR.f3});
  const strip = useEnter('rise', {at: atStrip, dist: 30, springPreset: 'settle'});
  const blade = useDraw(atBlade, DUR.f5);
  const zap = useImpulse({at: atBlade, dur: DUR.f5, peak: 1});
  const rule = useProgress(atRule, DUR.f5);

  return (
    <AbsoluteFill>
      {/* 会议纪要本（mech 苔绿 · 跨次生效） */}
      <div
        style={{position: 'absolute', left: 300, top: 250, width: 560, opacity: left.opacity, transform: left.transform}}
      >
        <Panel accent={theme.mech} style={{height: 380, padding: '30px 36px', position: 'relative'}}>
          <svg width={64} height={42} viewBox="0 0 64 42" style={{position: 'absolute', right: 28, top: 30}}>
            <path d="M6 5 Q19 1 32 5 L32 36 Q19 32 6 36 Z" fill="none" stroke={theme.mech} strokeWidth={3} />
            <path d="M58 5 Q45 1 32 5 L32 36 Q45 32 58 36 Z" fill="none" stroke={theme.mech} strokeWidth={3} />
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.mech}}>
            {'会议纪要'}
          </div>
          <div style={{marginTop: 20, height: 2, background: theme.mechDeep, opacity: 0.55}} />
          <div style={{marginTop: 30, fontFamily: theme.serif, fontSize: 30, color: theme.text, opacity: leftLine}}>
            {'「以后都走这个流程」'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 34,
              bottom: 30,
              border: `2px solid ${theme.mech}`,
              borderRadius: 999,
              padding: '8px 22px',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.mech,
              opacity: leftChip.opacity,
              transform: leftChip.transform,
            }}
          >
            {'跨次生效'}
          </div>
        </Panel>
      </div>

      {/* 桌角便签（dim 灰 · 当次作废；胶带贴角、微倾） */}
      <div
        style={{position: 'absolute', left: 1080, top: 268, width: 480, opacity: right.opacity, transform: right.transform}}
      >
        <div
          style={{
            position: 'relative',
            height: 352,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 10,
            background: theme.panel,
            transform: 'rotate(-2.5deg)',
            padding: '32px 34px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 195,
              top: -12,
              width: 90,
              height: 24,
              background: theme.panelBorder,
              opacity: 0.65,
              borderRadius: 3,
            }}
          />
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.dim}}>
            {'桌角便签'}
          </div>
          <div style={{marginTop: 18, height: 2, background: theme.panelBorder, opacity: 0.8}} />
          <div style={{marginTop: 26, fontFamily: theme.serif, fontSize: 28, color: theme.dim, opacity: rightLine}}>
            {'「今天就先这样」'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 30,
              bottom: 28,
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 999,
              padding: '8px 22px',
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.dim,
              opacity: rightChip.opacity,
              transform: rightChip.transform,
            }}
          >
            {'当次作废'}
          </div>
        </div>
      </div>

      {/* 拦截提示条：关键词级一刀切（@impulse + 划除线 @draw） */}
      <div style={{position: 'absolute', left: 440, top: 706, opacity: strip.opacity, transform: strip.transform}}>
        <div
          style={{
            position: 'relative',
            width: 1040,
            height: 116,
            border: `2px solid ${theme.danger}`,
            borderRadius: 14,
            background: theme.panel,
            boxShadow: `0 0 ${24 * zap}px ${theme.danger}55`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 56,
              top: 26,
              width: 260,
              height: 64,
              border: `2px solid ${theme.danger}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 26,
              color: theme.text,
            }}
          >
            {'本次会话'}
          </div>
          <svg
            width={260}
            height={64}
            viewBox="0 0 260 64"
            style={{position: 'absolute', left: 56, top: 26}}
          >
            <line
              x1={10}
              y1={32}
              x2={250}
              y2={32}
              stroke={theme.danger}
              strokeWidth={6}
              strokeLinecap="round"
              pathLength={blade.pathLength}
              strokeDasharray={blade.strokeDasharray}
              strokeDashoffset={blade.strokeDashoffset}
            />
          </svg>
          <span
            style={{
              position: 'absolute',
              left: 352,
              top: 32,
              fontFamily: theme.mono,
              fontSize: 42,
              color: theme.danger,
              transform: `scale(${1 + 0.12 * zap})`,
            }}
          >
            {'✕'}
          </span>
          <span
            style={{
              position: 'absolute',
              left: 430,
              top: 38,
              fontFamily: theme.sans,
              fontSize: 30,
              fontWeight: 600,
              color: theme.text,
            }}
          >
            {'关键词级一刀切'}
          </span>
        </div>
      </div>

      {/* p5-14 判词：规则而非理解 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 852,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          opacity: rule,
        }}
      >
        {'判断主体：规则 · 非理解 · 宁可错杀'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 前窗：查重门三盏比对灯（p5-15 空窗回落） ────────────────────────

const DedupLamps: React.FC<{enterAt: number; lampsAt: number; verdictAt: number}> = ({
  enterAt,
  lampsAt,
  verdictAt,
}) => {
  const e = useEnter('rise', {at: enterAt, dist: 34, springPreset: 'settle'});
  const lamps = useStagger(3, {at: lampsAt, dur: DUR.f4, stride: 9});
  const verdict = useEnter('pop', {at: verdictAt, dur: DUR.f4});
  const zap = useImpulse({at: verdictAt + DUR.f3, dur: DUR.f4, peak: 1});

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <Panel style={{position: 'absolute', left: 460, top: 268, width: 1000, padding: '34px 44px'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
          <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>
            {'第三道门 · 查重'}
          </span>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'三重比对'}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-start',
            marginTop: 30,
          }}
        >
          {['名字', '描述', '正文'].map((t, i) => (
            <div
              key={t}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                opacity: 0.35 + 0.65 * lamps[i],
              }}
            >
              <svg width={104} height={104} viewBox="0 0 104 104">
                <circle
                  cx={52}
                  cy={52}
                  r={40}
                  fill="none"
                  stroke={lamps[i] > 0.5 ? theme.text : theme.panelBorder}
                  strokeWidth={5}
                />
                <circle cx={52} cy={52} r={11} fill={theme.text} opacity={lamps[i]} />
              </svg>
              <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{t}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 30,
            display: 'flex',
            justifyContent: 'center',
            opacity: verdict.opacity,
            transform: verdict.transform,
          }}
        >
          <div
            style={{
              border: `2px solid ${theme.danger}`,
              borderRadius: 12,
              padding: '18px 44px',
              background: theme.panel,
              boxShadow: `0 0 ${26 * zap}px ${theme.danger}66`,
              fontFamily: theme.sans,
              fontSize: 28,
              fontWeight: 700,
              color: theme.danger,
            }}
          >
            {'任一相同 → 一律拒收'}
          </div>
        </div>
      </Panel>
    </div>
  );
};

// ── 5-D 后窗：事务三步收束（p5-20，10→0 破坏回声） ──────────────────────

const TxnSteps: React.FC<{enterAt: number; atWarn: number}> = ({enterAt, atWarn}) => {
  const e = useEnter('rise', {at: enterAt, dist: 30, springPreset: 'settle'});
  const steps = useStagger(3, {at: enterAt + DUR.f4, dur: DUR.f4, stride: 16});
  const warn = useEnter('pop', {at: atWarn, dur: DUR.f4});
  const zap = useImpulse({at: atWarn + DUR.f3, dur: DUR.f5, peak: 1});

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <Panel style={{position: 'absolute', left: 400, top: 330, width: 1120, padding: '36px 44px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 31, fontWeight: 700, color: theme.text}}>
          {'批量改写 · 必须是事务'}
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 32}}>
          {['先快照', '后改写', '失败回滚'].map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 ? (
                <span style={{fontFamily: theme.mono, fontSize: 36, color: theme.dim, opacity: steps[i]}}>
                  {'→'}
                </span>
              ) : null}
              <div
                style={{
                  width: 250,
                  height: 96,
                  border: `2px solid ${theme.text}`,
                  borderRadius: 12,
                  background: theme.panel,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  opacity: 0.3 + 0.7 * steps[i],
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{`0${i + 1}`}</span>
                <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text}}>{t}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            justifyContent: 'center',
            opacity: warn.opacity,
            transform: warn.transform,
          }}
        >
          <div
            style={{
              border: `2px solid ${theme.danger}`,
              borderRadius: 12,
              padding: '16px 40px',
              display: 'flex',
              alignItems: 'baseline',
              gap: 28,
              boxShadow: `0 0 ${24 * zap}px ${theme.danger}55`,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.danger}}>
              {'缺一步 → 资产变空箱'}
            </span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 30,
                fontWeight: 700,
                color: theme.danger,
                transform: `scale(${1 + 0.08 * zap})`,
              }}
            >
              {'10 → 0'}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
};

// ── 5-E 界线卡（p5-21..23 场景镜） ──────────────────────────────────────

const BoundaryCard: React.FC<{
  at: number;
  left: number;
  accentBorder: string;
  titleColor: string;
  subColor: string;
  title: string;
  sub: string;
  icon: 'paper' | 'cards';
}> = ({at, left, accentBorder, titleColor, subColor, title, sub, icon}) => {
  const e = useEnter('rise', {at, dist: 34, springPreset: 'settle'});
  return (
    <div style={{position: 'absolute', left, top: 190, width: 620, opacity: e.opacity, transform: e.transform}}>
      <Panel accent={accentBorder} style={{height: 250, padding: '32px 38px', position: 'relative'}}>
        {icon === 'paper' ? (
          <svg width={74} height={92} viewBox="0 0 74 92" style={{position: 'absolute', right: 32, top: 34}}>
            <rect x={4} y={4} width={66} height={84} rx={8} fill="none" stroke={theme.dim} strokeWidth={4} />
            {[28, 46, 64].map((y) => (
              <line key={y} x1={18} y1={y} x2={56} y2={y} stroke={theme.dim} strokeWidth={4} strokeLinecap="round" />
            ))}
          </svg>
        ) : (
          <svg width={84} height={84} viewBox="0 0 84 84" style={{position: 'absolute', right: 30, top: 38}}>
            <rect x={2} y={30} width={64} height={50} rx={8} fill="none" stroke={theme.mech} strokeWidth={4} />
            <rect x={10} y={16} width={64} height={50} rx={8} fill="none" stroke={theme.mech} strokeWidth={4} />
            <rect x={18} y={2} width={64} height={50} rx={8} fill="none" stroke={theme.mech} strokeWidth={4} />
          </svg>
        )}
        <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: titleColor}}>{title}</div>
        <div style={{fontFamily: theme.serif, fontSize: 30, color: subColor, marginTop: 16}}>{sub}</div>
      </Panel>
    </div>
  );
};

/** 卡片册母题合拢：散落卡片弹簧收拢成叠 + 苔绿辉光 breathe 收束 */
const SCATTER: ReadonlyArray<readonly [number, number]> = [
  [400, -24],
  [440, 120],
  [80, 220],
  [380, 230],
  [50, -10],
];

const FlyCard: React.FC<{
  delay: number;
  scatter: readonly [number, number];
  x: number;
  y: number;
  rot: number;
  labeled?: boolean;
}> = ({delay, scatter, x, y, rot, labeled = false}) => {
  // 空间通道弹簧（局部帧）；不透明度走时长+缓动（effects 二分不变量）
  const p = useSpring('settle', {at: delay, dur: DUR.f6});
  const o = useProgress(delay, DUR.f6);
  return (
    <div
      style={{
        position: 'absolute',
        left: x + (1 - p) * scatter[0],
        top: y + (1 - p) * scatter[1],
        width: 150,
        height: 88,
        transform: `rotate(${rot}deg)`,
        border: `2px solid ${theme.mech}`,
        borderRadius: 10,
        background: theme.panel,
        opacity: o,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
      }}
    >
      {labeled ? (
        <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.text}}>{'tab 缩进'}</span>
      ) : (
        <>
          <div style={{width: 104, height: 8, background: theme.panelBorder, borderRadius: 4}} />
          <div style={{width: 78, height: 8, background: theme.panelBorder, borderRadius: 4}} />
        </>
      )}
    </div>
  );
};

const CardfileClose: React.FC<{atCards: number; atBreathe: number}> = ({atCards, atBreathe}) => {
  const glow = useBreathe({period: 90, amp: 0.28, base: 0.42});
  const gate = useProgress(atBreathe, DUR.f5);
  const halo = glow * gate;

  return (
    <div style={{position: 'absolute', left: 150, top: 555, width: 660, height: 310}}>
      {/* 合拢定格后的苔绿辉光（breathe 收束） */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 14,
          width: 640,
          height: 292,
          border: `2px solid ${theme.mech}`,
          borderRadius: 24,
          opacity: halo,
          boxShadow: `0 0 ${34 * halo}px ${theme.mech}44`,
        }}
      />
      <Panel accent={theme.mech} style={{position: 'absolute', left: 20, top: 60, width: 280, height: 220, padding: '26px 26px 26px 36px'}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: theme.mechDeep,
            opacity: 0.55,
            borderRadius: '14px 0 0 14px',
          }}
        />
        <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.mech}}>{'卡片册'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 10}}>{'跨会话 · 长期'}</div>
        <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10}}>
          {[180, 158, 168].map((wd, i) => (
            <div key={i} style={{width: wd, height: 6, background: theme.panelBorder, borderRadius: 3}} />
          ))}
        </div>
      </Panel>
      {SCATTER.map((sc, i) => (
        <FlyCard
          key={i}
          delay={atCards + i * 9}
          scatter={sc}
          x={350}
          y={40 + i * 17}
          rot={(i - 2) * 3}
          labeled={i === 0}
        />
      ))}
    </div>
  );
};

/** 官方记忆全景两席定位（p5-23：你手写的 vs 模型自己攒的） */
const OfficialMap: React.FC<{atPanel: number}> = ({atPanel}) => {
  const e = useEnter('rise', {at: atPanel, dist: 30, springPreset: 'settle'});
  const rows = useStagger(2, {at: atPanel + DUR.f4, dur: DUR.f4, stride: 14});

  return (
    <div style={{position: 'absolute', left: 1230, top: 555, width: 540, opacity: e.opacity, transform: e.transform}}>
      <Panel style={{height: 310, padding: '26px 30px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text}}>
          {'官方记忆全景'}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 28,
            opacity: rows[0],
          }}
        >
          <span
            style={{
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 8,
              padding: '6px 14px',
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.dim,
            }}
          >
            {'CLAUDE.md'}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'你手写的指令文件'}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 20,
            padding: '12px 14px',
            border: `2px solid ${theme.mech}`,
            borderRadius: 12,
            background: `${theme.mech}14`,
            opacity: rows[1],
          }}
        >
          <span
            style={{
              border: `2px solid ${theme.mech}`,
              borderRadius: 8,
              padding: '6px 14px',
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.mech,
              background: theme.panel,
            }}
          >
            {'auto memory'}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text}}>{'模型自己攒的卡片册'}</span>
          <span
            style={{
              border: `2px solid ${theme.mech}`,
              borderRadius: 999,
              padding: '4px 14px',
              fontFamily: theme.mono,
              fontSize: 18,
              color: theme.mech,
            }}
          >
            {'本片'}
          </span>
        </div>
      </Panel>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5ThreeGates: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-05', 'p5-10');
  const bC = w('p5-11', 'p5-14');
  const bD = w('p5-15', 'p5-20');
  const bE = w('p5-21', 'p5-23');

  return (
    <AbsoluteFill>
      {/* 本集 P1–P5 不挂 HarnessBadge（P0 头注设计：坐标 Chip 替位，五层栈只在
          P6 收尾）——此前误挂默认 top:12 会整幕压进 frozen ChapterProgress 带 */}
      <Sequence {...bA} name="5-A 提取时机">
        <SceneTag chapter={'P5'} tagline={'三道门'} accent={theme.mech} />
        <MapAnchorChip active="cardfile" enterAt={10} />
        {/* p5-01 空窗回落：提取时机开卷（时钟+快照相机），p5-03 起让位图10 */}
        <Sequence durationInFrames={at('p5-03') - bA.from} name="5-A 开卷回落">
          <ExtractPrelude
            enterAt={6}
            chipsAt={at('p5-01') + Math.round(dur('p5-01') * 0.32) - bA.from}
            flashAt={at('p5-03') - bA.from - 15}
          />
          <Footnote delay={6}>{'extract'}</Footnote>
        </Sequence>
        {/* 幕界后首镜（P4 末镜隔幕间隙+交叉淡化）：lead 默认 true */}
        <ArchifyRecap
          slug="recall-loop"
          caption="四环节全景"
          cues={[
            {chapterId: 'extract-gates', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 三句穿门">
        {/* 前镜 5-A 末章与本镜首章帧相邻：lead={false}（分镜 lead 清单）；五章句句相接 */}
        <ArchifyRecap
          lead={false}
          slug="memory-gates"
          caption="三道门"
          cues={[
            {chapterId: 'three-in', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
            {chapterId: 'first-pass', at: at('p5-07') - bB.from, durationInFrames: dur('p5-07')},
            {chapterId: 'second-block', at: at('p5-07b') - bB.from, durationInFrames: dur('p5-07b')},
            {chapterId: 'third-block', at: at('p5-09') - bB.from, durationInFrames: dur('p5-09')},
            {chapterId: 'one-of-three', at: at('p5-10') - bB.from, durationInFrames: dur('p5-10')},
          ]}
        />
        <Footnote delay={40}>{'scope · persistent'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="5-C 便签对置">
        <MinutesVsSticky
          atLeft={at('p5-11') + Math.round(dur('p5-11') * 0.42) - bC.from}
          atRight={at('p5-11') + Math.round(dur('p5-11') * 0.42) - bC.from + 14}
          atLeftLine={at('p5-12') + Math.round(dur('p5-12') * 0.3) - bC.from}
          atRightLine={at('p5-12') + Math.round(dur('p5-12') * 0.72) - bC.from}
          atStrip={at('p5-13') + Math.round(dur('p5-13') * 0.22) - bC.from}
          atBlade={at('p5-13') + Math.round(dur('p5-13') * 0.58) - bC.from}
          atRule={at('p5-14') + Math.round(dur('p5-14') * 0.28) - bC.from}
        />
        <Footnote delay={6}>{'scope gate'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="5-D 事务整理">
        {/* p5-15 空窗回落：查重门三盏比对灯（图12 入场前的门三具象） */}
        <Sequence durationInFrames={at('p5-16') - bD.from} name="5-D 查重门回落">
          <DedupLamps
            enterAt={6}
            lampsAt={at('p5-15') + Math.round(dur('p5-15') * 0.28) - bD.from}
            verdictAt={at('p5-15') + Math.round(dur('p5-15') * 0.66) - bD.from}
          />
          <Footnote delay={6}>{'consolidate'}</Footnote>
        </Sequence>
        {/* 前镜 5-C 为场景镜：lead 默认 true */}
        <ArchifyRecap
          slug="consolidation-txn"
          caption="事务整理"
          cues={[
            {chapterId: 'trigger-snapshot', at: at('p5-16') - bD.from, durationInFrames: dur('p5-16')},
            {chapterId: 'swap-write', at: at('p5-17') - bD.from, durationInFrames: dur('p5-17')},
            {chapterId: 'fail-rollback', at: at('p5-18') - bD.from, durationInFrames: dur('p5-18')},
            {chapterId: 'no-snapshot', at: at('p5-19') - bD.from, durationInFrames: dur('p5-19')},
          ]}
        />
        {/* p5-20 收束窗：事务三步 + 10→0 破坏回声（锚定句窗内自含时序） */}
        <Sequence from={at('p5-20') - bD.from} durationInFrames={dur('p5-20')} name="5-D 事务三步收束">
          <TxnSteps enterAt={4} atWarn={Math.round(dur('p5-20') * 0.55)} />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="5-E 界线卡">
        {/* p5-21 界线句：全景图整理章回看（承接 5-D 事务链；p5-20 装置窗隔断＝空窗后
            重现 → lead 默认入场，不再瞬现）；界线卡入场让到 p5-22 起 */}
        <ArchifyRecap
          slug="recall-loop"
          caption="四环节全景"
          cues={[
            {chapterId: 'consolidate', at: at('p5-21') - bE.from, durationInFrames: dur('p5-21')},
          ]}
        />
        <BoundaryCard
          at={at('p5-22') - bE.from}
          left={240}
          accentBorder={theme.panelBorder}
          titleColor={theme.text}
          subColor={theme.dim}
          title={'草稿纸内的腾挪'}
          sub={'省着放'}
          icon="paper"
        />
        <BoundaryCard
          at={at('p5-22') - bE.from + 12}
          left={1060}
          accentBorder={theme.mech}
          titleColor={theme.text}
          subColor={theme.mech}
          title={'卡片册'}
          sub={'跨会话值得留'}
          icon="cards"
        />
        {/* 界线分隔：竖线 + 标签 */}
        <BoundaryDivider atLine={at('p5-22') - bE.from} />
        <BoundaryChip atChip={at('p5-22') + Math.round(dur('p5-22') * 0.45) - bE.from} />
        {/* 卡片册母题合拢：整件让到 consolidate cue 窗外（p5-22 起）——全屏独占契约，
            基座 Panel 与飞卡不得与画框同屏（此前 bE 全窗挂载，右缘压进画框 8.1s） */}
        <Sequence
          from={at('p5-22') - bE.from}
          durationInFrames={bE.durationInFrames - (at('p5-22') - bE.from)}
          name="5-E 卡片册合拢"
        >
          <CardfileClose
            atCards={Math.round(dur('p5-22') * 0.45)}
            atBreathe={dur('p5-22') + Math.round(dur('p5-23') * 0.2)}
          />
        </Sequence>
        <OfficialMap atPanel={at('p5-23') + Math.round(dur('p5-23') * 0.3) - bE.from} />
        <Footnote delay={6}>{'CLAUDE.md · auto memory'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 界线竖线 + 「界线」标签（随双卡落位淡入） */
const BoundaryDivider: React.FC<{atLine: number}> = ({atLine}) => {
  const o = useProgress(atLine + DUR.f5, DUR.f4);
  return (
    <div style={{position: 'absolute', left: 952, top: 214, opacity: o}}>
      <div style={{width: 4, height: 210, background: theme.panelBorder, borderRadius: 2}} />
      <div
        style={{
          position: 'absolute',
          left: -32,
          top: 224,
          width: 68,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
        }}
      >
        {'界线'}
      </div>
    </div>
  );
};

/** p5-22 收条：能从代码推导的事实 · 不存 */
const BoundaryChip: React.FC<{atChip: number}> = ({atChip}) => {
  const o = useProgress(atChip, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 480,
        textAlign: 'center',
        opacity: o,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 999,
          padding: '10px 28px',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
        }}
      >
        {'能从代码推导的事实 · '}
        <span style={{color: theme.text}}>{'不存'}</span>
      </span>
    </div>
  );
};

export default P5ThreeGates;
