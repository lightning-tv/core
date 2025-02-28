/*

Experimental DOM renderer

*/

import * as lng from '@lightningjs/renderer'
import {assertTruthy, EventEmitter} from '@lightningjs/renderer/utils'
import {Config} from './config.js'

// These are not exported from @lightningjs/renderer
import {
  CoreNode,
} from "@lightningjs/renderer/src/core/CoreNode.js"
import {
  CoreShaderManager,
} from "@lightningjs/renderer/src/core/CoreShaderManager.js"
import {
  IParsedColor,
} from "@lightningjs/renderer/src/core/renderers/canvas/internal/ColorUtils.js"
import {
  UnsupportedShader,
} from "@lightningjs/renderer/src/core/renderers/canvas/shaders/UnsupportedShader.js"
import {
  CoreContextTexture,
} from "@lightningjs/renderer/src/core/renderers/CoreContextTexture.js"
import {
  CoreRenderer, CoreRendererOptions, QuadOptions,
} from "@lightningjs/renderer/src/core/renderers/CoreRenderer.js"
import {
  CoreTextNode,
} from '@lightningjs/renderer/src/core/CoreTextNode.js'
import {
  TrProps, TextRendererState, TextRenderer, TrPropSetters, TrFontProps,
} from '@lightningjs/renderer/src/core/text-rendering/renderers/TextRenderer.js'


let elMap = new WeakMap<DOMNode, HTMLElement>()

let domRoot = document.body.appendChild(document.createElement('div'))
domRoot.id = 'dom_root'

