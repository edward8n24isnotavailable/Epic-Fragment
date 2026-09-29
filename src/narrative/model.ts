export type FragmentId = string
export type TimeNodeId = string

export type FragmentSourceType =
  | 'officialRecord'
  | 'officialNotice'
  | 'privateJournal'
  | 'object'
  | 'environment'
  | 'unspecified'
  | 'bossMemory'
  | 'hostileDocument'
  | 'forensicRecord'

export interface StoryFragmentDefinition {
  id: FragmentId
  timeNodeId: TimeNodeId
  title: string
  statement: string
  source: string
  sourceType: FragmentSourceType
  faction?: string
  reliabilityHint?: string
  conflictGroup?: string
  characters: readonly string[]
  locations: readonly string[]
  relatedFragments: readonly FragmentId[]
  tags: readonly string[]
  narrativeText: string
  causeHint?: string
  supportsStorylines?: readonly ('coup' | 'loyalist')[]
  mapEffect?: string
}

export interface TimeNodeDefinition {
  id: TimeNodeId
  label: string
  result: string
}

// Plain arrays and records keep the state serializable for the later save system.
export interface NarrativeState {
  collectedFragmentIds: FragmentId[]
  selections: Record<TimeNodeId, FragmentId | null>
}
