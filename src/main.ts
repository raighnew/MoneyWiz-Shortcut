import { config } from './config.ts'
import { parsePayment } from './parser/index.ts'
import { categorize } from './category/index.ts'
import { buildExpenseUrl } from './moneywiz/index.ts'
import type { CategoryKey, Platform } from './types.ts'

export interface ShortcutResult {
  ok: boolean
  error?: string
  platform?: Platform
  platformLabel?: string
  merchant?: string
  description?: string
  amount?: number
  date?: string
  category?: CategoryKey
  account?: string
  url?: string
  summary?: string
}

export function processOcrText(ocrText: string): ShortcutResult {
  const payment = parsePayment(ocrText)
  if (!payment) {
    return {
      ok: false,
      error: 'Could not detect the payment platform (JD/Taobao/PDD/WeChat/Alipay) in this screenshot.'
    }
  }
  if (payment.amount === null) {
    return {
      ok: false,
      error: `Detected a ${payment.platformLabel} screenshot but could not find the paid amount.`,
      platform: payment.platform,
      platformLabel: payment.platformLabel
    }
  }

  const category = categorize(payment, payment.platform)
  const account = config.accounts[payment.platform] ?? config.accounts.default
  const description = payment.description ?? payment.merchant ?? payment.platformLabel

  const url = buildExpenseUrl({
    amount: payment.amount,
    account,
    currency: config.currency,
    payee: payment.merchant,
    category: config.categoryNames[category],
    description,
    memo: payment.orderId ? `${payment.platformLabel} 订单号 ${payment.orderId}` : payment.platformLabel,
    date: payment.date,
    save: config.save
  })

  const summary = [
    `${payment.platformLabel}${payment.merchant ? ` · ${payment.merchant}` : ''}`,
    description,
    `¥${payment.amount} → ${category} (${account})`,
    payment.date ?? '(no date found, MoneyWiz will use now)'
  ].join('\n')

  return {
    ok: true,
    platform: payment.platform,
    platformLabel: payment.platformLabel,
    merchant: payment.merchant ?? undefined,
    description,
    amount: payment.amount,
    date: payment.date ?? undefined,
    category,
    account,
    url,
    summary
  }
}

// Scriptable entry point: the Shortcut passes the OCR text as the Run Script
// parameter and receives the result dictionary back.
if (typeof Script !== 'undefined' && Script && typeof args !== 'undefined' && args) {
  const input = args.shortcutParameter ?? args.plainTexts?.[0] ?? ''
  const result = processOcrText(String(input))
  Script.setShortcutOutput(result)
  Script.complete()
}
