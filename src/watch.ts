import { watch } from "node:fs"

import type { DependencyCollector } from "./deps"
import type { WatchEvent } from "./tui"

interface WatchLoopOptions {
  entryPath: string
  build: (watchMode: boolean) => Promise<{ deps?: Set<string> } | undefined>
  onEvent: (events: WatchEvent[]) => void
  collectDeps: DependencyCollector
}

/**
 * Watch only the files discovered from the dependency graph of the entry and rebuild on change.
 */
export async function watchLoop(options: WatchLoopOptions): Promise<void> {
  const { entryPath, build, onEvent, collectDeps } = options

  const activeWatchers = new Map<string, ReturnType<typeof watch>>()

  const resetWatchers = (files: Set<string>) => {
    // Close watchers no longer needed
    for (const [file, w] of activeWatchers) {
      if (!files.has(file)) {
        w.close()
        activeWatchers.delete(file)
      }
    }

    // Add watchers for new files
    for (const file of files) {
      if (activeWatchers.has(file)) continue
      try {
        const w = watch(file, { persistent: true }, (_event, filename) => {
          const rel = filename ? filename.toString() : file
          scheduleBuild(rel)
        })
        activeWatchers.set(file, w)
      } catch {
        // ignore watch errors for individual files
      }
    }
  }

  let queued = false
  const scheduleBuild = (changed?: string) => {
    if (queued) return
    queued = true
    setTimeout(async () => {
      queued = false
      if (changed) {
        onEvent([
          {
            kind: "modified",
            label: "modified",
            value: changed,
            time: Date.now(),
          },
        ])
      }
      const result = await build(true)
      if (result?.deps?.size) {
        resetWatchers(result.deps)
      } else {
        const deps = await collectDeps(entryPath)
        resetWatchers(deps)
      }
    }, 50)
  }

  const initialResult = await build(true)
  const initialDeps = initialResult?.deps?.size ? initialResult.deps : await collectDeps(entryPath)

  resetWatchers(initialDeps)
}
