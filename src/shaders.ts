import * as lngr from '@lightningjs/renderer';
import * as lngr_shaders from '@lightningjs/renderer/webgl/shaders';

import type {
  RoundedProps as ShaderRoundedProps,
  ShadowProps as ShaderShadowProps,
  HolePunchProps as ShaderHolePunchProps,
  RadialGradientProps as ShaderRadialGradientProps,
  LinearGradientProps as ShaderLinearGradientProps,
} from '@lightningjs/renderer';
export {
  ShaderRoundedProps,
  ShaderShadowProps,
  ShaderHolePunchProps,
  ShaderRadialGradientProps,
  ShaderLinearGradientProps,
};

import { type WebGlShaderType as WebGlShader } from '@lightningjs/renderer/webgl';
export { WebGlShader };

import { type IRendererShaderManager } from './lightningInit.js';
import { DOM_RENDERING, SHADERS_ENABLED } from './config.js';

export type Vec4 = [x: number, y: number, z: number, w: number];

export interface ShaderBorderProps extends lngr.BorderProps {
  width: number | Vec4;
  right: number;
  left: number;
  top: number;
  bottom: number;
  color: number;
  gap: number;
  gapColor: number;
}

export type ShaderBorderPrefixedProps = {
  [P in keyof ShaderBorderProps as `border-${P}`]: ShaderBorderProps[P];
};
export type ShaderShadowPrefixedProps = {
  [P in keyof ShaderShadowProps as `shadow-${P}`]: ShaderShadowProps[P];
};

export type ShaderRoundedWithShadowProps = ShaderRoundedProps &
  ShaderShadowPrefixedProps;
export type ShaderRoundedWithBorderProps = ShaderRoundedProps &
  ShaderBorderPrefixedProps;
export type ShaderRoundedWithBorderAndShadowProps = ShaderRoundedProps &
  ShaderShadowPrefixedProps &
  ShaderBorderPrefixedProps;

export type ShaderRounded = WebGlShader<ShaderRoundedProps>;
export type ShaderShadow = WebGlShader<ShaderShadowProps>;
export type ShaderRoundedWithBorder = WebGlShader<ShaderRoundedWithBorderProps>;
export type ShaderRoundedWithShadow = WebGlShader<ShaderRoundedWithShadowProps>;
export type ShaderRoundedWithBorderAndShadow =
  WebGlShader<ShaderRoundedWithBorderAndShadowProps>;
export type ShaderHolePunch = WebGlShader<ShaderHolePunchProps>;
export type ShaderRadialGradient = WebGlShader<ShaderRadialGradientProps>;
export type ShaderLinearGradient = WebGlShader<ShaderLinearGradientProps>;

export const defaultShaderRounded: ShaderRounded = lngr_shaders.Rounded;
export const defaultShaderShadow: ShaderShadow = lngr_shaders.Shadow;
export const defaultShaderRoundedWithShadow: ShaderRoundedWithShadow =
  lngr_shaders.RoundedWithShadow;
// TODO: lngr_shaders.RoundedWithBorderAndShadow doesn't support border-gap and border-gapColor
export const defaultShaderRoundedWithBorderAndShadow =
  lngr_shaders.RoundedWithBorderAndShadow as ShaderRoundedWithBorderAndShadow;
export const defaultShaderHolePunch: ShaderHolePunch = lngr_shaders.HolePunch;
export const defaultShaderRadialGradient: ShaderRadialGradient =
  lngr_shaders.RadialGradient;
export const defaultShaderLinearGradient: ShaderLinearGradient =
  lngr_shaders.LinearGradient;

function calcFactoredRadiusArray(
  radius: Vec4,
  width: number,
  height: number,
): Vec4 {
  const result: Vec4 = [radius[0], radius[1], radius[2], radius[3]];
  const factor = Math.min(
    Math.min(
      Math.min(
        width / Math.max(width, radius[0] + radius[1]),
        width / Math.max(width, radius[2] + radius[3]),
      ),
      Math.min(
        height / Math.max(height, radius[0] + radius[3]),
        height / Math.max(height, radius[1] + radius[2]),
      ),
    ),
    1,
  );
  result[0] *= factor;
  result[1] *= factor;
  result[2] *= factor;
  result[3] *= factor;
  return result;
}

function toValidVec4(value: unknown): Vec4 {
  if (typeof value === 'number') {
    return [value, value, value, value];
  }
  if (Array.isArray(value)) {
    switch (value.length) {
      default:
      case 4:
        return value as Vec4;
      case 3:
        return [value[0], value[1], value[2], value[0]];
      case 2:
        return [value[0], value[1], value[0], value[1]];
      case 1:
        return [value[0], value[0], value[0], value[0]];
      case 0:
        break;
    }
  }
  return [0, 0, 0, 0];
}

