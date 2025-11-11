// Utilities extracted from domRenderer.ts for clarity
import { Config } from '../config.js';
import { DomNodeLike } from './domRendererTypes.js';

export const colorToRgba = (c: number) =>
  `rgba(${(c >> 24) & 0xff},${(c >> 16) & 0xff},${(c >> 8) & 0xff},${(c & 0xff) / 255})`;

export function buildGradientStops(colors: number[], stops?: number[]): string {
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

export function getNodeLineHeight(props: {
  lineHeight?: number;
  fontSize: number;
}): number {
  return (
    props.lineHeight ?? Config.fontSettings.lineHeight ?? 1.2 * props.fontSize
  );
}

/** Legacy object-fit fall back for unsupported browsers */
export function computeLegacyObjectFit(
  node: DomNodeLike,
  img: HTMLImageElement,
  resizeMode: ({ type?: string } & Record<string, any>) | undefined,
  clipX: number,
  clipY: number,
  srcPos: null | { x: number; y: number },
  supportsObjectFit: boolean,
  supportsObjectPosition: boolean,
) {
  if (supportsObjectFit && supportsObjectPosition) return;
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
  }
  let offsetX = (containerW - drawW) * clipX;
  let offsetY = (containerH - drawH) * clipY;
  if (srcPos) {
    offsetX = -srcPos.x;
    offsetY = -srcPos.y;
  }
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
    styleParts[1] = `width: ${naturalW}px`;
    styleParts[2] = `height: ${naturalH}px`;
  }
  img.setAttribute('style', styleParts.join('; ') + ';');
}

export function applySubTextureScaling(
  node: DomNodeLike,
  img: HTMLImageElement,
  srcPos: { x: number; y: number } | null,
) {
  if (!srcPos) return;
  const regionW = (node.props as any).srcWidth ?? (srcPos as any).width;
  const regionH = (node.props as any).srcHeight ?? (srcPos as any).height;
  if (!regionW || !regionH) return;
  const targetW = node.props.width || regionW;
  const targetH = node.props.height || regionH;
  if (targetW === regionW && targetH === regionH) return;
  const naturalW = img.naturalWidth || regionW;
  const naturalH = img.naturalHeight || regionH;
  const scaleX = targetW / regionW;
  const scaleY = targetH / regionH;
  img.style.width = naturalW + 'px';
  img.style.height = naturalH + 'px';
  img.style.objectFit = 'none';
  img.style.objectPosition = '0 0';
  img.style.transformOrigin = '0 0';
  const translateX = -srcPos.x;
  const translateY = -srcPos.y;
  img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
  if (node.divBg) {
    const styleEl = node.divBg.style as any;
    if (
      styleEl.maskImage ||
      styleEl.webkitMaskImage ||
      /mask-image:/.test(node.divBg.getAttribute('style') || '')
    ) {
      const maskW = Math.round(naturalW * scaleX);
      const maskH = Math.round(naturalH * scaleY);
      const maskPosX = Math.round(translateX * scaleX);
      const maskPosY = Math.round(translateY * scaleY);
      styleEl.setProperty?.('mask-size', `${maskW}px ${maskH}px`);
      styleEl.setProperty?.('mask-position', `${maskPosX}px ${maskPosY}px`);
      styleEl.setProperty?.('-webkit-mask-size', `${maskW}px ${maskH}px`);
      styleEl.setProperty?.(
        '-webkit-mask-position',
        `${maskPosX}px ${maskPosY}px`,
      );
    }
  }
}
