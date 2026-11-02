/** P3 取走即空（p3-01..p3-12，5 镜）——分镜 3-A / 3-B / 3-C / 3-D / 3-E。
 *
 *  叙事链：3-A 环-箱联动（承 2-E morph：信箱文件形/角标/湛蓝描边/两信计数
 *  逐帧不变，自舞台中央移驻主环侧）：@pushIn 压向环-箱主角 → p3-01「每转完
 *  一轮」词落位环体转满一圈停顿一拍、「看一眼信箱」词落位视线带自环扫向信箱
 *  〔M-005〕→ p3-02「注入」词落位箱内两信整摞取走、化作消息条沿视线带注入环
 *  内消息列、「模型看见」词落位模型脑图标亮起一拍（只亮一拍=反应时刻）→ 3-B
 *  探测节律 ECU：p3-03「每秒一拍」词落位湛蓝脉冲按秒匀速点亮（零强调动效
 *  〔M-002〕）、「只看」「不取」词落位标签闪现 → p3-04「唤醒新一轮」词落位
 *  唤醒连线点亮、主环自停顿态重新起转（自唤醒具象）→ 3-C 双入口竞态 ECU：
 *  p3-05「只能有一个口」词落位铁律签压顶（单入口图示——一只手收回）→ p3-06
 *  「两个口」词落位两手齐伸（隐患显形）→ p3-07「谁先读，信归谁」词落位一只
 *  手先到抱走整摞、「慢一步的」「扑空」词落位后到的手抓空红闪、铁律签服务完
 *  本拍即收〔M-006〕→ 3-D 左红右绿消融同屏（全片张力峰值）：p3-08「演到关机」
 *  词落位双轨同步立起、关机单在两轨各自队友环体旁升起 → p3-09「放工具直读」
 *  词落位左轨工具卡抢先把回音抱走（有轨迹）、「永远停在待处理」词落位状态格
 *  卡死定格 → p3-10「零条」词落位左轨再查信箱——计数角标翻 0、整箱清零暗掉
 *  （重音镜，P3 记忆点前半）→ 3-E p3-11「全部办成、落定」词落位右轨两单关机
 *  先后翻绿对号、落定辉光一次（计数口径与口播一致：两队友·两单）→ p3-12
 *  「消费式信箱」「单点入口」词落位裁决签定格（教训收点，重音镜）。
 *
 *  空间契约：环转一轮与停顿可辨、注入轨迹单向可追（箱→环内消息列）、取走后
 *    信箱清空、模型脑只亮一拍；脉冲节拍恒定每秒一拍、探测光扫过箱面不停留、
 *    唤醒连线单向；两手同构等大、先到后到次序分明、抓空红闪不留残信、铁律签
 *    随拍退役；红左绿右恒定、左轨「待处理」定格可读、信箱计数 0 可读、右轨
 *    本镜不提前办成（3-E 才翻）、对号 ×2 与口播一致、裁决签 ≤12 字。
 *  红线落实：注入禁反向、脉冲禁取信、节拍禁忽快忽慢、两手禁同时得信、左轨
 *    关机单禁翻成办成、虚构左轨计数禁（narration 未给数——只演卡死+零条）；
 *    词落位 = wa(id,f)；y≥56 / bottom≥176；inbox_poller / peek / check_inbox /
 *    consume_lead_inbox 只进角标。
 *
 *  承接登记：2-E→3-A morph（主代理信箱携两信——身份线索：湛蓝描边+文件名
 *    角标+两信在箱，保两项以上）；3-E→4-A SceneFade+拉远重锚（教学消融→生产
 *    拓扑=语义断裂，身份线索=环体同款+信箱同款跨镜恒常）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ABLATION_LANES, AblationSplit, LoopRing, MailboxFile, ProbePulse, TeammateRing} from '../components/motifs';
import {DUR, clamp01, progress, useFlowDash, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 环-箱联动：环转满一圈停顿 → 视线带 → 整摞取走注入（模型脑亮一拍） ──

const RING_3A = {x: 420, y: 210, size: 460} as const;
const MAIL_3A = {x: 1170, y: 290, w: 380, h: 320} as const;

const ThreeA: React.FC<{atLap: number; atGlance: number; atTake: number; atModel: number}> = ({atLap, atGlance, atTake, atModel}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const push = usePushIn(2, {scale: 0.05, dur: DUR.f6});
  // 环转满一圈停顿（开帧静止一拍展示环-箱全局位 → 词锚起转一整圈、回相位停住）
  const lapP = clamp01(progress(frame, atLap, 46));
  const slow0 = (atLap / (fps * 2.5)) % 1;
  const dot = lapP < 1 ? (slow0 + lapP) % 1 : slow0;
  // 视线带（环右缘 → 箱左缘：高亮带描线 + 流光行进——单向可追）
  const glance = clamp01(progress(frame, atGlance, 16));
  const flow = useFlowDash({dash: 14, gap: 12, period: 26});
  // 箱内两信整摞取走 → 化作消息条沿带注入环内消息列
  const take = clamp01(progress(frame, atTake, 26));
  // 注入消息条沿带飞行（两条先后——三段避让简化为沿带的单轨迹）
  const injA = clamp01(progress(frame, atTake + 8, 26));
  const injB = clamp01(progress(frame, atTake + 16, 26));
  // 模型脑图标亮起一拍（只亮一拍=反应时刻——注入后模型看见）
  const model = Math.sin(Math.PI * clamp01(progress(frame, atModel, 26)));
  const ringEdge = {x: RING_3A.x + RING_3A.size - 46, y: RING_3A.y + RING_3A.size / 2};
  const boxEdge = {x: MAIL_3A.x, y: MAIL_3A.y + 110};
  const belt = (t: number) => ({x: ringEdge.x + (boxEdge.x - ringEdge.x) * t, y: ringEdge.y + (boxEdge.y - ringEdge.y) * t});
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '46% 44%'}}>
      {/* 主环特写（转满一圈停顿——环的节律即机制） */}
      <div style={{position: 'absolute', left: RING_3A.x, top: RING_3A.y}}>
        <LoopRing size={RING_3A.size} nodes={[]} showExit={false} dotProgress={dot} />
        {/* 环内消息列（注入终点——两条队友消息先后落入点亮） */}
        <div style={{position: 'absolute', left: RING_3A.size / 2 - 76, top: 150, width: 152}}>
          {[0, 1].map((i) => {
            const on = i === 0 ? injA > 0.85 : injB > 0.85;
            return (
              <div
                key={`im${i}`}
                style={{
                  height: 26,
                  marginTop: 12,
                  borderRadius: 6,
                  background: on ? withAlpha(theme.inbox, 0.4) : 'transparent',
                  border: `2px ${on ? 'solid' : 'dashed'} ${on ? withAlpha(theme.inbox, 0.85) : withAlpha(theme.panelBorder, 0.9)}`,
                }}
              />
            );
          })}
        </div>
        {/* 模型脑图标（环内中心——亮起一拍：模型看见才能反应） */}
        <div
          style={{
            position: 'absolute',
            left: RING_3A.size / 2 - 52,
            top: RING_3A.size / 2 - 52,
            width: 104,
            height: 104,
            borderRadius: '50%',
            border: `3px solid ${withAlpha(theme.text, 0.9 * model)}`,
            background: withAlpha(theme.panel, 0.95),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            opacity: model,
            boxShadow: model > 0.05 ? `0 0 ${26 * model}px ${withAlpha(theme.text, 0.45)}` : 'none',
          }}
        >
          模型
        </div>
      </div>
      {/* 主代理信箱（承 2-E morph——两信在箱待取；取走后清空） */}
      <div style={{position: 'absolute', left: MAIL_3A.x, top: MAIL_3A.y}}>
        <MailboxFile x={0} y={0} w={MAIL_3A.w} h={MAIL_3A.h} name="lead.jsonl" litP={1} rows={take > 0.5 ? 0 : 2} count={take > 0.5 ? 0 : 2} takeP={take} />
      </div>
      {/* 视线带（环 → 箱：高亮带 + 流光——「看一眼信箱」） */}
      {glance > 0.02 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line
            x1={ringEdge.x}
            y1={ringEdge.y}
            x2={ringEdge.x + (boxEdge.x - ringEdge.x) * glance}
            y2={ringEdge.y + (boxEdge.y - ringEdge.y) * glance}
            stroke={withAlpha(theme.inbox, 0.8)}
            strokeWidth={5}
            strokeLinecap="round"
            {...flow}
          />
        </svg>
      ) : null}
      {/* 注入飞行的消息条（沿视线带逆向而行：箱 → 环内消息列，两条先后） */}
      {[injA, injB].map((t, i) => {
        if (t <= 0.02 || t >= 0.98) return null;
        const p = belt(1 - t);
        return (
          <div
            key={`ij${i}`}
            style={{
              position: 'absolute',
              left: p.x - 40,
              top: p.y - 10 + i * 18,
              width: 120,
              height: 20,
              borderRadius: 5,
              background: withAlpha(theme.inbox, 0.5),
              border: `2px solid ${withAlpha(theme.inbox, 0.9)}`,
              opacity: 1 - Math.max(0, t - 0.85) * 6,
            }}
          />
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'主循环每轮看一眼信箱 · 有信注入对话历史'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 探测节律 ECU：每秒一拍脉冲 + 只看不取 + 唤醒再转 ────────────────────

const MAIL_3B = {x: 740, y: 420, w: 420, h: 320} as const;
const PULSE_3B = {x: 870, y: 170} as const;
const RING_3B = {x: 1380, y: 300, size: 300} as const;

const ThreeB: React.FC<{atTick: number; atLabel: number; atWake: number}> = ({atTick, atLabel, atWake}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 脉冲按秒匀速点亮（节拍器节奏——tick 恒 30 帧一周期，零强调动效）
  const tickOn = clamp01(progress(frame, atTick, DUR.f5));
  const tick = ((frame % 30) + 30) % 30 / 30;
  // 「只看不取」标签闪现（承袭语义③）
  const label = Math.sin(Math.PI * clamp01(progress(frame, atLabel, 24)));
  // 探测光扫过箱面（不停留——scanP 单程，与 tick 同拍推进）
  const scan = ((frame - atTick) % 60) / 60;
  // 唤醒连线点亮（脉冲 → 主环：暗态 → 亮，单向）+ 主环自停顿态重新起转
  const wake = clamp01(progress(frame, atWake, 16));
  // 主环节律：停顿态缓爬（0..0.18 相位）→ 唤醒后自爬升终点续转（无相位跳变）
  const preWake = clamp01(frame / Math.max(1, atWake)) * 0.18;
  const dot = wake > 0.5 ? preWake + Math.max(0, frame - atWake - 16) / (fps * 2.5) : preWake;
  const pulseCx = PULSE_3B.x + 76;
  const pulseCy = PULSE_3B.y + 76;
  const ringEdge = {x: RING_3B.x, y: RING_3B.y + RING_3B.size / 2};
  return (
    <AbsoluteFill>
      {/* 主代理信箱（探测对象——扫过不停留） */}
      <div style={{position: 'absolute', left: MAIL_3B.x, top: MAIL_3B.y}}>
        <MailboxFile x={0} y={0} w={MAIL_3B.w} h={MAIL_3B.h} name="lead.jsonl" litP={1} rows={1} count={1} scanP={scan} />
      </div>
      {/* 探测脉冲环（信箱上方——每秒一拍） */}
      <div style={{position: 'absolute', left: PULSE_3B.x, top: PULSE_3B.y, opacity: tickOn}}>
        <ProbePulse x={0} y={0} r={62} tick={tick} labelP={label} />
      </div>
      {/* 主环（右侧——停顿态缓爬 → 唤醒后重新起转） */}
      <div style={{position: 'absolute', left: RING_3B.x, top: RING_3B.y}}>
        <LoopRing size={RING_3B.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: RING_3B.size / 2 - 44, top: RING_3B.size + 10, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: wake > 0.5 ? theme.core : theme.dim, whiteSpace: 'nowrap'}}>
          {wake > 0.5 ? '重新起转' : '停顿态'}
        </div>
      </div>
      {/* 唤醒连线（脉冲 → 主环：暗态 → 点亮——一有动静立刻唤醒） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line x1={pulseCx + 70} y1={pulseCy} x2={ringEdge.x} y2={ringEdge.y} stroke={withAlpha(theme.inbox, 0.22 + 0.6 * wake)} strokeWidth={4} strokeDasharray="12 10" />
        {wake > 0.95 ? <circle cx={ringEdge.x} cy={ringEdge.y} r={8} fill={theme.inbox} opacity={0.9} /> : null}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'inbox_poller · peek · 每秒一拍'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 双入口竞态 ECU：铁律签 → 两手齐伸 → 先到抱走 / 后到抓空红闪 ─────────

const MAIL_3C = {x: 760, y: 300, w: 400, h: 330} as const;
const LOOP_3C = {x: 130, y: 340, size: 210} as const;
const TOOL_3C = {x: 1470, y: 360, w: 300, h: 110} as const;

/** 竞态手（抽象手形：掌 + 三指——自主体侧伸向箱口；`reach` 伸出比例、`grab` 抱握） */
const RaceHand: React.FC<{x: number; y: number; dir: 1 | -1; reach: number; grab?: number; flash?: number}> = ({x, y, dir, reach, grab = 0, flash = 0}) => {
  const armLen = 340 * reach;
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      {/* 手臂（自主体侧伸向箱口——单向伸展） */}
      <div
        style={{
          position: 'absolute',
          left: dir === 1 ? 60 : -60,
          top: -10,
          width: armLen,
          height: 22,
          borderRadius: 11,
          background: withAlpha(theme.dim, 0.55),
          transform: `translateX(${dir === 1 ? 0 : -armLen}px)`,
          opacity: 0.9,
        }}
      />
      {/* 掌 + 三指（抽象手形——同构等大；grab 抱握=指收拢，flash 抓空=红闪） */}
      <div
        style={{
          position: 'absolute',
          left: dir === 1 ? 60 + armLen : -60 - armLen - 74,
          top: -36,
          width: 74,
          height: 66,
          borderRadius: 14,
          border: `3px solid ${flash > 0.2 ? theme.danger : withAlpha(theme.dim, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          boxShadow: flash > 0.05 ? `0 0 ${22 * flash}px ${withAlpha(theme.danger, 0.7)}` : 'none',
        }}
      >
        {[0, 1, 2].map((f) => (
          <span
            key={`fg${f}`}
            style={{
              position: 'absolute',
              top: 12,
              left: 10 + f * 20,
              width: 12,
              height: 34 - grab * 16,
              borderRadius: 6,
              background: flash > 0.2 ? theme.danger : withAlpha(theme.dim, 0.7),
              transform: `translateY(${grab * 9}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

const ThreeC: React.FC<{atRule: number; atBoth: number; atGrab: number; atMiss: number; atRetire: number}> = ({atRule, atBoth, atGrab, atMiss, atRetire}) => {
  const frame = useCurrentFrame();
  const dot = useRingDotSafe();
  // 铁律签压顶（单入口图示——一只手收回：主循环伸、工具口收）
  const rule = clamp01(progress(frame, atRule, DUR.f4));
  const backTool = clamp01(progress(frame, atRule + 4, 14));
  // 两手齐伸（教学版埋的隐患显形）
  const both = clamp01(progress(frame, atBoth, 14));
  // 竞态：先到（工具卡侧）抱走整摞——有轨迹
  const grab = clamp01(progress(frame, atGrab, 22));
  // 慢一步的主循环手抓空、空握拳红闪一闪（≤0.5s）
  const miss = Math.sin(Math.PI * clamp01(progress(frame, atMiss, 16)));
  // 铁律签随拍退役（M-006）
  const retire = clamp01(progress(frame, atRetire, 12));
  const ruleO = Math.max(0, rule - retire);
  // 箱内条目：grab 完成（0.7+）整摞被抱走 → 清空
  const emptied = grab > 0.7;
  return (
    <AbsoluteFill>
      {/* 主循环小环（左侧——主循环这只手） */}
      <div style={{position: 'absolute', left: LOOP_3C.x, top: LOOP_3C.y}}>
        <LoopRing size={LOOP_3C.size} nodes={[]} showExit={false} dotProgress={dot} />
        <div style={{position: 'absolute', left: 14, top: LOOP_3C.size + 8, fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>主循环</div>
      </div>
      {/* 查信箱工具卡（右侧——工具这只手） */}
      <div
        style={{
          position: 'absolute',
          left: TOOL_3C.x,
          top: TOOL_3C.y,
          width: TOOL_3C.w,
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.tool, 0.8)}`,
          background: withAlpha(theme.panel, 0.97),
          padding: '14px 20px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.text}}>查信箱 · 工具</span>
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.tool, marginLeft: 10}}>{'check_inbox'}</span>
      </div>
      {/* 箱口信箱（竞态对象——同款） */}
      <div style={{position: 'absolute', left: MAIL_3C.x, top: MAIL_3C.y}}>
        <MailboxFile x={0} y={0} w={MAIL_3C.w} h={MAIL_3C.h} name="lead.jsonl" litP={1} rows={emptied ? 0 : 2} count={emptied ? 0 : 2} takeP={grab > 0.5 ? grab : 0} />
      </div>
      {/* 两只手（同构等大：左=主循环 / 右=工具卡；先到后到次序分明） */}
      {/* 左手（主循环）：铁律拍先伸 → 两口拍齐伸 → 竞态拍慢一步抓空红闪 */}
      <RaceHand x={LOOP_3C.x + 200} y={MAIL_3C.y + 80} dir={1} reach={rule * 0.55 + both * 0.45} grab={miss * 0.8} flash={miss} />
      {/* 右手（工具卡）：铁律拍收回 → 两口拍齐伸 → 竞态拍先到抱走整摞 */}
      <RaceHand x={TOOL_3C.x - 8} y={MAIL_3C.y + 190} dir={-1} reach={(1 - backTool) * 0.55 + both * 0.45 + grab * 0.25} grab={grab > 0.4 ? 1 : 0} />
      {/* 先到者抱走的整摞（随右手退回——被读走有轨迹） */}
      {grab > 0.45 && grab < 0.98 ? (
        <div style={{position: 'absolute', left: MAIL_3C.x + 240 - (grab - 0.45) * 620, top: MAIL_3C.y + 150, opacity: 1 - Math.max(0, (grab - 0.75) * 3.5)}}>
          {[0, 1].map((k) => (
            <div key={`gg${k}`} style={{width: 170, height: 18, marginTop: 7, borderRadius: 5, background: withAlpha(theme.tool, 0.4), border: `2px solid ${withAlpha(theme.tool, 0.85)}`}} />
          ))}
        </div>
      ) : null}
      {/* 铁律签（压顶——服务完本拍即收） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 128,
          display: 'flex',
          justifyContent: 'center',
          opacity: ruleO,
          transform: `translateY(${(1 - ruleO) * -18}px)`,
        }}
      >
        <div
          style={{
            padding: '12px 30px',
            borderRadius: 11,
            border: `3px solid ${withAlpha(theme.text, 0.9)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          铁律 · 读取只能有一个口
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'谁先读，信归谁 · 慢一步扑空'}
      </div>
    </AbsoluteFill>
  );
};

/** 3-C 内部：环体匀速节律（竞态舞台上的环照常转） */
function useRingDotSafe(secPerLap = 2.5) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (frame / (fps * secPerLap)) % 1;
}

// ── 3-D / 3-E 左红右绿消融双轨（全片张力峰值 → 右轨兑现 + 裁决签） ──────────

/** 轨内常量（左右同构——迷你编队 / 信箱 / 工具卡 / 关机单纵位） */
const LANE_GEO = {
  fleetY: 236,
  ringLead: 96,
  ringMate: 66,
  mail: {y: 420, w: 210, h: 180},
  tool: {y: 640, w: 250},
  order: {y1: 616, y2: 738, w: 360, h: 110},
} as const;

/** 关机单（状态格卡——两轨各自的裁决面：pending=红卡死 / wait=中性待处理 /
 *  done=绿办成 ✓；`y` 显式传入以复用两单叠放位） */
const ShutdownOrder: React.FC<{x: number; y: number; litP: number; state: 'pending' | 'wait' | 'done'; stuckP?: number; doneP?: number}> = ({x, y, litP, state, stuckP = 0, doneP = 0}) => {
  const tone = state === 'done' ? theme.ok : state === 'wait' ? theme.dim : theme.danger;
  const done = state === 'done' ? doneP : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: LANE_GEO.order.w,
        height: LANE_GEO.order.h,
        borderRadius: 12,
        border: `3px solid ${withAlpha(tone, 0.8)}`,
        background: withAlpha(theme.panel, 0.97),
        padding: '12px 18px',
        opacity: litP,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap'}}>
        <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text}}>关机单</span>
        <span
          style={{
            padding: '4px 14px',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(tone, 0.9)}`,
            background: state === 'done' && done > 0.4 ? withAlpha(theme.ok, 0.16) : withAlpha(theme.danger, 0.08 + 0.14 * stuckP),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: tone,
            transform: `scale(${1 + 0.06 * (state === 'done' ? done : stuckP)})`,
          }}
        >
          {state === 'done' && done > 0.4 ? '办成 ✓' : '待处理'}
        </span>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>
        {state === 'done' ? '队友停工 · 回音入列' : state === 'wait' ? '队友停工 · 等主循环取走' : '队友停工 · 回音被读走'}
      </div>
    </div>
  );
};

const ThreeD: React.FC<{
  atRise: number;
  atSnatch: number;
  atStuck: number;
  atZero: number;
}> = ({atRise, atSnatch, atStuck, atZero}) => {
  const frame = useCurrentFrame();
  // 双轨同步立起 + 关机单自队友环体旁升起
  const rise = clamp01(progress(frame, atRise, 20));
  // 左轨：工具卡抢先把回音抱走（有轨迹——回音自信箱飞向工具卡）
  const snatch = clamp01(progress(frame, atSnatch, 24));
  // 左轨关机单状态格卡在「待处理」定格（卡死——红光滞留不再翻动）
  const stuck = clamp01(progress(frame, atStuck, 16));
  // 左轨再查信箱：计数角标翻 0、整箱清零暗掉（重音镜）
  const zero = clamp01(progress(frame, atZero, 18));
  return (
    <AbsoluteFill>
      <AblationSplit litP={1} leftP={rise} rightP={rise} />
      {/* 双轨内容（同构：迷你编队 + 信箱 + 关机单；左轨另有工具卡与回音位） */}
      {([ABLATION_LANES.left, ABLATION_LANES.right] as const).map((lane, li) => {
        const isLeft = li === 0;
        const cx = lane.x + 40;
        return (
          <React.Fragment key={`lane${li}`}>
            {/* 迷你环体编队（轨头——主环橙 mini + 两品红 mini 同款缩微） */}
            <div style={{position: 'absolute', left: cx, top: LANE_GEO.fleetY, opacity: rise}}>
              <LoopRing size={LANE_GEO.ringLead} nodes={[]} showExit={false} dotProgress={(frame / 75) % 1} />
              <div style={{position: 'absolute', left: LANE_GEO.ringLead + 18, top: 4}}>
                <TeammateRing size={LANE_GEO.ringMate} dotProgress={(frame / 75) % 1} />
              </div>
              <div style={{position: 'absolute', left: LANE_GEO.ringLead + 18, top: LANE_GEO.ringMate + 22}}>
                <TeammateRing size={LANE_GEO.ringMate} dotProgress={(frame / 75) % 1} />
              </div>
            </div>
            {/* 轨内信箱（左：翻 0 清零暗掉 / 右：两信在箱待取——3-E 兑现） */}
            <div style={{position: 'absolute', left: cx + 330, top: LANE_GEO.mail.y, opacity: isLeft ? 1 - 0.55 * zero : rise}}>
              <MailboxFile x={0} y={0} w={LANE_GEO.mail.w} h={LANE_GEO.mail.h} name="lead.jsonl" litP={1} rows={isLeft ? 0 : 2} count={isLeft ? (zero > 0.5 ? 0 : 2) : 2} />
            </div>
            {/* 左轨：回音位（主代理侧虚线——回音本该落回主循环列） */}
            {isLeft ? (
              <div
                style={{
                  position: 'absolute',
                  left: cx + 130,
                  top: LANE_GEO.mail.y + 46,
                  width: 150,
                  height: 88,
                  borderRadius: 10,
                  border: `2.5px dashed ${withAlpha(theme.dim, 0.6)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: rise,
                }}
              >
                回音位 · 虚
              </div>
            ) : null}
            {/* 左轨：工具卡（放工具直读——抢先把回音抱走的抢读者） */}
            {isLeft ? (
              <div
                style={{
                  position: 'absolute',
                  left: cx + 40,
                  top: LANE_GEO.tool.y,
                  width: LANE_GEO.tool.w,
                  borderRadius: 11,
                  border: `3px solid ${withAlpha(theme.tool, 0.85)}`,
                  background: withAlpha(theme.panel, 0.97),
                  padding: '10px 16px',
                  opacity: rise,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>查信箱 · 直读</span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.tool, marginLeft: 8}}>{'check_inbox'}</span>
              </div>
            ) : null}
            {/* 左轨：被抱走的回音（自信箱飞向工具卡——被读走有轨迹） */}
            {isLeft && snatch > 0.1 && snatch < 0.95 ? (
              <div
                style={{
                  position: 'absolute',
                  left: cx + 370 - snatch * 90,
                  top: LANE_GEO.mail.y + 60 + snatch * 150,
                  padding: '5px 14px',
                  borderRadius: 8,
                  border: `2.5px solid ${withAlpha(theme.tool, 0.9)}`,
                  background: withAlpha(theme.panel, 0.98),
                  fontFamily: theme.sans,
                  fontSize: 17,
                  fontWeight: 700,
                  color: theme.text,
                  whiteSpace: 'nowrap',
                  opacity: 1 - Math.max(0, snatch - 0.8) * 5,
                }}
              >
                回音 · 关机回执
              </div>
            ) : null}
            {/* 关机单（左=卡死待处理定格 / 右=两单中性等待——3-E 兑现翻绿） */}
            {isLeft ? (
              <ShutdownOrder x={cx + 380} y={LANE_GEO.order.y1} litP={rise} state="pending" stuckP={stuck} />
            ) : (
              <>
                <ShutdownOrder x={cx + 380} y={LANE_GEO.order.y1} litP={rise} state="wait" />
                <ShutdownOrder x={cx + 380} y={LANE_GEO.order.y2} litP={rise} state="wait" />
              </>
            )}
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'实测：拆掉统一入口 → 放工具直读'}
      </div>
    </AbsoluteFill>
  );
};

const ThreeE: React.FC<{atDone: number[]; atGlow: number; atRule: number}> = ({atDone, atGlow, atRule}) => {
  const frame = useCurrentFrame();
  // 右轨两单关机先后翻绿对号（stagger——计数口径与口播一致：两队友·两单）
  const doneA = clamp01(progress(frame, atDone[0], 14));
  const doneB = clamp01(progress(frame, atDone[1], 14));
  // 落定辉光一次（双对号齐明后一拍辉光脉冲）
  const glow = Math.sin(Math.PI * clamp01(progress(frame, atGlow, 24)));
  // 裁决签定格（教训收点——「消费式信箱」「单点入口」两词先后压定）
  const rule1 = clamp01(progress(frame, atRule, 16));
  const rule2 = clamp01(progress(frame, atRule + 12, 16));
  return (
    <AbsoluteFill>
      <AblationSplit litP={1} leftP={1} rightP={1} />
      {/* 左轨：维持卡死并置（无退化外变化——静态重绘 3-D 末态） */}
      <div style={{position: 'absolute', left: ABLATION_LANES.left.x + 40, top: LANE_GEO.fleetY}}>
        <LoopRing size={LANE_GEO.ringLead} nodes={[]} showExit={false} dotProgress={(frame / 75) % 1} />
        <div style={{position: 'absolute', left: LANE_GEO.ringLead + 18, top: 4}}>
          <TeammateRing size={LANE_GEO.ringMate} dotProgress={(frame / 75) % 1} />
        </div>
        <div style={{position: 'absolute', left: LANE_GEO.ringLead + 18, top: LANE_GEO.ringMate + 22}}>
          <TeammateRing size={LANE_GEO.ringMate} dotProgress={(frame / 75) % 1} />
        </div>
      </div>
      <div style={{position: 'absolute', left: ABLATION_LANES.left.x + 370, top: LANE_GEO.mail.y, opacity: 0.45}}>
        <MailboxFile x={0} y={0} w={LANE_GEO.mail.w} h={LANE_GEO.mail.h} name="lead.jsonl" litP={1} rows={0} count={0} />
      </div>
      <ShutdownOrder x={ABLATION_LANES.left.x + 420} y={LANE_GEO.order.y1} litP={1} state="pending" stuckP={1} />
      {/* 右轨：两单关机逐一翻成「办成」（确认绿对号 ×2）+ 落定辉光一次 */}
      <div style={{position: 'absolute', left: ABLATION_LANES.right.x + 40, top: LANE_GEO.fleetY}}>
        <LoopRing size={LANE_GEO.ringLead} nodes={[]} showExit={false} dotProgress={(frame / 75) % 1} />
        <div style={{position: 'absolute', left: LANE_GEO.ringLead + 18, top: 4}}>
          <TeammateRing size={LANE_GEO.ringMate} dotProgress={(frame / 75) % 1} />
        </div>
        <div style={{position: 'absolute', left: LANE_GEO.ringLead + 18, top: LANE_GEO.ringMate + 22}}>
          <TeammateRing size={LANE_GEO.ringMate} dotProgress={(frame / 75) % 1} />
        </div>
      </div>
      <div style={{position: 'absolute', left: ABLATION_LANES.right.x + 370, top: LANE_GEO.mail.y, opacity: 1}}>
        <MailboxFile x={0} y={0} w={LANE_GEO.mail.w} h={LANE_GEO.mail.h} name="lead.jsonl" litP={1} rows={0} count={0} />
      </div>
      {/* 右轨两单（先后翻绿——对号 ×2 与口播数字一致） */}
      <ShutdownOrder x={ABLATION_LANES.right.x + 420} y={LANE_GEO.order.y1} litP={1} state="done" doneP={doneA} />
      <ShutdownOrder x={ABLATION_LANES.right.x + 420} y={LANE_GEO.order.y2} litP={1} state="done" doneP={doneB} />
      {/* 落定辉光（双对号齐明一拍——右轨整体辉光脉冲） */}
      <AbsoluteFill style={{background: withAlpha(theme.ok, 0.05 * glow), pointerEvents: 'none', boxShadow: `inset 0 0 ${160 * glow}px ${withAlpha(theme.ok, 0.16 * glow)}`}} />
      {/* 裁决压缩签（横贯双轨底部——两词先后压定、定格） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 852, display: 'flex', justifyContent: 'center', gap: 34}}>
        <div
          style={{
            padding: '13px 32px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.inbox, 0.9)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: rule1,
            transform: `translateY(${(1 - rule1) * 18}px)`,
          }}
        >
          消费式信箱
        </div>
        <div
          style={{
            padding: '13px 32px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.ok, 0.9)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: rule2,
            transform: `translateY(${(1 - rule2) * 18}px)`,
          }}
        >
          必须配单点入口
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'consume_lead_inbox · 两队友两单全办成'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3SingleEntry: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-02');
  const bB = w('p3-03', 'p3-04');
  const bC = w('p3-05', 'p3-07');
  const bD = w('p3-08', 'p3-10');
  const bE = w('p3-11', 'p3-12');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atLap={wa('p3-01', 0.4) - bA.from}
          atGlance={wa('p3-01', 0.72) - bA.from}
          atTake={wa('p3-02', 0.35) - bA.from}
          atModel={wa('p3-02', 0.6) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB
          atTick={wa('p3-03', 0.2) - bB.from}
          atLabel={wa('p3-03', 0.6) - bB.from}
          atWake={wa('p3-04', 0.25) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC
          atRule={wa('p3-05', 0.62) - bC.from}
          atBoth={wa('p3-06', 0.35) - bC.from}
          atGrab={wa('p3-07', 0.1) - bC.from}
          atMiss={wa('p3-07', 0.62) - bC.from}
          atRetire={wa('p3-07', 0.86) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="3-D">
        <ThreeD
          atRise={wa('p3-08', 0.25) - bD.from}
          atSnatch={wa('p3-09', 0.33) - bD.from}
          atStuck={wa('p3-09', 0.68) - bD.from}
          atZero={wa('p3-10', 0.26) - bD.from}
        />
      </Sequence>
      <Sequence {...bE} name="3-E">
        <ThreeE
          atDone={[wa('p3-11', 0.45), wa('p3-11', 0.72)].map((v) => v - bE.from)}
          atGlow={wa('p3-11', 0.9) - bE.from}
          atRule={wa('p3-12', 0.35) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3SingleEntry;
