/** P1 挂牌格口（p1-01..28）——接口解剖 → 三题型 → 答案空间先定 → 零幻觉的真相
 *  → 冷数据 → 陷阱面单 → B2 拆闭合。主色 slot 金 + danger。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {EvidenceBadge, Stage, StatRing, TerminalFeed} from '../components/devices';
import {Footnote, NumberedCard, Panel, SceneTag} from '../components/motifs';
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

/** 1-A 请求卡展开（useSpring 升起）：状态底单 + 三张问题卡，key 不发给模型。 */
const RequestUnfold: React.FC<{at: number; qAt: number; typeAt: number}> = ({at, qAt, typeAt}) => {
  const open = useSpring('settle', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const questions = [
    {key: 'is_refund', kind: '是非'},
    {key: 'route_slot', kind: '选择'},
    {key: 'severity', kind: '打分'},
  ];
  return (
    <div style={{position: 'relative', opacity: show, transform: `translateY(${(1 - open) * 46}px)`}}>
      {/* 背景格口墙 M-001 恒定锚 */}
      <div
        style={{
          position: 'absolute',
          inset: -50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.13,
        }}
      >
        <SlotWall cols={9} rows={3} width={1300} height={360} />
      </div>
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
        <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.slot}}>{'request = 状态底单 + 问题[]'}</div>
        <Panel style={{width: 980, padding: '20px 26px'}}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'状态底单 · state'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.text, marginTop: 6}}>
              {'工单 #4172 · 主题：登录页报错 · 近 3 次联系记录 ……'}
            </div>
          </div>
          <div style={{display: 'flex', gap: 16, marginTop: 16, perspective: 900}}>
            {questions.map((q, i) => {
              const p = progress(frame, qAt + i * 7, DUR.f4);
              const kindP = progress(frame, typeAt + i * 5, DUR.f3);
              return (
                <div
                  key={q.key}
                  style={{
                    flex: 1,
                    opacity: p,
                    transform: `rotateX(${(1 - p) * -62}deg) translateY(${(1 - p) * 16}px)`,
                  }}
                >
                  <Panel accent={theme.slot} style={{padding: '12px 14px'}}>
                    <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.text}}>
                      {`问题 ${i + 1} · key: ${q.key}`}
                    </div>
                    <div style={{display: 'flex', gap: 8, marginTop: 9, alignItems: 'center', flexWrap: 'wrap'}}>
                      <div
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: `1.5px solid ${theme.slot}99`,
                          color: theme.slot,
                          fontFamily: theme.mono,
                          fontSize: 16,
                          opacity: kindP,
                        }}
                      >
                        {q.kind}
                      </div>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: `1.5px dashed ${theme.panelBorder}`,
                          color: theme.dim,
                          fontFamily: theme.mono,
                          fontSize: 14,
                          opacity: kindP,
                        }}
                      >
                        {'key · 不发给模型'}
                      </div>
                    </div>
                  </Panel>
                </div>
              );
            })}
          </div>
        </Panel>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>递进去一段状态，再附上几张问题</div>
      </div>
    </div>
  );
};

/** 1-B 打分小票的 2–10 级刻度（useDraw 描线）+ 级间落点。 */
const GradeScale: React.FC<{at: number; markAt: number}> = ({at, markAt}) => {
  const draw = useDraw(at, DUR.f5);
  const frame = useCurrentFrame();
  const mark = progress(frame, markAt, DUR.f4);
  const levels = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div style={{marginTop: 18}}>
      <svg width={310} height={80} viewBox="0 0 310 80">
        <path d="M16 44 L294 44" stroke={theme.slot} strokeWidth={2.5} fill="none" {...draw} />
        {levels.map((lv, i) => (
          <path
            key={lv}
            d={`M${36 + i * 30} 37 L${36 + i * 30} 51`}
            stroke={theme.slot}
            strokeWidth={2}
            fill="none"
            {...draw}
          />
        ))}
        {levels.map((lv, i) => (
          <text key={lv} x={31 + i * 30} y={70} fill={theme.dim} fontSize={14} fontFamily={theme.mono}>
            {lv}
          </text>
        ))}
        <circle cx={36 + 4 * 30 + 13} cy={44} r={8} fill={theme.danger} opacity={mark} />
        <text x={36 + 4 * 30 - 8} y={20} fill={theme.danger} fontSize={15} fontFamily={theme.mono} opacity={mark}>
          {'≈ 6.4'}
        </text>
      </svg>
      <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.danger, marginTop: 2, opacity: mark}}>
        {'概率加权 · 落在两级中间'}
      </div>
    </div>
  );
};

