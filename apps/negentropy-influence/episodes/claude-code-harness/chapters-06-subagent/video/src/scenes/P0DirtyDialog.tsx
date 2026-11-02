/** P0 越干越脏的对话（p0-01..p0-07，2 镜）——分镜 0-A / 0-B。
 *
 *  叙事链：系列片头交棒后冷启动直入（开篇视听合力 I-039）——主对话消息面板
 *  占屏居中（全片「主会场」世界坐标首亮）：钢蓝消息条一屏屏刷过堆高〔M-005〕、
 *  早期目标卡驻列顶被不断上挤、面板角计数器三跳（三十文件 → 六十轮 → 一百二十
 *  条）→ p0-03 大半消息条集体降饱和变暗、「占位」仍占满面板高度（暗而占位=
 *  痛点具象〔M-003〕）→ 0-B 聊天群既视感（类比 A#1）：刷屏提速、旧「约定」
 *  气泡下沉变暗；「翻回去」人手小图标侧滑一拍 vs 模型侧静置无动作（A#1 失配
 *  对照）；「更强模型」拨杆拨动一次——刷屏速度分毫不变（无效帧对照定格半拍）、
 *  模型侧视野圈内空无一物；「出路」分流闸落下、脏消息条改道滑出面板外。
 *
 *  空间契约：面板单主体居中、目标卡全程可见（压顶≠删除）、署源角标右下恒定
 *  不抢焦（首部署源位）；拨杆仅一枚；无效帧前后刷屏速度逐帧一致（速度函数
 *  与拨杆状态零耦合——无效性的可核对判据）；约定气泡在场不下沉出屏。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；计数读数单位全汉字旁标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {MsgStrip, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep5 SourceCredit 形态） */
const SourceCredit: React.FC = () => {
  const o = useProgress(0, DUR.f5);
  return (
    <div
      style={{
        position: 'absolute',
        right: 72,
        bottom: 168,
        fontFamily: theme.mono,
        fontSize: 22,
        letterSpacing: 1,
        color: theme.dim,
        opacity: 0.85 * o,
      }}
    >
      Learn Claude Code
    </div>
  );
};

/** 主对话面板几何（0-A 满幅 / 0-B 居中同位）——全片主会场世界坐标锚 */
const PANEL = {x: 560, y: 150, w: 800, h: 640} as const;

/** 刷屏消息条文案（确定性循环——新压旧） */
const STREAM = ['读文件 27', '改文件', '跑测试', '读文件 28', '修测试', '再修', '读文件 29', 'grep 结果', '轮转 41', '读文件 30', '又修', '轮转 42'] as const;

/** 刷屏位移积分（基速→提速一次性 ramp 的闭式积分——纯函数帧算，速度函数与
 *  拨杆/开关状态零耦合：无效帧前后逐帧一致的红线由此构造性保证） */
const rampScroll = (frame: number, at: number, base: number, top: number, T = DUR.f6): number => {
  const t = Math.max(0, frame - at);
  const k = top - base;
  const s = t < T ? base * t + (k * t * t) / (2 * T) : base * t + k * (T / 2 + (t - T));
  return base * Math.min(frame, at) + s;
};

/** 滚动消息流（无限输送带——scroll 随帧推进，速度由调用方注入使其与拨杆零耦合） */
const StreamColumn: React.FC<{x: number; top: number; w: number; step: number; scroll: number; dimAll: number; ghostBase: number}> = ({
  x,
  top,
  w,
  step,
  scroll,
  dimAll,
  ghostBase,
}) => {
  const n = STREAM.length;
  return (
    <div style={{position: 'absolute', left: x, top, width: w, height: 1080, overflow: 'hidden'}}>
      {Array.from({length: n * 2}, (_, i) => {
        const rawY = i * step - (scroll % (n * step));
        const y = rawY < -step ? rawY + n * step : rawY;
        const label = STREAM[i % n];
        // 旧条（列上方）灰化渐深——越压越脏的层积
        const depth = clamp01((y - 0) / (n * step));
        return (
          <div key={i} style={{position: 'absolute', left: 0, top: y}}>
            <MsgStrip
              x={0}
              y={0}
              w={w}
              h={46}
              label={label}
              sub={i % 3 === 0 ? 'tool' : 'turn'}
              color={theme.steel}
              lit={1}
              ghost={Math.max(ghostBase, depth * 0.55 + dimAll * 0.5)}
            />
          </div>
        );
      })}
    </div>
  );
};

