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
      {/* 五层身份栈：居中放大，下期层呼吸预告（HarnessStackP6 内置） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: cards}}>
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
        {/* TODO(实装): 全新上下文（正确）↔ 缓存友好前缀（成本）天平；第二对取舍两行 */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <Panel accent={theme.mech}>{'争议双栏 + 取舍两行（待实装）'}</Panel>
        </AbsoluteFill>
      </Sequence>

      <Sequence {...bC} name="6-C 护栏与口径">
        {/* TODO(实装): 护栏卡三行（教学发明/无对照实验/估算口径）浮现于前半拍 */}
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
