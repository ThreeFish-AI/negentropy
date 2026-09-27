/** P3 货签决定生死（p3-01..p3-11）——台账体制的软肋：好签差签并排（差签蒙灰
 *  〔M-002〕以静写闷）→ 何时用工艺·放大镜 → 近失配靶纸 → 别写满弹回 → 一套卷子。
 *  主色货签粉（货签=内容面）；正解/命中走引航青，红线走警示金，ok 仅勾中瞬间。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useFlowDash,
  useImpulse,
  useProgress,
  useSpring,
  useStagger,
} from '../motion';
import {StatRing, Stage} from '../components/devices';
import {Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {Pill} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

// ── 货签母题（本幕局部形态：吊牌 + 孔 + 描边恒走货签粉）─────────────────────

/** 货签卡：吊牌形（顶部签孔），粉描边为好签态；gray=true 差签蒙灰〔M-002〕
 *  ——降饱和 + 无勾 + 零强调动效，以静写闷。 */
const TagLabel: React.FC<{
  title: string;
  sub?: {label: string; text: string}[];
  gray?: boolean;
  checkOn?: number; // 0..1 勾选常驻基线（ok 仅验证瞬间）
  checkGlow?: number; // impulse 辉光
  width?: number;
  style?: React.CSSProperties;
}> = ({title, sub = [], gray = false, checkOn = 0, checkGlow = 0, width = 380, style}) => (
  <div
    style={{
      position: 'relative',
      width,
      borderRadius: 14,
      border: `2.5px solid ${gray ? theme.panelBorder : theme.conceptDeep}`,
      background: gray ? `${theme.panel}99` : `${theme.conceptDeep}10`,
      padding: '30px 26px 22px',
      filter: gray ? 'grayscale(0.8)' : undefined,
      opacity: gray ? 0.62 : 1,
      ...style,
    }}
  >
    {/* 签孔 */}
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 10,
        transform: 'translateX(-50%)',
        width: 15,
        height: 15,
        borderRadius: 8,
        border: `3px solid ${gray ? theme.panelBorder : theme.conceptDeep}`,
        background: theme.bg,
      }}
    />
    <div
      style={{
        fontFamily: theme.mono,
        fontSize: 19,
        color: gray ? theme.dim : theme.conceptDeep,
        marginBottom: 10,
      }}
    >
      description:
    </div>
    <div
      style={{
        fontFamily: theme.sans,
        fontSize: 29,
        fontWeight: 600,
        color: gray ? theme.dim : theme.text,
      }}
    >
      {title}
    </div>
    {sub.map((s) => (
      <div key={s.label} style={{marginTop: 9, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
        <span style={{color: gray ? theme.dim : theme.conceptDeep}}>{s.label}</span>
        {'：'}
        {s.text}
      </div>
    ))}
    {checkOn > 0 ? (
      <div
        style={{
          position: 'absolute',
          right: -15,
          top: -15,
          width: 36,
          height: 36,
          borderRadius: 18,
          border: `3px solid ${theme.ok}`,
          color: theme.ok,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontFamily: theme.mono,
          opacity: checkOn,
          boxShadow: `0 0 ${16 * Math.max(checkGlow, 0.001)}px ${theme.ok}`,
        }}
      >
        ✓
      </div>
    ) : null}
  </div>
);

// ── 3-A 好签差签 ─────────────────────────────────────────────────────────────

/** 分拣员视线：从右签上方扫过、不停留（低调 dim 线，扫过即走）。 */
const SightSweep: React.FC<{at: number; dur: number}> = ({at, dur}) => {
  const p = useProgress(at, dur, 'linear');
  const x = -170 + p * 700;
  const on = p > 0.02 && p < 0.98 ? 1 : 0;
  return (
    <div style={{position: 'absolute', left: 0, top: -78, height: 40, width: 540, opacity: on}}>
      <div style={{position: 'absolute', left: x, top: 12, display: 'flex', alignItems: 'center', gap: 8}}>
        <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>视线</div>
        <div style={{width: 88, height: 2.5, background: `${theme.dim}AA`, borderRadius: 2}} />
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderLeft: `9px solid ${theme.dim}AA`,
          }}
        />
      </div>
    </div>
  );
};

