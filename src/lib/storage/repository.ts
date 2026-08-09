import { z } from 'zod'
import { getStorageProvider } from './StorageProvider'

export type StorageError =
  | { type: 'parse'; message: string }
  | { type: 'quota'; message: string }
  | { type: 'validation'; message: string; issues: z.ZodIssue[] }

export type Result<T> = { ok: true; value: T } | { ok: false; error: StorageError }

export interface Repository<T> {
  read(): Result<T>
  readOrDefault(defaultValue: T): T
  write(value: T): Result<void>
  clear(): void
}

export function createRepository<T>(key: string, schema: z.ZodType<T>): Repository<T> {
  return {
    read(): Result<T> {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return { ok: false, error: { type: 'parse', message: 'No data' } }
        const parsed = JSON.parse(raw)
        const result = schema.safeParse(parsed)
        if (!result.success) return { ok: false, error: { type: 'validation', message: 'Schema mismatch', issues: result.error.issues } }
        return { ok: true, value: result.data }
      } catch (e) {
        return { ok: false, error: { type: 'parse', message: String(e) } }
      }
    },
    readOrDefault(defaultValue: T): T {
      const result = this.read()
      return result.ok ? result.value : defaultValue
    },
    write(value: T): Result<void> {
      try {
        const validated = schema.parse(value)
        localStorage.setItem(key, JSON.stringify(validated))
        return { ok: true, value: undefined }
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
          return { ok: false, error: { type: 'quota', message: 'Storage quota exceeded. Please delete some projects or data.' } }
        }
        if (e instanceof z.ZodError) {
          return { ok: false, error: { type: 'validation', message: 'Data validation failed', issues: e.issues } }
        }
        return { ok: false, error: { type: 'quota', message: String(e) } }
      }
    },
    clear(): void {
      localStorage.removeItem(key)
    }
  }
}

export interface AsyncRepository<T> {
  read(): Promise<Result<T>>
  readOrDefault(defaultValue: T): Promise<T>
  write(value: T): Promise<Result<void>>
  clear(): Promise<void>
}

export function createAsyncRepository<T>(key: string, schema: z.ZodType<T>): AsyncRepository<T> {
  const provider = getStorageProvider()
  return {
    async read(): Promise<Result<T>> {
      try {
        const value = await provider.get<unknown>(key)
        if (value === null) return { ok: false, error: { type: 'parse', message: 'No data' } }
        const result = schema.safeParse(value)
        if (!result.success) return { ok: false, error: { type: 'validation', message: 'Schema mismatch', issues: result.error.issues } }
        return { ok: true, value: result.data }
      } catch (e) {
        return { ok: false, error: { type: 'parse', message: String(e) } }
      }
    },
    async readOrDefault(defaultValue: T): Promise<T> {
      const result = await this.read()
      return result.ok ? result.value : defaultValue
    },
    async write(value: T): Promise<Result<void>> {
      try {
        const validated = schema.parse(value)
        await provider.set(key, validated)
        return { ok: true, value: undefined }
      } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
          return { ok: false, error: { type: 'quota', message: 'Storage quota exceeded. Please delete some projects or data.' } }
        }
        if (e instanceof z.ZodError) {
          return { ok: false, error: { type: 'validation', message: 'Data validation failed', issues: e.issues } }
        }
        return { ok: false, error: { type: 'quota', message: String(e) } }
      }
    },
    async clear(): Promise<void> {
      await provider.remove(key)
    }
  }
}

export function formatStorageError(error: StorageError): string {
  switch (error.type) {
    case 'parse':
      return `Failed to read data: ${error.message}`
    case 'quota':
      return `Storage full: ${error.message}`
    case 'validation':
      return `Data corrupted: ${error.message}`
  }
}
