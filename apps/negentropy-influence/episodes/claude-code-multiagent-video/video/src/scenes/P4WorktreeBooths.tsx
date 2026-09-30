/** P4 隔间（p4-01..21，4 镜 11 cue）——分镜 4-A…4-D。
 *
 *  叙事链：覆盖事故（同目录双写，后写盖先写）→ 隔间拓扑（worktree-bind 六章
 *  全屏接力）→ 拆除守卫（worktree-teardown 五章接力，与前图跨镜背靠背 ⇒
 *  后挂实例关入场）→ 双重校准卡 ×2（强度：门体变厚锁死 + Lottie door-lock
 *  脉冲；关系：编号绳剪断）。
 *  空间契约：事故卡居中（公共目录），校准装置居中、对照卡左右对开；传送带
 *  母题（core 橙〔M-001〕）4-A 左下一现，「加机制」动效不触碰内核图形。
 *  用色纪律：人（两师傅剪影）一律无彩（text 白 / dim 灰）；后写覆盖的红闪、
 *  绳子剪断走 deny（拒绝/危险唯一语义）；门体锁死 = 产品拦截，同走 deny。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  useBreathe,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useStagger,
} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，由 Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** theme 色 + α（hex 后缀形态）：deny 走 token 而非 rgba 十进制复写——改值不漂移、
 *  撞色登记口径可清点（P6Finale 同款工具） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 传送带巡游节律：2.5s/圈（全片同值） */
const LAP_FRAMES = 75;

/** 左中锚位内核（恒定锚 + 匀速巡游光点；锁芯恒静＝环不动，只有光点在走） */
const KernelCore: React.FC<{size: number; left: number; top: number; span: number}> = ({
  size,
  left,
  top,
  span,
}) => {
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  return (
    <div style={{position: 'absolute', left, top}}>
      <LoopRing size={size} dotProgress={laps} showLabels={false} showExit={false} />
    </div>
  );
};

/** 师傅剪影——text 白无彩（人一律无彩） */
const Person: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.88,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={theme.text} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
  </svg>
);


// ── 4-D 锁死瞬间强调（原生，替代 Lottie door-lock）────────────────────────
/** deny 门栓落下 + 双环扩散锁定：一次性强脉冲（impulse 手感），随后静置锁死态。 */
const LockStrike: React.FC<{at: number; cx: number; cy: number}> = ({at, cx, cy}) => {
  const drop = useProgress(at, DUR.f3);
  const ring1 = useProgress(at + 2, DUR.f5);
  const ring2 = useProgress(at + 5, DUR.f5);
  const r1 = 18 + ring1 * 84, o1 = 0.9 * (1 - ring1);
  const r2 = 12 + ring2 * 58, o2 = 0.6 * (1 - ring2);
  return (
    <svg width={280} height={280} style={{position: 'absolute', left: cx - 140, top: cy - 140, opacity: 0.95}}>
      <circle cx={140} cy={140} r={r1} fill="none" stroke={theme.deny} strokeWidth={5} opacity={o1} />
      <circle cx={140} cy={140} r={r2} fill="none" stroke={theme.deny} strokeWidth={3} opacity={o2} />
      {/* 门栓：从上方砸落穿环 */}
      <g transform={`translate(0 ${(1 - drop) * -46})`}>
        <rect x={122} y={128} width={36} height={10} rx={3} fill={theme.deny} opacity={drop} />
        <rect x={130} y={98} width={20} height={32} rx={4} fill={theme.deny} opacity={drop} />
      </g>
      {drop >= 1 && <circle cx={140} cy={140} r={10} fill={theme.deny} />}
    </svg>
  );
};

// ── 4-A 覆盖事故（p4-01..03） ────────────────────────────────────────────

/** 公共目录里的同一文件：A（认证·左）先写、B（登录页·右）后写盖掉 */
const FILE_ROWS = [
  {text: 'auth_token = ...', who: 0},
  {text: 'login_ui = ...', who: 1},
  {text: 'session_ttl = ...', who: 0},
  {text: 'redirect = ...', who: 1},
] as const;

