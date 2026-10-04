/** P0 五个失败现场（p0-01..p0-20，6 镜）——分镜 0-A…0-F。
 *  系列片头（HarnessStack 五层栈落板、本层点亮、缩退常驻条）→ 五失败蒙太奇
 *  （pc2-failures 逐章：丢计划/淹没/全带/打架/即崩）→ 病根错位示意
 *  （看到的 ≠ 需要的）→ 全景首亮（pc2-panorama pan-loop）。
 *  空间契约：HarnessBadge 顶带下移 top:64；画面内容 y≥56 起；字幕带 bottom≥150。
 *  archify 全屏独占；0-D 三章背靠背后两章 lead={false}。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HarnessBadge, HarnessStackP0, harnessStackCrossAt} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useProgress} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 0-A 开卷：五层栈落板 → 第二层（本层）点亮呼吸 → 缩退常驻条（ep1 OpeningStack 同构裁剪） */
const OpeningStack: React.FC<{span: number}> = ({span}) => {
  const recedeAt = Math.max(70, Math.round(span * 0.6));
  const crossAt = harnessStackCrossAt(recedeAt);
  const kill = useProgress(crossAt, DUR.f3);
  const badgeIn = useProgress(crossAt, 8);
  const atCard = Math.round(span * 0.42);
  const cardIn = useProgress(atCard, DUR.f5);
  const cardOut = useProgress(span - DUR.f5, DUR.f5);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{opacity: 1 - kill}}>
        <HarnessStackP0 recedeAt={recedeAt} />
      </div>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 780,
          width: 1920,
          textAlign: 'center',
          opacity: cardIn * (1 - cardOut),
          fontFamily: theme.serif,
          fontSize: 46,
          letterSpacing: 6,
          color: theme.text,
        }}
      >
        {'长任务 · 五种失灵'}
      </div>
    </AbsoluteFill>
  );
};

/** 0-E 装置：上下两行（看到的 ↔ 需要的）错位对照，未对齐格红色警示（M-003）。
 *  两行格组先后推入（translateX 渐入，as-built）；台面标注为 storyboard 0-E 原文（钉顶部）。 */
const MisalignRow: React.FC = () => {
  const inTag = useProgress(0, DUR.f4);
  const inSeen = useProgress(DUR.f2, DUR.f4);
  const inNeed = useProgress(DUR.f3, DUR.f4);
  const seen = ['计划', '过程', '知识', '指令', '管线'];
  const need = ['计划', '结论', '此刻', '实况', '续命'];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 210, top: 226, width: 1500, opacity: inTag, fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 3}}>
        {'台面 · 上下文＝模型这一轮看到的全部消息'}
      </div>
      <div style={{position: 'absolute', left: 210, top: 300, width: 1500}}>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, letterSpacing: 4, marginBottom: 18}}>
          {'模型看到的'}
        </div>
        <div style={{display: 'flex', gap: 20, opacity: inSeen, transform: `translateX(${(1 - inSeen) * -48}px)`}}>
          {seen.map((t) => (
            <div key={t} style={{width: 276, height: 92, borderRadius: 10, background: theme.panel, border: `1px solid ${theme.panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.serif, fontSize: 30, color: theme.text}}>
              {t}
            </div>
          ))}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, letterSpacing: 4, margin: '34px 0 18px'}}>
          {'它此刻需要的'}
        </div>
        <div style={{display: 'flex', gap: 20, opacity: inNeed, transform: `translateX(${(1 - inNeed) * 48}px)`}}>
          {need.map((t, i) => (
            <div key={t} style={{width: 276, height: 92, borderRadius: 10, background: theme.panel, border: `1px solid ${i === 0 ? theme.core : theme.danger}`, boxShadow: i === 0 ? 'none' : `0 0 18px ${theme.danger}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.serif, fontSize: 30, color: i === 0 ? theme.core : theme.danger}}>
              {t}
            </div>
          ))}
        </div>
        <div style={{marginTop: 44, opacity: inNeed, fontFamily: theme.sans, fontSize: 24, color: theme.dim, letterSpacing: 2}}>
          {'错位了 —— 供给没人管'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P0Failures: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-05');
  const bC = w('p0-06', 'p0-08');
  const bD = w('p0-09', 'p0-12');
  const bE = w('p0-13', 'p0-15c');
  const bF = w('p0-16', 'p0-20');

  return (
    <AbsoluteFill>
      {/* 常驻条逐镜渲染（兄弟集同款）：0-A 走 OpeningStack 的 badgeIn 交叉淡入揭示，
          0-E 与四个 archify 镜各自镜内挂——archify 内框 y150 起、顶带透明，badge 位
          不被覆盖；逐镜补挂而非场景级副本（防 0-A/0-E 双显）。 */}
      <Sequence {...bA} name="0-A 系列片头（3D）">
        <OpeningStack span={bA.durationInFrames} />
      </Sequence>

      <Sequence {...bB} name="0-B 丢计划">
        <HarnessBadge style={BADGE_STYLE} />
        <ArchifyRecap slug="pc2-failures" caption="失败现场" cues={[
          {chapterId: 'fail-plan', at: at('p0-03') - bB.from, durationInFrames: dur('p0-03') + dur('p0-04') + dur('p0-05')},
        ]} />
      </Sequence>

      <Sequence {...bC} name="0-C 淹没">
        <HarnessBadge style={BADGE_STYLE} />
        <ArchifyRecap slug="pc2-failures" caption="失败现场" lead={false} cues={[
          {chapterId: 'fail-flood', at: at('p0-06') - bC.from, durationInFrames: dur('p0-06') + dur('p0-07') + dur('p0-08')},
        ]} />
      </Sequence>

      <Sequence {...bD} name="0-D 全带·打架·即崩">
        <HarnessBadge style={BADGE_STYLE} />
        {/* p0-09 为章前空窗句（失败三引入），三章背靠背：后两章 lead={false} */}
        <ArchifyRecap slug="pc2-failures" caption="失败现场" cues={[
          {chapterId: 'fail-carry', at: at('p0-10') - bD.from, durationInFrames: dur('p0-10')},
          {chapterId: 'fail-clash', at: at('p0-11') - bD.from, durationInFrames: dur('p0-11'), fit: 'trim'},
          {chapterId: 'fail-crash', at: at('p0-12') - bD.from, durationInFrames: dur('p0-12'), fit: 'trim'},
        ]} />
      </Sequence>

      <Sequence {...bE} name="0-E 病根错位">
        <HarnessBadge style={BADGE_STYLE} />
        <MisalignRow />
      </Sequence>

      <Sequence {...bF} name="0-F 全景首亮">
        <HarnessBadge style={BADGE_STYLE} />
        <ArchifyRecap slug="pc2-panorama" caption="一个循环 · 五个挂点" cues={[
          {chapterId: 'pan-loop', at: at('p0-16') - bF.from, durationInFrames: dur('p0-16') + dur('p0-16b') + dur('p0-17') + dur('p0-18') + dur('p0-19') + dur('p0-20')},
        ]} />
      </Sequence>
    </AbsoluteFill>
  );
};
