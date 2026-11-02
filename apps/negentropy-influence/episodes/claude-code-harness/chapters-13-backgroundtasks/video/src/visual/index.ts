import {evolvePath, getLength, getPointAtLength, getSubpaths, getTangentAtLength, interpolatePath, normalizePath} from '@remotion/paths';

export type VisualTiming = {
  from: number;
  duration: number;
  easing?: (progress: number) => number;
};

export type PathDrawState = {
  progress: number;
  strokeDasharray: string;
  strokeDashoffset: number;
};

export type PathMorphState = {
  progress: number;
  d: string;
};

export type PathFollowState = {
  progress: number;
  x: number;
  y: number;
  rotation: number;
  distance: number;
  length: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const drawablePathLength = (path: string, label: string): number => {
  const length = getLength(path);
  if (!Number.isFinite(length) || length <= 0) {
    throw new TypeError(`${label} must contain a drawable SVG segment`);
  }
  return length;
};

export const frameProgress = (frame: number, timing: VisualTiming): number => {
  if (!Number.isFinite(frame) || !Number.isFinite(timing.from) || !Number.isFinite(timing.duration)) {
    throw new TypeError('frame timing must be finite numbers');
  }
  if (timing.duration <= 0) {
    throw new RangeError(`duration must be greater than 0, received ${timing.duration}`);
  }
  const linearProgress = clamp01((frame - timing.from) / timing.duration);
  if (linearProgress === 0 || linearProgress === 1) {
    return linearProgress;
  }
  const easedProgress = timing.easing ? timing.easing(linearProgress) : linearProgress;
  if (!Number.isFinite(easedProgress)) {
    throw new TypeError('timing easing must return a finite number');
  }
  return clamp01(easedProgress);
};

export const pathDrawAtFrame = (path: string, frame: number, timing: VisualTiming): PathDrawState => {
  const progress = frameProgress(frame, timing);
  drawablePathLength(path, 'path');
  return {progress, ...evolvePath(progress, path)};
};

export const pathMorphAtFrame = (
  fromPath: string,
  toPath: string,
  frame: number,
  timing: VisualTiming,
): PathMorphState => {
  const progress = frameProgress(frame, timing);
  drawablePathLength(fromPath, 'fromPath');
  drawablePathLength(toPath, 'toPath');
  if (getSubpaths(fromPath).length !== getSubpaths(toPath).length) {
    throw new TypeError('Morph paths must have matching subpath counts; animate separate layers for identity changes');
  }
  return {progress, d: interpolatePath(progress, fromPath, toPath)};
};

export const pathFollowAtFrame = (path: string, frame: number, timing: VisualTiming): PathFollowState => {
  const progress = frameProgress(frame, timing);
  const normalizedPath = normalizePath(path);
  if (getSubpaths(normalizedPath).length !== 1) {
    throw new TypeError('FollowPath requires a single continuous subpath');
  }
  const length = drawablePathLength(normalizedPath, 'path');
  const distance = length * progress;
  const point = getPointAtLength(normalizedPath, distance);
  const tangent = getTangentAtLength(normalizedPath, distance);
  if (!point || !tangent || ![point.x, point.y, tangent.x, tangent.y].every(Number.isFinite)) {
    throw new TypeError('path must produce finite coordinates and tangent');
  }
  return {
    progress,
    x: point.x,
    y: point.y,
    rotation: Math.atan2(tangent.y, tangent.x) * (180 / Math.PI),
    distance,
    length,
  };
};
