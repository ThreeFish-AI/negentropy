/** P6 落点与信源（分镜 6-A…6-C）
 *  三种开始三段位置图（位置编码，不用三色）+ 共享小环匀速贯穿
 *  → 6-B 免责两句前置（p6-13/14 信源样式小字）→ 一句话合同金句卡（p6-07）
 *  → p6-09「钟挪进不睡的管家」过渡 →「守时的自主」边界两句 → 四件套回收条
 *  （p6-12 循环/工具/上下文管理/护栏；p6-12a 本集钉进「循环」格，仅循环格 core 描边+呼吸辉光）
 *  → 6-C 身份卡 → 下期卡 → 渐黑（末 beat 总时长推导，skills/06 红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneHeader, useRingDot} from '../components/motifs';

/** 三段位置图的一段：人（或表）与环的位置关系——「谁按的开始」用位置编码 */
const StartPanel: React.FC<{
  mode: 'onRing' | 'offRing' | 'noOne';
  title: string;
  sub: string;
  active: boolean;
}> = ({mode, title, sub, active}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dot = useRingDot(2.5);
  // 右上角共享小环：匀速转（贯穿三段，回收题眼）
  const cx = 130;
  const cy = 120;
  const r = 74;
  const rad = ((-90 + dot * 360) * Math.PI) / 180;
  const stroke = active ? theme.core : theme.panelBorder;
  return (
    <Panel accent={active ? theme.panelBorder : theme.panelBorder} style={{width: 420, padding: '20px 22px', opacity: active ? 1 : 0.42}}>
      <div style={{position: 'relative'}}>
        <svg width={260} height={250} style={{overflow: 'visible'}}>
          {/* 小环：右上角恒转 */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={5} />
          <circle cx={cx + r * Math.cos(rad)} cy={cy + r * Math.sin(rad)} r={9} fill={stroke} />
          {/* 位置主体（左下区） */}
          {mode === 'onRing' ? (
            <g opacity={active ? 1 : 0.6}>
              {/* 人站在环上（跟着转的人在等） */}
              <g transform={`translate(${cx + r * Math.cos(rad)} ${cy + r * Math.sin(rad)}) rotate(${dot * 360 + 90})`}>
                <circle cx={0} cy={-40} r={13} fill={theme.text} />
                <path d="M0 -26 v34 M0 -16 l-15 12 M0 -16 l15 12" stroke={theme.text} strokeWidth={6} strokeLinecap="round" fill="none" />
              </g>
              <text x={30} y={230} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {'人陪着转 —— 它和你一起等'}
              </text>
            </g>
          ) : null}
          {mode === 'offRing' ? (
            <g opacity={active ? 1 : 0.6}>
              {/* 人站在环外，风筝绳拴着后台块 */}
              <g transform={`translate(36 ${cy + 40})`}>
                <circle cx={0} cy={-38} r={12} fill={theme.text} />
                <path d="M0 -24 v30 M0 -14 l-13 11 M0 -14 l13 11 M0 6 l-9 15 M0 6 l9 15" stroke={theme.text} strokeWidth={5.5} strokeLinecap="round" fill="none" />
              </g>
              <path
                d={`M44 ${cy + 16} C 80 ${cy + 40}, ${cx - 40} ${cy - 30}, ${cx + r * 0.7} ${cy - r * 0.7}`}
                stroke={theme.later}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray="5 7"
              />
              <text x={30} y={230} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {'人在环外 —— 绳在循环手里'}
              </text>
            </g>
          ) : null}
          {mode === 'noOne' ? (
            <g opacity={active ? 1 : 0.6}>
              {/* 没有人：只有表盘，时间按开始 */}
              <g transform={`translate(56 ${cy + 30})`}>
                <circle cx={0} cy={0} r={34} fill={theme.panel} stroke={theme.later} strokeWidth={3.5} />
                <line x1={0} y1={0} x2={0} y2={-22} stroke={theme.later} strokeWidth={4} strokeLinecap="round" />
                <line x1={0} y1={0} x2={14} y2={8} stroke={theme.later} strokeWidth={3} strokeLinecap="round" />
              </g>
              {/* 表 → 环的触发线（虚线：时间替人按） */}
              <path
                d={`M92 ${cy + 30} C ${cx - 50} ${cy + 40}, ${cx - 60} ${cy}, ${cx - r} ${cy}`}
                stroke={theme.later}
                strokeWidth={2.5}
                fill="none"
                strokeDasharray="5 7"
              />
              <text x={30} y={230} fontFamily={theme.sans} fontSize={21} fill={theme.dim}>
                {'没有人 —— 时间自己按'}
              </text>
            </g>
          ) : null}
        </svg>
        {/* 段标题：位置陈述，不带色相 */}
        <div style={{marginTop: 4}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{title}</div>
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 22, color: active ? theme.text : theme.dim, marginTop: 10}}>
        {sub}
      </div>
    </Panel>
  );
};

