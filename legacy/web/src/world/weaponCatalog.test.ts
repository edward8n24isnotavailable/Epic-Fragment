import { describe, expect, it } from 'vitest'
import { originAttributes } from './originLoadouts'
import { offhandGear, scalingCoefficients, weaponAttack, weapons } from './weaponCatalog'

describe('GDD weapon catalog and attribute scaling', () => {
  it('contains the later weapon and offhand entries with their source locations', () => {
    expect(Object.keys(weapons)).toHaveLength(27)
    expect(Object.keys(offhandGear)).toHaveLength(10)
    expect(weapons.lorianGreatsword.source).toBe('最终 BOSS')
    expect(offhandGear.towerShield.source).toBe('皇宫主殿二层')
  })

  it('uses the GDD grade coefficients and adds multiple attribute bonuses', () => {
    expect(scalingCoefficients).toEqual({ S: 1, A: 0.7, B: 0.5, C: 0.35, D: 0.2, E: 0.1 })
    expect(weaponAttack(weapons.straightSword, originAttributes.knight)).toBeCloseTo(115.5)
    expect(weaponAttack(weapons.rapier, originAttributes.assassin)).toBeCloseTo(114)
    expect(weaponAttack(weapons.apprenticeStaff, originAttributes.mage)).toBeCloseTo(72.6)
  })

  it('includes elemental base attack before applying the scaling formula', () => {
    expect(weaponAttack(weapons.blackKnightGreatsword, originAttributes.knight)).toBeCloseTo(243.1)
    expect(weaponAttack(weapons.veteranGreatsword, originAttributes.knight)).toBeCloseTo(171.275)
  })
})
