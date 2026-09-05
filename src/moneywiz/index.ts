// MoneyWiz URL scheme, see
// https://help.wiz.money/en/articles/4525440-automate-transaction-management-with-url-schemas
export interface ExpenseRequest {
  amount: number
  account: string
  currency?: string
  payee?: string | null
  /** Hierarchy with slashes, e.g. 'Shopping/Online'. */
  category?: string | null
  description?: string | null
  memo?: string | null
  /** 'yyyy-MM-dd HH:mm:ss' */
  date?: string | null
  save?: boolean
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
  if (expense.category) {
    // Slashes separate the category hierarchy and must survive encoding.
    params.push(`category=${expense.category.split('/').map(encodeURIComponent).join('/')}`)
  }
  add('description', expense.description)
  add('memo', expense.memo)
  add('date', expense.date)
  params.push(`save=${expense.save ? 'true' : 'false'}`)

  return `moneywiz://expense?${params.join('&')}`
}
