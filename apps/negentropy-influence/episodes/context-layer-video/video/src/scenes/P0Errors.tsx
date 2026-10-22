/** P0 三种失效（p0-01..p0-27 含 26b，28 句；storyboard v5「P0 三种失效」节）。
 *
 *  7 镜 / 9 条 archify cue（failure-map：fm2-def ×4 + fm2-open ×5）：
 *   0-A 成绩对撞（p0-01..06）：19/85 双成绩条（ScoreDuo·NumCrash 迁移）+ 同模型标签脉冲
 *       + 实线徽 + 「29/150 题」刻度 + 「证据页直给」角标 + 本集标题字条 @enter:fall
 *   0-B 请求登场（p0-07..09）：RequestCard 首现〔M-001〕+ 三失效空槽位 @stagger
 *   0-C 失效卡①（p0-10..13）：fm2-def 锚 p0-10 → hold 11/12/13；前景两份口径卡对推
 *       + 应答气泡左右摆 + $14.2M/$12.8M 翻牌 @impulse + 虚线徽（Snowflake 案例）
 *   0-D 失效卡②（p0-14..16）：表清单错连线（橙描画）+ 10.1% 翻牌 + 语法对勾常亮
 *       + 实线徽（Spider 2.0）+ 角标「错在选表与连表」
 *   0-E 失效卡③（p0-17..20）：窗口内容列 + 手机号行明文滑入 + 橙边呼吸
 *       + RequestCard 缩于左上 + 「凭证继承」小标闪
 *   0-F 三错共性（p0-21..23）：三缩略卡收拢 + 判词条 + 97/4 比例条（RatioBars）+ 虚线徽
 *   0-G 登记成表（p0-24..27 含 26b）：fm2-open 锚 p0-24 → hold 25/26/26b/27；前景「十类四十九行」
 *       计数上翻 + 三卡飞落弧线 + 「逐层拆开」五轴导航条
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme, withAlpha} from '../design/theme';
import {progress, useBreathe, useEnter, useImpulse, useProgress, useSpring, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {RequestCard} from '../components/RequestCard';

export const P0Errors: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p0-01', 'p0-06');
  const bB = w('p0-07', 'p0-09');
  const bC = w('p0-10', 'p0-13');
  const bD = w('p0-14', 'p0-16');
  const bE = w('p0-17', 'p0-20');
  const bF = w('p0-21', 'p0-23');
  const bG = w('p0-24', 'p0-27');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P0" tagline="三种错误" accent={theme.concept} />

      {/* 0-A 成绩对撞：19/85 双成绩条 + 同模型标签 + 标题字条（首镜视听合力） */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="0-A">
        <ScoreDuo
          at={at('p0-01') - bA.from}
          tick29At={at('p0-03') - bA.from}
          pageTagAt={at('p0-04') - bA.from}
          pulseAt={at('p0-05') - bA.from}
        />
        <EpisodeTitle at={at('p0-06') - bA.from} />
        <div style={{position: 'absolute', bottom: 190, left: 80}}>
          <EvidenceBadge level="solid" at={10} note="FinanceBench · 同一 GPT-4-Turbo" />
        </div>
      </Sequence>

      {/* 0-B 请求登场：RequestCard 首现（恒定锚）+ 三失效空槽位 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="0-B">
        <RequestIntro cardAt={at('p0-07') - bB.from} slotsAt={at('p0-09') - bB.from} />
      </Sequence>

      {/* 0-C 失效卡①：fm2-def 全章回放为底，前景口径卡叠加 */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="0-C">
        <ArchifyRecap slug="failure-map" caption="问题登记簿 · 定义执法簇" cues={[
          {chapterId: 'fm2-def', at: at('p0-10') - bC.from, durationInFrames: dur('p0-10')},
          {chapterId: 'fm2-def', at: at('p0-11') - bC.from, durationInFrames: dur('p0-11'), fit: 'hold'},
          {chapterId: 'fm2-def', at: at('p0-12') - bC.from, durationInFrames: dur('p0-12'), fit: 'hold'},
          {chapterId: 'fm2-def', at: at('p0-13') - bC.from, durationInFrames: dur('p0-13'), fit: 'hold'},
        ]} />
        <DualDefCard
          at={at('p0-10') - bC.from + 8}
          swingAt={at('p0-12') - bC.from}
          flipAt={at('p0-13') - bC.from}
        />
        <div style={{position: 'absolute', bottom: 190, left: 80}}>
          <EvidenceBadge level="dashed" at={at('p0-13') - bC.from} note="Snowflake 博客开场 · 同季收入两数" />
        </div>
      </Sequence>

      {/* 0-D 失效卡②：选错表/连错关系 + 10.1% + 语法对勾常亮 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="0-D">
        <WrongJoin
          at={at('p0-14') - bD.from}
          linkAt={at('p0-15') - bD.from}
          crashAt={at('p0-15') - bD.from + 14}
        />
        <div style={{position: 'absolute', bottom: 190, left: 80}}>
          <EvidenceBadge level="solid" at={at('p0-15') - bD.from} note="Spider 2.0 · 632 题 · 千列级库" />
        </div>
        <div style={{position: 'absolute', bottom: 190, right: 80}}>
          <CornerNote at={at('p0-16') - bD.from} text="错在选表与连表 · 不在语法" accent={theme.conceptDeep} />
        </div>
      </Sequence>

      {/* 0-E 失效卡③：窗口内容列 + 手机号行明文滑入 + RequestCard 缩于左上 */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="0-E">
        <WindowLeak
          cardAt={at('p0-17') - bE.from}
          credAt={at('p0-18') - bE.from}
          leakAt={at('p0-19') - bE.from}
        />
      </Sequence>

      {/* 0-F 三错共性：三缩略卡收拢 + 判词条 + 97/4 比例条 + 虚线徽 */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="0-F">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
            <FailTrio at={at('p0-21') - bF.from} />
            <JudgeStrip at={at('p0-22') - bF.from} />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start'}}>
            <RatioBars at={at('p0-23') - bF.from} />
            <EvidenceBadge level="dashed" at={at('p0-23') - bF.from} note="Redis 调查 · n=1000 · 方法论未公开" />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* 0-G 登记成表：fm2-open 全章回放为底，前景计数 + 三卡飞落 + 五轴导航条 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="0-G">
        <ArchifyRecap slug="failure-map" caption="问题登记簿 · 十簇总览" cues={[
          {chapterId: 'fm2-open', at: at('p0-24') - bG.from, durationInFrames: dur('p0-24')},
          {chapterId: 'fm2-open', at: at('p0-25') - bG.from, durationInFrames: dur('p0-25'), fit: 'hold'},
          {chapterId: 'fm2-open', at: at('p0-26') - bG.from, durationInFrames: dur('p0-26'), fit: 'hold'},
          {chapterId: 'fm2-open', at: at('p0-26b') - bG.from, durationInFrames: dur('p0-26b'), fit: 'hold'},
          {chapterId: 'fm2-open', at: at('p0-27') - bG.from, durationInFrames: dur('p0-27'), fit: 'hold'},
        ]} />
        <RegistryOverlay
          countAt={at('p0-25') - bG.from}
          dropAt={at('p0-26') - bG.from}
          navAt={at('p0-27') - bG.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 可选锚关闭态：远未来帧 ⇒ 进度恒 0（hooks 不可条件调用）。 */
const ANCHOR_OFF = 1e12;

/** 0-A/8-L 共用：19 vs 85 双成绩条（同模型标签居中连接；NumCrash 迁移形态）。 */
export const ScoreDuo: React.FC<{
  at: number;
  /** 「29/150 题」刻度帧 */
  tick29At?: number;
  /** 「证据页直给」角标帧 */
  pageTagAt?: number;
  /** 模型标签脉冲帧 */
  pulseAt?: number;
}> = ({at, tick29At, pageTagAt, pulseAt}) => {
  const growL = useSpring('settle', {at: at + 4, dur: 40});
  const growR = useSpring('settle', {at: at + 18, dur: 46});
  const tick = useProgress(tick29At ?? ANCHOR_OFF, 12);
  const tag = useProgress(pageTagAt ?? ANCHOR_OFF, 12);
  const pulse = useImpulse({at: pulseAt ?? ANCHOR_OFF, dur: 26, peak: 1});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      {/* 19%：裸库检索 */}
      <div style={{width: 560}}>
        <div style={{fontSize: 84, color: theme.dim, fontVariantNumeric: 'tabular-nums', textAlign: 'right'}}>
          {Math.round(19 * growL)}%
        </div>
        <div style={{height: 44, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, background: theme.panel, marginTop: 8, position: 'relative', overflow: 'hidden'}}>
          <div style={{width: `${19 * growL}%`, height: '100%', background: withAlpha(theme.dim, 0.75)}} />
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: 9,
              fontSize: 18,
              fontFamily: theme.mono,
              color: theme.bg,
              opacity: tick * growL,
            }}
          >
            29/150 题
          </div>
        </div>
        <div style={{fontSize: 20, color: theme.dim, marginTop: 10, textAlign: 'right'}}>所有文档混一个库 · 检索</div>
      </div>
      {/* 同模型连接标签 */}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
        <div style={{width: 2, height: 44, background: theme.panelBorder}} />
        <div
          style={{
            padding: '8px 18px',
            border: `2px solid ${pulse > 0.05 ? theme.ok : theme.panelBorder}`,
            borderRadius: 999,
            fontSize: 19,
            fontFamily: theme.mono,
            color: pulse > 0.05 ? theme.ok : theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          同一 GPT-4-Turbo · 参数未改
        </div>
        <div style={{width: 2, height: 44, background: theme.panelBorder}} />
      </div>
      {/* 85%：证据页直给 */}
      <div style={{width: 560}}>
        <div style={{fontSize: 84, color: theme.ok, fontVariantNumeric: 'tabular-nums'}}>
          {Math.round(85 * growR)}%
        </div>
        <div style={{height: 44, border: `1.5px solid ${theme.ok}`, borderRadius: 8, background: theme.panel, marginTop: 8, position: 'relative', overflow: 'hidden'}}>
          <div style={{width: `${85 * growR}%`, height: '100%', background: withAlpha(theme.ok, 0.8)}} />
          <div
            style={{
              position: 'absolute',
              right: 14,
              top: 9,
              fontSize: 18,
              fontFamily: theme.mono,
              color: theme.ok,
              opacity: tag,
            }}
          >
            证据页直给
          </div>
        </div>
        <div style={{fontSize: 20, color: theme.dim, marginTop: 10}}>正确的证据页直接进窗口</div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-A 尾：本集标题字条 @enter:fall。 */
const EpisodeTitle: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('fall', {at, dur: 20});
  return (
    <div style={{position: 'absolute', top: 130, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: enter.opacity, transform: enter.transform}}>
      <div style={{padding: '12px 34px', border: `2px solid ${theme.concept}`, borderRadius: 10, background: withAlpha(theme.bg, 0.92)}}>
        <span style={{fontSize: 32, color: theme.concept, letterSpacing: 2}}>拆解 Agent Context Layer</span>
      </div>
    </div>
  );
};

/** 0-B：RequestCard 首现 + 三失效空槽位。 */
const RequestIntro: React.FC<{cardAt: number; slotsAt: number}> = ({cardAt, slotsAt}) => {
  const slots = useStagger(3, {stride: 12, at: slotsAt});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <RequestCard at={cardAt} />
      <div style={{display: 'flex', gap: 34}}>
        {['错误一', '错误二', '错误三'].map((t, i) => (
          <div
            key={t}
            style={{
              width: 236,
              height: 92,
              border: `2px dashed ${theme.panelBorder}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: theme.dim,
              opacity: slots[i] * 0.95,
              transform: `scale(${0.9 + slots[i] * 0.1})`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** 0-C 前景：两份「重复购买率」口径卡对推 + 应答气泡摆动 + $ 双数翻牌。 */
const DualDefCard: React.FC<{at: number; swingAt: number; flipAt: number}> = ({at, swingAt, flipAt}) => {
  const f = useCurrentFrame();
  const inL = useEnter('slideR', {at, dur: 24});
  const inR = useEnter('slideL', {at: at + 6, dur: 24});
  const flip = useImpulse({at: flipAt, dur: 24, peak: 1});
  // 应答气泡：p0-12 起在两份定义之间往复（帧驱动正弦，确定性）
  const swing = f >= swingAt ? Math.sin((f - swingAt) / 14) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 400,
        transform: `translateX(-50%) translateY(${flip * 6}px)`,
        width: 1010,
        padding: '24px 30px',
        background: withAlpha(theme.bg, 0.9),
        border: `2px solid ${theme.panelBorder}`,
        borderRadius: 14,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'center', gap: 44}}>
        <div style={{...inL, width: 300, padding: '16px 20px', background: theme.panel, border: `2px solid ${theme.concept}`, borderRadius: 10}}>
          <div style={{fontSize: 22, color: theme.concept}}>重复购买率 · 定义 A</div>
          <div style={{fontSize: 19, color: theme.dim, marginTop: 8, fontFamily: theme.mono}}>口径 = 按客户数</div>
        </div>
        <div style={{...inR, width: 300, padding: '16px 20px', background: theme.panel, border: `2px solid ${theme.conceptDeep}`, borderRadius: 10}}>
          <div style={{fontSize: 22, color: theme.conceptDeep}}>重复购买率 · 定义 B</div>
          <div style={{fontSize: 19, color: theme.dim, marginTop: 8, fontFamily: theme.mono}}>口径 = 按订单数</div>
        </div>
      </div>
      {/* 应答气泡：碰哪份定义报哪个数 */}
      <div style={{display: 'flex', justifyContent: 'center', marginTop: 22}}>
        <div
          style={{
            padding: '10px 26px',
            border: `1.5px solid ${theme.panelBorder}`,
            borderRadius: 999,
            background: theme.terminalBg,
            fontSize: 21,
            fontFamily: theme.mono,
            color: theme.text,
            transform: `translateX(${swing * 150}px)`,
          }}
        >
          代理应答 · 取当前命中定义
        </div>
      </div>
      {/* $ 双数翻牌（Snowflake 案例） */}
      <div style={{display: 'flex', justifyContent: 'center', gap: 40, marginTop: 22, opacity: flip > 0.02 ? 1 : 0.001}}>
        <span style={{fontSize: 46, color: theme.conceptDeep, fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', transform: `scale(${1 + flip * 0.12})`}}>$14.2M</span>
        <span style={{fontSize: 24, color: theme.dim, alignSelf: 'center'}}>同季收入</span>
        <span style={{fontSize: 46, color: theme.concept, fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', transform: `scale(${1 + flip * 0.12})`}}>$12.8M</span>
      </div>
    </div>
  );
};

/** 0-D：表清单 + 错连线（选错表/连错关系）+ 10.1% 翻牌 + 语法对勾常亮。 */
const WrongJoin: React.FC<{at: number; linkAt: number; crashAt: number}> = ({at, linkAt, crashAt}) => {
  const nodes = useStagger(4, {stride: 10, at});
  const line = useProgress(linkAt, 18);
  const crash = useSpring('settle', {at: crashAt, dur: 22});
  const val = Math.max(10.1, 100 - 89.9 * crash);
  const names = ['orders', 'customers', 'sessions', 'order_items'];
  const nx = [0, 230, 460, 230];
  const ny = [40, 40, 40, 170];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 90}}>
      <svg width={620} height={280}>
        {/* 正确连线（暗）：orders × customers */}
        <line x1={115} y1={78} x2={345} y2={78} stroke={theme.panelBorder} strokeWidth={2} opacity={nodes[1]} />
        {/* 错连线：orders × sessions（橙红描画） */}
        <line
          x1={115}
          y1={70}
          x2={575}
          y2={70}
          stroke={theme.conceptDeep}
          strokeWidth={3}
          strokeDasharray="8 7"
          opacity={line}
        />
        {names.map((n, i) => (
          <g key={n} opacity={nodes[i]}>
            <rect
              x={nx[i]}
              y={ny[i]}
              width={230}
              height={76}
              rx={8}
              fill={theme.panel}
              stroke={i === 2 ? theme.conceptDeep : theme.panelBorder}
              strokeWidth={i === 2 ? 2.5 : 1.5}
            />
            <text x={nx[i] + 115} y={ny[i] + 46} textAnchor="middle" fill={i === 2 ? theme.conceptDeep : theme.dim} fontSize={22} fontFamily={theme.mono}>
              {n}
            </text>
          </g>
        ))}
        <text x={345} y={58} textAnchor="middle" fill={theme.conceptDeep} fontSize={17} fontFamily={theme.mono} opacity={line}>
          选错表 · 连错关系
        </text>
      </svg>
      <div style={{textAlign: 'center'}}>
        <div style={{fontSize: 104, color: theme.conceptDeep, fontVariantNumeric: 'tabular-nums'}}>{val.toFixed(1)}%</div>
        <div style={{fontSize: 21, color: theme.dim, marginTop: 4}}>强模型裸答企业级评测</div>
        {/* 语法对勾常亮 */}
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 22, padding: '8px 18px', border: `2px solid ${theme.ok}`, borderRadius: 8}}>
          <span style={{color: theme.ok, fontSize: 22}}>✓</span>
          <span style={{fontSize: 19, color: theme.ok, fontFamily: theme.mono}}>SQL 语法合法</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-E：模型窗口内容列 + 手机号行明文滑入 + 橙边呼吸 + RequestCard 缩于左上。 */
const WindowLeak: React.FC<{cardAt: number; credAt: number; leakAt: number}> = ({cardAt, credAt, leakAt}) => {
  const rows = useStagger(3, {stride: 10, at: cardAt + 10});
  const leak = useSpring('settle', {at: leakAt, dur: 26});
  const breathe = useBreathe({period: 100, amp: 0.3, base: 0.7});
  const cred = useImpulse({at: credAt + 6, dur: 30, peak: 1});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {/* RequestCard 缩于左上（恒定锚持续在场） */}
      <div style={{position: 'absolute', left: 96, top: 132, transform: 'scale(0.52)', transformOrigin: 'top left'}}>
        <RequestCard at={cardAt} />
      </div>
      {/* 凭证继承小标 */}
      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 350,
          padding: '7px 16px',
          border: `2px solid ${cred > 0.05 ? theme.conceptDeep : theme.panelBorder}`,
          borderRadius: 8,
          fontSize: 18,
          fontFamily: theme.mono,
          color: theme.conceptDeep,
          opacity: 0.5 + cred * 0.5,
        }}
      >
        凭证继承 · 用户权限全集
      </div>
      {/* 窗口内容列 */}
      <div
        style={{
          width: 760,
          border: `2.5px solid ${theme.conceptDeep}`,
          borderColor: `rgba(245, 166, 35, ${0.45 + breathe * 0.55})`,
          borderRadius: 12,
          background: theme.panel,
          padding: '22px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{fontSize: 18, color: theme.dim, fontFamily: theme.mono}}>本轮窗口 · 全部内容</div>
        {['系统指令', '指标说明文档', '会话历史'].map((t, i) => (
          <div key={t} style={{opacity: rows[i], display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 21, color: theme.text}}>
            <span style={{width: 8, height: 8, borderRadius: 4, background: theme.concept}} />
            {t}
          </div>
        ))}
        {/* 手机号行：明文滑入（脱敏样式 + 橙警示） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 16px',
            border: `2px solid ${theme.conceptDeep}`,
            background: withAlpha(theme.conceptDeep, 0.08),
            borderRadius: 8,
            fontSize: 22,
            color: theme.conceptDeep,
            fontFamily: theme.mono,
            transform: `translateY(${(1 - leak) * 46}px)`,
            opacity: leak,
          }}
        >
          <span style={{width: 8, height: 8, borderRadius: 4, background: theme.conceptDeep}} />
          customers · phone 138****5678
          <span style={{fontSize: 17, border: `1.5px solid ${theme.conceptDeep}`, borderRadius: 6, padding: '2px 10px'}}>明文入窗</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-F：三失效缩略卡收拢对齐。 */
const FailTrio: React.FC<{at: number}> = ({at}) => {
  const cards = useStagger(3, {stride: 10, at});
  const items = [
    {t: '错误①', s: '口径两数', accent: theme.concept},
    {t: '错误②', s: '选错表', accent: theme.conceptDeep},
    {t: '错误③', s: '越权入窗', accent: theme.conceptDeep},
  ];
  return (
    <div style={{display: 'flex', gap: 30}}>
      {items.map((c, i) => (
        <div
          key={c.t}
          style={{
            width: 230,
            padding: '18px 0',
            border: `2px solid ${c.accent}`,
            borderRadius: 10,
            background: theme.panel,
            textAlign: 'center',
            opacity: cards[i],
            transform: `translateX(${(1 - cards[i]) * (i - 1) * 70}px)`,
          }}
        >
          <div style={{fontSize: 21, color: c.accent, fontFamily: theme.mono}}>{c.t}</div>
          <div style={{fontSize: 24, color: theme.text, marginTop: 8}}>{c.s}</div>
        </div>
      ))}
    </div>
  );
};

/** 0-F 判词条。 */
const JudgeStrip: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('rise', {at, dur: 18});
  return (
    <div style={{...enter, padding: '14px 38px', border: `2.5px solid ${theme.conceptDeep}`, borderRadius: 12, fontSize: 32, color: theme.conceptDeep, letterSpacing: 2}}>
      exit=0 · 数字错
    </div>
  );
};

/** 0-G 前景：十类四十九行计数上翻 + 三卡飞落弧线 + 逐层拆开导航条。 */
const RegistryOverlay: React.FC<{countAt: number; dropAt: number; navAt: number}> = ({countAt, dropAt, navAt}) => {
  const f = useCurrentFrame();
  const count = useSpring('settle', {at: countAt, dur: 30});
  const nav = useEnter('rise', {at: navAt, dur: 16});
  // 三卡错峰飞落：map 内用纯函数 progress（运动层铁律①）
  const drops = [0, 14, 28].map((d) => progress(f, dropAt + d, 40));
  // 三卡落点：口径(c1)/验证(c4)/访问控制(c3) 三簇近似位置（画布绝对坐标，回放框内）
  const targets = [
    {x: 520, y: 300, t: '错误①', s: '口径'},
    {x: 960, y: 430, t: '错误③', s: '访问控制'},
    {x: 1380, y: 330, t: '错误②', s: '验证'},
  ];
  return (
    <>
      {/* 计数上翻 */}
      <div style={{position: 'absolute', top: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <div style={{padding: '10px 28px', border: `2px solid ${theme.concept}`, borderRadius: 10, background: withAlpha(theme.bg, 0.9), fontSize: 26, fontFamily: theme.mono, color: theme.concept}}>
          十类 · {Math.round(49 * Math.min(1, count))} 行 · 每行四件事
        </div>
      </div>
      {/* 三卡飞落（二次贝塞尔弧线） */}
      {targets.map((tg, i) => {
        const p = Math.min(1, Math.max(0, drops[i]));
        const sx = 960;
        const sy = 1010;
        const cx = (sx + tg.x) / 2;
        const cy = 720;
        const x = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * cx + p * p * tg.x;
        const y = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * cy + p * p * tg.y;
        return (
          <div
            key={tg.t}
            style={{
              position: 'absolute',
              left: x - 80,
              top: y - 30,
              width: 160,
              padding: '8px 0',
              border: `2px solid ${theme.conceptDeep}`,
              borderRadius: 8,
              background: withAlpha(theme.bg, 0.92),
              textAlign: 'center',
              opacity: p,
            }}
          >
            <div style={{fontSize: 17, color: theme.conceptDeep, fontFamily: theme.mono}}>{tg.t}</div>
            <div style={{fontSize: 19, color: theme.text}}>{tg.s}</div>
          </div>
        );
      })}
      {/* 逐层拆开 · 五轴导航条 */}
      <div style={{position: 'absolute', bottom: 172, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: nav.opacity, transform: nav.transform}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '10px 26px', border: `2px solid ${theme.concept}`, borderRadius: 999, background: withAlpha(theme.bg, 0.9)}}>
          <span style={{fontSize: 20, color: theme.concept}}>逐层拆开</span>
          {['资产', '权威', '装配', '检索', '沉淀'].map((t) => (
            <span key={t} style={{fontSize: 19, color: theme.dim, fontFamily: theme.mono}}>{t}</span>
          ))}
        </div>
      </div>
    </>
  );
};

/** 97/4 比例条（0-F / 8-L 复用）：相信的长条 vs 建成的短刺。 */
export const RatioBars: React.FC<{at: number}> = ({at}) => {
  const grow97 = useSpring('settle', {at: at + 4, dur: 30});
  const grow4 = useSpring('settle', {at: at + 30, dur: 14});
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 560}}>
      <div>
        <div style={{fontSize: 20, color: theme.concept, marginBottom: 8}}>97% · 相信上下文决定成败</div>
        <div style={{width: 560, height: 28, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden'}}>
          <div style={{width: `${97 * grow97}%`, height: '100%', background: theme.concept, opacity: 0.85}} />
        </div>
      </div>
      <div>
        <div style={{fontSize: 20, color: theme.conceptDeep, marginBottom: 8}}>4% · 真正建成</div>
        <div style={{width: 560, height: 28, border: `1.5px solid ${theme.panelBorder}`, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center'}}>
          <div style={{width: `${4 * grow4}%`, height: 16, background: theme.conceptDeep, borderRadius: 3}} />
        </div>
      </div>
    </div>
  );
};

/** 角标注（0-D/通用）：短句 chip，不复述口播。 */
const CornerNote: React.FC<{at: number; text: string; accent: string}> = ({at, text, accent}) => {
  const enter = useEnter('rise', {at, dur: 14});
  return (
    <span style={{...enter, display: 'inline-block', padding: '8px 20px', border: `2px solid ${accent}`, borderRadius: 999, fontSize: 20, color: accent, background: withAlpha(theme.bg, 0.85)}}>
      {text}
    </span>
  );
};
