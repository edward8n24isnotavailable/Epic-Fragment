import { describe, expect, it } from 'vitest'
import { damagePlayer, initialCombat, stepCombat } from './combat'

describe('playground combat', () => {
  it('only hits during the active window and once per swing', () => {
    let state = initialCombat()
    state = stepCombat(state, true, 2.5, 0, 1, 4, 1 / 60)
    expect(state.enemy.health).toBe(80)
    for (let index = 0; index < 20; index += 1) {
      state = stepCombat(state, false, 2.5, 0, 1, 4, 1 / 60)
    }
    expect(state.enemy.health).toBe(55)
  })

  it('does not hit behind the player or when out of reach', () => {
    let state = initialCombat()
    for (let index = 0; index < 20; index += 1) {
      state = stepCombat(state, index === 0, 2.5, 0, -1, 4, 1 / 60)
    }
    expect(state.enemy.health).toBe(80)
  })

  it('uses stamina and can defeat the enemy', () => {
    let state = initialCombat()
    for (let swing = 0; swing < 4; swing += 1) {
      for (let frame = 0; frame < 40; frame += 1) {
        state = stepCombat(state, frame === 0, 2.5, 0, 1, 4, 1 / 60)
      }
    }
    expect(state.enemy.health).toBe(0)
    expect(state.player.stamina).toBeLessThan(state.player.maxStamina)
  })

  it('clamps lethal player damage at zero health', () => {
    const state = damagePlayer(initialCombat(), 400)
    expect(state.player.health).toBe(0)
  })

  it('uses the GDD base health and drains stamina while sprinting', () => {
    let state = initialCombat()
    expect(state.player.health).toBe(350)
    for (let frame = 0; frame < 60; frame += 1) {
      state = stepCombat(state, false, 0, 0, 1, 10, 1 / 60, true)
    }
    expect(state.player.stamina).toBeCloseTo(80, 1)
  })

  it('hits an enemy on the raised middle corridor floor', () => {
    let state = initialCombat()
    for (let frame = 0; frame < 20; frame += 1) {
      state = stepCombat(state, frame === 0, -32, 2.5, 1, -30.5, 1 / 60, false, 2.5)
    }
    expect(state.enemy.health).toBe(55)
  })
})
