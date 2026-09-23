/**
 * 运动层纯函数单测——`node --test scripts/motion.test.ts`（Node ≥ 23.6 原生跑 TS）。
 *
 * 刻意放在 video/ 而非 src/：tsconfig include 只有 src（frozen，不为测试改动），
 * 而本文件 import 需带 .ts 后缀（Node ESM 解析规则）——tsc 若收编会因
 * allowImportingTsExtensions 未开而报错。src/ 的类型覆盖由 tsc --noEmit 全量保证，
 * 本文件只测纯函数行为，不做类型承重。
 *
 * 只 import 纯模块（tokens/window/schedule——零 remotion/react 依赖）：
 * hooks 是它们的薄包装，行为由 MotionGallery 目视 + 场景抽帧覆盖。
 */
import {strict as assert} from 'node:assert';
import test from 'node:test';

import {DUR, EASING_CP, EXIT_FACTOR, SAFE_TOP_Y, SPRING, clampRiseDist, dampingRatio, overshootPeak} from '../src/motion/tokens.ts';
import {beatProgress, clamp01, progress, revealCharCount, win} from '../src/motion/window.ts';
import {schedule} from '../src/motion/schedule.ts';

// ── tokens ────────────────────────────────────────────────────────────

test('时长标尺在 30fps 下相邻档可辨（≥1 帧差）', () => {
  const v = Object.values(DUR) as number[];
  for (let i = 1; i < v.length; i++) {
    assert.ok(v[i] - v[i - 1] >= 1, `第 ${i} 档与前一档同帧数（伪选择）`);
  }
  assert.ok(v.length === 6);
});

test('ζ→过冲换算钉死：snap 轻过冲、settle 零过冲（直抄 dampingRatio 的反例护栏）', () => {
  const zSnap = dampingRatio(SPRING.snap);
  const zSettle = dampingRatio(SPRING.settle);
  assert.ok(zSnap > 0.4 && zSnap < 0.9, `snap ζ=${zSnap}`);
  // Mp = exp(-πζ/√(1-ζ²)) 是超出幅度；峰值 = 1 + Mp（ζ=0.6 → 峰值 ≈1.095）
  assert.ok(overshootPeak(zSnap) > 1.02 && overshootPeak(zSnap) < 1.2, `snap 峰值 ${overshootPeak(zSnap)}`);
  assert.ok(zSettle > 1, 'settle 须过阻尼');
  assert.equal(overshootPeak(zSettle), 1);
  // 反例：把设计系统的 ζ 当 damping 直填（0.8）→ ζ≈0.04、峰值≈1.88 暴力弹跳
  const wrong = dampingRatio({damping: 0.8, stiffness: 100, mass: 1});
  assert.ok(overshootPeak(wrong) > 1.8, `直抄 ζ 的峰值=${overshootPeak(wrong)}，必须被此断言抓住`);
});

test('缓动控制点合法（CSS 规则 x∈[0,1]，且 x(t) 数值单调——可作函数求值）', () => {
  for (const cp of Object.values(EASING_CP)) {
    const [x1, , x2] = cp;
    assert.ok(x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1, `x 越界：${cp}`);
    // x1<x2 是充分不必要（M3 standard (0.2,0,0,1) 的 x2<x1 仍单调）——判据用导数采样
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const dx =
        3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
      assert.ok(dx > -1e-9, `x(t) 非单调 @t=${t}：${cp}`);
    }
  }
});

test('出场快于入场系数与安全带口径为常量', () => {
  assert.equal(EXIT_FACTOR, 0.4);
  assert.equal(SAFE_TOP_Y, 920);
});

test('clampRiseDist：自下方入场行程不探进字幕安全带', () => {
  assert.equal(clampRiseDist(120, 836), 84, 'ISSUE-170 实测几何：rest 836 → 行程封顶 84');
  assert.equal(clampRiseDist(40, 836), 40, '未超限不动');
  assert.equal(clampRiseDist(120, 960), 0, '落位已在安全带内 → 零行程（退化但安全）');
});