/** 1-B 三张题型样板小票：依次翻面入场（useStagger），本句小票高亮。 */
const TicketRack: React.FC<{at: number; t2At: number; t3At: number; scaleAt: number; markAt: number}> = ({
  at,
  t2At,
  t3At,
  scaleAt,
  markAt,
}) => {
  const frame = useCurrentFrame();
  const st = useStagger(3, {at, dur: DUR.f4, fit: {total: Math.max(30, t2At - at)}});
  const activeIdx = frame >= t3At ? 2 : frame >= t2At ? 1 : 0;
  const tagStyle: React.CSSProperties = {
    padding: '3px 10px',
    borderRadius: 6,
    border: `1.5px solid ${theme.slot}99`,
    color: theme.slot,
    fontFamily: theme.mono,
    fontSize: 15,
  };
  return (
    <div style={{display: 'flex', gap: 30, perspective: 1100}}>
      {/* 小票一 · 是非 noul */}
      <div style={{width: 360, opacity: st[0], transform: `rotateY(${(1 - st[0]) * -70}deg)`}}>
        <Panel accent={activeIdx === 0 ? theme.slot : theme.panelBorder} style={{padding: '16px 20px', minHeight: 330}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>是非小票</div>
            <div style={tagStyle}>{'noul'}</div>
          </div>
          <div style={{display: 'flex', gap: 14, marginTop: 18}}>
            {['是', '否'].map((o) => (
              <div
                key={o}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  textAlign: 'center',
                  borderRadius: 9,
                  border: `2px solid ${theme.slot}`,
                  background: `${theme.slot}14`,
                  fontFamily: theme.serif,
                  fontSize: 30,
                  color: theme.text,
                }}
              >
                {o}
              </div>
            ))}
          </div>
          <div style={{marginTop: 28}}>
            <div style={{height: 10, borderRadius: 5, background: theme.panelBorder, position: 'relative'}}>
              <div style={{position: 'absolute', left: '82%', top: -5, width: 4, height: 20, borderRadius: 2, background: theme.calib}} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.dim,
                marginTop: 8,
              }}
            >
              <span>0</span>
              <span>1</span>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 10}}>
              答一个 0 到 1 之间的数
            </div>
          </div>
        </Panel>
      </div>
      {/* 小票二 · 选择 choice */}
      <div style={{width: 360, opacity: st[1], transform: `rotateY(${(1 - st[1]) * -70}deg)`}}>
        <Panel accent={activeIdx === 1 ? theme.slot : theme.panelBorder} style={{padding: '16px 20px', minHeight: 330}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>选择小票</div>
            <div style={tagStyle}>{'choice'}</div>
          </div>
          <div style={{marginTop: 16, display: 'flex', flexDirection: 'column', gap: 13}}>
            {[
              {o: '选项一', w: 0.78},
              {o: '选项二', w: 0.34},
              {o: '选项三', w: 0.22},
              {o: '选项四', w: 0.12},
            ].map((r) => (
              <div key={r.o}>
                <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.text}}>{r.o}</div>
                <div style={{height: 8, borderRadius: 4, background: theme.panelBorder, marginTop: 5}}>
                  <div style={{height: '100%', width: `${r.w * 100}%`, background: theme.slot, borderRadius: 4}} />
                </div>
              </div>
            ))}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, marginTop: 12}}>
            {'选项你来定 · 最多 255 个 · 每项都打分'}
          </div>
        </Panel>
      </div>
      {/* 小票三 · 打分 score */}
      <div style={{width: 360, opacity: st[2], transform: `rotateY(${(1 - st[2]) * -70}deg)`}}>
        <Panel accent={activeIdx === 2 ? theme.slot : theme.panelBorder} style={{padding: '16px 20px', minHeight: 330}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>打分小票</div>
            <div style={tagStyle}>{'score'}</div>
          </div>
          <GradeScale at={scaleAt} markAt={markAt} />
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 14}}>
            {'2 到 10 级 · 返回一个概率加权的分数'}
          </div>
        </Panel>
      </div>
    </div>
  );
};

