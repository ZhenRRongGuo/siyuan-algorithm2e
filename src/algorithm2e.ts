type AlgorithmNode =
  | { type: "caption"; text: string }
  | { type: "input"; text: string }
  | { type: "output"; text: string }
  | { type: "return"; text: string }
  | { type: "if"; condition: string; body: AlgorithmNode[] }
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
  return {
    name: match[1],
    end: start + match[0].length,
  }
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
      if (depth === 0) {
        return {
          value: source.slice(open + 1, index),
          end: index + 1,
        }
      }
    }
  }
  return null
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
      const lineEnd = source.indexOf("\n", index)
      const end = lineEnd < 0 ? source.length : lineEnd
      const text = source.slice(index, end).trim()
      if (text) nodes.push({ type: "raw", text })
      index = lineEnd < 0 ? source.length : lineEnd + 1
      continue
    }

    const name = command.name.toLowerCase()
    let next = readOptionalGroup(source, command.end)

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
      const condition = readGroup(source, command.end)
      if (condition) {
        const body = readGroup(source, condition.end)
        if (body) {
          nodes.push({ type: "if", condition: condition.value.trim(), body: parseContent(body.value, warnings) })
          index = body.end
          continue
        }
        warnings.push("\\If 缺少代码块")
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

    const rawEnd = Math.max(next, command.end)
    const group = readGroup(source, command.end)
    if (group) next = group.end
    warnings.push(`暂不支持命令 \\${command.name}，已保留原文`)
    nodes.push({ type: "raw", text: source.slice(index, Math.max(rawEnd, next)).trim() })
    index = Math.max(rawEnd, next)
  }

  return nodes
}

function renderInline(value: string): string {
  return escapeHtml(value).replace(/\\textbf\{([^{}]*)\}/g, "<strong>$1</strong>")
}

function renderLine(
  content: string,
  level: number,
  kind: string,
  config: IPseudocodeConfig,
  state: RenderState,
): string {
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
      case "if": {
        const body = renderNodes(node.body, level + 1, config, state)
        const ending = config.blockEnding === "true"
          ? renderLine(`<span class="algorithm2e-keyword">结束如果</span>`, level, "end", config, state)
          : ""
        return `${renderLine(`<span class="algorithm2e-keyword">如果</span> ${renderInline(node.condition)}：`, level, "if", config, state)}${body}${ending}`
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
