/*

Experimental DOM renderer

*/

import * as lng from '@lightningjs/renderer';

import { Config } from './config.js';
import {
  IRendererShader,
  IRendererStage,
  IRendererShaderProps,
  IRendererTextureProps,
  IRendererTexture,
  IRendererMain,
  IRendererNode,
  IRendererNodeProps,
  IRendererTextNode,
  IRendererTextNodeProps,
} from './lightningInit.js';
import { EventEmitter } from '@lightningjs/renderer/utils';

const colorToRgba = (c: number) =>
  `rgba(${(c >> 24) & 0xff},${(c >> 16) & 0xff},${(c >> 8) & 0xff},${(c & 0xff) / 255})`;

/*
 Animations
*/
type AnimationTask = {
  node: DOMNode;
  propsStart: Record<string, number>;
  propsEnd: Record<string, number>;
  timeStart: number;
  timeEnd: number;
  settings: Required<lng.AnimationSettings>;
  iteration: number;
  pausedTime: number | null;
};

let animationTasks: AnimationTask[] = [];
let animationFrameRequested = false;

function requestAnimationUpdate() {
  if (!animationFrameRequested && animationTasks.length > 0) {
    animationFrameRequested = true;
    requestAnimationFrame(updateAnimations);
  }
}

function updateAnimations(time: number) {
  animationFrameRequested = false;

  /*
   tasks are iterated in insertion order
   so that the later task will override the earlier ones
  */
  for (let i = 0; i < animationTasks.length; i++) {
    let task = animationTasks[i]!;
    if (task.pausedTime != null) continue;

    let elapsed = time - task.timeStart;

    // Still in delay period
    if (elapsed < task.settings.delay) {
      requestAnimationUpdate();
      continue;
    }

    let activeTime = elapsed - task.settings.delay;

    if (activeTime >= task.settings.duration) {
      // Start next iteration
      if (task.settings.loop || task.iteration < task.settings.repeat - 1) {
        task.iteration++;
        task.timeStart = time - task.settings.delay;
        if (task.settings.repeatDelay > 0) {
          task.timeStart += task.settings.repeatDelay;
        }
        requestAnimationUpdate();
      }
      // Animation complete
      else {
        Object.assign(task.node.props, task.propsEnd);
        updateNodeStyles(task.node);
        animationTasks.splice(i, 1);
        i--;
      }
      continue;
    }

    /*
     Update props and styles
    */
    let t = applyEasing(
      activeTime / task.settings.duration,
      task.settings.easing,
    );

    for (let prop in task.propsEnd) {
      let fn = prop.startsWith('color') ? interpolateColor : interpolate;
      (task.node.props as any)[prop] = fn(
        task.propsStart[prop]!,
        task.propsEnd[prop]!,
        t,
      );
    }

    updateNodeStyles(task.node);
  }

  requestAnimationUpdate();
}

function applyEasing(progress: number, easing: string): number {
  switch (easing) {
    case 'linear':
    default:
      return progress;
    case 'ease-in':
      return progress * progress;
    case 'ease-out':
      return progress * (2 - progress);
    case 'ease-in-out':
      return progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
  }
}

