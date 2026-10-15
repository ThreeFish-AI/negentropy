/** P3 权威轴：会签与放行（p3-01..p3-24，24 句；storyboard v3「P3 权威轴」节）。
 *
 *  7 镜 / 5 条 archify cue（chapterId 均为 tm2-* 新代章 id）：
 *   3-A 剖面高亮放行席位（HangarCrossSection built authority）+ 真闸门 vs 装饰门对照装置
 *   3-B 会签栏四格逐格盖章（v2 P4Signoff 迁移）+ 交集维恩成型
 *   3-C 只减不增计数器（X-001 核对）+ 签字笔悬停→时钟绿闪 + 三作废角标
 *   3-D VennShrink 韦恩收缩+工牌碎裂（v2 销账实装）
 *   3-E tm2-open hold 链@p3-16..17（原跨两句窗拆链，15 铺底 17 hold 补锚）→ tm2-threats@p3-18
 *      （stretch，镜内背靠背自动抑制）；数字墙+实线徽挪 cue 窗后 p3-19
 *   3-F 客户端零验签@p3-20 · tm2-surface@p3-21 → hold@p3-22（三底线句，三卡装置让位；
 *      recap 后置=画框遮盖）· 判词条@p3-23
 *   3-G 剖面推进切机位（收束）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useImpulse, useProgress, usePushIn, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {HangarCrossSection} from '../components/HangarCrossSection';
import {VennShrink} from '../components/VennShrink';

export const P3Authority: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-07');
  const bC = w('p3-08', 'p3-11');
  const bD = w('p3-12', 'p3-15');
  const bE = w('p3-16', 'p3-19');
  const bF = w('p3-20', 'p3-23');
  const bG = w('p3-24');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P3" tagline="权威轴 · 会签与放行" accent={theme.conceptDeep} />

      {/* 3-A 开轴绕开测试：剖面聚光放行席位（首句窗）→ 真闸门 vs 装饰门对照 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="3-A">
        <Sequence from={0} durationInFrames={dur('p3-01')} name="3-A-hangar">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <HangarCrossSection built highlight="authority" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p3-02') - bA.from} name="3-A-dev">
          <DualGate at02={0} at03={at('p3-03') - at('p3-02')} at04={at('p3-04') - at('p3-02')} />
        </Sequence>
      </Sequence>

      {/* 3-B 会签栏：四格逐格盖章 + 资格=交集维恩成型（v2 迁移） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="3-B">
        <SignoffRow at05={at('p3-05') - bB.from} at07={at('p3-07') - bB.from} />
      </Sequence>

      {/* 3-C 只减不增：计数器递减 + 签字笔悬停→时钟绿闪 + 三作废角标 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="3-C">
        <ShrinkCounter at08={at('p3-08') - bC.from} at09={at('p3-09') - bC.from} />
        <Sequence from={at('p3-10') - bC.from} name="3-C-clock">
          <ClockCheck at10={0} at11={at('p3-11') - at('p3-10')} />
        </Sequence>
      </Sequence>

      {/* 3-D 韦恩收缩 + 工牌碎裂（新组件） */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="3-D">
        <VennShrink at={at('p3-12') - bD.from} shrinkAt={at('p3-14') - bD.from} crackAt={at('p3-15') - bD.from} />
      </Sequence>

      {/* 3-E 供给面：tm2-open hold 链铺 p3-16..17 → tm2-threats@p3-18；
          数字墙+实线徽挪 cue 窗后 p3-19（十万份扫描数字句） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="3-E">
        <ArchifyRecap
          slug="blueprint--mcp-threat-model"
          caption="供给面 · 自述不可信"
          cues={[
            {chapterId: 'tm2-open', at: at('p3-16') - bE.from, durationInFrames: dur('p3-16')},
            {chapterId: 'tm2-open', at: at('p3-17') - bE.from, durationInFrames: dur('p3-17'), fit: 'hold'},
            {chapterId: 'tm2-threats', at: at('p3-18') - bE.from, durationInFrames: dur('p3-18')},
          ]}
        />
        <Sequence from={at('p3-19') - bE.from} name="3-E-wall">
          <NumbersWall at={0} />
          <div style={{position: 'absolute', bottom: 150, left: 80}}>
            <EvidenceBadge level="solid" at={6} note="98,380 · 生态扫描" />
          </div>
        </Sequence>
      </Sequence>

      {/* 3-F 三条底线：客户端零验签@20 · tm2-surface 链@p3-21..22（三卡装置让位，recap 后置遮盖）· 判词条@23 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="3-F">
        <ClientRow at20={at('p3-20') - bF.from} />
        <BottomLines at22={at('p3-22') - bF.from} />
        <ArchifyRecap slug="blueprint--mcp-threat-model" caption="供给边界" cues={[
          {chapterId: 'tm2-surface', at: at('p3-21') - bF.from, durationInFrames: dur('p3-21')},
          {chapterId: 'tm2-surface', at: at('p3-22') - bF.from, durationInFrames: dur('p3-22'), fit: 'hold'},
        ]} />
        <Sequence from={at('p3-23') - bF.from} name="3-F-strip">
          <JudgeStrip text="真值唯一出处 · 执法点在必经路" accent={theme.ok} />
        </Sequence>
      </Sequence>

      {/* 3-G 收束：剖面推进切机位工位 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="3-G">
        <HangarPush />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 真闸门 vs 装饰门对照（3-A）：左真闸门绕行线撞横杆弹回；右装饰门旁路畅通（橙警示）。 */
const DualGate: React.FC<{at02: number; at03: number; at04: number}> = ({at02, at03, at04}) => {
  const enter = useStagger(2, {stride: 14, at: at02});
  // 绕行探针：0→1 走向门；真闸门侧在门前后弹回（piecewise），装饰门侧绕过出门
  const probe = useProgress(at03, 44);
  const bounceT = probe < 0.55 ? probe / 0.55 : 1 - (probe - 0.55) / 0.45;
  const passT = probe;
  const rule = useProgress(at04, 14);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60}}>
      {/* 左：真闸门——横杆在必经通道，绕行线被挡弹回 */}
      <div style={{opacity: enter[0], position: 'relative'}}>
        <svg width={420} height={260}>
          <line x1={20} y1={210} x2={400} y2={210} stroke={theme.panelBorder} strokeWidth={3} />
          <text x={210} y={244} textAnchor="middle" fill={theme.ok} fontSize={20}>真闸门 · 绕不开</text>
          <rect x={186} y={130} width={48} height={80} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={1.5} />
          <line x1={150} y1={140} x2={270} y2={140} stroke={theme.ok} strokeWidth={6} strokeLinecap="round" />
          {/* 绕行线：走到横杆前被弹回 */}
          <polyline
            points={`20,190 ${20 + bounceT * 150},190`}
            fill="none"
            stroke={theme.concept}
            strokeWidth={2.5}
            strokeDasharray="7 7"
          />
          <circle cx={20 + bounceT * 150} cy={190} r={6} fill={theme.concept} />
        </svg>
      </div>
      {/* 右：装饰门——旁路畅通（橙警示） */}
      <div style={{opacity: enter[1], position: 'relative'}}>
        <svg width={420} height={260}>
          <line x1={20} y1={210} x2={400} y2={210} stroke={theme.panelBorder} strokeWidth={3} />
          <text x={210} y={244} textAnchor="middle" fill={theme.conceptDeep} fontSize={20}>装饰门 · 旁路畅通</text>
          <rect x={186} y={120} width={48} height={90} fill="none" stroke={theme.conceptDeep} strokeWidth={1.5} strokeDasharray="6 5" />
          {/* 旁路线：弧线绕过门出门 */}
          <path
            d={`M 20 190 C ${60 + passT * 90} 190, ${150 + passT * 120} 108, ${210 + passT * 180} 190`}
            fill="none"
            stroke={theme.conceptDeep}
            strokeWidth={2.5}
          />
          <circle cx={210 + passT * 180} cy={190} r={6} fill={theme.conceptDeep} />
        </svg>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 170,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 21,
          color: theme.dim,
          opacity: rule,
        }}
      >
        闸门长在物理通道上 · 绕开它会发生什么，答得出才算数
      </div>
    </AbsoluteFill>
  );
};