const roundedWithBorderProps: lngr.ShaderProps<ShaderRoundedWithBorderProps> = {
  radius: {
    default: [0, 0, 0, 0],
    resolve(value) {
      return toValidVec4(value);
    },
  },
  'top-left': {
    default: 0,
    set(value, props) {
      (props.radius as Vec4)[0] = value;
    },
    get(props) {
      return (props.radius as Vec4)[0];
    },
  },
  'top-right': {
    default: 0,
    set(value, props) {
      (props.radius as Vec4)[1] = value;
    },
    get(props) {
      return (props.radius as Vec4)[1];
    },
  },
  'bottom-right': {
    default: 0,
    set(value, props) {
      (props.radius as Vec4)[2] = value;
    },
    get(props) {
      return (props.radius as Vec4)[2];
    },
  },
  'bottom-left': {
    default: 0,
    set(value, props) {
      (props.radius as Vec4)[3] = value;
    },
    get(props) {
      return (props.radius as Vec4)[3];
    },
  },
  'border-width': {
    default: [0, 0, 0, 0],
    resolve(value) {
      return toValidVec4(value);
    },
  },
  'border-color': 0xffffffff,
  'border-gap': 0,
  'border-gapColor': 0x00000000,
  'border-top': {
    default: 0,
    set(value, props) {
      (props['border-width'] as Vec4)[0] = value;
    },
    get(props) {
      return (props['border-width'] as Vec4)[0];
    },
  },
  'border-right': {
    default: 0,
    set(value, props) {
      (props['border-width'] as Vec4)[1] = value;
    },
    get(props) {
      return (props['border-width'] as Vec4)[1];
    },
  },
  'border-bottom': {
    default: 0,
    set(value, props) {
      (props['border-width'] as Vec4)[2] = value;
    },
    get(props) {
      return (props['border-width'] as Vec4)[2];
    },
  },
  'border-left': {
    default: 0,
    set(value, props) {
      (props['border-width'] as Vec4)[3] = value;
    },
    get(props) {
      return (props['border-width'] as Vec4)[3];
    },
  },
};

