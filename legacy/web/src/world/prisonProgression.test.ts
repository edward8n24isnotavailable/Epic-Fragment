import { describe, expect, it } from 'vitest'
import { demoFragments, demoTimeNodes } from '../narrative/demoData'
import { collectFragment, initialNarrative, selectFragment } from '../narrative/state'
import { confirmChronicle, initialPrisonFlags } from './prisonProgression'

function evidence(ids: readonly string[]) {
  let state = initialNarrative(demoTimeNodes)
  for (const id of ids) {
    const definition = demoFragments.find(fragment => fragment.id === id)!
    state = collectFragment(state, id, demoFragments)
    const selected = selectFragment(state, definition.timeNodeId, id, demoFragments)
    if (!selected.ok) throw new Error(id)
    state = selected.state
  }
  return state
}

describe('prison timeline gates', () => {
  it('opens the city through a two-node inference without awarding an ability', () => {
    const flags = confirmChronicle(initialPrisonFlags(), evidence(['F01', 'F03']))
    expect(flags.exitKnowledge).toBe(true)
    expect(flags.spiritPerception).toBe(false)
    expect(flags.doubleJump).toBe(false)
  })

  it('requires F05 for prison perception and the complete coup line for double jump', () => {
    const prelude = confirmChronicle(initialPrisonFlags(), evidence(['F01', 'F03', 'F05']))
    expect(prelude.spiritPerception).toBe(true)
    expect(prelude.doubleJump).toBe(false)
    expect(confirmChronicle(prelude, evidence(['F01', 'F03', 'F05', 'F07'])).doubleJump).toBe(false)
    const complete = confirmChronicle(prelude, evidence(['F01', 'F03', 'F05', 'F07', 'F10']))
    expect(complete.doubleJump).toBe(true)
    expect(confirmChronicle(complete, evidence(['F01'])).doubleJump).toBe(true)
  })
})
