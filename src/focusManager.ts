import { Config } from './config.js';
import { type ElementNode } from './elementNode.js';

import type {
  KeyNameOrKeyCode,
  KeyHoldOptions,
  KeyMap,
  EventHandlers,
} from './intrinsicTypes.js';

const keyMapEntries: Record<KeyNameOrKeyCode, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Enter: 'Enter',
  l: 'Last',
  ' ': 'Space',
  Backspace: 'Back',
  Escape: 'Escape',
};

const keyHoldMapEntries: Record<KeyNameOrKeyCode, string> = {
  Enter: 'EnterHold',
};

const flattenKeyMap = (keyMap: any, targetMap: any): void => {
  for (const [key, value] of Object.entries(keyMap)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        targetMap[v] = key;
      });
    } else if (value === null) {
      delete targetMap[key];
    } else {
      targetMap[value as keyof any] = key;
    }
  }
};

let activeElement: ElementNode | undefined;
export const setActiveElement = (elm: ElementNode) => {
  updateFocusPath(elm, activeElement);
  activeElement = elm;
  // Callback for libraries to use signals / refs
  Config.setActiveElement(elm);
};

let focusPath: ElementNode[] = [];
const updateFocusPath = (
  currentFocusedElm: ElementNode,
  prevFocusedElm: ElementNode | undefined,
) => {
  let current = currentFocusedElm;
  const fp: ElementNode[] = [];
  while (current) {
    if (!current.states.has('focus') || current === currentFocusedElm) {
      current.states.add('focus');
      current.onFocus?.call(current, currentFocusedElm, prevFocusedElm);
      current.onFocusChanged?.call(
        current,
        true,
        currentFocusedElm,
        prevFocusedElm,
      );
    }
    fp.push(current);
    current = current.parent!;
  }

  focusPath.forEach((elm) => {
    if (!fp.includes(elm)) {
      elm.states.remove('focus');
      elm.onBlur?.call(elm, currentFocusedElm, prevFocusedElm);
      elm.onFocusChanged?.call(elm, false, currentFocusedElm, prevFocusedElm);
    }
  });

  focusPath = fp;
  return fp;
};

const propagateKeyDown = (
  e: KeyboardEvent,
  mappedEvent: string | undefined,
  isHold: boolean,
) => {
  let finalFocusElm: ElementNode | undefined = undefined;
  for (const elm of focusPath) {
    finalFocusElm = finalFocusElm || elm;
    if (mappedEvent) {
      const onKeyHandler =
        elm[`on${mappedEvent}` as keyof EventHandlers<KeyMap>];
      if (onKeyHandler?.call(elm, e, elm, finalFocusElm) === true) {
        break;
      }
    } else {
      console.log(`Unhandled key event: ${e.key || e.keyCode}`);
    }
    const fallbackFunction = isHold ? elm.onKeyHold : elm.onKeyPress;
    if (
      fallbackFunction?.call(elm, e, mappedEvent, elm, finalFocusElm) === true
    ) {
      break;
    }
  }
  return false;
};

const DEFAULT_KEY_HOLD_THRESHOLD = 150; // ms
const keyHoldTimeouts: { [key: KeyNameOrKeyCode]: number } = {};

const keyHoldCallback = (
  e: KeyboardEvent,
  mappedKeyHoldEvent: string | undefined,
) => {
  delete keyHoldTimeouts[e.key || e.keyCode];
  propagateKeyDown(e, mappedKeyHoldEvent, true);
};

const handleKeyEvents = (
  delay: number,
  keypress?: KeyboardEvent,
  keyup?: KeyboardEvent,
) => {
  if (keypress) {
    const key: KeyNameOrKeyCode = keypress.key || keypress.keyCode;
    const mappedKeyHoldEvent = keyHoldMapEntries[key];
    const mappedKeyEvent = keyMapEntries[key];
    if (!mappedKeyHoldEvent) {
      propagateKeyDown(keypress, mappedKeyEvent, false);
    } else {
      if (keyHoldTimeouts[key]) {
        clearTimeout(keyHoldTimeouts[key]);
      }
      keyHoldTimeouts[key] = window.setTimeout(
        () => keyHoldCallback(keypress, mappedKeyHoldEvent),
        delay,
      );
    }
  }

  if (keyup) {
    const key: KeyNameOrKeyCode = keyup.key || keyup.keyCode;
    const mappedKeyEvent = keyMapEntries[key];
    if (keyHoldTimeouts[key]) {
      clearTimeout(keyHoldTimeouts[key]);
      delete keyHoldTimeouts[key];
      propagateKeyDown(keyup, mappedKeyEvent, false);
    }
  }
};

interface FocusManagerOptions {
  userKeyMap?: Partial<KeyMap>;
  keyHoldOptions?: KeyHoldOptions;
  ownerContext?: (cb: () => void) => void;
}

export const useFocusManager = ({
  userKeyMap,
  keyHoldOptions,
  ownerContext = (cb) => {
    cb();
  },
}: FocusManagerOptions = {}) => {
  if (userKeyMap) {
    flattenKeyMap(userKeyMap, keyMapEntries);
  }

  if (keyHoldOptions?.userKeyHoldMap) {
    flattenKeyMap(keyHoldOptions.userKeyHoldMap, keyHoldMapEntries);
  }

  const delay = keyHoldOptions?.holdThreshold || DEFAULT_KEY_HOLD_THRESHOLD;
  const runKeyEvent = handleKeyEvents.bind(null, delay);

  // Owner context is for frameworks that need effects
  const keyPressHandler = (event: KeyboardEvent) =>
    ownerContext(() => {
      runKeyEvent(event, undefined);
    });

  const keyUpHandler = (event: KeyboardEvent) =>
    ownerContext(() => {
      runKeyEvent(undefined, event);
    });

  document.addEventListener('keyup', keyUpHandler);
  document.addEventListener('keydown', keyPressHandler);

  return {
    cleanup: () => {
      document.removeEventListener('keydown', keyPressHandler);
      document.removeEventListener('keyup', keyUpHandler);
      for (const [_, timeout] of Object.entries(keyHoldTimeouts)) {
        if (timeout) clearTimeout(timeout);
      }
    },
    focusPath: () => focusPath,
  };
};
