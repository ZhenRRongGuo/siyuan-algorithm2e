type AlgorithmNode =
  | { type: "caption"; text: string }
  | { type: "input"; text: string }
  | { type: "output"; text: string }
  | { type: "return"; text: string }
  | { type: "if"; condition: string; body: AlgorithmNode[]; elseBody?: AlgorithmNode[] }
  | { type: "loop"; kind: "for" | "foreach" | "while"; expression: string; body: AlgorithmNode[] }
  | { type: "comment"; text: string }
  | { type: "raw"; text: string }

interface AlgorithmDocument {
  nodes: AlgorithmNode[]
  warnings: string[]
}

interface GroupResult {
  value: string
  end: number
}

interface RenderState {
  line: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function readCommand(source: string, start: number): { name: string; end: number } | null {
  if (source[start] !== "\\") return null
  const match = source.slice(start).match(/^\\([A-Za-z]+|.)/)
  if (!match) return null
  return { name: match[1], end: start + match[0].length }
}

function skipWhitespace(source: string, start: number): number {
  let index = start
  while (index < source.length && /\s/.test(source[index])) index++
  return index
}

function readOptionalGroup(source: string, start: number): number {
  let index = skipWhitespace(source, start)
  if (source[index] !== "[") return start
  let depth = 0
  for (; index < source.length; index++) {
    if (source[index] === "\\") {
      index++
      continue
    }
    if (source[index] === "[") depth++
    if (source[index] === "]") {
      depth--
      if (depth === 0) return index + 1
    }
  }
  return source.length
}

function readGroup(source: string, start: number): GroupResult | null {
  const open = skipWhitespace(source, start)
  if (source[open] !== "{") return null

  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === "\\") {
      index++
      continue
    }
    if (source[index] === "{") depth++
    if (source[index] === "}") {
      depth--
      if (depth === 0) return { value: source.slice(open + 1, index), end: index + 1 }
    }
  }
  return null
}

function readMathEnd(source: string, start: number): number | null {
  const delimiter = source[start] === "$"
    ? "$"
    : source.startsWith("\\(", start)
      ? "\\)"
      : source.startsWith("\\[", start)
        ? "\\]"
        : null
  if (!delimiter) return null

  let index = start + delimiter.length
  while (index < source.length) {
    const end = source.indexOf(delimiter, index)
    if (end < 0) return source.length
    let slashCount = 0
    for (let slash = end - 1; slash >= start && source[slash] === "\\"; slash--) slashCount++
    if (slashCount % 2 === 0) return end + delimiter.length
    index = end + delimiter.length
  }
  return source.length
}

function extractAlgorithmBody(source: string, warnings: string[]): string {
  const begin = source.match(/\\begin\s*\{algorithm\}/i)
  if (!begin || begin.index === undefined) {
    warnings.push("未找到 \\begin{algorithm}，已按普通 algorithm2e 内容解析")
    return source
  }

  const bodyStart = readOptionalGroup(source, begin.index + begin[0].length)
  const endPattern = /\\end\s*\{algorithm\}/gi
  endPattern.lastIndex = bodyStart
  const end = endPattern.exec(source)
  if (!end || end.index === undefined) {
    warnings.push("未找到 \\end{algorithm}")
    return source.slice(bodyStart)
  }
  return source.slice(bodyStart, end.index)
}

function readCommandBody(source: string, commandEnd: number): { argument: GroupResult; body: GroupResult } | null {
  const argument = readGroup(source, commandEnd)
  if (!argument) return null
  const body = readGroup(source, argument.end)
  if (!body) return null
  return { argument, body }
}

