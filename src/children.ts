import type { ElementNode, TextNode } from './elementNode.js';

/**
 * Children class
 */
export default class Children extends Array<ElementNode | TextNode> {
  _parent: ElementNode;

  constructor(node: ElementNode) {
    super();
    this._parent = node;
  }

  get selected(): ElementNode | undefined {
    // For selected Elements should always be an ElementNode
    return this[this._parent.selected || 0] as ElementNode | undefined;
  }

  get firstChild() {
    return this[0];
  }

  insert(
    node: ElementNode | TextNode,
    beforeNode?: ElementNode | TextNode | null,
  ) {
    if (beforeNode) {
      const index = this.indexOf(beforeNode);
      this.splice(index, 0, node);
    } else {
      this.push(node);
    }

    node.parent = this._parent;
  }

  remove(node: ElementNode | TextNode) {
    const nodeIndexToRemove = this.indexOf(node);
    if (nodeIndexToRemove >= 0) {
      this.splice(nodeIndexToRemove, 1);
    }
  }
}
