/** P2 加一个工具，只改一行（分镜 2-A…2-H）—— 开源示教素材「Tool Dispatch Map」的概念重建
 *  重点视觉演绎：并发安全 ≠ 只读（真值表对撞）、连续块分批、读文件落盘自循环。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {CodeCard, DispatchTable, Footnote, LoopRing, NumberedCard, Panel, SceneHeader, Terminal, useRingDot} from '../components/motifs';

/** 环留在左上角：缩小但同色同线宽。
 *  落位约束：SceneHeader 占 top 52..112（含 bottom:-14 的幕内进度条，实际到 y≈126），
 *  角环必须整体落在其**下方**。此前 top:56 让环上半圈直接压在幕标题「P2 加一个工具，
 *  只改一行」上、环线又横穿进度条（2026-08 帧级复查 f7431/f9041/f10615 实拍坐实）。
 *  size=190 的 LoopRing 内部半径 = 95−46 = 49，环上沿 = top + 95 − 49 − 3(线宽半)；
 *  取 top:150 ⇒ 环上沿 y≈193，与进度条留 67px 净空。 */
const CornerRing: React.FC<{pulse?: boolean}> = ({pulse = false}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.5);
  const p = pulse ? 0.6 + 0.4 * Math.sin(frame / 4) : 1;
  return (
    <div style={{position: 'absolute', left: 64, top: 150, opacity: p}}>
      <LoopRing size={190} draw={1} dotProgress={dot} showExit={false} />
    </div>
  );
};