function parseContent(source: string, warnings: string[]): AlgorithmNode[] {
  const nodes: AlgorithmNode[] = []
  let index = 0

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index++
      continue
    }
    if (source[index] === "%") {
      const lineEnd = source.indexOf("\n", index)
      index = lineEnd < 0 ? source.length : lineEnd + 1
      continue
    }

    const command = readCommand(source, index)
    if (!command) {
      let end = index
      while (end < source.length && source[end] !== "\\" && source[end] !== "\n") {
        if (source[end] === "$") {
          end = readMathEnd(source, end) ?? end + 1
          continue
        }
        end++
      }
      const text = source.slice(index, end).trim()
      if (text) nodes.push({ type: "raw", text })
      index = end
      continue
    }

    const name = command.name.toLowerCase()

    if (name === ";") {
      index = command.end
      continue
    }

    if (name === "caption") {
      const group = readGroup(source, command.end)
      if (group) {
        nodes.push({ type: "caption", text: group.value.trim() })
        index = group.end
        continue
      }
    }

    if (name === "kwin" || name === "kwout") {
      const group = readGroup(source, command.end)
      if (group) {
        nodes.push({ type: name === "kwin" ? "input" : "output", text: group.value.trim() })
        index = group.end
        continue
      }
    }

    if (name === "if") {
      const parts = readCommandBody(source, command.end)
      if (parts) {
        const node: Extract<AlgorithmNode, { type: "if" }> = {
          type: "if",
          condition: parts.argument.value.trim(),
          body: parseContent(parts.body.value, warnings),
        }
        let next = skipWhitespace(source, parts.body.end)
        const elseCommand = readCommand(source, next)
        if (elseCommand && elseCommand.name.toLowerCase() === "else") {
          const elseBody = readGroup(source, elseCommand.end)
          if (elseBody) {
            node.elseBody = parseContent(elseBody.value, warnings)
            next = elseBody.end
          }
        }
        nodes.push(node)
        index = next
        continue
      }
      warnings.push("\\If 缺少条件或代码块")
    }

    if (name === "for" || name === "foreach" || name === "while") {
      const parts = readCommandBody(source, command.end)
      if (parts) {
        nodes.push({
          type: "loop",
          kind: name,
          expression: parts.argument.value.trim(),
          body: parseContent(parts.body.value, warnings),
        })
        index = parts.body.end
        continue
      }
      warnings.push(`\\${command.name} 缺少循环条件或代码块`)
    }

    if (name === "tcp" || name === "tcc") {
      const group = readGroup(source, command.end)
      if (group) {
        nodes.push({ type: "comment", text: group.value.trim() })
        index = group.end
        continue
      }
    }

    if (name === "return") {
      const group = readGroup(source, command.end)
      if (group) {
        nodes.push({ type: "return", text: group.value.trim() })
        index = group.end
        continue
      }
    }

    const group = readGroup(source, command.end)
    const rawEnd = group ? group.end : command.end
    warnings.push(`暂不支持命令 \\${command.name}，已保留原文`)
    nodes.push({ type: "raw", text: source.slice(index, rawEnd).trim() })
    index = rawEnd
  }

  return nodes
}

function renderText(value: string): string {
  return escapeHtml(value)
    .replace(/\\textbf\{([^{}]*)\}/g, "<strong>$1</strong>")
    .replace(/\\KwTo\b/g, "至")
    .replace(/\\KwAnd\b/g, "且")
    .replace(/\\KwOr\b/g, "或")
}

function renderMath(tex: string, displayMode: boolean): string {
  const katex = typeof window !== "undefined" ? window.katex : undefined
  if (katex) {
    try {
      return katex.renderToString(tex, { displayMode, throwOnError: false })
    } catch {
      // Fall back to escaped TeX when a particular expression is unsupported.
    }
  }
  return `<span class="algorithm2e-math">${escapeHtml(displayMode ? `\\[${tex}\\]` : `$${tex}$`)}</span>`
}

function renderInline(value: string): string {
  const mathPattern = /\$([\s\S]*?)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g
  let result = ""
  let lastIndex = 0
  for (const match of value.matchAll(mathPattern)) {
    const index = match.index ?? 0
    result += renderText(value.slice(lastIndex, index))
    const tex = match[1] ?? match[2] ?? match[3] ?? ""
    result += renderMath(tex, Boolean(match[3]))
    lastIndex = index + match[0].length
  }
  return result + renderText(value.slice(lastIndex))
}

