import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildExpenseUrl } from '../src/moneywiz/index.ts'

test('builds a complete expense URL', () => {
  const url = buildExpenseUrl({
    amount: 93,
    account: 'WeChat',
    currency: 'CNY',
    payee: '佳美盒KAMIBAKO海外专营店',
    category: 'Baby',
    description: 'MOONY 尤妮佳 纸尿裤',
    memo: '京东 订单号 3990000011112222',
    date: '2026-07-09 17:56:58',
    save: true
  })

  assert.ok(url.startsWith('moneywiz://expense?'))
  assert.ok(url.includes('amount=93.00'))
  assert.ok(url.includes('account=WeChat'))
  assert.ok(url.includes('currency=CNY'))
  assert.ok(url.includes(`payee=${encodeURIComponent('佳美盒KAMIBAKO海外专营店')}`))
  assert.ok(url.includes('category=Baby'))
  assert.ok(url.includes('date=2026-07-09%2017%3A56%3A58'))
  assert.ok(url.includes('save=true'))
})

test('strips spaces from the account name as the scheme requires', () => {
  const url = buildExpenseUrl({ amount: 1, account: 'John CHASE Savings' })
  assert.ok(url.includes('account=JohnCHASESavings'))
})

test('keeps the category hierarchy separator unencoded', () => {
  const url = buildExpenseUrl({ amount: 1, account: 'Cash', category: 'Dining Out/Restaurants' })
  assert.ok(url.includes('category=Dining%20Out/Restaurants'))
})

test('formats amounts with two decimals and no sign', () => {
  const url = buildExpenseUrl({ amount: -29.9, account: 'Cash' })
  assert.ok(url.includes('amount=29.90'))
})

test('omits empty optional parameters and defaults to save=false', () => {
  const url = buildExpenseUrl({ amount: 5, account: 'Cash' })
  assert.equal(url, 'moneywiz://expense?amount=5.00&account=Cash&save=false')
})
