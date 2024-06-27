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
  type ShaderEffectDesc,
  AddColorString,
} from './intrinsicTypes.js';
import Children from './children.js';
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
  INodeAnimatableProps,
  INodeWritableProps,
  ShaderRef,
  Dimensions,
  AnimationSettings,
  NodeLoadedPayload,
  LinearGradientEffectProps,
  ITextNodeWritableProps,
  IAnimationController,
} from '@lightningjs/renderer';
import { assertTruthy } from '@lightningjs/renderer/utils';
import { NodeType } from './nodeTypes.js';

const layoutQueue = new Set<ElementNode>();
let queueLayout = true;

function convertEffectsToShader(styleEffects: StyleEffects) {
  // Should be EffectDesc
  const effects: ShaderEffectDesc[] = [];

  for (const [type, props] of Object.entries(styleEffects)) {
    effects.push({ type, props } as ShaderEffectDesc);
  }
  return createShader('DynamicShader', { effects: effects as any[] });
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
  'verticalAlign',
  'wordWrap',
];

export type Styles = {
  [key: string]: NodeStyles | TextStyles | undefined;
} & (NodeStyles | TextStyles);

/** Node text, children of a ElementNode of type TextNode */
export interface ElementText {
  id?: string;
  type: 'text';
  parent?: ElementNode;
  text: string;
  states?: States;
  _queueDelete?: boolean;
}
export interface ElementNode
  extends AddColorString<
      Partial<Omit<INodeWritableProps, 'parent' | 'shader'>>
    >,
    IntrinsicCommonProps {
  [key: string]: unknown;
  id?: string;
  debug?: boolean;
  type: 'element' | 'textNode';
  lng: INode | IntrinsicNodeProps | IntrinsicTextProps;
  rendered: boolean;
  renderer?: RendererMain;
  selected?: number;
  autofocus?: boolean;
  flexItem?: boolean;
  flexOrder?: number;
  flexGrow?: number;
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
  _animationSettings?: Partial<AnimationSettings>;
  _animationQueue:
    | Array<{
        props: Partial<INodeAnimatableProps>;
        animationSettings?: Partial<AnimationSettings>;
      }>
    | undefined;
  _animationQueueSettings: Partial<AnimationSettings> | undefined;
  _animationRunning?: boolean;
  children: Children;
}
export class ElementNode extends Object {
  constructor(name: string) {
    super();
    this.type = name === 'text' ? NodeType.TextNode : NodeType.Element;
    this.rendered = false;
    this.lng = {} as (typeof this)['lng'];
    this.children = new Children(this);
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

  get parent() {
    return this._parent;
  }

  set parent(p) {
    this._parent = p;
    if (this.rendered) {
      this.lng.parent = p?.lng ?? null;
    }
  }

  set shader(shaderProps: Parameters<typeof createShader> | ShaderRef) {
    if (isArray(shaderProps)) {
      shaderProps = createShader(...shaderProps) as ShaderRef;
    }
    this.lng.shader = shaderProps;
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
    props: Partial<INodeAnimatableProps>,
    animationSettings?: Partial<AnimationSettings>,
  ): IAnimationController {
    assertTruthy(this.rendered, 'Node must be rendered before animating');
    return (this.lng as INode).animate(
      props,
      animationSettings || this.animationSettings,
    );
  }

  chain(
    props: Partial<INodeAnimatableProps>,
    animationSettings?: Partial<AnimationSettings>,
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
          if (focusedIndex !== null && focusedIndex < this.children.length) {
            const child = this.children[focusedIndex];
            isElementNode(child) && child.setFocus();
            return;
          }
        }
      }
      // Delay setting focus so children can render (useful for Row + Column)
      queueMicrotask(() => Config.setActiveElement(this));
    } else {
      this.autofocus = true;
    }
  }

  isTextNode() {
    return this.type === NodeType.TextNode;
  }

  _layoutOnLoad() {
    (this.lng as INode).on(
      'loaded',
      (_node: INode, loadedPayload: NodeLoadedPayload) => {
        const { dimensions } = loadedPayload;
        this.parent!.updateLayout(this, dimensions);
      },
    );
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
      const child = this.children[i] as ElementNode;
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
    this._states = new States(this._stateChanged.bind(this), states);
    if (this.rendered) {
      this._stateChanged();
    }
  }

  get states(): States {
    this._states = this._states || new States(this._stateChanged.bind(this));
    return this._states;
  }

  get animationSettings(): Partial<AnimationSettings> {
    return this._animationSettings || Config.animationSettings;
  }

  set animationSettings(animationSettings: Partial<AnimationSettings>) {
    this._animationSettings = animationSettings;
  }

  requiresLayout() {
    return this.display === 'flex' || this.onBeforeLayout;
  }

  updateLayout(child?: ElementNode, dimensions?: Dimensions) {
    if (this.hasChildren) {
      log('Layout: ', this);
      let changedLayout = false;
      if (isFunc(this.onBeforeLayout)) {
        changedLayout =
          this.onBeforeLayout.call(this, this, child, dimensions) || false;
      }

      if (this.display === 'flex') {
        if (calculateFlex(this) || changedLayout) {
          this.parent?.updateLayout();
        }
      } else if (changedLayout) {
        this.parent?.updateLayout();
      }

      isFunc(this.onLayout) &&
        this.onLayout.call(this, this, child, dimensions);
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

  render() {
    // Elements are rendered from the outside in, then `insert`ed from the inside out.
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

    if (this.rendered) {
      console.warn('Node already rendered: ', this);
      return;
    }

    if (parent.requiresLayout() && !layoutQueue.has(parent)) {
      layoutQueue.add(parent);
      if (queueLayout) {
        queueLayout = false;
        queueMicrotask(() => {
          queueLayout = true;
          const queue = [...layoutQueue];
          layoutQueue.clear();
          for (let i = queue.length - 1; i >= 0; i--) {
            queue[i]!.updateLayout();
          }
        });
      }
    }

    if (this._states) {
      this._stateChanged();
    }

    const props = node.lng;
    props.x = props.x || 0;
    props.y = props.y || 0;

    if (parent.rendered) {
      props.parent = parent.lng;
    }

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
      textProps.text = node.getText();

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
      node.lng = renderer.createTextNode(
        props as unknown as ITextNodeWritableProps,
      );

      if (parent.requiresLayout() && (!props.width || !props.height)) {
        node._layoutOnLoad();
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
      node.lng = renderer.createNode(props as INodeWritableProps);
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

    if (node.type === NodeType.Element) {
      // only element nodes will have children that need rendering
      for (let i = 0; i < node.children.length; i++) {
        const c = node.children[i];
        assertTruthy(c, 'Child is undefined');
        if (isElementNode(c)) {
          c.render();
        } else if (c.text && c.type === NodeType.Text) {
          // Solid Show uses an empty text node as a placeholder
          // Vue uses comment nodes for v-if
          console.warn('TextNode outside of <Text>: ', c);
        }
      }
    }

    node.autofocus && node.setFocus();
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
Object.defineProperties(ElementNode.prototype, {
  borderRadius: {
    set(this: ElementNode, radius: BorderRadius) {
      this.effects = this.effects
        ? {
            ...this.effects,
            ...{ radius: { radius } },
          }
        : { radius: { radius } };
    },

    get(this: ElementNode): BorderRadius | undefined {
      return this.effects?.radius?.radius;
    },
  },
  border: borderAccessor(),
  borderLeft: borderAccessor('Left'),
  borderRight: borderAccessor('Right'),
  borderTop: borderAccessor('Top'),
  borderBottom: borderAccessor('Bottom'),
  linearGradient: {
    set(this: ElementNode, props: LinearGradientEffectProps = {}) {
      this.effects = this.effects
        ? {
            ...this.effects,
            ...{ linearGradient: props },
          }
        : { linearGradient: props };
    },
    get(this: ElementNode): LinearGradientEffectProps | undefined {
      return this.effects?.linearGradient;
    },
  },
});
