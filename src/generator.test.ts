import { expect, test } from "bun:test"
import { compileCanvas, compileCanvasMap, compileStyle } from "./generator"
import type { PlumetCanvas, PlumetCanvasMap, PlumetStyle } from "./types"

test("emits basic declarations with kebab-case", () => {
  const style: PlumetStyle = {
    "#app": {
      $: {
        color: "red",
        backgroundColor: "black",
        // null/undefined should be skipped
        border: undefined,
      },
    },
  }

  const css = compileStyle(style)
  expect(css).toBe("#app{color:red;background-color:black;}\n")
})

test("supports nested selectors, pseudo, and & replacement", () => {
  const style: PlumetStyle = {
    ".btn": {
      $: { padding: "8px 12px" },
      ":hover": { $: { opacity: 0.5 } },
      "&.primary": { $: { color: "blue" } },
    },
  }

  const css = compileStyle(style)

  expect(css).toBe(
    ".btn{padding:8px 12px;}\n" + ".btn:hover{opacity:0.5;}\n" + ".btn.primary{color:blue;}\n",
  )
})

test("handles at-rules with nested selectors", () => {
  const style: PlumetStyle = {
    "@media (max-width: 600px)": {
      "#app": {
        $: { color: "red" },
      },
    },
  }

  const css = compileStyle(style)
  expect(css).toBe("@media (max-width: 600px){#app{color:red;}\n}\n")
})

test("compileCanvas and compileCanvasMap produce mapped css", () => {
  const header: PlumetCanvas = {
    config: { output: "./dist/header.css" },
    style: { "#header": { $: { color: "red" } } },
  }

  const footer: PlumetCanvas = {
    config: { output: "./dist/footer.css" },
    style: { "#footer": { $: { color: "blue" } } },
  }

  const canvases: PlumetCanvasMap = { header, footer }

  expect(compileCanvas(header)).toBe("#header{color:red;}\n")
  expect(compileCanvasMap(canvases)).toEqual({
    header: "#header{color:red;}\n",
    footer: "#footer{color:blue;}\n",
  })
})
