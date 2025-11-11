/*

Experimental DOM renderer

*/

import * as lng from '@lightningjs/renderer';

import { Config } from '../config.js';
import {
  IRendererStage,
  IRendererTextureProps,
  IRendererNode,
  IRendererNodeProps,
  IRendererTextNode,
  IRendererTextNodeProps,
  IRendererMain,
} from '../lightningInit.js';
import { EventEmitter } from '@lightningjs/renderer/utils';
import { ExtractProps, IRendererShader } from './domRendererTypes.js';

const colorToRgba = (c: number) =>
  `rgba(${(c >> 24) & 0xff},${(c >> 16) & 0xff},${(c >> 8) & 0xff},${(c & 0xff) / 255})`;

// Feature detection for legacy Safari (<9) which lacks object-fit / object-position
const supportsObjectFit: boolean =
  typeof document !== 'undefined'
    ? 'objectFit' in (document.documentElement?.style || {})
    : true;
const supportsObjectPosition: boolean =
  typeof document !== 'undefined'
    ? 'objectPosition' in (document.documentElement?.style || {})
    : true;
// CSS Masking + blend-mode support detection (standard + webkit prefixes)
const _styleRef: any =
  typeof document !== 'undefined' ? document.documentElement?.style || {} : {};
const supportsStandardMask = 'maskImage' in _styleRef;
const supportsWebkitMask = 'webkitMaskImage' in _styleRef; // legacy Safari
const supportsCssMask = supportsStandardMask || supportsWebkitMask;
const supportsMixBlendMode = 'mixBlendMode' in _styleRef;

/**
 * Compute fallback layout for object-fit / object-position when not supported.
 * Only executed after image load (natural dimensions known).
 */
function computeLegacyObjectFit(
  node: DOMNode,
  img: HTMLImageElement,
  resizeMode: ({ type?: string } & Record<string, any>) | undefined,
  clipX: number,
  clipY: number,
  srcPos: null | { x: number; y: number },
): void {
  if (supportsObjectFit && supportsObjectPosition) return; // No fallback needed
  const containerW = node.props.width || img.naturalWidth;
  const containerH = node.props.height || img.naturalHeight;
  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;

  let fitType = resizeMode?.type || (srcPos ? 'none' : 'fill');

  let drawW = naturalW;
  let drawH = naturalH;

  switch (fitType) {
    case 'cover': {
      const scale = Math.max(containerW / naturalW, containerH / naturalH);
      drawW = naturalW * scale;
      drawH = naturalH * scale;
      break;
    }
    case 'contain': {
      const scale = Math.min(containerW / naturalW, containerH / naturalH);
      drawW = naturalW * scale;
      drawH = naturalH * scale;
      break;
    }
    case 'fill': {
      drawW = containerW;
      drawH = containerH;
      break;
    }
    case 'none':
    default: {
      break;
    }
  }

  // Positioning (clipX / clipY emulate object-position percentage center default 0.5)
  // Negative offsets center the image inside container
  let offsetX = (containerW - drawW) * clipX;
  let offsetY = (containerH - drawH) * clipY;

  // For subTexture cropping fallback: emulate object-position with translate
  if (srcPos) {
    // Using transform translate instead of object-position
    offsetX = -srcPos.x;
    offsetY = -srcPos.y;
  }

  // Apply calculated layout styles
  const styleParts = [
    'position: absolute',
    `width: ${Math.round(drawW)}px`,
    `height: ${Math.round(drawH)}px`,
    `left: ${Math.round(offsetX)}px`,
    `top: ${Math.round(offsetY)}px`,
    'display: block',
    'pointer-events: none',
  ];

  img.style.removeProperty('object-fit');
  img.style.removeProperty('object-position');

  if (resizeMode?.type === 'none') {
    // explicit none: do not scale
    styleParts[1] = `width: ${naturalW}px`;
    styleParts[2] = `height: ${naturalH}px`;
  }

  // tint fallback still uses mix-blend-mode if relevant
  if (
    !supportsObjectFit &&
    node.props.color !== 0xffffffff &&
    node.props.color !== 0x00000000
  ) {
    styleParts.push('mix-blend-mode: multiply');
  }

  img.setAttribute('style', styleParts.join('; ') + ';');
}

