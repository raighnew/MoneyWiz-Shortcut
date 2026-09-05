import type { CategoryKey, Platform } from './types.ts'

export interface Config {
  currency: string
  save: boolean
  accounts: { default: string } & Partial<Record<Platform, string>>
  categoryNames: Record<CategoryKey, string>
}

// User configuration — edit here, rebuild with `npm run build`, or edit the
// same values in the config module at the top of dist/MoneyWiz.js directly
// inside the Scriptable editor.
export const config: Config = {
  currency: 'CNY',

  // true  = MoneyWiz saves the transaction silently.
  // false = MoneyWiz opens its New Expense screen prefilled — review/correct
  //         anything the OCR got wrong, then tap Save there.
  save: false,

  // MoneyWiz account name per payment platform. Must match your MoneyWiz
  // account names exactly (spaces are stripped automatically — the URL
  // scheme requires account names without spaces).
  accounts: {
    default: 'Cash',
    jd: 'WeChat',
    taobao: 'Alipay',
    pdd: 'WeChat',
    wechat: 'WeChat',
    alipay: 'Alipay'
  },

  // Maps internal category keys to your MoneyWiz category names — these must
  // exist in MoneyWiz with EXACTLY these names. Use "Parent/Child" for
  // subcategories per the URL scheme (e.g. 'Dining Out/Coffee'); a literal
  // slash INSIDE a category name (like "Gas/Fuel") cannot be addressed —
  // rename such categories in MoneyWiz (e.g. "Gas & Fuel").
  categoryNames: {
    Baby: 'Baby',
    Pet: 'Pet',
    Coffee: 'Coffee',
    GasFuel: 'Gas & Fuel',
    Transport: 'Transport',
    Groceries: 'Groceries',
    DiningOut: 'Dining Out',
    Shopping: 'Shopping'
  }
}