/** B 的一记后写：落在 A 的首行上（后写盖先写——行主翻色 + deny 红闪） */
const OVERWRITE_TEXT = 'login_path = ...';

const OverwriteAccident: React.FC<{atWrite: number; atOver: number; atStuck: number; span: number}> = ({
  atWrite,
  atOver,
  atStuck,
  span,
}) => {
  const dirIn = useEnter('fade', {at: 2, dur: DUR.f5});
  const persons = useStagger(2, {at: 2 + DUR.f4, stride: 10, dur: DUR.f4});
  // 逐行落笔（p4-02「前后脚写同一文件」）：固定四行 useReveal，不入 map
  const r0 = useReveal(FILE_ROWS[0].text, {at: atWrite, cps: 16});
  const r1 = useReveal(FILE_ROWS[1].text, {at: atWrite + 8, cps: 16});
  const r2 = useReveal(FILE_ROWS[2].text, {at: atWrite + 16, cps: 16});
  const r3 = useReveal(FILE_ROWS[3].text, {at: atWrite + 24, cps: 16});
  const rows = [r0, r1, r2, r3];
  // 后写盖先写：行主翻色（progress）+ deny 红闪（impulse 包络）
  const over = useProgress(atOver, DUR.f4);
  const flash = useImpulse({at: atOver, dur: DUR.f6});
  const overRow = useReveal(OVERWRITE_TEXT, {at: atOver + 2, cps: 20});
  // 回滚困境卡（p4-03）：抖动后停驻
  const stuck = useEnter('rise', {at: atStuck, dur: DUR.f5, dist: 30, restBottom: 730});
  const stuckShake = useShake({at: atStuck + DUR.f5, decay: true, amp: 5, dur: DUR.f6});
  const qMark = useProgress(atStuck + DUR.f5, DUR.f4);

  return (
    <AbsoluteFill>
      <KernelCore size={130} left={110} top={706} span={span} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...dirIn}}>
        {/* 公共目录事故卡（居中）：文件名即角标（不口播） */}
        <div style={{position: 'absolute', left: 660, top: 240}}>
          <Panel accent={theme.panelBorder} style={{width: 600, boxSizing: 'border-box', padding: '18px 26px'}}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 16,
                paddingBottom: 10,
                borderBottom: `2px solid ${theme.panelBorder}`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'config.py'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, opacity: 0.7}}>
                {'公共目录'}
              </span>
            </div>
            <div style={{marginTop: 14, fontFamily: theme.mono, fontSize: 25, lineHeight: 1.9}}>
              {rows.map((ln, i) => {
                const overwritten = i === 0 && over > 0.5;
                const who = overwritten ? 1 : FILE_ROWS[i].who;
                const shown = overwritten ? overRow : ln;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      color: who === 0 ? theme.text : theme.dim,
                      whiteSpace: 'pre',
                      background:
                        i === 0 && flash > 0.02 && over > 0.02
                          ? withAlpha(theme.deny, 0.06 + 0.16 * flash)
                          : 'transparent',
                      borderRadius: 6,
                      paddingLeft: 6,
                    }}
                  >
                    <span style={{fontSize: 17, opacity: 0.55}}>{who === 0 ? 'A' : 'B'}</span>
                    <span>{shown || ' '}</span>
                    {overwritten ? (
                      <span
                        style={{
                          fontSize: 20,
                          color: theme.deny,
                          opacity: qMark,
                          marginLeft: 'auto',
                        }}
                      >
                        {'?'}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* 两师傅剪影：左＝认证（先写），右＝登录页（后写） */}
        <div style={{position: 'absolute', left: 236, top: 330, opacity: persons[0]}}>
          <Person x={0} y={40} scale={1} />
          <div style={{position: 'absolute', left: 4, top: 0}}>
            <Panel style={{padding: '6px 16px'}}>
              <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.text}}>{'认证'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginLeft: 8}}>{'A'}</span>
            </Panel>
          </div>
        </div>
        <div style={{position: 'absolute', left: 1520, top: 330, opacity: persons[1]}}>
          <Person x={0} y={40} scale={1} />
          <div style={{position: 'absolute', left: 4, top: 0}}>
            <Panel accent={theme.panelBorder} style={{padding: '6px 16px'}}>
              <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>{'登录页'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginLeft: 8}}>{'B'}</span>
            </Panel>
          </div>
        </div>

        {/* 回滚困境卡：分不清谁的改动（抖动后停驻〔M-003〕） */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...stuck}}>
          <div style={{position: 'absolute', left: 0, top: 640, width: 1920, transform: `translateX(${stuckShake}px)`}}>
            <div style={{display: 'flex', justifyContent: 'center'}}>
              <Panel accent={theme.deny} style={{padding: '14px 34px'}}>
                <span style={{fontFamily: theme.serif, fontSize: 36, fontWeight: 700, color: theme.deny}}>
                  {'分不清谁的改动'}
                </span>
                <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 18}}>
                  {'rollback ?'}
                </span>
              </Panel>
            </div>
          </div>
        </div>
      </div>
      <Footnote delay={2}>{'config.py · double write'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-D① 强度对照（p4-15..18）：帘门 → 铁门锁死 ────────────────────────

/** 门体装置（居中）：thick 0..1＝帘门(dim 虚线·呼吸摆动)→铁门(deny 加粗·门栓锁死)。
 *  形变由场景侧 useProgress 驱动（分镜动效分工），Lottie door-lock 只做锁死脉冲。 */
const DOOR = {left: 860, top: 300, w: 200, h: 300} as const;

const DoorGlyph: React.FC<{thick: number; sway: number}> = ({thick, sway}) => {
  const bolt = clamp01((thick - 0.62) / 0.38);
  return (
    <div style={{position: 'absolute', left: DOOR.left, top: DOOR.top, width: DOOR.w, height: DOOR.h}}>
      <svg width={DOOR.w} height={DOOR.h}>
        {/* 门框（dim 静置） */}
        <rect x={8} y={8} width={184} height={284} rx={10} fill="none" stroke={theme.dim} strokeWidth={5} />
        {/* 帘门层：薄虚线，绕左合页轻摆（1-thick 随铁化淡出） */}
        <g opacity={1 - thick}>
          <rect
            x={34}
            y={34}
            width={132}
            height={232}
            rx={6}
            fill="none"
            stroke={theme.dim}
            strokeWidth={3}
            strokeDasharray="10 9"
            transform={`rotate(${sway * 2.6} 34 150)`}
            opacity={0.8}
          />
        </g>
        {/* 铁门层：deny 加粗描边 + 低透明填充（面色不烧成实心亮块） */}
        <rect
          x={34}
          y={34}
          width={132}
          height={232}
          rx={4}
          fill={theme.deny}
          fillOpacity={0.1 * thick}
          stroke={theme.deny}
          strokeOpacity={thick}
          strokeWidth={4 + 8 * thick}
        />
        {/* 门栓：自左立柱射出（bolt 0→1）；右侧锁扣静置 */}
        <rect x={150} y={136} width={16} height={28} rx={3} fill="none" stroke={theme.deny} strokeWidth={4} strokeOpacity={thick} />
        <rect x={34} y={143} width={Math.round(116 * bolt)} height={14} rx={3} fill={theme.deny} opacity={thick} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: DOOR.h + 12,
          width: DOOR.w,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 24,
          fontWeight: 600,
          color: thick > 0.55 ? theme.deny : theme.dim,
          opacity: 0.5 + 0.5 * Math.max(thick, 1 - thick),
        }}
      >
        {thick > 0.55 ? '铁门 · 锁死' : '薄帘门'}
      </div>
    </div>
  );
};

