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

type CleanElementNode = RemoveUnderscoreProps<ElementNode>;
/** Node text, children of a ElementNode of type TextNode */
export interface ElementText
  extends Partial<NewOmit<ElementNode, '_type'>>,
    RendererText {
  id?: string;
  _type: 'text';
  parent?: ElementNode;
  text: string;
  _queueDelete?: boolean;
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
        | 'states'
        | 'renderer'
        | 'preFlexwidth'
        | 'preFlexHeight'
      >
    > {
  states?: NodeStates;
}

export interface TextProps
  extends Partial<
    NewOmit<
      RemoveUnderscoreProps<ElementText>,
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
      | 'states'
      | 'texture'
      | 'textureOptions'
    >
  > {
  states?: NodeStates;
}

export type Styles = {
  [K in keyof ElementNode]?: ElementNode[K];
};
