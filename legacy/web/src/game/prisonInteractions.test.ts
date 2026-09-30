import { describe, expect, it } from 'vitest'
import { demoTimeNodes } from '../narrative/demoData'
import { initialNarrative } from '../narrative/state'
import { prisonLocations } from '../world/prisonLayout'
import { initialPrisonFlags } from '../world/prisonProgression'
import type { WeaponId } from '../world/equipment'
import { initialEncounters } from './encounters'
import { handlePrisonInteraction, prisonInteractionPrompt,
  type InteractionActions, type InteractionContext } from './prisonInteractions'

function context(x: number, y = 0): InteractionContext {
  return { zone: 'prison', x, y, flags: initialPrisonFlags(), origin: 'knight',
    loot: new Set(), acquiredWeapons: new Set<WeaponId>(),
    encounters: initialEncounters(), narrative: initialNarrative(demoTimeNodes) }
}

function actions(events: string[]): InteractionActions {
  return { travel: zone => { events.push(`travel:${zone}`) },
    collect: id => { events.push(`collect:${id}`); return true },
    addFlaskCapacity: () => { events.push('flask') },
    confirmTimeline: () => { events.push('save') },
    setMessage: message => { events.push(message) },
    syncWorld: () => { events.push('sync') }, publish: () => { events.push('publish') } }
}

describe('prison interactions', () => {
  it('adds the cell D dagger to the owned weapon inventory', () => {
    const state = context(-75)
    const events: string[] = []
    handlePrisonInteraction(state, actions(events))
    expect(state.loot.has('备用短刀')).toBe(true)
    expect(state.acquiredWeapons.has('dagger')).toBe(true)
    expect(events).toContain('publish')
  })

  it('routes the altar prompt and interaction to checkpoint confirmation', () => {
    const state = context(prisonLocations.altarX, 2.5)
    const events: string[] = []
    expect(prisonInteractionPrompt(state)).toContain('存档')
    handlePrisonInteraction(state, actions(events))
    expect(events).toContain('save')
    expect(events).toContain('sync')
  })
})
