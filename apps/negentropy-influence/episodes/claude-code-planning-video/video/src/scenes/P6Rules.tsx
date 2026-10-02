/** P6 五条规律（p6-01..p6-17，4 镜）——分镜 6-A…6-D。
 *  五规律逐条（pc2-rules 五章接力，一条一拍）→ 争议双栏（原生：全新上下文 ↔
 *  缓存友好前缀 + 第二对取舍）→ 护栏卡三行 + 数字口径两章（pc2-ablation-bar）→
 *  系列身份卡 + 下期卡 + 信源卡四行 + 工坊灯牌收暗（红线四：末 beat 总时长推导渐黑）。
 *  空间契约：下期卡标题主段=「会丢的和不能丢的」（check_series 规则 8 受检硬编码）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel} from '../components/motifs';
import {HarnessBadge, HarnessStackP6} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useFadeOut, useProgress, useStagger} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 6-D 收尾：五层身份栈（本层点亮、下期层呼吸）+ 本集/下期标题卡 + 信源卡四行 + 末 36 帧渐黑。
 *  标题主段 = check_series 规则 8 受检硬编码（改标题先改 series.json 再同步此串）。 */
const SeriesFinale: React.FC<{span: number; atCards: number}> = ({span, atCards}) => {
  const cards = useProgress(atCards, DUR.f5);
  const items = useStagger(4, {at: atCards, dur: DUR.f4, stride: DUR.f2});
  const keep = useFadeOut(span, {frames: 36});
  const sources = [
    '官方文档 · code.claude.com（取数 2026-10）',
    'Anthropic Engineering 博客',
    '第三方源码分析（片中已逐处标注）',
    '画面数字均为实测口径',
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 五层身份栈：右侧居中（y≥56 安全区内），下期层呼吸预告（HarnessStackP6 内置） */}
      <div style={{position: 'absolute', left: 1210, top: 330, opacity: cards}}>
        <HarnessStackP6 at={atCards} nextBreathAt={atCards + DUR.f5} />
      </div>

      {/* 本集标题卡（规则 8 受检主段） */}
      <div style={{position: 'absolute', left: 210, top: 250, opacity: items[0] ?? 0}}>
        <Panel style={{padding: '20px 30px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 3}}>
            {'本期 · 规划与协调'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 8}}>
            {'规划与协调：视野错位的五种修正手法'}
          </div>
        </Panel>
      </div>

      {/* 下期卡（规则 8 受检主段） */}
      <div style={{position: 'absolute', left: 210, top: 470, opacity: items[1] ?? 0}}>
        <Panel style={{padding: '20px 30px', border: `1px solid ${theme.mechDeep}`}}>
          <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 3}}>
            {'下期 · 记忆管理'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.mech, marginTop: 8}}>
            {'会丢的和不能丢的'}
          </div>
        </Panel>
      </div>

      {/* 信源卡四行（观众层固定行） */}
      <div style={{position: 'absolute', left: 210, top: 680, opacity: items[2] ?? 0}}>
        <Panel style={{padding: '16px 24px'}}>
          {sources.map((t) => (
            <div key={t} style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, lineHeight: 1.9}}>
              {t}
            </div>
          ))}
        </Panel>
      </div>

      {/* 渐黑遮罩：末 36 帧，窗取整镜时长（红线四） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />
    </AbsoluteFill>
  );
};

/** 6-C 前半拍装置：护栏卡三行（storyboard 6-C）——p6-11..12 浮现，archify 接手前渐隐。
 *  行文只放关键词对（画面纪律），口播细节留给字幕。 */
const GuardCard: React.FC<{out: number}> = ({out}) => {
  const rows = useStagger(3, {at: 0, dur: DUR.f4, stride: DUR.f3});
  const fade = useProgress(out, DUR.f4);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, top: 360, width: 1920, display: 'flex', justifyContent: 'center', opacity: 1 - fade}}>
        <Panel style={{padding: '30px 52px', display: 'flex', flexDirection: 'column', gap: 26}}>
          {[
            {k: '三轮提醒', v: '教学发明'},
            {k: '完成率', v: '无对照实验'},
            {k: '篇幅估算', v: '只是口径'},
          ].map((r, i) => (
            <div key={r.v} style={{display: 'flex', alignItems: 'baseline', gap: 22, opacity: rows[i] ?? 0, transform: `translateY(${(1 - (rows[i] ?? 0)) * 16}px)`}}>
              <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, letterSpacing: 3}}>{r.k}</div>
              <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.mech, letterSpacing: 5}}>{r.v}</div>
            </div>
          ))}
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 6-B 装置：争议双栏（全新上下文 ↔ 缓存友好前缀）+ 第二对取舍两行 */
const ControversyCols: React.FC<{at07: number; at10b: number}> = ({at07, at10b}) => {
  const cols = useStagger(2, {at: at07, dur: 18, stride: 14});
  const pair2 = useProgress(at10b, 18);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <HarnessBadge style={BADGE_STYLE} />
      <div style={{position: 'absolute', left: 230, top: 270, display: 'flex', gap: 60}}>
        {[
          {t: '教学版', s: '全新上下文', why: '图的是正确', tone: theme.mech},
          {t: '真实产品侧', s: '缓存友好前缀', why: '图的是成本（教程作者源码分析）', tone: theme.core},
        ].map((c, i) => (
          <div
            key={c.s}
            style={{
              width: 480,
              padding: '24px 32px',
              borderRadius: 12,
              background: theme.panel,
              border: `1px solid ${c.tone}77`,
              opacity: cols[i] ?? 0,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim, letterSpacing: 3}}>{c.t}</div>
            <div style={{fontFamily: theme.serif, fontSize: 29, color: c.tone, marginTop: 10}}>{c.s}</div>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.text, marginTop: 12}}>{c.why}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, top: 560, width: 1920, textAlign: 'center', opacity: cols[1] ?? 0, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
        {'两派账本不同 · 都对'}
      </div>
      <div style={{position: 'absolute', left: 380, top: 680, width: 1160, opacity: pair2}}>
        {['消息流 · 省钱 · 会被裁', '常驻指令区 · 稳定 · 花钱'].map((t) => (
          <div key={t} style={{fontFamily: theme.serif, fontSize: 24, color: theme.text, textAlign: 'center', lineHeight: 2.1}}>
            {t}
          </div>
        ))}
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, textAlign: 'center', marginTop: 8}}>
          {'按使用频率分档'}
        </div>
      </div>
    </AbsoluteFill>
  );
};


export const P6Rules: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-07', 'p6-10d');
  const bC = w('p6-11', 'p6-14b');
  const bD = w('p6-15', 'p6-17');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="6-A 五规律快板">
        <ArchifyRecap slug="pc2-rules" caption="五条规律" cues={[
          {chapterId: 'rule-position', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')},
          {chapterId: 'rule-state', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')},
          {chapterId: 'rule-lossy', at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
          {chapterId: 'rule-ledger', at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
          {chapterId: 'rule-structure', at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="6-B 争议双栏">
        <ControversyCols at07={0} at10b={at('p6-10b') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="6-C 护栏与口径">
        <GuardCard out={at('p6-13') - bC.from - DUR.f4} />
        <ArchifyRecap slug="pc2-ablation-bar" caption="数字口径" cues={[
          {chapterId: 'ablation-scale', at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')},
          {chapterId: 'ablation-ruling', at: at('p6-14') - bC.from, durationInFrames: dur('p6-14') + dur('p6-14b')},
        ]} />
      </Sequence>

      <Sequence {...bD} name="6-D 系列卡收尾">
        <SeriesFinale span={bD.durationInFrames} atCards={Math.round(bD.durationInFrames * 0.18)} />
      </Sequence>
    </AbsoluteFill>
  );
};
