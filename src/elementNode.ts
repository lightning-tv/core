import { renderer, createShader } from './lightningInit.js';
import {
  type BorderRadius,
  type BorderStyle,
  type IntrinsicCommonProps,
  type IntrinsicNodeProps,
  type IntrinsicTextProps,
  type StyleEffects,
  type NodeStyles,
  type TextStyles,
  type IntrinsicTextStyleCommonProps,
  type AnimationSettings,
  AddColorString,
} from './intrinsicTypes.js';
import { type ITextNode } from '@lightningjs/renderer';
import States, { type NodeStates } from './states.js';
import calculateFlex from './flex.js';
import {
  log,
  isArray,
  isNumber,
  isFunc,
  keyExists,
  flattenStyles,
  isINode,
  isElementNode,
} from './utils.js';
import { Config } from './config.js';
import type {
  RendererMain,
  INode,
  INodeAnimateProps,
  INodeProps,
  LinearGradientEffectProps,
  ITextNodeProps,
  IAnimationController,
  EffectDescUnion,
  ShaderController,
  RadialGradientEffectProps,
  RadialProgressEffectProps,
} from '@lightningjs/renderer';
import { assertTruthy } from '@lightningjs/renderer/utils';
import { NodeType } from './nodeTypes.js';
import { setActiveElement } from './focusManager.js';

const layoutQueue = new Set<ElementNode>();
let dynamicSizedNodeCount = 0;
let flushQueued = false;

function flushLayout() {
  if (flushQueued) return;

  flushQueued = true;
  // Use setTimeout to allow renderers microtasks to finish
  setTimeout(() => {
    const queue = [...layoutQueue];
    layoutQueue.clear();
    for (let i = queue.length - 1; i >= 0; i--) {
      const node = queue[i] as ElementNode;
      node.updateLayout();
    }
    flushQueued = false;
    dynamicSizedNodeCount = 0;
  }, 0);
}

function convertEffectsToShader(
  styleEffects: StyleEffects,
): ShaderController<'DynamicShader'> {
  const effects: EffectDescUnion[] = [];
  let index = 0;

  for (const [type, props] of Object.entries(styleEffects)) {
    effects.push({ name: `effect${index}`, type, props } as EffectDescUnion);
    index++;
  }
  return createShader('DynamicShader', { effects });
}

function borderAccessor(
  direction: '' | 'Top' | 'Right' | 'Bottom' | 'Left' = '',
) {
  return {
    set(this: ElementNode, value: BorderStyle) {
      // Format: width || { width, color }
      if (isNumber(value)) {
        value = { width: value, color: 0x000000ff };
      }
      this.effects = this.effects
        ? {
            ...(this.effects || {}),
            ...{ [`border${direction}`]: value },
          }
        : { [`border${direction}`]: value };
    },
    get(this: ElementNode): BorderStyle | undefined {
      return this.effects?.[`border${direction}`];
    },
  };
}

const LightningRendererNumberProps = [
  'alpha',
  'color',
  'colorTop',
  'colorRight',
  'colorLeft',
  'colorBottom',
  'colorTl',
  'colorTr',
  'colorBl',
  'colorBr',
  'height',
  'fontSize',
  'lineHeight',
  'mount',
  'mountX',
  'mountY',
  'pivot',
  'pivotX',
  'pivotY',
  'rotation',
  'scale',
  'scaleX',
  'scaleY',
  'width',
  'worldX',
  'worldY',
  'x',
  'y',
  'zIndex',
  'zIndexLocked',
];

const LightningRendererNonAnimatingProps = [
  'absX',
  'absY',
  'autosize',
  'clipping',
  'contain',
  'data',
  'fontFamily',
  'fontStretch',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'maxLines',
  'offsetY',
  'overflowSuffix',
  'rtt',
  'scrollable',
  'scrollY',
  'src',
  'text',
  'textAlign',
  'textBaseline',
  'textOverflow',
  'texture',
  'textureOptions',
  'verticalAlign',
  'wordWrap',
];

export type Styles = {
  [key: string]: NodeStyles | TextStyles | undefined;
} & (NodeStyles | TextStyles);

