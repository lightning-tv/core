import {
  type AnimationSettings as RendererAnimationSettings,
  type LinearGradientProps,
  type RadialGradientProps,
  type ITextNodeProps,
  type HolePunchProps,
  type IAnimationController,
  type ShadowProps,
  NodeLoadedPayload,
  NodeFailedPayload,
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

export type DollarString = `$${string}`;
export type BorderStyle = number | BorderStyleObject;
export type BorderRadius = number | number[];

export interface Effects {
  linearGradient?: LinearGradientProps;
  radialGradient?: RadialGradientProps;
  holePunch?: HolePunchProps;
  shadow?: ShadowProps;
}

export interface BorderEffects {
  radius?: { radius: BorderRadius };
  rounded?: { radius: BorderRadius };
  border?: BorderStyleObject;
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

type EventPayloadMap = {
  loaded: NodeLoadedPayload;
  failed: NodeFailedPayload;
  freed: Event;
  inBounds: Event;
  outOfBounds: Event;
  inViewport: Event;
  outOfViewport: Event;
};

type NodeEvents = keyof EventPayloadMap;

type EventHandler<E extends NodeEvents> = (
  target: ElementNode,
  event?: EventPayloadMap[E],
) => void;

export type OnEvent = Partial<{
  [K in NodeEvents]: EventHandler<K>;
}>;
