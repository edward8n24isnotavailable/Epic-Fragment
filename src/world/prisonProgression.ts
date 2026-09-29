import type { NarrativeState } from '../narrative/model'

export interface PrisonFlags {
  equipmentRecovered: boolean
  exitKnowledge: boolean
  spiritPerception: boolean
  doubleJump: boolean
  dash: boolean
  shortcutOpen: boolean
  wardenKey: boolean
  lockedDoorOpen: boolean
  frontGateOpen: boolean
  archiveRewardTaken: boolean
}

export function initialPrisonFlags(): PrisonFlags {
  return {
    equipmentRecovered: false, exitKnowledge: false, spiritPerception: false,
    doubleJump: false, dash: false, shortcutOpen: false, wardenKey: false,
    lockedDoorOpen: false, frontGateOpen: false, archiveRewardTaken: false,
  }
}

export function chronicleEffects(narrative: NarrativeState): Pick<PrisonFlags, 'exitKnowledge' | 'spiritPerception' | 'doubleJump' | 'dash'> {
  const choices = narrative.selections
  const firstTwo = choices.T0 === 'F01' && choices.T1 === 'F03'
  const firstThree = firstTwo && choices.T2 === 'F05'
  return {
    exitKnowledge: firstTwo,
    spiritPerception: firstThree,
    doubleJump: firstThree && choices.T3 === 'F07' && choices.T4 === 'F10',
    dash: choices.T0 === 'F01' && choices.T1 === 'F04' && choices.T2 === 'F05'
      && choices.T3 === 'F08' && choices.T4 === 'F09',
  }
}

// Once an altar responds, its reward remains available after the player changes the timeline.
export function confirmChronicle(flags: PrisonFlags, narrative: NarrativeState): PrisonFlags {
  const effects = chronicleEffects(narrative)
  return {
    ...flags,
    exitKnowledge: flags.exitKnowledge || effects.exitKnowledge,
    spiritPerception: flags.spiritPerception || effects.spiritPerception,
    doubleJump: flags.doubleJump || effects.doubleJump,
    dash: flags.dash || effects.dash,
  }
}