/** 会签栏四格（v2 P4Signoff 迁移）+ 交集维恩小图（p3-07 成型）。 */
const SignoffRow: React.FC<{at05: number; at07: number}> = ({at05, at07}) => {
  const stamps = useStagger(4, {stride: 24, at: at05 + 8});
  const venn = useEnter('pop', {at: at07, dur: 20});
  const labels = ['执照', '机型授权', '必检复核', '客户代表'];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      <div style={{display: 'flex', gap: 22}}>
        {labels.map((t, i) => (
          <div key={t} style={{width: 178, height: 158, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 14}}>
            <span style={{position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', fontSize: 20, color: theme.dim}}>{t}</span>
            <div style={{width: 66, height: 66, borderRadius: 33, border: `3px solid ${theme.ok}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.ok, fontSize: 22, transform: `scale(${stamps[i]})`, opacity: stamps[i]}}>已签</div>
          </div>
        ))}
      </div>
      {/* 资格 = 交集：四格收拢成两圆交集 */}
      <svg width={330} height={140} style={venn}>
        <circle cx={128} cy={70} r={62} fill={withAlpha(theme.concept, 0.16)} stroke={theme.concept} strokeWidth={2} />
        <circle cx={202} cy={70} r={62} fill={withAlpha(theme.conceptDeep, 0.14)} stroke={theme.conceptDeep} strokeWidth={2} />
        <text x={165} y={78} textAnchor="middle" fill={theme.ok} fontSize={22} fontWeight={700}>资格</text>
        <text x={165} y={126} textAnchor="middle" fill={theme.dim} fontSize={18}>全部满足 · 才放行</text>
      </svg>
    </AbsoluteFill>
  );
};

/** 只减不增计数器（v2 迁移；X-001 核对：人数只减不加）+ 不可代签角标。 */
const ShrinkCounter: React.FC<{at08: number; at09: number}> = ({at08, at09}) => {
  // 权重 3+4+4=11 ⇒ 12→1，终值 1 人保交集非空
  const s1 = useSpring('settle', {at: at08 + 6, dur: 20});
  const s2 = useSpring('settle', {at: at08 + 20, dur: 20});
  const s3 = useSpring('settle', {at: at08 + 34, dur: 20});
  const n = 12 - Math.round(s1 * 3 + s2 * 4 + s3 * 4);
  const nosub = useProgress(at09, 12);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18}}>
      <div style={{fontSize: 110, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>
        {n}
        <span style={{fontSize: 40, color: theme.dim}}> 人</span>
      </div>
      <div style={{fontSize: 24, color: theme.dim}}>每加一道会签 · 能关这张卡的人只会更少</div>
      <div style={{display: 'flex', gap: 10}}>
        {[s1, s2, s3].map((s, i) => (
          <div key={i} style={{width: 90, height: 8, background: theme.panelBorder, borderRadius: 4, overflow: 'hidden'}}>
            <div style={{width: `${s * 100}%`, height: '100%', background: theme.conceptDeep}} />
          </div>
        ))}
      </div>
      <div style={{fontSize: 20, color: theme.conceptDeep, opacity: nosub, marginTop: 6}}>不代签 · 一纸不能替另一纸</div>
    </AbsoluteFill>
  );
};

/** 签字笔悬停 → 墙上时钟绿闪（实时求值拍点）+ 三作废角标。 */
const ClockCheck: React.FC<{at10: number; at11: number}> = ({at10, at11}) => {
  const f = useCurrentFrame();
  const enter = useEnter('rise', {at: at10, dur: 18});
  const flash = useImpulse({at: at11 + 8, dur: 20, peak: 1});
  const tags = useStagger(3, {stride: 12, at: at11 + 14});
  const tremble = Math.sin(f / 3) * 2; // 笔尖悬停微颤（帧驱动，禁随机）
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 110}}>
      {/* 签字线 + 悬停笔 */}
      <div style={{...enter, position: 'relative', width: 320}}>
        <div style={{borderBottom: `2px solid ${theme.panelBorder}`, height: 90}} />
        <div style={{fontSize: 18, color: theme.dim, marginTop: 10}}>关盖签字 · 末格</div>
        <div
          style={{
            position: 'absolute',
            left: 150,
            top: 34,
            width: 10,
            height: 78,
            background: theme.concept,
            borderRadius: 3,
            transform: `rotate(24deg) translateY(${tremble}px)`,
          }}
        />
      </div>
      {/* 墙上时钟：落笔前那眼钟，绿闪 = 授权仍有效 */}
      <svg width={240} height={240} style={{...enter}}>
        <circle cx={120} cy={110} r={86} fill={theme.panel} stroke={flash > 0.05 ? theme.ok : theme.panelBorder} strokeWidth={flash > 0.05 ? 5 : 3} />
        <line x1={120} y1={110} x2={120} y2={54} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
        <line x1={120} y1={110} x2={158} y2={124} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
        <circle cx={120} cy={110} r={5} fill={theme.dim} />
        <text x={120} y={228} textAnchor="middle" fill={theme.ok} fontSize={19} opacity={flash}>授权仍有效</text>
      </svg>
      <div style={{position: 'absolute', bottom: 180, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 18}}>
        {['跨班作废', '过期作废', '转授作废'].map((t, i) => (
          <span key={t} style={{opacity: tags[i], padding: '6px 16px', border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 999, fontSize: 19, color: theme.conceptDeep}}>
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 供给面数字墙（v2 NumbersWall 迁移；客户端行挪 3-F 独立装置）。 */
const NumbersWall: React.FC<{at: number}> = ({at}) => {
  const rows = useStagger(3, {stride: 14, at});
  const data: Array<[string, string]> = [
    ['98,380', '份社区技能扫描'],
    ['157', '份确认恶意'],
    ['632', '个漏洞'],
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14}}>
      {data.map(([n, t], i) => (
        <div key={t} style={{opacity: rows[i], display: 'flex', gap: 20, alignItems: 'baseline'}}>
          <span style={{fontSize: 58, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums', minWidth: 260, textAlign: 'right'}}>{n}</span>
          <span style={{fontSize: 24, color: theme.dim}}>{t}</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 四家客户端 + 零验签红叉（3-F 首句）。 */
const ClientRow: React.FC<{at20: number}> = ({at20}) => {
  const marks = useStagger(4, {stride: 10, at: at20 + 6});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 170, gap: 20}}>
      <div style={{display: 'flex', gap: 22}}>
        {['Claude', 'Gemini', 'Codex', 'VS Code'].map((c, i) => (
          <div key={c} style={{position: 'relative', opacity: marks[i]}}>
            <span style={{display: 'inline-block', padding: '8px 18px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 21, color: theme.dim, textDecoration: 'line-through'}}>{c}</span>
            <span style={{position: 'absolute', top: -10, right: -10, fontSize: 22, color: theme.danger, fontWeight: 700}}>✕</span>
          </div>
        ))}
      </div>
      <div style={{fontSize: 21, color: theme.conceptDeep, opacity: marks[3]}}>四家头部客户端 · 零验签</div>
    </AbsoluteFill>
  );
};

/** 三条底线卡（p3-22 点名）。 */
const BottomLines: React.FC<{at22: number}> = ({at22}) => {
  const cards = useStagger(3, {stride: 16, at: at22});
  const lines = ['凭据一源一绑', '描述按不可信处理', '破坏性动作人工确认'];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 120}}>
      <div style={{display: 'flex', gap: 24}}>
        {lines.map((t, i) => (
          <div key={t} style={{opacity: cards[i], width: 250, padding: '20px 18px', border: `2px solid ${theme.ok}`, borderRadius: 10, background: withAlpha(theme.ok, 0.05), textAlign: 'center'}}>
            <div style={{fontSize: 26, color: theme.ok}}>{`底线 ${i + 1}`}</div>
            <div style={{fontSize: 21, color: theme.text, marginTop: 10}}>{t}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 判词条（各幕收束通用形；带底幕遮断前一装置，Sequence 默认 absolute-fill 不进文档流）。 */
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

/** 收束推进：剖面（无高亮）+ pushIn 下一工位方向。 */
const HangarPush: React.FC = () => {
  const push = usePushIn(4, {scale: 0.1, dur: 60});
  return (
    <AbsoluteFill style={{transform: push, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
      <HangarCrossSection built highlight={null} at={0} />
    </AbsoluteFill>
  );
};
