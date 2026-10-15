/** P4 装配轴：机位与工卡夹（p4-01..p4-28，28 句；storyboard v3「P4 装配轴」节）。
 *
 *  7 镜 / 15 条 archify cue（assembly-economics 章 id 未变）：
 *   4-A 剖面高亮机位（HangarCrossSection built assembly）+ 计时器烧钱 + 时序四档总表卡
 *   4-B ae-k1 hold 链@p4-07..10（裁纸/圈选/保留单三联装置让位，recap 后置=画框遮盖）
 *   4-C ae-k2 hold 链@p4-11..12 → hold@p4-14（承 4-B 链尾背靠背 → lead=false）；
 *      p4-13 留空窗给 46/19 工具墙+实线徽
 *   4-D ae-k3@p4-15 → hold@p4-16 → ae-k4@p4-17（推车 vs 呼叫铃让位；承 4-C 链尾背靠背 → lead=false）
 *   4-E ae-k5@p4-18 → hold@p4-19 → ae-knobs@p4-20（交接班纪要板让位；承 4-D 尾背靠背 → lead={false}）
 *   4-F InvertedU 倒 U 红线（组 A 组件 import）+ 分片×2 尖刺@23 + 摊页找不着@24
 *   4-G ae-knobs hold@p4-25（「这五条」回指五旋钮终态）→ ae-ch@p4-26（岔路装置让位）·
 *      岔路橙闪@27 · 剖面推进@28
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useProgress, usePushIn, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {HangarCrossSection} from '../components/HangarCrossSection';
import {InvertedU} from '../components/InvertedU';

export const P4Assembly: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p4-01', 'p4-06');
  const bB = w('p4-07', 'p4-10');
  const bC = w('p4-11', 'p4-14');
  const bD = w('p4-15', 'p4-17');
  const bE = w('p4-18', 'p4-20');
  const bF = w('p4-21', 'p4-24');
  const bG = w('p4-25', 'p4-28');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P4" tagline="装配轴 · 机位与工卡夹" accent={theme.concept} />

      {/* 4-A 开轴四档：剖面聚光机位（首句窗）→ 计时器 + 四档总表卡 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="4-A">
        <Sequence from={0} durationInFrames={dur('p4-01')} name="4-A-hangar">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <HangarCrossSection built highlight="assembly" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p4-02') - bA.from} name="4-A-dev">
          <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
            <BurnClock at={at('p4-03') - at('p4-02')} />
            <FourTierTable at={at('p4-04') - at('p4-02')} />
          </AbsoluteFill>
        </Sequence>
      </Sequence>

      {/* 4-B 最小够用：ae-k1 hold 链铺 p4-07..10（三联装置让位，recap 后置遮盖） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="4-B">
        <Sequence from={at('p4-08') - bB.from} name="4-B-dev">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 44}}>
            <PaperCut at={0} />
            <CircleSelect at={at('p4-09') - at('p4-08')} />
            <RetentionSlip at={at('p4-10') - at('p4-08')} />
          </AbsoluteFill>
        </Sequence>
        <ArchifyRecap slug="assembly-economics" caption="旋钮一 · 预算分配" cues={[
          {chapterId: 'ae-k1', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
          {chapterId: 'ae-k1', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08'), fit: 'hold'},
          {chapterId: 'ae-k1', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09'), fit: 'hold'},
          {chapterId: 'ae-k1', at: at('p4-10') - bB.from, durationInFrames: dur('p4-10'), fit: 'hold'},
        ]} />
      </Sequence>

      {/* 4-C 渐进披露：ae-k2 hold 链@11..12、@14（p4-13 空窗给 46/19 工具墙+实线徽）；承 4-B 链尾背靠背 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="4-C">
        <Sequence from={at('p4-12') - bC.from} durationInFrames={dur('p4-12')} name="4-C-card">
          <CardFace at={0} />
        </Sequence>
        <Sequence from={at('p4-13') - bC.from} name="4-C-wall">
          <ToolWall46 at={0} />
          <div style={{position: 'absolute', bottom: 150, left: 80}}>
            <EvidenceBadge level="solid" at={6} note="工具数饱和 46 败 / 19 成" />
          </div>
        </Sequence>
        <ArchifyRecap slug="assembly-economics" caption="旋钮二 · 渐进披露" cues={[
          {chapterId: 'ae-k2', at: at('p4-11') - bC.from, durationInFrames: dur('p4-11')},
          {chapterId: 'ae-k2', at: at('p4-12') - bC.from, durationInFrames: dur('p4-12'), fit: 'hold'},
          {chapterId: 'ae-k2', at: at('p4-14') - bC.from, durationInFrames: dur('p4-14'), fit: 'hold'},
        ]} lead={false} />
      </Sequence>

      {/* 4-D JIT 与缓存：ae-k3@15 → hold@16 → ae-k4@17（推车 vs 呼叫铃让位）；承 4-C 链尾背靠背 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="4-D">
        <Sequence from={at('p4-16') - bD.from} durationInFrames={dur('p4-16')} name="4-D-dev">
          <JitVsBell at={0} />
        </Sequence>
        <ArchifyRecap
          slug="assembly-economics"
          caption="旋钮三/四 · JIT 与缓存"
          cues={[
            {chapterId: 'ae-k3', at: at('p4-15') - bD.from, durationInFrames: dur('p4-15')},
            {chapterId: 'ae-k3', at: at('p4-16') - bD.from, durationInFrames: dur('p4-16'), fit: 'hold'},
            {chapterId: 'ae-k4', at: at('p4-17') - bD.from, durationInFrames: dur('p4-17')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 4-E 压缩与命名：ae-k5@18 → hold@19 → ae-knobs@20（纪要板让位）；承 4-D 尾背靠背 lead={false} */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="4-E">
        <Sequence from={at('p4-19') - bE.from} durationInFrames={dur('p4-19')} name="4-E-dev">
          <HandoverBoard at={0} />
        </Sequence>
        <ArchifyRecap
          slug="assembly-economics"
          caption="旋钮五 · 压缩分级"
          cues={[
            {chapterId: 'ae-k5', at: at('p4-18') - bE.from, durationInFrames: dur('p4-18')},
            {chapterId: 'ae-k5', at: at('p4-19') - bE.from, durationInFrames: dur('p4-19'), fit: 'hold'},
            {chapterId: 'ae-knobs', at: at('p4-20') - bE.from, durationInFrames: dur('p4-20')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 4-F 倒 U 红线：InvertedU（组 A 组件）+ 底部三段小景（红线句标/分片尖刺/摊页，末两段互斥换场） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="4-F">
        <InvertedU at={at('p4-21') - bF.from} />
        <RedlineChip at={at('p4-22') - bF.from} />
        <Sequence from={at('p4-23') - bF.from} durationInFrames={dur('p4-23')} name="4-F-spike">
          <ChunkSpike at={0} />
        </Sequence>
        <Sequence from={at('p4-24') - bF.from} name="4-F-pile">
          <PagesPile at={0} />
        </Sequence>
      </Sequence>

      {/* 4-G 检索前置：ae-knobs hold@p4-25（「这五条」回指五旋钮终态，岔路装置让位）→
          ae-ch 盖 p4-26（窗后橙闪@27；止于 p4-28 前）；剖面推进@28（互斥换场） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="4-G">
        <Sequence from={0} durationInFrames={at('p4-28') - bG.from} name="4-G-fork">
          <ForkRoad at={0} blinkAt={at('p4-27') - bG.from} />
        </Sequence>
        <ArchifyRecap slug="assembly-economics" caption="双通道 · 统一融合" cues={[
          {chapterId: 'ae-knobs', at: at('p4-25') - bG.from, durationInFrames: dur('p4-25'), fit: 'hold'},
          {chapterId: 'ae-ch', at: at('p4-26') - bG.from, durationInFrames: dur('p4-26')},
        ]} />
        <Sequence from={at('p4-28') - bG.from} name="4-G-push">
          <HangarPush />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 计时器烧钱（v2 P5Tarmac 迁移）：机位时间每分钟都在烧（橙）。 */
const BurnClock: React.FC<{at: number}> = ({at}) => {
  const tick = useSpring('settle', {at, dur: 120});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 76, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>${(1200 + tick * 3400).toFixed(0)}</div>
        <div style={{fontSize: 21, color: theme.dim}}>机位时间 · 每分钟都在烧</div>
      </div>
      <div style={{width: 250, height: 58, border: `2px solid ${theme.concept}`, borderRadius: 10, background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, color: theme.dim}}>
        工卡夹 · 就一块
      </div>
    </div>
  );
};

/** 时序四档总表卡：常驻/渐进/按需/仅引用四行逐行亮（口播 p4-04..06 三句点名）。 */
const FourTierTable: React.FC<{at: number}> = ({at}) => {
  const rows = useStagger(4, {stride: 34, at});
  const tiers: Array<[string, string, string]> = [
    ['常驻', '档案柜', '进窗 0 恢复成本'],
    ['渐进', '卡面章节号', '先占一行 · 用时展开'],
    ['按需', '调当版页', '用时回母本取'],
    ['仅引用', '库位牌', '只挂不搬 · 凭牌取'],
  ];
  return (
    <div style={{width: 860, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, padding: '18px 26px', boxSizing: 'border-box'}}>
      <div style={{display: 'grid', gridTemplateColumns: '150px 220px 1fr', fontSize: 18, color: theme.dim, paddingBottom: 10, borderBottom: `1.5px solid ${theme.panelBorder}`}}>
        <span>档位</span>
        <span>机库对应</span>
        <span>进窗 / 恢复成本</span>
      </div>
      {tiers.map(([t, obj, cost], i) => (
        <div key={t} style={{display: 'grid', gridTemplateColumns: '150px 220px 1fr', alignItems: 'center', padding: '12px 0', opacity: rows[i], borderBottom: i < 3 ? `1px solid ${withAlpha(theme.panelBorder, 0.4)}` : 'none'}}>
          <span style={{fontSize: 26, color: theme.concept}}>{t}</span>
          <span style={{fontSize: 22, color: theme.text}}>{obj}</span>
          <span style={{fontSize: 19, color: theme.dim}}>{cost}</span>
        </div>
      ))}
    </div>
  );
};

/** 裁纸刀（v2 迁移）：几十万页手册只切本卡用的几页。 */
const PaperCut: React.FC<{at: number}> = ({at}) => {
  const cut = useSpring('settle', {at: at + 8, dur: 30});
  const enter = useEnter('pop', {at, dur: 14});
  return (
    <div style={{...enter, textAlign: 'center'}}>
      <div style={{width: 170, height: 240, background: theme.panelBorder, borderRadius: 6, position: 'relative', overflow: 'hidden', margin: '0 auto'}}>
        {Array.from({length: 22}, (_, i) => (
          <div key={i} style={{position: 'absolute', left: 8, right: 8, top: 8 + i * 10, height: 5, background: theme.bg, opacity: 0.55}} />
        ))}
      </div>
      <div style={{fontSize: 44, color: theme.concept, marginTop: 4}}>✂</div>
      <div style={{width: 104, height: 66, background: theme.paper, borderRadius: 4, margin: '6px auto 0', transform: `translateX(${cut * 26}px)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: theme.paperInk}}>
        本卡 4 页
      </div>
    </div>
  );
};

/** 圈选：工具墙几百件，只圈影子板上那几格。 */
const CircleSelect: React.FC<{at: number}> = ({at}) => {
  const cells = useStagger(24, {stride: 2, at, dur: 3});
  const lasso = useEnter('pop', {at: at + 40, dur: 16});
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{width: 210, height: 150, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5, margin: '0 auto'}}>
        {cells.map((k, i) => {
          const inLasso = [8, 9, 14, 15].includes(i);
          return (
            <div key={i} style={{height: 22, borderRadius: 3, background: inLasso ? theme.ok : theme.panelBorder, opacity: inLasso ? 0.9 : k * 0.55}} />
          );
        })}
      </div>
      <div style={{...lasso, width: 108, height: 62, border: `2.5px dashed ${theme.ok}`, borderRadius: 14, margin: '10px auto 0', transform: `translateY(-92px)`, position: 'relative'}} />
      <div style={{fontSize: 18, color: theme.dim, marginTop: -64}}>只圈那几格</div>
    </div>
  );
};

/** 保留单：装不下、超窗的活不硬塞，显式记账（橙标签）。 */
const RetentionSlip: React.FC<{at: number}> = ({at}) => {
  const stick = useSpring('settle', {at, dur: 18});
  return (
    <div style={{transform: `rotate(${stick * 3 - 3}deg) scale(${0.8 + stick * 0.2})`, opacity: stick, width: 190, padding: '16px 18px', border: `2.5px dashed ${theme.conceptDeep}`, borderRadius: 8, textAlign: 'center'}}>
      <div style={{fontSize: 23, color: theme.conceptDeep}}>保留单</div>
      <div style={{fontSize: 17, color: theme.dim, marginTop: 6}}>超窗不硬塞</div>
      <div style={{fontSize: 17, color: theme.dim}}>显式记账</div>
    </div>
  );
};

/** 卡面章节号 → 正文按需展开（4-C 中继装置）。 */
const CardFace: React.FC<{at: number}> = ({at}) => {
  const expand = useSpring('settle', {at: at + 20, dur: 26});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60}}>
      <div style={{width: 220, height: 150, border: `2px solid ${theme.concept}`, borderRadius: 10, background: theme.panel, padding: 16, boxSizing: 'border-box'}}>
        <div style={{fontSize: 19, color: theme.concept}}>工卡卡面 · 目录常驻</div>
        <div style={{fontSize: 16, color: theme.dim, marginTop: 10, fontFamily: theme.mono}}>§ 32-11-00</div>
        <div style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>§ 32-11-01</div>
        <div style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>§ 57-10-02</div>
      </div>
      <div style={{fontSize: 40, color: theme.dim}}>→</div>
      <div style={{width: 130 + expand * 190, height: 150, border: `2px solid ${theme.ok}`, borderRadius: 10, background: theme.paper, padding: 14, boxSizing: 'border-box', overflow: 'hidden'}}>
        <div style={{fontSize: 16, color: theme.paperInkDim}}>正文当版页 · 按需</div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{height: 7, background: theme.paperInkDim, opacity: 0.3, borderRadius: 4, marginTop: 12, width: `${60 + (i % 3) * 15}%`}} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 46/19 工具墙（v2 迁移）：46 橙挂满失败 + 4 空位 + 19 绿够用成功。 */
const ToolWall46: React.FC<{at: number}> = ({at}) => {
  const cells = useStagger(69, {stride: 2, at, dur: 3});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 860, height: 360, display: 'grid', gridTemplateColumns: 'repeat(16,1fr)', gap: 6}}>
        {cells.map((k, i) => {
          const bad = i < 46;
          const good = i >= 50 && i < 69;
          // 46..49 空档格不吃 stagger：恒定低透明度虚线框（「46 橙｜4 空位｜19 绿」空位语义）
          const gap = !bad && !good;
          return (
            <div
              key={i}
              style={{
                height: 34,
                borderRadius: 4,
                opacity: gap ? 0.35 : k * 0.9,
                background: bad ? theme.conceptDeep : good ? theme.ok : 'transparent',
                border: gap ? `1px dashed ${theme.panelBorder}` : 'none',
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 预取推车 vs 呼叫铃（4-D 分屏）：小体量少变预取 / 大体量常更新按需。 */
const JitVsBell: React.FC<{at: number}> = ({at}) => {
  const cartIn = useSpring('settle', {at: at + 6, dur: 26});
  const ring = useSpring('settle', {at: at + 42, dur: 12});
  const crate = useSpring('settle', {at: at + 54, dur: 18});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70}}>
      <div style={{width: 380, padding: '22px 26px', border: `2px solid ${theme.concept}`, borderRadius: 12, background: theme.panel, textAlign: 'center'}}>
        <div style={{fontSize: 24, color: theme.concept}}>预取 · 小体量少变</div>
        <svg width={300} height={120} style={{marginTop: 10}}>
          <g transform={`translate(${cartIn * 130}, 0)`}>
            <rect x={20} y={64} width={86} height={34} rx={6} fill="none" stroke={theme.concept} strokeWidth={2.5} />
            <rect x={30} y={48} width={20} height={16} rx={3} fill={withAlpha(theme.concept, 0.5)} />
            <rect x={56} y={48} width={20} height={16} rx={3} fill={withAlpha(theme.concept, 0.5)} />
            <circle cx={38} cy={104} r={8} fill="none" stroke={theme.concept} strokeWidth={2.5} />
            <circle cx={88} cy={104} r={8} fill="none" stroke={theme.concept} strokeWidth={2.5} />
          </g>
          <line x1={10} y1={114} x2={290} y2={114} stroke={theme.panelBorder} strokeWidth={2} />
        </svg>
        <div style={{fontSize: 18, color: theme.dim}}>推车先装好 · 开工即用</div>
      </div>
      <div style={{width: 380, padding: '22px 26px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 12, background: theme.panel, textAlign: 'center'}}>
        <div style={{fontSize: 24, color: theme.conceptDeep}}>按需 · 大体量常更新</div>
        <svg width={300} height={120} style={{marginTop: 10}}>
          <g transform={`rotate(${ring * 14} 150 44)`}>
            <path d="M 132 58 A 18 18 0 1 1 168 58 Z" fill="none" stroke={theme.conceptDeep} strokeWidth={2.5} />
            <line x1={150} y1={20} x2={150} y2={34} stroke={theme.conceptDeep} strokeWidth={2.5} />
          </g>
          <rect x={112} y={86 - crate * 20} width={76} height={30} rx={4} fill="none" stroke={theme.conceptDeep} strokeWidth={2.5} />
          <line x1={10} y1={114} x2={290} y2={114} stroke={theme.panelBorder} strokeWidth={2} />
        </svg>
        <div style={{fontSize: 18, color: theme.dim}}>按铃再取 · 取的是当版</div>
      </div>
    </AbsoluteFill>
  );
};

/** 交接班纪要板（v2 P3ShadowBoard 迁移）：关掉的折一行，例外项一字不折 + 最后落章。 */
const HandoverBoard: React.FC<{at: number}> = ({at}) => {
  const notes = useStagger(4, {stride: 10, at});
  const seal = useSpring('settle', {at: at + 60, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 660, padding: 26, background: theme.panel, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 12}}>
        <div style={{fontSize: 22, color: theme.dim, marginBottom: 14}}>交接班纪要</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          {['已关闭工序 ×3 → 折成一行', '未关闭 · 一字不折', '保留项 · 一字不折', '异常发现 · 一字不折'].map((t, i) => (
            <div key={t} style={{opacity: notes[i], fontSize: 22, color: i === 0 ? theme.dim : theme.text, display: 'flex', gap: 12, alignItems: 'center'}}>
              <span style={{width: 10, height: 10, borderRadius: 5, background: i === 0 ? theme.dim : theme.ok}} />
              {t}
            </div>
          ))}
        </div>
        <div style={{marginTop: 18, textAlign: 'right'}}>
          <span style={{display: 'inline-block', padding: '6px 18px', border: `2.5px solid ${theme.ok}`, borderRadius: 8, color: theme.ok, fontSize: 26, transform: `rotate(-6deg) scale(${seal})`, opacity: seal}}>不费模型的在前 · 费模型的殿后</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 倒 U 红线句标（4-F 底部角标；曲线本体在 InvertedU 组件内）。 */
const RedlineChip: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 14});
  return (
    <div style={{position: 'absolute', bottom: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <span style={{padding: '8px 22px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 999, fontSize: 21, color: theme.conceptDeep}}>
        填充率过半 · 性能常常不升反降
      </span>
    </div>
  );
};

/** 分片尖刺（4-F）：长对话切碎喂，不可靠性平均翻一倍还多。 */
const ChunkSpike: React.FC<{at: number}> = ({at}) => {
  const spike = useSpring('settle', {at: at + 8, dur: 18});
  return (
    <div style={{position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 26}}>
      <div style={{textAlign: 'center'}}>
        <div style={{width: 90, height: 46, background: theme.panelBorder, borderRadius: 4, opacity: 0.8}} />
        <div style={{fontSize: 17, color: theme.dim, marginTop: 6}}>整窗喂</div>
      </div>
      <div style={{textAlign: 'center'}}>
        <div style={{width: 90, height: 46 + spike * 66, background: theme.conceptDeep, borderRadius: 4}} />
        <div style={{fontSize: 17, color: theme.conceptDeep, marginTop: 6}}>切碎分片 · 不可靠性 ×2</div>
      </div>
    </div>
  );
};

/** 摊页小景（4-F 尾句）：机位上摊太多页，反而找不着要的那页。 */
const PagesPile: React.FC<{at: number}> = ({at}) => {
  const pages = useStagger(9, {stride: 4, at, dur: 4});
  return (
    <div style={{position: 'absolute', bottom: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'flex-end'}}>
      {pages.map((k, i) => (
        <div
          key={i}
          style={{
            width: 62,
            height: 84,
            background: theme.paper,
            borderRadius: 3,
            opacity: k * 0.85,
            transform: `rotate(${(i - 4) * 4}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: theme.paperInkDim,
            fontFamily: theme.mono,
          }}
        >
          {`p${i + 1}`}
        </div>
      ))}
      <div style={{fontSize: 19, color: theme.dim, marginLeft: 18, marginBottom: 28}}>要的那页 · 找不着</div>
    </div>
  );
};

/** 岔路预告（4-G）：找错对象 = 橙岔路（cue 窗后橙闪）。 */
const ForkRoad: React.FC<{at: number; blinkAt: number}> = ({at, blinkAt}) => {
  const draw = useSpring('settle', {at: at + 6, dur: 26});
  const blink = useProgress(blinkAt, 60);
  const bad = 1 - blink * 0.5 * (Math.sin(blink * Math.PI * 6) > 0 ? 1 : 0.2);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={760} height={300}>
        <path d={`M 60 220 C ${60 + draw * 200} 220, ${180 + draw * 160} 220, 340 220`} fill="none" stroke={theme.concept} strokeWidth={4} />
        <path d={`M 340 220 C ${400 + draw * 80} 220, 480 160, 660 110`} fill="none" stroke={theme.ok} strokeWidth={4} opacity={draw} />
        <path d={`M 340 220 C ${400 + draw * 60} 230, 470 262, 660 268`} fill="none" stroke={theme.conceptDeep} strokeWidth={4} opacity={draw * bad} />
        <circle cx={60} cy={220} r={9} fill={theme.concept} />
        <text x={670} y={104} fill={theme.ok} fontSize={20} opacity={draw}>对象对</text>
        <text x={670} y={276} fill={theme.conceptDeep} fontSize={20} opacity={draw * bad}>找错对象 · 后面全错</text>
        <text x={330} y={190} fill={theme.dim} fontSize={18} opacity={draw}>候选怎么排</text>
      </svg>
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
