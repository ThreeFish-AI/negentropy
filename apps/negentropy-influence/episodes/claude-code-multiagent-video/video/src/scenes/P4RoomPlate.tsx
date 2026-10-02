/** P4 门牌房（p4-01..18，6 镜 8 cue）——分镜 4-A…4-F。
 *
 *  cue 清单（8）：
 *   4-B room-ledger-bind ledger@p4-05 / branches@p4-06（p4-04 空窗回落）
 *   4-C room-ledger-bind bind@p4-07 / namecheck@p4-08（与 4-B 末章镜界紧邻
 *      → lead={false}）
 *   4-E room-teardown entry@p4-12 / refuse@p4-13 / force-keep@p4-14 /
 *      audit@p4-16（p4-15 金句位空窗回落）
 *
 *  ★ 4-A 事故现场：同目录两笔写同一文件（@shake＋红闪覆盖）、回滚箭头打结（@draw）。
 *  ★ 4-D 认领进房·缺口②：卡带房号旅行入房（@travel 循环点）＋目录切换＋
 *    虚线箭头（@draw）＋「缺口②」角标（4-D 虚线在 6-E 换实线）。
 *  ★ 4-F 产品对照【三】：任务卡与门牌房=两套独立系统（图示拆开 @spring）。
 *  ★ LodgeMap active=rooms（本幕坐标高亮：楼上房带）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LodgeMap, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, progress, useDraw, useEnter, useImpulse, useProgress, useShake, useSpring, useStagger, useTravel} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const BADGE_STYLE: React.CSSProperties = {top: 64};

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const KeyCard: React.FC<{at: number; main: string; sub?: string; accent?: string; left?: number; top?: number; width?: number}> = ({
  at,
  main,
  sub,
  accent,
  left = 660,
  top = 400,
  width = 600,
}) => {
  const o = useProgress(at, DUR.f4);
  return (
    <div style={{position: 'absolute', left, top, width, opacity: o, transform: `translateY(${(1 - o) * 14}px)`, textAlign: 'center'}}>
      <Panel accent={accent} style={{boxSizing: 'border-box', padding: '22px 30px'}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 600, color: theme.text}}>{main}</div>
        {sub ? <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 10}}>{sub}</div> : null}
      </Panel>
    </div>
  );
};

// ── 4-A 事故现场 ────────────────────────────────────────────────────────

/** 同目录两笔写同一文件：两支笔交错、后写覆盖先写（红闪）；回滚箭头打结。 */
const AccidentScene: React.FC<{at02: number; at03: number}> = ({at02, at03}) => {
  const frame = useCurrentFrame();
  // 两支笔的书写进度（交错推进）
  const penA = progress(frame, 10, 40);
  const penB = progress(frame, 34, 40);
  // 覆盖红闪（后写盖先写）
  const over = useImpulse({at: 76, dur: DUR.f6, peak: 1});
  const overO = progress(frame, 74, DUR.f3);
  // 文件卡抖动（碰撞）
  const shake = useShake({at: 72, amp: 5, freq: 1.4, decay: true, dur: DUR.f6});
  // 回滚箭头打结（@draw）
  const knot = useDraw(at03, 40);
  const knotO = progress(frame, at03, DUR.f3);
  return (
    <AbsoluteFill>
      {/* 楼上房带亮灯（第五件在楼上） */}
      <div style={{position: 'absolute', left: 300, top: 120, display: 'flex', gap: 22, opacity: progress(frame, 2, DUR.f4)}}>
        {['房一', '房二', '房三'].map((r, i) => (
          <div key={r} style={{padding: '8px 22px', borderRadius: 8, border: `2px solid ${i === 1 ? theme.mechDeep : theme.panelBorder}`, fontFamily: theme.sans, fontSize: 22, color: i === 1 ? theme.text : theme.dim}}>
            {r}
          </div>
        ))}
      </div>

      {/* 同一文件卡（两笔交错写入） */}
      <div style={{position: 'absolute', left: 660, top: 300, transform: `translateX(${shake}px)`}}>
        <Panel accent={theme.danger} style={{width: 600, boxSizing: 'border-box', padding: '24px 30px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'./src/app.py'}</div>
          <svg width={540} height={190} style={{marginTop: 10}}>
            {/* 笔 A（左·先写） */}
            <line x1={20} y1={50} x2={20 + penA * 240} y2={50} stroke={theme.accent} strokeWidth={5} strokeLinecap="round" />
            <circle cx={Math.min(20 + penA * 240, 260)} cy={50} r={8} fill={theme.accent} />
            {/* 笔 B（右·后写，反向推进） */}
            <line x1={520} y1={92} x2={520 - penB * 240} y2={92} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
            <circle cx={Math.max(520 - penB * 240, 280)} cy={92} r={8} fill={theme.dim} />
            {/* 覆盖红闪区（后写盖掉先写） */}
            <rect x={270} y={34} width={250} height={72} rx={6} fill={theme.danger} opacity={0.14 + 0.3 * over} />
            <text x={395} y={78} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fontWeight={700} fill={theme.danger} opacity={overO}>
              {'后写 盖 先写'}
            </text>
            {/* 回滚箭头打结（p4-03） */}
            <g opacity={knotO}>
              <path
                d="M120 168 C 180 120, 420 210, 330 150 C 260 104, 420 110, 460 152"
                fill="none"
                stroke={theme.danger}
                strokeWidth={4}
                opacity={0.85}
                {...knot}
              />
              <text x={290} y={186} textAnchor="middle" fontFamily={theme.sans} fontSize={21} fill={theme.danger}>
                {'回滚 · 回不干净'}
              </text>
            </g>
          </svg>
        </Panel>
      </div>

      {/* 两位师傅（同目录各写各的） */}
      {[{x: 480, label: '甲'}, {x: 1310, label: '乙'}].map((p) => (
        <div key={p.label} style={{position: 'absolute', left: p.x, top: 560, opacity: 0.9}}>
          <svg width={110} height={160} viewBox="0 0 120 180">
            <circle cx={60} cy={34} r={28} fill={theme.text} />
            <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 4}}>{p.label}</div>
        </div>
      ))}
      <Footnote delay={14}>{'同一目录 · 互相覆盖'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-D 认领进房·缺口② ──────────────────────────────────────────────────

/** 认领带房号的卡→读写落房（目录标签切换）；诚实边界卡：目录不真切（虚线箭头+
 *  「缺口②」角标，天亮前合上）。 */
const ClaimIntoRoom: React.FC<{at09: number; at10: number; at11: number}> = ({at09, at10, at11}) => {
  const frame = useCurrentFrame();
  // 卡旅行入房（p4-09 前半：从墙飞向房二）
  const travel = progress(frame, at09 + 6, 26);
  const cardX = 360 + travel * 760;
  const cardY = 430 - travel * 150;
  // 房内工作循环点（落房后的读写循环——@travel 巡游）
  const loop = useTravel({cx: 1240, cy: 300, r: 34, secPerLap: 2.2});
  const loopO = progress(frame, at09 + 32, DUR.f4);
  // 目录标签切换（大厅 → 房-2）
  const dirFlip = progress(frame, at09 + 30, DUR.f4);
  // 虚线箭头（缺口②：目录不真切——6-E 换实线）
  const dashed = useDraw(at10 + 8, 36);
  const dashedO = progress(frame, at10 + 8, DUR.f3);
  // 缺口②角标
  const mark = useImpulse({at: at11, dur: DUR.f6, peak: 1});
  const markO = progress(frame, at11, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 墙（左） */}
      <div style={{position: 'absolute', left: 240, top: 260}}>
        <Panel style={{width: 260, boxSizing: 'border-box', padding: '18px 22px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'.tasks/'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text, marginTop: 8}}>{'写接口'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.accent, marginTop: 8}}>{'worktree: room-2'}</div>
        </Panel>
      </div>
      {/* 房二（右） */}
      <div style={{position: 'absolute', left: 1080, top: 200}}>
        <div
          style={{
            width: 320,
            boxSizing: 'border-box',
            padding: '18px 24px',
            borderRadius: 12,
            background: theme.panel,
            border: `2.5px solid ${theme.mechDeep}`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'房二 · room-2'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 6}}>{'.worktrees/room-2'}</div>
        </div>
      </div>
      {/* 房内工作循环（读写落房） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: loopO}}>
        <circle cx={1240} cy={300} r={34} fill="none" stroke={theme.panelBorder} strokeWidth={3} />
        <circle cx={loop.x} cy={loop.y} r={8} fill={theme.accent} />
      </svg>
      {/* 旅行中的任务卡 */}
      <div style={{position: 'absolute', left: cardX, top: cardY, opacity: 1}}>
        <div style={{width: 210, boxSizing: 'border-box', padding: '12px 16px', borderRadius: 8, background: theme.panel, border: `2px solid ${theme.accent}`}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text}}>{'写接口'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.accent, marginTop: 4}}>{'→ room-2'}</div>
        </div>
      </div>
      {/* 目录标签切换（大厅/房二 双位翻牌） */}
      <div style={{position: 'absolute', left: 830, top: 620}}>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'cwd'}</div>
        <div style={{position: 'relative', width: 260, height: 46, marginTop: 6, borderRadius: 8, border: `2px solid ${theme.panelBorder}`, overflow: 'hidden', background: theme.bg}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center', lineHeight: '42px', fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: 1 - dirFlip}}>
            {'大厅 / hall'}
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center', lineHeight: '42px', fontFamily: theme.mono, fontSize: 20, color: theme.accent, opacity: dirFlip}}>
            {'房二 / room-2'}
          </div>
        </div>
      </div>
      {/* 虚线箭头（提醒而非真切——缺口②）：描画动画与像素虚线分置两元素（红线三） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: dashedO}}>
        {/* 线型层：静态像素虚线 */}
        <path d="M960 700 C 1060 700, 1060 760, 1160 760" fill="none" stroke={theme.mechDeep} strokeWidth={4} strokeDasharray="14 10" opacity={0.35} />
        {/* 描画层：pathLength 归一化 */}
        <path d="M960 700 C 1060 700, 1060 760, 1160 760" fill="none" stroke={theme.mechDeep} strokeWidth={4} {...dashed} />
      </svg>
      {/* 缺口② 角标 */}
      <div
        style={{
          position: 'absolute',
          left: 1330,
          top: 700,
          opacity: markO,
          transform: `scale(${0.8 + 0.2 * mark}) rotate(-6deg)`,
          fontFamily: theme.serif,
          fontSize: 32,
          fontWeight: 700,
          color: theme.mechDeep,
          border: `3px solid ${theme.mechDeep}`,
          borderRadius: 10,
          padding: '4px 16px',
          textShadow: `0 0 ${12 * mark}px ${withAlpha(theme.mechDeep, 0.5)}`,
        }}
      >
        {'缺口 ②'}
      </div>
      <div style={{position: 'absolute', left: 330, top: 760, width: 600, textAlign: 'center', fontFamily: theme.sans, fontSize: 25, color: theme.dim, opacity: dashedO}}>
        {'房号 → 提醒 · 目录不切'}
      </div>
      <Footnote delay={18}>{'bind_task_to_worktree · validate_worktree_name'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-F 产品对照 ────────────────────────────────────────────────────────

/** 两套独立系统（图示拆开的双系统）：任务卡系统 vs 门牌房系统，无绑定。 */
const TwoSystems: React.FC<{at17: number}> = ({at17}) => {
  const riseL = useEnter('rise', {at: 4, dur: DUR.f5, springPreset: 'settle', dist: 26});
  const riseR = useEnter('rise', {at: 10, dur: DUR.f5, springPreset: 'settle', dist: 26});
  // 拆开（p4-18：靠师傅自己对上号——两卡背向弹开）
  const apart = useSpring('settle', {at: at17 + 10, dur: DUR.f5});
  const apartO = useProgress(at17 + 10, DUR.f4);
  const sep = 40 + 140 * apart;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', gap: sep}}>
        <div style={riseL}>
          <div style={{transform: `translateX(${-apart * 70}px)`}}>
            <Panel accent={theme.accent} style={{width: 480, boxSizing: 'border-box', padding: '26px 32px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'.tasks/'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.text, marginTop: 10}}>{'任务卡系统'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 10}}>{'状态 · 认领 · 依赖'}</div>
            </Panel>
          </div>
        </div>
        <div style={riseR}>
          <div style={{transform: `translateX(${apart * 70}px)`}}>
            <Panel accent={theme.mechDeep} style={{width: 480, boxSizing: 'border-box', padding: '26px 32px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'.worktrees/'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.text, marginTop: 10}}>{'门牌房系统'}</div>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 10}}>{'目录 · 分支 · 隔离'}</div>
            </Panel>
          </div>
        </div>
      </div>
      {/* 断开的绑定线（无绑定——靠师傅自己看着对） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: apartO}}>
        <line x1={960 - sep / 2 - 20} y1={420} x2={960 - sep / 2 - 90} y2={420} stroke={theme.danger} strokeWidth={4} />
        <line x1={960 + sep / 2 + 20} y1={420} x2={960 + sep / 2 + 90} y2={420} stroke={theme.danger} strokeWidth={4} />
        <text x={960} y={398} textAnchor="middle" fontFamily={theme.sans} fontSize={30} fontWeight={700} fill={theme.danger}>
          {'✕ 无绑定'}
        </text>
      </svg>
      {/* 【三】归属角标 */}
      <div
        style={{
          position: 'absolute',
          left: 880,
          top: 600,
          fontFamily: theme.serif,
          fontSize: 26,
          color: theme.dim,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 999,
          padding: '6px 20px',
          opacity: apartO,
        }}
      >
        {'三 · 据源码分析'}
      </div>
      <Footnote delay={16}>{'EnterWorktreeTool（产品侧）'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4RoomPlate: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-06');
  const bC = w('p4-07', 'p4-08');
  const bD = w('p4-09', 'p4-11');
  const bE = w('p4-12', 'p4-16');
  const bF = w('p4-17', 'p4-18');

  const frame = useCurrentFrame();
  const mapIn = progress(frame, 6, DUR.f4);

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />
      <SceneTag chapter="P4" tagline="门牌房" accent={theme.accent} />
      <div style={{position: 'absolute', left: 1668, top: 56, opacity: mapIn}}>
        <LodgeMap active="rooms" />
      </div>

      <Sequence {...bA} name="4-A 事故现场">
        <AccidentScene at02={at('p4-02') - bA.from} at03={at('p4-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="4-B 账本与房间">
        {/* p4-04 空窗回落 */}
        <ArchifyYield
          cues={[
            {at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')},
          ]}
        >
          <KeyCard at={2} main={'版本控制 · 三句话'} sub={'repo · commit · branch'} accent={theme.accent} />
        </ArchifyYield>
        {/* cue 1-2/8：room-ledger-bind 逐章（中央账本→各改各的线） */}
        <ArchifyRecap
          slug="room-ledger-bind"
          caption="账本·分支·房"
          cues={[
            {chapterId: 'ledger', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {chapterId: 'branches', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 绑定与校验">
        {/* cue 3-4/8：room-ledger-bind（房号绑定→名字校验）；与 4-B 末章镜界紧邻 → lead={false} */}
        <ArchifyRecap
          slug="room-ledger-bind"
          caption="绑定·名字校验"
          cues={[
            {chapterId: 'bind', at: at('p4-07') - bC.from, durationInFrames: dur('p4-07')},
            {chapterId: 'namecheck', at: at('p4-08') - bC.from, durationInFrames: dur('p4-08')},
          ]}
          lead={false}
        />
      </Sequence>

      <Sequence {...bD} name="4-D 认领进房·缺口②">
        <ClaimIntoRoom at09={at('p4-09') - bD.from} at10={at('p4-10') - bD.from} at11={at('p4-11') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="4-E 拆房三出口">
        {/* p4-15 金句位空窗回落 */}
        <ArchifyYield
          cues={[
            {at: at('p4-12') - bE.from, durationInFrames: dur('p4-12')},
            {at: at('p4-13') - bE.from, durationInFrames: dur('p4-13')},
            {at: at('p4-14') - bE.from, durationInFrames: dur('p4-14')},
            {at: at('p4-16') - bE.from, durationInFrames: dur('p4-16')},
          ]}
        >
          <KeyCard at={at('p4-15') - bE.from} main={'有改动 · 拒拆'} sub={'救命索 · keep_worktree'} accent={theme.accent} />
        </ArchifyYield>
        {/* cue 5-8/8：room-teardown 逐章（默认不拆→拒拆→强删/保留→事件日志） */}
        <ArchifyRecap
          slug="room-teardown"
          caption="拆房三出口"
          cues={[
            {chapterId: 'entry', at: at('p4-12') - bE.from, durationInFrames: dur('p4-12')},
            {chapterId: 'refuse', at: at('p4-13') - bE.from, durationInFrames: dur('p4-13')},
            {chapterId: 'force-keep', at: at('p4-14') - bE.from, durationInFrames: dur('p4-14')},
            {chapterId: 'audit', at: at('p4-16') - bE.from, durationInFrames: dur('p4-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 产品对照">
        <TwoSystems at17={at('p4-17') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4RoomPlate;
