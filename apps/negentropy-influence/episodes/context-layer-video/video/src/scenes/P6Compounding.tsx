/** P6 沉淀轴（p6-01..p6-28 含 05b/17b，30 句；storyboard v4「P6 沉淀轴」节）。
 *
 *  12 镜 / 10 条 archify cue（lc2-l5 ×2 + ol-draft ×3 + ol-conflict ×2 + ol-super ×1 +
 *  el-six ×1 + el-sm ×1；ol-super/el-six/el-sm 均承前链尾背靠背 → lead={false}）：
 *   6-A 开轴回写（p6-01..02）：lc2-l5 锚 p6-01 → hold p6-02；前景判词条 chip
 *       + 「沉淀轴」轴签（Map-First 幕首被 cue 窗占用，v3 同款让位——详见头注报告）
 *   6-B 三在线（p6-03..06）：LampTrio 三灯座（白话小标随灯名）+ 全亮验证闪
 *   6-C 会话案例（p6-07..08）：会话窗口 + 补句气泡高亮
 *   6-D 断链证据（p6-09..12）：LampTrio 只亮一盏（缺二）+ grep 实心徽三行 + 队列滞留
 *       + 补句气泡消散
 *   6-E 修复时序（p6-13..15）：trigger → consumer → watermark 三拍点亮 + 最后写落章
 *   6-F 两条路径（p6-16..17）：人工起草审核 ‖ 查询历史挖掘 双列
 *   6-G 起草一路（p6-17b..19）：ol-draft 锚 p6-17b → hold 18/19；前景 9,685<5% 覆盖条塌落
 *       + 虚线徽 + 挖掘路元数据签
 *   6-H 冲突并列（p6-20..21）：CONFLICT 卡（数值留空 · 拒答等裁决）
 *   6-I 裁决实验（p6-22..23）：ol-conflict 锚 p6-22 → hold p6-23；前景 D4 消融
 *       （热度 200:5 对比条）+ 实心徽
 *   6-J 被取代（p6-24）：ol-super 锚（lead={false}）；前景 superseded 盖章卡
 *   6-K 参数面（p6-25..26）：el-six 锚（lead={false}）→ el-sm 锚（lead={false}）；
 *       前景第七面虚框签
 *   6-L 轴收束（p6-27..28）：FiveAxisMap 五轴全亮（passedCount=5）+ 判词条 + 读管线预告
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {FiveAxisMap} from '../components/FiveAxisMap';
import {LampTrio} from '../components/LampTrio';

export const P6Compounding: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p6-01', 'p6-02');
  const bB = w('p6-03', 'p6-06');
  const bC = w('p6-07', 'p6-08');
  const bD = w('p6-09', 'p6-12');
  const bE = w('p6-13', 'p6-15');
  const bF = w('p6-16', 'p6-17');
  const bG = w('p6-17b', 'p6-19');
  const bH = w('p6-20', 'p6-21');
  const bI = w('p6-22', 'p6-23');
  const bJ = w('p6-24');
  const bK = w('p6-25', 'p6-26');
  const bL = w('p6-27', 'p6-28');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P6" tagline="沉淀轴" accent={theme.ok} />

      {/* 6-A 开轴回写：lc2-l5 hold 链 + 前景判词条 chip + 沉淀轴轴签 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="6-A">
        <ArchifyRecap slug="lifecycle" caption="时间面 · L5 沉淀回灌" cues={[
          {chapterId: 'lc2-l5', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
          {chapterId: 'lc2-l5', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02'), fit: 'hold'},
        ]} />
        <div style={{position: 'absolute', top: 148, right: 80}}>
          <span style={{padding: '7px 18px', border: `1.5px solid ${theme.ok}`, borderRadius: 999, fontSize: 18, fontFamily: theme.mono, color: theme.ok, background: withAlpha(theme.bg, 0.9)}}>
            沉淀轴 · 回路
          </span>
        </div>
        <div style={{position: 'absolute', bottom: 190, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <span style={{padding: '12px 36px', border: `2.5px solid ${theme.ok}`, borderRadius: 12, fontSize: 30, color: theme.ok, letterSpacing: 2, background: withAlpha(theme.bg, 0.9)}}>
            经营对象：回路
          </span>
        </div>
      </Sequence>

      {/* 6-B 三在线：LampTrio 三灯座 + 全亮验证闪 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="6-B">
        <LampTrio
          at={at('p6-03') - bB.from}
          onAt={[at('p6-05') - bB.from, at('p6-05') - bB.from + 40, at('p6-05b') - bB.from]}
          labels={['触发器', '消费者', '水位线']}
        />
        <AllLitChip at={at('p6-06') - bB.from} />
      </Sequence>

      {/* 6-C 会话案例：补句气泡高亮 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="6-C">
        <SessionWindow enterAt={at('p6-07') - bC.from} bubbleAt={at('p6-08') - bC.from} />
      </Sequence>

      {/* 6-D 断链证据：只亮一盏 + grep 三行 + 队列滞留 + 气泡消散 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="6-D">
        <BrokenLoop
          at={at('p6-09') - bD.from}
          grepAt={at('p6-10') - bD.from}
          queueAt={at('p6-11') - bD.from}
          fadeAt={at('p6-12') - bD.from}
        />
      </Sequence>

      {/* 6-E 修复时序：三拍点亮 + 最后写落章 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="6-E">
        <RepairTimeline
          at={at('p6-13') - bE.from}
          consumerAt={at('p6-14') - bE.from}
          watermarkAt={at('p6-15') - bE.from}
        />
      </Sequence>

      {/* 6-F 两条供给路径 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="6-F">
        <SupplyPaths at={at('p6-16') - bF.from} titleAt={at('p6-16') - bF.from} mineAt={at('p6-17') - bF.from} />
      </Sequence>

      {/* 6-G 起草一路：ol-draft hold 链 + 前景覆盖条 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="6-G">
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="对象生命周期 · 起草态" cues={[
          {chapterId: 'ol-draft', at: at('p6-17b') - bG.from, durationInFrames: dur('p6-17b')},
          {chapterId: 'ol-draft', at: at('p6-18') - bG.from, durationInFrames: dur('p6-18'), fit: 'hold'},
          {chapterId: 'ol-draft', at: at('p6-19') - bG.from, durationInFrames: dur('p6-19'), fit: 'hold'},
        ]} />
        <CoverageOverlay
          chipAt={at('p6-17b') - bG.from}
          collapseAt={at('p6-18') - bG.from}
          metaAt={at('p6-19') - bG.from}
        />
      </Sequence>

      {/* 6-H 冲突并列：CONFLICT 卡 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="6-H">
        <ConflictCard at={at('p6-20') - bH.from} defsAt={at('p6-21') - bH.from} />
      </Sequence>

      {/* 6-I 裁决实验：ol-conflict hold 链 + 前景 D4 消融 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="6-I">
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="对象生命周期 · 冲突态" cues={[
          {chapterId: 'ol-conflict', at: at('p6-22') - bI.from, durationInFrames: dur('p6-22')},
          {chapterId: 'ol-conflict', at: at('p6-23') - bI.from, durationInFrames: dur('p6-23'), fit: 'hold'},
        ]} />
        <D4Ablation at={at('p6-23') - bI.from} />
      </Sequence>

      {/* 6-J 被取代：ol-super（承 6-I 链尾跨镜背靠背 → lead={false}）+ 盖章卡 */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="6-J">
        <ArchifyRecap slug="blueprint--object-lifecycle" caption="对象生命周期 · 被取代" cues={[
          {chapterId: 'ol-super', at: at('p6-24') - bJ.from, durationInFrames: dur('p6-24')},
        ]} lead={false} />
        <SupersededCard at={at('p6-24') - bJ.from + 10} />
      </Sequence>

      {/* 6-K 参数面：el-six → el-sm（均承前背靠背 → lead={false}）+ 第七面签 */}
      <Sequence from={bK.from} durationInFrames={bK.durationInFrames} name="6-K">
        <ArchifyRecap slug="evolution-levers" caption="进化杠杆 · 六面" cues={[
          {chapterId: 'el-six', at: at('p6-25') - bK.from, durationInFrames: dur('p6-25')},
        ]} lead={false} />
        <ArchifyRecap slug="evolution-levers" caption="进化杠杆 · 状态机" cues={[
          {chapterId: 'el-sm', at: at('p6-26') - bK.from, durationInFrames: dur('p6-26')},
        ]} lead={false} />
        <div style={{position: 'absolute', top: 148, right: 80}}>
          <span style={{padding: '7px 18px', border: `1.5px dashed ${theme.conceptDeep}`, borderRadius: 999, fontSize: 18, fontFamily: theme.mono, color: theme.conceptDeep, background: withAlpha(theme.bg, 0.9)}}>
            第七面 · 仅提案 · 无代码
          </span>
        </div>
      </Sequence>

      {/* 6-L 轴收束：FiveAxisMap 五轴全亮 + 判词条 + 读管线预告 */}
      <Sequence from={bL.from} durationInFrames={bL.durationInFrames} name="6-L">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40}}>
          <FiveAxisMap built highlight={null} passedCount={5} at={4} />
        </AbsoluteFill>
        <div style={{position: 'absolute', top: 440, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
          <span style={{padding: '14px 40px', border: `2.5px solid ${theme.ok}`, borderRadius: 12, fontSize: 32, color: theme.ok, letterSpacing: 2, background: withAlpha(theme.bg, 0.9)}}>
            回路要三件都在线
          </span>
          <PreviewChip at={at('p6-28') - bL.from} />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 6-B：三灯全亮验证签（impulse）。 */
const AllLitChip: React.FC<{at: number}> = ({at}) => {
  const pulse = useImpulse({at: at + 6, dur: 30, peak: 1});
  return (
    <div style={{position: 'absolute', bottom: 190, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <span
        style={{
          padding: '9px 26px',
          border: `2.5px solid ${theme.ok}`,
          borderRadius: 999,
          fontSize: 23,
          color: theme.ok,
          background: withAlpha(theme.bg, 0.9),
          opacity: 0.35 + pulse * 0.65,
          transform: `scale(${1 + pulse * 0.05})`,
        }}
      >
        三件都在线 ✓ 回路存在
      </span>
    </div>
  );
};

/** 6-C：会话窗口 + 运营专员补句气泡高亮。 */
const SessionWindow: React.FC<{enterAt: number; bubbleAt: number}> = ({enterAt, bubbleAt}) => {
  const enter = useEnter('rise', {at: enterAt, dur: 18});
  const bubble = useSpring('settle', {at: bubbleAt, dur: 18});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...enter, width: 880, border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, padding: '22px 30px'}}>
        <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginBottom: 14}}>会话 · 第 N 轮</div>
        <div style={{display: 'flex', justifyContent: 'flex-start', marginBottom: 12}}>
          <span style={{padding: '10px 20px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, fontSize: 20, color: theme.dim, background: theme.terminalBg}}>
            上季度华东区的重复购买率是多少？
          </span>
        </div>
        {/* 补句气泡：高亮（本镜主体） */}
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <span
            style={{
              padding: '14px 24px',
              border: `2.5px solid ${theme.concept}`,
              borderRadius: 10,
              fontSize: 23,
              color: theme.text,
              background: withAlpha(theme.concept, 0.1),
              transform: `scale(${0.9 + bubble * 0.1})`,
              opacity: bubble,
            }}
          >
            <span style={{fontSize: 16, color: theme.concept, fontFamily: theme.mono, marginRight: 12}}>运营专员</span>
            我们说的复购 · 只算付款成功的订单
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-D：断链证据——状态位只亮一盏 + grep 三行 + 队列滞留 + 补句气泡消散。 */
const BrokenLoop: React.FC<{at: number; grepAt: number; queueAt: number; fadeAt: number}> = ({at, grepAt, queueAt, fadeAt}) => {
  const f = useCurrentFrame();
  const taskIn = useSpring('settle', {at: queueAt + 8, dur: 18});
  const ghost = useProgress(fadeAt, 30);
  const grepIn = useProgress(grepAt, 14);
  const queueIn = useProgress(queueAt, 14);
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 70}}>
      {/* 三状态位只亮一盏（relative 盒给 LampTrio 的 AbsoluteFill 提供包含块） */}
      <div style={{position: 'relative', width: 860, height: 420}}>
        <LampTrio at={at} onAt={[6, null, null]} missingAt={14} />
      </div>
      {/* 右列：气泡消散 + grep + 队列 */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 20, width: 620}}>
        {/* 补句气泡：到下一次会话就没了（消散） */}
        <div style={{opacity: 0.5 * (1 - ghost), transform: `translateY(${-ghost * 14}px)`, alignSelf: 'flex-end'}}>
          <span style={{padding: '8px 18px', border: `1.5px dashed ${theme.panelBorder}`, borderRadius: 10, fontSize: 18, color: theme.dim}}>
            「只算付款成功的订单」→ 未入长期记忆
          </span>
        </div>
        {/* grep 实心证据 */}
        <div style={{border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.terminalBg, padding: '14px 22px', opacity: grepIn}}>
          {[
            'add_session_to_memory  生产调用 = 0',
            'consolidation_jobs     消费者 = 0',
            'watermark 列           不存在',
          ].map((l) => (
            <div key={l} style={{fontSize: 18, fontFamily: theme.mono, color: theme.conceptDeep, lineHeight: 1.9, whiteSpace: 'pre'}}>
              {l}
            </div>
          ))}
          <div style={{marginTop: 10}}>
            <EvidenceBadge level="filled" at={grepAt + 16} note="本仓 grep" />
          </div>
        </div>
        {/* 队列滞留 */}
        <div style={{border: `2px solid ${theme.panelBorder}`, borderRadius: 10, background: theme.panel, padding: '14px 22px', opacity: queueIn}}>
          <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginBottom: 10}}>consolidation_jobs</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{padding: '8px 16px', border: `1.5px solid ${theme.concept}`, borderRadius: 8, fontSize: 18, fontFamily: theme.mono, color: theme.concept, transform: `translateX(${(1 - taskIn) * -120}px)`, opacity: taskIn}}>
              session→memory · task#1042
            </span>
            <span style={{fontSize: 17, color: theme.conceptDeep, opacity: taskIn}}>入队后滞留 · 无消费者出队</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-E：修复时序三拍 trigger → consumer → watermark。 */
