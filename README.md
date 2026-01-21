# Plumet

**Plumet** is a high-performance, compile-time CSS generator and CLI designed to transform strictly typed style contracts into static, deterministic CSS files. By traversing a nested style tree without runtime overhead, Plumet allows you to define your design system's "organs" with TypeScript precision and emit optimized CSS for production.

## Key Highlights

- **Deterministic Traversal:** Employs a single-pass, stack-based traversal (non-recursive) for predictable performance and memory safety.
- **Optimized Resolution:** Lightning-fast selector resolution utilizing internal kebab-case caching instead of expensive regex operations.
- **The `$` Paradigm:** Dedicated blocks for property declarations, supporting nested selectors, `&` references, and at-rules.
- **Zero-Runtime Footprint:** Outputs pure CSS files, ensuring your application remains lightweight and free of runtime CSS-in-JS dependencies.
- **Developer Ergonomics:** Minimal API surface featuring a robust CLI with hot-reloading support.

## Requirements

- **Runtime:** Node.js 18+ or Bun 1.0+
- **Environment:** TypeScript 5+ recommended for optimal type safety.
- **Dependencies:** `csstype` for managing style object definitions.

## Installation

You can install Plumet using your preferred package manager. It is fully compatible with **Bun** for even faster installation and execution.

```bash
# Using Bun
bun add plumet

# Using npm
npm install plumet

# Using pnpm
pnpm add plumet
```

## Quick Start

### 1. Define a Style Contract (`*.style.ts`)

```typescript
import type * as CSS from "csstype";

interface Token {
  ZIndex?: CSS.Property.ZIndex;
}

export interface PlumetStyle {
  $?: CSS.Properties;
  [selector: string]: PlumetStyle | CSS.Properties | undefined;
}

export interface PlumetConfig {
  output: string;
}

export interface PlumetCanvas {
  config: PlumetConfig;
  style: PlumetStyle;
}

export default function style(config: PlumetConfig, token: Token): PlumetCanvas {
  return {
    config,
    style: {
      "#app": {
        $: { zIndex: token.ZIndex },
        a: {
          $: { color: "blue" },
          ":hover": { $: { textDecoration: "underline" } },
        },
      },
    },
  };
}
```

### 2. Configure the Entry Point (`plumet.ts`)

```typescript
import header from "./header.style";
import footer from "./footer.style";

export default {
  header: header({ output: "./dist/header.css" }, { ZIndex: 10 }),
  footer: footer({ output: "./dist/footer.css" }, { ZIndex: 5 }),
};
```

> [!Note]
>
> The `output` path is resolved relative to the location of `plumet.ts`.

#### Omit Selectors

If you need to suppress selectors from the generated CSS—say the `.socket` block or hover states handled elsewhere—use the `omit` array on each canvas config. Provide exact selectors or simple `*` globs, and Plumet skips any matching node (and its children) while still emitting the rest of the tree.

```ts
export default {
  footer: footerStyle(
    {
      output: "./dist/footer.css",
      omit: ["#footer .socket", "#footer .sections*", "#footer .sections a:hover"],
    },
    tokens,
  ),
}
```

Wildcard matches (`#footer .sections*`) let you drop entire branches while leaving other selectors intact, and selectors nested inside media queries, pseudo-classes, or `&` replacements respect the same list.

### 3. Build and Watch

Execute the build process via the CLI. For an improved development experience, use the **Watch Mode** to recompile CSS automatically whenever your style contracts change.

```bash
# Standard Build with Bun
bunx plumet build --entry plumet.ts

# Watch Mode (Continuous Compilation)
bunx plumet build --entry plumet.ts --watch
# or simply
bunx plumet build -e plumet.ts -w
```

## CLI Reference

| Command | Option          | Description                                                                       |
| ------- | --------------- | --------------------------------------------------------------------------------- |
| `build` | `--entry`, `-e` | Specifies the entry file (defaults to `plumet.ts`).                               |
| `build` | `--watch`, `-w` | Enables Watch Mode; observes changes in the entry and all imported style modules. |

- **Automatic Directories:** Output paths are created automatically if they do not exist.
- **Resilience:** During Watch Mode, invalid canvases are reported as errors in the console, but the process remains active and ready for the next fix.

## Programmatic API

```typescript
import { compileCanvas, compileCanvasMap, compileStyle } from "plumet";
```

| Function                | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `compileStyle(style)`   | Generates a CSS string from a `PlumetStyle` tree.                |
| `compileCanvas(canvas)` | Generates a CSS string from a `{ config, style }` object.        |
| `compileCanvasMap(map)` | Returns an object mapping names to their respective CSS strings. |

## Style Object Rules

- **`$` Property:** Reserved for CSS declarations belonging to the current selector.
- **`@` Prefix:** Defines at-rule scopes (e.g., `@media`, `@keyframes`).
- **`&` Character:** Replaced by the parent selector (Sass-style nesting).
- **`:` or `::` Prefix:** Appends pseudo-classes or pseudo-elements to the current selector.
- **Standard Keys:** Evaluated as descendant selectors (`parent child`).

## Best Practices

- **Atomicity:** Maintain one "organ" or component per `*.style.ts` file.
- **Static Tokens:** Reuse design tokens and avoid complex runtime logic within the generator.
- **Efficiency:** Use **Watch Mode** during development to keep your static CSS files in sync with your TypeScript definitions instantly.

## Contributing

We welcome issues and pull requests.

- **Development:** Requires Bun.
- **Build:** `bun run build`
- **Test:** `bun run test`

## License

MIT © 2026 KazViz, Nazahex, and Nazator.

See the full license in [LICENSE](./LICENSE)
