/** P4 装配轴（p4-01..p4-29 含 24b、09b..f、13b、25b、26b/c，39 句；storyboard v5「P4 装配轴」节）。
 *
 *  10 镜 / 16 条 archify cue（assembly-economics：ae-k2 ×4 + ae-k3 ×3 + ae-k4 ×3 + ae-k5 ×6；
 *  ae-k4/ae-k5 承前链尾跨镜背靠背 → lead={false}）：
 *   4-A 开轴预算（p4-01..02）：FiveAxisMap 高亮 assembly（幕首）→ TokenBudget 建立
 *       （刻度轨道 + 预算线 + 四档位机会成本小字）
 *   4-B 时序四档（p4-03..05）：四档总表逐行亮 + 常驻对应物钉住
 *   4-C 渐进披露（p4-06..09）：ae-k2 锚 p4-06 → hold 07/08/09；前景对应物卡
 *       （按需加载 / 仅引用）+ 成本轴收尾
 *   4-X 预算走查（p4-09b..f，新镜）：一万 token 构造预算条（TokenBudget 的构造例
 *       派生形态，场景内联）——四段 stagger 填充 + 合计线 + 留白过半 + 「构造示例」角标
 *   4-D 工具实验（p4-10..13 含 13b）：46/19 消融两栏 + 实线徽（经转引）+ 外推限界
 *       角标 + p4-13b 官方建模角标（结论条随之压暗）
 *   4-E 划界（p4-14..16）：ae-k3 锚 p4-14 → hold 15/16；前景提前放/用到再取两区
 *       + 判据公式卡 @enter:fall
 *   4-F 缓存排序（p4-17..19）：ae-k4 锚 p4-17 → hold 18/19（lead={false}）；前景
 *       静态前缀 | 动态段分界示例条 + 复用波纹
 *   4-G 压缩四步（p4-20..24b）：ae-k5 锚 p4-20 → hold 21/22/23/24/24b（lead={false}）；
 *       前景「落盘→裁中段→占位→摘要」步骤条 + 成对保留框 + 「0 步」徽
 *   4-H 倒 U（p4-25..26 含 25b、26b/c）：InvertedU + TokenBudget 越线续填（联动）
 *       + 经验观察角标 + n² 官方口径角标（25b）+ 能力/不可靠性分解双条（26b，
 *       +112% 尖刺 @impulse）+ 对策卡（26c，@enter:fall + 「蓝图设计判定」角标）
 *   4-I 顺序与转场（p4-27..29）：顺序效应双条 + 结论条 + FiveAxisMap 推进（passedCount=3）
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useDim, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {FiveAxisMap} from '../components/FiveAxisMap';
import {InvertedU} from '../components/InvertedU';
import {TokenBudget} from '../components/TokenBudget';

export const P4Assembly: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移；
  // 例外：幕根（不在镜 Sequence 内）直接调用的 motion hook 用 at(句id) 原值，不减镜偏移。
  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-05');
  const bC = w('p4-06', 'p4-09');
  const bX = w('p4-09b', 'p4-09f');
  const bD = w('p4-10', 'p4-13b');
  const bE = w('p4-14', 'p4-16');
  const bF = w('p4-17', 'p4-19');
  const bG = w('p4-20', 'p4-24b');
  const bH = w('p4-25', 'p4-26c');
  const bI = w('p4-27', 'p4-29');
  const snowO = useProgress(at('p4-13b'), 14);
  const n2O = useProgress(at('p4-25b'), 14);

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P4" tagline="装配轴" accent={theme.concept} />

      {/* 4-A 开轴预算：Map-First 幕首 → TokenBudget 建立 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="4-A">
        <Sequence from={0} durationInFrames={dur('p4-01')} name="4-A-map">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <FiveAxisMap built highlight="assembly" at={4} />
          </AbsoluteFill>
        </Sequence>
        <Sequence from={at('p4-02') - bA.from} name="4-A-budget">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <TokenBudget at={4} tiersAt={16} />
          </AbsoluteFill>
        </Sequence>
      </Sequence>

      {/* 4-B 时序四档总表 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="4-B">
        <FourTierTable at03={at('p4-03') - bB.from} at05={at('p4-05') - bB.from} />
      </Sequence>

      {/* 4-C 渐进披露：ae-k2 hold 链 + 前景对应物卡 + 成本轴收尾 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="4-C">
        <ArchifyRecap slug="assembly-economics" caption="装配经济学 · 渐进披露" cues={[
          {chapterId: 'ae-k2', at: at('p4-06') - bC.from, durationInFrames: dur('p4-06')},
          {chapterId: 'ae-k2', at: at('p4-07') - bC.from, durationInFrames: dur('p4-07'), fit: 'hold'},
          {chapterId: 'ae-k2', at: at('p4-08') - bC.from, durationInFrames: dur('p4-08'), fit: 'hold'},
          {chapterId: 'ae-k2', at: at('p4-09') - bC.from, durationInFrames: dur('p4-09'), fit: 'hold'},
        ]} />
        <CostAxisOverlay
          onDemandAt={at('p4-07') - bC.from}
          refOnlyAt={at('p4-08') - bC.from}
          axisAt={at('p4-09') - bC.from}
        />
      </Sequence>

      {/* 4-X 预算走查（新镜）：一万 token 构造预算条——四段 stagger 填充 + 合计线 */}
      <Sequence from={bX.from} durationInFrames={bX.durationInFrames} name="4-X">
        <BudgetWalkthrough
          at={at('p4-09b') - bX.from}
          s1At={at('p4-09c') - bX.from}
          s2At={at('p4-09d') - bX.from}
          s3At={at('p4-09e') - bX.from}
          totalAt={at('p4-09f') - bX.from}
        />
      </Sequence>

      {/* 4-D 工具实验：46/19 消融 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="4-D">
        <ToolAblation
          at={at('p4-10') - bD.from}
          wallAt={at('p4-11') - bD.from}
          outroAt={at('p4-13') - bD.from}
          dimAt={at('p4-13b') - bD.from}
        />
        <div style={{position: 'absolute', bottom: 190, left: 80}}>
          <EvidenceBadge level="solid" at={at('p4-11') - bD.from} note="46 败 / 19 成 · 经转引" />
        </div>
        <div style={{position: 'absolute', bottom: 190, right: 80}}>
          <span style={{padding: '8px 20px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 18, color: theme.dim, fontFamily: theme.mono}}>
            8B 量化模型 · 单条查询示例 · 阈值不可外推
          </span>
        </div>
        <div style={{position: 'absolute', bottom: 164, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <span
            style={{
              padding: '7px 20px',
              border: `1.5px solid ${theme.dim}`,
              borderRadius: 999,
              fontSize: 18,
              color: theme.dim,
              fontFamily: theme.mono,
              background: withAlpha(theme.bg, 0.85),
              opacity: snowO,
            }}
          >
            Snowflake 官方建模最佳实践 · 整视图 ~100K token
          </span>
        </div>
      </Sequence>

      {/* 4-E 划界：ae-k3 hold 链 + 前景两区 + 公式卡 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="4-E">
        <ArchifyRecap slug="assembly-economics" caption="装配经济学 · 显式划界" cues={[
          {chapterId: 'ae-k3', at: at('p4-14') - bE.from, durationInFrames: dur('p4-14')},
          {chapterId: 'ae-k3', at: at('p4-15') - bE.from, durationInFrames: dur('p4-15'), fit: 'hold'},
          {chapterId: 'ae-k3', at: at('p4-16') - bE.from, durationInFrames: dur('p4-16'), fit: 'hold'},
        ]} />
        <DivideZones at={at('p4-14') - bE.from + 8} formulaAt={at('p4-16') - bE.from} />
      </Sequence>

      {/* 4-F 缓存排序：ae-k4 hold 链（承 4-E 链尾背靠背 → lead={false}）+ 前景分段示例条 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="4-F">
        <ArchifyRecap slug="assembly-economics" caption="装配经济学 · 缓存感知分段" cues={[
          {chapterId: 'ae-k4', at: at('p4-17') - bF.from, durationInFrames: dur('p4-17')},
          {chapterId: 'ae-k4', at: at('p4-18') - bF.from, durationInFrames: dur('p4-18'), fit: 'hold'},
          {chapterId: 'ae-k4', at: at('p4-19') - bF.from, durationInFrames: dur('p4-19'), fit: 'hold'},
        ]} lead={false} />
        <CacheSplitOverlay at={at('p4-17') - bF.from + 8} splitAt={at('p4-18') - bF.from} rippleAt={at('p4-18') - bF.from + 24} />
      </Sequence>

      {/* 4-G 压缩四步：ae-k5 hold 链（承 4-F 链尾背靠背 → lead={false}）+ 前景步骤条 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="4-G">
        <ArchifyRecap slug="assembly-economics" caption="装配经济学 · 压缩分级" cues={[
          {chapterId: 'ae-k5', at: at('p4-20') - bG.from, durationInFrames: dur('p4-20')},
          {chapterId: 'ae-k5', at: at('p4-21') - bG.from, durationInFrames: dur('p4-21'), fit: 'hold'},
          {chapterId: 'ae-k5', at: at('p4-22') - bG.from, durationInFrames: dur('p4-22'), fit: 'hold'},
          {chapterId: 'ae-k5', at: at('p4-23') - bG.from, durationInFrames: dur('p4-23'), fit: 'hold'},
          {chapterId: 'ae-k5', at: at('p4-24') - bG.from, durationInFrames: dur('p4-24'), fit: 'hold'},
          {chapterId: 'ae-k5', at: at('p4-24b') - bG.from, durationInFrames: dur('p4-24b'), fit: 'hold'},
        ]} lead={false} />
        <CompressSteps
          at={at('p4-20') - bG.from + 8}
          s1At={at('p4-21') - bG.from}
          s2At={at('p4-22') - bG.from}
          s3At={at('p4-23') - bG.from}
          pairAt={at('p4-24') - bG.from}
          zeroAt={at('p4-24b') - bG.from}
        />
      </Sequence>

      {/* 4-H 倒 U：InvertedU + TokenBudget 越线续填（联动）+ 角标/实线徽 +
          n² 角标（25b）+ 分解双条（26b）+ 对策卡（26c） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="4-H">
        <InvertedU at={at('p4-25') - bH.from} />
        <div style={{position: 'absolute', bottom: 176, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <TokenBudget
            at={at('p4-25') - bH.from}
            fillAt={at('p4-25') - bH.from + 10}
            overfillAt={at('p4-25') - bH.from + 26}
            width={1040}
          />
        </div>
        <div style={{position: 'absolute', top: 140, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26}}>
          <span style={{padding: '7px 18px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 18, color: theme.dim, fontFamily: theme.mono}}>
            填充过半＝经验观察 · 非受控实验
          </span>
          <span style={{padding: '7px 18px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 18, color: theme.dim, fontFamily: theme.mono, opacity: n2O}}>
            token 越多 ⇒ 两两关系 n² · 官方口径
          </span>
          <EvidenceBadge level="solid" at={at('p4-26') - bH.from} note="Full→Sharded 退化 39%" />
        </div>
        <DecomposeBars at={at('p4-26b') - bH.from} dimAt={at('p4-26c') - bH.from} />
        <CounterCard at={at('p4-26c') - bH.from} />
      </Sequence>

      {/* 4-I 顺序与转场：双条 + 结论 + FiveAxisMap 推进 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="4-I">
        <Sequence from={0} durationInFrames={at('p4-29') - bI.from} name="4-I-order">
          <OrderEffect at={at('p4-27') - bI.from} stripAt={at('p4-28') - bI.from} />
        </Sequence>
        <Sequence from={at('p4-29') - bI.from} name="4-I-map">
          <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
            <FiveAxisMap built highlight={null} passedCount={3} at={4} />
          </AbsoluteFill>
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 4-B：时序四档总表（四行逐句点亮 + 常驻对应物钉住）。 */
const FourTierTable: React.FC<{at03: number; at05: number}> = ({at03, at05}) => {
  const rows = useStagger(4, {stride: 12, at: at03});
  const pin = useProgress(at05, 14);
  const tiers: Array<{t: string; obj: string; cost: string}> = [
    {t: '常驻', obj: '身份说明 · 画像块 · 技能目录', cost: '每轮进窗'},
    {t: '渐进披露', obj: '技能正文 · 用到才载', cost: '目录占位'},
    {t: '按需加载', obj: '本轮检索到的定义 · 核准查询', cost: '用时入窗'},
    {t: '仅引用', obj: '订单明细表 · 只给地址', cost: '近零成本'},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 960, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, padding: '20px 30px', boxSizing: 'border-box'}}>
        <div style={{display: 'grid', gridTemplateColumns: '170px 1fr 170px', fontSize: 18, color: theme.dim, paddingBottom: 10, borderBottom: `1.5px solid ${theme.panelBorder}`}}>
          <span>档位</span>
          <span>本请求对应物</span>
          <span>进窗成本</span>
        </div>
        {tiers.map((r, i) => (
          <div
            key={r.t}
            style={{
              display: 'grid',
              gridTemplateColumns: '170px 1fr 170px',
              alignItems: 'center',
              padding: '15px 0',
              opacity: 0.35 + rows[i] * 0.65,
              borderBottom: i < 3 ? `1px solid ${withAlpha(theme.panelBorder, 0.4)}` : 'none',
            }}
          >
            <span style={{fontSize: 25, color: theme.concept}}>{r.t}</span>
            <span style={{fontSize: 21, color: theme.text}}>{r.obj}</span>
            <span style={{fontSize: 18, color: theme.dim, fontFamily: theme.mono}}>{r.cost}</span>
          </div>
        ))}
        <div style={{marginTop: 14, fontSize: 20, color: theme.ok, opacity: pin}}>
          身份画像 · 每轮都在（常驻钉住）
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 4-C 前景：按需/仅引用对应物卡 + 成本轴收尾（回放窗下沿半透明条）。 */
const CostAxisOverlay: React.FC<{onDemandAt: number; refOnlyAt: number; axisAt: number}> = ({onDemandAt, refOnlyAt, axisAt}) => {
  const c1 = useEnter('rise', {at: onDemandAt, dur: 16});
  const c2 = useEnter('rise', {at: refOnlyAt, dur: 16});
  const axis = useEnter('rise', {at: axisAt, dur: 16});
  return (
    <div style={{position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
      <div style={{display: 'flex', gap: 26}}>
        <div style={{...c1, padding: '10px 22px', border: `2px solid ${theme.concept}`, borderRadius: 10, background: withAlpha(theme.bg, 0.9)}}>
          <div style={{fontSize: 20, color: theme.concept}}>按需加载 · 定义 + 核准查询</div>
        </div>
        <div style={{...c2, padding: '10px 22px', border: `2px solid ${theme.concept}`, borderRadius: 10, background: withAlpha(theme.bg, 0.9)}}>
          <div style={{fontSize: 20, color: theme.concept}}>仅引用 · 订单明细表 → 地址</div>
        </div>
      </div>
      <div style={{...axis, display: 'flex', alignItems: 'center', gap: 20, fontSize: 18, fontFamily: theme.mono, color: theme.dim, background: withAlpha(theme.bg, 0.9), padding: '6px 20px', borderRadius: 999, border: `1.5px solid ${theme.panelBorder}`}}>
        <span>进窗成本 递减 →</span>
        <span style={{width: 1, height: 16, background: theme.panelBorder}} />
        <span>← 取回成本 递增</span>
      </div>
    </div>
  );
};

/** 4-D：46/19 工具消融两栏（消融对比定式）。结论条锚 p4-13；p4-13b 官方建模
 *  角标入场时结论条按 suppression 缓动压暗（useDim，纯 effects 通道）。 */
const ToolAblation: React.FC<{at: number; wallAt: number; outroAt: number; dimAt: number}> = ({at, wallAt, outroAt, dimAt}) => {
  const enter = useProgress(at, 12);
  const badCells = useStagger(46, {stride: 2, at: wallAt, dur: 3});
  const goodCells = useStagger(19, {stride: 3, at: wallAt + 40, dur: 3});
  const outro = useEnter('rise', {at: outroAt, dur: 16});
  const outroDim = useDim({at: dimAt, to: 0.4, dur: 'f5'});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, opacity: enter}}>
      <div style={{display: 'flex', gap: 80, alignItems: 'flex-end'}}>
        {/* 46 工具 · 失败 */}
        <div style={{textAlign: 'center'}}>
          <div style={{width: 560, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 5}}>
            {badCells.map((k, i) => (
              <div key={i} style={{height: 26, borderRadius: 3, background: theme.conceptDeep, opacity: k * 0.85}} />
            ))}
          </div>
          <div style={{marginTop: 12, padding: '8px 22px', border: `2px solid ${theme.danger}`, borderRadius: 8, fontSize: 22, color: theme.danger, display: 'inline-block'}}>
            46 工具 · 任务失败
          </div>
        </div>
        {/* 19 工具 · 成功 */}
        <div style={{textAlign: 'center'}}>
          <div style={{width: 560, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 5}}>
            {goodCells.map((k, i) => (
              <div key={i} style={{height: 26, borderRadius: 3, background: theme.ok, opacity: k * 0.9}} />
            ))}
          </div>
          <div style={{marginTop: 12, padding: '8px 22px', border: `2px solid ${theme.ok}`, borderRadius: 8, fontSize: 22, color: theme.ok, display: 'inline-block'}}>
            19 工具 · 同一任务成功
          </div>
        </div>
      </div>
      <div style={{...outro, opacity: outro.opacity * outroDim, padding: '12px 34px', border: `2.5px solid ${theme.ok}`, borderRadius: 12, fontSize: 30, color: theme.ok, letterSpacing: 2}}>
        目录要短 · 正文按需取
      </div>
    </AbsoluteFill>
  );
};

