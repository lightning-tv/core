import {
  type IAnimationController,
  type AnimationSettings,
  type Dimensions,
  type FadeOutEffectProps,
  type GlitchEffectProps,
  type GrayscaleEffectProps,
  type INode,
  type INodeWritableProps,
  type ITextNodeWritableProps,
  type LinearGradientEffectProps,
  type NodeFailedPayload,
  type NodeLoadedPayload,
  type RadialGradientEffectProps,
  type RadialProgressEffectProps,
} from '@lightningjs/renderer';
import { type ElementNode } from './elementNode.js';
import { type NodeStates } from './states.js';

type AddUndefined<T> = {
  [K in keyof T]: T[K] | undefined;
};

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
  type: keyof StyleEffects;
  props: StyleEffects[keyof StyleEffects];
};

export interface IntrinsicNodeCommonProps {
  animationSettings?: Partial<AnimationSettings>;
  autofocus?: boolean;
  forwardStates?: boolean;
  id?: string;
  onCreate?: (target: ElementNode) => void;
  onLoad?: (target: INode, nodeLoadedPayload: NodeLoadedPayload) => void;
  onFail?: (target: INode, nodeFailedPayload: NodeFailedPayload) => void;
  onBeforeLayout?: (
    this: ElementNode,
    target: ElementNode,
    child?: ElementNode,
    dimensions?: Dimensions,
  ) => boolean | void;
  onLayout?: (
    this: ElementNode,
    target: ElementNode,
    child?: ElementNode,
    dimensions?: Dimensions,
  ) => void;
  onAnimationStarted: (
    controller: IAnimationController,
    propKey: string,
    endValue: number,
  ) => void;
  onAnimationFinished?: (
    controller: IAnimationController,
    propKey: string,
    endValue: number,
  ) => void;
  forwardFocus?:
    | number
    | ((this: ElementNode, elm: ElementNode) => boolean | void);
  ref?: ElementNode | ((node: ElementNode) => void) | undefined;
  selected?: number;
  states?: NodeStates;
  text?: string;
}

export interface IntrinsicNodeStyleCommonProps {
  alignItems?: 'flexStart' | 'flexEnd' | 'center';
  border?: BorderStyle;
  borderBottom?: BorderStyle;
  borderLeft?: BorderStyle;
  borderRadius?: BorderRadius;
  borderRight?: BorderStyle;
  borderTop?: BorderStyle;
  display?: 'flex' | 'block';
  effects?: Effects;
  flexBoundary?: 'contain' | 'fixed';
  flexDirection?: 'row' | 'column';
  flexItem?: boolean;
  gap?: number;
  justifyContent?:
    | 'flexStart'
    | 'flexEnd'
    | 'center'
    | 'spaceBetween'
    | 'spaceEvenly';
  linearGradient?: LinearGradientEffectProps;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  transition?:
    | Record<string, Partial<AnimationSettings> | true | false>
    | true
    | false;
}

export interface IntrinsicTextStyleCommonProps {
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
}

export interface IntrinsicCommonProps
  extends IntrinsicNodeCommonProps,
    IntrinsicNodeStyleCommonProps,
    IntrinsicTextStyleCommonProps {}
export interface IntrinsicNodeStyleProps
  extends AddColorString<
      Partial<Omit<INodeWritableProps, 'parent' | 'shader'>>
    >,
    IntrinsicNodeStyleCommonProps {
  [key: string]: unknown;
}

export interface IntrinsicTextNodeStyleProps
  extends AddColorString<
      Partial<Omit<ITextNodeWritableProps, 'parent' | 'shader'>>
    >,
    IntrinsicTextStyleCommonProps {
  [key: string]: unknown;
}

export interface IntrinsicNodeProps
  extends AddUndefined<IntrinsicNodeCommonProps & IntrinsicNodeStyleProps> {
  style?:
    | IntrinsicNodeStyleProps
    | (IntrinsicNodeStyleProps | undefined)[]
    | undefined;
}

export interface IntrinsicTextProps
  extends AddUndefined<IntrinsicNodeCommonProps & IntrinsicTextNodeStyleProps> {
  style?:
    | IntrinsicTextNodeStyleProps
    | (IntrinsicTextNodeStyleProps | undefined)[]
    | undefined;
  children?: string | number | (string | number | undefined)[];
}

export type NodeStyles = IntrinsicNodeStyleProps;
export type TextStyles = IntrinsicTextNodeStyleProps;
export type NodeProps = IntrinsicNodeProps;
export type TextProps = IntrinsicTextProps;
