import type { RendererMainSettings } from '@lightningjs/renderer';
import { RendererMain } from '@lightningjs/renderer';

export let renderer: RendererMain;
export let createShader: RendererMain['createShader'];

export function startLightningRenderer(
  options: Partial<RendererMainSettings> = {},
  rootId: string | HTMLElement = 'app',
): RendererMain {
  renderer = new RendererMain(options, rootId);
  createShader = renderer.createShader.bind(renderer);
  return renderer;
}
