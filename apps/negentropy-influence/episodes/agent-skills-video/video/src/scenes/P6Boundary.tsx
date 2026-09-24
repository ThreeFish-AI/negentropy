/** P6 规范边界（p6-01..32）——权威天平、十三处分歧、三争议、未证明五条、金句收尾与渐黑。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useFadeOut, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {ActHUD, EvidenceBadge, Stage} from '../components/devices';

/** 6-A 天平。 */
const ScaleTip: React.FC<{at: number}> = ({at}) => {
  const tip = useSpring('settleSoft', {at: at + 8, dur: DUR.f6});
  const angle = tip * 9;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
      <div style={{display: 'flex', alignItems: 'flex-start', gap: 120, transform: `rotate(${-angle}deg)`, transformOrigin: 'center 40px', paddingBottom: 60}}>
        <div style={{padding: '16px 26px', borderRadius: 10, border: `2.5px solid ${theme.ok}`, background: `${theme.ok}12`, fontFamily: theme.serif, fontSize: 30, color: theme.ok}}>
          规范正文
        </div>
        <div style={{padding: '16px 26px', borderRadius: 10, border: `2.5px dashed ${theme.panelBorder}`, background: theme.panel, fontFamily: theme.serif, fontSize: 30, color: theme.dim}}>
          参考实现
        </div>
      </div>
      <svg width={60} height={60} viewBox="0 0 60 60">
        <polygon points="30,4 56,56 4,56" fill="none" stroke={theme.dim} strokeWidth={3} />
      </svg>
      <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.ok}}>格式要求，只以规范正文为准</div>
    </div>
  );
};

/** 6-B 分歧卡阵 + 六张真跑复现章。 */
const DiffCards: React.FC<{at: number; stampAt: number}> = ({at, stampAt}) => {
  const frame = useCurrentFrame();
  const cards = [
    '中文名判合规',
    '未知字段两口径',
    '逗号分隔不报错',
    '值内 --- 截断',
    '检查覆盖有限',
    '坏文件整体失败',
    'skill.md 回退',
    '空目录输出',
    '计数口径不一',
    'YAML 子集未定',
    '严格度分叉',
    '归一化未提',
    '规范表格漏一致',
  ];
  const stampP = useStagger(6, {at: stampAt, dur: DUR.f3, stride: 3});
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 12, maxWidth: 1100, justifyContent: 'center'}}>
        {cards.map((c, i) => {
          const p = progress(frame, at + i * 2, DUR.f2);
          const stamped = i < 6 ? stampP[i] : 0;
          return (
            <div
              key={c}
              style={{
                position: 'relative',
                padding: '10px 18px',
                borderRadius: 8,
                border: `2px solid ${stamped > 0.4 ? theme.ok : theme.panelBorder}`,
                background: stamped > 0.4 ? `${theme.ok}12` : theme.panel,
                fontFamily: theme.sans,
                fontSize: 20,
                color: stamped > 0.4 ? theme.ok : theme.dim,
                opacity: p,
              }}
            >
              {c}
              <div
                style={{
                  position: 'absolute',
                  right: -10,
                  top: -12,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: theme.ok,
                  color: theme.bg,
                  fontFamily: theme.sans,
                  fontSize: 14,
                  opacity: stamped,
                  transform: `rotate(${(1 - stamped) * -14}deg)`,
                }}
              >
                真跑复现
              </div>
            </div>
          );
        })}
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.text}}>13 处分歧 · 6 处真跑复现（规范 / 指南 / 参考实现三方对照）</div>
    </div>
  );
};

/** 6-C 严格 vs 宽容双门。 */
const TwoGates: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const open = progress(frame, at + 8, DUR.f5);
  return (
    <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'}}>
        <div style={{width: 200, height: 130, border: `3px solid ${theme.danger}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.serif, fontSize: 26, color: theme.danger}}>
          退回
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.danger}}>参考实现的检查命令</div>
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.dim}}>vs</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center'}}>
        <div style={{position: 'relative', width: 200, height: 130, border: `3px dashed ${theme.spine}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.serif, fontSize: 24, color: theme.spine}}>
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: 6,
              bottom: 6,
              width: 88,
              background: `${theme.spine}22`,
              transformOrigin: 'left',
              transform: `rotate(${open * -14}deg)`,
            }}
          />
          黄条上架
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.spine}}>客户端指南：提个醒，照样上架</div>
      </div>
    </div>
  );
};

