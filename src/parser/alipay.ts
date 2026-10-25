import type { CategoryKey, PaymentParser } from '../types.ts'
import {
  scoreKeywords,
  amountAfterLabels,
  bareAmountNearTop,
  dateAfterLabels,
  firstDateAnywhere,
  merchantAboveStandaloneAmount,
  valueAfterLabels,
  type WeightedKeyword
} from './utils.ts'

const KEYWORDS: readonly WeightedKeyword[] = [
  ['支付宝', 3],
  ['余额宝', 2],
  ['花呗', 2],
  ['账单分类', 2],
  ['收款方全称', 2],
  ['商家订单号', 2],
  ['交易成功', 1],
  ['付款方式', 1]
]

const HEADER_NOISE_PATTERN = /^(账单详情|账单|详情|返回|完成)$/

// Alipay's own bill category row (账单分类) maps onto our categories.
const BILL_CATEGORY_HINTS: readonly (readonly [string, CategoryKey])[] = [
  ['母婴', 'Baby'],
  ['亲子', 'Baby'],
  ['宠物', 'Pet'],
  ['餐饮', 'DiningOut'],
  ['美食', 'DiningOut'],
  ['生鲜', 'Groceries'],
  ['加油', 'GasFuel'],
  ['充电', 'GasFuel'],
  ['交通', 'PublicTransport'],
  ['出行', 'PublicTransport']
]

function hintFromBillCategory(lines: string[]): CategoryKey | undefined {
  const billCategory = valueAfterLabels(lines, ['账单分类'], /(.+)/)
  if (!billCategory) return undefined
  for (const [keyword, category] of BILL_CATEGORY_HINTS) {
    if (billCategory.includes(keyword)) return category
  }
  return undefined
}

export const alipay: PaymentParser = {
  platform: 'alipay',
  label: '支付宝',

  score(text) {
    return scoreKeywords(text, KEYWORDS)
  },

  parse(lines) {
    const merchant = merchantAboveStandaloneAmount(lines, HEADER_NOISE_PATTERN)
      ?? valueAfterLabels(lines, ['收款方全称', '收款方'], /(.+)/)
    return {
      merchant,
      description: valueAfterLabels(lines, ['商品说明', '商品'], /(.+)/) ?? merchant,
      amount: bareAmountNearTop(lines) ?? amountAfterLabels(lines, ['金额', '合计']),
      date: dateAfterLabels(lines, ['创建时间', '支付时间', '付款时间']) ?? firstDateAnywhere(lines),
      // 订单号 is a substring of 商家订单号, so one label covers both rows.
      orderId: valueAfterLabels(lines, ['订单号'], /([A-Za-z\d]{12,})/),
      hintCategory: hintFromBillCategory(lines)
    }
  }
}
