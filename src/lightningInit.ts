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
type SdfFontType = 'ssdf' | 'msdf';

export let renderer: RendererMain;
export let createShader: RendererMain['createShader'];

export const getRenderer = () => renderer;

export function startLightningRenderer(
  options: RendererMainSettings,
  rootId: string | HTMLElement = 'app',
) {
  renderer = new RendererMain(options, rootId);
  createShader = renderer.createShader.bind(renderer);
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
    if ('type' in font) {
      if (renderer.stage.renderer.mode === 'webgl') {
        stage.fontManager.addFontFace(
          new SdfTrFontFace(font.type, {
            ...font,
            stage,
          } as SdfTrFontFaceOptions),
        );
      }
    } else {
      stage.fontManager.addFontFace(new WebTrFontFace(font));
    }
  }
}
