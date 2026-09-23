/** P3 两档检索（p3-01..23）——默认平铺 vs 豪华递归 + 废弃文档陷阱 + 借阅推车。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useImpulse, useProgress, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {EvidenceBadge, LibraryHUD} from '../components/devices';

/** 3-D 废弃文档陷阱：旧卡涌入平铺档前三；专家红叉只在豪华档生效。 */
const GraveCards: React.FC<{at: number; crossAt: number}> = ({at, crossAt}) => {
  const old = useStagger(3, {at, stride: 8, dur: DUR.f5});
  const cross = useProgress(crossAt, DUR.f4);
  const hit = useImpulse({at: crossAt, dur: DUR.f5});
  const rows = [
    {t: '旧版客户退款审批流程 v12（已废弃）', s: '旧流程 · 措辞高度重合'},
    {t: '旧版客户退款审批流程 v03（已废弃）', s: '平铺档 top-3 全被占住'},
    {t: '现行客户退款审批流程', s: '真答案被挤出候选'},
  ];
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 170, display: 'flex', gap: 60, justifyContent: 'center', alignItems: 'flex-start'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {rows.map((r, i) => {
          const dead = i < 2;
          return (
            <div
              key={i}
              style={{
                width: 430,
                padding: '12px 18px',
                borderRadius: 10,
                border: `2px solid ${dead ? theme.danger : theme.mint}`,
                background: dead ? `${theme.danger}10` : `${theme.mint}12`,
                opacity: old[i],
                transform: `translateX(${(1 - old[i]) * -26}px)`,
                position: 'relative',
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 17, color: dead ? theme.danger : theme.mint}}>{r.t}</div>
              <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 4}}>{r.s}</div>
              {dead && (
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 8,
                    fontSize: 26,
                    color: theme.danger,
                    transform: `scale(${0.6 + 0.4 * cross + 0.3 * hit})`,
                    opacity: cross,
                  }}
                >
                  ✕
                </div>
              )}
            </div>
          );
        })}
        <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, textAlign: 'center', marginTop: 4}}>
          专家认出「已废弃」→ 降权淘汰（豪华档）
        </div>
      </div>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 58}}>🔍</div>
        <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text, marginTop: 6}}>重排专家逐条细读</div>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 4}}>rerank · 贵而准</div>
      </div>
    </div>
  );
};

