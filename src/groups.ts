import { ElementNode } from './elementNode.js';

type Group = Set<ElementNode>;

class GroupManager {
  public groups: Map<string, Group>;

  constructor() {
    this.groups = new Map();
  }

  /**
   * Adds an ElementNode to a group.
   * @param groupName - The name of the group.
   * @param element - The ElementNode to add to the group.
   */
  addToGroup(groupName: string, element: ElementNode): void {
    if (!this.groups.has(groupName)) {
      this.groups.set(groupName, new Set());
    }

    const group = this.groups.get(groupName)!;
    group.add(element);
  }

  /**
   * Clears all elements in a group.
   * @param groupName - The name of the group to clear.
   */
  clearGroup(groupName: string): void {
    this.groups.delete(groupName);
  }

  /**
   * Clears all groups and their elements.
   */
  clearAllGroups(): void {
    this.groups.forEach((group, groupName) => {
      this.clearGroup(groupName);
    });
    this.groups.clear();
  }

  /**
   * Gets all elements in a group.
   * @param groupName - The name of the group.
   * @returns The set of elements in the group, or undefined if the group does not exist.
   */
  getGroup(groupName: string): Group | undefined {
    return this.groups.get(groupName);
  }
}

const groupManager = new GroupManager();
export default groupManager;
export type { Group };
