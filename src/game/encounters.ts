import { initialEnemy, type EnemyState } from '../domain/enemy'
import { prisonLocations } from '../world/prisonLayout'

export const encounterIds = ['cellGuard', 'corruptedKnight', 'upper1', 'upper2', 'upper3', 'upper4',
  'inquisitor', 'warden', 'palaceGuard'] as const
export type EncounterId = typeof encounterIds[number]

export interface Encounter {
  enemy: EnemyState
  health: number
  maxHealth: number
  floorY: number
  minX: number
  maxX: number
  souls: number
  name: string
}

export function initialEncounters(): Record<EncounterId, Encounter> {
  return {
    cellGuard: { enemy: initialEnemy(-78.7, 50), health: 80, maxHealth: 80,
      floorY: 0, minX: -79.5, maxX: -76.6, souls: 30, name: '牢房疯兵' },
    corruptedKnight: { enemy: initialEnemy(-5, 200), health: 350, maxHealth: 350,
      floorY: 2.5, minX: -11, maxX: 1, souls: 300, name: '腐化骑士' },
    upper1: { enemy: initialEnemy(10), health: 80, maxHealth: 80,
      floorY: 7, minX: 7.5, maxX: 12.5, souls: 50, name: '二楼狱卒' },
    upper2: { enemy: initialEnemy(-2), health: 80, maxHealth: 80,
      floorY: 7, minX: -4.5, maxX: 0.5, souls: 50, name: '二楼狱卒' },
    upper3: { enemy: initialEnemy(-15), health: 80, maxHealth: 80,
      floorY: 7, minX: -17.5, maxX: -12.5, souls: 50, name: '二楼狱卒' },
    upper4: { enemy: initialEnemy(-27), health: 80, maxHealth: 80,
      floorY: 7, minX: -29.5, maxX: -24.5, souls: 50, name: '二楼狱卒' },
    inquisitor: { enemy: initialEnemy(prisonLocations.inquisitorX, 200), health: 400, maxHealth: 400,
      floorY: 2.5, minX: 29, maxX: 41, souls: 500, name: '责难官' },
    warden: { enemy: initialEnemy(prisonLocations.wardenX, 350), health: 1500, maxHealth: 1500,
      floorY: 7, minX: -41, maxX: -34, souls: 5000, name: '典狱长' },
    palaceGuard: { enemy: initialEnemy(prisonLocations.palaceGuardX, 100), health: 200, maxHealth: 200,
      floorY: 2.5, minX: 68, maxX: 77, souls: 200, name: '禁卫队长' },
  }
}

export function activeEncounterForRoom(
  roomId: string, playerX: number, encounters: Record<EncounterId, Encounter>,
): Encounter | null {
  if (roomId === 'InquisitorRoom') return encounters.inquisitor
  if (roomId === 'SecondFloor') return [encounters.warden, encounters.upper1, encounters.upper2,
    encounters.upper3, encounters.upper4]
    .filter(item => item.health > 0)
    .sort((a, b) => Math.abs(a.enemy.x - playerX) - Math.abs(b.enemy.x - playerX))[0] ?? null
  if (roomId === 'PalaceFoyer') return encounters.palaceGuard
  if (roomId === 'KnightCorridor') return encounters.corruptedKnight
  if (roomId === 'Cell' || roomId === 'PrisonCorridor') return encounters.cellGuard
  return null
}
