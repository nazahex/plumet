import type * as CSS from "csstype"
import type { PlumetCanvas, PlumetCanvasMap, PlumetStyle } from "./types"

type FrameKind = "rule" | "at"

interface Frame {
  kind: FrameKind
  selector: string
  style: PlumetStyle
  keys: string[]
  index: number
}

const kebabCache = new Map<string, string>()

function kebabCase(key: string): string {
  const cached = kebabCache.get(key)
  if (cached) return cached

  let result = ""
  for (let i = 0; i < key.length; i += 1) {
    const code = key.charCodeAt(i)
    if (code >= 65 && code <= 90) {
      result += `-${String.fromCharCode(code + 32)}`
    } else {
      result += key[i]
    }
  }

  kebabCache.set(key, result)
  return result
}

function injectSelector(template: string, selector: string): string {
  let idx = template.indexOf("&")
  if (idx === -1) return template

  let acc = ""
  let last = 0

  while (idx !== -1) {
    acc += template.slice(last, idx) + selector
    last = idx + 1
    idx = template.indexOf("&", last)
  }

  acc += template.slice(last)
  return acc
}

function resolveSelector(parent: string, key: string): string {
  if (key.indexOf("&") !== -1) {
    return injectSelector(key, parent)
  }

  const c = key.charCodeAt(0)
  if (c === 58 /* : */) {
    return parent + key
  }

  if (parent) {
    return `${parent} ${key}`
  }

  return key
}

function emitRule(selector: string, props: CSS.Properties, out: string[]): void {
  if (!selector) return

  out.push(selector, "{")

  for (const k in props) {
    const v = props[k as keyof CSS.Properties]
    if (v == null) continue
    out.push(kebabCase(k), ":", String(v), ";")
  }

  out.push("}\n")
}

function emitDeclarations(props: CSS.Properties, out: string[]): void {
  for (const k in props) {
    const v = props[k as keyof CSS.Properties]
    if (v == null) continue
    out.push(kebabCase(k), ":", String(v), ";")
  }
}

/**
 * Compile a nested `PlumetStyle` tree into a CSS string. Traversal is iterative (stack-based)
 * and emits declarations when a `$` block is present.
 *
 * @example
 * ```ts
 * import { compileStyle } from "@plumet/css"
 *
 * const style: PlumetStyle = {
 *   "#app": {
 *     $: { color: "black" },
 *     a: { ":hover": { $: { textDecoration: "underline" } } },
 *   },
 * }
 *
 * const css = compileStyle(style)
 * ```
 */
export function compileStyle(style: PlumetStyle): string {
  if (!style) return ""

  const out: string[] = []
  const stack: Frame[] = [
    {
      kind: "rule",
      selector: "",
      style,
      keys: Object.keys(style),
      index: 0,
    },
  ]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (!frame) break

    if (frame.index === 0 && frame.style.$) {
      if (frame.kind === "rule") {
        emitRule(frame.selector, frame.style.$, out)
      } else {
        emitDeclarations(frame.style.$, out)
      }
    }

    if (frame.index >= frame.keys.length) {
      if (frame.kind === "at") {
        out.push("}\n")
      }
      stack.pop()
      continue
    }

    const key = frame.keys[frame.index++]
    if (key === undefined) continue
    if (key === "$") continue

    const child = frame.style[key]
    if (!child || typeof child !== "object") continue

    if (key.charCodeAt(0) === 64 /* @ */) {
      out.push(key, "{")
      const childStyle = child as PlumetStyle
      stack.push({
        kind: "at",
        selector: frame.selector,
        style: childStyle,
        keys: Object.keys(childStyle),
        index: 0,
      })
      continue
    }

    const nextSelector = resolveSelector(frame.selector, key)
    const childStyle = child as PlumetStyle

    stack.push({
      kind: "rule",
      selector: nextSelector,
      style: childStyle,
      keys: Object.keys(childStyle),
      index: 0,
    })
  }

  return out.join("")
}

/**
 * Compile a single canvas into CSS using its style tree.
 *
 * @example
 * ```ts
 * import { compileCanvas } from "@plumet/css"
 *
 * const canvas: PlumetCanvas = {
 *   config: { output: "./dist/app.css" },
 *   style: { "#app": { $: { color: "black" } } },
 * }
 *
 * const css = compileCanvas(canvas)
 * ```
 */
export function compileCanvas(canvas: PlumetCanvas): string {
  return compileStyle(canvas.style)
}

/**
 * Compile multiple canvases and return a map of names to CSS strings.
 *
 * @example
 * ```ts
 * import { compileCanvasMap } from "@plumet/css"
 *
 * const canvases = {
 *   header: { config: { output: "./header.css" }, style: { "#header": { $: { color: "red" } } } },
 *   footer: { config: { output: "./footer.css" }, style: { "#footer": { $: { color: "blue" } } } },
 * }
 *
 * const cssMap = compileCanvasMap(canvases)
 * ```
 */
export function compileCanvasMap(canvasMap: PlumetCanvasMap): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of Object.keys(canvasMap)) {
    const canvas = canvasMap[key]
    if (!canvas) continue
    result[key] = compileCanvas(canvas)
  }
  return result
}