/** 4-X：一万 token 构造预算走查（TokenBudget 的构造例派生形态——共享件保持
 *  4-A 建立形不动，本装置场景内联复用其视觉语言：满宽轨道 + 分段填充 + 合计线）。
 *  四段随 p4-09c/d/e 依次填充（几何量走 settle 无过冲弹簧），合计线与留白区随
 *  p4-09f 亮起——「不到一半」给 4-H 倒 U 埋伏笔；角标「构造示例 · 非实测」。 */
const BudgetWalkthrough: React.FC<{at: number; s1At: number; s2At: number; s3At: number; totalAt: number}> = ({
  at,
  s1At,
  s2At,
  s3At,
  totalAt,
}) => {
  const enter = useProgress(at, 12);
  // 段宽为 10,000 口径下的占比：2,000 / 1,500 / 1,000 / 地址≈0
  const g1 = useSpring('settle', {at: s1At, dur: 26});
  const g2 = useSpring('settle', {at: s2At, dur: 24});
  const g3 = useSpring('settle', {at: s3At, dur: 24});
  const g4 = useProgress(s3At + 12, 14);
  const total = useProgress(totalAt, 14);
  const segs = [
    {label: '常驻 ≈ 2,000', sub: '身份 · 画像块 · 技能目录', w: 0.2 * Math.min(1, g1), color: withAlpha(theme.concept, 0.6), on: g1},
    {label: '按需 ≈ 1,500', sub: '定义 + 核准查询', w: 0.15 * Math.min(1, g2), color: withAlpha(theme.conceptDeep, 0.55), on: g2},
    {label: '历史 ≈ 1,000', sub: '对话历史', w: 0.1 * Math.min(1, g3), color: withAlpha(theme.dim, 0.45), on: g3},
  ];
  const filled = segs.reduce((s, x) => s + x.w, 0) + 0.005 * g4;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{width: 1240, opacity: enter, transform: `translateY(${(1 - enter) * 18}px)`}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
          <span style={{fontSize: 20, color: theme.dim, fontFamily: theme.mono}}>窗口 10,000 token</span>
          <span style={{padding: '5px 14px', border: `1.5px solid ${theme.dim}`, borderRadius: 999, fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>
            构造示例 · 非实测
          </span>
        </div>
        {/* 刻度轨道 + 四段依次填充 */}
        <div style={{position: 'relative', height: 58, border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, overflow: 'hidden'}}>
          {Array.from({length: 9}, (_, i) => (
            <div key={i} style={{position: 'absolute', left: `${(i + 1) * 10}%`, top: 0, bottom: 0, width: 1, background: withAlpha(theme.panelBorder, 0.9)}} />
          ))}
          {segs.map((s, i) => {
            const left = segs.slice(0, i).reduce((acc, x) => acc + x.w, 0);
            return (
              <div key={s.label} style={{position: 'absolute', left: `${left * 100}%`, top: 0, bottom: 0, width: `${s.w * 100}%`, background: s.color, borderRight: '1px solid ' + withAlpha(theme.bg, 0.8)}} />
            );
          })}
          {/* 地址 sliver（仅引用 · 近零成本） */}
          <div style={{position: 'absolute', left: `${(filled - 0.005 * g4) * 100}%`, top: 0, bottom: 0, width: `${0.5 * g4}%`, background: withAlpha(theme.ok, 0.55)}} />
          {/* 合计线 + 留白区（p4-09f 亮起） */}
          <div style={{position: 'absolute', left: '45.5%', top: 0, bottom: 0, borderLeft: `2.5px dashed ${total > 0.05 ? theme.ok : theme.panelBorder}`, opacity: 0.35 + 0.65 * total}} />
          <div style={{position: 'absolute', left: '48%', top: 16, fontSize: 17, fontFamily: theme.mono, color: theme.ok, opacity: total}}>
            合计 ≈ 4,500+
          </div>
          <div style={{position: 'absolute', left: '66%', top: 16, fontSize: 17, fontFamily: theme.mono, color: theme.dim, opacity: total}}>
            留白 &gt; 50%
          </div>
        </div>
        {/* 段落标签（锚终态位置，不随填充移动） */}
        <div style={{position: 'relative', height: 64, marginTop: 12}}>
          {[
            {left: '0%', on: g1, seg: segs[0]},
            {left: '20%', on: g2, seg: segs[1]},
            {left: '35%', on: g3, seg: segs[2]},
          ].map(({left, on, seg}) => (
            <div key={seg.label} style={{position: 'absolute', left, top: 0, opacity: 0.35 + Math.min(1, on) * 0.65, borderLeft: `2px solid ${theme.concept}`, paddingLeft: 10}}>
              <div style={{fontSize: 18, color: theme.text, fontFamily: theme.mono}}>{seg.label}</div>
              <div style={{fontSize: 14, color: theme.dim, marginTop: 2}}>{seg.sub}</div>
            </div>
          ))}
          <div style={{position: 'absolute', right: 0, top: 0, textAlign: 'right', opacity: 0.35 + g4 * 0.65, borderRight: `2px solid ${theme.ok}`, paddingRight: 10}}>
            <div style={{fontSize: 18, color: theme.text, fontFamily: theme.mono}}>地址 ≈ 0</div>
            <div style={{fontSize: 14, color: theme.dim, marginTop: 2}}>订单表 · 仅引用</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 4-E 前景：提前放 / 用到再取 两区划界 + 判据公式卡。 */
const DivideZones: React.FC<{at: number; formulaAt: number}> = ({at, formulaAt}) => {
  const enter = useProgress(at, 14);
  const divide = useProgress(at + 12, 18);
  const formula = useEnter('fall', {at: formulaAt, dur: 20});
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 330,
        transform: `translateX(-50%) translateY(${(1 - enter) * 20}px)`,
        width: 940,
        opacity: enter,
        padding: '20px 30px',
        background: withAlpha(theme.bg, 0.9),
        border: `2px solid ${theme.panelBorder}`,
        borderRadius: 14,
      }}
    >
      <div style={{display: 'flex', gap: 30}}>
        <div style={{flex: 1, padding: '14px 20px', border: `2px solid ${theme.concept}`, borderRadius: 10}}>
          <div style={{fontSize: 22, color: theme.concept}}>提前放</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 6, fontFamily: theme.mono}}>体量小 · 很少变</div>
        </div>
        {/* 划界线 */}
        <div style={{width: 3, background: theme.text, opacity: divide, borderRadius: 2}} />
        <div style={{flex: 1, padding: '14px 20px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 10}}>
          <div style={{fontSize: 22, color: theme.conceptDeep}}>用到再取</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 6, fontFamily: theme.mono}}>体量大 · 常更新</div>
        </div>
      </div>
      <div style={{...formula, marginTop: 18, textAlign: 'center', fontSize: 26, fontFamily: theme.mono, color: theme.text}}>
        被用到的概率 × 每轮带着它的成本
      </div>
    </div>
  );
};