/** 2-A 命令行拼接的笨拙 */
const ClumsyCommands: React.FC<{typoAt: number}> = ({typoAt}) => {
  const frame = useCurrentFrame();
  const bad = frame >= typoAt;
  const shake = bad ? Math.sin((frame - typoAt) / 1.6) * 3 : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
            <CornerRing />
      <div style={{display: 'flex', alignItems: 'center', gap: 44}}>
        <Panel accent={theme.mech} style={{width: 330, padding: '20px 24px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'模型想的是'}</div>
          <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.mech, marginTop: 8}}>
            {'读这个文件'}
          </div>
        </Panel>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.deny}}>{'翻译 +1 层'}</div>
          <div style={{fontSize: 44, color: theme.deny, lineHeight: 1}}>{'→'}</div>
        </div>
        <div style={{transform: `translateX(${shake}px)`}}>
          <Terminal
            width={720}
            height={230}
            cps={22}
            lines={[
              {prompt: '$', text: 'cat path/to/file.py', delay: 10},
              {prompt: '$', text: 'echo "..." > file.py', delay: 46},
            ]}
          />
        </div>
      </div>
      <Footnote delay={typoAt}>{'多一层翻译：费 token，还容易拼错'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-B 五张工具卡（反枚举：只有编号染色） */
const FiveTools: React.FC = () => {
  const frame = useCurrentFrame();
  const tools = ['跑命令', '读文件', '写文件', '改文件', '按模式找文件'];
  const mono = ['bash', 'read_file', 'write_file', 'edit_file', 'glob'];
  // 官方五类工具地图（how-claude-code-works）：示例五件归位官方分区，两个空槽亮虚线（Harness Engineering 改造）
  const zones = ['文件操作', '文件操作', '文件操作', '文件操作', '搜索'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CornerRing />
      <div style={{display: 'flex', gap: 20}}>
        {tools.map((t, i) => (
          <div key={t} style={{textAlign: 'center'}}>
            <NumberedCard index={i + 1} label={t} sub={mono[i]} active delay={i * 4} />
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 17,
                color: theme.dim,
                marginTop: 10,
                opacity: interpolate(frame - 20, [0, 12], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {zones[i]}
            </div>
          </div>
        ))}
        {/* 官方地图的两个空槽（执行类之外的 执行/网页/代码智能 区） */}
        {['执行', '网页'].map((z, i) => (
          <div
            key={z}
            style={{
              width: 220,
              height: 130,
              border: `2px dashed ${theme.panelBorder}`,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: interpolate(frame - 26 - i * 8, [0, 12], [0, 0.8], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              alignSelf: 'center',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{z}</span>
            <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'官方地图另有'}</span>
          </div>
        ))}
      </div>
      <Footnote delay={34}>
        {'官方内置工具五类：文件 / 搜索 / 执行 / 网页 / 代码智能 —— how-claude-code-works'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 2-C 字典分发表 + 命中行辉光 + 末尾空槽落入新映射 */
const Dispatch: React.FC<{hitAt: number; slotAt: number}> = ({hitAt, slotAt}) => {
  const frame = useCurrentFrame();
  const rows = [
    {key: 'bash', value: 'run_bash'},
    {key: 'read_file', value: 'run_read'},
    {key: 'write_file', value: 'run_write'},
    {key: 'edit_file', value: 'run_edit'},
    {key: 'glob', value: 'run_glob'},
  ];
  const hit = frame >= hitAt ? 1 : -1;
  const flyT = interpolate(frame - hitAt, [-14, 0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 70}}>
      <CornerRing />
      <div style={{position: 'relative'}}>
        <DispatchTable
          rows={rows}
          hit={hit}
          emptySlot={frame >= slotAt - 20}
          slotFilled={frame >= slotAt}
        />
        {flyT > 0 && flyT < 1 ? (
          <div
            style={{
              position: 'absolute',
              left: -70 + flyT * 70,
              top: 96,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: theme.mech,
            }}
          />
        ) : null}
      </div>
      <div style={{width: 330}}>
        <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, lineHeight: 1.5}}>
          {'前台的转接号码簿'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, marginTop: 14, lineHeight: 1.6}}>
          {'来电报个名字，'}
          <br />
          {'前台照着簿子转接。'}
          <br />
          {'换人只改簿子，'}
          <br />
          {'不改前台的流程。'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2-D 两版代码并置：唯一一行不同 */
const OneLineDiff: React.FC<{pulseAt: number}> = ({pulseAt}) => {
  const frame = useCurrentFrame();
  const before = [
    'for block in tool_calls:',
    '    output = run_bash(',
    '        block.input["command"])',
    '    results.append(...)',
  ];
  const after = [
    'for block in tool_calls:',
    '    handler = TOOL_HANDLERS[block.name]',
    '    output = handler(**block.input)',
    '    results.append(...)',
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CornerRing pulse={frame >= pulseAt} />
      <div style={{display: 'flex', gap: 44, alignItems: 'center'}}>
        {[
          {t: '之前', lines: before, hl: [1, 2]},
          {t: '之后', lines: after, hl: [1, 2]},
        ].map((side, i) => (
          <div key={side.t}>
            <div
              style={{
                fontFamily: theme.sans,
                fontSize: 26,
                color: i === 1 ? theme.mech : theme.dim,
                marginBottom: 12,
              }}
            >
              {side.t}
            </div>
            <CodeCard
              lines={side.lines}
              width={640}
              framesPerLine={2}
              highlight={side.hl}
              dimOthers
              showLineNumbers={false}
              accent={i === 1 ? theme.mech : undefined}
            />
          </div>
        ))}
      </div>
      <Footnote delay={pulseAt}>{'实测 diff：唯一实质变更即「执行」那一行'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-E 多工具调用：排队 vs 并行 */
const QueueVsParallel: React.FC<{splitAt: number}> = ({splitAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const split = frame >= splitAt;
  const names = ['read a.py', 'read b.py', 'glob *.py', 'bash rm x'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CornerRing />
      {!split ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          {names.map((n, i) => {
            const e = spring({frame: frame - i * 5, fps, config: {damping: 200}});
            return (
              <Panel key={n} style={{width: 460, padding: '14px 20px', opacity: e}}>
                <span style={{fontFamily: theme.mono, fontSize: 27, color: theme.text}}>{n}</span>
              </Panel>
            );
          })}
        </div>
      ) : (
        <div style={{display: 'flex', gap: 90}}>
          {[
            {t: '最简示例：排队', par: false},
            {t: '实际实现：能并行的并行', par: true},
          ].map((col) => (
            <div key={col.t}>
              <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginBottom: 14}}>
                {col.t}
              </div>
              {names.map((n, i) => {
                const at = col.par ? (i < 3 ? 0 : 22) : i * 12;
                const on = frame - splitAt >= at;
                return (
                  <Panel
                    key={n}
                    accent={on ? theme.mech : theme.panelBorder}
                    style={{
                      width: 420,
                      padding: '12px 18px',
                      marginBottom: 10,
                      opacity: on ? 1 : 0.3,
                    }}
                  >
                    <span style={{fontFamily: theme.mono, fontSize: 25, color: theme.text}}>{n}</span>
                  </Panel>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 2-F 真值表对撞：只读列全勾，能并行列在 ls / rm 上分岔 */
const ConcurrencyTable: React.FC<{
  splitAt: number;
  flashAt: number;
  taskAt: number;
  quoteAt: number;
}> = ({splitAt, flashAt, taskAt, quoteAt}) => {
  const frame = useCurrentFrame();
  if (frame >= quoteAt) {
    return (
      <QuoteCard
        zh="并发安全 ⊥ 只读性 —— 两个正交的维度，四种组合都存在"
        accent={theme.mech}
      />
    );
  }
  const rows = [
    {tool: '读文件', ro: true, cc: true, key: 'r'},
    {tool: '找文件', ro: true, cc: true, key: 'g'},
    {tool: '跑命令 · 列目录', ro: true, cc: true, key: 'ls'},
    {tool: '跑命令 · 删文件', ro: false, cc: false, key: 'rm'},
    {tool: '建任务', ro: false, cc: true, key: 'tc'},
  ];
  const showCC = frame >= splitAt;
  const flash = frame >= flashAt && frame < flashAt + 10;
  const mark = (v: boolean) => (v ? '✓' : '✗');
  const col = (v: boolean) => (v ? theme.mech : theme.deny);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CornerRing />
      <Panel style={{padding: '22px 28px', width: 1020}}>
        <div style={{display: 'flex', fontFamily: theme.sans, fontSize: 24, color: theme.dim, paddingBottom: 12}}>
          <div style={{flex: 2}}>{'工具（按这一次的具体输入）'}</div>
          <div style={{flex: 1, textAlign: 'center'}}>{'是不是只读'}</div>
          <div style={{flex: 1, textAlign: 'center'}}>{'能不能一起跑'}</div>
        </div>
        {rows.map((r, i) => {
          const isSplitRow = r.key === 'ls' || r.key === 'rm';
          const isTask = r.key === 'tc';
          const hi = (isSplitRow && flash) || (isTask && frame >= taskAt);
          return (
            <div
              key={r.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 62,
                borderTop: `1px solid ${theme.panelBorder}`,
                background: hi ? theme.mechDeep : 'transparent',
                borderRadius: 6,
              }}
            >
              <div style={{flex: 2, fontFamily: theme.mono, fontSize: 26, color: theme.text}}>
                {r.tool}
              </div>
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 32,
                  fontWeight: 700,
                  color: col(r.ro),
                }}
              >
                {mark(r.ro)}
              </div>
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 32,
                  fontWeight: 700,
                  color: showCC || !isTask ? col(r.cc) : theme.panelBorder,
                  opacity: showCC ? 1 : 0,
                }}
              >
                {mark(r.cc)}
              </div>
            </div>
          );
        })}
      </Panel>
      {flash ? (
        <div
          style={{
            position: 'absolute',
            fontFamily: theme.serif,
            fontSize: 40,
            color: theme.deny,
            top: 250,
            right: 190,
          }}
        >
          {'同名，结论相反'}
        </div>
      ) : null}
      <Footnote delay={splitAt}>
        {'isConcurrencySafe ≠ isReadOnly —— 第三方的源码分析'}
      </Footnote>
    </AbsoluteFill>
  );
};

/** 2-G 连续块分批：括号扫描落位，组内同时脉冲。
 *  分组时点由调用方按句边界传入——硬编码帧数会在配音时长变化后与口播错位。 */
const Batching: React.FC<{groupAt: number[]; noteAt: number}> = ({groupAt, noteAt}) => {
  const frame = useCurrentFrame();
  const calls = ['read A', 'read B', 'glob *.py', 'bash rm x', 'read C'];
  const groups = [
    {idx: [0, 1, 2], label: 'batch 1 · 并发', at: groupAt[0]},
    {idx: [3], label: 'batch 2 · 串行', at: groupAt[1]},
    {idx: [4], label: 'batch 3 · 并发', at: groupAt[2]},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CornerRing />
      <div style={{display: 'flex', gap: 16, marginBottom: 40}}>
        {calls.map((c, i) => {
          const g = groups.find((gr) => gr.idx.includes(i));
          const on = g ? frame >= g.at : false;
          const pulse = g && frame >= g.at && frame < g.at + 14;
          return (
            <Panel
              key={c}
              accent={on ? theme.mech : theme.panelBorder}
              style={{
                width: 200,
                padding: '18px 14px',
                textAlign: 'center',
                background: pulse ? theme.mechDeep : theme.panel,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text}}>{c}</span>
            </Panel>
          );
        })}
      </div>
      <div style={{display: 'flex', gap: 16}}>
        {groups.map((g) => {
          const on = frame >= g.at;
          const width = g.idx.length * 200 + (g.idx.length - 1) * 16;
          return (
            <div key={g.label} style={{width, opacity: on ? 1 : 0}}>
              <div style={{height: 3, background: theme.mech, opacity: 0.7}} />
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 22,
                  color: theme.mech,
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                {g.label}
              </div>
            </div>
          );
        })}
      </div>
      <Footnote delay={noteAt}>{'组内并行，组间严格按顺序'}</Footnote>
    </AbsoluteFill>
  );
};

/** 2-H 落盘自循环：读→落盘→读→落盘，四圈后定格 */
const SpillLoop: React.FC<{markAt: number; loopAt: number}> = ({markAt, loopAt}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - loopAt);
  // 每圈加速一档：圈时长 40 → 30 → 22 → 16 帧
  const durs = [40, 30, 22, 16];
  let acc = 0;
  let lap = 0;
  let within = 0;
  for (let i = 0; i < durs.length; i++) {
    if (t < acc + durs[i]) {
      lap = i;
      within = (t - acc) / durs[i];
      break;
    }
    acc += durs[i];
    lap = i + 1;
    within = 1;
  }
  const done = lap >= durs.length;
  const angle = done ? 300 : -90 + within * 360;
  const cx = 300;
  const cy = 210;
  const r = 132;
  const rad = (angle * Math.PI) / 180;
  const denyMix = Math.min(1, lap / 3);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <CornerRing />
      <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
        <div style={{position: 'relative', width: 600, height: 420}}>
          <svg width={600} height={420}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={denyMix > 0.4 ? theme.deny : theme.mech}
              strokeWidth={5}
              strokeDasharray="10 8"
              opacity={0.55 + denyMix * 0.45}
            />
            {!done ? (
              <circle cx={cx + r * Math.cos(rad)} cy={cy + r * Math.sin(rad)} r={12} fill={theme.deny} />
            ) : null}
            <text x={cx} y={cy - r - 20} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
              {'读文件'}
            </text>
            <text x={cx + r + 30} y={cy + 8} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
              {'落盘'}
            </text>
            <text x={cx} y={cy + r + 38} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
              {'再读'}
            </text>
            <text x={cx - r - 30} y={cy + 8} textAnchor="middle" fontFamily={theme.sans} fontSize={24} fill={theme.dim}>
              {'再落盘'}
            </text>
          </svg>
          {done ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: cy - 18,
                textAlign: 'center',
                fontFamily: theme.serif,
                fontSize: 40,
                color: theme.deny,
                fontWeight: 700,
              }}
            >
              {'转不出来'}
            </div>
          ) : null}
        </div>
        <Panel
          accent={frame >= markAt ? theme.core : theme.panelBorder}
          style={{width: 420, padding: '22px 26px'}}
        >
          <div style={{fontFamily: theme.mono, fontSize: 27, color: theme.text}}>{'read_file'}</div>
          <div style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim, marginTop: 10}}>
            {'结果大小上限'}
          </div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 54,
              color: frame >= markAt ? theme.core : theme.dim,
              marginTop: 4,
            }}
          >
            {'∞'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, marginTop: 8}}>
            {'永远不许落盘'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

export const P2Dispatch: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  /** 句尾锚（beat 内相对帧）：分镜「pX-YY 尾（+N 帧）」的机械化落点。
   *  句尾是本 beat 末句时，+N 会探出 Sequence 窗口（窗口只含句间 gap ≈10 帧）——
   *  封顶到「窗口末尾 − need 帧可见」：动效仍然发生，不被窗口剪掉。 */
  const endAt = (id: string) => w(id).from + w(id).durationInFrames;
  const tailAt = (b: {from: number; durationInFrames: number}, id: string, plus: number, need: number) =>
    Math.min(endAt(id) + plus - b.from, b.durationInFrames - need);
  const bA = w('p2-01', 'p2-03');
  const bC = w('p2-07', 'p2-10');
  const bD = w('p2-11', 'p2-13');
  const bE = w('p2-14', 'p2-16');
  const bF = w('p2-17', 'p2-24');
  const bG = w('p2-25', 'p2-26');
  const bH = w('p2-27', 'p2-31');
  const rel = (b: {from: number}, id: string) => w(id).from - b.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P2" title="加一个工具，只改一行" meta="Tool Dispatch · registry" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="2-A 命令行拼接的笨拙">
        {/* p2-03 尾 +22 帧：命令里一个字符高亮成 deny 并抖动（原 p2-04 已删，语义由角标承载）。
            p2-03 是本 beat 末句——+22 会探出窗口，封顶到末尾仍留 26 帧可见抖动+角标。 */}
        <ClumsyCommands typoAt={tailAt(bA, 'p2-03', 22, 26)} />
      </Sequence>
      <Sequence {...w('p2-05', 'p2-06')} name="2-B 五件工具">
        <FiveTools />
      </Sequence>
      <Sequence {...bC} name="2-C 字典分发表">
        <Dispatch hitAt={rel(bC, 'p2-09')} slotAt={rel(bC, 'p2-10')} />
      </Sequence>
      <Sequence {...bD} name="2-D 唯一一行的 diff">
        <OneLineDiff pulseAt={rel(bD, 'p2-13')} />
      </Sequence>
      <Sequence {...bE} name="2-E 排队与并行">
        <QueueVsParallel splitAt={rel(bE, 'p2-15')} />
      </Sequence>
      <Sequence {...bF} name="2-F 并发安全不等于只读">
        <ConcurrencyTable
          splitAt={rel(bF, 'p2-19')}
          flashAt={rel(bF, 'p2-20')}
          taskAt={rel(bF, 'p2-22')}
          quoteAt={rel(bF, 'p2-24')}
        />
      </Sequence>
      <Sequence {...bG} name="2-G 连续块分批">
        {/* 三组的落位跟着口播推进：p2-25 讲「连着能并行的划成一组」、
            p2-26 讲「中间夹着不能并行的就单独一组」 */}
        <Batching
          groupAt={[8, rel(bG, 'p2-26'), rel(bG, 'p2-26') + 26]}
          noteAt={rel(bG, 'p2-26') + 40}
        />
      </Sequence>
      <Sequence {...bH} name="2-H 落盘自循环">
        <SpillLoop markAt={rel(bH, 'p2-29')} loopAt={rel(bH, 'p2-30')} />
      </Sequence>
    </AbsoluteFill>
  );
};