/** 3-A 两签并排：左签「做什么+何时用」勾中亮起；右签泛泛蒙灰，静默退化。 */
const LabelPairBoard: React.FC<{
  at: number;
  checkAt: number;
  sweepAt: number;
  sweepDur: number;
  silentAt: number;
}> = ({at, checkAt, sweepAt, sweepDur, silentAt}) => {
  const enter = useStagger(2, {at, dur: DUR.f5, stride: 10});
  const glow = useImpulse({at: checkAt, dur: DUR.f5, peak: 1});
  const frame = useCurrentFrame();
  const checkOn = progress(frame, checkAt, DUR.f4);
  const silent = progress(frame, silentAt, DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
      <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>一行货签 · 两条命</div>
      <div style={{display: 'flex', gap: 96, alignItems: 'flex-start', paddingTop: 56}}>
        <div style={{position: 'relative', opacity: enter[0], transform: `translateY(${(1 - enter[0]) * 20}px)`}}>
          <TagLabel
            title="清洗 CSV"
            sub={[
              {label: '做什么', text: '乱表洗净'},
              {label: '何时用', text: '导出前'},
            ]}
            checkOn={checkOn}
            checkGlow={glow}
          />
        </div>
        <div style={{position: 'relative', opacity: enter[1], transform: `translateY(${(1 - enter[1]) * 20}px)`}}>
          <SightSweep at={sweepAt} dur={sweepDur} />
          <TagLabel title="帮忙处理文档" gray />
          <div
            style={{
              marginTop: 14,
              textAlign: 'center',
              opacity: silent,
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.deny,
              letterSpacing: 2,
            }}
          >
            静默退化 · 无声
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 3-B 何时用 ───────────────────────────────────────────────────────────────

/** 3-B 放大镜工艺：镜下「何时用」子句高亮；用户气泡浮起 → 连线 → 勾中。 */
const IntentBoard: React.FC<{
  at: number;
  lensAt: number;
  hlAt: number;
  bubbleAt: number;
  linkAt: number;
  checkAt: number;
}> = ({at, lensAt, hlAt, bubbleAt, linkAt, checkAt}) => {
  const frame = useCurrentFrame();
  const enter = progress(frame, at, DUR.f5);
  const lens = useProgress(lensAt, DUR.f5, 'decelerate');
  const bubble = useSpring('settle', {at: bubbleAt, dur: DUR.f5});
  const bubbleO = progress(frame, bubbleAt, DUR.f4);
  const hl = progress(frame, hlAt, DUR.f4);
  const link = progress(frame, linkAt, DUR.f4);
  const checkOn = progress(frame, checkAt, DUR.f4);
  const glow = useImpulse({at: checkAt, dur: DUR.f5, peak: 1});
  const flow = useFlowDash({dash: 9, gap: 12, period: 34});
  // 大签几何：行 1 / 行 2 纵向位置（放大镜滑轨）
  const rowY1 = 118;
  const rowY2 = 172;
  const lensY = rowY1 + (rowY2 - rowY1) * lens;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: enter}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 24}}>
        <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text}}>货签工艺</div>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.conceptDeep}}>何时用</div>
      </div>
      <div style={{position: 'relative', width: 1400, height: 380}}>
        {/* 用户气泡：只说表象，不说关键词（opacity 缓动、位移弹簧） */}
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 96,
            opacity: bubbleO,
            transform: `translateY(${(1 - bubble) * 30}px)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              borderRadius: 14,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.panel,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                border: `2px solid ${theme.dim}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 15,
                color: theme.dim,
              }}
            >
              用户
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 27, color: theme.text}}>这表看着乱</div>
          </div>
        </div>
        {/* 连线：气泡 → 好签（流动虚线，勾中前成形） */}
        <svg width={380} height={120} style={{position: 'absolute', left: 380, top: 118, opacity: link}}>
          <line
            x1={6}
            y1={60}
            x2={366}
            y2={60}
            stroke={theme.conceptDeep}
            strokeWidth={2.5}
            strokeDasharray={`${flow.strokeDasharray}`}
            strokeDashoffset={flow.strokeDashoffset}
          />
          <polygon points="354,52 372,60 354,68" fill={theme.conceptDeep} />
        </svg>
        {/* 大签：放大镜 + 高亮子句 */}
        <div style={{position: 'absolute', left: 760, top: 24}}>
          <div style={{position: 'relative'}}>
            <TagLabel
              title="清洗 CSV"
              sub={[
                {label: '做什么', text: '乱表洗净'},
                {label: '何时用', text: '导出前'},
              ]}
              width={420}
              checkOn={checkOn}
              checkGlow={glow}
            />
            {/* 行 2 高亮框（放大镜对准时亮起） */}
            <div
              style={{
                position: 'absolute',
                left: 18,
                top: rowY2 - 22,
                width: 384,
                height: 46,
                borderRadius: 8,
                border: `2px solid ${theme.conceptDeep}`,
                background: `${theme.conceptDeep}${hl > 0.05 ? '22' : '00'}`,
                opacity: 0.25 + 0.75 * hl,
                boxShadow: `0 0 ${12 * hl}px ${theme.conceptDeep}55`,
              }}
            />
            {/* 放大镜：沿行 1 → 行 2 滑轨 */}
            <svg width={150} height={190} style={{position: 'absolute', left: -66, top: lensY - 74}}>
              <circle cx={75} cy={75} r={62} fill={`${theme.conceptDeep}0D`} stroke={theme.text} strokeWidth={5} />
              <line x1={118} y1={118} x2={146} y2={146} stroke={theme.text} strokeWidth={9} strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
      <Footnote delay={0}>{'没说关键词 · 也想起'}</Footnote>
    </div>
  );
};

