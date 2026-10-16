/** P8 现状对账（p8-01..p8-33，33 句；storyboard v4「P8 现状对账」节）。
 *
 *  13 镜 / 8 条 archify cue（ip-assembler ×1 + ip-memory ×2 + ip-full ×3 + arc-facets ×2；
 *  ip-memory 承 ip-assembler 链尾跨镜背靠背 → lead={false}）：
 *   8-A 判定面（p8-01..03）：判据卡铸字 + 「文档存在 vs 生产路径在用」对照
 *       （ScrollVsBelt 迁移改写：代码文件灰静止 ‖ 调用线绿跑动）
 *   8-B 走廊③（p8-04..05）：CodePane·assemble() 源码段 + token 预算注释行高亮 + 标题小卡
 *   8-C 零调用（p8-06）：ip-assembler 锚；前景计数器 0 @impulse + 实心徽
 *   8-D 记忆真锚（p8-07..08）：ip-memory 锚 p8-07 → hold p8-08（lead={false}）；前景
 *       链路 mini + NegentropyPreloadMemoryTool 参数签
 *   8-E 走廊④（p8-09..11）：CodePane·expand_skill 目录行 × TOOL_REGISTRY 挂载对拍
 *       命中 0 + 在线考核计数 0 + ISSUE-194
 *   8-F 三四条（p8-12..14）：ip-full 锚 p8-12 → hold 13/14；前景 engine/context/ 空缺框
 *       + 10/2 审批徽 + ISSUE-195/196 回扣
 *   8-G 映射表（p8-15..16）：20 行机制↔代码三色行滚动 + 已落地行 #2/#3/#7 钉亮
 *   8-H 修复一二步（p8-17..20）：三步梯前两级 + 防注入前提角标 + 梯顶标题
 *   8-I 第三步（p8-21..22）：退役段立规特写 + 「不加新能力」结论条
 *   8-J 依赖序（p8-23..24）：轴依赖箭头链 + 三标（只增不改·带开关·出错降级）
 *   8-K 三错对策（p8-25..28）：RequestCard 回中央（全 passed 终态）+ 三失效卡被
 *       组件标签逐一覆盖（资产＋沉淀 / 检索 / 权威）
 *   8-L 差距复现（p8-29..31）：19/85 双条复现 + 97/4 并排 + 结论打字机
 *   8-M 终幕（p8-32..33）：arc-facets 锚 p8-32 → hold p8-33；三面标签归位 + 系列卡
 *       （seriesLayers.next ·「下期」仅此卡）+ 末镜推导渐黑
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {progress, useEnter, useFadeOut, useFlowDash, useImpulse, useProgress, useReveal, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {RequestCard} from '../components/RequestCard';
import {CodePane} from './P5Retrieval';
import {RatioBars, ScoreDuo} from './P0Errors';
import seriesLayers from '../series-layers.json';

/** FiveAxisMap 五轴 id（RequestCard 终态 passed 收束用，与组 A 高亮词表同源）。 */
const ALL_AXES = ['asset', 'authority', 'assembly', 'retrieval', 'consolidation'] as const;

