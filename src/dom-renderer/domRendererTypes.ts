import * as lng from '@lightningjs/renderer';
import { CoreAnimation } from '../intrinsicTypes.js';

/** Based on {@link lng.CoreRenderer} */
export interface IRendererCoreRenderer {
  mode: 'canvas' | 'webgl' | undefined;
}
/** Based on {@link lng.TrFontManager} */
export interface IRendererFontManager {
  addFontFace: (...a: any[]) => void;
}
/** Based on {@link lng.Stage} */
export interface IRendererStage {
  root: IRendererNode;
  renderer: IRendererCoreRenderer;
  fontManager: IRendererFontManager;
  shManager: IRendererShaderManager;
  animationManager: {
    registerAnimation: (anim: CoreAnimation) => void;
    unregisterAnimation: (anim: CoreAnimation) => void;
  };
}

/** Based on {@link lng.CoreShaderManager} */
export interface IRendererShaderManager {
  registerShaderType: (name: string, shader: any) => void;
}

/** Based on {@link lng.CoreShaderNode} */
export interface IRendererShader {
  shaderType?: string;
  props?: IRendererShaderProps;
  program?: {};
}
/** Based on {@link lng.CoreShaderType} */
export interface IRendererShaderType {}
export type IRendererShaderProps = Record<string, unknown>;

/** Based on {@link lng.Texture} */
export interface IRendererTexture extends lng.Texture {
  props: IRendererTextureProps;
  type: lng.TextureType;
}
export interface IRendererTextureProps {}

export interface IEventEmitter<
  T extends object = { [s: string]: (target: any, data: any) => void },
> {
  on<K extends keyof T>(event: Extract<K, string>, listener: T[K]): void;
  once<K extends keyof T>(event: Extract<K, string>, listener: T[K]): void;
  off<K extends keyof T>(event: Extract<K, string>, listener: T[K]): void;
  emit<K extends keyof T>(
    event: Extract<K, string>,
    data: Parameters<any>[1],
  ): void;
}

export interface IRendererNodeShaded extends IEventEmitter {
  stage: IRendererStage;
  id: number;
  animate: (
    props: Partial<lng.INodeAnimateProps<any>>,
    settings: Partial<lng.AnimationSettings>,
  ) => lng.IAnimationController;
  get absX(): number;
  get absY(): number;
}

/** Based on {@link lng.INodeProps} */
export interface IRendererNodeProps
  extends Omit<lng.INodeProps, 'shader' | 'parent'> {
  shader: IRendererShader | null;
  parent: IRendererNode | null;
}

/** Based on {@link lng.INode} */
export interface IRendererNode extends IRendererNodeShaded, IRendererNodeProps {
  div?: HTMLElement;
  props: IRendererNodeProps;
  renderState: lng.CoreNodeRenderState;
}

/** Based on {@link lng.ITextNodeProps} */
export interface IRendererTextNodeProps
  extends Omit<lng.ITextNodeProps, 'shader' | 'parent'> {
  shader: IRendererShader | null;
  parent: IRendererNode | null;
}

/** Based on {@link lng.ITextNode} */
export interface IRendererTextNode
  extends IRendererNodeShaded,
    IRendererTextNodeProps {
  div?: HTMLElement;
  props: IRendererTextNodeProps;
  renderState: lng.CoreNodeRenderState;
}

/** Based on {@link lng.RendererMain} */
export interface IRendererMain extends IEventEmitter {
  stage: IRendererStage;
  root: IRendererNode;
  canvas: HTMLCanvasElement;
  createTextNode(props: Partial<IRendererTextNodeProps>): IRendererTextNode;
  createNode(props: Partial<IRendererNodeProps>): IRendererNode;
  createShader(kind: string, props: IRendererShaderProps): IRendererShader;
  createTexture(
    kind: keyof lng.TextureMap,
    props: IRendererTextureProps,
  ): IRendererTexture;
  createEffect(
    kind: keyof lng.EffectMap,
    props: Record<string, any>,
    name?: string,
  ): lng.EffectDescUnion;
}
