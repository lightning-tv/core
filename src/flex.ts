import { type ElementNode } from './elementNode.js';
import { isTextNode, isElementText } from './utils.js';

export default function (node: ElementNode): boolean {
  const children: ElementNode[] = [];
  let hasOrder = false;
  let growSize = 0;
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i]!;

    if (isElementText(c) && c.text && !(c.width || c.height)) {
      return false;
    }

    // Filter empty text nodes which are place holders for <Show> and elements missing dimensions
    if (isTextNode(c) || c.flexItem === false) {
      continue;
    }

    if (c.flexOrder !== undefined) {
      hasOrder = true;
    }

    if (c.flexGrow !== undefined) {
      growSize += c.flexGrow;
    }

    children.push(c as ElementNode);
  }

  if (hasOrder) {
    children.sort((a, b) => (a.flexOrder || 0) - (b.flexOrder || 0));
  } else if (node.direction === 'rtl') {
    children.reverse();
  }

  const numChildren = children.length;
  const direction = node.flexDirection || 'row';
  const isRow = direction === 'row';
  const dimension = isRow ? 'width' : 'height';
  const crossDimension = isRow ? 'height' : 'width';
  const marginOne = isRow ? 'marginLeft' : 'marginTop';
  const crossMarginOne = isRow ? 'marginTop' : 'marginLeft';
  const marginTwo = isRow ? 'marginRight' : 'marginBottom';
  const crossMarginTwo = isRow ? 'marginBottom' : 'marginRight';
  const prop = isRow ? 'x' : 'y';
  const crossProp = isRow ? 'y' : 'x';
  const containerSize = node[dimension] || 0;
  let containerCrossSize = node[crossDimension] || 0;
  const gap = node.gap || 0;
  const justify = node.justifyContent || 'flexStart';
  const align = node.alignItems;
  let containerUpdated = false;

  // if there is only 1 child by default it inherits the parent size so we can skip
  if (growSize && numChildren > 1) {
    node.flexBoundary = node.flexBoundary || 'fixed'; // cant change size of flex container
    const flexBasis = children.reduce(
      (prev, c) =>
        prev +
        (c.flexGrow != null && c.flexGrow >= 0 ? 0 : c[dimension] || 0) +
        (c[marginOne] || 0) +
        (c[marginTwo] || 0),
      0,
    );
    const growFactor =
      (containerSize - flexBasis - gap * (numChildren - 1)) / growSize;

    if (growFactor >= 0) {
      for (let i = 0; i < numChildren; i++) {
        const c = children[i]!;
        if (c.flexGrow != null && c.flexGrow >= 0) {
          c[dimension] = c.flexGrow * growFactor;
        }
      }
    } else {
      console.warn('Negative growFactor, flexGrow not applied');
    }
  }

  let itemSize = 0;
  if (
    justify === 'center' ||
    justify === 'spaceBetween' ||
    justify === 'spaceEvenly'
  ) {
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
            c[crossProp] = c[crossMarginOne] || 0;
          } else if (align === 'center') {
            c[crossProp] =
              (containerCrossSize - (c[crossDimension] || 0)) / 2 +
              (c[crossMarginOne] || 0);
          } else if (align === 'flexEnd') {
            c[crossProp] =
              containerCrossSize -
              (c[crossDimension] || 0) -
              (c[crossMarginTwo] || 0);
          }
        }
      : (c: ElementNode) => c;

  if (isRow && node._calcHeight && !node.flexCrossBoundary) {
    // Assuming all the children have the same height
    const newHeight = children[0]?.height || node.height;
    if (newHeight !== node.height) {
      containerUpdated = true;
      node.height = containerCrossSize = newHeight;
    }
  }

  if (justify === 'flexStart') {
    let start = node.padding || 0;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      c[prop] = start + (c[marginOne] || 0);
      start +=
        (c[dimension] || 0) + gap + (c[marginOne] || 0) + (c[marginTwo] || 0);
      crossAlignChild(c);
    }
    // Update container size
    if (node.flexBoundary !== 'fixed') {
      const calculatedSize = start - gap + (node.padding || 0);
      if (calculatedSize !== containerSize) {
        // store the original size for Row & Column
        node[`preFlex${dimension}`] = containerSize;
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
  return containerUpdated;
}