const RepairTimeline: React.FC<{at: number; consumerAt: number; watermarkAt: number}> = ({at, consumerAt, watermarkAt}) => {
  const enter = useProgress(at, 14);
  const c = useProgress(consumerAt, 12);
  const wm = useProgress(watermarkAt, 12);
  const stamp = useSpring('snap', {at: watermarkAt + 14, dur: 14});
  const stages = [
    {t: 'trigger', s: '水位差 ≥Δ · 空闲 ≥T', a: 1},
    {t: 'consumer', s: 'SKIP LOCKED 出队执行', a: c},
    {t: 'watermark', s: '提交点 · 最后写', a: wm},
  ];
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, opacity: enter}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
        {stages.map((s, i) => (
          <div key={s.t} style={{display: 'flex', alignItems: 'center', gap: 20}}>
            <div
              style={{
                width: 300,
                padding: '18px 24px',
                border: `2.5px solid ${s.a > 0.4 ? theme.ok : theme.panelBorder}`,
                borderRadius: 12,
                background: theme.panel,
                opacity: 0.45 + s.a * 0.55,
                transform: `translateY(${(1 - s.a) * 12}px)`,
              }}
            >
              <div style={{fontSize: 24, fontFamily: theme.mono, color: s.a > 0.4 ? theme.ok : theme.dim}}>{s.t}</div>
              <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginTop: 6}}>{s.s}</div>
            </div>
            {i < 2 ? <span style={{fontSize: 26, color: theme.dim, opacity: stages[i + 1].a}}>→</span> : null}
          </div>
        ))}
      </div>
      <span
        style={{
          padding: '8px 24px',
          border: `3px solid ${theme.ok}`,
          borderRadius: 10,
          fontSize: 22,
          color: theme.ok,
          transform: `rotate(-7deg) scale(${stamp})`,
          opacity: Math.min(1, stamp),
        }}
      >
        最后写 · 防同一件事记两遍
      </span>
    </AbsoluteFill>
  );
};

