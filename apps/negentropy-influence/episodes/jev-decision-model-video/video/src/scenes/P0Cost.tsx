/** P0 判断之贵（p0-01..30）——小判断塞满流水线 → 大模型写议论文才盖章 → 慢贵难解析
 *  → 口头把握不可信 → 错配病根 → Jev 登场 → 分拣中心总览。主色 slot 金。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {EvidenceBadge, Stage} from '../components/devices';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 格口墙母题〔M-001〕：slot 琥珀金恒定描边（2.5px）+ 同形格阵，全片锚。 */
const SlotWall: React.FC<{
  cols: number;
  rows: number;
  width: number;
  height: number;
  labels?: string[];
  lit?: number;
  hot?: {index: number; glow: number};
}> = ({cols, rows, width, height, labels = [], lit = 1, hot}) => (
  <div style={{position: 'relative', width, height, opacity: lit}}>
    {Array.from({length: cols * rows}, (_, i) => i).map((i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const isHot = hot !== undefined && i === hot.index;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (c * width) / cols,
            top: (r * height) / rows,
            width: width / cols - 6,
            height: height / rows - 6,
            borderRadius: 9,
            border: `2.5px solid ${theme.slot}`,
            background: `${theme.slot}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.slot,
          }}
        >
          {labels[i] ?? ''}
          {isHot ? (
            <div
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: 9,
                border: `3px solid ${theme.danger}`,
                background: `${theme.danger}30`,
                opacity: hot.glow,
              }}
            />
          ) : null}
        </div>
      );
    })}
  </div>
);

/** 0-A 任务流水线上的判断节点阵：节点错峰亮起后持续眨眼（眨眼为纯函数相位）。 */
const JudgeNodes: React.FC<{at: number; pair1At: number; pair2At: number}> = ({at, pair1At, pair2At}) => {
  const frame = useCurrentFrame();
  const st = useStagger(14, {at, dur: DUR.f3, stride: 2});
  const kinds = ['工单归组', '动作放行', '输出及格', '候选排序'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36}}>
      <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text}}>
        每个 Agent 系统里，都塞满了各种小判断
      </div>
      <div style={{position: 'relative', width: 1460, height: 200}}>
        <div
          style={{
            position: 'absolute',
            left: 70,
            right: 70,
            top: 33,
            height: 3,
            background: theme.panelBorder,
            borderRadius: 2,
          }}
        />
        {st.map((lit, i) => {
          const x = 100 + i * 94;
          const labeled = i % 4 === 0 && i < 13;
          const kindIdx = i / 4;
          const blink = 0.6 + 0.4 * Math.sin(frame / 6.5 + i * 1.9);
          const chipP =
            kindIdx < 2
              ? progress(frame, pair1At + kindIdx * 9, DUR.f4)
              : progress(frame, pair2At + (kindIdx - 2) * 9, DUR.f4);
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  position: 'absolute',
                  left: x,
                  top: 20,
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  border: `2.5px solid ${labeled ? theme.slot : theme.dim}`,
                  background: labeled ? `${theme.slot}30` : theme.panel,
                  opacity: lit * (labeled ? Math.max(0.55, blink) : blink),
                }}
              />
              {labeled ? (
                <div
                  style={{
                    position: 'absolute',
                    left: x + 13 - 95,
                    top: 62,
                    width: 190,
                    opacity: chipP,
                    transform: `translateY(${(1 - chipP) * 12}px)`,
                  }}
                >
                  <div style={{width: 2, height: 16, background: `${theme.slot}88`, margin: '0 auto'}} />
                  <div
                    style={{
                      marginTop: 4,
                      padding: '10px 0',
                      borderRadius: 9,
                      textAlign: 'center',
                      border: `2px solid ${theme.slot}66`,
                      background: `${theme.slot}14`,
                      fontFamily: theme.sans,
                      fontSize: 24,
                      color: theme.text,
                    }}
                  >
                    {kinds[kindIdx]}
                  </div>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>
        {'每个节点 = 一次小判断 · 今天大多整包交给大模型'}
      </div>
    </div>
  );
};

/** 0-B 议论文堆纸：大模型每答一问，先写一叠议论文（错峰堆高）。 */
const EssayStack: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(6, {at, dur: DUR.f4, stride: 10});
  return (
    <div style={{position: 'relative', width: 620, height: 330}}>
      {st.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: i * 14,
            bottom: i * 34,
            width: 560 - i * 10,
            opacity: p,
            transform: `translateY(${(1 - p) * 18}px) rotate(${(i % 2 === 0 ? -1 : 1) * i * 0.5}deg)`,
          }}
        >
          <Panel style={{padding: '13px 17px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{`议论文 · 第 ${i + 1} 页`}</div>
            {[0.92, 0.85, 0.7, 0.88, 0.5].map((w, j) => (
              <div
                key={j}
                style={{height: 7, marginTop: 7, borderRadius: 3, width: `${w * 100}%`, background: theme.panelBorder}}
              />
            ))}
          </Panel>
        </div>
      ))}
    </div>
  );
};

/** 0-B 小章：作家终于落章（impulse 压印，留下金色印痕）。 */
const SealStamp: React.FC<{at: number}> = ({at}) => {
  const press = useImpulse({at, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const mark = progress(frame, at + 4, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      <div style={{position: 'relative', width: 150, height: 150}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 18,
            border: `3px solid ${theme.slot}`,
            background: `${theme.slot}1A`,
            fontFamily: theme.serif,
            fontSize: 58,
            color: theme.slot,
            transform: `translateY(${-press * 24}px) scale(${1 - press * 0.12})`,
          }}
        >
          章
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 16,
            borderRadius: 12,
            border: `2.5px dashed ${theme.slot}AA`,
            opacity: mark,
            transform: `scale(${0.8 + mark * 0.2})`,
          }}
        />
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.slot, opacity: mark}}>
        {'想要的只是这一下'}
      </div>
    </div>
  );
};

/** 0-C 沙漏：静态翻转帧（句边界翻 180°，不动画沙流）。 */
const Hourglass: React.FC<{at: number; flipAt: number}> = ({at, flipAt}) => {
  const frame = useCurrentFrame();
  const shown = progress(frame, at, DUR.f3);
  const flip = progress(frame, flipAt, DUR.f2) >= 0.5 ? 180 : 0;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: shown}}>
      <svg width={150} height={184} viewBox="0 0 150 184" style={{transform: `rotate(${flip}deg)`}}>
        <path d="M30 16 L120 16 L120 42 Q120 76 75 90 Q30 76 30 42 Z" fill={`${theme.dim}2E`} stroke={theme.dim} strokeWidth={2.5} />
        <path d="M30 168 L120 168 L120 142 Q120 108 75 94 Q30 108 30 142 Z" fill={`${theme.dim}40`} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={22} y1={16} x2={128} y2={16} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
        <line x1={22} y1={168} x2={128} y2={168} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
      </svg>
      <div
        style={{
          padding: '6px 16px',
          borderRadius: 8,
          border: `2px solid ${theme.dim}88`,
          fontFamily: theme.mono,
          fontSize: 24,
          color: theme.dim,
        }}
      >
        {'3–329s'}
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>慢的判断要等三百多秒</div>
    </div>
  );
};

/** 0-C 账单滚数条：计费按字数走，计数疯涨（useCount）。 */
const TickerBar: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const bill = useCount({from: 0, to: 87.4, at, dur: DUR.f6, ease: 'accelerate'});
  const shown = progress(frame, at, DUR.f3);
  return (
    <Panel style={{width: 640, padding: '20px 26px', opacity: shown}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>本月判断账单（示意）</div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger}}>{'$0.20–10 / MTok'}</div>
      </div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 64,
          color: theme.danger,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {'$ ' + bill.toFixed(2)}
      </div>
      <div style={{height: 10, borderRadius: 5, background: theme.panelBorder, marginTop: 10, overflow: 'hidden'}}>
        <div
          style={{
            height: '100%',
            width: `${progress(frame, at, DUR.f6) * 100}%`,
            background: theme.danger,
            borderRadius: 5,
          }}
        />
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 10}}>
        {'按字数计费 · 判断越勤，账单越吓人'}
      </div>
    </Panel>
  );
};

/** 0-C 自由文字条：输出还要再解析一遍，越界 / 截断 / 格式是家常便饭。 */
const FreeScrap: React.FC<{at: number; chipAt: number}> = ({at, chipAt}) => {
  const frame = useCurrentFrame();
  const n = Math.floor(progress(frame, at, DUR.f6) * 34);
  const chips = ['越界', '截断', '格式对不上'];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: progress(frame, at, DUR.f3)}}>
      <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, whiteSpace: 'pre'}}>
        {'吐出来的是一段自由文字：' + '·'.repeat(Math.max(0, n))}
      </div>
      {chips.map((c, i) => {
        const cp = progress(frame, chipAt + i * 7, DUR.f4);
        return (
          <div
            key={c}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: `2px solid ${theme.danger}88`,
              color: theme.danger,
              fontFamily: theme.sans,
              fontSize: 23,
              opacity: cp,
              transform: `scale(${0.8 + cp * 0.2})`,
            }}
          >
            {c}
          </div>
        );
      })}
    </div>
  );
};

/** 0-C 慢与贵主视图：沙漏 + 账单 + 自由文字条（纯布局层，动效在子装置里）。 */
const SlowCostBoard: React.FC<{
  hourAt: number;
  flipAt: number;
  tickAt: number;
  scrapAt: number;
  chipAt: number;
}> = ({hourAt, flipAt, tickAt, scrapAt, chipAt}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 42}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 76}}>
      <Hourglass at={hourAt} flipAt={flipAt} />
      <TickerBar at={tickAt} />
    </div>
    <FreeScrap at={scrapAt} chipAt={chipAt} />
  </div>
);

/** 0-D 「九成把握」徽章：亮起 → impulse 震裂 → 碎片滑开，露出「训练讨好」。 */
const BadgeCrack: React.FC<{at: number; crackAt: number; tagAt: number; lineAt: number}> = ({
  at,
  crackAt,
  tagAt,
  lineAt,
}) => {
  const frame = useCurrentFrame();
  const jolt = useImpulse({at: crackAt, dur: DUR.f4, peak: 1});
  const lit = progress(frame, at, DUR.f5);
  const crackP = progress(frame, crackAt, DUR.f4);
  const tagP = progress(frame, tagAt, DUR.f4);
  const lineP = progress(frame, lineAt, DUR.f4);
  const wedges = [
    'M120 120 L120 10 A110 110 0 0 1 215.3 65 Z',
    'M120 120 L215.3 65 A110 110 0 0 1 215.3 175 Z',
    'M120 120 L215.3 175 A110 110 0 0 1 120 230 Z',
    'M120 120 L120 230 A110 110 0 0 1 24.7 175 Z',
    'M120 120 L24.7 175 A110 110 0 0 1 24.7 65 Z',
    'M120 120 L24.7 65 A110 110 0 0 1 120 10 Z',
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
      <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text, opacity: lit}}>
        最麻烦的是：它嘴上的把握不可信
      </div>
      <div style={{position: 'relative', width: 360, height: 300, opacity: lit}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              padding: '18px 26px',
              borderRadius: 12,
              border: `2.5px dashed ${theme.danger}AA`,
              background: `${theme.danger}14`,
              fontFamily: theme.sans,
              fontSize: 25,
              color: theme.danger,
              textAlign: 'center',
              opacity: tagP,
              maxWidth: 300,
              lineHeight: 1.5,
            }}
          >
            为讨好人类做的训练
            <div style={{fontSize: 21, marginTop: 4}}>把诚实的犹豫磨平了</div>
          </div>
        </div>
        <svg
          width={300}
          height={300}
          viewBox="0 0 240 240"
          style={{position: 'absolute', left: 30, top: 0, opacity: 1 - crackP * 0.55}}
        >
          {wedges.map((d, k) => {
            const ang = ((k * 60 - 90) * Math.PI) / 180;
            const dist = crackP * 34 + jolt * 7;
            return (
              <g
                key={k}
                transform={`translate(${Math.cos(ang) * dist} ${Math.sin(ang) * dist}) rotate(${
                  (k % 2 === 0 ? 1 : -1) * crackP * 9
                } 120 120)`}
              >
                <path d={d} fill={`${theme.calib}30`} stroke={theme.calib} strokeWidth={2.5} />
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 0,
            width: 300,
            height: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 1 - crackP,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 62, color: theme.calib}}>90%</div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 4}}>九成把握</div>
        </div>
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 29, color: theme.dim, opacity: lineP}}>
        嘴上说九成把握，未必真能十次对九次
      </div>
    </div>
  );
};

/** 0-E 左：答案本来就只有几个选项（slot 短清单，错峰亮起）。 */
const ShortList: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(5, {at, dur: DUR.f3, stride: 8});
  const groups = [
    {q: '这张工单该归哪个组？', opts: ['退款组', '账务组', '技术组']},
    {q: '这个动作放不放行？', opts: ['放行', '拦下']},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
      {groups.map((g, gi) => (
        <div key={g.q}>
          <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, marginBottom: 10}}>{g.q}</div>
          <div style={{display: 'flex', gap: 14}}>
            {g.opts.map((o, oi) => {
              const p = st[gi * 3 + oi];
              return (
                <div
                  key={o}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 10,
                    border: `2.5px solid ${theme.slot}`,
                    background: `${theme.slot}16`,
                    fontFamily: theme.sans,
                    fontSize: 25,
                    color: theme.text,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 14}px)`,
                  }}
                >
                  {o}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.slot}}>{'掰着手指头都数得过来'}</div>
    </div>
  );
};

