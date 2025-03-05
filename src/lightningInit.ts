import * as lng from '@lightningjs/renderer';
import { DOMRendererMain } from './domRenderer.js';
import { Config } from './config.js';

export type SdfFontType = 'ssdf' | 'msdf';

export let renderer: lng.RendererMain;

export const getRenderer = () => renderer;

export function startLightningRenderer(
  options: lng.RendererMainSettings,
  rootId: string | HTMLElement = 'app',
) {
  renderer = Config.domRendering
    ? new DOMRendererMain(options, rootId)
    : new lng.RendererMain(options, rootId);
  return renderer;
}

export function loadFonts(
  fonts: (
    | lng.WebTrFontFaceOptions
    | (Partial<lng.SdfTrFontFaceOptions> & { type: SdfFontType })
  )[],
) {
  if (renderer.stage == null)
    return
  
  for (const font of fonts) {
    // WebGL — SDF
    if (renderer.stage.renderer.mode === 'webgl' &&
        'type' in font &&
        (font.type === 'msdf' || font.type === 'ssdf')
    ) {
      renderer.stage.fontManager.addFontFace(
        new lng.SdfTrFontFace(font.type, {
          ...font,
          stage: renderer.stage,
        } as lng.SdfTrFontFaceOptions),
      );
    }
    // Canvas — Web
    else if ('fontUrl' in font) {
      renderer.stage.fontManager.addFontFace(new lng.WebTrFontFace(font));
    }
  }
}
