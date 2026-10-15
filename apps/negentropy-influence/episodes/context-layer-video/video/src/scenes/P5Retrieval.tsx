/** P5 检索轴：影子板（p5-01..p5-34，34 句；storyboard v3「P5 检索轴」节）。
 *
 *  8 镜 / 13 条 archify cue：
 *   5-A 剖面高亮工具间（HangarCrossSection built retrieval）+ 影子板（v2 迁移）+ 新工具画格
 *   5-B WideFunnel 宽进严出三段流水线（新组件；carry/rerank/gate 对三段口播句）
 *   5-C 信任徽章 + 五源信号同一把尺 + 排序罗盘四针
 *   5-D fm2-def hold 链@p5-15..16、p5-18..19（p5-17 留空窗给代码走廊②+走路小人踩空——
 *       证据装置保可读；三填法角标@p5-19 叠画框上仍可读）
 *   5-E ol-conflict hold 链@p5-20、p5-22..23（p5-21 留空窗给复核提问气泡；底稿/保留单
 *       装置让位；承 5-D 链尾背靠背 → lead=false）→ 「验证锚定」判词条
 *   5-F fm2-def 链@p5-25..27（477 vs 48 属定义执法簇——图回放即 canonical 对峙；前隔
 *       p5-24 空窗恢复入场）+ 实线徽 + grain 角标（叠画框外可读）
 *   5-G ae-guard 链@p5-28..30（题库闸；p5-31 空窗给子代理回程+蒸馏结论角标——
 *       承 5-F 链尾背靠背 → lead=false）
 *   5-H 判词条「候选集质量=答案上限」+ 剖面推进切培训室
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useProgress, usePushIn, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {HangarCrossSection} from '../components/HangarCrossSection';
import {WideFunnel} from '../components/WideFunnel';

export const P5Retrieval: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-09');
  const bC = w('p5-10', 'p5-14');
  const bD = w('p5-15', 'p5-19');
  const bE = w('p5-20', 'p5-24');
  const bF = w('p5-25', 'p5-27');
  const bG = w('p5-28', 'p5-32');
  const bH = w('p5-33', 'p5-34');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P5" tagline="检索轴 · 影子板" accent={theme.concept} />

      {/* 5-A 开轴影子板：剖面聚光工具间（首句窗）→ 影子板全景 + 新工具画格 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="5-A">
        <Sequence from={0} durationInFrames={dur('p5-01')} name="5-A-hangar">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <HangarCrossSection built highlight="retrieval" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p5-02') - bA.from} name="5-A-dev">
          <ShadowBoard at={0} chipAt={at('p5-03') - at('p5-02')} drawAt={at('p5-04') - at('p5-02')} />
        </Sequence>
      </Sequence>

      {/* 5-B 宽进严出：三段流水线（新组件，三拍对三句）+ 信噪比角标 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="5-B">
        <WideFunnel
          at={0}
          carryAt={at('p5-06') - bB.from}
          rerankAt={at('p5-07') - bB.from}
          gateAt={at('p5-08') - bB.from}
        />
        <FootChip at={at('p5-09') - bB.from} text="截断 = 信噪比控制 · 淡出不删" accent={theme.ok} />
      </Sequence>

      {/* 5-C 信任归一：徽章点亮 → 信号同一把尺 → 排序罗盘 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="5-C">
        <TrustRuler at10={at('p5-10') - bC.from} at12={at('p5-12') - bC.from} at14={at('p5-14') - bC.from} />
      </Sequence>

      {/* 5-D 中文坑：fm2-def hold 链（p5-17 空窗给代码走廊②+踩空——证据装置保可读；三填法角标叠画框上） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="5-D">
        <Walker at15={at('p5-15') - bD.from} sinkAt={at('p5-17') - bD.from} />
        <div style={{position: 'absolute', top: 420, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <CodePane
            at={at('p5-17') - bD.from}
            lines={[
              "to_tsvector('english', '用户偏好先给结论，少铺垫')",
              "  → '少铺垫':2  '用户偏好先给结论':1   ← 连续汉字段 = 1 个 token",
              "plainto_tsquery('english','先给结论') @@ … → f",
              '关键词腿全空 · KB 无回退',
            ]}
            badge={{level: 'filled', note: 'PG 实测 · tsvector english'}}
          />
        </div>
        <ArchifyRecap slug="failure-map" caption="口径与检索 · 定义执法簇" cues={[
          {chapterId: 'fm2-def', at: at('p5-15') - bD.from, durationInFrames: dur('p5-15')},
          {chapterId: 'fm2-def', at: at('p5-16') - bD.from, durationInFrames: dur('p5-16'), fit: 'hold'},
          {chapterId: 'fm2-def', at: at('p5-18') - bD.from, durationInFrames: dur('p5-18'), fit: 'hold'},
          {chapterId: 'fm2-def', at: at('p5-19') - bD.from, durationInFrames: dur('p5-19'), fit: 'hold'},
        ]} />
        <div style={{position: 'absolute', bottom: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16}}>
          {['重建关键词索引', '入库预切词', '查询绕行'].map((t, i) => (
            <FixChip key={t} text={t} at={at('p5-19') - bD.from + i * 10} />
          ))}
        </div>
      </Sequence>

      {/* 5-E 放行验证：ol-conflict hold 链（p5-21 空窗给提问气泡；底稿/保留单让位）→ 判词条 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="5-E">
        <RIIGate at21={at('p5-21') - bE.from} at22={at('p5-22') - bE.from} at23={at('p5-23') - bE.from} />
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="验证锚定 · 冲突两态" cues={[
          {chapterId: 'ol-conflict', at: at('p5-20') - bE.from, durationInFrames: dur('p5-20')},
          {chapterId: 'ol-conflict', at: at('p5-22') - bE.from, durationInFrames: dur('p5-22'), fit: 'hold'},
          {chapterId: 'ol-conflict', at: at('p5-23') - bE.from, durationInFrames: dur('p5-23'), fit: 'hold'},
        ]} lead={false} />
        <Sequence from={at('p5-24') - bE.from} name="5-E-strip">
          <JudgeStrip text="验证锚定 · 绝不冒充背书" accent={theme.ok} />
        </Sequence>
      </Sequence>

      {/* 5-F 477 vs 48：fm2-def 链（定义执法簇 canonical 对峙；徽/角标叠画框外可读） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="5-F">
        <Crash477 at={0} />
        <div style={{position: 'absolute', bottom: 150, left: 80}}>
          <EvidenceBadge level="solid" at={at('p5-26') - bF.from} note="第三方复现 · 玩具版 4 vs 3" />
        </div>
        <ArchifyRecap slug="failure-map" caption="定义执法 · 重复计数" cues={[
          {chapterId: 'fm2-def', at: at('p5-25') - bF.from, durationInFrames: dur('p5-25')},
          {chapterId: 'fm2-def', at: at('p5-26') - bF.from, durationInFrames: dur('p5-26'), fit: 'hold'},
          {chapterId: 'fm2-def', at: at('p5-27') - bF.from, durationInFrames: dur('p5-27'), fit: 'hold'},
        ]} />
        <FootChip at={at('p5-27') - bF.from} text="先汇总再挂单 · grain 塌缩不可逆" accent={theme.conceptDeep} />
      </Sequence>

      {/* 5-G 题库与子代理：ae-guard 链（p5-31 空窗给跑腿小人回程+蒸馏结论角标——叠画框上可读） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="5-G">
        <QuizDeck at={0} />
        <SubagentRunner outAt={at('p5-29') - bG.from} backAt={at('p5-30') - bG.from} />
        <ArchifyRecap slug="assembly-economics" caption="出口守卫 · 题库闸" cues={[
          {chapterId: 'ae-guard', at: at('p5-28') - bG.from, durationInFrames: dur('p5-28')},
          {chapterId: 'ae-guard', at: at('p5-29') - bG.from, durationInFrames: dur('p5-29'), fit: 'hold'},
          {chapterId: 'ae-guard', at: at('p5-30') - bG.from, durationInFrames: dur('p5-30'), fit: 'hold'},
        ]} lead={false} />
        <FootChip at={at('p5-28') - bG.from + 60} text="题库 ≤20 · 多则反噬" accent={theme.conceptDeep} />
        <FootChip at={at('p5-31') - bG.from} text="隔离的只是它看到的 · 不是它的权限" accent={theme.conceptDeep} />
        <Sequence from={at('p5-32') - bG.from} name="5-G-strip">
          <JudgeStrip text="候选集质量 · 决定答案上限" accent={theme.concept} />
        </Sequence>
      </Sequence>

      {/* 5-H 收束：判词条（p5-33 窗）→ 剖面推进切培训室（p5-34 窗，互斥换场） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="5-H">
        <Sequence from={0} durationInFrames={dur('p5-33')} name="5-H-strip">
          <JudgeStrip text="找得到 · 排得准 · 答案才有上限" accent={theme.concept} />
        </Sequence>
        <Sequence from={at('p5-34') - bH.from} name="5-H-push">
          <HangarPush />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 影子板（v2 迁移）：轮廓格工具入格 + 「不在册=不存在」chip + 新工具画格（虚线→实线）。 */
