import { describe, expect, it } from 'vitest'
import { applyEnemyHit, initialEnemy, stepEnemy } from './enemy'
import { applyPoiseDamage, attackPoiseDamage, consumeExecution, increaseMaxPoise, initialPoise, poiseRules, stepPoise } from './poise'

describe('GDD poise', () => {
  it('uses the specified poise damage for each attack', () => {
    expect(attackPoiseDamage('light', false)).toBe(8)
    expect(attackPoiseDamage('heavy', false)).toBe(20)
    expect(attackPoiseDamage('heavy', true)).toBe(15)
    expect(poiseRules.parry).toBe(25)
    expect(poiseRules.shieldBash).toBe(12)
    expect(attackPoiseDamage('shieldBash', false)).toBe(12)
  })

  it('waits five seconds after a hit, then restores ten poise per second', () => {
    let poise = applyPoiseDamage(initialPoise(50), 8).state
    for (let frame = 0; frame < 300; frame += 1) poise = stepPoise(poise, 1 / 60)
    expect(poise.current).toBeCloseTo(42)
    for (let frame = 0; frame < 60; frame += 1) poise = stepPoise(poise, 1 / 60)
    expect(poise.current).toBeCloseTo(50)
  })

  it('breaks at zero, prevents attacks for three seconds, then restores poise', () => {
    let enemy = initialEnemy(4, 50)
    enemy = applyEnemyHit(enemy, 80, 25)
    expect(enemy.poise.current).toBe(25)
    expect(enemy.mode).toBe('patrol')
    enemy = applyEnemyHit(enemy, 80, 25)
    expect(enemy.poise.current).toBe(0)
    expect(enemy.poise.exhaustedRemaining).toBe(3)
    expect(enemy.poise.executionAvailable).toBe(true)
    expect(enemy.mode).toBe('hit')
    enemy = { ...enemy, poise: consumeExecution(enemy.poise) }
    expect(enemy.poise.executionAvailable).toBe(false)
    for (let frame = 0; frame < 120; frame += 1) {
      const step = stepEnemy(enemy, 2.8, 0, 1 / 60)
      enemy = step.enemy
      expect(step.playerDamage).toBe(0)
      expect(enemy.mode).toBe('hit')
    }
    expect(applyPoiseDamage(enemy.poise, 20).state).toEqual(enemy.poise)
    for (let frame = 0; frame < 61; frame += 1) enemy = stepEnemy(enemy, 2.8, 0, 1 / 60).enemy
    expect(enemy.poise.current).toBe(50)
    expect(enemy.poise.exhaustedRemaining).toBe(0)
    expect(enemy.mode).not.toBe('hit')
  })

  it('raises the warden phase two cap without clearing exhaustion', () => {
    expect(increaseMaxPoise(applyPoiseDamage(initialPoise(350), 50).state, 450))
      .toMatchObject({ current: 400, max: 450 })
    expect(increaseMaxPoise(applyPoiseDamage(initialPoise(350), 350).state, 450))
      .toMatchObject({ current: 0, max: 450, exhaustedRemaining: 3 })
  })
})
