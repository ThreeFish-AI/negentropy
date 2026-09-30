/** P3 班次（p3-01..23，4 镜 13 cue）——分镜 3-A…3-D。
 *
 *  装置重心：过载翻转装置（deny 拥堵扇面 → mech 金分流）、教学 vs 产品
 *  双向卡、原地复活装置、两数法对照卡；deny = 拥堵/急停的唯一语义色。
 *  archify 两图（shift-three-beats / idle-claim-loop）全屏独占：一章锚一句；
 *  跨实例背靠背（含镜界）后挂实例关入场；空窗后重现默认入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, useEnter, useProgress, useShake, useSpring, useStagger} from '../motion';

/** 常驻系列条定位（与 P1/P2 同值，由组装方统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅/队友剪影（无彩） */
const Silhouette: React.FC<{color?: string; opacity?: number}> = ({
  color = theme.text,
  opacity = 0.92,
}) => (
  <svg width={70} height={118} style={{overflow: 'visible'}}>
    <circle cx={35} cy={22} r={19} fill={color} opacity={opacity} />
    <path
      d="M7 104 Q7 42 35 38 Q63 42 63 104 Z"
      fill={color}
      opacity={opacity}
    />
  </svg>
);

// ── 3-A 领队派工过载 → 翻转：自己看板自己认领 ──────────────────────────

/** 十张待认领活卡（2 行 × 5）的固定槽位 */
const SLOT_POS = Array.from({length: 10}, (_, i) => ({
  left: 460 + (i % 5) * 250,
  top: 330 + Math.floor(i / 5) * 110,
}));