/** 6-F：两条供给路径并列（人工起草审核先高亮 / 查询历史挖掘另一路）。 */
const SupplyPaths: React.FC<{at: number; titleAt: number; mineAt: number}> = ({at, titleAt, mineAt}) => {
  const title = useEnter('rise', {at: titleAt, dur: 14});
  const p1 = useEnter('slideL', {at: at + 6, dur: 26});
  const p2 = useEnter('slideL', {at: mineAt, dur: 26});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34}}>
      <div style={{...title, padding: '10px 30px', border: `2px solid ${theme.ok}`, borderRadius: 10, fontSize: 24, color: theme.ok, background: withAlpha(theme.bg, 0.9)}}>
        组件二 · 两条供给路径
      </div>
      <div style={{...p1, width: 900, padding: '20px 30px', border: `2.5px solid ${theme.ok}`, borderRadius: 12, background: theme.panel, display: 'flex', alignItems: 'center', gap: 18}}>
        <span style={{fontSize: 20, color: theme.ok, fontFamily: theme.mono, border: `1.5px solid ${theme.ok}`, borderRadius: 6, padding: '2px 10px'}}>主路</span>
        {['人工起草', '审核', '发布'].map((t, i) => (
          <span key={t} style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{fontSize: 22, color: theme.text}}>{t}</span>
            {i < 2 ? <span style={{fontSize: 22, color: theme.ok}}>→</span> : null}
          </span>
        ))}
        <span style={{marginLeft: 'auto', fontSize: 17, color: theme.ok, fontFamily: theme.mono}}>本请求核准查询 · 走此路 ✓</span>
      </div>
      <div style={{...p2, width: 900, padding: '20px 30px', border: `2px dashed ${theme.dim}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 18}}>
        {['查询历史', '挖掘使用习惯'].map((t, i) => (
          <span key={t} style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <span style={{fontSize: 22, color: theme.dim}}>{t}</span>
            {i < 1 ? <span style={{fontSize: 22, color: theme.dim}}>→</span> : null}
          </span>
        ))}
        <span style={{marginLeft: 'auto', fontSize: 17, color: theme.dim, fontFamily: theme.mono}}>只碰元数据 · 不碰数据行</span>
      </div>
    </AbsoluteFill>
  );
};

/** 6-G 前景：人工路 chip + 9,685<5% 覆盖条塌落 + 挖掘路元数据签。 */
const CoverageOverlay: React.FC<{chipAt: number; collapseAt: number; metaAt: number}> = ({chipAt, collapseAt, metaAt}) => {
  const chip = useEnter('rise', {at: chipAt, dur: 14});
  const grow = useSpring('settle', {at: chipAt + 10, dur: 24});
  const drop = useSpring('settle', {at: collapseAt, dur: 30});
  const meta = useEnter('rise', {at: metaAt, dur: 14});
  const pct = 88 * grow * (1 - drop) + 4.8 * drop;
  return (
    <div style={{position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
      <div style={{...chip, display: 'flex', gap: 24}}>
        <span style={{padding: '8px 20px', border: `2px solid ${theme.ok}`, borderRadius: 999, fontSize: 19, color: theme.ok, background: withAlpha(theme.bg, 0.9)}}>
          本请求核准查询 · 人工审核路 ✓
        </span>
      </div>
      <div style={{width: 760, background: withAlpha(theme.bg, 0.9), border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, padding: '12px 20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 18, fontFamily: theme.mono, color: theme.dim, marginBottom: 8}}>
          <span>9,685 张表</span>
          <span style={{color: theme.conceptDeep}}>精修定义 &lt;5%</span>
        </div>
        <div style={{height: 20, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 10, overflow: 'hidden', background: theme.panel}}>
          <div style={{width: `${pct}%`, height: '100%', background: theme.conceptDeep, opacity: 0.8}} />
        </div>
      </div>
      <span style={{...meta, padding: '7px 20px', border: `1.5px dashed ${theme.dim}`, borderRadius: 999, fontSize: 18, fontFamily: theme.mono, color: theme.dim, background: withAlpha(theme.bg, 0.9)}}>
        挖掘路 · 只圈元数据与使用模式
      </span>
      <EvidenceBadge level="dashed" at={collapseAt + 8} note="官方自报 · 覆盖口径" />
    </div>
  );
};

/** 6-H：CONFLICT 卡——两份定义对置，数值区刻意留空，代理拒答。 */
const ConflictCard: React.FC<{at: number; defsAt: number}> = ({at, defsAt}) => {
  const title = useEnter('rise', {at, dur: 14});
  const inL = useEnter('slideR', {at: defsAt, dur: 22});
  const inR = useEnter('slideL', {at: defsAt + 8, dur: 22});
  const blank = useProgress(defsAt + 18, 14);
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      <div style={{...title, padding: '10px 30px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 10, fontSize: 24, color: theme.conceptDeep, background: withAlpha(theme.bg, 0.9)}}>
        组件三 · 冲突浮出 · 人工裁决
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
        <div style={{...inL, width: 320, padding: '20px 24px', border: `2px solid ${theme.concept}`, borderRadius: 12, background: theme.panel}}>
          <div style={{fontSize: 23, color: theme.concept}}>重复购买率 · 按客户</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 8, fontFamily: theme.mono}}>governed · v2</div>
        </div>
        {/* 数值区留空 */}
        <div style={{position: 'relative', width: 190, height: 110, border: `2px dashed ${blank > 0.3 ? theme.conceptDeep : theme.panelBorder}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: blank}}>
          <span style={{fontSize: 18, color: theme.conceptDeep, fontFamily: theme.mono}}>数值 · 留空</span>
        </div>
        <div style={{...inR, width: 320, padding: '20px 24px', border: `2px solid ${theme.conceptDeep}`, borderRadius: 12, background: theme.panel}}>
          <div style={{fontSize: 23, color: theme.conceptDeep}}>重复购买率 · 按订单</div>
          <div style={{fontSize: 17, color: theme.dim, marginTop: 8, fontFamily: theme.mono}}>推断 · 未治理</div>
        </div>
      </div>
      <span style={{padding: '10px 26px', border: `2px solid ${theme.dim}`, borderRadius: 999, fontSize: 21, color: theme.dim, fontFamily: theme.mono, opacity: blank}}>
        代理应答 · 拒答 · 等裁决
      </span>
    </AbsoluteFill>
  );
};

