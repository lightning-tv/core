import type {
  AnimationSettings,
  RendererMainSettings,
} from '@lightningjs/renderer';
import type { IntrinsicTextNodeStyleProps } from './intrinsicTypes.js';

interface Config {
  debug: boolean;
  animationSettings: Partial<AnimationSettings>;
  animationsEnabled: boolean;
  fontSettings: Partial<IntrinsicTextNodeStyleProps>;
  rendererOptions?: Partial<RendererMainSettings>;
}

declare global {
  interface ImportMeta {
    env: {
      DEV: boolean;
      // Add other environment variables here if needed
    };
  }
}

function isDevEnv(): boolean {
  return !!(import.meta.env && import.meta.env.DEV);
}
export const isDev = isDevEnv() || false;

export const Config: Config = {
  debug: false,
  animationsEnabled: true,
  animationSettings: {
    duration: 250,
    easing: 'ease-in-out',
  },
  fontSettings: {
    fontFamily: 'Ubuntu',
    fontSize: 100,
  },
};
