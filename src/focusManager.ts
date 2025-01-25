import { Config } from './config.js';
export type * from './focusKeyTypes.js';
import { ElementNode } from './elementNode.js';
import type {
  KeyNameOrKeyCode,
  KeyHoldOptions,
  KeyMap,
  FocusNode,
} from './focusKeyTypes.js';
import { isFunction } from './utils.js';

declare module '@lightningtv/core' {
  interface ElementNode extends FocusNode {}
  interface IntrinsicCommonProps extends FocusNode {}
}

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
  // Enter: 'EnterHold',
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

let needFocusDebugStyles = true;
const addFocusDebug = (
  prevFocusPath: ElementNode[],
  newFocusPath: ElementNode[],
) => {
  if (needFocusDebugStyles) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
      [data-focus="3"] {
        border: 2px solid rgba(255, 33, 33, 0.2);
        border-radius: 5px;
        transition: border-color 0.3s ease;
      }

      [data-focus="2"] {
        border: 2px solid rgba(255, 33, 33, 0.4);
        border-radius: 5px;
        transition: border-color 0.3s ease;
      }

      [data-focus="1"] {
        border: 4px solid rgba(255, 33, 33, 0.9);
        border-radius: 5px;
        transition: border-color 0.5s ease;
      }
    `;
    document.head.appendChild(style);
    needFocusDebugStyles = false;
  }

  prevFocusPath.forEach((elm) => {
    elm.data = {
      ...elm.data,
      focus: undefined,
    };
  });

  newFocusPath.forEach((elm, i) => {
    elm.data = {
      ...elm.data,
      focus: i + 1,
    };
  });
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
    if (
      !current.states.has(Config.focusStateKey) ||
      current === currentFocusedElm
    ) {
      current.states.add(Config.focusStateKey);
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
      elm.states.remove(Config.focusStateKey);
      elm.onBlur?.call(elm, currentFocusedElm, prevFocusedElm);
      elm.onFocusChanged?.call(elm, false, currentFocusedElm, prevFocusedElm);
    }
  });

  if (Config.focusDebug) {
    addFocusDebug(focusPath, fp);
  }

  focusPath = fp;
  return fp;
};

const propagateKeyPress = (
  e: KeyboardEvent,
  mappedEvent: string | undefined,
  isHold: boolean = false,
  isUp: boolean = false,
) => {
  let finalFocusElm: ElementNode | undefined = undefined;

  if (mappedEvent) {
    for (const elm of focusPath) {
      finalFocusElm = finalFocusElm || elm;
      const onKeyHandler = (
        isUp ? elm[`on${mappedEvent}Release`] : elm[`on${mappedEvent}`]
      ) as unknown;

      if (
        isFunction(onKeyHandler) &&
        onKeyHandler.call(elm, e, elm, finalFocusElm) === true
      ) {
        break;
      }

      const fallbackFunction = isHold ? elm.onKeyHold : elm.onKeyPress;
      if (
        isFunction(fallbackFunction) &&
        fallbackFunction.call(elm, e, mappedEvent, elm, finalFocusElm) === true
      ) {
        break;
      }
    }
  } else {
    console.log(`Unhandled ${e.type} for key event: ${e.key || e.keyCode}`);
  }

  return false;
};

const DEFAULT_KEY_HOLD_THRESHOLD = 500; // ms
const keyHoldTimeouts: { [key: KeyNameOrKeyCode]: number | true } = {};

const keyHoldCallback = (
  e: KeyboardEvent,
  mappedKeyHoldEvent: string | undefined,
) => {
  propagateKeyPress(e, mappedKeyHoldEvent, true);
};

const handleKeyEvents = (
  delay: number,
  keydown?: KeyboardEvent,
  keyup?: KeyboardEvent,
) => {
  if (keydown) {
    const key: KeyNameOrKeyCode = keydown.key || keydown.keyCode;
    const mappedKeyHoldEvent =
      keyHoldMapEntries[keydown.key] || keyHoldMapEntries[keydown.keyCode];
    const mappedKeyEvent =
      keyMapEntries[keydown.key] || keyMapEntries[keydown.keyCode];
    if (mappedKeyHoldEvent) {
      if (!keyHoldTimeouts[key]) {
        keyHoldTimeouts[key] = window.setTimeout(() => {
          keyHoldCallback(keydown, mappedKeyHoldEvent);
          keyHoldTimeouts[key] = true;
        }, delay);
      }
      return;
    }

    propagateKeyPress(keydown, mappedKeyEvent, false);
  } else if (keyup) {
    const key: KeyNameOrKeyCode = keyup.key || keyup.keyCode;
    const mappedKeyEvent =
      keyMapEntries[keyup.key] || keyMapEntries[keyup.keyCode];
    if (keyHoldTimeouts[key] && keyHoldTimeouts[key] !== true) {
      clearTimeout(keyHoldTimeouts[key]);
      // trigger key down event when hold didn't finish
      propagateKeyPress(keyup, mappedKeyEvent, false);
    }
    delete keyHoldTimeouts[key];
    propagateKeyPress(keyup, mappedKeyEvent, false, true);
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
        if (timeout && timeout !== true) clearTimeout(timeout);
      }
    },
    focusPath: () => focusPath,
  };
};
