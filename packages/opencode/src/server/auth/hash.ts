import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const SALT_LENGTH = 32
const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex")
  const derivedKey = scryptSync(password, salt, KEY_LENGTH)
  return `${salt}:${derivedKey.toString("hex")}`
}

export function verifyPassword(password: string, hashed: string): boolean {
  const [salt, key] = hashed.split(":")
  const derivedKey = scryptSync(password, salt, KEY_LENGTH)
  return timingSafeEqual(Buffer.from(derivedKey), Buffer.from(key, "hex"))
}