// ── 0-A 冷启动：消息瀑布堆高 + 计数器三跳 + 暗而占位 ────────────────────

const ZeroA: React.FC<{atBoost: number; atFiles: number; atRounds: number; atMsgs: number; atDim: number; atHold: number}> = ({
  atBoost,
  atFiles,
  atRounds,
  atMsgs,
  atDim,
  atHold,
}) => {
  const frame = useCurrentFrame();
  // 「越干越脏」词落位：刷屏加速（基线 1.1px/f → 3.0px/f，一次性 ramp）
  const scroll = rampScroll(frame, atBoost, 1.1, 3.0);
  // 计数器三跳：读文件 ×30 → 轮次 ×60 → 消息条 120（读数步进取整、单位汉字旁标）
  const c1 = clamp01(progress(frame, atFiles, DUR.f4));
  const c2 = clamp01(progress(frame, atRounds, DUR.f4));
  const c3 = clamp01(progress(frame, atMsgs, DUR.f5));
  const reading = Math.round(30 * c1 + 30 * c2 + 60 * c3);
  const unit = c3 > 0.05 ? '条消息' : c2 > 0.05 ? '轮对话' : '份文件';
  // p0-03 大半消息条集体降饱和变暗；「占位」暗条仍占满面板高度
  const dimAll = useProgress(atDim, DUR.f5);
  const holdPress = useProgress(atHold, DUR.f4);
  // 目标卡驻列顶被上挤（压顶≠删除——挤到面板顶缘挂起、渐暗）
  const squeeze = clamp01(c1 * 0.4 + c2 * 0.35 + c3 * 0.25);
  const goalY = 96 - 54 * squeeze;
  const goalGhost = 0.2 + 0.6 * squeeze;
  return (
    <AbsoluteFill>
      {/* 主对话消息面板（钢蓝——主会场世界坐标首亮） */}
      <div style={{position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h}}>
        <Panel accent={theme.steel} style={{width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden'}}>
          <div style={{padding: '14px 20px 8px', fontFamily: theme.mono, fontSize: 17, color: theme.steel}}>{'主对话 · messages'}</div>
          {/* 目标卡（列顶——被不断上挤） */}
          <div style={{position: 'absolute', left: 20, top: goalY, width: PANEL.w - 40, opacity: 1 - 0.25 * squeeze, zIndex: 2}}>
            <MsgStrip x={0} y={0} w={PANEL.w - 40} h={52} label={'最初的目标'} sub={'goal'} color={theme.text} lit={1} ghost={goalGhost} />
          </div>
          {/* 滚动消息流（暗而占位——降饱和后仍占满面板高度） */}
          <div style={{position: 'absolute', left: 20, top: 96, width: PANEL.w - 40, height: PANEL.h - 130}}>
            <StreamColumn x={0} top={-40} w={PANEL.w - 40} step={58} scroll={scroll} dimAll={dimAll} ghostBase={0.1} />
          </div>
          {/* 面板角计数器（三跳读数 + 单位旁标；基线小签恒常驻） */}
          <div
            style={{
              position: 'absolute',
              right: 18,
              top: 44,
              textAlign: 'right',
              padding: '8px 16px',
              borderRadius: 9,
              border: `2.5px solid ${reading > 0 ? theme.steel : theme.panelBorder}`,
              background: withAlpha(theme.panel, 0.9),
              zIndex: 3,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05}}>
              {String(reading)}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{unit}</div>
          </div>
          {/* 读文件图标流 ×30（第一跳的可视面——文件小签一行流过） */}
          {c1 > 0.01 && c3 < 0.9 ? (
            <div style={{position: 'absolute', left: 20, bottom: 92, display: 'flex', gap: 8, opacity: clamp01(c1 * (1 - c3))}}>
              {Array.from({length: 8}, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: 42,
                    boxSizing: 'border-box',
                    borderRadius: 6,
                    border: `2px solid ${withAlpha(theme.dim, 0.6)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: theme.mono,
                    fontSize: 12,
                    color: theme.dim,
                    opacity: clamp01(c1 * 8 - i) * 0.9 + 0.1,
                  }}
                >
                  {`.py`}
                </div>
              ))}
              <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 6, whiteSpace: 'nowrap'}}>{'×30'}</span>
            </div>
          ) : null}
          {/* 轮次格 ×60（第二跳的可视面） */}
          {c2 > 0.01 ? (
            <div style={{position: 'absolute', left: 20, bottom: 44, display: 'flex', gap: 5, opacity: clamp01(c2 * (1 - c3))}}>
              {Array.from({length: 15}, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 24,
                    height: 26,
                    borderRadius: 5,
                    border: `2px solid ${withAlpha(theme.steel, 0.55)}`,
                    background: withAlpha(theme.steel, 0.1),
                    opacity: clamp01(c2 * 15 - i) * 0.85 + 0.15,
                  }}
                />
              ))}
              <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 6, whiteSpace: 'nowrap'}}>{'×60 轮'}</span>
            </div>
          ) : null}
        </Panel>
      </div>
      {/* 「占位」压暗定格强调（暗而占位——半拍收束脉冲，不改条形） */}
      <div
        style={{
          position: 'absolute',
          left: PANEL.x,
          top: PANEL.y,
          width: PANEL.w,
          height: PANEL.h,
          borderRadius: 14,
          border: `2.5px solid ${withAlpha(theme.dim, 0.5 * holdPress)}`,
          pointerEvents: 'none',
          opacity: holdPress,
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7 * dimAll}}>
        {'暗而占位 · 高度不减'}
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 0-B 聊天群既视感 + 换模型无效 + 分流闸出路 ───────────────────────────

const ZeroB: React.FC<{atRush: number; atHand: number; atToggle: number; atEmpty: number; atGate: number; atDivert: number}> = ({
  atRush,
  atHand,
  atToggle,
  atEmpty,
  atGate,
  atDivert,
}) => {
  const frame = useCurrentFrame();
  // 刷屏提速一次（p0-04「刷屏」）；此后速度恒定——拨杆状态不进速度函数（红线）
  const scroll = rampScroll(frame, atRush, 2.6, 5.0);
  // 旧「约定」气泡不断下沉变暗（在场不下沉出屏——记录还在）
  const sink = useProgress(atRush, DUR.f6, 'decelerate');
  const pactY = 96 + 120 * sink;
  // 人手小图标侧滑回翻一拍（人做得到——模型侧无人手即对照）
  const hand = useProgress(atHand, DUR.f5, 'decelerate');
  const handOut = useProgress(atHand + DUR.f6, DUR.f4, 'accelerate');
  // 「更强模型」拨杆：拨动一次（flick 半拍）——刷屏速度分毫不变
  const flick = useProgress(atToggle, DUR.f4, 'accelerate');
  // 无效帧对照定格半拍（对照签显形——速度不变的可核对提示）
  const noEffect = useImpulse({at: atToggle + DUR.f5, dur: DUR.f6, peak: 1});
  // 「信息不在场」视野圈亮起——圈内空无一物
  const emptyVision = useProgress(atEmpty, DUR.f5);
  // 「出路」分流闸落下 + 脏消息条改道滑出面板外（右下出口——1-A 新会议室同侧呼应）
  const gate = useProgress(atGate, DUR.f5, 'decelerate');
  const divert = useProgress(atDivert, DUR.f6, 'accelerate');
  const MODEL = {x: 1480, y: 300} as const;
  return (
    <AbsoluteFill>
      {/* 主面板（同位居中——聊天群既视感） */}
      <div style={{position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h}}>
        <Panel accent={theme.steel} style={{width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden'}}>
          <div style={{padding: '14px 20px 8px', fontFamily: theme.mono, fontSize: 17, color: theme.steel}}>{'主对话 · messages'}</div>
          {/* 旧「约定」气泡（下沉变暗——记录还在） */}
          <div style={{position: 'absolute', left: 20, top: pactY, width: PANEL.w - 40, zIndex: 2}}>
            <MsgStrip x={0} y={0} w={PANEL.w - 40} h={52} label={'开头的约定'} sub={'pinned'} color={theme.text} lit={1} ghost={0.25 + 0.5 * sink} />
          </div>
          {/* 刷屏流（改道：divert 后新条斜出面板右下——脏活不再进对话） */}
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 240,
              width: PANEL.w - 40,
              height: PANEL.h - 320,
              transform: `translate(${260 * divert}px, ${140 * divert}px) rotate(${14 * divert}deg)`,
              opacity: 1 - 0.35 * divert,
            }}
          >
            <StreamColumn x={0} top={-40} w={PANEL.w - 40} step={58} scroll={scroll} dimAll={0.15} ghostBase={0.15} />
          </div>
          {/* 人手小图标（侧滑回翻一拍——翻回去是人的动作） */}
          {hand > 0.01 && handOut < 0.99 ? (
            <div
              style={{
                position: 'absolute',
                left: PANEL.w - 200 - 120 * (1 - hand) + 160 * handOut,
                top: pactY + 26,
                opacity: hand * (1 - handOut),
              }}
            >
              <svg width={54} height={62} viewBox="0 0 54 62" style={{overflow: 'visible'}}>
                <path
                  d="M 20 58 L 20 34 Q 20 28 25 28 Q 30 28 30 34 L 30 24 Q 30 18 35 18 Q 40 18 40 24 L 40 20 Q 40 14 45 14 Q 50 14 50 20 L 50 38 Q 50 52 38 58 Z"
                  fill={theme.panel}
                  stroke={theme.dim}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}
          {/* 分流闸（面板底部入口位——出路落下的一道闸） */}
          <div style={{position: 'absolute', left: PANEL.w - 300, bottom: 64, opacity: gate}}>
            <div style={{position: 'relative', width: 220, height: 96}}>
              {/* 闸体斜板 */}
              <svg width={220} height={96} viewBox="0 0 220 96" style={{overflow: 'visible'}}>
                <line x1={10} y1={16 - 60 * (1 - gate)} x2={210} y2={76 - 60 * (1 - gate)} stroke={theme.ok} strokeWidth={5} strokeLinecap="round" />
                <circle cx={210} cy={76 - 60 * (1 - gate)} r={6} fill={theme.ok} />
                <text x={110} y={44} textAnchor="middle" fontFamily={theme.mono} fontSize={13} fill={theme.ok} opacity={gate}>
                  {'分流口'}
                </text>
              </svg>
            </div>
          </div>
        </Panel>
      </div>
      {/* 模型侧（旁侧——更强模型拨杆 + 静置无动作 + 空视野圈） */}
      <div style={{position: 'absolute', left: MODEL.x, top: MODEL.y, width: 340}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginBottom: 12}}>{'model'}</div>
        {/* 模型方块（静置无动作——无手、无翻页） */}
        <div
          style={{
            width: 150,
            height: 110,
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'模型'}
        </div>
        {/* 视野圈（「信息不在场」——圈内空无一物） */}
        {emptyVision > 0.01 ? (
          <svg width={210} height={210} style={{position: 'absolute', left: 170, top: -30, overflow: 'visible', opacity: emptyVision}}>
            <circle cx={105} cy={105} r={86} fill="none" stroke={withAlpha(theme.dim, 0.75)} strokeWidth={3} strokeDasharray="12 10" />
            <text x={105} y={112} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
              {'∅'}
            </text>
          </svg>
        ) : null}
        {/* 「更强模型」拨杆开关（仅此一枚——拨动后速度分毫不变） */}
        <div style={{position: 'relative', width: 300, marginTop: 42}}>
          <div
            style={{
              width: 300,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
              background: theme.panel,
              padding: '10px 14px',
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginBottom: 8}}>{'更强模型'}</div>
            <div style={{position: 'relative', height: 34, borderRadius: 17, background: withAlpha(theme.panelBorder, 0.6)}}>
              <div
                style={{
                  position: 'absolute',
                  left: 4 + 224 * flick,
                  top: 3,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: flick > 0.5 ? theme.core : theme.dim,
                }}
              />
            </div>
          </div>
          {/* 无效帧对照签（定格半拍——前后逐帧一致的可核对提示） */}
          {noEffect > 0.05 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: -44,
                padding: '5px 12px',
                borderRadius: 7,
                border: `2px solid ${withAlpha(theme.dim, 0.8)}`,
                fontFamily: theme.mono,
                fontSize: 14,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: noEffect,
              }}
            >
              {'速度 · 分毫不变'}
            </div>
          ) : null}
        </div>
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0DirtyDialog: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atBoost={wa('p0-01', 0.2) - bA.from}
          atFiles={wa('p0-02', 0.4) - bA.from}
          atRounds={wa('p0-02', 0.58) - bA.from}
          atMsgs={wa('p0-02', 0.8) - bA.from}
          atDim={wa('p0-03', 0.45) - bA.from}
          atHold={wa('p0-03', 0.85) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atRush={wa('p0-04', 0.14) - bB.from}
          atHand={wa('p0-05', 0.1) - bB.from}
          atToggle={wa('p0-06', 0.12) - bB.from}
          atEmpty={wa('p0-06', 0.55) - bB.from}
          atGate={wa('p0-07', 0.12) - bB.from}
          atDivert={wa('p0-07', 0.55) - bB.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0DirtyDialog;
