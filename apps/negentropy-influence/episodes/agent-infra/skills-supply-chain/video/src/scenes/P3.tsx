/** P3 编号牌失踪（p3-01..p3-13）——版本之战：双门失效（写死卡死 / 省略跳变）→
 *  官方仓 0 标签 vs 云厂商 8 级发版的两个物种 → 锁文件孤本。
 *  装置句两处：p3-01 空编号位〔M-002 以静写闷，仅红叉一枚 useImpulse〕；
 *  p3-13 散文 vs 代码天平 useSpring 持平（「都是指令」的几何直译）。
 *  其余句全部 archify full 逐章回放（version-gates / two-species / lockfile-orphan）。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 3-A 空编号位（p3-01 装置） ────────────────────────────────────────────────

const PLATE_FIELDS = [
  'name:',
  'description:',
  'license:',
  'compatibility:',
  'metadata:',
  'allowed-tools:',
];

/** 舱单式编号牌：六字段行安静入列〔M-002 以静写闷〕，第七行 version 虚线空位，
 *  红叉以唯一一枚 useImpulse 盖章（storyboard：空编号位红叉 `@impulse`）。
 *  「红」取警示金：空位=留白/悬案语义，danger 红全片仅攻击命中瞬间。 */
const VersionPlate: React.FC<{at: number; beatDur: number}> = ({at, beatDur}) => {
  const rowWin = Math.max(24, Math.round(beatDur * 0.4));
  const rows = useStagger(PLATE_FIELDS.length, {at, dur: DUR.f3, fit: {total: rowWin}});
  const slotAt = at + Math.round(beatDur * 0.5);
  const slot = useProgress(slotAt, DUR.f4);
  const crossAt = at + Math.round(beatDur * 0.62);
  const x = useDraw(crossAt, DUR.f4);
  const glow = useImpulse({at: crossAt, dur: DUR.f4, peak: 1});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 22}}>
        <div style={{fontFamily: theme.serif, fontSize: 38, color: theme.text}}>编号牌</div>
        <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.deny}}>6字段 · 0版本</div>
      </div>
      <Panel style={{width: 640, padding: '22px 30px'}}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.dim,
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          SKILL.md
        </div>
        {PLATE_FIELDS.map((f, i) => (
          <div
            key={f}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              height: 44,
              opacity: rows[i],
              borderBottom: `1px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 23, color: theme.text, width: 250}}>
              {f}
            </span>
            {/* 值条：字段有内容（静默入列，无强调动效） */}
            <span
              style={{
                width: 240,
                height: 10,
                borderRadius: 5,
                background: `${theme.dim}4D`,
              }}
            />
          </div>
        ))}
        {/* 第七行：version 虚线空位（留白/悬案 → 警示金） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            height: 56,
            opacity: slot,
            borderBottom: 'none',
          }}
        >
          <span
            style={{fontFamily: theme.mono, fontSize: 23, color: theme.deny, width: 250}}
          >
            version:
          </span>
          <span
            style={{
              position: 'relative',
              width: 240,
              height: 30,
              borderRadius: 6,
              border: `2.5px dashed ${theme.deny}80`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${1 + 0.12 * glow})`,
            }}
          >
            {/* 红叉：两条描线在空位上盖章，辉光唯一脉冲 */}
            <svg width={72} height={56} style={{position: 'absolute', overflow: 'visible'}}>
              <circle cx={36} cy={28} r={34} fill={theme.deny} opacity={0.1 * glow} />
              <line
                x1={18}
                y1={10}
                x2={54}
                y2={46}
                stroke={theme.deny}
                strokeWidth={5 + 2 * glow}
                strokeLinecap="round"
                opacity={0.88}
                pathLength={x.pathLength}
                strokeDasharray={x.strokeDasharray}
                strokeDashoffset={x.strokeDashoffset}
              />
              <line
                x1={54}
                y1={10}
                x2={18}
                y2={46}
                stroke={theme.deny}
                strokeWidth={5 + 2 * glow}
                strokeLinecap="round"
                opacity={0.88}
                pathLength={x.pathLength}
                strokeDasharray={x.strokeDasharray}
                strokeDashoffset={x.strokeDashoffset}
              />
            </svg>
          </span>
        </div>
      </Panel>
    </div>
  );
};

