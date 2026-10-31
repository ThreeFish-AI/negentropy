/** P2 同一件事，两种说法（p2-01..p2-07，4 镜）——分镜 2-A / 2-B / 2-C / 2-D。
 *
 *  叙事链：走查舞台全景（左右分屏立起、右半暂暗；指令气泡携三枚任务签落
 *  舞台中央）→ 交给 bash：三条咒语逐条拼出（错一枚字符虚闪示脆）→ 右半激活：
 *  一次回答三调用块并排（参数签就位）→ 照表分发（三名字签飞表、行点亮、部件
 *  端闪、参数递入）→ 逐个执行（青碧脉冲逐块过）→ 原路回喂（三结果条携同款
 *  任务签回流——a/b/*.py 四段旅程同签可追）→ 对比定格重音镜（等高线点亮 +
 *  中缝翻译层箭头碎散消隐——0-C 灰翻译层走完生命周期）→ 三块放大 + 空白
 *  编号签（单号雏形，欲显未显）收黑悬念。
 *
 *  空间契约：环体缩悬顶角（〔M-001〕，执行段查表链微光在位；2-B 走查时转过
 *  三小段）；对照表缩微驻右上角（Morph Continuity 1-D→2-A：同形缩微，列结构/
 *  行数/描边色逐帧不变；2-B 只点亮读/找两行）。任务签三枚全程同形同色可追。
 *
 *  红线落实：词落位 = 句首 + 句长比例；分发次序 = 口播次序（两读一找）；
 *  右侧提前激活禁止（2-A 右半暂暗）；编号签空白（显字留 3-A）；y≥56/bottom≥150。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, NumberTag, Panel, SceneTag, TableRegistry, execArcPath} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useImpulse, useProgress, useShake, useSpring} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 任务签 token（a / b / *.py——全程同形同色可追；白底高亮不占概念色） */
const TokenChip: React.FC<{t: string}> = ({t}) => (
  <span
    style={{
      fontFamily: theme.mono,
      fontWeight: 700,
      fontSize: 22,
      color: theme.text,
      background: `${theme.text}22`,
      borderRadius: 6,
      padding: '2px 10px',
      whiteSpace: 'nowrap',
    }}
  >
    {t}
  </span>
);

/** 三枚任务（走查例：读 a / 读 b / 列 *.py） */
const TASKS = [
  {zh: '读', token: 'a'},
  {zh: '读', token: 'b'},
  {zh: '列', token: '*.py'},
] as const;

/** 右半的三个调用块内容（次序 = 口播：两读一找） */
const CALLS = [
  {zh: '读文件', en: 'read_file', token: 'a', row: 1},
  {zh: '读文件', en: 'read_file', token: 'b', row: 1},
  {zh: '找文件', en: 'glob', token: '*.py', row: 4},
] as const;

/** 环体缩悬顶角（M-001；执行段查表链微光在位） */
const RingCorner: React.FC<{dim?: number; spin?: number}> = ({dim = 1, spin = 0}) => {
  const size = 150;
  const r = size / 2 - 46;
  return (
    <div style={{position: 'absolute', left: 76, top: 84, opacity: dim}}>
      <LoopRing
        size={size}
        nodes={[0, 1, 2, 3, 4].map((i) => ({label: `s${i}`, angle: -90 + i * 72}))}
        showLabels={false}
        showExit={false}
        dotProgress={spin % 1}
      />
      <svg width={size} height={size} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
        <path
          d={execArcPath(size / 2, size / 2, r)}
          fill="none"
          stroke={theme.mech}
          strokeWidth={7}
          strokeLinecap="round"
          opacity={0.55}
        />
      </svg>
    </div>
  );
};

// ── 2-A 走查舞台全景 + 交给 bash ────────────────────────────────────────

/** 左半三条咒语（读要拼路径、列要配模式；第三条带模式串拼到折行） */
const SPELLS = [
  {d: 'cat ./a.txt', prompt: '$ '},
  {d: 'cat ./b.txt', prompt: '$ '},
  {d: 'find . -name ', prompt: '$ '},
  {d: '      "*.py"', prompt: ''},
] as const;