function buildGradientStops(colors: number[], stops?: number[]): string {
  if (!Array.isArray(colors) || colors.length === 0) return '';

  const positions: number[] = [];
  if (Array.isArray(stops) && stops.length === colors.length) {
    for (let v of stops) {
      if (typeof v !== 'number' || !isFinite(v)) {
        positions.push(0);
        continue;
      }

      let pct = v <= 1 ? v * 100 : v;
      if (pct < 0) pct = 0;
      if (pct > 100) pct = 100;
      positions.push(pct);
    }
  } else {
    const lastIndex = colors.length - 1;
    for (let i = 0; i < colors.length; i++) {
      positions.push(lastIndex === 0 ? 0 : (i / lastIndex) * 100);
    }
  }

  if (positions.length !== colors.length) {
    while (positions.length < colors.length)
      positions.push(positions.length === 0 ? 0 : 100);
  }

  return colors
    .map((color, idx) => `${colorToRgba(color)} ${positions[idx]!.toFixed(2)}%`)
    .join(', ');
}

function applyEasing(easing: string, progress: number): number {
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

function interpolateProp(
  name: string,
  start: number,
  end: number,
  t: number,
): number {
  return name.startsWith('color')
    ? interpolateColor(start, end, t)
    : interpolate(start, end, t);
}

/*
 Animations
*/

let animationTasks: AnimationController[] = [];
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

        task.stop();
        i--;
      }
      continue;
    }

    /*
     Update props and styles
    */
    let t = activeTime / task.settings.duration;
    t = applyEasing(task.settings.easing, t);

    for (let prop in task.propsEnd) {
      let start = task.propsStart[prop]!;
      let end = task.propsEnd[prop]!;
      (task.node.props as any)[prop] = interpolateProp(prop, start, end, t);
    }

    updateNodeStyles(task.node);
  }

  requestAnimationUpdate();
}

class AnimationController implements lng.IAnimationController {
  state: lng.AnimationControllerState = 'paused';

  stopPromise: Promise<void> | null = null;
  stopResolve: (() => void) | null = null;

  propsStart: Record<string, number> = {};
  propsEnd: Record<string, number> = {};
  timeStart: number = performance.now();
  timeEnd: number;
  settings: Required<lng.AnimationSettings>;
  iteration: number = 0;
  pausedTime: number | null = null;

  constructor(
    public node: DOMNode,
    props: Partial<lng.INodeAnimateProps<any>>,
    rawSettings: Partial<lng.AnimationSettings>,
  ) {
    this.settings = {
      duration: rawSettings.duration ?? 300,
      delay: rawSettings.delay ?? 0,
      easing: rawSettings.easing ?? 'linear',
      loop: rawSettings.loop ?? false,
      repeat: rawSettings.repeat ?? 1,
      repeatDelay: rawSettings.repeatDelay ?? 0,
      stopMethod: false,
    };

    this.timeEnd =
      this.timeStart + this.settings.delay + this.settings.duration;

    for (let [prop, value] of Object.entries(props)) {
      if (value != null && typeof value === 'number') {
        this.propsStart[prop] = (node.props as any)[prop];
        this.propsEnd[prop] = value;
      }
    }

    animationTasks.push(this);
  }

