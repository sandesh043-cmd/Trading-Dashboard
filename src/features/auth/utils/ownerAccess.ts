export const OWNER_EMAIL = 'sandesh043@gmail.com'

export function isOwnerEmail(email: string) {
  return email.trim().toLowerCase() === OWNER_EMAIL
}
