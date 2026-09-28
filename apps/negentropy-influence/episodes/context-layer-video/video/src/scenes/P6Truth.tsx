/** P6 装配线真相与收口（p6-01..p6-28，31 句；storyboard「P6 装配线真相与收口」节）。
 *
 *  8 镜 / 15 条 archify cue：
 *   6-A 判定面铸字 · 6-B 代码走廊⑤ + ip-assembler@02→ip-nine@04
 *   6-C ip-memory@05→ip-full@06 · 6-D 代码走廊⑥ + ip-hooks@08
 *   6-E lm-spine@11→el-six@12→el-sm@13 · 6-F dt-design@15→dt-show@16→dt-p0@17→dt-main@18
 *   6-G 回环三堵 fm-stale@21→fm-conflict@22→fm-auth@23 · 6-H 终幕盖章 + TailFade（红线四）
 *
 *  lead 链（按 cue 实际帧位判定）：6-B 链首恢复入场；6-C 接 6-B 链尾背靠背 false；
 *  6-D / 6-E 链首(lm) / 6-F / 6-G 链首(fm-stale) 均隔句空窗恢复入场；
 *  6-E el 接 lm 尾、6-G 后两堵逐句背靠背 → false。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {useFadeOut, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {CodePane} from './P2MasterPage';
import {WorkCard} from '../components/WorkCard';

export const P6Truth: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bB = w('p6-02', 'p6-04');
  const bC = w('p6-05', 'p6-07');
  const bD = w('p6-08', 'p6-10');
  const bE = w('p6-11', 'p6-14');
  const bF = w('p6-15', 'p6-18');
  const bG = w('p6-19', 'p6-23');
  const bH = w('p6-24', 'p6-28');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P6" tagline="装配线真相与收口" accent={theme.ok} />

      {/* 6-A 判定面铸字 */}
      <Sequence from={0} durationInFrames={dur('p6-01', 'p6-01b')} name="6-A">
        <VerdictPlate />
      </Sequence>

      {/* 6-B 零调用：代码走廊⑤（链首：前接 6-A 纯装置，ip-assembler 恢复入场） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="6-B">
        <CodePane
          at={at('p6-02') - bB.from}
          lines={[
            '$ grep -rn "\\.assemble(" apps/negentropy/src apps/negentropy/tests',
            'tests/unit_tests/engine/test_context_assembler_reflection.py:167:  ← 唯一命中',
            '生产调用数 = 0',
            '真锚 = NegencyPreloadMemoryTool（每轮 · 用户消息为 query）',
          ]}
          badge={{level: 'filled', note: 'assemble() 生产零调用'}}
        />
        <ArchifyRecap
          slug="injection-points"
          caption="参考实现 · 未接线"
          cues={[
            {chapterId: 'ip-assembler', at: at('p6-02') - bB.from, durationInFrames: dur('p6-02')},
            {chapterId: 'ip-nine', at: at('p6-04') - bB.from, durationInFrames: dur('p6-04')},
          ]}
        />
      </Sequence>

      {/* 6-C 真锚链条（6-B 链尾 ip-nine@04 末帧恰接 ip-memory@05 首，背靠背 false） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="6-C">
        <ArchifyRecap
          slug="injection-points"
          caption="每轮注入 · 五挂点汇入"
          cues={[
            {chapterId: 'ip-memory', at: at('p6-05') - bC.from, durationInFrames: dur('p6-05')},
            {chapterId: 'ip-full', at: at('p6-06') - bC.from, durationInFrames: dur('p6-06')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 6-D 菜单不能点：代码走廊⑥（6-C 链尾隔 p6-07 空窗，恢复入场） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="6-D">
        <CodePane
          at={at('p6-08') - bD.from}
          lines={[
            'skills_injector.py:357  "To use a skill, call expand_skill(name)"',
            'TOOL_REGISTRY: 20 个符号 · expand_skill 命中数 = 0',
            '在线考核关口：调用数据恒 0',
          ]}
          badge={{level: 'filled', note: 'ISSUE-194 · 菜单能看不能点'}}
        />
        <ArchifyRecap slug="injection-points" caption="五挂点 · 工具架空位" cues={[{chapterId: 'ip-hooks', at: at('p6-08') - bD.from, durationInFrames: dur('p6-08')}]} />
      </Sequence>

      {/* 6-E 十六行表 + 杠杆（lm-spine 隔 p6-08b..p6-10 空窗恢复入场；el-six 接其尾 false） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="6-E">
        <ArchifyRecap
          slug="blueprint--layer-mechanism-map"
          caption="十六行重核 · 全脊柱"
          cues={[{chapterId: 'lm-spine', at: at('p6-11') - bE.from, durationInFrames: dur('p6-11')}]}
        />
        <ArchifyRecap
          slug="evolution-levers"
          caption="六面杠杆 · 状态机"
          cues={[
            {chapterId: 'el-six', at: at('p6-12') - bE.from, durationInFrames: dur('p6-12')},
            {chapterId: 'el-sm', at: at('p6-13') - bE.from, durationInFrames: dur('p6-13')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 6-F 双轨（6-E 链尾隔 p6-14 空窗，恢复入场） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="6-F">
        <ArchifyRecap
          slug="blueprint--dual-track-roadmap"
          caption="样板间 × 本楼改造"
          cues={[
            {chapterId: 'dt-design', at: at('p6-15') - bF.from, durationInFrames: dur('p6-15')},
            {chapterId: 'dt-show', at: at('p6-16') - bF.from, durationInFrames: dur('p6-16')},
            {chapterId: 'dt-p0', at: at('p6-17') - bF.from, durationInFrames: dur('p6-17'), fit: 'hold'},
            {chapterId: 'dt-main', at: at('p6-18') - bF.from, durationInFrames: dur('p6-18')},
          ]}
        />
      </Sequence>

      {/* 6-G 回环三堵（fm-stale 隔 p6-19/20 空窗恢复入场；后两堵逐句背靠背 false） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="6-G">
        <ArchifyRecap
          slug="failure-map"
          caption="三堵回环 · 过期页"
          cues={[{chapterId: 'fm-stale', at: at('p6-21') - bG.from, durationInFrames: dur('p6-21')}]}
        />
        <ArchifyRecap slug="failure-map" caption="两页打架" cues={[{chapterId: 'fm-conflict', at: at('p6-22') - bG.from, durationInFrames: dur('p6-22')}]} lead={false} />
        <ArchifyRecap slug="failure-map" caption="交集天花板" cues={[{chapterId: 'fm-auth', at: at('p6-23') - bG.from, durationInFrames: dur('p6-23')}]} lead={false} />
      </Sequence>

      {/* 6-H 终幕：全屏定格盖章 → 渐黑（红线四：TailFade 挂 6-H 内部，窗口= bH 时长） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="6-H">
        <FinalStamp totalFrames={bH.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

const VerdictPlate: React.FC = () => {
  const f = useCurrentFrame();
  const strike = Math.min(1, Math.max(0, (f - 4) / 8));
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${0.8 + strike * 0.2})`, border: `4px solid ${theme.ok}`, borderRadius: 14, padding: '34px 56px', background: 'rgba(126,211,33,0.06)'}}>
        <div style={{fontSize: 64, color: theme.ok, letterSpacing: 10}}>判定面</div>
        <div style={{fontSize: 22, color: theme.dim, marginTop: 14}}>声明 ⇄ 装配线实跑</div>
      </div>
    </AbsoluteFill>
  );
};

const FinalStamp: React.FC<{totalFrames: number}> = ({totalFrames}) => {
  const f = useCurrentFrame();
  const seal = useSpring('settle', {at: 10, dur: 14});
  const dim = useFadeOut(totalFrames);
  const rows = useStagger(3, {stride: 26, at: 40});
  const fixes = [
    ['过期页', '新鲜度 · 源水位刷新'],
    ['两页打架', '冲突浮出 · 人工裁决'],
    ['无签关盖', '交集天花板 · 出口必经'],
  ];
  return (
    <AbsoluteFill style={{background: theme.bg, opacity: dim, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44}}>
      <div style={{display: 'flex', gap: 34}}>
        {fixes.map(([bad, fix], i) => (
          <div key={bad} style={{opacity: rows[i], textAlign: 'center'}}>
            <div style={{fontSize: 24, color: theme.conceptDeep, textDecoration: 'line-through'}}>{bad}</div>
            <div style={{fontSize: 19, color: theme.ok, marginTop: 6}}>{fix}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'relative', transform: `scale(${seal})`}}>
        <WorkCard stamps={7} totalSlots={7} w={430} label="工卡 · 关盖放行" />
        <div
          style={{
            position: 'absolute',
            top: -26,
            right: -30,
            padding: '10px 22px',
            border: `4px solid ${theme.ok}`,
            borderRadius: 10,
            color: theme.ok,
            fontSize: 40,
            transform: 'rotate(12deg)',
            background: 'rgba(14,17,22,0.9)',
            letterSpacing: 6,
          }}
        >
          放行
        </div>
      </div>
    </AbsoluteFill>
  );
};