  start() {
    if (this.pausedTime != null) {
      this.timeStart += performance.now() - this.pausedTime;
      this.pausedTime = null;
    } else {
      this.timeStart = performance.now();
    }
    this.state = 'running';
    requestAnimationUpdate();
    return this;
  }
  pause() {
    this.pausedTime = performance.now();
    this.state = 'paused';
    return this;
  }
  stop() {
    let index = animationTasks.indexOf(this);
    if (index !== -1) {
      animationTasks.splice(index, 1);
    }
    this.state = 'stopped';
    if (this.stopResolve) {
      this.stopResolve();
      this.stopResolve = null;
      this.stopPromise = null;
    }
    return this;
  }
  restore() {
    return this;
  }
  waitUntilStopped() {
    this.stopPromise ??= new Promise((resolve) => {
      this.stopResolve = resolve;
    });
    return this.stopPromise;
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
  return new AnimationController(this, props, settings);
}

/*
  Node Properties
*/

let elMap = new WeakMap<DOMNode, HTMLElement>();

function updateNodeParent(node: DOMNode | DOMText) {
  if (node.parent != null) {
    elMap.get(node.parent as DOMNode)!.appendChild(node.div);
  }
}

function getNodeLineHeight(props: IRendererTextNodeProps): number {
  return (
    props.lineHeight ?? Config.fontSettings.lineHeight ?? 1.2 * props.fontSize
  );
}

function updateNodeStyles(node: DOMNode | DOMText) {
  let { props } = node;

  let style = `position: absolute; z-index: ${props.zIndex};`;

  if (props.alpha !== 1) style += `opacity: ${props.alpha};`;

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

    if (props.scale !== 1 && props.scale != null) {
      transform += `scale(${props.scale})`;
    } else {
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
    if (textProps.fontFamily) {
      style += `font-family: ${textProps.fontFamily};`;
    }
    if (textProps.fontSize) {
      style += `font-size: ${textProps.fontSize}px;`;
    }
    if (textProps.fontStyle !== 'normal') {
      style += `font-style: ${textProps.fontStyle};`;
    }
    if (textProps.fontWeight !== 'normal') {
      style += `font-weight: ${textProps.fontWeight};`;
    }
    if (textProps.fontStretch !== 'normal') {
      style += `font-stretch: ${textProps.fontStretch};`;
    }
    if (textProps.lineHeight != null) {
      style += `line-height: ${textProps.lineHeight}px;`;
    }
    if (textProps.letterSpacing) {
      style += `letter-spacing: ${textProps.letterSpacing}px;`;
    }
    if (textProps.textAlign !== 'left') {
      style += `text-align: ${textProps.textAlign};`;
    }

    let maxLines = textProps.maxLines || Infinity;
    switch (textProps.contain) {
      case 'width':
        style += `width: ${props.width}px; overflow: hidden;`;
        break;
      case 'both': {
        let lineHeight = getNodeLineHeight(textProps);
        maxLines = Math.min(maxLines, Math.floor(props.height / lineHeight));
        maxLines = Math.max(1, maxLines);
        let height = maxLines * lineHeight;
        style += `width: ${props.width}px; height: ${height}px; overflow: hidden;`;
        break;
      }
      case 'none':
        style += `width: max-content;`;
        break;
    }

    if (maxLines !== Infinity) {
      // https://stackoverflow.com/a/13924997
      style += `display: -webkit-box;
        overflow: hidden;
        -webkit-line-clamp: ${maxLines};
        line-clamp: ${maxLines};
        -webkit-box-orient: vertical;`;
    }

    // if (node.overflowSuffix) style += `overflow-suffix: ${node.overflowSuffix};`
    // if (node.verticalAlign) style += `vertical-align: ${node.verticalAlign};`

    scheduleUpdateDOMTextMeasurement(node);
  }
  // <Node>
  else {
    if (props.width !== 0) style += `width: ${props.width}px;`;
    if (props.height !== 0) style += `height: ${props.height}px;`;

    let vGradient =
      props.colorBottom !== props.colorTop
        ? `linear-gradient(to bottom, ${colorToRgba(props.colorTop)}, ${colorToRgba(props.colorBottom)})`
        : null;

    let hGradient =
      props.colorLeft !== props.colorRight
        ? `linear-gradient(to right, ${colorToRgba(props.colorLeft)}, ${colorToRgba(props.colorRight)})`
        : null;

    let gradient =
      vGradient && hGradient
        ? `${vGradient}, ${hGradient}`
        : vGradient || hGradient;

    let srcImg: string | null = null;
    let srcPos: null | { x: number; y: number } = null;
    let rawImgSrc: string | null = null;

    if (
      props.texture != null &&
      props.texture.type === lng.TextureType.subTexture
    ) {
      srcPos = (props.texture as any).props;
      rawImgSrc = (props.texture as any).props.texture.props.src;
    } else if (props.src) {
      rawImgSrc = props.src;
    }

    if (rawImgSrc) {
      srcImg = `url(${rawImgSrc})`;
    }

    let bgStyle = '';
    let borderStyle = '';
    let radiusStyle = '';
    let maskStyle = '';
    let needsBackgroundLayer = false;
    let imgStyle = '';

    if (rawImgSrc) {
      needsBackgroundLayer = true;

      const hasTint = props.color !== 0xffffffff && props.color !== 0x00000000;

      if (hasTint) {
        bgStyle += `background-color: ${colorToRgba(props.color)};`;
        if (srcImg) {
          maskStyle += `mask-image: ${srcImg};`;
          if (srcPos !== null) {
            maskStyle += `mask-position: -${srcPos.x}px -${srcPos.y}px;`;
          } else {
            maskStyle += `mask-size: 100% 100%;`;
          }
        }
      } else if (gradient) {
        // use gradient as a mask when no tint is applied
        maskStyle += `mask-image: ${gradient};`;
      }

      const imgStyleParts = [
        'position: absolute',
        'top: 0',
        'left: 0',
        'right: 0',
        'bottom: 0',
        'display: block',
        'pointer-events: none',
      ];

      if (props.textureOptions.resizeMode?.type) {
        const resizeMode = props.textureOptions.resizeMode;
        imgStyleParts.push('width: 100%');
        imgStyleParts.push('height: 100%');
        imgStyleParts.push(`object-fit: ${resizeMode.type}`);

        // Handle clipX and clipY for object-position
        const clipX = (resizeMode as any).clipX ?? 0.5;
        const clipY = (resizeMode as any).clipY ?? 0.5;
        imgStyleParts.push(`object-position: ${clipX * 100}% ${clipY * 100}%`);
      } else if (srcPos !== null) {
        imgStyleParts.push('width: auto');
        imgStyleParts.push('height: auto');
        imgStyleParts.push('object-fit: none');
        imgStyleParts.push(`object-position: -${srcPos.x}px -${srcPos.y}px`);
      } else if (props.width && !props.height) {
        imgStyleParts.push('width: 100%');
        imgStyleParts.push('height: auto');
      } else if (props.height && !props.width) {
        imgStyleParts.push('width: auto');
        imgStyleParts.push('height: 100%');
      } else {
        imgStyleParts.push('width: 100%');
        imgStyleParts.push('height: 100%');
        imgStyleParts.push('object-fit: fill');
      }
      if (hasTint) {
        if (supportsMixBlendMode) {
          imgStyleParts.push('mix-blend-mode: multiply');
        } else {
          imgStyleParts.push('opacity: 0.9');
        }
      }

      imgStyle = imgStyleParts.join('; ') + ';';
    } else if (gradient) {
      bgStyle += `background-image: ${gradient};`;
      bgStyle += `background-repeat: no-repeat;`;
      bgStyle += `background-size: 100% 100%;`;
    } else if (props.color !== 0) {
      bgStyle += `background-color: ${colorToRgba(props.color)};`;
    }

    if (props.shader != null) {
      let effects = props.shader.props?.effects;
      if (Array.isArray(effects)) {
        for (let effect of effects) {
          switch (effect.type) {
            case 'radius': {
              let radius = effect.props?.radius;
              if (typeof radius === 'number' && radius > 0) {
                radiusStyle += `border-radius: ${radius}px;`;
              } else if (Array.isArray(radius) && radius.length === 4) {
                radiusStyle += `border-radius: ${radius[0]}px ${radius[1]}px ${radius[2]}px ${radius[3]}px;`;
              }
              break;
            }
            case 'border':
            case 'borderTop':
            case 'borderBottom':
            case 'borderLeft':
            case 'borderRight': {
              let borderWidth = effect.props?.width;
              let borderColor = effect.props?.color;
              if (
                typeof borderWidth === 'number' &&
                borderWidth !== 0 &&
                typeof borderColor === 'number' &&
                borderColor !== 0
              ) {
                const rgbaColor = colorToRgba(borderColor);
                if (effect.type === 'border') {
                  // Avoid affecting layout sizing while applying uniform borders
                  borderStyle += `box-shadow: inset 0px 0px 0px ${borderWidth}px ${rgbaColor};`;
                } else {
                  const side = effect.type.slice('border'.length).toLowerCase();
                  borderStyle += `border-${side}: ${borderWidth}px solid ${rgbaColor};`;
                }
              }
              break;
            }
            case 'radialGradient': {
              const rg = effect.props as
                | Partial<lng.RadialGradientEffectProps>
                | undefined;
              const colors = Array.isArray(rg?.colors) ? rg!.colors! : [];
              const stops = Array.isArray(rg?.stops) ? rg!.stops! : undefined;
              const pivot = Array.isArray(rg?.pivot) ? rg!.pivot! : [0.5, 0.5];
              const width =
                typeof rg?.width === 'number' ? rg!.width! : props.width || 0;
              const height =
                typeof rg?.height === 'number' ? rg!.height! : width;

              if (colors.length > 0) {
                const gradientStops = buildGradientStops(colors, stops);
                if (gradientStops) {
                  if (colors.length === 1) {
                    // Single color -> solid fill
                    if (srcImg || gradient) {
                      maskStyle += `mask-image: linear-gradient(${gradientStops});`;
                    } else {
                      bgStyle += `background-color: ${colorToRgba(colors[0]!)};`;
                    }
                  } else {
                    const isEllipse =
                      width > 0 && height > 0 && width !== height;
                    const pivotX = (pivot[0] ?? 0.5) * 100;
                    const pivotY = (pivot[1] ?? 0.5) * 100;
                    let sizePart = '';
                    if (width > 0 && height > 0) {
                      if (!isEllipse && width === height) {
                        sizePart = `${Math.round(width)}px`;
                      } else {
                        sizePart = `${Math.round(width)}px ${Math.round(height)}px`;
                      }
                    } else {
                      sizePart = 'closest-side';
                    }
                    const radialGradient = `radial-gradient(${isEllipse ? 'ellipse' : 'circle'} ${sizePart} at ${pivotX.toFixed(2)}% ${pivotY.toFixed(2)}%, ${gradientStops})`;
                    if (srcImg || gradient) {
                      maskStyle += `mask-image: ${radialGradient};`;
                    } else {
                      bgStyle += `background-image: ${radialGradient};`;
                      bgStyle += `background-repeat: no-repeat;`;
                      bgStyle += `background-size: 100% 100%;`;
                    }
                  }
                }
              }
              break;
            }
            case 'linearGradient': {
              const lg = effect.props as
                | Partial<lng.LinearGradientEffectProps>
                | undefined;
              const colors = Array.isArray(lg?.colors) ? lg!.colors! : [];
              const stops = Array.isArray(lg?.stops) ? lg!.stops! : undefined;
              const angleRad = typeof lg?.angle === 'number' ? lg!.angle! : 0; // radians

              if (colors.length > 0) {
                const gradientStops = buildGradientStops(colors, stops);
                if (gradientStops) {
                  if (colors.length === 1) {
                    if (srcImg || gradient) {
                      maskStyle += `mask-image: linear-gradient(${gradientStops});`;
                    } else {
                      bgStyle += `background-color: ${colorToRgba(colors[0]!)};`;
                    }
                  } else {
                    const angleDeg = 180 * (angleRad / Math.PI - 1);
                    const linearGradient = `linear-gradient(${angleDeg.toFixed(2)}deg, ${gradientStops})`;
                    if (srcImg || gradient) {
                      maskStyle += `mask-image: ${linearGradient};`;
                    } else {
                      bgStyle += `background-image: ${linearGradient};`;
                      bgStyle += `background-repeat: no-repeat;`;
                      bgStyle += `background-size: 100% 100%;`;
                    }
                  }
                }
              }
              break;
            }
            default:
              console.warn(`Unknown shader effect type: ${effect.type}`);
              break;
          }
        }
      }
    }

    if (maskStyle !== '') {
      if (!supportsStandardMask && supportsWebkitMask) {
        maskStyle = maskStyle.replace(/mask-/g, '-webkit-mask-');
      } else if (!supportsCssMask) {
        maskStyle = '';
      }
      if (maskStyle !== '') {
        needsBackgroundLayer = true;
      }
    }

    style += radiusStyle;

    if (needsBackgroundLayer) {
      if (node.divBg == null) {
        node.divBg = document.createElement('div');
        node.div.insertBefore(node.divBg, node.div.firstChild);
      } else if (node.divBg.parentElement !== node.div) {
        node.div.insertBefore(node.divBg, node.div.firstChild);
      }

      let bgLayerStyle =
        'position: absolute; top:0; left:0; right:0; bottom:0; z-index: -1; pointer-events: none; overflow: hidden;';
      if (bgStyle) {
        bgLayerStyle += bgStyle;
      }
      if (maskStyle) {
        bgLayerStyle += maskStyle;
      }

      node.divBg.setAttribute('style', bgLayerStyle + radiusStyle);

      if (rawImgSrc) {
        if (!node.imgEl) {
          node.imgEl = document.createElement('img');
          node.imgEl.alt = '';
          node.imgEl.setAttribute('aria-hidden', 'true');

          node.imgEl.addEventListener('load', () => {
            const payload: lng.NodeTextureLoadedPayload = {
              type: 'texture',
              dimensions: {
                width: node.imgEl!.naturalWidth,
                height: node.imgEl!.naturalHeight,
              },
            };
            node.emit('loaded', payload);
            // Apply legacy fallback layout if needed
            const resizeMode = (node.props.textureOptions as any)?.resizeMode;
            const clipX = (resizeMode as any)?.clipX ?? 0.5;
            const clipY = (resizeMode as any)?.clipY ?? 0.5;
            computeLegacyObjectFit(
              node,
              node.imgEl!,
              resizeMode,
              clipX,
              clipY,
              srcPos,
            );
          });

          node.imgEl.addEventListener('error', (e) => {
            node.props.src = null;
            const payload: lng.NodeTextureFailedPayload = {
              type: 'texture',
              error: new Error(`Failed to load image: ${rawImgSrc}`),
            };
            node.emit('failed', payload);
          });
        }
        if (node.imgEl.dataset.rawSrc !== rawImgSrc) {
          node.imgEl.src = rawImgSrc;
          node.imgEl.dataset.rawSrc = rawImgSrc;
        }
        if (node.imgEl.parentElement !== node.divBg) {
          node.divBg.appendChild(node.imgEl);
        }
        node.imgEl.setAttribute('style', imgStyle);
        // If object-fit unsupported, override with JS fallback after style assignment
        if (!supportsObjectFit || !supportsObjectPosition) {
          const resizeMode = (node.props.textureOptions as any)?.resizeMode;
          const clipX = (resizeMode as any)?.clipX ?? 0.5;
          const clipY = (resizeMode as any)?.clipY ?? 0.5;
          computeLegacyObjectFit(
            node,
            node.imgEl,
            resizeMode,
            clipX,
            clipY,
            srcPos,
          );
        }
      } else if (node.imgEl) {
        node.imgEl.remove();
        node.imgEl = undefined;
      }
    } else {
      if (node.imgEl) {
        node.imgEl.remove();
        node.imgEl = undefined;
      }
      if (node.divBg) {
        node.divBg.remove();
        node.divBg = undefined;
      }
      style += bgStyle;
    }

    const needsSeparateBorderLayer = needsBackgroundLayer && maskStyle !== '';

    if (needsSeparateBorderLayer) {
      if (node.divBorder == null) {
        node.divBorder = document.createElement('div');
        node.div.appendChild(node.divBorder);
      }
    } else if (node.divBorder) {
      node.divBorder.remove();
      node.divBorder = undefined;
    }

    if (node.divBorder == null) {
      style += borderStyle;
    } else {
      let borderLayerStyle =
        'position: absolute; top:0; left:0; right:0; bottom:0; z-index: -1; pointer-events: none;';
      borderLayerStyle += borderStyle;
      node.divBorder.setAttribute('style', borderLayerStyle + radiusStyle);
    }
  }

  node.div.setAttribute('style', style);
}

const fontFamiliesToLoad = new Set<string>();

const textNodesToMeasure = new Set<DOMText>();

type Size = { width: number; height: number };

function getElSize(node: DOMNode): Size {
  let rect = node.div.getBoundingClientRect();

  let dpr = Config.rendererOptions?.deviceLogicalPixelRatio ?? 1;
  rect.height /= dpr;
  rect.width /= dpr;

  for (;;) {
    if (node.props.scale != null && node.props.scale !== 1) {
      rect.height /= node.props.scale;
      rect.width /= node.props.scale;
    } else {
      rect.height /= node.props.scaleY;
      rect.width /= node.props.scaleX;
    }

    if (node.parent instanceof DOMNode) {
      node = node.parent;
    } else {
      break;
    }
  }

  return rect;
}

/*
  Text nodes with contain 'width' or 'none'
  need to have their height or width calculated.
  And then cause the flex layout to be recalculated.
*/
function updateDOMTextSize(node: DOMText): void {
  let size: Size;
  switch (node.contain) {
    case 'width':
      size = getElSize(node);
      if (node.props.height !== size.height) {
        node.props.height = size.height;
        updateNodeStyles(node);
        const payload: lng.NodeTextLoadedPayload = {
          type: 'text',
          dimensions: {
            width: node.props.width,
            height: node.props.height,
          },
        };
        node.emit('loaded', payload);
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
        updateNodeStyles(node);
        const payload: lng.NodeTextLoadedPayload = {
          type: 'text',
          dimensions: {
            width: node.props.width,
            height: node.props.height,
          },
        };
        node.emit('loaded', payload);
      }
      break;
  }
}

function updateDOMTextMeasurements() {
  textNodesToMeasure.forEach(updateDOMTextSize);
  textNodesToMeasure.clear();
}

function scheduleUpdateDOMTextMeasurement(node: DOMText) {
  /*
    Make sure the font is loaded before measuring
  */
  if (node.fontFamily && !fontFamiliesToLoad.has(node.fontFamily)) {
    fontFamiliesToLoad.add(node.fontFamily);
    document.fonts.load(`16px ${node.fontFamily}`);
  }

  if (textNodesToMeasure.size === 0) {
    if (document.fonts.status === 'loaded') {
      setTimeout(updateDOMTextMeasurements);
    } else {
      document.fonts.ready.then(updateDOMTextMeasurements);
    }
  }

  textNodesToMeasure.add(node);
}

function updateNodeData(node: DOMNode | DOMText) {
  for (let key in node.data) {
    let keyValue: unknown = node.data[key];
    if (keyValue === undefined) {
      node.div.removeAttribute('data-' + key);
    } else {
      node.div.setAttribute('data-' + key, String(keyValue));
    }
  }
}

function resolveNodeDefaults(
  props: Partial<IRendererNodeProps>,
): IRendererNodeProps {
  const color = props.color ?? 0x00000000;

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
    zIndex: Math.ceil(props.zIndex ?? 0),
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
    preventCleanup: props.preventCleanup ?? false,
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
    debug: props.debug ?? {},
  };
}

