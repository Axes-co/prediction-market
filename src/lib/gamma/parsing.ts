export function trimToString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function booleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }
  return false
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseJsonStringArray(value: unknown): string[] | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return null
    }
    return parsed.map(item => String(item))
  }
  catch {
    return null
  }
}

const HEX32_PATTERN = /^0x[0-9a-f]{64}$/i
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/i

export function isHex32(value: unknown): value is string {
  return typeof value === 'string' && HEX32_PATTERN.test(value.trim())
}

export function normalizeHex32(value: unknown): string | null {
  return isHex32(value) ? value.trim().toLowerCase() : null
}

export function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return ADDRESS_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null
}

export function decimalString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString()
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) {
      return parsed.toString()
    }
  }
  return '0'
}

/**
 * Same as `decimalString` but returns null instead of '0' when the input is
 * missing or unparseable. Use for nullable numeric columns where we need to
 * distinguish "Gamma didn't tell us" from "value is zero".
 */
export function decimalStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString()
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed.toString()
    }
  }
  return null
}

/**
 * Boolean parser that returns null when the value is absent. Use for nullable
 * boolean columns where we need to preserve "Gamma didn't tell us" semantics.
 */
export function booleanFlagOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'true') {
      return true
    }
    if (trimmed === 'false') {
      return false
    }
  }
  return null
}
