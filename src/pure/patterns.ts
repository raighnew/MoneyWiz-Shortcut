// Single source of truth for the 100%-built-in Shortcut variant: these
// patterns are tested under Node (test/pure.test.ts) and serialized into
// Match Text actions by scripts/generate-shortcut-pure.mjs.
//
// Keep them portable between JavaScript RegExp and ICU (NSRegularExpression):
// no lookbehind, no inline flags — multiline/case-insensitivity are applied
// by each consumer ('im' flags in JS, '(?m)' + case-insensitive in Shortcuts).
import {
  CATEGORY_KEYWORDS,
  FALLBACK_CATEGORY,
  PLATFORM_FALLBACK_CATEGORIES
} from '../category/keywords.ts'
import { config } from '../config.ts'
import type { Platform } from '../types.ts'

function escapeForRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Tried in order, group 1 captures the amount. 实付款/合计 — the total
// actually paid — is the figure to record; JD's per-item 到手 price is only
// a late fallback for screenshots that show nothing else.
//
// Real-world OCR constraints these encode (from an actual JD screenshot):
// - Vision may emit the label column and value column as SEPARATE blocks, so
//   实付款 can sit many lines away from its "共減¥24合汁¥93>" value — that
//   pattern scans up to 120 chars ahead for the first ¥ amount ending a line.
// - OCR misreads: 合计 arrives as 合汁, 共减 as 共減 — hence 合[计汁].
// - A notification badge like a lone "3" must NEVER count as an amount, so
//   the bare-line fallbacks require a ¥ sign or two decimals.
export const AMOUNT_PATTERNS: readonly string[] = [
  '实付款?[\\s\\S]{0,120}?[¥￥]\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?=[^0-9\\n]*$)',
  '实付款?[^\\n]*?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?=[^0-9\\n]*$)',
  '合[计汁][^0-9\\n]{0,4}([0-9][0-9,]*(?:\\.[0-9]{1,2})?)',
  '(?:价格|付款|金额|总价)[^\\n0-9]{0,8}[¥￥]\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)',
  '到手[^\\n0-9]{0,6}([0-9][0-9,]*(?:\\.[0-9]{1,2})?)',
  '^[-−–]?\\s*[¥￥]\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*元?$',
  '^[-−–]?\\s*([0-9][0-9,]*\\.[0-9]{2})\\s*元?$'
]

// Full timestamps only — partial dates (JD's 期望配送时间 2026-07-11,09:00) must
// not match; when nothing matches, the date parameter is omitted and MoneyWiz
// stamps the current time. Alipay's English UI prints dates with en-dashes
// (2026–07–11) and WeChat's with slashes (2026/9/5), hence the separator class.
export const DATE_PATTERN = '[0-9]{4}[-–—/][0-9]{1,2}[-–—/][0-9]{1,2} [0-9]{1,2}:[0-9]{2}:[0-9]{2}'

// Normalizes en/em dashes and slashes to the ASCII hyphen MoneyWiz expects.
export const DATE_SEPARATOR_PATTERN = '[–—/]'

export interface ReplacementRule {
  pattern: string
  replacement: string
}

// WeChat prints single-digit months and days (2026/9/5), which MoneyWiz
// rejects; applied in order AFTER the separators are normalized.
export const DATE_PADDING_RULES: readonly ReplacementRule[] = [
  { pattern: '-([0-9])-', replacement: '-0$1-' },
  { pattern: '-([0-9]) ', replacement: '-0$1 ' }
]

// The merchant feeds the MoneyWiz description (payee holds the platform
// name). Tried in order, group 1 captures the value:
// 1. label rows — 商品说明 滴滴出行-快车 / Item description 每日新鲜
// 2. storefront rows — captured THROUGH the marker word so trailing badge
//    text ("华宇软水盐折扣店 潜力好店 暑假大促") drops off.
// 3. the name WeChat/Alipay print directly above the big bill amount — the
//    only merchant signal on an English scan-to-pay bill, so it comes last
//    and never pre-empts a marketplace storefront row.
export const MERCHANT_PATTERNS: readonly string[] = [
  '(?:商品说明|Item description)[：:\\s]*([^\\n]+)',
  '^([^\\n]*?(?:专营店|旗舰店|专卖店|官方店|折扣店|平台商户|超市|买菜))',
  '^([^\\n]+)\\n[-−–][0-9]+\\.[0-9]{2}$'
]
export const MERCHANT_NOISE_PATTERN = '全球购|复制|[>›〉＞]'

export interface KeywordRule {
  /** Value written into the MoneyWiz URL. */
  value: string
  pattern: string
}

// First matching rule wins, mirroring src/category/index.ts priorities.
export const CATEGORY_RULES: readonly KeywordRule[] = CATEGORY_KEYWORDS.map(([category, keywords]) => ({
  value: config.categoryNames[category],
  pattern: keywords.map(escapeForRegex).join('|')
}))

export const FALLBACK_CATEGORY_NAME: string = config.categoryNames.Shopping

// Ordered by priority: storefronts before payment apps, so a PDD order paid
// via WeChat still books to the PDD account.
// English UI markers included: Alipay's English screens say "Payment
// success" / "Transaction successful" / "Payment time" (OCR splits "Payment
// method" across two lines, so multi-word markers can't rely on it);
// WeChat's English screens mention WeChat — wechat is checked first, so the
// overlap between "Payment Successful" and "Payment success" resolves
// correctly.
const PLATFORM_PATTERNS: readonly (readonly [Platform, string])[] = [
  ['jd', '京东|卖了换钱|交易快照'],
  ['pdd', '拼多多|拼单|多多买菜'],
  ['taobao', '淘宝|天猫|菜鸟|淘气值'],
  ['wechat', '微信支付|微信转账|商户全称|零钱|WeChat|Weixin|Transactions|Transaction Services|Payment successful|Initiate Split Bill|Merchant Mini Program|Recipient Service|Transfer has been accepted'],
  ['alipay', '支付宝|余额宝|花呗|账单分类|Alipay|Payment success|Payment time|Transaction successful|Transaction Details']
]

// The platform name doubles as the MoneyWiz payee — simple and consistent
// across all screenshots (MoneyWiz auto-creates missing payees).
const PLATFORM_PAYEES: Record<Platform, string> = {
  jd: 'JD',
  pdd: 'PDD',
  taobao: 'Taobao',
  wechat: 'WeChat',
  alipay: 'Alipay'
}

export interface PlatformRule {
  account: string
  payee: string
  /** Category when no keyword rule matches — see PLATFORM_FALLBACK_CATEGORIES. */
  fallbackCategory: string
  pattern: string
}

export const PLATFORM_RULES: readonly PlatformRule[] = PLATFORM_PATTERNS.map(([platform, pattern]) => ({
  account: config.accounts[platform] ?? config.accounts.default,
  payee: PLATFORM_PAYEES[platform],
  fallbackCategory: config.categoryNames[
    PLATFORM_FALLBACK_CATEGORIES[platform] ?? FALLBACK_CATEGORY
  ],
  pattern
}))

export const FALLBACK_ACCOUNT: string = config.accounts.default
export const CURRENCY: string = config.currency
export const SAVE_MODE: string = config.save ? 'true' : 'false'
