/** P1 停摆的舱单（p1-01..p1-14，镜 1-A..1-E）——舱单解剖（五字段/铅封/两箱型）→
 *  一次取单、相对地址换托管、格式标记缺席 → 反对三连（停摆印章）→ 四处裂缝 →
 *  锁步竞态（阴阳舱单）→ 评论区长成三层塔。
 *  主色关税橙（舱单/铅封/海关面）；〔M-001〕舱单行母题 LedgerWall 橙描边恒定线宽；
 *  〔M-003〕终态停驻（停摆印章歪斜定格、三层塔落定）。空间语义：左=发布方堆场，
 *  右=客户端泊位，分发流向恒向右。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDim, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {EvidenceBadge, Stage} from '../components/devices';
import {LedgerWall, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 铅封/舱单母题恒定线宽（M-001：全片同形，禁改）。 */
const SEAL_W = 2.5;

// ── 1-A 舱单装置（p1-06 / p1-06a / p1-06b） ─────────────────────────────

const MANIFEST_ROWS = [
  {id: 'pdf-tools', desc: 'sha256 · 9f2c…'},
  {id: 'csv-clean', desc: 'sha256 · 41ad…'},
  {id: 'brand-kit', desc: 'sha256 · c07e…'},
  {id: 'db-audit', desc: 'sha256 · 5b93…'},
];

const FORK_GLYPHS = [
  {k: 'A', g: '↩'},
  {k: 'B', g: '×'},
  {k: 'C', g: '⇄'},
];

/** 1-A 主装置：中＝发布方域名下的总舱单（〔M-001〕舱单行 useStagger 逐行点亮，
 *  摘要列即铅封）；右＝客户端一次请求取走整张舱单（useDraw 描箭头 + 舱单副本
 *  useSpring 滑入泊位），更新只看这一处；左＝托管工位，p1-06a 技能包 useSpring
 *  从机房 A 换到 CDN B，舱单相对地址指针随之改线，客户端侧无感；p1-06b 舱单顶部
 *  格式标记 impulse 亮起 → 虚线缺席 → 三个实现分叉成三个答案（警示金）。 */
