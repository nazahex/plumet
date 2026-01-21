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

export type PlumetFormat = "default" | "minify" | "pretty"

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
  /**
   * Optional list of selectors to omit entirely from the emitted CSS. Supports `*` glob.
   * Examples: "#muelle .socket", ".socials svg", "#muelle .sections a:hover", "#muelle .sections*".
   */
  omit?: string[]
}

/**
 * Global configuration that applies across all canvases.
 */
export interface PlumetGlobalConfig {
  /**
   * Formatting style for the generated CSS. "default" preserves the current compact layout,
   * "minify" removes newlines, and "pretty" adds indentation for readability.
   */
  format?: PlumetFormat
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

/**
 * Aggregated Plumet definition with shared config and canvases.
 */
export interface PlumetData {
  config?: PlumetGlobalConfig
  canvas: PlumetCanvasMap
}