/** 1-C 「另写答案」闸门：落闩焊死（useImpulse 震入）——闭合输出通道。 */
const WeldedGate: React.FC<{stampAt: number; slamAt: number}> = ({stampAt, slamAt}) => {
  const slam = useImpulse({at: slamAt, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const stamp = progress(frame, stampAt, DUR.f4);
  const welded = progress(frame, slamAt, DUR.f5);
  const drop = welded * 24 + slam * 6;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 44}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
          <SlotWall cols={1} rows={3} width={310} height={190} labels={['退款', '账务', '技术']} lit={stamp} />
          <div
            style={{
              padding: '7px 20px',
              borderRadius: 8,
              border: `2.5px solid ${theme.ok}`,
              color: theme.ok,
              fontFamily: theme.mono,
              fontSize: 20,
              transform: `rotate(-5deg) scale(${0.7 + stamp * 0.3})`,
              opacity: stamp,
            }}
          >
            {'选项表 · 调用方写死'}
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
          <svg width={430} height={130} viewBox="0 0 430 130">
            <text x={16} y={36} fill={theme.dim} fontSize={16} fontFamily={theme.mono}>
              {'模型输出'}
            </text>
            <text x={372} y={36} fill={theme.dim} fontSize={16} fontFamily={theme.mono}>
              {'答案'}
            </text>
            <line x1={14} y1={70} x2={168} y2={70} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
            <line x1={262} y1={70} x2={416} y2={70} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
            <g transform={`translate(0 ${drop})`}>
              <rect x={196} y={18} width={38} height={40} rx={5} fill={`${theme.danger}2E`} stroke={theme.danger} strokeWidth={3} />
              <rect x={186} y={8} width={58} height={11} rx={4} fill={theme.panelBorder} />
            </g>
            {[0, 1, 2].map((k) => (
              <circle
                key={k}
                cx={215}
                cy={52 + k * 12}
                r={4.5}
                fill={theme.ok}
                opacity={welded * (0.55 + 0.45 * ((k + 1) % 2))}
              />
            ))}
          </svg>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <div
              style={{
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.danger,
                opacity: welded,
                textDecoration: 'line-through',
              }}
            >
              {'「另写一个答案」通道'}
            </div>
            <div
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                border: `2px solid ${theme.ok}99`,
                color: theme.ok,
                fontFamily: theme.mono,
                fontSize: 19,
                opacity: welded,
              }}
            >
              焊死
            </div>
          </div>
        </div>
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.text, opacity: welded}}>
        模型没有「另写一个答案」这个输出通道
      </div>
    </div>
  );
};

