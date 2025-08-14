import type * as lngr2 from 'lngr2';
import type * as lngr3 from 'lngr3';
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
  /** Whether the DOM renderer should be used instead of `@lightningjs/renderer` */
  var __LIGHTNING_DOM_RENDERING__: boolean | undefined;
  /** Whether element shaders should be disabled */
  var __LIGHTNING_DISABLE_SHADERS__: boolean | undefined;
  /** If should use `@lightningjs/renderer` v3 or v2 */
  var __LIGHTNING_RENDERER_V3__: boolean | undefined;
  /** Whether is in development environment */
  var __DEV__: boolean | undefined;

  /** Could be set by vite or other bundler */
  interface ImportMetaEnv {
    DEV?: unknown;
  }
  interface ImportMeta {
    env?: ImportMetaEnv;
  }
}

export const isDev =
  !!(import.meta.env && import.meta.env.DEV) ||
  (typeof __DEV__ === 'boolean' && __DEV__);
export const DEV = isDev;

/** Whether the DOM renderer is used instead of `@lightningjs/renderer` */
export const DOM_RENDERING =
  typeof __LIGHTNING_DOM_RENDERING__ === 'boolean' &&
  __LIGHTNING_DOM_RENDERING__;

/** Whether element shaders are enabled */
export const SHADERS_ENABLED = !(
  typeof __LIGHTNING_DISABLE_SHADERS__ === 'boolean' &&
  __LIGHTNING_DISABLE_SHADERS__
);
/** If should use `@lightningjs/renderer` v3 or v2 */
export const LIGHTNING_RENDERER_V3 =
  typeof __LIGHTNING_RENDERER_V3__ === 'boolean' && __LIGHTNING_RENDERER_V3__;

export type RendererOptions = lngr2.RendererMainSettings &
  lngr3.RendererMainSettings;

/**
  RUNTIME LIGHTNING CONFIGURATION \
  This configuration can be set at runtime, but it is recommended to set it
  before running any Lightning modules to ensure consistent behavior across the application.
*/
export interface Config {
  debug: boolean;
  focusDebug: boolean;
  keyDebug: boolean;
  simpleAnimationsEnabled?: boolean;
  animationSettings?: AnimationSettings;
  animationsEnabled: boolean;
  fontSettings: Partial<TextProps>;
  rendererOptions?: Partial<RendererOptions>;
  setActiveElement: (elm: ElementNode) => void;
  focusStateKey: DollarString;
  lockStyles?: boolean;
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
