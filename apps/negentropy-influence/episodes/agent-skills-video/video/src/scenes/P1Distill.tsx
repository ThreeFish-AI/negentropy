/** P1 淬炼成册（p1-01..35）——空泛陷阱 → 四格便签 → 编辑台 → 坑点 → 执行修订 → 试岗对照。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {ActHUD, NoteQuad, Stage} from '../components/devices';

/** 1-A AI 起草页的空话 + 划掉线。 */
const DraftPage: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const st = useStagger(2, {at, dur: DUR.f4, stride: 10});
  const lines = ['妥善处理错误', '遵循最佳实践'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
      <div
        style={{
          width: 760,
          padding: '26px 34px',
          borderRadius: 10,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>AI 凭通用知识起草的初稿…</div>
        {lines.map((l, i) => {
          const strike = strikeAt(frame, at + 40 + i * 6);
          return (
            <div key={l} style={{position: 'relative', fontFamily: theme.sans, fontSize: 28, color: theme.dim, opacity: st[i]}}>
              {l}
              <div
                style={{
                  position: 'absolute',
                  left: -8,
                  right: -8,
                  top: '55%',
                  height: 3,
                  background: theme.danger,
                  transformOrigin: 'left',
                  transform: `scaleX(${strike})`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
const strikeAt = (frame: number, at: number) => progress(frame, at, DUR.f4);

/** 1-B 老师傅三次叫停。 */
const StopMarks: React.FC<{ats: number[]}> = ({ats}) => {
  const frame = useCurrentFrame();
  const marks = ['第一次叫停', '第二次叫停', '第三次叫停'];
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div style={{fontSize: 96}}>🧓</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        {marks.map((m, i) => {
          const p = markAt(frame, ats[i]);
          return (
            <div key={m} style={{display: 'flex', alignItems: 'center', gap: 14, opacity: p}}>
              <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.danger}}>✗</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{m}，纠正方向</div>
            </div>
          );
        })}
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>旁听全程的记录员：原料都在这了</div>
      </div>
    </div>
  );
};
const markAt = (frame: number, at: number) => progress(frame, at, DUR.f3);

/** 1-E 编辑台盖章 + 划掉一行。 */
const StampSweep: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const rows = ['第一步：检查输入', '第二步：执行转换', '解释 PDF 是什么', '第三步：核对输出'];
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      {rows.map((r, i) => {
        const stampP = progress(frame, at + i * 6, DUR.f3);
        const isCut = r === '解释 PDF 是什么';
        const cutP = isCut ? progress(frame, at + 34, DUR.f4) : 0;
        return (
          <div key={r} style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <div
              style={{
                width: 92,
                textAlign: 'center',
                padding: '6px 0',
                borderRadius: 8,
                border: `2px solid ${isCut ? theme.danger : theme.ok}99`,
                color: isCut ? theme.danger : theme.ok,
                fontFamily: theme.sans,
                fontSize: 19,
                opacity: stampP,
                transform: `rotate(${(1 - stampP) * -12}deg)`,
              }}
            >
              {isCut ? '不会错' : '会做错'}
            </div>
            <div style={{position: 'relative', fontFamily: theme.sans, fontSize: 27, color: isCut ? theme.dim : theme.text}}>
              {r}
              <div
                style={{
                  position: 'absolute',
                  left: -6,
                  right: -6,
                  top: '55%',
                  height: 3,
                  background: theme.danger,
                  transformOrigin: 'left',
                  transform: `scaleX(${cutP})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 1-F 坑点清单红笔。 */
const GotchaPad: React.FC<{at: number}> = ({at}) => {
  const d1 = useDraw(at, DUR.f5);
  const d2 = useDraw(at + 14, DUR.f5);
  const frame = useCurrentFrame();
  const hl = progress(frame, at + 30, DUR.f4);
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div
        style={{
          width: 640,
          padding: '26px 32px',
          borderRadius: 10,
          background: theme.panel,
          border: `2px solid ${theme.danger}66`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.danger, marginBottom: 16}}>坑点清单（写在正文首页）</div>
        <div style={{position: 'relative', fontFamily: theme.sans, fontSize: 25, color: theme.text, marginBottom: 12}}>
          · 数据库断了，健康检查照样报正常
          <div style={{position: 'absolute', left: -10, right: -10, top: 6, bottom: 6, background: `${theme.forge}22`, opacity: hl}} />
        </div>
        <svg width={560} height={26} viewBox="0 0 560 26">
          <path d="M6 16 C 140 4, 300 24, 554 10" stroke={theme.danger} strokeWidth={3} fill="none" {...d1} />
        </svg>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginTop: 10}}>每纠正 AI 一次，就添一条 ↗</div>
      </div>
      <svg width={300} height={140} viewBox="0 0 300 140">
        <path d="M20 110 C 80 20, 220 18, 280 90" stroke={theme.forge} strokeWidth={5} fill="none" {...d2} strokeLinecap="round" />
      </svg>
    </div>
  );
};

/** 1-H 试岗对照桌。 */
const TwinDesk: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const checks = ['①', '②', '③', '④'];
  const cutAll = progress(frame, at + 64, DUR.f5);
  const glowOnly = progress(frame, at + 76, DUR.f4);
  return (
    <div style={{display: 'flex', gap: 44}}>
      {[
        {name: '带手册', has: true, tone: theme.ok},
        {name: '两手空空', has: false, tone: theme.dim},
      ].map((who, wi) => (
        <div
          key={who.name}
          style={{
            width: 420,
            padding: '22px 26px',
            borderRadius: 12,
            background: theme.panel,
            border: `2px solid ${who.tone}66`,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
            <div style={{fontSize: 44}}>{who.has ? '📘' : '🙅'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 27, color: who.tone}}>{who.name}</div>
          </div>
          <div style={{display: 'flex', gap: 14}}>
            {checks.map((c, i) => {
              const pass = who.has || i < 2;
              const p = progress(frame, at + wi * 4 + i * 9, DUR.f3);
              return (
                <div key={c} style={{position: 'relative', width: 84, height: 96, opacity: p}}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 8,
                      border: `2px solid ${pass ? theme.ok : theme.danger}88`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: theme.mono,
                      fontSize: 28,
                      color: pass ? theme.ok : theme.danger,
                    }}
                  >
                    {pass ? '✓' : '✗'}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      right: -4,
                      bottom: -8,
                      fontSize: 13,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: theme.panelBorder,
                      color: theme.text,
                      fontFamily: theme.mono,
                      opacity: pass ? p : 0,
                    }}
                  >
                    证据
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center'}}>
        <div style={{position: 'relative', fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
          两边都过 → 删
          <div
            style={{
              position: 'absolute',
              left: -8,
              right: -8,
              top: '50%',
              height: 3,
              background: theme.danger,
              transformOrigin: 'left',
              transform: `scaleX(${cutAll})`,
            }}
          />
        </div>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 23,
            color: theme.ok,
            border: `2px solid ${theme.ok}88`,
            borderRadius: 8,
            padding: '8px 14px',
            opacity: glowOnly,
          }}
        >
          只有带手册才过 = 真价值
        </div>
      </div>
    </div>
  );
};

/** 1-G 执行再修订小回路（p1-27 承接，p1-28 起让位 archify）。 */
const ReviseLoop: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(3, {at, dur: DUR.f4, stride: 8});
  const steps = [
    ['初稿', theme.forge],
    ['真实任务跑一轮', theme.spine],
    ['全部结果回灌', theme.book],
  ];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
      {steps.map(([t, c], i) => (
        <React.Fragment key={t}>
          <div
            style={{
              padding: '18px 28px',
              borderRadius: 12,
              border: `2.5px solid ${c}`,
              background: `${c}14`,
              color: c,
              fontFamily: theme.sans,
              fontSize: 30,
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 22}px)`,
            }}
          >
            {t}
          </div>
          {i < steps.length - 1 ? (
            <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim, opacity: st[i + 1]}}>→</div>
          ) : null}
        </React.Fragment>
      ))}
      <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.forge, opacity: st[2]}}>↺</div>
    </div>
  );
};

/** 1-I 幕尾字牌。 */
const ActSeal: React.FC<{at: number}> = ({at}) => {
  const rise = useSpring('settle', {at, dur: DUR.f5});
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        opacity: rise,
        transform: `translateY(${(1 - rise) * 30}px)`,
      }}
    >
      <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>作者指南的推荐做法 · 不是格式的硬规定</div>
      <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.forge}}>被纠正过、被考过的经验，才算淬炼成册</div>
    </div>
  );
};

