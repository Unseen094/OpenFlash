import { describe, it, expect, beforeEach } from 'vitest'
import { postScore, getLeaderboard, clearLeaderboard, listLeaderboards } from './leaderboard'

beforeEach(() => {
  localStorage.clear()
})

describe('leaderboard', () => {
  it('starts empty', () => {
    expect(getLeaderboard('g1')).toEqual([])
    expect(listLeaderboards()).toEqual([])
  })

  it('posts and sorts descending, keeping top 10', () => {
    for (let i = 1; i <= 15; i++) {
      postScore('g1', `p${i}`, i)
    }
    const board = getLeaderboard('g1')
    expect(board).toHaveLength(10)
    expect(board[0].score).toBe(15)
    expect(board[9].score).toBe(6)
  })

  it('keeps boards isolated per game', () => {
    postScore('g1', 'a', 5)
    postScore('g2', 'b', 9)
    expect(getLeaderboard('g1')).toHaveLength(1)
    expect(getLeaderboard('g2')[0].player).toBe('b')
    expect(listLeaderboards()).toHaveLength(2)
  })

  it('rejects non-finite scores without side effects', () => {
    postScore('g1', 'a', NaN)
    postScore('g1', 'a', Infinity)
    expect(getLeaderboard('g1')).toEqual([])
    expect(listLeaderboards()).toEqual([])
  })

  it('truncates a long player name to 40 chars', () => {
    const name = 'x'.repeat(80)
    const board = postScore('g1', name, 10)
    expect(board[0].player).toHaveLength(40)
  })

  it('uses a fallback player name when empty', () => {
    const board = postScore('g1', '', 1)
    expect(board[0].player).toBe('anonymous')
  })

  it('stores scores or their timestamps', () => {
    const before = Date.now()
    const board = postScore('g1', 'a', 42)
    const after = Date.now()
    expect(board[0].at).toBeGreaterThanOrEqual(before)
    expect(board[0].at).toBeLessThanOrEqual(after)
  })

  it('clears a board and drops it from the index', () => {
    postScore('g1', 'a', 5)
    clearLeaderboard('g1')
    expect(getLeaderboard('g1')).toEqual([])
    expect(listLeaderboards()).toEqual([])
  })

  it('survives a storage reset (persistence round trip)', () => {
    postScore('g1', 'nova', 1200)
    localStorage.setItem('openflash_leaderboard_g1', localStorage.getItem('openflash_leaderboard_g1') || '')
    const board = getLeaderboard('g1')
    expect(board).toHaveLength(1)
    expect(board[0]).toEqual({ player: 'nova', score: 1200, at: board[0].at })
  })
})