/** 校准题头：两枚编号 chip（01 强度 / 02 关系）——② 开场时换亮 */
const CalibHeader: React.FC<{atRel: number}> = ({atRel}) => {
  const inAll = useEnter('fade', {at: 2, dur: DUR.f5});
  const two = useProgress(atRel, DUR.f4);
  const chip = (label: string, on: number) => (
    <div
      style={{
        width: 220,
        textAlign: 'center',
        padding: '8px 0',
        borderRadius: 999,
        border: `2px solid ${on > 0.5 ? theme.mech : theme.panelBorder}`,
        background: on > 0.5 ? theme.mechDeep : theme.panel,
        fontFamily: theme.sans,
        fontSize: 25,
        fontWeight: 600,
        color: on > 0.5 ? theme.mech : theme.dim,
        opacity: 0.45 + 0.55 * on,
      }}
    >
      {label}
    </div>
  );
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, ...inAll}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 148,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 38,
          fontWeight: 700,
          color: theme.text,
        }}
      >
        {'隔间 · 两处口径'}
      </div>
      <div style={{position: 'absolute', left: 0, top: 212, width: 1920, display: 'flex', justifyContent: 'center', gap: 40}}>
        {chip('01 强度', 1 - two)}
        {chip('02 关系', two)}
      </div>
    </div>
  );
};