export const P8Truth: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p8-01', 'p8-03');
  const bB = w('p8-04', 'p8-05');
  const bC = w('p8-06');
  const bD = w('p8-07', 'p8-08');
  const bE = w('p8-09', 'p8-11');
  const bF = w('p8-12', 'p8-14');
  const bG = w('p8-15', 'p8-16');
  const bH = w('p8-17', 'p8-20');
  const bI = w('p8-21', 'p8-22');
  const bJ = w('p8-23', 'p8-24');
  const bK = w('p8-25', 'p8-28');
  const bL = w('p8-29', 'p8-31');
  const bM = w('p8-32', 'p8-33');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P8" tagline="现状对账" accent={theme.ok} />

      {/* 8-A 判定面：判据卡（p8-01..02，末段淡出让位）+ 文档存在 vs 生产路径在用（p8-03） */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="8-A">
        <Sequence from={0} durationInFrames={at('p8-03') - bA.from} name="8-A-plate">
          <VerdictPlate at={0} totalFrames={at('p8-03') - bA.from} />
        </Sequence>
        <Sequence from={at('p8-03') - bA.from} name="8-A-contrast">
          <ExistsVsLive at={0} />
        </Sequence>
      </Sequence>

      {/* 8-B 走廊③：assemble() 源码段 + 预算注释行 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="8-B">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
          <TitleChip at={at('p8-04') - bB.from} text="第一条 · 设计完整的上下文装配器" />
          <CodePane
            at={at('p8-04') - bB.from + 10}
            lines={[
              'context_assembler.py · assemble(self, request: ContextRequest)',
              '  # 按 token 预算给 memory / history / system 分额度   ← 注释',
              '  budgets = plan.allocate(request.domains)',
              '  return ContextBundle(items=[…])   # 每项 uri@version',
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* 8-C 零调用：ip-assembler 锚 + 前景计数器 0 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="8-C">
        <ArchifyRecap slug="injection-points" caption="注入点 · 参考实现未接线" cues={[
          {chapterId: 'ip-assembler', at: at('p8-06') - bC.from, durationInFrames: dur('p8-06')},
        ]} />
        <ZeroCounter at={at('p8-06') - bC.from + 10} />
      </Sequence>

      {/* 8-D 记忆真锚：ip-memory hold 链（承 8-C 链尾跨镜背靠背 → lead={false}）+ 前景链路 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="8-D">
        <ArchifyRecap slug="injection-points" caption="注入点 · 记忆真锚" cues={[
          {chapterId: 'ip-memory', at: at('p8-07') - bD.from, durationInFrames: dur('p8-07')},
          {chapterId: 'ip-memory', at: at('p8-08') - bD.from, durationInFrames: dur('p8-08'), fit: 'hold'},
        ]} lead={false} />
        <MemoryChainOverlay at={at('p8-07') - bD.from + 10} paramAt={at('p8-08') - bD.from} />
      </Sequence>

      {/* 8-E 走廊④：expand_skill × TOOL_REGISTRY 对拍 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="8-E">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50}}>
          <CodePane
            at={at('p8-09') - bE.from}
            lines={[
              'skills_injector.py:357  "To use a skill, call expand_skill(name)"',
              'TOOL_REGISTRY: 20 个符号 · expand_skill 命中数 = 0',
              '在线考核 · 调用数据样本 = 0',
            ]}
            badge={{level: 'filled', note: '目录承诺 · 挂载命中 0'}}
          />
          <RegistrySlots at={at('p8-10') - bE.from} />
        </AbsoluteFill>
        <div style={{position: 'absolute', bottom: 190, right: 80}}>
          <span style={{padding: '7px 18px', border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 999, fontSize: 18, fontFamily: theme.mono, color: theme.conceptDeep}}>
            ISSUE-194
          </span>
        </div>
      </Sequence>

      {/* 8-F 三四条：ip-full hold 链 + 前景空缺框/10-of-2/回扣 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="8-F">
        <ArchifyRecap slug="injection-points" caption="注入点 · 装配面全景" cues={[
          {chapterId: 'ip-full', at: at('p8-12') - bF.from, durationInFrames: dur('p8-12')},
          {chapterId: 'ip-full', at: at('p8-13') - bF.from, durationInFrames: dur('p8-13'), fit: 'hold'},
          {chapterId: 'ip-full', at: at('p8-14') - bF.from, durationInFrames: dur('p8-14'), fit: 'hold'},
        ]} />
        <GapBadges
          gapAt={at('p8-12') - bF.from}
          approvalAt={at('p8-13') - bF.from}
          recallAt={at('p8-14') - bF.from}
        />
      </Sequence>

      {/* 8-G 映射表：20 行三色滚动 + 已落地钉亮 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="8-G">
        <MappingTable20 at={at('p8-15') - bG.from} pinAt={at('p8-16') - bG.from} />
      </Sequence>

      {/* 8-H 修复一二步：三步梯前两级 + 前提角标 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="8-H">
        <FixLadder
          titleAt={at('p8-17') - bH.from}
          step1At={at('p8-18') - bH.from}
          precondAt={at('p8-19') - bH.from}
          step2At={at('p8-20') - bH.from}
        />
      </Sequence>

      {/* 8-I 第三步：退役段立规特写 + 结论条 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="8-I">
        <RetireRule at={at('p8-21') - bI.from} stripAt={at('p8-22') - bI.from} />
      </Sequence>

      {/* 8-J 轴依赖序 + 三标 */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="8-J">
        <AxisChain at={at('p8-23') - bJ.from} chipsAt={at('p8-24') - bJ.from} />
      </Sequence>

      {/* 8-K 三错对策：RequestCard 终态 + 三覆盖 */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="8-K">
        <PlugTheThree
          at={at('p8-25') - bK.from}
          row1At={at('p8-26') - bK.from}
          row2At={at('p8-27') - bK.from}
          row3At={at('p8-28') - bK.from}
        />
      </Sequence>

      {/* 8-L 差距复现：19/85 + 97/4 + 结论打字机 */}
      <Sequence from={bL.from} durationInFrames={bL.durationInFrames} name="8-L">
        <div style={{position: 'relative', width: '100%', height: 470, marginTop: 60}}>
          <ScoreDuo at={at('p8-29') - bL.from} pulseAt={at('p8-29') - bL.from + 30} />
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80, marginTop: 10}}>
          <RatioBars at={at('p8-30') - bL.from} />
          <EvidenceBadge level="dashed" at={at('p8-30') - bL.from} note="Redis 调查 · n=1000" />
        </div>
        <ConclusionType at={at('p8-31') - bL.from} />
      </Sequence>

      {/* 8-M 终幕：arc-facets 定格 + 三面标签 + 系列卡 + 渐黑 */}
      <Sequence from={bM.from} durationInFrames={bM.durationInFrames} name="8-M">
        <ArchifyRecap slug="blueprint--architecture" caption="三面蓝图 · 收束定格" cues={[
          {chapterId: 'arc-facets', at: at('p8-32') - bM.from, durationInFrames: dur('p8-32')},
          {chapterId: 'arc-facets', at: at('p8-33') - bM.from, durationInFrames: dur('p8-33'), fit: 'hold'},
        ]} lead={false} />
        <Finale
          totalFrames={bM.durationInFrames}
          d32={dur('p8-32')}
          p833At={at('p8-33') - bM.from}
          d33={dur('p8-33')}
          tagsAt={at('p8-32') - bM.from}
          cardAt={at('p8-33') - bM.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 8-A：判定面判据卡（铸字落定；窗口末段淡出让位对照景）。 */
const VerdictPlate: React.FC<{at: number; totalFrames: number}> = ({at, totalFrames}) => {
  const strike = useSpring('settle', {at: at + 4, dur: 14});
  const f = useCurrentFrame();
  // 出场退让：窗口最后 15 帧淡出（时长为出场常数，锚点由窗口总长推导）
  const exit = 1 - progress(f, totalFrames - 15, 15);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: exit}}>
      <div style={{transform: `scale(${0.82 + strike * 0.18})`, border: `4px solid ${theme.ok}`, borderRadius: 14, padding: '30px 60px', background: withAlpha(theme.ok, 0.06)}}>
        <div style={{fontSize: 62, color: theme.ok, letterSpacing: 10}}>判定面</div>
        <div style={{fontSize: 22, color: theme.dim, marginTop: 14, fontFamily: theme.mono}}>只认生产路径上真实发生的调用</div>
      </div>
    </AbsoluteFill>
  );
};

