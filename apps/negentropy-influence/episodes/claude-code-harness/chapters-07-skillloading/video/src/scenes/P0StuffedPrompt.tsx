/** P0 六千五百行的账（p0-01..p0-09，3 镜）——分镜 0-A / 0-B / 0-C。
 *
 *  叙事链：系列片头交棒后冷启动直入（开篇视听合力 I-039）——画面中央一条细长
 *  开场白带（全片主装置·病灶态首亮：灰白问题态）横贯；p0-01「六千五百行」词落
 *  三摞文档自上方压落、带身一沉〔M-005〕、「全额再付」词落计费格首枚格子亮起
 *  （计费帧雏形）→ p0-02「开场白」词落定义签贴上（角标 system prompt）、「装
 *  不下」词落带身胀满泛警示红一拍 → p0-03「每轮」词落带子向右复制一份叠印
 *  （每轮复制叠印首演——常驻成本具象）→ 0-B 推近带内：三摞文档逐份滑入带身
 *  （界面规范/数据库指南/接口文档三签各带行数标尺）、带右缘 6500 行总标尺立起、
 *  「只改一个颜色」小任务卡落角落；p0-06「百分之九十九」带内 99% 区域集体灰掉、
 *  只余任务卡邻近一线亮区（重音镜 punch）〔M-003〕；p0-07「按长度计费」计价签
 *  贴上、「每轮全额付」叠印帧加速——带子向右逐轮复制、账格逐轮 +6500 → 0-C
 *  注意力视角帧（拉回全局）：消息历史区纵列、早期带内容灰暗；一枚聚光灯视野
 *  只罩当轮最新消息条（「注意力」词落收窄）；p0-09「用到才拿」引子卡浮起定格
 *  （全片问题句，转 P1）。
 *
 *  空间契约：单主体开场白带、三摞文档只带行数标尺签、任务卡全程可见、总标尺
 *  刻度与三摞行数吻合（2000+1500+3000=6500）、灰区面积与 99% 口径一致、叠印
 *  帧数与轮数相符、聚光灯单一只罩当轮条、署源角标右下恒定不抢焦（首部署源位）。
 *  0-C 末帧灰暗带的屏位 = 1-A 首帧紫目录带亮起的屏位（容器同位呼应，判替换
 *  不 morph——ep2 0-C→1-A 问题物→答案物判例）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；system prompt / ×6500
 *  只进角标；读数单位全汉字旁标。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BillingStack, CatalogBand} from '../components/motifs';
import {DUR, clamp01, progress, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 署源角标（首部署源位，RSI I-080 豁免登记）：右下常驻，一次淡入后恒定不抢焦；
 *  bottom 168 避开字幕条（承 ep1–ep6 SourceCredit 形态） */
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

/** 主带位（0-A 病灶态细长 / 0-C 灰暗态同位——1-A 紫目录带同屏位接力） */
const BAND = {x: 360, y: 430, w: 1200, h: 96} as const;

/** 三摞文档（0-A 压落——各带行数标尺签，不具名） */
const STACKS = [
  {x: 620, tag: '两千行', lines: 2000},
  {x: 960, tag: '一千五百行', lines: 1500},
  {x: 1300, tag: '三千行', lines: 3000},
] as const;

