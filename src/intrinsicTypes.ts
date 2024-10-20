import {
  type FadeOutEffectProps,
  type GlitchEffectProps,
  type GrayscaleEffectProps,
  type AnimationSettings as RendererAnimationSettings,
  type LinearGradientEffectProps,
  type RadialGradientEffectProps,
  type RadialProgressEffectProps,
  type ITextNodeProps,
} from '@lightningjs/renderer';
import { ElementNode, type RendererNode } from './elementNode.js';
import { NodeStates } from './states.js';

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

export type NewOmit<T, K extends PropertyKey> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};

export type RemoveUnderscoreProps<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};

type RendererText = AddColorString<
  Partial<Omit<ITextNodeProps, 'debug' | 'shader' | 'parent'>>
>;

type CleanElementNode = NewOmit<
  RemoveUnderscoreProps<ElementNode>,
  | 'parent'
  | 'insertChild'
  | 'removeChild'
  | 'selectedNode'
  | 'shader'
  | 'animate'
  | 'chain'
  | 'start'
  | 'setFocus'
  | 'isTextNode'
  | 'getText'
  | 'destroy'
  | 'hasChildren'
  | 'getChildById'
  | 'searchChildrenById'
  | 'states'
  | 'requiresLayout'
  | 'updateLayout'
  | 'render'
  | 'style'
>;
/** Node text, children of a ElementNode of type TextNode */
export interface ElementText
  extends NewOmit<ElementNode, '_type' | 'parent' | 'children'>,
    RendererText {
  _type: 'textNode';
  parent?: ElementNode;
  children: TextNode[];
  text: string;
  style: TextStyles;
}

export interface TextNode {
  _type: 'text';
  parent?: ElementText;
  text: string;
  [key: string]: any;
}

export interface NodeProps
  extends RendererNode,
    Partial<
      NewOmit<
        CleanElementNode,
        | 'children'
        | 'text'
        | 'lng'
        | 'rendered'
        | 'renderer'
        | 'preFlexwidth'
        | 'preFlexHeight'
      >
    > {
  states?: NodeStates;
  style?: NestedNodeStyles;
}
export interface NodeStyles extends NodeProps {
  [key: `$${string}`]: NodeProps;
}
type NestedNodeStyles = NodeStyles | Array<NestedNodeStyles | undefined>;

export interface TextProps
  extends RendererText,
    Partial<
      NewOmit<
        CleanElementNode,
        | 'lng'
        | 'rendered'
        | 'renderer'
        | 'alignItems'
        | 'autosize'
        | 'children'
        | 'data'
        | 'display'
        | 'flexBoundary'
        | 'flexDirection'
        | 'gap'
        | 'justifyContent'
        | 'forwardFocus'
        | 'forwardStates'
        | 'linearGradient'
        | 'src'
        | 'texture'
        | 'textureOptions'
      >
    > {
  states?: NodeStates;
  style?: NestedTextStyles;
}

export interface TextStyles extends TextProps {
  [key: `$${string}`]: TextProps;
}
type NestedTextStyles = TextStyles | Array<NestedTextStyles | undefined>;

export type Styles = NodeStyles | TextStyles;

// TODO: deprecated
export interface IntrinsicNodeProps extends NodeProps {}
export interface IntrinsicNodeStyleProps extends NodeStyles {}
export interface IntrinsicTextNodeStyleProps extends TextStyles {}