/** 1-D 双卡对开（useProgress）：零类型错误 = 构造保证 vs 合法不等于正确。 */
const TruthPair: React.FC<{topAt: number; subAt: number; botAt: number}> = ({topAt, subAt, botAt}) => {
  const top = useProgress(topAt, DUR.f5);
  const bot = useProgress(botAt, DUR.f5);
  const frame = useCurrentFrame();
  const sub = progress(frame, subAt, DUR.f4);
  return (
    <div style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center'}}>
      {/* 背景格口墙 M-001（恒定锚） */}
      <div
        style={{
          position: 'absolute',
          inset: -44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.14,
        }}
      >
        <SlotWall cols={8} rows={3} width={1240} height={330} />
      </div>
      <Panel
        accent={theme.slot}
        style={{
          width: 880,
          padding: '20px 28px',
          opacity: top,
          transform: `translateX(${(1 - top) * -60}px)`,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.slot}}>{'零幻觉 · 零类型错误'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'官方宣传'}</div>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, marginTop: 10, opacity: sub}}>
          {'= 构造保证 · 不是测出来的成绩（官方文档原话）'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8, opacity: sub}}>
          {'只能往挂牌的格口里投 → 永远不会投出不存在的格口'}
        </div>
      </Panel>
      <Panel
        accent={theme.danger}
        style={{
          width: 880,
          padding: '18px 28px',
          opacity: bot,
          transform: `translateX(${(1 - bot) * 60}px)`,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 36, color: theme.danger}}>{'合法 ≠ 正确'}</div>
          <SlotWall cols={3} rows={1} width={250} height={54} hot={{index: 1, glow: bot}} />
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, marginTop: 8}}>
          {'照样可能投错格口 —— 完全合法，也可能完全错误'}
        </div>
      </Panel>
    </div>
  );
};

/** 1-E 零概率条：16% 的题，正确选项拿到 0.00（useCount 滚数）。 */
const ZeroBar: React.FC<{at: number}> = ({at}) => {
  const pct = useCount({to: 16, at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const p = progress(frame, at, DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 10, width: 350}}>
      <div style={{fontFamily: theme.mono, fontSize: 54, color: theme.danger}}>{Math.round(pct) + '%'}</div>
      <div
        style={{
          height: 236,
          borderRadius: 10,
          border: `2px solid ${theme.panelBorder}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${16 * p}%`,
            background: `${theme.danger}45`,
            borderTop: `3px solid ${theme.danger}`,
          }}
        />
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.danger}}>{'正确选项 = 0.00 概率'}</div>
      <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'某基准 16% 的题 · 第三方实测'}</div>
    </div>
  );
};

/** 1-E 选项序倒转：两排选项卡 + 交叉翻转线（useDraw 描线），★ 跟着翻面。 */
const FlipArrows: React.FC<{at: number}> = ({at}) => {
  const draw = useDraw(at, DUR.f5);
  const frame = useCurrentFrame();
  const move = progress(frame, at + 10, DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 320}}>
      <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'选项序 ①'}</div>
      <div style={{display: 'flex', gap: 12}}>
        {[
          {t: 'A', star: 1 - move},
          {t: 'B', star: 0},
          {t: 'C', star: 0},
        ].map((c) => (
          <div
            key={c.t}
            style={{
              width: 84,
              height: 56,
              borderRadius: 8,
              border: `2px solid ${c.t === 'A' ? theme.text : theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.text,
              position: 'relative',
            }}
          >
            {c.t}
            {c.star > 0 ? (
              <div style={{position: 'absolute', top: -16, fontSize: 19, opacity: c.star}}>{'★'}</div>
            ) : null}
          </div>
        ))}
      </div>
      <svg width={300} height={52} viewBox="0 0 300 52">
        <path d="M42 4 C 24 24, 120 30, 138 48" stroke={theme.danger} strokeWidth={2.5} fill="none" {...draw} />
        <path d="M138 4 C 120 24, 24 30, 42 48" stroke={theme.danger} strokeWidth={2.5} fill="none" {...draw} />
      </svg>
      <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'选项序 ②（打乱后）'}</div>
      <div style={{display: 'flex', gap: 12}}>
        {[
          {t: 'B', star: 0},
          {t: 'A', star: move},
          {t: 'C', star: 0},
        ].map((c) => (
          <div
            key={c.t}
            style={{
              width: 84,
              height: 56,
              borderRadius: 8,
              border: `2px solid ${c.t === 'B' ? theme.text : theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 24,
              color: theme.text,
              position: 'relative',
            }}
          >
            {c.t}
            {c.star > 0 ? (
              <div style={{position: 'absolute', top: -16, fontSize: 19, opacity: c.star}}>{'★'}</div>
            ) : null}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 10,
          padding: '6px 16px',
          borderRadius: 8,
          border: `2px solid ${theme.danger}99`,
          color: theme.danger,
          fontFamily: theme.sans,
          fontSize: 21,
        }}
      >
        {'13% 的答案跟着翻面 · 第三方实测'}
      </div>
    </div>
  );
};

