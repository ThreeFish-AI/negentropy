/** P4 四个港口四种章程（p4-01..11，镜 4-A..4-F）——翻遍四家官方文档逐条对账：
 *  模范生 Gemini（确认门）→ 私货 Claude Code / 通吃 VS Code → 堆场路牌混战与 .agents 事实锚点
 *  → 宽容之门黄牌放行（CargoBox〔M-001〕恒定锚）→ 双跑盲评断言勾选 → 验箱师 13 处对不上、
 *  四家签名栏描空全空，唯独 Gemini 岗亭绿灯回闪。主色引航青；deny 金=警告牌/13 分歧，
 *  ok 绿只给断言勾选与确认门，danger 全幕不出场。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useDraw, useImpulse, useSpring, useStagger} from '../motion';
import {CargoBox, Counter, Footnote, Panel, SceneTag} from '../components/motifs';
import {Pill} from '../components/cards';
import {EvidenceBadge} from '../components/devices';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

/** 4-D 宽容之门（p4-07 装置句）：name 不匹配的箱子亮黄警告牌仍放行——CargoBox〔M-001〕
 *  恒定锚；黄=warn（deny），放行不是确认门、不占 ok；门禁计数器收口「严拒 4 / 宽进 12」。 */
const GatePass: React.FC<{at: number; stampAt: number; barAt: number; countAt: number}> = ({
  at,
  stampAt,
  barAt,
  countAt,
}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const inP = progress(frame, at, DUR.f6); // 箱子驶向验关台
  const outP = progress(frame, barAt + 4, DUR.f6); // 抬杆后放行（向右=进上下文）
  const stamp = useImpulse({at: stampAt, dur: DUR.f4}); // 黄牌拍上
  const mark = progress(frame, stampAt + 2, DUR.f3); // 黄牌留驻
  const rise = useSpring('settle', {at: barAt, dur: DUR.f5}); // 闸门抬杆
  const x = 36 + inP * 258 + outP * 470;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, opacity: show}}>
      <div style={{fontFamily: theme.serif, fontSize: 33, color: theme.text}}>宽容之门 · 黄牌照放</div>
      <div style={{position: 'relative', width: 1080, height: 296}}>
        {/* 验关台闸门：双柱 + 警示横杆（deny 金警示带） */}
        <div style={{position: 'absolute', left: 486, top: 36, width: 8, height: 222, borderRadius: 4, background: theme.panelBorder}} />
        <div style={{position: 'absolute', left: 664, top: 36, width: 8, height: 222, borderRadius: 4, background: theme.panelBorder}} />
        <div
          style={{
            position: 'absolute',
            left: 486,
            top: 126,
            width: 186,
            height: 14,
            borderRadius: 7,
            background: `repeating-linear-gradient(45deg, ${theme.deny} 0 14px, #0B0E13 14px 28px)`,
            transformOrigin: '7px 7px',
            transform: `rotate(${-rise * 64}deg)`,
          }}
        />
        {/* 港口地平线 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 254, height: 3, background: theme.panelBorder}} />
        {/* 待验集装箱〔M-001〕+ 黄警告牌 */}
        <div style={{position: 'absolute', left: x, top: 142}}>
          <CargoBox label="csv-clean" width={172} height={112} />
          <div
            style={{
              position: 'absolute',
              right: -14,
              top: -26,
              opacity: mark,
              transform: `scale(${0.6 + 0.4 * mark + stamp * 0.22})`,
            }}
          >
            <div
              style={{
                padding: '7px 15px',
                borderRadius: 9,
                border: `2.5px solid ${theme.deny}`,
                background: `${theme.deny}1E`,
                fontFamily: theme.sans,
                fontSize: 21,
                color: theme.deny,
                whiteSpace: 'nowrap',
              }}
            >
              名称不符
            </div>
          </div>
        </div>
      </div>
      {/* 门禁计数器（自建实测口径） */}
      <Panel style={{display: 'flex', alignItems: 'baseline', gap: 46, padding: '14px 44px'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, fontFamily: theme.sans, fontSize: 25, color: theme.deny}}>
          严拒 <Counter from={0} to={4} start={countAt} frames={DUR.f6} style={{fontSize: 42}} />
        </div>
        <div style={{width: 2, height: 40, background: theme.panelBorder}} />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, fontFamily: theme.sans, fontSize: 25, color: theme.concept}}>
          宽进 <Counter from={0} to={12} start={countAt} frames={DUR.f6} style={{fontSize: 42}} />
        </div>
      </Panel>
    </div>
  );
};

