import {
  type FadeOutEffectProps,
  type GlitchEffectProps,
  type GrayscaleEffectProps,
  type AnimationSettings as RendererAnimationSettings,
  type LinearGradientEffectProps,
  type RadialGradientEffectProps,
  type RadialProgressEffectProps,
} from '@lightningjs/renderer';
import { ElementNode } from './elementNode.js';

export type AnimationSettings = Partial<RendererAnimationSettings> | undefined;

export type AddColorString<T> = {
  [K in keyof T]: K extends `color${string}` ? string | number : T[K];
};

export interface BorderStyleObject {
  width: number;
  color: number | string;
}

export type BorderStyle = number | BorderStyleObject;
export type BorderRadius = number | number[];

export interface Effects {
  fadeOut?: FadeOutEffectProps;
  linearGradient?: LinearGradientEffectProps;
  radialGradient?: RadialGradientEffectProps;
  radialProgressGradient?: RadialProgressEffectProps;
  grayscale?: GrayscaleEffectProps;
  glitch?: GlitchEffectProps;
  radialProgress?: RadialProgressEffectProps;
  holePunch?: any; // shoud be HolePunchEffectProps;
}

export interface BorderEffects {
  radius?: { radius: BorderRadius };
  border?: BorderStyle;
  borderTop?: BorderStyle;
  borderRight?: BorderStyle;
  borderBottom?: BorderStyle;
  borderLeft?: BorderStyle;
}

export type StyleEffects = Effects & BorderEffects;

// Renderer should export EffectDesc
export type ShaderEffectDesc = {
  name?: string;
  type: keyof StyleEffects;
  props: StyleEffects[keyof StyleEffects];
};

type PElementNode = Partial<ElementNode>;
export type NewOmit<T, K extends PropertyKey> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};
export type NodeProps = NewOmit<
  ElementNode,
  | 'lineHeight'
  | 'letterSpacing'
  | 'wordWrap'
  | 'verticalAlign'
  | 'text'
  | 'fontFamily'
  | 'fontStretch'
  | 'fontSize'
  | 'maxLines'
  | 'fontWeight'
  | 'fontStyle'
  | 'textBaseline'
  | 'textAlign'
  | 'textOverflow'
  | 'contain'
  | 'overflowSuffix'
>;
export type TextProps = NewOmit<
  ElementNode,
  | 'clipping'
  | 'src'
  | 'texture'
  | 'textureOptions'
  | 'autosize'
  | 'children'
  | 'linearGradient'
  | 'transition'
>;
