import * as lngr2 from 'lngr2';
import * as lngr3 from 'lngr3';
import { DOMRendererMain } from './domRenderer.js';
import {
  DOM_RENDERING,
  LIGHTNING_RENDERER_V3,
  RendererOptions,
} from './config.js';
import {
  ShaderBorderPrefixedProps,
  ShaderHolePunchProps,
  ShaderLinearGradientProps,
  ShaderRadialGradientProps,
  ShaderRoundedProps,
  ShaderShadowPrefixedProps,
} from './shaders.js';
import { EventPayloadMap, NewOmit, NodeEvents } from './intrinsicTypes.js';

export type SdfFontType = 'ssdf' | 'msdf';

/** Based on {@link lngr2.CoreRenderer} */
export interface IRendererCoreRenderer {
  mode: 'canvas' | 'webgl' | undefined;
}
/** Based on {@link lngr2.TrFontManager} */
export interface IRendererFontManager {
  addFontFace: (...a: any[]) => void;
}
/** Based on {@link lngr2.Stage} */
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

/** Based on {@link lngr2.CoreShaderManager} */
export interface IRendererShaderManager {
  registerShaderType: (name: string, shader: any) => void;
}

/** Based on {@link lngr2.CoreShaderNode} */
export interface IRendererShader {
  shaderType: IRendererShaderType;
  props?: IRendererShaderProps & IRendererShaderPropsEffects;
  program?: {};
}
/** Based on {@link lngr2.CoreShaderType} */
export interface IRendererShaderType {}

export type IRendererShaderPropsEffects = { effects?: lngr2.EffectDescUnion[] };

export type IRendererShaderProps = Partial<ShaderBorderPrefixedProps> &
  Partial<ShaderShadowPrefixedProps> &
  Partial<ShaderRoundedProps> &
  Partial<ShaderHolePunchProps> &
  Partial<ShaderRadialGradientProps> &
  Partial<ShaderLinearGradientProps>;

/** Based on {@link lngr2.Texture} */
export interface IRendererTexture {
  props: IRendererTextureProps;
  type: lngr2.TextureType;
}
export interface IRendererTextureProps {}

export interface IRendererNodeShaded {
  stage: IRendererStage;
  id: number;
  animate: (
    props: Partial<lngr2.INodeAnimateProps<any>>,
    settings: Partial<lngr2.AnimationSettings>,
  ) => IAnimationController;
  get absX(): number;
  get absY(): number;
  on<E extends NodeEvents>(ev: E, cb: IRendererNodeOnCallback<E>): void;
  destroy(): void;
}
export type IRendererNodeOnCallback<E extends NodeEvents> = (
  node: IRendererNode,
  data: EventPayloadMap[E],
) => void;

export type AnimationControllerState = 'stopped' | 'running' | 'paused';

/** Based on {@link lngr2.IAnimationController} */
export interface IAnimationController {
  /**
   * Start the animation
   *
   * @remarks
   * If the animation is paused this method will resume the animation.
   */
  start(): IAnimationController;
  /**
   * Stop the animation
   *
   * @remarks
   * Resets the animation to the start state
   */
  stop(): IAnimationController;
  /**
   * Pause the animation
   */
  pause(): IAnimationController;
  /**
   * Restore the animation to the original values
   */
  restore(): IAnimationController;
  /**
   * Promise that resolves when the last active animation is stopped (including
   * when the animation finishes naturally).
   *
   * @remarks
   * The Promise returned by this method is reset every time the animation
   * enters a new start/stop cycle. This means you must call `start()` before
   * calling this method if you want to wait for the animation to stop.
   *
   * This method always returns a resolved promise if the animation is currently
   * in a stopped state.
   *
   * @returns
   */
  waitUntilStopped(): Promise<void>;
  /**
   * Current state of the animation
   *
   * @remarks
   * - `stopped` - The animation is currently stopped (at the beggining or end
   *   of the animation)
   * - `running` - The animation is currently running
   * - `paused` - The animation is currently paused
   */
  readonly state: AnimationControllerState;

  on: (
    e: string,
    cb: (controller: IAnimationController, props?: any) => void,
  ) => void;
}

export type CustomDataMap = {
  [key: string]: string | number | boolean | undefined;
};

export { TextureType, type TextureMap } from 'lngr2';

export interface TextureOptions {
  /**
   * Preload the texture immediately even if it's not being rendered to the
   * screen.
   *
   * @remarks
   * This allows the texture to be used immediately without any delay when it
   * is first needed for rendering. Otherwise the loading process will start
   * when the texture is first rendered, which may cause a delay in that texture
   * being shown properly.
   *
   * @defaultValue `false`
   */
  preload?: boolean;
  /**
   * Prevent clean up of the texture when it is no longer being used.
   *
   * @remarks
   * This is useful when you want to keep the texture in memory for later use.
   * Regardless of whether the texture is being used or not, it will not be
   * cleaned up.
   *
   * @defaultValue `false`
   */
  preventCleanup?: boolean;
  /**
   * Flip the texture horizontally when rendering
   *
   * @defaultValue `false`
   */
  flipX?: boolean;
  /**
   * Flip the texture vertically when rendering
   *
   * @defaultValue `false`
   */
  flipY?: boolean;
  /**
   * You can use resizeMode to determine the clipping automatically from the width
   * and height of the source texture. This can be convenient if you are unsure about
   * the exact image sizes but want the image to cover a specific area.
   *
   * The resize modes cover and contain are supported
   */
  resizeMode?: ResizeModeOptions;
}

