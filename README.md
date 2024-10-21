# Lightning TV Core for Universal Renderers

Provides an abstraction layer for Lightning Renderer which Universal renders like Solid & Vue can use.

## Migrating states

All states in style object must start with a $. So focus: will be $focus. Additionally, any state keys you use must also be prefixed with a $ - `states={{ $active: true }}`

onBeforeLayout is removed

onAnimation added `onAnimation?: Record<AnimationEvents, AnimationEventHandler>;`
onAnimationStarted and onAnimationFinished removed, use onAnimation.
onEvents is now onEvent with signature `onEvent?: Record<NodeEvents, EventHandler>;`

Use effects in style
New caching layer added to effects. So rather than using borderRadius, use `effects: { radius: { radius: 8 }}` (radius is the only weird one like this)
