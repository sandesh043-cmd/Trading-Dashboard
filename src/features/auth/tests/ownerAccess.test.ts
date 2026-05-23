import { describe, expect, it } from 'vitest'
import { isOwnerEmail } from '../utils/ownerAccess'

describe('isOwnerEmail', () => {
  it('allows the configured owner email case-insensitively', () => {
    expect(isOwnerEmail('Sandesh043@gmail.com')).toBe(true)
  })

  it('rejects any other email', () => {
    expect(isOwnerEmail('other@example.com')).toBe(false)
  })
})