const OverloadFlip: React.FC<{atFlip: number}> = ({atFlip}) => {
  // 拥堵扇面：领队向下发 10 支 deny 箭头（stagger 逐支）
  const arrows = useStagger(SLOT_POS.length, {at: 4, stride: 3, dur: DUR.f3});
  // 拥堵抖动：满额后衰减抖两下（领队 + 箭头组共用）
  const jamAt = 4 + SLOT_POS.length * 3 + DUR.f3;
  const shake = useShake({at: jamAt, amp: 4, freq: 1.6, decay: true, dur: DUR.f5});
  // 翻转：deny 拥堵退场，三队友 mech 金箭头向上分流认领
  const flip = useProgress(atFlip, DUR.f6);
  const motto = useProgress(atFlip + DUR.f5, DUR.f4);
  // 三队友自下缘升起（restBottom 钳行进安全带）
  const mates = useStagger(3, {at: atFlip + 4, stride: 5, dur: DUR.f4});

  return (
    <AbsoluteFill>
      <SceneTag chapter="班次" tagline="自己看板 · 自己认领" />

      {/* 领队（上缘居中）＋拥堵抖动 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 35,
          top: 130,
          transform: `translateX(${shake}px)`,
        }}
      >
        <Silhouette />
        <div
          style={{
            position: 'absolute',
            left: -35,
            top: 118,
            width: 140,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'领队'}
        </div>
      </div>

      {/* 派工箭头 ×10（deny 拥堵扇面）——翻转时随 flip 退场 */}
      <svg width={1920} height={720} style={{position: 'absolute', left: 0, top: 0, opacity: 1 - flip}}>
        {SLOT_POS.map((s, i) => {
          const p = arrows[i];
          const tx = s.left + 105;
          const ty = s.top + 40;
          // 从领队 (960,250) 到各卡的直线，长度随 stagger 生长
          const x1 = 960 + (tx - 960) * 0.12;
          const y1 = 250;
          const x2 = x1 + (tx - x1) * p;
          const y2 = y1 + (ty - y1) * p;
          return (
            <g key={i} opacity={p}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.deny} strokeWidth={3} />
              {p >= 1 ? (
                <circle cx={tx} cy={ty - 6} r={5} fill={theme.deny} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* 十张待领活卡（panel 底 + mono 编号） */}
      {SLOT_POS.map((s, i) => (
        <div key={i} style={{position: 'absolute', left: s.left, top: s.top, opacity: arrows[i]}}>
          <Panel style={{width: 210, padding: '12px 0', textAlign: 'center'}}>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
              {`t${String(i + 1).padStart(2, '0')}`}
            </span>
          </Panel>
        </div>
      ))}

      {/* 翻转后：三队友自行认领（mech 金箭头分流） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {[0, 1, 2].map((i) => {
          const mx = 620 + i * 320;
          const ty = 330 + (i % 2) * 110 + 40;
          const p = flip * (mates[i] ?? 0);
          return (
            <g key={i} opacity={p}>
              <line x1={mx} y1={840} x2={mx} y2={840 - (840 - ty - 90) * p} stroke={theme.mech} strokeWidth={4} />
              <path
                d={`M${mx - 10} ${840 - (840 - ty - 90) * p + 18} L${mx} ${840 - (840 - ty - 90) * p} L${mx + 10} ${840 - (840 - ty - 90) * p + 18}`}
                fill="none"
                stroke={theme.mech}
                strokeWidth={4}
              />
            </g>
          );
        })}
      </svg>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 620 + i * 320 - 35,
            top: 840,
            opacity: flip * (mates[i] ?? 0),
          }}
        >
          <Silhouette />
        </div>
      ))}

      {/* 题词（衬线） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 640,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 50,
          fontWeight: 700,
          color: theme.text,
          opacity: motto,
        }}
      >
        {'自己看板 · 自己认领'}
      </div>

      <Footnote delay={6}>{'scan_unclaimed_tasks'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 3-D 教学 vs 产品双向卡 ──────────────────────────────────────────────

/** 三行对照：超时方向相反 / 复活机制 / 报信两数法（dim 行 = 未讲到） */
const DUO_ROWS = [
  {axis: '超时', teach: '超时下班', prod: '不赶人'},
  {axis: '复活', teach: '完成即退', prod: '收消息复活'},
  {axis: '报信', teach: '一条消息', prod: '通知含答案'},
] as const;

/** 双向卡：slideL/slideR 对开；teachHot 数值控制左卡 deny 高热（p3-19 急的是教学版） */
const DuoCards: React.FC<{at: number; teachHot?: number}> = ({at, teachHot = 0}) => {
  const left = useEnter('slideL', {at, dur: DUR.f5, dist: 120, springPreset: 'settle'});
  const right = useEnter('slideR', {at: at + 4, dur: DUR.f5, dist: 120, springPreset: 'settle'});
  const row1 = useProgress(at + 10, DUR.f4);
  const hot = useProgress(at + 14, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 左：教学版（p3-19 急着下班 → deny 高热） */}
      <div style={{position: 'absolute', left: 320, top: 300, ...left}}>
        <Panel
          accent={teachHot > 0.5 ? theme.deny : theme.panelBorder}
          style={{
            width: 600,
            padding: '22px 30px',
            boxShadow: teachHot > 0.5 ? `0 0 ${18 * hot}px ${withAlpha(theme.danger, 0.4 * hot)}` : undefined,
          }}
        >
          <div style={{height: 44}}>
            <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>
              {'教学版'}
            </span>
          </div>
          {DUO_ROWS.map((r, i) => (
            <div
              key={r.axis}
              style={{
                height: 60,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                opacity: i === 0 ? row1 : 0.4,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, width: 64}}>{r.axis}</span>
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 27,
                  color: i === 0 && teachHot > 0.5 ? theme.deny : theme.text,
                }}
              >
                {r.teach}
              </span>
            </div>
          ))}
          {teachHot > 0.5 ? (
            <div
              style={{
                marginTop: 10,
                fontFamily: theme.sans,
                fontSize: 23,
                color: theme.deny,
                opacity: hot,
              }}
            >
              {'急着下班'}
            </div>
          ) : null}
        </Panel>
      </div>
      {/* 右：产品 */}
      <div style={{position: 'absolute', left: 1000, top: 300, ...right}}>
        <Panel accent={theme.mech} style={{width: 600, padding: '22px 30px'}}>
          <div style={{height: 44}}>
            <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.mech}}>
              {'产品'}
            </span>
          </div>
          {DUO_ROWS.map((r, i) => (
            <div
              key={r.axis}
              style={{
                height: 60,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                opacity: i === 0 ? row1 : 0.4,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, width: 64}}>{r.axis}</span>
              <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>{r.prod}</span>
            </div>
          ))}
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 原地复活装置：已停工位收到新消息，剪影重新坐起（spring） */
const ReviveSeat: React.FC<{atMsg: number}> = ({atMsg}) => {
  const frame = useProgress(2, DUR.f4);
  // 消息条从收件格飞入工位（mech 金一条）
  const msgFly = useProgress(atMsg, DUR.f5, 'decelerate');
  // 坐起（spring）：趴 → 坐
  const sit = useSpring('settle', {at: atMsg + DUR.f5 + 2, dur: DUR.f6});
  const label = useProgress(atMsg + DUR.f5 + 8, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 960 - 190, top: 340, opacity: frame}}>
        <Panel accent={theme.mech} style={{width: 380, height: 330, position: 'relative'}}>
          {/* 工位门牌：收件格（右上角小格） */}
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: 12,
              width: 84,
              height: 54,
              borderRadius: 8,
              border: `2px solid ${theme.mech}`,
              background: theme.bg,
            }}
          />
          {/* 新消息条：从收件格飞向剪影（mech 金） */}
          <div
            style={{
              position: 'absolute',
              left: 252 - 56 * msgFly,
              top: 40 + 110 * msgFly,
              width: 128,
              padding: '6px 0',
              textAlign: 'center',
              borderRadius: 6,
              background: withAlpha(theme.mechDeep, 0.55),
              border: `2px solid ${theme.mech}`,
              fontFamily: theme.mono,
              fontSize: 18,
              color: theme.mech,
              opacity: 0.25 + 0.75 * msgFly,
            }}
          >
            {'新消息'}
          </div>
          {/* 剪影：趴（dim，低位）↔ 坐（text 白）——crossfade，位移由 spring 驱动 */}
          <div
            style={{
              position: 'absolute',
              left: 155,
              top: 168 + 46 * (1 - sit),
              transform: `rotate(${18 * (1 - sit)}deg)`,
              opacity: 1 - sit,
            }}
          >
            <Silhouette color={theme.dim} opacity={0.7} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 155,
              top: 152,
              opacity: sit,
            }}
          >
            <Silhouette />
          </div>
          {/* 状态标签：已停 → 在 */}
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 12,
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.dim,
              opacity: 1 - label,
            }}
          >
            {'已停'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 12,
              fontFamily: theme.mono,
              fontSize: 20,
              color: theme.mech,
              opacity: label,
            }}
          >
            {'在'}
          </div>
        </Panel>
      </div>
      <Footnote delay={2}>{'idle_notification'}</Footnote>
    </AbsoluteFill>
  );
};