// ── 3-C 散文 vs 代码天平（p3-13 装置） ────────────────────────────────────────

const PIVOT = {x: 600, y: 250};
const HALF = 330;
const STRING = 84;

/** 天平秤：开场代码盘沉（散文被看轻）→ useSpring 持平（「都是指令」的几何直译，
 *  storyboard：散文 vs 代码天平 useSpring 持平 `@spring`）。
 *  收尾处两侧编号牌对照——代码 v1.2.3（检疫绿=验证面）vs 散文 v?（警示金=悬案），
 *  承接末句「凭什么散文就不需要版本管理」。 */
const ProseCodeBalance: React.FC<{at: number; beatDur: number}> = ({at, beatDur}) => {
  const enter = useProgress(at, DUR.f5);
  const pans = useStagger(2, {at: at + Math.round(beatDur * 0.08), dur: DUR.f4, stride: 14});
  const levelAt = at + Math.round(beatDur * 0.42);
  const level = useSpring('snap', {at: levelAt, dur: Math.round(beatDur * 0.3)});
  const labelOn = useProgress(at + Math.round(beatDur * 0.72), DUR.f5);
  const tagAt = at + Math.round(beatDur * 0.82);
  const tags = useProgress(tagAt, DUR.f5);
  const tagGlow = useImpulse({at: tagAt, dur: DUR.f5, peak: 1});
  // 开场左（散文）盘翘起 11°：被看轻；持平弹簧归零后微过冲再停驻
  const deg = (1 - level) * 11;
  const rad = (deg * Math.PI) / 180;
  const leftX = PIVOT.x - HALF * Math.cos(rad);
  const leftY = PIVOT.y - HALF * Math.sin(rad);
  const rightX = PIVOT.x + HALF * Math.cos(rad);
  const rightY = PIVOT.y + HALF * Math.sin(rad);
  const panCard: React.CSSProperties = {
    width: 268,
    borderRadius: 14,
    border: `2.5px solid ${theme.panelBorder}`,
    background: theme.panel,
    padding: '18px 22px 14px',
  };
  const textBar = (w: number, i: number) => (
    <div
      key={i}
      style={{height: 8, borderRadius: 4, background: `${theme.dim}4D`, width: w, marginTop: 9}}
    />
  );
  return (
    <div style={{position: 'relative', width: 1200, height: 620, opacity: enter}}>
      {/* 支点塔柱 */}
      <svg width={1200} height={620}>
        <line x1={PIVOT.x} y1={PIVOT.y} x2={PIVOT.x} y2={470} stroke={theme.dim} strokeWidth={7} />
        <line x1={PIVOT.x - 120} y1={472} x2={PIVOT.x + 120} y2={472} stroke={theme.dim} strokeWidth={7} strokeLinecap="round" />
        {/* 秤杆 + 吊索 */}
        <line x1={leftX} y1={leftY} x2={rightX} y2={rightY} stroke={theme.dim} strokeWidth={6} strokeLinecap="round" />
        <line x1={leftX} y1={leftY} x2={leftX} y2={leftY + STRING} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={rightX} y1={rightY} x2={rightX} y2={rightY + STRING} stroke={theme.dim} strokeWidth={2.5} />
        <circle cx={PIVOT.x} cy={PIVOT.y} r={9} fill={theme.bg} stroke={theme.text} strokeWidth={4} />
      </svg>
      {/* 支点判词：都是指令 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 60,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          color: theme.text,
          opacity: labelOn,
        }}
      >
        都是指令
      </div>
      {/* 左盘：散文（无编号 → 警示金） */}
      <div
        style={{
          position: 'absolute',
          left: leftX - 134,
          top: leftY + STRING,
          opacity: pans[0],
          transform: `translateY(${(1 - pans[0]) * 18}px)`,
        }}
      >
        <div style={panCard}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>散文</span>
            <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>SKILL.md</span>
          </div>
          {textBar(200, 0)}
          {textBar(160, 1)}
          {textBar(184, 2)}
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: tags,
            }}
          >
            <span
              style={{
                padding: '4px 14px',
                borderRadius: 8,
                border: `2.5px dashed ${theme.deny}`,
                color: theme.deny,
                fontFamily: theme.mono,
                fontSize: 20,
                boxShadow: `0 0 ${14 * Math.max(tagGlow, 0.001)}px ${theme.deny}66`,
              }}
            >
              v ?
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.deny}}>无编号</span>
          </div>
        </div>
      </div>
      {/* 右盘：代码（逐版发布 → 检疫绿=验证面） */}
      <div
        style={{
          position: 'absolute',
          left: rightX - 134,
          top: rightY + STRING,
          opacity: pans[1],
          transform: `translateY(${(1 - pans[1]) * 18}px)`,
        }}
      >
        <div style={panCard}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.serif, fontSize: 32, color: theme.text}}>代码</span>
            <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>index.js</span>
          </div>
          {textBar(200, 0)}
          {textBar(160, 1)}
          {textBar(184, 2)}
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: tags,
            }}
          >
            <span
              style={{
                padding: '4px 14px',
                borderRadius: 8,
                border: `2.5px solid ${theme.conceptDeep}`,
                color: theme.conceptDeep,
                fontFamily: theme.mono,
                fontSize: 20,
              }}
            >
              v1.2.3
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.conceptDeep}}>
              逐版
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────────────

