/*

Experimental DOM renderer

*/

import * as lng from '@lightningjs/renderer'
import {Config} from './config.js'

let elMap = new WeakMap<lng.INode, HTMLElement>()

let domRoot = document.body.appendChild(document.createElement('div'))
domRoot.id = 'dom_root'

domRoot.style.backgroundColor = 'white'

// little slider to show/hide the dom renderer output :)
let rangeInput = document.body.appendChild(document.createElement('input'))
rangeInput.type  = 'range'
rangeInput.min   = '0'
rangeInput.max   = '1'
rangeInput.step  = '0.1'
rangeInput.value = '1'
rangeInput.style.position = 'fixed'
rangeInput.style.top      = '10px'
rangeInput.style.right    = '10px'
rangeInput.style.zIndex   = '65535'

rangeInput.addEventListener('input', () => {
  domRoot.style.opacity = rangeInput.value
})

const colorToRgba = (c: number) =>
  `rgba(${(c>>24) & 0xff},${(c>>16) & 0xff},${(c>>8) & 0xff},${(c & 0xff) / 255})`

const nodeSetPropTable: {
  [K in keyof lng.INodeProps]: (el: HTMLElement, value: lng.INodeProps[K], prop: K, props: Partial<lng.INodeProps>) => void
} = {
  parent(el, value) {
    if (value != null) {
      if (value.id === 1) {
        domRoot.appendChild(el)
      } else {
        elMap.get(value)!.appendChild(el)
      }
    } else {
      console.warn('no parent?')
    }
  },
  async src(el, value, _, props) {

    let url: string | null = null
    
    if (value != null) {
      try {
        // for some reason just setting `url(${value})` causes net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep
        let res = await fetch(value)
        let blob = await res.blob()
        url = `url(${URL.createObjectURL(blob)})`
      } catch (err) {
        console.error(err)
      }
    }
    
    // Mask image
    if (props.color) {
      el.style.setProperty('mask-image', url)
      el.style.setProperty('mask-size', 'contain')
      el.style.setProperty('background-blend-mode', 'multiply')
    }

    // Background image
    el.style.setProperty('background-image', url)
    el.style.setProperty('background-size', 'contain')
  },
  alpha(el, value) {
    el.style.setProperty('opacity', String(value))
  },
  x(el, value, _, props) {

    let mount = props.mountX
    if (mount != null) {
      value = value - (props.width ?? 0) * mount
    }

    el.style.setProperty('left', value+'px')
  },
  y(el, value, _, props) {

    let mount = props.mountY
    if (mount != null) {
      value = value - (props.height ?? 0) * mount
    }

    el.style.setProperty('top', value+'px')
  },
  width(el, value) {
    el.style.setProperty('width', value+'px')
  },
  height(el, value) {
    el.style.setProperty('height', value+'px')
  },
  zIndex(el, value) {
    el.style.setProperty('z-index', String(value))
  },
  clipping(el, value) {
    el.style.setProperty('overflow', value ? 'hidden' : 'visible')
  },
  rotation(el, value) {
    el.style.setProperty('transform', `rotate(${value}rad)`)
  },
  scale(el, value) {
    el.style.setProperty('transform', `scale(${value})`)
  },
  scaleX(el, value) {
    el.style.setProperty('transform', `scaleX(${value})`)
  },
  scaleY(el, value) {
    el.style.setProperty('transform', `scaleY(${value})`)
  },
  color(el, value) {
    el.style.setProperty('background-color', colorToRgba(value))
  },
  data(el, value) {
    for (let key in value) {
      let keyValue: unknown = value[key]
      if (keyValue === undefined) {
        el.removeAttribute('data-'+key)
      } else {
        el.setAttribute('data-'+key, String(keyValue))
      }
    }
  },
  shader(el, value) {
    for (let prop of Object.getOwnPropertyNames(value.props)) {
      switch (prop) {
      case 'border':{
        let {width, color} = value.props[prop] as {width: number, color: number}
        // css border impacts the element's box size when box-shadow doesn't
        el.style.setProperty('box-shadow', `inset 0px 0px 0px ${width}px ${colorToRgba(color)}`)
        break
      }
      case 'radius': {
        let {radius} = value.props[prop]
        el.style.setProperty('border-radius', radius+'px')
        break
      }
      default:
        console.warn('unhandled shader', el, prop, value.props[prop])
      }
    }
  },
  autosize:       todoSetProp,
  colorTop:       todoSetProp,
  colorBottom:    todoSetProp,
  colorLeft:      todoSetProp,
  colorRight:     todoSetProp,
  colorTl:        todoSetProp,
  colorTr:        todoSetProp,
  colorBr:        todoSetProp,
  colorBl:        todoSetProp,
  preventCleanup: todoSetProp,
  texture:        todoSetProp,
  textureOptions: todoSetProp,
  zIndexLocked:   todoSetProp,
  mount:          todoSetProp,
  mountX:         todoSetProp,
  mountY:         todoSetProp,
  pivot:          todoSetProp,
  pivotX:         todoSetProp,
  pivotY:         todoSetProp,
  rtt:            todoSetProp,
  imageType:      todoSetProp,
  srcWidth:       todoSetProp,
  srcHeight:      todoSetProp,
  srcX:           todoSetProp,
  srcY:           todoSetProp,
  strictBounds:   todoSetProp,
}