const ShadowBoard: React.FC<{at: number; chipAt: number; drawAt: number}> = ({at, chipAt, drawAt}) => {
  const cells = useStagger(8, {stride: 8, at});
  const chip = useProgress(chipAt, 12);
  const draw = useSpring('settle', {at: drawAt + 6, dur: 22});
  const fill = useProgress(drawAt + 26, 12);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: 760, height: 400, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 14, padding: 18}}>
        {cells.map((k, i) => (
          <div
            key={i}
            style={{
              border: `2px dashed ${k > 0.05 ? theme.concept : theme.panelBorder}`,
              opacity: 0.35 + k * 0.65,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              color: theme.dim,
            }}
          >
            {['🔧', '🪛', '🔩', '📏', '🔋', '🧯', '💡', '🛞'][i]}
          </div>
        ))}
        {/* 新工具进编制：先画格（虚线描出）再实线化 = 自动贴标纳管 */}
        <div
          style={{
            position: 'absolute',
            right: 60,
            bottom: 60,
            width: 150,
            height: 130,
            borderRadius: 10,
            border: `2.5px ${fill > 0.5 ? 'solid' : 'dashed'} ${theme.ok}`,
            opacity: draw,
            background: withAlpha(theme.ok, 0.05),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            color: theme.ok,
          }}
        >
          新工具 · 先画格
        </div>
      </div>
      <div style={{position: 'absolute', bottom: 170, left: 0, right: 0, textAlign: 'center', fontSize: 21, color: theme.dim, opacity: chip}}>
        件件有格 · 不在板 = 不在册
      </div>
    </AbsoluteFill>
  );
};

