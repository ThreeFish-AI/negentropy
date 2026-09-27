/** P6 装配线真相与收口（p6-01..p6-28，30 句；storyboard「P6 装配线真相与收口」节）。
 *
 *  8 镜 / 14 条 archify cue：
 *   6-A 判定面铸字 · 6-B 代码走廊⑤ + ip-assembler@02→ip-nine@04
 *   6-C ip-memory@05→ip-full@06 · 6-D 代码走廊⑥ + ip-hooks@08
 *   6-E lm-spine@11→el-six@12→el-sm@13 · 6-F dt-design@15→dt-show@16→dt-p0@17→dt-main@17b(并入)
 *   6-G 回环三堵 fm-stale@21→fm-conflict@22→fm-auth@23 · 6-H 终幕盖章 + TailFade（红线四）
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
  const bH = w('p6-24', 'p6-28');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P6" tagline="装配线真相与收口" accent={theme.ok} />

      {/* 6-A 判定面铸字 */}
      <Sequence from={0} durationInFrames={dur('p6-01', 'p6-01b')} name="6-A">
        <VerdictPlate />
      </Sequence>

      {/* 6-B 零调用：代码走廊⑤ */}
      <Sequence from={at('p6-02')} durationInFrames={dur('p6-02', 'p6-04')} name="6-B">
        <CodePane
          at={at('p6-02')}
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
            {chapterId: 'ip-assembler', at: at('p6-02'), durationInFrames: dur('p6-02')},
            {chapterId: 'ip-nine', at: at('p6-04'), durationInFrames: dur('p6-04')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 6-C 真锚链条 */}
      <Sequence from={at('p6-05')} durationInFrames={dur('p6-05', 'p6-07')} name="6-C">
        <ArchifyRecap
          slug="injection-points"
          caption="每轮注入 · 五挂点汇入"
          cues={[
            {chapterId: 'ip-memory', at: at('p6-05'), durationInFrames: dur('p6-05')},
            {chapterId: 'ip-full', at: at('p6-06'), durationInFrames: dur('p6-06')},
          ]}
        />
      </Sequence>

      {/* 6-D 菜单不能点：代码走廊⑥ */}
      <Sequence from={at('p6-08')} durationInFrames={dur('p6-08', 'p6-10')} name="6-D">
        <CodePane
          at={at('p6-08')}
          lines={[
            'skills_injector.py:357  "To use a skill, call expand_skill(name)"',
            'TOOL_REGISTRY: 20 个符号 · expand_skill 命中数 = 0',
            '在线考核关口：调用数据恒 0',
          ]}
          badge={{level: 'filled', note: 'ISSUE-194 · 菜单能看不能点'}}
        />
        <ArchifyRecap slug="injection-points" caption="五挂点 · 工具架空位" cues={[{chapterId: 'ip-hooks', at: at('p6-08'), durationInFrames: dur('p6-08')}]} />
      </Sequence>

      {/* 6-E 十六行表 + 杠杆 */}
      <Sequence from={at('p6-11')} durationInFrames={dur('p6-11', 'p6-14')} name="6-E">
        <ArchifyRecap
          slug="blueprint--layer-mechanism-map"
          caption="十六行重核 · 全脊柱"
          cues={[{chapterId: 'lm-spine', at: at('p6-11'), durationInFrames: dur('p6-11')}]}
        />
        <ArchifyRecap
          slug="evolution-levers"
          caption="六面杠杆 · 状态机"
          cues={[
            {chapterId: 'el-six', at: at('p6-12'), durationInFrames: dur('p6-12')},
            {chapterId: 'el-sm', at: at('p6-13'), durationInFrames: dur('p6-13')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 6-F 双轨 */}
      <Sequence from={at('p6-15')} durationInFrames={dur('p6-15', 'p6-18')} name="6-F">
        <ArchifyRecap
          slug="blueprint--dual-track-roadmap"
          caption="样板间 × 本楼改造"
          cues={[
            {chapterId: 'dt-design', at: at('p6-15'), durationInFrames: dur('p6-15')},
            {chapterId: 'dt-show', at: at('p6-16'), durationInFrames: dur('p6-16')},
            {chapterId: 'dt-p0', at: at('p6-17'), durationInFrames: dur('p6-17'), fit: 'hold'},
            {chapterId: 'dt-main', at: at('p6-18'), durationInFrames: dur('p6-18')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 6-G 回环三堵 */}
      <Sequence from={at('p6-19')} durationInFrames={dur('p6-19', 'p6-23')} name="6-G">
        <ArchifyRecap
          slug="failure-map"
          caption="三堵回环 · 过期页"
          cues={[{chapterId: 'fm-stale', at: at('p6-21'), durationInFrames: dur('p6-21')}]}
        />
        <ArchifyRecap slug="failure-map" caption="两页打架" cues={[{chapterId: 'fm-conflict', at: at('p6-22'), durationInFrames: dur('p6-22')}]} lead={false} />
        <ArchifyRecap slug="failure-map" caption="交集天花板" cues={[{chapterId: 'fm-auth', at: at('p6-23'), durationInFrames: dur('p6-23')}]} lead={false} />
      </Sequence>

      {/* 6-H 终幕：全屏定格盖章 → 渐黑（红线四：TailFade 挂 6-H 内部，窗口= bH 时长） */}
      <Sequence from={at('p6-24')} durationInFrames={bH.durationInFrames} name="6-H">
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