const textSetPropTable: {
  [K in keyof lng.ITextNodeProps]: (el: HTMLElement, value: lng.ITextNodeProps[K], prop: K, props: Partial<lng.ITextNodeProps>) => void
} = {
  ...nodeSetPropTable,
  text(el, value) {
    el.innerHTML = value
  },
  color(el, value) {
    el.style.setProperty('color', colorToRgba(value))
  },
  fontFamily(el, value) {
    el.style.setProperty('font-family', value)
  },
  fontSize(el, value) {
    el.style.setProperty('font-size', value+'px')
  },
  fontStyle(el, value) {
    el.style.setProperty('font-style', value)
  },
  fontWeight(el, value) {
    el.style.setProperty('font-weight', String(value))
  },
  fontStretch(el, value) {
    el.style.setProperty('font-stretch', value)
  },
  lineHeight(el, value) {
    if (value != null) {
      el.style.setProperty('line-height', String(value)+'px')
    } else {
      el.style.removeProperty('line-height')
    }
  },
  letterSpacing(el, value) {
    el.style.setProperty('letter-spacing', String(value))
  },
  textAlign(el, value) {
    el.style.setProperty('text-align', value)
  },
  overflowSuffix(el, value) {
    el.style.setProperty('overflow-suffix', value)
  },
  maxLines(el, value) {
    el.style.setProperty('max-lines', String(value))
  },
  contain(el, value) {
    el.style.setProperty('contain', value)
  },
  verticalAlign(el, value) {
    el.style.setProperty('vertical-align', value)
  },
  textBaseline:         todoSetProp,
  textRendererOverride: todoSetProp,
  scrollable:           todoSetProp,
  scrollY:              todoSetProp,
  offsetY:              todoSetProp,
  debug:                todoSetProp,
}

function todoSetProp(el: HTMLElement, value: any, prop: string) {
  // console.log('TODO prop', prop, value)
}

function textSetProp<K extends keyof lng.ITextNodeProps>(
  el: HTMLElement,
  prop: K,
  value: lng.ITextNodeProps[K],
  props: Partial<lng.ITextNodeProps>,
) {
  textSetPropTable[prop]!(el, value, prop, props)
}
function nodeSetProp<K extends keyof lng.INodeProps>(
  el: HTMLElement,
  prop: K,
  value: lng.INodeProps[K],
  props: Partial<lng.INodeProps>,
) {
  nodeSetPropTable[prop]!(el, value, prop, props)
}

function textSetProps(el: HTMLElement, props: Partial<lng.ITextNodeProps>) {
  for (let key in props) {
    textSetProp(el, key as any, (props as any)[key], props)
  }
}
function nodeSetProps(el: HTMLElement, props: Partial<lng.INodeProps>) {
  for (let key in props) {
    nodeSetProp(el, key as any, (props as any)[key], props)
  }
}

class DOMNode implements lng.INode {

  constructor (
    public node: lng.INode,
    public el: HTMLElement,
  ) {}

