import { type ElementNode } from './elementNode.js';
import { NodeType } from './nodeTypes.js';

export default function (node: ElementNode): boolean {
  const children = [];
  let hasOrder = false;
  let growSize = 0;
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i]!;
    // Filter empty text nodes which are place holders for <Show> and elements missing dimensions
    if (c._type === NodeType.Text) {
      continue;
    }

    // Skip layout for non flex items
    if (c.flexItem === false) {
      continue;
    }

    // text node hasnt loaded yet - skip layout
    if (c._type === NodeType.TextNode && c.text && !(c.width || c.height)) {
      return false;
    }

    if (c.flexOrder !== undefined) {
      hasOrder = true;
    }

    if (c.flexGrow !== undefined) {
      growSize += c.flexGrow;
    }

    children.push(c);
  }

  if (hasOrder) {
    children.sort((a, b) => (a.flexOrder || 0) - (b.flexOrder || 0));
  }

  const numChildren = children.length;
  const direction = node.flexDirection || 'row';
  const isRow = direction === 'row';
  const dimension = isRow ? 'width' : 'height';
  const crossDimension = isRow ? 'height' : 'width';
  const marginOne = isRow ? 'marginLeft' : 'marginTop';
  const marginTwo = isRow ? 'marginRight' : 'marginBottom';
  const prop = isRow ? 'x' : 'y';
  const crossProp = isRow ? 'y' : 'x';
  const containerSize = node[dimension] || 0;
  const containerCrossSize = node[crossDimension] || 0;
  const gap = node.gap || 0;
  const justify = node.justifyContent || 'flexStart';
  const align = node.alignItems;

  if (growSize) {
    const flexBasis = children.reduce(
      (prev, c) =>
        prev +
        (c.flexGrow ? 0 : c[dimension] || 0) +
        (c[marginOne] || 0) +
        (c[marginTwo] || 0),
      0,
    );
    const growFactor =
      (containerSize - flexBasis - gap * (numChildren - 1)) / growSize;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      if (c.flexGrow !== undefined && c.flexGrow > 0) {
        c[dimension] = c.flexGrow * growFactor;
      }
    }
  }

  let itemSize = 0;
  if (['center', 'spaceBetween', 'spaceEvenly'].includes(justify)) {
    itemSize = children.reduce(
      (prev, c) =>
        prev + (c[dimension] || 0) + (c[marginOne] || 0) + (c[marginTwo] || 0),
      0,
    );
  }

  // Only align children if container has a cross size
  const crossAlignChild =
    containerCrossSize && align
      ? (c: ElementNode) => {
          if (align === 'flexStart') {
            c[crossProp] = 0;
          } else if (align === 'center') {
            c[crossProp] = (containerCrossSize - (c[crossDimension] || 0)) / 2;
          } else if (align === 'flexEnd') {
            c[crossProp] = containerCrossSize - (c[crossDimension] || 0);
          }
        }
      : (c: ElementNode) => c;

  if (justify === 'flexStart') {
    let start = 0;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      c[prop] = start + (c[marginOne] || 0);
      start +=
        (c[dimension] || 0) + gap + (c[marginOne] || 0) + (c[marginTwo] || 0);
      crossAlignChild(c);
    }
    // Update container size
    if (node.flexBoundary !== 'fixed') {
      const calculatedSize = start - gap;
      if (calculatedSize !== node[dimension]) {
        node[dimension] = calculatedSize;
        return true;
      }
    }
  } else if (justify === 'flexEnd') {
    let start = containerSize;
    for (let i = numChildren - 1; i >= 0; i--) {
      const c = children[i]!;
      c[prop] = start - (c[dimension] || 0) - (c[marginTwo] || 0);
      start -=
        (c[dimension] || 0) + gap + (c[marginOne] || 0) + (c[marginTwo] || 0);
      crossAlignChild(c);
    }
    // Update container size
    if (node.flexBoundary !== 'fixed') {
      const calculatedSize = start - gap;
      if (calculatedSize !== node[dimension]) {
        node[dimension] = calculatedSize;
        return true;
      }
    }
  } else if (justify === 'center') {
    let start = (containerSize - (itemSize + gap * (numChildren - 1))) / 2;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      c[prop] = start + (c[marginOne] || 0);
      start +=
        (c[dimension] || 0) + gap + (c[marginOne] || 0) + (c[marginTwo] || 0);
      crossAlignChild(c);
    }
  } else if (justify === 'spaceBetween') {
    const toPad = (containerSize - itemSize) / (numChildren - 1);
    let start = 0;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      c[prop] = start + (c[marginOne] || 0);
      start +=
        (c[dimension] || 0) + toPad + (c[marginOne] || 0) + (c[marginTwo] || 0);
      crossAlignChild(c);
    }
  } else if (justify === 'spaceEvenly') {
    const toPad = (containerSize - itemSize) / (numChildren + 1);
    let start = toPad;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      c[prop] = start + (c[marginOne] || 0);
      start +=
        (c[dimension] || 0) + toPad + (c[marginOne] || 0) + (c[marginTwo] || 0);
      crossAlignChild(c);
    }
  }

  // Container was not updated
  return false;
}
