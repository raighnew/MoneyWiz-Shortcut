import type { PaymentParser } from '../types.ts'
import {
  scoreKeywords,
  amountAfterLabels,
  dateAfterLabels,
  firstDateAnywhere,
  valueAfterLabels,
  cleanMerchantName,
  productTitleAfter,
  type WeightedKeyword
} from './utils.ts'

const KEYWORDS: readonly WeightedKeyword[] = [
  ['京东', 3],
  ['卖了换钱', 3],
  ['交易快照', 2],
  ['到手', 2],
  ['下单时间', 1],
  ['申请售后', 1]
]

const MERCHANT_PATTERN = /专营店|旗舰店|专卖店|官方店|自营|超市/
const TITLE_STOP_PATTERN = /^(数量|已选|共\s*\d|[×x]\s*\d|不支持|支持|实付款|到手|退货|保价)/

// Vision emits JD's label column and value column as separate blocks, so
// 实付款's "共減¥24合汁¥93" value lands ten-odd lines below its label; without
// this reach the per-item 到手 price would be booked instead of the total.
const DETACHED_COLUMN_LOOKAHEAD_LINES = 12

export const jd: PaymentParser = {
  platform: 'jd',
  label: '京东',

  score(text) {
    return scoreKeywords(text, KEYWORDS)
  },

  parse(lines) {
    const foundIndex = lines.findIndex(line => MERCHANT_PATTERN.test(line))
    const merchantIndex = foundIndex >= 0 ? foundIndex : 0
    return {
      merchant: cleanMerchantName(lines[merchantIndex] ?? ''),
      description: productTitleAfter(lines, merchantIndex, TITLE_STOP_PATTERN),
      // 实付款/合计 is the total actually paid; the per-item 到手 price is
      // only a fallback.
      amount: amountAfterLabels(lines, ['实付款'], DETACHED_COLUMN_LOOKAHEAD_LINES)
        ?? amountAfterLabels(lines, ['合计', '到手']),
      date: dateAfterLabels(lines, ['支付时间', '下单时间']) ?? firstDateAnywhere(lines),
      orderId: valueAfterLabels(lines, ['订单编号', '订单号'], /(\d{10,})/)
    }
  }
}