const DocTriplet: React.FC<{press: number; dim?: number}> = ({press, dim = 0}) => (
  <>
    {STACKS.map((s) => {
      const p = clamp01(press);
      const drop = (1 - p) * -170;
      return (
        <div
          key={s.tag}
          style={{
            position: 'absolute',
            left: s.x - 90,
            top: 214 + drop,
            width: 180,
            opacity: (0.35 + 0.65 * p) * (1 - 0.6 * clamp01(dim)),
          }}
        >
          {/* 文档页叠（六页薄板——体量剪影） */}
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <div
              key={k}
              style={{
                height: 13,
                marginBottom: 4,
                borderRadius: 3,
                background: withAlpha(theme.dim, 0.34 - k * 0.03),
                border: `1.5px solid ${withAlpha(theme.dim, 0.4)}`,
                width: `${100 - k * 6}%`,
              }}
            />
          ))}
          {/* 行数标尺签（只标行数、不具名） */}
          <div
            style={{
              marginTop: 8,
              textAlign: 'center',
              padding: '4px 10px',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.dim, 0.75)}`,
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {s.tag}
          </div>
        </div>
      );
    })}
  </>
);

// ── 0-A 冷启动：三摞压带 + 计费格雏形 + 定义签 + 复制叠印首演 ────────────

const ZeroA: React.FC<{atPress: number; atSink: number; atCell: number; atDef: number; atSwell: number; atCopy: number}> = ({
  atPress,
  atSink,
  atCell,
  atDef,
  atSwell,
  atCopy,
}) => {
  // 「六千五百行」三摞文档压落 + 带身一沉（M-005：词落位点火）
  const press = useProgress(atPress, DUR.f5, 'decelerate');
  const sink = useProgress(atSink, DUR.f4);
  // 「全额再付」计费格首枚亮起（雏形——闪现语义态显式锁存：格亮即保持）
  const cell = useProgress(atCell, DUR.f4);
  const cellFlash = useImpulse({at: atCell, dur: DUR.f5, peak: 1});
  // 「开场白」定义签贴上（锁存）；「装不下」带身胀满泛警示红一拍（一拍即收）
  const def = useProgress(atDef, DUR.f4);
  const swell = useImpulse({at: atSwell, dur: DUR.f5, peak: 1});
  const swellHold = useProgress(atSwell, DUR.f3);
  // 「每轮」带子向右复制一份叠印（首演——一份即止）
  const copy = useProgress(atCopy, DUR.f5, 'decelerate');
  return (
    <AbsoluteFill>
      {/* 三摞文档（上方压落） */}
      <DocTriplet press={press} />
      {/* 开场白带（病灶态·灰白）+ 计费叠印帧（同位挂载） */}
      <div style={{position: 'absolute', left: BAND.x, top: BAND.y + 14 * sink, width: BAND.w, height: BAND.h + 20 * swellHold}}>
        <BillingStack x={0} y={0} w={BAND.w} h={BAND.h + 20 * swellHold} copies={copy} cellsLit={cell} perRound={'+6500'} cellTag={'每轮全额'} />
        <div style={{position: 'absolute', inset: 0}}>
          <CatalogBand
            x={0}
            y={0}
            w={BAND.w}
            h={BAND.h + 20 * swellHold}
            accent={theme.dim}
            headLabel={'开场白 · system prompt'}
            lit={1}
            swell={swellHold}
          />
        </div>
      </div>
      {/* 计费格首亮闪注（一拍即收的强调，不常驻） */}
      {cellFlash > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: BAND.x + 8,
            top: BAND.y + BAND.h + 66,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: cellFlash,
          }}
        >
          {'全额再付 · 计费格雏形'}
        </div>
      ) : null}
      {/* 定义签（每轮固定摆在模型面前的文本——角标 system prompt） */}
      <div
        style={{
          position: 'absolute',
          left: BAND.x,
          top: BAND.y - 56,
          padding: '6px 16px',
          borderRadius: 8,
          border: `2px solid ${withAlpha(theme.dim, 0.85)}`,
          background: theme.panel,
          fontFamily: theme.sans,
          fontSize: 19,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: def,
          transform: `translateY(${(1 - def) * -14}px)`,
        }}
      >
        {'每轮固定摆在模型面前的文本'}
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 10}}>{'system prompt'}</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'知识的账 · 每轮全额再付'}
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 0-B 推近带内：三摞滑入 + 6500 总标尺 + 99% 灰化 + 叠印加速 ────────────

/** 0-B 大带内景（CU 机位——同一物理带的病灶爆涨态） */
const BIG = {x: 330, y: 200, w: 1260, h: 600} as const;

/** 带内三摞文档列（具名三签 + 行数标尺随行增长） */
const NamedStacks: React.FC<{lit: readonly number[]; grow: readonly number[]; grey: number; sink: number}> = ({lit, grow, grey, sink}) => {
  const docs = [
    {zh: '界面规范', en: 'react-style', lines: 2000},
    {zh: '数据库指南', en: 'sql-style', lines: 1500},
    {zh: '接口文档', en: 'api-design', lines: 3000},
  ] as const;
  return (
    <>
      {docs.map((d, i) => {
        const p = clamp01(lit[i] ?? 0);
        const g = clamp01(grow[i] ?? 0);
        const pages = 14;
        return (
          <div
            key={d.en}
            style={{
              position: 'absolute',
              left: BIG.x + 60 + i * 400,
              top: BIG.y + 120 + 26 * clamp01(sink),
              width: 330,
              opacity: 0.25 + 0.75 * p,
              transform: `translateY(${(1 - p) * -46}px)`,
              filter: `saturate(${1 - 0.62 * clamp01(grey)})`,
            }}
          >
            {/* 名签 + 行数标尺（刻度随行增长——读数到位） */}
            <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10}}>
              <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: grey > 0.5 ? theme.dim : theme.text}}>{d.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, fontVariantNumeric: 'tabular-nums'}}>
                {`${Math.round(d.lines * g)} 行`}
              </span>
            </div>
            {/* 文档页（体量条——页数示意、行读数走标尺） */}
            <div style={{position: 'relative', height: 330}}>
              {Array.from({length: pages}, (_, k) => {
                const on = clamp01(g * pages - k);
                return (
                  <div
                    key={k}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: k * 23,
                      width: `${96 - (k % 4) * 7}%`,
                      height: 17,
                      borderRadius: 4,
                      background: withAlpha(theme.dim, 0.2 + 0.14 * on),
                      border: `1.5px solid ${withAlpha(theme.dim, 0.3 + 0.2 * on)}`,
                      opacity: 0.35 + 0.65 * on,
                    }}
                  />
                );
              })}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{d.en}</div>
          </div>
        );
      })}
    </>
  );
};

const ZeroB: React.FC<{atS1: number; atS2: number; atS3: number; atTotal: number; atTask: number; atSink: number; atGrey: number; atPrice: number; atAccel: number}> = ({
  atS1,
  atS2,
  atS3,
  atTotal,
  atTask,
  atSink,
  atGrey,
  atPrice,
  atAccel,
}) => {
  const frame = useCurrentFrame();
  // 三摞 stagger 滑入（词落=「界面规范/数据库指南/接口文档」三词）+ 行数标尺随行增长
  const lit = [0, 1, 2].map((i) => clamp01(progress(frame, [atS1, atS2, atS3][i], DUR.f5)));
  const grow = [0, 1, 2].map((i) => clamp01(progress(frame, [atS1, atS2, atS3][i] + DUR.f4, DUR.f6)));
  // 「六千五百行」总标尺撑到顶（数据本体：6500 到位即止、禁过冲）
  const total = clamp01(progress(frame, atTotal, DUR.f6));
  const totalVal = 6500 * total;
  // 「只改一个颜色」小任务卡落角落；「整本带着」三摞全量沉底
  const task = useProgress(atTask, DUR.f4);
  const sink = useProgress(atSink, DUR.f5);
  // 「百分之九十九」99% 灰化（重音镜 punch：1–2s 定格）——灰化锁存
  const grey = useProgress(atGrey, DUR.f5);
  const greyPunch = useImpulse({at: atGrey, dur: DUR.f6 + DUR.f4, peak: 1});
  // 「按长度计费」计价签贴上；「每轮全额付」叠印帧加速（copies 1→3、格逐轮 +6500）
  const price = useProgress(atPrice, DUR.f4);
  const accel = clamp01(progress(frame, atAccel, DUR.f6 + DUR.f4));
  const copies = 1 + 2 * accel;
  const cells = 1 + 2 * accel;
  return (
    <AbsoluteFill>
      {/* 大带内景（病灶爆涨态——头部标签承 0-A） */}
      <div style={{position: 'absolute', left: BIG.x, top: BIG.y, width: BIG.w, height: BIG.h}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.95),
            position: 'relative',
            overflow: 'hidden',
            boxShadow: grey > 0.4 ? `inset 0 0 ${60 * grey}px ${withAlpha(theme.bg, 0.8)}` : 'none',
          }}
        >
          <div style={{padding: '16px 24px 0', fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'开场白 · system prompt · 带内'}</div>
          {/* 三摞文档列（具名 + 行数标尺） */}
          <div style={{position: 'absolute', inset: 0, opacity: 1 - 0.55 * grey}}>
            <NamedStacks lit={lit} grow={grow} grey={grey} sink={sink} />
          </div>
          {/* 99% 灰化遮罩：任务卡邻近一线亮区外全灰（灰区面积与口径一致） */}
          {grey > 0.02 ? (
            <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.bg, 0.62 * grey), pointerEvents: 'none'}} />
          ) : null}
          {/* 小任务卡（p0-05 落角落后全程可见；99% 灰化时成为唯一亮区一线） */}
          {task > 0.02 ? (
            <div
              style={{
                position: 'absolute',
                left: BIG.w - 480,
                top: BIG.h - 210,
                opacity: task,
                transform: `translateY(${(1 - task) * 22}px)`,
              }}
            >
              <div
                style={{
                  width: 300,
                  height: 96,
                  borderRadius: 10,
                  border: `2.5px solid ${withAlpha(theme.text, 0.55 + 0.4 * grey)}`,
                  background: theme.panel,
                  boxShadow: grey > 0.05 ? `0 0 ${26 * grey + 20 * greyPunch}px ${withAlpha(theme.text, 0.3 * grey)}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 18px',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{width: 30, height: 30, borderRadius: 6, background: theme.core, display: 'inline-block'}} />
                <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'只改一个颜色'}</span>
              </div>
              {/* 任务卡左侧一线亮区（灰化后唯一亮带的延伸——「只余一线」可读） */}
              {grey > 0.05 ? (
                <div
                  style={{
                    position: 'absolute',
                    right: 316,
                    top: 24,
                    width: 150 * grey,
                    height: 44,
                    borderRadius: 8,
                    background: withAlpha(theme.text, 0.1 * grey),
                    border: `2px solid ${withAlpha(theme.text, 0.4 * grey)}`,
                  }}
                />
              ) : null}
            </div>
          ) : null}
          {/* 右缘 6500 总标尺（刻度与三摞行数吻合 2000+1500+3000） */}
          <div style={{position: 'absolute', right: 26, top: 110, bottom: 60, width: 74}}>
            <div style={{position: 'relative', width: '100%', height: '100%'}}>
              <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, background: withAlpha(theme.dim, 0.55)}} />
              {[0, 1, 2, 3].map((k) => (
                <div key={k} style={{position: 'absolute', right: 0, top: `${25 * k}%`, width: 22, height: 2, background: withAlpha(theme.dim, 0.55)}} />
              ))}
              {/* 标尺读数（撑到顶——6500 定格） */}
              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  top: `${100 - 82 * total}%`,
                  fontFamily: theme.mono,
                  fontSize: 19,
                  fontWeight: 700,
                  color: theme.text,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${Math.round(totalVal)}`}
                <div style={{fontSize: 13, color: theme.dim, fontWeight: 400}}>{'行 · 满标'}</div>
              </div>
            </div>
          </div>
          {/* 计价签（按长度计费——贴带内右上） */}
          <div
            style={{
              position: 'absolute',
              right: 130,
              top: 18,
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.danger, 0.85)}`,
              background: withAlpha(theme.danger, 0.08),
              fontFamily: theme.sans,
              fontSize: 19,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: price,
            }}
          >
            {'按长度计费'}
          </div>
        </div>
      </div>
      {/* 叠印帧加速（带子向右逐轮复制、账格逐轮 +6500——叠印帧数与轮数相符） */}
      <div style={{position: 'absolute', left: BIG.x, top: BIG.y + BIG.h + 10, width: BIG.w - 260}}>
        <BillingStack x={0} y={0} w={BIG.w - 300} h={60} copies={copies} cellsLit={cells} perRound={'+6500'} cellTag={'每轮全额付'} />
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 0-C 注意力视角帧：聚光灯只罩当轮条 + 引子卡 ───────────────────────────

