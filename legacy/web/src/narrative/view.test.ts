import { describe, expect, it } from 'vitest'
import { demoFragments, demoTimeNodes } from './demoData'
import { collectFragment, initialNarrative, selectFragment } from './state'
import { buildTimelineView } from './view'

describe('timeline presentation data', () => {
  it('keeps unknown nodes visible and narrates only selected evidence', () => {
    let state = initialNarrative(demoTimeNodes)
    state = collectFragment(state, 'F03', demoFragments)
    const before = buildTimelineView(state, demoTimeNodes, demoFragments)
    expect(before.nodes[1].candidates.map(candidate => candidate.id)).toEqual(['F03'])
    expect(before.nodes[1].selectedId).toBeNull()
    expect(before.narrativeText).toContain('国王死亡：【此处历史不明】')

    const selected = selectFragment(state, 'T1', 'F03', demoFragments)
    if (!selected.ok) throw new Error('F03 must be selectable')
    const after = buildTimelineView(selected.state, demoTimeNodes, demoFragments, ['T1'])
    expect(after.nodes[1].hasConflict).toBe(true)
    expect(after.narrativeText).toContain('一份官方公告称，国王已经死亡')
    expect(after.narrativeText).not.toContain('真相')
  })
})
