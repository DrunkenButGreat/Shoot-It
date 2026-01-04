import { customAlphabet } from 'nanoid'
import { appConfig } from '@/config/app.config'

const nanoid = customAlphabet(
  appConfig.shortcode.charset,
  appConfig.shortcode.length
)

export function generateShortCode(): string {
  return nanoid()
}

export function isValidShortCode(code: string): boolean {
  if (code.length !== appConfig.shortcode.length) {
    return false
  }
  
  const validChars = new Set(appConfig.shortcode.charset)
  return code.split('').every(char => validChars.has(char))
}
