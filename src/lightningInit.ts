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
import { EventPayloadMap, NodeEvents } from './intrinsicTypes.js';

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
  props?: IRendererShaderProps & { effects?: lngr2.EffectDescUnion[] };
  program?: {};
}
/** Based on {@link lngr2.CoreShaderType} */
export interface IRendererShaderType {}

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
export interface IRendererNodeProps {
  /**
   * The x coordinate of the Node's Mount Point.
   *
   * @remarks
   * See {@link mountX} and {@link mountY} for more information about setting
   * the Mount Point.
   *
   * @default `0`
   */
  x: number;
  /**
   * The y coordinate of the Node's Mount Point.
   *
   * @remarks
   * See {@link mountX} and {@link mountY} for more information about setting
   * the Mount Point.
   *
   * @default `0`
   */
  y: number;
  /**
   * The width of the Node.
   *
   * @default `0`
   */
  width: number;
  /**
   * The height of the Node.
   *
   * @default `0`
   */
  height: number;
  /**
   * The alpha opacity of the Node.
   *
   * @remarks
   * The alpha value is a number between 0 and 1, where 0 is fully transparent
   * and 1 is fully opaque.
   *
   * @default `1`
   */
  alpha: number;
  /**
   * Autosize mode
   *
   * @remarks
   * When enabled, when a texture is loaded into the Node, the Node will
   * automatically resize to the dimensions of the texture.
   *
   * Text Nodes are always autosized based on their text content regardless
   * of this mode setting.
   *
   * @default `false`
   */
  autosize: boolean;
  /**
   * Margin around the Node's bounds for preloading
   *
   * @default `null`
   */
  boundsMargin: number | [number, number, number, number] | null;
  /**
   * Clipping Mode
   *
   * @remarks
   * Enable Clipping Mode when you want to prevent the drawing of a Node and
   * its descendants from overflowing outside of the Node's x/y/width/height
   * bounds.
   *
   * For WebGL, clipping is implemented using the high-performance WebGL
   * operation scissor. As a consequence, clipping does not work for
   * non-rectangular areas. So, if the element is rotated
   * (by itself or by any of its ancestors), clipping will not work as intended.
   *
   * TODO: Add support for non-rectangular clipping either automatically or
   * via Render-To-Texture.
   *
   * @default `false`
   */
  clipping: boolean;
  /**
   * The color of the Node.
   *
   * @remarks
   * The color value is a number in the format 0xRRGGBBAA, where RR is the red
   * component, GG is the green component, BB is the blue component, and AA is
   * the alpha component.
   *
   * Gradient colors may be set by setting the different color sub-properties:
   * {@link colorTop}, {@link colorBottom}, {@link colorLeft}, {@link colorRight},
   * {@link colorTl}, {@link colorTr}, {@link colorBr}, {@link colorBl} accordingly.
   *
   * @default `0xffffffff` (opaque white)
   */
  color: number;
  /**
   * The color of the top edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorTop: number;
  /**
   * The color of the bottom edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorBottom: number;
  /**
   * The color of the left edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorLeft: number;
  /**
   * The color of the right edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorRight: number;
  /**
   * The color of the top-left corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorTl: number;
  /**
   * The color of the top-right corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorTr: number;
  /**
   * The color of the bottom-right corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorBr: number;
  /**
   * The color of the bottom-left corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorBl: number;
  /**
   * The Node's parent Node.
   *
   * @remarks
   * The value `null` indicates that the Node has no parent. This may either be
   * because the Node is the root Node of the scene graph, or because the Node
   * has been removed from the scene graph.
   *
   * In order to make sure that a Node can be rendered on the screen, it must
   * be added to the scene graph by setting it's parent property to a Node that
   * is already in the scene graph such as the root Node.
   *
   * @default `null`
   */
  parent: IRendererNode | null;
  /**
   * The Node's z-index.
   *
   * @remarks
   * TBD
   */
  zIndex: number;
  /**
   * The Node's Texture.
   *
   * @remarks
   * The `texture` defines a rasterized image that is contained within the
   * {@link width} and {@link height} dimensions of the Node. If null, the
   * Node will use an opaque white {@link ColorTexture} when being drawn, which
   * essentially enables colors (including gradients) to be drawn.
   *
   * If set, by default, the texture will be drawn, as is, stretched to the
   * dimensions of the Node. This behavior can be modified by setting the TBD
   * and TBD properties.
   *
   * To create a Texture in order to set it on this property, call
   * {@link RendererMain.createTexture}.
   *
   * If the {@link src} is set on a Node, the Node will use the
   * {@link ImageTexture} by default and the Node will simply load the image at
   * the specified URL.
   *
   * Note: If this is a Text Node, the Texture will be managed by the Node's
   * {@link TextRenderer} and should not be set explicitly.
   */
  texture: IRendererTexture | null;
  /**
   * [Deprecated]: Prevents the texture from being cleaned up when the Node is removed
   *
   * @remarks
   * Please use the `preventCleanup` property on {@link TextureOptions} instead.
   *
   * @default false
   */
  preventCleanup?: boolean;
  /**
   * Options to associate with the Node's Texture
   */
  textureOptions: TextureOptions;
  /**
   * The Node's shader
   *
   * @remarks
   * The `shader` defines a {@link Shader} used to draw the Node. By default,
   * the Default Shader is used which simply draws the defined {@link texture}
   * or {@link color}(s) within the Node without any special effects.
   *
   * To create a Shader in order to set it on this property, call
   * {@link RendererMain.createShader}.
   *
   * Note: If this is a Text Node, the Shader will be managed by the Node's
   * {@link TextRenderer} and should not be set explicitly.
   */
  shader: IRendererShader;
  /**
   * Image URL
   *
   * @remarks
   * When set, the Node's {@link texture} is automatically set to an
   * {@link ImageTexture} using the source image URL provided (with all other
   * settings being defaults)
   */
  src: string | null;
  zIndexLocked: number;
  /**
   * Scale to render the Node at
   *
   * @remarks
   * The scale value multiplies the provided {@link width} and {@link height}
   * of the Node around the Node's Pivot Point (defined by the {@link pivot}
   * props).
   *
   * Behind the scenes, setting this property sets both the {@link scaleX} and
   * {@link scaleY} props to the same value.
   *
   * NOTE: When the scaleX and scaleY props are explicitly set to different values,
   * this property returns `null`. Setting `null` on this property will have no
   * effect.
   *
   * @default 1.0
   */
  scale: number | null;
  /**
   * Scale to render the Node at (X-Axis)
   *
   * @remarks
   * The scaleX value multiplies the provided {@link width} of the Node around
   * the Node's Pivot Point (defined by the {@link pivot} props).
   *
   * @default 1.0
   */
  scaleX: number;
  /**
   * Scale to render the Node at (Y-Axis)
   *
   * @remarks
   * The scaleY value multiplies the provided {@link height} of the Node around
   * the Node's Pivot Point (defined by the {@link pivot} props).
   *
   * @default 1.0
   */
  scaleY: number;
  /**
   * Combined position of the Node's Mount Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Mount Point at the top-left corner of the Node.
   * - `0.5` defines it at the center of the Node.
   * - `1.0` defines it at the bottom-right corner of the node.
   *
   * Use the {@link mountX} and {@link mountY} props seperately for more control
   * of the Mount Point.
   *
   * When assigned, the same value is also passed to both the {@link mountX} and
   * {@link mountY} props.
   *
   * @default 0 (top-left)
   */
  mount: number;
  /**
   * X position of the Node's Mount Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Mount Point's X position as the left-most edge of the
   *   Node
   * - `0.5` defines it as the horizontal center of the Node
   * - `1.0` defines it as the right-most edge of the Node.
   *
   * The combination of {@link mountX} and {@link mountY} define the Mount Point
   *
   * @default 0 (left-most edge)
   */
  mountX: number;
  /**
   * Y position of the Node's Mount Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Mount Point's Y position as the top-most edge of the
   *   Node
   * - `0.5` defines it as the vertical center of the Node
   * - `1.0` defines it as the bottom-most edge of the Node.
   *
   * The combination of {@link mountX} and {@link mountY} define the Mount Point
   *
   * @default 0 (top-most edge)
   */
  mountY: number;
  /**
   * Combined position of the Node's Pivot Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Pivot Point at the top-left corner of the Node.
   * - `0.5` defines it at the center of the Node.
   * - `1.0` defines it at the bottom-right corner of the node.
   *
   * Use the {@link pivotX} and {@link pivotY} props seperately for more control
   * of the Pivot Point.
   *
   * When assigned, the same value is also passed to both the {@link pivotX} and
   * {@link pivotY} props.
   *
   * @default 0.5 (center)
   */
  pivot: number;
  /**
   * X position of the Node's Pivot Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Pivot Point's X position as the left-most edge of the
   *   Node
   * - `0.5` defines it as the horizontal center of the Node
   * - `1.0` defines it as the right-most edge of the Node.
   *
   * The combination of {@link pivotX} and {@link pivotY} define the Pivot Point
   *
   * @default 0.5 (centered on x-axis)
   */
  pivotX: number;
  /**
   * Y position of the Node's Pivot Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Pivot Point's Y position as the top-most edge of the
   *   Node
   * - `0.5` defines it as the vertical center of the Node
   * - `1.0` defines it as the bottom-most edge of the Node.
   *
   * The combination of {@link pivotX} and {@link pivotY} define the Pivot Point
   *
   * @default 0.5 (centered on y-axis)
   */
  pivotY: number;
  /**
   * Rotation of the Node (in Radians)
   *
   * @remarks
   * Sets the amount to rotate the Node by around it's Pivot Point (defined by
   * the {@link pivot} props). Positive values rotate the Node clockwise, while
   * negative values rotate it counter-clockwise.
   *
   * Example values:
   * - `-Math.PI / 2`: 90 degree rotation counter-clockwise
   * - `0`: No rotation
   * - `Math.PI / 2`: 90 degree rotation clockwise
   * - `Math.PI`: 180 degree rotation clockwise
   * - `3 * Math.PI / 2`: 270 degree rotation clockwise
   * - `2 * Math.PI`: 360 rotation clockwise
   */
  rotation: number;
  /**
   * Whether the Node is rendered to a texture
   *
   * @remarks
   * TBD
   *
   * @default false
   */
  rtt: boolean;
  /**
   * Node data element for custom data storage (optional)
   *
   * @remarks
   * This property is used to store custom data on the Node as a key/value data store.
   * Data values are limited to string, numbers, booleans. Strings will be truncated
   * to a 2048 character limit for performance reasons.
   *
   * This is not a data storage mechanism for large amounts of data please use a
   * dedicated data storage mechanism for that.
   *
   * The custom data will be reflected in the inspector as part of `data-*` attributes
   *
   * @default `undefined`
   */
  data?: CustomDataMap;
  /**
   * Image Type to explicitly set the image type that is being loaded
   *
   * @remarks
   * This property must be used with a `src` that points at an image. In some cases
   * the extension doesn't provide a reliable representation of the image type. In such
   * cases set the ImageType explicitly.
   *
   * `regular` is used for normal images such as png, jpg, etc
   * `compressed` is used for ETC1/ETC2 compressed images with a PVR or KTX container
   * `svg` is used for scalable vector graphics
   *
   * @default `undefined`
   */
  imageType?: 'regular' | 'compressed' | 'svg' | null;
  /**
   * She width of the rectangle from which the Image Texture will be extracted.
   * This value can be negative. If not provided, the image's source natural
   * width will be used.
   */
  srcWidth?: number;
  /**
   * The height of the rectangle from which the Image Texture will be extracted.
   * This value can be negative. If not provided, the image's source natural
   * height will be used.
   */
  srcHeight?: number;
  /**
   * The x coordinate of the reference point of the rectangle from which the Texture
   * will be extracted.  `width` and `height` are provided. And only works when
   * createImageBitmap is available. Only works when createImageBitmap is supported on the browser.
   */
  srcX?: number;
  /**
   * The y coordinate of the reference point of the rectangle from which the Texture
   * will be extracted. Only used when source `srcWidth` width and `srcHeight` height
   * are provided. Only works when createImageBitmap is supported on the browser.
   */
  srcY?: number;
  /**
   * By enabling Strict bounds the renderer will not process & render child nodes of a node that is out of the visible area
   *
   * @remarks
   * When enabled out of bound nodes, i.e. nodes that are out of the visible area, will
   * **NOT** have their children processed and renderer anymore. This means the children of a out of bound
   * node will not receive update processing such as positioning updates and will not be drawn on screen.
   * As such the rest of the branch of the update tree that sits below this node will not be processed anymore
   *
   * This is a big performance gain but may be disabled in cases where the width of the parent node is
   * unknown and the render must process the child nodes regardless of the viewport status of the parent node
   *
   * @default false
   */
  strictBounds: boolean;
  /**
   * Mark the node as interactive so we can perform hit tests on it
   * when pointer events are registered.
   * @default false
   */
  interactive?: boolean;
}

/** Based on {@link lngr2.INode} */
export interface IRendererNode extends IRendererNodeShaded, IRendererNodeProps {
  div?: HTMLElement;
  props: IRendererNodeProps;
}

/** Based on {@link lngr2.ITextNodeProps} */
export interface IRendererTextNodeProps
  extends Omit<lngr2.ITextNodeProps, 'shader' | 'parent'> {
  shader: IRendererShader | null;
  parent: IRendererNode | null;
}
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
  createShader(kind: string, props: IRendererShaderProps): IRendererShader;
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
