/** P8 装配线真相（p8-01..p8-32，32 句；storyboard v3「P8 装配线真相」节）。
 *
 *  8 镜 / 7 条 archify cue（ip-* 与 lmm-open，id 未变）：
 *   8-A 判定面铭牌 + 图纸卷轴 vs 传送带对照
 *   8-B ip-assembler@p8-04（hold）→ ip-nine@p8-06（trim；实例内隔空窗恢复入场）；
 *      代码走廊③@p8-05（grep 逐行滚过仅一行高亮）
 *   8-C ip-memory@p8-07（hold）→ ip-full@p8-08（trim）；ip-nine 尾恰接本镜首 → lead={false}
 *   8-D ip-hooks@p8-10 → hold@p8-12（「菜单能看不能点」正对架空挂点；代码走廊④留 p8-11
 *       空窗保可读，recap 后置遮盖）· 计数器恒 0@p8-13
 *   8-E lmm-open@p8-14（trim；16+4 表一闪三色）
 *   8-F 修复序三步梯（断边先接/执法点统一/死亡段立规）+ 轴依赖箭头链 + 三标
 *   8-G 回环三堵快剪（错橙→堵绿三连配对）
 *   8-H 终幕：实习生剪影 + 97/4 复现 + 三面蓝图 + 工卡盖满最后一格章全屏定格
 *       + 机库灯次第暗 + 系列卡（「下期」口径，字面量豁免仅在此卡）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useImpulse, useProgress, useSpring, useStagger, useFadeOut} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {WorkCard} from '../components/WorkCard';
import {CatalogCard} from '../components/CatalogCard';
import {CodePane} from './P5Retrieval';
import {RatioBars} from './P0Errors';
import seriesLayers from '../series-layers.json';

export const P8Truth: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p8-01', 'p8-03');
  const bB = w('p8-04', 'p8-06');
  const bC = w('p8-07', 'p8-08');
  const bD = w('p8-09', 'p8-13');
  const bE = w('p8-14');
  const bF = w('p8-15', 'p8-20');
  const bG = w('p8-21', 'p8-25');
  const bH = w('p8-26', 'p8-32');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P8" tagline="装配线真相" accent={theme.ok} />

      {/* 8-A 判定面：铸字铭牌 + 图纸 vs 传送带对照 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="8-A">
        <VerdictPlate at={0} />
        <Sequence from={at('p8-03') - bA.from} name="8-A-contrast">
          <ScrollVsBelt at={0} />
        </Sequence>
      </Sequence>

      {/* 8-B 零调用：ip-assembler 盖 p8-04；代码走廊③挪 cue 窗后 p8-05；ip-nine@p8-06 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="8-B">
        <ArchifyRecap
          slug="injection-points"
          caption="参考实现 · 未接线"
          cues={[
            {chapterId: 'ip-assembler', at: at('p8-04') - bB.from, durationInFrames: dur('p8-04')},
            {chapterId: 'ip-nine', at: at('p8-06') - bB.from, durationInFrames: dur('p8-06')},
          ]}
        />
        <Sequence from={at('p8-05') - bB.from} durationInFrames={dur('p8-05')} name="8-B-code">
          <CodePane
            at={0}
            lines={[
              '$ grep -rn "\\.assemble(" apps/negentropy/src apps/negentropy/tests',
              'tests/unit_tests/engine/test_context_assembler_reflection.py:167:  ← 唯一命中',
              '生产调用数 = 0',
              '真锚 = NegentropyPreloadMemoryTool（每轮 · 用户消息为 query）',
            ]}
            badge={{level: 'filled', note: 'assemble() 生产零调用'}}
          />
        </Sequence>
      </Sequence>

      {/* 8-C 真锚：ip-nine 尾恰接本镜首 → 跨镜背靠背 lead={false}；ip-full 盖 p8-08 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="8-C">
        <ArchifyRecap
          slug="injection-points"
          caption="每轮注入 · 五挂点汇入"
          cues={[
            {chapterId: 'ip-memory', at: at('p8-07') - bC.from, durationInFrames: dur('p8-07')},
            {chapterId: 'ip-full', at: at('p8-08') - bC.from, durationInFrames: dur('p8-08')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 8-D 菜单不能点：ip-hooks@10 → hold@p8-12（架空挂点正对「能看不能点」）；
          代码走廊④留 p8-11 空窗保可读，recap 后置遮盖；计数器恒 0@p8-13 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="8-D">
        <Sequence from={at('p8-11') - bD.from} durationInFrames={dur('p8-11', 'p8-12')} name="8-D-code">
          <CodePane
            at={0}
            lines={[
              'skills_injector.py:357  "To use a skill, call expand_skill(name)"',
              'TOOL_REGISTRY: 20 个符号 · expand_skill 命中数 = 0',
              '目录行写着能点 · 注册表里没有这只手',
            ]}
            badge={{level: 'filled', note: '看得到 · 点不动'}}
          />
        </Sequence>
        <ZeroCounter at={at('p8-13') - bD.from} />
        <ArchifyRecap slug="injection-points" caption="五挂点 · 工具架空位" cues={[
          {chapterId: 'ip-hooks', at: at('p8-10') - bD.from, durationInFrames: dur('p8-10')},
          {chapterId: 'ip-hooks', at: at('p8-12') - bD.from, durationInFrames: dur('p8-12'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 8-E 十六行表：lmm-open 一闪（trim） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="8-E">
        <ArchifyRecap slug="blueprint--layer-mechanism-map" caption="十六行重核 · 矩阵总览" cues={[
          {chapterId: 'lmm-open', at: at('p8-14') - bE.from, durationInFrames: dur('p8-14')},
        ]} />
      </Sequence>

      {/* 8-F 修复序：三步梯逐级 + 轴依赖箭头链 + 三标 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="8-F">
        <FixLadder
          at={0}
          step1At={at('p8-16') - bF.from}
          step2At={at('p8-17') - bF.from}
          step3At={at('p8-18') - bF.from}
          chainAt={at('p8-19') - bF.from}
          chipsAt={at('p8-20') - bF.from}
        />
      </Sequence>

      {/* 8-G 回环三堵：飞机回归 + 错橙→堵绿三连配对 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="8-G">
        <LoopPlugs
          at21={at('p8-21') - bG.from}
          pair1At={at('p8-23') - bG.from}
          pair2At={at('p8-24') - bG.from}
          pair3At={at('p8-25') - bG.from}
        />
      </Sequence>

      {/* 8-H 终幕：实习生 + 97/4 复现 + 三面蓝图 + 盖满最后一格章 + 灯暗 + 系列卡 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="8-H">
        <Finale totalFrames={bH.durationInFrames} at27={at('p8-27') - bH.from} at28={at('p8-28') - bH.from} at29={at('p8-29') - bH.from} at30={at('p8-30') - bH.from} at31={at('p8-31') - bH.from} at32={at('p8-32') - bH.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 判定面铭牌（v2 迁移）：铸字大字 + 声明⇄实跑副题。 */