const defaultShader: IRendererShader = {
  shaderType: '',
  props: undefined,
};

let lastNodeId = 0;

class DOMNode extends EventEmitter implements IRendererNode {
  div = document.createElement('div');
  divBg: HTMLElement | undefined;
  divBorder: HTMLElement | undefined;
  imgEl: HTMLImageElement | undefined;

  id = ++lastNodeId;

  renderState: lng.CoreNodeRenderState = 0 /* Init */;

  preventCleanup = true;

  constructor(
    public stage: IRendererStage,
    public props: IRendererNodeProps,
  ) {
    super();

    // @ts-ignore
    this.div._node = this;
    this.div.setAttribute('data-id', String(this.id));
    elMap.set(this, this.div);

    updateNodeParent(this);
    updateNodeStyles(this);
    updateNodeData(this);
  }

  destroy(): void {
    elMap.delete(this);
    this.div.parentNode!.removeChild(this.div);
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
    this.props.zIndex = Math.ceil(v);
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
    this.div.innerText = props.text;
  }

  get text() {
    return this.props.text;
  }
  set text(v) {
    this.props.text = v;
    this.div.innerText = v;
    scheduleUpdateDOMTextMeasurement(this);
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

  this.root.div.style.left = `${left}px`;
  this.root.div.style.top = `${top}px`;
  this.root.div.style.width = `${width}px`;
  this.root.div.style.height = `${height}px`;
  this.root.div.style.position = 'absolute';
  this.root.div.style.transformOrigin = '0 0 0';
  this.root.div.style.transform = `scale(${dpr}, ${dpr})`;
  this.root.div.style.overflow = 'hidden';
}

export class DOMRendererMain implements IRendererMain {
  root: DOMNode;
  canvas: HTMLCanvasElement;
  stage: IRendererStage;
  private eventListeners: Map<string, Set<(target: any, data: any) => void>> =
    new Map();