export const defaultShaderRoundedWithBorder: ShaderRoundedWithBorder = {
  props: roundedWithBorderProps,
  canBatch: () => false,
  update(node) {
    const props = this.props!;
    const borderWidth = props['border-width'] as Vec4;
    const borderGap = props['border-gap'] || 0;

    this.uniformRGBA('u_borderColor', props['border-color']);
    this.uniform4fa('u_borderWidth', borderWidth);
    this.uniform1f('u_borderGap', borderGap);
    this.uniformRGBA('u_borderGapColor', props['border-gapColor']);

    const origWidth = node.width;
    const origHeight = node.height;
    this.uniform2f('u_dimensions_orig', origWidth, origHeight);

    const expandedWidth =
      origWidth + borderWidth[3] + borderWidth[1] + borderGap * 2; // original + left + right + 2*gap
    const expandedHeight =
      origHeight + borderWidth[0] + borderWidth[2] + borderGap * 2; // original + top + bottom + 2*gap

    // u_dimensions for the shader's SDF functions should be the expanded size
    this.uniform2f('u_dimensions', expandedWidth, expandedHeight);

    // The `radius` property is for the content rectangle.
    // Factor it against the original dimensions to prevent self-intersection.
    const contentRadius = calcFactoredRadiusArray(
      this.props!.radius as Vec4,
      origWidth,
      origHeight,
    );

    // From the content radius, calculate the outer radius of the border.
    // For each corner, the total radius is content radius + gap + border thickness.
    // Border thickness at a corner is approximated as the max of the two adjacent border sides.
    const bTop = borderWidth[0],
      bRight = borderWidth[1],
      bBottom = borderWidth[2],
      bLeft = borderWidth[3];
    const outerRadius: Vec4 = [
      contentRadius[0] + borderGap + Math.max(bTop, bLeft), // top-left
      contentRadius[1] + borderGap + Math.max(bTop, bRight), // top-right
      contentRadius[2] + borderGap + Math.max(bBottom, bRight), // bottom-right
      contentRadius[3] + borderGap + Math.max(bBottom, bLeft), // bottom-left
    ];

    // The final radius passed to the shader is the outer radius of the whole shape.
    // It also needs to be factored against the expanded dimensions.
    // The shader will then work inwards to calculate the radii for the gap and content.
    this.uniform4fa(
      'u_radius',
      calcFactoredRadiusArray(outerRadius, expandedWidth, expandedHeight),
    );
  },
  vertex: /*glsl*/ `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    attribute vec2 a_position;
    attribute vec2 a_textureCoords;
    attribute vec4 a_color;
    attribute vec2 a_nodeCoords;

    uniform vec2 u_resolution;
    uniform float u_pixelRatio;
    uniform vec2 u_dimensions;
    uniform vec2 u_dimensions_orig;

    uniform vec4 u_radius;
    uniform vec4 u_borderWidth;
    uniform float u_borderGap;

    varying vec4 v_color;
    varying vec2 v_textureCoords;
    varying vec2 v_nodeCoords;
    varying vec4 v_borderEndRadius;
    varying vec2 v_borderEndSize;

    varying vec4 v_innerRadius;
    varying vec2 v_innerSize;
    varying vec2 v_halfDimensions;
    varying float v_borderZero;

    void main() {
      vec2 screenSpace = vec2(2.0 / u_resolution.x, -2.0 / u_resolution.y);

      v_color = a_color;
      v_nodeCoords = a_nodeCoords;

      float bTop = u_borderWidth.x;
      float bRight = u_borderWidth.y;
      float bBottom = u_borderWidth.z;
      float bLeft = u_borderWidth.w;
      float gap = u_borderGap;

      // Calculate the offset to expand the quad for border and gap
      vec2 expansionOffset = vec2(0.0);
      if (a_nodeCoords.x == 0.0) { // Left edge vertex
          expansionOffset.x = -(bLeft + gap);
      } else { // Right edge vertex (a_nodeCoords.x == 1.0)
          expansionOffset.x = (bRight + gap);
      }
      if (a_nodeCoords.y == 0.0) { // Top edge vertex
          expansionOffset.y = -(bTop + gap);
      } else { // Bottom edge vertex (a_nodeCoords.y == 1.0)
          expansionOffset.y = (bBottom + gap);
      }

      vec2 expanded_a_position = a_position + expansionOffset;
      vec2 normalized = expanded_a_position * u_pixelRatio;

      // u_dimensions is expanded, u_dimensions_orig is original content size
      v_textureCoords.x = (a_textureCoords.x * u_dimensions.x - (bLeft + gap)) / u_dimensions_orig.x;
      v_textureCoords.y = (a_textureCoords.y * u_dimensions.y - (bTop + gap)) / u_dimensions_orig.y;

      v_borderZero = (u_borderWidth.x == 0.0 && u_borderWidth.y == 0.0 && u_borderWidth.z == 0.0 && u_borderWidth.w == 0.0) ? 1.0 : 0.0;
      // If there's no border, there's no gap from the border logic perspective
      // The Rounded shader itself would handle radius if borderZero is true.
      // However, RoundedWithBorder implies border capabilities.
      // If border width is 0 but gap is > 0, it should effectively be a rounded rect with padding.
      // For now, if border is zero, gap is also considered zero for this specific border logic.

      v_halfDimensions = u_dimensions * 0.5; // u_dimensions is now expanded_dimensions
      if(v_borderZero == 0.0) {
        // Calculate radius and size for the inner edge of the border (where the gap begins)
        v_borderEndRadius = vec4(
          max(0.0, u_radius.x - max(bTop, bLeft) - 0.5),
          max(0.0, u_radius.y - max(bTop, bRight) - 0.5),
          max(0.0, u_radius.z - max(bBottom, bRight) - 0.5),
          max(0.0, u_radius.w - max(bBottom, bLeft) - 0.5)
        );
        v_borderEndSize = vec2(
            (u_dimensions.x - (bLeft + bRight) - 1.0),
            (u_dimensions.y - (bTop + bBottom) - 1.0)
        ) * 0.5;

        // Calculate radius and size for the content area (after the gap)
        v_innerRadius = vec4(
          max(0.0, u_radius.x - max(bTop, bLeft) - u_borderGap - 0.5),
          max(0.0, u_radius.y - max(bTop, bRight) - u_borderGap - 0.5),
          max(0.0, u_radius.z - max(bBottom, bRight) - u_borderGap - 0.5),
          max(0.0, u_radius.w - max(bBottom, bLeft) - u_borderGap - 0.5)
        );
        v_innerSize = vec2(
            (u_dimensions.x - (bLeft + bRight) - (u_borderGap * 2.0) - 1.0),
            (u_dimensions.y - (bTop + bBottom) - (u_borderGap * 2.0) - 1.0)
        ) * 0.5;
      }

      gl_Position = vec4(normalized.x * screenSpace.x - 1.0, normalized.y * -abs(screenSpace.y) + 1.0, 0.0, 1.0);
      gl_Position.y = -sign(screenSpace.y) * gl_Position.y;
    }
  `,
  fragment: /*glsl*/ `
    # ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    # else
    precision mediump float;
    # endif

    uniform vec2 u_resolution;
    uniform float u_pixelRatio;
    uniform float u_alpha;
    uniform vec2 u_dimensions;
    uniform sampler2D u_texture;

    uniform vec4 u_radius;

    uniform vec4 u_borderWidth;
    uniform vec4 u_borderColor;
    uniform vec4 u_borderGapColor;

    varying vec4 v_borderEndRadius;
    varying vec2 v_borderEndSize;

    varying vec4 v_color;
    varying vec2 v_textureCoords;
    varying vec2 v_nodeCoords;

    varying vec2 v_halfDimensions;
    varying vec4 v_innerRadius;
    varying vec2 v_innerSize;
    varying float v_borderZero;

    float roundedBox(vec2 p, vec2 s, vec4 r) {
      r.xy = (p.x > 0.0) ? r.yz : r.xw;
      r.x = (p.y > 0.0) ? r.y : r.x;
      vec2 q = abs(p) - s + r.x;
      return (min(max(q.x, q.y), 0.0) + length(max(q, 0.0))) - r.x;
    }

    void main() {
      vec4 contentTexColor = texture2D(u_texture, v_textureCoords) * v_color;

      vec2 boxUv = v_nodeCoords.xy * u_dimensions - v_halfDimensions;
      float outerShapeDist = roundedBox(boxUv, v_halfDimensions, u_radius);
      float outerShapeAlpha = 1.0 - smoothstep(0.0, 1.0, outerShapeDist); // 1 inside, 0 outside

      if(v_borderZero == 1.0) { // No border, effectively no gap from border logic
        gl_FragColor = mix(vec4(0.0), contentTexColor, outerShapeAlpha) * u_alpha;
        return;
      }

      // Adjust boxUv for non-uniform borders (consistent with original shader)
      // This adjusted UV is used for calculating distances to border-end and content shapes
      vec2 adjustedBoxUv = boxUv;
      adjustedBoxUv.x += (u_borderWidth.y - u_borderWidth.w) * 0.5;
      adjustedBoxUv.y += (u_borderWidth.z - u_borderWidth.x) * 0.5;

      // Distance to the inner edge of the border (where the gap begins)
      float borderEndDist = roundedBox(adjustedBoxUv, v_borderEndSize, v_borderEndRadius);
      float borderEndAlpha = 1.0 - smoothstep(0.0, 1.0, borderEndDist); // 1 if inside gap or content, 0 if in border or outside

      // Distance to the content area (after the gap)
      float contentDist = roundedBox(adjustedBoxUv, v_innerSize, v_innerRadius);
      float contentAlpha = 1.0 - smoothstep(0.0, 1.0, contentDist); // 1 if inside content, 0 if in gap, border or outside

      vec4 finalColor;
      if (contentAlpha > 0.0) { // Pixel is inside the content area
        finalColor = contentTexColor;
      } else if (borderEndAlpha > 0.0) { // Pixel is inside the gap area
        // Pre-multiply alpha for correct blending
        finalColor = u_borderGapColor;
        finalColor.rgb *= finalColor.a;
      } else { // Pixel is inside the border area
        // Pre-multiply alpha for correct blending
        finalColor = u_borderColor;
        finalColor.rgb *= finalColor.a;
      }

      gl_FragColor = mix(vec4(0.0), finalColor, outerShapeAlpha) * u_alpha;
    }
  `,
};

