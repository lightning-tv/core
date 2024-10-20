# Lightning TV Core for Universal Renderers

Provides an abstraction layer for Lightning Renderer which Universal renders like Solid & Vue can use.

## Migrating states

All states in style object must start with a $. So focus: will be $focus. Additionally, any state keys you use must also be prefixed with a $ - `states={{ $active: true }}`