/** Node text, children of a ElementNode of type TextNode */
export interface ElementText
  extends Partial<Omit<ITextNode, 'id' | 'parent' | 'shader'>>,
    Partial<Omit<ElementNode, '_type'>>,
    IntrinsicTextStyleCommonProps {
  id?: string;
  _type: 'text';
  parent?: ElementNode;
  text: string;
  states?: States;
  _queueDelete?: boolean;
}
export interface ElementNode
  extends AddColorString<Partial<Omit<INodeProps, 'parent' | 'shader'>>>,
    IntrinsicCommonProps {
  [key: string]: unknown;
  debug?: boolean;
  _id: string | undefined;
  _type: 'element' | 'textNode';
  lng: INode | IntrinsicNodeProps | IntrinsicTextProps;
  rendered: boolean;
  renderer?: RendererMain;
  selected?: number;
  skipFocus?: boolean;
  flexItem?: boolean;
  flexOrder?: number;
  flexGrow?: number;
  preFlexwidth?: number;
  preFlexheight?: number;
  text?: string;
  forwardFocus?:
    | number
    | ((this: ElementNode, elm: ElementNode) => boolean | void);

  _undoStyles?: string[];
  _effects?: StyleEffects;
  _parent: ElementNode | undefined;
  _style?: Styles;
  _states?: States;
  _events?: Array<[string, (target: ElementNode, event?: Event) => void]>;
  _animationSettings?: AnimationSettings | undefined;
  _animationQueue:
    | Array<{
        props: Partial<INodeAnimateProps>;
        animationSettings?: AnimationSettings;
      }>
    | undefined;
  _animationQueueSettings: AnimationSettings | undefined;
  _animationRunning?: boolean;
  children: Array<ElementNode | ElementText>;
}
export class ElementNode extends Object {
  constructor(name: string) {
    super();
    this._type = name === 'text' ? NodeType.TextNode : NodeType.Element;
    this.rendered = false;
    this.lng = {};
    this.children = [];
  }

  get effects(): StyleEffects | undefined {
    return this._effects;
  }

  set effects(v: StyleEffects) {
    this._effects = v;
    if (this.rendered) {
      this.shader = convertEffectsToShader(v);
    }
  }

  set id(id: string) {
    this._id = id;
    if (Config.rendererOptions?.inspector) {
      this.data = { ...this.data, testId: id };
    }
  }

  get id(): string | undefined {
    return this._id;
  }

  get parent() {
    return this._parent;
  }

  set parent(p) {
    this._parent = p;
    if (this.rendered) {
      this.lng.parent = p?.lng ?? null;
    }
  }

  insertChild(
    node: ElementNode | ElementText,
    beforeNode?: ElementNode | ElementText | null,
  ) {
    node.parent = this;

    if (beforeNode) {
      // SolidJS can move nodes around in the children array.
      // We need to insert following DOM insertBefore which moves elements.
      this.removeChild(node);
      const index = this.children.indexOf(beforeNode);
      if (index >= 0) {
        this.children.splice(index, 0, node);
        return;
      }
    }
    this.children.push(node);
  }

  removeChild(node: ElementNode | ElementText) {
    const nodeIndexToRemove = this.children.indexOf(node);
    if (nodeIndexToRemove >= 0) {
      this.children.splice(nodeIndexToRemove, 1);
    }
  }

  get selectedNode(): ElementNode | undefined {
    const selectedIndex = this.selected || 0;

    for (let i = selectedIndex; i < this.children.length; i++) {
      const element = this.children[i];
      if (isElementNode(element)) {
        this.selected = i;
        return element;
      }
    }

    return undefined;
  }

  set shader(
    shaderProps:
      | Parameters<typeof createShader>
      | ReturnType<RendererMain['createShader']>,
  ) {
    let shProps = shaderProps;
    if (isArray(shaderProps)) {
      shProps = createShader(...shaderProps);
    }
    this.lng.shader = shProps;
  }

  _sendToLightningAnimatable(name: string, value: number) {
    if (
      this.transition &&
      this.rendered &&
      Config.animationsEnabled &&
      (this.transition === true || this.transition[name])
    ) {
      const animationSettings =
        this.transition === true || this.transition[name] === true
          ? undefined
          : (this.transition[name] as undefined | AnimationSettings);

      const animationController = this.animate(
        { [name]: value },
        animationSettings,
      );

      if (isFunc(this.onAnimationStarted)) {
        animationController.once('animating', (controller) => {
          this.onAnimationStarted?.call(this, controller, name, value);
        });
      }

      if (isFunc(this.onAnimationFinished)) {
        animationController.once('stopped', (controller) => {
          this.onAnimationFinished?.call(this, controller, name, value);
        });
      }

      return animationController.start();
    }

    (this.lng[name as keyof INode] as number | string) = value;
  }