/** 4-E 断言清单行（纯展示件，lit 由父级 stagger 驱动）。ok 只给断言勾选。 */
const CheckRow: React.FC<{label: string; lit: number}> = ({label, lit}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 12, opacity: lit}}>
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        border: `2.5px solid ${theme.ok}`,
        background: `${theme.ok}1A`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: 18,
        color: theme.ok,
      }}
    >
      ✓
    </div>
    <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.text}}>{label}</div>
  </div>
);

/** 4-E 产物堆（纯展示件）：三层叠纸，dim=不带箱的那份。 */
const DocStack: React.FC<{dim: boolean}> = ({dim}) => (
  <div style={{position: 'relative', width: 150, height: 100}}>
    {[0, 1, 2].map((k) => (
      <div
        key={k}
        style={{
          position: 'absolute',
          left: k * 9,
          top: k * 17,
          width: 150 - k * 9,
          height: 66,
          borderRadius: 8,
          border: `2px solid ${dim ? theme.panelBorder : `${theme.concept}AA`}`,
          background: theme.panel,
        }}
      />
    ))}
  </div>
);

/** 4-E 双跑盲评（p4-08b/08c 装置句）：同单两跑（带箱〔M-001〕/不带）产物交遮幕裁判席，
 *  断言清单逐条勾选，「断言 3/3」计数收口——记账部分由 et-assert 章接管。 */
