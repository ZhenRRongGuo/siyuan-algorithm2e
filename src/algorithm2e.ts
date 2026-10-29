import { getAlgorithm2eLabels, getDefaultAlgorithm2eSettings, Algorithm2eLabels } from "./settings"

type AlgorithmNode =
  | { type: "caption"; text: string }
  | { type: "input"; text: string; comment?: string; commentAlign?: "left" | "right"; terminated?: boolean }
  | { type: "output"; text: string; comment?: string; commentAlign?: "left" | "right"; terminated?: boolean }
  | { type: "return"; text: string; comment?: string; commentAlign?: "left" | "right"; terminated?: boolean }
  | { type: "if"; condition: string; body: AlgorithmNode[]; elseBody?: AlgorithmNode[]; comment?: string; commentAlign?: "left" | "right"; terminated?: boolean }
  | { type: "loop"; kind: "for" | "foreach" | "while"; expression: string; body: AlgorithmNode[]; comment?: string; commentAlign?: "left" | "right"; terminated?: boolean }
  | { type: "comment"; kind: "tcp" | "tcc"; text: string; align?: "left" | "right" }
  | { type: "raw"; text: string; comment?: string; commentAlign?: "left" | "right"; terminated?: boolean }

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

function cssFontValue(value: string): string {
  return `"${value.replace(/[^a-zA-Z0-9\u4e00-\u9fff ,.'_-]/g, "").replace(/"/g, "")}"`
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

function readSquareGroup(source: string, start: number): GroupResult | null {
  const open = skipWhitespace(source, start)
  if (source[open] !== "[") return null
  const close = source.indexOf("]", open + 1)
  if (close < 0) return null
  return { value: source.slice(open + 1, close), end: close + 1 }
}

function readCommentCommand(source: string, command: { name: string; end: number }): { text: string; end: number; align: "left" | "right" } | null {
  let index = command.end
  if (source[index] === "*") index++
  const direction = readSquareGroup(source, index)
  if (direction) index = direction.end
  const group = readGroup(source, index)
  if (!group) return null
  return {
    text: group.value.trim(),
    end: group.end,
    align: direction?.value.trim().toLowerCase() === "r" ? "right" : "left",
  }
}

function readInlineStatement(source: string, start: number): GroupResult | null {
  let index = start
  while (index < source.length) {
    if (source[index] === "\n") break
    if (source[index] === "\\") break
    if (source[index] === "$") {
      index = readMathEnd(source, index) ?? index + 1
      continue
    }
    index++
  }
  const value = source.slice(start, index).trim()
  return value ? { value, end: index } : null
}

function parseContent(source: string, warnings: string[]): AlgorithmNode[] {
  const nodes: AlgorithmNode[] = []
  let index = 0
  let lineHasContent = false

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      if (source[index] === "\n") lineHasContent = false
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
      if (text) {
        nodes.push({ type: "raw", text })
        lineHasContent = true
      }
      index = end
      continue
    }

    const name = command.name.toLowerCase()

    if (name === ";") {
      const previous = nodes[nodes.length - 1]
      if (lineHasContent && previous && previous.type !== "caption" && previous.type !== "comment") {
        (previous as Extract<AlgorithmNode, { type: "input" | "output" | "return" | "if" | "loop" | "raw" }>).terminated = true
      }
      index = command.end
      continue
    }

    if (name === "caption") {
      const group = readGroup(source, command.end)
      if (group) {
        nodes.push({ type: "caption", text: group.value.trim() })
        lineHasContent = true
        index = group.end
        continue
      }
    }

    if (name === "label") {
      const group = readGroup(source, command.end)
      if (group) {
        // Labels are LaTeX cross-reference metadata and have no visual output.
        index = group.end
        continue
      }
    }

    if (name === "kwin" || name === "kwout") {
      const group = readGroup(source, command.end)
      if (group) {
        nodes.push({ type: name === "kwin" ? "input" : "output", text: group.value.trim() })
        lineHasContent = true
        index = group.end
        continue
      }
    }

    if (name === "if" || name === "eif") {
      const parts = readCommandBody(source, command.end)
      if (parts) {
        const node: Extract<AlgorithmNode, { type: "if" }> = {
          type: "if",
          condition: parts.argument.value.trim(),
          body: parseContent(parts.body.value, warnings),
        }
        let next = skipWhitespace(source, parts.body.end)
        if (name === "eif") {
          const elseBody = readGroup(source, next)
          if (elseBody) {
            node.elseBody = parseContent(elseBody.value, warnings)
            next = elseBody.end
          } else {
            warnings.push("\\eIf 缺少否定分支代码块")
          }
        } else {
          const elseCommand = readCommand(source, next)
          if (elseCommand && elseCommand.name.toLowerCase() === "else") {
            const elseBody = readGroup(source, elseCommand.end)
            if (elseBody) {
              node.elseBody = parseContent(elseBody.value, warnings)
              next = elseBody.end
            }
          }
        }
        nodes.push(node)
        lineHasContent = true
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
        lineHasContent = true
        index = parts.body.end
        continue
      }
      warnings.push(`\\${command.name} 缺少循环条件或代码块`)
    }

    if (name === "tcp" || name === "tcc") {
      const comment = readCommentCommand(source, command)
      if (comment) {
        const previous = nodes[nodes.length - 1]
        if (name === "tcp" && lineHasContent && previous && previous.type !== "caption" && previous.type !== "comment") {
          const previousComment = previous as Extract<AlgorithmNode, { type: "input" | "output" | "return" | "if" | "loop" | "raw" }>
          previousComment.comment = comment.text
          previousComment.commentAlign = comment.align
        } else {
          nodes.push({ type: "comment", kind: name, text: comment.text, align: comment.align })
          lineHasContent = true
        }
        index = comment.end
        continue
      }
    }

    if (name === "return") {
      const group = readGroup(source, command.end)
      if (group) {
        const node: Extract<AlgorithmNode, { type: "return" }> = { type: "return", text: group.value.trim() }
        nodes.push(node)
        lineHasContent = true
        index = group.end
        continue
      }
      const inline = readInlineStatement(source, command.end)
      if (inline) {
        const node: Extract<AlgorithmNode, { type: "return" }> = { type: "return", text: inline.value }
        nodes.push(node)
        lineHasContent = true
        index = inline.end
        continue
      }
    }

    const group = readGroup(source, command.end)
    const rawEnd = group ? group.end : command.end
    warnings.push(`暂不支持命令 \\${command.name}，已保留原文`)
    nodes.push({ type: "raw", text: source.slice(index, rawEnd).trim() })
    lineHasContent = true
    index = rawEnd
  }

  return nodes
}