/** 6-I 前景：D4 消融——热度 200:5 对比条（错误口径胜出，红）vs 人工裁决（绿）。 */
const D4Ablation: React.FC<{at: number}> = ({at}) => {
  const enter = useProgress(at, 14);
  const tilt = useSpring('settle', {at: at + 10, dur: 26});
  return (
    <div style={{position: 'absolute', bottom: 176, left: '50%', transform: `translateX(-50%) translateY(${(1 - enter) * 16}px)`, width: 880, opacity: enter}}>
      <div style={{border: `2px solid ${theme.panelBorder}`, borderRadius: 12, background: withAlpha(theme.bg, 0.92), padding: '16px 26px'}}>
        <div style={{fontSize: 19, color: theme.dim, fontFamily: theme.mono, marginBottom: 10}}>auto_popularity · 自动挑</div>
        {/* 200:5 对比条：错侧压倒（X-001 核对：多数侧在画面下方/左方压倒） */}
        <div style={{display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden', transform: `rotate(${tilt * -1.5}deg)`}}>
          <div style={{width: '97.6%', background: withAlpha(theme.danger, 0.55), display: 'flex', alignItems: 'center', paddingLeft: 14, fontSize: 17, fontFamily: theme.mono, color: theme.text}}>
            按订单 · 热度 200
          </div>
          <div style={{width: '2.4%', background: withAlpha(theme.ok, 0.6)}} />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 17, fontFamily: theme.mono}}>
          <span style={{color: theme.danger}}>错误口径胜出</span>
          <span style={{color: theme.ok}}>人工裁决 → 正确保留</span>
        </div>
      </div>
      <div style={{display: 'flex', justifyContent: 'center', marginTop: 12}}>
        <EvidenceBadge level="filled" at={at + 14} note="D4 · 本仓原型复算" />
      </div>
    </div>
  );
};