  animate(
    props: Partial<INodeAnimateProps>,
    animationSettings?: AnimationSettings,
  ): IAnimationController {
    assertTruthy(this.rendered, 'Node must be rendered before animating');
    return (this.lng as INode).animate(
      props,
      animationSettings || this.animationSettings || {},
    );
  }

  chain(
    props: Partial<INodeAnimateProps>,
    animationSettings?: AnimationSettings,
  ) {
    if (this._animationRunning) {
      this._animationQueue = [];
      this._animationRunning = false;
    }

    if (animationSettings) {
      this._animationQueueSettings = animationSettings;
    } else if (!this._animationQueueSettings) {
      this._animationQueueSettings =
        animationSettings || this.animationSettings;
    }
    animationSettings = animationSettings || this._animationQueueSettings;
    this._animationQueue = this._animationQueue || [];
    this._animationQueue.push({ props, animationSettings });
    return this;
  }

  async start() {
    let animation = this._animationQueue!.shift();
    while (animation) {
      this._animationRunning = true;
      await this.animate(animation.props, animation.animationSettings)
        .start()
        .waitUntilStopped();
      animation = this._animationQueue!.shift();
    }
    this._animationRunning = false;
    this._animationQueueSettings = undefined;
  }

  setFocus() {
    if (this.skipFocus) {
      return;
    }

    if (this.rendered) {
      // can be 0
      if (this.forwardFocus !== undefined) {
        if (isFunc(this.forwardFocus)) {
          if (this.forwardFocus.call(this, this) !== false) {
            return;
          }
        } else {
          const focusedIndex =
            typeof this.forwardFocus === 'number' ? this.forwardFocus : null;
          const nodes = this.children;
          if (focusedIndex !== null && focusedIndex < nodes.length) {
            const child = nodes[focusedIndex];
            isElementNode(child) && child.setFocus();
            return;
          }
        }
      }
      // Delay setting focus so children can render (useful for Row + Column)
      queueMicrotask(() => setActiveElement(this));
    } else {
      this._autofocus = true;
    }
  }

  isTextNode() {
    return this._type === NodeType.TextNode;
  }

  _layoutOnLoad() {
    dynamicSizedNodeCount++;
    (this.lng as INode).on('loaded', () => {
      // Re-add the node to the layout queue because somehow the queue fluses and there is a straggler
      layoutQueue.add(this.parent!);
      flushLayout();
    });
  }

  getText() {
    let result = '';
    for (let i = 0; i < this.children.length; i++) {
      result += this.children[i]!.text;
    }
    return result;
  }

  destroy() {
    if (this._queueDelete && isINode(this.lng)) {
      this.lng.destroy();
      if (this.parent?.requiresLayout()) {
        this.parent.updateLayout();
      }
    }
  }
  // Must be set before render
  set onEvents(
    events: Array<[string, (target: ElementNode, event?: any) => void]>,
  ) {
    this._events = events;
  }

  get onEvents():
    | Array<[string, (target: ElementNode, event?: any) => void]>
    | undefined {
    return this._events;
  }

  set style(values: Styles | (Styles | undefined)[]) {
    if (isArray(values)) {
      this._style = flattenStyles(values);
    } else {
      this._style = values;
    }
    // Keys set in JSX are more important
    for (const key in this._style) {
      // be careful of 0 values
      if (this[key as keyof Styles] === undefined) {
        this[key as keyof Styles] = this._style[key as keyof Styles];
      }
    }
  }

  get style(): Styles {
    return this._style!;
  }

  get hasChildren() {
    return this.children.length > 0;
  }

  getChildById(id: string) {
    return this.children.find((c) => c.id === id);
  }

