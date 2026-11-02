/** P0 万能的手没有形状（p0-01..p0-07，3 镜）——分镜 0-A / 0-B / 0-C（storyboard v1）。
 *
 *  ★ 0-A 开篇视听合力（I-039）：系列片头交棒后冷启动直入——终端窗居中偏上 +
 *    一双灰色手掌摊开托住窗（A#1 承接：这双手）；p0-01「拼咒语」词落位第一条
 *    命令逐字打出、掌缘灰光随之一沉〔M-005〕；p0-02「一件」词落位 bash 单卡
 *    贴上掌心（唯一家什，其余指缝空置）。
 *  ★ 0-B 窗推近三条命令逐条占位：p0-03「读／写／改」三词各落位一条命令行长成
 *    （stagger；第三条拼到窗口右缘折行）；p0-04「想的是」词落位意图气泡浮起
 *    （文件图标 +「读」动作小签）、「说出口的」词落位灰连线绷直——上想下说
 *    对照成型。
 *  ★ 0-C 翻译层特写：灰色「翻译层」箭头压上命令行（意图端 → 长串字符端）；
 *    p0-05「费钱粮」计数小卡弹出又收起、「拼错」字符错位闪珊瑚红、整条划掉
 *    作废；p0-06「没有形状」三条命令褪色成无差别灰串（读/写标签溶解、程序
 *    观察位图标一现）；p0-07「长出更多的手」指缝透出五道琥珀光缝依次点亮、
 *    「各有名字」每道光缝浮出空白名牌轮廓（不显字——1→5 生长留给 1 幕）、
 *    bash 卡滑向拇指位；镜尾拉回双手全貌（P1 承接位）。
 *  ★ 署源角标（首部署源位，RSI I-080）：右下常驻「Learn Claude Code」，一次
 *    淡入后全幕恒定不闪烁（挂镜 Sequence 外）。
 *  ★ Visual Lock：命令词全进角标不放大字（命令行 mono 小号）；光缝只亮轮廓、
 *    名牌不显字；翻译层箭头灰调（非契约主色）；手的拟人动作止于「托住/摊开」。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel, Terminal} from '../components/motifs';
import {DUR, clamp01, useEnter, useImpulse, useProgress, usePushIn, useReveal} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** hex + 动态透明度（帧驱动，无随机；effects 通道恒不过冲） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位）：右下常驻，一次淡入后恒定不抢焦；bottom 168 ≥ 150
 *  避开字幕条（承 ep1 SourceCredit 形态） */
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

/** 摊开的手掌（灰色＝能力受限前的「万能」态；机械简笔：掌 + 四指 + 拇指）。
 *  五指指位（x 相对 cx）：食 -175 / 中 -75 / 无名 +25 / 小 +125；拇指左倾。
 *  光缝位（指缝五道）：-225 / -125 / -25 / +75 / +175。 */
const FINGERS = [
  {x: -175, len: 185},
  {x: -75, len: 215},
  {x: 25, len: 190},
  {x: 125, len: 140},
] as const;
const SLITS = [-225, -125, -25, 75, 175] as const;

const PalmHand: React.FC<{
  cx: number;
  cy: number;
  glow?: number;
  sink?: number;
  opacity?: number;
}> = ({cx, cy, glow = 0, sink = 0, opacity = 1}) => (
  <svg
    width={620}
    height={420}
    viewBox="-310 -170 620 420"
    style={{position: 'absolute', left: cx - 310, top: cy - 170, overflow: 'visible', opacity}}
  >
    <g transform={`translate(0 ${sink})`}>
      {/* 掌缘灰光（「掌缘灰光随之一沉」的具象：随打字进度显形的低饱和辉光） */}
      <g opacity={glow} filter="none">
        <rect x={-240} y={-70} width={480} height={190} rx={40} fill="none" stroke={theme.dim} strokeWidth={22} opacity={0.28} />
      </g>
      {/* 掌：圆角矩形描边 */}
      <rect x={-240} y={-70} width={480} height={190} rx={40} fill={theme.bg} stroke={theme.dim} strokeWidth={5} />
      {/* 四指：圆角竖条描边（掌顶 y=-70 向上） */}
      {FINGERS.map((f) => (
        <rect
          key={f.x}
          x={f.x - 23}
          y={-70 - f.len}
          width={46}
          height={f.len + 44}
          rx={23}
          fill={theme.bg}
          stroke={theme.dim}
          strokeWidth={5}
        />
      ))}
      {/* 拇指：左倾圆角条（掌左缘外伸） */}
      <g transform={`translate(${-258} ${-16}) rotate(36)`}>
        <rect x={-25} y={-155} width={50} height={170} rx={25} fill={theme.bg} stroke={theme.dim} strokeWidth={5} />
      </g>
    </g>
  </svg>
);

