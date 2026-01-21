import type * as CSS from "csstype"
import type {
  PlumetCanvas,
  PlumetCanvasMap,
  PlumetFormat,
  PlumetGlobalConfig,
  PlumetStyle,
} from "./types"

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

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[\\^$+?.()|[\]{}-]/g, "\\$&")
  const withWildcards = escaped.replace(/\*/g, ".*")
  return new RegExp(`^${withWildcards}$`)
}

type CompileOptions = {
  omit?: string[]
  format?: PlumetFormat
}

type CompileOptionsInput = string[] | CompileOptions | undefined

function normalizeOptions(options?: CompileOptionsInput): CompileOptions {
  if (Array.isArray(options)) return { omit: options }
  return options ?? {}
}

function collectDeclarations(props?: CSS.Properties): [string, string][] {
  if (!props) return []
  const entries: [string, string][] = []

  for (const k in props) {
    const v = props[k as keyof CSS.Properties]
    if (v == null) continue
    entries.push([kebabCase(k), String(v)])
  }

  return entries
}

function createOmitMatcher(omit?: string[]): (selector: string) => boolean {
  const omitMatchers = (omit ?? []).map(globToRegex)
  if (!omitMatchers.length) return () => false
  return (selector: string) => omitMatchers.some((re) => re.test(selector))
}

function indent(depth: number, format: PlumetFormat): string {
  if (format !== "pretty") return ""
  return "  ".repeat(depth)
}

function writeRule(
  out: string[],
  selector: string,
  declarations: [string, string][],
  depth: number,
  format: PlumetFormat,
): void {
  if (format === "pretty") {
    const base = indent(depth, format)
    out.push(base, selector, " {\n")
    for (const [prop, value] of declarations) {
      out.push(indent(depth + 1, format), prop, ": ", value, ";\n")
    }
    out.push(base, "}\n")
    return
  }

  out.push(selector, "{")
  for (const [prop, value] of declarations) {
    out.push(prop, ":", value, ";")
  }
  out.push("}")
  if (format === "default") {
    out.push("\n")
  }
}

function writeDeclarations(
  out: string[],
  declarations: [string, string][],
  depth: number,
  format: PlumetFormat,
): void {
  if (format === "pretty") {
    for (const [prop, value] of declarations) {
      out.push(indent(depth, format), prop, ": ", value, ";\n")
    }
    return
  }

  for (const [prop, value] of declarations) {
    out.push(prop, ":", value, ";")
  }
}

function wrapAtRule(name: string, body: string, depth: number, format: PlumetFormat): string {
  if (!body) return ""

  if (format === "pretty") {
    const base = indent(depth, format)
    return `${base}${name} {\n${body}${base}}\n`
  }

  const newline = format === "default" ? "\n" : ""
  return `${name}{${body}}${newline}`
}

function compileRuleNode(
  selector: string,
  style: PlumetStyle,
  depth: number,
  format: PlumetFormat,
  isOmitted: (selector: string) => boolean,
  out: string[],
): boolean {
  const startLength = out.length
  const declarations = collectDeclarations(style.$)

  if (declarations.length) {
    writeRule(out, selector, declarations, depth, format)
  }

  const keys = Object.keys(style)
  for (const key of keys) {
    if (!key || key === "$") continue

    const child = style[key]
    if (!child || typeof child !== "object") continue

    if (key.charCodeAt(0) === 64 /* @ */) {
      const bodyParts: string[] = []
      const childStyle = child as PlumetStyle
      const childDecl = collectDeclarations(childStyle.$)
      if (childDecl.length) {
        writeDeclarations(bodyParts, childDecl, depth + 1, format)
      }

      const childKeys = Object.keys(childStyle)
      for (const childKey of childKeys) {
        if (!childKey || childKey === "$") continue
        const nested = childStyle[childKey]
        if (!nested || typeof nested !== "object") continue

        if (childKey.charCodeAt(0) === 64 /* @ */) {
          const nestedBody = compileAtRule(
            childKey,
            nested as PlumetStyle,
            selector,
            depth + 1,
            format,
            isOmitted,
          )
          if (nestedBody) {
            bodyParts.push(nestedBody)
          }
          continue
        }

        const nestedSelector = resolveSelector(selector, childKey)
        if (isOmitted(nestedSelector)) {
          continue
        }

        compileRuleNode(
          nestedSelector,
          nested as PlumetStyle,
          depth + 1,
          format,
          isOmitted,
          bodyParts,
        )
      }

      const body = bodyParts.join("")
      if (body) {
        out.push(wrapAtRule(key, body, depth, format))
      }
      continue
    }

    const nextSelector = resolveSelector(selector, key)
    if (isOmitted(nextSelector)) {
      continue
    }

    compileRuleNode(nextSelector, child as PlumetStyle, depth, format, isOmitted, out)
  }

  return out.length > startLength
}