const VerdictPlate: React.FC<{at: number}> = ({at}) => {
  const strike = useSpring('settle', {at: at + 4, dur: 12});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${0.8 + strike * 0.2})`, border: `4px solid ${theme.ok}`, borderRadius: 14, padding: '34px 56px', background: withAlpha(theme.ok, 0.06)}}>
        <div style={{fontSize: 64, color: theme.ok, letterSpacing: 10}}>判定面</div>
        <div style={{fontSize: 22, color: theme.dim, marginTop: 14}}>声明算不算数 · 只认生产路径</div>
      </div>
    </AbsoluteFill>
  );
};

/** 图纸卷轴 vs 传送带（8-A 对照）：图纸挂墙蒙尘 / 装配线走带运行。 */
const ScrollVsBelt: React.FC<{at: number}> = ({at}) => {
  const enter = useStagger(2, {stride: 12, at});
  const f = useCurrentFrame();
  // 传送带匀速走带（机械感是主题，等速线性合法的 bespoke 逃生舱形态）
  const belt = (f / 2.2) % 24;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80}}>
      <div style={{opacity: enter[0], width: 300, textAlign: 'center'}}>
        <div style={{width: 120, height: 92, margin: '0 auto', border: `2px solid ${theme.panelBorder}`, borderRadius: 6, background: theme.panel, position: 'relative', opacity: 0.7}}>
          <div style={{position: 'absolute', inset: 12, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 3}} />
          <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.bg, 0.45)}} />
        </div>
        <div style={{fontSize: 20, color: theme.dim, marginTop: 12}}>图纸 · 挂墙蒙尘</div>
      </div>
      <div style={{fontSize: 32, color: theme.dim}}>vs</div>
      <div style={{opacity: enter[1], width: 340, textAlign: 'center'}}>
        <div style={{width: 300, height: 74, margin: '0 auto', border: `2px solid ${theme.ok}`, borderRadius: 8, position: 'relative', overflow: 'hidden', background: theme.panel}}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{position: 'absolute', top: 16, left: ((i * 24 + belt) % 144) * 2, width: 16, height: 40, borderRadius: 3, background: withAlpha(theme.ok, 0.4)}} />
          ))}
        </div>
        <div style={{fontSize: 20, color: theme.ok, marginTop: 12}}>装配线 · 走带运行中</div>
      </div>
    </AbsoluteFill>
  );
};

/** 在线考核计数器恒 0（8-D 尾）：0 闪烁。 */
const ZeroCounter: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 14});
  const blink = useImpulse({at: at + 20, dur: 50, peak: 1});
  return (
    <div style={{position: 'absolute', bottom: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <span style={{padding: '8px 24px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 10, fontSize: 26, color: theme.conceptDeep, fontFamily: theme.mono}}>
        在线考核 · 调用数据 = 0{blink > 0.3 ? ' ▂' : ''}
      </span>
    </div>
  );
};

/** 修复序三步梯（8-F）：断边先接 / 执法点统一 / 死亡段立规 + 轴依赖链 + 三标。 */
const FixLadder: React.FC<{
  at: number;
  step1At: number;
  step2At: number;
  step3At: number;
  chainAt: number;
  chipsAt: number;
}> = ({at, step1At, step2At, step3At, chainAt, chipsAt}) => {
  const frame = useEnter('rise', {at, dur: 18});
  const s1 = useProgress(step1At, 16);
  const s2 = useProgress(step2At, 16);
  const s3 = useProgress(step3At, 16);
  // 轴依赖箭头链：资产+权威 → 装配 → 检索 → 复利
  const chain = useStagger(4, {stride: 16, at: chainAt});
  const chips = useStagger(3, {stride: 10, at: chipsAt});
  const steps: Array<{p: number; glyph: string; title: string; sub: string}> = [
    {p: s1, glyph: '⤳', title: '第一步 · 断边先接', sub: '会话→长期记忆 三件套补齐'},
    {p: s2, glyph: '⌗', title: '第二步 · 执法点统一', sub: '闸门挪到必经主路'},
    {p: s3, glyph: '⚖', title: '第三步 · 死亡段立规', sub: '对象退场 · 有葬礼'},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      <div style={{...frame, display: 'flex', alignItems: 'flex-end', gap: 26}}>
        {steps.map((st, i) => (
          <div key={st.title} style={{opacity: 0.35 + st.p * 0.65, width: 270, padding: '18px 20px', border: `2px solid ${st.p > 0.5 ? theme.ok : theme.panelBorder}`, borderRadius: 10, background: theme.panel, marginBottom: i * 34, transform: `translateY(${(1 - st.p) * 14}px)`}}>
            <div style={{fontSize: 30, color: st.p > 0.5 ? theme.ok : theme.dim}}>{st.glyph}</div>
            <div style={{fontSize: 22, color: theme.text, marginTop: 8}}>{st.title}</div>
            <div style={{fontSize: 17, color: theme.dim, marginTop: 6}}>{st.sub}</div>
          </div>
        ))}
      </div>
      {/* 轴依赖序箭头链 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        {['资产+权威', '装配', '检索', '复利'].map((t, i) => (
          <div key={t} style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{opacity: chain[i], padding: '6px 16px', border: `1.5px solid ${i === 0 ? theme.ok : theme.concept}`, borderRadius: 8, fontSize: 19, color: i === 0 ? theme.ok : theme.concept}}>{t}</span>
            {i < 3 ? <span style={{fontSize: 20, color: theme.dim, opacity: chain[i + 1]}}>→</span> : null}
          </div>
        ))}
      </div>
      {/* 只增不改 · 带开关 · 出错降级 */}
      <div style={{display: 'flex', gap: 16}}>
        {['只增不改', '带开关', '出错降级'].map((t, i) => (
          <span key={t} style={{opacity: chips[i], padding: '6px 18px', border: `1.5px solid ${theme.ok}`, borderRadius: 999, fontSize: 19, color: theme.ok}}>{t}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 回环三堵（8-G）：飞机回归 + 错（橙）→堵（绿）三连配对快剪。 */
const LoopPlugs: React.FC<{at21: number; pair1At: number; pair2At: number; pair3At: number}> = ({at21, pair1At, pair2At, pair3At}) => {
  const plane = useEnter('rise', {at: at21, dur: 18});
  const pairs = [useProgress(pair1At, 14), useProgress(pair2At, 14), useProgress(pair3At, 14)];
  const data: Array<[string, string]> = [
    ['过期页', '新鲜度信号 · 源一动就回取'],
    ['两页打架', '冲突浮出 · 人工裁决'],
    ['无签关盖', '权限取交集 · 只有一道门'],
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
      <svg width={190} height={64} style={plane}>
        <path d="M 14 44 L 84 22 L 138 22 L 176 38 L 176 46 L 14 46 Z" fill="none" stroke={theme.concept} strokeWidth={2.5} />
        <line x1={92} y1={22} x2={102} y2={4} stroke={theme.concept} strokeWidth={2.5} />
        <line x1={96} y1={12} x2={152} y2={12} stroke={theme.concept} strokeWidth={2.5} />
      </svg>
      {data.map(([bad, fix], i) => (
        <div key={bad} style={{display: 'flex', alignItems: 'center', gap: 20, opacity: pairs[i]}}>
          <span style={{width: 210, textAlign: 'center', padding: '10px 0', border: `2px solid ${theme.conceptDeep}`, borderRadius: 8, fontSize: 22, color: theme.conceptDeep, textDecoration: 'line-through', opacity: 0.85}}>{bad}</span>
          <span style={{fontSize: 24, color: theme.ok}}>→</span>
          <span style={{padding: '10px 20px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 22, color: theme.ok, background: withAlpha(theme.ok, 0.05)}}>{fix}</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 终幕（8-H）：机库灯下实习生剪影 → 工卡+目录卡 → 97/4 复现 → 三标 → 三面 →
 *  盖满最后一格章全屏定格 → 机库灯次第暗 → 系列卡（「下期」）。 */
const Finale: React.FC<{
  totalFrames: number;
  at27: number;
  at28: number;
  at29: number;
  at30: number;
  at31: number;
  at32: number;
}> = ({totalFrames, at27, at28, at29, at30, at31, at32}) => {
  const f = useCurrentFrame();
  const walk = useProgress(at27, 90);
  const bars = useEnter('rise', {at: at29, dur: 16});
  const trio = useStagger(3, {stride: 12, at: at30});
  const faces = useStagger(3, {stride: 14, at: at31});
  const seal = useSpring('settle', {at: at32 + 10, dur: 14});
  // 机库灯次第暗：盖章定格后三盏吊灯依次熄灭
  const dimAll = useProgress(at32 + 55, 50);
  const lampsOff = [useProgress(at32 + 55, 20), useProgress(at32 + 72, 20), useProgress(at32 + 89, 20)];
  // 红线四：片尾渐黑从末 beat 总时长推导（motion 层 useFadeOut，禁写死帧数）
  const fade = useFadeOut(totalFrames);
  const cardO = useProgress(at32 + 85, 16);
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {/* 机库轮廓 + 三盏吊灯（次第熄灭） */}
      <svg width={1200} height={420} style={{position: 'absolute', left: 360, top: 90}}>
        <path d="M 30 400 L 30 200 Q 600 -60 1170 200 L 1170 400" fill="none" stroke={theme.panelBorder} strokeWidth={3} />
        {[180, 600, 1020].map((x, i) => (
          <g key={x} opacity={(1 - dimAll) * (1 - lampsOff[i]) + 0.04}>
            <line x1={x} y1={70 + Math.abs(600 - x) * 0.06} x2={x} y2={120} stroke={theme.panelBorder} strokeWidth={2} />
            <ellipse cx={x} cy={128} rx={34} ry={10} fill={theme.concept} opacity={0.75} />
            <ellipse cx={x} cy={128} rx={64} ry={20} fill={withAlpha(theme.concept, 0.12)} />
          </g>
        ))}
      </svg>
      {/* 实习生剪影：走进机库（聪明但不慌：匀步；走完后步幅收敛为站立微动） */}
      <div style={{position: 'absolute', bottom: 210, left: 240 + walk * 520}}>
        <svg width={90} height={170}>
          <circle cx={45} cy={20} r={16} fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <line x1={45} y1={36} x2={45} y2={96} stroke={theme.dim} strokeWidth={2.5} />
          <line x1={45} y1={96} x2={33 + Math.sin(f / 9) * 6 * (1 - 0.85 * walk)} y2={152} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={45} y1={96} x2={57 - Math.sin(f / 9) * 6 * (1 - 0.85 * walk)} y2={152} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={45} y1={46} x2={26} y2={72} stroke={theme.dim} strokeWidth={2.5} />
          <line x1={45} y1={46} x2={64} y2={72} stroke={theme.dim} strokeWidth={2.5} />
        </svg>
      </div>
      {/* 摘要带（上半区，逐句换场） */}
      <Sequence from={at28} durationInFrames={at29 - at28} name="8-H-cameo" layout="none">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 44, paddingTop: 90}}>
          <WorkCard stamps={0} totalSlots={9} w={300} label="给他的工卡" />
          <CatalogCard small at={8} version="rev.2026-03" address="ctx://amm/32-11" />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={at29} durationInFrames={at31 - at29} name="8-H-bars" layout="none">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 120, gap: 30}}>
          <div style={bars}><RatioBars at={0} /></div>
          <div style={{display: 'flex', gap: 18}}>
            {['蓝图', '判定面', '施工'].map((t, i) => (
              <span key={t} style={{opacity: trio[i], padding: '8px 22px', border: `2px solid ${theme.ok}`, borderRadius: 999, fontSize: 24, color: theme.ok}}>差距在{t}</span>
            ))}
          </div>
          <div style={{display: 'flex', gap: 26, marginTop: 8}}>
            {[
              {t: '验收面', q: '防住什么坏法'},
              {t: '结构面', q: '沿哪几条维度'},
              {t: '时间面', q: '一生怎么流'},
            ].map((x, i) => (
              <div key={x.t} style={{opacity: faces[i], width: 210, padding: '14px 12px', border: `1.5px solid ${theme.concept}`, borderRadius: 10, textAlign: 'center'}}>
                <div style={{fontSize: 23, color: theme.concept}}>{x.t}</div>
                <div style={{fontSize: 17, color: theme.dim, marginTop: 6}}>{x.q}</div>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>
      {/* 盖满最后一格章：全屏定格（全片唯一）→ 放行 */}
      <Sequence from={at32} name="8-H-stamp" layout="none">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'relative', transform: `scale(${0.9 + seal * 0.1})`}}>
            <WorkCard stamps={9} totalSlots={9} highlightSlot={8} w={430} label="工卡 · 关盖放行" />
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
                transform: `rotate(12deg) scale(${seal})`,
                opacity: seal,
                background: withAlpha(theme.bg, 0.9),
                letterSpacing: 6,
              }}
            >
              放行
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
      {/* 系列卡（「下期」口径；本集唯一豁免处） */}
      <div style={{position: 'absolute', bottom: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: cardO}}>
        <div style={{padding: '18px 44px', border: `2px solid ${theme.concept}`, borderRadius: 14, background: withAlpha(theme.bg, 0.92), textAlign: 'center'}}>
          <div style={{fontSize: 22, color: theme.concept, letterSpacing: 6}}>下期</div>
          <div style={{fontSize: 30, color: theme.text, marginTop: 10}}>{seriesLayers.next}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