// ── 3-C 近失配靶纸 ───────────────────────────────────────────────────────────

/** 3-C 靶纸三环：中心=正解（引航青）、近环=差一点（警示金）、外环=无关（淡出）。
 *  弹着点打在近环上——只有近失配，能逼出描述的边界。 */
const TargetBoard: React.FC<{enterAt: number; hitAt: number; fadeAt: number}> = ({
  enterAt,
  hitAt,
  fadeAt,
}) => {
  const frame = useCurrentFrame();
  const enter = progress(frame, enterAt, DUR.f5);
  const hitGlow = useImpulse({at: hitAt, dur: DUR.f4, peak: 1});
  const hitOn = progress(frame, hitAt, DUR.f3);
  const fade = progress(frame, fadeAt, DUR.f4);
  // 弹着点：近环右上弧（-35°）
  const cx = 310;
  const cy = 310;
  const hx = cx + 195 * Math.cos((-35 * Math.PI) / 180);
  const hy = cy + 195 * Math.sin((-35 * Math.PI) / 180);
  const legend: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontFamily: theme.sans,
    fontSize: 22,
    color: theme.text,
  };
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 90, opacity: enter}}>
      <div style={{position: 'relative', width: 620, height: 620}}>
        <svg width={620} height={620}>
          {/* 外环：无关（虚线，淡出弱化） */}
          <circle
            cx={cx}
            cy={cy}
            r={285}
            fill="none"
            stroke={theme.dim}
            strokeWidth={2.5}
            strokeDasharray="10 9"
            opacity={1 - fade * 0.72}
          />
          {/* 近环：差一点（警示金实线） */}
          <circle cx={cx} cy={cy} r={195} fill="none" stroke={theme.deny} strokeWidth={3} />
          {/* 中心：正解（引航青） */}
          <circle cx={cx} cy={cy} r={100} fill={`${theme.concept}12`} stroke={theme.concept} strokeWidth={3} />
          {/* 弹着点：弹孔常驻 + 冲击环脉冲 */}
          {hitOn > 0 ? (
            <>
              <circle cx={hx} cy={hy} r={16} fill="none" stroke={theme.deny} strokeWidth={3} opacity={hitGlow} />
              <circle cx={hx} cy={hy} r={6.5} fill={theme.deny} />
            </>
          ) : null}
        </svg>
        {/* 环标签 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 6,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.dim,
            opacity: 1 - fade * 0.75,
          }}
        >
          无关 · 天气
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 66,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.deny,
          }}
        >
          差一点 · 改个表格
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 288,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.concept,
          }}
        >
          正解 · 表格编辑
        </div>
      </div>
      {/* 图例：三环语义 */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 26}}>
        <div style={legend}>
          <div style={{width: 15, height: 15, borderRadius: 8, background: theme.concept}} />
          正解 · 别家签
        </div>
        <div style={legend}>
          <div style={{width: 15, height: 15, borderRadius: 8, background: theme.deny}} />
          差一点 · 本签边界
        </div>
        <div style={legend}>
          <div
            style={{
              width: 15,
              height: 15,
              borderRadius: 8,
              border: `2.5px solid ${theme.dim}`,
              opacity: 1 - fade * 0.7,
            }}
          />
          无关 · 剔除
        </div>
      </div>
    </div>
  );
};

