import { describe, expect, it } from 'vitest'
import { addFlaskCapacity, castSpell, damagePlayer, initialCombat, refillAtCheckpoint, resolveIncomingHit, setMaxFp, stepCombat, stepDefense, useDaggerStep, useFlask } from './combat'

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

  it('makes a heavy attack slower and stronger while charging 24 stamina', () => {
    let heavy = stepCombat(initialCombat(), false, 2.5, 0, 1, 4, 1 / 60, false, 0, true)
    expect(heavy.attack.kind).toBe('heavy')
    expect(heavy.player.stamina).toBe(66)
    for (let frame = 0; frame < 10; frame += 1) heavy = stepCombat(heavy, false, 2.5, 0, 1, 4, 1 / 60)
    expect(heavy.enemy.health).toBe(80)
    for (let frame = 0; frame < 15; frame += 1) heavy = stepCombat(heavy, false, 2.5, 0, 1, 4, 1 / 60)
    expect(heavy.enemy.health).toBe(40)
  })

  it('marks an airborne heavy attack as a jump strike and doubles a strike against exhausted poise', () => {
    let jumpStrike = stepCombat(initialCombat(), false, 2.5, 0, 1, 4,
      1 / 60, false, 0, true, 1, 1.35, true, 2)
    expect(jumpStrike.attack.jumping).toBe(true)
    for (let frame = 0; frame < 25; frame += 1) {
      jumpStrike = stepCombat(jumpStrike, false, 2.5, 0, 1, 4,
        1 / 60, false, 0, false, 1, 1.35, false, 2)
    }
    expect(jumpStrike.enemy.health).toBe(0)
  })

  it('uses shield bash stamina, reach and fixed damage independently of weapon scaling', () => {
    let state = stepCombat(initialCombat(), false, 2.5, 0, 1, 3.7,
      1 / 60, false, 0, false, 4, 1.35, false, 1, true)
    expect(state.attack.kind).toBe('shieldBash')
    expect(state.player.stamina).toBe(74)
    expect(state.attack.damageMultiplier).toBe(1)
    for (let frame = 0; frame < 20; frame += 1) {
      state = stepCombat(state, false, 2.5, 0, 1, 3.7, 1 / 60)
    }
    expect(state.enemy.health).toBe(68)
  })

  it('uses flasks only when injured and preserves extra capacity after a checkpoint', () => {
    let state = addFlaskCapacity(initialCombat())
    expect(state.maxFlasks).toBe(4)
    expect(useFlask(state)).toBe(state)
    state = damagePlayer(state, 200)
    state = useFlask(state)
    expect(state.player.health).toBe(290)
    expect(state.flasks).toBe(3)
    state = useFlask(state)
    expect(state.player.health).toBe(350)
    expect(state.flasks).toBe(2)
    state = refillAtCheckpoint(state)
    expect(state.flasks).toBe(4)
    expect(state.maxFlasks).toBe(4)
  })

  it('parries only during its timing window and blocks from the front after holding L', () => {
    const input = { pressed: true, held: true, sprinting: false, direction: 0 as const, shieldReduction: 0.85 }
    let state = stepDefense(initialCombat(), input, 1 / 60)
    expect(resolveIncomingHit(state, 25, 0.85, true).outcome).toBe('hit')
    for (let frame = 0; frame < 3; frame += 1) state = stepDefense(state, { ...input, pressed: false }, 1 / 60)
    expect(resolveIncomingHit(state, 25, 0.85, true).outcome).toBe('parried')
    for (let frame = 0; frame < 13; frame += 1) state = stepDefense(state, { ...input, pressed: false }, 1 / 60)
    expect(state.defense.mode).toBe('guard')
    const blocked = resolveIncomingHit(state, 25, 0.85, true)
    expect(blocked.outcome).toBe('blocked')
    expect(blocked.state.player.health).toBe(346)
    expect(blocked.state.player.stamina).toBe(65)
    const counter = stepCombat(blocked.state, true, 2.5, 0, 1, 4, 1 / 60)
    expect(counter.attack.damageMultiplier).toBe(0.8)
    expect(counter.defense.counterRemaining).toBe(0)
    expect(resolveIncomingHit(state, 25, 0.85, false).outcome).toBe('hit')
  })

  it('breaks the guard when stamina cannot pay the hit cost', () => {
    let state = stepDefense(initialCombat(),
      { pressed: false, held: true, sprinting: false, direction: 0, shieldReduction: 0.5 }, 1 / 60)
    state = { ...state, player: { ...state.player, stamina: 2 } }
    const hit = resolveIncomingHit(state, 25, 0.5, true)
    expect(hit.outcome).toBe('guardBroken')
    expect(hit.state.defense.mode).toBe('stagger')
    expect(hit.state.player.stamina).toBe(0)
  })

  it('dodges while sprinting, spending 20 stamina and evading only during active frames', () => {
    const input = { pressed: true, held: true, sprinting: true, direction: 1 as const, shieldReduction: 0.85 }
    let state = stepDefense(initialCombat(), input, 1 / 60)
    expect(state.defense.mode).toBe('dodge')
    expect(state.player.stamina).toBe(70)
    expect(resolveIncomingHit(state, 25, 0.85, true).outcome).toBe('hit')
    for (let frame = 0; frame < 2; frame += 1) state = stepDefense(state, { ...input, pressed: false }, 1 / 60)
    expect(resolveIncomingHit(state, 25, 0.85, true).outcome).toBe('dodged')
    for (let frame = 0; frame < 6; frame += 1) state = stepDefense(state, { ...input, pressed: false }, 1 / 60)
    expect(resolveIncomingHit(state, 25, 0.85, true).outcome).toBe('hit')
    for (let frame = 0; frame < 5; frame += 1) state = stepDefense(state, { ...input, pressed: false }, 1 / 60)
    expect(state.defense.mode).toBe('guard')
    const followUp = stepCombat(state, true, 2.5, 0, 1, 4, 1 / 60)
    expect(followUp.attack.damageMultiplier).toBe(0.9)
  })

  it('uses origin FP for spells and refills FP at the checkpoint', () => {
    let state = setMaxFp(initialCombat(), 80)
    expect(state.player.fp).toBe(80)
    state = castSpell(state, 'soulArrow')
    expect(state.player.fp).toBe(65)
    state = castSpell(state, 'radiantWeapon')
    expect(state.player.fp).toBe(35)
    state = refillAtCheckpoint(state)
    expect(state.player.fp).toBe(80)
  })

  it('heals for 30 percent with a prayer and does not spend FP at full health', () => {
    let state = setMaxFp(initialCombat(), 70)
    expect(castSpell(state, 'smallHeal')).toBe(state)
    state = damagePlayer(state, 180)
    state = castSpell(state, 'smallHeal')
    expect(state.player.health).toBe(275)
    expect(state.player.fp).toBe(50)
    state = castSpell(state, 'divineSight')
    expect(state.player.fp).toBe(35)
    const lowFp = { ...state, player: { ...state.player, fp: 10 } }
    expect(castSpell(lowFp, 'smallHeal')).toBe(lowFp)
  })

  it('applies the radiant weapon bonus to a new attack', () => {
    let state = initialCombat()
    for (let frame = 0; frame < 20; frame += 1) {
      state = stepCombat(state, frame === 0, 2.5, 0, 1, 4, 1 / 60,
        false, 0, false, 1.2)
    }
    expect(state.enemy.health).toBe(50)
  })

  it('charges FP for a dagger step and prevents another during cooldown', () => {
    const initial = initialCombat()
    const dodging = useDaggerStep(initial, -1)
    expect(dodging.player.fp).toBe(40)
    expect(dodging.defense.mode).toBe('dodge')
    expect(dodging.defense.direction).toBe(-1)
    expect(useDaggerStep(dodging, 1)).toBe(dodging)
  })

  it('uses 20 FP for a mace blessing and restores 20 percent health', () => {
    const wounded = damagePlayer(initialCombat(), 100)
    const blessed = castSpell(wounded, 'blessing')
    expect(blessed.player.health).toBe(320)
    expect(blessed.player.fp).toBe(30)
    expect(castSpell(blessed, 'blessing').player.health).toBe(350)
  })
})
