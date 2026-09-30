import type { ProgressionState } from '../domain/progression'
import { demoFragments, demoTimeNodes } from '../narrative/demoData'
import type { NarrativeState } from '../narrative/model'
import { initialPrisonFlags, type PrisonFlags } from '../world/prisonProgression'
import { originLoadouts, type OriginId } from '../world/originLoadouts'
import { offhandGear, weapons, type EquipmentState, type OffhandGearId, type WeaponId } from '../world/equipment'
import { encounterIds, type EncounterId } from './encounters'

export const SAVE_KEY = 'epic-fragment:checkpoint:v1'

export interface GameSaveData {
  version: 1
  savedAt: number
  origin: OriginId
  equipment: EquipmentState
  flags: PrisonFlags
  loot: string[]
  acquiredWeapons: WeaponId[]
  acquiredOffhands: OffhandGearId[]
  progression: ProgressionState
  narrative: NarrativeState
  discoveredRooms: string[]
  defeatedEncounters: EncounterId[]
  maxFlasks: number
}

export interface SaveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function finite(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min
}

export function isGameSave(value: unknown): value is GameSaveData {
  if (!record(value) || value.version !== 1 || !finite(value.savedAt)
    || typeof value.origin !== 'string' || !Object.hasOwn(originLoadouts, value.origin)
    || !record(value.equipment) || !record(value.flags)
    || !record(value.progression) || !record(value.narrative)) return false
  const equipment = value.equipment
  const flags = value.flags
  const progression = value.progression
  const narrative = value.narrative
  if (typeof equipment.mainHand !== 'string' || !Object.hasOwn(weapons, equipment.mainHand)
    || equipment.offHand !== null && (typeof equipment.offHand !== 'string'
      || !Object.hasOwn(weapons, equipment.offHand) && !Object.hasOwn(offhandGear, equipment.offHand))
    || equipment.twoHanded !== true && equipment.twoHanded !== false
    || equipment.mainHand === equipment.offHand) return false
  if (!Object.keys(initialPrisonFlags()).every(key => typeof flags[key] === 'boolean')) return false
  if (!strings(value.loot) || !strings(value.acquiredWeapons)
    || !value.acquiredWeapons.every(id => Object.hasOwn(weapons, id))
    || !strings(value.acquiredOffhands)
    || !value.acquiredOffhands.every(id => Object.hasOwn(offhandGear, id))
    || !strings(value.discoveredRooms) || !strings(value.defeatedEncounters)
    || !value.defeatedEncounters.every(id => encounterIds.includes(id as EncounterId))
    || !finite(value.maxFlasks, 3) || !Number.isInteger(value.maxFlasks)) return false
  if (!finite(progression.souls) || !finite(progression.nextDropId, 1)
    || !finite(progression.checkpointX, -1000) || progression.checkpointActive !== true
    || !finite(progression.deaths) || !Array.isArray(progression.drops)
    || !progression.drops.every(drop => record(drop) && finite(drop.id, 1)
      && finite(drop.x, -1000) && (drop.y === undefined || finite(drop.y, -1000))
      && finite(drop.amount) && (drop.kind === 'enemy' || drop.kind === 'grave'))) return false
  const validFragments = new Set(demoFragments.map(fragment => fragment.id))
  if (!strings(narrative.collectedFragmentIds)
    || !narrative.collectedFragmentIds.every(id => validFragments.has(id))
    || !record(narrative.selections)) return false
  const selections = narrative.selections
  const collected = narrative.collectedFragmentIds
  if (!demoTimeNodes.every(node => selections[node.id] === null
    || typeof selections[node.id] === 'string'
      && collected.includes(selections[node.id] as string)
      && demoFragments.some(fragment => fragment.id === selections[node.id]
        && fragment.timeNodeId === node.id))) return false
  return true
}

export function readGameSave(storage: SaveStorage): GameSaveData | null {
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isGameSave(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeGameSave(storage: SaveStorage, save: GameSaveData): boolean {
  try {
    if (!isGameSave(save)) return false
    storage.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

export function clearGameSave(storage: SaveStorage): boolean {
  try {
    storage.removeItem(SAVE_KEY)
    return true
  } catch {
    return false
  }
}
