import type { PaymentParser } from '../types.ts'
import {
  scoreKeywords,
  amountAfterLabels,
  dateAfterLabels,
  valueAfterLabels,
  cleanMerchantName,
  productTitleAfter,
  type WeightedKeyword
} from './utils.ts'

const KEYWORDS: readonly WeightedKeyword[] = [
  ['拼多多', 3],
  ['拼单', 2],
  ['已拼', 2],
  ['拼单时间', 2],
  ['多多买菜', 2],
  ['百亿补贴', 2]
]

const MERCHANT_PATTERN = /旗舰店|专营店|专卖店|官方店|折扣店|买菜|的店|超市/
const TITLE_STOP_PATTERN = /^(已选|数量|共\s*\d|[×x]\s*\d|实付|商品总价|拼单成功|等待)/

export const pdd: PaymentParser = {
  platform: 'pdd',
  label: '拼多多',

  score(text) {
    return scoreKeywords(text, KEYWORDS)
  },

  parse(lines) {
    const foundIndex = lines.findIndex(line => MERCHANT_PATTERN.test(line))
    const merchantIndex = foundIndex >= 0 ? foundIndex : 0
    return {
      merchant: cleanMerchantName(lines[merchantIndex] ?? ''),
      description: productTitleAfter(lines, merchantIndex, TITLE_STOP_PATTERN),
      amount: amountAfterLabels(lines, ['实付款', '实付', '合计']),
      // 下单时间 is when the money left; 拼单时间/成交时间 are group-buy
      // milestones that can land days later.
      date: dateAfterLabels(lines, ['支付时间', '下单时间', '拼单时间']),
      // PDD order ids look like "250708-123456789012345".
      orderId: valueAfterLabels(lines, ['订单编号', '订单号'], /(\d[\d-]{7,})/)
    }
  }
}
