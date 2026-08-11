export interface StorageProvider {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  subscribe?(key: string, callback: (value: unknown) => void): () => void
}

export class LocalStorageProvider implements StorageProvider {
  get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key)
    if (raw === null) return Promise.resolve(null)
    try {
      return Promise.resolve(JSON.parse(raw) as T)
    } catch {
      return Promise.resolve(null)
    }
  }

  set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value))
    return Promise.resolve()
  }

  remove(key: string): Promise<void> {
    localStorage.removeItem(key)
    return Promise.resolve()
  }

  subscribe(key: string, callback: (value: unknown) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          callback(JSON.parse(e.newValue))
        } catch {
          callback(null)
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }
}

export class FirestoreProvider implements StorageProvider {
  constructor(_config: { projectId: string; collection?: string }) {
    throw new Error('FirestoreProvider is not implemented. Please use LocalStorageProvider.')
  }

  get<T>(_key: string): Promise<T | null> {
    throw new Error('FirestoreProvider is not implemented.')
  }

  set<T>(_key: string, _value: T): Promise<void> {
    throw new Error('FirestoreProvider is not implemented.')
  }

  remove(_key: string): Promise<void> {
    throw new Error('FirestoreProvider is not implemented.')
  }
}

let currentProvider: StorageProvider = new LocalStorageProvider()

export function getStorageProvider(): StorageProvider {
  return currentProvider
}

export function setStorageProvider(provider: StorageProvider): void {
  currentProvider = provider
}
