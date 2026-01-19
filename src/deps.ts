import { access, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const CANDIDATE_EXTS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".mts", ".cts"]

async function resolveImport(base: string, spec: string): Promise<string | undefined> {
  if (!spec.startsWith(".")) return undefined
  const baseDir = dirname(base)
  const full = resolve(baseDir, spec)

  const withExt = async (p: string) => {
    try {
      await access(p)
      return p
    } catch {
      return undefined
    }
  }

  if (CANDIDATE_EXTS.some((ext) => spec.endsWith(ext))) {
    return withExt(full)
  }

  for (const ext of CANDIDATE_EXTS) {
    const candidate = await withExt(full + ext)
    if (candidate) return candidate
  }

  return undefined
}

/**
 * Collect a set of local file dependencies by following static import/export statements.
 */
export async function collectDependencies(
  entryPath: string,
  seen: Set<string> = new Set<string>(),
): Promise<Set<string>> {
  const queue = [entryPath]

  while (queue.length) {
    const current = queue.pop()
    if (!current || seen.has(current)) continue
    seen.add(current)

    let content = ""
    try {
      content = await readFile(current, "utf8")
    } catch {
      continue
    }

    const importRegex =
      /(?:import|export)\s+[^"']*from\s+["']([^"']+)["']|import\s*["']([^"']+)["']/g
    for (;;) {
      const m = importRegex.exec(content)
      if (m === null) break
      const spec = (m[1] ?? m[2]) as string | undefined
      if (!spec) continue
      const resolved = await resolveImport(current, spec)
      if (resolved && !seen.has(resolved)) {
        queue.push(resolved)
      }
    }
  }

  return seen
}

export type DependencyCollector = (entryPath: string) => Promise<Set<string>>