/** 两数法对照卡：一条结果消息 vs 通知内含答案 */
const TwoCounts: React.FC = () => {
  const inL = useProgress(2, DUR.f5);
  const inR = useProgress(2 + 8, DUR.f5);
  const answer = useProgress(2 + 16, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 左：教学版——一条结果消息 */}
      <div style={{position: 'absolute', left: 330, top: 330, opacity: inL}}>
        <Panel style={{width: 560, padding: '22px 30px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            {'一条消息'}
          </div>
          <div style={{marginTop: 14}}>
            <Panel accent={theme.panelBorder} style={{width: 420, padding: '12px 18px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'result'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 4}}>
                {'干完了 · 汇报'}
              </div>
            </Panel>
          </div>
        </Panel>
      </div>
      {/* 右：产品——空闲通知内含最终答案 */}
      <div style={{position: 'absolute', left: 1030, top: 330, opacity: inR}}>
        <Panel accent={theme.mech} style={{width: 560, padding: '22px 30px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.mech}}>
            {'通知含答案'}
          </div>
          <div style={{marginTop: 14}}>
            <Panel accent={theme.mechDeep} style={{width: 420, padding: '12px 18px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
                {'idle_notification'}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 4}}>
                {'空闲 · '}
                <span style={{color: theme.mech, opacity: answer}}>{'内含最终答案'}</span>
              </div>
            </Panel>
          </div>
        </Panel>
      </div>
      <Footnote delay={4}>{'idle_notification'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3ShiftAutonomy: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-08');
  const bC = w('p3-09', 'p3-15');
  const bD = w('p3-16', 'p3-23');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 派工过载翻转">
        <OverloadFlip atFlip={at('p3-03') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="3-B 班次三拍">
        {/* 与 2-H 自制镜隔多句空窗 → 默认入场；五章接力无空窗 */}
        <ArchifyRecap
          slug="shift-three-beats"
          caption="班次三拍"
          cues={[
            {chapterId: 'three-beats', at: at('p3-04') - bB.from, durationInFrames: dur('p3-04')},
            {chapterId: 'work-cap', at: at('p3-05') - bB.from, durationInFrames: dur('p3-05')},
            {chapterId: 'idle-order', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {chapterId: 'instruction-first', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
            {chapterId: 'timeout-leave', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 认领循环">
        {/* 与 3-B 末图跨实例背靠背（含镜界）→ 关入场；五章接力 */}
        <ArchifyRecap
          slug="idle-claim-loop"
          caption="认领循环"
          lead={false}
          cues={[
            {chapterId: 'three-conditions', at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')},
            {chapterId: 'conj-check', at: at('p3-10') - bC.from, durationInFrames: dur('p3-10')},
            {chapterId: 'deps-read', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')},
            {chapterId: 'blocked-only', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')},
            {chapterId: 'verify-receipt', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13')},
          ]}
        />
        <Sequence from={at('p3-14') - bC.from} name="3-C 金句卡">
          <QuoteCard zh="失败不当成功" />
        </Sequence>
        {/* 五章末隔一句空窗重现 → 默认入场 */}
        <ArchifyRecap
          slug="idle-claim-loop"
          caption="认领循环"
          cues={[
            {chapterId: 'lead-two-jobs', at: at('p3-15') - bC.from, durationInFrames: dur('p3-15')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 教学 vs 产品">
        {/* p3-16..17：双向卡对开 */}
        <Sequence
          from={at('p3-16') - bD.from}
          durationInFrames={Math.max(1, at('p3-18') - at('p3-16'))}
        >
          <DuoCards at={2} />
        </Sequence>
        {/* 3-C 末图后隔多句空窗 → 默认入场 */}
        <ArchifyRecap
          slug="shift-three-beats"
          caption="班次三拍"
          cues={[
            {chapterId: 'no-fixed-timeout', at: at('p3-18') - bD.from, durationInFrames: dur('p3-18')},
          ]}
        />
        {/* p3-19 回落：左卡 deny 高热（急着下班的是教学版） */}
        <Sequence
          from={at('p3-19') - bD.from}
          durationInFrames={Math.max(1, at('p3-20') - at('p3-19'))}
        >
          <DuoCards at={2} teachHot={1} />
        </Sequence>
        {/* p3-20 原地复活装置 */}
        <Sequence
          from={at('p3-20') - bD.from}
          durationInFrames={Math.max(1, at('p3-21') - at('p3-20'))}
        >
          <ReviveSeat atMsg={10} />
        </Sequence>
        {/* p3-21 两数法对照卡 */}
        <Sequence
          from={at('p3-21') - bD.from}
          durationInFrames={Math.max(1, at('p3-22') - at('p3-21'))}
        >
          <TwoCounts />
        </Sequence>
        {/* 前章隔三句空窗重现 → 默认入场 */}
        <ArchifyRecap
          slug="shift-three-beats"
          caption="班次三拍"
          cues={[
            {chapterId: 'done-two-ways', at: at('p3-22') - bD.from, durationInFrames: dur('p3-22')},
          ]}
        />
        <Sequence from={at('p3-23') - bD.from} name="3-D 尾句小卡">
          {/* caption-dup-ok: 3-D 尾句记忆点小卡，刻意定格（storyboard 3-D 注记） */}
          <QuoteCard zh="一件事 · 一次说清" />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3ShiftAutonomy;