/** 1-E 冷数据面板：67.8% 环（devices StatRing）+ 两条第三方冷数据。 */
const ColdBoard: React.FC<{
  ringAt: number;
  wrongAt: number;
  coldAt: number;
  zeroAt: number;
  flipAt: number;
  linkAt: number;
}> = ({ringAt, wrongAt, coldAt, zeroAt, flipAt, linkAt}) => {
  const frame = useCurrentFrame();
  const wrong = progress(frame, wrongAt, DUR.f4);
  const cold = progress(frame, coldAt, DUR.f3);
  const zero = progress(frame, zeroAt, DUR.f3);
  const flip = progress(frame, flipAt, DUR.f3);
  const link = progress(frame, linkAt, DUR.f4);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32}}>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 54}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <StatRing value={0.678} at={ringAt} label="评测准确率 · 官方自报" color={theme.calib} size={225} />
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'67.8% · 9 个模型里排第 4'}</div>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: `2px solid ${theme.danger}99`,
              color: theme.danger,
              fontFamily: theme.sans,
              fontSize: 21,
              opacity: wrong,
            }}
          >
            {'≈ 1/3 在合法选项里挑错'}
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: cold}}>
            {'第三方实测 · 两条冷数据'}
          </div>
          <div style={{display: 'flex', gap: 36, alignItems: 'flex-start'}}>
            <div style={{opacity: zero}}>
              <ZeroBar at={zeroAt} />
            </div>
            <div style={{opacity: flip}}>
              <FlipArrows at={flipAt} />
            </div>
          </div>
        </div>
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 29, color: theme.calib, opacity: link}}>
        {'打分不是每个选项各算各的 —— 选项之间会互相影响'}
      </div>
    </div>
  );
};