const ManifestDesk: React.FC<{
  rowsAt: number;
  fetchAt: number;
  loopAt: number;
  hostAt: number;
  swapAt: number;
  markAt: number;
  absentAt: number;
  forkAt: number;
}> = ({rowsAt, fetchAt, loopAt, hostAt, swapAt, markAt, absentAt, forkAt}) => {
  const frame = useCurrentFrame();
  const panelIn = useProgress(rowsAt, DUR.f4);
  const rows = useStagger(MANIFEST_ROWS.length, {at: rowsAt + DUR.f3, dur: DUR.f4, stride: 6});
  const arrow = useDraw(fetchAt, DUR.f5);
  const fly = useSpring('settle', {at: fetchAt + DUR.f3, dur: DUR.f6});
  const hostIn = useProgress(hostAt, DUR.f4);
  const swap = useSpring('settle', {at: swapAt, dur: DUR.f6});
  const land = useImpulse({at: swapAt + DUR.f5, dur: DUR.f4, peak: 1});
  const mark = useProgress(markAt, DUR.f4);
  const markHit = useImpulse({at: markAt, dur: DUR.f5, peak: 1});
  const absent = useProgress(absentAt, DUR.f4);
  const dimRest = useDim({at: markAt, to: 0.45});
  const fork = useStagger(FORK_GLYPHS.length, {at: forkAt, dur: DUR.f4, stride: 8});
  // effects 通道（opacity）走纯函数时长+缓动
  const flyO = progress(frame, fetchAt + DUR.f1, DUR.f3);
  const loopO = progress(frame, loopAt, DUR.f4);
  const calmO = progress(frame, swapAt + DUR.f6, DUR.f4);

  const stationGap = 160;
  const onB = swap > 0.5;
  const flight = Math.min(1, Math.max(0, fly));
  return (
    <div style={{position: 'relative', width: 1500, height: 600}}>
      {/* 连线层：相对地址指针（舱单 → 托管工位）+ 一次请求箭头（舱单 → 客户端） */}
      <svg width={1500} height={600} viewBox="0 0 1500 600" style={{position: 'absolute', inset: 0}}>
        <line
          x1={420}
          y1={390}
          x2={306}
          y2={305 + swap * stationGap}
          stroke={theme.concept}
          strokeWidth={2}
          strokeDasharray="7 7"
          opacity={hostIn * 0.8 * dimRest}
        />
        <path
          d="M 1052 236 L 1168 236"
          fill="none"
          stroke={theme.concept}
          strokeWidth={3}
          strokeLinecap="round"
          {...arrow}
        />
        <path d="M 1156 226 L 1170 236 L 1156 246" fill="none" stroke={theme.concept} strokeWidth={3} opacity={flyO} />
      </svg>

      {/* 左：发布方堆场 + 托管工位 */}
      <div style={{position: 'absolute', left: 0, top: 24, opacity: panelIn}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, letterSpacing: 2}}>{'发布方'}</div>
        <div
          style={{
            marginTop: 12,
            padding: '8px 18px',
            borderRadius: 8,
            border: `2px solid ${theme.panelBorder}`,
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.text,
          }}
        >
          {'acme.dev'}
        </div>
      </div>
      {['机房 A', 'CDN B'].map((name, i) => {
        const active = i === (onB ? 1 : 0);
        return (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: 0,
              top: 250 + i * stationGap,
              width: 300,
              height: 110,
              borderRadius: 12,
              border: `2px ${active ? 'solid' : 'dashed'} ${active ? theme.text : theme.panelBorder}`,
              background: theme.panel,
              opacity: hostIn,
              padding: '10px 14px',
              boxSizing: 'border-box',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{name}</span>
          </div>
        );
      })}
      {/* 技能包：机房 A → CDN B（托管工位切换） */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 300 + swap * stationGap,
          opacity: hostIn,
          transform: `scale(${1 + land * 0.08})`,
          padding: '8px 16px',
          borderRadius: 8,
          border: `2px solid ${theme.text}`,
          background: theme.bg,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.text,
        }}
      >
        {'技能包'}
      </div>

      {/* 中：总舱单（〔M-001〕橙描边恒定线宽） */}
      <div
        style={{
          position: 'absolute',
          left: 420,
          top: 24,
          width: 632,
          height: 470,
          borderRadius: 14,
          border: `${SEAL_W}px solid ${theme.concept}`,
          background: `${theme.concept}0A`,
          opacity: panelIn,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.concept}}>{'index.json'}</span>
          {/* 顶部格式标记：亮起 → 虚线缺席 */}
          <span
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              border: `2px ${absent > 0.5 ? 'dashed' : 'solid'} ${mark > 0 ? theme.deny : theme.panelBorder}`,
              background: `${theme.deny}${mark > 0 ? '14' : '00'}`,
              fontFamily: theme.sans,
              fontSize: 22,
              color: mark > 0 ? theme.deny : theme.dim,
              transform: `scale(${1 + markHit * 0.1})`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{opacity: 1 - absent * 0.55}}>{'格式版本'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 24, opacity: absent}}>{'?'}</span>
          </span>
        </div>
        {/* 舱单行：名字 + 摘要（铅封列） */}
        <div style={{position: 'absolute', left: 24, top: 80, transform: 'scale(1.38)', transformOrigin: 'top left'}}>
          <LedgerWall rows={MANIFEST_ROWS} width={420} rowH={44} visible={rows.map((r) => r * dimRest)} />
        </div>
        {/* 相对地址（换托管不改舱单） */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 346,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: hostIn * dimRest,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{'url · ./pdf-tools/'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'相对解析'}</span>
        </div>
        {/* 格式标记缺席 → 三个答案 */}
        <div style={{position: 'absolute', left: 24, top: 400, display: 'flex', alignItems: 'center', gap: 16}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.deny, opacity: fork[0]}}>{'3 个答案'}</span>
          {FORK_GLYPHS.map((f, i) => (
            <span
              key={f.k}
              style={{
                width: 76,
                height: 44,
                borderRadius: 8,
                border: `2px solid ${theme.deny}`,
                background: `${theme.deny}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.deny,
                opacity: fork[i],
                transform: `translateY(${(1 - fork[i]) * 14}px)`,
              }}
            >
              <span style={{fontSize: 16, color: theme.dim}}>{f.k}</span>
              {f.g}
            </span>
          ))}
        </div>
      </div>

      {/* 一次请求：标签 + 舱单副本滑入泊位 */}
      <div
        style={{position: 'absolute', left: 1050, top: 186, fontFamily: theme.sans, fontSize: 20, color: theme.concept, opacity: flyO}}
      >
        {'1 次请求'}
      </div>

      {/* 右：客户端泊位 */}
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 120,
          width: 300,
          height: 230,
          borderRadius: 14,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: panelIn,
          padding: '12px 16px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'客户端'}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 200,
          width: 120,
          height: 76,
          borderRadius: 8,
          border: `${SEAL_W}px solid ${theme.concept}`,
          background: theme.bg,
          opacity: flyO,
          transform: `translateX(${flight * 380}px)`,
          padding: '12px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {[0.9, 0.7, 0.8].map((wd, j) => (
          <div key={j} style={{height: 5, borderRadius: 3, width: `${wd * 100}%`, background: `${theme.concept}88`}} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 372,
          padding: '6px 16px',
          borderRadius: 999,
          border: `2px solid ${theme.concept}`,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.concept,
          opacity: loopO * dimRest,
        }}
      >
        {'↻ 更新只看这里'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1180,
          top: 430,
          padding: '6px 16px',
          borderRadius: 999,
          border: `2px solid ${theme.panelBorder}`,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.text,
          opacity: calmO * dimRest,
        }}
      >
        {'换托管 · 无感'}
      </div>
    </div>
  );
};

// ── 1-B 停摆印章（p1-07） ───────────────────────────────────────────────

/** 1-B 装置：提案卡 #254 → 时间轴 linear 推满（6+ 月）→ 警示金「停摆」印章
 *  useImpulse 盖下、歪斜定格（M-003：停摆是持续状态，印章常驻到画框接管）。 */
const StallStamp: React.FC<{at: number; barAt: number; barDur: number; stampAt: number}> = ({
  at,
  barAt,
  barDur,
  stampAt,
}) => {
  const cardIn = useProgress(at, DUR.f4);
  const bar = useProgress(barAt, barDur, 'linear');
  const stampIn = useProgress(stampAt, DUR.f3, 'accelerate');
  const hit = useImpulse({at: stampAt + DUR.f3, dur: DUR.f5, peak: 1});
  const months = Math.floor(bar * 6);
  return (
    <div style={{position: 'relative', width: 1100, height: 420}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 40,
          width: 1100,
          height: 320,
          borderRadius: 16,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: cardIn,
          transform: `translateY(${hit * 5}px)`,
          padding: '34px 44px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 26}}>
          <span style={{fontFamily: theme.mono, fontSize: 72, color: theme.concept}}>{'#254'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>{'舱单提案'}</span>
          <span
            style={{
              marginLeft: 'auto',
              padding: '6px 18px',
              borderRadius: 999,
              border: `2px solid ${theme.panelBorder}`,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.dim,
            }}
          >
            {'Open · 未合并'}
          </span>
        </div>
        {/* 时间轴：躺了多久 */}
        <div style={{position: 'absolute', left: 44, right: 44, bottom: 52}}>
          <div style={{height: 12, borderRadius: 6, background: theme.panelBorder, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${bar * 100}%`, background: theme.deny, borderRadius: 6}} />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 12}}>
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'提交'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 28, color: theme.deny}}>
              {`${months}${bar >= 1 ? '+' : ''} 月`}
            </span>
          </div>
        </div>
      </div>
      {/* 停摆印章 */}
      <div
        style={{
          position: 'absolute',
          left: 600,
          top: 132,
          opacity: stampIn,
          transform: `rotate(-9deg) scale(${1.5 - 0.5 * stampIn + hit * 0.08})`,
        }}
      >
        <div
          style={{
            padding: '10px 40px',
            borderRadius: 12,
            border: `4px solid ${theme.deny}`,
            background: `${theme.deny}14`,
            fontFamily: theme.sans,
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: 10,
            color: theme.deny,
            boxShadow: `0 0 ${24 * hit}px ${theme.deny}66`,
          }}
        >
          {'停摆'}
        </div>
      </div>
    </div>
  );
};