const BlindJudge: React.FC<{at: number; curtainAt: number; listAt: number; doneAt: number}> = ({
  at,
  curtainAt,
  listAt,
  doneAt,
}) => {
  const frame = useCurrentFrame();
  const show = progress(frame, at, DUR.f4);
  const enter = useStagger(2, {at, dur: DUR.f4, stride: 10}); // 两份产物入场
  const fall = useSpring('settle', {at: curtainAt, dur: DUR.f5}); // 遮幕落下
  const curtainO = progress(frame, curtainAt, DUR.f3);
  const listO = progress(frame, listAt, DUR.f4);
  const ticks = useStagger(3, {at: listAt, dur: DUR.f3, stride: 9}); // 断言逐条勾选
  const askO = progress(frame, curtainAt + 12, DUR.f4); // 裁判只问一句
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, opacity: show}}>
      <div style={{display: 'flex', gap: 16}}>
        <Pill color={theme.concept}>双跑</Pill>
        <Pill color={theme.concept}>盲评</Pill>
        <Pill color={theme.concept}>断言</Pill>
      </div>
      <div style={{position: 'relative', width: 1220, height: 320}}>
        {/* 左：两份产物（带箱=CargoBox〔M-001〕压顶） */}
        <div style={{position: 'absolute', left: 40, top: 46, display: 'flex', gap: 74, alignItems: 'flex-end'}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: enter[0]}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.concept}}>带箱</div>
            <CargoBox label="SKILL" width={128} height={84} />
            <DocStack dim={false} />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: enter[1]}}>
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>不带</div>
            <div style={{width: 128, height: 84}} />
            <DocStack dim />
          </div>
        </div>
        {/* 中：遮幕落下——裁判只见 A/B 编号，不知哪份带箱 */}
        <div
          style={{
            position: 'absolute',
            left: 470,
            top: 0,
            width: 280,
            height: 300,
            borderRadius: 12,
            border: `2.5px solid ${theme.panelBorder}`,
            background: theme.panel,
            transform: `translateY(${(1 - fall) * -330}px)`,
            opacity: curtainO,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, letterSpacing: 4}}>盲评</div>
          <div style={{display: 'flex', gap: 22}}>
            {['产物 A', '产物 B'].map((t) => (
              <div
                key={t}
                style={{
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: `2px solid ${theme.concept}77`,
                  fontFamily: theme.mono,
                  fontSize: 21,
                  color: theme.text,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        {/* 右：裁判席 */}
        <div
          style={{
            position: 'absolute',
            left: 952,
            top: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            opacity: show,
          }}
        >
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              border: `2.5px solid ${theme.concept}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.serif,
              fontSize: 30,
              color: theme.concept,
            }}
          >
            裁
          </div>
          <div style={{width: 220, height: 16, borderRadius: 8, background: theme.panelBorder}} />
          <div
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              border: `1.5px dashed ${theme.dim}88`,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.dim,
              opacity: askO,
            }}
          >
            哪份好？
          </div>
        </div>
      </div>
      {/* 断言清单：逐条勾选 + 计数收口 */}
      <Panel style={{display: 'flex', alignItems: 'center', gap: 42, padding: '16px 36px', opacity: listO}}>
        {['图表', '行数', '格式'].map((t, i) => (
          <CheckRow key={t} label={t} lit={ticks[i]} />
        ))}
        <div style={{fontFamily: theme.mono, fontSize: 27, color: theme.ok, marginLeft: 10}}>
          断言 <Counter from={0} to={3} start={doneAt} frames={DUR.f5} />/3
        </div>
      </Panel>
    </div>
  );
};

/** 4-F 签名栏（描空）：线描成、签位始终空——四家没有一家验签名。 */
const SignatureLine: React.FC<{at: number}> = ({at}) => {
  const d = useDraw(at, DUR.f5);
  return (
    <svg width={188} height={16} viewBox="0 0 188 16">
      <line x1={3} y1={8} x2={185} y2={8} stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" {...d} />
    </svg>
  );
};

/** 4-F 验箱师与真空（p4-11 装置句）：参考校验器 13 处对不上（deny=13 分歧）连打复现；
 *  四联卡签名栏描空全空——唯独 Gemini 岗亭绿灯回闪（ok=确认门，呼应 4-A）。 */
const PortQuad: React.FC<{at: number; lampAt: number}> = ({at, lampAt}) => {
  const frame = useCurrentFrame();
  const st = useStagger(4, {at, dur: DUR.f4, stride: 7}); // 四联卡入场
  const marks = useStagger(13, {at: at + 6, dur: DUR.f2, stride: 2}); // 13 ✗ 连打
  const lampOn = progress(frame, lampAt, DUR.f3); // 绿灯常亮
  const blink = Math.max(useImpulse({at: lampAt, dur: DUR.f5}), useImpulse({at: lampAt + 16, dur: DUR.f5})); // 回闪两拍
  const ports = [
    {name: 'Gemini', hot: true},
    {name: 'Claude Code', hot: false},
    {name: 'OpenAI', hot: false},
    {name: 'VS Code', hot: false},
  ];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        opacity: progress(frame, at, DUR.f4),
      }}
    >
      {/* 复核条：13 ✗ 连打 + 计数 */}
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>验箱师复核</div>
        <div style={{display: 'flex', gap: 6}}>
          {marks.map((m, i) => (
            <div key={i} style={{opacity: m, fontFamily: theme.mono, fontSize: 21, color: theme.deny}}>
              ✗
            </div>
          ))}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.deny}}>
          ×<Counter from={0} to={13} start={at + 32} frames={DUR.f5} />
        </div>
      </div>
      {/* 四联卡：签名栏描空，唯 Gemini 确认门绿灯 */}
      <div style={{display: 'flex', gap: 24}}>
        {ports.map((p, i) => (
          <div key={p.name} style={{opacity: st[i], transform: `translateY(${(1 - st[i]) * 18}px)`}}>
            <Panel
              accent={p.hot ? theme.concept : theme.panelBorder}
              style={{
                width: 248,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 10, minHeight: 32}}>
                {p.hot ? (
                  <div
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 8,
                      background: theme.ok,
                      boxShadow: `0 0 ${6 + 30 * Math.max(blink, lampOn * 0.5)}px ${theme.ok}`,
                      opacity: 0.3 + 0.7 * Math.max(blink, lampOn * 0.8),
                    }}
                  />
                ) : null}
                <div style={{fontFamily: theme.sans, fontSize: 25, color: p.hot ? theme.text : theme.dim}}>{p.name}</div>
              </div>
              <SignatureLine at={at + 16 + i * 6} />
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 17,
                  padding: '4px 12px',
                  borderRadius: 7,
                  color: p.hot ? theme.ok : theme.dim,
                  border: `1.5px solid ${p.hot ? `${theme.ok}88` : theme.panelBorder}`,
                }}
              >
                {p.hot ? '确认门' : '不验签名'}
              </div>
            </Panel>
          </div>
        ))}
      </div>
    </div>
  );
};

export const P4: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-04');
  const bC = w('p4-05a', 'p4-05b');
  const bD = w('p4-06', 'p4-08');
  const bE = w('p4-08a', 'p4-08d');
  const bF = w('p4-09', 'p4-11');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="4-A 对账开场与模范生">
        <SceneTag chapter="P4" tagline="四个港口四种章程" accent={theme.concept} />
        <ArchifyRecap
          slug="four-ports-charter"
          caption="四港章程对账"
          cues={[
            {chapterId: 'fp-quartet', at: at('p4-01') - bA.from, durationInFrames: dur('p4-01')},
            {chapterId: 'fp-ports', at: at('p4-02') - bA.from, durationInFrames: dur('p4-02')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="4-B 私货与通吃">
        <SceneTag chapter="P4" tagline="四个港口四种章程" accent={theme.concept} />
        {/* fp-gemini@p4-02 跨镜背靠背 → lead={false}；03→04 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="four-ports-charter"
          caption="四港章程对账"
          lead={false}
          cues={[
            {chapterId: 'fp-cc', at: at('p4-03') - bB.from, durationInFrames: dur('p4-03')},
            {chapterId: 'fp-vscode', at: at('p4-04') - bB.from, durationInFrames: dur('p4-04')},
          ]}
        />
        <Footnote delay={at('p4-04') - bB.from + Math.round(dur('p4-04') / 2)}>私货字段 · 三套全认</Footnote>
      </Sequence>

      <Sequence {...bC} name="4-C 堆场混战">
        <SceneTag chapter="P4" tagline="四个港口四种章程" accent={theme.concept} />
        {/* fp-vscode@p4-04 跨镜背靠背 → lead={false}；05a→05b 同实例由 enters 抑制 */}
        <ArchifyRecap
          slug="four-ports-charter"
          caption="四港章程对账"
          lead={false}
          cues={[
            // fp-paths 章已合并锚点内容（four-ports 5 章契约）；p4-05b 由本章时长覆盖
            {chapterId: 'fp-paths', at: at('p4-05a') - bC.from, durationInFrames: dur('p4-05a', 'p4-05b')},
          ]}
        />
        <Footnote delay={at('p4-05b') - bC.from + Math.round(dur('p4-05b') / 2)}>.agents · 四家全认</Footnote>
      </Sequence>

      <Sequence {...bD} name="4-D 宽容之门">
        <SceneTag chapter="P4" tagline="四个港口四种章程" accent={theme.concept} />
        <EvidenceBadge text="自建实测 · 12 箱" at={at('p4-06') - bD.from} />
        <ArchifyYield
          cues={[
            {at: at('p4-06') - bD.from, durationInFrames: dur('p4-06')},
            {at: at('p4-08') - bD.from, durationInFrames: dur('p4-08')},
          ]}
        >
          <GatePass
            at={at('p4-07') - bD.from}
            stampAt={at('p4-07') - bD.from + 16}
            barAt={at('p4-07') - bD.from + 30}
            countAt={at('p4-07') - bD.from + Math.round(dur('p4-07') * 0.66)}
          />
        </ArchifyYield>
        {/* fp-anchor@p4-05b 跨镜背靠背 → 首实例 lead={false}；ls-x2 前有 p4-07 装置空窗 → 恢复入场 */}
        <ArchifyRecap
          slug="lenient-vs-strict"
          caption="宽容与严格两道门"
          lead={false}
          cues={[{chapterId: 'ls-warnload', at: at('p4-06') - bD.from, durationInFrames: dur('p4-06')}]}
        />
        <ArchifyRecap
          slug="lenient-vs-strict"
          caption="宽容与严格两道门"
          cues={[{chapterId: 'ls-x2', at: at('p4-08') - bD.from, durationInFrames: dur('p4-08')}]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 双跑盲评">
        <SceneTag chapter="P4" tagline="四个港口四种章程" accent={theme.concept} />
        <ArchifyYield
          cues={[
            {at: at('p4-08a') - bE.from, durationInFrames: dur('p4-08a')},
            {at: at('p4-08d') - bE.from, durationInFrames: dur('p4-08d')},
          ]}
        >
          <BlindJudge
            at={at('p4-08b') - bE.from}
            curtainAt={at('p4-08b') - bE.from + 10}
            listAt={at('p4-08c') - bE.from}
            doneAt={at('p4-08c') - bE.from + Math.round(dur('p4-08c') * 0.55)}
          />
        </ArchifyYield>
        {/* ls-x2@p4-08 跨镜背靠背 → 首实例 lead={false}；et-assert 前有 08b/08c 装置空窗 → 恢复入场 */}
        <ArchifyRecap
          slug="eval-twin-runs"
          caption="同单双跑盲评"
          lead={false}
          cues={[{chapterId: 'et-blind', at: at('p4-08a') - bE.from, durationInFrames: dur('p4-08a')}]}
        />
        <ArchifyRecap
          slug="eval-twin-runs"
          caption="同单双跑盲评"
          cues={[{chapterId: 'et-assert', at: at('p4-08d') - bE.from, durationInFrames: dur('p4-08d')}]}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 验箱师与签名真空">
        <SceneTag chapter="P4" tagline="四个港口四种章程" accent={theme.concept} />
        <EvidenceBadge text="自建复核 · 13 条" at={at('p4-09') - bF.from} />
        <ArchifyYield
          cues={[
            {at: at('p4-09') - bF.from, durationInFrames: dur('p4-09')},
            {at: at('p4-10') - bF.from, durationInFrames: dur('p4-10')},
          ]}
        >
          <PortQuad at={at('p4-11') - bF.from} lampAt={at('p4-11') - bF.from + 20} />
        </ArchifyYield>
        {/* et-assert@p4-08d 跨镜背靠背 → lead={false}；09→10 同实例连续换章由 enters 抑制；
            p4-11 为装置空窗（绿灯回闪） */}
        <ArchifyRecap
          slug="four-ports-charter"
          caption="四港章程对账"
          lead={false}
          cues={[
            {chapterId: 'fp-ref', at: at('p4-09') - bF.from, durationInFrames: dur('p4-09')},
            {chapterId: 'fp-vacuum', at: at('p4-10') - bF.from, durationInFrames: dur('p4-10')},
          ]}
        />
        <Footnote delay={at('p4-11') - bF.from + 24}>「建议考虑」· 它当了真</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};