// ── 0-A 冷启动：终端 + 双手托窗 ────────────────────────────────────────

/** p0-01 读命令（首条咒语——引号套路径的读） */
const CMD_A = 'cat "./notes/plan.md"';

const ZeroA: React.FC<{atType: number; atBash: number}> = ({atType, atBash}) => {
  const termIn = useEnter('rise', {at: 0, dur: DUR.f5, dist: 22});
  const handIn = useEnter('rise', {at: DUR.f2, dur: DUR.f5, dist: 26});
  // 打字进度 → 掌缘灰光显形 + 掌整体轻沉（「掌缘灰光随之一沉」）
  const typed = useProgress(atType, 40, 'linear');
  const glow = 0.55 * typed;
  const sink = 8 * typed;
  const bash = useEnter('pop', {at: atBash, dur: DUR.f4, springPreset: 'settle'});
  return (
    <AbsoluteFill>
      {/* ⑨ QA W1：手掌垫到终端窗后（原画在窗上、指尖伸进窗内盖住命令区）；
          cy 795→765 使掌缘下沿 885，距字幕盒顶（≈943）≥16 半尺寸 px */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: handIn.opacity, transform: handIn.transform}}>
        <PalmHand cx={960} cy={765} glow={glow} sink={sink} />
      </div>
      <div style={{position: 'absolute', left: 960 - 490, top: 340, ...termIn}}>
        <Terminal lines={[{text: CMD_A, delay: atType, prompt: '$ '}]} cps={11} width={980} height={360} />
      </div>
      {/* p0-02「一件」：bash 单卡贴上掌心（唯一家什；随掌上移 806→780） */}
      <div style={{position: 'absolute', left: 960 - 105, top: 780, ...bash}}>
        <Panel accent={withAlpha(theme.dim, 0.9)} style={{padding: '10px 22px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 28, whiteSpace: 'nowrap'}}>
            <span style={{color: theme.core}}>{'$ '}</span>
            <span style={{color: theme.text}}>{'bash'}</span>
          </span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 窗推近：三条命令占位 + 意图气泡 ────────────────────────────────

/** p0-03 三条命令（读 / 写·引号套引号 / 改·拗口拼到折行） */
const CMDS_B = [
  {d: 'cat ./docs/plan.md', prompt: '$ '},
  {d: 'echo \'{"tag":"章节"}\' >> ./notes.md', prompt: '$ '},
  {d: "sed -i 's/旧文本/新文本/g' ", prompt: '$ '},
  {d: '  ./config.yaml', prompt: ''},
] as const;

const ZeroB: React.FC<{atRead: number; atWrite: number; atEdit: number; atIntent: number; atLine: number}> = ({
  atRead,
  atWrite,
  atEdit,
  atIntent,
  atLine,
}) => {
  const push = usePushIn(0, {scale: 0.05, dur: DUR.f6});
  const termIn = useEnter('fade', {at: 0, dur: DUR.f4});
  const handO = useProgress(0, DUR.f4);
  const intent = useEnter('pop', {at: atIntent, dur: DUR.f4, springPreset: 'settle'});
  const line = useProgress(atLine, DUR.f5, 'decelerate');
  return (
    <AbsoluteFill style={{transform: push}}>
      {/* ⑨ QA W1：手掌垫到终端窗后（原画在窗上、指尖盖住窗内三条命令行）；
          cy 805→765 使掌缘下沿 885，距字幕盒顶（≈943）间隙 ≥16 半尺寸 px */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: handO * 0.9}}>
        <PalmHand cx={960} cy={765} glow={0.5} />
      </div>
      <div style={{position: 'absolute', left: 960 - 590, top: 300, opacity: termIn.opacity}}>
        <Terminal
          lines={CMDS_B.map((c) => ({text: c.d, delay: c.prompt ? (c.d.startsWith('cat') ? atRead : c.d.startsWith('echo') ? atWrite : atEdit) : atEdit + 14, prompt: c.prompt}))}
          cps={16}
          width={1180}
          height={430}
        />
      </div>
      {/* p0-04「想的是」：意图气泡浮起（文件图标 +「读」动作小签） */}
      <div style={{position: 'absolute', left: 640, top: 158, ...intent}}>
        <Panel style={{padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14}}>
          <svg width={40} height={48} viewBox="0 0 40 48">
            <path
              d="M6 4 L26 4 L34 14 L34 44 L6 44 Z"
              fill={theme.panel}
              stroke={theme.text}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <path d="M26 4 L26 14 L34 14" fill="none" stroke={theme.text} strokeWidth={3} />
          </svg>
          <div>
            <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 600, color: theme.text}}>{'读'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'intent'}</div>
          </div>
        </Panel>
      </div>
      {/* 「说出口的」：气泡 → 底下命令串之间的灰色连线绷直（draw 描线） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line
          x1={700}
          y1={252}
          x2={700}
          y2={368}
          stroke={withAlpha(theme.dim, 0.75)}
          strokeWidth={3}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - line}
        />
      </svg>
    </AbsoluteFill>
  );
};

// ── 0-C 翻译层特写 → 拉回双手全貌 ──────────────────────────────────────

/** 灰串字符块（长串字符的具象：无差别方块序列） */
const CharRun: React.FC<{x: number; y: number; n: number; shown: number; color?: string}> = ({x, y, n, shown, color}) => (
  <svg width={n * 22 + 8} height={40} style={{position: 'absolute', left: x, top: y}}>
    {Array.from({length: n}, (_, i) => (
      <rect
        key={i}
        x={i * 22}
        y={8}
        width={16}
        height={22}
        rx={3}
        fill={color ?? theme.dim}
        opacity={i < shown ? 0.6 : 0.14}
      />
    ))}
  </svg>
);

const ZeroC: React.FC<{
  atFee: number;
  atTypo: number;
  atVoid: number;
  atIcon: number;
  atSlits: number;
  atNames: number;
  atBash: number;
  atPull: number;
}> = ({atFee, atTypo, atVoid, atIcon, atSlits, atNames, atBash, atPull}) => {
  const frame = useCurrentFrame();
  // 翻译层舞台入场（特写态），p0-07「长出更多的手」词落位拉回全貌（scale 收）
  const stageIn = useEnter('fade', {at: 0, dur: DUR.f4});
  const pullBack = useProgress(atPull, DUR.f6, 'decelerate');
  const zoom = 1.28 - 0.28 * pullBack;
  const stageO = 1 - useProgress(atPull + DUR.f4, DUR.f4);
  // 计数小卡：弹出（数字跳动）又收起
  const fee = useEnter('pop', {at: atFee, dur: DUR.f4, springPreset: 'snap'});
  const feeN = Math.round(2 + 46 * useProgress(atFee, DUR.f4, 'linear'));
  const feeOut = useProgress(atFee + DUR.f5 + 6, DUR.f3);
  // 拼错：一枚字符错位闪珊瑚红 + 整条命令划掉作废
  const typo = useImpulse({at: atTypo, dur: DUR.f4, peak: 1});
  const typoO = useProgress(atTypo, DUR.f2);
  const strike = useProgress(atTypo + DUR.f3, DUR.f4, 'accelerate');
  // 「没有形状」：读/写标签溶解 + 三串褪成无差别灰
  const fade = useProgress(atVoid, DUR.f5);
  const iconO = useImpulse({at: atIcon, dur: DUR.f5});
  // 拉回层淡入与光缝点亮
  const slitIn = useEnter('fade', {at: atSlits, dur: DUR.f4});
  const pullO = useProgress(atPull, DUR.f4);
  // 名牌轮廓（不显字）
  const tagO = useProgress(atNames, DUR.f4);
  // bash 卡滑向拇指位（掌心 → 拇指侧）
  const bashX = 960 - 105 - 235 * useProgress(atBash, DUR.f5, 'decelerate');
  const bashO = useProgress(0, DUR.f3);
  // 灰串消散（拉回时舞台让位给双手）
  return (
    <AbsoluteFill>
      {/* 特写舞台：翻译层箭头压在命令行上（意图端 → 长串字符端） */}
      <AbsoluteFill style={{opacity: stageIn.opacity * stageO, transform: `scale(${zoom})`, transformOrigin: '960px 560px'}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080}}>
          {/* 意图端（0-B 气泡同款文件的缩小态 +「读」签） */}
          <div style={{position: 'absolute', left: 380, top: 470, opacity: 1 - fade * 0.85}}>
            <svg width={72} height={86} viewBox="0 0 72 86">
              <path d="M10 6 L48 6 L62 22 L62 80 L10 80 Z" fill={theme.panel} stroke={theme.text} strokeWidth={4} strokeLinejoin="round" />
              <path d="M48 6 L48 22 L62 22" fill="none" stroke={theme.text} strokeWidth={4} />
            </svg>
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text, textAlign: 'center', marginTop: 10}}>
              {'读'}
            </div>
          </div>
          {/* 翻译层箭头（灰调——非契约主色） */}
          <svg width={560} height={120} viewBox="0 0 560 120" style={{position: 'absolute', left: 560, top: 470}}>
            <path d="M12 46 H508" stroke={theme.dim} strokeWidth={9} strokeLinecap="round" opacity={0.85} />
            <path d="M504 26 L548 46 L504 66 Z" fill={theme.dim} opacity={0.9} />
            <text x={280} y={22} textAnchor="middle" fontFamily={theme.sans} fontSize={27} fontWeight={600} fill={theme.dim}>
              {'翻译层'}
            </text>
          </svg>
          {/* 长串字符端（47 字符灰块；拼错位 = 第 18 块错位闪红） */}
          <CharRun x={1160} y={492} n={26} shown={26} />
          {/* 字符错位闪珊瑚红（「拼错」词落位） */}
          <svg width={60} height={40} style={{position: 'absolute', left: 1160 + 17 * 22 - 6, top: 492, opacity: typoO}}>
            <rect
              x={0}
              y={8 - 10 * typo}
              width={16}
              height={22}
              rx={3}
              fill={typo > 0.15 ? theme.warn : theme.dim}
              opacity={0.6 + 0.4 * typo}
            />
          </svg>
          {/* 整条命令划掉作废（strikethrough 红线一划到底） */}
          <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
            <line
              x1={1140}
              y1={512}
              x2={1140 + 640 * strike}
              y2={504}
              stroke={theme.warn}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.9}
            />
          </svg>
          {/* 「费钱粮」计数小卡：逐字计费跳动又收起 */}
          <div
            style={{
              position: 'absolute',
              left: 900,
              top: 660,
              opacity: fee.opacity * (1 - feeOut),
              transform: fee.transform,
            }}
          >
            <Panel accent={theme.warn} style={{padding: '12px 22px', display: 'flex', alignItems: 'baseline', gap: 12}}>
              <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: theme.warn, fontVariantNumeric: 'tabular-nums'}}>
                {`${feeN}`}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.text}}>{'字符 · 计费'}</span>
            </Panel>
          </div>
          {/* 三条命令褪色成三串无差别灰（「没有形状」）+ 程序观察位图标一现 */}
          <div style={{position: 'absolute', left: 460, top: 700, opacity: fade}}>
            <CharRun x={0} y={0} n={30} shown={30} />
            <CharRun x={0} y={54} n={30} shown={30} />
            <CharRun x={0} y={108} n={30} shown={30} />
          </div>
          <div style={{position: 'absolute', left: 1180, top: 745, opacity: iconO, display: 'flex', alignItems: 'center', gap: 12}}>
            <svg width={54} height={44} viewBox="0 0 54 44">
              <rect x={4} y={4} width={46} height={36} rx={8} fill="none" stroke={theme.dim} strokeWidth={3} />
              <circle cx={20} cy={22} r={7} fill="none" stroke={theme.text} strokeWidth={3} />
              <line x1={26} y1={28} x2={36} y2={36} stroke={theme.text} strokeWidth={3.5} strokeLinecap="round" />
            </svg>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'程序眼里 · 全是字符'}</span>
          </div>
        </div>
      </AbsoluteFill>

      {/* 拉回后的双手全貌 + 五道琥珀光缝（「长出更多的手」） */}
      <AbsoluteFill style={{opacity: slitIn.opacity * pullO}}>
        <PalmHand cx={960} cy={770} glow={0.35} />
        <svg
          width={620}
          height={420}
          viewBox="-310 -170 620 420"
          style={{position: 'absolute', left: 650, top: 600, overflow: 'visible'}}
        >
          {SLITS.map((sx, i) => {
            const lit = clamp01((frame - (atSlits + i * 4)) / DUR.f4);
            return (
              <rect
                key={sx}
                x={sx - 5}
                y={-160}
                width={10}
                height={150}
                rx={5}
                fill={theme.mech}
                opacity={0.9 * lit}
              />
            );
          })}
        </svg>
        {/* 「各有名字」：每道光缝浮出一枚空白名牌轮廓（不显字——生长留给 1 幕） */}
        {SLITS.map((sx) => (
          <div
            key={sx}
            style={{
              position: 'absolute',
              left: 960 + sx - 42,
              top: 430,
              width: 84,
              height: 34,
              borderRadius: 8,
              border: `2px dashed ${withAlpha(theme.mech, 0.8)}`,
              opacity: tagO,
            }}
          />
        ))}
      </AbsoluteFill>
      {/* bash 卡：自掌心滑向拇指位 */}
      <div style={{position: 'absolute', left: bashX, top: 760, opacity: bashO}}>
        <Panel accent={withAlpha(theme.dim, 0.9)} style={{padding: '10px 22px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 28, whiteSpace: 'nowrap'}}>
            <span style={{color: theme.core}}>{'$ '}</span>
            <span style={{color: theme.text}}>{'bash'}</span>
          </span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0ShapelessHand: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  // 词落位锚 = 句首 + 句长比例（口播无词级时间戳，比例即词窗；TTS 变更自动重定时）
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-02');
  const bB = w('p0-03', 'p0-04');
  const bC = w('p0-05', 'p0-07');

  return (
    <AbsoluteFill>
      <SourceCredit />
      <Sequence {...bA} name="0-A">
        <ZeroA atType={wa('p0-01', 0.72) - bA.from} atBash={wa('p0-02', 0.42) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atRead={wa('p0-03', 0.14) - bB.from}
          atWrite={wa('p0-03', 0.4) - bB.from}
          atEdit={wa('p0-03', 0.6) - bB.from}
          atIntent={wa('p0-04', 0.22) - bB.from}
          atLine={wa('p0-04', 0.52) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atFee={wa('p0-05', 0.17) - bC.from}
          atTypo={wa('p0-05', 0.4) - bC.from}
          atVoid={wa('p0-06', 0.32) - bC.from}
          atIcon={wa('p0-06', 0.68) - bC.from}
          atSlits={wa('p0-07', 0.22) - bC.from}
          atNames={wa('p0-07', 0.8) - bC.from}
          atBash={wa('p0-07', 0.45) - bC.from}
          atPull={wa('p0-07', 0.08) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0ShapelessHand;