export interface ResizeModeOptionsCover {
  /**
   * Specifies that the image should be resized to cover the specified dimensions.
   */
  type: 'cover';
  /**
   * The horizontal clipping position
   * To clip the left, set clipX to 0. To clip the right, set clipX to 1.
   * clipX 0.5 will clip a equal amount from left and right
   *
   * @defaultValue 0.5
   */
  clipX?: number;
  /**
   * The vertical clipping position
   * To clip the top, set clipY to 0. To clip the bottom, set clipY to 1.
   * clipY 0.5 will clip a equal amount from top and bottom
   *
   * @defaultValue 0.5
   */
  clipY?: number;
}
export interface ResizeModeOptionsContain {
  /**
   * Specifies that the image should be resized to fit within the specified dimensions.
   */
  type: 'contain';
}
export type ResizeModeOptions =
  | ResizeModeOptionsCover
  | ResizeModeOptionsContain;

/** Based on {@link lngr2.INodeProps} and {@link lngr2.CoreNodeProps} */
export interface IRendererNodeProps
  extends NewOmit<
    lngr2.INodeProps & lngr3.INodeProps,
    'shader' | 'parent' | 'texture' | 'debug'
  > {
  shader: IRendererShader | null;
  parent: IRendererNode | null;
  texture: IRendererTexture | null;
}

/** Based on {@link lngr2.INode} */
export interface IRendererNode extends IRendererNodeShaded, IRendererNodeProps {
  div?: HTMLElement;
  props: IRendererNodeProps;
}

/** Based on {@link lngr2.ITextNodeProps} */
export interface IRendererTextNodeProps
  extends IRendererNodeProps,
    Omit<
      lngr2.ITextNodeProps & lngr3.ITextNodeProps,
      'shader' | 'parent' | 'texture' | 'debug'
    > {}

/** Based on {@link lngr2.ITextNode} */
export interface IRendererTextNode
  extends IRendererNodeShaded,
    IRendererTextNodeProps {
  div?: HTMLElement;
  props: IRendererTextNodeProps;
}

/** Based on {@link lngr2.RendererMain} */
export interface IRendererMain {
  stage: IRendererStage;
  root: IRendererNode;
  createTextNode(props: Partial<IRendererTextNodeProps>): IRendererTextNode;
  createNode(props: Partial<IRendererNodeProps>): IRendererNode;
  createShader(
    kind: string,
    props: IRendererShaderProps & IRendererShaderPropsEffects,
  ): IRendererShader;
  createTexture(
    kind: keyof lngr2.TextureMap,
    props: IRendererTextureProps,
  ): IRendererTexture;
  createEffect(
    kind: keyof lngr2.EffectMap,
    props: Record<string, any>,
    name?: string,
  ): lngr2.EffectDescUnion;
  on: (e: string, cb: (...a: any[]) => void) => void;
}

export let renderer: IRendererMain;

export const getRenderer = () => renderer;

export function startLightningRenderer(
  options: RendererOptions,
  rootId: string | HTMLElement = 'app',
) {
  renderer = DOM_RENDERING
    ? new DOMRendererMain(options, rootId)
    : LIGHTNING_RENDERER_V3
      ? (new lngr3.RendererMain(options, rootId) as any as IRendererMain)
      : (new lngr2.RendererMain(options, rootId) as any as IRendererMain);
  return renderer;
}

export function loadFonts(
  fonts: (
    | lngr2.WebTrFontFaceOptions
    | (Partial<lngr2.SdfTrFontFaceOptions> & { type: SdfFontType })
  )[],
) {
  for (const font of fonts) {
    // WebGL — SDF
    if (
      renderer.stage.renderer.mode === 'webgl' &&
      'type' in font &&
      (font.type === 'msdf' || font.type === 'ssdf')
    ) {
      let fontFace: any;
      if (LIGHTNING_RENDERER_V3) {
        fontFace = new lngr3.SdfTrFontFace(font.type, {
          ...font,
          stage: renderer.stage as any,
        } as lngr3.SdfTrFontFaceOptions);
      } else {
        fontFace = new lngr2.SdfTrFontFace(font.type, {
          ...font,
          stage: renderer.stage as any,
        } as lngr2.SdfTrFontFaceOptions);
      }
      renderer.stage.fontManager.addFontFace(fontFace);
    }
    // Canvas — Web
    else if ('fontUrl' in font) {
      let fontFace: any;
      if (LIGHTNING_RENDERER_V3) {
        fontFace = new lngr3.WebTrFontFace(font);
      } else {
        fontFace = new lngr2.WebTrFontFace(font);
      }
      renderer.stage.fontManager.addFontFace(fontFace);
    }
  }
}