export const P3: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-05');
  const bB = w('p3-06', 'p3-07');
  const bC = w('p3-08', 'p3-13');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 双门失效">
        <SceneTag chapter="P3" tagline="编号牌失踪" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')},
            {at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
            {at: at('p3-05') - bA.from, durationInFrames: dur('p3-05')},
          ]}
        >
          <VersionPlate at={at('p3-01') - bA.from} beatDur={dur('p3-01')} />
        </ArchifyYield>
        {/* 前句 p3-01 为装置句（非背靠背）→ 首章正常入场 */}
        <ArchifyRecap
          slug="version-gates"
          caption="编号牌 · 双门失效"
          cues={[
            {chapterId: 'vg-nofield', at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {chapterId: 'vg-pinned', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')},
            {chapterId: 'vg-floating', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
            {chapterId: 'vg-test', at: at('p3-05') - bA.from, durationInFrames: dur('p3-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 两个物种">
        <SceneTag chapter="P3" tagline="编号牌失踪" accent={theme.concept} />
        <Footnote delay={at('p3-06') - bB.from + Math.round(dur('p3-06') * 0.35)}>
          {'0 标签 vs 8 级'}
        </Footnote>
        {/* vg-test@p3-05 跨镜背靠背 → lead={false}；06→07 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="two-species"
          caption="两个物种 · 发版对照"
          lead={false}
          cues={[
            {chapterId: 'ts2-official', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')},
            {chapterId: 'ts2-supabase', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 锁文件孤本">
        <SceneTag chapter="P3" tagline="编号牌失踪" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p3-08') - bC.from, durationInFrames: dur('p3-08')},
            {at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')},
            {at: at('p3-10') - bC.from, durationInFrames: dur('p3-10')},
            {at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')},
            {at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')},
          ]}
        >
          <ProseCodeBalance at={at('p3-13') - bC.from} beatDur={dur('p3-13')} />
        </ArchifyYield>
        {/* ts2-supabase@p3-07 跨镜背靠背 → lead={false}；08→12 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="lockfile-orphan"
          caption="锁文件 · 孤本"
          lead={false}
          cues={[
            {chapterId: 'lo-four', at: at('p3-08') - bC.from, durationInFrames: dur('p3-08')},
            {chapterId: 'lo-flip', at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')},
            {chapterId: 'lo-rollback', at: at('p3-10') - bC.from, durationInFrames: dur('p3-10')},
            {chapterId: 'lo-lock', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')},
            {chapterId: 'lo-orphan', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
