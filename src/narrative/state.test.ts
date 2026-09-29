import { describe, expect, it } from 'vitest'
import { demoFragments, demoTimeNodes } from './demoData'
import { activeFragments, candidatesForNode, collectFragment, initialNarrative, selectFragment } from './state'

describe('story fragment collection and timeline', () => {
  it('starts with neutral empty nodes and stores a serializable state', () => {
    const state = initialNarrative(demoTimeNodes)
    expect(state.selections).toEqual({ T0: null, T1: null, T2: null, T3: null, T4: null, T5: null })
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })

  it('uses the GDD v0.1.3 six nodes and complete Demo evidence catalog', () => {
    expect(demoTimeNodes.map(node => node.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4', 'T5'])
    expect(demoFragments.map(fragment => fragment.id).sort()).toEqual([
      'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12', 'F15',
    ])
    expect(demoFragments.find(fragment => fragment.id === 'F08')?.locations).toContain('皇宫塔楼顶部')
  })

  it('collects known evidence once and shows only collected candidates', () => {
    const empty = initialNarrative(demoTimeNodes)
    const first = collectFragment(empty, 'F03', demoFragments)
    expect(collectFragment(first, 'F03', demoFragments)).toBe(first)
    expect(collectFragment(first, 'F99', demoFragments)).toBe(first)
    expect(candidatesForNode(first, 'T1', demoFragments).map(fragment => fragment.id)).toEqual(['F03'])
    const second = collectFragment(first, 'F04', demoFragments)
    expect(candidatesForNode(second, 'T1', demoFragments).map(fragment => fragment.id)).toEqual(['F03', 'F04'])
  })

  it('selects only collected evidence for its own node and permits uncertainty', () => {
    const empty = initialNarrative(demoTimeNodes)
    expect(selectFragment(empty, 'T1', 'F03', demoFragments)).toEqual({ ok: false, reason: 'uncollected' })
    const collected = collectFragment(empty, 'F03', demoFragments)
    expect(selectFragment(collected, 'T0', 'F03', demoFragments)).toEqual({ ok: false, reason: 'wrong-node' })
    expect(selectFragment(collected, 'T9', 'F03', demoFragments)).toEqual({ ok: false, reason: 'unknown-node' })
    expect(selectFragment(collected, 'T1', 'F99', demoFragments)).toEqual({ ok: false, reason: 'unknown-fragment' })

    const selected = selectFragment(collected, 'T1', 'F03', demoFragments)
    expect(selected.ok).toBe(true)
    if (!selected.ok) return
    expect(selected.state.selections.T1).toBe('F03')
    const uncertain = selectFragment(selected.state, 'T1', null, demoFragments)
    expect(uncertain.ok).toBe(true)
    if (uncertain.ok) expect(uncertain.state.selections.T1).toBeNull()
  })

  it('reads active evidence in node order without labelling any version as truth', () => {
    let state = initialNarrative(demoTimeNodes)
    state = collectFragment(state, 'F05', demoFragments)
    state = collectFragment(state, 'F01', demoFragments)
    const atT2 = selectFragment(state, 'T2', 'F05', demoFragments)
    if (!atT2.ok) throw new Error('F05 must be selectable')
    const atT0 = selectFragment(atT2.state, 'T0', 'F01', demoFragments)
    if (!atT0.ok) throw new Error('F01 must be selectable')
    expect(activeFragments(atT0.state, demoTimeNodes, demoFragments).map(fragment => fragment.id)).toEqual(['F01', 'F05'])
    expect(Object.keys(demoFragments[0])).not.toContain('isTruth')
  })
})
