import { ElementNode } from '../elementNode';
import calculateFlex from '../flex';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isElementNode } from '../utils';
import { NodeType } from '../nodeTypes';

// Helper to create a basic ElementNode for flex testing
// (Adapted from flex.performance.spec.ts)
function createTestElement(
  initialProps: Partial<ElementNode> & {
    nodeType?: 'element' | 'textNode' | 'text'; // Added 'text' for true TextNode
    children?: Array<ElementNode | TextNode>; // Allow TextNode in children
  } = {},
): ElementNode | TextNode {
  if (initialProps.nodeType === 'text') {
    // Create a simple TextNode (not ElementText which is a type of ElementNode)
    const textNodeInstance: TextNode = {
      _type: NodeType.Text,
      text: (initialProps as any).text || '',
      // Add other properties if TextNode has them and they are relevant for testing
    };
    return textNodeInstance;
  }

  const nodeTypeName =
    initialProps.nodeType === 'textNode' ? 'text' : 'element';
  const node = new ElementNode(nodeTypeName);

  for (const key in initialProps) {
    if (Object.prototype.hasOwnProperty.call(initialProps, key)) {
      if (key === 'children') continue;
      if (key === 'nodeType') continue;
      (node as any)[key] = (initialProps as any)[key];
    }
  }

  node.x = node.x || 0;
  node.y = node.y || 0;
  node.width = node.width || 0;
  node.height = node.height || 0;

  if (initialProps.children) {
    node.children = initialProps.children as Array<ElementNode | TextNode>;
    node.children.forEach((child) => {
      if (isElementNode(child)) {
        child.parent = node;
        child.rendered = true;
        child.width = child.width || 0;
        child.height = child.height || 0;
        child.x = child.x || 0;
        child.y = child.y || 0;
      } else {
        // If it's a simple TextNode, it might need a parent reference if flex logic ever inspects it
        // For now, flex logic filters out TextNode instances early.
        (child as TextNode).parent = node as unknown as ElementText; // Cast for parent type
      }
    });
  } else {
    node.children = [];
  }

  node.rendered = true;
  return node;
}

// Mock console.warn
let originalConsoleWarn: (...data: any[]) => void;
beforeEach(() => {
  originalConsoleWarn = console.warn;
  console.warn = vi.fn();
});
afterEach(() => {
  console.warn = originalConsoleWarn;
});

