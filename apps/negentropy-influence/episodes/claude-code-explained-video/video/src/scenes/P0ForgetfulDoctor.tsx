/** P0 失忆的医生（p0-01..15，4 镜 4 cue）——分镜 0-A…0-D。
 *
 *  ★ 开场任务：用人肉往返立「它说完了、活还得你干」的痛点，再把诊室装置
 *    （循环〔M-001〕／病历本／医生／科室门）一次性定妆——本集恒定空间契约自本幕生效。
 *  ★ 行数尺首现（底边四格，第一格 102 点亮）＋三层外设剪影自右缘挂入（mech 青）。
 *  archify 全屏独占：human-relay 三瞥（0-B 两章同实例背靠背／0-C 循环接手／0-D 差距预告）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {
  DeptGate,
  Doctor,
  HarnessPlate,
  Ledger,
  LINE_GAUGE,
  LineGauge,
  LoopRing,
  MonoTag,
  PeripheralRow,
  QuoteCard,
  withAlpha,
} from '../components/clinic';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, useCount, useEnter, useImpulse, useStagger} from '../motion';

/** 聊天框两侧（0-A）——左用户敲字、右模型回复，白纸隐喻卡。
 *  白纸卡只放压短关键词（「一张白纸 · 全忘」），不逐字复述口播 p0-03——
 *  RSI-007 双层字幕纪律（2026-10-02 评审修复，同 0-B 金句卡压短形态）。 */
const ChatDuo: React.FC<{atChat: number; atPaper: number}> = ({atChat, atPaper}) => {
  const enters = useStagger(2, {at: atChat, stride: 8, dur: DUR.f5});
  const paper = useEnter('fall', {at: atPaper, dur: DUR.f5, dist: 90});
  return (
    <>
      {[
        {x: 300, who: '你', tone: theme.text},
        {x: 1160, who: '模型', tone: theme.dim},
      ].map((s, i) => (
        <div
          key={s.who}
          style={{
            position: 'absolute',
            left: s.x,
            top: 300,
            width: 420,
            opacity: enters[i],
            transform: `translateY(${(1 - enters[i]) * 24}px)`,
            padding: '18px 24px',
            background: theme.panel,
            border: `2px solid ${withAlpha(s.tone, 0.5)}`,
            borderRadius: 10,
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          <div style={{fontSize: 18, color: s.tone, marginBottom: 10}}>{s.who}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17}}>{i === 0 ? 'help me fix…' : '建议：修改 src/…'}</div>
        </div>
      ))}
      <div
        style={{
          ...paper,
          position: 'absolute',
          left: 770,
          top: 560,
          width: 380,
          padding: '16px 22px',
          background: withAlpha(theme.text, 0.06),
          border: `2px dashed ${withAlpha(theme.dim, 0.55)}`,
          borderRadius: 6,
          fontFamily: theme.serif,
          fontSize: 21,
          color: theme.dim,
        }}
      >
        {'一张白纸 · 全忘'}
      </div>
    </>
  );
};

/** 0-D：102 大数字卡（useCount 逐格计数的落点） */
const CountCard: React.FC<{at: number; to: number}> = ({at, to}) => {
  const n = Math.round(useCount({to, at, dur: DUR.f6}));
  const pulse = useImpulse({at: at + 26, dur: DUR.f4, peak: 1});
  return (
    <div
      style={{
        position: 'absolute',
        left: 690,
        top: 330,
        transform: `scale(${1 + 0.05 * pulse})`,
        fontFamily: theme.mono,
        fontSize: 120,
        color: theme.core,
        textShadow: `0 0 ${18 * pulse}px ${withAlpha(theme.core, 0.5)}`,
      }}
    >
      {n}
    </div>
  );
};

