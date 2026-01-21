const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const BLUE = "\x1b[34m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RED = "\x1b[31m"
const GRAY = "\x1b[90m"
const MAGENTA = "\x1b[35m"

type Kind = "info" | "warn" | "error" | "done" | "summary"

export type WatchKind = "built" | "modified" | "invalid" | "failed"

interface Line {
  label: string
  value: string
  color?: "gray"
}

export interface WatchEvent {
  kind: WatchKind
  label: string
  value: string
  time?: number | Date
}

const symbols: Record<Kind, string> = {
  info: "◆ ⟦info⟧",
  warn: "▲ ⟦warn⟧",
  error: "✖ ⟦error⟧",
  done: "✔ ⟦done⟧",
  summary: "❖ SUMMARY",
}

const watchSymbol = "⥁ ⟦watch⟧"

const palette: Record<Kind, string> = {
  info: BLUE,
  warn: YELLOW,
  error: RED,
  done: GREEN,
  summary: BOLD,
}

const watchPalette: Record<WatchKind, string> = {
  built: GRAY,
  modified: BLUE,
  invalid: RED,
  failed: RED,
}

function style(text: string, ...codes: string[]): string {
  if (!codes.length) return text
  return `${codes.join("")}${text}${RESET}`
}

/**
 * Color a string gray using ANSI codes.
 */
export function gray(text: string): string {
  return style(text, GRAY)
}

/**
 * Render the leading heading line, e.g., `› plumet building css`, fully tinted gray.
 */
export function heading(tool: string, verbIng: string, domain: string, subdomain?: string): void {
  const parts: string[] = ["›", tool, verbIng, domain]
  if (subdomain) parts.push(subdomain)
  console.log(gray(parts.join(" ")))
  console.log("")
}

function label(kind: Kind): string {
  const code = palette[kind] ?? ""
  return style(style(symbols[kind], BOLD), code)
}

function valueWithColor(value: string, color?: "gray"): string {
  if (!color) return value
  return style(value, GRAY)
}

function formatTime(ts: number | Date | undefined): string {
  const d = ts instanceof Date ? ts : new Date(ts ?? Date.now())
  const pad = (n: number, size = 2) => String(n).padStart(size, "0")
  const ms = pad(Math.floor(d.getMilliseconds() / 10), 2)
  return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${ms}]`
}

function printWatch(events: WatchEvent[], withHeader: boolean, printed: { header: boolean }): void {
  if (!events.length) return

  if (withHeader && !printed.header) {
    console.log(style(style(watchSymbol, BOLD), MAGENTA))
    printed.header = true
  }

  for (const event of events) {
    const tint = watchPalette[event.kind] ?? GRAY
    const timePart = style(formatTime(event.time), tint)
    const labelPart = style(event.label, BOLD, tint)
    const valuePart =
      event.kind === "invalid" || event.kind === "failed" ? style(event.value, tint) : event.value
    console.log(`  - ${timePart} ${labelPart}: ${valuePart}`)
  }
}

function printBlock(kind: Kind, lines: Line[]): void {
  console.log(label(kind))
  for (const line of lines) {
    console.log(`  - ${style(line.label, BOLD)}: ${valueWithColor(line.value, line.color)}`)
  }
  console.log("")
}

export interface Summary {
  files: number
  errors: number
  warnings: number
  totalBytes?: number
}

/**
 * Create a minimal TUI printer for info/warn/error/done blocks and a summary line.
 */
export function createTui() {
  const printed = { header: false }
  return {
    info(lines: Line[]): void {
      printBlock("info", lines)
    },
    warn(lines: Line[]): void {
      printBlock("warn", lines)
    },
    error(lines: Line[]): void {
      printBlock("error", lines)
    },
    done(lines: Line[]): void {
      printBlock("done", lines)
    },
    summary(meta: Summary): void {
      const human = (b?: number) => {
        if (!b && b !== 0) return undefined
        if (b < 1024) return `${b} B`
        const kb = b / 1024
        if (kb < 1024) return `${kb.toFixed(1)} KB`
        return `${(kb / 1024).toFixed(1)} MB`
      }

      const filePart = `${meta.files} files${meta.totalBytes ? ` (${human(meta.totalBytes)})` : ""}`
      const parts = [filePart, `${meta.errors} error`, `${meta.warnings} warning`]
      console.log(`${label("summary")} - ${parts.join(" ┄ ")}`)
    },
    watch(events: WatchEvent[]): void {
      printWatch(events, true, printed)
    },
  }
}

export type { Line }
