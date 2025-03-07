/*

Experimental DOM renderer

*/

import * as lng from '@lightningjs/renderer'
import { Config } from './config.js'

const colorToRgba = (c: number) =>
  `rgba(${(c >> 24) & 0xff},${(c >> 16) & 0xff},${(c >> 8) & 0xff},${(c & 0xff) / 255})`

/*
 Animations
*/
type AnimationTask = {
  node:       DOMNode
  propsStart: Record<string, number>
  propsEnd:   Record<string, number>
  timeStart:  number
  timeEnd:    number
  settings:   Required<lng.AnimationSettings>
  iteration:  number
  pausedTime: number | null
}

let animationTasks: AnimationTask[] = []
let animationFrameRequested = false

function requestAnimationUpdate() {
  if (!animationFrameRequested && animationTasks.length > 0) {
    animationFrameRequested = true
    requestAnimationFrame(updateAnimations)
  }
}

function updateAnimations(time: number) {
  animationFrameRequested = false
  
  /*
   tasks are iterated in insertion order
   so that the later task will override the earlier ones
  */
  for (let i = 0; i < animationTasks.length; i++) {
    let task = animationTasks[i]!
    if (task.pausedTime != null) continue
    
    let elapsed = time - task.timeStart
    
    // Still in delay period
    if (elapsed < task.settings.delay) {
      requestAnimationUpdate()
      continue
    }
    
    let activeTime = elapsed - task.settings.delay
    
    if (activeTime >= task.settings.duration) {
      // Start next iteration
      if (task.settings.loop || task.iteration < task.settings.repeat - 1) {
        task.iteration++
        task.timeStart = time - task.settings.delay
        if (task.settings.repeatDelay > 0) {
          task.timeStart += task.settings.repeatDelay
        }
        requestAnimationUpdate()
      }
      // Animation complete
      else {
        Object.assign(task.node.props, task.propsEnd)
        updateNodeStyles(task.node)
        animationTasks.splice(i, 1)
        i--
      }
      continue
    }
    
    
    /*
     Update props and styles
    */
    let t = applyEasing(activeTime / task.settings.duration, task.settings.easing)

    for (let prop in task.propsEnd) {
      let fn = prop.startsWith('color') ? interpolateColor : interpolate
      ;(task.node.props as any)[prop] = fn(task.propsStart[prop]!, task.propsEnd[prop]!, t)
    }
    
    updateNodeStyles(task.node)
  }

  requestAnimationUpdate()
}

function applyEasing(progress: number, easing: string): number {
  switch (easing) {
  case 'linear':
  default:            return progress
  case 'ease-in':     return progress * progress
  case 'ease-out':    return progress * (2 - progress)
  case 'ease-in-out': return progress < 0.5 
                              ? 2 * progress * progress 
                              : -1 + (4 - 2 * progress) * progress
  }
}

