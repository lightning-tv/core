import { type ElementNode } from './elementNode.js';
import type {
  KeyNameOrKeyCode,
  KeyMapEventHandlers,
  KeyHoldOptions,
  KeyHandler,
  KeyMap,
} from './intrinsicTypes.js';

export const keyMapEntries: Record<KeyNameOrKeyCode, string> = {
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

export const keyHoldMapEntries: Record<KeyNameOrKeyCode, string> = {
  Enter: 'EnterHold',
};

const flattenKeyMap = (keyMap: any, targetMap: any): void => {
  for (const [key, value] of Object.entries(keyMap)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        targetMap[v] = key;
      });
    } else {
      targetMap[value as keyof any] = key;
    }
  }
};

const DEFAULT_KEY_HOLD_THRESHOLD = 150; // ms

let focusPath: ElementNode[] = [];
const keyHoldTimeouts: { [key: KeyNameOrKeyCode]: number } = {};

export const updateFocusPath = (
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
      elm.onBlur?.call(current, currentFocusedElm, prevFocusedElm);
      elm.onFocusChanged?.call(
        current,
        false,
        currentFocusedElm,
        prevFocusedElm,
      );
    }
  });

  focusPath = fp;
  return fp;
};

export const propagateKeyDown = (
  e: KeyboardEvent,
  mappedEvent: string | undefined,
  isHold: boolean,
) => {
  let finalFocusElm: ElementNode | undefined = undefined;
  for (const elm of focusPath) {
    finalFocusElm = finalFocusElm || elm;
    if (mappedEvent) {
      const onKeyHandler = elm[
        `on${mappedEvent}` as keyof KeyMapEventHandlers
      ] as KeyHandler | undefined;
      if (onKeyHandler?.call(elm, e, elm, finalFocusElm) === true) {
        break;
      }
    } else {
      console.log(`Unhandled key event: ${e.key || e.keyCode}`);
    }
    const fallbackFunction = (isHold ? elm.onKeyPress : elm.onKeyHold) as
      | KeyHandler
      | undefined;
    if (fallbackFunction?.call(elm, e, elm, finalFocusElm) === true) {
      break;
    }
  }
  return false;
};

export const keyHoldCallback = (
  e: KeyboardEvent,
  mappedKeyHoldEvent: string | undefined,
  keyHoldTimeouts: { [key: KeyNameOrKeyCode]: number },
) => {
  delete keyHoldTimeouts[e.key || e.keyCode];
  propagateKeyDown(e, mappedKeyHoldEvent, true);
};

export const handleKeyEvents = (
  keypressEvent: KeyboardEvent,
  keyupEvent: KeyboardEvent | undefined,
  keyHoldOptions: KeyHoldOptions,
  keyHoldTimeouts: { [key: KeyNameOrKeyCode]: number },
) => {
  const keypress = keypressEvent;
  const keyup = keyupEvent;

  if (keypress) {
    const key: KeyNameOrKeyCode = keypress.key || keypress.keyCode;
    const mappedKeyHoldEvent = keyHoldMapEntries[key];
    const mappedKeyEvent = keyMapEntries[key];
    if (!mappedKeyHoldEvent) {
      propagateKeyDown(keypress, mappedKeyEvent, false);
    } else {
      const delay = keyHoldOptions?.holdThreshold || DEFAULT_KEY_HOLD_THRESHOLD;
      if (keyHoldTimeouts[key]) {
        clearTimeout(keyHoldTimeouts[key]);
      }
      keyHoldTimeouts[key] = window.setTimeout(
        () => keyHoldCallback(keypress, mappedKeyHoldEvent, keyHoldTimeouts),
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

export const useFocusManager = (
  userKeyMap?: Partial<KeyMap>,
  keyHoldOptions?: KeyHoldOptions,
) => {
  let keypressEvent: KeyboardEvent | undefined;
  let keyupEvent: KeyboardEvent | undefined;

  if (userKeyMap) {
    flattenKeyMap(userKeyMap, keyMapEntries);
  }

  if (keyHoldOptions?.userKeyHoldMap) {
    flattenKeyMap(keyHoldOptions.userKeyHoldMap, keyHoldMapEntries);
  }

  const keyPressHandler = (event: KeyboardEvent) => {
    keypressEvent = event;
    handleKeyEvents(keypressEvent, keyupEvent, keyHoldOptions, keyHoldTimeouts);
  };

  const keyUpHandler = (event: KeyboardEvent) => {
    keyupEvent = event;
    handleKeyEvents(keypressEvent, keyupEvent, keyHoldOptions, keyHoldTimeouts);
  };
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
    focusPath,
  };
};