describe('Flexbox Layout (calculateFlex)', () => {
  describe('Basic Row Layout', () => {
    it('should layout children in a row with flexStart', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        justifyContent: 'flexStart',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);

      expect(child1.x).toBe(0);
      expect(child1.y).toBe(0); // Default y
      expect(child2.x).toBe(50); // child1.width
      expect(child2.y).toBe(0);
    });

    it('should layout children in a row with flexEnd', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        justifyContent: 'flexEnd',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // total width = 50 + 60 = 110. Parent width = 200. Space = 90
      // child2 is at 200 - 60 = 140
      // child1 is at 140 - 50 = 90
      expect(child1.x).toBe(200 - 110);
      expect(child2.x).toBe(200 - 60);
    });

    it('should layout children in a row with center', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        justifyContent: 'center',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // total width = 110. Parent width = 200. Space = 90. Start = 90 / 2 = 45.
      expect(child1.x).toBe(45);
      expect(child2.x).toBe(45 + 50);
    });

    it('should layout children in a row with spaceBetween', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const child3 = createTestElement({
        width: 40,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 300, // total child width = 50+60+40 = 150
        height: 100,
        flexDirection: 'row',
        justifyContent: 'spaceBetween',
        children: [child1, child2, child3],
      }) as ElementNode;

      calculateFlex(parent);
      // Remaining space = 300 - 150 = 150. Gaps = 2. Space per gap = 150 / 2 = 75
      expect(child1.x).toBe(0);
      expect(child2.x).toBe(50 + 75); // child1.width + space
      expect(child3.x).toBe(50 + 75 + 60 + 75); // child1.width + space + child2.width + space
    });

    it('should layout children in a row with spaceBetween and padding', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200, // total child width = 110
        height: 100,
        padding: 10, // available space for items = 200 - 10 - 10 = 180
        flexDirection: 'row',
        justifyContent: 'spaceBetween',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // Item space = 180. Total child width = 110. Remaining space = 70.
      expect(child1.x).toBe(10); // parent.padding
      expect(child2.x).toBe(10 + 50 + 70); // parent.padding + child1.width + space
    });

    it('should layout children in a row with spaceEvenly', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200, // total child width = 110
        height: 100,
        flexDirection: 'row',
        justifyContent: 'spaceEvenly',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // Remaining space = 200 - 110 = 90. Spaces = 3 (before first, between, after last). Space per gap = 90 / 3 = 30
      expect(child1.x).toBe(30);
      expect(child2.x).toBe(30 + 50 + 30); // space + child1.width + space
    });
  });

  describe('Basic Column Layout', () => {
    it('should layout children in a column with flexStart', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 60,
      }) as ElementNode;
      const parent = createTestElement({
        width: 100,
        height: 200,
        flexDirection: 'column',
        justifyContent: 'flexStart',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);

      expect(child1.x).toBe(0);
      expect(child1.y).toBe(0);
      expect(child2.x).toBe(0);
      expect(child2.y).toBe(50); // child1.height
    });
  });

  describe('Flex Grow', () => {
    it('should distribute remaining space among flexGrow items in a row', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
        flexGrow: 1,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 50,
        flexGrow: 1,
      }) as ElementNode;
      const parent = createTestElement({
        width: 300, // Initial total child width = 100. Remaining space = 200.
        height: 100,
        flexDirection: 'row',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // Each child gets 200 / 2 = 100 extra width.
      expect(child1.width).toBe(50 + 100);
      expect(child2.width).toBe(50 + 100);
      expect(child1.x).toBe(0);
      expect(child2.x).toBe(150);
    });

    it('should distribute remaining space proportionally to flexGrow values', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
        flexGrow: 1,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 50,
        flexGrow: 3,
      }) as ElementNode; // Total flexGrow = 4
      const parent = createTestElement({
        width: 300, // Initial total child width = 100. Remaining space = 200.
        height: 100,
        flexDirection: 'row',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // child1 gets 200 * (1/4) = 50 extra. child2 gets 200 * (3/4) = 150 extra.
      expect(child1.width).toBe(50 + 50);
      expect(child2.width).toBe(50 + 150);
      expect(child1.x).toBe(0);
      expect(child2.x).toBe(100);
    });

    it('should not apply flexGrow if growFactor is negative', () => {
      const child1 = createTestElement({
        width: 150,
        height: 50,
        flexGrow: 1,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 150,
        height: 50,
        flexGrow: 1,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200, // Children already wider than parent
        height: 100,
        flexDirection: 'row',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.width).toBe(150); // Unchanged
      expect(child2.width).toBe(150); // Unchanged
      expect(console.warn).toHaveBeenCalledWith(
        'Negative growFactor, flexGrow not applied',
      );
    });

    it('should not apply flexGrow if only one child', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
        flexGrow: 1,
      }) as ElementNode;
      const parent = createTestElement({
        width: 300,
        height: 100,
        flexDirection: 'row',
        children: [child1],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.width).toBe(50); // Unchanged
    });
  });

  describe('Align Items (Cross Axis)', () => {
    it('should align items to flexStart in a row', () => {
      const child1 = createTestElement({
        width: 50,
        height: 30,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        alignItems: 'flexStart',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.y).toBe(0);
      expect(child2.y).toBe(0);
    });

    it('should align items to center in a row', () => {
      const child1 = createTestElement({
        width: 50,
        height: 30,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        alignItems: 'center',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.y).toBe((100 - 30) / 2); // (parent.height - child.height) / 2
      expect(child2.y).toBe((100 - 50) / 2);
    });

    it('should align items to flexEnd in a row', () => {
      const child1 = createTestElement({
        width: 50,
        height: 30,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        alignItems: 'flexEnd',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.y).toBe(100 - 30); // parent.height - child.height
      expect(child2.y).toBe(100 - 50);
    });

    it('should respect alignSelf property', () => {
      const child1 = createTestElement({
        width: 50,
        height: 30,
        alignSelf: 'flexEnd',
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 50,
        alignSelf: 'center',
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        alignItems: 'flexStart', // Default for parent
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.y).toBe(100 - 30);
      expect(child2.y).toBe((100 - 50) / 2);
    });
  });

  describe('Gap Property', () => {
    it('should apply gap between items in a row', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        gap: 10,
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.x).toBe(0);
      expect(child2.x).toBe(50 + 10); // child1.width + gap
    });

    it('should apply rowGap and columnGap in a wrapped row', () => {
      const child1 = createTestElement({
        width: 80,
        height: 30,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 80,
        height: 30,
      }) as ElementNode;
      const child3 = createTestElement({
        width: 80,
        height: 30,
      }) as ElementNode;
      const parent = createTestElement({
        width: 150, // child1 and child2 fit, child3 wraps
        height: 200,
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 10, // Gap between columns (horizontal)
        rowGap: 5, // Gap between rows (vertical)
        alignItems: 'flexStart', // To make cross axis predictable
        children: [child1, child2, child3],
      }) as ElementNode;
      parent.containerCrossSize = 30; // Simulate a known cross size for wrapping calculations

      calculateFlex(parent);

      expect(child1.x).toBe(0);
      expect(child1.y).toBe(0);

      expect(child2.x).toBe(80 + 10); // child1.width + columnGap
      expect(child2.y).toBe(0); // Still on the first row

      expect(child3.x).toBe(0); // Wrapped to new line
      expect(child3.y).toBe(30 + 5); // parent.containerCrossSize (height of first row items) + rowGap
    });
  });

  describe('Margins', () => {
    it('should respect margins in a row', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
        marginLeft: 5,
        marginRight: 10,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
        marginLeft: 15,
      }) as ElementNode;
      const parent = createTestElement({
        width: 300,
        height: 100,
        flexDirection: 'row',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.x).toBe(5); // marginLeft
      expect(child2.x).toBe(5 + 50 + 10 + 15); // child1.marginLeft + child1.width + child1.marginRight + child2.marginLeft
    });
  });

  describe('Padding', () => {
    it('should respect parent padding for flexStart', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'flexStart',
        children: [child1],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.x).toBe(20);
    });

    it('should respect parent padding for flexEnd', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'flexEnd',
        children: [child1],
      }) as ElementNode;

      calculateFlex(parent);
      expect(child1.x).toBe(200 - 20 - 50); // parent.width - parent.padding - child1.width
    });
  });

  describe('Flex Wrap', () => {
    it('should wrap children in a row when they exceed container width', () => {
      const child1 = createTestElement({
        width: 100,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 100,
        height: 50,
      }) as ElementNode;
      const child3 = createTestElement({
        width: 100,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 250, // Can fit two children per row
        height: 200,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'flexStart', // for predictable cross-axis
        children: [child1, child2, child3],
      }) as ElementNode;
      // Manually set containerCrossSize as it's normally determined by children or explicit parent height
      // For this test, assume children determine the row height.
      parent.containerCrossSize = 50;

      const updated = calculateFlex(parent);

      expect(child1.x).toBe(0);
      expect(child1.y).toBe(0);
      expect(child2.x).toBe(100 + 10); // child1.width + gap
      expect(child2.y).toBe(0);
      expect(child3.x).toBe(0); // Wrapped
      expect(child3.y).toBe(50 + 10); // parent.containerCrossSize + gap (acting as rowGap)
      expect(updated).toBe(true); // Container cross size should have been updated
      expect(parent.height).toBe(50 + 10 + 50); // row1_height + gap + row2_height
    });
  });

  describe('Direction RTL', () => {
    it('should layout children in reverse order for row with direction RTL and flexStart', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        justifyContent: 'flexStart', // Still flexStart, but items are reversed first
        direction: 'rtl',
        children: [child1, child2],
      }) as ElementNode;

      calculateFlex(parent);
      // Children are [child2, child1] effectively for layout
      expect(child2.x).toBe(0);
      expect(child1.x).toBe(60); // child2.width
    });
  });

  describe('Flex Order', () => {
    it('should respect flexOrder property', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
        flexOrder: 2,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
        flexOrder: 1,
      }) as ElementNode;
      const child3 = createTestElement({
        width: 70,
        height: 50,
      }) as ElementNode; // default order 0
      const parent = createTestElement({
        width: 300,
        height: 100,
        flexDirection: 'row',
        children: [child1, child2, child3],
      }) as ElementNode;

      calculateFlex(parent);
      // Order: child3 (0), child2 (1), child1 (2)
      expect(child3.x).toBe(0);
      expect(child2.x).toBe(70); // child3.width
      expect(child1.x).toBe(70 + 60); // child3.width + child2.width
    });
  });

  describe('Edge Cases and Filtering', () => {
    it('should return false if no processable children', () => {
      const parent = createTestElement({
        width: 100,
        height: 100,
        flexDirection: 'row',
        children: [],
      }) as ElementNode;
      expect(calculateFlex(parent)).toBe(false);

      const textChild = createTestElement({
        nodeType: 'text',
        text: 'hello',
      }) as TextNode;
      const parentWithTextChild = createTestElement({
        width: 100,
        height: 100,
        flexDirection: 'row',
        children: [textChild],
      }) as ElementNode;
      expect(calculateFlex(parentWithTextChild)).toBe(false);
    });

    it('should filter out non-flex items (flexItem: false)', () => {
      const child1 = createTestElement({
        width: 50,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 60,
        height: 50,
        flexItem: false,
      }) as ElementNode;
      const child3 = createTestElement({
        width: 70,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        children: [child1, child2, child3],
      }) as ElementNode;

      calculateFlex(parent);
      // child2 is ignored
      expect(child1.x).toBe(0);
      expect(child3.x).toBe(50); // child1.width
      // child2 position should remain unchanged by flex
      expect(child2.x).toBe(0);
      expect(child2.y).toBe(0);
    });

    it('should return false if an ElementText child has text but no dimensions', () => {
      // ElementText is an ElementNode with _type = NodeType.TextNode
      const textChild = createTestElement({
        nodeType: 'textNode',
        text: 'Hello',
        width: 0,
        height: 0,
      }) as ElementNode;
      const parent = createTestElement({
        width: 100,
        height: 100,
        children: [textChild],
      }) as ElementNode;
      expect(calculateFlex(parent)).toBe(false);
    });
  });

  describe('Container Size Update (flexBoundary)', () => {
    it('should update parent width if flexBoundary is not fixed and children exceed width (row)', () => {
      const child1 = createTestElement({
        width: 100,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 120,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200, // Initial width, children total 220
        height: 100,
        flexDirection: 'row',
        // flexBoundary default is not 'fixed'
        children: [child1, child2],
      }) as ElementNode;

      const updated = calculateFlex(parent);
      expect(updated).toBe(true);
      expect(parent.width).toBe(220);
      expect(parent.preFlexwidth).toBe(200);
    });

    it('should NOT update parent width if flexBoundary is "fixed"', () => {
      const child1 = createTestElement({
        width: 100,
        height: 50,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 120,
        height: 50,
      }) as ElementNode;
      const parent = createTestElement({
        width: 200,
        height: 100,
        flexDirection: 'row',
        flexBoundary: 'fixed',
        children: [child1, child2],
      }) as ElementNode;

      const updated = calculateFlex(parent);
      expect(updated).toBe(false);
      expect(parent.width).toBe(200); // Unchanged
    });

    it('should update parent height if flexBoundary is not fixed and children exceed height (column)', () => {
      const child1 = createTestElement({
        width: 50,
        height: 100,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 50,
        height: 120,
      }) as ElementNode;
      const parent = createTestElement({
        width: 100,
        height: 200, // Initial height, children total 220
        flexDirection: 'column',
        children: [child1, child2],
      }) as ElementNode;

      const updated = calculateFlex(parent);
      expect(updated).toBe(true);
      expect(parent.height).toBe(220);
      expect(parent.preFlexheight).toBe(200);
    });
  });

  describe('Container Cross Size Update (flexWrap)', () => {
    it('should update parent cross dimension (height for row) when flexWrap is active', () => {
      const child1 = createTestElement({
        width: 100,
        height: 30,
      }) as ElementNode;
      const child2 = createTestElement({
        width: 100,
        height: 40,
      }) as ElementNode; // Taller child
      const child3 = createTestElement({
        width: 100,
        height: 35,
      }) as ElementNode;
      const parent = createTestElement({
        width: 150, // Forces child2 and child3 to wrap
        height: 50, // Initial height, might be overridden by content
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        alignItems: 'flexStart',
        children: [child1, child2, child3],
      }) as ElementNode;
      parent.containerCrossSize = 40; // Tallest item in first "virtual" row before actual layout

      const containerUpdated = calculateFlex(parent);

      expect(containerUpdated).toBe(true);
      // Expected height:
      // Row 1 height is determined by tallest item: child1 (30) -> so 30 (or parent.containerCrossSize if set)
      // For this test, let's assume the first row's effective height is based on its content.
      // If child1 is alone on first row, its height is 30.
      // child2 and child3 wrap. child2 is 40, child3 is 35. Second row height is 40.
      // Total height = height_row1 (30) + gap (5) + height_row2 (40) = 75
      // However, the logic uses parent.containerCrossSize for each row's height before summing.
      // So, if parent.containerCrossSize is 40 (from child2, the tallest overall before this specific layout pass):
      // Row 1 uses 40. Row 2 uses 40.
      // Total height = 40 (row1) + 5 (gap) + 40 (row2) = 85
      expect(parent.height).toBe(
        parent.containerCrossSize + 5 + parent.containerCrossSize,
      ); // 40 + 5 + 40 = 85
      expect(parent.preFlexheight).toBe(50); // Original height
    });
  });
});