function interpolate(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

function interpolateColor(start: number, end: number, t: number): number {
  return (
    (interpolate((start >> 24) & 0xff, (end >> 24) & 0xff, t) << 24) |
    (interpolate((start >> 16) & 0xff, (end >> 16) & 0xff, t) << 16) |
    (interpolate((start >> 8) & 0xff, (end >> 8) & 0xff, t) << 8) |
    interpolate(start & 0xff, end & 0xff, t)
  )
}

class AnimationController implements lng.IAnimationController {

  state: lng.AnimationControllerState = 'paused'

  constructor(
    public task: AnimationTask,
  ) {}

  start() {
    if (this.task.pausedTime != null) {
      this.task.timeStart += performance.now() - this.task.pausedTime
      this.task.pausedTime = null
    } else {
      this.task.timeStart = performance.now()
    }
    requestAnimationUpdate()
    return this
  }
  pause() {
    this.task.pausedTime = performance.now()
    return this
  }
  stop() {
    let index = animationTasks.indexOf(this.task)
    if (index !== -1) {
      animationTasks.splice(index, 1)
    }
    return this
  }

  restore() {return this}
  waitUntilStopped() {return Promise.resolve()}
  on() {return this}
  once() {return this}
  off() {return this}
  emit() {return this}
}

function animate(
  this: DOMNode,
  props: Partial<lng.INodeAnimateProps<any>>,
  settings: Partial<lng.AnimationSettings>,
): lng.IAnimationController {

  let fullSettings: Required<lng.AnimationSettings> = {
    duration:    settings.duration ?? 300,
    delay:       settings.delay ?? 0,
    easing:      settings.easing ?? 'linear',
    loop:        settings.loop ?? false,
    repeat:      settings.repeat ?? 1,
    repeatDelay: settings.repeatDelay ?? 0,
    stopMethod:  false,
  }

  let now = performance.now()

  // Create the animation task
  let task: AnimationTask = {
    node:       this,
    propsStart: {},
    propsEnd:   {},
    timeStart:  now,
    timeEnd:    now + fullSettings.delay + fullSettings.duration,
    settings:   fullSettings,
    iteration:  0,
    pausedTime: null,
  }

  for (let [prop, value] of Object.entries(props)) {
    if (value != null && typeof value === 'number') {
      task.propsStart[prop] = (this.props as any)[prop]
      task.propsEnd[prop] = value
    }
  }

  animationTasks.push(task)

  return new AnimationController(task)
}

let elMap = new WeakMap<DOMNode, HTMLElement>()

let domRoot = document.body.appendChild(document.createElement('div'))
domRoot.id = 'dom_root'

function updateNodeParent(node: DOMNode | DOMText) {
  if (node.parent != null) {
    if (node.parent.id === 1) {
      domRoot.appendChild(node.el)
    } else {
      elMap.get(node.parent as DOMNode)!.appendChild(node.el)
    }
  } else {
    console.warn('no parent?')
  }
}

function getNodeStyles(node: Readonly<DOMNode | DOMText>): string {
  let style = "position: absolute;"

  if (node.alpha !== 1) style += `opacity: ${node.alpha};`

  let { x, y } = node

  if (node.mountX != null) {
    x -= (node.width ?? 0) * node.mountX
  }

  if (node.mountY != null) {
    y -= (node.height ?? 0) * node.mountY
  }

  if (x !== 0) style += `left: ${x}px;`

  if (y !== 0) style += `top: ${y}px;`

  if (node.width !== 0) style += `width: ${node.width}px;`

  if (node.height !== 0) style += `height: ${node.height}px;`

  if (node.zIndex !== 0) {
    style += `z-index: ${node.zIndex};`
  }

  if (node.clipping) {
    style += `overflow: hidden;`
  }

  let transform = ''

  if (node.rotation !== 0) transform += `rotate(${node.rotation}rad);`
  if (node.scale !== 1) transform += `scale(${node.scale});`
  else {
    if (node.scaleX !== 1) transform += `scaleX(${node.scaleX});`
    if (node.scaleY !== 1) transform += `scaleY(${node.scaleY});`
  }

  if (transform.length > 0) {
    style += `transform: ${transform}`
  }

  // <Text>
  if (node instanceof DOMText) {

    if (node.color != null && node.color !== 0) {
      style += `color: ${colorToRgba(node.color)};`
    }

    if (node.fontFamily) style += `font-family: ${node.fontFamily};`
    if (node.fontSize) style += `font-size: ${node.fontSize}px;`
    if (node.fontStyle !== 'normal') style += `font-style: ${node.fontStyle};`
    if (node.fontWeight !== 'normal') style += `font-weight: ${node.fontWeight};`
    if (node.fontStretch !== 'normal') style += `font-stretch: ${node.fontStretch};`
    if (node.lineHeight != null) style += `line-height: ${node.lineHeight}px;`
    if (node.letterSpacing) style += `letter-spacing: ${node.letterSpacing}px;`
    if (node.textAlign !== 'left') style += `text-align: ${node.textAlign};`
    // if (node.overflowSuffix) style += `overflow-suffix: ${node.overflowSuffix};`
    if (node.maxLines > 0) {
      // https://stackoverflow.com/a/13924997
      style += `display: -webkit-box;
        overflow: hidden;
        -webkit-line-clamp: ${node.maxLines};
        line-clamp: ${node.maxLines};
        -webkit-box-orient: vertical;`
    }
    if (node.contain !== 'none') {
      style += `overflow: hidden;` // not sure if there is a way to support it proparely
    }
    // if (node.verticalAlign) style += `vertical-align: ${node.verticalAlign};`
  }
  // <Node>
  else {

    let bgImg: string[] = []
    let bgPos: null | { x: number, y: number } = null

    if (node.colorBottom !== node.colorTop) {
      bgImg.push(`linear-gradient(${colorToRgba(node.colorTop)}, ${colorToRgba(node.colorBottom)})`)
    }
    if (node.colorLeft !== node.colorRight) {
      bgImg.push(`linear-gradient(to right, ${colorToRgba(node.colorLeft)}, ${colorToRgba(node.colorRight)})`)
    }

    if (node.texture != null && node.texture.type === lng.TextureType.subTexture) {
      bgPos = (node.texture as any).props
      bgImg.push(`url(${(node.texture as any).props.texture.props.src})`)
    } else if (node.src != null) {
      bgImg.push(`url(${node.src})`)
    }

    if (bgImg.length > 0) {
      style += `background-image: ${bgImg.join(',')}; background-blend-mode: multiply;`
      if (bgPos !== null) {
        style += `background-position: -${bgPos.x}px -${bgPos.y}px;`
      } else {
        style += 'background-size: 100% 100%;'
      }

      if (node.color !== 0xffffffff && node.color !== 0) {
        style += `background-color: ${colorToRgba(node.color)};`
        style += `mask-image: ${bgImg.join(',')};`
        if (bgPos !== null) {
          style += `mask-position: -${bgPos.x}px -${bgPos.y}px;`
        } else {
          style += `mask-size: 100% 100%;`
        }
      }

    } else if (node.color !== 0) {
      style += `background-color: ${colorToRgba(node.color)};`
    }

    if (node.shader != null) {
      let shader = node.shader.props
      if (shader != null) {
        // Border
        if (typeof shader['border-width'] === 'number' && shader['border-width'] > 0 &&
          typeof shader['border-color'] === 'number' && shader['border-color'] > 0
        ) {
          // css border impacts the element's box size when box-shadow doesn't
          style += `box-shadow: inset 0px 0px 0px ${shader['border-width']}px ${colorToRgba(shader['border-color'])};`
        }
        // Rounded
        if (typeof shader['radius'] === 'number' && shader['radius'] > 0) {
          style += `border-radius: ${shader['radius']}px;`
        }
      }
    }
  }

  return style
}

function updateNodeStyles(node: DOMNode | DOMText) {
  node.el.setAttribute('style', getNodeStyles(node))
}

function updateNodeData(node: DOMNode | DOMText) {
  for (let key in node.data) {
    let keyValue: unknown = node.data[key]
    if (keyValue === undefined) {
      node.el.removeAttribute('data-' + key)
    } else {
      node.el.setAttribute('data-' + key, String(keyValue))
    }
  }
}

function resolveNodeDefaults(props: Partial<lng.INodeProps<any>>): lng.INodeProps<any> {

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
    preventCleanup: props.preventCleanup ?? false,
    imageType: props.imageType,
    strictBounds: props.strictBounds ?? false,
  };
}