/** 底部角标 chip（bottom:170 避让字幕带）。 */
const FootChip: React.FC<{at: number; text: string; accent: string}> = ({at, text, accent}) => {
  const enter = useEnter('rise', {at, dur: 14});
  return (
    <div style={{position: 'absolute', bottom: 170, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <span style={{padding: '7px 20px', border: `1.5px solid ${accent}`, borderRadius: 999, fontSize: 20, color: accent, background: withAlpha(theme.bg, 0.85)}}>
        {text}
      </span>
    </div>
  );
};

const FixChip: React.FC<{at: number; text: string}> = ({at, text}) => {
  const enter = useEnter('rise', {at, dur: 12});
  return (
    <span style={{opacity: enter.opacity, transform: enter.transform, padding: '6px 16px', border: `1.5px solid ${theme.ok}`, borderRadius: 999, fontSize: 19, color: theme.ok}}>
      {text}
    </span>
  );
};

/** 信任徽章 + 同一把尺 + 排序罗盘（5-C 三段）。 */
const TrustRuler: React.FC<{at10: number; at12: number; at14: number}> = ({at10, at12, at14}) => {
  const enter = useEnter('rise', {at: at10, dur: 16});
  const badges = useStagger(2, {stride: 22, at: at10 + 6});
  const marks = useStagger(4, {stride: 14, at: at12});
  const align = useProgress(at12 + 60, 26);
  const needles = useStagger(4, {stride: 12, at: at14, dur: 8});
  const sweep = useSpring('settle', {at: at14 + 30, dur: 30});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90}}>
      <div style={{...enter, display: 'flex', flexDirection: 'column', gap: 24}}>
        {[
          {t: '版次号', sub: 'REV 随对象走'},
          {t: '校准证书', sub: '可溯源 · 才可信'},
        ].map((b, i) => (
          <div key={b.t} style={{opacity: badges[i], display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', border: `2px solid ${theme.ok}`, borderRadius: 10, background: withAlpha(theme.ok, 0.05)}}>
            <span style={{fontSize: 26, color: theme.ok}}>✓</span>
            <div>
              <div style={{fontSize: 24, color: theme.text}}>{b.t}</div>
              <div style={{fontSize: 17, color: theme.dim}}>{b.sub}</div>
            </div>
          </div>
        ))}
        {/* 五源信号拉到同一把尺 */}
        <div style={{marginTop: 6}}>
          <div style={{fontSize: 17, color: theme.dim, marginBottom: 8}}>重要度 · 引用量 · 通过率 · 新鲜度 → 同一把尺</div>
          <div style={{position: 'relative', height: 34, width: 360}}>
            <div style={{position: 'absolute', left: 0, right: 0, top: 16, height: 2, background: theme.panelBorder}} />
            {[0.1, 0.32, 0.58, 0.84].map((p, i) => (
              <div key={i} style={{position: 'absolute', left: `${p * 100}%`, top: 16 - 26 * marks[i] * (0.4 + align * 0.6), width: 2, height: 26 * marks[i], background: i === 0 ? theme.ok : theme.concept}} />
            ))}
          </div>
        </div>
      </div>
      {/* 排序罗盘：四针（相关/权威/热度/新鲜），权威压过声量 */}
      <svg width={340} height={340} style={enter}>
        <circle cx={170} cy={170} r={130} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
        <circle cx={170} cy={170} r={88} fill="none" stroke={theme.panelBorder} strokeWidth={1} />
        {[
          {label: '相关', angle: -90, color: theme.concept},
          {label: '权威', angle: -90, color: theme.ok},
          {label: '热度', angle: -90, color: theme.dim},
          {label: '新鲜', angle: -90, color: theme.conceptDeep},
        ].map((n, i) => {
          const a = ((n.angle + needles[i] * 340 + (i === 1 ? sweep * 14 : 0)) * Math.PI) / 180;
          const len = i === 1 ? 108 : 74;
          return (
            <g key={n.label}>
              <line x1={170} y1={170} x2={170 + Math.cos(a) * len} y2={170 + Math.sin(a) * len} stroke={n.color} strokeWidth={i === 1 ? 4 : 2.5} strokeLinecap="round" opacity={needles[i]} />
              <text x={170 + Math.cos(a) * (len + 22)} y={170 + Math.sin(a) * (len + 22) + 6} textAnchor="middle" fill={n.color} fontSize={17}>
                {n.label}
              </text>
            </g>
          );
        })}
        <circle cx={170} cy={170} r={6} fill={theme.dim} />
      </svg>
    </AbsoluteFill>
  );
};

/** 走路小人（5-D，v2 销账实装）：两条腿走路 → 关键词腿踩空（橙）。 */
const Walker: React.FC<{at15: number; sinkAt: number}> = ({at15, sinkAt}) => {
  const f = useCurrentFrame();
  const enter = useEnter('rise', {at: at15, dur: 16});
  const sink = useSpring('settle', {at: sinkAt, dur: 24});
  const step = Math.sin(f / 7);
  // 关键词腿：踩空后垂进地面缺口
  const keyAngle = step * 26 + sink * 52;
  const semAngle = -step * 26;
  const tilt = sink * 10;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120}}>
      <div style={{position: 'relative', width: 420, height: 240}}>
        {/* 地面 + 关键词缺口 */}
        <div style={{position: 'absolute', bottom: 20, left: 0, right: 0, height: 3, background: theme.panelBorder}} />
        <div style={{position: 'absolute', bottom: 14, left: 150, width: 120, height: 14, border: `2px dashed ${theme.conceptDeep}`, borderRadius: 4, opacity: sink, background: withAlpha(theme.bg, 0.9)}} />
        {/* 小人：头/躯干/双腿 */}
        <div style={{position: 'absolute', left: 150, top: 20, transform: `rotate(${tilt}deg)`, transformOrigin: '150px 120px'}}>
          <svg width={140} height={190}>
            <circle cx={70} cy={26} r={20} fill="none" stroke={theme.dim} strokeWidth={2.5} />
            <line x1={70} y1={46} x2={70} y2={116} stroke={theme.dim} strokeWidth={2.5} />
            {/* 语义腿（钢蓝） */}
            <line x1={70} y1={116} x2={70 + Math.sin((semAngle * Math.PI) / 180) * 66} y2={116 + Math.cos((semAngle * Math.PI) / 180) * 66} stroke={theme.concept} strokeWidth={3} strokeLinecap="round" />
            {/* 关键词腿（橙，踩空） */}
            <line x1={70} y1={116} x2={70 + Math.sin((keyAngle * Math.PI) / 180) * 66} y2={116 + Math.cos((keyAngle * Math.PI) / 180) * 66} stroke={theme.conceptDeep} strokeWidth={3} strokeLinecap="round" />
            <line x1={70} y1={60} x2={44 + step * 6} y2={86} stroke={theme.dim} strokeWidth={2.5} />
            <line x1={70} y1={60} x2={96 - step * 6} y2={86} stroke={theme.dim} strokeWidth={2.5} />
          </svg>
        </div>
        {/* 腿标签 */}
        <span style={{position: 'absolute', left: 250, top: 196, fontSize: 19, color: theme.conceptDeep, opacity: sink}}>关键词 · 踩空</span>
        <span style={{position: 'absolute', left: 18, top: 196, fontSize: 19, color: theme.concept}}>语义 · 还在走</span>
      </div>
    </AbsoluteFill>
  );
};