/** 4-F 前景：静态前缀 | 动态段 分界示例条 + 复用波纹。 */
const CacheSplitOverlay: React.FC<{at: number; splitAt: number; rippleAt: number}> = ({at, splitAt, rippleAt}) => {
  const enter = useProgress(at, 14);
  const split = useProgress(splitAt, 16);
  const ripple = useImpulse({at: rippleAt, dur: 30, peak: 1});
  return (
    <div style={{position: 'absolute', bottom: 190, left: '50%', transform: `translateX(-50%) translateY(${(1 - enter) * 18}px)`, width: 900, opacity: enter}}>
      <div style={{display: 'flex', alignItems: 'stretch', border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: withAlpha(theme.bg, 0.9), overflow: 'hidden'}}>
        <div style={{flex: 1.1, padding: '14px 22px', background: withAlpha(theme.concept, 0.14 + ripple * 0.12), borderRight: `2.5px solid ${theme.text}`}}>
          <div style={{fontSize: 20, color: theme.concept}}>静态前缀</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 6, fontFamily: theme.mono}}>身份说明 · 每轮相同</div>
          <div style={{fontSize: 16, color: theme.concept, marginTop: 8, opacity: ripple}}>↑ 复用上一轮已算部分</div>
        </div>
        <div style={{flex: 1, padding: '14px 22px'}}>
          <div style={{fontSize: 20, color: theme.conceptDeep}}>动态段</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 6, fontFamily: theme.mono}}>检索到的定义 · 用户消息侧</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: '52%', top: -14, bottom: -14, width: 3, background: theme.text, opacity: split, borderRadius: 2}} />
    </div>
  );
};