const ShotA: React.FC<{atDrop: number; atTags: number; atHand: number; atSpell: number; atFragile: number}> = ({
  atDrop,
  atTags,
  atHand,
  atSpell,
  atFragile,
}) => {
  const frame = useCurrentFrame();
  // 指令气泡：顶部 → p2-01「你说」落至舞台中央 → p2-02「交给 bash」滑向左半
  const dropY = useSpring('settle', {at: atDrop, dur: DUR.f5});
  const slideX = useSpring('settle', {at: atHand, dur: DUR.f5});
  const bubbleY = 140 + 250 * dropY;
  const bubbleX = 960 - 430 * slideX;
  // 三枚任务签依次显形
  const tags = TASKS.map((_, i) => clamp01(progress(frame, atTags + i * 5, DUR.f3)));
  // 三条咒语逐条拼出（mono 逐字：每条 36 帧打满；第三条折行续打）
  const spellChars = (li: 0 | 1 | 2): number => {
    const at = [atSpell, atSpell + 10, atSpell + 22][li];
    return Math.floor(clamp01((frame - at) / 36) * 26);
  };
  // 「错一个字符」：第一条命令一枚字符虚闪示脆（不真错，只预演）
  const fragile = useImpulse({at: atFragile, dur: DUR.f5, peak: 1});
  return (
    <AbsoluteFill>
      <SceneTag chapter="Worked Example" tagline="同一件事 · 两种说法" accent={theme.mech} />
      {/* 左右分屏框架（右半暂暗——未讲到不亮） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={960} y1={130} x2={960} y2={880} stroke={theme.panelBorder} strokeWidth={3} strokeDasharray="10 12" opacity={0.8} />
      </svg>
      <div style={{position: 'absolute', left: 330, top: 168, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
        {'bash 咒语'}
      </div>
      <div style={{position: 'absolute', left: 1230, top: 168, fontFamily: theme.mono, fontSize: 24, color: theme.dim, opacity: 0.45}}>
        {'专用工具'}
      </div>
      <RingCorner dim={0.9} />
      {/* 对照表缩微驻右上角（同形缩微，行数接 1-B 末态 5 行） */}
      <TableRegistry x={1560} y={100} scale={0.42} rows={5} dim={0.12} />
      {/* 指令气泡（三枚任务签随落位依次显形；「交给 bash」滑向左半） */}
      <div style={{position: 'absolute', left: bubbleX, top: bubbleY, transform: 'translate(-50%, -50%)'}}>
        <Panel style={{padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 18}}>
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'user'}</span>
          {TASKS.map((tk, i) => (
            <span key={tk.token} style={{display: 'flex', alignItems: 'center', gap: 8, opacity: tags[i]}}>
              <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{tk.zh}</span>
              <TokenChip t={tk.token} />
            </span>
          ))}
        </Panel>
      </div>
      {/* 左半：三条咒语逐条拼出（命令词全进角标 mono，不放大字） */}
      <div style={{position: 'absolute', left: 300, top: 500, fontFamily: theme.mono, fontSize: 27, lineHeight: 2.0, color: theme.dim}}>
        {SPELLS.slice(0, 2).map((s, li) => (
          <div key={li} style={{whiteSpace: 'pre'}}>
            <span style={{color: theme.core}}>{s.prompt}</span>
            {s.d.slice(0, Math.min(s.d.length, spellChars(li as 0 | 1)))}
          </div>
        ))}
        <div style={{whiteSpace: 'pre'}}>
          <span style={{color: theme.core}}>{'$ '}</span>
          {SPELLS[2].d.slice(0, Math.min(SPELLS[2].d.length, spellChars(2)))}
        </div>
        <div style={{whiteSpace: 'pre', opacity: spellChars(2) > 14 ? 1 : 0}}>
          {SPELLS[3].d.slice(0, Math.max(0, spellChars(2) - 14))}
        </div>
      </div>
      {/* 「错一个字符」虚闪（第一条 cat ./a.txt 的第 9 字符位——mono 0.6em 步进） */}
      <span
        style={{
          position: 'absolute',
          left: 300 + 10 * 27 * 0.6,
          top: 506,
          width: 16,
          height: 30,
          background: withAlpha(theme.warn, 0.25 + 0.55 * fragile),
          borderRadius: 3,
          opacity: fragile > 0.05 ? 1 : 0,
        }}
      />
      <Footnote delay={atSpell}>{'cat · find -name'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-B 右半激活：三调用块 + 照表分发 + 逐个执行 + 原路回喂 ────────────

/** 调用块（三块同款；右上角留编号签位——显字在 2-D/3-A） */
const CallBlock: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  call: (typeof CALLS)[number];
  enter: number;
  pulse: number;
  tagSlot?: React.ReactNode;
}> = ({x, y, w, h, call, enter, pulse, tagSlot}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      boxSizing: 'border-box',
      borderRadius: 12,
      border: `2.5px solid ${theme.tool}`,
      background: `${theme.tool}18`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 10,
      padding: '0 20px',
      opacity: enter,
      boxShadow: `0 0 ${26 * pulse}px ${theme.tool}`,
    }}
  >
    <span style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
      <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: theme.text}}>{call.zh}</span>
      <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.tool}}>{call.en}</span>
    </span>
    <span style={{display: 'flex', alignItems: 'center', gap: 10}}>
      <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'path'}</span>
      <TokenChip t={call.token} />
    </span>
    {tagSlot}
  </div>
);

