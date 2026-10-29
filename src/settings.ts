export type Algorithm2ePreset = "zh-CN" | "en-US" | "custom"
export type Algorithm2eStyle = "rounded" | "three-line"

export interface Algorithm2eFonts {
  chinese: string
  english: string
  math: string
}

export const DEFAULT_FONTS: Algorithm2eFonts = {
  chinese: "SimSun",
  english: "Times New Roman",
  math: "Times New Roman",
}

export interface Algorithm2eLabels {
  algorithm: string
  for: string
  foreach: string
  while: string
  do: string
  if: string
  then: string
  else: string
  kwIn: string
  kwOut: string
  kwTo: string
  kwAnd: string
  kwOr: string
  return: string
  tcp: string
  tcc: string
  endIf: string
  endLoop: string
  separator: string
}

export interface Algorithm2eSettings {
  preset: Algorithm2ePreset
  labels: Algorithm2eLabels
  style: Algorithm2eStyle
  scopeLine: boolean
  blockEnding: boolean
  lineNumber: boolean
  fonts: Algorithm2eFonts
}

export const PRESET_LABELS: Record<Exclude<Algorithm2ePreset, "custom">, Algorithm2eLabels> = {
  "zh-CN": {
    algorithm: "算法",
    for: "对于",
    foreach: "对于每个",
    while: "当",
    do: "执行",
    if: "如果",
    then: "那么",
    else: "否则",
    kwIn: "输入",
    kwOut: "输出",
    kwTo: "至",
    kwAnd: "且",
    kwOr: "或",
    return: "返回",
    tcp: "//",
    tcc: "/*",
    endIf: "结束",
    endLoop: "结束",
    separator: "：",
  },
  "en-US": {
    algorithm: "Algorithm",
    for: "for",
    foreach: "for each",
    while: "while",
    do: "do",
    if: "if",
    then: "then",
    else: "else",
    kwIn: "Input",
    kwOut: "Output",
    kwTo: "to",
    kwAnd: "and",
    kwOr: "or",
    return: "return",
    tcp: "//",
    tcc: "/*",
    endIf: "end",
    endLoop: "end",
    separator: ":",
  },
}

const DEFAULT_LABELS: Algorithm2eLabels = {
  ...PRESET_LABELS["en-US"],
}

export const LABEL_KEYS: Array<keyof Algorithm2eLabels> = [
  "algorithm",
  "for",
  "foreach",
  "while",
  "do",
  "if",
  "then",
  "else",
  "kwIn",
  "kwOut",
  "kwTo",
  "kwAnd",
  "kwOr",
  "return",
  "tcp",
  "tcc",
  "endIf",
  "endLoop",
  "separator",
]

let currentSettings: Algorithm2eSettings = {
  preset: "en-US",
  labels: { ...DEFAULT_LABELS },
  style: "three-line",
  scopeLine: true,
  blockEnding: false,
  lineNumber: true,
  fonts: { ...DEFAULT_FONTS },
}

function cloneSettings(settings: Algorithm2eSettings): Algorithm2eSettings {
  return {
    preset: settings.preset,
    labels: { ...settings.labels },
    style: settings.style,
    scopeLine: settings.scopeLine,
    blockEnding: settings.blockEnding,
    lineNumber: settings.lineNumber,
    fonts: { ...settings.fonts },
  }
}

export function getDefaultAlgorithm2eSettings(): Algorithm2eSettings {
  return cloneSettings(currentSettings)
}

export function getAlgorithm2eLabels(): Algorithm2eLabels {
  return { ...currentSettings.labels }
}

export function setAlgorithm2eSettings(settings: Partial<Algorithm2eSettings> | null | undefined): Algorithm2eSettings {
  if (!settings) {
    currentSettings = {
      preset: "en-US",
      labels: { ...PRESET_LABELS["en-US"] },
      style: "three-line",
      scopeLine: true,
      blockEnding: false,
      lineNumber: true,
      fonts: { ...DEFAULT_FONTS },
    }
    return getDefaultAlgorithm2eSettings()
  }
  const preset = settings.preset === "en-US" || settings.preset === "custom" ? settings.preset : "zh-CN"
  const presetLabels = preset === "custom" ? DEFAULT_LABELS : PRESET_LABELS[preset]
  const labels = preset === "custom"
    ? { ...presetLabels, ...(settings?.labels || {}) }
    : { ...presetLabels }
  // Migrate the old Chinese comment labels to the actual LaTeX-style markers.
  if (labels.tcp === "注") labels.tcp = "//"
  if (labels.tcc === "注释" || labels.tcc === "Comment") labels.tcc = "/*"
  const style = settings.style === "rounded" ? "rounded" : "three-line"
  const scopeLine = settings.scopeLine !== false
  const blockEnding = settings.blockEnding === true
  const lineNumber = settings.lineNumber !== false
  const fonts = { ...DEFAULT_FONTS, ...(settings.fonts || {}) }
  currentSettings = { preset, labels, style, scopeLine, blockEnding, lineNumber, fonts }
  return getDefaultAlgorithm2eSettings()
}

export function labelsForPreset(preset: Algorithm2ePreset): Algorithm2eLabels {
  if (preset === "custom") return getAlgorithm2eLabels()
  return { ...PRESET_LABELS[preset] }
}