/** 4-G 前景：压缩四步步骤条 + 成对保留框 + 「0 步」徽。 */
const CompressSteps: React.FC<{at: number; s1At: number; s2At: number; s3At: number; pairAt: number; zeroAt: number}> = ({
  at,
  s1At,
  s2At,
  s3At,
  pairAt,
  zeroAt,
}) => {
  const enter = useProgress(at, 14);
  const a1 = useProgress(s1At, 12);
  const a2 = useProgress(s2At, 12);
  const a3 = useProgress(s3At, 12);
  const pair = useEnter('rise', {at: pairAt, dur: 14});
  const zero = useSpring('snap', {at: zeroAt + 6, dur: 16});
  const dim = useProgress(zeroAt, 14);
  const steps = [
    {t: '落盘', s: '写磁盘 · 留路径', a: a1},
    {t: '裁中段', s: '留归档标记', a: a2},
    {t: '占位', s: '带路径占位', a: a2},
    {t: '摘要', s: '才调模型写', a: a3},
  ];
  return (
    <div style={{position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: enter * (1 - dim * 0.55)}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        {steps.map((s, i) => (
          <div key={s.t} style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <div
              style={{
                width: 172,
                padding: '10px 14px',
                border: `2px solid ${s.a > 0.4 ? theme.conceptDeep : theme.panelBorder}`,
                borderRadius: 10,
                background: withAlpha(theme.bg, 0.9),
                opacity: 0.5 + s.a * 0.5,
              }}
            >
              <div style={{fontSize: 20, color: s.a > 0.4 ? theme.conceptDeep : theme.dim}}>
                {`0${i + 1} ${s.t}`}
              </div>
              <div style={{fontSize: 15, color: theme.dim, fontFamily: theme.mono, marginTop: 3}}>{s.s}</div>
            </div>
            {i < 3 ? <span style={{fontSize: 20, color: theme.dim}}>→</span> : null}
          </div>
        ))}
        <span style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono, alignSelf: 'flex-end', opacity: a3}}>信息损失递增</span>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <span style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, opacity: a3}}>前三步不调模型</span>
        <span style={{...pair, padding: '8px 20px', border: `2px solid ${theme.danger}`, borderRadius: 8, fontSize: 18, fontFamily: theme.mono, color: theme.danger, background: withAlpha(theme.bg, 0.9)}}>
          工具调用 ⇄ 结果 成对保留 · 切开 → 接口拒绝
        </span>
      </div>
      {/* 「0 步」徽：第一轮四步一步不用跑 */}
      <div
        style={{
          padding: '8px 26px',
          border: `2.5px solid ${theme.ok}`,
          borderRadius: 999,
          fontSize: 24,
          fontFamily: theme.mono,
          color: theme.ok,
          background: withAlpha(theme.bg, 0.95),
          transform: `scale(${0.7 + zero * 0.3})`,
          opacity: Math.min(1, zero),
        }}
      >
        本请求 · 0 步
      </div>
    </div>
  );
};