const colorToRgba = (c: number) =>
  `rgba(${(c>>24) & 0xff},${(c>>16) & 0xff},${(c>>8) & 0xff},${(c & 0xff) / 255})`

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

  let {x, y} = node

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
    let bgPos: null | {x: number, y: number} = null

    if (node.colorBottom !== node.colorTop) {
      bgImg.push(`linear-gradient(${colorToRgba(node.colorTop)}, ${colorToRgba(node.colorBottom)})`)
    }
    if (node.colorLeft !== node.colorRight) {
      bgImg.push(`linear-gradient(to right, ${colorToRgba(node.colorLeft)}, ${colorToRgba(node.colorRight)})`)
    }

    if (node.texture != null) {
      if (node.texture.type === lng.TextureType.subTexture) {
        bgPos = (node.texture as any).props
        bgImg.push(`url(${(node.texture as any).props.texture.props.src})`)
      } else {
        bgImg.push(`url(${(node.texture as any).props.src})`)
      }
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

    if (Array.isArray(node.shader.props.effects)) {
      for (let effect of node.shader.props.effects) {
        switch (effect.name) {
        case 'border':{
          let {width, color} = effect.props as {width: number, color: number}
          // css border impacts the element's box size when box-shadow doesn't
          style += `box-shadow: inset 0px 0px 0px ${width}px ${colorToRgba(color)};`
          break
        }
        case 'radius': {
          let {radius} = effect.props as {radius: number}
          style += `border-radius: ${radius}px;`
          break
        }
        default:
          console.warn('unhandled shader', node, effect)
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
      node.el.removeAttribute('data-'+key)
    } else {
      node.el.setAttribute('data-'+key, String(keyValue))
    }
  }
}

class DOMNode implements lng.INode {

  el = document.createElement('div')

  constructor (
    public node: lng.INode,
  ) {
    // @ts-ignore
    this.el._node = this
    this.el.setAttribute('data-id', String(node.id))
    elMap.set(this, this.el)

    updateNodeParent(this)
    updateNodeStyles(this)
    updateNodeData(this)
  }

  destroy(): void {
    elMap.delete(this)
    this.el.parentNode!.removeChild(this.el)
    this.node.destroy()
  }

  get id(): number {return this.node.id}
  get props() {return this.node.props}
  get children() {return this.node.children}
  get parent(){return this.node.parent}
  get rttParent() {return this.node.rttParent}
  get updateType() {return this.node.updateType}
  get childUpdateType() {return this.node.childUpdateType}
  get globalTransform() {return this.node.globalTransform}
  get scaleRotateTransform() {return this.node.scaleRotateTransform}
  get localTransform() {return this.node.localTransform}
  get renderCoords() {return this.node.renderCoords}
  get renderBound() {return this.node.renderBound}
  get strictBound() {return this.node.strictBound}
  get preloadBound() {return this.node.preloadBound}
  get clippingRect() {return this.node.clippingRect}
  get isRenderable() {return this.node.isRenderable}
  get renderState() {return this.node.renderState}
  get worldAlpha() {return this.node.worldAlpha}
  get premultipliedColorTl() {return this.node.premultipliedColorTl}
  get premultipliedColorTr() {return this.node.premultipliedColorTr}
  get premultipliedColorBl() {return this.node.premultipliedColorBl}
  get premultipliedColorBr() {return this.node.premultipliedColorBr}
  get calcZIndex() {return this.node.calcZIndex}
  get hasRTTupdates() {return this.node.hasRTTupdates}
  get parentHasRenderTexture() {return this.node.parentHasRenderTexture}

  animate(
    props: Partial<lng.INodeAnimateProps>,
    settings: Partial<lng.AnimationSettings>,
): lng.IAnimationController {

    let keyframes: Keyframe[] = []
    for (let prop in props) {
      switch (prop) {
      case 'scale':
        keyframes.push({transform: `scale(${props.scale})`})
        break
      case 'alpha':
        keyframes.push({opacity: props.alpha})
        break
      case 'x':
        keyframes.push({left: props.x+'px'})
        break
      case 'y':
        keyframes.push({top: props.y+'px'})
        break
      case 'width':
        keyframes.push({width: props.width+'px'})
        break
      case 'height':
        keyframes.push({height: props.height+'px'})
        break
      case 'color':
        if (this instanceof DOMText) {
          keyframes.push({color: colorToRgba(props.color!)})
        } else {
          keyframes.push({backgroundColor: colorToRgba(props.color!)})
        }
        break
      default:
        // TODO handle all animateable props
        console.warn('unhandled animate prop', prop)
      }
    }

    // TODO: handle all animation settings

    this.el.animate(keyframes, {
      duration:   settings.duration,
      easing:     settings.easing,
      delay:      settings.delay,
      iterations: settings.loop ? Infinity : settings.repeat,
      fill:       'forwards',
    })

    return this.node.animate(props, settings)
  }

  get x(): number {return this.node.x}
  set x(value: number) {
    this.node.x = value
    updateNodeStyles(this)
  }
  get y(): number {return this.node.y}
  set y(value: number) {
    this.node.y = value
    updateNodeStyles(this)
  }
  get width(): number {return this.node.width}
  set width(value: number) {
    this.node.width = value
    updateNodeStyles(this)
  }
  get height(): number {return this.node.height}
  set height(value: number) {
    this.node.height = value
    updateNodeStyles(this)
  }
  get alpha(): number {return this.node.alpha}
  set alpha(value: number) {
    this.node.alpha = value
    updateNodeStyles(this)
  }
  get autosize(): boolean {return this.node.autosize}
  set autosize(value: boolean) {
    this.node.autosize = value
    updateNodeStyles(this)
  }
  get clipping(): boolean {return this.node.clipping}
  set clipping(value: boolean) {
    this.node.clipping = value
    updateNodeStyles(this)
  }
  get color(): number {return this.node.color}
  set color(value: number) {
    this.node.color = value
    updateNodeStyles(this)
  }
  get colorTop(): number {return this.node.colorTop}
  set colorTop(value: number) {
    this.node.colorTop = value
    updateNodeStyles(this)
  }
  get colorBottom(): number {return this.node.colorBottom}
  set colorBottom(value: number) {
    this.node.colorBottom = value
    updateNodeStyles(this)
  }
  get colorLeft(): number {return this.node.colorLeft}
  set colorLeft(value: number) {
    this.node.colorLeft = value
    updateNodeStyles(this)
  }
  get colorRight(): number {return this.node.colorRight}
  set colorRight(value: number) {
    this.node.colorRight = value
    updateNodeStyles(this)
  }
  get colorTl(): number {return this.node.colorTl}
  set colorTl(value: number) {
    this.node.colorTl = value
    updateNodeStyles(this)
  }
  get colorTr(): number {return this.node.colorTr}
  set colorTr(value: number) {
    this.node.colorTr = value
    updateNodeStyles(this)
  }
  get colorBr(): number {return this.node.colorBr}
  set colorBr(value: number) {
    this.node.colorBr = value
    updateNodeStyles(this)
  }
  get colorBl(): number {return this.node.colorBl}
  set colorBl(value: number) {
    this.node.colorBl = value
    updateNodeStyles(this)
  }
  get zIndex(): number {return this.node.zIndex}
  set zIndex(value: number) {
    this.node.zIndex = value
    updateNodeStyles(this)
  }
  get texture(): lng.Texture | null {return this.node.texture}
  set texture(value: lng.Texture | null) {
    this.node.texture = value
    updateNodeStyles(this)
  }
  get preventCleanup(): boolean {return this.node.preventCleanup}
  set preventCleanup(value: boolean) {
    this.node.preventCleanup = value
    updateNodeStyles(this)
  }
  set textureOptions(value: any) {
    this.node.textureOptions = value
    updateNodeStyles(this)
  }
  get textureOptions() {return this.node.textureOptions}
  get src(): string | null {return this.node.src}
  set src(value: string | null) {
    this.node.src = value
    updateNodeStyles(this)
  }
  get zIndexLocked(): number {return this.node.zIndexLocked}
  set zIndexLocked(value: number) {
    this.node.zIndexLocked = value
    updateNodeStyles(this)
  }
  get scale(): number {return this.node.scale}
  set scale(value: number) {
    this.node.scale = value
    updateNodeStyles(this)
  }
  get scaleX(): number {return this.node.scaleX}
  set scaleX(value: number) {
    this.node.scaleX = value
    updateNodeStyles(this)
  }
  get scaleY(): number {return this.node.scaleY}
  set scaleY(value: number) {
    this.node.scaleY = value
    updateNodeStyles(this)
  }
  get mount(): number {return this.node.mount}
  set mount(value: number) {
    this.node.mount = value
    updateNodeStyles(this)
  }
  get mountX(): number {return this.node.mountX}
  set mountX(value: number) {
    this.node.mountX = value
    updateNodeStyles(this)
  }
  get mountY(): number {return this.node.mountY}
  set mountY(value: number) {
    this.node.mountY = value
    updateNodeStyles(this)
  }
  get pivot(): number {return this.node.pivot}
  set pivot(value: number) {
    this.node.pivot = value
    updateNodeStyles(this)
  }
  get pivotX(): number {return this.node.pivotX}
  set pivotX(value: number) {
    this.node.pivotX = value
    updateNodeStyles(this)
  }
  get pivotY(): number {return this.node.pivotY}
  set pivotY(value: number) {
    this.node.pivotY = value
    updateNodeStyles(this)
  }
  get rotation(): number {return this.node.rotation}
  set rotation(value: number) {
    this.node.rotation = value
    updateNodeStyles(this)
  }
  get rtt(): boolean {return this.node.rtt}
  set rtt(value: boolean) {
    this.node.rtt = value
    updateNodeStyles(this)
  }
  get shader(){return this.node.shader}
  set shader(v: lng.BaseShaderController){
    this.node.shader = v
    updateNodeStyles(this)
  }

  get data() {return this.node.data}
  set data(value: any) {
    this.node.data = value
    updateNodeData(this)
  }

  set imageType(value: 'regular' | 'compressed' | 'svg' | null) {this.node.imageType = value}
  get imageType(): 'regular' | 'compressed' | 'svg' | null {return this.node.imageType}
  get srcWidth(): number | undefined {return this.node.srcWidth}
  set srcWidth(value: number | undefined) {this.node.srcWidth = value}
  get srcHeight(): number | undefined {return this.node.srcHeight}
  set srcHeight(value: number | undefined) {this.node.srcHeight = value}
  get srcX(): number | undefined {return this.node.srcX}
  set srcX(value: number | undefined) {this.node.srcX = value}
  get srcY(): number | undefined {return this.node.srcY}
  set srcY(value: number | undefined) {this.node.srcY = value}
  get strictBounds(): boolean {return this.node.strictBounds}
  set strictBounds(value: boolean) {
    this.node.strictBounds = value
    updateNodeStyles(this)
  }
  loadTexture(): void {return this.node.loadTexture()}
  unloadTexture(): void {return this.node.unloadTexture()}
  autosizeNode(dimensions: lng.Dimensions): void {return this.node.autosizeNode(dimensions)}
  sortChildren(): void {return this.node.sortChildren()}
  updateScaleRotateTransform(): void {return this.node.updateScaleRotateTransform()}
  updateLocalTransform(): void {return this.node.updateLocalTransform()}
  checkRenderBounds(): lng.CoreNodeRenderState {return this.node.checkRenderBounds()}
  updateBoundingRect(): void {return this.node.updateBoundingRect()}
  createRenderBounds(): void {return this.node.createRenderBounds()}
  updateRenderState(renderState: lng.CoreNodeRenderState): void {return this.node.updateRenderState(renderState)}
  updateIsRenderable(): void {return this.node.updateIsRenderable()}
  checkBasicRenderability(): boolean {return this.node.checkBasicRenderability()}
  setRenderable(isRenderable: boolean): void {return this.node.setRenderable(isRenderable)}
  updateTextureOwnership(isRenderable: boolean): void {return this.node.updateTextureOwnership(isRenderable)}
  isOutOfBounds(): boolean {return this.node.isOutOfBounds()}
  hasDimensions(): boolean {return this.node.hasDimensions()}
  hasColorProperties(): boolean {return this.node.hasColorProperties()}
  hasShader(): boolean {return this.node.hasShader()}
  calculateRenderCoords(): void {return this.node.calculateRenderCoords()}
  calculateZIndex(): void {return this.node.calculateZIndex()}
  get absX(): number {return this.node.absX}
  get absY(): number {return this.node.absY}
  get framebufferDimensions(): lng.Dimensions {return this.node.framebufferDimensions}
  get parentRenderTexture() {return this.node.parentRenderTexture}
  flush(): void {return this.node.flush()}
  on(event: string, listener: (target: any, data: any) => void): void {return this.node.on(event, listener)}
  off(event: string, listener?: (target: any, data: any) => void): void {return this.node.off(event, listener)}
  once(event: string, listener: (target: any, data: any) => void): void {return this.node.once(event, listener)}
  emit(event: string, data?: any): void {return this.node.emit(event, data)}
  removeAllListeners(): void {return this.node.removeAllListeners()}
  get stage() {return this.node.stage}
  setUpdateType(type: any) {this.node.setUpdateType(type)}
  update(delta: number, parentClippingRect: any) {this.node.update(delta, parentClippingRect)}
  calculateClippingRect(parentClippingRect: any) {this.node.calculateClippingRect(parentClippingRect)}
  renderQuads(renderer: any) {this.node.renderQuads(renderer)}
}

class DOMText extends DOMNode {

  constructor (
    public override node: lng.ITextNode,
  ) {
    super(node)
    this.el.innerText = node.text
  }

  get text(): string {return this.node.text}
  set text(value: string) {
    this.node.text = value
    this.el.innerText = value
  }
  get fontFamily(): string {return this.node.fontFamily}
  set fontFamily(value: string) {
    this.node.fontFamily = value
    updateNodeStyles(this)
  }
  get fontSize(): number {return this.node.fontSize}
  set fontSize(value: number) {
    this.node.fontSize = value
    updateNodeStyles(this)
  }
  get fontStyle(): lng.ITextNode['fontStyle'] {return this.node.fontStyle}
  set fontStyle(value: lng.ITextNode['fontStyle']) {
    this.node.fontStyle = value
    updateNodeStyles(this)
  }
  get fontWeight(): lng.ITextNode['fontWeight'] {return this.node.fontWeight}
  set fontWeight(value: lng.ITextNode['fontWeight']) {
    this.node.fontWeight = value
    updateNodeStyles(this)
  }
  get fontStretch(): lng.ITextNode['fontStretch'] {return this.node.fontStretch}
  set fontStretch(value: lng.ITextNode['fontStretch']) {
    this.node.fontStretch = value
    updateNodeStyles(this)
  }
  get lineHeight(): number | undefined {return this.node.lineHeight}
  set lineHeight(value: number | undefined) {
    this.node.lineHeight = value
    updateNodeStyles(this)
  }
  get letterSpacing(): number {return this.node.letterSpacing}
  set letterSpacing(value: number) {
    this.node.letterSpacing = value
    updateNodeStyles(this)
  }
  get textAlign(): lng.ITextNode['textAlign'] {return this.node.textAlign}
  set textAlign(value: lng.ITextNode['textAlign']) {
    this.node.textAlign = value
    updateNodeStyles(this)
  }
  get overflowSuffix(): string {return this.node.overflowSuffix}
  set overflowSuffix(value: string) {
    this.node.overflowSuffix = value
    updateNodeStyles(this)
  }
  get maxLines(): number {return this.node.maxLines}
  set maxLines(value: number) {
    this.node.maxLines = value
    updateNodeStyles(this)
  }
  get contain(): lng.ITextNode['contain'] {return this.node.contain}
  set contain(value: lng.ITextNode['contain']) {
    this.node.contain = value
    updateNodeStyles(this)
  }
  get verticalAlign(): lng.ITextNode['verticalAlign'] {return this.node.verticalAlign}
  set verticalAlign(value: lng.ITextNode['verticalAlign']) {
    this.node.verticalAlign = value
    updateNodeStyles(this)
  }
  get textBaseline(): lng.ITextNode['textBaseline'] {return this.node.textBaseline}
  set textBaseline(value: lng.ITextNode['textBaseline']) {
    this.node.textBaseline = value
    updateNodeStyles(this)
  }
  get textRendererOverride(): lng.ITextNode['textRendererOverride'] {return this.node.textRendererOverride}
  set textRendererOverride(value: lng.ITextNode['textRendererOverride']) {
    this.node.textRendererOverride = value
    updateNodeStyles(this)
  }
  get scrollable(): boolean {return this.node.scrollable}
  set scrollable(value: boolean) {
    this.node.scrollable = value
    updateNodeStyles(this)
  }
  get scrollY(): number {return this.node.scrollY}
  set scrollY(value: number) {
    this.node.scrollY = value
    updateNodeStyles(this)
  }
  get offsetY(): number {return this.node.offsetY}
  set offsetY(value: number) {
    this.node.offsetY = value
    updateNodeStyles(this)
  }
  get debug(): lng.ITextNode['debug'] {return this.node.debug}
  set debug(value: lng.ITextNode['debug']) {
    this.node.debug = value
    updateNodeStyles(this)
  }
}

function updateRootPosition(this: DOMRendererMain) {
  let {canvas, settings} = this

  let rect = canvas.getBoundingClientRect()
  let top = document.documentElement.scrollTop + rect.top
  let left = document.documentElement.scrollLeft + rect.left

  let height = Math.ceil(settings.appHeight ?? 1080 / (settings.deviceLogicalPixelRatio ?? 1))
  let width = Math.ceil(settings.appWidth ?? 1920 / (settings.deviceLogicalPixelRatio ?? 1))

  let scaleX = settings.deviceLogicalPixelRatio ?? 1
  let scaleY = settings.deviceLogicalPixelRatio ?? 1

  domRoot.style.left            = `${left}px`
  domRoot.style.top             = `${top}px`
  domRoot.style.width           = `${width}px`
  domRoot.style.height          = `${height}px`
  domRoot.style.position        = 'absolute'
  domRoot.style.transformOrigin = '0 0 0'
  domRoot.style.transform       = `scale(${scaleX}, ${scaleY})`
  domRoot.style.overflow        = 'hidden'
  domRoot.style.zIndex          = '65534'
}

export class DOMRendererMain extends lng.RendererMain {

  constructor(settings: lng.RendererMainSettings, target: string | HTMLElement) {
    super(settings, target)

    if (Config.fontSettings.fontFamily != null) {
      domRoot.style.setProperty('font-family', Config.fontSettings.fontFamily)
    }
    if (Config.fontSettings.fontSize != null) {
      domRoot.style.setProperty('font-size', Config.fontSettings.fontSize+'px')
    }

    domRoot.style.setProperty('line-height',
      Config.fontSettings.lineHeight
        ? Config.fontSettings.lineHeight+'px'
        : '1' // 1 = same as font size
    )

    updateRootPosition.call(this)

    new MutationObserver(updateRootPosition.bind(this)).observe(this.canvas, {attributes: true})
    new ResizeObserver(updateRootPosition.bind(this)).observe(this.canvas)
    window.addEventListener('resize', updateRootPosition.bind(this))
  }

  override createNode<
    ShCtr extends lng.BaseShaderController = lng.ShaderController<'DefaultShader'>,
  >(
    props: Partial<lng.INodeProps<ShCtr>>,
  ): lng.INode<ShCtr> {
    return new DOMNode(super.createNode(props))
  }

  override createTextNode(props: Partial<lng.ITextNodeProps>): lng.ITextNode {
    return new DOMText(super.createTextNode(props))
  }

  override createShader<ShType extends keyof lng.ShaderMap>(
    shaderType: ShType,
    props?: any,
  ): lng.ShaderController<ShType> {
    let shader = super.createShader(shaderType, props)
    return shader
  }

  override createDynamicShader<
      T extends lng.DynamicEffects<[...{ name?: string; type: keyof lng.EffectMap }[]]>,
    >(effects: [...T]): lng.DynamicShaderController<T> {
    let shader = super.createDynamicShader(effects)
    return shader
  }
}

export class DOMCoreContextTexture extends CoreContextTexture {
  image: HTMLImageElement | SVGElement | undefined = new Image

  load(): void {}

  free(): void {}

  updateMemSize(): void {}

  hasImage(): boolean {
    return this.image !== undefined;
  }

  getImage(color: IParsedColor): HTMLImageElement | SVGElement {
    return this.image!
  }
}

export class DOMCoreRenderer extends CoreRenderer {
  public renderToTextureActive = false
  activeRttNode: CoreNode | null = null
  defShaderCtr: lng.BaseShaderController

  constructor(options: CoreRendererOptions) {
    super(options)

    this.mode = 'canvas'
    this.shManager.renderer = this

    // Stub for default shader controller
    this.defShaderCtr = {
      type: 'DefaultShader',
      props: {},
      shader: new UnsupportedShader('DefaultShader'),
      getResolvedProps: () => () => {
        return {}
      },
    }
  }

  reset(): void {}

  render(): void {}

  addQuad(quad: QuadOptions): void {}

  createCtxTexture(textureSource: lng.Texture): CoreContextTexture {
    return new DOMCoreContextTexture(this.txMemManager, textureSource);
  }

  getShaderManager(): CoreShaderManager {
    return this.shManager;
  }

  override getDefShaderCtr(): lng.BaseShaderController {
    return this.defShaderCtr;
  }

  renderRTTNodes(): void {
    // noop - DOM rendering doesn't need this
  }

  removeRTTNode(node: CoreNode): void {}

  renderToTexture(node: CoreNode): void {}

  getBufferInfo(): null {
    return null;
  }

  getQuadCount(): null {
    return null;
  }

  updateClearColor(color: number) {}
}

export interface DOMTextRendererState extends TextRendererState {
  node: CoreTextNode
}

export class DOMTextRenderer extends TextRenderer<DOMTextRendererState> {
  public type: 'canvas' = 'canvas'

  constructor(stage: lng.Stage) {
    super(stage)
  }

  override getPropertySetters(): Partial<TrPropSetters<DOMTextRendererState>> {
    return {
      fontFamily: (state, value) => {
        state.props.fontFamily = value;
        this.scheduleUpdateState(state);
      },
      fontWeight: (state, value) => {
        state.props.fontWeight = value;
        this.scheduleUpdateState(state);
      },
      fontStyle: (state, value) => {
        state.props.fontStyle = value;
        this.scheduleUpdateState(state);
      },
      fontStretch: (state, value) => {
        state.props.fontStretch = value;
        this.scheduleUpdateState(state);
      },
      fontSize: (state, value) => {
        state.props.fontSize = value;
        this.scheduleUpdateState(state);
      },
      text: (state, value) => {
        state.props.text = value;
        this.scheduleUpdateState(state);
      },
      textAlign: (state, value) => {
        state.props.textAlign = value;
        this.scheduleUpdateState(state);
      },
      color: (state, value) => {
        state.props.color = value;
        this.scheduleUpdateState(state);
      },
      x: (state, value) => {
        state.props.x = value;
      },
      y: (state, value) => {
        state.props.y = value;
      },
      contain: (state, value) => {
        state.props.contain = value;
        this.scheduleUpdateState(state);
      },
      width: (state, value) => {
        state.props.width = value;
        if (state.props.contain !== 'none') {
          this.scheduleUpdateState(state);
        }
      },
      height: (state, value) => {
        state.props.height = value;
        if (state.props.contain === 'both') {
          this.scheduleUpdateState(state);
        }
      },
      offsetY: (state, value) => {
        state.props.offsetY = value;
        this.scheduleUpdateState(state);
      },
      scrollY: (state, value) => {
        state.props.scrollY = value;
      },
      letterSpacing: (state, value) => {
        state.props.letterSpacing = value;
        this.scheduleUpdateState(state);
      },
      lineHeight: (state, value) => {
        state.props.lineHeight = value;
        this.scheduleUpdateState(state);
      },
      maxLines: (state, value) => {
        state.props.maxLines = value;
        this.scheduleUpdateState(state);
      },
      textBaseline: (state, value) => {
        state.props.textBaseline = value;
        this.scheduleUpdateState(state);
      },
      verticalAlign: (state, value) => {
        state.props.verticalAlign = value;
        this.scheduleUpdateState(state);
      },
      overflowSuffix: (state, value) => {
        state.props.overflowSuffix = value;
        this.scheduleUpdateState(state);
      },
    };
  }

  override canRenderFont(props: TrFontProps): boolean {
    // DOM renderer can render any font
    return true;
  }

  override isFontFaceSupported(fontFace: lng.TrFontFace): boolean {
    return fontFace instanceof lng.WebTrFontFace;
  }

  override addFontFace(fontFace: lng.TrFontFace): void {
    // console.log('addFontFace', fontFace)
  }

  override createState(
    props: TrProps,
    node: CoreTextNode,
  ): DOMTextRendererState {
    return {
      props,
      node,
      status: 'initialState', // Always set as loaded since DOM renderer handles it
      updateScheduled: false,
      emitter: new EventEmitter(),
      forceFullLayoutCalc: false,
      textW: props.width || 0,
      textH: props.height || 0,
      isRenderable: true,
      debugData: {
        updateCount: 0,
        layoutCount: 0,
        drawCount: 0,
        lastLayoutNumCharacters: 0,
        layoutSum: 0,
        drawSum: 0,
        bufferSize: 0,
      },
    };
  }

  override updateState(state: DOMTextRendererState): void {

    // Create temporary element to measure text dimensions
  const measureEl = document.createElement('div');
  
    // Apply all text-related styles from the state
    measureEl.style.position = 'absolute';
    measureEl.style.visibility = 'hidden';
    measureEl.style.whiteSpace = 'nowrap'; // For single line measurement
    measureEl.style.fontFamily = state.props.fontFamily || 'inherit';
    measureEl.style.fontSize = `${state.props.fontSize || 16}px`;
    measureEl.style.fontWeight = state.props.fontWeight || 'normal';
    measureEl.style.fontStyle = state.props.fontStyle || 'normal';
    measureEl.style.fontStretch = state.props.fontStretch || 'normal';
    measureEl.style.letterSpacing = `${state.props.letterSpacing || 0}px`;
    
    measureEl.style.lineHeight = `${state.props.lineHeight || state.props.fontSize || 16}px`;
    
    // Set the text content
    measureEl.textContent = state.props.text || '';
    
    // Handle multiline if needed
    if (state.props.width && state.props.width > 0 && state.props.contain !== 'none') {
      measureEl.style.width = `${state.props.width}px`;
      measureEl.style.whiteSpace = 'normal';
      
      if (state.props.maxLines > 0) {
        measureEl.style.display = '-webkit-box';
        measureEl.style.webkitLineClamp = `${state.props.maxLines}`;
        measureEl.style.webkitBoxOrient = 'vertical';
        measureEl.style.overflow = 'hidden';
      }
    }
    
    // Append to DOM to measure
    document.body.appendChild(measureEl);
    
    // Get computed dimensions
    const rect = measureEl.getBoundingClientRect();
    state.textW = rect.width;
    state.textH = rect.height;
    
    // Clean up
    document.body.removeChild(measureEl);

    this.setStatus(state, 'loaded')

    // const cssString = getFontCssString(state.props);
    
    // const trFontFace = this.stage.fontManager.resolveFontFace(
    //   this.fontFamilyArray,
    //   state.props,
    //   'canvas',
    // ) as lng.WebTrFontFace | undefined;

    // assertTruthy(trFontFace, `Could not resolve font face for ${cssString}`);
    // state.fontInfo = {
    //   fontFace: trFontFace,
    //   cssString: cssString,
    //   // TODO: For efficiency we would use this here but it's not reliable on WPE -> document.fonts.check(cssString),
    //   loaded: false,
    // };
    // // If font is not loaded, set up a handler to update the font info when the font loads
    // if (!state.fontInfo.loaded) {
    //   globalFontSet
    //     .load(cssString)
    //     .then(this.onFontLoaded.bind(this, state, cssString))
    //     .catch(this.onFontLoadError.bind(this, state, cssString));
    //   return;
    // }
  }

  override renderQuads(): void {
    // No-op - all rendering is handled by DOMText
  }

  override destroyState(state: DOMTextRendererState): void {
    if (state.status === 'destroyed') {
      return;
    }
    super.destroyState(state);
  }
}