  constructor(
    public settings: lng.RendererMainSettings,
    rawTarget: string | HTMLElement,
  ) {
    let target: HTMLElement;
    if (typeof rawTarget === 'string') {
      let result = document.getElementById(rawTarget);
      if (result instanceof HTMLElement) {
        target = result;
      } else {
        throw new Error(`Target #${rawTarget} not found`);
      }
    } else {
      target = rawTarget;
    }

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
      animationManager: {
        registerAnimation(anim) {
          console.log('registerAnimation', anim);
        },
        unregisterAnimation(anim) {
          console.log('unregisterAnimation', anim);
        },
      },
    };

    this.root = new DOMNode(
      this.stage,
      resolveNodeDefaults({
        width: settings.appWidth ?? 1920,
        height: settings.appHeight ?? 1080,
        shader: defaultShader,
        zIndex: 1,
      }),
    );
    this.stage.root = this.root;
    target.appendChild(this.root.div);

    if (Config.fontSettings.fontFamily) {
      this.root.div.style.fontFamily = Config.fontSettings.fontFamily;
    }
    if (Config.fontSettings.fontSize) {
      this.root.div.style.fontSize = Config.fontSettings.fontSize + 'px';
    }
    if (Config.fontSettings.lineHeight) {
      this.root.div.style.lineHeight = Config.fontSettings.lineHeight + 'px';
    } else {
      this.root.div.style.lineHeight = '1.2';
    }
    if (Config.fontSettings.fontWeight) {
      if (typeof Config.fontSettings.fontWeight === 'number') {
        this.root.div.style.fontWeight = Config.fontSettings.fontWeight + 'px';
      } else {
        this.root.div.style.fontWeight = Config.fontSettings.fontWeight;
      }
    }