/** 8-A：文档存在（灰静止）vs 链路在用（绿跑动调用线）。 */
const ExistsVsLive: React.FC<{at: number}> = ({at}) => {
  const enter = useStagger(2, {stride: 12, at});
  const flow = useFlowDash({dash: 9, gap: 13, period: 30});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90}}>
      {/* 文档存在：代码文件灰静止 */}
      <div style={{opacity: enter[0], width: 360, textAlign: 'center'}}>
        <div style={{width: 190, height: 130, margin: '0 auto', border: `2px solid ${theme.panelBorder}`, borderRadius: 8, background: theme.panel, padding: '16px 18px', boxSizing: 'border-box', textAlign: 'left'}}>
          <div style={{fontSize: 14, fontFamily: theme.mono, color: theme.dim}}>context_assembler.py</div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{height: 6, background: theme.panelBorder, opacity: 0.5, borderRadius: 3, marginTop: 12, width: `${80 - i * 12}%`}} />
          ))}
        </div>
        <div style={{fontSize: 20, color: theme.dim, marginTop: 12}}>代码存在 · 静止</div>
      </div>
      <div style={{fontSize: 32, color: theme.dim}}>vs</div>
      {/* 链路在用：调用线跑动 */}
      <div style={{opacity: enter[1], width: 420, textAlign: 'center'}}>
        <svg width={420} height={130}>
          <line x1={20} y1={65} x2={400} y2={65} stroke={theme.panelBorder} strokeWidth={2} />
          <line x1={20} y1={65} x2={400} y2={65} stroke={theme.ok} strokeWidth={2.5} {...flow} />
          <circle cx={70} cy={65} r={7} fill={theme.ok} />
          <circle cx={350} cy={65} r={7} fill={theme.ok} />
          <text x={70} y={98} textAnchor="middle" fill={theme.dim} fontSize={16} fontFamily={theme.mono}>engine</text>
          <text x={350} y={98} textAnchor="middle" fill={theme.dim} fontSize={16} fontFamily={theme.mono}>assemble()</text>
        </svg>
        <div style={{fontSize: 20, color: theme.ok, marginTop: 4}}>生产路径 · 每轮真实调用</div>
      </div>
    </AbsoluteFill>
  );
};

