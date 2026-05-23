import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../utils/formatCurrency'

describe('formatCurrency', () => {
  it('rounds financial amounts and includes thousands separators', () => {
    expect(formatCurrency(6426.6)).toBe('$6,427')
  })
})