function interpolate(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function interpolateColor(start: number, end: number, t: number): number {
  return (
    (interpolate((start >> 24) & 0xff, (end >> 24) & 0xff, t) << 24) |
    (interpolate((start >> 16) & 0xff, (end >> 16) & 0xff, t) << 16) |
    (interpolate((start >> 8) & 0xff, (end >> 8) & 0xff, t) << 8) |
    interpolate(start & 0xff, end & 0xff, t)
  );
}

class AnimationController implements lng.IAnimationController {
  state: lng.AnimationControllerState = 'paused';

  constructor(public task: AnimationTask) {}

  start() {
    if (this.task.pausedTime != null) {
      this.task.timeStart += performance.now() - this.task.pausedTime;
      this.task.pausedTime = null;
    } else {
      this.task.timeStart = performance.now();
    }
    requestAnimationUpdate();
    return this;
  }
  pause() {
    this.task.pausedTime = performance.now();
    return this;
  }
  stop() {
    let index = animationTasks.indexOf(this.task);
    if (index !== -1) {
      animationTasks.splice(index, 1);
    }
    return this;
  }

  restore() {
    return this;
  }
  waitUntilStopped() {
    return Promise.resolve();
  }
  on() {
    return this;
  }
  once() {
    return this;
  }
  off() {
    return this;
  }
  emit() {
    return this;
  }
}

function animate(
  this: DOMNode,
  props: Partial<lng.INodeAnimateProps<any>>,
  settings: Partial<lng.AnimationSettings>,
): lng.IAnimationController {
  let fullSettings: Required<lng.AnimationSettings> = {
    duration: settings.duration ?? 300,
    delay: settings.delay ?? 0,
    easing: settings.easing ?? 'linear',
    loop: settings.loop ?? false,
    repeat: settings.repeat ?? 1,
    repeatDelay: settings.repeatDelay ?? 0,
    stopMethod: false,
  };

  let now = performance.now();

  // Create the animation task
  let task: AnimationTask = {
    node: this,
    propsStart: {},
    propsEnd: {},
    timeStart: now,
    timeEnd: now + fullSettings.delay + fullSettings.duration,
    settings: fullSettings,
    iteration: 0,
    pausedTime: null,
  };

  for (let [prop, value] of Object.entries(props)) {
    if (value != null && typeof value === 'number') {
      task.propsStart[prop] = (this.props as any)[prop];
      task.propsEnd[prop] = value;
    }
  }

  animationTasks.push(task);

  return new AnimationController(task);
}

let elMap = new WeakMap<DOMNode, HTMLElement>();

function updateNodeParent(node: DOMNode | DOMText) {
  if (node.parent != null) {
    elMap.get(node.parent as DOMNode)!.appendChild(node.el);
  }
}

function getNodeStyles(node: Readonly<DOMNode | DOMText>): string {
  let { props } = node;

  let style = `position: absolute; z-index: ${props.zIndex};`;

  if (props.alpha !== 1) style += `opacity: ${props.alpha};`;

  if (props.width !== 0) style += `width: ${props.width}px;`;

  if (props.height !== 0) style += `height: ${props.height}px;`;

  if (props.clipping) {
    style += `overflow: hidden;`;
  }

  // Transform
  {
    let transform = '';

    let { x, y } = props;

    if (props.mountX != null) {
      x -= (props.width ?? 0) * props.mountX;
    }

    if (props.mountY != null) {
      y -= (props.height ?? 0) * props.mountY;
    }

    if (x !== 0) transform += `translateX(${x}px)`;

    if (y !== 0) transform += `translateY(${y}px)`;

    if (props.rotation !== 0) transform += `rotate(${props.rotation}rad)`;

    if (props.scale !== 1 && props.scale != null)
      transform += `scale(${props.scale})`;
    else {
      if (props.scaleX !== 1) transform += `scaleX(${props.scaleX})`;
      if (props.scaleY !== 1) transform += `scaleY(${props.scaleY})`;
    }

    if (transform.length > 0) {
      style += `transform: ${transform};`;
    }
  }

  // <Text>
  if (node instanceof DOMText) {
    let textProps = node.props;

    if (textProps.color != null && textProps.color !== 0) {
      style += `color: ${colorToRgba(textProps.color)};`;
    }

    if (textProps.fontFamily) style += `font-family: ${textProps.fontFamily};`;
    if (textProps.fontSize) style += `font-size: ${textProps.fontSize}px;`;
    if (textProps.fontStyle !== 'normal')
      style += `font-style: ${textProps.fontStyle};`;
    if (textProps.fontWeight !== 'normal')
      style += `font-weight: ${textProps.fontWeight};`;
    if (textProps.fontStretch !== 'normal')
      style += `font-stretch: ${textProps.fontStretch};`;
    if (textProps.lineHeight != null)
      style += `line-height: ${textProps.lineHeight}px;`;
    if (textProps.letterSpacing)
      style += `letter-spacing: ${textProps.letterSpacing}px;`;
    if (textProps.textAlign !== 'left')
      style += `text-align: ${textProps.textAlign};`;
    // if (node.overflowSuffix) style += `overflow-suffix: ${node.overflowSuffix};`
    if (textProps.maxLines > 0) {
      // https://stackoverflow.com/a/13924997
      style += `display: -webkit-box;
        overflow: hidden;
        -webkit-line-clamp: ${textProps.maxLines};
        line-clamp: ${textProps.maxLines};
        -webkit-box-orient: vertical;`;
    }
    if (textProps.contain !== 'none') {
      style += `overflow: hidden;`;
    }
    // if (node.verticalAlign) style += `vertical-align: ${node.verticalAlign};`
  }
  // <Node>
  else {
    let bgImg: string[] = [];
    let bgPos: null | { x: number; y: number } = null;

    if (props.colorBottom !== props.colorTop) {
      bgImg.push(
        `linear-gradient(${colorToRgba(props.colorTop)}, ${colorToRgba(props.colorBottom)})`,
      );
    }
    if (props.colorLeft !== props.colorRight) {
      bgImg.push(
        `linear-gradient(to right, ${colorToRgba(props.colorLeft)}, ${colorToRgba(props.colorRight)})`,
      );
    }

    if (
      props.texture != null &&
      props.texture.type === lng.TextureType.subTexture
    ) {
      bgPos = (props.texture as any).props;
      bgImg.push(`url(${(props.texture as any).props.texture.props.src})`);
    } else if (props.src) {
      bgImg.push(`url(${props.src})`);
    }

    if (bgImg.length > 0) {
      style += `background-image: ${bgImg.join(',')}; background-blend-mode: multiply;`;
      if (bgPos !== null) {
        style += `background-position: -${bgPos.x}px -${bgPos.y}px;`;
      } else {
        style += 'background-size: 100% 100%;';
      }

      if (props.color !== 0xffffffff && props.color !== 0) {
        style += `background-color: ${colorToRgba(props.color)};`;
        style += `mask-image: ${bgImg.join(',')};`;
        if (bgPos !== null) {
          style += `mask-position: -${bgPos.x}px -${bgPos.y}px;`;
        } else {
          style += `mask-size: 100% 100%;`;
        }
      }
    } else if (props.color !== 0) {
      style += `background-color: ${colorToRgba(props.color)};`;
    }

    if (props.shader != null) {
      let shader = props.shader.props;
      if (shader != null) {
        const borderWidth = shader['border-width'] as number | undefined;
        const borderColor = shader['border-color'] as number | undefined;
        const radius = shader['radius'] as
          | number
          | [number, number, number, number]
          | undefined;

        // Border
        if (
          typeof borderWidth === 'number' &&
          borderWidth !== 0 &&
          typeof borderColor === 'number' &&
          borderColor !== 0
        ) {
          // css border impacts the element's box size when box-shadow doesn't
          style += `box-shadow: inset 0px 0px 0px ${borderWidth}px ${colorToRgba(borderColor)};`;
        }
        // Rounded
        if (typeof radius === 'number' && radius > 0) {
          style += `border-radius: ${radius}px;`;
        } else if (Array.isArray(radius) && radius.length === 4) {
          style += `border-radius: ${radius[0]}px ${radius[1]}px ${radius[2]}px ${radius[3]}px;`;
        }
      }
    }
  }

  return style;
}

function updateNodeStyles(node: DOMNode | DOMText) {
  node.el.setAttribute('style', getNodeStyles(node));

  if (node instanceof DOMText) {
    scheduleUpdateTextNodeMeasurement(node);
  }
}

/*
  Text nodes with contain 'width' or 'none'
  need to have their height or width calculated.
  And then cause the flex layout to be recalculated.
*/

const textNodesToMeasure = new Set<DOMText>();

type Size = { width: number; height: number };

function getElSize(node: DOMNode): Size {
  let rect = node.el.getBoundingClientRect();
  let dpr = Config.rendererOptions?.deviceLogicalPixelRatio ?? 1;
  rect.height = rect.height / dpr;
  rect.width = rect.width / dpr;
  return rect;
}

function updateTextNodeMeasurements() {
  for (let node of textNodesToMeasure) {
    let size: Size;
    switch (node.contain) {
      case 'width':
        size = getElSize(node);
        if (node.props.height !== size.height) {
          node.props.height = size.height;
          node.emit('loaded');
        }
        break;
      case 'none':
        size = getElSize(node);
        if (
          node.props.height !== size.height ||
          node.props.width !== size.width
        ) {
          node.props.width = size.width;
          node.props.height = size.height;
          node.emit('loaded');
        }
        break;
    }
  }
  textNodesToMeasure.clear();
}

function scheduleUpdateTextNodeMeasurement(node: DOMText) {
  if (textNodesToMeasure.size === 0) {
    setTimeout(updateTextNodeMeasurements);
  }

  textNodesToMeasure.add(node);
}

function updateNodeData(node: DOMNode | DOMText) {
  for (let key in node.data) {
    let keyValue: unknown = node.data[key];
    if (keyValue === undefined) {
      node.el.removeAttribute('data-' + key);
    } else {
      node.el.setAttribute('data-' + key, String(keyValue));
    }
  }
}

function resolveNodeDefaults(
  props: Partial<IRendererNodeProps>,
): IRendererNodeProps {
  const color = props.color ?? 0xffffffff;

  return {
    x: props.x ?? 0,
    y: props.y ?? 0,
    width: props.width ?? 0,
    height: props.height ?? 0,
    alpha: props.alpha ?? 1,
    autosize: props.autosize ?? false,
    boundsMargin: props.boundsMargin ?? null,
    clipping: props.clipping ?? false,
    color,
    colorTop: props.colorTop ?? color,
    colorBottom: props.colorBottom ?? color,
    colorLeft: props.colorLeft ?? color,
    colorRight: props.colorRight ?? color,
    colorBl: props.colorBl ?? props.colorBottom ?? props.colorLeft ?? color,
    colorBr: props.colorBr ?? props.colorBottom ?? props.colorRight ?? color,
    colorTl: props.colorTl ?? props.colorTop ?? props.colorLeft ?? color,
    colorTr: props.colorTr ?? props.colorTop ?? props.colorRight ?? color,
    zIndex: props.zIndex ?? 0,
    zIndexLocked: props.zIndexLocked ?? 0,
    parent: props.parent ?? null,
    texture: props.texture ?? null,
    textureOptions: props.textureOptions ?? {},
    shader: props.shader ?? defaultShader,
    // Since setting the `src` will trigger a texture load, we need to set it after
    // we set the texture. Otherwise, problems happen.
    src: props.src ?? null,
    srcHeight: props.srcHeight,
    srcWidth: props.srcWidth,
    srcX: props.srcX,
    srcY: props.srcY,
    scale: props.scale ?? null,
    scaleX: props.scaleX ?? props.scale ?? 1,
    scaleY: props.scaleY ?? props.scale ?? 1,
    mount: props.mount ?? 0,
    mountX: props.mountX ?? props.mount ?? 0,
    mountY: props.mountY ?? props.mount ?? 0,
    pivot: props.pivot ?? 0.5,
    pivotX: props.pivotX ?? props.pivot ?? 0.5,
    pivotY: props.pivotY ?? props.pivot ?? 0.5,
    rotation: props.rotation ?? 0,
    rtt: props.rtt ?? false,
    data: {},
    imageType: props.imageType,
    strictBounds: props.strictBounds ?? false,
  };
}

function resolveTextNodeDefaults(
  props: Partial<IRendererTextNodeProps>,
): IRendererTextNodeProps {
  return {
    ...resolveNodeDefaults(props),
    text: props.text ?? '',
    textRendererOverride: props.textRendererOverride ?? null,
    fontSize: props.fontSize ?? 16,
    fontFamily: props.fontFamily ?? 'sans-serif',
    fontStyle: props.fontStyle ?? 'normal',
    fontWeight: props.fontWeight ?? 'normal',
    fontStretch: props.fontStretch ?? 'normal',
    textAlign: props.textAlign ?? 'left',
    contain: props.contain ?? 'none',
    scrollable: props.scrollable ?? false,
    scrollY: props.scrollY ?? 0,
    offsetY: props.offsetY ?? 0,
    letterSpacing: props.letterSpacing ?? 0,
    lineHeight: props.lineHeight, // `undefined` is a valid value
    maxLines: props.maxLines ?? 0,
    textBaseline: props.textBaseline ?? 'alphabetic',
    verticalAlign: props.verticalAlign ?? 'middle',
    overflowSuffix: props.overflowSuffix ?? '...',
    wordBreak: props.wordBreak ?? 'normal',
    debug: props.debug ?? {},
  };
}

const defaultShader: IRendererShader = {
  shaderType: '',
  props: undefined,
};

let lastNodeId = 0;

class DOMNode extends EventEmitter implements IRendererNode {
  el = document.createElement('div');
  id = ++lastNodeId;

  renderState: lng.CoreNodeRenderState = 0 /* Init */;

  constructor(
    public stage: IRendererStage,
    public props: IRendererNodeProps,
  ) {
    super();

    // @ts-ignore
    this.el._node = this;
    this.el.setAttribute('data-id', String(this.id));
    elMap.set(this, this.el);

    updateNodeParent(this);
    updateNodeStyles(this);
    updateNodeData(this);
  }

  destroy(): void {
    elMap.delete(this);
    this.el.parentNode!.removeChild(this.el);
  }

  get parent() {
    return this.props.parent;
  }
  set parent(value: IRendererNode | null) {
    this.props.parent = value;
    updateNodeParent(this);
  }

  animate = animate;

  get x() {
    return this.props.x;
  }
  set x(v) {
    this.props.x = v;
    updateNodeStyles(this);
  }
  get y() {
    return this.props.y;
  }
  set y(v) {
    this.props.y = v;
    updateNodeStyles(this);
  }
  get width() {
    return this.props.width;
  }
  set width(v) {
    this.props.width = v;
    updateNodeStyles(this);
  }
  get height() {
    return this.props.height;
  }
  set height(v) {
    this.props.height = v;
    updateNodeStyles(this);
  }
  get alpha() {
    return this.props.alpha;
  }
  set alpha(v) {
    this.props.alpha = v;
    updateNodeStyles(this);
  }
  get autosize() {
    return this.props.autosize;
  }
  set autosize(v) {
    this.props.autosize = v;
    updateNodeStyles(this);
  }
  get clipping() {
    return this.props.clipping;
  }
  set clipping(v) {
    this.props.clipping = v;
    updateNodeStyles(this);
  }
  get color() {
    return this.props.color;
  }
  set color(v) {
    this.props.color = v;
    updateNodeStyles(this);
  }
  get colorTop() {
    return this.props.colorTop;
  }
  set colorTop(v) {
    this.props.colorTop = v;
    updateNodeStyles(this);
  }
  get colorBottom() {
    return this.props.colorBottom;
  }
  set colorBottom(v) {
    this.props.colorBottom = v;
    updateNodeStyles(this);
  }
  get colorLeft() {
    return this.props.colorLeft;
  }
  set colorLeft(v) {
    this.props.colorLeft = v;
    updateNodeStyles(this);
  }
  get colorRight() {
    return this.props.colorRight;
  }
  set colorRight(v) {
    this.props.colorRight = v;
    updateNodeStyles(this);
  }
  get colorTl() {
    return this.props.colorTl;
  }
  set colorTl(v) {
    this.props.colorTl = v;
    updateNodeStyles(this);
  }
  get colorTr() {
    return this.props.colorTr;
  }
  set colorTr(v) {
    this.props.colorTr = v;
    updateNodeStyles(this);
  }
  get colorBr() {
    return this.props.colorBr;
  }
  set colorBr(v) {
    this.props.colorBr = v;
    updateNodeStyles(this);
  }
  get colorBl() {
    return this.props.colorBl;
  }
  set colorBl(v) {
    this.props.colorBl = v;
    updateNodeStyles(this);
  }
  get zIndex() {
    return this.props.zIndex;
  }
  set zIndex(v) {
    this.props.zIndex = v;
    updateNodeStyles(this);
  }
  get texture() {
    return this.props.texture;
  }
  set texture(v) {
    this.props.texture = v;
    updateNodeStyles(this);
  }
  get textureOptions(): IRendererNode['textureOptions'] {
    return this.props.textureOptions;
  }
  set textureOptions(v) {
    this.props.textureOptions = v;
    updateNodeStyles(this);
  }
  get src() {
    return this.props.src;
  }
  set src(v) {
    this.props.src = v;
    updateNodeStyles(this);
  }
  get zIndexLocked() {
    return this.props.zIndexLocked;
  }
  set zIndexLocked(v) {
    this.props.zIndexLocked = v;
    updateNodeStyles(this);
  }
  get scale() {
    return this.props.scale ?? 1;
  }
  set scale(v) {
    this.props.scale = v;
    updateNodeStyles(this);
  }
  get scaleX() {
    return this.props.scaleX;
  }
  set scaleX(v) {
    this.props.scaleX = v;
    updateNodeStyles(this);
  }
  get scaleY() {
    return this.props.scaleY;
  }
  set scaleY(v) {
    this.props.scaleY = v;
    updateNodeStyles(this);
  }
  get mount() {
    return this.props.mount;
  }
  set mount(v) {
    this.props.mount = v;
    updateNodeStyles(this);
  }
  get mountX() {
    return this.props.mountX;
  }
  set mountX(v) {
    this.props.mountX = v;
    updateNodeStyles(this);
  }
  get mountY() {
    return this.props.mountY;
  }
  set mountY(v) {
    this.props.mountY = v;
    updateNodeStyles(this);
  }
  get pivot() {
    return this.props.pivot;
  }
  set pivot(v) {
    this.props.pivot = v;
    updateNodeStyles(this);
  }
  get pivotX() {
    return this.props.pivotX;
  }
  set pivotX(v) {
    this.props.pivotX = v;
    updateNodeStyles(this);
  }
  get pivotY() {
    return this.props.pivotY;
  }
  set pivotY(v) {
    this.props.pivotY = v;
    updateNodeStyles(this);
  }
  get rotation() {
    return this.props.rotation;
  }
  set rotation(v) {
    this.props.rotation = v;
    updateNodeStyles(this);
  }
  get rtt() {
    return this.props.rtt;
  }
  set rtt(v) {
    this.props.rtt = v;
    updateNodeStyles(this);
  }
  get shader() {
    return this.props.shader;
  }
  set shader(v) {
    this.props.shader = v;
    updateNodeStyles(this);
  }
  get strictBounds() {
    return this.props.strictBounds;
  }
  set strictBounds(v) {
    this.props.strictBounds = v;
    updateNodeStyles(this);
  }

  get data(): IRendererNode['data'] {
    return this.props.data;
  }
  set data(v) {
    this.props.data = v;
    updateNodeData(this);
  }

  get imageType() {
    return this.props.imageType;
  }
  set imageType(v) {
    this.props.imageType = v;
  }
  get srcWidth() {
    return this.props.srcWidth;
  }
  set srcWidth(v) {
    this.props.srcWidth = v;
  }
  get srcHeight() {
    return this.props.srcHeight;
  }
  set srcHeight(v) {
    this.props.srcHeight = v;
  }
  get srcX() {
    return this.props.srcX;
  }
  set srcX(v) {
    this.props.srcX = v;
  }
  get srcY() {
    return this.props.srcY;
  }
  set srcY(v) {
    this.props.srcY = v;
  }

  get boundsMargin(): number | [number, number, number, number] | null {
    return this.props.boundsMargin;
  }
  set boundsMargin(value: number | [number, number, number, number] | null) {
    this.props.boundsMargin = value;
  }

  get absX(): number {
    return this.x + -this.width * this.mountX + (this.parent?.absX ?? 0);
  }
  get absY(): number {
    return this.y + -this.height * this.mountY + (this.parent?.absY ?? 0);
  }
}

class DOMText extends DOMNode {
  constructor(
    stage: IRendererStage,
    public override props: IRendererTextNodeProps,
  ) {
    super(stage, props);
    this.el.innerText = props.text;
  }

  get text() {
    return this.props.text;
  }
  set text(v) {
    this.props.text = v;
    this.el.innerText = v;
    scheduleUpdateTextNodeMeasurement(this);
  }
  get fontFamily() {
    return this.props.fontFamily;
  }
  set fontFamily(v) {
    this.props.fontFamily = v;
    updateNodeStyles(this);
  }
  get fontSize() {
    return this.props.fontSize;
  }
  set fontSize(v) {
    this.props.fontSize = v;
    updateNodeStyles(this);
  }
  get fontStyle() {
    return this.props.fontStyle;
  }
  set fontStyle(v) {
    this.props.fontStyle = v;
    updateNodeStyles(this);
  }
  get fontWeight() {
    return this.props.fontWeight;
  }
  set fontWeight(v) {
    this.props.fontWeight = v;
    updateNodeStyles(this);
  }
  get fontStretch() {
    return this.props.fontStretch;
  }
  set fontStretch(v) {
    this.props.fontStretch = v;
    updateNodeStyles(this);
  }
  get lineHeight() {
    return this.props.lineHeight;
  }
  set lineHeight(v) {
    this.props.lineHeight = v;
    updateNodeStyles(this);
  }
  get letterSpacing() {
    return this.props.letterSpacing;
  }
  set letterSpacing(v) {
    this.props.letterSpacing = v;
    updateNodeStyles(this);
  }
  get textAlign() {
    return this.props.textAlign;
  }
  set textAlign(v) {
    this.props.textAlign = v;
    updateNodeStyles(this);
  }
  get overflowSuffix() {
    return this.props.overflowSuffix;
  }
  set overflowSuffix(v) {
    this.props.overflowSuffix = v;
    updateNodeStyles(this);
  }
  get maxLines() {
    return this.props.maxLines;
  }
  set maxLines(v) {
    this.props.maxLines = v;
    updateNodeStyles(this);
  }
  get contain() {
    return this.props.contain;
  }
  set contain(v) {
    this.props.contain = v;
    updateNodeStyles(this);
  }
  get verticalAlign() {
    return this.props.verticalAlign;
  }
  set verticalAlign(v) {
    this.props.verticalAlign = v;
    updateNodeStyles(this);
  }
  get textBaseline() {
    return this.props.textBaseline;
  }
  set textBaseline(v) {
    this.props.textBaseline = v;
    updateNodeStyles(this);
  }
  get textRendererOverride() {
    return this.props.textRendererOverride;
  }
  set textRendererOverride(v) {
    this.props.textRendererOverride = v;
    updateNodeStyles(this);
  }
  get scrollable() {
    return this.props.scrollable;
  }
  set scrollable(v) {
    this.props.scrollable = v;
    updateNodeStyles(this);
  }
  get scrollY() {
    return this.props.scrollY;
  }
  set scrollY(v) {
    this.props.scrollY = v;
    updateNodeStyles(this);
  }
  get offsetY() {
    return this.props.offsetY;
  }
  set offsetY(v) {
    this.props.offsetY = v;
    updateNodeStyles(this);
  }
  get wordBreak() {
    return this.props.wordBreak;
  }
  set wordBreak(v) {
    this.props.wordBreak = v;
    updateNodeStyles(this);
  }
  get debug() {
    return this.props.debug;
  }
  set debug(v) {
    this.props.debug = v;
    updateNodeStyles(this);
  }
}

function updateRootPosition(this: DOMRendererMain) {
  let { canvas, settings } = this;

  let rect = canvas.getBoundingClientRect();
  let top = document.documentElement.scrollTop + rect.top;
  let left = document.documentElement.scrollLeft + rect.left;

  let dpr = settings.deviceLogicalPixelRatio ?? 1;

  let height = Math.ceil(settings.appHeight ?? 1080 / dpr);
  let width = Math.ceil(settings.appWidth ?? 1920 / dpr);

  this.root.el.style.left = `${left}px`;
  this.root.el.style.top = `${top}px`;
  this.root.el.style.width = `${width}px`;
  this.root.el.style.height = `${height}px`;
  this.root.el.style.position = 'absolute';
  this.root.el.style.transformOrigin = '0 0 0';
  this.root.el.style.transform = `scale(${dpr}, ${dpr})`;
  this.root.el.style.overflow = 'hidden';
}

export class DOMRendererMain implements IRendererMain {
  root: DOMNode;
  canvas: HTMLCanvasElement;

  stage: IRendererStage;

  constructor(
    public settings: lng.RendererMainSettings,
    public target: string | HTMLElement,
  ) {
    let canvas = document.body.appendChild(document.createElement('canvas'));
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';

    this.canvas = canvas;

    this.stage = {
      root: null!,
      renderer: {
        mode: 'canvas',
      },
      fontManager: {
        addFontFace: () => {},
      },
      shManager: {
        registerShaderType() {},
      },
    };

    this.root = new DOMNode(
      this.stage,
      resolveTextNodeDefaults({
        width: settings.appWidth ?? 1920,
        height: settings.appHeight ?? 1080,
        fontFamily: Config.fontSettings.fontFamily,
        fontSize: Config.fontSettings.fontSize,
        lineHeight: Config.fontSettings.lineHeight,
        shader: defaultShader,
        zIndex: 65534,
      }),
    );
    this.stage.root = this.root;
    document.body.appendChild(this.root.el);

    if (Config.fontSettings.fontFamily) {
      this.root.el.style.fontFamily = Config.fontSettings.fontFamily;
    }
    if (Config.fontSettings.fontSize) {
      this.root.el.style.fontSize = Config.fontSettings.fontSize + 'px';
    }
    if (Config.fontSettings.lineHeight) {
      this.root.el.style.lineHeight = Config.fontSettings.lineHeight + 'px';
    }
    if (Config.fontSettings.fontWeight) {
      if (typeof Config.fontSettings.fontWeight === 'number') {
        this.root.el.style.fontWeight = Config.fontSettings.fontWeight + 'px';
      } else {
        this.root.el.style.fontWeight = Config.fontSettings.fontWeight;
      }
    }

    updateRootPosition.call(this);

    new MutationObserver(updateRootPosition.bind(this)).observe(this.canvas, {
      attributes: true,
    });
    new ResizeObserver(updateRootPosition.bind(this)).observe(this.canvas);
    window.addEventListener('resize', updateRootPosition.bind(this));
  }

  createNode(props: Partial<IRendererNodeProps>): IRendererNode {
    return new DOMNode(this.stage, resolveNodeDefaults(props));
  }

  createTextNode(props: Partial<IRendererTextNodeProps>): IRendererTextNode {
    return new DOMText(this.stage, resolveTextNodeDefaults(props));
  }

  createShader(
    shaderType: string,
    props?: IRendererShaderProps,
  ): IRendererShader {
    return { shaderType, props };
  }

  createTexture(
    textureType: keyof lng.TextureMap,
    props: IRendererTextureProps,
  ): IRendererTexture {
    let type = lng.TextureType.generic;
    switch (textureType) {
      case 'SubTexture':
        type = lng.TextureType.subTexture;
        break;
      case 'ImageTexture':
        type = lng.TextureType.image;
        break;
      case 'ColorTexture':
        type = lng.TextureType.color;
        break;
      case 'NoiseTexture':
        type = lng.TextureType.noise;
        break;
      case 'RenderTexture':
        type = lng.TextureType.renderToTexture;
        break;
    }
    return { type, props };
  }

  on(name: string, callback: (target: any, data: any) => void) {
    console.log('on', name, callback);
  }
}