function resolveTextNodeDefaults(props: Partial<lng.ITextNodeProps>): lng.ITextNodeProps {
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
    debug: props.debug ?? {},
  }
}

type RendererInterfaceCoreRenderer = {
  mode: 'canvas' | 'webgl'
}
type RendererInterfaceFontManager = {
  addFontFace: (...a: any[]) => void
}
type RendererInterfaceStage = {
  root: lng.INode
  renderer: RendererInterfaceCoreRenderer
  fontManager: RendererInterfaceFontManager
}

type RendererInterfaceShader = {
  shaderType: string,
  props: RendererInterfaceShaderProps
  resolvedProps: RendererInterfaceShaderProps
  node: lng.INode | null
  attachNode(node: lng.INode): void
}
type RendererInterfaceShaderProps = {}
type RendererInterfaceTexture = {
  props: RendererInterfaceTextureProps
  type: lng.TextureType
  setRenderableOwner: () => void;
  on: () => void;
}
type RendererInterfaceTextureProps = {}

const defaultShader: RendererInterfaceShader = {}

let lastNodeId = 0

class DOMNode implements lng.INode {

  el = document.createElement('div')
  id = ++lastNodeId

  constructor(
    public stage: RendererInterfaceStage,
    public props: lng.INodeProps<any>,
  ) {

    // @ts-ignore
    this.el._node = this
    this.el.setAttribute('data-id', String(this.id))
    elMap.set(this, this.el)

    updateNodeParent(this)
    updateNodeStyles(this)
    updateNodeData(this)
  }

