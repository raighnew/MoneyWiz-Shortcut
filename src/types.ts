export type Platform = 'jd' | 'taobao' | 'pdd' | 'wechat' | 'alipay'

export type CategoryKey =
  | 'Baby'
  | 'Pet'
  | 'Coffee'
  | 'GasFuel'
  | 'Transport'
  | 'Groceries'
  | 'DiningOut'
  | 'Shopping'

export interface ParsedPayment {
  merchant: string | null
  description: string | null
  amount: number | null
  /** 'yyyy-MM-dd HH:mm:ss', the format the MoneyWiz URL scheme expects. */
  date: string | null
  orderId: string | null
  /** Category suggested by the platform itself (e.g. Alipay's 账单分类 row). */
  hintCategory?: CategoryKey
}

export interface PaymentParser {
  platform: Platform
  label: string
  score(text: string): number
  parse(lines: string[]): ParsedPayment
}

export interface DetectedPayment extends ParsedPayment {
  platform: Platform
  platformLabel: string
}