/** 6-D 无锁柜门 + 三枚空卡。 */
const TrustGap: React.FC<{at: number}> = ({at}) => {
  const st = useStagger(3, {at: at + 10, dur: DUR.f4, stride: 7});
  const holes = ['没有签名盖章', '不查出处', '锁不住是哪一版'];
  return (
    <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
      <div
        style={{
          width: 300,
          height: 210,
          borderRadius: 12,
          border: `3px solid ${theme.forge}`,
          background: `${theme.forge}0E`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: theme.sans,
          color: theme.forge,
        }}
      >
        <div style={{fontSize: 52}}>🔓</div>
        <div style={{fontSize: 24}}>谁都能往里放书</div>
        <div style={{fontSize: 19, color: theme.dim}}>「Keep the format small」的取舍</div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        {holes.map((h, i) => (
          <div
            key={h}
            style={{
              width: 340,
              padding: '14px 22px',
              borderRadius: 10,
              border: `2px dashed ${theme.danger}77`,
              color: theme.danger,
              fontFamily: theme.sans,
              fontSize: 24,
              opacity: st[i],
              transform: `translateY(${(1 - st[i]) * 18}px)`,
            }}
          >
            {h}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 6-E 未证明五便签。 */
const UnprovenNotes: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const notes = [
    '省多少：没有实测数字',
    '几百本：书脊墙没人讨论',
    '触发准不准：只有写法建议',
    '信任与来源：无签名无版本',
    '过了检查 ≠ 合规 ≠ 好用',
  ];
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 20, maxWidth: 1080, justifyContent: 'center'}}>
      {notes.map((n, i) => {
        const p = progress(frame, at + i * 7, DUR.f4);
        return (
          <div
            key={n}
            style={{
              padding: '18px 24px',
              borderRadius: 6,
              background: theme.panel,
              border: `2px solid ${theme.dim}66`,
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
              fontFamily: theme.sans,
              fontSize: 23,
              color: theme.text,
              opacity: p,
              transform: `translateY(${(1 - p) * 30}px) rotate(${(i % 2 ? 1 : -1) * (1 - p) * 5}deg)`,
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
};

/** 6-F 金句 + 信源卡 + 渐黑（渐黑时长从末 beat 推导——红线四；本组件局部帧 0 = 末 beat 起点）。 */
const FinalCard: React.FC<{at: number; fadeDur: number; fadeFrames: number}> = ({at, fadeDur, fadeFrames}) => {
  const rise = useSpring('settle', {at, dur: DUR.f6});
  const frame = useCurrentFrame();
  const srcO = progress(frame, at + 40, DUR.f5);
  const out = useFadeOut(fadeDur, {frames: fadeFrames});
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, opacity: out}}>
      <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dim, opacity: rise}}>
        {'老师傅的经验 → 淬炼成手册 · 贴好书脊 · 按需抽取'}
      </div>
      <div style={{textAlign: 'center'}}>
        <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.text, opacity: rise}}>
          {'模型本身，一个参数都没有动。'}
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.forge, marginTop: 18, opacity: rise}} >
          {'变的只是：它在对的时刻，读到了对的那一页。'}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 26,
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.dim,
          opacity: srcO,
        }}
      >
        <span>agentskills.io</span>
        <span>agentskills/agentskills @69ef37e9（CC-BY-4.0 / Apache-2.0）</span>
        <span>本仓精读 docs/research/agent-infra/090</span>
      </div>
    </div>
  );
};