  destroy(): void {
    elMap.delete(this)
    this.el.parentNode!.removeChild(this.el)
  }

  get parent(): DOMNode | null { return this.props.parent }
  set parent(value: DOMNode | null) {
    this.props.parent = value
    updateNodeParent(this)
  }

  globalTransform = undefined
  children = undefined
  rttParent = undefined
  updateType = undefined
  childUpdateType = undefined
  scaleRotateTransform = undefined
  localTransform = undefined
  renderCoords = undefined
  renderBound = undefined
  strictBound = undefined
  preloadBound = undefined
  clippingRect = undefined
  isRenderable = undefined
  renderState = undefined
  worldAlpha = undefined
  premultipliedColorTl = undefined
  premultipliedColorTr = undefined
  premultipliedColorBl = undefined
  premultipliedColorBr = undefined
  calcZIndex = undefined
  hasRTTupdates = undefined
  parentHasRenderTexture = undefined

  animate = animate;

  get x(): number { return this.props.x }
  set x(value: number) {
    this.props.x = value
    updateNodeStyles(this)
  }
  get y(): number { return this.props.y }
  set y(value: number) {
    this.props.y = value
    updateNodeStyles(this)
  }
  get width(): number { return this.props.width }
  set width(value: number) {
    this.props.width = value
    updateNodeStyles(this)
  }
  get height(): number { return this.props.height }
  set height(value: number) {
    this.props.height = value
    updateNodeStyles(this)
  }
  get alpha(): number { return this.props.alpha }
  set alpha(value: number) {
    this.props.alpha = value
    updateNodeStyles(this)
  }
  get autosize(): boolean { return this.props.autosize }
  set autosize(value: boolean) {
    this.props.autosize = value
    updateNodeStyles(this)
  }
  get clipping(): boolean { return this.props.clipping }
  set clipping(value: boolean) {
    this.props.clipping = value
    updateNodeStyles(this)
  }
  get color(): number { return this.props.color }
  set color(value: number) {
    this.props.color = value
    updateNodeStyles(this)
  }
  get colorTop(): number { return this.props.colorTop }
  set colorTop(value: number) {
    this.props.colorTop = value
    updateNodeStyles(this)
  }
  get colorBottom(): number { return this.props.colorBottom }
  set colorBottom(value: number) {
    this.props.colorBottom = value
    updateNodeStyles(this)
  }
  get colorLeft(): number { return this.props.colorLeft }
  set colorLeft(value: number) {
    this.props.colorLeft = value
    updateNodeStyles(this)
  }
  get colorRight(): number { return this.props.colorRight }
  set colorRight(value: number) {
    this.props.colorRight = value
    updateNodeStyles(this)
  }
  get colorTl(): number { return this.props.colorTl }
  set colorTl(value: number) {
    this.props.colorTl = value
    updateNodeStyles(this)
  }
  get colorTr(): number { return this.props.colorTr }
  set colorTr(value: number) {
    this.props.colorTr = value
    updateNodeStyles(this)
  }
  get colorBr(): number { return this.props.colorBr }
  set colorBr(value: number) {
    this.props.colorBr = value
    updateNodeStyles(this)
  }
  get colorBl(): number { return this.props.colorBl }
  set colorBl(value: number) {
    this.props.colorBl = value
    updateNodeStyles(this)
  }
  get zIndex(): number { return this.props.zIndex }
  set zIndex(value: number) {
    this.props.zIndex = value
    updateNodeStyles(this)
  }
  get texture(): lng.Texture | null { return this.props.texture }
  set texture(value: lng.Texture | null) {
    this.props.texture = value
    updateNodeStyles(this)
  }
  get preventCleanup(): boolean { return this.props.preventCleanup }
  set preventCleanup(value: boolean) {
    this.props.preventCleanup = value
    updateNodeStyles(this)
  }
  get textureOptions() { return this.props.textureOptions }
  set textureOptions(value: any) {
    this.props.textureOptions = value
    updateNodeStyles(this)
  }
  get src(): string | null { return this.props.src }
  set src(value: string | null) {
    this.props.src = value
    updateNodeStyles(this)
  }
  get zIndexLocked(): number { return this.props.zIndexLocked }
  set zIndexLocked(value: number) {
    this.props.zIndexLocked = value
    updateNodeStyles(this)
  }
  get scale(): number { return this.props.scale ?? 1 }
  set scale(value: number) {
    this.props.scale = value
    updateNodeStyles(this)
  }
  get scaleX(): number { return this.props.scaleX }
  set scaleX(value: number) {
    this.props.scaleX = value
    updateNodeStyles(this)
  }
  get scaleY(): number { return this.props.scaleY }
  set scaleY(value: number) {
    this.props.scaleY = value
    updateNodeStyles(this)
  }
  get mount(): number { return this.props.mount }
  set mount(value: number) {
    this.props.mount = value
    updateNodeStyles(this)
  }
  get mountX(): number { return this.props.mountX }
  set mountX(value: number) {
    this.props.mountX = value
    updateNodeStyles(this)
  }
  get mountY(): number { return this.props.mountY }
  set mountY(value: number) {
    this.props.mountY = value
    updateNodeStyles(this)
  }
  get pivot(): number { return this.props.pivot }
  set pivot(value: number) {
    this.props.pivot = value
    updateNodeStyles(this)
  }
  get pivotX(): number { return this.props.pivotX }
  set pivotX(value: number) {
    this.props.pivotX = value
    updateNodeStyles(this)
  }
  get pivotY(): number { return this.props.pivotY }
  set pivotY(value: number) {
    this.props.pivotY = value
    updateNodeStyles(this)
  }
  get rotation(): number { return this.props.rotation }
  set rotation(value: number) {
    this.props.rotation = value
    updateNodeStyles(this)
  }
  get rtt(): boolean { return this.props.rtt }
  set rtt(value: boolean) {
    this.props.rtt = value
    updateNodeStyles(this)
  }
  get shader() { return this.props.shader }
  set shader(v: lng.CoreShaderNode) {
    this.props.shader = v
    updateNodeStyles(this)
  }
  get strictBounds(): boolean { return this.props.strictBounds }
  set strictBounds(value: boolean) {
    this.props.strictBounds = value
    updateNodeStyles(this)
  }