    updateRootPosition.call(this);

    new MutationObserver(updateRootPosition.bind(this)).observe(this.canvas, {
      attributes: true,
    });
    new ResizeObserver(updateRootPosition.bind(this)).observe(this.canvas);
    window.addEventListener('resize', updateRootPosition.bind(this));
  }

  once<K extends string | number>(
    event: Extract<K, string>,
    listener: { [s: string]: (target: any, data: any) => void }[K],
  ): void {
    const wrappedListener = (target: any, data: any) => {
      this.off(event, wrappedListener as any);
      listener(target, data);
    };
    this.on(event, wrappedListener);
  }

  on(name: string, callback: (target: any, data: any) => void) {
    let listeners = this.eventListeners.get(name);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(name, listeners);
    }
    listeners.add(callback);
  }

  off<K extends string | number>(
    event: Extract<K, string>,
    listener: { [s: string]: (target: any, data: any) => void }[K],
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as any);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  emit<K extends string | number>(
    event: Extract<K, string>,
    data: Parameters<any>[1],
  ): void;
  emit<K extends string | number>(
    event: Extract<K, string>,
    target: any,
    data: Parameters<any>[1],
  ): void;
  emit<K extends string | number>(
    event: Extract<K, string>,
    targetOrData: any,
    maybeData?: Parameters<any>[1],
  ): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    const hasExplicitTarget = arguments.length === 3;
    const target = hasExplicitTarget ? targetOrData : this.root;
    const data = hasExplicitTarget ? maybeData : targetOrData;

    for (const listener of Array.from(listeners)) {
      try {
        listener(target, data);
      } catch (error) {
        console.error(`Error in listener for event "${event}"`, error);
      }
    }
  }

  createNode(props: Partial<IRendererNodeProps>): IRendererNode {
    return new DOMNode(this.stage, resolveNodeDefaults(props));
  }

  createTextNode(props: Partial<IRendererTextNodeProps>): IRendererTextNode {
    return new DOMText(this.stage, resolveTextNodeDefaults(props));
  }

  createShader<ShType extends keyof lng.ShaderMap>(
    shaderType: ShType,
    props?: ExtractProps<lng.ShaderMap[ShType]>,
  ): lng.ShaderController<ShType> {
    return {
      shaderType,
      props,
      program: {},
    } as unknown as lng.ShaderController<ShType>;
  }

  createTexture<Type extends keyof lng.TextureMap>(
    textureType: keyof lng.TextureMap,
    props: IRendererTextureProps,
  ): InstanceType<lng.TextureMap[Type]> {
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
    return { type, props } as InstanceType<lng.TextureMap[Type]>;
  }

  createEffect<
    Type extends keyof lng.EffectMap,
    Name extends string | undefined = undefined,
  >(
    type: Type,
    props: ExtractProps<lng.EffectMap[Type]>,
    name?: Name,
  ): lng.EffectDesc<{ name: Name; type: Type }> {
    return { type, props, name: name as Name } as unknown as lng.EffectDesc<{
      name: Name;
      type: Type;
    }>;
  }
}

export function loadFontToDom(font: lng.WebTrFontFaceOptions): void {
  const fontFaceDescriptors: FontFaceDescriptors | undefined = font.descriptors
    ? {
        ...font.descriptors,
        weight:
          typeof font.descriptors.weight === 'number'
            ? String(font.descriptors.weight)
            : font.descriptors.weight,
      }
    : undefined;

  const fontFace = new FontFace(
    font.fontFamily,
    `url(${font.fontUrl})`,
    fontFaceDescriptors,
  );

  if (typeof document !== 'undefined' && 'fonts' in document) {
    const fontSet = document.fonts as FontFaceSet & {
      add?: (font: FontFace) => FontFaceSet;
    };
    fontSet.add?.(fontFace);
  }
}

export function isDomRenderer(
  r: lng.RendererMain | IRendererMain,
): r is IRendererMain {
  return r instanceof DOMRendererMain;
}