  destroy(): void {
    elMap.delete(this.node)
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
      // TODO handle all animateable props
      }
    }

    // TODO: handle all animation settings

    // ? Should WAAPI be used?
    this.el.animate(keyframes, {
      duration: settings.duration,
      easing:   settings.easing,
      fill:     'forwards',
    })

    return this.node.animate(props, settings)
  }

  get x(): number {return this.node.x}
  set x(value: number) {
    this.node.x = value
    nodeSetPropTable.x(this.el, value, 'x', this.props)
  }
  get y(): number {return this.node.y}
  set y(value: number) {
    this.node.y = value
    nodeSetPropTable.y(this.el, value, 'y', this.props)
  }
  get width(): number {return this.node.width}
  set width(value: number) {
    this.node.width = value
    nodeSetPropTable.width(this.el, value, 'width', this.props)
  }
  get height(): number {return this.node.height}
  set height(value: number) {
    this.node.height = value
    nodeSetPropTable.height(this.el, value, 'height', this.props)
  }
  get alpha(): number {return this.node.alpha}
  set alpha(value: number) {
    this.node.alpha = value
    nodeSetPropTable.alpha(this.el, value, 'alpha', this.props)
  }
  get autosize(): boolean {return this.node.autosize}
  set autosize(value: boolean) {
    this.node.autosize = value
    nodeSetPropTable.autosize(this.el, value, 'autosize', this.props)
  }
  get clipping(): boolean {return this.node.clipping}
  set clipping(value: boolean) {
    this.node.clipping = value
    nodeSetPropTable.clipping(this.el, value, 'clipping', this.props)
  }
  get color(): number {return this.node.color}
  set color(value: number) {
    this.node.color = value
    nodeSetPropTable.color(this.el, value, 'color', this.props)
  }
  get colorTop(): number {return this.node.colorTop}
  set colorTop(value: number) {
    this.node.colorTop = value
    nodeSetPropTable.colorTop(this.el, value, 'colorTop', this.props)
  }
  get colorBottom(): number {return this.node.colorBottom}
  set colorBottom(value: number) {
    this.node.colorBottom = value
    nodeSetPropTable.colorBottom(this.el, value, 'colorBottom', this.props)
  }
  get colorLeft(): number {return this.node.colorLeft}
  set colorLeft(value: number) {
    this.node.colorLeft = value
    nodeSetPropTable.colorLeft(this.el, value, 'colorLeft', this.props)
  }
  get colorRight(): number {return this.node.colorRight}
  set colorRight(value: number) {
    this.node.colorRight = value
    nodeSetPropTable.colorRight(this.el, value, 'colorRight', this.props)
  }
  get colorTl(): number {return this.node.colorTl}
  set colorTl(value: number) {
    this.node.colorTl = value
    nodeSetPropTable.colorTl(this.el, value, 'colorTl', this.props)
  }
  get colorTr(): number {return this.node.colorTr}
  set colorTr(value: number) {
    this.node.colorTr = value
    nodeSetPropTable.colorTr(this.el, value, 'colorTr', this.props)
  }
  get colorBr(): number {return this.node.colorBr}
  set colorBr(value: number) {
    this.node.colorBr = value
    nodeSetPropTable.colorBr(this.el, value, 'colorBr', this.props)
  }
  get colorBl(): number {return this.node.colorBl}
  set colorBl(value: number) {
    this.node.colorBl = value
    nodeSetPropTable.colorBl(this.el, value, 'colorBl', this.props)
  }
  get zIndex(): number {return this.node.zIndex}
  set zIndex(value: number) {
    this.node.zIndex = value
    nodeSetPropTable.zIndex(this.el, value, 'zIndex', this.props)
  }
  get texture(): lng.Texture | null {return this.node.texture}
  set texture(value: lng.Texture | null) {
    this.node.texture = value
    nodeSetPropTable.texture(this.el, value, 'texture', this.props)
  }
  get preventCleanup(): boolean {return this.node.preventCleanup}
  set preventCleanup(value: boolean) {
    this.node.preventCleanup = value
    nodeSetPropTable.preventCleanup(this.el, value, 'preventCleanup', this.props)
  }
  set textureOptions(value: any) {
    this.node.textureOptions = value
    nodeSetPropTable.textureOptions(this.el, value, 'textureOptions', this.props)
  }
  get textureOptions() {return this.node.textureOptions}
  get src(): string | null {return this.node.src}
  set src(value: string | null) {
    this.node.src = value
    nodeSetPropTable.src(this.el, value, 'src', this.props)
  }
  get zIndexLocked(): number {return this.node.zIndexLocked}
  set zIndexLocked(value: number) {
    this.node.zIndexLocked = value
    nodeSetPropTable.zIndexLocked(this.el, value, 'zIndexLocked', this.props)
  }
  get scale(): number {return this.node.scale}
  set scale(value: number) {
    this.node.scale = value
    nodeSetPropTable.scale(this.el, value, 'scale', this.props)
  }
  get scaleX(): number {return this.node.scaleX}
  set scaleX(value: number) {
    this.node.scaleX = value
    nodeSetPropTable.scaleX(this.el, value, 'scaleX', this.props)
  }
  get scaleY(): number {return this.node.scaleY}
  set scaleY(value: number) {
    this.node.scaleY = value
    nodeSetPropTable.scaleY(this.el, value, 'scaleY', this.props)
  }
  get mount(): number {return this.node.mount}
  set mount(value: number) {
    this.node.mount = value
    nodeSetPropTable.mount(this.el, value, 'mount', this.props)
  }
  get mountX(): number {return this.node.mountX}
  set mountX(value: number) {
    this.node.mountX = value
    nodeSetPropTable.mountX(this.el, value, 'mountX', this.props)
  }
  get mountY(): number {return this.node.mountY}
  set mountY(value: number) {
    this.node.mountY = value
    nodeSetPropTable.mountY(this.el, value, 'mountY', this.props)
  }
  get pivot(): number {return this.node.pivot}
  set pivot(value: number) {
    this.node.pivot = value
    nodeSetPropTable.pivot(this.el, value, 'pivot', this.props)
  }
  get pivotX(): number {return this.node.pivotX}
  set pivotX(value: number) {
    this.node.pivotX = value
    nodeSetPropTable.pivotX(this.el, value, 'pivotX', this.props)
  }
  get pivotY(): number {return this.node.pivotY}
  set pivotY(value: number) {
    this.node.pivotY = value
    nodeSetPropTable.pivotY(this.el, value, 'pivotY', this.props)
  }
  get rotation(): number {return this.node.rotation}
  set rotation(value: number) {
    this.node.rotation = value
    nodeSetPropTable.rotation(this.el, value, 'rotation', this.props)
  }
  get rtt(): boolean {return this.node.rtt}
  set rtt(value: boolean) {
    this.node.rtt = value
    nodeSetPropTable.rtt(this.el, value, 'rtt', this.props)
  }
  get shader(){return this.node.shader}
  set shader(v: lng.BaseShaderController){
    this.node.shader = v
    nodeSetPropTable.shader(this.el, v, 'shader', this.props)
  }
  
  get data() {return this.node.data}
  set data(value: any) {this.node.data = value}

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
    nodeSetPropTable.strictBounds(this.el, value, 'strictBounds', this.props)
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
    el: HTMLElement,
  ) {
    super(node, el)
  }

  get text(): any {return this.node.text}
  set text(value: any) {
    this.node.text = value
    textSetPropTable.text(this.el, value, 'text', this.props)
  }
  override get color(): any {return this.node.color}
  override set color(value: any) {
    this.node.color = value
    textSetPropTable.color(this.el, value, 'color', this.props)
  }
  get fontFamily(): any {return this.node.fontFamily}
  set fontFamily(value: any) {
    this.node.fontFamily = value
    textSetPropTable.fontFamily(this.el, value, 'fontFamily', this.props)
  }
  get fontSize(): any {return this.node.fontSize}
  set fontSize(value: any) {
    this.node.fontSize = value
    textSetPropTable.fontSize(this.el, value, 'fontSize', this.props)
  }
  get fontStyle(): any {return this.node.fontStyle}
  set fontStyle(value: any) {
    this.node.fontStyle = value
    textSetPropTable.fontStyle(this.el, value, 'fontStyle', this.props)
  }
  get fontWeight(): any {return this.node.fontWeight}
  set fontWeight(value: any) {
    this.node.fontWeight = value
    textSetPropTable.fontWeight(this.el, value, 'fontWeight', this.props)
  }
  get fontStretch(): any {return this.node.fontStretch}
  set fontStretch(value: any) {
    this.node.fontStretch = value
    textSetPropTable.fontStretch(this.el, value, 'fontStretch', this.props)
  }
  get lineHeight(): any {return this.node.lineHeight}
  set lineHeight(value: any) {
    this.node.lineHeight = value
    textSetPropTable.lineHeight(this.el, value, 'lineHeight', this.props)
  }
  get letterSpacing(): any {return this.node.letterSpacing}
  set letterSpacing(value: any) {
    this.node.letterSpacing = value
    textSetPropTable.letterSpacing(this.el, value, 'letterSpacing', this.props)
  }
  get textAlign(): any {return this.node.textAlign}
  set textAlign(value: any) {
    this.node.textAlign = value
    textSetPropTable.textAlign(this.el, value, 'textAlign', this.props)
  }
  get overflowSuffix(): any {return this.node.overflowSuffix}
  set overflowSuffix(value: any) {
    this.node.overflowSuffix = value
    textSetPropTable.overflowSuffix(this.el, value, 'overflowSuffix', this.props)
  }
  get maxLines(): any {return this.node.maxLines}
  set maxLines(value: any) {
    this.node.maxLines = value
    textSetPropTable.maxLines(this.el, value, 'maxLines', this.props)
  }
  get contain(): any {return this.node.contain}
  set contain(value: any) {
    this.node.contain = value
    textSetPropTable.contain(this.el, value, 'contain', this.props)
  }
  get verticalAlign(): any {return this.node.verticalAlign}
  set verticalAlign(value: any) {
    this.node.verticalAlign = value
    textSetPropTable.verticalAlign(this.el, value, 'verticalAlign', this.props)
  }
  get textBaseline(): any {return this.node.textBaseline}
  set textBaseline(value: any) {
    this.node.textBaseline = value
    textSetPropTable.textBaseline(this.el, value, 'textBaseline', this.props)
  }
  get textRendererOverride(): any {return this.node.textRendererOverride}
  set textRendererOverride(value: any) {
    this.node.textRendererOverride = value
    textSetPropTable.textRendererOverride(this.el, value, 'textRendererOverride', this.props)
  }
  get scrollable(): any {return this.node.scrollable}
  set scrollable(value: any) {
    this.node.scrollable = value
    textSetPropTable.scrollable(this.el, value, 'scrollable', this.props)
  }
  get scrollY(): any {return this.node.scrollY}
  set scrollY(value: any) {
    this.node.scrollY = value
    textSetPropTable.scrollY(this.el, value, 'scrollY', this.props)
  }
  get offsetY(): any {return this.node.offsetY}
  set offsetY(value: any) {
    this.node.offsetY = value
    textSetPropTable.offsetY(this.el, value, 'offsetY', this.props)
  }
  get debug(): any {return this.node.debug}
  set debug(value: any) {
    this.node.debug = value
    textSetPropTable.debug(this.el, value, 'debug', this.props)
  }
}

function updateRootPosition(this: DOMRenderer) {
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

export class DOMRenderer extends lng.RendererMain {
  
  constructor(settings: lng.RendererMainSettings, target: string | HTMLElement) {
    super(settings, target)

    if (Config.fontSettings.fontFamily != null) {
      domRoot.style.setProperty('font-family', Config.fontSettings.fontFamily)
    }
    if (Config.fontSettings.fontSize != null) {
      domRoot.style.setProperty('font-size', Config.fontSettings.fontSize+'px')
    }

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

    let el = document.createElement('div')
    el.style.position = 'absolute'
    
    let node = new DOMNode(super.createNode(props), el)

    el.setAttribute('data-id', String(node.id))
    elMap.set(node, el)
    
    nodeSetProps(el, props)
    
    return node
  }

  override createTextNode(props: Partial<lng.ITextNodeProps>): lng.ITextNode {

    let el = document.createElement('div')
    el.style.position = 'absolute'
    
    let node = new DOMText(super.createTextNode(props), el)

    el.setAttribute('data-id', String(node.id))
    elMap.set(node, el)
    
    textSetProps(el, props)
    
    return node
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
