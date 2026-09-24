/** P4 书脊路由（p4-01..24）——模型读描述自判；正反例；静默落空；描述评测法。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDim, useDraw, useImpulse, useSpring, useStagger} from '../motion';
import {Footnote, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {ActHUD, SpineRow, Stage} from '../components/devices';

/** 4-A 工单飘到书脊墙前。 */
const TicketFloat: React.FC<{at: number}> = ({at}) => {
  const fly = useSpring('settle', {at, dur: DUR.f5});
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div
        style={{
          padding: '20px 28px',
          borderRadius: 12,
          background: theme.panel,
          border: `2.5px solid ${theme.forge}`,
          fontFamily: theme.sans,
          fontSize: 25,
          color: theme.text,
          maxWidth: 460,
          lineHeight: 1.6,
          opacity: fly,
          transform: `translateX(${(1 - fly) * -80}px) rotate(${(1 - fly) * -4}deg)`,
        }}
      >
        工单：从季度报告里抽出表格、填进表单
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 8}}>谁来接？</div>
      </div>
      <div style={{transform: `translateX(${fly * 20}px)`}}>
        <SpineRow names={['pdf-tools', 'md-tables', 'code-review', 'data-analysis', 'meeting', 'tool-06', 'tool-07']} at={at} />
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 12}}>
          不做关键词匹配 → 模型读完书脊，自己判断（按实现指南的说法）
        </div>
      </div>
    </div>
  );
};

/** 4-B 正反例对读。 */
const SpineVerdict: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const goodP = progress(frame, at, DUR.f5);
  const badP = progress(frame, at + 16, DUR.f5);
  const badge = progress(frame, at + 30, DUR.f4);
  return (
    <div style={{display: 'flex', gap: 60}}>
      <div
        style={{
          width: 560,
          padding: '24px 28px',
          borderRadius: 12,
          border: `2.5px solid ${theme.ok}`,
          background: `${theme.ok}12`,
          opacity: goodP,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.ok}}>好描述</div>
        <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text, marginTop: 12, lineHeight: 1.7}}>
          能从 PDF 里提取文字和表格，还能填表、合并文件。
          <div style={{color: theme.ok}}>用户一提到 PDF、表单或文档提取，就用它。</div>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.ok, marginTop: 14, opacity: goodP}}>→ 命中，抽出整本</div>
      </div>
      <div
        style={{
          width: 460,
          padding: '24px 28px',
          borderRadius: 12,
          border: `2.5px dashed ${theme.panelBorder}`,
          background: theme.panel,
          opacity: badP * 0.95,
          position: 'relative',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>差描述</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 12}}>{'「帮忙处理 PDF 相关的事。」'}</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '6px 14px',
            borderRadius: 8,
            border: `2px solid ${theme.spine}88`,
            color: theme.spine,
            fontFamily: theme.sans,
            fontSize: 19,
            opacity: badge,
            transform: `rotate(${(1 - badge) * -10}deg)`,
          }}
        >
          也满足硬性规定 · 上架检查不拦
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.danger, marginTop: 14, opacity: badP}}>
          → 落空（无报错 · 无警告）
        </div>
      </div>
    </div>
  );
};

/** 4-C 命中/落空双联。 */
const HitMiss: React.FC<{at: number}> = ({at}) => {
  const pull = useSpring('settle', {at, dur: DUR.f5});
  const sink = useDim({at: at + 10, to: 0.35, dur: DUR.f5});
  return (
    <div style={{display: 'flex', gap: 90, alignItems: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <div style={{fontSize: 64, opacity: pull, transform: `translateY(${(1 - pull) * 30}px)`}}>📘</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.ok, opacity: pull}}>整本被抽出，读进上下文</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 18, opacity: sink}}>
        <div style={{fontSize: 64}}>🌫️</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
          差描述的工单沉底
          <div style={{fontSize: 22}}>这本手册，就像从来没被放进柜子</div>
        </div>
      </div>
    </div>
  );
};

