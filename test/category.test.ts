import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categorize } from '../src/category/index.ts'
import type { ParsedPayment } from '../src/types.ts'

function payment(merchant: string, description: string, hintCategory?: ParsedPayment['hintCategory']): ParsedPayment {
  return { merchant, description, amount: 1, date: null, orderId: null, hintCategory }
}

test('diapers and baby brands go to Baby', () => {
  assert.equal(categorize(payment('佳美盒KAMIBAKO海外专营店', 'MOONY 尤妮佳 air fit 纸尿裤')), 'Baby')
  assert.equal(categorize(payment('某某店', '爱他美奶粉 3段')), 'Baby')
})

test('brand keywords match case-insensitively', () => {
  assert.equal(categorize(payment('店', 'MOONY air fit NB码')), 'Baby')
})

test('pet supplies go to Pet', () => {
  assert.equal(categorize(payment('宠物旗舰店', '猫粮 10kg')), 'Pet')
  assert.equal(categorize(payment('某店', '豆腐猫砂 6L')), 'Pet')
})

test('coffee shops and drinks go to Coffee', () => {
  assert.equal(categorize(payment('瑞幸咖啡', '生椰拿铁')), 'Coffee')
  assert.equal(categorize(payment('星巴克', '大杯美式')), 'Coffee')
})

test('fuel and charging go to GasFuel', () => {
  assert.equal(categorize(payment('中石化', '92号汽油')), 'GasFuel')
  assert.equal(categorize(payment('特来电', '充电桩订单')), 'GasFuel')
})

test('supermarkets and fresh food go to Groceries', () => {
  assert.equal(categorize(payment('天猫超市', '三只松鼠零食大礼包')), 'Groceries')
  assert.equal(categorize(payment('盒马', '生鲜蔬菜')), 'Groceries')
})

test('restaurants and delivery go to DiningOut', () => {
  assert.equal(categorize(payment('美团平台商户', '外卖订单')), 'DiningOut')
  assert.equal(categorize(payment('海底捞', '火锅')), 'DiningOut')
})

test('ride hailing goes to Transport', () => {
  assert.equal(categorize(payment('滴滴出行', '快车')), 'Transport')
})

test('unknown purchases fall back to Shopping', () => {
  assert.equal(categorize(payment('优衣库', '男装 T恤')), 'Shopping')
})

test('platform hint is used when keywords do not match', () => {
  assert.equal(categorize(payment('某商户', '订单', 'Transport')), 'Transport')
})

test('keyword match beats the platform hint', () => {
  assert.equal(categorize(payment('滴滴出行', '快车', 'Baby')), 'Transport')
})

test('unmatched scan-to-pay bills default to Groceries', () => {
  assert.equal(categorize(payment('某商户', '扫码收款'), 'wechat'), 'Groceries')
  assert.equal(categorize(payment('某商户', '扫码收款'), 'alipay'), 'Groceries')
})

test('unmatched marketplace orders default to Shopping', () => {
  assert.equal(categorize(payment('某店', '订单'), 'jd'), 'Shopping')
  assert.equal(categorize(payment('某店', '订单'), 'pdd'), 'Shopping')
  assert.equal(categorize(payment('某店', '订单'), 'taobao'), 'Shopping')
})

test('a keyword match beats the platform default', () => {
  assert.equal(categorize(payment('瑞幸咖啡', '生椰拿铁'), 'wechat'), 'Coffee')
})

test('天猫 does not trigger the Pet category', () => {
  assert.equal(categorize(payment('天猫旗舰店', '手机壳')), 'Shopping')
})
