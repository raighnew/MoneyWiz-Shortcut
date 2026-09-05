import type { PaymentParser } from '../types.ts'
import {
  scoreKeywords,
  amountAfterLabels,
  bareAmountNearTop,
  dateAfterLabels,
  firstDateAnywhere,
  firstLongDigitRun,
  pairDetachedLabelColumn,
  valueAfterLabels,
  cleanMerchantName,
  type WeightedKeyword
} from './utils.ts'

// The English UI never says "WeChat" anywhere on a bill, so detection leans on
// section headers and status strings that are unique to it — Alipay's English
// screens say "Transaction Details" / "Transaction successful" instead.
// Only markers that OCR keeps on ONE line qualify: "Recipient Note" and
// "Transfer Order No." arrive wrapped and would never match.
const KEYWORDS: readonly WeightedKeyword[] = [
  ['微信支付', 3],
  ['微信转账', 3],
  ['商户全称', 3],
  ['Transaction Services', 3],
  ['当前状态', 2],
  ['零钱', 2],
  ['交易单号', 2],
  ['Transactions', 2],
  ['Payment successful', 2],
  ['Transfer has been accepted', 2],
  ['Initiate Split Bill', 2],
  ['Merchant Mini Program', 2],
  ['Recipient Service', 2],
  ['二维码收款', 2],
  ['支付成功', 1],
  ['账单详情', 1],
  // Alipay's English bills carry an Acquirer row too — a tie-breaker only.
  ['Acquirer', 1]
]

const HEADER_NOISE_PATTERN = /^(账单详情|账单|详情|返回|完成|Transactions|×)$/
const BARE_AMOUNT_PATTERN = /^[-−–]?\s*[¥￥]?\s*\d[\d,]*(?:\.\d{1,2})?\s*元?$/
const ORDER_NUMBER_PATTERN = /(\d{10,})/
const MIN_ORDER_NUMBER_DIGITS = 15

// Rows of the English detail table, listed so the column pairing can rebuild
// the labels OCR wrapped across lines ("Payment" + "Method").
const ENGLISH_ROW_LABELS: readonly string[] = [
  'Current Status',
  'Payment Time',
  'Transfer Time',
  'Received Time',
  'Payment Method',
  'Recipient Note',
  'Transfer Description',
  'Products',
  'Merchant',
  'Acquirer',
  'Transaction Order No.',
  'Transfer Order No.',
  'Merchant Order No.',
  'Order No.'
]

// The merchant display name sits directly above the big amount on the bill
// detail page; 商户全称 is the registered company name, kept as fallback.
function displayNameAboveAmount(lines: string[]): string | null {
  const amountIndex = lines.findIndex(line => BARE_AMOUNT_PATTERN.test(line))
  for (let i = amountIndex - 1; i >= 0; i--) {
    if (!HEADER_NOISE_PATTERN.test(lines[i]!)) return cleanMerchantName(lines[i]!)
  }
  return null
}

export const wechat: PaymentParser = {
  platform: 'wechat',
  label: '微信支付',

  score(text) {
    return scoreKeywords(text, KEYWORDS)
  },

  parse(lines) {
    const rows = pairDetachedLabelColumn(lines, ENGLISH_ROW_LABELS)
    const rowValue = (...labels: string[]): string | null => {
      for (const label of labels) {
        const value = rows?.get(label)
        if (value) return value
      }
      return null
    }

    const merchant = displayNameAboveAmount(lines)
      ?? valueAfterLabels(lines, ['商户全称', '收款方'], /(.+)/)
      ?? rowValue('Merchant')

    // Recipient Note / Transfer Description are always the boilerplate
    // 二维码收款 / 微信转账, so the display name describes the spend better.
    const description = rowValue('Products')
      ?? valueAfterLabels(lines, ['商品'], /(.+)/)
      ?? merchant

    // Transfers carry a Received Time as well, so the paid-at row is read by
    // label rather than by taking the first timestamp on screen.
    const paidAtRow = rowValue('Payment Time', 'Transfer Time')
    const orderNumberRow = rowValue(
      'Transaction Order No.',
      'Transfer Order No.',
      'Order No.',
      'Merchant Order No.'
    )

    return {
      merchant,
      description,
      amount: bareAmountNearTop(lines) ?? amountAfterLabels(lines, ['金额', '合计']),
      date: (paidAtRow && firstDateAnywhere([paidAtRow]))
        ?? dateAfterLabels(lines, ['支付时间', '转账时间'])
        ?? firstDateAnywhere(lines),
      orderId: valueAfterLabels(lines, ['交易单号', '商户单号'], /([A-Za-z\d]{10,})/)
        ?? orderNumberRow?.match(ORDER_NUMBER_PATTERN)?.[1]
        ?? firstLongDigitRun(lines, MIN_ORDER_NUMBER_DIGITS)
    }
  }
}