function compileAtRule(
  name: string,
  style: PlumetStyle,
  parentSelector: string,
  depth: number,
  format: PlumetFormat,
  isOmitted: (selector: string) => boolean,
): string {
  const bodyParts: string[] = []
  const declarations = collectDeclarations(style.$)
  if (declarations.length) {
    writeDeclarations(bodyParts, declarations, depth + 1, format)
  }

  const keys = Object.keys(style)
  for (const key of keys) {
    if (!key || key === "$") continue
    const child = style[key]
    if (!child || typeof child !== "object") continue

    if (key.charCodeAt(0) === 64 /* @ */) {
      const nestedBody = compileAtRule(
        key,
        child as PlumetStyle,
        parentSelector,
        depth + 1,
        format,
        isOmitted,
      )
      if (nestedBody) {
        bodyParts.push(nestedBody)
      }
      continue
    }

    const nextSelector = resolveSelector(parentSelector, key)
    if (isOmitted(nextSelector)) {
      continue
    }

    compileRuleNode(nextSelector, child as PlumetStyle, depth + 1, format, isOmitted, bodyParts)
  }

  const body = bodyParts.join("")
  return wrapAtRule(name, body, depth, format)
}

/**
 * Compile a nested `PlumetStyle` tree into a CSS string.
 */
export function compileStyle(style: PlumetStyle, options?: CompileOptionsInput): string {
  if (!style) return ""

  const { omit, format = "default" } = normalizeOptions(options)
  const isOmitted = createOmitMatcher(omit)
  const out: string[] = []

  const keys = Object.keys(style)
  for (const key of keys) {
    if (!key || key === "$") continue
    const child = style[key]
    if (!child || typeof child !== "object") continue

    if (key.charCodeAt(0) === 64 /* @ */) {
      const body = compileAtRule(key, child as PlumetStyle, "", 0, format, isOmitted)
      if (body) {
        out.push(body)
      }
      continue
    }

    const selector = resolveSelector("", key)
    if (isOmitted(selector)) continue
    compileRuleNode(selector, child as PlumetStyle, 0, format, isOmitted, out)
  }

  return out.join("")
}

export function compileCanvas(canvas: PlumetCanvas, globalConfig?: PlumetGlobalConfig): string {
  const omit = canvas.config?.omit
  const format = globalConfig?.format
  let options: CompileOptionsInput
  if (omit != null && format != null) {
    options = { omit, format }
  } else if (omit != null) {
    options = omit
  } else if (format != null) {
    options = { format }
  }

  return compileStyle(canvas.style, options)
}

export function compileCanvasMap(
  canvasMap: PlumetCanvasMap,
  globalConfig?: PlumetGlobalConfig,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of Object.keys(canvasMap)) {
    const canvas = canvasMap[key]
    if (!canvas) continue
    result[key] = compileCanvas(canvas, globalConfig)
  }
  return result
}
