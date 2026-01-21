#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { collectDependencies } from "./deps"
import { compileCanvas } from "./generator"
import type { Line, WatchEvent } from "./tui"
import { createTui, gray, heading } from "./tui"
import type { PlumetCanvas, PlumetData, PlumetGlobalConfig } from "./types"
import { watchLoop } from "./watch"

function help(): void {
  console.log("Usage: plumet build [--entry <file>] [--watch]")
  console.log("\nOptions:")
  console.log("  --entry, -e   Path to plumet.ts (default: plumet.ts)")
  console.log("  --watch, -w   Rebuild on file changes")
}

function takeFlag(argv: string[], keys: string[]): string | undefined {
  for (let i = 0; i < argv.length - 1; i += 1) {
    const current = argv[i]
    if (!current) continue
    if (keys.includes(current)) {
      const next = argv[i + 1]
      if (next) return next
    }
  }
  return undefined
}

function hasFlag(argv: string[], keys: string[]): boolean {
  return argv.some((arg) => keys.includes(arg))
}

function isCanvas(value: unknown): value is PlumetCanvas {
  if (!value || typeof value !== "object") return false
  const maybe = value as Record<string, unknown>
  const config = maybe["config"] as Record<string, unknown> | undefined
  const style = maybe["style"]
  return Boolean(
    config && typeof config["output"] === "string" && style && typeof style === "object",
  )
}

function isCanvasMap(value: unknown): value is Record<string, PlumetCanvas> {
  if (!value || typeof value !== "object") return false
  const entries = Object.values(value as Record<string, unknown>)
  return entries.every((item) => isCanvas(item))
}

function normalizePlumetData(
  value: unknown,
): { canvas: Record<string, PlumetCanvas>; config?: PlumetGlobalConfig } | undefined {
  if (!value || typeof value !== "object") return undefined

  const maybeData = value as PlumetData
  if (maybeData.canvas && typeof maybeData.canvas === "object") {
    if (maybeData.config === undefined) {
      return { canvas: maybeData.canvas }
    }
    return { canvas: maybeData.canvas, config: maybeData.config }
  }

  if (isCanvasMap(value)) {
    return { canvas: value as Record<string, PlumetCanvas> }
  }

  return undefined
}

async function build(entryPath: string, watchMode: boolean, ui = createTui()) {
  // Defer printing info until after the entry is loaded so we can show global format

  const errors: Line[] = []
  const done: Line[] = []
  const watchEvents: WatchEvent[] = []
  let deps: Set<string> | undefined

  const moduleUrl = watchMode
    ? `${pathToFileURL(entryPath).href}?t=${Date.now()}`
    : pathToFileURL(entryPath).href

  let canvasMap: Record<string, PlumetCanvas> | undefined
  let globalConfig: PlumetGlobalConfig | undefined

  try {
    deps = await collectDependencies(entryPath)
    const loaded = await import(moduleUrl)
    const normalized = normalizePlumetData(loaded?.default)
    canvasMap = normalized?.canvas
    globalConfig = normalized?.config
    if (!watchMode) {
      const infoLines: Line[] = [
        { label: "entry", value: relative(process.cwd(), entryPath) || entryPath },
        { label: "format", value: String(globalConfig?.format ?? "default") },
      ]
      ui.info(infoLines)
    }
  } catch (error) {
    errors.push({ label: "invalid", value: (error as Error)?.message ?? "failed to load entry" })
    if (watchMode) {
      watchEvents.push({ kind: "invalid", label: "invalid", value: errors[0]?.value ?? "" })
      ui.watch(watchEvents)
    } else {
      ui.error(errors)
      ui.summary({ files: 0, errors: errors.length, warnings: 0 })
      process.exitCode = 1
    }
    return deps ? { deps } : undefined
  }

  if (!canvasMap || typeof canvasMap !== "object") {
    errors.push({ label: "invalid", value: "default export must be PlumetData" })
    if (watchMode) {
      watchEvents.push({ kind: "invalid", label: "invalid", value: errors[0]?.value ?? "" })
      ui.watch(watchEvents)
    } else {
      ui.error(errors)
      ui.summary({ files: 0, errors: errors.length, warnings: 0 })
      process.exitCode = 1
    }
    return deps ? { deps } : undefined
  }

  const baseDir = dirname(entryPath)
  let totalBytes = 0

  for (const [name, canvas] of Object.entries(canvasMap)) {
    if (!isCanvas(canvas)) {
      errors.push({ label: "invalid", value: `${name}: expected PlumetCanvas` })
      watchEvents.push({
        kind: "invalid",
        label: "invalid",
        value: `${name}: expected PlumetCanvas`,
      })
      continue
    }

    try {
      const css = compileCanvas(canvas, globalConfig)
      const outputPath = resolve(baseDir, canvas.config.output)

      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, css, "utf8")
      const st = await stat(outputPath)
      const size = st.size ?? 0
      totalBytes += size

      const shown = relative(process.cwd(), outputPath) || outputPath
      const formatBytes = (b: number) => {
        if (b < 1024) return `${b} B`
        const kb = b / 1024
        if (kb < 1024) return `${kb.toFixed(1)} KB`
        return `${(kb / 1024).toFixed(1)} MB`
      }

      const builtValue = `${name} ⇒ ${gray(shown)} › ${gray(formatBytes(size))}`
      done.push({ label: "built", value: builtValue })
      watchEvents.push({ kind: "built", label: "built", value: builtValue })
    } catch (error) {
      const msg = `${name}: ${(error as Error).message}`
      errors.push({ label: "failed", value: msg })
      watchEvents.push({ kind: "failed", label: "failed", value: msg })
    }
  }

  if (watchMode) {
    ui.watch(watchEvents)
  } else {
    if (errors.length) {
      ui.error(errors)
    }

    if (done.length) {
      ui.done(done)
    }

    ui.summary({ files: done.length, errors: errors.length, warnings: 0, totalBytes })

    if (errors.length) {
      process.exitCode = 1
    }
  }

  return deps ? { deps } : undefined
}

async function main(): Promise<void> {
  const [, , ...argv] = process.argv

  if (argv.includes("--help") || argv.includes("-h")) {
    help()
    return
  }

  if (argv[0] !== "build") {
    help()
    process.exitCode = 1
    return
  }

  const entry = takeFlag(argv, ["--entry", "-e"]) ?? "plumet.ts"
  const watchMode = hasFlag(argv, ["--watch", "-w"])
  const entryPath = resolve(process.cwd(), entry)
  const ui = createTui()

  const tool = "plumet"
  const domain = "css"
  const verb = argv[0] ?? "build"

  const verbIng = verb.endsWith("ing")
    ? verb
    : verb.endsWith("e")
      ? `${verb.slice(0, -1)}ing`
      : `${verb}ing`

  const headingDomain = watchMode ? `${domain} in watch mode` : domain
  heading(tool, verbIng, headingDomain)

  try {
    if (!watchMode) {
      await build(entryPath, false, ui)
      return
    }

    await watchLoop({
      entryPath,
      collectDeps: collectDependencies,
      onEvent: (events: WatchEvent[]) => ui.watch(events),
      build: async (_watchMode) => build(entryPath, true, ui),
    })
  } catch (error) {
    console.error("✖ Build failed", error)
    process.exitCode = 1
  }
}

void main()