// ── window ────────────────────────────────────────────────────────────

test('clamp01 / progress / win 的钳制语义', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(progress(10, 10, 10), 0, '起点为 0');
  assert.equal(progress(20, 10, 10), 1, '终点为 1');
  assert.equal(progress(5, 10, 10), 0, '窗外前钳 0');
  assert.equal(progress(99, 10, 10), 1, '窗外后钳 1');
  assert.equal(win(0.5, [0.25, 0.75]), 0.5);
  assert.equal(win(0.1, [0.25, 0.75]), 0);
  assert.equal(win(0.9, [0.25, 0.75]), 1);
  assert.equal(beatProgress(0, -30, 90), 1 / 3);
});

test('逐字揭示：cps 按实际 fps 换算并向下取整，framesPerChar 保持固定帧间隔', () => {
  assert.equal(revealCharCount(29, 60, 12), 5);
  assert.equal(revealCharCount(30, 60, 12), 6);
  assert.equal(revealCharCount(30, 24, 12, 3), 10);
  assert.equal(revealCharCount(30, 120, 12, 3), 10);
});

// ── schedule ──────────────────────────────────────────────────────────

test('fit 模式：末项恰在窗口末完成、不外溢', () => {
  const p = schedule(5, {dur: 10, fit: {total: 90}});
  const last = p.starts[4] + p.dur;
  assert.ok(last <= 90 + 1, `末项 ${last} 外溢`);
  assert.ok(last >= 89, `末项 ${last} 未到窗口末`);
});

test('fit 装不下时缩子项时长，不外溢窗口（优先级：不外溢 > 最小步长 > 子项时长）', () => {
  // total 30 时 (30-12)/7≈2.57 ≥ minStride=2 仍装得下；压到 24 才触发缩时长
  const p = schedule(8, {dur: 12, fit: {total: 24}});
  const last = p.starts[7] + p.dur;
  assert.ok(last <= 24, `末项 ${last} 外溢`);
  assert.ok(p.dur >= 3, '子项时长跌破下限');
  assert.ok(p.dur < 12, '装不下却未缩子项时长');
});

test('fit 窗口连 1 帧子项也容不下时显式拒绝，不返回外溢计划', () => {
  assert.throws(() => schedule(8, {dur: 12, fit: {total: 5}}), /fit\.total=5.*8/);
});

test('fit 可行极限先牺牲子项时长，仍完整落在窗口内', () => {
  const p = schedule(8, {dur: 12, fit: {total: 8}});
  assert.equal(p.dur, 1);
  assert.equal(p.starts[7] + p.dur, 8);
});

test('lag 模式：Manim 语义 start[i] = i·dur·lag', () => {
  const p = schedule(3, {dur: 10, lag: 0.5});
  assert.deepEqual(p.starts, [0, 5, 10]);
  assert.deepEqual(schedule(3, {dur: 10, lag: 0}).starts, [0, 0, 0], 'lag=0 须同刻齐动');
});

test('stride 模式与三选一守卫', () => {
  assert.deepEqual(schedule(3, {dur: 5, stride: 4}).starts, [0, 4, 8]);
  assert.throws(() => schedule(3, {dur: 5, stride: 4, lag: 1}));
  assert.throws(() => schedule(3, {dur: 5, lag: 1, fit: {total: 40}}));
});

test('最小步长与空集', () => {
  assert.deepEqual(schedule(0, {dur: 5, stride: 4}), {starts: [], dur: 5});
  const p = schedule(2, {dur: 5, stride: 0}); // 非法步长 → 抬到下限
  assert.ok(p.starts[1] - p.starts[0] >= 1);
});

test('起点取整且单调不减', () => {
  const p = schedule(6, {dur: 7, fit: {total: 53}});
  for (let i = 1; i < p.starts.length; i++) {
    assert.ok(p.starts[i] >= p.starts[i - 1], '起点须单调不减');
    assert.ok(Number.isInteger(p.starts[i]));
  }
});
