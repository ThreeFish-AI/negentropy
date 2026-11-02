/** P1 一张登记表（p1-01..p1-08，3 镜）——分镜 1-A / 1-B / 1-C。
 *
 *  Morph Continuity（0-C→1-A，头注明示）：同一主体 = 靛蓝编号徽章。起止态：
 *  0-C 末帧徽章（№）悬于「请求→回复」连线中点放大定格（屏中央 y≈408）→
 *  1-A 首帧徽章同位在场，@pushIn 急推中结构卡展开为登记表主视觉（靛蓝），
 *  徽章色相、圆形轮廓、屏位居中逐帧不变，随后落位表头「编号」列签上方；
 *  两端节点退为表头「类型」「状态」列签、连线化为表头横线。身份线索：
 *  靛蓝圆形徽章 + 屏中央位置（保两项）。展开与表头文字落位不争抢——
 *  p1-01 徽章先落位、p1-03 四列文字才逐列点亮（次序解耦）。
 *
 *  叙事链：1-A 开帧环体〔M-001〕缩悬顶角一拍（全景坐标锚；环上「轮末查信」
 *  段暗色微光提示——4-B 点亮的伏笔）→ p1-01「一张登记表」词落位 morph 展开
 *  成表、徽章落位「编号」列签（主装置首亮，重音镜）→ p1-02「开单/领号」两词
 *  落位表落首行（七字段缩略行）、新号签生成入列 → p1-03 四词落位表头四列签
 *  逐列出亮 → p1-04「三种」词落位三态胶囊逐个点亮（P1 记忆点，重音镜 1–2s
 *  punch）→ 1-B 回执簿类比 ECU（附录 A 唯一正主落锚）：p1-05「开单、等回执、
 *  按编号销账」三词落位三动作微演（存根落一行→右联空位呼吸→回执撕下飞回
 *  同号重合闪兰紫）→ p1-06「不管催账」词落位边界小签贴上、簿页轻合一半又停
 *  （不担保语义——半合待命态）→ 1-C 拉回对比全景：p1-07「看表说话」词落位
 *  右半表行高亮一拍、左半灰流降速退层 → p1-08「走四步」词落位四枚空白步签
 *  立起待命、环体远景掠过一圈不停留（幕尾钩，P2 接棒位）。
 *
 *  空间契约：表头四列与口播点名次序一致、三态胶囊三色全片恒定、七字段缩略
 *  不抢焦；回执联与存根同号重合可读、兰紫只落在重合拍、登记表缩微同形在场、
 *  回执簿本镜即收（不升格贯穿剧场）、簿页不长出催账元素；左右对照等高、
 *  步签空白不显字、环体同形掠过不抢焦。
 *  红线落实：表行禁一次全亮（幻灯片式）、三态胶囊禁提前显色、步签禁提前
 *  显字（P2 正源）、聊天记录禁抢焦、行值禁发明号数（首行缩略占位「…」）；
 *  词落位 = wa(id,f)；y≥56 / bottom≥176（长角标 bottom 210）。
 *
 *  承接登记：1-C→2-A morph（同一主体 = 登记表：1-C 末帧表居右半放大态 →
 *  2-A 首帧表驻走查舞台上方同形微缩，四列表头/行内容/靛蓝描边逐帧不变）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {HookArc, LoopRing, RegistryTable, ReceiptBook, StepSign} from '../components/motifs';
import {DUR, clamp01, progress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 1-A morph 首亮：环缩悬顶角 + 结构卡展开成表 + 徽章落位 + 三态点亮 ────────

const TABLE_1A = {x: 470, y: 300, w: 880} as const;
const RING_CORNER_1A = {x: 1656, y: 48, size: 150} as const;

const OneA: React.FC<{
  atMorph: number;
  atRow: number;
  atNum: number;
  atCols: number[];
  atPills: number[];
}> = ({atMorph, atRow, atNum, atCols, atPills}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const push = usePushIn(2, {scale: 0.08, dur: DUR.f6});
  // morph 展开（p1-01「一张登记表」——结构卡自屏中央展开为表）
  const expand = clamp01(progress(frame, atMorph, 26));
  // 环体缩悬顶角（开帧全景坐标锚居中一拍 → morph 起缩悬右上角待命）
  const shrink = clamp01(progress(frame, atMorph - 6, 20));
  const ringSize = 400 + (RING_CORNER_1A.size - 400) * shrink;
  const ringX = 760 + (RING_CORNER_1A.x - 760) * shrink;
  const ringY = 210 + (RING_CORNER_1A.y - 210) * shrink;
  const dot = ((frame / (fps * 2.5)) % 1 + 1) % 1;
  // 徽章 morph 飞行：屏中央（0-C 末帧位）→ 表头「编号」列签上方
  const badgeFly = clamp01(progress(frame, atMorph + 6, 18));
  const badgeX = 960 + (TABLE_1A.x + 96 - 960) * badgeFly;
  const badgeY = 408 + (TABLE_1A.y - 40 - 408) * badgeFly;
  const badgeScale = 1 - 0.42 * badgeFly;
  // 表落首行（p1-02「开一张请求单」——七字段缩略行；值缩略不发明号数）
  const rowP = clamp01(progress(frame, atRow, 16));
  // 新号签生成入列（p1-02「领一个号」——行内号位由虚位点亮承载）
  const numLit = clamp01(progress(frame, atNum, 12));
  // 表头四列逐列出亮（p1-03 四词——次序 = 口播点名次序）
  const cols = atCols.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 三态胶囊逐个点亮（p1-04——P1 记忆点，重音镜 1–2s punch）
  const pills = atPills.map((a) => clamp01(progress(frame, a, DUR.f4)));
  const pillFlash = [0, 1, 2].map((i) => Math.sin(Math.PI * clamp01(progress(frame, atPills[i], 22))));
  return (
    <AbsoluteFill style={{transform: push, transformOrigin: '50% 46%'}}>
      {/* 环体〔M-001〕（开帧居中缓转一拍 → 缩悬顶角；「轮末查信」段暗色微光提示） */}
      <div style={{position: 'absolute', left: ringX, top: ringY, width: ringSize, height: ringSize, opacity: 1}}>
        <LoopRing size={ringSize} nodes={[]} showExit={false} dotProgress={dot} />
        <HookArc size={ringSize} litP={0} />
      </div>
      {/* 登记表主视觉（morph 展开自屏中央——scale/透明度承载展开，靛蓝描边恒定） */}
      <div
        style={{
          position: 'absolute',
          left: TABLE_1A.x,
          top: TABLE_1A.y,
          width: TABLE_1A.w,
          transform: `scale(${0.55 + 0.45 * expand})`,
          transformOrigin: '50% 0%',
          opacity: expand,
        }}
      >
        <RegistryTable
          x={0}
          y={0}
          w={TABLE_1A.w}
          headerP={cols}
          rows={[{key: 'ghost', badge: undefined, type: '…', to: '…', state: 'pending', rowP, hotP: numLit * 0.6}]}
          pillP={pills}
        />
      </div>
      {/* 三态胶囊 punch 辉光（逐格点亮帧的落定拍——三色全片恒定） */}
      {pills.map((p, i) =>
        p > 0.02 ? (
          <div
            key={`pf${i}`}
            style={{
              position: 'absolute',
              left: TABLE_1A.x + TABLE_1A.w + 26,
              top: TABLE_1A.y + 44 + i * 62,
              width: 120,
              height: 34,
              borderRadius: 999,
              boxShadow: pillFlash[i] > 0.05 ? `0 0 ${26 * pillFlash[i]}px ${withAlpha([theme.dim, theme.ok, theme.danger][i], 0.55 * pillFlash[i])}` : 'none',
              pointerEvents: 'none',
              opacity: p,
            }}
          />
        ) : null,
      )}
      {/* 靛蓝编号徽章（morph 主体：0-C 连线中点 → 表头「编号」列签上方落位） */}
      <div style={{position: 'absolute', left: badgeX, top: badgeY, transform: `translate(-50%, -50%) scale(${badgeScale})`, opacity: 1}}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            border: `5px solid ${theme.req}`,
            background: withAlpha(theme.req, 0.16),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          №
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'登记表 · request_id · ProtocolState'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-B 回执簿类比 ECU：开单 → 等回执 → 撕下对号（兰紫落定拍）→ 半合待命 ────

