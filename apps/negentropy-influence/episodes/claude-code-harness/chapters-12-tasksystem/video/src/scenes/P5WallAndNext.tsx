/** P5 收束与下期（p5-01..p5-06，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  叙事链：5-A 任务墙定格收束（EWS）：全片任务墙同形定格为背景暗层（空墙→
 *  挂卡→连线→翻绿全生命周期在墙面暗纹里微光扫过一遍 0.5s 回放）＋金句卡
 *  （衬线体）「出内存 · 入文件」两短语各压一拍重读 → 5-B 地基承重：墙体上
 *  方浮起组队与协商的剪影群（协同姿态小人剪影——群像不显机制细节）全立于
 *  墙面＋承重接触线自左向右点亮＋墙体在剪影重量下纹丝不动（承重即胜任）→
 *  5-C 下期卡（视觉层）：暗场中环体〔M-001〕同形回归（描边/线宽承全片锚定）
 *  转动——一条慢命令进度条压上环体，进度爬到中段卡住不动、环体转速衰减至
 *  停（转动停滞＝问题态非休止态）＋「下期」签点亮定格（只点问题不预告机制）
 *  → 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免）：主行 Learn Claude Code /
 *  次行仓库地址 / 角注 MIT——p5-05 同拍淡入两行先后落定、p5-06 静持（漂移
 *  警示由口播承载，卡面零复述），全片在此卡收束。
 *
 *  空间契约：金句卡为唯一主体、衬线体、墙为背景暗层不抢焦；剪影为群像不
 *    做任何具体协作动作、承重线只在接触面、墙体零形变（不下沉不裂缝）；
 *    环体同形同色（系列锚）、进度条卡在中段非起点、停滞=问题态；署源卡为
 *    最后画面、卡面 ≤3 行信息、字号不低于可读阈值。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位——⑧ 轮按句内字位复核一轮通过，
 *    词级实测复核留 ⑨ 轮 QA；登记口径见 P0 头注）；y≥56 / bottom≥176；尾幕渐黑（红线四）
 *    窗取末 beat 总时长（p5-05..p5-06 之和）——终点即本幕终点；收尾版式不挂
 *    SceneTag（承 ep1–ep11 先例）。
 *
 *  承接登记：4-D→5-A SceneFade＋全景重锚（storyboard 登记）——任务墙以同形
 *    签名回归（镜间身份恒常，承 ep2 4-D→5-A 判例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, TaskWall, WALL, WallCard, WALL_SLOTS} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 墙体定格收束：生命周期微光回放 + 金句卡「出内存 · 入文件」 ─────────

const FiveA: React.FC<{atQuote: number; atLife: number; atK1: number; atK2: number}> = ({atQuote, atLife, atK1, atK2}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入定格（收束仪式）
  const quote = useProgress(atQuote, DUR.f5);
  // 墙面生命周期微光扫过一遍（空墙→挂卡→连线→翻绿四态 0.5s≈15f 回放：
  // 扫光带自左向右扫过墙面暗层，扫过处四枚状态小章依次闪现）
  const lifeT = clamp01(progress(frame, atLife, 15));
  const sweepX = WALL.x + WALL.w * lifeT;
  const stages = ['空墙', '挂卡', '连线', '翻绿'];
  const stagePs = stages.map((_, i) => Math.sin(Math.PI * clamp01(progress(frame, atLife + i * 3.4, 12))));
  // 两短语各压一拍重读（scale + 辉光——mech/unlock 双主题色）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1G = clamp01(progress(frame, atK1, DUR.f5));
  const k2G = clamp01(progress(frame, atK2, DUR.f5));
  return (
    <AbsoluteFill>
      {/* 任务墙背景暗层（定格收束——全片同形；不抢焦） */}
      <div style={{position: 'absolute', left: WALL.x, top: WALL.y, opacity: 0.22}}>
        <TaskWall litP={1} slotsP={1} glowP={0.3} />
        <WallCard x={WALL_SLOTS[0].x} y={WALL_SLOTS[0].y} title="写初稿" id="task_001" state="done" greenP={1} signP={1} signer="写手 · 甲" />
        <WallCard x={WALL_SLOTS[1].x} y={WALL_SLOTS[1].y} title="排版" id="task_003" state="done" greenP={1} signP={1} signer="写手 · 乙" />
        <WallCard x={WALL_SLOTS[2].x} y={WALL_SLOTS[2].y} title="发布" id="task_004" state="done" greenP={1} signP={1} signer="写手 · 甲" />
        <WallCard x={WALL_SLOTS[3].x} y={WALL_SLOTS[3].y} title="配图" id="task_002" state="done" greenP={1} signP={1} signer="写手 · 乙" />
      </div>
      {/* 生命周期扫光带（自左向右一过——四态回放的载体） */}
      {lifeT > 0.02 && lifeT < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: sweepX,
            top: WALL.y + 30,
            width: 130,
            height: WALL.h - 60,
            background: `linear-gradient(90deg, transparent, ${withAlpha(theme.mech, 0.16)}, transparent)`,
            opacity: Math.sin(Math.PI * lifeT),
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 四态小章（扫过处依次闪现——空墙/挂卡/连线/翻绿） */}
      {stages.map((s, i) => {
        const p = stagePs[i];
        if (p <= 0.03) return null;
        return (
          <div
            key={s}
            style={{
              position: 'absolute',
              left: WALL.x + 250 + i * 260,
              top: WALL.y + WALL.h - 6,
              padding: '4px 16px',
              borderRadius: 8,
              border: `2px solid ${i === 3 ? withAlpha(theme.ok, 0.75) : withAlpha(theme.dim, 0.7)}`,
              background: withAlpha(theme.panel, 0.85),
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 700,
              color: i === 3 ? theme.ok : theme.dim,
              whiteSpace: 'nowrap',
              opacity: p * 0.85,
            }}
          >
            {s}
          </div>
        );
      })}
      {/* 金句卡（衬线体居中——两短语各压一拍重读） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <div style={{opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
            <Panel accent={theme.mech} style={{padding: '24px 60px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 52, color: theme.text, whiteSpace: 'nowrap'}}>
                {/* caption-dup-ok: 金句卡为压缩签（出内存 · 入文件），与口播整句
                    非逐字重合——收束定格仪式，承 ep1–ep11 5-A 豁免先例（storyboard 前言明文） */}
                <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + 0.05 * k1})`, textShadow: k1G > 0.01 ? `0 0 ${22 * k1G}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>{'出内存'}</span>
                <span>{' · '}</span>
                <span style={{fontWeight: 700, color: theme.unlock, display: 'inline-block', transform: `scale(${1 + 0.05 * k2})`, textShadow: k2G > 0.01 ? `0 0 ${22 * k2G}px ${withAlpha(theme.unlock, 0.5)}` : 'none'}}>{'入文件'}</span>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'.tasks/ · 重启不丢 · 人人可看'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 地基承重：剪影群立于墙面 + 承重接触线点亮 + 墙体零形变 ─────────────

