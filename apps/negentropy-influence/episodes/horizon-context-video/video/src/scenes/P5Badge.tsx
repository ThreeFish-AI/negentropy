/** P5 专用工牌＝M6（主体轴 who）+ 自动贴标＝M7（发现→标记→执行供给链），
 *  末尾带出 §10–§12 三组降级配角（承重列之外的供给与出口）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useDraw,
  useFlowDash,
  useProgress,
  useShake,
  useSpring,
  useStagger,
} from '../motion';
import {NumberedCard, Panel, SceneTag} from '../components/motifs';
import {CodeWalk, TerminalLog} from '../components/CodeWalk';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {AskCard, EvidenceBadge, MechZoom, NumberClash, PillarHUD, Stage} from '../components/devices';

/** 5-B 权限交集环：只减不增 */
const PermIntersect: React.FC<{at: number}> = ({at}) => {
  const shrink = useSpring('settle', {at, dur: DUR.f6});
  const r = 150;
  // 从近乎并集的宽重叠**单调收窄**到定格的工牌透镜——对齐 p5-05「权限只减不增」与
  // storyboard 5-B「收窄成工牌形」；终态间距 76 与 v4 定格一致，只翻转过程方向。
  const rest = 76;
  const dx = rest - 40 * (1 - shrink);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 58}}>
      <svg width={560} height={340}>
        <circle cx={280 - dx} cy={170} r={r} fill={`${theme.engine}22`} stroke={theme.engine} strokeWidth={3} />
        <circle cx={280 + dx} cy={170} r={r} fill={`${theme.dig}22`} stroke={theme.dig} strokeWidth={3} />
        {/* 两行环标题锚定**终态**位置：随 dx 移动会在开场宽重叠时互相叠字 */}
        <text x={280 - rest - 56} y={72} fill={theme.engine} fontSize={22} fontFamily={theme.sans}>
          带教人权限
        </text>
        <text x={280 + rest - 40} y={72} fill={theme.dig} fontSize={22} fontFamily={theme.sans}>
          代理允许面
        </text>
        <text x={280 - 34} y={178} fill={theme.text} fontSize={26} fontFamily={theme.sans} opacity={shrink}>
          工牌
        </text>
      </svg>
      <div>
        <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>权限只减不增</div>
        <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 25, color: theme.dim, lineHeight: 1.6}}>
          带教人自己都看不了的机密
          <br />
          智能体绝对无权触碰
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'inline-block',
            padding: '8px 16px',
            borderRadius: 8,
            border: `2px solid ${theme.danger}`,
            color: theme.danger,
            fontFamily: theme.sans,
            fontSize: 22,
          }}
        >
          ✗ 并集（发万能钥匙）
        </div>
      </div>
    </div>
  );
};

/** 5-A 万能钥匙 vs 专用工牌：左边拆给你看，右边给出正解。
 *
 *  两个时点都由句边界给出（铁律⑤）：钥匙被注入、七道锁逐一弹开落在 p5-02
 *  （「一旦指令被注入，大厦瞬间失守」），工牌挂落与两条铁律落在 p5-04。
 *  七道锁用 schedule 的 `fit` 模式**铺满整句**——p5-02 有 184 帧（6.1s），用固定
 *  stride 会在前 1/3 演完、剩下 4s 静止（ISSUE-187 ①）。
 *  `useShake` 必须同时给 `decay: true` 与 `dur`，否则会抖满整个子镜 447 帧。 */