/** 复核放行（5-E）：提问气泡 → 带版次底稿拍台（绿）→ 保留单（橙）。 */
const RIIGate: React.FC<{at21: number; at22: number; at23: number}> = ({at21, at22, at23}) => {
  const bubble = useEnter('rise', {at: at21, dur: 14});
  const slap = useSpring('settle', {at: at22 + 6, dur: 14});
  const retain = useSpring('settle', {at: at23 + 8, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
      <div style={{...bubble, padding: '12px 28px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 16, background: theme.panel, fontSize: 24, color: theme.text}}>
        复核员：「这个力矩值 · 依据哪一版？」
      </div>
      <div style={{display: 'flex', gap: 64, alignItems: 'center'}}>
        <div style={{transform: `scale(${slap}) rotate(-3deg)`, padding: '22px 30px', background: theme.paper, borderRadius: 8, color: theme.paperInk}}>
          <div style={{fontSize: 20, color: theme.paperInkDim}}>带版次底稿</div>
          <div style={{fontSize: 44, fontWeight: 700}}>45 N·m · rev.D</div>
          <div style={{fontSize: 16, color: theme.paperInkDim, marginTop: 6}}>校准证书 №A-1123</div>
        </div>
        <div style={{fontSize: 36, color: theme.dim}}>∥</div>
        <div style={{transform: `scale(${retain}) rotate(4deg)`, padding: '18px 26px', border: `2.5px dashed ${theme.conceptDeep}`, borderRadius: 8}}>
          <div style={{fontSize: 24, color: theme.conceptDeep}}>保留单</div>
          <div style={{fontSize: 18, color: theme.dim, marginTop: 4}}>未经核准 · 跟着飞机走</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 判词条（各幕收束通用形；带底幕遮断前一装置）。 */
const JudgeStrip: React.FC<{text: string; accent: string}> = ({text, accent}) => {
  const enter = useEnter('rise', {at: 4, dur: 18});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', background: withAlpha(theme.bg, 0.92)}}>
      <div style={{...enter, padding: '16px 40px', border: `2.5px solid ${accent}`, borderRadius: 12, fontSize: 34, color: accent, letterSpacing: 2, background: withAlpha(theme.bg, 0.85)}}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** 477 vs 48（v2 迁移）：完全正确的算式算出重复计数。 */
const Crash477: React.FC<{at: number}> = ({at}) => {
  const grow = useSpring('settle', {at: at + 10, dur: 45});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 120, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>{Math.round(48 + 429 * grow)}</div>
        <div style={{fontSize: 22, color: theme.dim}}>上游提前汇总 · 重复计数</div>
      </div>
      <div style={{fontSize: 40, color: theme.dim}}>vs</div>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 120, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>48</div>
        <div style={{fontSize: 22, color: theme.dim}}>真实答案</div>
      </div>
    </AbsoluteFill>
  );
};

/** 题库卡组（5-G，v2 销账实装）：命中翻面亮绿（出示盖章底稿）。 */
const QuizDeck: React.FC<{at: number}> = ({at}) => {
  const cards = [0, 1, 2, 3].map((i) => at + 16 + i * 16);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30}}>
      <div style={{fontSize: 24, color: theme.dim, width: 120, textAlign: 'right'}}>题库<br />最后一道闸</div>
      {cards.map((flipAt, i) => (
        <QuizCard key={i} flipAt={flipAt} index={i} />
      ))}
    </AbsoluteFill>
  );
};

const QuizCard: React.FC<{flipAt: number; index: number}> = ({flipAt, index}) => {
  const flip = useSpring('settle', {at: flipAt, dur: 18});
  // 翻面：背面 scaleX 1→0，绿面 0→1（两片叠放，无 3D 依赖）
  const back = Math.max(0, 1 - flip * 2);
  const front = Math.max(0, flip * 2 - 1);
  return (
    <div style={{position: 'relative', width: 128, height: 168}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          background: theme.panel,
          border: `2px solid ${theme.concept}`,
          transform: `scaleX(${back})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: theme.concept,
        }}
      >
        <span style={{fontSize: 22, fontFamily: theme.mono}}>{`Q${index + 1}`}</span>
        <span style={{fontSize: 15, color: theme.dim}}>核准答案</span>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 8,
          background: withAlpha(theme.ok, 0.12),
          border: `2px solid ${theme.ok}`,
          transform: `scaleX(${front})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <span style={{fontSize: 26, color: theme.ok}}>✓</span>
        <span style={{fontSize: 15, color: theme.ok}}>底稿 · 已盖章</span>
      </div>
    </div>
  );
};

/** 子代理跑腿小人（5-G）：背探查包出门（用完即弃）→ 只带回一页蒸馏结论。 */
const SubagentRunner: React.FC<{outAt: number; backAt: number}> = ({outAt, backAt}) => {
  const f = useCurrentFrame();
  const outP = useProgress(outAt, 60);
  const backP = useProgress(backAt, 70);
  // 往返：200 → 700（去程）→ 200（回程）
  const x = 200 + outP * 500 - backP * 500;
  const step = Math.sin(f / 5) * (outP > 0 && outP < 1 ? 1 : backP > 0 && backP < 1 ? 1 : 0.15);
  const carrying = backP > 0.5;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', paddingBottom: 300}}>
      <div style={{position: 'relative', height: 200, transform: `translateX(${x}px)`}}>
        <svg width={110} height={180}>
          <circle cx={55} cy={22} r={17} fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <line x1={55} y1={39} x2={55} y2={104} stroke={theme.dim} strokeWidth={2.5} />
          <line x1={55} y1={104} x2={55 + step * 24} y2={166} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={55} y1={104} x2={55 - step * 24} y2={166} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" />
          {/* 探查包（去程）/ 蒸馏结论单页（回程） */}
          {!carrying ? (
            <g>
              <rect x={62} y={52} width={34} height={26} rx={5} fill="none" stroke={theme.concept} strokeWidth={2} />
              <text x={79} y={69} textAnchor="middle" fill={theme.concept} fontSize={11}>探查</text>
            </g>
          ) : (
            <g>
              <rect x={64} y={50} width={26} height={34} rx={3} fill={theme.paper} stroke={theme.ok} strokeWidth={2} />
              <text x={77} y={71} textAnchor="middle" fill={theme.paperInk} fontSize={10}>结论</text>
            </g>
          )}
        </svg>
        <div style={{position: 'absolute', top: -2, left: 0, fontSize: 16, color: theme.dim}}>
          {carrying ? '只带回蒸馏结论' : '子代理 · 出门探查'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 288, textAlign: 'center', fontSize: 17, color: theme.dim, opacity: backP}}>
        过程留在用完即弃的窗口
      </div>
    </AbsoluteFill>
  );
};

/** 收束推进：剖面（无高亮）+ pushIn 下一工位方向。 */
const HangarPush: React.FC = () => {
  const push = usePushIn(4, {scale: 0.1, dur: 60});
  return (
    <AbsoluteFill style={{transform: push, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
      <HangarCrossSection built highlight={null} at={0} />
    </AbsoluteFill>
  );
};

/** 代码走廊（v2 P2MasterPage 迁移；本集 ②④ 两处复用，P8Truth import）。 */
export const CodePane: React.FC<{
  at: number;
  lines: string[];
  badge?: {level: 'dashed' | 'solid' | 'filled'; note?: string};
}> = ({at, lines, badge}) => {
  const rows = useStagger(lines.length, {stride: 12, at});
  return (
    <div style={{width: 900, background: theme.terminalBg, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, padding: '18px 24px', fontFamily: theme.mono, boxSizing: 'border-box'}}>
      {lines.map((l, i) => (
        <div key={i} style={{opacity: rows[i], fontSize: 21, lineHeight: 1.9, color: l.includes('⚠') || l.includes('422') || l.includes('←') ? theme.conceptDeep : theme.text, whiteSpace: 'pre'}}>
          <span style={{color: theme.dim, marginRight: 14}}>{String(i + 1).padStart(2, '0')}</span>
          {l}
        </div>
      ))}
      {badge ? (
        <div style={{marginTop: 12}}>
          <EvidenceBadge level={badge.level} at={at + (rows.length - 1) * 12 + 5} note={badge.note} />
        </div>
      ) : null}
    </div>
  );
};
