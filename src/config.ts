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

  // Maps internal category keys to your MoneyWiz categories — these must
  // exist in MoneyWiz with EXACTLY these names. Use "Parent/Child" for
  // subcategories per the URL scheme. A literal slash INSIDE a category name
  // (like "Gas/Fuel") cannot be addressed — MoneyWiz does not decode %2F —
  // so either rename that category in MoneyWiz or map to its parent and pick
  // the subcategory by hand on the review screen (save=false).
  categoryNames: {
    Baby: 'Shopping/Baby',
    Pet: 'Shopping/Pets',
    Coffee: 'Food & Dining/Coffee',
    GasFuel: 'Transportation/GasFuel',
    Transport: 'Transportation/Public Transportation',
    Groceries: 'Shopping/Groceries',
    DiningOut: 'Food & Dining/Dining Out',
    Shopping: 'Shopping'
  }
}
