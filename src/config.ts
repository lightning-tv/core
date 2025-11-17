import type { RendererMainSettings } from '@lightningjs/renderer';
import type {
  TextProps,
  AnimationSettings,
  DollarString,
} from './intrinsicTypes.js';
import { type ElementNode } from './elementNode.js';

/**
  STATIC LIGHTNING CONFIGURATION \
  Replace the values below with in your build system, \
  or set them in the global scope before importing lightning-core.
*/
declare global {
  /** Could be set by vite or other bundler */
  interface ImportMetaEnv {
    DEV?: unknown;
    VITE_LIGHTNING_DOM_RENDERING?: unknown;
    VITE_LIGHTNING_DISABLE_SHADERS?: unknown;
  }
  interface ImportMeta {
    env?: ImportMetaEnv;
  }
}

export const isDev = !!(import.meta.env && import.meta.env.DEV);
export const DOM_RENDERING = !!(
  import.meta.env && import.meta.env.VITE_LIGHTNING_DOM_RENDERING === 'true'
);
export const SHADERS_ENABLED = !!(
  import.meta.env && import.meta.env.VITE_LIGHTNING_DISABLE_SHADERS !== 'true'
);

/**
  RUNTIME LIGHTNING CONFIGURATION \
  This configuration can be set at runtime, but it is recommended to set it
  before running any Lightning modules to ensure consistent behavior across the application.
*/
export interface Config {
  animationsEnabled: boolean;
  animationSettings?: AnimationSettings;
  debug: boolean;
  domRendererEnabled?: boolean;
  focusDebug: boolean;
  focusStateKey: DollarString;
  fontSettings: Partial<TextProps>;
  keyDebug: boolean;
  lockStyles?: boolean;
  rendererOptions?: Partial<RendererMainSettings>;
  setActiveElement: (elm: ElementNode) => void;
  simpleAnimationsEnabled?: boolean;
  throttleInput?: number;
}

export const Config: Config = {
  debug: false,
  focusDebug: false,
  keyDebug: false,
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
  focusStateKey: '$focus',
  lockStyles: true,
};