const BOOK_1B = {x: 520, y: 240} as const;
const MINI_TABLE_1B = {x: 92, y: 140, w: 400} as const;

const OneB: React.FC<{atStub: number; atWait: number; atFly: number; atMerge: number; atBound: number; atHalf: number}> = ({
  atStub,
  atWait,
  atFly,
  atMerge,
  atBound,
  atHalf,
}) => {
  const frame = useCurrentFrame();
  // 开单：存根落一行（p1-05「开单」词）
  const stub = clamp01(progress(frame, atStub, 14));
  // 等回执：右联空位呼吸（p1-05「等回执」词——持续呼吸至撕下拍）
  const wait = clamp01(progress(frame, atWait, DUR.f4));
  const breathe = 0.5 + 0.5 * Math.sin(frame / 9);
  // 销账：回执撕下携号飞回 + 同号重合（p1-05「按编号销账」词）
  const fly = clamp01(progress(frame, atFly, 18));
  const merge = clamp01(progress(frame, atMerge, 12));
  // 兰紫落定拍（重合完成闪一拍）
  const glow = Math.sin(Math.PI * clamp01(progress(frame, atMerge + 8, 26)));
  // 边界小签（p1-06「不管催账」）+ 簿页轻合一半又停（不担保语义）
  const bound = clamp01(progress(frame, atBound, DUR.f4));
  const half = clamp01(progress(frame, atHalf, 16));
  return (
    <AbsoluteFill>
      {/* 登记表缩微驻角（同形在场——micro 档，不重绘） */}
      <div style={{position: 'absolute', left: MINI_TABLE_1B.x, top: MINI_TABLE_1B.y, opacity: 0.85}}>
        <RegistryTable
          x={0}
          y={0}
          w={MINI_TABLE_1B.w}
          micro
          rows={[{key: 'g1', badge: undefined, type: '…', to: '…', state: 'pending'}]}
        />
      </div>
      {/* 回执簿（附录 A 唯一正主——双联簿页占屏） */}
      <div style={{position: 'absolute', left: BOOK_1B.x, top: BOOK_1B.y}}>
        <ReceiptBook x={0} y={0} w={880} h={440} openP={1} stubP={stub} flyP={fly} mergeP={merge} glow={glow * wait} halfP={half} />
        {/* 等回执空位呼吸提示（右联回执位——wait 起 dash 呼吸） */}
        {wait > 0.3 && fly < 0.05 ? (
          <div
            style={{
              position: 'absolute',
              left: 448,
              top: 306,
              width: 140,
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.dim,
              opacity: 0.35 + 0.45 * breathe,
              whiteSpace: 'nowrap',
            }}
          >
            等回执…
          </div>
        ) : null}
        {/* 同号重合拍读出（对上号，才算办结——兰紫唯一落点；框体由
            ReceiptBook 内置 mergeP 承载，此处仅标签读出） */}
        {merge > 0.3 ? (
          <div
            style={{
              position: 'absolute',
              left: 150,
              top: 108,
              fontFamily: theme.sans,
              fontSize: 18,
              fontWeight: 700,
              color: theme.receipt,
              whiteSpace: 'nowrap',
              opacity: merge,
              textShadow: glow > 0.03 ? `0 0 ${18 * glow}px ${withAlpha(theme.receipt, 0.8 * glow)}` : 'none',
            }}
          >
            对上号 ✓
          </div>
        ) : null}
      </div>
      {/* 边界小签（管销账 · 不管催账——p1-06 贴簿页边） */}
      <div
        style={{
          position: 'absolute',
          left: 770,
          top: 726,
          padding: '8px 20px',
          borderRadius: 10,
          border: `2.5px dashed ${withAlpha(theme.dim, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          fontFamily: theme.sans,
          fontSize: 20,
          fontWeight: 700,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: bound,
          transform: `translateY(${(1 - bound) * 12}px)`,
        }}
      >
        管销账 · 不管催账
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'回执簿类比 · 一单一号 · 幂等凭据不是重试器'}
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 看表对照：聊天灰流（不可查） vs 表行定格（清清楚楚）+ 四步虚位钩 ─────

const CHAT_1C = {x: 110, y: 210, w: 700, h: 470} as const;
const TABLE_1C = {x: 950, y: 240, w: 820} as const;
const STEPS_1C = {y: 640} as const;

const OneC: React.FC<{atSee: number; atSteps: number; atSweep: number}> = ({atSee, atSteps, atSweep}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 聊天灰流：持续滚动（帧驱动循环）→「看表说话」词落位降速退层
  const calm = clamp01(progress(frame, atSee, 18));
  const see = clamp01(progress(frame, atSee, DUR.f4));
  // 表行高亮一拍（裁决：查表 vs 翻聊天记录）
  const hot = Math.sin(Math.PI * clamp01(progress(frame, atSee + 4, 30)));
  // 四枚空白步签立起（p1-08「走四步」——①②③④ 虚位，签面暂空）
  const steps = clamp01(progress(frame, atSteps, 16));
  // 环体远景掠过一圈不停留（背景 y 400 带，小尺寸 220）
  const sweep = clamp01(progress(frame, atSweep, 46));
  const ringX = -260 + sweep * 2180;
  const dot = ((frame / (fps * 2.5)) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* 环体〔M-001〕远景掠过（不停留——虚化陪衬层） */}
      <div style={{position: 'absolute', left: ringX, top: 300, opacity: 0.35}}>
        <LoopRing size={220} nodes={[]} showExit={false} showLabels={false} dotProgress={dot} />
      </div>
      {/* 左半：聊天记录长条（灰流——滚动渐虚化，口信海的不可查） */}
      <div
        style={{
          position: 'absolute',
          left: CHAT_1C.x,
          top: CHAT_1C.y,
          width: CHAT_1C.w,
          height: CHAT_1C.h,
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.94),
          overflow: 'hidden',
          opacity: 1 - 0.45 * calm,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, padding: '12px 20px 4px'}}>{'聊天记录 · 往上翻…'}</div>
        {Array.from({length: 9}, (_, i) => {
          const t = (i * 61 + frame * (1.6 - 1.2 * calm)) % 61;
          const y = 44 + t * 7.4;
          return (
            <div
              key={`chat${i}`}
              style={{
                position: 'absolute',
                left: 24 + (i % 3) * 26,
                top: y,
                width: CHAT_1C.w - 90 - (i % 3) * 40,
                height: 26,
                borderRadius: 8,
                background: withAlpha(theme.dim, 0.22),
                opacity: Math.max(0, 1 - Math.abs(y - 260) / 300) * 0.8,
              }}
            />
          );
        })}
      </div>
      {/* 右半：登记表（一行定格、状态胶囊清清楚楚——裁决物） */}
      <div style={{position: 'absolute', left: TABLE_1C.x, top: TABLE_1C.y}}>
        <RegistryTable
          x={0}
          y={0}
          w={TABLE_1C.w}
          rows={[{key: 'see', badge: undefined, type: '…', to: '…', state: 'pending', hotP: Math.max(0.15, hot)}]}
        />
      </div>
      {/* 四枚空白步签（表侧——①②③④ 虚位，签面暂空，步名留给 P2） */}
      <div style={{position: 'absolute', left: TABLE_1C.x, top: STEPS_1C.y, display: 'flex', gap: 22, opacity: steps}}>
        {[0, 1, 2, 3].map((i) => (
          <StepSign key={`ss${i}`} index={i} litP={steps} />
        ))}
      </div>
      {/* 「怎么转」问句签（幕尾钩——P2 接棒位） */}
      <div
        style={{
          position: 'absolute',
          left: CHAT_1C.x,
          top: 716,
          fontFamily: theme.serif,
          fontSize: 24,
          fontWeight: 700,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: see * 0.9,
        }}
      >
        翻记录？还是看表？
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'看表说话 · 拿一单关机，走四步'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P1RegistryTable: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p1-01', 'p1-04');
  const bB = w('p1-05', 'p1-06');
  const bC = w('p1-07', 'p1-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="1-A">
        <OneA
          atMorph={wa('p1-01', 0.45) - bA.from}
          atRow={wa('p1-02', 0.3) - bA.from}
          atNum={wa('p1-02', 0.55) - bA.from}
          atCols={[0.22, 0.34, 0.46, 0.6].map((f) => wa('p1-03', f) - bA.from)}
          atPills={[0.32, 0.46, 0.6].map((f) => wa('p1-04', f) - bA.from)}
        />
      </Sequence>
      <Sequence {...bB} name="1-B">
        <OneB
          atStub={wa('p1-05', 0.22) - bB.from}
          atWait={wa('p1-05', 0.31) - bB.from}
          atFly={wa('p1-05', 0.45) - bB.from}
          atMerge={wa('p1-05', 0.62) - bB.from}
          atBound={wa('p1-06', 0.68) - bB.from}
          atHalf={wa('p1-06', 0.82) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="1-C">
        <OneC atSee={wa('p1-07', 0.63) - bC.from} atSteps={wa('p1-08', 0.63) - bC.from} atSweep={wa('p1-08', 0.2) - bC.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1RegistryTable;