  get data() { return this.props.data }
  set data(value: any) {
    this.props.data = value
    updateNodeData(this)
  }

  get imageType(): 'regular' | 'compressed' | 'svg' | null { return this.props.imageType }
  set imageType(value: 'regular' | 'compressed' | 'svg' | null) { this.props.imageType = value }
  get srcWidth(): number | undefined { return this.props.srcWidth }
  set srcWidth(value: number | undefined) { this.props.srcWidth = value }
  get srcHeight(): number | undefined { return this.props.srcHeight }
  set srcHeight(value: number | undefined) { this.props.srcHeight = value }
  get srcX(): number | undefined { return this.props.srcX }
  set srcX(value: number | undefined) { this.props.srcX = value }
  get srcY(): number | undefined { return this.props.srcY }
  set srcY(value: number | undefined) { this.props.srcY = value }

  get boundsMargin(): number | [number, number, number, number] | null {
    return this.props.boundsMargin
  }
  set boundsMargin(value: number | [number, number, number, number] | null) {
    this.props.boundsMargin = value
  }

  get absX(): number {
    return (
      this.x +
      -this.width * this.mountX +
      (this.parent?.absX || this.parent?.globalTransform?.tx || 0)
    )
  }
  get absY(): number {
    return (
      this.y +
      -this.height * this.mountY +
      (this.parent?.absY ?? 0)
    )
  }