  searchChildrenById(id: string): ElementNode | undefined {
    // traverse all the childrens children
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      if (isElementNode(child)) {
        if (child.id === id) {
          return child;
        }

        const found = child.searchChildrenById(id);
        if (found) {
          return found;
        }
      }
    }
  }

  set states(states: NodeStates) {
    this._states = this._states
      ? this._states.merge(states)
      : new States(this._stateChanged.bind(this), states);
    if (this.rendered) {
      this._stateChanged();
    }
  }

  get states(): States {
    this._states = this._states || new States(this._stateChanged.bind(this));
    return this._states;
  }

  get animationSettings(): AnimationSettings | undefined {
    return this._animationSettings || Config.animationSettings;
  }

  set animationSettings(animationSettings: AnimationSettings) {
    this._animationSettings = animationSettings;
  }

  set hidden(val: boolean) {
    this.alpha = val ? 0 : 1;
  }

  get hidden() {
    return this.alpha === 0;
  }

  set autofocus(val: any) {
    this._autofocus = val ? true : false;
    this._autofocus && this.setFocus();
  }

  get autofocus() {
    return this._autofocus;
  }

  requiresLayout() {
    return this.display === 'flex' || this.onBeforeLayout || this.onLayout;
  }

  set updateLayoutOn(v: any) {
    this.updateLayout();
  }

  get updateLayoutOn() {
    return null;
  }

  updateLayout() {
    if (this.hasChildren) {
      log('Layout: ', this);
      let changedLayout = false;
      if (isFunc(this.onBeforeLayout)) {
        console.warn('onBeforeLayout is deprecated');
        changedLayout = this.onBeforeLayout.call(this, this) || false;
      }

      if (this.display === 'flex') {
        if (calculateFlex(this) || changedLayout) {
          this.parent?.updateLayout();
        }
      } else if (changedLayout) {
        this.parent?.updateLayout();
      }

      isFunc(this.onLayout) && this.onLayout.call(this, this);
    }
  }

  _stateChanged() {
    log('State Changed: ', this, this.states);

    if (this.forwardStates) {
      // apply states to children first
      const states = this.states.slice() as States;
      this.children.forEach((c) => {
        c.states = states;
      });
    }

    const states = this.states;

    if (this._undoStyles || (this.style && keyExists(this.style, states))) {
      this._undoStyles = this._undoStyles || [];
      const stylesToUndo: { [key: string]: any } = {};

      this._undoStyles.forEach((styleKey) => {
        stylesToUndo[styleKey] = this.style[styleKey];
      });

      const newStyles: NodeStyles | TextStyles = states.reduce((acc, state) => {
        const styles = this.style[state];
        if (styles) {
          acc = {
            ...acc,
            ...styles,
          };
        }
        return acc;
      }, {});

      this._undoStyles = Object.keys(newStyles);

      // Apply transition first
      if (newStyles.transition !== undefined) {
        this.transition = newStyles.transition as NodeStyles['transition'];
      }

      // Apply the styles
      Object.assign(this, stylesToUndo, newStyles);
    }
  }

  render(topNode?: boolean) {
    // Elements are inserted from the inside out, then rendered from the outside in.
    // Render starts when an element is insertered with a parent that is already renderered.
    const node = this;
    const parent = this.parent;

    if (!parent) {
      console.warn('Parent not set - no node created for: ', this);
      return;
    }

    if (!parent.rendered) {
      console.warn('Parent not rendered yet: ', this);
      return;
    }

    if (parent.requiresLayout()) {
      layoutQueue.add(parent);
    }

    if (this.rendered) {
      // This happens if Array of items is reordered to reuse elements.
      // We return after layout is queued so the change can trigger layout updates.
      return;
    }

    if (this._states) {
      this._stateChanged();
    }

    const props = node.lng;
    if (this.right || this.right === 0) {
      props.x = (parent.width || 0) - this.right;
      props.mountX = 1;
    }
    if (this.bottom || this.bottom === 0) {
      props.y = (parent.height || 0) - this.bottom;
      props.mountY = 1;
    }

    props.x = props.x || 0;
    props.y = props.y || 0;
    props.parent = parent.lng;

    if (node._effects) {
      props.shader = convertEffectsToShader(node._effects);
    }

    if (node.isTextNode()) {
      const textProps = props as IntrinsicTextProps;
      if (Config.fontSettings) {
        for (const key in Config.fontSettings) {
          if (textProps[key] === undefined) {
            textProps[key] = Config.fontSettings[key];
          }
        }
      }
      textProps.text = textProps.text || node.getText();

      if (textProps.textAlign && !textProps.contain) {
        console.warn('Text align requires contain: ', node.getText());
      }

      // contain is either width or both
      if (textProps.contain) {
        if (!textProps.width) {
          textProps.width =
            (parent.width || 0) - textProps.x! - (textProps.marginRight || 0);
        }

        if (
          textProps.contain === 'both' &&
          !textProps.height &&
          !textProps.maxLines
        ) {
          textProps.height =
            (parent.height || 0) - textProps.y! - (textProps.marginBottom || 0);
        } else if (textProps.maxLines === 1) {
          textProps.height = (textProps.height ||
            textProps.lineHeight ||
            textProps.fontSize) as number;
        }
      }

      log('Rendering: ', this, props);
      node.lng = renderer.createTextNode(props as unknown as ITextNodeProps);
      if (parent.requiresLayout()) {
        if (!props.width || !props.height) {
          node._layoutOnLoad();
        }
      }
    } else {
      // If its not an image or texture apply some defaults
      if (!props.texture) {
        // Set width and height to parent less offset
        if (isNaN(props.width as number)) {
          props.width = (parent.width || 0) - props.x;
        }

        if (isNaN(props.height as number)) {
          props.height = (parent.height || 0) - props.y;
        }

        if (props.rtt && !props.color) {
          props.color = 0xffffffff;
        }

        if (!props.color && !props.src) {
          // Default color to transparent - If you later set a src, you'll need
          // to set color '#ffffffff'
          props.color = 0x00000000;
        }
      }

      log('Rendering: ', this, props);
      node.lng = renderer.createNode(props as INodeProps);
    }

    node.rendered = true;

    if (node.autosize && parent.requiresLayout()) {
      node._layoutOnLoad();
    }

    if (node.onFail) {
      node.lng.on('failed', node.onFail);
    }

    if (node.onLoad) {
      node.lng.on('loaded', node.onLoad);
    }

    isFunc(this.onCreate) && this.onCreate.call(this, node);

    node.onEvents &&
      node.onEvents.forEach(([name, handler]) => {
        (node.lng as INode).on(name, (inode, data) => handler(node, data));
      });

    // L3 Inspector adds div to the lng object
    //@ts-expect-error - div is not in the typings
    if (node.lng?.div) {
      //@ts-expect-error - div is not in the typings
      node.lng.div.element = node;
    }

    if (node._type === NodeType.Element) {
      // only element nodes will have children that need rendering
      const numChildren = node.children.length;
      for (let i = 0; i < numChildren; i++) {
        const c = node.children[i];
        assertTruthy(c, 'Child is undefined');
        if (isElementNode(c)) {
          c.render();
        } else if (c.text && c._type === NodeType.Text) {
          // Solid Show uses an empty text node as a placeholder
          // Vue uses comment nodes for v-if
          console.warn('TextNode outside of <Text>: ', c);
        }
      }
    }
    if (topNode && !dynamicSizedNodeCount) {
      flushLayout();
    }
    node._autofocus && node.setFocus();
  }
}