// ── 1-E 评论区长成三层塔（p1-14） ───────────────────────────────────────

const DEBATE_CHIPS = ['同域?', '双处同步', '锁步竞态'];
const TOWER = [
  {k: 'L1', name: '运输铅封', color: theme.concept, width: 560},
  {k: 'L2', name: '随箱签章', color: theme.conceptDeep, width: 480},
  {k: 'L3', name: '灯塔见证', color: theme.conceptDeep, width: 400},
];

/** 1-E 装置：底部评论区窗口（三条争论楼层 useStagger 滚入，3 个月）→ 从窗口
 *  顶沿向上 useStagger 生长三层塔（L1 橙＝运输铅封，L2/L3 绿＝签章与见证），
 *  终态停驻（M-003）。 */
const CommentTower: React.FC<{at: number; monthAt: number; towerAt: number}> = ({at, monthAt, towerAt}) => {
  const frame = useCurrentFrame();
  const winIn = useProgress(at, DUR.f4);
  const floors = useStagger(DEBATE_CHIPS.length, {at: at + DUR.f3, dur: DUR.f4, stride: 8});
  const monthO = useProgress(monthAt, DUR.f4);
  const stem = useProgress(towerAt, DUR.f5, 'decelerate');
  const layers = useStagger(TOWER.length, {at: towerAt + DUR.f4, dur: DUR.f5, stride: 12});
  const titleO = progress(frame, towerAt + DUR.f4 + 24 + DUR.f5, DUR.f4);
  const cx = 550;
  return (
    <div style={{position: 'relative', width: 1100, height: 640}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 30,
          letterSpacing: 4,
          color: theme.text,
          opacity: titleO,
        }}
      >
        {'信任栈 · 三层'}
      </div>
      {/* 生长茎：评论区顶沿 → 塔基 */}
      <div
        style={{
          position: 'absolute',
          left: cx - 2,
          top: 400,
          width: 4,
          height: 44,
          background: theme.concept,
          transformOrigin: 'bottom',
          transform: `scaleY(${stem})`,
          opacity: stem,
        }}
      />
      {/* 三层塔：自下而上 */}
      {TOWER.map((t, i) => (
        <div
          key={t.k}
          style={{
            position: 'absolute',
            left: cx - t.width / 2,
            top: 318 - i * 96,
            width: t.width,
            height: 80,
            borderRadius: 12,
            border: `${SEAL_W}px solid ${t.color}`,
            background: `${t.color}14`,
            opacity: layers[i],
            transform: `translateY(${(1 - layers[i]) * 50}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            boxSizing: 'border-box',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 24, color: t.color}}>{t.k}</span>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{t.name}</span>
        </div>
      ))}
      {/* 评论区窗口 */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 444,
          width: 700,
          height: 190,
          borderRadius: 14,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          opacity: winIn,
          padding: '12px 22px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'#254 · 评论区'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny, opacity: monthO}}>{'3 个月'}</span>
        </div>
        {DEBATE_CHIPS.map((c, i) => (
          <div
            key={c}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 10,
              opacity: floors[i],
              transform: `translateX(${(1 - floors[i]) * -20}px)`,
            }}
          >
            <span style={{width: 18, height: 18, borderRadius: 9, background: `${theme.dim}66`}} />
            <span
              style={{
                padding: '2px 12px',
                borderRadius: 6,
                border: `1.5px solid ${theme.concept}88`,
                fontFamily: theme.sans,
                fontSize: 18,
                color: theme.text,
              }}
            >
              {c}
            </span>
            <span style={{flex: 1, height: 6, borderRadius: 3, background: theme.panelBorder}} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────────────

export const P1: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-06b');
  const bB = w('p1-07', 'p1-10');
  const bC = w('p1-10a', 'p1-10c');
  const bD = w('p1-11', 'p1-13');
  const bE = w('p1-14');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 舱单解剖">
        <SceneTag chapter="P1" tagline="停摆的舱单" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p1-01') - bA.from, durationInFrames: dur('p1-01')},
            {at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')},
            {at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
            {at: at('p1-04') - bA.from, durationInFrames: dur('p1-04')},
            {at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')},
          ]}
        >
          <ManifestDesk
            rowsAt={at('p1-06') - bA.from}
            fetchAt={at('p1-06') - bA.from + Math.round(dur('p1-06') * 0.26)}
            loopAt={at('p1-06') - bA.from + Math.round(dur('p1-06') * 0.55)}
            hostAt={at('p1-06a') - bA.from}
            swapAt={at('p1-06a') - bA.from + Math.round(dur('p1-06a') * 0.66)}
            markAt={at('p1-06b') - bA.from + Math.round(dur('p1-06b') * 0.1)}
            absentAt={at('p1-06b') - bA.from + Math.round(dur('p1-06b') * 0.5)}
            forkAt={at('p1-06b') - bA.from + Math.round(dur('p1-06b') * 0.72)}
          />
        </ArchifyYield>
        {/* manifest-anatomy 5 章上限：p1-06 / p1-06a / p1-06b 由 ManifestDesk 装置承接 */}
        <ArchifyRecap
          slug="manifest-anatomy"
          caption="舱单解剖 · 五字段"
          cues={[
            {chapterId: 'ma-old', at: at('p1-01') - bA.from, durationInFrames: dur('p1-01')},
            {chapterId: 'ma-index', at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')},
            {chapterId: 'ma-fields', at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
            {chapterId: 'ma-seal', at: at('p1-04') - bA.from, durationInFrames: dur('p1-04')},
            {chapterId: 'ma-boxes', at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 反对三连">
        <SceneTag chapter="P1" tagline="停摆的舱单" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
            {at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')},
            {at: at('p1-10') - bB.from, durationInFrames: dur('p1-10')},
          ]}
        >
          <StallStamp
            at={at('p1-07') - bB.from}
            barAt={at('p1-07') - bB.from + Math.round(dur('p1-07') * 0.3)}
            barDur={Math.round(dur('p1-07') * 0.36)}
            stampAt={at('p1-07') - bB.from + Math.round(dur('p1-07') * 0.7)}
          />
        </ArchifyYield>
        {/* 前句 p1-07 为装置句（非背靠背）→ 首章正常入场 */}
        <ArchifyRecap
          slug="three-objections"
          caption="反对三连"
          cues={[
            {chapterId: 'to-samedomain', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
            {chapterId: 'to-footgun', at: at('p1-09') - bB.from, durationInFrames: dur('p1-09')},
            {chapterId: 'to-pipeline', at: at('p1-10') - bB.from, durationInFrames: dur('p1-10')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 四处裂缝">
        <SceneTag chapter="P1" tagline="停摆的舱单" accent={theme.concept} />
        {/* to-pipeline@p1-10 跨镜背靠背 → lead={false}；10a→10b→10c 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="four-cracks"
          caption="四处裂缝"
          lead={false}
          cues={[
            {chapterId: 'fc-soft404', at: at('p1-10a') - bC.from, durationInFrames: dur('p1-10a')},
            {chapterId: 'fc-units', at: at('p1-10b') - bC.from, durationInFrames: dur('p1-10b')},
            {chapterId: 'fc-schema', at: at('p1-10c') - bC.from, durationInFrames: dur('p1-10c')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 锁步竞态">
        <SceneTag chapter="P1" tagline="停摆的舱单" accent={theme.concept} />
        <EvidenceBadge text="自建玩具 · 实测" at={at('p1-13') - bD.from} />
        {/* fc-schema@p1-10c 跨镜背靠背 → lead={false}；11→12→13 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="lockstep-race"
          caption="锁步竞态 · 阴阳舱单"
          lead={false}
          cues={[
            {chapterId: 'lr-t0', at: at('p1-11') - bD.from, durationInFrames: dur('p1-11')},
            {chapterId: 'lr-race', at: at('p1-12') - bD.from, durationInFrames: dur('p1-12')},
            {chapterId: 'lr-catch', at: at('p1-13') - bD.from, durationInFrames: dur('p1-13')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 三层塔过渡">
        <SceneTag chapter="P1" tagline="停摆的舱单" accent={theme.concept} />
        <Stage>
          <CommentTower
            at={at('p1-14') - bE.from}
            monthAt={at('p1-14') - bE.from + Math.round(dur('p1-14') * 0.36)}
            towerAt={at('p1-14') - bE.from + Math.round(dur('p1-14') * 0.48)}
          />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