export function registerDefaultShaderRounded(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType('rounded', defaultShaderRounded);
}
export function registerDefaultShaderShadow(shManager: IRendererShaderManager) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType('shadow', defaultShaderShadow);
}
export function registerDefaultShaderRoundedWithBorder(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType(
      'roundedWithBorder',
      defaultShaderRoundedWithBorder,
    );
}
export function registerDefaultShaderRoundedWithShadow(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType(
      'roundedWithShadow',
      defaultShaderRoundedWithShadow,
    );
}
export function registerDefaultShaderRoundedWithBorderAndShadow(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType(
      'roundedWithBorderWithShadow',
      defaultShaderRoundedWithBorderAndShadow,
    );
}
export function registerDefaultShaderHolePunch(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType('holePunch', defaultShaderHolePunch);
}
export function registerDefaultShaderRadialGradient(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType('radialGradient', defaultShaderRadialGradient);
}
export function registerDefaultShaderLinearGradient(
  shManager: IRendererShaderManager,
) {
  if (SHADERS_ENABLED && !DOM_RENDERING)
    shManager.registerShaderType('linearGradient', defaultShaderLinearGradient);
}

export function registerDefaultShaders(shManager: IRendererShaderManager) {
  if (SHADERS_ENABLED && !DOM_RENDERING) {
    registerDefaultShaderRounded(shManager);
    registerDefaultShaderShadow(shManager);
    registerDefaultShaderRoundedWithBorder(shManager);
    registerDefaultShaderRoundedWithShadow(shManager);
    registerDefaultShaderRoundedWithBorderAndShadow(shManager);
    registerDefaultShaderHolePunch(shManager);
    registerDefaultShaderRadialGradient(shManager);
    registerDefaultShaderLinearGradient(shManager);
  }
}
