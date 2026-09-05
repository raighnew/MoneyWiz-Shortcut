import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processOcrText } from '../src/main.ts'
import { config } from '../src/config.ts'
import { loadFixture } from './helpers.ts'

test('JD screenshot end to end: parse, categorize, build URL', () => {
  const result = processOcrText(loadFixture('jd'))
  assert.equal(result.ok, true)
  assert.equal(result.platform, 'jd')
  assert.equal(result.amount, 93)
  assert.equal(result.category, 'Baby')
  assert.equal(result.account, config.accounts.jd)
  assert.ok(result.url!.startsWith('moneywiz://expense?amount=93.00'))
  assert.ok(result.url!.includes('category=Baby'))
  assert.ok(result.url!.includes('date=2026-07-09%2017%3A56%3A58'))
  assert.ok(result.summary!.includes('¥93'))
})

test('Alipay screenshot end to end uses the alipay account', () => {
  const result = processOcrText(loadFixture('alipay'))
  assert.equal(result.ok, true)
  assert.equal(result.category, 'Transport')
  assert.equal(result.account, config.accounts.alipay)
})

test('unrecognized text returns an error result', () => {
  const result = processOcrText('这是一段和支付无关的文字')
  assert.equal(result.ok, false)
  assert.ok(result.error)
  assert.equal(result.url, undefined)
})
