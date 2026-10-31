import {strict as assert} from 'node:assert';
import test from 'node:test';

import {frameProgress, pathDrawAtFrame, pathFollowAtFrame, pathMorphAtFrame} from '../../src/visual/index.ts';

const timing = {from: 10, duration: 20};
const line = 'M0 0 L100 0';

test('frameProgress clamps the timeline window and rejects invalid durations', () => {
  assert.equal(frameProgress(0, timing), 0);
  assert.equal(frameProgress(20, timing), 0.5);
  assert.equal(frameProgress(40, timing), 1);
  assert.throws(() => frameProgress(20, {from: 0, duration: 0}), /duration must be greater than 0/);
  assert.throws(() => frameProgress(5, {from: 0, duration: 10, easing: () => Number.NaN}), /finite number/);
});

test('pathDrawAtFrame exposes deterministic dash state at the boundaries', () => {
  const start = pathDrawAtFrame(line, 10, timing);
  const middle = pathDrawAtFrame(line, 20, timing);
  const end = pathDrawAtFrame(line, 30, timing);
  assert.equal(start.progress, 0);
  assert.equal(middle.progress, 0.5);
  assert.equal(end.progress, 1);
  assert.equal(start.strokeDashoffset, 150);
  assert.equal(end.strokeDashoffset, 0);
  assert.equal(pathDrawAtFrame(line, 20, timing).strokeDashoffset, middle.strokeDashoffset);
});

test('pathDrawAtFrame remains monotonic across the complete transition window', () => {
  const offsets = [10, 15, 20, 25, 30].map((frame) => pathDrawAtFrame(line, frame, timing).strokeDashoffset);
  assert.deepEqual(offsets, [150, 75, 50, 25, 0]);
});

test('pathMorphAtFrame preserves exact endpoints and produces an intermediate path', () => {
  const fromPath = 'M0 0 L100 0';
  const toPath = 'M0 0 L100 100';
  assert.equal(pathMorphAtFrame(fromPath, toPath, 10, timing).d, fromPath);
  assert.equal(pathMorphAtFrame(fromPath, toPath, 30, timing).d, toPath);
  assert.notEqual(pathMorphAtFrame(fromPath, toPath, 20, timing).d, fromPath);
  assert.notEqual(pathMorphAtFrame(fromPath, toPath, 20, timing).d, toPath);
});

test('pathMorphAtFrame exposes stable intermediate states for transition QA', () => {
  const fromPath = 'M0 0 L100 0';
  const toPath = 'M0 0 L100 100';
  const states = [10, 15, 20, 25, 30].map((frame) => pathMorphAtFrame(fromPath, toPath, frame, timing).d);
  assert.equal(states[0], fromPath);
  assert.equal(states[4], toPath);
  assert.equal(new Set(states.slice(1, 4)).size, 3);
});

test('pathMorphAtFrame accepts different command counts through Remotion normalization', () => {
  const state = pathMorphAtFrame(
    'M40 80 L90 80 L90 120 Z',
    'M40 60 C100 10 180 10 240 60 C180 150 100 150 40 60 Z',
    20,
    timing,
  );
  assert.match(state.d, /^M/);
  assert.ok(state.d.length > 20);
});

test('pathFollowAtFrame returns endpoint position and tangent rotation', () => {
  const start = pathFollowAtFrame(line, 10, timing);
  const end = pathFollowAtFrame(line, 30, timing);
  assert.deepEqual({x: start.x, y: start.y, rotation: start.rotation}, {x: 0, y: 0, rotation: 0});
  assert.deepEqual({x: end.x, y: end.y, rotation: end.rotation}, {x: 100, y: 0, rotation: 0});
});

test('pathFollowAtFrame advances continuously along a straight path', () => {
  const positions = [10, 15, 20, 25, 30].map((frame) => pathFollowAtFrame(line, frame, timing).x);
  assert.deepEqual(positions, [0, 25, 50, 75, 100]);
});

test('visual path primitives reject empty or non-drawable paths', () => {
  assert.throws(() => pathDrawAtFrame('M0 0', 10, timing), /drawable SVG segment/);
  assert.throws(() => pathMorphAtFrame('M0 0', line, 10, timing), /fromPath/);
  assert.throws(() => pathFollowAtFrame('M0 0', 10, timing), /drawable SVG segment/);
});

test('non-finite timing and negative durations fail before geometry evaluation', () => {
  assert.throws(() => frameProgress(Number.NaN, timing), /finite/);
  assert.throws(() => frameProgress(15, {from: Infinity, duration: 20}), /finite/);
  assert.throws(() => frameProgress(15, {from: 10, duration: -1}), /greater than 0/);
});

test('easing cannot change window endpoints or overshoot path progress', () => {
  const customTiming = {...timing, easing: () => 2};
  assert.equal(frameProgress(0, customTiming), 0);
  assert.equal(frameProgress(20, customTiming), 1);
  assert.equal(frameProgress(40, customTiming), 1);
  assert.equal(frameProgress(20, {...timing, easing: (value) => value * value}), 0.25);
});

test('draw supports compound paths while follow refuses a discontinuous trajectory', () => {
  const compoundPath = 'M0 0 L100 0 M200 0 L300 0';
  assert.equal(pathDrawAtFrame(compoundPath, 30, timing).strokeDashoffset, 0);
  assert.throws(() => pathFollowAtFrame(compoundPath, 20, timing), /single continuous subpath/);
  assert.throws(() => pathMorphAtFrame(line, compoundPath, 20, timing), /matching subpath counts/);
});

test('follow normalizes relative paths and evaluates curve tangents', () => {
  assert.equal(pathFollowAtFrame('m10 20 l0 100', 20, timing).y, 70);
  assert.equal(pathFollowAtFrame('m10 20 l0 100', 20, timing).rotation, 90);
  const curve = 'M0 0 C0 100 100 100 100 0';
  const middle = pathFollowAtFrame(curve, 20, timing);
  assert.ok(Math.abs(middle.x - 50) < 0.1);
  assert.ok(Math.abs(middle.y - 75) < 0.1);
  assert.deepEqual(pathFollowAtFrame(curve, 20, timing), middle);
});

test('malformed and empty paths fail even at Morph endpoints', () => {
  assert.throws(() => pathDrawAtFrame('', 10, timing));
  assert.throws(() => pathMorphAtFrame(line, 'M0', 10, timing));
  assert.throws(() => pathFollowAtFrame('M0 0 C1', 10, timing));
});