const KeyVsBadge: React.FC<{
  breakAt: number;
  breachSpan: number;
  badgeAt: number;
  badgeSpan: number;
}> = ({breakAt, breachSpan, badgeAt, badgeSpan}) => {
  const shake = useShake({at: breakAt, active: true, amp: 8, decay: true, dur: DUR.f6});
  const inject = useProgress(breakAt, Math.max(1, Math.round(breachSpan * 0.3)));
  const locks = useStagger(7, {at: breakAt, fit: {total: breachSpan}, dur: DUR.f4});
  const lanyard = useDraw(badgeAt, DUR.f5);
  const drop = useSpring('snap', {at: badgeAt, dur: DUR.f6});
  const glow = useBreathe({period: 60, base: 0.55, amp: 0.45});
  const rules = useStagger(2, {
    at: badgeAt,
    fit: {total: Math.max(2, Math.round(badgeSpan * 0.6))},
    dur: DUR.f5,
  });
  return (
    <div style={{display: 'flex', gap: 90, alignItems: 'flex-start'}}>
      <div style={{width: 400, textAlign: 'center'}}>
        <div
          style={{
            fontSize: 92,
            transform: `translateX(${shake}px) rotate(${shake * 0.6}deg)`,
          }}
        >
          🔑
        </div>
        <div
          style={{
            marginTop: 10,
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: 999,
            border: `2px solid ${theme.danger}`,
            color: theme.danger,
            fontFamily: theme.mono,
            fontSize: 20,
            opacity: inject,
          }}
        >
          prompt injection ↯
        </div>
        {/* 只靠 🔒/🔓 换字形在 30px 上读不出开合（2026-09-19 抽帧实测），
            故同时给倾倒角度与红色下划条——状态由三重冗余表达，不依赖字形辨识 */}
        <div style={{marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center'}}>
          {locks.map((p, i) => (
            <div key={i} style={{textAlign: 'center'}}>
              <div
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                  opacity: 0.45 + 0.55 * p,
                  transform: `rotate(${p * 20}deg) translateY(${p * 5}px)`,
                }}
              >
                {p > 0.5 ? '🔓' : '🔒'}
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 4,
                  borderRadius: 2,
                  background: p > 0.5 ? theme.danger : theme.panelBorder,
                  opacity: p > 0.5 ? 1 : 0.6,
                }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.danger,
            opacity: locks[6],
          }}
        >
          万能钥匙 → 七道门一起失守
        </div>
      </div>
      <div style={{width: 430, textAlign: 'center'}}>
        <svg width={430} height={86} style={{display: 'block'}}>
          <path
            d="M 215 0 C 175 40, 255 40, 215 84"
            stroke={theme.engine}
            strokeWidth={3}
            fill="none"
            {...lanyard}
          />
        </svg>
        <div
          style={{
            width: 260,
            margin: '0 auto',
            padding: '18px 0',
            borderRadius: 12,
            border: `3px solid ${theme.engine}`,
            background: `${theme.engine}14`,
            boxShadow: `0 0 ${10 + 22 * glow}px ${theme.engine}66`,
            transform: `translateY(${(1 - drop) * -34}px)`,
            opacity: drop,
          }}
        >
          <div style={{fontSize: 44}}>🤖</div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.engine, marginTop: 6}}>
            AGENT · 独立身份
          </div>
        </div>
        <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10}}>
          {['铁律一 · 权限只减不增', '铁律二 · 天花板实时求值'].map((t, i) => (
            <div
              key={t}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: `2px solid ${theme.engine}`,
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.text,
                opacity: rules[i],
                transform: `translateX(${(1 - rules[i]) * 18}px)`,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 5-E 进楼考验：新文件涌入的速度 vs 人工逐表登记的速度，差额就是未纳管缺口。
 *
 *  两条共享同一个 progress、只差常数倍率 ⇒ 差额恒单调非负，不会出现
 *  「减项跑在被减项前面」的塌陷（ISSUE-187 根因③）。
 *  用 manual 不用 danger：人工逐表写规则是受治理的手册式资产，容量跟不上不是
 *  错误数字也不是越权泄露（planning §三 色彩语义唯一）。 */
const IntakeBacklog: React.FC<{at: number; span: number}> = ({at, span}) => {
  const p = useProgress(at, span, 'linear');
  const bar = (label: string, width: number, color: string) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
      <span style={{width: 150, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
        {label}
      </span>
      <div style={{height: 26, width: width * p, borderRadius: 6, background: `${color}AA`}} />
    </div>
  );
  return (
    <div style={{width: 520, display: 'flex', flexDirection: 'column', gap: 14}}>
      {bar('新文件进楼', 350, theme.dim)}
      {bar('人工逐表登记', 140, theme.manual)}
      <div
        style={{
          marginLeft: 166,
          width: (350 - 140) * p,
          height: 22,
          borderRadius: 6,
          border: `2px dashed ${theme.manual}`,
          background: `${theme.manual}10`,
        }}
      />
      <div
        style={{
          marginLeft: 166,
          fontFamily: theme.sans,
          fontSize: 21,
          color: theme.manual,
          opacity: p,
        }}
      >
        差额 = 未纳管缺口，只会越拉越大
      </div>
    </div>
  );
};

/** 5-E 自动贴标流水线：传送带 → 扫描探针 → 密级标签 → 联动承重墙闸机。
 *
 *  文件用 `frame % slideSpan` 循环滑行（纯 progress 在 map 内算，不在循环里调 hook），
 *  保证本子镜 426 帧全程有运动；标签贴合与闸机联动分别锚在 p5-18 与 p5-20。
 *  三枚标签统一用 dig 并靠文案区分密级 —— storyboard 原写「彩色」，但多色相会让
 *  色彩变成装饰，违反 planning §三 的色彩语义唯一契约。 */
const FILES = ['customers.csv', 'orders.parquet', 'events.json'];
const TAGS = ['PII · 身份标识', 'CONFIDENTIAL · 财务', 'INTERNAL · 行为日志'];

const TagLine: React.FC<{
  startAt: number;
  slideSpan: number;
  linkAt: number;
  linkSpan: number;
}> = ({startAt, slideSpan, linkAt, linkSpan}) => {
  const frame = useCurrentFrame();
  const belt = useFlowDash({dash: 16, gap: 20, period: 36});
  const probe = useBreathe({period: 48, base: 0.5, amp: 0.5});
  const stick = useSpring('snap', {at: linkAt, dur: DUR.f6});
  const link = useDraw(linkAt, DUR.f5);
  const lit = useProgress(linkAt + Math.max(1, Math.round(linkSpan * 0.4)), DUR.f5);
  const e = Math.max(0, frame - startAt);
  return (
    <div style={{width: 1240}}>
      <div style={{position: 'relative', height: 150}}>
        <svg width={1240} height={150}>
          <line
            x1={40}
            y1={118}
            x2={1160}
            y2={118}
            stroke={theme.panelBorder}
            strokeWidth={4}
            {...belt}
          />
          {[200, 600, 1000].map((cx) => (
            <circle key={cx} cx={cx} cy={130} r={9} fill="none" stroke={theme.panelBorder} strokeWidth={3} />
          ))}
          <rect
            x={856}
            y={10}
            width={128}
            height={52}
            rx={8}
            fill={theme.panel}
            stroke={theme.dig}
            strokeWidth={2}
          />
          <text x={868} y={42} fill={theme.dig} fontSize={19} fontFamily={theme.mono}>
            扫描探针
          </text>
          <line
            x1={920}
            y1={62}
            x2={920}
            y2={110}
            stroke={theme.dig}
            strokeWidth={3}
            opacity={0.35 + 0.65 * probe}
          />
        </svg>
        {FILES.map((f, i) => {
          const t = (e / Math.max(1, slideSpan) + i / 3) % 1;
          return (
            <div
              key={f}
              style={{
                position: 'absolute',
                left: 40 + t * 1060,
                top: 74,
                padding: '6px 12px',
                borderRadius: 6,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                fontFamily: theme.mono,
                fontSize: 17,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              📄 {f}
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', gap: 20, justifyContent: 'center', marginTop: 4}}>
        {TAGS.map((t, i) => (
          <div
            key={t}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: `2px solid ${theme.dig}`,
              background: `${theme.dig}14`,
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.dig,
              opacity: stick,
              transform: `scale(${0.82 + 0.18 * stick}) translateY(${(1 - stick) * -14}px)`,
              transitionProperty: 'none',
              marginTop: i === 1 ? 0 : 4,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <svg width={1240} height={72} style={{display: 'block'}}>
        <path
          d="M 620 0 C 620 34, 620 40, 620 66"
          stroke={theme.dig}
          strokeWidth={3}
          fill="none"
          {...link}
        />
      </svg>
      <div style={{textAlign: 'center', marginTop: -6}}>
        <span
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: 10,
            border: `2px solid ${lit > 0.4 ? theme.engine : theme.panelBorder}`,
            background: lit > 0.4 ? `${theme.engine}14` : 'transparent',
            fontFamily: theme.sans,
            fontSize: 23,
            color: lit > 0.4 ? theme.engine : theme.dim,
          }}
        >
          🛂 承重墙闸机自动联动 · 免重复配置
        </span>
      </div>
    </div>
  );
};

/** 5-D 双钟对照：快照钟 vs 实时钟，中间阴影是越权窗口 */
const TwoClocks: React.FC<{revokeAt: number}> = ({revokeAt}) => {
  const frame = useCurrentFrame();
  const gap = progress(frame, revokeAt, DUR.f6);
  const clock = (title: string, sub: string, dead: boolean, c: string) => (
    <div style={{textAlign: 'center'}}>
      <div
        style={{
          width: 190,
          height: 190,
          borderRadius: '50%',
          border: `4px solid ${c}`,
          background: `${c}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 62,
        }}
      >
        {dead ? '⛔' : '🕐'}
      </div>
      <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{title}</div>
      <div style={{fontFamily: theme.sans, fontSize: 21, color: c}}>{sub}</div>
    </div>
  );
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 48}}>
      {clock('快照式工牌', '回收后仍持权', gap < 0.5, theme.danger)}
      <div
        style={{
          width: 40 + 220 * gap,
          height: 110,
          borderRadius: 8,
          background: `${theme.danger}1E`,
          border: `2px dashed ${theme.danger}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.danger,
          opacity: gap,
        }}
      >
        越权窗口
      </div>
      {clock('实时天花板', '上一秒回收，下一秒失效', gap > 0.5, theme.ok)}
    </div>
  );
};

/** 5-F 断链最后一环 */
const BrokenChain: React.FC<{at: number; leakAt: number}> = ({at, leakAt}) => {
  const ps = useStagger(3, {at, stride: 8, dur: DUR.f5});
  // leakAt：明文出楼要落在说出它的那句上，写死 at+26 会提前 12.5s
  const leak = useProgress(leakAt, DUR.f6);
  const links = ['发现（自动分类）', '标记（系统标签）', '执行（tag-based 策略）'];
  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        {links.map((l, i) => (
          <React.Fragment key={l}>
            <div
              style={{
                padding: '20px 26px',
                borderRadius: 10,
                border: `2px solid ${i === 2 ? theme.danger : theme.dig}`,
                background: `${i === 2 ? theme.danger : theme.dig}12`,
                fontFamily: theme.sans,
                fontSize: 25,
                color: theme.text,
                opacity: ps[i],
              }}
            >
              {l}
            </div>
            {i < 2 ? (
              <span style={{fontSize: 30, color: i === 1 ? theme.danger : theme.dim}}>
                {i === 1 ? '⇢' : '→'}
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.danger,
          opacity: leak,
        }}
      >
        phone 已贴系统标签 → 仍以 138****2041 明文出楼
      </div>
    </div>
  );
};

/** 5-G 听证会空白卡：不作为的可视化——数字栏刻意留白 */
const ConflictHearing: React.FC<{at: number}> = ({at}) => {
  const [a, b] = useStagger(2, {at, stride: 8, dur: DUR.f5});
  const card = (who: string, expr: string, c: string, p: number) => (
    <div
      style={{
        width: 470,
        padding: '24px 28px',
        borderRadius: 12,
        border: `2px solid ${c}`,
        background: `${c}12`,
        opacity: p,
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 24, color: c}}>{who}</div>
      <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.text, marginTop: 10}}>{expr}</div>
      <div
        style={{
          marginTop: 16,
          height: 56,
          borderRadius: 8,
          border: `2px dashed ${theme.dim}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
        }}
      >
        数值待人工裁决
      </div>
    </div>
  );
  return (
    <div>
      <div style={{display: 'flex', gap: 30}}>
        {card('governed 金标准', 'count_distinct(orders.customer_id)', theme.manual, a)}
        {card('inferred 民间口径', 'count(events.id)', theme.dig, b)}
      </div>
      <div style={{marginTop: 22, textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.danger}}>
        禁止按热度自动选 —— 否则错误口径借多数人赢
      </div>
    </div>
  );
};

export const P5Badge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  // 非 beat 用途一律走 dur，不写 w('句id') 字面形态（见 P3Gate 同处注释）
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p5-01', 'p5-04');
  const bB = w('p5-05', 'p5-08');
  const bC = w('p5-08a');
  const bD = w('p5-09', 'p5-15');
  const bE = w('p5-16', 'p5-20');
  const bF = w('p5-21', 'p5-25');
  const bG = w('p5-26', 'p5-30');
  const bH = w('p5-31', 'p5-32');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A 专用工牌">
        <SceneTag chapter="M6" tagline="Agent Identity：实习生专用工牌" accent={theme.engine} />
        <Sequence
          from={at('p5-01') - bA.from}
          durationInFrames={at('p5-02') - at('p5-01')}
          name="5-A① 母图推近 · 大门发牌处"
        >
          <Stage top={320}>
            <MechZoom focus="badge" spanInFrames={at('p5-02') - at('p5-01')}>
              <AskCard
                at={0}
                kicker="最棘手的问题"
                body="智能体真正进入业务流 —— 工牌怎么发？"
              />
            </MechZoom>
          </Stage>
        </Sequence>
        <Sequence
          from={at('p5-02') - bA.from}
          durationInFrames={bA.durationInFrames - (at('p5-02') - bA.from)}
          name="5-A② 万能钥匙碎裂与专用工牌挂落"
        >
          <Stage top={320}>
            <KeyVsBadge
              breakAt={0}
              breachSpan={dur('p5-02')}
              badgeAt={at('p5-04') - at('p5-02')}
              badgeSpan={dur('p5-04')}
            />
          </Stage>
        </Sequence>
        <ArchifyRecap
          slug="agent-identity"
          caption="权限天花板只减不增"
          cues={[{chapterId: 'ceiling', at: at('p5-03') - bA.from, durationInFrames: dur('p5-03')}]}
        />
      </Sequence>

      <Sequence {...bB} name="5-B 权限交集环与刷卡审计">
        <Stage top={380}>
          <PermIntersect at={at('p5-05') - bB.from} />
        </Stage>
        <ArchifyRecap
          slug="agent-identity"
          caption="agent_type 归因审计"
          variant="inset"
          cues={[{chapterId: 'audit', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')}]}
        />
      </Sequence>

      <Sequence {...bC} name="5-C 回指 P3 的代理识别灯">
        <Stage top={400}>
          <Panel accent={theme.engine} style={{padding: '30px 40px', width: 1080}}>
            <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text, textAlign: 'center'}}>
              前面闸机能认出代理 —— 认的就是这张工牌
            </div>
          </Panel>
        </Stage>
        <ArchifyRecap
          slug="agent-identity"
          caption="IS_AGENT_ACTIVATED 谓词"
          variant="inset"
          cues={[
            {chapterId: 'strict', at: at('p5-08a') - bC.from, durationInFrames: dur('p5-08a')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="5-D 双钟对照与代码走廊④">
        <Stage top={180}>
          <TwoClocks revokeAt={at('p5-13') - bD.from} />
          <CodeWalk
            title="M6 天花板 · 查询期实时求值（非登录期快照）"
            lines={[
              'def session_allows(session, perm):',
              '    if session.ceiling:',
              '        return perm in (USER_PERMS[session.user] & AGENT_SERVICE_ALLOWED)',
              '    return perm in session.perms          # 快照式：回收后仍持权',
            ]}
            hi={[{line: 2, at: 18, color: theme.ok}, {line: 3, at: 28, color: theme.danger}]}
            caption="horizon_context_lab.py :785"
            width={1180}
          />
          {/* 终端行 = selftest 原文逐字摘录（含前导两空格）；改措辞须同步 narration/source-notes */}
          <TerminalLog
            prompt="uv run --no-project python horizon_context_lab.py --selftest"
            lines={[
              {
                text: '  [PASS] D9: 拆权限天花板（快照冻结）→ 回收后旧会话仍持 select:orders（越权窗口）；对照：同时创建的天花板会话判定时实时求值，同一时刻立即失去——不存在「上次办的工牌还能用」的窗口',
                color: theme.danger,
                bold: true,
                at: at('p5-13') - bD.from,
              },
            ]}
            width={1180}
          />
          <EvidenceBadge grade="lab" />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="5-E 自动贴标流水线">
        <SceneTag chapter="M7" tagline="分类与标签驱动策略传播" accent={theme.dig} />
        <Sequence
          from={at('p5-16') - bE.from}
          durationInFrames={at('p5-18') - at('p5-16')}
          name="5-E① 母图推近 · 装卸货码头贴标层"
        >
          <Stage top={320}>
            <MechZoom focus="tag" spanInFrames={at('p5-18') - at('p5-16')}>
              <AskCard
                at={0}
                kicker="进楼考验"
                body="海量新数据不断涌入 —— 谁来判定它们的密级？"
                width={520}
              />
              <IntakeBacklog at={at('p5-17') - at('p5-16')} span={dur('p5-17')} />
            </MechZoom>
          </Stage>
        </Sequence>
        <Sequence
          from={at('p5-18') - bE.from}
          durationInFrames={bE.durationInFrames - (at('p5-18') - bE.from)}
          name="5-E② 机密自动贴标流水线"
        >
          <Stage top={280}>
            <NumberedCard
              index={7}
              label="机密自动贴标系统"
              sub="发现 → 标记 → 执行"
              active
              accent={theme.dig}
              width={430}
            />
            <TagLine
              startAt={0}
              slideSpan={dur('p5-18')}
              linkAt={at('p5-20') - at('p5-18')}
              linkSpan={dur('p5-20')}
            />
          </Stage>
        </Sequence>
        <ArchifyRecap
          slug="classification-tagging"
          caption="发现 → 标记 → 执行"
          cues={[{chapterId: 'tag-driven', at: at('p5-19') - bE.from, durationInFrames: dur('p5-19')}]}
        />
      </Sequence>

      <Sequence {...bF} name="5-F 断链最后一环与代码走廊⑤">
        {/* top=320：代码走廊 5 行 + D10 长行折 2 行的纵向预算；且须低于 inset 画框底边 315 */}
        <Stage top={320}>
          <BrokenChain at={at('p5-21') - bF.from} leakAt={at('p5-23') - bF.from} />
          <CodeWalk
            title="M7 供给链 · 一次性映射（掩码策略不能直绑系统标签）"
            lines={[
              'TAG_MAPPING = {"CONTACT_INFO": "pii"}   # 一次性映射：系统标签 → 用户治理标签',
              'TAG_POLICY = {"pii": "MASK_FULL"}       # 用户标签 → 策略',
              'def policy_for(system_tags, table_name, col, mapping=TAG_MAPPING):',
              '    user_tag = mapping.get(system_tags.get((table_name, col)))',
              '    return TAG_POLICY.get(user_tag) if user_tag else None',
            ]}
            hi={[{line: 0, at: 16, color: theme.dig}, {line: 3, at: 26, color: theme.ok}]}
            caption="horizon_context_lab.py :805 内 :821"
            width={1220}
          />
          {/* 终端行 = selftest 原文逐字摘录（含前导两空格）；本镜纵向预算紧，不留 prompt 与 E3 行 */}
          <TerminalLog
            lines={[
              {
                text: '  [PASS] D10: 拆标签映射（只分类不绑策略）→ phone 已贴系统标签仍明文出楼——发现→标记→执行 链条断在最后一环',
                color: theme.danger,
                bold: true,
                at: at('p5-23') - bF.from,
              },
            ]}
            width={1220}
          />
        </Stage>
        <ArchifyRecap
          slug="classification-tagging"
          caption="未映射 = 显式保护缺口"
          variant="inset"
          cues={[{chapterId: 'explicit-gap', at: at('p5-23') - bF.from, durationInFrames: dur('p5-23')}]}
        />
      </Sequence>

      <Sequence {...bG} name="5-G 七柱合拢与听证会空白卡">
        <Stage top={360}>
          <ConflictHearing at={at('p5-29') - bG.from} />
          <div style={{marginTop: 26}}>
            <NumberClash
              badLabel="按热度自动选"
              bad="[6,1,2]"
              goodLabel="人工裁决后"
              good="[3,1,2]"
              at={at('p5-30') - bG.from}
            />
          </div>
        </Stage>
        <ArchifyRecap
          slug="collect-enrich-activate"
          caption="双轨富化与冲突浮出"
          variant="inset"
          cues={[{chapterId: 'enrich', at: at('p5-28') - bG.from, durationInFrames: dur('p5-28')}]}
        />
      </Sequence>

      <Sequence {...bH} name="5-H 四因子称重与标准插座">
        <Stage top={400}>
          <div style={{display: 'flex', gap: 70, alignItems: 'center'}}>
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 76}}>⚖️</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 12}}>
                问询处四因子称重
              </div>
            </div>
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 76}}>🔌</div>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 12}}>
                标准 MCP 开放接口
              </div>
            </div>
          </div>
        </Stage>
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="四因子信号排序"
          variant="inset"
          cues={[{chapterId: 'factors', at: at('p5-31') - bH.from, durationInFrames: dur('p5-31')}]}
        />
        <ArchifyRecap
          slug="open-interop"
          caption="受控工具面开放"
          variant="inset"
          // 与前一实例背靠背占同一位置：跳过入场弹簧，否则 p5-31→32 边界换图弹入
          lead={false}
          cues={[{chapterId: 'socket', at: at('p5-32') - bH.from, durationInFrames: dur('p5-32')}]}
        />
      </Sequence>

      {/* 跨 5-G/5-H 常驻：提到两镜之外单实例化，避免切镜处 HUD 消失再从 0 淡入闪一次 */}
      <PillarHUD lit={7} at={at('p5-26')} />
    </AbsoluteFill>
  );
};