/** 0-E 右：自由文字长卷轴——持续下坠的「无限下拉」（useProgress 线性驱动）。 */
const ScrollDrain: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const p = useProgress(at, dur, 'linear');
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
      <div style={{width: 96, height: 14, borderRadius: 7, background: theme.panelBorder}} />
      <div
        style={{
          width: 400,
          height: 480,
          borderRadius: 12,
          border: `2.5px solid ${theme.panelBorder}`,
          background: theme.panel,
          overflow: 'hidden',
          padding: '18px 24px',
        }}
      >
        <div style={{transform: `translateY(${-p * 460}px)`}}>
          {Array.from({length: 50}, (_, i) => (
            <div
              key={i}
              style={{
                height: 8,
                marginTop: 12,
                borderRadius: 4,
                width: 120 + ((i * 53) % 220),
                background: i % 5 === 4 ? `${theme.dim}55` : theme.panelBorder,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
        {'一个词一个词往外吐 · 程序还得再解析一遍'}
      </div>
    </div>
  );
};

/** 0-E 错配主视图：几个选项 vs 一篇长文（左短清单 · 右卷轴）。 */
const MismatchBoard: React.FC<{at: number; listAt: number; scrollAt: number; scrollDur: number}> = ({
  at,
  listAt,
  scrollAt,
  scrollDur,
}) => {
  const frame = useCurrentFrame();
  const word = progress(frame, at, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
      <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.danger, opacity: word, letterSpacing: 5}}>
        病根就一个词：错配
      </div>
      <div style={{display: 'flex', gap: 80, alignItems: 'center'}}>
        <ShortList at={listAt} />
        <div style={{fontFamily: theme.serif, fontSize: 54, color: theme.dim}}>{'≠'}</div>
        <ScrollDrain at={scrollAt} dur={scrollDur} />
      </div>
    </div>
  );
};

/** 0-F Jev 名片卡：弹簧升起（产品名 / 系统一模型 / 快系统注记）。 */
const NameCard: React.FC<{at: number; noteAt: number}> = ({at, noteAt}) => {
  const rise = useSpring('settle', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const note = progress(frame, noteAt, DUR.f4);
  return (
    <div style={{opacity: show, transform: `translateY(${(1 - rise) * 44}px)`}}>
      <Panel accent={theme.slot} style={{width: 600, padding: '22px 32px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'TypeSafe · 2026-09'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.slot}}>{'新东西'}</div>
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 74, color: theme.slot, marginTop: 4}}>Jev</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text, marginTop: 2}}>
          官方管这类模型叫「系统一模型」
        </div>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
            marginTop: 12,
            opacity: note,
            lineHeight: 1.6,
          }}
        >
          名字取自心理学的快系统（卡尼曼）：不深思熟虑，扫一眼就拍板
        </div>
      </Panel>
    </div>
  );
};

