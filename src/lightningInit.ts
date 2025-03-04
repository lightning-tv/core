import type {
  RendererMainSettings,
  SdfTrFontFaceOptions,
  WebTrFontFaceOptions,
} from '@lightningjs/renderer';
import {
  SdfTrFontFace,
  WebTrFontFace,
  RendererMain,
} from '@lightningjs/renderer';
import { DOMRendererMain } from './domRenderer.js';
import { Config } from './config.js';

type SdfFontType = 'ssdf' | 'msdf';

export let renderer: RendererMain;

export const getRenderer = () => renderer;

export function startLightningRenderer(
  options: RendererMainSettings,
  rootId: string | HTMLElement = 'app',
) {
  renderer = Config.domRendering
    ? new DOMRendererMain(options, rootId)
    : new RendererMain(options, rootId);
  return renderer;
}

export function loadFonts(
  fonts: (
    | WebTrFontFaceOptions
    | (Partial<SdfTrFontFaceOptions> & { type: SdfFontType })
  )[],
) {
  const stage = renderer.stage;

  for (const font of fonts) {
    if ('type' in font && (font.type === 'msdf' || font.type === 'ssdf')) {
      if (renderer.stage.renderer.mode === 'webgl') {
        stage.fontManager.addFontFace(
          new SdfTrFontFace(font.type, {
            ...font,
            stage,
          } as SdfTrFontFaceOptions),
        );
      }
    } else if ('fontUrl' in font) {
      stage.fontManager.addFontFace(new WebTrFontFace(font));
    }
  }
}
