import { describe, expect, it } from 'vitest'
import { initialCombat, stepCombat } from '../domain/combat'
import { activeSkill, equipMain, equipOffhand, initialEquipment, ownedOffhands, ownedWeapons, shieldStats, toggleGrip, weaponPower, type OffhandGearId, type WeaponId } from './equipment'

describe('equipped weapons', () => {
  it('switches grip and disables the shield while two handing', () => {
    const oneHanded = initialEquipment('knight')
    expect(activeSkill(oneHanded)).toBe('shield')
    expect(shieldStats(oneHanded).reduction).toBe(0.85)
    const twoHanded = toggleGrip(oneHanded)
    expect(twoHanded.offHand).toBe('kiteShield')
    expect(shieldStats(twoHanded).reduction).toBe(0)
    expect(activeSkill(twoHanded)).toBe('holyGuard')
    expect(weaponPower(twoHanded)).toBeCloseTo(weaponPower(oneHanded) * 1.2)
    expect(toggleGrip(twoHanded)).toEqual(oneHanded)
  })

  it('routes L to each equipped offhand or main weapon skill', () => {
    expect(activeSkill(initialEquipment('assassin'))).toBe('shield')
    expect(activeSkill(toggleGrip(initialEquipment('assassin')))).toBe('flurry')
    expect(activeSkill(initialEquipment('mage'))).toBe('soulArrow')
    expect(activeSkill(initialEquipment('cleric'))).toBe('prayer')
    expect(activeSkill(toggleGrip(initialEquipment('cleric')))).toBe('blessing')
    expect(activeSkill(toggleGrip(initialEquipment('wretch')))).toBe('none')
  })

  it('swaps a weapon from the offhand into the main hand without duplicating it', () => {
    const mage = initialEquipment('mage')
    const switched = equipMain(mage, 'dagger', ownedWeapons('mage'))
    expect(switched.mainHand).toBe('dagger')
    expect(switched.offHand).toBe('apprenticeStaff')
    expect(activeSkill(switched)).toBe('daggerStep')
    expect(equipOffhand(switched, 'dagger', ownedOffhands('mage'))).toBe(switched)
  })

  it('unlocks the found dagger and refuses equipment the player does not own', () => {
    const knight = initialEquipment('knight')
    const acquired = new Set<WeaponId>(['dagger'])
    expect(equipMain(knight, 'dagger', ownedWeapons('knight'))).toBe(knight)
    expect(ownedWeapons('knight', acquired)).toContain('dagger')
    expect(equipMain(knight, 'dagger', ownedWeapons('knight', acquired)).mainHand).toBe('dagger')
    expect(equipOffhand(knight, 'travelerScripture', ownedOffhands('knight', acquired))).toBe(knight)
    expect(ownedWeapons('assassin')).toContain('thiefDagger')
    expect(ownedWeapons('knight')).not.toContain('veteranGreatsword')
    expect(equipMain(knight, 'veteranGreatsword', ownedWeapons('knight'))).toBe(knight)
    const laterWeapons = new Set<WeaponId>(['veteranGreatsword'])
    const laterOffhands = new Set<OffhandGearId>(['knightShield'])
    expect(equipMain(knight, 'veteranGreatsword', ownedWeapons('knight', laterWeapons)).mainHand)
      .toBe('veteranGreatsword')
    expect(ownedOffhands('knight', laterWeapons, laterOffhands)).toContain('knightShield')
  })

  it('applies two handed damage and the rapier reach in combat', () => {
    const knight = initialEquipment('knight')
    const twoHanded = toggleGrip(knight)
    let oneHandCombat = initialCombat()
    let twoHandCombat = initialCombat()
    for (let frame = 0; frame < 20; frame += 1) {
      oneHandCombat = stepCombat(oneHandCombat, frame === 0, 0, 0, 1, 1.5, 1 / 60,
        false, 0, false, weaponPower(knight))
      twoHandCombat = stepCombat(twoHandCombat, frame === 0, 0, 0, 1, 1.5, 1 / 60,
        false, 0, false, weaponPower(twoHanded))
    }
    expect(oneHandCombat.enemy.health).toBe(55)
    expect(twoHandCombat.enemy.health).toBe(50)
    let rapierCombat = initialCombat()
    for (let frame = 0; frame < 20; frame += 1) {
      rapierCombat = stepCombat(rapierCombat, frame === 0, 0, 0, 1, 2.3, 1 / 60,
        false, 0, false, 1, 1.6)
    }
    expect(rapierCombat.enemy.health).toBe(55)
  })
})
