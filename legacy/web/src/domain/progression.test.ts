import { describe, expect, it } from 'vitest'
import { activateCheckpoint, collectSouls, dropEnemySouls, initialProgression, loseSoulsOnDeath } from './progression'

describe('checkpoint and souls', () => {
  it('awards souls only when the player reaches the drop', () => {
    const dropped = dropEnemySouls(initialProgression(), 4, 50)
    expect(collectSouls(dropped, 0).souls).toBe(0)
    expect(collectSouls(dropped, 4).souls).toBe(50)
  })

  it('stores a checkpoint and allows one chance to recover lost souls', () => {
    let state = activateCheckpoint(initialProgression(), -8.5, -8.5)
    expect(state.checkpointX).toBe(-8.5)
    state = collectSouls(dropEnemySouls(state, 4, 50), 4)
    state = loseSoulsOnDeath(state, 2)
    expect(state.souls).toBe(0)
    expect(state.drops.find(drop => drop.kind === 'grave')?.amount).toBe(50)
    state = loseSoulsOnDeath(state, -4)
    expect(state.drops.some(drop => drop.kind === 'grave')).toBe(false)
  })

  it('keeps second-floor souls out of reach from the corridor below', () => {
    const dropped = dropEnemySouls(initialProgression(), -30, 50, 7)
    expect(collectSouls(dropped, -30, 2.5).souls).toBe(0)
    expect(collectSouls(dropped, -30, 7).souls).toBe(50)
  })
})
