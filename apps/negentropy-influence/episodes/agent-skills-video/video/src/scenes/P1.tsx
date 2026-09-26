/** P1 一个文件夹的标准（p1-01..p1-12，镜 1-A..1-G）——箱体解剖（六格两必填）→
 *  登记处即文件系统（同名即箱号）→ 正文与附件全自由 → 工艺一·从真实任务长出 →
 *  工艺二·跑了再改/会的别写 → 治理宪法「格式要小」→ 三处留白（放哪/谁查/航线）。
 *  主色货签粉（集装箱/知识/内容面）；〔M-001〕在 1-B（铭牌出箱）、1-D（便签入箱）、
 *  1-G（大箱留白图）回归；〔M-003〕终态停驻（铭牌锁死、问号常驻、金签落定）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';
import {EvidenceBadge, Stage, TerminalFeed} from '../components/devices';
import {CargoBox, Footnote, SceneTag} from '../components/motifs';
import {FadeUp, Pill} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 1-B 登记处 ──────────────────────────────────────────────────────────

/** 1-B 主装置：左〔M-001〕箱体弹出箱号铭牌（progress 抬起），useSpring 滑入右侧
 *  文件系统抽屉的同名槽位，snap 微过冲「咔」锁死，ok 绿 ✓ 只在同名对齐的验证
 *  瞬间亮起。白拿全球唯一身份，不向任何机构申请。 */
