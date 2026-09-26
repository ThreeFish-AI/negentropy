/** P0 四十六家就范（p0-01..p0-13，镜 0-A..0-E）——2025 反常捐出 → 一年后整张
 *  牌桌亮灯 → 「一个文件夹」悬念三连 → 团队规矩不在 AI 脑内 → 两条老路（盲猜
 *  翻沉 / 全塞压舱）收在「装了多少 vs 用了多少」的账上。
 *  主色引航青（港口/规范/台账面）；〔M-001〕在 0-C（文件夹即箱）与 0-E（甲板
 *  小箱）回归；〔M-003〕停驻终态（牌匾递出、三无章、船沉账停）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {EvidenceBadge, Stage} from '../components/devices';
import {CargoBox, Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 0-A 港务大楼 · 递牌匾 ────────────────────────────────────────────────

/** 年份戳：impulse 落章留痕（落定后不再动——M-003 停驻）。 */
const YearStamp: React.FC<{at: number}> = ({at}) => {
  const hit = useImpulse({at, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const mark = progress(frame, at + 3, DUR.f3);
  return (
    <div style={{position: 'relative', width: 116, height: 116}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3px solid ${theme.concept}`,
          background: `${theme.concept}1A`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 38,
          color: theme.concept,
          transform: `scale(${1 + hit * 0.22})`,
        }}
      >
        {'2025'}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 12,
          borderRadius: 9,
          border: `2px dashed ${theme.concept}99`,
          opacity: mark,
        }}
      />
    </div>
  );
};

/** 0-A 主装置：左港务大楼（存量图纸），牌匾 useSpring 递出、沿轨道滑向右侧
 *  对手空席（向右=进入他人使用），年份戳压角，抵达后停驻。 */
const PlaqueHandoff: React.FC<{stampAt: number; handAt: number}> = ({stampAt, handAt}) => {
  const slide = useSpring('settle', {at: handAt, dur: DUR.f6});
  const frame = useCurrentFrame();
  const seatsP = progress(frame, handAt + 10, DUR.f5);
  return (
    <div style={{position: 'relative', width: 1440, height: 540}}>
      {/* 递出轨道 */}
      <svg width={1440} height={540} viewBox="0 0 1440 540" style={{position: 'absolute', inset: 0}}>
        <line x1={350} y1={262} x2={950} y2={262} stroke={`${theme.concept}55`} strokeWidth={3} strokeDasharray="10 14" />
      </svg>
      {/* 港务大楼（左：自有图纸的存量方） */}
      <div style={{position: 'absolute', left: 40, top: 160}}>
        <Panel accent={theme.concept} style={{width: 300, height: 380, padding: 0}}>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: '28px 26px 0'}}>
            {Array.from({length: 12}, (_, i) => (
              <div key={i} style={{height: 34, borderRadius: 5, background: `${theme.concept}2E`}} />
            ))}
          </div>
          <div style={{textAlign: 'center', marginTop: 30, fontFamily: theme.mono, fontSize: 26, color: theme.concept}}>
            {'Anthropic'}
          </div>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 6}}>
            {'港务大楼'}
          </div>
        </Panel>
      </div>
      {/* 递出的牌匾 */}
      <div style={{position: 'absolute', left: 356, top: 128, transform: `translateX(${slide * 250}px)`}}>
        <div style={{position: 'relative'}}>
          <Panel accent={theme.concept} style={{width: 320, padding: '28px 30px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.mono, fontSize: 40, letterSpacing: 3, color: theme.concept}}>{'OPEN SPEC'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text, marginTop: 12}}>{'捐出'}</div>
          </Panel>
          <div style={{position: 'absolute', right: -26, top: -34}}>
            <YearStamp at={stampAt} />
          </div>
        </div>
      </div>
      {/* 对手空席（右：接收方，0-B 将逐个亮灯） */}
      <div style={{position: 'absolute', right: 40, top: 168, display: 'flex', gap: 16, opacity: seatsP}}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 100,
              height: 152,
              borderRadius: 12,
              border: `2.5px dashed ${theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 42,
              color: theme.dim,
            }}
          >
            {'?'}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 0-C 悬念三连 ────────────────────────────────────────────────────────

/** 「无」章：deny 金（悬案色）印章，impulse 连盖、落定歪斜停驻。 */
const NoStamp: React.FC<{label: string; at: number}> = ({label, at}) => {
  const hit = useImpulse({at, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const mark = progress(frame, at + 3, DUR.f3);
  return (
    <div
      style={{
        width: 208,
        height: 88,
        borderRadius: 12,
        border: `2.5px solid ${theme.deny}`,
        background: `${theme.deny}14`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: mark,
        transform: `rotate(${(mark - 0.5) * 5 + hit * 4}deg) scale(${1 + hit * 0.1})`,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.deny}}>{'无'}</span>
      <span style={{fontFamily: theme.sans, fontSize: 29, color: theme.text}}>{label}</span>
    </div>
  );
};

/** 0-C 主装置：文件夹即箱〔M-001〕——开盖露出唯一一份 SKILL.md；右栏 247 行
 *  滚数 + 三枚「无」章连盖；p0-07 金问号压轴（悬案色）。 */
const FolderDossier: React.FC<{fileAt: number; countAt: number; stampAt: number; qAt: number}> = ({
  fileAt,
  countAt,
  stampAt,
  qAt,
}) => {
  const frame = useCurrentFrame();
  const fileP = progress(frame, fileAt, DUR.f5);
  const qP = progress(frame, qAt, DUR.f5);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 110}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
        <div style={{position: 'relative'}}>
          <CargoBox width={380} height={280} opened />
          <div
            style={{
              position: 'absolute',
              left: 66,
              top: 52 + (1 - fileP) * 96,
              width: 248,
              padding: '14px 18px',
              borderRadius: 10,
              border: `2px solid ${theme.conceptDeep}88`,
              background: theme.panel,
              opacity: fileP,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.conceptDeep}}>{'SKILL.md'}</div>
            {[0.94, 0.86, 0.9, 0.62, 0.8].map((w, j) => (
              <div key={j} style={{height: 6, marginTop: 8, borderRadius: 3, width: `${w * 100}%`, background: theme.panelBorder}} />
            ))}
          </div>
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>{'一个文件夹 · 一份说明'}</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
        <div style={{position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 96, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
            <Counter from={0} to={247} start={countAt} frames={DUR.f6 * 2} />
            <span style={{fontSize: 40, color: theme.dim, marginLeft: 10}}>{' 行'}</span>
          </div>
          <div
            style={{
              position: 'absolute',
              right: -130,
              top: -34,
              fontFamily: theme.mono,
              fontSize: 118,
              color: theme.deny,
              opacity: qP,
              transform: `scale(${0.5 + qP * 0.6})`,
            }}
          >
            {'?'}
          </div>
        </div>
        <div style={{display: 'flex', gap: 22}}>
          <NoStamp label="版本号" at={stampAt} />
          <NoStamp label="日志" at={stampAt + 16} />
          <NoStamp label="安全章节" at={stampAt + 32} />
        </div>
      </div>
    </div>
  );
};

// ── 0-D 规矩之困 ────────────────────────────────────────────────────────

/** 0-D 主装置：左三张团队便签（deny 金——存量知识，stagger 浮现），右 AI 头像
 *  （作业台侧，spring 驱动衰减摇头）；抓取弧落空打 ×，便签上浮躲开。 */
const RulesBoard: React.FC<{shakeAt: number; noteAt: number; grabAt: number}> = ({shakeAt, noteAt, grabAt}) => {
  const wiggle = useSpring('snap', {at: shakeAt});
  const st = useStagger(3, {at: noteAt, dur: DUR.f4, stride: 10});
  const frame = useCurrentFrame();
  const tilt = Math.sin(wiggle * Math.PI * 4) * 8 * Math.max(0, 1 - wiggle);
  const notes = [
    {label: '报销单', sub: '怎么填'},
    {label: '评审口径', sub: '盯什么'},
    {label: 'PDF 表单', sub: '三个坑'},
  ];
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
      <div style={{fontFamily: theme.sans, fontSize: 33, fontWeight: 600, color: theme.text}}>
        {'规矩在团队 · 不在脑内'}
      </div>
      <div style={{position: 'relative', width: 1240, height: 470}}>
        {/* 抓取弧：画向便签、落空处打 × */}
        <svg width={1240} height={470} viewBox="0 0 1240 470" style={{position: 'absolute', inset: 0}}>
          {notes.map((n, i) => {
            const noteTop = 40 + i * 150;
            const arcP = progress(frame, grabAt + i * 7, DUR.f4);
            return (
              <React.Fragment key={n.label}>
                <path
                  d={`M1010 300 Q 760 ${noteTop} 420 ${noteTop + 44}`}
                  fill="none"
                  stroke={`${theme.deny}99`}
                  strokeWidth={3}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - arcP}
                />
                {arcP >= 1 ? (
                  <text x={420} y={noteTop + 28} textAnchor="middle" fontFamily={theme.mono} fontSize={40} fill={theme.deny}>
                    {'×'}
                  </text>
                ) : null}
              </React.Fragment>
            );
          })}
        </svg>
        {/* 左：团队规矩便签（存量） */}
        {notes.map((n, i) => {
          const dodge = progress(frame, grabAt + 6 + i * 7, DUR.f4);
          const dy = -Math.sin(Math.PI * dodge) * 24;
          return (
            <div
              key={n.label}
              style={{
                position: 'absolute',
                left: 60,
                top: 40 + i * 150 + dy,
                opacity: st[i],
                transform: `translateY(${(1 - st[i]) * 18}px) rotate(${(i - 1) * 3}deg)`,
              }}
            >
              <div
                style={{
                  width: 330,
                  padding: '18px 22px',
                  borderRadius: 4,
                  background: `${theme.deny}1E`,
                  border: `2px solid ${theme.deny}CC`,
                  boxShadow: `0 10px 24px ${theme.deny}1E`,
                }}
              >
                <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 600, color: theme.text}}>{n.label}</div>
                <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 6}}>{n.sub}</div>
              </div>
            </div>
          );
        })}
        {/* 右：AI 头像（使用中），摇头够不着 */}
        <div style={{position: 'absolute', right: 60, top: 170, transform: `rotate(${tilt}deg)`}}>
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 34,
              border: `3px solid ${theme.concept}`,
              background: `${theme.concept}14`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <div style={{display: 'flex', gap: 36}}>
              <div style={{width: 22, height: 22, borderRadius: 11, background: theme.concept}} />
              <div style={{width: 22, height: 22, borderRadius: 11, background: theme.concept}} />
            </div>
            <div style={{width: 64, height: 6, borderRadius: 3, background: `${theme.concept}88`}} />
          </div>
          <div style={{marginTop: 14, textAlign: 'center', fontFamily: theme.mono, fontSize: 22, color: theme.concept}}>
            {'AI 助手'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 0-E 两条老路 ────────────────────────────────────────────────────────

/** 0-E 主装置：左船引航青雾中盲航翻沉（猜错路）；右船 deny 金超载，甲板摞
 *  〔M-001〕小箱逐个翻倒、金水漫甲板。同一 useProgress 同步下沉；翻牌
 *  useCount 滚到 60000；p0-12b 窗亮出「9/10 无关」挑拣税条。终态停驻。 */
const TwoRoadsBoard: React.FC<{
  sinkAt: number;
  sinkDur: number;
  countAt: number;
  countDur: number;
  stripAt: number;
}> = ({sinkAt, sinkDur, countAt, countDur, stripAt}) => {
  const sink = useProgress(sinkAt, sinkDur);
  const sixtyK = useCount({to: 60000, at: countAt, dur: countDur, ease: 'accelerate'});
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30}}>
      <div style={{display: 'flex', gap: 70}}>
        {/* 左船：盲猜 · 雾中翻沉 */}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
          <svg width={560} height={310} viewBox="0 0 560 310">
            {[36, 108, 180].map((y) => (
              <rect key={y} x={16} y={y} width={528} height={24} rx={12} fill={`${theme.concept}12`} />
            ))}
            <g transform={`translate(${sink * 26} ${sink * 88}) rotate(${sink * 34} 280 196)`}>
              <path d="M128 196 L432 196 L392 248 L168 248 Z" fill={`${theme.concept}20`} stroke={theme.concept} strokeWidth={3} />
              <rect x={248} y={134} width={64} height={62} rx={6} fill={`${theme.concept}16`} stroke={theme.concept} strokeWidth={2.5} />
              <line x1={280} y1={64} x2={280} y2={134} stroke={theme.concept} strokeWidth={3} />
              <text x={280} y={54} textAnchor="middle" fontFamily={theme.mono} fontSize={36} fill={theme.concept}>
                {'?'}
              </text>
            </g>
            <line x1={10} y1={250} x2={550} y2={250} stroke={`${theme.dim}77`} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" />
          </svg>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.concept}}>{'老路一 · 让它猜'}</div>
        </div>
        {/* 右船：全塞 · 超载进水 */}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
          <svg width={560} height={310} viewBox="0 0 560 310">
            <g transform={`translate(0 ${sink * 58}) rotate(${-sink * 14} 280 206)`}>
              <path d="M128 202 L432 202 L394 252 L166 252 Z" fill={`${theme.deny}1C`} stroke={theme.deny} strokeWidth={3} />
              <rect x={252} y={148} width={56} height={54} rx={6} fill={`${theme.deny}14`} stroke={theme.deny} strokeWidth={2.5} />
              {[
                {x: 170, y: 166},
                {x: 218, y: 166},
                {x: 266, y: 166},
                {x: 194, y: 134},
                {x: 242, y: 134},
              ].map((b, i) => (
                <g key={i} transform={`rotate(${sink * (12 + i * 7)} ${b.x + 23} ${b.y + 16}) translate(0 ${sink * i * 8})`}>
                  <rect x={b.x} y={b.y} width={46} height={32} rx={5} fill={`${theme.conceptDeep}1E`} stroke={theme.conceptDeep} strokeWidth={2.5} />
                </g>
              ))}
            </g>
            <rect x={140} y={214 - sink * 34} width={280} height={40 + sink * 30} rx={16} fill={`${theme.deny}2E`} opacity={sink} />
            <line x1={10} y1={250} x2={550} y2={250} stroke={`${theme.dim}77`} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" />
          </svg>
          <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny}}>{'老路二 · 全塞进去'}</div>
        </div>
      </div>
      {/* 旁挂账：翻牌 + 挑拣税 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 64}}>
        <Panel accent={theme.deny} style={{padding: '14px 28px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.dim}}>{'20 技能 × 3000 token'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 52, color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4}}>
            {'≈ ' + Math.round(sixtyK).toLocaleString('en-US')}
          </div>
        </Panel>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          <div style={{display: 'flex', gap: 8}}>
            {Array.from({length: 10}, (_, i) => {
              const off = i === 9 ? 0 : progress(frame, stripAt + i * 2, DUR.f3);
              const dimmed = off > 0.5;
              return (
                <div
                  key={i}
                  style={{
                    width: 42,
                    height: 28,
                    borderRadius: 6,
                    border: `2px solid ${dimmed ? theme.panelBorder : theme.concept}`,
                    background: dimmed ? 'transparent' : `${theme.concept}1E`,
                    opacity: dimmed ? 0.4 : 1,
                  }}
                />
              );
            })}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.deny}}>{'9/10 无关 · 挑拣税'}</div>
        </div>
      </div>
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────────────

export const P0: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-04');
  const bC = w('p0-05', 'p0-07');
  const bD = w('p0-08', 'p0-10');
  const bE = w('p0-11', 'p0-13');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 反常捐赠">
        <SceneTag chapter="P0" tagline="四十六家就范" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},
          ]}
        >
          <PlaqueHandoff stampAt={at('p0-01') - bA.from} handAt={at('p0-02') - bA.from + 2} />
        </ArchifyYield>
        <ArchifyRecap
          slug="port-46-adoption"
          caption="港务大楼 · 2025 捐出"
          cues={[
            {chapterId: 'pa-open', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="0-B 牌桌亮灯">
        <SceneTag chapter="P0" tagline="四十六家就范" accent={theme.concept} />
        <ArchifyRecap
          slug="port-46-adoption"
          caption="夜港亮灯 · 46 家牌桌"
          cues={[
            {chapterId: 'pa-harbor', at: at('p0-03') - bB.from, durationInFrames: dur('p0-03')},
            {chapterId: 'pa-table', at: at('p0-04') - bB.from, durationInFrames: dur('p0-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="0-C 悬念三连">
        <SceneTag chapter="P0" tagline="四十六家就范" accent={theme.concept} />
        <EvidenceBadge text="信源 · agentskills.io 规范原文" at={at('p0-06') - bC.from} />
        <Stage>
          <FolderDossier
            fileAt={at('p0-05') - bC.from}
            countAt={at('p0-06') - bC.from + 4}
            stampAt={at('p0-06') - bC.from + 18}
            qAt={at('p0-07') - bC.from}
          />
        </Stage>
        <Footnote delay={at('p0-07') - bC.from}>{'三无文件 · 凭什么低头'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="0-D 规矩之困">
        <SceneTag chapter="P0" tagline="四十六家就范" accent={theme.concept} />
        <Stage>
          <RulesBoard
            shakeAt={at('p0-09') - bD.from}
            noteAt={at('p0-10') - bD.from}
            grabAt={at('p0-10') - bD.from + 10}
          />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="0-E 两条老路">
        <SceneTag chapter="P0" tagline="四十六家就范" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p0-11') - bE.from, durationInFrames: dur('p0-11')},
            {at: at('p0-12') - bE.from, durationInFrames: dur('p0-12')},
            {at: at('p0-12a') - bE.from, durationInFrames: dur('p0-12a')},
            {at: at('p0-13') - bE.from, durationInFrames: dur('p0-13')},
          ]}
        >
          <TwoRoadsBoard
            sinkAt={at('p0-12a') - bE.from}
            sinkDur={dur('p0-12a', 'p0-12b')}
            countAt={at('p0-12a') - bE.from}
            countDur={dur('p0-12a', 'p0-12b')}
            stripAt={at('p0-12b') - bE.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="two-old-roads"
          caption="两条老路 · 猜与塞"
          cues={[
            {chapterId: 'or-two', at: at('p0-11') - bE.from, durationInFrames: dur('p0-11')},
            {chapterId: 'or-guess', at: at('p0-12') - bE.from, durationInFrames: dur('p0-12')},
            {chapterId: 'or-stuff', at: at('p0-12a') - bE.from, durationInFrames: dur('p0-12a')},
            {chapterId: 'or-ledger', at: at('p0-13') - bE.from, durationInFrames: dur('p0-13')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
