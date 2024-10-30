import { INode } from '@lightningjs/renderer';
import { Config, isDev } from './config.js';
import type { Styles, ElementText, TextNode } from './intrinsicTypes.js';
import { ElementNode } from './elementNode.js';
import { NodeType } from './nodeTypes.js';

function hasDebug(node: any) {
  return isObject(node) && node.debug;
}

export function log(
  msg: string,
  node: ElementNode | ElementText | TextNode,
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

export const isFunction = (obj: unknown): obj is Function =>
  typeof obj === 'function';

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
  return 'destroy' in node && typeof node.destroy === 'function';
}

export function isElementNode(node: unknown): node is ElementNode {
  return node instanceof ElementNode;
}

export function isElementText(
  node: ElementNode | ElementText | TextNode,
): node is ElementText {
  return node._type === NodeType.TextNode;
}

export function isTextNode(
  node: ElementNode | ElementText | TextNode,
): node is TextNode {
  return node._type === NodeType.Text;
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
        result[key as keyof Styles] = obj[key as keyof Styles]!;
      }
    }
  }

  return result;
}

export function logRenderTree(node: ElementNode) {
  const tree = [node];
  let parent = node.parent;
  while (parent) {
    tree.push(parent);
    parent = parent.parent;
  }
  tree.reverse();

  let output = `
function convertEffectsToShader(styleEffects) {
  const effects = [];
  let index = 0;

  for (const [type, props] of Object.entries(styleEffects)) {
    effects.push({ type, props });
    index++;
  }
  return createShader('DynamicShader', { effects });
}
`;
  tree.forEach((node, i) => {
    if (!node._rendererProps) {
      return;
    }
    node._rendererProps.parent = undefined;
    node._rendererProps.shader = undefined;
    const props = JSON.stringify(node._rendererProps, null, 2);
    const effects = node._effects
      ? `props${i}.shader = convertEffectsToShader(${JSON.stringify(node._effects, null, 2)});`
      : '';
    const parent = i === 0 ? 'rootNode' : `node${i - 1}`;
    output += `
const props${i} = ${props};
props${i}.parent = ${parent};
${effects}
const node${i} = renderer.createNode(props${i});
`;
  });

  return output;
}