const RegistryPlate: React.FC<{ejectAt: number; slideAt: number; lockAt: number}> = ({
  ejectAt,
  slideAt,
  lockAt,
}) => {
  const lift = useProgress(ejectAt, DUR.f4);
  const slide = useSpring('settle', {at: slideAt, dur: DUR.f5});
  const lock = useSpring('snap', {at: lockAt, dur: DUR.f4});
  const frame = useCurrentFrame();
  const okP = progress(frame, lockAt + 4, DUR.f3);
  const slots = ['pdf-tools/', 'csv-cleaner/', 'wiki-q/', 'sheet-fix/'];
  const target = 1;
  return (
    <div style={{position: 'relative', width: 1360, height: 480}}>
      {/* 左：箱体与铭牌 */}
      <div style={{position: 'absolute', left: 30, top: 110}}>
        <CargoBox label="csv-cleaner" width={330} height={240} />
        <div style={{marginTop: 16, textAlign: 'center', fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          {'文件夹名 · 即箱号'}
        </div>
      </div>
      {/* 铭牌：弹出 → 滑向抽屉同名槽位 */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 196 - lift * 26,
          transform: `translateX(${slide * 780}px) scale(${1 + lock * 0.06})`,
        }}
      >
        <div
          style={{
            padding: '10px 22px',
            borderRadius: 8,
            border: `2.5px solid ${theme.conceptDeep}`,
            background: theme.panel,
            fontFamily: theme.mono,
            fontSize: 26,
            color: theme.conceptDeep,
            boxShadow: `0 8px 24px ${theme.conceptDeep}22`,
          }}
        >
          {'csv-cleaner'}
        </div>
      </div>
      {/* 右：文件系统抽屉（登记处） */}
      <div style={{position: 'absolute', right: 40, top: 56, width: 480}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.concept, marginBottom: 10}}>
          {'文件系统 · 登记处'}
        </div>
        {slots.map((s, i) => {
          const hot = i === target;
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 64,
                borderBottom: `2px dashed ${hot ? theme.conceptDeep : theme.panelBorder}`,
                padding: '0 14px',
                background: hot ? `${theme.conceptDeep}12` : undefined,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 24, color: hot ? theme.text : theme.dim}}>{s}</span>
              {hot && okP > 0 ? (
                <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.ok, opacity: okP}}>{'✓ 同名'}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 1-D 工艺一 · 长出来 ─────────────────────────────────────────────────

/** 1-D 主装置：左工作台 TerminalFeed 跑真实任务（useProgress 进度条推满一轮），
 *  人纠偏冒出 deny 便签「库X 会踩坑」，useSpring 飞入右侧开盖〔M-001〕箱的
 *  gotchas 节并钉住（向右=写进手册进箱）。 */
const GrowWorkbench: React.FC<{
  taskAt: number;
  taskDur: number;
  fixAt: number;
  flyAt: number;
  pinAt: number;
}> = ({taskAt, taskDur, fixAt, flyAt, pinAt}) => {
  const bar = useProgress(taskAt, taskDur);
  const fly = useSpring('settleSoft', {at: flyAt, dur: DUR.f6});
  const frame = useCurrentFrame();
  const fixP = progress(frame, fixAt, DUR.f4);
  const pinP = progress(frame, pinAt, DUR.f3);
  const flight = Math.min(1, Math.max(0, fly));
  return (
    <div style={{position: 'relative', width: 1420, height: 560}}>
      {/* 左：真实任务工作台 */}
      <div style={{position: 'absolute', left: 0, top: 60, display: 'flex', flexDirection: 'column', gap: 18}}>
        <TerminalFeed
          at={taskAt}
          title="run clean.py data.csv"
          lines={[
            {text: '× 列名带空格 · 解析失败', danger: true},
            {text: '△ 人纠偏 · 换写法'},
            {text: '✓ 重跑通过', ok: true},
          ]}
        />
        <div style={{width: 640}}>
          <div style={{height: 8, borderRadius: 4, background: theme.panelBorder, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${bar * 100}%`, background: theme.conceptDeep, borderRadius: 4}} />
          </div>
        </div>
      </div>
      {/* 纠偏便签：从工作台飞向箱内 gotchas 节 */}
      <div
        style={{
          position: 'absolute',
          left: 620,
          top: 262 - Math.sin(Math.PI * flight) * 64,
          transform: `translateX(${flight * 470}px)`,
          opacity: fixP,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderRadius: 4,
            background: `${theme.deny}26`,
            border: `2px solid ${theme.deny}`,
            transform: 'rotate(-3deg)',
            boxShadow: `0 6px 18px ${theme.deny}22`,
            fontFamily: theme.sans,
            fontSize: 27,
            color: theme.text,
          }}
        >
          {'库X 会踩坑'}
        </div>
      </div>
      {/* 右：开盖箱〔M-001〕，gotchas 节接住便签 */}
      <div style={{position: 'absolute', right: 60, top: 90}}>
        <div style={{position: 'relative'}}>
          <CargoBox width={380} height={300} opened />
          <div style={{position: 'absolute', left: 40, top: 46, width: 300}}>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'正文 · 自由书写'}</div>
            {[0.9, 0.75, 0.84].map((w, j) => (
              <div key={j} style={{height: 6, marginTop: 8, borderRadius: 3, width: `${w * 100}%`, background: theme.panelBorder}} />
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 40,
              bottom: 30,
              width: 300,
              padding: '10px 14px',
              borderRadius: 8,
              border: `2px solid ${theme.conceptDeep}`,
              background: `${theme.conceptDeep}14`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.conceptDeep}}>{'gotchas'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'含金量最高'}</span>
            {pinP > 0 ? (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: theme.deny,
                  opacity: pinP,
                  boxShadow: `0 0 ${8 * pinP}px ${theme.deny}`,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 1-F 治理宪法 ────────────────────────────────────────────────────────

/** 1-F 主装置：会议室长桌衬底，条文卡 useDraw 描边浮现——英文原话衬线逐字显
 *  （金句位），p1-10 落两枚中文要点锚点（格式要小=引航青 / 真实痛点）。 */
const CharterCard: React.FC<{drawAt: number; textAt: number; subAt: number}> = ({drawAt, textAt, subAt}) => {
  const draw = useDraw(drawAt, DUR.f6);
  const quote = useReveal('"Keep the format small"', {at: textAt, cps: 13});
  const frame = useCurrentFrame();
  const kickP = progress(frame, drawAt + 4, DUR.f4);
  return (
    <div style={{position: 'relative', width: 1040, height: 540}}>
      {/* 会议室长桌衬底 */}
      <div style={{position: 'absolute', left: 110, bottom: 4, width: 820, opacity: 0.55}}>
        <div style={{height: 16, borderRadius: 8, background: theme.panelBorder}} />
        <div style={{display: 'flex', justifyContent: 'space-between', padding: '0 30px'}}>
          {Array.from({length: 6}, (_, i) => (
            <div key={i} style={{width: 30, height: 12, borderRadius: 6, background: `${theme.dim}44`, marginTop: 8}} />
          ))}
        </div>
      </div>
      {/* 条文卡描边 */}
      <svg width={1040} height={540} viewBox="0 0 1040 540" style={{position: 'absolute', inset: 0}}>
        <rect
          x={10}
          y={10}
          width={1020}
          height={470}
          rx={22}
          fill={`${theme.concept}0C`}
          stroke={theme.concept}
          strokeWidth={3.5}
          {...draw}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 24, letterSpacing: 4, color: theme.concept, opacity: kickP}}>
          {'治理原则 · CONSTITUTION'}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 62, fontStyle: 'italic', color: theme.text}}>{quote}</div>
        <div style={{display: 'flex', gap: 28, marginTop: 8}}>
          <FadeUp delay={subAt}>
            <Pill color={theme.concept}>{'格式要小'}</Pill>
          </FadeUp>
          <FadeUp delay={subAt + 10}>
            <Pill color={theme.dim}>{'真实痛点'}</Pill>
          </FadeUp>
        </div>
      </div>
    </div>
  );
};

// ── 1-G 三处留白 ────────────────────────────────────────────────────────

/** 留白区：deny 金虚线框 + 问号 impulse 弹出后常驻（M-003）。 */
const BlankZone: React.FC<{label: string; lit: number; qAt: number; width: number; height: number}> = ({
  label,
  lit,
  qAt,
  width,
  height,
}) => {
  const pop = useImpulse({at: qAt, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const mark = progress(frame, qAt + 2, DUR.f4);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 14,
        border: `2.5px dashed ${theme.deny}`,
        background: `${theme.deny}0D`,
        opacity: lit,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 58,
          color: theme.deny,
          opacity: mark,
          transform: `scale(${0.6 + pop * 0.35})`,
        }}
      >
        {'?'}
      </span>
      <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{label}</span>
    </div>
  );
};

/** p1-12 金签：不是没做完——刻意不做。impulse 落章、歪斜停驻。 */
const IntentStamp: React.FC<{at: number}> = ({at}) => {
  const hit = useImpulse({at, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const mark = progress(frame, at + 2, DUR.f3);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: mark,
        transform: `rotate(-7deg) scale(${1 + hit * 0.12})`,
      }}
    >
      <div
        style={{
          padding: '12px 34px',
          borderRadius: 12,
          border: `3px solid ${theme.deny}`,
          fontFamily: theme.sans,
          fontSize: 38,
          fontWeight: 700,
          color: theme.deny,
        }}
      >
        {'刻意不做'}
      </div>
    </div>
  );
};

/** 1-G 主装置：中央大箱〔M-001〕（SKILL.md 稳在箱内——箱体是定死的），三块
 *  留白区 stagger 亮出：航线（顶·海运层）、放哪（左·堆场侧）、谁查（右·泊位
 *  侧），金问号逐个弹出常驻；p1-12「刻意不做」金签收束。 */
const BlankSpots: React.FC<{zoneAt: number; qBase: number; stampAt: number}> = ({zoneAt, qBase, stampAt}) => {
  const lit = useStagger(3, {at: zoneAt, dur: DUR.f4, stride: 14});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
      <div style={{fontFamily: theme.mono, fontSize: 28, letterSpacing: 3, color: theme.deny}}>{'三处留白'}</div>
      <div style={{position: 'relative', width: 1440, height: 540}}>
        {/* 航线（顶） */}
        <div style={{position: 'absolute', left: 505, top: 0}}>
          <BlankZone label="航线" lit={lit[0]} qAt={qBase} width={430} height={100} />
        </div>
        {/* 中央箱体〔M-001〕 */}
        <div style={{position: 'absolute', left: 460, top: 136}}>
          <div style={{position: 'relative'}}>
            <CargoBox width={520} height={370} opened />
            <div
              style={{
                position: 'absolute',
                left: 148,
                top: 150,
                padding: '10px 20px',
                borderRadius: 8,
                border: `2px solid ${theme.panelBorder}`,
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.dim,
              }}
            >
              {'SKILL.md'}
            </div>
          </div>
        </div>
        {/* 放哪（左·堆场侧） */}
        <div style={{position: 'absolute', left: 30, top: 300}}>
          <BlankZone label="放哪" lit={lit[1]} qAt={qBase + 14} width={300} height={150} />
        </div>
        {/* 谁查（右·泊位侧） */}
        <div style={{position: 'absolute', right: 30, top: 300}}>
          <BlankZone label="谁查" lit={lit[2]} qAt={qBase + 28} width={300} height={150} />
        </div>
      </div>
      <IntentStamp at={stampAt} />
    </div>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────────────

export const P1: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-03');
  const bB = w('p1-04', 'p1-06');
  const bC = w('p1-07', 'p1-08b');
  const bD = w('p1-08c', 'p1-08e');
  const bE = w('p1-08f', 'p1-08g');
  const bF = w('p1-09', 'p1-10');
  const bG = w('p1-11', 'p1-12');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 箱体解剖">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <ArchifyRecap
          slug="box-anatomy"
          caption="箱体解剖 · 六格两必填"
          cues={[
            {chapterId: 'ba-box', at: at('p1-01') - bA.from, durationInFrames: dur('p1-01')},
            {chapterId: 'ba-corner', at: at('p1-02') - bA.from, durationInFrames: dur('p1-02')},
            {chapterId: 'ba-name', at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 登记处">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p1-04') - bB.from, durationInFrames: dur('p1-04')},
            {at: at('p1-06') - bB.from, durationInFrames: dur('p1-06')},
          ]}
        >
          <RegistryPlate
            ejectAt={at('p1-05') - bB.from}
            slideAt={at('p1-05') - bB.from + 10}
            lockAt={at('p1-05') - bB.from + 30}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="identity-registry"
          caption="登记处 · 文件系统"
          cues={[
            {chapterId: 'ir-nocenter', at: at('p1-04') - bB.from, durationInFrames: dur('p1-04')},
            {chapterId: 'ir-deal', at: at('p1-06') - bB.from, durationInFrames: dur('p1-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="1-C 正文与附件">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <ArchifyRecap
          slug="box-anatomy"
          caption="正文与附件 · 规范不管"
          cues={[
            {chapterId: 'ba-body', at: at('p1-07') - bC.from, durationInFrames: dur('p1-07')},
            {chapterId: 'ba-annex', at: at('p1-08') - bC.from, durationInFrames: dur('p1-08')},
            {chapterId: 'ba-optional', at: at('p1-08a') - bC.from, durationInFrames: dur('p1-08a')},
            {chapterId: 'ba-validate', at: at('p1-08b') - bC.from, durationInFrames: dur('p1-08b')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 长出来">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p1-08c') - bD.from, durationInFrames: dur('p1-08c')},
            {at: at('p1-08e') - bD.from, durationInFrames: dur('p1-08e')},
          ]}
        >
          <GrowWorkbench
            taskAt={at('p1-08d') - bD.from}
            taskDur={dur('p1-08d')}
            fixAt={at('p1-08d') - bD.from + 14}
            flyAt={at('p1-08d') - bD.from + 30}
            pinAt={at('p1-08d') - bD.from + 52}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="craft-real-tasks"
          caption="工艺 · 从真实任务长出"
          cues={[
            {chapterId: 'cr-grow', at: at('p1-08c') - bD.from, durationInFrames: dur('p1-08c')},
            {chapterId: 'cr-gotchas', at: at('p1-08e') - bD.from, durationInFrames: dur('p1-08e')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 跑了再改">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <ArchifyRecap
          slug="craft-real-tasks"
          caption="工艺 · 写完就跑"
          cues={[
            {chapterId: 'cr-rerun', at: at('p1-08f') - bE.from, durationInFrames: dur('p1-08f')},
            {chapterId: 'cr-lean', at: at('p1-08g') - bE.from, durationInFrames: dur('p1-08g')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="1-F 治理宪法">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <EvidenceBadge text="agentskills.io · 治理原则原话" at={at('p1-09') - bF.from} />
        <Stage>
          <CharterCard
            drawAt={at('p1-09') - bF.from}
            textAt={at('p1-09') - bF.from + 10}
            subAt={at('p1-10') - bF.from}
          />
        </Stage>
      </Sequence>

      <Sequence {...bG} name="1-G 三处留白">
        <SceneTag chapter="P1" tagline="一个文件夹的标准" accent={theme.conceptDeep} />
        <Stage>
          <BlankSpots
            zoneAt={at('p1-11') - bG.from}
            qBase={at('p1-11') - bG.from + 16}
            stampAt={at('p1-12') - bG.from + 6}
          />
        </Stage>
        <Footnote delay={at('p1-12') - bG.from}>{'三处留白 · 后面摊牌'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
