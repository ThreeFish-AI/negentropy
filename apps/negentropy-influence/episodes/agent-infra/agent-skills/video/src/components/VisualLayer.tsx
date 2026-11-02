import React from 'react';
import {useCurrentFrame} from 'remotion';

import {pathDrawAtFrame, pathFollowAtFrame, pathMorphAtFrame, type VisualTiming} from '../visual';

type DrawPathProps = Omit<React.SVGProps<SVGPathElement>, 'd' | 'pathLength' | 'strokeDasharray' | 'strokeDashoffset' | 'style'> & {
  path: string;
  timing: VisualTiming;
  style?: Omit<React.CSSProperties, 'd' | 'strokeDasharray' | 'strokeDashoffset'>;
};

export const DrawPath: React.FC<DrawPathProps> = ({path, timing, ...props}) => {
  const untrustedProps = props as React.SVGProps<SVGPathElement>;
  if (
    untrustedProps.pathLength !== undefined ||
    untrustedProps.style?.strokeDasharray !== undefined ||
    untrustedProps.style?.strokeDashoffset !== undefined
  ) {
    throw new TypeError('DrawPath controls pathLength and dash properties');
  }
  const frame = useCurrentFrame();
  const state = pathDrawAtFrame(path, frame, timing);
  const pathProps: React.SVGProps<SVGPathElement> = {
    fill: 'none',
    ...props,
    d: path,
    strokeDasharray: state.strokeDasharray,
    strokeDashoffset: state.strokeDashoffset,
  };
  return <path {...pathProps} />;
};

type MorphPathProps = Omit<React.SVGProps<SVGPathElement>, 'd'> & {
  fromPath: string;
  toPath: string;
  timing: VisualTiming;
};

export const MorphPath: React.FC<MorphPathProps> = ({fromPath, toPath, timing, ...props}) => {
  const frame = useCurrentFrame();
  const state = pathMorphAtFrame(fromPath, toPath, frame, timing);
  return <path {...props} d={state.d} />;
};

type FollowPathProps = {
  path: string;
  timing: VisualTiming;
  rotateOffset?: number;
  children: React.ReactNode;
};

export const FollowPath: React.FC<FollowPathProps> = ({path, timing, rotateOffset = 0, children}) => {
  const frame = useCurrentFrame();
  const state = pathFollowAtFrame(path, frame, timing);
  return (
    <g transform={`translate(${state.x},${state.y}) rotate(${state.rotation + rotateOffset})`}>
      {children}
    </g>
  );
};
