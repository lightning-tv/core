import { ElementNode } from '../src/elementNode.ts';
import { setActiveElement } from '../src/focusManager.ts';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isElementNode } from '../src/utils.ts';
import { NodeType } from '../src/nodeTypes.ts';

// Helper to create a basic ElementNode for focus testing
function createTestElement(
  initialProps: Partial<ElementNode> = {},
): ElementNode {
  const node = new ElementNode('element');

  for (const key in initialProps) {
    if (Object.prototype.hasOwnProperty.call(initialProps, key)) {
      (node as any)[key] = (initialProps as any)[key];
    }
  }

  node.x = node.x || 0;
  node.y = node.y || 0;
  node.width = node.width || 0;
  node.height = node.height || 0;
  node.rendered = true;
  node.children = node.children || [];

  return node;
}

describe('Focus Manager - this binding tests', () => {
  let parent: ElementNode;
  let child1: ElementNode;
  let child2: ElementNode;

  beforeEach(() => {
    // Create a simple hierarchy for testing
    parent = createTestElement({
      id: 'parent',
    });

    child1 = createTestElement({
      id: 'child1',
      parent: parent,
    });

    child2 = createTestElement({
      id: 'child2',
      parent: parent,
    });

    parent.children = [child1, child2];
  });

  afterEach(() => {
    vi.clearAllMocks();
    // element reset
    parent = undefined as any;
    child1 = undefined as any;
    child2 = undefined as any;
    // global activeElement state reset
    setActiveElement(undefined as any);
  });

  describe('onFocus callback this binding', () => {
    it('should bind this correctly for regular function', () => {
      const onFocusSpy = vi.fn();
      const mockThis = { id: 'test-this' };

      child1.onFocus = function (this, currentFocusedElm, prevFocusedElm) {
        onFocusSpy(this, currentFocusedElm, prevFocusedElm);
      };

      setActiveElement(child1);

      expect(onFocusSpy).toHaveBeenCalledWith(child1, child1, undefined);
    });

    it('should handle arrow function without this binding', () => {
      const onFocusSpy = vi.fn();

      child1.onFocus = (currentFocusedElm, prevFocusedElm) => {
        onFocusSpy(currentFocusedElm, prevFocusedElm);
      };

      // Focus child2 first, then child1
      setActiveElement(child1);

      // currentFocusedElm should be child1, prevFocusedElm should be child2
      expect(onFocusSpy).toHaveBeenCalledWith(child1, undefined);
    });

    it('should handle both regular function and arrow function in the same element', () => {
      const onFocusSpy1 = vi.fn();
      const onFocusSpy2 = vi.fn();
      // Regular function
      child1.onFocus = function (this, currentFocusedElm, prevFocusedElm) {
        // currentFocusedElm should be child1, prevFocusedElm should be child2
        onFocusSpy1(this, currentFocusedElm, prevFocusedElm);
      };
      setActiveElement(child1);
      expect(onFocusSpy1).toHaveBeenCalledWith(child1, child1, undefined);

      // Arrow function
      child1.onFocus = (currentFocusedElm: any, prevFocusedElm: any) => {
        // same behavior as arrow function
        onFocusSpy2(currentFocusedElm, prevFocusedElm);
      };

      setActiveElement(child2);
      setActiveElement(child1);
      expect(onFocusSpy2).toHaveBeenCalledWith(child1, child2);
    });
  });

  describe('onFocusChanged callback this binding', () => {
    it('should bind this correctly for regular function', () => {
      const onFocusChangedSpy = vi.fn();

      child1.onFocusChanged = function (
        this: any,
        hasFocus: boolean,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) {
        onFocusChangedSpy(this, hasFocus, currentFocusedElm, prevFocusedElm);
      };
      setActiveElement(child1);

      expect(onFocusChangedSpy).toHaveBeenCalledWith(
        child1,
        true,
        child1,
        undefined,
      );
    });

    it('should handle arrow function without this binding', () => {
      const onFocusChangedSpy = vi.fn();

      child1.onFocusChanged = (
        hasFocus: boolean,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) => {
        onFocusChangedSpy(hasFocus, currentFocusedElm, prevFocusedElm);
      };

      setActiveElement(child1);

      expect(onFocusChangedSpy).toHaveBeenCalledWith(true, child1, undefined);
    });

    it('should handle focus change with proper this binding', () => {
      const onFocusChangedSpy1 = vi.fn();
      const onFocusChangedSpy2 = vi.fn();

      child1.onFocusChanged = function (
        this: any,
        hasFocus: boolean,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) {
        onFocusChangedSpy1(this, hasFocus, currentFocusedElm, prevFocusedElm);
      };

      child2.onFocusChanged = (
        hasFocus: boolean,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) => {
        onFocusChangedSpy2(hasFocus, currentFocusedElm, prevFocusedElm);
      };

      // Focus child1
      setActiveElement(child1);
      expect(onFocusChangedSpy1).toHaveBeenCalledWith(
        child1,
        true,
        child1,
        undefined,
      );

      // Focus child2 (child1 should lose focus)
      setActiveElement(child2);
      expect(onFocusChangedSpy1).toHaveBeenCalledWith(
        child1,
        false,
        child2,
        child1,
      );
      expect(onFocusChangedSpy2).toHaveBeenCalledWith(true, child2, child1);
    });
  });

  describe('onBlur callback this binding', () => {
    it('should bind this correctly for regular function', () => {
      const onBlurSpy = vi.fn();

      child1.onBlur = function (
        this: any,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) {
        onBlurSpy(this, currentFocusedElm, prevFocusedElm);
      };

      // First focus child1, then child2 to trigger blur on child1
      setActiveElement(child1);
      setActiveElement(child2);

      expect(onBlurSpy).toHaveBeenCalledWith(child1, child2, child1);
    });

    it('should handle arrow function without this binding', () => {
      const onBlurSpy = vi.fn();

      child1.onBlur = (currentFocusedElm: any, prevFocusedElm: any) => {
        onBlurSpy(currentFocusedElm, prevFocusedElm);
      };

      // First focus child1, then child2 to trigger blur on child1
      setActiveElement(child1);
      setActiveElement(child2);

      expect(onBlurSpy).toHaveBeenCalledWith(child2, child1);
    });
  });

  describe('Mixed callback types', () => {
    it('should handle mixed regular functions and arrow functions', () => {
      const onFocusSpy = vi.fn();
      const onFocusChangedSpy = vi.fn();
      const onBlurSpy = vi.fn();

      // Regular function for onFocus
      child1.onFocus = function (
        this: any,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) {
        onFocusSpy(this, currentFocusedElm, prevFocusedElm);
      };

      // Arrow function for onFocusChanged
      child1.onFocusChanged = (
        hasFocus: boolean,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) => {
        onFocusChangedSpy(hasFocus, currentFocusedElm, prevFocusedElm);
      };

      // Regular function for onBlur
      child1.onBlur = function (
        this: any,
        currentFocusedElm: any,
        prevFocusedElm: any,
      ) {
        onBlurSpy(this, currentFocusedElm, prevFocusedElm);
      };

      // Focus child1
      setActiveElement(child1);
      expect(onFocusSpy).toHaveBeenCalledWith(child1, child1, undefined);
      expect(onFocusChangedSpy).toHaveBeenCalledWith(true, child1, undefined);

      // Focus child2 (child1 should lose focus)
      setActiveElement(child2);
      expect(onBlurSpy).toHaveBeenCalledWith(child1, child2, child1);
      expect(onFocusChangedSpy).toHaveBeenCalledWith(false, child2, child1);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined callbacks gracefully', () => {
      child1.onFocus = undefined as any;
      child1.onFocusChanged = undefined as any;
      child1.onBlur = undefined as any;

      expect(() => {
        setActiveElement(child1);
        setActiveElement(child2);
      }).not.toThrow();
    });

    it('should handle non-function values gracefully', () => {
      child1.onFocus = 'not a function' as any;
      child1.onFocusChanged = 123 as any;
      child1.onBlur = {} as any;

      expect(() => {
        setActiveElement(child1);
        setActiveElement(child2);
      }).not.toThrow();
    });

    it('should handle null callbacks gracefully', () => {
      child1.onFocus = null as any;
      child1.onFocusChanged = null as any;
      child1.onBlur = null as any;

      expect(() => {
        setActiveElement(child1);
        setActiveElement(child2);
      }).not.toThrow();
    });
  });
});