function renderText(value: string, labels: Algorithm2eLabels): string {
  return escapeHtml(value)
    .replace(/\\textbf\{([^{}]*)\}/g, "<strong>$1</strong>")
    .replace(/\\KwTo\b/g, `<span class="algorithm2e-keyword">${escapeHtml(labels.kwTo)}</span>`)
    .replace(/\\KwAnd\b/g, `<span class="algorithm2e-keyword">${escapeHtml(labels.kwAnd)}</span>`)
    .replace(/\\KwOr\b/g, `<span class="algorithm2e-keyword">${escapeHtml(labels.kwOr)}</span>`)
}

function getSiyuanKatexMacros(): Record<string, string> | undefined {
  const rawMacros = typeof window !== "undefined"
    ? window.siyuan?.config?.editor?.katexMacros
    : undefined
  if (!rawMacros) return undefined

  try {
    const parsed = typeof rawMacros === "string" ? JSON.parse(rawMacros) : rawMacros
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined

    const macros: Record<string, string> = {}
    Object.entries(parsed).forEach(([name, value]) => {
      if (typeof value === "string") macros[name] = value
    })
    return Object.keys(macros).length > 0 ? macros : undefined
  } catch {
    // An invalid global macro setting should not prevent the algorithm block
    // from rendering; KaTeX will fall back to its normal command set.
    return undefined
  }
}

function renderMath(tex: string, displayMode: boolean): string {
  // Keep norm delimiters as literal ASCII bars. Some fonts used by SiYuan
  // render the Unicode double-bar glyph (∥) as two slashes.
  const normalizedTex = tex
    .replace(/\\Vert\b/g, "\\text{ || }")
    .replace(/\\\|/g, "\\text{ || }")
  const katex = typeof window !== "undefined" ? window.katex : undefined
  if (katex) {
    try {
      const macros = getSiyuanKatexMacros()
      return katex.renderToString(normalizedTex, {
        displayMode,
        throwOnError: false,
        ...(macros ? { macros } : {}),
      })
    } catch {
      // Fall back to escaped TeX when a particular expression is unsupported.
    }
  }
  return `<span class="algorithm2e-math">${escapeHtml(displayMode ? `\\[${normalizedTex}\\]` : `$${normalizedTex}$`)}</span>`
}

function renderInline(value: string, labels: Algorithm2eLabels): string {
  const mathPattern = /\$([\s\S]*?)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g
  let result = ""
  let lastIndex = 0
  for (const match of value.matchAll(mathPattern)) {
    const index = match.index ?? 0
    result += renderText(value.slice(lastIndex, index), labels)
    const tex = match[1] ?? match[2] ?? match[3] ?? ""
    result += renderMath(tex, Boolean(match[3]))
    lastIndex = index + match[0].length
  }
  return result + renderText(value.slice(lastIndex), labels)
}

function renderLine(content: string, level: number, kind: string, config: IPseudocodeConfig, state: RenderState): string {
  const excludesFromLineNumber = kind === "input" || kind === "output"
  if (!excludesFromLineNumber) state.line++
  const lineNumber = config.lineNumber === "true"
    ? `<span class="algorithm2e-line-number">${excludesFromLineNumber ? "" : state.line}</span>`
    : ""
  const scopeClass = config.scopeLine === "true" && level > 0 ? " algorithm2e-scope-line" : ""
  return `<div class="algorithm2e-line algorithm2e-${kind}${scopeClass}" style="--algorithm2e-level:${level}">${lineNumber}<span class="algorithm2e-content">${content}</span></div>`
}

