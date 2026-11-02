/** P5 核心与外圈（p5-01, p5-04..06, p5-07..08，3 镜）——分镜 5-A…5-C。
 *
 *  ★ 镜界沿 narration 幕内 3 beat：5-A p5-01 / 5-B p5-04..06 / 5-C p5-07..08
 *    （联缀覆盖本幕全部句；无 p5-02/03）。本集零建图（storyboard 建图轮决策），
 *    故本幕无 ArchifyRecap 挂载。
 *  ★ 5-A 金句卡与口播 p5-01 逐字重合是 storyboard 已豁免的刻意复述
 *    （caption-dup-ok：收束定格仪式，同幕回扣豁免先例），照做。
 *  ★ 5-B Visual Lock：手为灰色（theme.dim＝能力受限语义）；命令串以断裂态
 *    呈现（中段断落 + 碎屑飘落，warn＝退化语义），禁显示为可运行成功态；
 *    下期卡只含工具箱剪影，不点机制名、不预告内容。
 *  ★ 5-C 署源卡（尾部署源位，RSI I-080 豁免）：卡面 ≤3 行信息（信源名 /
 *    仓库地址 / MIT 角注）；p5-08 漂移警示由口播承载、卡面零复述；主行 56px
 *    ≥44、次行 28px ≥26（可读阈值）；全片在此卡收束（黑场前最后画面）。
 *  ★ 尾幕渐黑（红线四，实现形态照 claude-code-concurrency P6ReconRules）：窗
 *    取末 beat 总时长（p5-07..p5-08 之和）——其终点即本幕终点，勿改用末句
 *    单句窗（长黑屏教训：useFadeOut 只吃窗尾 36 帧，窗缩短≠起点不变）。
 *  ★ 收尾版式不挂 SceneTag（旧系列 P5/P6 让位收尾版式先例；系列身份由署源
 *    卡收束）。句内词落位一律按句时长比例推导，禁写死帧数。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, type RingNode} from '../components/motifs';
import {DUR, clamp01, useBreathe, useDraw, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** hex + 动态透明度（帧驱动，无随机；effects 通道恒不过冲）。 */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 本集环体五站（P1 五步的同构缩微；labels 恒关——缩微态只读轮廓不读字） */
const EMBLEM_NODES: RingNode[] = [0, 1, 2, 3, 4].map((i) => ({
  label: `station-${i}`,
  angle: -90 + i * 72,
}));

// ── 5-A 环体定格收束 + 金句卡（caption-dup-ok 豁免） ────────────────────

/** 金句关键词：重读排版（字重/字号差）+ 词落位各压一拍（一次性脉冲 + 常驻辉光） */
const KeyWord: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const pop = useImpulse({at, dur: DUR.f6, peak: 0.07});
  const glow = useProgress(at, DUR.f5);
  return (
    <span
      style={{
        fontSize: 68,
        fontWeight: 700,
        color: theme.core,
        display: 'inline-block',
        transform: `scale(${1 + pop})`,
        textShadow: glow > 0.01 ? `0 0 ${22 * glow}px ${withAlpha(theme.core, 0.5)}` : 'none',
      }}
    >
      {children}
    </span>
  );
};

const QuoteShot: React.FC<{at01: number; dur01: number}> = ({at01, dur01}) => {
  // 背景：环体+外圈同构缩微、定格不转（收束态水印；金句卡为唯一主体）
  const ringO = useProgress(at01, DUR.f5);
  const card = useEnter('pop', {at: at01 + 6, dur: DUR.f6});
  // 词落位：p5-01「核心」约 30%、「保险丝」约 78%（句首「一句话收束」铺垫后）
  const coreAt = at01 + Math.round(dur01 * 0.3);
  const fuseAt = at01 + Math.round(dur01 * 0.78);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: ringO * 0.3,
        }}
      >
        <div style={{position: 'relative', width: 720, height: 720}}>
          <LoopRing size={720} nodes={EMBLEM_NODES} dimNodes showExit={false} showLabels={false} />
          {/* 外圈（4-D 保险丝层同构）：像素 dasharray 虚线圆——与环体的 pathLength
              描线分属不同元素（红线三） */}
          <svg
            width={720}
            height={720}
            viewBox="0 0 720 720"
            style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}
          >
            <circle
              cx={360}
              cy={360}
              r={336}
              fill="none"
              stroke={theme.dim}
              strokeWidth={3}
              strokeDasharray="10 12"
              opacity={0.8}
            />
          </svg>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: card.opacity,
          transform: card.transform,
        }}
      >
        <Panel accent={theme.core} style={{padding: '58px 78px'}}>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 54,
              color: theme.text,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
            }}
          >
            <KeyWord at={coreAt}>{'核心'}</KeyWord>
            {'不长大，长大的是'}
            <KeyWord at={fuseAt}>{'保险丝'}</KeyWord>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B bash 单手：灰手 + 两串断裂命令 + 下期卡（工具箱剪影） ────────────

