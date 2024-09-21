import type {
  AnimationSettings,
  RendererMainSettings,
} from '@lightningjs/renderer';
import type { IntrinsicTextNodeStyleProps } from './intrinsicTypes.js';
import { type ElementNode } from './elementNode.js';

interface Config {
  debug: boolean;
  focusDebug: boolean;
  animationSettings?: Partial<AnimationSettings> | undefined;
  animationsEnabled: boolean;
  fontSettings: Partial<IntrinsicTextNodeStyleProps>;
  rendererOptions?: Partial<RendererMainSettings>;
  setActiveElement: (elm: ElementNode) => void;
}

function isDevEnv(): boolean {
  return !!(import.meta.env && import.meta.env.DEV);
}
export const isDev = isDevEnv() || false;

export const Config: Config = {
  debug: false,
  focusDebug: false,
  animationsEnabled: true,
  animationSettings: {
    duration: 250,
    easing: 'ease-in-out',
  },
  fontSettings: {
    fontFamily: 'Ubuntu',
    fontSize: 100,
  },
  setActiveElement: () => {},
};
