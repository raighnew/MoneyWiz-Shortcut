import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePayment } from '../src/parser/index.ts'
import { loadFixture } from './helpers.ts'

test('JD order detail screenshot', () => {
  const payment = parsePayment(loadFixture('jd'))
  assert.ok(payment)
  assert.equal(payment.platform, 'jd')
  assert.equal(payment.merchant, '佳美盒KAMIBAKO海外专营店')
  assert.equal(payment.description, 'MOONY 尤妮佳 air fit 纸尿裤')
  // 实付款/合计 (93, total actually paid) must win over the per-item 到手
  // price (88), the discount (24) and the original price (112).
  assert.equal(payment.amount, 93)
  assert.equal(payment.date, '2026-07-09 17:56:58')
  assert.equal(payment.orderId, '3990000011112222')
})

test('Taobao order detail screenshot', () => {
  const payment = parsePayment(loadFixture('taobao'))
  assert.ok(payment)
  assert.equal(payment.platform, 'taobao')
  assert.equal(payment.merchant, '天猫超市')
  assert.equal(payment.description, '三只松鼠零食大礼包 坚果炒货组合装')
  assert.equal(payment.amount, 59)
  assert.equal(payment.date, '2026-07-05 10:21:00')
  assert.equal(payment.orderId, '3990000011112222333')
})

test('PDD order detail screenshot', () => {
  const payment = parsePayment(loadFixture('pdd'))
  assert.ok(payment)
  assert.equal(payment.platform, 'pdd')
  assert.equal(payment.merchant, '好孩子官方旗舰店')
  assert.equal(payment.description, '婴儿湿巾80抽×6包 宝宝手口湿纸巾')
  // 实付 (29.90), not 商品总价 (33.90) or the coupon (4.00).
  assert.equal(payment.amount, 29.9)
  assert.equal(payment.date, '2026-07-08 20:11:12')
  assert.equal(payment.orderId, '250708-123456789012345')
})

test('WeChat Pay bill detail screenshot', () => {
  const payment = parsePayment(loadFixture('wechat'))
  assert.ok(payment)
  assert.equal(payment.platform, 'wechat')
  assert.equal(payment.merchant, '美团平台商户')
  assert.equal(payment.description, '美团外卖订单-烧腊双拼饭')
  assert.equal(payment.amount, 28.5)
  assert.equal(payment.date, '2026-07-10 12:03:22')
  assert.equal(payment.orderId, '4200002345202607101234567890')
})

test('Alipay bill detail screenshot', () => {
  const payment = parsePayment(loadFixture('alipay'))
  assert.ok(payment)
  assert.equal(payment.platform, 'alipay')
  assert.equal(payment.merchant, '滴滴出行')
  assert.equal(payment.description, '滴滴出行-快车')
  assert.equal(payment.amount, 15.6)
  assert.equal(payment.date, '2026-07-08 09:15:30')
  assert.equal(payment.orderId, '2026070822001412341234567890')
  assert.equal(payment.hintCategory, 'Transport')
})

test('English-locale WeChat merchant bill', () => {
  const payment = parsePayment(loadFixture('wechat-en-merchant'))
  assert.ok(payment)
  assert.equal(payment.platform, 'wechat')
  assert.equal(payment.merchant, '卖菜小摊')
  assert.equal(payment.description, '江苏省南京市卖菜小摊扫码收款')
  assert.equal(payment.amount, 8.2)
  assert.equal(payment.date, '2026-09-05 07:58:56')
  assert.equal(payment.orderId, '4500000367202609051111222233')
})

test('English-locale WeChat QR payment to a person', () => {
  const payment = parsePayment(loadFixture('wechat-en-qr-transfer'))
  assert.ok(payment)
  assert.equal(payment.platform, 'wechat')
  assert.equal(payment.merchant, '扫二维码付款-给王小明')
  assert.equal(payment.amount, 5)
  assert.equal(payment.date, '2026-09-05 07:54:49')
  // The order number wraps onto a second OCR line and is glued back together.
  assert.equal(payment.orderId, '10001073012026090500001111222233')
})

test('English-locale WeChat transfer uses Transfer Time, not Received Time', () => {
  const payment = parsePayment(loadFixture('wechat-en-transfer'))
  assert.ok(payment)
  assert.equal(payment.platform, 'wechat')
  assert.equal(payment.merchant, '转账-转给城郊葡萄园')
  assert.equal(payment.amount, 60)
  assert.equal(payment.date, '2026-08-27 21:37:32')
})

test('English-locale WeChat bill with a refund barcode below the rows', () => {
  const payment = parsePayment(loadFixture('wechat-en-barcode'))
  assert.ok(payment)
  assert.equal(payment.platform, 'wechat')
  assert.equal(payment.merchant, '惠民生鲜超市')
  assert.equal(payment.amount, 4.5)
  assert.equal(payment.date, '2026-09-02 16:34:38')
  // The barcode digits under the rows must not be mistaken for the order id.
  assert.equal(payment.orderId, '4200003226202609020000111122')
})

test('an English Alipay bill is not claimed by the WeChat parser', () => {
  const payment = parsePayment(loadFixture('alipay-en'))
  assert.notEqual(payment?.platform, 'wechat')
})

test('real JD OCR: 实付款 total wins over the per-item 到手 price', () => {
  const payment = parsePayment(loadFixture('jd-real'))
  assert.ok(payment)
  // The value column sits ten lines below 实付款; 到手¥88 must not win.
  assert.equal(payment.amount, 93)
  assert.equal(payment.date, '2026-07-09 17:56:58')
})

test('real PDD OCR: 下单时间 wins over the later 拼单时间', () => {
  const payment = parsePayment(loadFixture('pdd-real'))
  assert.ok(payment)
  assert.equal(payment.amount, 17.9)
  assert.equal(payment.date, '2026-06-21 06:59:08')
})

test('a PDD order paid via WeChat is still detected as PDD', () => {
  // The fixture contains 支付方式 微信支付 — the stronger PDD signals must win.
  const payment = parsePayment(loadFixture('pdd'))
  assert.ok(payment)
  assert.equal(payment.platform, 'pdd')
})

test('unrelated text is rejected', () => {
  assert.equal(parsePayment('今天天气不错，去公园散步，晚上看了一部电影。'), null)
  assert.equal(parsePayment(''), null)
})