/** 1-F 面单特写：手写备注逐字流出，「退款」关键词高亮（useImpulse 脉冲）。 */
const WAYBILL_TEXT = '这不是退款和账单的问题，是登录页坏了。';
const WaybillCloseup: React.FC<{at: number; typeAt: number; typeDur: number; hotAt: number}> = ({
  at,
  typeAt,
  typeDur,
  hotAt,
}) => {
  const hot = useImpulse({at: hotAt, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const shown = progress(frame, at, DUR.f4);
  const n = Math.floor(progress(frame, typeAt, typeDur) * WAYBILL_TEXT.length);
  const conf = progress(frame, hotAt, DUR.f3);
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12, opacity: shown}}>
      <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'工单 #4172 · 手写备注'}</div>
      <Panel accent={theme.panelBorder} style={{width: 620, padding: '24px 28px'}}>
        <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text, lineHeight: 1.75}}>
          {WAYBILL_TEXT.split('').map((ch, i) => {
            const isKw = i >= 3 && i < 5;
            return (
              <span
                key={i}
                style={{
                  opacity: i < n ? 1 : 0.08,
                  color: isKw ? theme.danger : theme.text,
                  background: isKw ? `${theme.danger}40` : 'transparent',
                  borderRadius: 5,
                  padding: isKw ? '2px 4px' : 0,
                  display: 'inline-block',
                  transform: isKw ? `scale(${1 + hot * 0.25})` : 'none',
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </Panel>
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <div
          style={{
            padding: '6px 16px',
            borderRadius: 8,
            border: `2px solid ${theme.calib}99`,
            color: theme.calib,
            fontFamily: theme.mono,
            fontSize: 20,
            opacity: conf,
          }}
        >
          {'conf 1.00 · 满格把握'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, opacity: conf}}>
          {'→ 投进账务格口'}
        </div>
      </div>
    </div>
  );
};

/** 1-F 满格把握投错格：面单卡沿弹簧轨迹拖入账务格口，格口持续闪红。 */
const WrongDrop: React.FC<{at: number; flashAt: number}> = ({at, flashAt}) => {
  const drop = useSpring('settle', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f3);
  const flash = frame >= flashAt ? 0.45 + 0.4 * Math.sin((frame - flashAt) / 2.6) : 0;
  const x = 26 + drop * 236;
  const y = 318 - drop * 159;
  return (
    <div style={{position: 'relative', width: 470, height: 400, opacity: show}}>
      <div style={{position: 'absolute', left: 250, top: 26}}>
        <SlotWall
          cols={1}
          rows={3}
          width={205}
          height={330}
          labels={['退款 refund', '账务 billing', '技术 technical']}
          hot={{index: 1, glow: flash}}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: 180,
          padding: '10px 14px',
          borderRadius: 10,
          border: `2.5px solid ${theme.calib}`,
          background: theme.panel,
          transform: `rotate(${drop * 8}deg)`,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.text,
          boxShadow: `0 0 ${14 * (1 - drop)}px ${theme.calib}66`,
        }}
      >
        {'工单 #4172'}
        <div style={{fontSize: 15, color: theme.calib, marginTop: 4}}>{'conf 1.00'}</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 250,
          top: 372,
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.dim,
        }}
      >
        {'格口墙 · 只认挂牌'}
      </div>
    </div>
  );
};