export const P1Distill: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p1-01', 'p1-06');
  const bB = w('p1-07', 'p1-11');
  const bC = w('p1-12', 'p1-15');
  const bD = w('p1-16', 'p1-18');
  const bE = w('p1-19', 'p1-21');
  const bF = w('p1-22', 'p1-26');
  const bG = w('p1-27', 'p1-28');
  const bH = w('p1-29', 'p1-33');
  const bI = w('p1-34', 'p1-35');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A 空泛陷阱">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')}]}>
          <DraftPage at={at('p1-02') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="distill-loop"
          caption="空泛陷阱：只凭通用知识"
          cues={[{chapterId: 'generic-trap', at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')}]}
        />
        <ActHUD lit={1} />
      </Sequence>

      <Sequence {...bB} name="1-B 真实任务">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <Stage>
          <StopMarks
            ats={[at('p1-09') - bB.from, at('p1-10') - bB.from, at('p1-11') - bB.from - 6].map((x) => Math.max(0, x))}
          />
        </Stage>
        <Footnote delay={20}>员工（AI）办真实工单 · 老师傅只在走偏时出手</Footnote>
      </Sequence>

      <Sequence {...bC} name="1-C 四格便签">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')}]}>
          <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
            <NoteQuad labels={['奏效的步骤', '纠正过的地方', '输入输出格式', '背景与约定']} at={at('p1-12') - bC.from} />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="distill-loop"
          caption="四格便签：步骤 / 纠正 / 格式 / 背景"
          cues={[{chapterId: 'four-notes', at: at('p1-12') - bC.from, durationInFrames: dur('p1-12')}]}
        />
        <Footnote delay={46}>记录员的便签 → 手册初稿</Footnote>
      </Sequence>

      <Sequence {...bD} name="1-D 资料合成">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p1-17') - bD.from, durationInFrames: dur('p1-17')}]}>
          <SourceShelf at={at('p1-16') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="distill-loop"
          caption="另一入口：拿旧资料合成"
          cues={[{chapterId: 'synthesize', at: at('p1-17') - bD.from, durationInFrames: dur('p1-17')}]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 编辑台">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p1-21') - bE.from, durationInFrames: dur('p1-21')}]}>
          <StampSweep at={at('p1-19') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="distill-loop"
          caption="编辑台：没有这条会做错吗"
          cues={[{chapterId: 'edit-cut', at: at('p1-21') - bE.from, durationInFrames: dur('p1-21')}]}
        />
      </Sequence>

      <Sequence {...bF} name="1-F 坑点清单">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p1-24') - bF.from, durationInFrames: dur('p1-24')}]}>
          <GotchaPad at={at('p1-22') - bF.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="distill-loop"
          caption="坑点清单：踩坑前先读到"
          cues={[{chapterId: 'gotchas', at: at('p1-24') - bF.from, durationInFrames: dur('p1-24')}]}
        />
      </Sequence>

      <Sequence {...bG} name="1-G 执行再修订">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield cues={[{at: at('p1-28') - bG.from, durationInFrames: dur('p1-28')}]}>
          <ReviseLoop at={at('p1-27') - bG.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="distill-loop"
          caption="执行 → 全部回灌 → 修订"
          cues={[{chapterId: 'execute-revise', at: at('p1-28') - bG.from, durationInFrames: dur('p1-28')}]}
        />
      </Sequence>

      <Sequence {...bH} name="1-H 试岗对照">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <ArchifyYield
          cues={[
            {at: at('p1-29') - bH.from, durationInFrames: dur('p1-29')},
            {at: at('p1-30') - bH.from, durationInFrames: dur('p1-30')},
            {at: at('p1-32') - bH.from, durationInFrames: dur('p1-32')},
            {at: at('p1-33') - bH.from, durationInFrames: dur('p1-33')},
          ]}
        >
          <TwinDesk at={at('p1-29') - bH.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="eval-twin-runs"
          caption="同一工单：带 vs 不带"
          cues={[
            {chapterId: 'twin', at: at('p1-29') - bH.from, durationInFrames: dur('p1-29')},
            {chapterId: 'with-without', at: at('p1-30') - bH.from, durationInFrames: dur('p1-30')},
            {chapterId: 'both-pass', at: at('p1-32') - bH.from, durationInFrames: dur('p1-32')},
            {chapterId: 'only-with', at: at('p1-33') - bH.from, durationInFrames: dur('p1-33')},
          ]}
        />
        <Footnote delay={30}>成绩板数字为指南示例，非实测</Footnote>
      </Sequence>

      <Sequence {...bI} name="1-I 定性收束">
        <SceneTag chapter="P1" tagline="淬炼成册" accent={theme.forge} />
        <Stage>
          <ActSeal at={6} />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 1-D 档案架：自家资料 vs 外购通用书。 */
const SourceShelf: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const own = ['事故复盘', '操作文档', '评审意见', '修复补丁'];
  return (
    <div style={{display: 'flex', gap: 80, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.forge}}>自家旧资料</div>
        <div style={{display: 'flex', gap: 12}}>
          {own.map((o, i) => {
            const p = progress(frame, at + i * 5, DUR.f3);
            return (
              <div
                key={o}
                style={{
                  width: 118,
                  height: 150,
                  borderRadius: 6,
                  border: `2px solid ${theme.forge}99`,
                  background: `${theme.forge}16`,
                  color: theme.forge,
                  fontFamily: theme.sans,
                  fontSize: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 20}px)`,
                }}
              >
                {o}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.ok}}>胜过</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, opacity: 0.65}}>
        <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>外面买的</div>
        <div
          style={{
            width: 220,
            height: 150,
            borderRadius: 6,
            border: `2px dashed ${theme.panelBorder}`,
            color: theme.dim,
            fontFamily: theme.sans,
            fontSize: 21,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          《通用最佳实践》
          <br />
          （放回书架）
        </div>
      </div>
    </div>
  );
};
