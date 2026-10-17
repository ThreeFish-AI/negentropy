/** P5 检索轴（p5-01..p5-34，34 句；storyboard v4「P5 检索轴」节）。
 *
 *  11 镜 / 6 条 archify cue（lmm-seam ×2 + lc2-l4 ×2 + fm2-supply ×2）：
 *   5-A 三档基线（p5-01..04）：FiveAxisMap 高亮 retrieval（幕首）→ FinanceBench 三档
 *       成绩条 19/50/85（数字基线标尺定式）+ 实线徽 + 结论闪
 *   5-B 宽进严出（p5-05..08）：WideFunnel 三段（carry/rerank/gate 对三句）+ 参考口径角标
 *   5-C 本请求候选（p5-09..10）：候选列表分类着色 + 信噪比标尺指针
 *   5-D 信任四因子（p5-11..13）：四因子权重条 + 规则角标三连
 *   5-E 治理胜出（p5-14..15）：lmm-seam 锚 p5-14 → hold p5-15；前景两份定义卡换位
 *       + RRF 按排名合成角标
 *   5-F 应答契约（p5-16..19）：resolve 三出路卡逐条点亮
 *   5-G 应答锚定（p5-20..21）：lc2-l4 锚 p5-20 → hold p5-21；前景绿章落定 + L4 段位签
 *   5-H 治理≠验证（p5-22..26）：477 vs 48 对撞（明细按天叠层）+ 双标签分位 + >20 角标
 *       + 实线徽（玩具版 4 vs 3）
 *   5-I 走廊②（p5-27..28）：CodePane·PG tsvector english 汉字单 token 实测
 *   5-J 落行登记（p5-29..30）：fm2-supply 锚 p5-29 → hold p5-30；前景查询擦肩小窗
 *       + I-196 角标
 *   5-K 子代理（p5-31..34）：主/子双窗隔离 + 判词条 + FiveAxisMap 推进（passedCount=4）
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {FiveAxisMap} from '../components/FiveAxisMap';
import {WideFunnel} from '../components/WideFunnel';

export const P5Retrieval: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-08');
  const bC = w('p5-09', 'p5-10');
  const bD = w('p5-11', 'p5-13');
  const bE = w('p5-14', 'p5-15');
  const bF = w('p5-16', 'p5-19');
  const bG = w('p5-20', 'p5-21');
  const bH = w('p5-22', 'p5-26');
  const bI = w('p5-27', 'p5-28');
  const bJ = w('p5-29', 'p5-30');
  const bK = w('p5-31', 'p5-34');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P5" tagline="检索轴" accent={theme.concept} />

      {/* 5-A 三档基线：Map-First 幕首 → FinanceBench 三档成绩条 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="5-A">
        <Sequence from={0} durationInFrames={dur('p5-01')} name="5-A-map">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <FiveAxisMap built highlight="retrieval" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p5-02') - bA.from} name="5-A-bars">
          <ThreeTierBars
            at={0}
            midAt={at('p5-03') - at('p5-02')}
            topAt={at('p5-03') - at('p5-02') + 22}
            outroAt={at('p5-04') - at('p5-02')}
          />
          <div style={{position: 'absolute', bottom: 190, left: 80}}>
            <EvidenceBadge level="solid" at={8} note="FinanceBench · 150 题" />
          </div>
        </Sequence>
      </Sequence>

      {/* 5-B 宽进严出：WideFunnel 三段流水线 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="5-B">
        <WideFunnel
          at={0}
          carryAt={at('p5-06') - bB.from}
          rerankAt={at('p5-07') - bB.from}
          gateAt={at('p5-08') - bB.from}
        />
        <div style={{position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <span style={{padding: '7px 20px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 18, color: theme.dim, fontFamily: theme.mono, background: withAlpha(theme.bg, 0.85)}}>
            Anthropic 参考实现与评测口径
          </span>
        </div>
      </Sequence>

      {/* 5-C 本请求候选：分类着色 + 信噪比标尺 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="5-C">
        <CandidateCloseup at={at('p5-09') - bC.from} needleAt={at('p5-10') - bC.from} />
      </Sequence>

      {/* 5-D 信任四因子 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="5-D">
        <TrustRuler at={at('p5-11') - bD.from} barsAt={at('p5-12') - bD.from} rulesAt={at('p5-13') - bD.from} />
      </Sequence>

      {/* 5-E 治理胜出：lmm-seam hold 链 + 前景定义卡换位 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="5-E">
        <ArchifyRecap slug="blueprint--layer-mechanism-map" caption="跨轴接缝 · 口径单点" cues={[
          {chapterId: 'lmm-seam', at: at('p5-14') - bE.from, durationInFrames: dur('p5-14')},
          {chapterId: 'lmm-seam', at: at('p5-15') - bE.from, durationInFrames: dur('p5-15'), fit: 'hold'},
        ]} />
        <GovernedSwap swapAt={at('p5-14') - bE.from + 10} rrfAt={at('p5-15') - bE.from} />
      </Sequence>

      {/* 5-F 应答契约：三出路卡 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="5-F">
        <ResolveContract
          at={at('p5-16') - bF.from}
          d1At={at('p5-17') - bF.from}
          d2At={at('p5-18') - bF.from}
          d3At={at('p5-19') - bF.from}
        />
      </Sequence>

      {/* 5-G 应答锚定：lc2-l4 hold 链 + 前景绿章 + L4 段位签 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="5-G">
        <ArchifyRecap slug="lifecycle" caption="时间面 · L4 应答锚定" cues={[
          {chapterId: 'lc2-l4', at: at('p5-20') - bG.from, durationInFrames: dur('p5-20')},
          {chapterId: 'lc2-l4', at: at('p5-21') - bG.from, durationInFrames: dur('p5-21'), fit: 'hold'},
        ]} />
        <AnchorStamp stampAt={at('p5-20') - bG.from + 12} tagAt={at('p5-21') - bG.from} />
      </Sequence>

      {/* 5-H 治理不等于验证：477 vs 48 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="5-H">
        <Crash47748
          at={at('p5-22') - bH.from}
          pileAt={at('p5-23') - bH.from}
          crashAt={at('p5-24') - bH.from}
          splitAt={at('p5-25') - bH.from}
          slowAt={at('p5-26') - bH.from}
        />
        <div style={{position: 'absolute', bottom: 190, left: 80}}>
          <EvidenceBadge level="solid" at={at('p5-24') - bH.from} note="第三方复现 · 玩具版 4 vs 3" />
        </div>
      </Sequence>

      {/* 5-I 代码走廊②：PG tsvector english 汉字单 token */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="5-I">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <CodePane
            at={at('p5-28') - bI.from}
            lines={[
              "SELECT to_tsvector('english', '指标口径：重复购买率按付款成功订单计算');",
              "  → '指标口径：重复购买率按付款成功订单计算':1  ← 整段汉字 = 1 个 token",
              "SELECT plainto_tsquery('english', '重复购买率') @@ …  → f",
              '关键词腿零命中 · KB 无回退',
            ]}
            badge={{level: 'filled', note: 'PG 实测 · tsvector english'}}
          />
        </AbsoluteFill>
      </Sequence>

      {/* 5-J 落行登记：fm2-supply hold 链 + 前景查询擦肩小窗 */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="5-J">
        <ArchifyRecap slug="failure-map" caption="失效登记簿 · 背书接入四簇" cues={[
          {chapterId: 'fm2-supply', at: at('p5-29') - bJ.from, durationInFrames: dur('p5-29')},
          {chapterId: 'fm2-supply', at: at('p5-30') - bJ.from, durationInFrames: dur('p5-30'), fit: 'hold'},
        ]} />
        <SearchMiss at={at('p5-29') - bJ.from + 8} issueAt={at('p5-30') - bJ.from} />
      </Sequence>

      {/* 5-K 子代理隔离 + 轴收束 */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="5-K">
        <Sequence from={0} durationInFrames={at('p5-34') - bK.from} name="5-K-split">
          <SubAgentSplit
            at={at('p5-31') - bK.from}
            noiseAt={at('p5-32') - bK.from}
            backAt={at('p5-32') - bK.from + 30}
          />
          <JudgeStrip at={at('p5-33') - bK.from} />
        </Sequence>
        <Sequence from={at('p5-34') - bK.from} name="5-K-map">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <FiveAxisMap built highlight={null} passedCount={4} at={4} />
          </AbsoluteFill>
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 5-A：FinanceBench 三档成绩条（19/50/85，数字基线标尺定式）。 */
const ThreeTierBars: React.FC<{at: number; midAt: number; topAt: number; outroAt: number}> = ({at, midAt, topAt, outroAt}) => {
  const g1 = useSpring('settle', {at: at + 4, dur: 32});
  const g2 = useSpring('settle', {at: midAt, dur: 30});
  const g3 = useSpring('settle', {at: topAt, dur: 30});
  const outro = useEnter('rise', {at: outroAt, dur: 16});
  const rows = [
    {v: 19 * g1, label: '所有文档混一个库', color: theme.dim, pct: Math.round(19 * g1)},
    {v: 50 * g2, label: '每份文档单独建库', color: theme.concept, pct: Math.round(50 * g2)},
    {v: 85 * g3, label: '直接给证据页', color: theme.ok, pct: Math.round(85 * g3)},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 30, width: 900}}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
              <span style={{fontSize: 21, color: theme.dim}}>{r.label}</span>
              <span style={{fontSize: 30, color: r.color, fontVariantNumeric: 'tabular-nums', fontFamily: theme.mono}}>{r.pct}%</span>
            </div>
            <div style={{height: 34, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, background: theme.panel}}>
              <div style={{width: `${r.v}%`, height: '100%', background: withAlpha(r.color, 0.75), borderRadius: 7}} />
            </div>
          </div>
        ))}
        {/* 基线标尺：19% 为对比基线 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontFamily: theme.mono, color: theme.dim}}>
          <span style={{width: 14, height: 14, border: `2px solid ${theme.dim}`, borderRadius: 3}} />
          基线 19% · 每档 +检索结构
        </div>
      </div>
      <div style={{...outro, padding: '12px 34px', border: `2.5px solid ${theme.concept}`, borderRadius: 12, fontSize: 30, color: theme.concept, letterSpacing: 2}}>
        检索方式 · 答对的前提
      </div>
    </AbsoluteFill>
  );
};

/** 5-C：本请求候选列表特写 + 信噪比标尺指针。 */
const CandidateCloseup: React.FC<{at: number; needleAt: number}> = ({at, needleAt}) => {
  const rows = useStagger(5, {stride: 8, at});
  const swing = useSpring('settle', {at: needleAt, dur: 26});
  const items = [
    {t: '指标定义文档 · 重复购买率', tone: 'hit'},
    {t: '季度报表说明', tone: 'hit'},
    {t: '数据字典', tone: 'mid'},
    {t: '渠道周报', tone: 'noise'},
    {t: '留存分析 · 不相干', tone: 'noise'},
  ] as const;
  const tone = {
    hit: {c: theme.ok, bg: withAlpha(theme.ok, 0.08)},
    mid: {c: theme.concept, bg: 'transparent'},
    noise: {c: theme.panelBorder, bg: 'transparent'},
  } as const;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 80}}>
      <div style={{width: 640, display: 'flex', flexDirection: 'column', gap: 12}}>
        {items.map((it, i) => (
          <div
            key={it.t}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 18px',
              border: `1.5px solid ${tone[it.tone].c}`,
              background: tone[it.tone].bg,
              borderRadius: 8,
              fontSize: 21,
              fontFamily: theme.mono,
              color: it.tone === 'noise' ? theme.dim : theme.text,
              opacity: rows[i] * (it.tone === 'noise' ? 0.55 : 1),
            }}
          >
            <span style={{fontSize: 16, color: theme.dim}}>{`#${i + 1}`}</span>
            {it.t}
          </div>
        ))}
      </div>
      {/* 信噪比标尺 */}
      <div style={{width: 380, textAlign: 'center'}}>
        <div style={{position: 'relative', height: 30}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 14, height: 2, background: theme.panelBorder}} />
          <div
            style={{
              position: 'absolute',
              left: `${10 + swing * 76}%`,
              top: 2,
              width: 4,
              height: 26,
              borderRadius: 2,
              background: theme.ok,
            }}
          />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 18, fontFamily: theme.mono, color: theme.dim}}>
          <span>噪</span>
          <span style={{color: theme.ok, opacity: swing}}>高信噪端</span>
          <span>信</span>
        </div>
        <div style={{fontSize: 18, color: theme.dim, marginTop: 18}}>截断 · 控制信噪比</div>
      </div>
    </AbsoluteFill>
  );
};

