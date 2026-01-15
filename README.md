# DEPRECATED: This repo has been merged into the lightning-tv/solid repo

Future changes will be made there and released with the solid package.

# Lightning TV Core for Universal Renderers

Provides an abstraction layer for Lightning Renderer which Universal renders like Solid & Vue can use.

## Upgrade guide 2.5

All states in style object must start with a $. So focus: will be $focus. Additionally, any state keys you use must also be prefixed with a $ - `states={{ $active: true }}` - this will provide better Typescript support.

onBeforeLayout is removed, use onLayout instead
onAnimation added `onAnimation?: Record<AnimationEvents, AnimationEventHandler>;`

- onAnimationStarted and onAnimationFinished removed, use onAnimation.
  onEvents is now onEvent with signature `onEvent?: Record<NodeEvents, EventHandler>;`
- onLoad and onFailed removed, use onEvent instead

```jsx
onEvent={{
  loaded: callbackFunc;
}}
```

Use effects in style is preferred for performance:

border, borderLeft/Right/Top/Bottom, linearGradient, radialGradient, borderRadius are all effects.
So rather than using borderRadius, use `effects: { border: { width: 10, color: 0x000000ff }, radius: { radius: 8 }}` (radius is the only weird one like this)