/** 协同姿态小人剪影（SVG 直陈——群像不显机制细节、不做协作动作） */
const Silhouette: React.FC<{kind: 0 | 1 | 2; x: number; y: number; op: number}> = ({kind, x, y, op}) => (
  <svg width={120} height={130} viewBox="0 0 120 130" style={{position: 'absolute', left: x, top: y, opacity: op, overflow: 'visible'}}>
    <g fill={withAlpha(theme.dim, 0.72)}>
      {/* 头 */}
      <circle cx={60} cy={26} r={15} />
      {/* 躯干（三型：并肩 / 对坐A / 对坐B——静态站姿/坐姿，无动作） */}
      {kind === 0 ? <path d="M 44 44 L 76 44 L 80 96 L 66 96 L 62 62 L 58 62 L 54 96 L 40 96 Z" /> : null}
      {kind === 1 ? <path d="M 46 44 L 74 44 L 78 84 L 64 84 L 62 60 L 58 60 L 56 84 L 42 84 Z" /> : null}
      {kind === 2 ? <path d="M 46 44 L 74 44 L 78 82 L 62 82 L 60 58 L 56 58 L 54 82 L 40 82 Z" /> : null}
      {/* 坐姿剪影的座面（对坐型——协商姿态的静置物） */}
      {kind > 0 ? <rect x={30} y={80} width={60} height={9} rx={3} opacity={0.8} /> : null}
    </g>
  </svg>
);