/** 6-A 三段位置图依次亮起 + 机制外挪一层箭头 + 共享小环匀速贯穿 */
const ThreePositions: React.FC<{l1: number; l2: number; l3: number; layerAt: number; ringAt: number}> = ({
  l1,
  l2,
  l3,
  layerAt,
  ringAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e1 = spring({frame: frame - l1, fps, config: {damping: 200}});
  const e2 = spring({frame: frame - l2, fps, config: {damping: 200}});
  const e3 = spring({frame: frame - l3, fps, config: {damping: 200}});
  const layer = interpolate(frame - layerAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ringO = interpolate(frame - ringAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
            <div style={{position: 'absolute', left: 0, right: 0, top: 190, display: 'flex', justifyContent: 'center', gap: 36}}>
        <div style={{opacity: e1}}>
          <StartPanel mode="onRing" title="01 · 有人按并等着" sub="最笨也最常见" active={frame >= l1} />
        </div>
        <div style={{opacity: e2}}>
          <StartPanel mode="offRing" title="02 · 有人按不等" sub="活丢后台，通知排队，还有狗看着" active={frame >= l2} />
        </div>
        <div style={{opacity: e3}}>
          <StartPanel mode="noOne" title="03 · 没人按" sub="时间自己按，错峰响，七天不响就退休" active={frame >= l3} />
        </div>
      </div>
      {/* 机制外挪：每多一种开始，往外挪一层 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 246,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          color: theme.text,
          opacity: layer,
        }}
      >
        {'活挪出这一轮，触发挪出这个人'}
      </div>
      {/* 题眼回收：环一秒不停 */}
      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 96,
          opacity: ringO,
        }}
      >
        <LoopRing size={230} draw={1} dotProgress={useRingDot(2.5)} showLabels={false} />
        <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 21, color: theme.core, marginTop: 6}}>
          {'从头到尾 · 一秒没停'}
        </div>
      </div>
      <Footnote delay={ringAt}>{'按下的不一定是它，等的一定不是你'}</Footnote>
    </AbsoluteFill>
  );
};

/** 6-B 免责两句前置（p6-13/14 信源样式小字）→ 一句话合同金句卡（p6-07）
 *  → p6-09 钟挪进管家过渡 → 守时的自主边界两句（p6-10/11）
 *  → 四件套回收条（p6-12）+ 本集钉进「循环」格（p6-12a）。 */