  get framebufferDimensions(): lng.Dimensions { return this.node.framebufferDimensions }
  get parentRenderTexture() { return this.node.parentRenderTexture }

  loadTexture(): void { }
  unloadTexture(): void { }
  autosizeNode(dimensions: lng.Dimensions): void { }
  sortChildren(): void { }
  updateScaleRotateTransform(): void { }
  updateLocalTransform(): void { }
  checkRenderBounds(): lng.CoreNodeRenderState { }
  updateBoundingRect(): void { }
  createRenderBounds(): void { }
  updateRenderState(renderState: lng.CoreNodeRenderState): void { }
  updateIsRenderable(): void { }
  checkBasicRenderability(): boolean { }
  setRenderable(isRenderable: boolean): void { }
  updateTextureOwnership(isRenderable: boolean): void { }
  isOutOfBounds(): boolean { }
  hasDimensions(): boolean { }
  hasColorProperties(): boolean { }
  hasShader(): boolean { }
  calculateRenderCoords(): void { }
  calculateZIndex(): void { }
  flush(): void { }
  on(event: string, listener: (target: any, data: any) => void): void { }
  off(event: string, listener?: (target: any, data: any) => void): void { }
  once(event: string, listener: (target: any, data: any) => void): void { }
  emit(event: string, data?: any): void { }
  removeAllListeners(): void { }
  setUpdateType(type: any) { }
  update(delta: number, parentClippingRect: any) { }
  calculateClippingRect(parentClippingRect: any) { }
  renderQuads(renderer: any) { }
}

class DOMText extends DOMNode {

  constructor(
    stage: RendererInterfaceStage,
    public override props: lng.ITextNodeProps
  ) {
    super(stage, props)
    this.el.innerText = props.text
  }