/** 6-J 前景：superseded 盖章卡（灰化归档 · 留记录不删除）。 */
const SupersededCard: React.FC<{at: number}> = ({at}) => {
  const seal = useSpring('snap', {at, dur: 16});
  const gray = useProgress(at, 20);
  return (
    <div style={{position: 'absolute', top: 330, left: '50%', transform: 'translateX(-50%)'}}>
      <div style={{position: 'relative', width: 360, padding: '20px 26px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 12, background: theme.panel, opacity: 1 - gray * 0.45}}>
        <div style={{fontSize: 22, color: theme.dim}}>重复购买率 · 按订单</div>
        <div style={{fontSize: 17, color: theme.dim, fontFamily: theme.mono, marginTop: 8, opacity: 0.7}}>推断口径 · 归档保留</div>
        <span
          style={{
            position: 'absolute',
            right: -20,
            top: -18,
            padding: '8px 20px',
            border: `3px solid ${theme.conceptDeep}`,
            borderRadius: 8,
            fontSize: 24,
            fontFamily: theme.mono,
            color: theme.conceptDeep,
            transform: `rotate(10deg) scale(${seal})`,
            opacity: seal,
            background: withAlpha(theme.bg, 0.9),
          }}
        >
          superseded
        </span>
      </div>
      <div style={{textAlign: 'center', marginTop: 14, fontSize: 18, color: theme.dim, fontFamily: theme.mono, opacity: gray}}>
        留记录 · 不是直接删掉
      </div>
    </div>
  );
};

/** 6-L 预告条（读管线走查）。 */
const PreviewChip: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 16});
  return (
    <span style={{...enter, padding: '9px 26px', border: `1.5px solid ${theme.concept}`, borderRadius: 999, fontSize: 20, color: theme.concept, background: withAlpha(theme.bg, 0.9)}}>
      接下来 · 读管线七段走查
    </span>
  );
};
