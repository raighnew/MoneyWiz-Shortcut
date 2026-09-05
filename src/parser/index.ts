import type { DetectedPayment, PaymentParser } from '../types.ts'
import { toLines } from './utils.ts'
import { jd } from './jd.ts'
import { taobao } from './taobao.ts'
import { pdd } from './pdd.ts'
import { wechat } from './wechat.ts'
import { alipay } from './alipay.ts'

const PARSERS: readonly PaymentParser[] = [jd, taobao, pdd, wechat, alipay]

// A screenshot may mention several platforms (a JD order paid via WeChat),
// so every parser scores the text and the strongest signal wins.
const MIN_DETECTION_SCORE = 3

export function parsePayment(ocrText: string): DetectedPayment | null {
  const lines = toLines(ocrText)
  const fullText = lines.join('\n')

  let best: { parser: PaymentParser; score: number } | null = null
  for (const parser of PARSERS) {
    const score = parser.score(fullText)
    if (score >= MIN_DETECTION_SCORE && (!best || score > best.score)) {
      best = { parser, score }
    }
  }
  if (!best) return null

  return {
    ...best.parser.parse(lines),
    platform: best.parser.platform,
    platformLabel: best.parser.label
  }
}