/** 简笔手（stroke-only，灰＝能力受限语义）：掌 + 三道指缝 + 拇指 */
const HAND_GLYPH = (c: string) => (
  <g fill="none" stroke={c} strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M34 62 Q28 26 64 18 Q102 10 136 24 Q162 34 158 62 Q154 92 112 100 Q66 108 42 94 Q32 86 34 62 Z"
      strokeWidth={5}
    />
    <path d="M66 20 Q60 46 65 74 M98 14 Q92 42 97 72 M128 22 Q123 46 127 70" strokeWidth={4} />
    <path d="M34 68 Q10 76 12 94 Q14 108 36 102" strokeWidth={5} />
  </g>
);

/** 工具箱剪影（Visual Lock：只剪影、不点机制名、不预告内容）——开口手提箱 + 两件无名工具出头 */
const TOOLBOX_GLYPH = (c: string) => (
  <g>
    <path d="M30 58 L138 58 L126 100 L42 100 Z" fill={c} />
    <path d="M60 58 Q60 34 84 34 Q108 34 108 58" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
    <g transform="rotate(-16 58 42)">
      <rect x={54} y={26} width={9} height={34} rx={3} fill={c} />
      <circle cx={58.5} cy={21} r={7} fill={c} />
    </g>
    <g transform="rotate(14 108 39)">
      <rect x={104} y={20} width={9} height={40} rx={3} fill={c} />
      <rect x={100} y={10} width={17} height={11} rx={2} fill={c} />
    </g>
  </g>
);

/** 手拼命令串：三段微错位（拼凑感＝非成功可运行态），breakAt 中段断落 + 碎屑飘落 */
const CmdString: React.FC<{
  top: number;
  at: number;
  breakAt: number;
  segs: readonly [string, string, string];
  wobble: readonly [number, number, number];
  midX: number;
}> = ({top, at, breakAt, segs, wobble, midX}) => {
  const frame = useCurrentFrame();
  const inO = useProgress(at, DUR.f5);
  const fall = useProgress(breakAt, 30, 'accelerate');
  const gone = useProgress(breakAt + 6, 24);
  const gap = useProgress(breakAt, DUR.f5);
  // 碎屑（断口处三片、固定偏移错峰——无随机）：纯函数进度，不进 hook
  const bits = [0, 1, 2].map((i) => {
    const p = clamp01((frame - (breakAt + 4 + i * 3)) / 26);
    const e = p * p;
    return {dx: midX + 6 + i * 24 + e * (12 - i * 5), dy: 8 + e * (112 + i * 28), o: 1 - p, s: 6 - i};
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 872,
        top,
        opacity: inO,
        fontFamily: theme.mono,
        fontSize: 30,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{display: 'inline-block', transform: `translate(${-gap * 10}px, ${wobble[0]}px)`}}>
        {segs[0]}
      </span>
      <span
        style={{
          display: 'inline-block',
          color: fall > 0 ? theme.warn : theme.text,
          transform: `translate(${gap * 10}px, ${wobble[1] + fall * 170}px) rotate(${fall * -24}deg)`,
          opacity: 1 - gone,
        }}
      >
        {segs[1]}
      </span>
      <span style={{display: 'inline-block', transform: `translate(${gap * 10}px, ${wobble[2]}px)`}}>
        {segs[2]}
      </span>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: b.dx,
            top: b.dy,
            width: b.s,
            height: b.s,
            borderRadius: 1,
            background: theme.warn,
            opacity: b.o * 0.9,
            transform: `rotate(${b.o * 40}deg)`,
          }}
        />
      ))}
    </div>
  );
};

/** 下期卡（p5-06「下期」词落位浮起；措辞只「下期」，剪影零预告） */
const NextCard: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f6, dist: 22});
  const bob = useBreathe({period: 110, amp: 3, base: 0, offset: at});
  return (
    <div
      style={{
        position: 'absolute',
        left: 1508,
        top: 336,
        opacity: e.opacity,
        transform: `${e.transform} translateY(${bob}px)`,
      }}
    >
      <Panel
        accent={withAlpha(theme.core, 0.5)}
        style={{width: 264, boxSizing: 'border-box', padding: '24px 26px 20px', textAlign: 'center'}}
      >
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 32,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 12,
            paddingLeft: 12,
          }}
        >
          {'下期'}
        </div>
        <svg width={168} height={112} viewBox="0 0 168 112" style={{marginTop: 14}}>
          {TOOLBOX_GLYPH(withAlpha(theme.core, 0.92))}
        </svg>
      </Panel>
    </div>
  );
};

