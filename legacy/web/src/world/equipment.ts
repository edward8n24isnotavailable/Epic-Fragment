import type { OriginId } from './originLoadouts'
import { offhandGear, weaponAttack, weapons, type CombatAttributes, type OffhandGearId, type WeaponId } from './weaponCatalog'
export { offhandGear, weapons } from './weaponCatalog'
export type { OffhandGearId, WeaponId } from './weaponCatalog'

export type OffhandId = WeaponId | OffhandGearId | null
export type WeaponSkill = typeof weapons[WeaponId]['skill'] | 'prayer' | 'shield'

export interface EquipmentState {
  mainHand: WeaponId
  offHand: OffhandId
  twoHanded: boolean
}

const startingEquipment: Record<OriginId, EquipmentState> = {
  knight: { mainHand: 'straightSword', offHand: 'kiteShield', twoHanded: false },
  assassin: { mainHand: 'rapier', offHand: 'leatherShield', twoHanded: false },
  mage: { mainHand: 'apprenticeStaff', offHand: 'dagger', twoHanded: false },
  cleric: { mainHand: 'mace', offHand: 'travelerScripture', twoHanded: false },
  wretch: { mainHand: 'club', offHand: 'woodenShield', twoHanded: false },
}

export function initialEquipment(origin: OriginId): EquipmentState {
  return { ...startingEquipment[origin] }
}

export function ownedWeapons(origin: OriginId, acquired: ReadonlySet<WeaponId> = new Set()): WeaponId[] {
  const initial = startingEquipment[origin]
  const result: WeaponId[] = [initial.mainHand]
  if (initial.offHand && initial.offHand in weapons && !result.includes(initial.offHand as WeaponId)) {
    result.push(initial.offHand as WeaponId)
  }
  if (origin === 'assassin') result.push('thiefDagger')
  for (const weapon of acquired) if (!result.includes(weapon)) result.push(weapon)
  return result
}

export function ownedOffhands(
  origin: OriginId, acquiredWeapons: ReadonlySet<WeaponId> = new Set(),
  acquiredOffhands: ReadonlySet<OffhandGearId> = new Set(),
): OffhandId[] {
  const initial = startingEquipment[origin]
  const result: OffhandId[] = [null, ...ownedWeapons(origin, acquiredWeapons)]
  if (initial.offHand && initial.offHand in offhandGear) result.push(initial.offHand)
  for (const item of acquiredOffhands) if (!result.includes(item)) result.push(item)
  return result
}

export function equipMain(
  state: EquipmentState, weapon: WeaponId, owned: readonly WeaponId[],
): EquipmentState {
  if (!owned.includes(weapon) || weapon === state.mainHand) return state
  return { ...state, mainHand: weapon,
    offHand: state.offHand === weapon ? state.mainHand : state.offHand }
}

export function equipOffhand(
  state: EquipmentState, item: OffhandId, owned: readonly OffhandId[],
): EquipmentState {
  if (item === state.mainHand || !owned.includes(item) || item === state.offHand) return state
  return { ...state, offHand: item }
}

export function toggleGrip(state: EquipmentState): EquipmentState {
  return { ...state, twoHanded: !state.twoHanded }
}

export function activeOffhand(state: EquipmentState): OffhandId {
  return state.twoHanded ? null : state.offHand
}

export function activeSkill(state: EquipmentState): WeaponSkill {
  const offHand = activeOffhand(state)
  if (offHand && offHand in offhandGear) {
    if (offhandGear[offHand as OffhandGearId].kind === 'scripture') return 'prayer'
    return 'shield'
  }
  return weapons[state.mainHand].skill
}

export function shieldStats(state: EquipmentState): { reduction: number; parryBonusFrames: number } {
  const offHand = activeOffhand(state)
  return offHand && offHand in offhandGear ? offhandGear[offHand as OffhandGearId]
    : { reduction: 0, parryBonusFrames: 0 }
}

const baselineAttributes: CombatAttributes = { strength: 10, dexterity: 10, intelligence: 10, faith: 10 }

export function weaponPower(state: EquipmentState, attributes: CombatAttributes = baselineAttributes): number {
  return weaponAttack(weapons[state.mainHand], attributes) / weapons.straightSword.attack
    * (state.twoHanded ? 1.2 : 1)
}

export function equipmentName(item: WeaponId | OffhandId): string {
  if (!item) return '空手'
  return item in weapons ? weapons[item as WeaponId].name : offhandGear[item as OffhandGearId].name
}