/** 0-F 「一次前向、逐项打分」公式条：选项得分随进度自左向右逐项点亮。 */
const ScoreSweep: React.FC<{at: number; dur: number; lineAt: number}> = ({at, dur, lineAt}) => {
  const p = useProgress(at, dur);
  const frame = useCurrentFrame();
  const line = progress(frame, lineAt, DUR.f4);
  const opts = [
    {label: '选项 A', conf: 0.62},
    {label: '选项 B', conf: 0.21},
    {label: '选项 C', conf: 0.11},
    {label: '选项 D', conf: 0.06},
  ];
  const seg = 1 / opts.length;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.pass}}>
        {'程序先把答案写死 → 一遍跑完 → 逐项打分'}
      </div>
      <div style={{display: 'flex', gap: 16}}>
        {opts.map((o, i) => {
          const local = Math.max(0, Math.min(1, (p - i * seg * 0.9) / (seg * 2)));
          return (
            <div
              key={o.label}
              style={{
                width: 190,
                padding: '12px 14px',
                borderRadius: 10,
                border: `2px solid ${local >= 1 ? theme.slot : theme.panelBorder}`,
                background: theme.panel,
                opacity: 0.35 + 0.65 * local,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.text}}>{o.label}</div>
              <div
                style={{
                  height: 9,
                  borderRadius: 4,
                  background: theme.panelBorder,
                  marginTop: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${o.conf * 100 * local}%`,
                    background: theme.slot,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.slot, marginTop: 6, opacity: local}}>
                {o.conf.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 29, color: theme.text, opacity: line}}>
        {'不是更聪明 —— 是把判断变成程序能直接用的函数调用'}
      </div>
    </div>
  );
};

/** 0-G 分拣中心总览灯板：七区灯随句错峰点亮（格口墙走 M-001 恒定描边）。 */
const TourBoard: React.FC<{at: number; total: number}> = ({at, total}) => {
  const frame = useCurrentFrame();
  const st = useStagger(7, {at, dur: DUR.f4, fit: {total: Math.max(90, total - at)}});
  const zone = (i: number): React.CSSProperties => ({
    opacity: st[i],
    transform: `translateY(${(1 - st[i]) * 14}px)`,
  });
  const lamp = (c: string, i: number): React.CSSProperties => ({
    width: 11,
    height: 11,
    borderRadius: 6,
    background: c,
    boxShadow: `0 0 ${16 * st[i]}px ${c}`,
  });
  return (
    <div
      style={{
        position: 'relative',
        width: 1520,
        height: 600,
        borderRadius: 18,
        border: `2px solid ${theme.panelBorder}`,
        background: `${theme.panel}55`,
      }}
    >
      {/* 区 1 · 调度员台 */}
      <div style={{position: 'absolute', left: 34, top: 28, width: 400, ...zone(1)}}>
        <Panel style={{padding: '13px 17px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={lamp(theme.dim, 1)} />
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{'调度员台 · 大模型'}</div>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 7}}>
            {'会规划线路 · 会写说明 · 慢而贵'}
          </div>
        </Panel>
      </div>
      {/* 区 4 · 面单堆 */}
      <div style={{position: 'absolute', left: 34, top: 208, width: 400, ...zone(4)}}>
        <Panel style={{padding: '13px 17px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={lamp(theme.text, 4)} />
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>面单堆</div>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 7}}>
            {'手写地址也看得懂 · 不是扫码机'}
          </div>
        </Panel>
      </div>
      {/* 区 2 · 老分拣员位 */}
      <div style={{position: 'absolute', left: 500, top: 56, width: 430, ...zone(2)}}>
        <Panel accent={theme.slot} style={{padding: '15px 19px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={lamp(theme.slot, 2)} />
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.slot}}>{'老分拣员 · Jev'}</div>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8}}>
            {'扫一眼面单 · 同时填好几张分拣小票'}
          </div>
        </Panel>
      </div>
      {/* 区 3 · 小票排 */}
      <div style={{position: 'absolute', left: 500, top: 208, width: 430, ...zone(3)}}>
        <div style={{display: 'flex', gap: 12}}>
          {['是非小票', '选格口小票', '打等级小票'].map((t) => (
            <div
              key={t}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 9,
                textAlign: 'center',
                border: `2px solid ${theme.pass}88`,
                background: `${theme.pass}14`,
                fontFamily: theme.sans,
                fontSize: 20,
                color: theme.text,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 8, textAlign: 'center'}}>
          {'各答各的 · 互不相看'}
        </div>
      </div>
      {/* 区 5 · 格口墙（M-001 恒定锚） */}
      <div style={{position: 'absolute', left: 1010, top: 40, ...zone(5)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10}}>
          <div style={lamp(theme.slot, 5)} />
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.slot}}>格口墙</div>
        </div>
        <SlotWall cols={3} rows={3} width={450} height={330} />
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 8}}>
          {'只能往挂牌的格口里投'}
        </div>
      </div>
      {/* 区 6 · 三条去向传送带 */}
      <div style={{position: 'absolute', left: 34, bottom: 26, width: 1450, ...zone(6)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={lamp(theme.route, 6)} />
            <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.route}}>三条去向</div>
          </div>
          {[0, 1, 2].map((k) => (
            <svg key={k} width={330} height={26} viewBox="0 0 330 26">
              <line x1={4} y1={13} x2={306} y2={13} stroke={theme.route} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
              <polygon points={'306,6 322,13 306,20'} fill={theme.route} opacity={0.9} />
              <circle cx={20 + ((frame / 1.6 + k * 90) % 270)} cy={13} r={5} fill={theme.route} />
            </svg>
          ))}
        </div>
      </div>
    </div>
  );
};

export const P0Cost: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-10');
  const bD = w('p0-11', 'p0-13');
  const bE = w('p0-14', 'p0-17');
  const bF = w('p0-18', 'p0-23');
  const bG = w('p0-24', 'p0-30');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 小判断清单">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <Stage>
          <JudgeNodes at={at('p0-01') - bA.from} pair1At={at('p0-02') - bA.from} pair2At={at('p0-03') - bA.from} />
        </Stage>
      </Sequence>

      <Sequence {...bB} name="0-B 让作家盖章">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <Stage>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
            <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>
              这些判断，今天大多交给大模型
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 56}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
                <div style={{fontSize: 84}}>{'✍️'}</div>
                <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>{'大模型 · 为写长文章而生'}</div>
                <EssayStack at={at('p0-04') - bB.from} />
              </div>
              <SealStamp at={at('p0-06') - bB.from} />
            </div>
          </div>
        </Stage>
      </Sequence>

      <Sequence {...bC} name="0-C 慢与贵">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <EvidenceBadge text={'官方博客对照'} at={at('p0-08') - bC.from} />
        <ArchifyYield cues={[{at: at('p0-07') - bC.from, durationInFrames: dur('p0-07')}]}>
          <SlowCostBoard
            hourAt={at('p0-07') - bC.from}
            flipAt={at('p0-08') - bC.from}
            tickAt={at('p0-08') - bC.from}
            scrapAt={at('p0-09') - bC.from}
            chipAt={at('p0-10') - bC.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="sorting-center"
          caption="四宗罪：慢、贵、要解析、口头概率"
          cues={[{chapterId: 'sc-four-sins', at: at('p0-07') - bC.from, durationInFrames: dur('p0-07')}]}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 口头概率不可信">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <Stage>
          <BadgeCrack
            at={at('p0-11') - bD.from}
            crackAt={at('p0-12') - bD.from}
            tagAt={at('p0-12') - bD.from + 8}
            lineAt={at('p0-13') - bD.from}
          />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="0-E 错配">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p0-15') - bE.from, durationInFrames: dur('p0-15')}]}>
          <MismatchBoard
            at={at('p0-14') - bE.from}
            listAt={at('p0-16') - bE.from}
            scrollAt={at('p0-17') - bE.from}
            scrollDur={dur('p0-17')}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="sorting-center"
          caption="分拣中心 · 病根是错配"
          cues={[{chapterId: 'sc-mismatch', at: at('p0-15') - bE.from, durationInFrames: dur('p0-15')}]}
        />
      </Sequence>

      <Sequence {...bF} name="0-F Jev 登场">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p0-21') - bF.from, durationInFrames: dur('p0-21')}]}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28}}>
            <NameCard at={at('p0-18') - bF.from} noteAt={at('p0-20') - bF.from} />
            <ScoreSweep
              at={at('p0-22') - bF.from}
              dur={dur('p0-22')}
              lineAt={at('p0-22') - bF.from + Math.round(dur('p0-22') * 0.45)}
            />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="sorting-center"
          caption="分拣中心 · 一次前向逐项打分"
          cues={[{chapterId: 'sc-one-liner', at: at('p0-21') - bF.from, durationInFrames: dur('p0-21')}]}
        />
        <Footnote delay={at('p0-23') - bF.from}>{'便宜到可以随处调用 —— 这集要拆的悬念'}</Footnote>
      </Sequence>

      <Sequence {...bG} name="0-G 分拣中心总览">
        <SceneTag chapter="P0" tagline="判断之贵" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p0-26') - bG.from, durationInFrames: dur('p0-26')}]}>
          <TourBoard at={at('p0-24') - bG.from} total={dur('p0-24', 'p0-30')} />
        </ArchifyYield>
        <ArchifyRecap
          slug="sorting-center"
          caption="分拣中心 · 全景导览"
          cues={[{chapterId: 'sc-tour', at: at('p0-26') - bG.from, durationInFrames: dur('p0-26')}]}
        />
        <Footnote delay={at('p0-30') - bG.from}>
          {'格口怎么挂 · 面单怎么扫 · 把握怎么对账 · 账单怎么变便宜'}
        </Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