/** 5-D：信任四因子权重条 + 排序规则角标三连。 */
const TrustRuler: React.FC<{at: number; barsAt: number; rulesAt: number}> = ({at, barsAt, rulesAt}) => {
  const enter = useProgress(at, 12);
  const bars = useStagger(4, {stride: 12, at: barsAt, dur: 8});
  const rules = useStagger(3, {stride: 12, at: rulesAt});
  const factors = [
    {t: 'relevance', zh: '相关', v: 0.9},
    {t: 'authority', zh: '权威', v: 1.0},
    {t: 'popularity', zh: '热度 · log 封顶', v: 0.45},
    {t: 'freshness', zh: '新鲜', v: 0.7},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, opacity: enter}}>
      <div style={{display: 'flex', gap: 44, alignItems: 'flex-end'}}>
        {factors.map((f, i) => (
          <div key={f.t} style={{textAlign: 'center'}}>
            <div style={{width: 130, height: 210, display: 'flex', alignItems: 'flex-end', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, background: theme.panel, overflow: 'hidden'}}>
              <div
                style={{
                  width: '100%',
                  height: `${f.v * bars[i] * 100}%`,
                  background: i === 1 ? withAlpha(theme.ok, 0.6) : withAlpha(theme.concept, 0.55),
                }}
              />
            </div>
            <div style={{fontSize: 20, color: i === 1 ? theme.ok : theme.concept, marginTop: 10, fontFamily: theme.mono}}>{f.t}</div>
            <div style={{fontSize: 17, color: theme.dim, marginTop: 3}}>{f.zh}</div>
          </div>
        ))}
      </div>
      <div style={{display: 'flex', gap: 18}}>
        {['权威压过热度', '热度有上限', '新的压过旧的'].map((t, i) => (
          <span key={t} style={{opacity: rules[i], padding: '8px 20px', border: `2px solid ${theme.concept}`, borderRadius: 999, fontSize: 20, color: theme.concept}}>
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 5-E 前景：两份「重复购买率」卡换位（受治理升至首位）+ RRF 角标。 */
const GovernedSwap: React.FC<{swapAt: number; rrfAt: number}> = ({swapAt, rrfAt}) => {
  const f = useCurrentFrame();
  const swap = useSpring('settle', {at: swapAt, dur: 30});
  const rrf = useEnter('rise', {at: rrfAt, dur: 16});
  // 换位：受治理卡自下而上，推断卡自上而下
  const governedY = (1 - swap) * 108;
  const inferredY = -swap * 108;
  return (
    <div style={{position: 'absolute', bottom: 172, left: '50%', transform: 'translateX(-50%)', width: 820}}>
      <div style={{position: 'relative', height: 208}}>
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: governedY,
            width: 480,
            padding: '12px 20px',
            border: `2px solid ${theme.concept}`,
            borderRadius: 10,
            background: withAlpha(theme.bg, 0.92),
          }}
        >
          <span style={{fontSize: 20, color: theme.concept}}>受治理定义 · 目录条目</span>
          <span style={{float: 'right', fontSize: 17, color: theme.ok, fontFamily: theme.mono, opacity: swap}}>rank 1</span>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 24,
            top: 104 + inferredY,
            width: 440,
            padding: '12px 20px',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 10,
            background: withAlpha(theme.bg, 0.92),
            opacity: 0.7,
          }}
        >
          <span style={{fontSize: 20, color: theme.dim}}>推断口径 · 提示词里捞的</span>
          <span style={{float: 'right', fontSize: 17, color: theme.dim, fontFamily: theme.mono, opacity: swap}}>rank 2</span>
        </div>
      </div>
      <div style={{...rrf, display: 'flex', justifyContent: 'center', marginTop: 4}}>
        <span style={{padding: '7px 20px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 18, fontFamily: theme.mono, color: theme.dim, background: withAlpha(theme.bg, 0.9)}}>
          RRF · 按排名合成 · 权重 1/1 · 1/2 · 1/3
        </span>
      </div>
    </div>
  );
};

/** 5-F：resolve 契约卡——三条出路并列。 */
const ResolveContract: React.FC<{at: number; d1At: number; d2At: number; d3At: number}> = ({at, d1At, d2At, d3At}) => {
  const cards = useStagger(3, {stride: 14, at});
  const d1 = useProgress(d1At, 12);
  const d2 = useProgress(d2At, 12);
  const d3 = useProgress(d3At, 12);
  const outs = [
    {t: '题库命中 → 重放核准查询', s: '置信度 + 出处', c: theme.ok, d: d1},
    {t: '未命中 → 按定义现算', s: '标注「未经核准」', c: theme.conceptDeep, d: d2},
    {t: '无受治理定义 → 直说缺口', s: 'no_governed_coverage', c: theme.dim, d: d3},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
      {outs.map((o, i) => (
        <div
          key={o.t}
          style={{
            width: 860,
            padding: '18px 28px',
            border: `2px solid ${o.c}`,
            borderRadius: 12,
            background: theme.panel,
            opacity: cards[i],
            transform: `translateY(${(1 - cards[i]) * 20}px)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{fontSize: 24, color: o.c}}>{`出路${'①②③'[i]} · ${o.t}`}</div>
            <div style={{fontSize: 18, color: theme.dim, fontFamily: theme.mono, marginTop: 6, opacity: 0.35 + o.d * 0.65}}>{o.s}</div>
          </div>
          <span style={{fontSize: 26, color: o.c, opacity: 0.4 + o.d * 0.6}}>{o.d > 0.6 ? '✓' : '—'}</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 5-G 前景：核准查询绿章落定 + L4 段位签（回放窗下沿）。 */
const AnchorStamp: React.FC<{stampAt: number; tagAt: number}> = ({stampAt, tagAt}) => {
  const stamp = useSpring('snap', {at: stampAt, dur: 16});
  const tag = useEnter('rise', {at: tagAt, dur: 14});
  return (
    <div style={{position: 'absolute', bottom: 190, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 30, alignItems: 'center'}}>
      <span
        style={{
          padding: '10px 26px',
          border: `3px solid ${theme.ok}`,
          borderRadius: 10,
          fontSize: 24,
          color: theme.ok,
          background: withAlpha(theme.bg, 0.92),
          transform: `rotate(-7deg) scale(${stamp})`,
          opacity: Math.min(1, stamp),
        }}
      >
        核准查询 · 重放 ✓
      </span>
      <span style={{...tag, padding: '7px 20px', border: `1.5px solid ${theme.concept}`, borderRadius: 999, fontSize: 19, fontFamily: theme.mono, color: theme.concept, background: withAlpha(theme.bg, 0.9)}}>
        L4 · 应答锚定
      </span>
    </div>
  );
};

/** 5-H：477 vs 48 对撞（明细按天叠层 → 重复计数）。 */
const Crash47748: React.FC<{at: number; pileAt: number; crashAt: number; splitAt: number; slowAt: number}> = ({
  at,
  pileAt,
  crashAt,
  splitAt,
  slowAt,
}) => {
  const enter = useProgress(at, 12);
  const days = useStagger(7, {stride: 5, at: pileAt, dur: 4});
  const crash = useSpring('settle', {at: crashAt, dur: 34});
  const split = useStagger(2, {stride: 12, at: splitAt});
  const slow = useEnter('rise', {at: slowAt, dur: 14});
  const v477 = Math.round(48 + 429 * crash);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70, opacity: enter}}>
      {/* 明细按天叠层 */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start'}}>
        {Array.from({length: 7}, (_, i) => (
          <div
            key={i}
            style={{
              width: 150 + i * 26,
              height: 20,
              borderRadius: 4,
              border: `1.5px solid ${theme.conceptDeep}`,
              background: withAlpha(theme.conceptDeep, 0.12),
              opacity: days[i],
              fontFamily: theme.mono,
              fontSize: 13,
              color: theme.conceptDeep,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 10,
            }}
          >
            {`day-${i + 1} 明细`}
          </div>
        ))}
        <span style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginTop: 8, opacity: days[6]}}>上游提前按天汇总</span>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 46}}>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 104, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>{v477}</div>
            <div style={{fontSize: 20, color: theme.dim}}>重复计数</div>
          </div>
          <div style={{fontSize: 36, color: theme.dim}}>vs</div>
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 104, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>48</div>
            <div style={{fontSize: 20, color: theme.dim}}>真实答案</div>
          </div>
        </div>
        {/* 双标签分位 */}
        <div style={{display: 'flex', gap: 22}}>
          <span style={{opacity: split[0], padding: '8px 22px', border: `2px solid ${theme.concept}`, borderRadius: 8, fontSize: 20, color: theme.concept}}>治理管定义对</span>
          <span style={{opacity: split[1], padding: '8px 22px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 20, color: theme.ok}}>验证管结果对</span>
        </div>
        <span style={{...slow, padding: '7px 20px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 18, fontFamily: theme.mono, color: theme.dim}}>
          题库 &gt;20 条 · 显著拖慢（官方文档）
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** 5-J 前景：查询串 vs 连写长句擦肩（关键词腿不匹配）+ I-196 角标。 */
const SearchMiss: React.FC<{at: number; issueAt: number}> = ({at, issueAt}) => {
  const f = useCurrentFrame();
  const enter = useProgress(at, 14);
  const issue = useEnter('rise', {at: issueAt, dur: 14});
  // 两 chip 相向滑动、擦肩不接触（帧驱动位移）
  const t = Math.min(1, Math.max(0, (f - at) / 60));
  return (
    <div style={{position: 'absolute', bottom: 190, left: '50%', transform: `translateX(-50%) translateY(${(1 - enter) * 16}px)`, width: 900, opacity: enter}}>
      <div style={{border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: withAlpha(theme.bg, 0.92), padding: '18px 26px'}}>
        <div style={{position: 'relative', height: 96}}>
          <div
            style={{
              position: 'absolute',
              left: `${4 + t * 34}%`,
              top: 10,
              padding: '8px 18px',
              border: `2px solid ${theme.concept}`,
              borderRadius: 8,
              fontSize: 20,
              fontFamily: theme.mono,
              color: theme.concept,
            }}
          >
            查询：重复购买率
          </div>
          <div
            style={{
              position: 'absolute',
              right: `${2 + t * 16}%`,
              top: 52,
              padding: '8px 18px',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 8,
              fontSize: 17,
              fontFamily: theme.mono,
              color: theme.dim,
              maxWidth: 460,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            标题：Q3 华东渠道复盘——线索、回款与复购口径对齐的十八项动作清单
          </div>
          <span style={{position: 'absolute', left: '46%', top: 34, fontSize: 24, color: theme.conceptDeep, opacity: t > 0.7 ? 1 : 0}}>✕ 擦肩</span>
        </div>
      </div>
      <div style={{...issue, display: 'flex', justifyContent: 'center', marginTop: 12}}>
        <span style={{padding: '6px 18px', border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 999, fontSize: 17, fontFamily: theme.mono, color: theme.conceptDeep}}>
          I-196 · 三个修复候选待评审
        </span>
      </div>
    </div>
  );
};

/** 5-K：主/子代理双窗隔离（过程留子窗，结论卡单张飞回）。 */
const SubAgentSplit: React.FC<{at: number; noiseAt: number; backAt: number}> = ({at, noiseAt, backAt}) => {
  const f = useCurrentFrame();
  const enter = useProgress(at, 14);
  const noise = useProgress(noiseAt, 20);
  const back = useSpring('settle', {at: backAt, dur: 30});
  const noiseRows = Array.from({length: 6}, (_, i) => `probe(${i + 1}) → rows=… elapsed=…`,);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60, opacity: enter}}>
      {/* 主窗口（zIndex 抬升：飞回的结论卡压过子窗口绘制） */}
      <div style={{width: 470, border: `2px solid ${theme.concept}`, borderRadius: 12, background: theme.panel, padding: '18px 24px', position: 'relative', zIndex: 2}}>
        <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginBottom: 12}}>主代理窗口</div>
        {['系统指令', '用户问题 · 复购率'].map((t) => (
          <div key={t} style={{padding: '10px 14px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 19, color: theme.text, marginBottom: 10}}>
            {t}
          </div>
        ))}
        {/* 结论卡落位槽 */}
        <div
          style={{
            position: 'absolute',
            right: -190,
            top: 90,
            width: 210,
            padding: '12px 16px',
            border: `2px solid ${theme.ok}`,
            borderRadius: 10,
            background: withAlpha(theme.bg, 0.95),
            transform: `translateX(${(1 - back) * 160}px)`,
            opacity: back,
          }}
        >
          <div style={{fontSize: 17, color: theme.ok, fontFamily: theme.mono}}>结论卡</div>
          <div style={{fontSize: 16, color: theme.dim, marginTop: 5}}>复购率 · 核准口径</div>
        </div>
      </div>
      {/* 子代理窗口：过程噪声 */}
      <div style={{width: 470, border: `2px dashed ${theme.panelBorder}`, borderRadius: 12, background: theme.terminalBg, padding: '18px 24px', overflow: 'hidden'}}>
        <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginBottom: 12}}>子代理窗口 · 用完即弃</div>
        {noiseRows.map((r, i) => (
          <div key={r} style={{fontSize: 15, fontFamily: theme.mono, color: theme.dim, opacity: noise * (0.9 - i * 0.08), whiteSpace: 'nowrap'}}>
            {r}
          </div>
        ))}
        <div style={{fontSize: 16, color: theme.dim, marginTop: 10, opacity: noise}}>过程全部留在本窗口</div>
      </div>
    </AbsoluteFill>
  );
};

/** 判词条（5-K 收束形：底置条，不全屏遮断——主/子双窗保持可读）。 */
const JudgeStrip: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 18});
  return (
    <div style={{position: 'absolute', bottom: 184, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <div style={{padding: '14px 40px', border: `2.5px solid ${theme.concept}`, borderRadius: 12, fontSize: 32, color: theme.concept, letterSpacing: 2, background: withAlpha(theme.bg, 0.9)}}>
        隔离的是上下文 · 不是权限也不是动作
      </div>
    </div>
  );
};

/** 代码走廊（v2 P2MasterPage 迁移；本集 ②③④ 复用，P8Truth import）。 */
export const CodePane: React.FC<{
  at: number;
  lines: string[];
  badge?: {level: 'dashed' | 'solid' | 'filled'; note?: string};
}> = ({at, lines, badge}) => {
  const rows = useStagger(lines.length, {stride: 12, at});
  return (
    <div style={{width: 1040, background: theme.terminalBg, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, padding: '18px 24px', fontFamily: theme.mono, boxSizing: 'border-box'}}>
      {lines.map((l, i) => (
        <div key={i} style={{opacity: rows[i], fontSize: 21, lineHeight: 1.9, color: l.includes('⚠') || l.includes('422') || l.includes('←') ? theme.conceptDeep : theme.text, whiteSpace: 'pre'}}>
          <span style={{color: theme.dim, marginRight: 14}}>{String(i + 1).padStart(2, '0')}</span>
          {l}
        </div>
      ))}
      {badge ? (
        <div style={{marginTop: 12}}>
          <EvidenceBadge level={badge.level} at={at + (lines.length - 1) * 12 + 5} note={badge.note} />
        </div>
      ) : null}
    </div>
  );
};
