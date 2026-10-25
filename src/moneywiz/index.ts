// MoneyWiz URL scheme, see
// https://help.wiz.money/en/articles/4525440-automate-transaction-management-with-url-schemas
export interface ExpenseRequest {
  amount: number
  account: string
  currency?: string
  payee?: string | null
  /** Hierarchy with slashes, e.g. 'Shopping/Baby'. */
  category?: string | null
  description?: string | null
  memo?: string | null
  /** 'yyyy-MM-dd HH:mm:ss' */
  date?: string | null
  save?: boolean
}

// Slashes separating the hierarchy must survive encoding. MoneyWiz does NOT
// decode %2F back into a name (verified on-device), so a category whose own
// name contains a slash cannot be addressed at all — see config.categoryNames.
export function encodeCategoryParam(category: string): string {
  return category.split('/').map(encodeURIComponent).join('/')
}

export function buildExpenseUrl(expense: ExpenseRequest): string {
  const params: string[] = []
  const add = (key: string, value: string | null | undefined) => {
    if (value) params.push(`${key}=${encodeURIComponent(value)}`)
  }

  add('amount', Math.abs(expense.amount).toFixed(2))
  // The scheme requires account names without spaces.
  add('account', expense.account.replace(/\s+/g, ''))
  add('currency', expense.currency)
  add('payee', expense.payee)
  if (expense.category) params.push(`category=${encodeCategoryParam(expense.category)}`)
  add('description', expense.description)
  add('memo', expense.memo)
  add('date', expense.date)
  params.push(`save=${expense.save ? 'true' : 'false'}`)

  return `moneywiz://expense?${params.join('&')}`
}
