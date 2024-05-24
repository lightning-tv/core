import type { RendererMainSettings } from '@lightningjs/renderer';
import { MainCoreDriver, RendererMain } from '@lightningjs/renderer';

export let renderer: RendererMain;
export let createShader: RendererMain['createShader'];

export function startLightningRenderer(
  options: Partial<RendererMainSettings> = {},
  rootId: string | HTMLElement = 'app',
): RendererMain {
  const driver = new MainCoreDriver();
  renderer = new RendererMain(options, rootId, driver);
  createShader = renderer.createShader.bind(renderer);
  return renderer;
}
