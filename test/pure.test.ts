import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AMOUNT_PATTERNS,
  CATEGORY_RULES,
  DATE_PADDING_RULES,
  DATE_PATTERN,
  DATE_SEPARATOR_PATTERN,
  FALLBACK_ACCOUNT,
  FALLBACK_CATEGORY_NAME,
  MERCHANT_NOISE_PATTERN,
  MERCHANT_PATTERNS,
  PLATFORM_RULES
} from '../src/pure/patterns.ts'
import { loadFixture } from './helpers.ts'

// Mirrors how the generated pure Shortcut evaluates the patterns:
// Match Text is case-insensitive with (?m) — 'im' flags here.
function firstMatch(pattern: string, text: string): string | null {
  const match = text.match(new RegExp(pattern, 'im'))
  return match ? (match[1] ?? match[0]) : null
}

function extractAmount(text: string): string | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const value = firstMatch(pattern, text)
    if (value) return value.replace(/,/g, '')
  }
  return null
}

function extractMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const value = firstMatch(pattern, text)
    if (value) return value.replace(new RegExp(MERCHANT_NOISE_PATTERN, 'gi'), '').trim()
  }
  return null
}

// Mirrors the generator's Replace Text chain: separators to ASCII hyphens,
// then zero-padding for WeChat's single-digit months and days.
function extractDate(text: string): string | null {
  const matched = firstMatch(DATE_PATTERN, text)
  if (!matched) return null
  let normalized = matched.replace(new RegExp(DATE_SEPARATOR_PATTERN, 'g'), '-')
  for (const rule of DATE_PADDING_RULES) {
    normalized = normalized.replace(new RegExp(rule.pattern, 'g'), rule.replacement.replace('$1', '$1'))
  }
  return normalized
}

const pickCategory = (text: string) =>
  CATEGORY_RULES.find(rule => new RegExp(rule.pattern, 'im').test(text))?.value ?? null

const pickPlatform = (text: string) =>
  PLATFORM_RULES.find(rule => new RegExp(rule.pattern, 'im').test(text)) ?? null

const CASES = [
  // 实付款 合计 ¥93 (total actually paid) wins over the per-item 到手¥88.
  // The storefront line becomes the description; payee is the platform name.
  { fixture: 'jd', amount: '93', date: '2026-07-09 17:56:58', description: '佳美盒KAMIBAKO海外专营店', category: 'Baby', account: 'WeChat', payee: 'JD' },
  // Real Vision OCR output: label/value columns split into separate blocks,
  // 合计 misread as 合汁, a lone notification badge "3", full-width ＞.
  { fixture: 'jd-real', amount: '93', date: '2026-07-09 17:56:58', description: '佳美盒KAMIBAKO海外专营店', category: 'Baby', account: 'WeChat', payee: 'JD' },
  { fixture: 'taobao', amount: '59.00', date: '2026-07-05 10:20:30', description: '天猫超市', category: 'Groceries', account: 'Alipay', payee: 'Taobao' },
  { fixture: 'pdd', amount: '29.90', date: '2026-07-08 20:11:05', description: '好孩子官方旗舰店', category: 'Baby', account: 'WeChat', payee: 'PDD' },
  // Real Vision OCR of a PDD order: 实付：¥17.9（免运费）, 折扣店 storefront
  // with trailing badge text, Apple Pay payment, en-dash-free timestamps.
  { fixture: 'pdd-real', amount: '17.9', date: '2026-06-21 06:59:08', description: '华宇软水盐折扣店', category: null, account: 'WeChat', payee: 'PDD' },
  { fixture: 'wechat', amount: '28.50', date: '2026-07-10 12:03:22', description: '美团平台商户', category: 'Dining Out', account: 'WeChat', payee: 'WeChat' },
  { fixture: 'alipay', amount: '15.60', date: '2026-07-08 09:15:30', description: '滴滴出行-快车', category: 'Transport', account: 'Alipay', payee: 'Alipay' },
  // English-locale Alipay Transaction Details page, real Vision OCR: bare
  // "-12.55" amount, "Payment method" split across two lines, merchant via
  // the "Item description" row.
  { fixture: 'alipay-en', amount: '12.55', date: '2026-07-11 16:52:10', description: '每日新鲜', category: 'Groceries', account: 'Alipay', payee: 'Alipay' },
  // English-locale WeChat bills, real Vision OCR: the page never says
  // "WeChat", dates arrive as 2026/9/5, and the merchant is only readable as
  // the line sitting above the bare amount.
  { fixture: 'wechat-en-merchant', amount: '8.20', date: '2026-09-05 07:58:56', description: '卖菜小摊', category: 'Groceries', account: 'WeChat', payee: 'WeChat' },
  { fixture: 'wechat-en-qr-transfer', amount: '5.00', date: '2026-09-05 07:54:49', description: '扫二维码付款-给王小明', category: null, account: 'WeChat', payee: 'WeChat' },
  { fixture: 'wechat-en-transfer', amount: '60.00', date: '2026-08-27 21:37:32', description: '转账-转给城郊葡萄园', category: null, account: 'WeChat', payee: 'WeChat' },
  { fixture: 'wechat-en-barcode', amount: '4.50', date: '2026-09-02 16:34:38', description: '惠民生鲜超市', category: 'Groceries', account: 'WeChat', payee: 'WeChat' }
] as const