/** 4-D 分箱：应触发 / 不应触发 → 练习组 / 考核组。 */
const SortBins: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const pool = Array.from({length: 12});
  const split = progress(frame, at + 26, DUR.f5);
  return (
    <div style={{display: 'flex', gap: 40}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.spine}}>约 20 条提问（每条跑 3 次 · 过半算触发）</div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 560}}>
          {pool.map((_, i) => {
            const p = progress(frame, at + i * 2, DUR.f2);
            return (
              <div
                key={i}
                style={{
                  width: 64,
                  height: 40,
                  borderRadius: 6,
                  background: i < 6 ? `${theme.ok}30` : `${theme.danger}26`,
                  border: `1.5px solid ${i < 6 ? theme.ok : theme.danger}88`,
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: i < 6 ? theme.ok : theme.danger,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: p,
                }}
              >
                {i < 6 ? '应触发' : '不应'}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{width: 2, background: theme.panelBorder}} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
        {[
          {h: '练习组 ≈ 六成', b: '只看它的失败来改描述', c: theme.forge},
          {h: '考核组 ≈ 四成', b: '不参与改稿，留着当裁判', c: theme.spine},
        ].map((g, i) => {
          const p = progress(frame, at + 30 + i * 10, DUR.f4);
          return (
            <div
              key={g.h}
              style={{
                width: 420,
                padding: '18px 24px',
                borderRadius: 10,
                border: `2px solid ${g.c}88`,
                background: `${g.c}10`,
                opacity: split * p,
                transform: `translateX(${(1 - split * p) * 30}px)`,
              }}
            >
              <div style={{fontFamily: theme.serif, fontSize: 27, color: g.c}}>{g.h}</div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, marginTop: 8}}>{g.b}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 4-E 五轮曲线 + 1024 标尺。 */
const EvalCurve: React.FC<{at: number}> = ({at}) => {
  const line = useDraw(at, DUR.f6);
  const cap = useImpulse({at: at + 40, dur: DUR.f4, peak: 1});
  const pts = '0,150 60,120 120,60 180,84 240,70 300,92';
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>考核组得分（示意）</div>
        <svg width={340} height={180} viewBox="0 0 340 180">
          <polyline points={pts} fill="none" stroke={theme.spine} strokeWidth={4} {...line} />
          <circle cx={120} cy={60} r={9} fill={theme.ok} opacity={line.strokeDashoffset < 0.4 ? 1 : 0} />
          <circle cx={300} cy={92} r={6} fill={theme.dim} opacity={line.strokeDashoffset < 0.05 ? 1 : 0} />
        </svg>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.ok}}>第 3 轮最高 → 选它，不是最后一轮</div>
      </div>
      <div
        style={{
          padding: '16px 24px',
          borderRadius: 10,
          border: `${2 + cap * 2}px solid ${theme.danger}`,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.danger,
          transform: `scale(${1 + cap * 0.06})`,
        }}
      >
        硬上限 1024 字符
        <div style={{fontSize: 20, color: theme.dim, fontFamily: theme.mono}}>description.length ≤ 1024</div>
      </div>
    </div>
  );
};

export const P4Route: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-05');
  const bB = w('p4-06', 'p4-10');
  const bC = w('p4-11', 'p4-14');
  const bD = w('p4-15', 'p4-20');
  const bE = w('p4-21', 'p4-24');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 谁来做决定">
        <SceneTag chapter="P4" tagline="书脊路由" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')}]}>
          <TicketFloat at={at('p4-01') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="description-routing"
          caption="多数产品：模型自己判断"
          cues={[{chapterId: 'judge', at: at('p4-03') - bA.from, durationInFrames: dur('p4-03')}]}
        />
        <Footnote delay={34}>{'「The description carries the entire burden of triggering」— agentskills.io'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="4-B 正反例对读">
        <SceneTag chapter="P4" tagline="书脊路由" accent={theme.spine} />
        <ArchifyYield
          cues={[
            {at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        >
          <SpineVerdict at={at('p4-06') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="description-routing"
          caption="好描述做什么+何时用 / 差描述合规却含糊"
          cues={[
            {chapterId: 'good-desc', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'bad-desc', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 命中与落空">
        <SceneTag chapter="P4" tagline="书脊路由" accent={theme.spine} />
        <ArchifyYield cues={[{at: at('p4-12') - bC.from, durationInFrames: dur('p4-12')}]}>
          <HitMiss at={at('p4-11') - bC.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="description-routing"
          caption="命中 vs 静默落空"
          cues={[{chapterId: 'hit-miss', at: at('p4-12') - bC.from, durationInFrames: dur('p4-12')}]}
        />
        <Footnote delay={26}>实验用简化的判断规则代替模型（可复现）</Footnote>
      </Sequence>

      <Sequence {...bD} name="4-D 描述也要测">
        <SceneTag chapter="P4" tagline="书脊路由" accent={theme.spine} />
        <ArchifyYield
          cues={[
            {at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')},
            {at: at('p4-19') - bD.from, durationInFrames: dur('p4-19')},
            {at: at('p4-20') - bD.from, durationInFrames: dur('p4-20')},
          ]}
        >
          <SortBins at={at('p4-15') - bD.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="description-eval"
          caption="20 条提问 / 练习组与考核组"
          cues={[
            {chapterId: 'queries', at: at('p4-16') - bD.from, durationInFrames: dur('p4-16')},
            {chapterId: 'groups', at: at('p4-19') - bD.from, durationInFrames: dur('p4-19')},
            {chapterId: 'pick', at: at('p4-20') - bD.from, durationInFrames: dur('p4-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 考核组裁判">
        <SceneTag chapter="P4" tagline="书脊路由" accent={theme.spine} />
        <Stage>
          <EvalCurve at={at('p4-21') - bE.from} />
        </Stage>
        <Footnote delay={30}>曲线为方法示意，非实测数据</Footnote>
        <ActHUD lit={2} />
      </Sequence>
    </AbsoluteFill>
  );
};
