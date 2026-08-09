import { z } from 'zod'
import { createRepository } from '../storage/repository'

export interface ScoreEntry {
  player: string
  score: number
  at: number
}

export interface GameLeaderboard {
  gameId: string
  entries: ScoreEntry[]
}

export const ScoreEntrySchema = z.object({
  player: z.string().max(40),
  score: z.number().finite(),
  at: z.number()
})

export const LeaderboardSchema: z.ZodType<GameLeaderboard> = z.object({
  gameId: z.string(),
  entries: z.array(ScoreEntrySchema)
})

const INDEX_KEY = 'openflash_leaderboards_index'
const KEY_PREFIX = 'openflash_leaderboard_'

const indexRepo = createRepository<string[]>(INDEX_KEY, z.array(z.string()))

function loadIndex(): string[] {
  return indexRepo.readOrDefault([])
}

function saveIndex(ids: string[]): void {
  indexRepo.write(ids)
}

function boardRepo(gameId: string) {
  return createRepository<GameLeaderboard>(KEY_PREFIX + gameId, LeaderboardSchema)
}

export function getLeaderboard(gameId: string): ScoreEntry[] {
  return boardRepo(gameId).readOrDefault({ gameId, entries: [] }).entries
}

export function postScore(gameId: string, player: string, score: number): ScoreEntry[] {
  if (!Number.isFinite(score)) return getLeaderboard(gameId)

  const cleanPlayer = (player || 'anonymous').slice(0, 40)
  const entry: ScoreEntry = { player: cleanPlayer, score, at: Date.now() }

  const list = [...getLeaderboard(gameId), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const index = loadIndex()
  if (!index.includes(gameId)) {
    index.push(gameId)
    saveIndex(index)
  }
  boardRepo(gameId).write({ gameId, entries: list })
  return list
}

export function clearLeaderboard(gameId: string): void {
  boardRepo(gameId).clear()
}

export function listLeaderboards(): GameLeaderboard[] {
  return loadIndex()
    .map(id => boardRepo(id).readOrDefault({ gameId: id, entries: [] }))
    .filter(b => b.entries.length > 0)
}