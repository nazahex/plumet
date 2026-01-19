import type * as CSS from "csstype"

/**
 * Nested CSS style tree consumed by the Plumet compiler. `$` holds declarations for the
 * current selector; other keys represent selectors, at-rules, or nested scopes.
 *
 * @example Basic selector with declarations
 * ```ts
 * const style: PlumetStyle = {
 *   "#app": {
 *     $: { color: "red" },
 *   },
 * }
 * ```
 *
 * @example Nested selector with pseudo and `&`
 * ```ts
 * const style: PlumetStyle = {
 *   ".btn": {
 *     $: { padding: "8px 12px" },
 *     ":hover": { $: { opacity: 0.8 } },
 *     "&.primary": { $: { background: "blue" } },
 *   },
 * }
 * ```
 */
export interface PlumetStyle {
  $?: CSS.Properties
  [selector: string]: PlumetStyle | CSS.Properties | undefined
}

/**
 * Per-canvas configuration for the generator.
 *
 * @example
 * ```ts
 * const config: PlumetConfig = { output: "./dist/button.css" }
 * ```
 */
export interface PlumetConfig {
  output: string
}

/**
 * A compile-ready unit combining a config and its style tree.
 *
 * @example
 * ```ts
 * const canvas: PlumetCanvas = {
 *   config: { output: "./dist/app.css" },
 *   style: { "#app": { $: { color: "black" } } },
 * }
 * ```
 */
export interface PlumetCanvas {
  config: PlumetConfig
  style: PlumetStyle
}

/**
 * Map of named canvases consumed by the CLI or programmatic compiler.
 *
 * @example
 * ```ts
 * const canvases: PlumetCanvasMap = {
 *   header: headerCanvas,
 *   footer: footerCanvas,
 * }
 * ```
 */
export type PlumetCanvasMap = Record<string, PlumetCanvas>