const FiveB: React.FC<{atSil: number[]; atLine: number}> = ({atSil, atLine}) => {
  const frame = useCurrentFrame();
  // 剪影群 stagger 立上墙面（组队与协商的群像——三组）
  const sils = atSil.map((a) => clamp01(progress(frame, a, 20)));
  // 承重接触线自左向右点亮（只在接触面——墙顶沿下）
  const line = clamp01(progress(frame, atLine, 24));
  return (
    <AbsoluteFill>
      {/* 任务墙（全幅——承重物；纹丝不动） */}
      <div style={{position: 'absolute', left: WALL.x, top: WALL.y + 96}}>
        <TaskWall litP={1} slotsP={0.7} glowP={0.25} />
      </div>
      {/* 剪影群（墙顶上方——三组协同姿态全立于墙面） */}
      <Silhouette kind={0} x={520} y={86} op={sils[0]} />
      <Silhouette kind={1} x={770} y={106} op={sils[1]} />
      <Silhouette kind={2} x={1000} y={106} op={sils[2]} />
      <Silhouette kind={0} x={1210} y={86} op={sils[2]} />
      {/* 承重接触线（墙顶沿下——自左向右点亮；墙体零形变的对照锚） */}
      <svg width={WALL.w} height={14} viewBox={`0 0 ${WALL.w} 14`} style={{position: 'absolute', left: WALL.x, top: WALL.y + 92}}>
        <line x1={0} y1={7} x2={WALL.w * line} y2={7} stroke={theme.text} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        {line >= 0.99 ? <circle cx={WALL.w} cy={7} r={6} fill={theme.text} opacity={0.8} /> : null}
      </svg>
      {/* 墙上内容（暗层——收束态墙挂着完成卡） */}
      <div style={{position: 'absolute', left: WALL.x, top: WALL.y + 96, opacity: 0.3}}>
        <WallCard x={WALL_SLOTS[0].x} y={WALL_SLOTS[0].y} title="写初稿" id="task_001" state="done" greenP={1} signP={1} signer="写手 · 甲" />
        <WallCard x={WALL_SLOTS[1].x} y={WALL_SLOTS[1].y} title="排版" id="task_003" state="done" greenP={1} signP={1} signer="写手 · 乙" />
        <WallCard x={WALL_SLOTS[2].x} y={WALL_SLOTS[2].y} title="发布" id="task_004" state="done" greenP={1} signP={1} signer="写手 · 甲" />
        <WallCard x={WALL_SLOTS[3].x} y={WALL_SLOTS[3].y} title="配图" id="task_002" state="done" greenP={1} signP={1} signer="写手 · 乙" />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'组队 · 协商 · 全踩这堵墙'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡：环体回归 + 慢命令进度条卡在中段 + 转速衰减至停 ──────────────

const RING_5C = {x: 740, y: 150, size: 440} as const;
const BAR_5C = {x: 660, y: 646, w: 600} as const;

const FiveC: React.FC<{atBar: number; atStall: number; atNext: number}> = ({atBar, atStall, atNext}) => {
  const frame = useCurrentFrame();
  // 进度条爬行到中段卡住（55%——不走完：那不是问题）
  const barRun = clamp01(progress(frame, atBar, 34));
  const bar = Math.min(0.55, barRun * 0.62);
  // 环体转速衰减至停（匀速 → 减速 0.35 圈 → 冻结——转动停滞=问题态非休止态）
  const t1 = Math.min(frame, atStall) / 95;
  const t2 = frame > atStall ? ((1 - Math.cos(Math.PI * Math.min(1, (frame - atStall) / 26))) / 2) * 0.35 : 0;
  const dotPos = (t1 + t2) % 1;
  // 「下期」签点亮定格
  const next = clamp01(progress(frame, atNext, DUR.f5));
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕同形回归（描边/线宽承全片锚定——暗场居中） */}
      <div style={{position: 'absolute', left: RING_5C.x, top: RING_5C.y}}>
        <LoopRing size={RING_5C.size} nodes={[]} showExit={false} dotProgress={dotPos} />
      </div>
      {/* 慢命令进度条（压上环体下方——爬到中段卡住不动） */}
      <div style={{position: 'absolute', left: BAR_5C.x, top: BAR_5C.y, width: BAR_5C.w, opacity: clamp01(progress(frame, atBar - 4, DUR.f4))}}>
        <div style={{position: 'relative', height: 40, borderRadius: 8, border: `3px solid ${withAlpha(theme.core, 0.7)}`, background: withAlpha(theme.panel, 0.92)}}>
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bar * 100}%`, borderRadius: 5, background: withAlpha(theme.core, 0.4)}} />
          {/* 停滞位刻度（中段——问题态的锚） */}
          <div style={{position: 'absolute', left: '55%', top: -8, bottom: -8, borderLeft: `3px dashed ${withAlpha(theme.dim, 0.8)}`}} />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
          <span>{'慢命令'}</span>
          <span style={{color: bar >= 0.55 ? theme.text : theme.dim, fontWeight: bar >= 0.55 ? 700 : 400}}>{bar >= 0.55 ? '卡住' : '运行'}</span>
        </div>
      </div>
      {/* 「下期」签（旁缀——只点问题不预告机制） */}
      {next > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', opacity: next, transform: `translateY(${(1 - next) * 18}px)`}}>
          <Panel accent={theme.core} style={{padding: '16px 50px', textAlign: 'center'}}>
            <div style={{fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: theme.text, letterSpacing: 12, paddingLeft: 12, whiteSpace: 'nowrap'}}>{'下期'}</div>
            <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>{'从一条卡住的慢命令说起'}</div>
          </Panel>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'慢命令 · 停在原地干等'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免） ──────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-05 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.3);
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
      <Panel accent={withAlpha(theme.mech, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-05..p5-06 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5WallAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01');
  const bB = w('p5-02');
  const bC = w('p5-03', 'p5-04');
  const bD = w('p5-05', 'p5-06');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA atQuote={wa('p5-01', 0.12) - bA.from} atLife={wa('p5-01', 0.3) - bA.from} atK1={wa('p5-01', 0.45) - bA.from} atK2={wa('p5-01', 0.58) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB atSil={[0.25, 0.36, 0.5].map((f) => wa('p5-02', f) - bB.from)} atLine={wa('p5-02', 0.66) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC atBar={wa('p5-03', 0.36) - bC.from} atStall={wa('p5-03', 0.68) - bC.from} atNext={wa('p5-04', 0.12) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-05') - bD.from} durCard={span('p5-05')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5WallAndNext;
