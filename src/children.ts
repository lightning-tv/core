import type { ElementNode, SolidNode } from './elementNode.js';

/**
 * Children class
 */
export default class Children extends Array<SolidNode> {
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

  insert(node: SolidNode, beforeNode?: SolidNode | null) {
    if (beforeNode) {
      const index = this.indexOf(beforeNode);
      this.splice(index, 0, node);
    } else {
      this.push(node);
    }

    node.parent = this._parent;
  }

  remove(node: SolidNode) {
    const nodeIndexToRemove = this.indexOf(node);
    if (nodeIndexToRemove >= 0) {
      this.splice(nodeIndexToRemove, 1);
    }
  }
}
