import type { FragmentId, NarrativeState, StoryFragmentDefinition, TimeNodeId, TimeNodeDefinition } from './model'
import { candidatesForNode } from './state'

export interface TimelineCandidateView {
  id: FragmentId
  title: string
  statement: string
  source: string
  reliabilityHint?: string
}

export interface TimelineNodeView {
  id: TimeNodeId
  label: string
  result: string
  selectedId: FragmentId | null
  candidates: TimelineCandidateView[]
  hasConflict: boolean
}

export interface TimelineView {
  nodes: TimelineNodeView[]
  narrativeText: string
}

export function buildTimelineView(
  state: NarrativeState,
  nodes: readonly TimeNodeDefinition[],
  definitions: readonly StoryFragmentDefinition[],
  conflictedNodeIds: readonly TimeNodeId[] = [],
): TimelineView {
  const nodeViews = nodes.map(node => ({
    id: node.id,
    label: node.label,
    result: node.result,
    selectedId: state.selections[node.id] ?? null,
    candidates: candidatesForNode(state, node.id, definitions).map(fragment => ({
      id: fragment.id,
      title: fragment.title,
      statement: fragment.statement,
      source: fragment.source,
      reliabilityHint: fragment.reliabilityHint,
    })),
    hasConflict: conflictedNodeIds.includes(node.id),
  }))
  const narrativeText = nodeViews.map(node => {
    const fragment = definitions.find(item => item.id === node.selectedId)
    return `${node.label}：${fragment?.narrativeText ?? '【此处历史不明】'}`
  }).join('\n')
  return { nodes: nodeViews, narrativeText }
}
