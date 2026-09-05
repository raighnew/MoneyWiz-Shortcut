export type WeightedKeyword = readonly [keyword: string, weight: number]

const DATE_PATTERN = /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[\s,，]*(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
const YUAN_AMOUNT_PATTERN = /[¥￥]\s*(\d[\d,]*(?:\.\d{1,2})?)/g
// A line that is (almost) nothing but an amount, e.g. "-93.00" or "¥28.50".
const BARE_AMOUNT_LINE_PATTERN = /^[-−–]?\s*[¥￥]?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*元?$/

export function toLines(text: string): string[] {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

export function scoreKeywords(text: string, weightedKeywords: readonly WeightedKeyword[]): number {
  let score = 0
  for (const [keyword, weight] of weightedKeywords) {
    if (text.includes(keyword)) score += weight
  }
  return score
}

export function parseNumber(numberText: string): number | null {
  const value = Number(String(numberText).replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

// OCR often renders "实付款 共减¥24 合计 ¥93" as one line: the amount we want
// is the LAST currency amount in the fragment, discounts come before it.
export function lastYuanAmountIn(fragment: string): number | null {
  const matches = [...fragment.matchAll(YUAN_AMOUNT_PATTERN)]
  const last = matches[matches.length - 1]
  return last ? parseNumber(last[1]!) : null
}

// Column layouts sometimes split a label and its value onto adjacent OCR
// lines, so the lines after the label line are checked as well.
const DEFAULT_LOOKAHEAD_LINES = 2

function candidatesAfterLabel(
  lines: string[],
  label: string,
  lookaheadLines = DEFAULT_LOOKAHEAD_LINES
): string[][] {
  const candidateGroups: string[][] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const labelIndex = line.indexOf(label)
    if (labelIndex < 0) continue
    const group = [line.slice(labelIndex + label.length)]
    for (let offset = 1; offset <= lookaheadLines; offset++) {
      if (lines[i + offset] !== undefined) group.push(lines[i + offset]!)
    }
    candidateGroups.push(group)
  }
  return candidateGroups
}

export function amountAfterLabels(
  lines: string[],
  labels: readonly string[],
  lookaheadLines = DEFAULT_LOOKAHEAD_LINES
): number | null {
  for (const label of labels) {
    for (const group of candidatesAfterLabel(lines, label, lookaheadLines)) {
      for (const candidate of group) {
        const amount = lastYuanAmountIn(candidate)
        if (amount !== null) return amount
        const bare = candidate.match(BARE_AMOUNT_LINE_PATTERN)
        if (bare) return parseNumber(bare[1]!)
      }
    }
  }
  return null
}

// Bill detail pages (WeChat/Alipay) show the amount alone near the top.
export function bareAmountNearTop(lines: string[], maxLinesToScan = 8): number | null {
  for (const line of lines.slice(0, maxLinesToScan)) {
    const match = line.match(BARE_AMOUNT_LINE_PATTERN)
    if (match) return parseNumber(match[1]!)
  }
  return null
}

function formatDateMatch(match: RegExpMatchArray): string {
  const pad = (value: string | number) => String(value).padStart(2, '0')
  const [, year, month, day, hour, minute, second] = match
  const time = hour === undefined
    ? '00:00:00'
    : `${pad(hour)}:${pad(minute!)}:${pad(second ?? 0)}`
  return `${year}-${pad(month!)}-${pad(day!)} ${time}`
}

// Returns 'yyyy-MM-dd HH:mm:ss' for the first label that has a date on its
// own line or one of the next two lines.
export function dateAfterLabels(lines: string[], labels: readonly string[]): string | null {
  for (const label of labels) {
    for (const group of candidatesAfterLabel(lines, label)) {
      for (const candidate of group) {
        const match = candidate.match(DATE_PATTERN)
        if (match) return formatDateMatch(match)
      }
    }
  }
  return null
}

export function firstDateAnywhere(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.match(DATE_PATTERN)
    if (match) return formatDateMatch(match)
  }
  return null
}

export function valueAfterLabels(
  lines: string[],
  labels: readonly string[],
  valuePattern: RegExp
): string | null {
  for (const label of labels) {
    for (const group of candidatesAfterLabel(lines, label)) {
      for (const candidate of group) {
        const match = candidate.match(valuePattern)
        if (match) return (match[1] ?? match[0]).trim()
      }
    }
  }
  return null
}

// Strips storefront badges and chevrons: "全球购 佳美盒KAMIBAKO海外专营店 >"
// becomes "佳美盒KAMIBAKO海外专营店".
export function cleanMerchantName(line: string): string {
  return line
    .replace(/全球购|品牌闪购|复制/g, '')
    .replace(/[>›〉＞]+\s*$/, '')
    .trim()
}

// Joins the product-title lines between the merchant row and the first
// metadata row (quantity, SKU, price...).
export function productTitleAfter(
  lines: string[],
  merchantIndex: number,
  stopPattern: RegExp
): string | null {
  const titleLines: string[] = []
  for (let i = merchantIndex + 1; i < lines.length; i++) {
    if (stopPattern.test(lines[i]!)) break
    titleLines.push(lines[i]!)
    if (titleLines.length >= 2) break
  }
  const title = titleLines.join(' ').trim()
  return title || null
}

// Vision emits a detail table as two separate blocks — every label, then every
// value — and wraps long labels across lines ("Payment" / "Method"), so a label
// never sits next to its value and candidatesAfterLabel cannot reach it.
// Re-joining the wrapped labels restores the 1:1 order between the two blocks.
const MAX_LINES_PER_LABEL = 3
const MIN_LABELS_PER_BLOCK = 2
const WRAPPED_VALUE_TAIL_PATTERN = /^\d{1,4}$/
const LONG_DIGIT_RUN_ENDING_PATTERN = /\d{10,}$/

// A long order number wraps onto a second line ("…40817" / "564"); gluing the
// tail back keeps the value column aligned with the label column.
function unwrapValueLines(lines: string[]): string[] {
  const values: string[] = []
  for (const line of lines) {
    const previous = values[values.length - 1]
    if (
      previous !== undefined
      && WRAPPED_VALUE_TAIL_PATTERN.test(line)
      && LONG_DIGIT_RUN_ENDING_PATTERN.test(previous)
    ) {
      values[values.length - 1] = previous + line
      continue
    }
    values.push(line)
  }
  return values
}

export function pairDetachedLabelColumn(
  lines: string[],
  vocabulary: readonly string[]
): ReadonlyMap<string, string> | null {
  // Longest first, so "Transfer Order No." wins over the "Order No." that
  // WeChat leaves behind when the first word is absorbed into the value block.
  const labelsByLengthDesc = [...vocabulary].sort((a, b) => b.length - a.length)

  function labelAt(index: number): { label: string; lineCount: number } | null {
    for (const label of labelsByLengthDesc) {
      for (let lineCount = 1; lineCount <= MAX_LINES_PER_LABEL; lineCount++) {
        if (index + lineCount > lines.length) break
        if (lines.slice(index, index + lineCount).join(' ') === label) return { label, lineCount }
      }
    }
    return null
  }

  for (let start = 0; start < lines.length; start++) {
    const labels: string[] = []
    let cursor = start
    for (let match = labelAt(cursor); match; match = labelAt(cursor)) {
      labels.push(match.label)
      cursor += match.lineCount
    }
    if (labels.length < MIN_LABELS_PER_BLOCK) continue

    const values = unwrapValueLines(lines.slice(cursor))
    const rows = new Map<string, string>()
    labels.forEach((label, index) => {
      const value = values[index]
      if (value !== undefined && !rows.has(label)) rows.set(label, value)
    })
    return rows
  }
  return null
}

// Last resort for order numbers when the label column could not be paired.
export function firstLongDigitRun(lines: string[], minDigits: number): string | null {
  const pattern = new RegExp(`\\d{${minDigits},}`)
  for (const line of lines) {
    const match = line.match(pattern)
    if (match) return match[0]
  }
  return null
}
