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
  /** Whether the DOM renderer should be used instead of `@lightningjs/renderer` */
  var __LIGHTNING_DOM_RENDERING__: boolean | undefined;
  /** Whether element shaders should be disabled */
  var __LIGHTNING_DISABLE_SHADERS__: boolean | undefined;
}

export const isDev = !!(import.meta.env && import.meta.env.DEV);

/** Whether the DOM renderer is used instead of `@lightningjs/renderer` */
export const DOM_RENDERING =
  typeof __LIGHTNING_DOM_RENDERING__ === 'boolean' &&
  __LIGHTNING_DOM_RENDERING__;

/** Whether element shaders are enabled */
export const SHADERS_ENABLED = !(
  typeof __LIGHTNING_DISABLE_SHADERS__ === 'boolean' &&
  __LIGHTNING_DISABLE_SHADERS__
);

/**
  RUNTIME LIGHTNING CONFIGURATION \
  This configuration can be set at runtime, but it is recommended to set it
  before running any Lightning modules to ensure consistent behavior across the application.
*/
export interface Config {
  debug: boolean;
  focusDebug: boolean;
  keyDebug: boolean;
  animationSettings?: AnimationSettings;
  animationsEnabled: boolean;
  fontSettings: Partial<TextProps>;
  rendererOptions?: Partial<RendererMainSettings>;
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