for (const key of LightningRendererNumberProps) {
  Object.defineProperty(ElementNode.prototype, key, {
    get(): number {
      return this.lng[key];
    },
    set(this: ElementNode, v: number) {
      this._sendToLightningAnimatable(key, v);
    },
  });
}

for (const key of LightningRendererNonAnimatingProps) {
  Object.defineProperty(ElementNode.prototype, key, {
    get(): unknown {
      return this.lng[key];
    },
    set(v: unknown) {
      this.lng[key] = v;
    },
  });
}

// Add Border Helpers
function createEffectAccessor<T>(key: keyof StyleEffects) {
  return {
    set(this: ElementNode, value: T) {
      this.effects = this.effects
        ? {
            ...this.effects,
            [key]: value,
          }
        : { [key]: value };
    },

    get(this: ElementNode): T | undefined {
      return this.effects?.[key] as T | undefined;
    },
  };
}

Object.defineProperties(ElementNode.prototype, {
  border: borderAccessor(),
  borderLeft: borderAccessor('Left'),
  borderRight: borderAccessor('Right'),
  borderTop: borderAccessor('Top'),
  borderBottom: borderAccessor('Bottom'),
  linearGradient:
    createEffectAccessor<LinearGradientEffectProps>('linearGradient'),
  radialGradient:
    createEffectAccessor<RadialGradientEffectProps>('radialGradient'),
  radialProgress: createEffectAccessor<RadialProgressEffectProps>(
    'radialProgressGradient',
  ),
  borderRadius: {
    set(this: ElementNode, radius: BorderRadius) {
      this.effects = this.effects
        ? {
            ...this.effects,
            radius: { radius },
          }
        : { radius: { radius } };
    },

    get(this: ElementNode): BorderRadius | undefined {
      return this.effects?.radius?.radius;
    },
  },
});
