/** P3 知识按需进场（p3-01..p3-19，5 镜）——分镜 3-A…3-E。
 *  挂点③回照（panorama pan-m3）→ 两级结构与成本（pc2-skill-levels 两章）→
 *  SQL 规范走查（原生：标签常驻垫纸 + 点名后手册抽出经工具结果进场）→
 *  两种命运（levels-lifecycle）→ 消融与结论（pc2-skill-cost 两章）。
 *  空间契约：抽屉标签=卡片系（不得与工序卡/扉页目录撞名）；token 数字带估算口径角标。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useProgress} from '../motion';

const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 3-C 规范走查：标签常驻垫纸（左）→ 点名（中）→ 手册整本抽出经工具结果落进消息流（右） */
const SkillWalk: React.FC<{at08: number; at10: number; at11: number}> = ({at08, at10, at11}) => {
  const base = useProgress(at08, DUR.f5);
  const pick = useProgress(at10, DUR.f5);
  const enter = useProgress(at11, DUR.f6);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 左：系统指令区（垫纸）——标签常驻 */}
      <div style={{position: 'absolute', left: 240, top: 280, width: 430, opacity: base}}>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3, marginBottom: 14}}>
          {'系统指令区 · 每轮常驻'}
        </div>
        {['sql-style　SQL 规范', 'api-doc　接口约定', 'react-style　前端规范'].map((t, i) => (
          <div
            key={t}
            style={{
              padding: '12px 20px',
              marginBottom: 10,
              borderRadius: 8,
              background: theme.panel,
              border: `1px solid ${i === 0 ? theme.mechDeep : theme.panelBorder}`,
              fontFamily: theme.mono,
              fontSize: 20,
              color: i === 0 ? theme.mech : theme.dim,
            }}
          >
            {t}
          </div>
        ))}
        <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 10, opacity: base}}>
          {'一张标签 · 上百 token（教程作者估算）'}
        </div>
      </div>
      {/* 中：点名动作 */}
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 420,
          opacity: pick,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.text,
          padding: '12px 24px',
          borderRadius: 10,
          border: `1px dashed ${theme.mechDeep}`,
        }}
      >
        {'点名 · load_skill("sql-style")'}
      </div>
      {/* 右：消息流——手册整本落入 */}
      <div style={{position: 'absolute', left: 1150, top: 300, width: 480, opacity: enter}}>
        <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, letterSpacing: 3, marginBottom: 14}}>
          {'消息流 · 按轮全价'}
        </div>
        <div
          style={{
            padding: '20px 26px',
            borderRadius: 10,
            background: `${theme.mech}14`,
            border: `1px solid ${theme.mechDeep}`,
            fontFamily: theme.serif,
            fontSize: 24,
            color: theme.text,
            lineHeight: 1.7,
          }}
        >
          {'《SQL 规范》全文'}
          <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 10}}>
            {'约两千 token（教程作者估算） · 随历史携带'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P3Skills: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-03');
  const bB = w('p3-04', 'p3-07');
  const bC = w('p3-08', 'p3-11');
  const bD = w('p3-12', 'p3-14c');
  const bE = w('p3-15', 'p3-19');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 挂点③回照">
        <ArchifyRecap slug="pc2-panorama" caption="挂点③ · 技能进场" cues={[
          {chapterId: 'pan-m3', at: at('p3-01') - bA.from, durationInFrames: dur('p3-01') + dur('p3-02') + dur('p3-03')},
        ]} />
      </Sequence>

      <Sequence {...bB} name="3-B 两级与成本">
        {/* 跨图背靠背（3-A pan-m3 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-skill-levels" caption="技能两级" lead={false} cues={[
          {chapterId: 'levels-two', at: at('p3-04') - bB.from, durationInFrames: dur('p3-04') + dur('p3-05') + dur('p3-06')},
          {chapterId: 'levels-cost', at: at('p3-07') - bB.from, durationInFrames: dur('p3-07')},
        ]} />
      </Sequence>

      <Sequence {...bC} name="3-C 规范走查">
        <SkillWalk at08={0} at10={at('p3-10') - bC.from} at11={at('p3-11') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="3-D 两种命运">
        <ArchifyRecap slug="pc2-skill-levels" caption="技能两级" cues={[
          {chapterId: 'levels-lifecycle', at: at('p3-12') - bD.from, durationInFrames: dur('p3-12') + dur('p3-13') + dur('p3-14') + dur('p3-14b') + dur('p3-14c')},
        ]} />
      </Sequence>

      <Sequence {...bE} name="3-E 消融与结论">
        {/* 跨图背靠背（3-D levels-lifecycle 尾→本章首章）：lead={false} */}
        <ArchifyRecap slug="pc2-skill-cost" caption="拆掉两级" lead={false} cues={[
          {chapterId: 'cost-ablation', at: at('p3-15') - bE.from, durationInFrames: dur('p3-15') + dur('p3-16') + dur('p3-17')},
          {chapterId: 'cost-ruling', at: at('p3-18') - bE.from, durationInFrames: dur('p3-18') + dur('p3-19')},
        ]} />
      </Sequence>
    </AbsoluteFill>
  );
};
