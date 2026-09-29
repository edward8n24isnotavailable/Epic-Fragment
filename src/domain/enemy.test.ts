import { describe, expect, it } from 'vitest'
import { applyEnemyHit, initialEnemy, stepEnemy } from './enemy'

describe('enemy state machine', () => {
  it('detects, approaches, telegraphs, and hits once per attack', () => {
    let enemy = initialEnemy()
    let hits = 0
    for (let frame = 0; frame < 180; frame += 1) {
      const result = stepEnemy(enemy, 2.5, 0, 1 / 60)
      enemy = result.enemy
      hits += result.playerDamage > 0 ? 1 : 0
      if (hits > 0) break
    }
    expect(hits).toBe(1)
    expect(enemy.mode).toBe('active')
    for (let frame = 0; frame < 8; frame += 1) {
      const result = stepEnemy(enemy, 2.5, 0, 1 / 60)
      enemy = result.enemy
      expect(result.playerDamage).toBe(0)
    }
  })

  it('stops attacking after death', () => {
    const dead = applyEnemyHit(initialEnemy(), 0)
    expect(stepEnemy(dead, 4, 0, 1 / 60).playerDamage).toBe(0)
    expect(dead.mode).toBe('dead')
  })
})