const PhaseStrength: React.FC<{atTeach: number; atIron: number; atBlock: number}> = ({
  atTeach,
  atIron,
  atBlock,
}) => {
  const teach = useEnter('slideL', {at: atTeach, dur: DUR.f5, dist: 60});
  const official = useEnter('slideR', {at: atIron, dur: DUR.f5, dist: 60});
  // 门体变厚锁死（@progress）：帘门呼吸 → 铁门 deny 加粗 + 门栓
  const iron = useProgress(atIron, DUR.f6, 'decelerate');
  const sway = useBreathe({period: 44, amp: 0.4, base: 0.6});
  // 官方引语逐字（@reveal，mono 引语态）
  const quote = useReveal("You can't turn this check off", {at: atIron + DUR.f4, cps: 15});
  const quoteZh = useProgress(atIron + DUR.f5 + DUR.f4, DUR.f4);
  // p4-18 拦下：编辑/命令两卡撞在锁死门上
  const block = useProgress(atBlock, DUR.f5, 'decelerate');
  const hit = useImpulse({at: atBlock + DUR.f5, dur: DUR.f5});
  const thesis = useProgress(atBlock + DUR.f4, DUR.f4);

  const blockedChip = (label: string, i: number) => {
    const x = 1700 + i * 40 - (1700 + i * 40 - 1085 - i * 20) * clamp01(block);
    return (
      <div
        style={{
          position: 'absolute',
          left: x,
          top: 648 + i * 8,
          padding: '8px 22px',
          borderRadius: 10,
          border: `3px solid ${theme.deny}`,
          background: withAlpha(theme.deny, 0.05 + 0.18 * clamp01(hit)),
          fontFamily: theme.sans,
          fontSize: 24,
          fontWeight: 600,
          color: theme.text,
        }}
      >
        {label}
      </div>
    );
  };

  return (
    <AbsoluteFill>
      {/* 教学版（左，slideL）：换的是落笔位置 */}
      <div style={{position: 'absolute', left: 150, top: 330, ...teach}}>
        <Panel style={{width: 560, boxSizing: 'border-box', padding: '22px 30px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'教学版'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'wt_ctx'}</span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text, marginTop: 22}}>
            {'换的是落笔位置'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginTop: 18}}>
            {'工具挪进各自目录'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 12, opacity: 0.75}}>
            {'cwd switch · directory level'}
          </div>
        </Panel>
      </div>

      {/* 门体（居中）：帘门呼吸 → 铁门锁死 */}
      <DoorGlyph thick={clamp01(iron)} sway={sway} />
      {/* 锁死瞬间强调（原 Lottie door-lock 在 headless ANGLE 渲染确定性挂死——ep4 clock-swing
          同款根因，崩点 17308 实证；改原生门栓锁死：deny 落栓 + 双环扩散，运动层铁律零资产依赖） */}
      <LockStrike at={atIron + DUR.f5} cx={DOOR.left + DOOR.w / 2} cy={DOOR.top + 240} />

      {/* 产品（右，slideR）：官方引语卡（mono 引语态） */}
      <div style={{position: 'absolute', left: 1210, top: 330, ...official}}>
        <Panel accent={theme.deny} style={{width: 560, boxSizing: 'border-box', padding: '22px 30px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'产品'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'官方文档'}</span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 27, color: theme.text, marginTop: 22, whiteSpace: 'pre', minHeight: 76}}>
            {`"${quote}"`}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.deny, marginTop: 14, opacity: quoteZh}}>
            {'工具调用层 · 硬阻断'}
          </div>
        </Panel>
      </div>

      {/* p4-18 拦下：编辑 / 命令两卡撞门即停（deny 闪） */}
      {blockedChip('编辑', 0)}
      {blockedChip('命令', 1)}

      {/* 题词定格（p4-18 记忆点⑭；caption-dup-ok: 记忆点标签，主字已压短非逐字） */}
      <div style={{position: 'absolute', left: 360, top: 730, width: 1200, height: 180, opacity: thesis}}>
        <QuoteCard zh="硬阻断 · 关不掉" />
      </div>
    </AbsoluteFill>
  );
};

