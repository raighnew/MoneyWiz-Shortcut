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
  ['淘宝', 3],
  ['天猫', 3],
  ['菜鸟', 2],
  ['淘气值', 2],
  ['官方物流', 1],
  ['创建时间', 1],
  ['付款时间', 1],
  ['申请开票', 1]
]

const MERCHANT_PATTERN = /旗舰店|专营店|专卖店|企业店|天猫超市|淘宝店|的小店|超市/
const TITLE_STOP_PATTERN = /^(共\s*\d|已选|数量|实付款|[×x]\s*\d|颜色|规格|交易成功|等待)/

export const taobao: PaymentParser = {
  platform: 'taobao',
  label: '淘宝',

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
      date: dateAfterLabels(lines, ['付款时间', '创建时间', '下单时间']),
      orderId: valueAfterLabels(lines, ['订单编号', '订单号'], /(\d{12,})/)
    }
  }
}