/** 0-C 消息历史区（band 顶置灰暗——1-A 紫目录带同位接力） */
const HIST = {x: 380, y: 330, w: 1160} as const;

const ZeroC: React.FC<{atSpot: number; atDimA: number; atCard: number}> = ({atSpot, atDimA, atCard}) => {
  // 「注意力」聚光灯收窄（宽罩 → 只罩当轮条）
  const spot = useProgress(atSpot, DUR.f5, 'decelerate');
  // 「被稀释」早期内容降饱和淡出（灰暗=缺席的具象——锁存到帧尾）
  const dimA = useProgress(atDimA, DUR.f6);
  // 「用到才拿」引子卡浮起定格（全片问题句——短语不成句）
  const card = useProgress(atCard, DUR.f5);
  const rows = 7;
  return (
    <AbsoluteFill>
      {/* 开场白带（灰暗态——屏位同 1-A 紫目录带首亮位） */}
      <CatalogBand x={HIST.x} y={HIST.y} w={HIST.w} h={96} accent={theme.dim} headLabel={'开场白 · system prompt'} dim={0.25 + 0.35 * dimA} />
      {/* 消息历史区纵列（早期在上灰暗、当轮最新在下） */}
      <div style={{position: 'absolute', left: HIST.x + 60, top: HIST.y + 130, width: HIST.w - 120}}>
        {Array.from({length: rows}, (_, i) => {
          // 深度：越早（上）越暗——降饱和淡出方向恒定（压暗向早期侧）
          const depth = i / (rows - 1);
          const ghost = clamp01(0.15 + 0.5 * depth + 0.35 * dimA * depth);
          return (
            <div
              key={i}
              style={{
                height: 44,
                marginBottom: 10,
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `2px solid ${ghost > 0.5 ? withAlpha(theme.panelBorder, 0.9) : withAlpha(theme.dim, 0.55)}`,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                fontFamily: theme.sans,
                fontSize: 18,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: clamp01(1 - 0.55 * ghost),
                filter: `saturate(${1 - 0.6 * ghost})`,
              }}
            >
              {i === rows - 1 ? '当轮最新消息' : `历史消息 ${i + 1}`}
            </div>
          );
        })}
      </div>
      {/* 聚光灯视野（单一——收窄只罩当轮条：高度从全列收到当轮条 + 亮圈） */}
      <div
        style={{
          position: 'absolute',
          left: HIST.x + 40,
          top: HIST.y + 130 + (rows - 1) * 54 - 30 - (1 - spot) * 200,
          width: HIST.w - 80,
          height: 108 + (1 - spot) * 420,
          borderRadius: 18,
          border: `${3.5}px solid ${withAlpha(theme.text, 0.28 + 0.5 * spot)}`,
          boxShadow: spot > 0.3 ? `0 0 ${46 * spot}px ${withAlpha(theme.text, 0.16)}` : 'none',
          pointerEvents: 'none',
        }}
      />
      <div style={{position: 'absolute', left: HIST.x + 40, top: HIST.y + 128, fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: spot}}>
        {'注意力 · 只罩当轮'}
      </div>
      {/* 引子卡（浮起定格——短语 + 问号；转 P1） */}
      <div
        style={{
          position: 'absolute',
          left: 1490,
          top: 560 - 40 * card,
          opacity: card,
          transform: `translateY(${(1 - card) * 30}px)`,
        }}
      >
        <div
          style={{
            padding: '20px 34px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(theme.text, 0.85)}`,
            background: theme.panel,
            boxShadow: card > 0.6 ? `0 0 ${30 * card}px ${withAlpha(theme.text, 0.22)}` : 'none',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'用到才拿？'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 8}}>{'知识怎么进场'}</div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'被稀释 · 等于缺席'}
      </div>
      <SourceCredit />
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0StuffedPrompt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-07');
  const bC = w('p0-08', 'p0-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A">
        <ZeroA
          atPress={wa('p0-01', 0.12) - bA.from}
          atSink={wa('p0-01', 0.3) - bA.from}
          atCell={wa('p0-01', 0.72) - bA.from}
          atDef={wa('p0-02', 0.26) - bA.from}
          atSwell={wa('p0-02', 0.68) - bA.from}
          atCopy={wa('p0-03', 0.34) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="0-B">
        <ZeroB
          atS1={wa('p0-04', 0.28) - bB.from}
          atS2={wa('p0-04', 0.52) - bB.from}
          atS3={wa('p0-04', 0.76) - bB.from}
          atTotal={wa('p0-05', 0.2) - bB.from}
          atTask={wa('p0-05', 0.52) - bB.from}
          atSink={wa('p0-05', 0.82) - bB.from}
          atGrey={wa('p0-06', 0.14) - bB.from}
          atPrice={wa('p0-07', 0.14) - bB.from}
          atAccel={wa('p0-07', 0.6) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="0-C">
        <ZeroC
          atSpot={wa('p0-08', 0.34) - bC.from}
          atDimA={wa('p0-08', 0.64) - bC.from}
          atCard={wa('p0-09', 0.6) - bC.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0StuffedPrompt;