const BashHand: React.FC<{
  at04: number;
  dur04: number;
  at05: number;
  dur05: number;
  at06: number;
  dur06: number;
}> = ({at04, dur04, at05, dur05, at06, dur06}) => {
  const ringO = useProgress(at04, DUR.f5);
  // 环体伸臂（「回到这双手」约 22%）→ 手落位（约 34%）→ bash 家什（「bash」约 66%）
  const arm = useDraw(at04 + Math.round(dur04 * 0.22), DUR.f6);
  const hand = useEnter('rise', {at: at04 + Math.round(dur04 * 0.34), dur: DUR.f5, dist: 20});
  const bash = useEnter('pop', {at: at04 + Math.round(dur04 * 0.66), dur: DUR.f5});
  // p5-05：读命令约 12% / 找命令约 44% / 「又丑又容易错」约 74% 起各断一截
  const strAAt = at05 + Math.round(dur05 * 0.12);
  const strBAt = at05 + Math.round(dur05 * 0.44);
  const breakA = at05 + Math.round(dur05 * 0.74);
  const breakB = breakA + DUR.f3;
  // p5-06：「下期」为首词，约 12% 落位
  const nextAt = at06 + Math.round(dur06 * 0.12);
  return (
    <AbsoluteFill>
      {/* 环体（M-001 主角侧位，五站缩微、labels 关） */}
      <div style={{position: 'absolute', left: 130, top: 330, opacity: ringO}}>
        <LoopRing size={250} nodes={EMBLEM_NODES} showExit={false} />
      </div>
      {/* 灰臂：自环缘伸向手（pathLength 归一化描线，红线三） */}
      <svg width={340} height={200} viewBox="0 0 340 200" style={{position: 'absolute', left: 316, top: 412, overflow: 'visible'}}>
        <path
          d="M12 44 C 120 8, 230 64, 326 168"
          fill="none"
          stroke={theme.dim}
          strokeWidth={15}
          strokeLinecap="round"
          {...arm}
        />
      </svg>
      {/* 灰手（能力受限语义） */}
      <svg width={170} height={150} viewBox="0 0 170 150" style={{position: 'absolute', left: 600, top: 545, opacity: hand.opacity, transform: hand.transform}}>
        {HAND_GLYPH(theme.dim)}
      </svg>
      {/* 手里仅 bash 一件家什（工具语义＝tool 色，$ 提示符走 core 同 Terminal 惯例） */}
      <div style={{position: 'absolute', left: 634, top: 460, opacity: bash.opacity, transform: bash.transform}}>
        <Panel accent={withAlpha(theme.tool, 0.75)} style={{padding: '10px 20px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 28, whiteSpace: 'nowrap'}}>
            <span style={{color: theme.core}}>{'$ '}</span>
            <span style={{color: theme.text}}>{'bash'}</span>
          </span>
        </Panel>
      </div>
      {/* 两串手拼命令（读文件 / 找文件），「又丑又容易错」处各断一截、碎屑飘落 */}
      <CmdString
        top={356}
        at={strAAt}
        breakAt={breakA}
        segs={['cat ', './notes/', 'plan.md']}
        wobble={[1, -3, 2]}
        midX={72}
      />
      <CmdString
        top={476}
        at={strBAt}
        breakAt={breakB}
        segs={['find . ', '-name ', '"*.md"']}
        wobble={[-2, 3, -1]}
        midX={126}
      />
      <NextCard at={nextAt} />
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ────────────────────────

const CreditCard: React.FC<{at07: number; dur07: number}> = ({at07, dur07}) => {
  // 卡随 p5-07 口播同拍淡入；两行先后落定（课程名约 56% 被念到，次行隔 DUR.f6 跟落）
  const card = useEnter('rise', {at: at07 + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = at07 + Math.round(dur07 * 0.56);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel
        accent={withAlpha(theme.core, 0.4)}
        style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}
      >
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：挂在 5-C Sequence 最后子节点，盖过署源卡；
 *  useFadeOut 在本 Sequence 语境取 5-C 局部帧，窗=末 beat 总时长
 *  （p5-07..p5-08 之和）——终点即本幕终点，勿改用末句单句窗。 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5CoreAndRim: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  // 镜界（narration 幕内 3 beat，联缀覆盖本幕全部句）
  const bA = w('p5-01');
  const bB = w('p5-04', 'p5-06');
  const bC = w('p5-07', 'p5-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <QuoteShot at01={at('p5-01') - bA.from} dur01={dur('p5-01')} />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <BashHand
          at04={at('p5-04') - bB.from}
          dur04={dur('p5-04')}
          at05={at('p5-05') - bB.from}
          dur05={dur('p5-05')}
          at06={at('p5-06') - bB.from}
          dur06={dur('p5-06')}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <CreditCard at07={at('p5-07') - bC.from} dur07={dur('p5-07')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5CoreAndRim;