function renderInlineComment(comment: string | undefined, labels: Algorithm2eLabels, align: "left" | "right" = "left"): string {
  return comment
    ? `<span class="algorithm2e-inline-comment${align === "right" ? " algorithm2e-right-comment" : ""}">${escapeHtml(labels.tcp)} ${renderInline(comment, labels)}</span>`
    : ""
}

function blockCommentEnd(marker: string): string {
  if (marker === "/*") return "*/"
  if (marker === "<!--") return "-->"
  return marker
}

function renderNodes(nodes: AlgorithmNode[], level: number, config: IPseudocodeConfig, state: RenderState): string {
  const labels = getAlgorithm2eLabels()
  return nodes.map((node) => {
    switch (node.type) {
      case "caption":
        return `<div class="algorithm2e-caption"><span class="algorithm2e-caption-label">${escapeHtml(labels.algorithm)} ${escapeHtml(config.algorithmNumber || config._defaultAlgorithmNumber)}${escapeHtml(labels.separator)}</span> ${renderInline(node.text, labels)}</div>`
      case "input":
        return renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.kwIn)}${escapeHtml(labels.separator)}</span> ${renderInline(node.text, labels)}${node.terminated ? ";" : ""}${renderInlineComment(node.comment, labels, node.commentAlign)}`, level, "input", config, state)
      case "output":
        return renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.kwOut)}${escapeHtml(labels.separator)}</span> ${renderInline(node.text, labels)}${node.terminated ? ";" : ""}${renderInlineComment(node.comment, labels, node.commentAlign)}`, level, "output", config, state)
      case "return":
        return renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.return)}</span> ${renderInline(node.text, labels)}${node.terminated ? ";" : ""}${renderInlineComment(node.comment, labels, node.commentAlign)}`, level, "return", config, state)
      case "comment":
        return node.kind === "tcc"
          ? renderLine(`<span class="algorithm2e-comment-marker">${escapeHtml(labels.tcc)} ${renderInline(node.text, labels)} ${escapeHtml(blockCommentEnd(labels.tcc))}</span>`, level, "comment", config, state)
          : renderLine(`<span class="algorithm2e-comment-marker${node.align === "right" ? " algorithm2e-right-comment" : ""}">${escapeHtml(labels.tcp)} ${renderInline(node.text, labels)}</span>`, level, "comment", config, state)
      case "loop": {
        const keyword = node.kind === "foreach" ? labels.foreach : node.kind === "while" ? labels.while : labels.for
        const header = renderLine(`<span class="algorithm2e-keyword">${escapeHtml(keyword)}</span> ${renderInline(node.expression, labels)} <span class="algorithm2e-keyword">${escapeHtml(labels.do)}</span>${renderInlineComment(node.comment, labels, node.commentAlign)}`, level, "loop", config, state)
        const body = renderNodes(node.body, level + 1, config, state)
        const ending = config.blockEnding === "true"
          ? renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.endLoop)}</span>`, level, "end", config, state)
          : ""
        return `${header}${body}${ending}`
      }
      case "if": {
        const header = renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.if)}</span> ${renderInline(node.condition, labels)} <span class="algorithm2e-keyword">${escapeHtml(labels.then)}</span>${renderInlineComment(node.comment, labels, node.commentAlign)}`, level, "if", config, state)
        const body = renderNodes(node.body, level + 1, config, state)
        const elsePart = node.elseBody
          ? `${renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.else)}</span>`, level, "else", config, state)}${renderNodes(node.elseBody, level + 1, config, state)}`
          : ""
        const ending = config.blockEnding === "true"
          ? renderLine(`<span class="algorithm2e-keyword">${escapeHtml(labels.endIf)}</span>`, level, "end", config, state)
          : ""
        return `${header}${body}${elsePart}${ending}`
      }
      case "raw":
        return node.text.split(/\r?\n/).map((line) => renderLine(`${renderInline(line, labels)}${node.terminated ? ";" : ""}${renderInlineComment(node.comment, labels, node.commentAlign)}`, level, "raw", config, state)).join("")
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
  const settings = getDefaultAlgorithm2eSettings()
  const rootStyle = [
    `--algorithm2e-font-chinese:${cssFontValue(settings.fonts.chinese)}`,
    `--algorithm2e-font-english:${cssFontValue(settings.fonts.english)}`,
    `--algorithm2e-font-math:${cssFontValue(settings.fonts.math)}`,
  ].join(";")
  result.html = `<div class="algorithm2e-root" data-style="${settings.style}" style="${escapeHtml(rootStyle)}">${warningHtml}<div class="algorithm2e-body">${renderNodes(document.nodes, 0, config, state)}</div></div>`
  result.ok = true
  result.message = warnings.join("\n")
  return result
}
