import { z } from 'zod'
import { createRepository, Result } from '../storage/repository'
import type { PublishedGame } from './types'
import { getServerGames, recordServerDownload as apiRecordDownload, recordServerPlay as apiRecordPlay } from './api'

const STORAGE_KEY = 'openflash_published_games'

const PlanIdSchema = z.enum(['beta', 'sigma', 'alpha'])

const PublishedGameSchema: z.ZodType<PublishedGame> = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().max(200),
  description: z.string().max(5000),
  creatorId: z.string(),
  creatorName: z.string().max(100),
  priceUsd: z.number().nonnegative(),
  adsEnabled: z.boolean(),
  plan: PlanIdSchema,
  publishedAt: z.number(),
  plays: z.number().nonnegative(),
  downloads: z.number().nonnegative(),
  revenueUsd: z.number().nonnegative(),
  thumbnail: z.string()
})

const GamesArraySchema = z.array(PublishedGameSchema)

const gamesRepo = createRepository<PublishedGame[]>(STORAGE_KEY, GamesArraySchema)

function loadAll(): PublishedGame[] {
  return gamesRepo.readOrDefault([])
}

function saveAll(games: PublishedGame[]): Result<void> {
  return gamesRepo.write(games)
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

export function recordPlay(id: string, adRevenueUsd: number): void {
  const g = getPublishedGame(id)
  if (!g) return
  updateGame(id, {
    plays: g.plays + 1,
    revenueUsd: Math.round((g.revenueUsd + adRevenueUsd) * 100) / 100
  })
}

export function recordDownload(id: string, downloadRevenueUsd: number): void {
  const g = getPublishedGame(id)
  if (!g) return
  updateGame(id, {
    downloads: g.downloads + 1,
    revenueUsd: Math.round((g.revenueUsd + downloadRevenueUsd) * 100) / 100
  })
}

// ─── Server-side games (Phase 8) ──────────────────────────────────────────────

const USE_SERVER = !!import.meta.env.VITE_API_BASE_URL

/**
 * Refresh the local published-games list from the server API.
 * Falls back to local storage if no API is configured.
 */
export async function syncServerGames(creatorId?: string): Promise<PublishedGame[]> {
  if (!USE_SERVER) {
    return creatorId ? listPublishedGamesByCreator(creatorId) : listPublishedGames()
  }
  try {
    const items = await getServerGames(creatorId)
    const games: PublishedGame[] = items.map(g => ({
      id: g.id,
      projectId: g.projectId,
      title: g.title,
      description: g.description,
      creatorId: g.creatorId,
      creatorName: g.creatorName,
      priceUsd: g.priceUsd,
      adsEnabled: g.adsEnabled,
      plan: g.plan as PublishedGame['plan'],
      publishedAt: g.publishedAt,
      plays: g.plays,
      downloads: g.downloads,
      revenueUsd: g.revenueUsd,
      thumbnail: g.thumbnail
    }))
    pushGames(games)
    return games
  } catch {
    return creatorId ? listPublishedGamesByCreator(creatorId) : listPublishedGames()
  }
}

function pushGames(games: PublishedGame[]): void {
  const known = new Set(games.map(g => g.id))
  const merged = [...games, ...loadAll().filter(g => !known.has(g.id))]
  saveAll(merged)
}

/**
 * Record a play via the server API (idempotent per session).
 * Falls back to local recordPlay if no API is configured.
 */
export async function recordServerPlay(id: string, adRevenueUsd: number): Promise<void> {
  if (!USE_SERVER) {
    recordPlay(id, adRevenueUsd)
    return
  }
  try {
    await apiRecordPlay(id, 'system', sessionIdFor(id), adRevenueUsd)
    const g = getPublishedGame(id)
    if (g) updateGame(id, { plays: g.plays + 1 })
  } catch {
    recordPlay(id, adRevenueUsd)
  }
}

/**
 * Record a download via the server API (idempotent per session).
 * Falls back to local recordDownload if no API is configured.
 */
export async function recordServerDownload(id: string, downloadRevenueUsd: number): Promise<void> {
  if (!USE_SERVER) {
    recordDownload(id, downloadRevenueUsd)
    return
  }
  try {
    await apiRecordDownload(id, 'system', sessionIdFor(id), downloadRevenueUsd)
    const g = getPublishedGame(id)
    if (g) updateGame(id, { downloads: g.downloads + 1 })
  } catch {
    recordDownload(id, downloadRevenueUsd)
  }
}

const activeSessions = new Map<string, string>()

function sessionIdFor(gameId: string): string {
  let id = activeSessions.get(gameId)
  if (!id) {
    id = `${gameId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`
    activeSessions.set(gameId, id)
  }
  return id
}

export function clearSession(gameId: string): void {
  activeSessions.delete(gameId)
}
