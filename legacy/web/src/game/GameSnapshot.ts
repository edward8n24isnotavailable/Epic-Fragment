import type { TimelineView } from '../narrative/view'
import type { CharacterAttributes, OriginId } from '../world/originLoadouts'
import type { EquipmentState, OffhandId, WeaponId } from '../world/equipment'

export interface GameSnapshot {
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
  fp: number
  maxFp: number
  flasks: number
  maxFlasks: number
  enemyHealth: number
  enemyMaxHealth: number
  enemyPoise: number
  enemyMaxPoise: number
  enemyExhaustedRemaining: number
  enemyExecutionAvailable: boolean
  enemyAttackName: string | null
  attackPhase: string
  defenseMode: string
  shieldReduction: number
  prayerInput: string | null
  radiantRemaining: number
  sightRemaining: number
  grounded: boolean
  souls: number
  checkpointActive: boolean
  saveAvailable: boolean
  dead: boolean
  message: string
  room: string
  discoveredRooms: number
  fragments: number
  timelineOpen: boolean
  timelineUnlocked: boolean
  timeline: TimelineView
  equipmentRecovered: boolean
  canSwitchEquipment: boolean
  equipment: EquipmentState
  weaponOptions: WeaponId[]
  offhandOptions: OffhandId[]
  skillName: string
  exitKnowledge: boolean
  spiritPerception: boolean
  doubleJump: boolean
  shortcutOpen: boolean
  wardenKey: boolean
  lockedDoorOpen: boolean
  nearAltar: boolean
  enemyName: string
  totalRooms: number
  origin: OriginId
  originLevel: number
  attributes: CharacterAttributes
  weaponDamage: number
  equipmentSummary: string
  loot: string[]
  prompt: string | null
}
