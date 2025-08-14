import type * as lngr2 from 'lngr2';
import type * as lngr3 from 'lngr3';
import { ElementNode } from './elementNode.js';
import { NodeStates } from './states.js';
import {
  ShaderBorderProps,
  ShaderHolePunchProps,
  ShaderLinearGradientProps,
  ShaderRadialGradientProps,
  ShaderRoundedProps,
  ShaderShadowProps,
} from './shaders.js';
import {
  IRendererNodeProps,
  IAnimationController,
  IRendererNode,
  IRendererTextNode,
  IRendererTextNodeProps,
} from './lightningInit.js';

export type AnimationSettings = Partial<
  lngr2.AnimationSettings | lngr3.AnimationSettings
>;

/**
 * Grab all the number properties of type T
 */
export type NumberProps<T> = {
  [Key in keyof T as NonNullable<T[Key]> extends number ? Key : never]: number;
};
/**
 * Properties of a Node used by the animate() function
 */
export type CoreNodeAnimateProps = NumberProps<IRendererNodeProps>;

export type AddColorString<T> = {
  [K in keyof T]: K extends `color${string}` ? string | number : T[K];
};

export interface BorderStyleObject {
  width: number;
  color: number | string;
}

export type DollarString = `$${string}`;
export type BorderStyle = BorderStyleObject;
export type BorderRadius = number | number[];

export interface Effects {
  linearGradient?: Partial<ShaderLinearGradientProps>;
  radialGradient?: Partial<ShaderRadialGradientProps>;
  holePunch?: Partial<ShaderHolePunchProps>;
  shadow?: Partial<ShaderShadowProps>;
  rounded?: Partial<ShaderRoundedProps>;
  borderRadius?: Partial<BorderRadius>;
  border?: Partial<ShaderBorderProps>;
}

export type StyleEffects = Effects;

export type NewOmit<T, K extends PropertyKey> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};

export type RemoveUnderscoreProps<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};

export type RendererText = AddColorString<
  Partial<
    Omit<
      IRendererTextNodeProps,
      'parent' | 'debug' | 'shader' | 'src' | 'children' | 'id'
    >
  >
>;

export type RendererNode = AddColorString<
  Partial<
    NewOmit<
      IRendererNodeProps,
      'parent' | 'debug' | 'shader' | 'src' | 'children' | 'id'
    >
  >
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
  extends NewOmit<
      ElementNode,
      '_type' | 'parent' | 'children' | 'src' | 'scale'
    >,
    NewOmit<RendererText, 'x' | 'y' | 'width' | 'height'> {
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
        | 'emit'
        | 'preFlexwidth'
        | 'preFlexHeight'
      >
    > {
  states?: NodeStates;
  style?: NodeStyles;
}
export interface NodeStyles extends NewOmit<NodeProps, 'style'> {
  [key: `$${string}`]: NodeProps;
}

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
        | 'direction'
        | 'display'
        | 'flexBoundary'
        | 'flexDirection'
        | 'gap'
        | 'justifyContent'
        | 'forwardFocus'
        | 'forwardStates'
        | 'linearGradient'
        | 'src'
        | 'scale'
        | 'texture'
        | 'textureOptions'
      >
    > {
  states?: NodeStates;
  style?: TextStyles;
}

export interface TextStyles extends NewOmit<TextProps, 'style'> {
  [key: `$${string}`]: TextProps;
}

export type Styles = NodeStyles | TextStyles;

// TODO: deprecated
export interface IntrinsicNodeProps extends NodeProps {}
export interface IntrinsicNodeStyleProps extends NodeStyles {}
export interface IntrinsicTextNodeStyleProps extends TextStyles {}

export type AnimationEvents = 'animating' | 'tick' | 'stopped';
export type AnimationEventHandler = (
  controller: IAnimationController,
  name: string,
  endValue: number,
  props?: any,
) => void;

export type EventPayloadMap = {
  loaded: lngr2.NodeLoadedPayload | lngr3.NodeLoadedPayload | undefined;
  failed: lngr2.NodeFailedPayload | lngr3.NodeFailedPayload;
  freed: Event;
  inBounds: Event;
  outOfBounds: Event;
  inViewport: Event;
  outOfViewport: Event;
};

export type NodeEvents = keyof EventPayloadMap;

export type EventHandler<E extends NodeEvents> = (
  target: ElementNode,
  event?: EventPayloadMap[E],
) => void;

export type OnEvent = Partial<{
  [K in NodeEvents]: EventHandler<K>;
}>;
