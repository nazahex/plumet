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

test("omits exact selectors when configured", () => {
  const style: PlumetStyle = {
    "#app": {
      $: { color: "black" },
      a: { $: { color: "blue" } },
      ".socket": { $: { color: "gray" } },
    },
  }

  const css = compileStyle(style, ["#app .socket", "#app a"])
  expect(css).toBe("#app{color:black;}\n")
})

test("omits selectors by glob", () => {
  const style: PlumetStyle = {
    "#app": {
      $: { color: "black" },
      ".sections": {
        $: { display: "grid" },
        a: {
          $: { color: "blue" },
          ":hover": { $: { color: "red" } },
        },
      },
      ".socials": { svg: { $: { fill: "pink" } } },
    },
  }

  const css = compileStyle(style, ["#app .sections*", "#app .socials svg"])
  expect(css).toBe("#app{color:black;}\n")
})

test("compileCanvas uses omit from config", () => {
  const canvas: PlumetCanvas = {
    config: { output: "./dist/app.css", omit: ["#app .skip"] },
    style: {
      "#app": {
        $: { color: "black" },
        ".keep": { $: { color: "blue" } },
        ".skip": { $: { color: "red" } },
      },
    },
  }

  expect(compileCanvas(canvas)).toBe("#app{color:black;}\n#app .keep{color:blue;}\n")
})

test("omit honors selectors inside at-rules", () => {
  const style: PlumetStyle = {
    "@media (max-width: 600px)": {
      "#app": {
        $: { color: "black" },
        a: { $: { color: "blue" } },
      },
    },
  }

  const css = compileStyle(style, ["#app a"])
  expect(css).toBe("@media (max-width: 600px){#app{color:black;}\n}\n")
})

test("skips empty rules and empty at-rules", () => {
  const style: PlumetStyle = {
    "#app": {
      $: { color: undefined },
      ".child": { $: { color: undefined } },
      "@media (max-width: 800px)": {
        ".nested": { $: { padding: undefined } },
      },
    },
  }

  expect(compileStyle(style)).toBe("")
})

test("supports minify format", () => {
  const style: PlumetStyle = {
    "#app": {
      $: { color: "red" },
    },
  }

  expect(compileStyle(style, { format: "minify" })).toBe("#app{color:red;}")
})

test("supports pretty format", () => {
  const style: PlumetStyle = {
    "#app": {
      $: { color: "red" },
      a: { $: { color: "blue" } },
    },
  }

  expect(compileStyle(style, { format: "pretty" })).toBe(
    "#app {\n  color: red;\n}\n#app a {\n  color: blue;\n}\n",
  )
})

test("glob omit with wildcard only removes matching selectors", () => {
  const style: PlumetStyle = {
    "#app": {
      $: { color: "black" },
      ".socket": { $: { color: "gray" } },
      ".socket-secondary": { $: { color: "silver" } },
      ".banner": { $: { color: "violet" } },
    },
  }

  const css = compileStyle(style, ["#app .socket*"])
  expect(css).toBe("#app{color:black;}\n#app .banner{color:violet;}\n")
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

test("compileCanvas uses global format config", () => {
  const canvas: PlumetCanvas = {
    config: { output: "./dist/app.css" },
    style: { "#app": { $: { color: "black" } } },
  }

  expect(compileCanvas(canvas, { format: "minify" })).toBe("#app{color:black;}")
})