for (const expected of CASES) {
  test(`pure-shortcut patterns handle the ${expected.fixture} screenshot`, () => {
    const text = loadFixture(expected.fixture)
    assert.equal(extractAmount(text), expected.amount)
    assert.equal(extractDate(text), expected.date)
    assert.equal(extractMerchant(text), expected.description)
    assert.equal(pickCategory(text), expected.category)
    const platform = pickPlatform(text)
    assert.equal(platform?.account ?? FALLBACK_ACCOUNT, expected.account)
    assert.equal(platform?.payee, expected.payee)
  })
}

test('实付款 (total paid) wins over the per-item 到手 price', () => {
  assert.equal(extractAmount('①到手¥88\n实付款 共减¥24 合计 ¥93 >'), '93')
})

test('到手 is used when no 实付/合计 is on screen', () => {
  assert.equal(extractAmount('①到手¥88\n数量 ×1'), '88')
})

test('实付 wins over 合计 regardless of line order', () => {
  assert.equal(extractAmount('商品总价 ¥33.90\n合计 ¥33.90\n实付 ¥29.90'), '29.90')
  assert.equal(extractAmount('实付款 共减¥24 合计 ¥93 >'), '93')
})

test('实付 value split onto the next OCR line is still found', () => {
  assert.equal(extractAmount('实付款\n¥29.90\n订单编号 250708123'), '29.90')
})

test('column-split OCR with 合计 misread as 合汁 still finds 实付款 amount', () => {
  assert.equal(extractAmount('实付款\n订单编号\n支付方式\n支付时间\n共減¥24合汁¥93>'), '93')
})

test('a lone notification badge digit is never an amount', () => {
  assert.equal(extractAmount('订单详情\n3\n・・・\n全球购'), null)
})

test('价格/付款 labels are fallbacks and need a ¥ sign', () => {
  assert.equal(extractAmount('价格 ¥68.00\n数量 ×1'), '68.00')
  assert.equal(extractAmount('付款 ¥12.50'), '12.50')
  // 付款时间 timestamps must never be read as amounts.
  assert.equal(extractAmount('付款时间 2026-07-08 20:11:12'), null)
})

test('partial timestamps like JD delivery windows are ignored', () => {
  assert.equal(firstMatch(DATE_PATTERN, '期望配送时间 2026-07-11,09:00-15:00'), null)
})

test('unrecognized text yields no amount and the fallbacks', () => {
  const unrelated = '今天天气不错，去公园散步。'
  assert.equal(extractAmount(unrelated), null)
  assert.equal(pickCategory(unrelated) ?? FALLBACK_CATEGORY_NAME, 'Shopping')
  assert.equal(pickPlatform(unrelated), null)
})

test('the category fallback follows the detected platform', () => {
  const fallbackFor = (fixture: string) =>
    pickPlatform(loadFixture(fixture))?.fallbackCategory ?? FALLBACK_CATEGORY_NAME
  assert.equal(fallbackFor('wechat-en-qr-transfer'), 'Groceries')
  assert.equal(fallbackFor('alipay-en'), 'Groceries')
  assert.equal(fallbackFor('jd-real'), 'Shopping')
  assert.equal(fallbackFor('pdd-real'), 'Shopping')
})

test('WeChat slash dates are normalized and zero-padded', () => {
  assert.equal(extractDate('Payment\nTime\n2026/9/5 07:58:56'), '2026-09-05 07:58:56')
  // Already-padded ISO timestamps must pass through untouched.
  assert.equal(extractDate('支付时间 2026-07-09 17:56:58'), '2026-07-09 17:56:58')
})
