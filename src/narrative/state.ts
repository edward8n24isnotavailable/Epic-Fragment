import type { FragmentId, NarrativeState, StoryFragmentDefinition, TimeNodeDefinition, TimeNodeId } from './model'

export type SelectionResult =
  | { ok: true; state: NarrativeState }
  | { ok: false; reason: 'unknown-node' | 'unknown-fragment' | 'uncollected' | 'wrong-node' }

export function initialNarrative(nodes: readonly TimeNodeDefinition[]): NarrativeState {
  return {
    collectedFragmentIds: [],
    selections: Object.fromEntries(nodes.map(node => [node.id, null])),
  }
}

export function collectFragment(
  state: NarrativeState,
  fragmentId: FragmentId,
  definitions: readonly StoryFragmentDefinition[],
): NarrativeState {
  if (!definitions.some(fragment => fragment.id === fragmentId)) return state
  if (state.collectedFragmentIds.includes(fragmentId)) return state
  return { ...state, collectedFragmentIds: [...state.collectedFragmentIds, fragmentId] }
}

export function candidatesForNode(
  state: NarrativeState,
  nodeId: TimeNodeId,
  definitions: readonly StoryFragmentDefinition[],
): StoryFragmentDefinition[] {
  return definitions.filter(fragment => fragment.timeNodeId === nodeId && state.collectedFragmentIds.includes(fragment.id))
}

export function selectFragment(
  state: NarrativeState,
  nodeId: TimeNodeId,
  fragmentId: FragmentId | null,
  definitions: readonly StoryFragmentDefinition[],
): SelectionResult {
  if (!Object.hasOwn(state.selections, nodeId)) return { ok: false, reason: 'unknown-node' }
  if (fragmentId !== null) {
    const fragment = definitions.find(item => item.id === fragmentId)
    if (!fragment) return { ok: false, reason: 'unknown-fragment' }
    if (!state.collectedFragmentIds.includes(fragmentId)) return { ok: false, reason: 'uncollected' }
    if (fragment.timeNodeId !== nodeId) return { ok: false, reason: 'wrong-node' }
  }
  if (state.selections[nodeId] === fragmentId) return { ok: true, state }
  return { ok: true, state: { ...state, selections: { ...state.selections, [nodeId]: fragmentId } } }
}

export function activeFragments(
  state: NarrativeState,
  nodes: readonly TimeNodeDefinition[],
  definitions: readonly StoryFragmentDefinition[],
): StoryFragmentDefinition[] {
  return nodes.flatMap(node => {
    const fragment = definitions.find(item => item.id === state.selections[node.id])
    return fragment ? [fragment] : []
  })
}
