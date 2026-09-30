import { describe, expect, it } from 'vitest'
import { initialMovement, stepMovement } from './movement'
import { prisonSurfaces } from '../world/prisonLayout'

describe('character movement', () => {
  it('accelerates sideways and stays on the gameplay plane', () => {
    let state = initialMovement()
    for (let index = 0; index < 60; index += 1) {
      state = stepMovement(state, { direction: 1, jumpPressed: false }, 1 / 60)
    }
    expect(state.x).toBeGreaterThan(-1)
    expect(state.y).toBe(0)
    expect(state.grounded).toBe(true)
  })

  it('moves faster while sprinting', () => {
    let normal = initialMovement()
    let sprinting = initialMovement()
    for (let index = 0; index < 30; index += 1) {
      normal = stepMovement(normal, { direction: 1, jumpPressed: false }, 1 / 60)
      sprinting = stepMovement(sprinting, { direction: 1, jumpPressed: false, sprinting: true }, 1 / 60)
    }
    expect(sprinting.x).toBeGreaterThan(normal.x)
  })

  it('jumps and lands', () => {
    let state = stepMovement(initialMovement(), { direction: 0, jumpPressed: true }, 1 / 60)
    expect(state.y).toBeGreaterThan(0)
    expect(state.grounded).toBe(false)
    for (let index = 0; index < 120; index += 1) {
      state = stepMovement(state, { direction: 0, jumpPressed: false }, 1 / 60)
    }
    expect(state.y).toBe(0)
    expect(state.grounded).toBe(true)
  })

  it('honors coyote time and buffered jump', () => {
    const offEdge = { ...initialMovement(), y: 1, grounded: false, coyoteRemaining: 0.06 }
    const coyoteJump = stepMovement(offEdge, { direction: 0, jumpPressed: true }, 1 / 60)
    expect(coyoteJump.velocityY).toBeGreaterThan(0)

    const falling = { ...initialMovement(), y: 0.05, velocityY: -2, grounded: false, coyoteRemaining: 0 }
    const buffered = stepMovement(falling, { direction: 0, jumpPressed: true }, 1 / 60)
    const landed = stepMovement(buffered, { direction: 0, jumpPressed: false }, 1 / 60)
    const afterLanding = stepMovement(landed, { direction: 0, jumpPressed: false }, 1 / 60)
    expect(afterLanding.velocityY).toBeGreaterThan(0)
  })

  it('blocks a high ledge until the player jumps onto it', () => {
    let state = initialMovement(-58, -1.5)
    for (let index = 0; index < 45; index += 1) {
      state = stepMovement(state, { direction: 1, jumpPressed: false }, 1 / 60, prisonSurfaces)
    }
    expect(state.x).toBeCloseTo(-57.32, 2)
    expect(state.y).toBe(-1.5)

    state = stepMovement(state, { direction: 1, jumpPressed: true }, 1 / 60, prisonSurfaces)
    for (let index = 0; index < 55; index += 1) {
      state = stepMovement(state, { direction: 1, jumpPressed: false }, 1 / 60, prisonSurfaces)
    }
    expect(state.x).toBeGreaterThan(-57)
    expect(state.y).toBeCloseTo(-0.5, 2)
    expect(state.grounded).toBe(true)
  })

  it('falls from an upper platform and lands on the next lower surface', () => {
    let state = initialMovement(-42, 2.5)
    for (let index = 0; index < 52; index += 1) {
      state = stepMovement(state, { direction: -1, jumpPressed: false }, 1 / 60, prisonSurfaces)
    }
    expect(state.y).toBe(1.5)
    expect(state.grounded).toBe(true)
  })

  it('can traverse from the cell through the sewer and vent to the hall', () => {
    let state = initialMovement(-81, 0)
    for (let index = 0; index < 1500; index += 1) {
      const jumpPressed = state.grounded && state.x > -57.5 && state.x < -40 && state.velocityX === 0
      state = stepMovement(state, { direction: 1, jumpPressed }, 1 / 60, prisonSurfaces)
    }
    expect(state.x).toBeGreaterThan(16)
    expect(state.y).toBe(2.5)
    expect(state.grounded).toBe(true)
  })

  it('reaches the second-floor entry only after a second jump', () => {
    let single = initialMovement(23, 2.5)
    let double = initialMovement(23, 2.5)
    for (let frame = 0; frame < 120; frame += 1) {
      single = stepMovement(single, { direction: 0, jumpPressed: frame === 0 }, 1 / 60, prisonSurfaces)
      double = stepMovement(double, { direction: 0, jumpPressed: frame === 0 || frame === 27, extraJumps: 1 }, 1 / 60, prisonSurfaces)
    }
    expect(single.y).toBe(2.5)
    expect(double.y).toBe(6.1)

    let upstairs = initialMovement(20, 6.1)
    for (let frame = 0; frame < 100; frame += 1) {
      upstairs = stepMovement(upstairs, { direction: -1, jumpPressed: frame === 0 }, 1 / 60, prisonSurfaces)
    }
    expect(upstairs.x).toBeLessThan(18)
    expect(upstairs.y).toBe(7)
  })
})