// ── 4-D② 关系对照（p4-19..21）：编号绳剪断 ──────────────────────────────

const PhaseRelation: React.FC<{atOpen: number; atCut: number}> = ({atOpen, atCut}) => {
  const teach = useEnter('slideL', {at: atOpen, dur: DUR.f5, dist: 60});
  const official = useEnter('slideR', {at: atOpen + DUR.f3, dur: DUR.f5, dist: 60});
  // 绳子剪断（@impulse deny）+ 断口分离（教学版独有绑法被剪开）
  const cut = useProgress(atCut, DUR.f5, 'decelerate');
  const flash = useImpulse({at: atCut, dur: DUR.f5});
  const zero = useProgress(atCut + DUR.f5, DUR.f4);
  // svg 局部坐标（svg 500×170）：任务卡左、隔间卡右，绳在两卡之间（y 85）
  const ROPE_Y = 85;
  const HALF_W = 72;

  return (
    <AbsoluteFill>
      {/* 教学版（左，slideL）：任务 —编号绳— 隔间（独有绑法；末句剪断） */}
      <div style={{position: 'absolute', left: 150, top: 330, ...teach}}>
        <Panel style={{width: 560, boxSizing: 'border-box', padding: '22px 30px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'教学版'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.mech}}>{'独有绑法'}</span>
          </div>
          <svg width={500} height={170} style={{marginTop: 18}}>
            {/* 任务卡 */}
            <rect x={10} y={50} width={130} height={70} rx={10} fill={theme.panel} stroke={theme.mech} strokeWidth={3} />
            {/* 隔间卡（带门牌条） */}
            <rect x={360} y={50} width={130} height={70} rx={10} fill={theme.panel} stroke={theme.mech} strokeWidth={3} />
            <rect x={380} y={40} width={90} height={18} rx={5} fill={theme.mechDeep} stroke={theme.mech} strokeWidth={2} />
            {/* 绳：cut 前一根整绳；cut 后两半各自垂落（断口 = 分离的产物） */}
            <g opacity={1 - clamp01(cut)}>
              <line x1={140} y1={ROPE_Y} x2={360} y2={ROPE_Y} stroke={theme.text} strokeWidth={5} />
            </g>
            <g opacity={clamp01(cut)}>
              <line
                x1={140}
                y1={ROPE_Y}
                x2={140 + HALF_W}
                y2={ROPE_Y + 26 * clamp01(cut)}
                stroke={theme.dim}
                strokeWidth={5}
                strokeLinecap="round"
              />
              <line
                x1={360}
                y1={ROPE_Y}
                x2={360 - HALF_W}
                y2={ROPE_Y + 26 * clamp01(cut)}
                stroke={theme.dim}
                strokeWidth={5}
                strokeLinecap="round"
              />
              {/* 剪断闪（deny）+ 断口叉 */}
              <text
                x={250}
                y={ROPE_Y + 14}
                textAnchor="middle"
                fontFamily={theme.sans}
                fontSize={40}
                fontWeight={700}
                fill={theme.deny}
                opacity={clamp01(flash) * (1 - clamp01(zero) * 0.5)}
              >
                {'✕'}
              </text>
            </g>
            <text x={75} y={92} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.text}>
              {'任务'}
            </text>
            <text x={425} y={92} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.text}>
              {'隔间'}
            </text>
            <text x={250} y={ROPE_Y - 14} textAnchor="middle" fontFamily={theme.mono} fontSize={19} fill={theme.dim}>
              {'ID'}
            </text>
          </svg>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginTop: 10}}>
            {'任务和隔间 · 绑死'}
          </div>
        </Panel>
      </div>

      {/* 官方（右，slideR）：负证据卡（dim 虚线框——查无此项） */}
      <div style={{position: 'absolute', left: 1210, top: 330, ...official}}>
        <Panel
          accent={theme.dim}
          style={{
            width: 560,
            boxSizing: 'border-box',
            padding: '22px 30px',
            borderStyle: 'dashed',
          }}
        >
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.dim}}>{'官方'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'agent-teams'}</span>
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.dim, marginTop: 24}}>
            {'不提隔间'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 22}}>
            {'两套机制 · 分开'}
          </div>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 21,
              color: theme.dim,
              marginTop: 14,
              opacity: 0.5 + 0.5 * clamp01(zero),
            }}
          >
            {'官方零记载'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4WorktreeBooths: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-03');
  const bB = w('p4-04', 'p4-09');
  const bC = w('p4-10', 'p4-14');
  const bD = w('p4-15', 'p4-21');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 覆盖事故">
        <SceneTag chapter="worktree" tagline="隔间" />
        <OverwriteAccident
          atWrite={at('p4-02') - bA.from}
          atOver={at('p4-02') - bA.from + DUR.f6}
          atStuck={at('p4-03') - bA.from}
          span={bA.durationInFrames}
        />
      </Sequence>

      <Sequence {...bB} name="4-B 隔间拓扑">
        {/* 本幕首个回放实例（前一 cue 在 P3 末，隔 4-A 整镜空窗）⇒ 默认入场 */}
        <ArchifyRecap
          slug="worktree-bind"
          caption="隔间绑定"
          cues={[
            {chapterId: 'booth-per-task', at: at('p4-04') - bB.from, durationInFrames: dur('p4-04')},
            {chapterId: 'copies-branches', at: at('p4-05') - bB.from, durationInFrames: dur('p4-05')},
            {chapterId: 'id-rope', at: at('p4-06') - bB.from, durationInFrames: dur('p4-06')},
            {chapterId: 'bind-no-status', at: at('p4-07') - bB.from, durationInFrames: dur('p4-07')},
            {chapterId: 'pre-arrange', at: at('p4-08') - bB.from, durationInFrames: dur('p4-08')},
            {chapterId: 'auto-switch', at: at('p4-09') - bB.from, durationInFrames: dur('p4-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 拆除守卫">
        {/* auto-switch（p4-09 末帧）⇄ default-keep（p4-10 首帧）跨镜换图背靠背 ⇒ 关入场 */}
        <ArchifyRecap
          slug="worktree-teardown"
          caption="拆除守卫"
          lead={false}
          cues={[
            {chapterId: 'default-keep', at: at('p4-10') - bC.from, durationInFrames: dur('p4-10')},
            {chapterId: 'dirty-refuse', at: at('p4-11') - bC.from, durationInFrames: dur('p4-11')},
            {chapterId: 'unknown-refuse', at: at('p4-12') - bC.from, durationInFrames: dur('p4-12')},
            {chapterId: 'discard-with-branch', at: at('p4-13') - bC.from, durationInFrames: dur('p4-13')},
            {chapterId: 'keep-for-review', at: at('p4-14') - bC.from, durationInFrames: dur('p4-14')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="4-D 双重校准">
        <CalibHeader atRel={at('p4-19') - bD.from} />
        <Sequence from={0} durationInFrames={at('p4-19') - bD.from} name="4-D 强度对照">
          <PhaseStrength
            atTeach={at('p4-16') - bD.from}
            atIron={at('p4-17') - bD.from}
            atBlock={at('p4-18') - bD.from}
          />
        </Sequence>
        <Sequence from={at('p4-19') - bD.from} name="4-D 关系对照">
          <PhaseRelation atOpen={0} atCut={at('p4-21') - at('p4-19')} />
        </Sequence>
        <Footnote delay={0}>{'isolation: worktree · You can\'t turn this check off'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4WorktreeBooths;