/** 4-H：能力 / 不可靠性 分解双条（p4-26b）——能力只降 16%（浅）vs 不可靠性涨
 *  112%（橙尖刺，@impulse 重音）；条宽几何量走 settle 无过冲弹簧；对策卡
 *  （p4-26c）入场时按 suppression 压暗（useDim，纯 effects 通道）。 */
const DecomposeBars: React.FC<{at: number; dimAt: number}> = ({at, dimAt}) => {
  const enter = useProgress(at, 12);
  const gCap = useSpring('settle', {at: at + 6, dur: 24});
  const gRel = useSpring('settle', {at: at + 20, dur: 26});
  const spike = useImpulse({at: at + 26, dur: 24, peak: 1});
  const dim = useDim({at: dimAt, to: 0.35, dur: 'f5'});
  const max = 112;
  const rows = [
    {label: '能力', val: '−16%', w: (16 / max) * Math.min(1, gCap), color: withAlpha(theme.concept, 0.4)},
    {label: '不可靠性', val: '+112%', w: Math.min(1, gRel), color: withAlpha(theme.conceptDeep, 0.75)},
  ];
  return (
    <div style={{position: 'absolute', right: 170, top: 300, width: 400, opacity: enter * dim, display: 'flex', flexDirection: 'column', gap: 18}}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
            <span style={{fontSize: 19, color: r.label === '不可靠性' ? theme.conceptDeep : theme.dim}}>{r.label}</span>
            <span style={{fontSize: 22, color: r.label === '不可靠性' ? theme.conceptDeep : theme.dim, fontVariantNumeric: 'tabular-nums', fontFamily: theme.mono, transform: r.label === '不可靠性' ? `scale(${1 + spike * 0.18})` : 'none'}}>
              {r.val}
            </span>
          </div>
          <div style={{position: 'relative', height: 22, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 6, background: theme.panel}}>
            <div style={{width: `${r.w * 100}%`, height: '100%', background: r.color, borderRadius: 5}} />
            {r.label === '不可靠性' ? (
              <span style={{position: 'absolute', right: -4, top: -12, fontSize: 22, color: theme.conceptDeep, opacity: spike}}>▲</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

/** 4-H：对策卡（p4-26c，重音镜）——「规约只存一处 · 派发前完整复诵」，
 *  @enter:fall；角标注明这是蓝图设计判定而非论文原文主张。 */
const CounterCard: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('fall', {at, dur: 20});
  return (
    <div style={{position: 'absolute', top: 212, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, ...enter}}>
      <div style={{padding: '14px 40px', border: `2.5px solid ${theme.concept}`, borderRadius: 12, fontSize: 30, color: theme.concept, letterSpacing: 2, background: withAlpha(theme.bg, 0.92)}}>
        规约只存一处 · 派发前完整复诵
      </div>
      <span style={{fontSize: 16, color: theme.dim, fontFamily: theme.mono}}>蓝图设计判定 · 非论文原文主张</span>
    </div>
  );
};

/** 4-I：顺序效应双条（任务说明位置决定成绩）+ 结论条。 */
const OrderEffect: React.FC<{at: number; stripAt: number}> = ({at, stripAt}) => {
  const growHi = useSpring('settle', {at: at + 4, dur: 30});
  const growLo = useSpring('settle', {at: at + 22, dur: 24});
  const strip = useEnter('rise', {at: stripAt, dur: 16});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 860}}>
        <div>
          <div style={{fontSize: 21, color: theme.ok, marginBottom: 8}}>任务说明在长证据前面 · 高</div>
          <div style={{height: 36, border: `1.5px solid ${theme.ok}`, borderRadius: 8, background: theme.panel}}>
            <div style={{width: `${82 * growHi}%`, height: '100%', background: withAlpha(theme.ok, 0.75), borderRadius: 7}} />
          </div>
        </div>
        <div>
          <div style={{fontSize: 21, color: theme.conceptDeep, marginBottom: 8}}>任务说明放在后面 · 低</div>
          <div style={{height: 36, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, background: theme.panel}}>
            <div style={{width: `${54 * growLo}%`, height: '100%', background: withAlpha(theme.conceptDeep, 0.7), borderRadius: 7}} />
          </div>
        </div>
      </div>
      <div style={{...strip, padding: '14px 38px', border: `2.5px solid ${theme.concept}`, borderRadius: 12, fontSize: 32, color: theme.concept, letterSpacing: 2}}>
        预算 ⇒ 正确性
      </div>
    </AbsoluteFill>
  );
};