/** 1-F 陷阱面单台：面单特写 + 满格把握投错格 + 三枚判词章（纯布局层）。 */
const TrapDesk: React.FC<{
  waybillAt: number;
  typeAt: number;
  typeDur: number;
  hotAt: number;
  dropAt: number;
  flashAt: number;
  stampAt: number;
}> = ({waybillAt, typeAt, typeDur, hotAt, dropAt, flashAt, stampAt}) => {
  const frame = useCurrentFrame();
  const stamps = [
    {t: '满分把握', mark: '', c: theme.calib},
    {t: '完全合法', mark: '✔', c: theme.ok},
    {t: '完全错误', mark: '✘', c: theme.danger},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 54}}>
        <WaybillCloseup at={waybillAt} typeAt={typeAt} typeDur={typeDur} hotAt={hotAt} />
        <WrongDrop at={dropAt} flashAt={flashAt} />
      </div>
      <div style={{display: 'flex', gap: 22}}>
        {stamps.map((s, i) => {
          const p = progress(frame, stampAt + i * 8, DUR.f4);
          return (
            <div
              key={s.t}
              style={{
                padding: '10px 26px',
                borderRadius: 10,
                border: `2.5px solid ${s.c}AA`,
                fontFamily: theme.serif,
                fontSize: 27,
                color: s.c,
                opacity: p,
                transform: `rotate(${i === 2 ? 4 : -3}deg) scale(${0.8 + p * 0.2})`,
              }}
            >
              {s.t}
              {s.mark ? (
                <span style={{marginLeft: 6}}>{s.mark}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 1-G 拆解台三栏卡：改了什么 / 怎么坏 / 教训（NumberedCard 组合，错峰钉入）。 */
const TeardownRow: React.FC<{at: number; c2At: number; c3At: number}> = ({at, c2At, c3At}) => {
  const frame = useCurrentFrame();
  const st = useStagger(3, {at, dur: DUR.f4, fit: {total: Math.max(40, c3At - at)}});
  const active = (i: number) => (i === 0 ? frame < c2At : i === 1 ? frame >= c2At && frame < c3At : frame >= c3At);
  const cards = [
    {label: '改了什么', sub: '闭合选项 → 自由生成 + 宽松解析', accent: theme.slot},
    {label: '怎么坏', sub: '标签漂移 · billing → 账务组 → 出界', accent: theme.danger},
    {label: '教训', sub: '类型安全 = 工程的选择', accent: theme.ok},
  ];
  return (
    <div style={{display: 'flex', gap: 26}}>
      {cards.map((c, i) => (
        <div key={c.label} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 24}px)`}}>
          <NumberedCard index={i + 1} label={c.label} sub={c.sub} active={active(i)} accent={c.accent} width={360} />
        </div>
      ))}
    </div>
  );
};

/** 1-G 越界判词：「五张单子 · 三张越界」红条脉冲钉入。 */
const VerdictFlash: React.FC<{at: number}> = ({at}) => {
  const pulse = useImpulse({at, dur: DUR.f5, peak: 1});
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f3);
  return (
    <div style={{display: 'flex', justifyContent: 'center', opacity: show}}>
      <div
        style={{
          padding: '11px 34px',
          borderRadius: 10,
          border: `3px solid ${theme.danger}`,
          background: `${theme.danger}1C`,
          fontFamily: theme.serif,
          fontSize: 33,
          color: theme.danger,
          transform: `scale(${1 + pulse * 0.08})`,
        }}
      >
        {'五张单子 · 三张越界'}
      </div>
    </div>
  );
};

/** 1-G 拆解台主视图：闭合态 / 拆后双终端走廊 + 越界判词 + 三栏卡（纯布局层）。 */
const TeardownBay: React.FC<{t1At: number; t2At: number; verdictAt: number; rowAt: number; c2At: number; c3At: number}> = ({
  t1At,
  t2At,
  verdictAt,
  rowAt,
  c2At,
  c3At,
}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
    <TerminalFeed
      title="proto b2 · 闭合态"
      at={t1At}
      lines={[
        {text: "[正常]          → 'billing'      conf=0.86  合法 ✔", ok: true},
        {text: "[陷阱·字面误读] → 'billing'      conf=1.00  合法 ✘ 应为 technical", danger: true},
      ]}
    />
    <TerminalFeed
      title="proto b2 · 拆掉闭合"
      at={t2At}
      lines={[
        {text: "[正常]          → 'Billing team' conf=0.86  越界! ✘", danger: true},
        {text: "[陷阱]          → 'Billing team' conf=1.00  越界! ✘", danger: true},
        {text: '标签漂移：billing → 账务组 · 直接出界', danger: true},
      ]}
    />
    <VerdictFlash at={verdictAt} />
    <TeardownRow at={rowAt} c2At={c2At} c3At={c3At} />
  </div>
);

export const P1Slots: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-06');
  const bC = w('p1-07', 'p1-08');
  const bD = w('p1-09', 'p1-13');
  const bE = w('p1-14', 'p1-19');
  const bF = w('p1-20', 'p1-23');
  const bG = w('p1-24', 'p1-28');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 接口解剖">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')}]}>
          <RequestUnfold
            at={at('p1-01') - bA.from}
            qAt={at('p1-02') - bA.from - 12}
            typeAt={at('p1-03') - bA.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="question-contracts"
          caption="问题契约 · 请求解剖"
          cues={[{chapterId: 'qc-anatomy', at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')}]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 三题型">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p1-05') - bB.from, durationInFrames: dur('p1-05')}]}>
          <TicketRack
            at={at('p1-04') - bB.from}
            t2At={at('p1-05') - bB.from}
            t3At={at('p1-06') - bB.from}
            scaleAt={at('p1-06') - bB.from}
            markAt={at('p1-06') - bB.from + Math.round(dur('p1-06') * 0.55)}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="question-contracts"
          caption="问题契约 · 三题型"
          cues={[{chapterId: 'qc-three-types', at: at('p1-05') - bB.from, durationInFrames: dur('p1-05')}]}
        />
        <Footnote delay={at('p1-06') - bB.from}>{'题型原名 noul / choice / score · 上限 255 选项 · 10 级'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="1-C 答案空间先定">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p1-07') - bC.from, durationInFrames: dur('p1-07')}]}>
          <WeldedGate stampAt={at('p1-07') - bC.from} slamAt={at('p1-08') - bC.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="question-contracts"
          caption="问题契约 · 答案空间先定"
          cues={[{chapterId: 'qc-closed', at: at('p1-07') - bC.from, durationInFrames: dur('p1-07')}]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 零幻觉的真相">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <ArchifyYield cues={[{at: at('p1-12') - bD.from, durationInFrames: dur('p1-12')}]}>
          <TruthPair topAt={at('p1-09') - bD.from} subAt={at('p1-10') - bD.from} botAt={at('p1-13') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="slot-wall"
          caption="格口墙 · 合法不等于正确"
          cues={[{chapterId: 'sw-legal-vs-correct', at: at('p1-12') - bD.from, durationInFrames: dur('p1-12')}]}
        />
        <Footnote delay={at('p1-11') - bD.from}>{'「零幻觉」不是实测成绩，是构造保证 —— 官方文档'}</Footnote>
      </Sequence>

      <Sequence {...bE} name="1-E 冷数据">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <Stage>
          <ColdBoard
            ringAt={at('p1-14') - bE.from}
            wrongAt={at('p1-15') - bE.from}
            coldAt={at('p1-16') - bE.from}
            zeroAt={at('p1-17') - bE.from}
            flipAt={at('p1-18') - bE.from}
            linkAt={at('p1-19') - bE.from}
          />
        </Stage>
      </Sequence>

      <Sequence {...bF} name="1-F 陷阱面单">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <EvidenceBadge text={'简化原型 · 复刻官方自曝失误'} at={at('p1-20') - bF.from} />
        <ArchifyYield cues={[{at: at('p1-22') - bF.from, durationInFrames: dur('p1-22')}]}>
          <TrapDesk
            waybillAt={at('p1-20') - bF.from}
            typeAt={at('p1-21') - bF.from}
            typeDur={dur('p1-21')}
            hotAt={at('p1-22') - bF.from - 8}
            dropAt={at('p1-22') - bF.from}
            flashAt={at('p1-23') - bF.from}
            stampAt={at('p1-23') - bF.from + 8}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="slot-wall"
          caption="格口墙 · 陷阱面单"
          cues={[{chapterId: 'sw-trap', at: at('p1-22') - bF.from, durationInFrames: dur('p1-22')}]}
        />
      </Sequence>

      <Sequence {...bG} name="1-G B2 拆闭合">
        <SceneTag chapter="P1" tagline="挂牌格口" accent={theme.slot} />
        <EvidenceBadge text={'简化原型 · B2'} at={at('p1-24') - bG.from} />
        <ArchifyYield
          cues={[
            {at: at('p1-25') - bG.from, durationInFrames: dur('p1-25')},
            {at: at('p1-27') - bG.from, durationInFrames: dur('p1-27')},
          ]}
        >
          <TeardownBay
            t1At={at('p1-24') - bG.from}
            t2At={at('p1-26') - bG.from}
            verdictAt={at('p1-28') - bG.from}
            rowAt={at('p1-24') - bG.from}
            c2At={at('p1-26') - bG.from}
            c3At={at('p1-28') - bG.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="closed-vs-open"
          caption="拆闭合 · 越界判例"
          cues={[
            {chapterId: 'co-open-path', at: at('p1-25') - bG.from, durationInFrames: dur('p1-25')},
            {chapterId: 'co-verdict', at: at('p1-27') - bG.from, durationInFrames: dur('p1-27')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