const ContractAndRecap: React.FC<{disclaim2At: number; quoteAt: number; boundAt: number; fourAt: number; pinAt: number}> = ({
  disclaim2At,
  quoteAt,
  boundAt,
  fourAt,
  pinAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 免责两行：p6-13 句首浮出第一行，p6-14 句锚浮出第二行（信源样式小字）
  const d1 = interpolate(frame - 6, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const d2 = interpolate(frame - disclaim2At, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 金句卡（p6-07）spring 淡入；免责区随之淡出让位
  const quote = spring({frame: frame - quoteAt, fps, config: {damping: 200}});
  const disclaimGone = interpolate(frame - quoteAt, [0, 16], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // p6-09 过渡 + p6-10/11 边界两句
  const clock = interpolate(frame - boundAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 四件套回收条（p6-12）四格依次亮
  const four = interpolate(frame - fourAt, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const FOUR = ['循环', '工具', '上下文管理', '护栏'];
  // p6-12a 本集钉进「循环」格：core 描边 + 呼吸辉光（帧驱动 sin，确定性）
  const pin = interpolate(frame - pinAt, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glow = 0.55 + 0.45 * Math.sin(frame / 5);
  return (
    <AbsoluteFill>
      {/* 免责两句前置：信源样式小字（p6-13 官方文档 / p6-14 第三方标注） */}
      {disclaimGone > 0.01 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <div style={{textAlign: 'center', opacity: disclaimGone}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, opacity: d1}}>
              {'本片机制依据官方文档 · 取数 2026 年 8 月，以官方最新表述为准'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, marginTop: 22, opacity: d2}}>
              {'产品内部的部分为第三方源码分析 · 片中已逐处标注'}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
      {/* 一句话合同金句卡 + 边界两句（p6-07 起，随后 p6-09..11 跟随；
          paddingBottom 抬高中线——p6-12 四件套回收条在 bottom:246 带下方让位） */}
      {quote > 0 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 160px 150px'}}>
          <div style={{textAlign: 'center', opacity: quote, transform: `translateY(${(1 - quote) * 26}px)`}}>
            <div style={{fontFamily: theme.serif, fontSize: 68, fontWeight: 700, color: theme.core, lineHeight: 1.4}}>
              {'按下的不一定是它，'}
              <br />
              {'等的一定不是你。'}
            </div>
            {/* p6-09「钟挪进不睡的管家」过渡 + p6-10/11 守时的自主边界 */}
            <div
              style={{
                marginTop: 44,
                fontFamily: theme.serif,
                fontSize: 29,
                color: theme.text,
                opacity: clock,
                lineHeight: 1.8,
              }}
            >
              {'钟曾经装在它身体里，现在挪进了一个不睡的管家。'}
              <br />
              <span style={{color: theme.dim, fontSize: 26}}>
                {'它的自主，到此为止是「守时的自主」——'}
                <br />
                {'「自己决定该干什么活」是更大的一步，我们后面再拆。'}
              </span>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
      {/* 四件套回收条（p6-12 四格依次亮；反枚举：四格不给四色）。
          带 bottom:246 与 6-A「机制外挪」同一水平带，避开 Footnote（bottom:168）压字 */}
      {four > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 246,
            display: 'flex',
            justifyContent: 'center',
            gap: 26,
            opacity: four,
            transform: `translateY(${(1 - four) * 22}px)`,
          }}
        >
          {FOUR.map((t, i) => {
            const cell = interpolate(frame - fourAt - i * 6, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const isLoop = i === 0;
            return (
              <div key={t} style={{position: 'relative'}}>
                <div
                  style={{
                    padding: '14px 30px',
                    borderRadius: 12,
                    border: isLoop && pin > 0 ? `3px solid ${theme.core}` : `2px solid ${theme.panelBorder}`,
                    background: isLoop && pin > 0 ? `${theme.coreDeep}` : theme.panel,
                    fontFamily: theme.sans,
                    fontSize: 26,
                    color: isLoop && pin > 0 ? theme.text : theme.dim,
                    opacity: cell,
                    whiteSpace: 'nowrap',
                    boxShadow: isLoop && pin > 0 ? `0 0 ${26 * glow}px ${theme.core}` : 'none',
                  }}
                >
                  {t}
                </div>
                {/* p6-12a 本集钉进「循环」格：图钉落下 */}
                {isLoop && pin > 0 ? (
                  <svg
                    width={34}
                    height={38}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -24,
                      marginLeft: -17,
                      transform: `scale(${0.6 + 0.4 * pin})`,
                      overflow: 'visible',
                    }}
                  >
                    <circle cx={17} cy={16} r={12} fill={theme.core} stroke={theme.coreDeep} strokeWidth={3} />
                    <circle cx={17} cy={16} r={4} fill={theme.bg} />
                    <line x1={17} y1={28} x2={17} y2={38} stroke={theme.coreDeep} strokeWidth={4} strokeLinecap="round" />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {/* 四件套画像的出处角标（p6-12 起，【二】官方工程博客） */}
      <Footnote delay={fourAt}>
        {'循环 · 工具 · 上下文管理 · 护栏 —— 官方工程博客'}
      </Footnote>
    </AbsoluteFill>
  );
};

/**
 * 6-C 身份卡 → 下期卡 → 渐黑（单句 p6-15）。
 * `beatDurationInFrames` 是**本 beat 的总时长**，渐黑窗口据此反推（红线四：
 * 不写死帧数、不用末句时长——末句短于 beat 时会提前收尾）。
 * 下期卡在句内后半段浮出：窗口从 beat 总时长按固定比例推导（句锚不可分——
 * 单句镜无第二锚，比例锚定在句中段「为什么还有人这么干」分句处）。
 */
const IdentityAndFade: React.FC<{beatDurationInFrames: number}> = ({beatDurationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  // 下期卡：身份卡稳住一拍后浮出（beat 总时长 × 0.52 处——口播念到
  // 「为什么还有人这么干」时下期卡就位，「下期见」前视觉先到）
  const nextAt = Math.round(beatDurationInFrames * 0.52);
  const nextT = interpolate(frame - nextAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 18}px)`}}>
        <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dim, letterSpacing: 3}}>
          {'Claude Code Harness Engineering'}
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 60,
            fontWeight: 700,
            color: theme.core,
            marginTop: 16,
          }}
        >
          {'时机层：谁来按下开始'}
        </div>
        {/* 下期预告卡：标题只在画面（反串线纪律） */}
        {nextT > 0 ? (
          <div
            style={{
              marginTop: 26,
              padding: '13px 28px',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 12,
              background: theme.panel,
              opacity: nextT,
              transform: `translateY(${(1 - nextT) * 14}px)`,
              display: 'inline-block',
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 2}}>
              {'下期 · 协作层'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.text, marginTop: 5}}>
              {'从一个到一群'}
            </div>
          </div>
        ) : null}
      </div>
      {/* 渐黑遮罩 */}
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-13', 'p6-12a');
  const bC = w('p6-15');
  return (
    <AbsoluteFill>
      <SceneHeader index="P6" title="落点与信源" meta="three answers to who starts" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="6-A 三种开始的位置">
        {/* l1 锚 p6-01（W10 抽帧实拍：原锚 p6-02 使首句 5.3s 全幕只剩抬头，
            收尾句「这一集其实只回答了一个问题：谁来按开始」配真空画面）。
            第一张卡随首句浮出，p6-02 口播「有人按并等着」时它已就位 */}
        <ThreePositions
          l1={at('p6-01') - bA.from}
          l2={at('p6-03') - bA.from}
          l3={at('p6-04') - bA.from}
          layerAt={at('p6-05') - bA.from}
          ringAt={at('p6-06') - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="6-B 免责·金句·四件套">
        {/* p6-13/14 免责前置；p6-07 金句；p6-09..11 边界；p6-12 四件套；p6-12a 钉进循环格 */}
        <ContractAndRecap
          disclaim2At={at('p6-14') - bB.from}
          quoteAt={at('p6-07') - bB.from}
          boundAt={at('p6-09') - bB.from}
          fourAt={at('p6-12') - bB.from}
          pinAt={at('p6-12a') - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="6-C 身份卡与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <IdentityAndFade beatDurationInFrames={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