/** 标题小卡（第一条/通用）。 */
const TitleChip: React.FC<{at: number; text: string}> = ({at, text}) => {
  const enter = useEnter('rise', {at, dur: 14});
  return (
    <div style={{...enter, padding: '10px 26px', border: `2px solid ${theme.ok}`, borderRadius: 10, fontSize: 23, color: theme.ok, background: withAlpha(theme.bg, 0.9)}}>
      {text}
    </div>
  );
};

/** 8-C：grep 计数器大字 0 @impulse（回放窗侧前景）。 */
const ZeroCounter: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 14});
  const flip = useImpulse({at: at + 12, dur: 30, peak: 1});
  return (
    <div style={{position: 'absolute', right: 110, top: 300, textAlign: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <div style={{fontSize: 130, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums', fontFamily: theme.mono, transform: `scale(${1 + flip * 0.08})`}}>
        0
      </div>
      <div style={{fontSize: 20, color: theme.dim, fontFamily: theme.mono}}>生产调用</div>
      <div style={{marginTop: 14}}>
        <EvidenceBadge level="filled" at={at + 22} note="grep 唯一命中 · 单测" />
      </div>
    </div>
  );
};

/** 8-D 前景：记忆链路 mini + 工具参数签（画框外下沿）。 */
const MemoryChainOverlay: React.FC<{at: number; paramAt: number}> = ({at, paramAt}) => {
  const chain = useStagger(3, {stride: 12, at});
  const param = useEnter('rise', {at: paramAt, dur: 14});
  return (
    <div style={{position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, background: withAlpha(theme.bg, 0.9), padding: '8px 22px', borderRadius: 999, border: `1.5px solid ${theme.panelBorder}`}}>
        {['用户消息', '检索长期记忆', '注入窗口'].map((t, i) => (
          <span key={t} style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <span style={{fontSize: 19, color: theme.concept, opacity: chain[i]}}>{t}</span>
            {i < 2 ? <span style={{fontSize: 18, color: theme.dim, opacity: chain[i + 1]}}>→</span> : null}
          </span>
        ))}
      </div>
      <span style={{...param, padding: '7px 20px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 17, fontFamily: theme.mono, color: theme.dim, background: withAlpha(theme.bg, 0.9)}}>
        NegentropyPreloadMemoryTool · top_k=5 · ≤4,000 字符
      </span>
    </div>
  );
};

/** 8-E：TOOL_REGISTRY 挂载表空位（expand_skill 行问号）。 */
const RegistrySlots: React.FC<{at: number}> = ({at}) => {
  const rows = useStagger(4, {stride: 10, at});
  const slots: Array<[string, string]> = [
    ['read_files', '✓'],
    ['run_sql', '✓'],
    ['search_kb', '✓'],
    ['expand_skill', '?'],
  ];
  return (
    <div style={{width: 330, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, padding: '16px 22px'}}>
      <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginBottom: 12}}>TOOL_REGISTRY</div>
      {slots.map(([name, mark], i) => {
        const missing = mark === '?';
        return (
          <div key={name} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', opacity: rows[i], borderBottom: `1px solid ${withAlpha(theme.panelBorder, 0.4)}`}}>
            <span style={{fontSize: 19, fontFamily: theme.mono, color: missing ? theme.conceptDeep : theme.dim}}>{name}</span>
            <span
              style={{
                width: 34,
                height: 30,
                borderRadius: 6,
                border: `2px ${missing ? 'dashed' : 'solid'} ${missing ? theme.conceptDeep : theme.ok}`,
                color: missing ? theme.conceptDeep : theme.ok,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
              }}
            >
              {mark}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 8-F 前景：engine/context/ 空缺框 + 10/2 审批徽 + ISSUE 回扣（画框外侧栏）。 */
const GapBadges: React.FC<{gapAt: number; approvalAt: number; recallAt: number}> = ({gapAt, approvalAt, recallAt}) => {
  const gap = useEnter('rise', {at: gapAt, dur: 14});
  const approval = useEnter('rise', {at: approvalAt, dur: 14});
  const recall = useStagger(2, {stride: 12, at: recallAt});
  return (
    <>
      <div style={{position: 'absolute', left: 36, top: 230, width: 256, display: 'flex', flexDirection: 'column', gap: 18}}>
        <div style={{...gap, padding: '12px 16px', border: `2px dashed ${theme.conceptDeep}`, borderRadius: 10, fontSize: 17, fontFamily: theme.mono, color: theme.conceptDeep, background: withAlpha(theme.bg, 0.85)}}>
          engine/context/ · 检查段不存在
        </div>
        <div style={{...approval, padding: '12px 16px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 10, background: withAlpha(theme.bg, 0.85)}}>
          <div style={{fontSize: 34, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums', fontFamily: theme.mono}}>10 / 2</div>
          <div style={{fontSize: 16, color: theme.dim, marginTop: 4}}>高危工具 · 已接审批</div>
        </div>
      </div>
      <div style={{position: 'absolute', right: 36, top: 230, width: 256, display: 'flex', flexDirection: 'column', gap: 14}}>
        {['ISSUE-195 · 会话回写缺两件', 'ISSUE-196 · 中文检索全空'].map((t, i) => (
          <span key={t} style={{opacity: recall[i], padding: '9px 14px', border: `1.5px solid ${theme.dim}`, borderRadius: 8, fontSize: 16, fontFamily: theme.mono, color: theme.dim, background: withAlpha(theme.bg, 0.85)}}>
            {t}
          </span>
        ))}
      </div>
    </>
  );
};

/** 8-G：20 行机制↔代码映射表（三色行滚动 + #2/#3/#7 钉亮）。 */
const MappingTable20: React.FC<{at: number; pinAt: number}> = ({at, pinAt}) => {
  const enter = useProgress(at, 12);
  const pin = useProgress(pinAt, 14);
  const rows: Array<{n: number; t: string; s: 'live' | 'part' | 'none'}> = [
    {n: 1, t: '资产注册 · definitions 表', s: 'part'},
    {n: 2, t: '口径单点 · 只存一份', s: 'live'},
    {n: 3, t: '结构校验 · 422 门', s: 'live'},
    {n: 4, t: '权威行级过滤', s: 'none'},
    {n: 5, t: '会话权限上界 · RBAC∩RSS', s: 'part'},
    {n: 6, t: '执法点 · 引擎求值', s: 'none'},
    {n: 7, t: '记忆注入 · preload 工具', s: 'live'},
    {n: 8, t: '技能展开 · expand_skill', s: 'none'},
    {n: 9, t: '检索三段 · 初检重排截断', s: 'none'},
    {n: 10, t: '信任排序 · 四因子', s: 'none'},
    {n: 11, t: 'RRF 融合', s: 'none'},
    {n: 12, t: '应答契约 · 三出路', s: 'none'},
    {n: 13, t: 'Guard · 五项检查', s: 'none'},
    {n: 14, t: '装配预算 · assemble()', s: 'none'},
    {n: 15, t: '缓存感知分段', s: 'none'},
    {n: 16, t: '压缩分级 · 四步', s: 'none'},
    {n: 17, t: '回写触发器', s: 'none'},
    {n: 18, t: '消费者出队', s: 'none'},
    {n: 19, t: '水位线', s: 'none'},
    {n: 20, t: '衰减退役', s: 'none'},
  ];
  const status = {
    live: {c: theme.ok, tag: '已落地'},
    part: {c: theme.concept, tag: '部分'},
    none: {c: theme.dim, tag: '仅设计'},
  } as const;
  const ROW_H = 47;
  const VISIBLE = 10;
  const VIEW_H = ROW_H * VISIBLE;
  // p8-15 下滚掠过全表 → p8-16 回滚到顶、已落地行（#2/#3/#7）钉亮
  const down = useSpring('settle', {at: at + 20, dur: 80});
  const back = useSpring('settle', {at: pinAt, dur: 36});
  const offset = Math.max(0, Math.min(1, down * (1 - back))) * (rows.length * ROW_H - VIEW_H);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: enter}}>
      <div style={{width: 900, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, overflow: 'hidden'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', padding: '14px 24px', borderBottom: `1.5px solid ${theme.panelBorder}`, fontSize: 19, fontFamily: theme.mono, color: theme.dim}}>
          <span>机制 ↔ 代码 · 20 行</span>
          <span style={{color: theme.ok, opacity: pin}}>跑通行集中在资产与权威</span>
        </div>
        <div style={{height: VIEW_H, overflow: 'hidden', position: 'relative'}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: -offset}}>
            {rows.map((r) => {
              const st = status[r.s];
              const pinned = r.s === 'live' && pin > 0.4;
              return (
                <div
                  key={r.n}
                  style={{
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    borderBottom: `1px solid ${withAlpha(theme.panelBorder, 0.35)}`,
                    background: pinned ? withAlpha(theme.ok, 0.08) : 'transparent',
                    outline: pinned ? `2px solid ${theme.ok}` : 'none',
                  }}
                >
                  <span style={{display: 'flex', alignItems: 'center', gap: 16}}>
                    <span style={{fontSize: 16, fontFamily: theme.mono, color: theme.dim, width: 30}}>{`#${r.n}`}</span>
                    <span style={{fontSize: 20, color: r.s === 'none' ? theme.dim : theme.text}}>{r.t}</span>
                  </span>
                  <span style={{fontSize: 16, fontFamily: theme.mono, color: st.c, border: `1.5px solid ${st.c}`, borderRadius: 6, padding: '2px 10px', opacity: r.s === 'none' ? 0.6 : 1}}>
                    {st.tag}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 8-H：修复序三步梯前两级 + 防注入前提角标。 */
const FixLadder: React.FC<{titleAt: number; step1At: number; precondAt: number; step2At: number}> = ({
  titleAt,
  step1At,
  precondAt,
  step2At,
}) => {
  const title = useEnter('fall', {at: titleAt, dur: 16});
  const s1 = useProgress(step1At, 16);
  const pre = useEnter('rise', {at: precondAt, dur: 14});
  const s2 = useProgress(step2At, 16);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36}}>
      <div style={{...title, padding: '10px 30px', border: `2.5px solid ${theme.ok}`, borderRadius: 10, fontSize: 26, color: theme.ok, letterSpacing: 3}}>
        伤害大的先修
      </div>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 30}}>
        <div style={{opacity: 0.35 + s1 * 0.65, width: 380, padding: '20px 26px', border: `2px solid ${s1 > 0.5 ? theme.ok : theme.panelBorder}`, borderRadius: 12, background: theme.panel}}>
          <div style={{fontSize: 20, color: theme.dim, fontFamily: theme.mono}}>step 1</div>
          <div style={{fontSize: 25, color: theme.text, marginTop: 8}}>补回路缺件</div>
          <div style={{fontSize: 18, color: theme.dim, marginTop: 8, fontFamily: theme.mono}}>触发器 · 消费者 · 水位线 接齐</div>
        </div>
        <div style={{opacity: 0.35 + s2 * 0.65, width: 380, padding: '20px 26px', border: `2px solid ${s2 > 0.5 ? theme.ok : theme.panelBorder}`, borderRadius: 12, background: theme.panel, marginBottom: 34}}>
          <div style={{fontSize: 20, color: theme.dim, fontFamily: theme.mono}}>step 2</div>
          <div style={{fontSize: 25, color: theme.text, marginTop: 8}}>执法点统一</div>
          <div style={{fontSize: 18, color: theme.dim, marginTop: 8, fontFamily: theme.mono}}>审批收进同一拦截位</div>
        </div>
      </div>
      <span style={{...pre, padding: '9px 22px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 999, fontSize: 19, fontFamily: theme.mono, color: theme.conceptDeep, background: withAlpha(theme.bg, 0.9)}}>
        前提 · 写入端防注入扫描先上线
      </span>
    </AbsoluteFill>
  );
};

/** 8-I：第三步退役段立规 + 结论条。 */
const RetireRule: React.FC<{at: number; stripAt: number}> = ({at, stripAt}) => {
  const enter = useProgress(at, 14);
  const chips = useStagger(2, {stride: 14, at: at + 8});
  const strip = useEnter('rise', {at: stripAt, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, opacity: enter}}>
      <div style={{display: 'flex', gap: 30}}>
        {['定义禁用 → 盘上副本可删', '挂载承诺 → 可收回'].map((t, i) => (
          <span key={t} style={{opacity: chips[i], padding: '16px 28px', border: `2px solid ${theme.concept}`, borderRadius: 12, fontSize: 23, color: theme.concept, background: theme.panel}}>
            {t}
          </span>
        ))}
      </div>
      <div style={{fontSize: 19, color: theme.dim, fontFamily: theme.mono}}>step 3 · 退役段立规</div>
      <div style={{...strip, padding: '14px 38px', border: `2.5px solid ${theme.ok}`, borderRadius: 12, fontSize: 30, color: theme.ok, letterSpacing: 2}}>
        三步 · 零新能力
      </div>
    </AbsoluteFill>
  );
};

/** 8-J：轴依赖序箭头链 + 三标。 */
const AxisChain: React.FC<{at: number; chipsAt: number}> = ({at, chipsAt}) => {
  const chain = useStagger(4, {stride: 14, at});
  const chips = useStagger(3, {stride: 10, at: chipsAt});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 46}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        {['资产＋权威', '装配', '检索', '沉淀'].map((t, i) => (
          <span key={t} style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{opacity: chain[i], padding: '10px 22px', border: `2px solid ${i === 0 ? theme.ok : theme.concept}`, borderRadius: 10, fontSize: 22, color: i === 0 ? theme.ok : theme.concept}}>
              {t}
            </span>
            {i < 3 ? <span style={{fontSize: 24, color: theme.dim, opacity: chain[i + 1]}}>→</span> : null}
          </span>
        ))}
      </div>
      <div style={{display: 'flex', gap: 20}}>
        {['只增不改', '带开关', '出错就降级'].map((t, i) => (
          <span key={t} style={{opacity: chips[i], padding: '9px 22px', border: `2px solid ${theme.ok}`, borderRadius: 999, fontSize: 20, color: theme.ok}}>
            {t}
          </span>
        ))}
      </div>
      <span style={{fontSize: 17, fontFamily: theme.mono, color: theme.dim, opacity: chips[2]}}>additive · 特性开关 · fail-soft</span>
    </AbsoluteFill>
  );
};

/** 8-K：RequestCard 回中央（全 passed）+ 三失效卡被组件标签覆盖。 */
const PlugTheThree: React.FC<{at: number; row1At: number; row2At: number; row3At: number}> = ({at, row1At, row2At, row3At}) => {
  const card = useEnter('pop', {at, dur: 20});
  const rows = [useProgress(row1At, 14), useProgress(row2At, 14), useProgress(row3At, 14)];
  const data: Array<{bad: string; fix: string; axes: string[]}> = [
    {bad: '同一指标两个数', fix: '注册表只留一份定义 · 冲突交人裁决', axes: ['资产', '沉淀']},
    {bad: '裸问答错', fix: '检索给对候选 · 命中即重放 · 缺口直说', axes: ['检索']},
    {bad: '越权读到手机号', fix: '会话上界只减不增 · 拦截留记录', axes: ['权威']},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
      <div style={{opacity: card.opacity, transform: card.transform}}>
        <RequestCard at={at} passed={ALL_AXES} />
      </div>
      {data.map((d, i) => (
        <div key={d.bad} style={{display: 'flex', alignItems: 'center', gap: 20, opacity: rows[i]}}>
          <span style={{width: 220, textAlign: 'center', padding: '10px 0', border: `2px solid ${theme.conceptDeep}`, borderRadius: 8, fontSize: 20, color: theme.conceptDeep, textDecoration: 'line-through', opacity: 0.85}}>
            {d.bad}
          </span>
          <span style={{fontSize: 24, color: theme.ok}}>→</span>
          <span style={{padding: '10px 22px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 20, color: theme.ok, background: withAlpha(theme.ok, 0.05)}}>
            {d.fix}
          </span>
          <span style={{display: 'flex', gap: 8}}>
            {d.axes.map((a) => (
              <span key={a} style={{padding: '5px 12px', border: `1.5px solid ${theme.concept}`, borderRadius: 6, fontSize: 15, fontFamily: theme.mono, color: theme.concept}}>
                {a}
              </span>
            ))}
          </span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 8-L：结论打字机。 */
const ConclusionType: React.FC<{at: number}> = ({at}) => {
  const text = useReveal('差的不是认识 · 是有没有接进生产路径', {at, cps: 8});
  const enter = useEnter('rise', {at, dur: 14});
  return (
    <div style={{...enter, marginTop: 24, padding: '12px 36px', border: `2.5px solid ${theme.concept}`, borderRadius: 12, background: withAlpha(theme.bg, 0.9)}}>
      <span style={{fontSize: 28, color: theme.concept, letterSpacing: 1}}>{text}</span>
      <span style={{opacity: text.length >= 18 ? 1 : 0, color: theme.concept}}>▍</span>
    </div>
  );
};

/** 8-M 终幕：arc-facets 定格 + 三面标签 + 系列卡（「下期」唯一豁免处）+ 末镜渐黑。 */
const Finale: React.FC<{
  totalFrames: number;
  d32: number;
  p833At: number;
  d33: number;
  tagsAt: number;
  cardAt: number;
}> = ({totalFrames, d32, p833At, d33, tagsAt, cardAt}) => {
  const tags = useStagger(3, {stride: 14, at: tagsAt});
  const cardO = useProgress(cardAt, 16);
  // 红线四：片尾渐黑从末 beat 总时长推导（禁写死帧数）
  const fade = useFadeOut(totalFrames);
  const faces = [
    {t: '验收面', q: '管防住什么'},
    {t: '结构面', q: '管怎么分工'},
    {t: '时间面', q: '管从注册到退役'},
  ];
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {/* 三面标签（回放框下沿前景归位） */}
      <div style={{position: 'absolute', bottom: 340, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26}}>
        {faces.map((x, i) => (
          <div key={x.t} style={{opacity: tags[i], width: 220, padding: '14px 12px', border: `1.5px solid ${theme.concept}`, borderRadius: 10, textAlign: 'center', background: withAlpha(theme.bg, 0.85)}}>
            <div style={{fontSize: 23, color: theme.concept}}>{x.t}</div>
            <div style={{fontSize: 17, color: theme.dim, marginTop: 6}}>{x.q}</div>
          </div>
        ))}
      </div>
      {/* 系列卡（「下期」口径 · 本集唯一豁免处） */}
      <div style={{position: 'absolute', bottom: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: cardO}}>
        <div style={{padding: '18px 44px', border: `2px solid ${theme.concept}`, borderRadius: 14, background: withAlpha(theme.bg, 0.92), textAlign: 'center'}}>
          <div style={{fontSize: 22, color: theme.concept, letterSpacing: 6}}>下期</div>
          <div style={{fontSize: 30, color: theme.text, marginTop: 10}}>{seriesLayers.next}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