/** 3-E 借阅推车：薄本换厚本、装不下降档。 */
const CartSwap: React.FC<{at: number}> = ({at}) => {
  const swap = useProgress(at, DUR.f6);
  const down = useProgress(at + 30, DUR.f5);
  const thick = 1 + 0.9 * swap;
  return (
    <div style={{position: 'absolute', inset: 0, paddingTop: 300, display: 'flex', gap: 80, justifyContent: 'center', alignItems: 'flex-start'}}>
      <div style={{fontSize: 96, transform: `translateX(${-30 * swap}px)`}}>🛒</div>
      <div style={{display: 'flex', gap: 26, alignItems: 'flex-end'}}>
        <div style={{width: 60, height: 40 * thick, background: `${theme.mint}44`, border: `2px solid ${theme.mint}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 13, color: theme.mint}}>
          原文
        </div>
        <div style={{width: 60, height: 40, background: `${theme.peri}33`, border: `2px solid ${theme.peri}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 13, color: theme.peri, opacity: 1 - 0.7 * down}}>
          摘要
        </div>
        <div style={{width: 60, height: 26, background: `${theme.peri}22`, border: `1px dashed ${theme.peri}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 12, color: theme.peri, opacity: down}}>
          降档
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, width: 300, lineHeight: 1.8}}>
        先广后深 · 有余量换厚本
        <br />
        装不下<b style={{color: theme.text}}>降档拿薄的</b>
        <br />
        <span style={{color: theme.danger}}>绝不截断半句</span>
      </div>
    </div>
  );
};

export const P3Retrieval: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-05');
  const bB = w('p3-07', 'p3-08');
  const bC = w('p3-09', 'p3-15');
  const bD = w('p3-16', 'p3-19');
  const bE = w('p3-20', 'p3-23');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 默认档是平铺">
        <SceneTag chapter="P3" tagline="两档检索" accent={theme.rose} />
        <ArchifyRecap
          slug="retrieval-phase"
          caption="QUICK 平铺 · find 固定"
          cues={[{chapterId: 'quick', at: at('p3-01') - bA.from, durationInFrames: dur('p3-01')}, {chapterId: 'quick', at: at('p3-02') - bA.from, durationInFrames: dur('p3-02'), fit: 'hold'}, {chapterId: 'quick', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03'), fit: 'hold'}, {chapterId: 'quick', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04'), fit: 'hold'}, {chapterId: 'quick', at: at('p3-05') - bA.from, durationInFrames: dur('p3-05'), fit: 'hold'}]}
        />
        <EvidenceBadge grade="official" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bB} name="3-B 咨询台拆单">
        <SceneTag chapter="P3" tagline="两档检索" accent={theme.mint} />
        <ArchifyRecap
          slug="intent-typed-queries"
          caption="意图分析 · 拆检索单"
          lead={false}
          cues={[{chapterId: 'split', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')}, {chapterId: 'split', at: at('p3-08') - bB.from, durationInFrames: dur('p3-08'), fit: 'hold'}]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bC} name="3-C 逐架下钻">
        <SceneTag chapter="P3" tagline="两档检索" accent={theme.mint} />
        <ArchifyRecap
          slug="retrieval-phase"
          caption="豪华档 · 唯一剪枝"
          lead={false}
          cues={[
            {chapterId: 'thinking', at: at('p3-09') - bC.from, durationInFrames: dur('p3-09')}, {chapterId: 'thinking', at: at('p3-10') - bC.from, durationInFrames: dur('p3-10'), fit: 'hold'},
            {chapterId: 'prune', at: at('p3-11') - bC.from, durationInFrames: dur('p3-11')}, {chapterId: 'prune', at: at('p3-12') - bC.from, durationInFrames: dur('p3-12'), fit: 'hold'}, {chapterId: 'prune', at: at('p3-13') - bC.from, durationInFrames: dur('p3-13'), fit: 'hold'}, {chapterId: 'prune', at: at('p3-15') - bC.from, durationInFrames: dur('p3-15'), fit: 'hold'},
          ]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bD} name="3-D 废弃文档陷阱 · 代码走廊②">
        <SceneTag chapter="P3" tagline="两档检索" accent={theme.danger} />
        <GraveCards at={at('p3-17') - bD.from} crossAt={at('p3-19') - bD.from} />
        <div style={{position: 'absolute', left: 430, top: 640, width: 1060}}>
          <TerminalLog
            prompt="uv run openviking_lab.py --selftest"
            lines={[
              {text: 'QUICK   recall@3 = 0.75   [陷阱] ✘ 客户退款审批流程是什么 → legacy-refund/v12…', color: theme.danger, at: at('p3-18') - bD.from},
              {text: 'THINKING recall@3 = 1.00（展开 43 个书架） [陷阱] ✔ → refund/refund-flow.md', color: theme.mint, at: at('p3-19') - bD.from},
            ]}
            caption="lab S3 · 两档对照实测"
          />
        </div>
        <EvidenceBadge grade="lab" />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>

      <Sequence {...bE} name="3-E 借阅推车">
        <SceneTag chapter="P3" tagline="两档检索" accent={theme.mint} />
        <ArchifyYield cues={[{at: at('p3-21') - bE.from, durationInFrames: dur('p3-21')}, {at: at('p3-22') - bE.from, durationInFrames: dur('p3-22')}, {at: at('p3-23') - bE.from, durationInFrames: dur('p3-23')}]}>
          <CartSwap at={at('p3-20') - bE.from} />
        </ArchifyYield>
        <ArchifyRecap
          slug="retrieval-phase"
          caption="借阅推车 · 降档不截断"
          cues={[{chapterId: 'asm', at: at('p3-21') - bE.from, durationInFrames: dur('p3-21')}, {chapterId: 'asm', at: at('p3-22') - bE.from, durationInFrames: dur('p3-22'), fit: 'hold'}, {chapterId: 'asm', at: at('p3-23') - bE.from, durationInFrames: dur('p3-23'), fit: 'hold'}]}
        />
        <LibraryHUD lit={3} at={-30} />
      </Sequence>
    </AbsoluteFill>
  );
};
