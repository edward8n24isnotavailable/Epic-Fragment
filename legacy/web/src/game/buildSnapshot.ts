import type { CombatState } from '../domain/combat'
import { enemyAttackName, type EnemyState } from '../domain/enemy'
import type { MovementState } from '../domain/movement'
import type { ProgressionState } from '../domain/progression'
import { demoFragments, demoTimeNodes } from '../narrative/demoData'
import type { NarrativeState } from '../narrative/model'
import { buildTimelineView } from '../narrative/view'
import { roomAt, type WorldZone } from '../world/prisonLayout'
import type { PrisonFlags } from '../world/prisonProgression'
import { originAttributes, originLoadouts, type OriginId } from '../world/originLoadouts'
import { equipmentName, ownedOffhands, ownedWeapons, weapons,
  type EquipmentState, type OffhandGearId, type WeaponId } from '../world/equipment'
import { weaponAttack } from '../world/weaponCatalog'
import { activeEncounterForRoom, encounterIds, type Encounter, type EncounterId } from './encounters'
import { profileForEncounter } from './enemyProfiles'
import type { GameSnapshot } from './GameSnapshot'

export interface SnapshotState {
  combat: CombatState
  movement: MovementState
  enemy: EnemyState
  encounters: Record<EncounterId, Encounter>
  zone: WorldZone
  flags: PrisonFlags
  narrative: NarrativeState
  progression: ProgressionState
  equipment: EquipmentState
  origin: OriginId
  acquiredWeapons: ReadonlySet<WeaponId>
  acquiredOffhands: ReadonlySet<OffhandGearId>
  loot: ReadonlySet<string>
  discoveredRooms: ReadonlySet<string>
  message: string
  timelineOpen: boolean
  saveAvailable: boolean
  canSwitchEquipment: boolean
  skillName: string
  shieldReduction: number
  prayerInput: string | null
  radiantRemaining: number
  sightRemaining: number
  respawnRemaining: number
  nearAltar: boolean
  prompt: string | null
}

export function buildGameSnapshot(state: SnapshotState): GameSnapshot {
  const currentRoom = roomAt(state.movement.x, state.movement.y, state.zone)
  const encounter = activeEncounterForRoom(currentRoom.id, state.movement.x, state.encounters)
  const encounterId = encounter ? encounterIds.find(id => state.encounters[id] === encounter) : null
  const currentEnemy = encounter?.enemy ?? state.enemy
  const combat = state.combat
  return {
    health: combat.player.health,
    maxHealth: combat.player.maxHealth,
    stamina: Math.round(combat.player.stamina),
    maxStamina: combat.player.maxStamina,
    fp: combat.player.fp,
    maxFp: combat.player.maxFp,
    flasks: combat.flasks,
    maxFlasks: combat.maxFlasks,
    enemyHealth: encounter?.health ?? combat.enemy.health,
    enemyMaxHealth: encounter?.maxHealth ?? combat.enemy.maxHealth,
    enemyPoise: Math.ceil(currentEnemy.poise.current),
    enemyMaxPoise: currentEnemy.poise.max,
    enemyExhaustedRemaining: Math.ceil(currentEnemy.poise.exhaustedRemaining),
    enemyExecutionAvailable: currentEnemy.poise.executionAvailable,
    enemyAttackName: encounter && encounterId
      ? enemyAttackName(encounter.enemy, profileForEncounter(encounterId, encounter.health))
      : enemyAttackName(state.enemy),
    attackPhase: combat.attack.phase,
    defenseMode: combat.defense.mode,
    shieldReduction: state.shieldReduction,
    prayerInput: state.prayerInput,
    radiantRemaining: Math.ceil(state.radiantRemaining),
    sightRemaining: Math.ceil(state.sightRemaining),
    grounded: state.movement.grounded,
    souls: state.progression.souls,
    checkpointActive: state.progression.checkpointActive,
    saveAvailable: state.saveAvailable,
    dead: state.respawnRemaining > 0,
    message: state.message,
    room: currentRoom.label,
    discoveredRooms: state.discoveredRooms.size,
    fragments: state.narrative.collectedFragmentIds.length,
    timelineOpen: state.timelineOpen,
    timelineUnlocked: state.narrative.collectedFragmentIds.includes('F01'),
    timeline: buildTimelineView(state.narrative, demoTimeNodes, demoFragments),
    equipmentRecovered: state.flags.equipmentRecovered,
    canSwitchEquipment: state.canSwitchEquipment,
    equipment: { ...state.equipment },
    weaponOptions: ownedWeapons(state.origin, state.acquiredWeapons),
    offhandOptions: ownedOffhands(state.origin, state.acquiredWeapons, state.acquiredOffhands),
    skillName: state.skillName,
    exitKnowledge: state.flags.exitKnowledge,
    spiritPerception: state.flags.spiritPerception && state.zone === 'prison',
    doubleJump: state.flags.doubleJump,
    shortcutOpen: state.flags.shortcutOpen,
    wardenKey: state.flags.wardenKey,
    lockedDoorOpen: state.flags.lockedDoorOpen,
    nearAltar: state.nearAltar,
    enemyName: encounter?.name ?? '灰烬士兵',
    totalRooms: 14,
    origin: state.origin,
    originLevel: originLoadouts[state.origin].level,
    attributes: { ...originAttributes[state.origin] },
    weaponDamage: Math.round(weaponAttack(weapons[state.equipment.mainHand], originAttributes[state.origin])
      * (state.equipment.twoHanded ? 1.2 : 1)),
    equipmentSummary: state.flags.equipmentRecovered
      ? `${equipmentName(state.equipment.mainHand)} / ${equipmentName(state.equipment.offHand)} / ${state.equipment.twoHanded ? '双手握持' : '单手握持'} / 四部位防具 / ${originLoadouts[state.origin].other}`
      : '囚服、牢门钥匙；职业装备被没收',
    loot: [...state.loot],
    prompt: state.prompt,
  }
}