export const P0ForgetfulDoctor: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-11');
  const bD = w('p0-12', 'p0-15');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 开场设问与白纸">
        <ChatDuo atChat={2} atPaper={at('p0-03') - bA.from} />
        {/* 登记角标 llm(messages)——英文标识符只进画面角标的唯一落点（storyboard 0-A 双重登记） */}
        <MonoTag x={246} y={64} at={2}>{'llm(messages)'}</MonoTag>
      </Sequence>

      <Sequence {...bB} name="0-B 人肉往返">
        {/* human-relay 两章同实例背靠背（实例内自动抑制换章弹入） */}
        <ArchifyRecap
          slug="human-relay"
          caption="人当中间层"
          cues={[
            // manual-full 落 trim 留痕（契约同 P4 recall-loop）：p0-04 窗 3.93s vs
            // storySec 6.70s → rate 1.70，原速播＋裁尾约 2.8s（往返拍收束让位给对话起句）
            {chapterId: 'manual-full', at: at('p0-04') - bB.from, durationInFrames: dur('p0-04'), fit: 'trim'},
            {chapterId: 'talk-only', at: at('p0-05') - bB.from, durationInFrames: dur('p0-05')},
          ]}
        />
        {/* p0-06 空窗回落：金句卡（压短形态，非逐字复述）＋storyboard 登记角标 chat */}
        <QuoteCard x={640} y={430} at={at('p0-06') - bB.from} width={640}>
          {'说完了 · 活还是你的'}
        </QuoteCard>
        <MonoTag x={246} y={64} at={at('p0-06') - bB.from}>{'chat'}</MonoTag>
      </Sequence>

      <Sequence {...bC} name="0-C 诊室定妆">
        {/* 诊室让位（R10 修复）：常驻件拆锚 cue 窗外两段（3-F 嵌套 Sequence 范式）——
            原整幕常驻致 p0-10 全屏窗期间框外医生/病历本仍可见，违「全屏独占·播放期
            装置让位」契约；回场段重放 stagger＝「程序接管后诊室回归」，Harness 挂牌
            随 p0-11「这套程序叫 Harness」落位 */}
        <Sequence durationInFrames={at('p0-10') - bC.from} name="0-C 诊室定妆前段">
          {/* atPlate 取本段末帧之外＝前段不挂 Harness 牌（牌属 p0-11 回场） */}
          <ClinicFirstLook atEnter={2} atPlate={at('p0-10') - bC.from + 1} />
        </Sequence>
        <Sequence
          from={at('p0-10') + dur('p0-10') - bC.from}
          durationInFrames={bC.from + bC.durationInFrames - at('p0-10') - dur('p0-10')}
          name="0-C 诊室定妆回场">
          <ClinicFirstLook atEnter={2} atPlate={2} />
        </Sequence>
        {/* p0-10 句让位：循环接手一瞥（与 0-B 实例隔幕，独立实例恢复入场）。
            caption=实例角色（R9 修复：原与章 label「循环接手」逐字同串双绘） */}
        <ArchifyRecap
          slug="human-relay"
          caption="程序接管"
          cues={[{chapterId: 'loop-takes-over', at: at('p0-10') - bC.from, durationInFrames: dur('p0-10')}]}
        />
      </Sequence>

      <Sequence {...bD} name="0-D 行数尺与三层外设">
        {/* to 由 LINE_GAUGE 数据面派生（R10：消 102 硬编码副本，与底部尺带同源） */}
        <CountCard at={2} to={Number(LINE_GAUGE[0].label)} />
        <LineGauge lit={1} />
        <PeripheralRow x={1140} y={430} lit={3} at={at('p0-14') - bD.from} />
        {/* 角标收进自制段（R11 修复：原常驻镜尾，p0-15 全屏窗期间 (246,64) 在画框外
            悬挂可见且口径已过时——同 5-B 角标窗内范式） */}
        <Sequence durationInFrames={at('p0-15') - bD.from} name="0-D 自制段角标">
          <MonoTag x={246} y={64} at={at('p0-12') - bD.from}>{`${LINE_GAUGE[0].label} 行 · 教学版`}</MonoTag>
        </Sequence>
        {/* p0-15 句让位：差距预告一瞥（caption=实例角色，R9 修复同串双绘） */}
        <ArchifyRecap
          slug="human-relay"
          caption="差距在哪"
          cues={[{chapterId: 'gap-preview', at: at('p0-15') - bD.from, durationInFrames: dur('p0-15')}]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 0-C 诊室首现：四件套 stagger 定妆（循环居中〔M-001〕／病历左上／医生左／科室门右） */
const ClinicFirstLook: React.FC<{atEnter: number; atPlate: number}> = ({atEnter, atPlate}) => {
  const enters = useStagger(4, {at: atEnter, stride: 9, dur: DUR.f5});
  return (
    <>
      {/* 病历本＝四件套 stagger 第 2 席（与病历说明 caption 同锚 enters[1]），
          唯一凭据不再硬切入场——2026-10-02 评审意见修复 */}
      <div style={{position: 'absolute', left: 150, top: 130, opacity: enters[1]}}>
        <Ledger x={0} y={0} />
      </div>
      <div style={{position: 'absolute', left: 150, top: 320, width: 86, opacity: enters[2]}}>
        <Doctor x={0} y={0} scale={0.72} />
        {/* 标签独立 absolute（Doctor 脱流，in-flow 会从容器顶起排压头部圆——
            同 P6 SplitScreen 修复口径，2026-10-02 评审） */}
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'医生 · 模型'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 810, top: 230, opacity: enters[3]}}>
        <DeptGate x={0} y={0} lit />
      </div>
      <div style={{position: 'absolute', left: 660, top: 430, opacity: enters[0]}}>
        <LoopRing x={0} y={0} size={280} litSteps={0} glow />
      </div>
      <HarnessPlate x={840} y={170} at={atPlate} />
      <div style={{position: 'absolute', left: 660, top: 730, width: 600, opacity: enters[1], transform: `translateY(${(1 - enters[1]) * 12}px)`, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
        {'病历本 = 唯一凭据 · 每轮全量重读'}
      </div>
    </>
  );
};

export default P0ForgetfulDoctor;
