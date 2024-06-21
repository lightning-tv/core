import { INode } from '@lightningjs/renderer';
import { Config, isDev } from './config.js';
import { ElementNode, Styles, ElementText } from './elementNode.js';

function hasDebug(node: any) {
  return isObject(node) && node.debug;
}

export function log(
  msg: string,
  node: ElementNode | ElementText,
  ...args: any[]
) {
  if (isDev) {
    if (Config.debug || hasDebug(node) || hasDebug(args[0])) {
      console.log(msg, node, ...args);
    }
  }
}

export const isFunc = (obj: unknown): obj is CallableFunction =>
  obj instanceof Function;

export function isObject(
  item: unknown,
): item is Record<string | number | symbol, unknown> {
  return typeof item === 'object';
}

export function isArray(item: unknown): item is any[] {
  return Array.isArray(item);
}

export function isString(item: unknown): item is string {
  return typeof item === 'string';
}

export function isNumber(item: unknown): item is number {
  return typeof item === 'number';
}

export function isInteger(item: unknown): item is number {
  return Number.isInteger(item);
}

export function isINode(node: object): node is INode {
  return Boolean('destroy' in node && typeof node.destroy === 'function');
}

export function isElementNode(node: unknown): node is ElementNode {
  return node instanceof ElementNode;
}

export function keyExists(
  obj: Record<string, unknown>,
  keys: (string | number | symbol)[],
) {
  for (const key of keys) {
    if (key in obj) {
      return true;
    }
  }
  return false;
}

export function flattenStyles(
  obj: Styles | undefined | (Styles | undefined)[],
  result: Styles = {},
): Styles {
  if (isArray(obj)) {
    obj.forEach((item) => {
      flattenStyles(item, result);
    });
  } else if (obj) {
    // handle the case where the object is not an array
    for (const key in obj) {
      // be careful of 0 values
      if (result[key] === undefined) {
        result[key as keyof Styles] = obj[key as keyof Styles];
      }
    }
  }

  return result;
}
