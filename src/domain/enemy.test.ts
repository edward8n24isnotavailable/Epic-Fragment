import { describe, expect, it } from 'vitest'
import { applyEnemyHit, enemyAttackName, initialEnemy, stepEnemy } from './enemy'
import { profileForEncounter } from '../game/enemyProfiles'

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

  it('telegraphs a distinct long range inquisitor attack and rotates through moves', () => {
    const profile = profileForEncounter('inquisitor', 400)
    let enemy = initialEnemy(4, 200)
    enemy = stepEnemy(enemy, 1.5, 0, 1 / 60, 0, profile).enemy
    enemy = stepEnemy(enemy, 1.5, 0, 1 / 60, 0, profile).enemy
    expect(enemyAttackName(enemy, profile)).toBe('审讯鞭横扫')
    for (let frame = 0; frame < 80; frame += 1) enemy = stepEnemy(enemy, 1.5, 0, 1 / 60, 0, profile).enemy
    expect(enemy.attackIndex).toBe(1)
    expect(profile.attacks[1].name).toBe('烙铁投掷')
    expect(profileForEncounter('inquisitor', 180).attacks.at(-1)?.name).toBe('暴怒连击')
  })

  it('keeps ground shockwave below an airborne player', () => {
    const profile = { detectRange: 5, chaseSpeed: 1, attacks: [
      { name: '地震', range: 3, damage: 50, windup: 0.1, active: 0.2,
        recovery: 0.4, verticalRange: 1.3, groundOnly: true, allAround: true },
    ] }
    let enemy = initialEnemy(4)
    let hits = 0
    for (let frame = 0; frame < 30; frame += 1) {
      const result = stepEnemy(enemy, 2.5, 0.8, 1 / 60, 0, profile)
      enemy = result.enemy
      hits += result.playerDamage
    }
    expect(hits).toBe(0)
  })

  it('emits a ranged projectile once and leaves damage to the projectile collision', () => {
    const profile = { detectRange: 8, chaseSpeed: 1, attacks: [
      { name: '烙铁投掷', range: 7, damage: 31, windup: 0.1,
        active: 0.2, recovery: 0.3, projectileSpeed: 9 },
    ] }
    let enemy = initialEnemy(4)
    const projectiles = []
    let directDamage = 0
    for (let frame = 0; frame < 25; frame += 1) {
      const result = stepEnemy(enemy, 0, 0, 1 / 60, 0, profile)
      enemy = result.enemy
      if (result.projectile) projectiles.push(result.projectile)
      directDamage += result.playerDamage
    }
    expect(projectiles).toEqual([{ name: '烙铁投掷', damage: 31, speed: 9 }])
    expect(directDamage).toBe(0)
  })
})