// ── 3-D 别写满（货签膨胀 → 撞线弹回 → 收缩过关）────────────────────────────

const CLUTTER = ['Excel', '透视表', '爬虫', '周报', '合并单元格', '模板', '图表', '数据清洗'];

/** 3-D 单句装置：货签膨胀成大杂烩 → 撞 2% 标尺被弹回 → 收缩成精炼版过关。
 *  呼应 2-E 的同一条红线。 */
const OverstuffBoard: React.FC<{at: number; beatDur: number}> = ({at, beatDur}) => {
  const frame = useCurrentFrame();
  const growAt = at + Math.round(beatDur * 0.28);
  const hitAt = at + Math.round(beatDur * 0.52);
  const shrinkAt = at + Math.round(beatDur * 0.7);
  const passAt = at + Math.round(beatDur * 0.86);
  const enter = progress(frame, at, DUR.f5);
  const grow = useProgress(growAt, Math.max(10, hitAt - growAt), 'decelerate');
  const bounce = useSpring('snap', {at: hitAt, dur: DUR.f5});
  const shrink = useProgress(shrinkAt, Math.max(10, passAt - shrinkAt));
  const pass = progress(frame, passAt, DUR.f4);
  const passGlow = useImpulse({at: passAt, dur: DUR.f5, peak: 1});
  const flash = useImpulse({at: hitAt, dur: DUR.f4, peak: 1});
  const clutter = useStagger(CLUTTER.length, {at: growAt + 6, dur: DUR.f3, stride: 4});
  // 宽度：430 → 790（膨胀）→ 弹回微缩 → 440（收缩）；标尺线在 x=810
  const w = 430 + 360 * grow - 350 * shrink - 14 * bounce;
  const clutterOn = (i: number) => clutter[i] * (1 - shrink);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: enter}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <Pill color={theme.deny}>别写满</Pill>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>越泛 · 越易误触</div>
      </div>
      <div style={{position: 'relative', width: 1120, height: 470}}>
        {/* 2% 标尺：呼应 2-E 的同一条红线 */}
        <div
          style={{
            position: 'absolute',
            left: 810,
            top: 0,
            bottom: 40,
            borderLeft: `3px dashed ${theme.deny}`,
            boxShadow: `0 0 ${14 * flash}px ${theme.deny}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 822,
            top: -6,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.deny,
          }}
        >
          ≤2%
        </div>
        {/* 膨胀中的货签 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 40,
            width: w,
            borderRadius: 14,
            border: `2.5px solid ${grow > 0.02 && shrink < 0.5 ? theme.deny : theme.conceptDeep}`,
            background: `${grow > 0.02 && shrink < 0.5 ? theme.deny : theme.conceptDeep}10`,
            padding: '22px 24px 18px',
            transition: 'none',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.conceptDeep}}>description:</div>
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>清洗 CSV</div>
            {pass > 0 ? (
              <div
                style={{
                  marginLeft: 'auto',
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  border: `3px solid ${theme.ok}`,
                  color: theme.ok,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 18,
                  opacity: pass,
                  boxShadow: `0 0 ${14 * Math.max(passGlow, 0.001)}px ${theme.ok}`,
                }}
              >
                ✓
              </div>
            ) : null}
          </div>
          {/* 精炼两行：收缩后仍是主角 */}
          {[
            {label: '做什么', text: '乱表洗净'},
            {label: '何时用', text: '导出前'},
          ].map((s) => (
            <div key={s.label} style={{marginTop: 10, fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>
              <span style={{color: theme.conceptDeep}}>{s.label}</span>
              {'：'}
              {s.text}
            </div>
          ))}
          {/* 杂烩词条：膨胀期涌入、收缩期退场 */}
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16}}>
            {CLUTTER.map((c, i) => (
              <div
                key={c}
                style={{
                  padding: '6px 13px',
                  borderRadius: 7,
                  border: `2px solid ${theme.deny}99`,
                  color: theme.deny,
                  fontFamily: theme.sans,
                  fontSize: 18,
                  opacity: clutterOn(i),
                  transform: `scale(${0.85 + 0.15 * clutterOn(i)})`,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>
        {/* 误触发计数：随膨胀上涨 */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 200,
            textAlign: 'center',
            opacity: grow * (1 - shrink),
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 44, color: theme.deny}}>
            <Counter from={3} to={11} start={growAt} frames={Math.max(12, hitAt - growAt)} />
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>误触发</div>
        </div>
      </div>
    </div>
  );
};

// ── 3-E 一套卷子 ─────────────────────────────────────────────────────────────

/** 3-E 考卷：20 题×3 遍铺开 → 六四分档（练/考）→ 触发率环 → 冠军≠终版。 */
const ExamBoard: React.FC<{
  sheetAt: number;
  sheetWin: number;
  splitAt: number;
  scoreAt: number;
  champAt: number;
  quoteAt: number;
}> = ({sheetAt, sheetWin, splitAt, scoreAt, champAt, quoteAt}) => {
  const cells = useStagger(20, {at: sheetAt, dur: DUR.f3, fit: {total: Math.max(80, sheetWin)}});
  const frame = useCurrentFrame();
  const split = progress(frame, splitAt, DUR.f5);
  const champOn = progress(frame, champAt, DUR.f4);
  const champGlow = useImpulse({at: champAt, dur: DUR.f5, peak: 1});
  const quote = progress(frame, quoteAt, DUR.f5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
      {/* 金句（p3-09a 窗）：口播点题时压上 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 22,
          opacity: quote,
          transform: `translateY(${(1 - quote) * 14}px)`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.text, letterSpacing: 6}}>一套卷子</div>
        <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>六练 · 四考</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 70}}>
        {/* 考卷：20 题 grid，每题三遍（三小杠） */}
        <div>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginBottom: 10}}>
            tasks ×3 —— 20 题 · 每题三遍
          </div>
          {/* 六四分档条：左 60% 练（青）/ 右 40% 考（金 · 封存） */}
          <div style={{display: 'flex', width: 600, marginBottom: 14, opacity: 0.4 + 0.6 * split}}>
            <div
              style={{
                width: 360,
                padding: '7px 0',
                textAlign: 'center',
                borderRadius: '8px 0 0 8px',
                background: `${theme.concept}26`,
                border: `2px solid ${theme.concept}`,
                borderRight: 'none',
                fontFamily: theme.sans,
                fontSize: 18,
                color: theme.concept,
              }}
            >
              练 · 12 题
            </div>
            <div
              style={{
                width: 240,
                padding: '7px 0',
                textAlign: 'center',
                borderRadius: '0 8px 8px 0',
                background: `${theme.deny}1C`,
                border: `2px solid ${theme.deny}`,
                borderLeft: 'none',
                fontFamily: theme.sans,
                fontSize: 18,
                color: theme.deny,
              }}
            >
              考 · 8 题 封存
            </div>
          </div>
          <Panel accent={`${theme.concept}66`} style={{width: 600, padding: '16px 18px'}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10}}>
              {cells.map((p, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 7,
                    border: `2px solid ${theme.panelBorder}`,
                    padding: '7px 8px',
                    opacity: p,
                  }}
                >
                  <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{display: 'flex', gap: 3, marginTop: 5}}>
                    {[0, 1, 2].map((k) => (
                      <div key={k} style={{width: 12, height: 3.5, borderRadius: 2, background: `${theme.concept}99`}} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        {/* 右列：触发率环 + 两版货签（最优 ≠ 最后） */}
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
          <StatRing value={0.85} at={scoreAt} label="触发率" color={theme.concept} size={190} />
          <div style={{display: 'flex', gap: 26, alignItems: 'flex-start'}}>
            <div style={{position: 'relative'}}>
              <TagLabel title="清洗 CSV · v3" width={230} checkOn={champOn} checkGlow={champGlow} />
              <div
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.ok,
                  opacity: champOn,
                }}
              >
                冠军
              </div>
            </div>
            <div>
              <TagLabel title="清洗 CSV · v7" width={230} gray />
              <div
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 16,
                  color: theme.dim,
                }}
              >
                终版
              </div>
            </div>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.deny, opacity: champOn}}>
            最优 ≠ 最后
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 主组件 ───────────────────────────────────────────────────────────────────

export const P3: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-06');
  const bC = w('p3-07', 'p3-08');
  const bD = w('p3-08a');
  const bE = w('p3-09', 'p3-11');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A 好签差签">
        <SceneTag chapter="P3" tagline="货签决定生死" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
          ]}
        >
          <LabelPairBoard
            at={at('p3-01') - bA.from}
            checkAt={at('p3-02') - bA.from}
            sweepAt={at('p3-03') - bA.from + Math.round(dur('p3-03') * 0.3)}
            sweepDur={Math.round(dur('p3-03') * 0.4)}
            silentAt={at('p3-03') - bA.from + Math.round(dur('p3-03') * 0.62)}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="label-good-bad"
          caption="货签好坏 · 静默退化"
          cues={[
            {chapterId: 'lb-pair', at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {chapterId: 'lb-silent', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 何时用">
        <SceneTag chapter="P3" tagline="货签决定生死" accent={theme.conceptDeep} />
        <ArchifyYield cues={[{at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')}]}>
          <IntentBoard
            at={at('p3-05') - bB.from}
            lensAt={at('p3-05') - bB.from + Math.round(dur('p3-05') * 0.12)}
            hlAt={at('p3-05') - bB.from + Math.round(dur('p3-05') * 0.38)}
            bubbleAt={at('p3-05') - bB.from + Math.round(dur('p3-05') * 0.55)}
            linkAt={at('p3-06') - bB.from}
            checkAt={at('p3-06') - bB.from + Math.round(dur('p3-06') * 0.4)}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="label-good-bad"
          caption="货签好坏 · 静默退化"
          cues={[{chapterId: 'lb-intent', at: at('p3-06') - bB.from, durationInFrames: dur('p3-06')}]}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 近失配靶纸">
        <SceneTag chapter="P3" tagline="货签决定生死" accent={theme.conceptDeep} />
        <ArchifyYield cues={[{at: at('p3-08') - bC.from, durationInFrames: dur('p3-08')}]}>
          <TargetBoard
            enterAt={at('p3-07') - bC.from}
            hitAt={at('p3-08') - bC.from + Math.round(dur('p3-08') * 0.3)}
            fadeAt={at('p3-08') - bC.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="routing-eval-protocol"
          caption="练签协议 · 考与盲评"
          cues={[{chapterId: 're-nearmiss', at: at('p3-08') - bC.from, durationInFrames: dur('p3-08')}]}
        />
        <Footnote delay={at('p3-07') - bC.from + Math.round(dur('p3-07') * 0.6)}>
          {'差一点 · 照出边界'}
        </Footnote>
      </Sequence>

      <Sequence {...bD} name="3-D 别写满">
        <SceneTag chapter="P3" tagline="货签决定生死" accent={theme.conceptDeep} />
        <Stage>
          <OverstuffBoard at={at('p3-08a') - bD.from} beatDur={dur('p3-08a')} />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="3-E 一套卷子">
        <SceneTag chapter="P3" tagline="货签决定生死" accent={theme.conceptDeep} />
        <ArchifyYield
          cues={[
            {at: at('p3-09') - bE.from, durationInFrames: dur('p3-09')},
            {at: at('p3-10') - bE.from, durationInFrames: dur('p3-10')},
            {at: at('p3-11') - bE.from, durationInFrames: dur('p3-11')},
          ]}
        >
          <ExamBoard
            sheetAt={at('p3-09') - bE.from}
            sheetWin={dur('p3-09')}
            splitAt={at('p3-10') - bE.from}
            scoreAt={at('p3-10') - bE.from + Math.round(dur('p3-10') * 0.35)}
            champAt={at('p3-11') - bE.from}
            quoteAt={at('p3-09a') - bE.from}
          />
        </ArchifyYield>
        <ArchifyRecap
          slug="routing-eval-protocol"
          caption="练签协议 · 考与盲评"
          cues={[
            {chapterId: 're-protocol', at: at('p3-09') - bE.from, durationInFrames: dur('p3-09')},
            {chapterId: 're-holdout', at: at('p3-10') - bE.from, durationInFrames: dur('p3-10')},
            {chapterId: 're-interview', at: at('p3-11') - bE.from, durationInFrames: dur('p3-11')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
