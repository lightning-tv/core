/*

Experimental DOM renderer

*/

import * as lng from '@lightningjs/renderer'

let elMap = new WeakMap<lng.INode, HTMLElement>()

let domRoot = document.body.appendChild(document.createElement('div'))
domRoot.id = 'dom_root'

let rangeInput = document.createElement('input')
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

document.body.appendChild(rangeInput)

/*
 fetchJson function from @lightningjs/renderer/src/core/text-rendering/font-face-types/utils.ts

 Copyright 2020 Metrological

 Licensed under the Apache License, Version 2.0 (the License);
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
*/
export function fetchJson(
  url: string,
  responseType: XMLHttpRequestResponseType = '',
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.responseType = responseType
    xhr.onreadystatechange = () => {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        // On most devices like WebOS and Tizen, the file protocol returns 0 while http(s) protocol returns 200
        if (xhr.status === 0 || xhr.status === 200) {
          resolve(xhr.response)
        } else {
          reject(xhr.statusText)
        }
      }
    }
    xhr.open('GET', url, true)
    xhr.send(null)
  })
}

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
        let parent = elMap.get(value)
        if (parent) {
          parent.appendChild(el)
        } else {
          console.warn('no parent element')
        }
      }
    }
  },
  src(el, value) {
    if (value != null) {
      // for some reason just setting `url(${value})` causes net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep
      fetchJson(value, 'blob').then((res) => {
        el.style.setProperty('background-image', `url(${URL.createObjectURL(res as Blob)})`)
        el.style.setProperty('background-size', 'contain')
        el.style.setProperty('background-repeat', 'no-repeat')
      })
    }
  },
  alpha(el, value) {
    if (value !== 1) {
      el.style.setProperty('opacity', String(value))
    }
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
    if (value !== 0) {
      el.style.setProperty('width', value+'px')
    }
  },
  height(el, value) {
    if (value !== 0) {
      el.style.setProperty('height', value+'px')
    }
  },
  zIndex(el, value) {
    el.style.setProperty('z-index', String(value))
  },
  clipping(el, value) {
    if (value) {
      el.style.setProperty('overflow', 'hidden')
    }
  },
  rotation(el, value) {
    if (value !== 0) {
      el.style.setProperty('transform', `rotate(${value}rad)`)
    }
  },
  scale(el, value) {
    if (value !== 1) {
      el.style.setProperty('transform', `scale(${value})`)
    }
  },
  scaleX(el, value) {
    if (value !== 1) {
      el.style.setProperty('transform', `scaleX(${value})`)
    }
  },
  scaleY(el, value) {
    if (value !== 1) {
      el.style.setProperty('transform', `scaleY(${value})`)
    }
  },
  color(el, value) {
    if (value !== 0) {
      el.style.setProperty('background-color', colorToRgba(value))
    }
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
  shader:         todoSetProp,
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
    if (value !== 0) {
      el.style.setProperty('color', colorToRgba(value))
    }
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
      el.style.setProperty('line-height', String(value))
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
    let node = super.createNode(props)

    let el = document.createElement('div')
    el.style.position = 'absolute'

    nodeSetProps(el, props)

    node = new Proxy(node, {
      set(target, prop, value) {

        if (prop in nodeSetPropTable) {
          (nodeSetPropTable as any)[prop]!(el, value, prop, props)
        }

        return Reflect.set(target, prop, value)
      }
    })

    elMap.set(node, el)
    return node
  }

  override createTextNode(props: Partial<lng.ITextNodeProps>): lng.ITextNode {
    let node = super.createTextNode(props)

    let el = document.createElement('div')
    el.style.position = 'absolute'

    textSetProps(el, props)

    node = new Proxy(node, {
      set(target, prop, value) {

        if (prop in textSetPropTable) {
          (textSetPropTable as any)[prop]!(el, value, prop, props)
        }

        return Reflect.set(target, prop, value)
      },
    })

    elMap.set(node, el)
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
