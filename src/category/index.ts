import type { CategoryKey, ParsedPayment, Platform } from '../types.ts'
import { CATEGORY_KEYWORDS, FALLBACK_CATEGORY, PLATFORM_FALLBACK_CATEGORIES } from './keywords.ts'

export function categorize(payment: ParsedPayment, platform?: Platform): CategoryKey {
  const haystack = [payment.description, payment.merchant]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some(keyword => haystack.includes(keyword))) return category
  }
  return payment.hintCategory
    ?? (platform && PLATFORM_FALLBACK_CATEGORIES[platform])
    ?? FALLBACK_CATEGORY
}
