import * as lng from '@lightningjs/renderer';
import { DOMRendererMain } from './domRenderer.js';
import { DOM_RENDERING } from './config.js';

export type SdfFontType = 'ssdf' | 'msdf';

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
    registerAnimation: (anim: any) => void;
    unregisterAnimation: (anim: any) => void;
  };
}

/** Based on {@link lng.CoreShaderManager} */
export interface IRendererShaderManager {
  registerShaderType: (name: string, shader: any) => void;
}

/** Based on {@link lng.CoreShaderNode} */
export interface IRendererShader {
  shaderType: IRendererShaderType;
  props?: IRendererShaderProps;
  program?: {};
}
/** Based on {@link lng.CoreShaderType} */
export interface IRendererShaderType {}
export type IRendererShaderProps = Record<string, unknown>;

/** Based on {@link lng.Texture} */
export interface IRendererTexture {
  props: IRendererTextureProps;
  type: lng.TextureType;
}
export interface IRendererTextureProps {}

export interface IEventEmitter {
  on: (e: string, cb: (...a: any[]) => void) => void;
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
  extends Omit<lng.INodeProps<lng.CoreShaderNode>, 'shader' | 'parent'> {
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
  createTextNode(props: Partial<IRendererTextNodeProps>): IRendererTextNode;
  createNode(props: Partial<IRendererNodeProps>): IRendererNode;
  createShader(kind: string, props: IRendererShaderProps): IRendererShader;
  createTexture(
    kind: keyof lng.TextureMap,
    props: IRendererTextureProps,
  ): IRendererTexture;
}

export let renderer: IRendererMain;

export const getRenderer = () => renderer;

export function startLightningRenderer(
  options: lng.RendererMainSettings,
  rootId: string | HTMLElement = 'app',
) {
  renderer = DOM_RENDERING
    ? new DOMRendererMain(options, rootId)
    : (new lng.RendererMain(options, rootId) as any as IRendererMain);
  return renderer;
}

export function loadFonts(
  fonts: (
    | lng.WebTrFontFaceOptions
    | (Partial<lng.SdfTrFontFaceOptions> & { type: SdfFontType })
  )[],
) {
  for (const font of fonts) {
    // WebGL — SDF
    if (
      renderer.stage.renderer.mode === 'webgl' &&
      'type' in font &&
      (font.type === 'msdf' || font.type === 'ssdf')
    ) {
      renderer.stage.fontManager.addFontFace(
        new lng.SdfTrFontFace(font.type, {
          ...font,
          stage: renderer.stage as any,
        } as lng.SdfTrFontFaceOptions),
      );
    }
    // Canvas — Web
    else if ('fontUrl' in font) {
      renderer.stage.fontManager.addFontFace(new lng.WebTrFontFace(font));
    }
  }
}