  get text(): string { return this.props.text }
  set text(value: string) {
    this.props.text = value
    this.el.innerText = value
  }
  get fontFamily(): string { return this.props.fontFamily }
  set fontFamily(value: string) {
    this.props.fontFamily = value
    updateNodeStyles(this)
  }
  get fontSize(): number { return this.props.fontSize }
  set fontSize(value: number) {
    this.props.fontSize = value
    updateNodeStyles(this)
  }
  get fontStyle(): lng.ITextNode['fontStyle'] { return this.props.fontStyle }
  set fontStyle(value: lng.ITextNode['fontStyle']) {
    this.props.fontStyle = value
    updateNodeStyles(this)
  }
  get fontWeight(): lng.ITextNode['fontWeight'] { return this.props.fontWeight }
  set fontWeight(value: lng.ITextNode['fontWeight']) {
    this.props.fontWeight = value
    updateNodeStyles(this)
  }
  get fontStretch(): lng.ITextNode['fontStretch'] { return this.props.fontStretch }
  set fontStretch(value: lng.ITextNode['fontStretch']) {
    this.props.fontStretch = value
    updateNodeStyles(this)
  }
  get lineHeight(): number | undefined { return this.props.lineHeight }
  set lineHeight(value: number | undefined) {
    this.props.lineHeight = value
    updateNodeStyles(this)
  }
  get letterSpacing(): number { return this.props.letterSpacing }
  set letterSpacing(value: number) {
    this.props.letterSpacing = value
    updateNodeStyles(this)
  }
  get textAlign(): lng.ITextNode['textAlign'] { return this.props.textAlign }
  set textAlign(value: lng.ITextNode['textAlign']) {
    this.props.textAlign = value
    updateNodeStyles(this)
  }
  get overflowSuffix(): string { return this.props.overflowSuffix }
  set overflowSuffix(value: string) {
    this.props.overflowSuffix = value
    updateNodeStyles(this)
  }
  get maxLines(): number { return this.props.maxLines }
  set maxLines(value: number) {
    this.props.maxLines = value
    updateNodeStyles(this)
  }
  get contain(): lng.ITextNode['contain'] { return this.props.contain }
  set contain(value: lng.ITextNode['contain']) {
    this.props.contain = value
    updateNodeStyles(this)
  }
  get verticalAlign(): lng.ITextNode['verticalAlign'] { return this.props.verticalAlign }
  set verticalAlign(value: lng.ITextNode['verticalAlign']) {
    this.props.verticalAlign = value
    updateNodeStyles(this)
  }
  get textBaseline(): lng.ITextNode['textBaseline'] { return this.props.textBaseline }
  set textBaseline(value: lng.ITextNode['textBaseline']) {
    this.props.textBaseline = value
    updateNodeStyles(this)
  }
  get textRendererOverride(): lng.ITextNode['textRendererOverride'] { return this.props.textRendererOverride }
  set textRendererOverride(value: lng.ITextNode['textRendererOverride']) {
    this.props.textRendererOverride = value
    updateNodeStyles(this)
  }
  get scrollable(): boolean { return this.props.scrollable }
  set scrollable(value: boolean) {
    this.props.scrollable = value
    updateNodeStyles(this)
  }
  get scrollY(): number { return this.props.scrollY }
  set scrollY(value: number) {
    this.props.scrollY = value
    updateNodeStyles(this)
  }
  get offsetY(): number { return this.props.offsetY }
  set offsetY(value: number) {
    this.props.offsetY = value
    updateNodeStyles(this)
  }
  get debug(): lng.ITextNode['debug'] { return this.props.debug }
  set debug(value: lng.ITextNode['debug']) {
    this.props.debug = value
    updateNodeStyles(this)
  }
}

function updateRootPosition(this: DOMRendererMain) {
  let { canvas, settings } = this

  let rect = canvas.getBoundingClientRect()
  let top = document.documentElement.scrollTop + rect.top
  let left = document.documentElement.scrollLeft + rect.left

  let height = Math.ceil(settings.appHeight ?? 1080 / (settings.deviceLogicalPixelRatio ?? 1))
  let width = Math.ceil(settings.appWidth ?? 1920 / (settings.deviceLogicalPixelRatio ?? 1))

  let scaleX = settings.deviceLogicalPixelRatio ?? 1
  let scaleY = settings.deviceLogicalPixelRatio ?? 1

  domRoot.style.left = `${left}px`
  domRoot.style.top = `${top}px`
  domRoot.style.width = `${width}px`
  domRoot.style.height = `${height}px`
  domRoot.style.position = 'absolute'
  domRoot.style.transformOrigin = '0 0 0'
  domRoot.style.transform = `scale(${scaleX}, ${scaleY})`
  domRoot.style.overflow = 'hidden'
  domRoot.style.zIndex = '65534'
}

export class DOMRendererMain implements lng.RendererMain {

