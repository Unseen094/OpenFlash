import type { PublishedGame } from './types'

const STORAGE_KEY = 'openflash_published_games'

function loadAll(): PublishedGame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAll(games: PublishedGame[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

export function listPublishedGames(): PublishedGame[] {
  return loadAll().sort((a, b) => b.publishedAt - a.publishedAt)
}

export function listPublishedGamesByCreator(creatorId: string): PublishedGame[] {
  return loadAll().filter(g => g.creatorId === creatorId).sort((a, b) => b.publishedAt - a.publishedAt)
}

export function getPublishedGame(id: string): PublishedGame | null {
  return loadAll().find(g => g.id === id) ?? null
}

export interface CreateGameInput {
  projectId: string
  title: string
  description: string
  creatorId: string
  creatorName: string
  priceUsd: number
  adsEnabled: boolean
  plan: PublishedGame['plan']
  thumbnail?: string
}

export function publishGame(input: CreateGameInput): PublishedGame {
  const game: PublishedGame = {
    id: `game_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    priceUsd: input.priceUsd,
    adsEnabled: input.adsEnabled,
    plan: input.plan,
    publishedAt: Date.now(),
    plays: 0,
    downloads: 0,
    revenueUsd: 0,
    thumbnail: input.thumbnail || ''
  }
  const all = loadAll()
  all.push(game)
  saveAll(all)
  return game
}

export function updateGame(id: string, patch: Partial<PublishedGame>): PublishedGame | null {
  const all = loadAll()
  const idx = all.findIndex(g => g.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch }
  saveAll(all)
  return all[idx]
}

export function deleteGame(id: string): void {
  saveAll(loadAll().filter(g => g.id !== id))
}

/** Increment play count + ad revenue. */
export function recordPlay(id: string, adRevenueUsd: number): void {
  const g = getPublishedGame(id)
  if (!g) return
  updateGame(id, {
    plays: g.plays + 1,
    revenueUsd: Math.round((g.revenueUsd + adRevenueUsd) * 100) / 100
  })
}

/** Increment download count + download revenue. */
export function recordDownload(id: string, downloadRevenueUsd: number): void {
  const g = getPublishedGame(id)
  if (!g) return
  updateGame(id, {
    downloads: g.downloads + 1,
    revenueUsd: Math.round((g.revenueUsd + downloadRevenueUsd) * 100) / 100
  })
}