function renderLine(content: string, level: number, kind: string, config: IPseudocodeConfig, state: RenderState): string {
  state.line++
  const lineNumber = config.lineNumber === "true"
    ? `<span class="algorithm2e-line-number">${state.line}</span>`
    : ""
  return `<div class="algorithm2e-line algorithm2e-${kind}" style="--algorithm2e-level:${level}">${lineNumber}<span class="algorithm2e-content">${content}</span></div>`
}

function renderNodes(nodes: AlgorithmNode[], level: number, config: IPseudocodeConfig, state: RenderState): string {
  return nodes.map((node) => {
    switch (node.type) {
      case "caption":
        return `<div class="algorithm2e-caption"><span class="algorithm2e-caption-label">${escapeHtml(config.algorithmLabel || "Algorithm")} ${escapeHtml(config.algorithmNumber || config._defaultAlgorithmNumber)}:</span> ${renderInline(node.text)}</div>`
      case "input":
        return renderLine(`<span class="algorithm2e-keyword">输入：</span>${renderInline(node.text)}`, level, "input", config, state)
      case "output":
        return renderLine(`<span class="algorithm2e-keyword">输出：</span>${renderInline(node.text)}`, level, "output", config, state)
      case "return":
        return renderLine(`<span class="algorithm2e-keyword">返回</span> ${renderInline(node.text)}`, level, "return", config, state)
      case "comment":
        return renderLine(`<span class="algorithm2e-comment-marker">注：</span>${renderInline(node.text)}`, level, "comment", config, state)
      case "loop": {
        const keyword = node.kind === "foreach" ? "对每个" : node.kind === "while" ? "当" : "对于"
        const ending = config.blockEnding === "true"
          ? renderLine(`<span class="algorithm2e-keyword">结束${node.kind === "while" ? "当" : "循环"}</span>`, level, "end", config, state)
          : ""
        return `${renderLine(`<span class="algorithm2e-keyword">${keyword}</span> ${renderInline(node.expression)}：`, level, "loop", config, state)}${renderNodes(node.body, level + 1, config, state)}${ending}`
      }
      case "if": {
        const body = renderNodes(node.body, level + 1, config, state)
        const elsePart = node.elseBody
          ? `${renderLine(`<span class="algorithm2e-keyword">否则</span>`, level, "else", config, state)}${renderNodes(node.elseBody, level + 1, config, state)}`
          : ""
        const ending = config.blockEnding === "true"
          ? renderLine(`<span class="algorithm2e-keyword">结束如果</span>`, level, "end", config, state)
          : ""
        return `${renderLine(`<span class="algorithm2e-keyword">如果</span> ${renderInline(node.condition)}：`, level, "if", config, state)}${body}${elsePart}${ending}`
      }
      case "raw":
        return node.text.split(/\r?\n/).map((line) => renderLine(renderInline(line), level, "raw", config, state)).join("")
    }
  }).join("")
}

export function compileAlgorithm2e(code: string, config: IPseudocodeConfig): IResCompilePseudocode {
  const result: IResCompilePseudocode = { ok: false, code, html: "", message: "" }
  if (!code.trim()) {
    result.message = "algorithm2e 代码为空"
    return result
  }

  const warnings: string[] = []
  const body = extractAlgorithmBody(code.replace(/\r\n/g, "\n"), warnings)
  const document: AlgorithmDocument = { nodes: parseContent(body, warnings), warnings }
  const state: RenderState = { line: 0 }
  const warningHtml = warnings.length
    ? `<div class="algorithm2e-diagnostics">${warnings.map((warning) => `<div>⚠ ${escapeHtml(warning)}</div>`).join("")}</div>`
    : ""
  result.html = `<div class="algorithm2e-root" data-style="ruled">${warningHtml}<div class="algorithm2e-body">${renderNodes(document.nodes, 0, config, state)}</div></div>`
  result.ok = true
  result.message = warnings.join("\n")
  return result
}