  root: lng.INode
  canvas: HTMLCanvasElement

  stage: RendererInterfaceStage

  constructor(
    public settings: lng.RendererMainSettings,
    public target: string | HTMLElement
  ) {
    // super(settings, target)

    let canvas = document.body.appendChild(document.createElement('canvas'))
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'

    this.canvas = canvas

    this.stage = {
      root: null!,
      renderer: {
        mode: 'canvas',
      },
      fontManager: {
        addFontFace: () => { }
      }
    }

    this.root = new DOMNode(this.stage, {
      x: 0,
      y: 0,
      width: settings.appWidth ?? 1920,
      height: settings.appWidth ?? 1080,
      alpha: 1,
      autosize: false,
      boundsMargin: null,
      clipping: false,
      color: 0x00000000,
      colorTop: 0x00000000,
      colorBottom: 0x00000000,
      colorLeft: 0x00000000,
      colorRight: 0x00000000,
      colorTl: 0x00000000,
      colorTr: 0x00000000,
      colorBl: 0x00000000,
      colorBr: 0x00000000,
      zIndex: 0,
      zIndexLocked: 0,
      scaleX: 1,
      scaleY: 1,
      mountX: 0,
      mountY: 0,
      mount: 0,
      pivot: 0.5,
      pivotX: 0.5,
      pivotY: 0.5,
      rotation: 0,
      parent: null,
      texture: null,
      textureOptions: {},
      shader: defaultShader,
      rtt: false,
      src: null,
      scale: 1,
      preventCleanup: false,
      strictBounds: false,
    })
    this.stage.root = this.root


    if (Config.fontSettings.fontFamily != null) {
      domRoot.style.setProperty('font-family', Config.fontSettings.fontFamily)
    }
    if (Config.fontSettings.fontSize != null) {
      domRoot.style.setProperty('font-size', Config.fontSettings.fontSize + 'px')
    }

    domRoot.style.setProperty('line-height',
      Config.fontSettings.lineHeight
        ? Config.fontSettings.lineHeight + 'px'
        : '1' // 1 = same as font size
    )

    updateRootPosition.call(this)

    new MutationObserver(updateRootPosition.bind(this)).observe(this.canvas, { attributes: true })
    new ResizeObserver(updateRootPosition.bind(this)).observe(this.canvas)
    window.addEventListener('resize', updateRootPosition.bind(this))
  }

  createNode<ShNode extends lng.CoreShaderNode<any>>(
    props: Partial<lng.INodeProps<ShNode>>,
  ): lng.INode<ShNode> {
    return new DOMNode(this.stage, resolveNodeDefaults(props))
  }

  createTextNode(props: Partial<lng.ITextNodeProps>): lng.ITextNode {
    return new DOMText(this.stage, resolveTextNodeDefaults(props))
  }

  createShader(shType: string, props?: RendererInterfaceShaderProps): RendererInterfaceShader {
    return {
      shaderType: shType,
      props: props,
      resolvedProps: props,
      node: null as lng.INode | null,
      attachNode(node: lng.INode) {
        this.node = node
      }
    }
  }

  createTexture(textureType: keyof lng.TextureMap, props: RendererInterfaceTextureProps): RendererInterfaceTexture {
    let type = lng.TextureType.generic
    switch (textureType) {
      case 'SubTexture':    type = lng.TextureType.subTexture      ;break
      case 'ImageTexture':  type = lng.TextureType.image           ;break
      case 'ColorTexture':  type = lng.TextureType.color           ;break
      case 'NoiseTexture':  type = lng.TextureType.noise           ;break
      case 'RenderTexture': type = lng.TextureType.renderToTexture ;break
    }
    return {
      type: type,
      props: props,
      setRenderableOwner: () => { },
      on: () => { }
    }
  }

  on(name: string, callback: (target: any, data: any) => void) {
    console.log('on', name, callback)
  }
}