export const P6Boundary: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-04');
  const bB = w('p6-05', 'p6-10');
  const bC = w('p6-11', 'p6-16');
  const bD = w('p6-17', 'p6-21');
  const bE = w('p6-22', 'p6-26');
  const bF = w('p6-27', 'p6-32');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 权威天平">
        <SceneTag chapter="P6" tagline="规范边界" accent={theme.book} />
        <ArchifyYield cues={[{at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')}]}>
          <ScaleTip at={at('p6-01') - bA.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="authority-and-controversies"
          caption="格式要求只以规范正文为准"
          cues={[{chapterId: 'authority', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')}]}
        />
        <Footnote delay={30}>{'「specification.mdx is authoritative」— AGENTS.md'}</Footnote>
        <ActHUD lit={3} />
      </Sequence>

      <Sequence {...bB} name="6-B 十三处分歧">
        <SceneTag chapter="P6" tagline="规范边界" accent={theme.book} />
        <ArchifyYield
          cues={[
            {at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
            {at: at('p6-06') - bB.from, durationInFrames: dur('p6-06')},
          ]}
        >
          <DiffCards at={at('p6-05') - bB.from} stampAt={at('p6-06') - bB.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="authority-and-controversies"
          caption="13 处分歧 / 6 处真跑复现"
          cues={[
            {chapterId: 'diff-13', at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
            {chapterId: 'realrun', at: at('p6-06') - bB.from, durationInFrames: dur('p6-06')},
          ]}
        />
        <EvidenceBadge grade="lab" />
      </Sequence>

      <Sequence {...bC} name="6-C 争议一">
        <SceneTag chapter="P6" tagline="规范边界" accent={theme.book} />
        <ArchifyYield
          cues={[
            {at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')},
            {at: at('p6-14') - bC.from, durationInFrames: dur('p6-14')},
          ]}
        >
          <TwoGates at={at('p6-11') - bC.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="authority-and-controversies"
          caption="严格退回 vs 宽容上架"
          cues={[
            {chapterId: 'strict', at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')},
            {chapterId: 'lenient', at: at('p6-14') - bC.from, durationInFrames: dur('p6-14')},
          ]}
        />
        <Footnote delay={40}>归属：谷歌 Antigravity 文档 · 互联网架构委员会 RFC 9413</Footnote>
      </Sequence>

      <Sequence {...bD} name="6-D 争议二三">
        <SceneTag chapter="P6" tagline="规范边界" accent={theme.book} />
        <ArchifyYield cues={[{at: at('p6-20') - bD.from, durationInFrames: dur('p6-20')}]}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'center'}}>
            <Panel accent={`${theme.spine}77`} style={{padding: '16px 26px'}}>
              <span style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>
                争议二：AI 自己挑手册，还是由人点名？（挑错是静默的）
              </span>
            </Panel>
            <TrustGap at={at('p6-17') - bD.from} />
          </div>
        </ArchifyYield>
        <ArchifyRecap
          slug="authority-and-controversies"
          caption="争议三：格式极简，信任谁管"
          cues={[{chapterId: 'trust', at: at('p6-20') - bD.from, durationInFrames: dur('p6-20')}]}
        />
      </Sequence>

      <Sequence {...bE} name="6-E 没有证明的五条">
        <SceneTag chapter="P6" tagline="规范边界" accent={theme.book} />
        <ArchifyYield
          cues={[
            {at: at('p6-23') - bE.from, durationInFrames: dur('p6-23')},
            {at: at('p6-26') - bE.from, durationInFrames: dur('p6-26')},
          ]}
        >
          <UnprovenNotes at={at('p6-22') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="unproven-list"
          caption="材料没有证明的五件事"
          cues={[
            {chapterId: 'five', at: at('p6-23') - bE.from, durationInFrames: dur('p6-23')},
            {chapterId: 'check', at: at('p6-26') - bE.from, durationInFrames: dur('p6-26')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="6-F 收尾金句">
        <SceneTag chapter="P6" tagline="规范边界" accent={theme.book} />
        <Stage>
          <FinalCard at={6} fadeDur={bF.durationInFrames} fadeFrames={90} />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
