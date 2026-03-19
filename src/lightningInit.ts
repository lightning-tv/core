import * as lng from '@lightningjs/renderer';
import {
  DOMRendererMain,
  isDomRenderer,
  loadFontToDom,
} from './dom-renderer/domRenderer.js';
import { Config, DOM_RENDERING } from './config.js';
import { DomRendererMainSettings } from './dom-renderer/domRendererTypes.js';

export type SdfFontType = 'ssdf' | 'msdf';
// Global renderer instance: can be either the Lightning or DOM implementation
export let renderer: lng.RendererMain | DOMRendererMain;

export const getRenderer = () => renderer;

export function startLightningRenderer(
  options: lng.RendererMainSettings | DomRendererMainSettings,
  rootId: string | HTMLElement = 'app',
) {
  const enableDomRenderer = DOM_RENDERING && Config.domRendererEnabled;

  renderer = enableDomRenderer
    ? new DOMRendererMain(options, rootId)
    : new lng.RendererMain(options as lng.RendererMainSettings, rootId);
  return renderer;
}

export function loadFonts(
  fonts: (
    | lng.WebTrFontFaceOptions
    | (Partial<lng.SdfTrFontFaceOptions> & { type: SdfFontType })
  )[],
) {
  const enableDomRenderer = DOM_RENDERING && Config.domRendererEnabled;
  for (const font of fonts) {
    // WebGL — SDF
    if (
      renderer.stage.renderer.mode === 'webgl' &&
      'type' in font &&
      (font.type === 'msdf' || font.type === 'ssdf')
    ) {
      renderer.stage.fontManager.addFontFace(
        new lng.SdfTrFontFace(font.type, {
          ...font,
          stage: renderer.stage as any,
        } as lng.SdfTrFontFaceOptions),
      );
    }
    // Canvas — Web
    else if ('fontUrl' in font) {
      if (enableDomRenderer) {
        loadFontToDom(font);
      } else {
        renderer.stage.fontManager.addFontFace(new lng.WebTrFontFace(font));
      }
    }
  }
}