const ShotB: React.FC<{
  atBlocks: number;
  atDispatch: number;
  atExec: number;
  atFeed: number;
}> = ({atBlocks, atDispatch, atExec, atFeed}) => {
  const frame = useCurrentFrame();
  // 三块 stagger 弹入（useStagger 钳制）
  const ins = [0, 1, 2].map((i) => clamp01(progress(frame, atBlocks + i * 5, DUR.f4)));
  // 照表分发：三名字签逐个飞向对照表（对应行点亮→部件端闪；表 lit 两行=读/找）
  const dispatches = [0, 1, 2].map((i) => clamp01(progress(frame, atDispatch + i * 12, 14)));
  const litRead = dispatches[0] > 0.7 || dispatches[1] > 0.7 ? 1 : 0;
  const litGlob = dispatches[2] > 0.7 ? 1 : 0;
  // 逐个执行：青碧脉冲逐块过
  const execP = [0, 1, 2].map((i) => Math.sin(Math.PI * clamp01(progress(frame, atExec + i * 6, 16))));
  // 原路回喂：三结果条携同款任务签沿通路回流消息位
  const feeds = [0, 1, 2].map((i) => clamp01(progress(frame, atFeed + i * 6, 18)));
  // 环体转过三小段（每分发一段：1/5 圈 × 3）
  const spin = useProgress(atDispatch, Math.max(1, atFeed + 24 - atDispatch), 'linear') * 0.6;
  // 回喂通路（青碧，右半消息位 ↔ 执行位）
  const PATH = {from: {x: 1240, y: 780}, to: {x: 1240, y: 600}};
  return (
    <AbsoluteFill>
      {/* 右半激活（分屏线保留，右半亮起） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={960} y1={130} x2={960} y2={880} stroke={theme.panelBorder} strokeWidth={3} strokeDasharray="10 12" opacity={0.5} />
        {/* 回喂通路（青碧实线——执行位 ↔ 消息位） */}
        <line x1={PATH.from.x} y1={PATH.from.y} x2={PATH.to.x} y2={PATH.to.y} stroke={withAlpha(theme.tool, 0.55)} strokeWidth={4} />
        <path d="M1232 616 L1240 600 L1248 616 Z" fill={theme.tool} opacity={0.8} />
      </svg>
      <RingCorner dim={0.55} spin={spin} />
      {/* 对照表缩微联动位（右上；只点亮读/找两行） */}
      <TableRegistry
        x={1560}
        y={100}
        scale={0.42}
        rows={5}
        dim={0.12}
        lit={[false, litRead > 0, false, false, litGlob > 0]}
      />
      {/* 右侧消息位：一次回答条 + 三调用块并排 */}
      <div style={{position: 'absolute', left: 1020, top: 240, display: 'flex', alignItems: 'center', gap: 12, opacity: ins[0]}}>
        <div style={{width: 10, height: 10, borderRadius: 999, background: theme.core}} />
        <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.core}}>{'assistant'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'一次回答 · 三个调用'}</span>
      </div>
      {CALLS.map((c, i) => (
        <CallBlock key={c.token} x={1020 + i * 290} y={300} w={262} h={150} call={c} enter={ins[i]} pulse={execP[i]} />
      ))}
      {/* 分发：三名字签逐个飞向对照表（名字 chip：块 → 表） */}
      {dispatches.map((u, i) => {
        if (u <= 0 || u >= 1) {
          return null;
        }
        const c = CALLS[i];
        const p0 = {x: 1020 + i * 290 + 130, y: 375};
        const p2 = {x: 1700, y: 240};
        const px = p0.x + (p2.x - p0.x) * u;
        const py = p0.y + (p2.y - p0.y) * u - Math.sin(Math.PI * u) * 90;
        return (
          <div
            key={`d-${c.token}`}
            style={{position: 'absolute', left: px, top: py, transform: 'translate(-50%, -50%)'}}
          >
            <div style={{padding: '4px 12px', borderRadius: 8, border: `2px solid ${theme.mech}`, background: theme.panel}}>
              <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: theme.mech}}>{c.zh}</span>
            </div>
          </div>
        );
      })}
      {/* 执行位（右下：三脉冲的落点 + 「执行」铭牌） */}
      <div style={{position: 'absolute', left: 1160, top: 742}}>
        <Panel accent={theme.tool} style={{padding: '10px 22px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'执行'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{'execute'}</div>
        </Panel>
      </div>
      {/* 原路回喂：三结果条携同款任务签回流消息位（自执行位汇入通路、上行分流各块） */}
      {feeds.map((u, i) => {
        if (u <= 0 || u >= 1) {
          return null;
        }
        const c = CALLS[i];
        const xTarget = 1020 + i * 290 + 40;
        const px = 1240 + (xTarget - 1240) * u;
        const y = 780 + (300 - 780) * u;
        return (
          <div key={`f-${c.token}`} style={{position: 'absolute', left: px, top: y, opacity: 1}}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderRadius: 10,
                border: `2px solid ${theme.tool}`,
                background: theme.panel,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.tool}}>{'tool_result'}</span>
              <TokenChip t={c.token} />
            </div>
          </div>
        );
      })}
      <Footnote delay={atDispatch}>{'lookup → handler → input'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-C 对比定格重音镜：等高线 + 翻译层消隐 ─────────────────────────────

const ShotC: React.FC<{atLine: number; atVanish: number}> = ({atLine, atVanish}) => {
  const frame = useCurrentFrame();
  // 等高裁决线（横贯，词落位点亮）
  const line = useProgress(atLine, DUR.f5, 'decelerate');
  const lineGlow = useImpulse({at: atLine + DUR.f4, dur: DUR.f5});
  // 中缝翻译层箭头（0-C 同款灰调）：「消失了」碎散消隐（裂四段、确定性偏移散落）
  const vanish = useProgress(atVanish, DUR.f4, 'accelerate');
  const gone = useProgress(atVanish + DUR.f3, DUR.f4);
  const FRAGS = [
    {dx: -96, dy: -70, rot: -34},
    {dx: -30, dy: -110, rot: 18},
    {dx: 34, dy: -84, rot: -20},
    {dx: 98, dy: -128, rot: 40},
  ];
  return (
    <AbsoluteFill>
      {/* 左：三条长咒语串（灰 mono 长行——2-A 同款命令的定格态） */}
      <div style={{position: 'absolute', left: 210, top: 420, fontFamily: theme.mono, fontSize: 26, lineHeight: 2.2, color: theme.dim}}>
        <div style={{whiteSpace: 'pre'}}>
          <span style={{color: theme.core}}>{'$ '}</span>
          {'cat ./a.txt'}
        </div>
        <div style={{whiteSpace: 'pre'}}>
          <span style={{color: theme.core}}>{'$ '}</span>
          {'cat ./b.txt'}
        </div>
        <div style={{whiteSpace: 'pre'}}>
          <span style={{color: theme.core}}>{'$ '}</span>
          {'find . -name "*.py"'}
        </div>
      </div>
      {/* 右：三枚齐整意图卡（同款任务签承载） */}
      {TASKS.map((tk, i) => (
        <div
          key={tk.token}
          style={{
            position: 'absolute',
            left: 1150,
            top: 408 + i * 92,
            width: 500,
            height: 74,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2px solid ${theme.mech}`,
            background: `${theme.mech}12`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '0 22px',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>{`${tk.zh}文件`}</span>
          <TokenChip t={tk.token} />
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginLeft: 'auto'}}>
            {i < 2 ? 'read_file' : 'glob'}
          </span>
        </div>
      ))}
      {/* 等高裁决线（横贯两列顶部；倾斜禁止） */}
      <div
        style={{
          position: 'absolute',
          left: 190,
          right: 190,
          top: 352,
          height: 3,
          background: theme.text,
          opacity: 0.9 * line,
          boxShadow: `0 0 ${18 * lineGlow}px ${theme.text}`,
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, top: 306, textAlign: 'center', fontFamily: theme.sans, fontSize: 25, color: theme.dim, opacity: line}}>
        {'等高 · 同一件事'}
      </div>
      {/* 中缝翻译层箭头（0-C 同款同位同灰调；「消失了」碎散消隐） */}
      <div style={{position: 'absolute', left: 960 - 110, top: 560, opacity: 1 - gone}}>
        <svg width={220} height={90} viewBox="0 0 220 90" style={{overflow: 'visible'}}>
          {FRAGS.map((f, i) => (
            <g
              key={i}
              transform={`translate(${f.dx * vanish} ${f.dy * vanish * vanish}) rotate(${f.rot * vanish})`}
              opacity={1 - vanish}
            >
              <line x1={i * 52 - 96} y1={30} x2={i * 52 - 48} y2={30} stroke={theme.dim} strokeWidth={7} strokeLinecap="round" />
            </g>
          ))}
          <g transform={`translate(${96 * vanish} ${-160 * vanish * vanish}) rotate(${36 * vanish})`} opacity={1 - vanish}>
            <path d="M78 18 L96 30 L78 42 Z" fill={theme.dim} />
          </g>
          <text
            x={110}
            y={4}
            textAnchor="middle"
            fontFamily={theme.sans}
            fontSize={22}
            fontWeight={600}
            fill={theme.dim}
            opacity={1 - vanish}
          >
            {'翻译层'}
          </text>
        </svg>
      </div>
      <Footnote delay={atVanish}>{'咒语 vs 意图'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 三块放大 + 空白编号签（单号雏形）收黑 ──────────────────────────

const ShotD: React.FC<{atFlash: number; atWobble: number; atBlack: number}> = ({atFlash, atWobble, atBlack}) => {
  const frame = useCurrentFrame();
  // 三块齐立各闪一下（微错峰；sin 包络纯函数——起于 0 归于 0）
  const flashes = [0, 1, 2].map((i) => Math.sin(Math.PI * progress(frame, atFlash + i * 4, DUR.f5)));
  // 三空白签同时轻晃（欲显未显；useShake 衰减归零）
  const wobble = useShake({at: atWobble, amp: 5, freq: 2.4, decay: true, dur: DUR.f5});
  // 半拍后收黑（悬念交给下一幕；黑幕只压场景层——字幕在最上 overlay）
  const black = useProgress(atBlack, DUR.f4);
  return (
    <AbsoluteFill>
      {CALLS.map((c, i) => (
        <div key={c.token} style={{position: 'absolute', left: 150 + i * 560, top: 380}}>
          <div style={{transform: `scale(${1 + 0.05 * flashes[i]})`}}>
            <CallBlock
              x={0}
              y={0}
              w={470}
              h={230}
              call={c}
              enter={1}
              pulse={flashes[i]}
              tagSlot={
                <div style={{position: 'absolute', right: 14, top: 12, transform: `translateX(${wobble}px)`}}>
                  <NumberTag size={52} dashed />
                </div>
              }
            />
          </div>
        </div>
      ))}
      {/* 「各归各？」悬念签 */}
      <SuspenseSign at={atWobble} />
      {/* 收黑遮罩（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.88 * black, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

const SuspenseSign: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at: at + DUR.f3, dur: DUR.f4, dist: 16});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 190, display: 'flex', justifyContent: 'center', ...e}}>
      <Panel accent={theme.warn} style={{padding: '10px 26px'}}>
        <span style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.warn}}>{'各归各？'}</span>
      </Panel>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2TwoWays: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-04');
  const bC = w('p2-05');
  const bD = w('p2-06', 'p2-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="2-A">
        <ShotA
          atDrop={wa('p2-01', 0.12) - bA.from}
          atTags={wa('p2-01', 0.3) - bA.from}
          atHand={wa('p2-02', 0.08) - bA.from}
          atSpell={wa('p2-02', 0.22) - bA.from}
          atFragile={wa('p2-02', 0.62) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="2-B">
        <ShotB
          atBlocks={wa('p2-03', 0.24) - bB.from}
          atDispatch={wa('p2-04', 0.08) - bB.from}
          atExec={wa('p2-04', 0.45) - bB.from}
          atFeed={wa('p2-04', 0.68) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="2-C">
        <ShotC atLine={wa('p2-05', 0.34) - bC.from} atVanish={wa('p2-05', 0.88) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="2-D">
        <ShotD
          atFlash={wa('p2-06', 0.62) - bD.from}
          atWobble={wa('p2-07', 0.38) - bD.from}
          atBlack={wa('p2-07', 0.72) - bD.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2TwoWays;
