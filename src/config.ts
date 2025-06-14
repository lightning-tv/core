import type { RendererMainSettings } from '@lightningjs/renderer';
import type {
  TextProps,
  AnimationSettings,
  DollarString,
} from './intrinsicTypes.js';
import { type ElementNode } from './elementNode.js';

export interface Config {
  debug: boolean;
  focusDebug: boolean;
  keyDebug: boolean;
  simpleAnimationsEnabled?: boolean;
  animationSettings?: AnimationSettings;
  animationsEnabled: boolean;
  fontSettings: Partial<TextProps>;
  rendererOptions?: Partial<RendererMainSettings>;
  setActiveElement: (elm: ElementNode) => void;
  focusStateKey: DollarString;
  lockStyles?: boolean;
}

function isDevEnv(): boolean {
  return !!(import.meta.env && import.meta.env.DEV);
}
export const isDev = isDevEnv() || false;

function shadersEnabled(): boolean {
  return !(import.meta.env && import.meta.env.VITE_DISABLE_SHADERS === 'true');
}
export const SHADERS_ENABLED = shadersEnabled();

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
